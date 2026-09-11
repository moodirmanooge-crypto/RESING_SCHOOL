// src/pages/Academics.jsx
//
// Public "Academics" page — supports both Full Time and Part Time students
// looking up their results using Student ID + parent/student password.

import { useState, useEffect } from "react";
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
import { Hash, User, Building2, BarChart3, Award, GraduationCap } from "lucide-react";

const SCHOOL_NAME = "RISING STAR SCHOOL";

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

const currentMonthKey = () => new Date().toISOString().slice(0, 7); // "2026-09"

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
  if (pct >= 30) return { letter: "E", color: "#b91c1c", remark: "U baahan taageero dheeraad ah" };
  return { letter: "F", color: "#991b1b", remark: "U baahan taageero dheeraad ah" };
}

// Go'aanka ugu dambeeya: Celceliska (average) haddii uu yahay D ama ka sarreeya
// (A/B/B-/C+/C/C-/D) waa la GUDBAY; haddii uu yahay E ama F waa la DHACAY.
function verdictFor(letter) {
  if (letter === "E" || letter === "F") {
    return { label: "Ku Dhacay", color: "#dc2626" };
  }
  return { label: "Gudbay", color: "#16a34a" };
}

export default function Academics() {
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [year, setYear] = useState(ACADEMIC_YEARS[0]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [student, setStudent] = useState(null);
  const [results, setResults] = useState([]);

  const [showCelebration, setShowCelebration] = useState(false);
  const [feeBlocked, setFeeBlocked] = useState(false);
  const [feeInfo, setFeeInfo] = useState(null);

  // ---- Xannib: F12, right-click, iyo shortcut-yada developer tools ----
  useEffect(() => {
    function handleContextMenu(e) {
      e.preventDefault();
    }

    function handleKeyDown(e) {
      const key = (e.key || "").toLowerCase();

      if (key === "f12") {
        e.preventDefault();
        return;
      }

      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (key === "i" || key === "j" || key === "c")
      ) {
        e.preventDefault();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (key === "u" || key === "s")) {
        e.preventDefault();
        return;
      }
    }

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const resetLookup = () => {
    setStudent(null);
    setResults([]);
    setStudentId("");
    setPassword("");
    setError("");
    setFeeBlocked(false);
    setFeeInfo(null);
    setShowCelebration(false);
  };

  const handleLookup = async (e) => {
    e.preventDefault();
    setError("");
    setFeeBlocked(false);
    setFeeInfo(null);
    setShowCelebration(false);

    const idInput = studentId.trim();
    if (!idInput) {
      setError("Fadlan geli Lambarka Ardayga (Student ID).");
      return;
    }
    if (!password.trim()) {
      setError("Fadlan geli Password-ka.");
      return;
    }

    try {
      setLoading(true);

      let foundStudentData = null;
      let finalStudentId = idInput;

      // Raadin sugan oo ka baadi-goobaysa collection-yada 'students' iyo 'partTimeStudents'
      async function findStudentInCollection(collName, targetId) {
        const variants = [
          targetId,
          targetId.toUpperCase(),
          targetId.toLowerCase(),
          targetId.padStart(4, "0"),
        ];

        // 1. Ku baaro Document ID ahaan
        for (const v of variants) {
          const snap = await getDoc(doc(db, collName, v));
          if (snap.exists()) {
            return { id: snap.id, data: snap.data() };
          }
        }

        // 2. Ku baaro 'studentId' field ahaan
        for (const v of variants) {
          const q = query(collection(db, collName), where("studentId", "==", v));
          const querySnap = await getDocs(q);
          if (!querySnap.empty) {
            const d = querySnap.docs[0];
            return { id: d.id, data: d.data() };
          }
        }
        return null;
      }

      // Marka hore ka raadi 'students' kadibna 'partTimeStudents' (Private)
      let match = await findStudentInCollection("students", idInput);
      if (!match) {
        match = await findStudentInCollection("partTimeStudents", idInput);
      }

      if (!match) {
        setError("Lambarka Ardayga lama helin. Fadlan hubi oo isku day mar kale.");
        setLoading(false);
        return;
      }

      foundStudentData = match.data;
      finalStudentId = match.id || match.data.studentId || idInput;

      // Password check (Taageeraya labada field ee kala ah 'password' ama 'parentPassword')
      const dbPassword = String(
        foundStudentData.password || foundStudentData.parentPassword || ""
      );
      if (dbPassword !== password.trim()) {
        setError("Password-ku waa khalad. Fadlan isku day mar kale.");
        setLoading(false);
        return;
      }

      // ---- Fee gate: Hubinta lacagta bisha ----
      if (foundStudentData.feeType !== "Free") {
        const monthKey = currentMonthKey();
        const paymentDocId = `${finalStudentId}_${monthKey}`;
        const paymentSnap = await getDoc(doc(db, "payments", paymentDocId));

        const monthlyFee = Number(foundStudentData.monthlyFee || 0);
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

      // Soo qaadashada natiijooyinka ardaygan
      const resultsSnap = await getDocs(
        query(collection(db, "results"), where("studentId", "==", finalStudentId))
      );

      const subjectRows = resultsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((r) => r.subject && String(r.subject).trim() !== "");

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

      const combined = Object.values(bySubject).sort((a, b) => {
        const aMax = Number(a.maxMarks) || 100;
        const bMax = Number(b.maxMarks) || 100;
        const aPct = aMax > 0 ? (Number(a.marks) || 0) / aMax : 0;
        const bPct = bMax > 0 ? (Number(b.marks) || 0) / bMax : 0;
        return bPct - aPct;
      });

      setStudent({ ...foundStudentData, studentId: finalStudentId });
      setResults(combined);

      if (combined.length > 0) {
        const tMarks = combined.reduce((s, r) => s + (Number(r.marks) || 0), 0);
        const tMax = combined.reduce((s, r) => s + (Number(r.maxMarks) || 0), 0);
        const avg = tMax > 0 ? (tMarks / tMax) * 100 : 0;
        if (avg >= 65) {
          setShowCelebration(true);
        }
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
  const averageGrade = gradeFor(averagePct);
  const verdict = verdictFor(averageGrade.letter);
  const halfway = Math.ceil(results.length / 2);
  const resultsColLeft = results.slice(0, halfway);
  const resultsColRight = results.slice(halfway);

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
              <span className="login-portal-icon">👤</span>
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
                  placeholder="e.g. 0004 or R001"
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

        {student && (
          <div className="report-card-wrap">
            {results.length === 0 ? (
              <div className="aca-results-card">
                <div style={{ padding: "40px 20px", textAlign: "center", color: "#475569" }}>
                  <div style={{ fontSize: "45px", marginBottom: "12px" }}>📭</div>
                  <h3 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "8px", color: "#1e293b" }}>
                    Lama helin imtixaankaaga
                  </h3>
                  <p style={{ fontSize: "14px", color: "#64748b" }}>
                    Ardaygan weli natiijo lagama gelin xilligan ama sanadkan la doortay ({year}).
                  </p>
                  <button className="aca-logout-btn" onClick={resetLookup} style={{ marginTop: 18 }}>
                    Log Out
                  </button>
                </div>
              </div>
            ) : (
              <>
                {showCelebration && (
                  <div className="aca-celebrate-banner">
                    <div className="aca-confetti" aria-hidden="true">
                      {Array.from({ length: 30 }).map((_, i) => (
                        <span
                          key={i}
                          className="aca-confetti-piece"
                          style={{
                            left: `${Math.random() * 100}%`,
                            background: [
                              "#f97316",
                              "#22a05f",
                              "#2563eb",
                              "#eab308",
                              "#7c3aed",
                              "#ec4899",
                            ][i % 6],
                            animationDelay: `${Math.random() * 2}s`,
                            animationDuration: `${2.5 + Math.random() * 2}s`,
                          }}
                        />
                      ))}
                    </div>
                    <div className="aca-celebrate-banner-inner">
                      <div className="aca-celebrate-trophy">🏆</div>
                      <div className="aca-celebrate-banner-text">
                        <h3 className="aca-celebrate-title">Hambalyo!</h3>
                        <p className="aca-celebrate-sub">Horumar Wacan!</p>
                        <p className="aca-celebrate-text">
                          {student?.fullName || "Ardaygan"}, waxaad gaadhay
                          celceliska <strong>{averagePct.toFixed(1)}%</strong> —
                          waxaad ka mid tahay ardayda ugu fiican! Sii wad shaqadan
                          wanaagsan.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="report-card">
                  <div className="report-card-header">
                    <div className="report-card-header-left">
                      <GraduationCap size={38} className="report-card-header-icon" />
                      <div>
                        <h2 className="report-card-title">WARQADDA NATIJAADA</h2>
                        <p className="report-card-subtitle">STUDENT REPORT CARD</p>
                      </div>
                    </div>
                    <div className="report-card-ribbon">
                      <GraduationCap size={20} />
                      <span>Waxbarasho Mustaqbal Wanaagsan</span>
                    </div>
                  </div>

                  <div className="report-info-card">
                    <div className="report-info-row">
                      <span className="report-info-icon"><Hash size={18} /></span>
                      <span className="report-info-label">Rool Lambar</span>
                      <span className="report-info-colon">:</span>
                      <span className="report-info-value">{student.studentId}</span>
                    </div>
                    <div className="report-info-row">
                      <span className="report-info-icon"><User size={18} /></span>
                      <span className="report-info-label">M. Ardayga</span>
                      <span className="report-info-colon">:</span>
                      <span className="report-info-value">{student.fullName || "—"}</span>
                    </div>
                    <div className="report-info-row">
                      <span className="report-info-icon"><Building2 size={18} /></span>
                      <span className="report-info-label">Dugsiga</span>
                      <span className="report-info-colon">:</span>
                      <span className="report-info-value">{SCHOOL_NAME}</span>
                    </div>
                    <div className="report-info-row">
                      <span className="report-info-icon"><BarChart3 size={18} /></span>
                      <span className="report-info-label">Celceliska</span>
                      <span className="report-info-colon">:</span>
                      <span className="report-info-value">{averageGrade.letter}</span>
                    </div>
                    <div className="report-info-row">
                      <span className="report-info-icon"><Award size={18} /></span>
                      <span className="report-info-label">Go'aan</span>
                      <span className="report-info-colon">:</span>
                      <span className="report-info-value" style={{ color: verdict.color }}>{verdict.label}</span>
                    </div>
                  </div>

                  <div className="report-subjects-grid">
                    <table className="report-subjects-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>MAADADA</th>
                          <th>DARAJO</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultsColLeft.map((r, i) => {
                          const max = Number(r.maxMarks) || 100;
                          const marks = Number(r.marks) || 0;
                          const pct = max > 0 ? (marks / max) * 100 : 0;
                          const g = gradeFor(pct);
                          return (
                            <tr key={r.id}>
                              <td className="report-subj-num">{i + 1}</td>
                              <td className="report-subj-name">{r.subject}</td>
                              <td>
                                <span className="grade-pill" style={{ "--pill-color": g.color }}>{g.letter}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    <table className="report-subjects-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>MAADADA</th>
                          <th>DARAJO</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultsColRight.map((r, i) => {
                          const max = Number(r.maxMarks) || 100;
                          const marks = Number(r.marks) || 0;
                          const pct = max > 0 ? (marks / max) * 100 : 0;
                          const g = gradeFor(pct);
                          return (
                            <tr key={r.id}>
                              <td className="report-subj-num">{halfway + i + 1}</td>
                              <td className="report-subj-name">{r.subject}</td>
                              <td>
                                <span className="grade-pill" style={{ "--pill-color": g.color }}>{g.letter}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="report-footer-grid">
                    <div className="report-quote-box">
                      <GraduationCap size={22} />
                      <p>"Aqoontu waa iftiin, waa furaha mustaqbalka."</p>
                    </div>
                    <div className="report-encourage-box">
                      <BarChart3 size={22} />
                      <p>Ku dadaal horumar ka wanaagsan!</p>
                    </div>
                  </div>
                </div>

                <div className="report-card-actions">
                  <button className="aca-logout-btn" onClick={resetLookup}>Log Out</button>
                </div>
              </>
            )}
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
          <a href="tel:+252617390261">+252 61 7390261</a>
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