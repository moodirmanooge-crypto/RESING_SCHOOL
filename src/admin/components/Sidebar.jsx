// Sidebar.jsx — naqshad cagaar madow ah (dark green) oo logo weyn leh
import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { signOutAdmin } from "../../services/adminOtpService";
import { db } from "../../firebase/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import {
  LayoutDashboard,
  GraduationCap,
  Users,
  School,
  Wallet,
  UserPlus,
  MessageCircle,
  BarChart3,
  CalendarCheck,
  ClipboardList,
  CalendarDays,
  FileEdit,
  IdCard,
  Award,
  Settings,
  Clock,
  Receipt,
  FileSpreadsheet,
  CalendarOff,
  Image as ImageIcon,
  Newspaper,
  ShieldPlus,
  ShieldCheck,
  ClipboardCheck,
  BookOpen,
  UploadCloud,
  Trash2,
  Package,
  MessageSquare,
  Mail,
  Upload,
  LogOut,
} from "lucide-react";

import logo from "../assets/logo.png";
import { SCHOOL_NAME, SCHOOL_CITY } from "../schoolInfo";

const menus = [
  { name: "Dashboard", icon: LayoutDashboard, path: "/admin/dashboard" },
  { name: "Admissions", icon: ClipboardCheck, path: "/admin/admissions" },
  { name: "Add Student", icon: UserPlus, path: "/admin/add-student" },
  // Diiwaan-gelin badan hal mar (Bulk)
  { name: "Bulk Registration", icon: Upload, path: "/admin/bulk-registration" },
  { name: "Student List", icon: GraduationCap, path: "/admin/students" },
  { name: "Teachers", icon: Users, path: "/admin/teachers" },
  { name: "Parents", icon: Users, path: "/admin/parents" },
  { name: "Classes", icon: School, path: "/admin/classes" },
  // Hantida dugsiga: kuraasta, miisaska, sabuuradaha iwm + tirada wiilasha/gabdhaha
  { name: "School Assets", icon: Package, path: "/admin/school-assets" },
  { name: "Shifts", icon: Clock, path: "/admin/shifts" },
  { name: "Attendance", icon: CalendarCheck, path: "/admin/attendance" },
  { name: "Holidays", icon: CalendarOff, path: "/admin/holidays" },
  { name: "Exams", icon: ClipboardList, path: "/admin/exams" },
  { name: "Timetable", icon: CalendarDays, path: "/admin/timetable" },
  { name: "Exam Timetable", icon: FileEdit, path: "/admin/exam-timetable" },
  { name: "Exam Cards", icon: IdCard, path: "/admin/exam-cards" },
  { name: "ID Cards", icon: IdCard, path: "/admin/id-cards" },
  { name: "Certificates", icon: Award, path: "/admin/certificates" },
  { name: "Upload Certificate", icon: UploadCloud, path: "/admin/upload-certificate" },
  { name: "Results by Class", icon: FileSpreadsheet, path: "/admin/results-by-class" },
  { name: "Gallery", icon: ImageIcon, path: "/admin/gallery" },
  { name: "News", icon: Newspaper, path: "/admin/news" },
  { name: "Library", icon: BookOpen, path: "/admin/library" },
  { name: "Add Cashier", icon: Wallet, path: "/admin/add-cashier" },
  { name: "Receipts", icon: Receipt, path: "/admin/receipts" },
  { name: "Recycle Bin", icon: Trash2, path: "/admin/recycle-bin" },
  { name: "Messages", icon: MessageCircle, path: "/admin/messages" },
  { name: "Reports", icon: BarChart3, path: "/admin/reports" },
  { name: "Settings", icon: Settings, path: "/admin/settings" },
];

// Super-Admin-only menu items — never filtered by permissions, never
// shown to a sub-admin regardless of what was assigned to them.
const superAdminOnlyMenus = [
  { name: "Add Sub-Admin", icon: ShieldPlus, path: "/admin/add-sub-admin" },
  { name: "Manage Admins", icon: ShieldCheck, path: "/admin/manage-admins" },
];

const SUPPORT_WHATSAPP = "252617390261"; // international format, no + or leading 0
const SUPPORT_EMAIL = "risingstar0261@gmail.com";

