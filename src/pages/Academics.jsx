// src/pages/Academics.jsx
//
// Public "Academics" page — a parent/student types the Student ID +
// parent/student password and gets back EVERY subject result stored for
// that student in the `results` collection, combined into one table
// (matching the mobile results screenshot: Islamic, Somali, Biology,
// Chemistry, Arabic, Geography, English, Business, History, Technology,
// Physics, Math — whatever subjects exist for that studentId).
//
// Each `results` document is one subject score (studentId, subject,
// marks, maxMarks, className, examId, ...). This page queries all docs
// where studentId == the entered ID, verifies the password against the
// student's own record in `students/{studentId}`, then checks the
// `payments` collection for that student's current-month fee status
// before releasing results — if any amount is still owed (even $1),
// results are withheld and a note tells the family exactly what's owed.

import { useState } from "react";
import "../styles/academics.css";
import logo from "../assets/logo.png";
import { Link } from "react-router-dom";
import { db } from "../firebase/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";

const NAV_LINKS = [
  { label: "Home", to: "/" },
  { label: "About Us", to: "/about" },
  { label: "Admissions", to: "/admissions" },
  { label: "Academics", to: "/academics" },
  { label: "Gallery", to: "/gallery" },
  { label: "News & Events", to: "/news" },
  { label: "Contact", to: "/contact" },
];

const ACADEMIC_YEARS = ["2025-2026", "2024-2025", "2023-2024"];

const currentMonthKey = () => new Date().toISOString().slice(0, 7); // "2026-07"

