//src/parent/Dashboard.jsx
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
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase/firebase";

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

function ResponsiveStyles() {
  return (
    <style>{`
      .pd-layout { display: flex; min-height: 100vh; }
      .pd-sidebar { width: 240px; background: ${COLORS.panel}; border-right: 1px solid ${COLORS.border}; display:flex; flex-direction:column; padding: 28px 20px; gap: 32px; flex-shrink: 0; }
      .pd-main { flex: 1; padding: 36px 44px; overflow-y: auto; min-width: 0; }
      .pd-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; }
      .pd-detail-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
      .pd-payment-summary-row { display: flex; gap: 16px; margin-bottom: 20px; }
      .pd-table-wrap { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
      .pd-table { width: 100%; border-collapse: collapse; min-width: 420px; }
      .pd-header { display:flex; justify-content: space-between; align-items: flex-end; margin-bottom: 28px; gap: 12px; }
      .pd-bottom-nav { display: none; }
      .pd-mobile-topbar { display: none; }
      .pd-day-tabs { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; margin-bottom: 16px; }

      @media (max-width: 860px) {
        .pd-layout { flex-direction: column; }
        .pd-sidebar { display: none; }
        .pd-mobile-topbar {
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
        .pd-main { padding: 18px 16px 90px 16px; }
        .pd-header { flex-direction: column; align-items: flex-start; gap: 10px; margin-bottom: 20px; }
        .pd-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
        .pd-detail-grid { grid-template-columns: 1fr 1fr; gap: 14px; }
        .pd-payment-summary-row { flex-direction: column; gap: 10px; }
        .pd-panel { padding: 16px; border-radius: 14px; }
        .pd-stat-value { font-size: 20px !important; }
        .pd-h1 { font-size: 22px !important; }

        .pd-bottom-nav {
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
        .pd-bottom-nav-item {
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
        .pd-bottom-nav-item.active { color: ${COLORS.accent}; }
        .pd-bottom-dot {
          width: 6px; height: 6px; border-radius: 999px; background: ${COLORS.accent};
        }
        .pd-bottom-badge {
          position: absolute;
          top: -2px;
          right: 14%;
          background: ${COLORS.danger};
          color: #fff;
          font-size: 10px;
          padding: 1px 5px;
          border-radius: 999px;
        }
      }

      @media (max-width: 420px) {
        .pd-grid { grid-template-columns: 1fr 1fr; }
        .pd-detail-grid { grid-template-columns: 1fr; }
      }
    `}</style>
  );
}

const NAV_ITEMS = [
  { key: "overview", label: "Overview", icon: "🏠" },
  { key: "timetable", label: "Timetable", icon: "🗓️" },
  { key: "examTimetable", label: "Exam Timetable", icon: "📝" },
  { key: "attendance", label: "Attendance", icon: "📅" },
  { key: "payments", label: "Payments", icon: "💳" },
  { key: "reports", label: "Reports", icon: "⚠️" },
  { key: "messages", label: "Messages", icon: "💬" },
];

