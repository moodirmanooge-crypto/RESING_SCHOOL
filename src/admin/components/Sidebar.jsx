// Sidebar.jsx — dark green design, large logo
// - Dashboard always stays at the top; the rest of the menu is sorted alphabetically (A → Z)
// - "Teachers" was renamed to "Add Teachers"
// - New page: "Exam Rooms" (exam seating rooms)
// - New page: "Results Submission" (waqtiga gudbinta natiijada + la socodka macalimiinta)
import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { signOutAdmin } from "../../services/adminOtpService";
import { db } from "../../firebase/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import {
  LayoutDashboard,
  GraduationCap,
  Users,
  School,
  Wallet,
  CreditCard,
  UserPlus,
  MessageCircle,
  BarChart3,
  CalendarCheck,
  ClipboardList,
  CalendarDays,
  CalendarClock,
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
  DoorOpen,
  UserRoundPlus,
} from "lucide-react";

import logo from "../assets/logo.png";
import { SCHOOL_NAME, SCHOOL_CITY } from "../schoolInfo";

// Dashboard always stays at the top
const dashboardMenu = { name: "Dashboard", icon: LayoutDashboard, path: "/admin/dashboard" };

// The rest of the menu — order does not matter here, it gets sorted A → Z below.
const otherMenus = [
  { name: "Admissions", icon: ClipboardCheck, path: "/admin/admissions" },
  { name: "Add Student", icon: UserPlus, path: "/admin/add-student" },
  { name: "Bulk Registration", icon: Upload, path: "/admin/bulk-registration" },
  { name: "Student List", icon: GraduationCap, path: "/admin/students" },
  { name: "Add Teachers", icon: UserRoundPlus, path: "/admin/teachers" },
  { name: "Parents", icon: Users, path: "/admin/parents" },
  { name: "Classes", icon: School, path: "/admin/classes" },
  { name: "School Assets", icon: Package, path: "/admin/school-assets" },
  { name: "Shifts", icon: Clock, path: "/admin/shifts" },
  { name: "Attendance", icon: CalendarCheck, path: "/admin/attendance" },
  { name: "Holidays", icon: CalendarOff, path: "/admin/holidays" },
  { name: "Exams", icon: ClipboardList, path: "/admin/exams" },
  { name: "Timetable", icon: CalendarDays, path: "/admin/timetable" },
  { name: "Exam Timetable", icon: FileEdit, path: "/admin/exam-timetable" },
  { name: "Exam Rooms", icon: DoorOpen, path: "/admin/exam-rooms" },
  { name: "Exam Cards", icon: IdCard, path: "/admin/exam-cards" },
  { name: "Exam Payments", icon: CreditCard, path: "/admin/exam-payments" },
  { name: "ID Cards", icon: IdCard, path: "/admin/id-cards" },
  { name: "Certificates", icon: Award, path: "/admin/certificates" },
  { name: "Upload Certificate", icon: UploadCloud, path: "/admin/upload-certificate" },
  { name: "Results by Class", icon: FileSpreadsheet, path: "/admin/results-by-class" },
  // NEW: waqtiga gudbinta natiijada + cidda gudbisay / dhiman + fasaxyada update
  { name: "Results Submission", icon: CalendarClock, path: "/admin/results-submission" },
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

const byName = (a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" });

const menus = [dashboardMenu, ...[...otherMenus].sort(byName)];

// Super-Admin-only menu items
const superAdminOnlyMenus = [
  { name: "Add Sub-Admin", icon: ShieldPlus, path: "/admin/add-sub-admin" },
  { name: "Manage Admins", icon: ShieldCheck, path: "/admin/manage-admins" },
].sort(byName);

const SUPPORT_WHATSAPP = "252617390261";
const SUPPORT_EMAIL = "risingstar0261@gmail.com";

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const navRef = useRef(null);

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
        if (m.path === "/admin/school-assets") {
          return (
            permissions.includes("/admin/school-assets") ||
            permissions.includes("/admin/classes") ||
            permissions.includes("/admin/students")
          );
        }
        if (m.path === "/admin/exam-rooms") {
          return (
            permissions.includes("/admin/exam-rooms") ||
            permissions.includes("/admin/exam-timetable") ||
            permissions.includes("/admin/exams")
          );
        }
        // Results Submission: sub-admin leh Results by Class ama Exams ayaa arki kara
        if (m.path === "/admin/results-submission") {
          return (
            permissions.includes("/admin/results-submission") ||
            permissions.includes("/admin/results-by-class") ||
            permissions.includes("/admin/exams")
          );
        }
        return permissions.includes(m.path);
      })
    : menus;

  // Protection: a sub-admin cannot open a page they are not permitted to see.
  useEffect(() => {
    if (!isSubAdmin) return;
    const path = location.pathname.replace(/\/+$/, "");
    const matchesMenu = (m) => path === m.path || path.startsWith(m.path + "/");

    const isKnownMenuPage =
      menus.some(matchesMenu) || superAdminOnlyMenus.some(matchesMenu);
    if (!isKnownMenuPage) return;

    const allowed = visibleMenus.some(matchesMenu);
    if (allowed) return;

    if (visibleMenus.length > 0) {
      navigate(visibleMenus[0].path, { replace: true });
    }
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = navRef.current?.querySelector(".rs-nav.active");
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [location.pathname]);

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
      gap: 13,
      padding: "10px 14px",
      marginBottom: 3,
      textDecoration: "none",
      color: isActive ? "#fff" : "rgba(255,255,255,0.8)",
      borderRadius: 12,
      transition: "background .2s ease, color .2s ease, transform .2s ease",
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
      <div style={streak1} />
      <div style={streak2} />

      {/* ---------- LOGO ---------- */}
      <div style={{ padding: "22px 18px 12px", textAlign: "center", position: "relative" }}>
        <div style={logoRing}>
          <img src={logo} alt="" style={{ width: "88%", height: "88%", objectFit: "contain" }} />
        </div>
        <div style={schoolName}>{SCHOOL_NAME}</div>
        <div style={schoolCity}>{SCHOOL_CITY}</div>
        <div style={divider} />
      </div>

      {/* ---------- MENU ---------- */}
      <nav
        ref={navRef}
        className="rs-sidebar-scroll"
        style={{ padding: "2px 12px 10px", overflowY: "auto", flex: 1, position: "relative" }}
      >
        {visibleMenus.map((item, i) => {
          const Icon = item.icon;
          const showBadge = item.path === "/admin/admissions" && pendingAdmissions > 0;
          return (
            <div key={item.path}>
              <NavLink to={item.path} className="rs-nav" style={linkStyle("green")}>
                <Icon size={19} />
                <span style={{ flex: 1 }}>{item.name}</span>
                {showBadge && <span style={badge}>{pendingAdmissions}</span>}
              </NavLink>
              {i === 0 && item.path === dashboardMenu.path && visibleMenus.length > 1 && (
                <div style={azLabel}>Menu · A → Z</div>
              )}
            </div>
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

      {/* ---------- BOTTOM CARD ---------- */}
      <div style={{ padding: "10px 14px 14px", position: "relative", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={bottomCard}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 24, lineHeight: 1 }}>🎓</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "#fff", lineHeight: 1.3, textAlign: "left" }}>
              Education Empowers Communities
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <a href={`https://wa.me/${SUPPORT_WHATSAPP}`} target="_blank" rel="noopener noreferrer" style={supportBtn}>
              <MessageSquare size={13} /> Support
            </a>
            <a href={`mailto:${SUPPORT_EMAIL}`} style={{ ...supportBtn, background: "transparent", border: "1px solid rgba(255,255,255,0.3)" }}>
              <Mail size={13} /> Email
            </a>
          </div>
        </div>

        <button type="button" onClick={handleLogout} style={logoutBtn} className="rs-logout">
          <LogOut size={16} /> Log Out
        </button>
      </div>

      <style>{`
        .rs-nav:not(.active):hover { background: rgba(255,255,255,0.08) !important; color: #fff !important; transform: translateX(3px); }
        .rs-logout:hover { background: rgba(239,68,68,0.22) !important; }
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
  width: 104,
  height: 104,
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
  marginTop: 12,
  fontSize: 14,
  fontWeight: 800,
  color: "#fff",
  lineHeight: 1.3,
  letterSpacing: "0.01em",
};
const schoolCity = {
  marginTop: 5,
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: "0.18em",
  color: "#86efac",
};
const divider = { height: 1, background: "rgba(255,255,255,0.12)", marginTop: 14 };
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
const azLabel = {
  margin: "10px 8px 8px",
  fontSize: 10.5,
  fontWeight: 700,
  color: "rgba(255,255,255,0.45)",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  borderTop: "1px solid rgba(255,255,255,0.1)",
  paddingTop: 10,
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
  borderRadius: 14,
  padding: "11px 12px",
};
const supportBtn = {
  flex: 1,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "7px 0",
  borderRadius: 9,
  background: "#16a34a",
  color: "#fff",
  fontSize: 12,
  fontWeight: 700,
  textDecoration: "none",
};
const logoutBtn = {
  marginTop: 10,
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "10px 0",
  borderRadius: 12,
  border: "1px solid rgba(248,113,113,0.45)",
  background: "rgba(239,68,68,0.12)",
  color: "#fecaca",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  transition: "background .2s ease",
};