const monthLabel = (key) => {
  if (!key) return "—";
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

function gradeFor(pct) {
  if (pct >= 80) return { letter: "A", color: "#16a34a", remark: "Aad u Wanaagsan" };
  if (pct >= 70) return { letter: "B", color: "#22a05f", remark: "Aad u Wanaagsan" };
  if (pct >= 65) return { letter: "B-", color: "#65a30d", remark: "Wanaagsan" };
  if (pct >= 60) return { letter: "C+", color: "#ca8a04", remark: "Wanaagsan" };
  if (pct >= 55) return { letter: "C", color: "#d97706", remark: "Wanaagsan" };
  if (pct >= 50) return { letter: "C-", color: "#ea580c", remark: "Wanaagsan" };
  if (pct >= 40) return { letter: "D", color: "#dc2626", remark: "Ku dadaal" };
  return { letter: "F", color: "#991b1b", remark: "U baahan taageero dheeraad ah" };
}

function overallGradeFor(pct) {
  if (pct >= 80) return { letter: "A", label: "Aan (A)" };
  if (pct >= 65) return { letter: "B", label: "Fiican (B)" };
  if (pct >= 50) return { letter: "C", label: "Gudbay (C)" };
  if (pct >= 40) return { letter: "D", label: "Ku dadaal (D)" };
  return { letter: "F", label: "Dib u fadhi (F)" };
}

export default function Academics() {
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [year, setYear] = useState(ACADEMIC_YEARS[0]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [student, setStudent] = useState(null);
  const [results, setResults] = useState([]);

  // Fee-lock state — when the current month's fee isn't fully paid, we
  // stop before showing any result and surface this instead.
  const [feeBlocked, setFeeBlocked] = useState(false);
  const [feeInfo, setFeeInfo] = useState(null); // { monthlyFee, paidAmount, remaining, monthLabel }

  const resetLookup = () => {
    setStudent(null);
    setResults([]);
    setStudentId("");
    setPassword("");
    setError("");
    setFeeBlocked(false);
    setFeeInfo(null);
  };

  const handleLookup = async (e) => {
    e.preventDefault();
    setError("");
    setFeeBlocked(false);
    setFeeInfo(null);

    const idInput = studentId.trim();
    if (!idInput) {
      setError("Fadlan geli Lambarka Ardayga (Student ID).");
      return;
    }
    if (!password.trim()) {
      setError("Fadlan geli Password-ka.");
      return;
    }

    // Student IDs are stored zero-padded (e.g. "0004") — accept either
    // "4" or "0004" from the input.
    const paddedId = idInput.padStart(4, "0");

    try {
      setLoading(true);

      const studentSnap = await getDoc(doc(db, "students", paddedId));
      if (!studentSnap.exists()) {
        setError("Lambarka Ardayga lama helin. Fadlan hubi oo isku day mar kale.");
        setLoading(false);
        return;
      }

      const studentData = studentSnap.data();

      // Password check — matches the same field AddStudent.jsx saves
      // (parentPassword) against what the student/parent types in.
      if (String(studentData.parentPassword || "") !== password.trim()) {
        setError("Password-ku waa khalad. Fadlan isku day mar kale.");
        setLoading(false);
        return;
      }

      // ---- Fee gate: block results unless the current month is fully
      // paid. Free students (feeType === "Free") always pass through —
      // there is nothing owed to check. Paid students must have a
      // `payments/{studentId}_{monthKey}` doc with status "Paid" and
      // remaining <= 0; even $1 still owed withholds the results. ----
      if (studentData.feeType !== "Free") {
        const monthKey = currentMonthKey();
        const paymentDocId = `${paddedId}_${monthKey}`;
        const paymentSnap = await getDoc(doc(db, "payments", paymentDocId));

        const monthlyFee = Number(studentData.monthlyFee || 0);
        const paidAmount = paymentSnap.exists()
          ? Number(paymentSnap.data().paidAmount || 0)
          : 0;
        const remaining = Math.max(monthlyFee - paidAmount, 0);
        const isFullyPaid =
          paymentSnap.exists() &&
          paymentSnap.data().status === "Paid" &&
          remaining <= 0;

        if (!isFullyPaid) {
          setFeeBlocked(true);
          setFeeInfo({
            monthlyFee,
            paidAmount,
            remaining,
            monthLabel: monthLabel(monthKey),
          });
          setLoading(false);
          return;
        }
      }

      // Pull every subject result stored for this student, across all
      // exams — the studentId field on each results doc is what ties
      // them together, exactly as written by the teacher's Results page.
      const resultsSnap = await getDocs(
        query(collection(db, "results"), where("studentId", "==", paddedId))
      );

      const subjectRows = resultsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((r) => r.subject && String(r.subject).trim() !== "");

      // If the same subject appears more than once (re-takes, multiple
      // exams), keep only the most recently updated one per subject so
      // the table shows one row per subject like the reference screen.
      const bySubject = {};
      subjectRows.forEach((r) => {
        const key = String(r.subject).toLowerCase();
        const existing = bySubject[key];
        const rTime = r.updatedAt?.seconds || 0;
        const eTime = existing?.updatedAt?.seconds || 0;
        if (!existing || rTime >= eTime) {
          bySubject[key] = r;
        }
      });

      const combined = Object.values(bySubject).sort((a, b) =>
        String(a.subject).localeCompare(String(b.subject))
      );

      setStudent({ ...studentData, studentId: paddedId });
      setResults(combined);

      if (combined.length === 0) {
        setError(
          "Ardaygan weli natiijo lagama helin xilligan la doortay. Fadlan la xiriir maamulka."
        );
      }
    } catch (err) {
      console.error(err);
      setError("Khalad ayaa dhacay. Fadlan isku day mar kale.");
    } finally {
      setLoading(false);
    }
  };

  const totalMarks = results.reduce((sum, r) => sum + (Number(r.marks) || 0), 0);
  const totalMax = results.reduce((sum, r) => sum + (Number(r.maxMarks) || 0), 0);
  const averagePct = totalMax > 0 ? (totalMarks / totalMax) * 100 : 0;
  const overall = overallGradeFor(averagePct);

  return (
    <div className="aca-page">
      <header className="home-nav">
        <Link to="/" className="brand">
          <img src={logo} className="brand-logo" alt="Rising Star School logo" />
          <div className="brand-text">
            <span className="brand-name">RISING STAR SCHOOL</span>
            <span className="brand-tagline">
              RISING STAR PRIMARY &amp; SECONDARY SCHOOL
            </span>
          </div>
        </Link>

        <nav className="home-nav-links">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={
                "home-nav-link" + (l.to === "/academics" ? " active" : "")
              }
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="header-actions">
          <div className="menu-wrap">
            <Link to="/admin-login" className="login-portal-btn">
              <span className="login-portal-icon">Login</span>
              Login / Portal
            </Link>
          </div>
        </div>
      </header>

      <section className="aca-hero">
        <div className="aca-hero-badge">Academics</div>
        <h1 className="aca-hero-title">Check Student Results</h1>
        <p className="aca-hero-sub">
          Enter the Student ID and password to view every subject result
          for the selected academic year.
        </p>
      </section>

      <div className="aca-content">
        <div className="aca-lookup-card">
          <h2 className="aca-lookup-title">Tira-taxaneha Ardeyga</h2>
          <p className="aca-lookup-sub">
            U gudub aragtida natiijadaada — geli lambarkaaga iyo password-kaaga.
          </p>

          <form onSubmit={handleLookup}>
            <div className="aca-lookup-grid">
              <div className="aca-field">
                <label>Student ID</label>
                <input
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="e.g. 0004"
                />
              </div>
              <div className="aca-field">
                <label>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <div className="aca-field">
                <label>Academic Year</label>
                <select value={year} onChange={(e) => setYear(e.target.value)}>
                  {ACADEMIC_YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button type="submit" className="aca-lookup-btn" disabled={loading}>
              {loading ? "Sugaya..." : "U Gudub Aragtida Natiijadaada"}
            </button>

            {error && <div className="aca-error">{error}</div>}
          </form>
        </div>

        {feeBlocked && feeInfo && (
          <div className="aca-results-card">
            <div className="aca-fee-lock">
              <div className="aca-fee-lock-icon">🔒</div>
              <h3 className="aca-fee-lock-title">
                Natiijada Waa La Xiray — Fee Bishaan ({feeInfo.monthLabel})
              </h3>
              <p className="aca-fee-lock-text">
                Ardaygan wali wuxuu ka leeyahay lacagta dugsiga bishan{" "}
                <strong>${feeInfo.remaining.toFixed(2)}</strong> oo aan la
                bixin. Natiijada ma la soo bandhigi karo ilaa lacagta oo
                dhan la bixiyo.
              </p>
              <div className="aca-fee-lock-grid">
                <div className="aca-fee-lock-box">
                  <div className="aca-fee-lock-label">Fee-ga Bishii</div>
                  <div className="aca-fee-lock-value">
                    ${feeInfo.monthlyFee.toFixed(2)}
                  </div>
                </div>
                <div className="aca-fee-lock-box">
                  <div className="aca-fee-lock-label">La Bixiyay</div>
                  <div className="aca-fee-lock-value">
                    ${feeInfo.paidAmount.toFixed(2)}
                  </div>
                </div>
                <div className="aca-fee-lock-box owed">
                  <div className="aca-fee-lock-label">Haray</div>
                  <div className="aca-fee-lock-value">
                    ${feeInfo.remaining.toFixed(2)}
                  </div>
                </div>
              </div>
              <p className="aca-fee-lock-note">
                Fadlan la xiriir Cashier-ka dugsiga si aad lacagta u bixiso,
                kadibna dib u isku day.
              </p>
            </div>
          </div>
        )}

        {student && results.length > 0 && (
          <div className="aca-results-card">
            <div className="aca-student-banner">
              <div className="aca-student-info">
                <span className="aca-student-name">
                  {student.fullName || "—"}
                </span>
                <span className="aca-student-meta">
                  Student ID: {student.studentId} &nbsp;•&nbsp; Class:{" "}
                  {student.className || "—"} &nbsp;•&nbsp; {year}
                </span>
              </div>
              <button className="aca-logout-btn" onClick={resetLookup}>
                Log Out
              </button>
            </div>

            <div className="aca-table-wrap">
              <table className="aca-table">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Marks (out of {results[0]?.maxMarks || 100})</th>
                    <th>Grade</th>
                    <th>Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => {
                    const max = Number(r.maxMarks) || 100;
                    const marks = Number(r.marks) || 0;
                    const pct = max > 0 ? (marks / max) * 100 : 0;
                    const g = gradeFor(pct);
                    return (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 700, textTransform: "capitalize" }}>
                          {r.subject}
                        </td>
                        <td>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                            }}
                          >
                            <span>{pct.toFixed(1)}</span>
                            <div className="aca-bar-track">
                              <div
                                className="aca-bar-fill"
                                style={{
                                  width: `${Math.min(pct, 100)}%`,
                                  background: g.color,
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td>
                          <span
                            className="aca-grade-dot"
                            style={{ color: g.color }}
                          >
                            {g.letter}
                          </span>
                        </td>
                        <td>{g.remark}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="aca-summary-grid">
              <div className="aca-summary-box blue">
                <div className="aca-summary-label">WADARTA</div>
                <div className="aca-summary-value">{totalMarks.toFixed(1)}</div>
              </div>
              <div className="aca-summary-box green">
                <div className="aca-summary-label">CELCELISKA</div>
                <div className="aca-summary-value">{averagePct.toFixed(1)}</div>
              </div>
              <div className="aca-summary-box gold">
                <div className="aca-summary-label">GO'AANKA</div>
                <div className="aca-summary-value grade-good">
                  {overall.label}
                </div>
              </div>
            </div>

            <div className="aca-remark-box">
              {student.fullName || "Ardaygan"}, waxaad muujisay natiijo{" "}
              {averagePct >= 65
                ? "aad u wanaagsan. Waxaad ku guulaysatay inaad noqoto ardayda ugu fiican fasalka! Horumar wanaagsan!"
                : averagePct >= 50
                ? "wanaagsan. Sii wad dadaalka si aad u horumariso natiijadaada."
                : "u baahan dadaal dheeraad ah. Fadlan la xiriir macalinka fasalka si taageero loo helo."}
            </div>
          </div>
        )}

        {student && results.length === 0 && !error && !feeBlocked && (
          <div className="aca-results-card">
            <p className="aca-empty">
              Natiijo lama helin ardaygan xilligan la doortay.
            </p>
          </div>
        )}
      </div>

      <footer className="home-footer">
        <div className="home-footer-left">
          <img src={logo} className="footer-logo" alt="Rising Star School logo" />
          <div>
            <div className="footer-school-name">RISING STAR SCHOOL</div>
            <div className="footer-school-tagline">
              RISING STAR PRIMARY &amp; SECONDARY SCHOOL
            </div>
          </div>
        </div>

        <div className="home-footer-contact">
          <a href="tel:+252611234567">+252 61 7390261</a>
          <a href="mailto:risingstar0261@gmail.com">risingstar0261@gmail.com</a>
          <span>Mogadishu, Somalia</span>
        </div>

        <div className="home-footer-quote">
          Excellence in Education, Bright Future for Every Child.
        </div>
      </footer>
    </div>
  );
}