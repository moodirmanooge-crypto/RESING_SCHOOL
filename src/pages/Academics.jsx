// src/pages/Academics.jsx
//
// Public "Academics" page — Full Time iyo Part Time ardayda waxay ku
// eegayaan natiijadooda Student ID + password.
//
// Natiijadu waxay ka furmaysaa SHAASHAD GOONI AH (full-screen) oo dul
// fadhida bogga — scroll hoos uma baahna. Waxay muujinaysaa:
//   - 4-ta imtixaan (Monthly One, Term, Monthly Two, Final) mid mid
//   - Dhibcaha saxda ah ee macalimiintu soo gudbiyeen (tusaale 45 / 50)
//   - Wadarta imtixaan kasta iyo wadarta guud ee dhammaan imtixaannada

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
import {
  X,
  Printer,
  Layers,
  BookOpen,
  Trophy,
  TrendingUp,
  TrendingDown,
  Hash,
  School,
  User,
} from "lucide-react";

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

// 4-ta imtixaan ee dugsiga, sida ay u kala horreeyaan sanadka
const EXAM_ORDER = ["Monthly One", "Term", "Monthly Two", "Final"];
const EXAM_COLORS = {
  "Monthly One": "#2563eb",
  Term: "#7c3aed",
  "Monthly Two": "#0891b2",
  Final: "#ea580c",
};
const EXAM_SHORT = {
  "Monthly One": "M1",
  Term: "Term",
  "Monthly Two": "M2",
  Final: "Final",
};

const currentMonthKey = () => new Date().toISOString().slice(0, 7);

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

// D ama ka sarreeya = Gudbay; E ama F = Ku Dhacay
function verdictFor(letter) {
  if (letter === "E" || letter === "F") return { label: "Ku Dhacay", color: "#dc2626" };
  return { label: "Gudbay", color: "#16a34a" };
}

const fmt = (n) => {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
};
const pctOf = (marks, max) => (max > 0 ? (marks / max) * 100 : 0);
const tsOf = (r) => {
  const u = r?.updatedAt;
  if (!u) return 0;
  if (typeof u.seconds === "number") return u.seconds;
  const d = u instanceof Date ? u : new Date(u);
  return isNaN(d) ? 0 : d.getTime() / 1000;
};

// Natiijooyinka u kala saar: imtixaan -> maado (kan ugu dambeeyay maado kasta)
function buildReport(rows) {
  const byExam = {};
  rows.forEach((r) => {
    const subject = String(r.subject || "").trim();
    if (!subject) return;
    const type = String(r.examType || "").trim() || "Exam";
    const key = subject.toLowerCase();
    byExam[type] = byExam[type] || {};
    const prev = byExam[type][key];
    if (!prev || tsOf(r) >= tsOf(prev)) {
      byExam[type][key] = {
        subject,
        marks: Number(r.marks) || 0,
        maxMarks: Number(r.maxMarks) || 100,
        teacherName: r.teacherName || "",
        updatedAt: r.updatedAt,
      };
    }
  });

  // Had iyo jeer 4-ta imtixaan; nooc kale haddii uu jiro dabadooda ayuu galayaa
  const extraTypes = Object.keys(byExam).filter((t) => !EXAM_ORDER.includes(t));
  const examTypes = [...EXAM_ORDER, ...extraTypes];

  const exams = examTypes.map((type) => {
    const subjects = Object.values(byExam[type] || {}).sort((a, b) =>
      a.subject.localeCompare(b.subject)
    );
    const total = subjects.reduce((s, x) => s + x.marks, 0);
    const max = subjects.reduce((s, x) => s + x.maxMarks, 0);
    const pct = pctOf(total, max);
    return {
      type,
      color: EXAM_COLORS[type] || "#475569",
      short: EXAM_SHORT[type] || type,
      subjects,
      total,
      max,
      pct,
      grade: gradeFor(pct),
      hasData: subjects.length > 0,
    };
  });

  // Liiska maadooyinka oo dhan (isku dar)
  const subjectNames = {};
  exams.forEach((e) =>
    e.subjects.forEach((s) => {
      subjectNames[s.subject.toLowerCase()] = s.subject;
    })
  );

  const combined = Object.entries(subjectNames)
    .map(([key, name]) => {
      const perExam = {};
      let total = 0;
      let max = 0;
      exams.forEach((e) => {
        const hit = e.subjects.find((s) => s.subject.toLowerCase() === key);
        if (hit) {
          perExam[e.type] = hit;
          total += hit.marks;
          max += hit.maxMarks;
        }
      });
      const pct = pctOf(total, max);
      return { subject: name, perExam, total, max, pct, grade: gradeFor(pct) };
    })
    .sort((a, b) => b.pct - a.pct);

  const grandTotal = exams.reduce((s, e) => s + e.total, 0);
  const grandMax = exams.reduce((s, e) => s + e.max, 0);
  const grandPct = pctOf(grandTotal, grandMax);

  return {
    exams,
    combined,
    grandTotal,
    grandMax,
    grandPct,
    grandGrade: gradeFor(grandPct),
    examsTaken: exams.filter((e) => e.hasData).length,
    hasAny: combined.length > 0,
  };
}

