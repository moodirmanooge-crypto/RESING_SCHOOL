//src/student/Dashboard.jsx
//student dashboard.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import StudentIdCard from "./StudentIdCard";
import CertificateCard from "../admin/components/CertificateCard";

const COLORS = {
  bg: "#0b1120",
  panel: "#111a2e",
  panelSoft: "#0f1626",
  border: "#1f2b45",
  text: "#e7ecf7",
  textDim: "#8b97b0",
  accent: "#3ecf8e",
  accentSoft: "rgba(62,207,142,0.12)",
  warn: "#f5a623",
  danger: "#ef5a6f",
};

// Rotating colors for the "#N" session badges, matching the printed timetable design.
const BADGE_COLORS = [
  "#6d5df0", // purple
  "#2a9fb5", // teal
  "#2fae63", // green
  "#c99a1e", // gold
  "#d97b1e", // orange
  "#c0507a", // pink/rose
  "#5b4fd6", // indigo
];

// Rough icon mapping for common subjects, falling back to a generic book icon.
function subjectIcon(subject) {
  const s = (subject || "").toLowerCase();
  if (s.includes("islam")) return "🌙";
  if (s.includes("arab") || s.includes("afso")) return "📖";
  if (s.includes("somali")) return "⭐";
  if (s.includes("cilmi") || s.includes("bio") || s.includes("bilis")) return "🧪";
  if (s.includes("say") || s.includes("science")) return "🌐";
  if (s.includes("xisaab") || s.includes("math")) return "🧮";
  if (s.includes("english") || s.includes("ingiriis")) return "💬";
  return "📘";
}

// Class order: 1 -> 8 (primary), then F1 -> F4 (secondary/form)
const CLASS_ORDER = ["1", "2", "3", "4", "5", "6", "7", "8", "F1", "F2", "F3", "F4"];
function classRank(className) {
  const idx = CLASS_ORDER.indexOf(String(className || "").toUpperCase());
  return idx === -1 ? 999 : idx;
}
function groupByClass(items) {
  const groups = {};
  items.forEach((item) => {
    const key = String(item.className || "Unknown").toUpperCase();
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });
  return Object.entries(groups).sort(
    ([a], [b]) => classRank(a) - classRank(b)
  );
}

const DAYS = [
  { key: "Saturday", label: "Saturday" },
  { key: "Sunday", label: "Sunday" },
  { key: "Monday", label: "Monday" },
  { key: "Tuesday", label: "Tuesday" },
  { key: "Wednesday", label: "Wednesday" },
];

// Injects the responsive/media-query behavior that inline styles can't express.
function ResponsiveStyles() {
  return (
    <style>{`
      .rs-page { min-height: 100vh; background: ${COLORS.bg}; color: ${COLORS.text}; font-family: 'Inter','Segoe UI',system-ui,sans-serif; }
      .rs-layout { display: flex; min-height: 100vh; }
      .rs-sidebar { width: 240px; background: ${COLORS.panel}; border-right: 1px solid ${COLORS.border}; display:flex; flex-direction:column; padding: 28px 20px; gap: 32px; flex-shrink: 0; }
      .rs-main { flex: 1; padding: 36px 44px; overflow-y: auto; min-width: 0; }
      .rs-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; }
      .rs-detail-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
      .rs-payment-summary-row { display: flex; gap: 16px; margin-bottom: 20px; }
      .rs-table-wrap { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
      .rs-table { width: 100%; border-collapse: collapse; min-width: 420px; }
      .rs-header { display:flex; justify-content: space-between; align-items: flex-end; margin-bottom: 28px; gap: 12px; }
      .rs-bottom-nav { display: none; }
      .rs-mobile-topbar { display: none; }
      .rs-day-tabs { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; margin-bottom: 16px; }

      @media (max-width: 860px) {
        .rs-layout { flex-direction: column; }
        .rs-sidebar { display: none; }
        .rs-mobile-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 16px;
          background: ${COLORS.panel};
          border-bottom: 1px solid ${COLORS.border};
          position: sticky;
          top: 0;
          z-index: 20;
        }
        .rs-main { padding: 18px 16px 90px 16px; }
        .rs-header { flex-direction: column; align-items: flex-start; gap: 10px; margin-bottom: 20px; }
        .rs-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
        .rs-detail-grid { grid-template-columns: 1fr 1fr; gap: 14px; }
        .rs-payment-summary-row { flex-direction: column; gap: 10px; }
        .rs-panel { padding: 16px; border-radius: 14px; }
        .rs-stat-value { font-size: 20px !important; }
        .rs-h1 { font-size: 22px !important; }

        .rs-bottom-nav {
          display: flex;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: ${COLORS.panel};
          border-top: 1px solid ${COLORS.border};
          padding: 8px 4px calc(8px + env(safe-area-inset-bottom));
          z-index: 30;
          overflow-x: auto;
        }
        .rs-bottom-nav-item {
          flex: 1;
          min-width: 60px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          background: transparent;
          border: none;
          color: ${COLORS.textDim};
          font-size: 10.5px;
          padding: 6px 2px;
          position: relative;
          white-space: nowrap;
        }
        .rs-bottom-nav-item.active { color: ${COLORS.accent}; }
        .rs-bottom-dot {
          width: 6px; height: 6px; border-radius: 999px; background: ${COLORS.accent};
        }
        .rs-bottom-badge {
          position: absolute;
          top: -2px;
          right: 18%;
          background: ${COLORS.danger};
          color: #fff;
          font-size: 10px;
          padding: 1px 5px;
          border-radius: 999px;
        }
      }

      @media (max-width: 420px) {
        .rs-grid { grid-template-columns: 1fr 1fr; }
        .rs-detail-grid { grid-template-columns: 1fr; }
      }
    `}</style>
  );
}

