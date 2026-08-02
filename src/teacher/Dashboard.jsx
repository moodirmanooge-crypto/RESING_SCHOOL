// src/teacher/Dashboard.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase/firebase";
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import {
  GraduationCap,
  Users,
  UserCheck,
  UserX,
  CalendarCheck2,
  FileEdit,
  BarChart3,
  School,
  Mail,
  MailOpen,
  IdCard,
} from "lucide-react";

import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import TeacherIdCard from "./TeacherIdCard";
import MobileBottomNav from "./MobileBottomNav";
import ShiftClock from "./ShiftClock";
import { useMessages } from "../context/MessagesContext"; // Hubi path-kan

function DashboardStyles() {
  return (
    <style>{`
      .td-layout { display: flex; min-height: 100vh; background: #05070D; }
      .td-content { flex: 1; display: flex; flex-direction: column; min-width: 0; }
      .td-body { padding: 0 20px 30px; }
      .td-stat-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 20px;
        margin-bottom: 24px;
      }
      .td-classes-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 16px;
      }
      .td-quick-actions { display: flex; gap: 16px; flex-wrap: wrap; }
      .td-attendance-row { display: flex; align-items: center; gap: 24px; flex-wrap: wrap; }

      @media (max-width: 900px) {
        /* Bottom tab bar takes over navigation on mobile, so the old
           sidebar is fully hidden here (handled in Sidebar.jsx itself)
           and page content gets extra bottom padding so the fixed bar
           never overlaps the last section. */
        .td-body { padding: 0 14px 90px; }
        .td-stat-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
        .td-panel { padding: 16px !important; border-radius: 16px !important; }
        .td-classes-grid { grid-template-columns: 1fr 1fr; gap: 12px; }
        .td-stat-value { font-size: 24px !important; }
        .td-quick-actions button { flex: 1 1 45%; justify-content: center; }
        .td-attendance-row { gap: 14px; }
        .td-attendance-row button { margin-left: 0 !important; width: 100%; text-align: left; }
      }

      @media (max-width: 480px) {
        .td-stat-grid { grid-template-columns: 1fr 1fr; }
        .td-classes-grid { grid-template-columns: 1fr; }
        .td-quick-actions button { flex: 1 1 100%; }
      }
    `}</style>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { allMessages, markAsRead } = useMessages();

  const [teacherName, setTeacherName] = useState("Teacher");
  const [teacherUsername, setTeacherUsername] = useState("");
  const [teacherData, setTeacherData] = useState(null);
  const [classes, setClasses] = useState([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [presentToday, setPresentToday] = useState(0);
  const [absentToday, setAbsentToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showIdCard, setShowIdCard] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);

      // teacherId stored in localStorage at login time IS the teacher's
      // Firestore document id, which is also their login username
      // (e.g. "moodir1"). This is what the ID card shows as "TEACHER ID".
      const id = localStorage.getItem("teacherId") || "";
      setTeacherUsername(id);

      const teacherNameStored = localStorage.getItem("teacherName");
      if (teacherNameStored) setTeacherName(teacherNameStored);

      if (id) {
        try {
          const teacherSnap = await getDoc(doc(db, "teachers", id));
          if (teacherSnap.exists()) {
            const data = teacherSnap.data();
            setTeacherData(data);
            if (data.fullName) setTeacherName(data.fullName);
          }
        } catch (e) {
          setTeacherData(null);
        }
      }

      const classesSnap = await getDocs(
        query(collection(db, "classes"), where("teacherId", "==", id))
      );
      const classList = classesSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setClasses(classList);

      const studentsSnap = await getDocs(collection(db, "students"));
      setTotalStudents(studentsSnap.size);

      const today = new Date().toISOString().slice(0, 10);
      const attSnap = await getDocs(
        query(collection(db, "attendance"), where("date", "==", today))
      );

      let present = 0;
      let absent = 0;
      attSnap.docs.forEach((d) => {
        const data = d.data();
        if (data.status === "Present") present++;
        if (data.status === "Absent") absent++;
      });

      setPresentToday(present);
      setAbsentToday(absent);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      label: "My Classes",
      value: classes.length,
      icon: School,
      ring: "#6D5DF0",
      bg: "rgba(109,93,240,0.15)",
    },
    {
      label: "Total Students",
      value: totalStudents,
      icon: GraduationCap,
      ring: "#22C55E",
      bg: "rgba(34,197,94,0.15)",
    },
    {
      label: "Present Today",
      value: presentToday,
      icon: UserCheck,
      ring: "#17A2B8",
      bg: "rgba(23,162,184,0.15)",
    },
    {
      label: "Absent Today",
      value: absentToday,
      icon: UserX,
      ring: "#EF4444",
      bg: "rgba(239,68,68,0.15)",
    },
  ];

  const quickActions = [
    { label: "Mark Attendance", icon: CalendarCheck2, path: "/teacher/attendance" },
    { label: "Create Exam", icon: FileEdit, path: "/teacher/exams" },
    { label: "View Results", icon: BarChart3, path: "/teacher/results" },
    { label: "View Students", icon: Users, path: "/teacher/students" },
  ];

  const formatTime = (createdAt) => {
    if (!createdAt) return "";
    const d = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    return d.toLocaleString();
  };

  // Kaliya 5-ta ugu dambeeyay ayaa Dashboard-ka lagu tusayaa
  const recentMessages = allMessages.slice(0, 5);

  return (
    <div className="td-layout">
      <DashboardStyles />
      <Sidebar teacherName={teacherName} />

      <div className="td-content">
        <Topbar teacherName={teacherName} />

        {loading ? (
          <p style={{ padding: 30, color: "#94A3B8" }}>Loading dashboard...</p>
        ) : (
          <div className="td-body">
            {/* Stat Cards */}
            <div className="td-stat-grid">
              {statCards.map((c) => {
                const Icon = c.icon;
                return (
                  <div
                    key={c.label}
                    className="td-panel"
                    style={{
                      background: "#0B1120",
                      borderRadius: 20,
                      padding: 22,
                      border: "1px solid rgba(255,255,255,.06)",
                    }}
                  >
                    <div
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: "50%",
                        background: c.bg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: 16,
                      }}
                    >
                      <Icon size={22} color={c.ring} />
                    </div>
                    <h3 className="td-stat-value" style={{ margin: 0, fontSize: 30, color: "#fff" }}>
                      {c.value}
                    </h3>
                    <p style={{ margin: "4px 0 0", color: "#94A3B8" }}>
                      {c.label}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Shift Clock In / Out */}
            <ShiftClock />

            

            {/* Fariimaha ugu dambeeyay */}
            <div
              className="td-panel"
              style={{
                background: "#0B1120",
                borderRadius: 20,
                padding: 24,
                marginBottom: 24,
                border: "1px solid rgba(255,255,255,.06)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 16,
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <h3 style={{ margin: 0, color: "#fff" }}>Fariimaha</h3>
                <button
                  onClick={() => navigate("/teacher/messages")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#8B5CF6",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: "bold",
                  }}
                >
                  Dhammaan Fariimaha →
                </button>
              </div>

              {recentMessages.length === 0 ? (
                <p style={{ color: "#94A3B8" }}>Weli fariin lama helin.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {recentMessages.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => {
                        markAsRead(m);
                        navigate("/teacher/messages");
                      }}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                        padding: "12px 14px",
                        borderRadius: 12,
                        cursor: "pointer",
                        background: m.read
                          ? "#111827"
                          : "rgba(139,92,246,.10)",
                        border: m.read
                          ? "1px solid rgba(255,255,255,.06)"
                          : "1px solid rgba(139,92,246,.3)",
                      }}
                    >
                      {m.read ? (
                        <MailOpen size={16} color="#94A3B8" style={{ marginTop: 2, flexShrink: 0 }} />
                      ) : (
                        <Mail size={16} color="#8B5CF6" style={{ marginTop: 2, flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ color: "#fff", fontWeight: m.read ? 500 : 700, fontSize: 14 }}>
                            {m.subject || "(Cinwaan la'aan)"}
                          </span>
                          <span style={{ color: "#64748B", fontSize: 11, flexShrink: 0 }}>
                            {formatTime(m.createdAt)}
                          </span>
                        </div>
                        <p style={{ margin: "2px 0 0", color: "#94A3B8", fontSize: 12 }}>
                          {m.body || m.text}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* My Classes */}
            <div
              className="td-panel"
              style={{
                background: "#0B1120",
                borderRadius: 20,
                padding: 24,
                marginBottom: 24,
                border: "1px solid rgba(255,255,255,.06)",
              }}
            >
              <h3 style={{ marginTop: 0, color: "#fff" }}>My Classes</h3>

              {classes.length === 0 ? (
                <p style={{ color: "#94A3B8" }}>No classes assigned yet.</p>
              ) : (
                <div className="td-classes-grid">
                  {classes.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        border: "1px solid rgba(255,255,255,.08)",
                        borderRadius: 15,
                        padding: 16,
                        background: "#111827",
                      }}
                    >
                      <h4 style={{ margin: "0 0 6px 0", color: "#fff" }}>
                        {c.className}
                      </h4>
                      <p style={{ margin: 0, color: "#94A3B8" }}>
                        Section: {c.section || "-"}
                      </p>
                      <p style={{ margin: 0, color: "#94A3B8" }}>
                        Students: {c.studentCount || 0}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Today's Attendance */}
            <div
              className="td-panel"
              style={{
                background: "#0B1120",
                borderRadius: 20,
                padding: 24,
                marginBottom: 24,
                border: "1px solid rgba(255,255,255,.06)",
              }}
            >
              <h3 style={{ marginTop: 0, color: "#fff" }}>Today's Attendance</h3>
              <div className="td-attendance-row">
                <span style={{ color: "#22C55E", fontWeight: "bold" }}>
                  Present: {presentToday}
                </span>
                <span style={{ color: "#EF4444", fontWeight: "bold" }}>
                  Absent: {absentToday}
                </span>
                <button
                  onClick={() => navigate("/teacher/attendance")}
                  style={{
                    marginLeft: "auto",
                    background: "none",
                    border: "none",
                    color: "#8B5CF6",
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: "bold",
                  }}
                >
                  Take / Update Attendance →
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div
              className="td-panel"
              style={{
                background: "#0B1120",
                borderRadius: 20,
                padding: 24,
                border: "1px solid rgba(255,255,255,.06)",
              }}
            >
              <h3 style={{ marginTop: 0, color: "#fff" }}>Quick Actions</h3>
              <div className="td-quick-actions">
                {quickActions.map((a) => {
                  const Icon = a.icon;
                  return (
                    <button
                      key={a.label}
                      onClick={() => navigate(a.path)}
                      style={{
                        background: "linear-gradient(90deg,#6D5DF0,#8B5CF6)",
                        color: "white",
                        border: "none",
                        borderRadius: 15,
                        padding: "14px 22px",
                        cursor: "pointer",
                        fontWeight: "bold",
                        fontSize: 14,
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <Icon size={18} />
                      {a.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom tab bar — mobile only (hidden via CSS on desktop) */}
      <MobileBottomNav />
    </div>
  );
}