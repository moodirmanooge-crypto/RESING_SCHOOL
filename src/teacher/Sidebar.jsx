// src/teacher/Sidebar.jsx
// On mobile (<= 900px) this whole sidebar — including its old mobile
// hamburger topbar and drawer — is hidden. Navigation on mobile is
// handled instead by MobileBottomNav.jsx, matching the student-portal
// pattern shown in the reference screenshot.

import { NavLink, useNavigate } from "react-router-dom";
import { signOutTeacher } from "../services/teacherOtpService";
import {
  LayoutDashboard,
  CalendarCheck2,
  FileEdit,
  BarChart3,
  GraduationCap,
  Mail,
  User,
  LogOut,
  CalendarDays,
} from "lucide-react";
import { useMessages } from "../context/MessagesContext"; // Hubi path-kan

const menus = [
  { name: "Dashboard", icon: LayoutDashboard, path: "/teacher/dashboard" },
  { name: "Attendance", icon: CalendarCheck2, path: "/teacher/attendance" },
  { name: "Messages", icon: Mail, path: "/teacher/messages" },
  { name: "Exams", icon: FileEdit, path: "/teacher/exams" },
  { name: "Results", icon: BarChart3, path: "/teacher/results" },
  { name: "Students", icon: GraduationCap, path: "/teacher/students" },
  { name: "Timetable", icon: CalendarDays, path: "/teacher/timetable" },
  { name: "Profile", icon: User, path: "/teacher/profile" },
];

function SidebarStyles() {
  return (
    <style>{`
      /* Bottom tab bar (MobileBottomNav) fully replaces this sidebar on
         mobile, so hide it completely there instead of turning it into
         a drawer — this is what was showing wrong in the screenshot. */
      @media (max-width: 900px) {
        .tsb-aside { display: none !important; }
      }
    `}</style>
  );
}

export default function Sidebar({ teacherName = "Teacher" }) {
  const navigate = useNavigate();
  const { unreadCount } = useMessages();

  // Ka bax Firebase Auth session-ka (OTP) + xogta UI, kadib login-ka macalinka.
  const logout = async () => {
    await signOutTeacher();
    navigate("/teacher-login");
  };

  return (
    <>
      <SidebarStyles />

      <aside
        className="tsb-aside"
        style={{
          width: 270,
          minHeight: "100vh",
          background: "#0B1120",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          borderRight: "1px solid rgba(255,255,255,.08)",
        }}
      >
        <div>
          <div
            style={{
              padding: 25,
              display: "flex",
              alignItems: "center",
              gap: 15,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 15, minWidth: 0 }}>
              <div
                style={{
                  width: 55,
                  height: 55,
                  borderRadius: 15,
                  background: "linear-gradient(135deg,#6D5DF0,#8B5CF6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 26,
                  flexShrink: 0,
                }}
              >
                🏫
              </div>

              <div style={{ minWidth: 0 }}>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 22,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {localStorage.getItem("teacherName") || "Teacher"}
                </h2>
                <small style={{ color: "#94A3B8" }}>Teacher Panel</small>
              </div>
            </div>
          </div>

          <div style={{ padding: "10px 18px", overflowY: "auto" }}>
            {menus.map((item) => {
              const Icon = item.icon;
              const isMessages = item.path === "/teacher/messages";

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  style={({ isActive }) => ({
                    display: "flex",
                    alignItems: "center",
                    gap: 15,
                    padding: "14px 18px",
                    marginBottom: 8,
                    textDecoration: "none",
                    color: "#fff",
                    borderRadius: 15,
                    transition: ".3s",
                    background: isActive
                      ? "linear-gradient(90deg,#6D5DF0,#8B5CF6)"
                      : "transparent",
                  })}
                >
                  <Icon size={20} />
                  <span style={{ flex: 1 }}>{item.name}</span>
                  {isMessages && unreadCount > 0 && (
                    <span
                      style={{
                        background: "#EF4444",
                        color: "#fff",
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 8px",
                        minWidth: 18,
                        textAlign: "center",
                      }}
                    >
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        </div>

        <div style={{ padding: 20 }}>
          <div
            style={{
              background: "#111827",
              borderRadius: 18,
              padding: 15,
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 15,
            }}
          >
            {localStorage.getItem("teacherPhoto") ? (
              <img
                src={localStorage.getItem("teacherPhoto")}
                alt="Teacher"
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "2px solid #6D5DF0",
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg,#6D5DF0,#8B5CF6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 18,
                  flexShrink: 0,
                }}
              >
                {(localStorage.getItem("teacherName") || "T")
                  .charAt(0)
                  .toUpperCase()}
              </div>
            )}

            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {teacherName}
              </div>
              <small style={{ color: "#94A3B8" }}>Teacher</small>
            </div>
          </div>

          <button
            onClick={logout}
            style={{
              width: "100%",
              height: 50,
              border: "none",
              borderRadius: 15,
              background: "#EF4444",
              color: "#fff",
              cursor: "pointer",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 10,
              fontWeight: 700,
              fontSize: 15,
            }}
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}