const NAV_ITEMS = [
  { key: "overview", label: "Overview", icon: "🏠" },
  { key: "certificate", label: "Certificate", icon: "🎓" },
  { key: "timetable", label: "Timetable", icon: "🗓️" },
  { key: "examTimetable", label: "Exam Timetable", icon: "📝" },
  { key: "attendance", label: "Attendance", icon: "📅" },
  { key: "payments", label: "Payments", icon: "💳" },
  { key: "messages", label: "Messages", icon: "💬" },
];

// Loads html2canvas from a CDN on demand (only when the student actually
// clicks "Download"), snapshots the timetable card, and triggers a PNG
// download. Falls back to opening a print-friendly window if the canvas
// library can't be loaded (e.g. network blocked).
async function downloadTimetableImage({ className, dayLabel }) {
  const node = document.getElementById("student-timetable-card");
  if (!node) return;

  try {
    if (!window.html2canvas) {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
      });
    }

    const canvas = await window.html2canvas(node, {
      backgroundColor: "#0f1626",
      scale: 2,
    });
    const link = document.createElement("a");
    link.download = `Timetable-${className || "class"}-${dayLabel || "day"}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  } catch (err) {
    console.log("Falling back to print view:", err);
    window.print();
  }
}

// Snapshots the rendered certificate card (from CertificateCard.jsx) and
// triggers a PNG download. Same html2canvas-on-demand pattern as the
// timetable download above, for consistency across the dashboard.
async function downloadCertificateImage(fullName) {
  const node = document.getElementById("certificate-render-card");
  if (!node) return;

  try {
    if (!window.html2canvas) {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
      });
    }

    const canvas = await window.html2canvas(node, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
    });
    const link = document.createElement("a");
    link.download = `Certificate-${(fullName || "student").replace(/\s+/g, "-")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  } catch (err) {
    console.log("Falling back to print view:", err);
    window.print();
  }
}