function ScoreRing({ pct, color, size = 132, label = "Guud" }) {
  const stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (Math.min(Math.max(pct, 0), 100) / 100) * c;
  return (
    <div className="acr-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="acr-ring-progress"
        />
      </svg>
      <div className="acr-ring-label">
        <strong>{pct.toFixed(1)}%</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function Bar({ pct, color }) {
  return (
    <div className="acr-bar">
      <div
        className="acr-bar-fill"
        style={{ width: `${Math.min(pct, 100)}%`, background: color }}
      />
    </div>
  );
}

function GradePill({ grade }) {
  return (
    <span className="acr-pill" style={{ "--pill": grade.color }}>
      {grade.letter}
    </span>
  );
}

export default function Academics() {
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [year, setYear] = useState(ACADEMIC_YEARS[0]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [student, setStudent] = useState(null);
  const [report, setReport] = useState(null);
  const [activeTab, setActiveTab] = useState("all");

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
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (key === "i" || key === "j" || key === "c")) {
        e.preventDefault();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (key === "u" || key === "s")) {
        e.preventDefault();
      }
    }
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Marka shaashadda natiijadu furan tahay, bogga hoose ha scroll-gareyn,
  // Escape-na ha xiro.
  const overlayOpen = Boolean(student && report);
  useEffect(() => {
    if (!overlayOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onEsc = (e) => {
      if (e.key === "Escape") resetLookup();
    };
    document.addEventListener("keydown", onEsc);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onEsc);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlayOpen]);

  function resetLookup() {
    setStudent(null);
    setReport(null);
    setStudentId("");
    setPassword("");
    setError("");
    setFeeBlocked(false);
    setFeeInfo(null);
    setActiveTab("all");
  }

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

    try {
      setLoading(true);

      async function findStudentInCollection(collName, targetId) {
        const variants = Array.from(
          new Set([
            targetId,
            targetId.toUpperCase(),
            targetId.toLowerCase(),
            targetId.padStart(4, "0"),
          ])
        );
        for (const v of variants) {
          const snap = await getDoc(doc(db, collName, v));
          if (snap.exists()) return { id: snap.id, data: snap.data() };
        }
        for (const v of variants) {
          const qs = await getDocs(
            query(collection(db, collName), where("studentId", "==", v))
          );
          if (!qs.empty) return { id: qs.docs[0].id, data: qs.docs[0].data() };
        }
        return null;
      }

      let studentType = "Full Time";
      let match = await findStudentInCollection("students", idInput);
      if (!match) {
        match = await findStudentInCollection("partTimeStudents", idInput);
        studentType = "Part Time";
      }

      if (!match) {
        setError("Lambarka Ardayga lama helin. Fadlan hubi oo isku day mar kale.");
        return;
      }

      const data = match.data;
      const finalStudentId = match.id || data.studentId || idInput;

      const dbPassword = String(data.password || data.parentPassword || "");
      if (dbPassword !== password.trim()) {
        setError("Password-ku waa khalad. Fadlan isku day mar kale.");
        return;
      }

      // ---- Fee gate ----
      if (data.feeType !== "Free") {
        const monthKey = currentMonthKey();
        const paymentSnap = await getDoc(doc(db, "payments", `${finalStudentId}_${monthKey}`));
        const monthlyFee = Number(data.monthlyFee || 0);
        const paidAmount = paymentSnap.exists() ? Number(paymentSnap.data().paidAmount || 0) : 0;
        const remaining = Math.max(monthlyFee - paidAmount, 0);
        const isFullyPaid =
          paymentSnap.exists() && paymentSnap.data().status === "Paid" && remaining <= 0;

        if (!isFullyPaid) {
          setFeeBlocked(true);
          setFeeInfo({ monthlyFee, paidAmount, remaining, monthLabel: monthLabel(monthKey) });
          return;
        }
      }

      // Natiijooyinka labada collection ka soo qaad (results + resultsPartTime),
      // si aan natiijo looga waayin haddii mid si khaldan loogu kaydiyay.
      const [ftSnap, ptSnap] = await Promise.all([
        getDocs(query(collection(db, "results"), where("studentId", "==", finalStudentId))),
        getDocs(query(collection(db, "resultsPartTime"), where("studentId", "==", finalStudentId))),
      ]);
      const rows = [...ftSnap.docs, ...ptSnap.docs].map((d) => ({ id: d.id, ...d.data() }));

      setStudent({ ...data, studentId: data.studentId || finalStudentId, studentType });
      setReport(buildReport(rows));
      setActiveTab("all");
    } catch (err) {
      console.error(err);
      setError("Khalad ayaa dhacay. Fadlan isku day mar kale.");
    } finally {
      setLoading(false);
    }
  };

  const activeExam =
    report && activeTab !== "all" ? report.exams.find((x) => x.type === activeTab) : null;
  const verdict = report ? verdictFor(report.grandGrade.letter) : null;
  const celebrate = report && report.hasAny && report.grandPct >= 65;
  const bestSubject = report?.combined[0];
  const weakSubject =
    report && report.combined.length > 1 ? report.combined[report.combined.length - 1] : null;

  return (
    <div className="aca-page">
      <header className="home-nav">
        <Link to="/" className="brand">
          <img src={logo} className="brand-logo" alt="Rising Star School logo" />
          <div className="brand-text">
            <span className="brand-name">RISING STAR SCHOOL</span>
            <span className="brand-tagline">RISING STAR PRIMARY &amp; SECONDARY SCHOOL</span>
          </div>
        </Link>

        <nav className="home-nav-links">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={"home-nav-link" + (l.to === "/academics" ? " active" : "")}
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
          Geli Student ID-ga iyo password-ka si aad u aragto natiijada dhammaan
          imtixaannada — Monthly One, Term, Monthly Two iyo Final.
        </p>
      </section>

      <div className="aca-content">
        <div className="aca-lookup-card">
          <h2 className="aca-lookup-title">Tira-taxaneha Ardayga</h2>
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
                <strong>${feeInfo.remaining.toFixed(2)}</strong> oo aan la bixin. Natiijada
                ma la soo bandhigi karo ilaa lacagta oo dhan la bixiyo.
              </p>
              <div className="aca-fee-lock-grid">
                <div className="aca-fee-lock-box">
                  <div className="aca-fee-lock-label">Fee-ga Bishii</div>
                  <div className="aca-fee-lock-value">${feeInfo.monthlyFee.toFixed(2)}</div>
                </div>
                <div className="aca-fee-lock-box">
                  <div className="aca-fee-lock-label">La Bixiyay</div>
                  <div className="aca-fee-lock-value">${feeInfo.paidAmount.toFixed(2)}</div>
                </div>
                <div className="aca-fee-lock-box owed">
                  <div className="aca-fee-lock-label">Haray</div>
                  <div className="aca-fee-lock-value">${feeInfo.remaining.toFixed(2)}</div>
                </div>
              </div>
              <p className="aca-fee-lock-note">
                Fadlan la xiriir Cashier-ka dugsiga si aad lacagta u bixiso, kadibna dib u isku day.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ================= SHAASHADDA NATIIJADA (full-screen) ================= */}
      {overlayOpen && (
        <div className="acr-overlay" role="dialog" aria-modal="true">
          <div className="acr-shell">
            {/* Top bar */}
            <div className="acr-topbar acr-noprint">
              <div className="acr-topbar-brand">
                <img src={logo} alt="" />
                <div>
                  <strong>{SCHOOL_NAME}</strong>
                  <span>Warqadda Natiijada · {year}</span>
                </div>
              </div>
              <div className="acr-topbar-actions">
                <button type="button" className="acr-icon-btn" onClick={() => window.print()}>
                  <Printer size={17} /> <span>Print</span>
                </button>
                <button type="button" className="acr-icon-btn acr-close" onClick={resetLookup}>
                  <X size={18} /> <span>Xir</span>
                </button>
              </div>
            </div>

            <div className="acr-scroll">
              {/* Hero: ardayga + wadarta guud */}
              <section className="acr-hero">
                {celebrate && (
                  <div className="acr-confetti" aria-hidden="true">
                    {Array.from({ length: 26 }).map((_, i) => (
                      <span
                        key={i}
                        style={{
                          left: `${(i * 37) % 100}%`,
                          background: ["#facc15", "#34d399", "#60a5fa", "#f472b6", "#fb923c"][i % 5],
                          animationDelay: `${(i % 9) * 0.3}s`,
                          animationDuration: `${3 + (i % 5) * 0.5}s`,
                        }}
                      />
                    ))}
                  </div>
                )}

                <div className="acr-hero-main">
                  <div className="acr-avatar">
                    {(student.fullName || "?").trim().charAt(0).toUpperCase()}
                  </div>
                  <div className="acr-hero-info">
                    {celebrate && <div className="acr-congrats">🏆 Hambalyo! Horumar Wacan</div>}
                    <h2>{student.fullName || "—"}</h2>
                    <div className="acr-chips">
                      <span><Hash size={13} /> {student.studentId}</span>
                      {student.className && <span><School size={13} /> Fasalka {student.className}</span>}
                      <span><User size={13} /> {student.studentType}</span>
                    </div>
                  </div>
                </div>

                {report.hasAny && (
                  <div className="acr-hero-score">
                    <ScoreRing pct={report.grandPct} color="#facc15" />
                    <div className="acr-hero-stats">
                      <div>
                        <span>Wadarta Guud</span>
                        <strong>
                          {fmt(report.grandTotal)} <small>/ {fmt(report.grandMax)}</small>
                        </strong>
                      </div>
                      <div>
                        <span>Darajada Guud</span>
                        <strong>{report.grandGrade.letter}</strong>
                      </div>
                      <div>
                        <span>Go'aan</span>
                        <strong className={verdict.label === "Gudbay" ? "ok" : "bad"}>
                          {verdict.label}
                        </strong>
                      </div>
                      <div>
                        <span>Imtixaanno</span>
                        <strong>
                          {report.examsTaken} <small>/ {EXAM_ORDER.length}</small>
                        </strong>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {!report.hasAny ? (
                <div className="acr-empty">
                  <div className="acr-empty-icon">📭</div>
                  <h3>Weli natiijo lama soo gelin</h3>
                  <p>
                    Macalimiintu weli ma soo gudbin natiijada ardaygan ({year}). Fadlan dib u
                    eeg marka imtixaannada la saxo.
                  </p>
                </div>
              ) : (
                <>
                  {/* Tabs */}
                  <div className="acr-tabs acr-noprint">
                    <button
                      type="button"
                      className={activeTab === "all" ? "active" : ""}
                      onClick={() => setActiveTab("all")}
                    >
                      <Layers size={15} /> Dhammaan
                    </button>
                    {report.exams.map((ex) => (
                      <button
                        type="button"
                        key={ex.type}
                        className={activeTab === ex.type ? "active" : ""}
                        style={{ "--tab": ex.color }}
                        onClick={() => setActiveTab(ex.type)}
                      >
                        <i style={{ background: ex.color }} />
                        {ex.type}
                        {!ex.hasData && <em>—</em>}
                      </button>
                    ))}
                  </div>

                  {activeTab === "all" ? (
                    <>
                      {/* Kaararka 4-ta imtixaan */}
                      <div className="acr-exam-cards">
                        {report.exams.map((ex) => (
                          <button
                            type="button"
                            key={ex.type}
                            className={"acr-exam-card" + (ex.hasData ? "" : " empty")}
                            style={{ "--accent": ex.color }}
                            onClick={() => setActiveTab(ex.type)}
                          >
                            <div className="acr-exam-card-top">
                              <span className="acr-exam-name">{ex.type}</span>
                              {ex.hasData && <GradePill grade={ex.grade} />}
                            </div>
                            {ex.hasData ? (
                              <>
                                <div className="acr-exam-total">
                                  {fmt(ex.total)}
                                  <small> / {fmt(ex.max)}</small>
                                </div>
                                <Bar pct={ex.pct} color={ex.color} />
                                <div className="acr-exam-meta">
                                  <span>{ex.pct.toFixed(1)}%</span>
                                  <span>{ex.subjects.length} maado</span>
                                </div>
                              </>
                            ) : (
                              <div className="acr-exam-pending">Weli lama soo gudbin</div>
                            )}
                          </button>
                        ))}
                      </div>

                      {/* Best / weakest subject */}
                      {bestSubject && (
                        <div className="acr-highlights">
                          <div className="acr-highlight good">
                            <TrendingUp size={20} />
                            <div>
                              <span>Maadada ugu fiican</span>
                              <strong>{bestSubject.subject}</strong>
                            </div>
                            <b>{bestSubject.pct.toFixed(0)}%</b>
                          </div>
                          {weakSubject && (
                            <div className="acr-highlight weak">
                              <TrendingDown size={20} />
                              <div>
                                <span>U baahan dadaal</span>
                                <strong>{weakSubject.subject}</strong>
                              </div>
                              <b>{weakSubject.pct.toFixed(0)}%</b>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Jadwalka isku darka ah */}
                      <div className="acr-panel">
                        <div className="acr-panel-head">
                          <BookOpen size={18} />
                          <h3>Dhibcaha Maado Kasta — Dhammaan Imtixaannada</h3>
                        </div>
                        <div className="acr-table-wrap">
                          <table className="acr-table">
                            <thead>
                              <tr>
                                <th>#</th>
                                <th className="left">Maadada</th>
                                {report.exams.map((ex) => (
                                  <th key={ex.type}>
                                    <span className="acr-th-dot" style={{ background: ex.color }} />
                                    {ex.short}
                                  </th>
                                ))}
                                <th>Wadar</th>
                                <th>%</th>
                                <th>Darajo</th>
                              </tr>
                            </thead>
                            <tbody>
                              {report.combined.map((row, i) => (
                                <tr key={row.subject}>
                                  <td className="num">{i + 1}</td>
                                  <td className="left subj">{row.subject}</td>
                                  {report.exams.map((ex) => {
                                    const cell = row.perExam[ex.type];
                                    return (
                                      <td key={ex.type} className="mark">
                                        {cell ? (
                                          <>
                                            <b>{fmt(cell.marks)}</b>
                                            <small>/{fmt(cell.maxMarks)}</small>
                                          </>
                                        ) : (
                                          <span className="dash">—</span>
                                        )}
                                      </td>
                                    );
                                  })}
                                  <td className="mark total">
                                    <b>{fmt(row.total)}</b>
                                    <small>/{fmt(row.max)}</small>
                                  </td>
                                  <td className="pct">{row.pct.toFixed(1)}%</td>
                                  <td>
                                    <GradePill grade={row.grade} />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr>
                                <td />
                                <td className="left">Wadarta</td>
                                {report.exams.map((ex) => (
                                  <td key={ex.type} className="mark">
                                    {ex.hasData ? (
                                      <>
                                        <b>{fmt(ex.total)}</b>
                                        <small>/{fmt(ex.max)}</small>
                                      </>
                                    ) : (
                                      <span className="dash">—</span>
                                    )}
                                  </td>
                                ))}
                                <td className="mark total">
                                  <b>{fmt(report.grandTotal)}</b>
                                  <small>/{fmt(report.grandMax)}</small>
                                </td>
                                <td className="pct">{report.grandPct.toFixed(1)}%</td>
                                <td>
                                  <GradePill grade={report.grandGrade} />
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    </>
                  ) : (
                    /* ----- Hal imtixaan ----- */
                    activeExam && (
                      <div className="acr-panel" style={{ "--accent": activeExam.color }}>
                        <div className="acr-single-head">
                          <div>
                            <span className="acr-single-tag" style={{ background: activeExam.color }}>
                              {activeExam.type}
                            </span>
                            <h3>Natiijada {activeExam.type}</h3>
                          </div>
                          {activeExam.hasData && (
                            <ScoreRing
                              pct={activeExam.pct}
                              color={activeExam.color}
                              size={96}
                              label={activeExam.grade.letter}
                            />
                          )}
                        </div>

                        {!activeExam.hasData ? (
                          <div className="acr-empty small">
                            <div className="acr-empty-icon">⏳</div>
                            <h3>Imtixaankan weli natiijo lama soo gudbin</h3>
                            <p>Marka macalimiintu saxaan, halkan ayay ka muuqan doontaa.</p>
                          </div>
                        ) : (
                          <>
                            <div className="acr-single-stats">
                              <div>
                                <span>Wadarta</span>
                                <strong>
                                  {fmt(activeExam.total)} <small>/ {fmt(activeExam.max)}</small>
                                </strong>
                              </div>
                              <div>
                                <span>Boqolley</span>
                                <strong>{activeExam.pct.toFixed(1)}%</strong>
                              </div>
                              <div>
                                <span>Darajo</span>
                                <strong style={{ color: activeExam.grade.color }}>
                                  {activeExam.grade.letter}
                                </strong>
                              </div>
                              <div>
                                <span>Maadooyin</span>
                                <strong>{activeExam.subjects.length}</strong>
                              </div>
                            </div>

                            <div className="acr-subject-list">
                              {[...activeExam.subjects]
                                .sort((a, b) => pctOf(b.marks, b.maxMarks) - pctOf(a.marks, a.maxMarks))
                                .map((s, i) => {
                                  const p = pctOf(s.marks, s.maxMarks);
                                  const g = gradeFor(p);
                                  return (
                                    <div className="acr-subject-row" key={s.subject}>
                                      <span className="acr-subject-rank">{i + 1}</span>
                                      <div className="acr-subject-body">
                                        <div className="acr-subject-line">
                                          <strong>{s.subject}</strong>
                                          <span className="acr-subject-marks">
                                            {fmt(s.marks)}
                                            <small> / {fmt(s.maxMarks)}</small>
                                          </span>
                                        </div>
                                        <Bar pct={p} color={g.color} />
                                        <div className="acr-subject-foot">
                                          <span>{s.teacherName ? `Macalin: ${s.teacherName}` : g.remark}</span>
                                          <span>{p.toFixed(1)}%</span>
                                        </div>
                                      </div>
                                      <GradePill grade={g} />
                                    </div>
                                  );
                                })}
                            </div>
                          </>
                        )}
                      </div>
                    )
                  )}

                  <div className="acr-footer-quote">
                    <Trophy size={18} />
                    <p>"Aqoontu waa iftiin, waa furaha mustaqbalka." — Ku dadaal horumar ka wanaagsan!</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <footer className="home-footer">
        <div className="home-footer-left">
          <img src={logo} className="footer-logo" alt="Rising Star School logo" />
          <div>
            <div className="footer-school-name">RISING STAR SCHOOL</div>
            <div className="footer-school-tagline">RISING STAR PRIMARY &amp; SECONDARY SCHOOL</div>
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