export default function Sidebar() {
  const navigate = useNavigate();

  // Ka bax Firebase Auth session-ka (OTP) + xogta UI, kadib login-ka admin-ka.
  // Dashboard-ka dib looma geli karo password + code cusub la'aantood.
  async function handleLogout() {
    await signOutAdmin();
    navigate("/admin-login");
  }

  const adminRole = localStorage.getItem("adminRole") || "admin";
  const isSubAdmin = adminRole === "subadmin";

  let permissions = [];
  if (isSubAdmin) {
    try {
      permissions = JSON.parse(localStorage.getItem("adminPermissions") || "[]");
    } catch (e) {
      permissions = [];
    }
  }

  const visibleMenus = isSubAdmin
    ? menus.filter((m) => {
        if (m.path === "/admin/add-student" || m.path === "/admin/bulk-registration") {
          if (permissions.includes(m.path)) return true;
          return (
            permissions.includes("/admin/add-student") ||
            permissions.includes("/admin/students")
          );
        }
        // School Assets: sub-admin-ka haysta Classes ama Student List wuu arkaa
        if (m.path === "/admin/school-assets") {
          return (
            permissions.includes("/admin/school-assets") ||
            permissions.includes("/admin/classes") ||
            permissions.includes("/admin/students")
          );
        }
        return permissions.includes(m.path);
      })
    : menus;

  const [pendingAdmissions, setPendingAdmissions] = useState(0);

  useEffect(() => {
    const q = query(collection(db, "Admissions"), where("status", "==", "Pending"));
    const unsub = onSnapshot(
      q,
      (snap) => setPendingAdmissions(snap.size),
      (err) => console.log(err)
    );
    return () => unsub();
  }, []);

  const linkStyle =
    (accent = "green") =>
    ({ isActive }) => ({
      display: "flex",
      alignItems: "center",
      gap: 14,
      padding: "11px 16px",
      marginBottom: 3,
      textDecoration: "none",
      color: isActive ? "#fff" : "rgba(255,255,255,0.82)",
      borderRadius: 12,
      transition: "background .2s ease, color .2s ease",
      fontWeight: isActive ? 700 : 500,
      fontSize: 14.5,
      background: isActive
        ? accent === "amber"
          ? "linear-gradient(90deg,#f59e0b,#d97706)"
          : "linear-gradient(90deg,#22a447,#15803d)"
        : "transparent",
      border: isActive
        ? `1.5px solid ${accent === "amber" ? "rgba(253,230,138,0.6)" : "rgba(187,247,208,0.55)"}`
        : "1.5px solid transparent",
      boxShadow: isActive ? "0 8px 18px rgba(0,0,0,0.25)" : "none",
    });

  return (
    <aside className="rs-sidebar" style={aside}>
      {/* Xariiqyo qurxin ah (diagonal light streaks) */}
      <div style={streak1} />
      <div style={streak2} />

      {/* ---------- LOGO ---------- */}
      <div style={{ padding: "26px 20px 18px", textAlign: "center", position: "relative" }}>
        <div style={logoRing}>
          <img src={logo} alt="" style={{ width: "86%", height: "86%", objectFit: "contain" }} />
        </div>
        <div style={schoolName}>{SCHOOL_NAME}</div>
        <div style={schoolCity}>{SCHOOL_CITY}</div>
        <div style={divider} />
      </div>

      {/* ---------- MENU ---------- */}
      <nav className="rs-sidebar-scroll" style={{ padding: "4px 14px", overflowY: "auto", flex: 1, position: "relative" }}>
        {visibleMenus.map((item) => {
          const Icon = item.icon;
          const showBadge = item.path === "/admin/admissions" && pendingAdmissions > 0;
          return (
            <NavLink key={item.path} to={item.path} className="rs-nav" style={linkStyle("green")}>
              <Icon size={19} />
              <span style={{ flex: 1 }}>{item.name}</span>
              {showBadge && <span style={badge}>{pendingAdmissions}</span>}
            </NavLink>
          );
        })}

        {!isSubAdmin && (
          <>
            <div style={sectionLabel}>Super Admin</div>
            {superAdminOnlyMenus.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink key={item.path} to={item.path} className="rs-nav" style={linkStyle("amber")}>
                  <Icon size={19} />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
          </>
        )}
      </nav>

      {/* ---------- KAARKA HOOSE ---------- */}
      <div style={{ padding: 16, position: "relative" }}>
        <div style={bottomCard}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 34, lineHeight: 1 }}>🎓</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", lineHeight: 1.35, textAlign: "left" }}>
              Education Empowers Communities
            </div>
          </div>
          <div style={{ width: 70, height: 3, background: "#facc15", borderRadius: 4, margin: "10px 0 12px" }} />
          <div style={{ display: "flex", gap: 8 }}>
            <a href={`https://wa.me/${SUPPORT_WHATSAPP}`} target="_blank" rel="noopener noreferrer" style={supportBtn}>
              <MessageSquare size={13} /> Support
            </a>
            <a href={`mailto:${SUPPORT_EMAIL}`} style={{ ...supportBtn, background: "transparent", border: "1px solid rgba(255,255,255,0.3)" }}>
              <Mail size={13} /> Email
            </a>
          </div>
        </div>

        <button type="button" onClick={handleLogout} style={logoutBtn}>
          <LogOut size={16} /> Log Out
        </button>
      </div>

      <style>{`
        .rs-nav:not(.active):hover { background: rgba(255,255,255,0.08) !important; color: #fff !important; }
        .rs-sidebar-scroll::-webkit-scrollbar { width: 6px; }
        .rs-sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.18); border-radius: 6px; }
        .rs-sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
      `}</style>
    </aside>
  );
}