export default function StudentDashboard() {
  const navigate = useNavigate();
  const studentId = localStorage.getItem("studentId");

  const [student, setStudent] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [messages, setMessages] = useState([]);
  const [payments, setPayments] = useState([]);
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);

  // Regular class timetable + exam timetable (read-only, keyed by day)
  const [timetableByDay, setTimetableByDay] = useState({});
  const [examTimetableByDay, setExamTimetableByDay] = useState({});
  const [examWeek, setExamWeek] = useState(null);
  const [activeTimetableDay, setActiveTimetableDay] = useState(DAYS[0].key);
  const [activeExamDay, setActiveExamDay] = useState(DAYS[0].key);
  // teacherId -> fullName, so each timetable session can show who teaches it
  const [teacherNames, setTeacherNames] = useState({});
  // Class 8 leaving certificate, if one has been issued for this student
  const [certificate, setCertificate] = useState(null);

  useEffect(() => {
    if (!studentId) {
      navigate("/student-login");
      return;
    }

    const load = async () => {
      try {
        const studentSnap = await getDoc(doc(db, "students", studentId));
        let className = null;
        if (studentSnap.exists()) {
          const data = { id: studentSnap.id, ...studentSnap.data() };
          setStudent(data);
          className = data.className;
        }

        try {
          const attQ = query(
            collection(db, "attendance"),
            where("studentId", "==", studentId)
          );
          const attSnap = await getDocs(attQ);
          setAttendance(attSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        } catch (e) {
          setAttendance([]);
        }

        // Load every teacher's name once, so timetable sessions (which only
        // store teacherId) can be displayed with the teacher's full name.
        try {
          const teachersSnap = await getDocs(collection(db, "teachers"));
          const map = {};
          teachersSnap.docs.forEach((d) => {
            const data = d.data();
            map[d.id] = data.fullName || data.username || d.id;
          });
          setTeacherNames(map);
        } catch (e) {
          setTeacherNames({});
        }

        // Load the regular class timetable (timetable collection, doc id
        // `${className}__${day}`), one document per day.
        if (className) {
          try {
            const ttMap = {};
            await Promise.all(
              DAYS.map(async (d) => {
                const snap = await getDoc(
                  doc(db, "timetable", `${className}__${d.key}`)
                );
                if (snap.exists()) ttMap[d.key] = snap.data();
              })
            );
            setTimetableByDay(ttMap);
          } catch (e) {
            setTimetableByDay({});
          }

          // Load the exam timetable (examTimetable collection, doc id
          // `${className}__${day}`) — kept fully separate from the
          // regular timetable above.
          try {
            const examMap = {};
            await Promise.all(
              DAYS.map(async (d) => {
                const snap = await getDoc(
                  doc(db, "examTimetable", `${className}__${d.key}`)
                );
                if (snap.exists()) examMap[d.key] = snap.data();
              })
            );
            setExamTimetableByDay(examMap);
          } catch (e) {
            setExamTimetableByDay({});
          }

          // Load the exam week date range (examWeek/{className}), if set.
          try {
            const wkSnap = await getDoc(doc(db, "examWeek", className));
            if (wkSnap.exists()) setExamWeek(wkSnap.data());
          } catch (e) {
            setExamWeek(null);
          }

          // Load the Class 8 leaving certificate, if issued. Certificates
          // are keyed by a random certificateId, so look them up by the
          // studentId field instead of by doc id.
          if (String(className).toUpperCase() === "8") {
            try {
              const certQ = query(
                collection(db, "certificates"),
                where("studentId", "==", studentId)
              );
              const certSnap = await getDocs(certQ);
              if (!certSnap.empty) {
                setCertificate({ id: certSnap.docs[0].id, ...certSnap.docs[0].data() });
              } else {
                setCertificate(null);
              }
            } catch (e) {
              setCertificate(null);
            }
          }
        }
      } finally {
        setLoading(false);
      }
    };

    load();

    // Live messages feed — catches both broadcast messages sent to
    // "all students" and individual messages addressed to this exact
    // student (matched by recipientId, which MessagesCard sets to the
    // student's document id). onSnapshot means this updates instantly,
    // no refresh needed, as soon as admin sends something.
    let unsubscribeBroadcast = () => {};
    let unsubscribeIndividual = () => {};
    let broadcastMsgs = [];
    let individualMsgs = [];

    function mergeAndSetMessages() {
      const all = [...broadcastMsgs, ...individualMsgs];
      // de-dupe by id, sort newest first
      const seen = new Map();
      all.forEach((m) => seen.set(m.id, m));
      const merged = Array.from(seen.values()).sort((a, b) => {
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime;
      });
      setMessages(merged);
    }

    try {
      const broadcastQ = query(
        collection(db, "messages"),
        where("audienceGroup", "==", "student"),
        where("scope", "==", "broadcast")
      );
      unsubscribeBroadcast = onSnapshot(broadcastQ, (snap) => {
        broadcastMsgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        mergeAndSetMessages();
      });
    } catch (e) {
      broadcastMsgs = [];
    }

    try {
      const individualQ = query(
        collection(db, "messages"),
        where("audienceGroup", "==", "student"),
        where("scope", "==", "individual"),
        where("recipientId", "==", studentId)
      );
      unsubscribeIndividual = onSnapshot(individualQ, (snap) => {
        individualMsgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        mergeAndSetMessages();
      });
    } catch (e) {
      individualMsgs = [];
    }

    // Live payments feed — updates instantly when the cashier records a payment
    let unsubscribe = () => {};
    try {
      const paymentsQ = query(
        collection(db, "payments"),
        where("studentId", "==", studentId)
      );
      unsubscribe = onSnapshot(paymentsQ, (snap) => {
        setPayments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      });
    } catch (e) {
      setPayments([]);
    }

    return () => {
      unsubscribe();
      unsubscribeBroadcast();
      unsubscribeIndividual();
    };
  }, [studentId, navigate]);

  const logout = () => {
    localStorage.removeItem("studentId");
    localStorage.removeItem("studentName");
    navigate("/student-login");
  };

  const attendanceStats = attendance.reduce(
    (acc, a) => {
      const status = (a.status || "").toLowerCase();
      if (status === "present") acc.present += 1;
      else if (status === "absent") acc.absent += 1;
      else if (status === "late") acc.late += 1;
      acc.total += 1;
      return acc;
    },
    { present: 0, absent: 0, late: 0, total: 0 }
  );
  const attendanceRate =
    attendanceStats.total > 0
      ? Math.round((attendanceStats.present / attendanceStats.total) * 100)
      : null;

  // Student is Free if feeType is explicitly "Free" (case-insensitive).
  const isFreeStudent = String(student?.feeType || "").toLowerCase() === "free";

  // Payments written by the Cashier's Payments.jsx use paidAmount/monthKey/
  // status/monthLabel/schoolName — not amount/date/method/cashierName.
  // Sort newest first by monthKey (falls back to createdAt if monthKey missing).
  const sortedPayments = [...payments].sort((a, b) => {
    if (a.monthKey && b.monthKey) return b.monthKey.localeCompare(a.monthKey);
    const aTime = a.createdAt?.seconds || 0;
    const bTime = b.createdAt?.seconds || 0;
    return bTime - aTime;
  });

  const totalPaid = payments.reduce(
    (sum, p) => sum + (Number(p.paidAmount) || 0),
    0
  );
  const monthlyFee =
    Number(student?.monthlyFee) ||
    Number(sortedPayments[0]?.monthlyFee) ||
    0;

  const latestPayment = sortedPayments[0];
  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const isCurrentMonthPaid =
    isFreeStudent ||
    (latestPayment?.monthKey === currentMonthKey &&
      latestPayment?.status === "Paid");

  const isClass8 = String(student?.className || "").toUpperCase() === "8";
  const visibleNavItems = NAV_ITEMS.filter(
    (item) => item.key !== "certificate" || isClass8
  );

  if (loading) {
    return (
      <div className="rs-page" style={{ alignItems: "center", justifyContent: "center", display: "flex" }}>
        <ResponsiveStyles />
        <div style={{ color: COLORS.textDim, fontSize: 14, letterSpacing: 1 }}>LOADING…</div>
      </div>
    );
  }

  return (
    <div className="rs-page">
      <ResponsiveStyles />

      {/* Mobile top bar (visible only on small screens) */}
      <div className="rs-mobile-topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={styles.brandMark}>RS</div>
          <div>
            <div style={{ ...styles.brandTitle, fontSize: 13 }}>Rising School</div>
            <div style={{ ...styles.brandSub, fontSize: 11 }}>Student Portal</div>
          </div>
        </div>
        <button onClick={logout} style={styles.logoutBtnMobile}>
          Log out
        </button>
      </div>

      <div className="rs-layout">
        {/* Desktop sidebar (hidden on small screens) */}
        <aside className="rs-sidebar">
          <div style={styles.brand}>
            <div style={styles.brandMark}>RS</div>
            <div>
              <div style={styles.brandTitle}>Rising School</div>
              <div style={styles.brandSub}>Student Portal</div>
            </div>
          </div>

          <nav style={styles.nav}>
            {visibleNavItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                style={{
                  ...styles.navItem,
                  ...(tab === item.key ? styles.navItemActive : {}),
                }}
              >
                {item.label}
                {item.key === "messages" && messages.length > 0 && (
                  <span style={styles.navBadge}>{messages.length}</span>
                )}
              </button>
            ))}
          </nav>

          <button onClick={logout} style={styles.logoutBtn}>
            Log out
          </button>
        </aside>

        <main className="rs-main">
          <header className="rs-header">
            <div>
              <div style={styles.eyebrow}>Student ID {studentId}</div>
              <h1 className="rs-h1" style={styles.h1}>
                {student?.fullName ? `Welcome, ${student.fullName.split(" ")[0]}` : "Welcome"}
              </h1>
            </div>
            <div style={styles.classPill}>{student?.className || "—"}</div>
          </header>

          {tab === "overview" && (
            <section className="rs-grid">
              <StatCard
                label="Attendance rate"
                value={attendanceRate !== null ? `${attendanceRate}%` : "No data"}
                accent={COLORS.accent}
              />
              <StatCard
  label={student?.feeType === "Free" ? "Fee Status" : "Monthly Fee"}
  value={
    student?.feeType === "Free"
      ? "Free"
      : `$${Number(student?.monthlyFee || 0).toLocaleString()}`
  }
  accent={COLORS.accent}
/>
              <StatCard
                label="Messages from admin"
                value={messages.length}
                accent={COLORS.danger}
              />
              <div className="rs-panel" style={{ ...styles.panel, gridColumn: "1 / -1" }}>
                <div style={styles.panelTitle}>Student details</div>
                <div className="rs-detail-grid">
                  <Detail label="Full name" value={student?.fullName} />
                  <Detail label="Class" value={student?.className} />
                  <Detail label="District" value={student?.district} />
                  <Detail label="Monthly fee" value={student?.monthlyFee} />
                  <Detail label="Parent phone" value={student?.parentPhone} />
                  <Detail label="Student phone" value={student?.studentPhone} />
                </div>
              </div>
            </section>
          )}

          {/* Student ID Card — auto-generated from the student's own record,
              nothing typed by the student. Admin/teacher only enters
              fullName, className, shift and studentPhoto when registering;
              this tab simply renders those fields into the official card
              design (front + back), with a working print button. */}
          {tab === "idCard" && (
            <section className="rs-panel" style={styles.panel}>
              <div style={styles.panelTitle}>My Student ID Card</div>
              <StudentIdCard student={student} studentId={studentId} />
            </section>
          )}

          {/* Class 8 Leaving Certificate — only visible to Class 8 students.
              Rendered from the same CertificateCard component used in the
              admin panel and the public verify page, so the design always
              stays in sync. If admin hasn't generated one yet, show an
              empty state instead of a broken/missing certificate. */}
          {tab === "certificate" && isClass8 && (
            <section className="rs-panel" style={styles.panel}>
              <div style={styles.panelTitle}>My Class 8 Leaving Certificate</div>
              {certificate ? (
                <div style={{ overflowX: "auto" }}>
                  <CertificateCard
                    certificate={certificate}
                    verifyUrl={`${window.location.origin}/verify/${certificate.certificateId}`}
                  />
                  <button
                    onClick={() => downloadCertificateImage(certificate.fullName)}
                    style={{
                      marginTop: 16,
                      padding: "11px 20px",
                      borderRadius: 10,
                      border: "none",
                      background: "linear-gradient(135deg,#6d5df0,#8b6cf5)",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    
                  </button>
                </div>
              ) : (
                <EmptyState text="Your leaving certificate has not been issued yet. Please check with the school administration." />
              )}
            </section>
          )}

          {/* Regular weekly class timetable — styled to match the official
              printed timetable design, with a "Download as image" button.
              Each session shows the teacher's name (not just the subject). */}
          {tab === "timetable" && (
            <section className="rs-panel" style={styles.panel}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  marginBottom: 16,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={styles.timetableIconBadge}>🗓️</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.text }}>
                    Class Timetable – {student?.className || "—"}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div style={styles.academicYearPill}>🗓️ Academic Year 2024/2025</div>
                  <button
                    onClick={() =>
                      downloadTimetableImage({
                        className: student?.className,
                        dayLabel: DAYS.find((d) => d.key === activeTimetableDay)?.label,
                      })
                    }
                    style={styles.downloadBtn}
                  >
                    ⬇️ Download
                  </button>
                </div>
              </div>

              <div className="rs-day-tabs">
                {DAYS.map((d) => {
                  const isActive = d.key === activeTimetableDay;
                  const hasData = (timetableByDay[d.key]?.sessions || []).length > 0;
                  return (
                    <button
                      key={d.key}
                      onClick={() => setActiveTimetableDay(d.key)}
                      style={{
                        ...styles.dayTabBtn,
                        ...(isActive ? styles.dayTabBtnActive : {}),
                      }}
                    >
                      📅 {d.label}
                      {hasData && (
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: isActive ? "#06231a" : COLORS.accent,
                            marginLeft: 6,
                            display: "inline-block",
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {(() => {
                const sessions = [...(timetableByDay[activeTimetableDay]?.sessions || [])].sort(
                  (a, b) => (a.startTime || "").localeCompare(b.startTime || "")
                );
                if (sessions.length === 0) {
                  return <EmptyState text="No timetable set for this day yet." />;
                }
                return (
                  <div id="student-timetable-card" style={styles.ttCard}>
                    <div className="rs-table-wrap">
                      <div style={styles.ttCardHeaderRow}>
                        <div style={styles.ttColNum}>#</div>
                        <div style={styles.ttColStart}>START</div>
                        <div style={styles.ttColEnd}>END</div>
                        <div style={styles.ttColSubject}>SUBJECT</div>
                        <div style={styles.ttColTeacher}>TEACHER</div>
                      </div>
                      {sessions.map((s, i) => {
                        const badgeColor = BADGE_COLORS[i % BADGE_COLORS.length];
                        const teacherName =
                          s.teacherName || teacherNames[s.teacherId] || s.teacherId || "—";
                        return (
                          <div key={s.id || i} style={styles.ttRow}>
                            <div style={{ ...styles.ttNumBadge, background: badgeColor }}>
                              {s.sessionNumber ?? i + 1}
                            </div>
                            <div style={styles.ttColStart}>
                              <span style={styles.ttClockIcon}>🕐</span> {s.startTime}
                            </div>
                            <div style={styles.ttColEnd}>
                              <span style={{ color: COLORS.textDim, marginRight: 6 }}>→</span>
                              <span style={styles.ttClockIcon}>🕐</span> {s.endTime}
                            </div>
                            <div style={styles.ttColSubject}>
                              <span style={{ marginRight: 8 }}>{subjectIcon(s.subject)}</span>
                              {(s.subject || "—").toUpperCase()}
                            </div>
                            <div style={styles.ttColTeacher}>{teacherName}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={styles.ttFooterNote}>
                      ℹ️ Timetable is subject to change. Please check regularly for updates.
                    </div>
                  </div>
                );
              })()}
            </section>
          )}

          {/* Exam timetable — its own tab, separate collection/data from the regular timetable */}
          {tab === "examTimetable" && (
            <section className="rs-panel" style={styles.panel}>
              <div style={styles.panelTitle}>Exam Timetable — {student?.className || "—"}</div>
              {examWeek?.startDate && (
                <div style={{ color: COLORS.textDim, fontSize: 13, marginBottom: 14 }}>
                  Exams run from <strong style={{ color: COLORS.text }}>{examWeek.startDate}</strong>{" "}
                  to <strong style={{ color: COLORS.text }}>{examWeek.endDate}</strong>
                </div>
              )}
              <div className="rs-day-tabs">
                {DAYS.map((d) => {
                  const isActive = d.key === activeExamDay;
                  const hasData = (examTimetableByDay[d.key]?.slots || []).length > 0;
                  return (
                    <button
                      key={d.key}
                      onClick={() => setActiveExamDay(d.key)}
                      style={{
                        ...styles.dayTabBtn,
                        ...(isActive ? styles.dayTabBtnActive : {}),
                      }}
                    >
                      {d.label}
                      {hasData && (
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: isActive ? "#fff" : COLORS.warn,
                            marginLeft: 6,
                            display: "inline-block",
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {(() => {
                const slots = [...(examTimetableByDay[activeExamDay]?.slots || [])].sort(
                  (a, b) => (a.startTime || "").localeCompare(b.startTime || "")
                );
                if (slots.length === 0) {
                  return <EmptyState text="No exam scheduled for this day." />;
                }
                return (
                  <div className="rs-table-wrap">
                    <table className="rs-table" style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>#</th>
                          <th style={styles.th}>Start</th>
                          <th style={styles.th}>End</th>
                          <th style={styles.th}>Subject</th>
                        </tr>
                      </thead>
                      <tbody>
                        {slots.map((s) => (
                          <tr key={s.id}>
                            <td style={styles.td}>{s.examNumber}</td>
                            <td style={styles.td}>{s.startTime}</td>
                            <td style={styles.td}>{s.endTime}</td>
                            <td style={styles.td}>{s.subject || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </section>
          )}

          {tab === "attendance" && (
            <section className="rs-panel" style={styles.panel}>
              <div style={styles.panelTitle}>Attendance — all classes</div>
              {attendance.length === 0 ? (
                <EmptyState text="No attendance records yet." />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                  {groupByClass(attendance).map(([className, classAttendance]) => (
                    <div key={className}>
                      <div style={styles.classGroupLabel}>Class {className}</div>
                      <div className="rs-table-wrap">
                        <table className="rs-table" style={styles.table}>
                          <thead>
                            <tr>
                              <th style={styles.th}>Date</th>
                              <th style={styles.th}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {classAttendance.map((a) => (
                              <tr key={a.id}>
                                <td style={styles.td}>{a.date || "—"}</td>
                                <td style={styles.td}>
                                  <StatusPill status={a.status} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {tab === "payments" && (
            <section className="rs-panel" style={styles.panel}>
              <div style={styles.panelTitle}>Payments</div>
              {isFreeStudent ? (
                <>
                  <div className="rs-payment-summary-row">
                    <div style={styles.paymentSummaryCard}>
                      <div style={styles.detailLabel}>Fee status</div>
                      <div
                        className="rs-stat-value"
                        style={{ ...styles.statValue, color: COLORS.accent }}
                      >
                        Free
                      </div>
                    </div>
                    <div style={styles.paymentSummaryCard}>
                      <div style={styles.detailLabel}>Total paid</div>
                      <div
                        className="rs-stat-value"
                        style={{ ...styles.statValue, color: COLORS.accent }}
                      >
                        Free
                      </div>
                    </div>
                    <div style={styles.paymentSummaryCard}>
                      <div style={styles.detailLabel}>This month</div>
                      <div
                        style={{
                          ...styles.statValue,
                          fontSize: 18,
                          color: COLORS.accent,
                        }}
                      >
                        Free
                      </div>
                    </div>
                  </div>
                  <EmptyState text="This student is registered as Free. No fees apply." />
                </>
              ) : (
                <>
                  <div className="rs-payment-summary-row">
                    <div style={styles.paymentSummaryCard}>
                      <div style={styles.detailLabel}>Monthly fee</div>
                      <div className="rs-stat-value" style={styles.statValue}>${monthlyFee.toLocaleString()}</div>
                    </div>
                    <div style={styles.paymentSummaryCard}>
                      <div style={styles.detailLabel}>Total paid</div>
                      <div className="rs-stat-value" style={{ ...styles.statValue, color: COLORS.accent }}>
                        ${totalPaid.toLocaleString()}
                      </div>
                    </div>
                    <div style={styles.paymentSummaryCard}>
                      <div style={styles.detailLabel}>This month</div>
                      <div
                        style={{
                          ...styles.statValue,
                          fontSize: 18,
                          color: isCurrentMonthPaid ? COLORS.accent : COLORS.danger,
                        }}
                      >
                        {isCurrentMonthPaid ? "Paid" : "Not Paid"}
                      </div>
                    </div>
                  </div>
                  {sortedPayments.length === 0 ? (
                    <EmptyState text="No payments have been recorded yet." />
                  ) : (
                    <div className="rs-table-wrap">
                      <table className="rs-table" style={styles.table}>
                        <thead>
                          <tr>
                            <th style={styles.th}>Month</th>
                            <th style={styles.th}>School</th>
                            <th style={styles.th}>Paid</th>
                            <th style={styles.th}>Remaining</th>
                            <th style={styles.th}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedPayments.map((p) => (
                            <tr key={p.id}>
                              <td style={styles.td}>{p.monthLabel || p.monthKey || "—"}</td>
                              <td style={styles.td}>{p.schoolName || "—"}</td>
                              <td style={styles.td}>${Number(p.paidAmount || 0).toLocaleString()}</td>
                              <td style={styles.td}>${Number(p.remaining || 0).toLocaleString()}</td>
                              <td style={styles.td}>
                                <StatusPill status={p.status} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {tab === "messages" && (
            <section className="rs-panel" style={styles.panel}>
              <div style={styles.panelTitle}>Messages from admin</div>
              {messages.length === 0 ? (
                <EmptyState text="No messages yet." />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {messages.map((m) => (
                    <div key={m.id} style={styles.messageCard}>
                      <div style={styles.messageTitle}>{m.subject || m.title || "Announcement"}</div>
                      <div style={styles.messageBody}>{m.text || m.body}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </main>
      </div>

      {/* Mobile bottom nav (visible only on small screens) */}
      <nav className="rs-bottom-nav">
        {visibleNavItems.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`rs-bottom-nav-item${tab === item.key ? " active" : ""}`}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</span>
            <span>{item.label}</span>
            {item.key === "messages" && messages.length > 0 && (
              <span className="rs-bottom-badge">{messages.length}</span>
            )}
            {tab === item.key && <span className="rs-bottom-dot" />}
          </button>
        ))}
      </nav>
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div className="rs-panel" style={styles.panel}>
      <div style={{ ...styles.statBar, background: accent }} />
      <div style={styles.statLabel}>{label}</div>
      <div className="rs-stat-value" style={styles.statValue}>{value}</div>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <div style={styles.detailLabel}>{label}</div>
      <div style={styles.detailValue}>{value || "—"}</div>
    </div>
  );
}

function EmptyState({ text }) {
  return <div style={styles.empty}>{text}</div>;
}

function StatusPill({ status }) {
  const s = (status || "").toLowerCase();
  const map = {
    present: { bg: "rgba(62,207,142,0.15)", color: COLORS.accent },
    absent: { bg: "rgba(239,90,111,0.15)", color: COLORS.danger },
    late: { bg: "rgba(245,166,35,0.15)", color: COLORS.warn },
    paid: { bg: "rgba(62,207,142,0.15)", color: COLORS.accent },
    "not paid": { bg: "rgba(239,90,111,0.15)", color: COLORS.danger },
  };
  const style = map[s] || { bg: "rgba(139,151,176,0.15)", color: COLORS.textDim };
  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        textTransform: "capitalize",
        background: style.bg,
        color: style.color,
      }}
    >
      {status || "—"}
    </span>
  );
}

const styles = {
  brand: { display: "flex", alignItems: "center", gap: 12 },
  brandMark: {
    width: 40,
    height: 40,
    borderRadius: 10,
    background: COLORS.accentSoft,
    color: COLORS.accent,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 14,
    flexShrink: 0,
  },
  brandTitle: { fontSize: 14, fontWeight: 700 },
  brandSub: { fontSize: 12, color: COLORS.textDim },
  nav: { display: "flex", flexDirection: "column", gap: 6, flex: 1 },
  navItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    textAlign: "left",
    padding: "11px 14px",
    borderRadius: 10,
    border: "none",
    background: "transparent",
    color: COLORS.textDim,
    fontSize: 14,
    cursor: "pointer",
  },
  navItemActive: {
    background: COLORS.accentSoft,
    color: COLORS.accent,
    fontWeight: 600,
  },
  navBadge: {
    background: COLORS.danger,
    color: "#fff",
    fontSize: 11,
    padding: "1px 7px",
    borderRadius: 999,
  },
  logoutBtn: {
    padding: "11px 14px",
    borderRadius: 10,
    border: `1px solid ${COLORS.border}`,
    background: "transparent",
    color: COLORS.textDim,
    fontSize: 13,
    cursor: "pointer",
  },
  logoutBtnMobile: {
    padding: "8px 12px",
    borderRadius: 8,
    border: `1px solid ${COLORS.border}`,
    background: "transparent",
    color: COLORS.textDim,
    fontSize: 12,
    cursor: "pointer",
    flexShrink: 0,
  },
  eyebrow: {
    fontSize: 12,
    letterSpacing: 1.5,
    color: COLORS.textDim,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  h1: { fontSize: 28, margin: 0, fontWeight: 700 },
  classPill: {
    padding: "8px 16px",
    borderRadius: 999,
    background: COLORS.panelSoft,
    border: `1px solid ${COLORS.border}`,
    fontSize: 13,
    color: COLORS.textDim,
    alignSelf: "flex-start",
  },
  paymentSummaryCard: {
    background: COLORS.panelSoft,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 12,
    padding: 16,
    flex: 1,
  },
  panel: {
    background: COLORS.panel,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 16,
    padding: 22,
    position: "relative",
    overflow: "hidden",
  },
  panelTitle: { fontSize: 15, fontWeight: 600, marginBottom: 16 },
  classGroupLabel: {
    fontSize: 13,
    fontWeight: 700,
    color: COLORS.accent,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statBar: {
    position: "absolute",
    top: 0,
    left: 0,
    height: 3,
    width: "100%",
  },
  statLabel: { fontSize: 13, color: COLORS.textDim, marginBottom: 8 },
  statValue: { fontSize: 26, fontWeight: 700 },
  detailLabel: { fontSize: 12, color: COLORS.textDim, marginBottom: 4 },
  detailValue: { fontSize: 14, fontWeight: 500 },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left",
    fontSize: 12,
    color: COLORS.textDim,
    padding: "8px 10px",
    borderBottom: `1px solid ${COLORS.border}`,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    whiteSpace: "nowrap",
  },
  td: {
    padding: "12px 10px",
    borderBottom: `1px solid ${COLORS.border}`,
    fontSize: 14,
    whiteSpace: "nowrap",
  },
  empty: {
    padding: "32px 0",
    textAlign: "center",
    color: COLORS.textDim,
    fontSize: 14,
  },
  messageCard: {
    background: COLORS.panelSoft,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 12,
    padding: 16,
  },
  messageTitle: { fontWeight: 600, marginBottom: 6, fontSize: 14 },
  messageBody: { fontSize: 13, color: COLORS.textDim, lineHeight: 1.5 },
  dayTabBtn: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    padding: "9px 16px",
    borderRadius: 10,
    border: `1px solid ${COLORS.border}`,
    background: COLORS.panelSoft,
    color: COLORS.textDim,
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
  },
  dayTabBtnActive: {
    background: COLORS.accent,
    borderColor: COLORS.accent,
    color: "#06231a",
  },

  // ---- Timetable card (matches the printed reference design) ----
  timetableIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    background: "linear-gradient(135deg,#6d5df0,#8b6cf5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    flexShrink: 0,
  },
  academicYearPill: {
    background: COLORS.panelSoft,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 10,
    padding: "8px 14px",
    fontSize: 12.5,
    fontWeight: 600,
    color: COLORS.textDim,
    whiteSpace: "nowrap",
  },
  downloadBtn: {
    background: "linear-gradient(135deg,#6d5df0,#8b6cf5)",
    border: "none",
    borderRadius: 10,
    padding: "9px 16px",
    fontSize: 12.5,
    fontWeight: 700,
    color: "#fff",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  ttCard: {
    background: COLORS.panelSoft,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 16,
    padding: "18px 20px",
  },
  ttCardHeaderRow: {
    display: "grid",
    gridTemplateColumns: "44px 110px 130px 1fr 1fr",
    gap: 10,
    padding: "0 4px 12px",
    borderBottom: `1px solid ${COLORS.border}`,
    color: "#8b87ad",
    fontSize: 11.5,
    fontWeight: 700,
    letterSpacing: 0.5,
    minWidth: 640,
  },
  ttRow: {
    display: "grid",
    gridTemplateColumns: "44px 110px 130px 1fr 1fr",
    gap: 10,
    alignItems: "center",
    padding: "14px 4px",
    borderBottom: `1px solid ${COLORS.border}`,
    minWidth: 640,
  },
  ttNumBadge: {
    width: 30,
    height: 30,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontWeight: 800,
    fontSize: 13,
  },
  ttColNum: { textAlign: "left" },
  ttColStart: { fontWeight: 700, color: COLORS.text, fontSize: 14, whiteSpace: "nowrap" },
  ttColEnd: { fontWeight: 700, color: COLORS.text, fontSize: 14, whiteSpace: "nowrap" },
  ttColSubject: { fontWeight: 800, color: COLORS.text, fontSize: 13.5, letterSpacing: 0.3 },
  ttColTeacher: { fontWeight: 600, color: COLORS.textDim, fontSize: 13 },
  ttClockIcon: { marginRight: 4 },
  ttFooterNote: {
    marginTop: 14,
    background: "rgba(139,108,245,0.08)",
    border: "1px solid rgba(139,108,245,0.2)",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 12.5,
    color: COLORS.textDim,
  },
};