export default function ParentDashboard() {
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

  useEffect(() => {
    if (!studentId) {
      navigate("/parent-login");
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
        }
      } finally {
        setLoading(false);
      }
    };

    load();

    let unsubMsgsGroup = () => {};
    let unsubMsgsDirect = () => {};
    const groupMsgs = new Map();
    const directMsgs = new Map();

    const publishMessages = () => {
      const merged = [...groupMsgs.values(), ...directMsgs.values()];
      merged.sort((a, b) => {
        const ta = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const tb = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return tb - ta;
      });
      setMessages(merged);
    };

    try {
      const msgGroupQ = query(
        collection(db, "messages"),
        where("audienceGroup", "in", ["parent", "student", "broadcast"])
      );
      unsubMsgsGroup = onSnapshot(msgGroupQ, (snap) => {
        groupMsgs.clear();
        snap.docs.forEach((d) => groupMsgs.set(d.id, { id: d.id, ...d.data() }));
        publishMessages();
      });
    } catch (e) {
      // ignore
    }

    try {
      const msgDirectQ = query(
        collection(db, "messages"),
        where("recipientId", "==", studentId)
      );
      unsubMsgsDirect = onSnapshot(msgDirectQ, (snap) => {
        directMsgs.clear();
        snap.docs.forEach((d) => directMsgs.set(d.id, { id: d.id, ...d.data() }));
        publishMessages();
      });
    } catch (e) {
      // ignore
    }

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
      unsubMsgsGroup();
      unsubMsgsDirect();
    };
  }, [studentId, navigate]);

  const logout = () => {
    localStorage.removeItem("studentId");
    localStorage.removeItem("parentName");
    navigate("/parent-login");
  };

  const [markingRead, setMarkingRead] = useState(false);
  const markAllAsRead = async () => {
    const unread = messages.filter((m) => m.read === false);
    if (unread.length === 0) return;
    setMarkingRead(true);
    try {
      const batch = writeBatch(db);
      unread.forEach((m) => {
        batch.update(doc(db, "messages", m.id), { read: true });
      });
      await batch.commit();
    } catch (e) {
      console.error("Failed to mark messages as read:", e);
    } finally {
      setMarkingRead(false);
    }
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

  const hasConcern =
    (attendanceRate !== null && attendanceRate < 75) ||
    attendanceStats.absent >= 3;

  const unreadMessages = messages.filter((m) => m.read === false).length;

  const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const monthlyFee = Number(student?.monthlyFee) || 0;
  const sortedPayments = [...payments].sort((a, b) => {
    const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date || 0);
    const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date || 0);
    return dateB - dateA;
  });

  if (loading) {
    return (
      <div style={{ ...styles.page, alignItems: "center", justifyContent: "center", display: "flex" }}>
        <ResponsiveStyles />
        <div style={{ color: COLORS.textDim, fontSize: 14, letterSpacing: 1 }}>LOADING…</div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <ResponsiveStyles />

      {/* Mobile top bar (visible only on small screens) */}
      <div className="pd-mobile-topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={styles.brandMark}>RS</div>
          <div>
            <div style={{ ...styles.brandTitle, fontSize: 13 }}>Rising School</div>
            <div style={{ ...styles.brandSub, fontSize: 11 }}>Parent Portal</div>
          </div>
        </div>
        <button onClick={logout} style={styles.logoutBtnMobile}>
          Log out
        </button>
      </div>

      <div className="pd-layout">
        {/* Desktop sidebar (hidden on small screens) */}
        <aside className="pd-sidebar">
          <div style={styles.brand}>
            <div style={styles.brandMark}>RS</div>
            <div>
              <div style={styles.brandTitle}>Rising School</div>
              <div style={styles.brandSub}>Parent Portal</div>
            </div>
          </div>

          <nav style={styles.nav}>
            {NAV_ITEMS.map((item) => (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                style={{
                  ...styles.navItem,
                  ...(tab === item.key ? styles.navItemActive : {}),
                }}
              >
                {item.label}
                {item.key === "messages" && unreadMessages > 0 && (
                  <span style={styles.navBadge}>{unreadMessages}</span>
                )}
                {item.key === "reports" && hasConcern && (
                  <span style={{ ...styles.navBadge, background: COLORS.warn }}>!</span>
                )}
              </button>
            ))}
          </nav>

          <button onClick={logout} style={styles.logoutBtn}>
            Log out
          </button>
        </aside>

        <main className="pd-main">
          <header className="pd-header">
            <div>
              <div style={styles.eyebrow}>Following student {studentId}</div>
              <h1 className="pd-h1" style={styles.h1}>
                {student?.fullName ? student.fullName : "Your child"}
              </h1>
            </div>
            <div style={styles.classPill}>{student?.className || "—"}</div>
          </header>

          {tab === "overview" && (
            <section className="pd-grid">
              <StatCard
                label="Attendance rate"
                value={attendanceRate !== null ? `${attendanceRate}%` : "No data"}
                accent={hasConcern ? COLORS.danger : COLORS.accent}
              />
              <StatCard
                label="Total paid"
                value={`$${totalPaid.toLocaleString()}`}
                accent={COLORS.accent}
              />
              <StatCard
                label="Messages from admin"
                value={unreadMessages > 0 ? `${unreadMessages} new` : messages.length}
                accent={unreadMessages > 0 ? COLORS.danger : COLORS.accent}
              />
              <div className="pd-panel" style={{ ...styles.panel, gridColumn: "1 / -1" }}>
                <div style={styles.panelTitle}>Student details</div>
                <div className="pd-detail-grid">
                  <Detail label="Full name" value={student?.fullName} />
                  <Detail label="Class" value={student?.className} />
                  <Detail label="District" value={student?.district} />
                  <Detail label="Monthly fee" value={student?.monthlyFee} />
                  <Detail label="Student phone" value={student?.studentPhone} />
                  <Detail label="Orphan status" value={student?.orphanStatus} />
                </div>
              </div>
            </section>
          )}

          {/* Regular weekly class timetable — read-only, separate from exam timetable */}
          {tab === "timetable" && (
            <section className="pd-panel" style={styles.panel}>
              <div style={styles.panelTitle}>Class Timetable — {student?.className || "—"}</div>
              <div className="pd-day-tabs">
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
                      {d.label}
                      {hasData && (
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: isActive ? "#fff" : COLORS.accent,
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
                  <div className="pd-table-wrap">
                    <table className="pd-table" style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>#</th>
                          <th style={styles.th}>Start</th>
                          <th style={styles.th}>End</th>
                          <th style={styles.th}>Subject</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessions.map((s) => (
                          <tr key={s.id}>
                            <td style={styles.td}>{s.sessionNumber}</td>
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

          {/* Exam timetable — its own tab, separate collection/data from the regular timetable */}
          {tab === "examTimetable" && (
            <section className="pd-panel" style={styles.panel}>
              <div style={styles.panelTitle}>Exam Timetable — {student?.className || "—"}</div>
              {examWeek?.startDate && (
                <div style={{ color: COLORS.textDim, fontSize: 13, marginBottom: 14 }}>
                  Exams run from <strong style={{ color: COLORS.text }}>{examWeek.startDate}</strong>{" "}
                  to <strong style={{ color: COLORS.text }}>{examWeek.endDate}</strong>
                </div>
              )}
              <div className="pd-day-tabs">
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
                  <div className="pd-table-wrap">
                    <table className="pd-table" style={styles.table}>
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
            <section className="pd-panel" style={styles.panel}>
              <div style={styles.panelTitle}>Attendance — all classes</div>
              {attendance.length === 0 ? (
                <EmptyState text="No attendance records yet." />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                  {groupByClass(attendance).map(([className, classAttendance]) => (
                    <div key={className}>
                      <div style={styles.classGroupLabel}>Class {className}</div>
                      <div className="pd-table-wrap">
                        <table className="pd-table" style={styles.table}>
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
            <section className="pd-panel" style={styles.panel}>
              <div style={styles.panelTitle}>Payments</div>
              <div className="pd-payment-summary-row">
                <div style={styles.paymentSummaryCard}>
                  <div style={styles.detailLabel}>Monthly fee</div>
                  <div className="pd-stat-value" style={styles.statValue}>${monthlyFee.toLocaleString()}</div>
                </div>
                <div style={styles.paymentSummaryCard}>
                  <div style={styles.detailLabel}>Total paid</div>
                  <div className="pd-stat-value" style={{ ...styles.statValue, color: COLORS.accent }}>
                    ${totalPaid.toLocaleString()}
                  </div>
                </div>
              </div>
              {sortedPayments.length === 0 ? (
                <EmptyState text="No payments have been recorded yet." />
              ) : (
                <div className="pd-table-wrap">
                  <table className="pd-table" style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Date</th>
                        <th style={styles.th}>Amount</th>
                        <th style={styles.th}>Method</th>
                        <th style={styles.th}>Recorded by</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedPayments.map((p) => {
                        const d = p.date?.toDate ? p.date.toDate() : p.date;
                        return (
                          <tr key={p.id}>
                            <td style={styles.td}>
                              {d ? new Date(d).toLocaleDateString() : "—"}
                            </td>
                            <td style={styles.td}>${Number(p.amount || 0).toLocaleString()}</td>
                            <td style={styles.td}>{p.method || "—"}</td>
                            <td style={styles.td}>{p.cashierName || "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {tab === "reports" && (
            <section className="pd-panel" style={styles.panel}>
              <div style={styles.panelTitle}>Reports &amp; concerns</div>
              {hasConcern ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {((attendanceRate !== null && attendanceRate < 75) ||
                    attendanceStats.absent >= 3) && (
                    <div style={styles.concernCard}>
                      <div style={styles.concernTitle}>Attendance needs attention</div>
                      <div style={styles.concernBody}>
                        {attendanceRate !== null
                          ? `Your child's attendance rate is ${attendanceRate}%, with ${attendanceStats.absent} absence(s) recorded. Consider following up with the school.`
                          : `Your child has ${attendanceStats.absent} absence(s) recorded. Consider following up with the school.`}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <EmptyState text="No attendance concerns at this time." />
              )}
            </section>
          )}

          {tab === "messages" && (
            <section className="pd-panel" style={styles.panel}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
                <div style={{ ...styles.panelTitle, marginBottom: 0 }}>Messages from admin</div>
                {unreadMessages > 0 && (
                  <button
                    onClick={markAllAsRead}
                    disabled={markingRead}
                    style={styles.markReadBtn}
                  >
                    {markingRead ? "Marking…" : `Mark all as read (${unreadMessages})`}
                  </button>
                )}
              </div>
              {messages.length === 0 ? (
                <EmptyState text="No messages yet." />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {messages.map((m) => {
                    const when = m.createdAt?.toDate
                      ? m.createdAt.toDate()
                      : m.createdAt
                      ? new Date(m.createdAt)
                      : null;
                    return (
                      <div key={m.id} style={styles.messageCard}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                          <div style={styles.messageTitle}>
                            {m.subject || m.title || "Announcement"}
                          </div>
                          {m.read === false && (
                            <span style={{ ...styles.navBadge, flexShrink: 0 }}>New</span>
                          )}
                        </div>
                        <div style={styles.messageBody}>{m.text || m.body}</div>
                        <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 8 }}>
                          {m.senderName ? `From ${m.senderName}` : ""}
                          {when ? ` · ${when.toLocaleString()}` : ""}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </main>
      </div>

      {/* Mobile bottom nav (visible only on small screens) */}
      <nav className="pd-bottom-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`pd-bottom-nav-item${tab === item.key ? " active" : ""}`}
          >
            <span style={{ fontSize: 17, lineHeight: 1 }}>{item.icon}</span>
            <span>{item.label}</span>
            {item.key === "messages" && unreadMessages > 0 && (
              <span className="pd-bottom-badge">{unreadMessages}</span>
            )}
            {item.key === "reports" && hasConcern && (
              <span className="pd-bottom-badge" style={{ background: COLORS.warn }}>!</span>
            )}
            {tab === item.key && <span className="pd-bottom-dot" />}
          </button>
        ))}
      </nav>
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div className="pd-panel" style={styles.panel}>
      <div style={{ ...styles.statBar, background: accent }} />
      <div style={styles.statLabel}>{label}</div>
      <div className="pd-stat-value" style={styles.statValue}>{value}</div>
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
  page: {
    minHeight: "100vh",
    background: COLORS.bg,
    color: COLORS.text,
    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
  },
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
  markReadBtn: {
    padding: "8px 14px",
    borderRadius: 8,
    border: `1px solid ${COLORS.accent}`,
    background: COLORS.accentSoft,
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  messageCard: {
    background: COLORS.panelSoft,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 12,
    padding: 16,
  },
  messageTitle: { fontWeight: 600, marginBottom: 6, fontSize: 14 },
  messageBody: { fontSize: 13, color: COLORS.textDim, lineHeight: 1.5 },
  concernCard: {
    background: "rgba(239,90,111,0.1)",
    border: `1px solid ${COLORS.danger}`,
    borderRadius: 12,
    padding: 18,
  },
  concernTitle: { fontWeight: 700, color: COLORS.danger, marginBottom: 8, fontSize: 14 },
  concernBody: { fontSize: 13, color: COLORS.text, lineHeight: 1.5 },
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
};