// ---------------- styles ----------------
const aside = {
  width: 272,
  minWidth: 272,
  height: "100vh",
  position: "sticky",
  top: 0,
  alignSelf: "flex-start",
  background: "linear-gradient(170deg,#0d3b24 0%,#0f4a2c 45%,#0a2f1c 100%)",
  color: "#fff",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  borderTopRightRadius: 22,
  borderBottomRightRadius: 22,
  boxShadow: "6px 0 24px rgba(10,47,28,0.25)",
};
const streak1 = {
  position: "absolute",
  top: 260,
  right: -120,
  width: 260,
  height: 2,
  background: "linear-gradient(90deg,transparent,rgba(134,239,172,0.35),transparent)",
  transform: "rotate(-40deg)",
  pointerEvents: "none",
};
const streak2 = { ...streak1, top: 520, right: -140, opacity: 0.6 };
const logoRing = {
  width: 128,
  height: 128,
  margin: "0 auto",
  borderRadius: "50%",
  background: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 0 0 4px rgba(255,255,255,0.12), 0 10px 26px rgba(0,0,0,0.35)",
  overflow: "hidden",
};
const schoolName = {
  marginTop: 14,
  fontSize: 15,
  fontWeight: 800,
  color: "#fff",
  lineHeight: 1.3,
  letterSpacing: "0.01em",
};
const schoolCity = {
  marginTop: 6,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.18em",
  color: "#86efac",
};
const divider = { height: 1, background: "rgba(255,255,255,0.12)", marginTop: 16 };
const badge = {
  minWidth: 20,
  height: 20,
  padding: "0 6px",
  borderRadius: 999,
  background: "#ef4444",
  color: "#fff",
  fontSize: 11,
  fontWeight: 800,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
const sectionLabel = {
  margin: "14px 6px 8px",
  fontSize: 11,
  fontWeight: 700,
  color: "rgba(255,255,255,0.5)",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  borderTop: "1px solid rgba(255,255,255,0.1)",
  paddingTop: 14,
};
const bottomCard = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 16,
  padding: "14px 16px",
};
const supportBtn = {
  flex: 1,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "8px 0",
  borderRadius: 9,
  background: "#16a34a",
  color: "#fff",
  fontSize: 12,
  fontWeight: 700,
  textDecoration: "none",
};
const logoutBtn = {
  marginTop: 12,
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "11px 0",
  borderRadius: 12,
  border: "1px solid rgba(248,113,113,0.45)",
  background: "rgba(239,68,68,0.12)",
  color: "#fecaca",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};