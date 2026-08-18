// Sidebar.jsx
import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
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
  HelpCircle,
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
} from "lucide-react";

import logo from "../assets/logo.png";

const menus = [
  { name: "Dashboard", icon: LayoutDashboard, path: "/admin/dashboard" },
  { name: "Admissions", icon: ClipboardCheck, path: "/admin/admissions" },
  { name: "Students", icon: GraduationCap, path: "/admin/students" },
  { name: "Teachers", icon: Users, path: "/admin/teachers" },
  { name: "Parents", icon: Users, path: "/admin/parents" },
  { name: "Classes", icon: School, path: "/admin/classes" },
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
  // A sub-admin's session carries adminRole: "subadmin" and an
  // adminPermissions JSON array of allowed paths (set at login in
  // LoginForm.jsx from their `admin/{email}` doc). The original Super
  // Admin account has no role field (or role: "admin") and always sees
  // every menu item, unfiltered.
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

  // Sub-admins only ever see the menu items they were explicitly handed
  // — everything else is left out of the list entirely, not just
  // disabled, per how this sidebar was scoped.
  const visibleMenus = isSubAdmin
    ? menus.filter((m) => permissions.includes(m.path))
    : menus;

  // Live count of pending admissions — shown as a notification badge
  // next to the "Admissions" menu item so admins immediately see how
  // many new applications are waiting to be reviewed.
  const [pendingAdmissions, setPendingAdmissions] = useState(0);

  useEffect(() => {
    const q = query(
      collection(db, "Admissions"),
      where("status", "==", "Pending")
    );
    const unsub = onSnapshot(
      q,
      (snap) => setPendingAdmissions(snap.size),
      (err) => console.log(err)
    );
    return () => unsub();
  }, []);

  return (
    <aside
      style={{
        width: 270,
        minHeight: "100vh",
        background: "#ffffff",
        color: "#111827",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        borderRight: "1px solid rgba(15,61,46,0.08)",
      }}
    >
      <div>
        {/* Logo */}
        <div
          style={{
            padding: "24px 25px 20px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 12,
              background: "#ffffff",
              border: "1px solid rgba(15,61,46,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              overflow: "hidden",
            }}
          >
            <img
              src={logo}
              alt=""
              style={{
                width: "80%",
                height: "80%",
                objectFit: "contain",
              }}
            />
          </div>

          <div>
            <h2
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 800,
                color: "#14532d",
                lineHeight: 1.2,
                letterSpacing: "0.01em",
              }}
            >
              RiSING SCHOOL
            </h2>
            <small style={{ color: "#9CA3AF", fontSize: 11.5 }}>
              School Management System
            </small>
          </div>
        </div>

        {/* Menu */}
        <div style={{ padding: "8px 18px", overflowY: "auto" }}>
          {visibleMenus.map((item) => {
            const Icon = item.icon;
            const showBadge = item.path === "/admin/admissions" && pendingAdmissions > 0;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                style={({ isActive }) => ({
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "12px 18px",
                  marginBottom: 4,
                  textDecoration: "none",
                  color: isActive ? "#fff" : "#4b5563",
                  borderRadius: 12,
                  transition: "all .2s ease",
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 14,
                  background: isActive
                    ? "linear-gradient(90deg,#16a34a,#15803d)"
                    : "transparent",
                  boxShadow: isActive
                    ? "0 8px 16px rgba(22,163,74,0.25)"
                    : "none",
                })}
              >
                <Icon size={18} />
                <span style={{ flex: 1 }}>{item.name}</span>
                {showBadge && (
                  <span
                    style={{
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
                    }}
                  >
                    {pendingAdmissions}
                  </span>
                )}
              </NavLink>
            );
          })}

          {!isSubAdmin && (
            <>
              <div
                style={{
                  margin: "14px 4px 8px",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#9CA3AF",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  borderTop: "1px solid rgba(15,61,46,0.08)",
                  paddingTop: 14,
                }}
              >
                Super Admin
              </div>
              {superAdminOnlyMenus.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    style={({ isActive }) => ({
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: "12px 18px",
                      marginBottom: 4,
                      textDecoration: "none",
                      color: isActive ? "#fff" : "#4b5563",
                      borderRadius: 12,
                      transition: "all .2s ease",
                      fontWeight: isActive ? 700 : 500,
                      fontSize: 14,
                      background: isActive
                        ? "linear-gradient(90deg,#f59e0b,#d97706)"
                        : "transparent",
                      boxShadow: isActive
                        ? "0 8px 16px rgba(245,158,11,0.25)"
                        : "none",
                    })}
                  >
                    <Icon size={18} />
                    <span>{item.name}</span>
                  </NavLink>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* Help card */}
      <div style={{ padding: 20 }}>
        <div
          style={{
            background: "linear-gradient(145deg,#EFFBF3,#E6F5EC)",
            border: "1px solid rgba(22,163,74,0.15)",
            borderRadius: 18,
            padding: "20px 18px",
            textAlign: "center",
          }}
        >
          <HelpCircle size={30} color="#16a34a" style={{ marginBottom: 8 }} />
          <div style={{ fontWeight: 700, fontSize: 13.5, color: "#14532d" }}>
            Need Help?
          </div>
          <div style={{ fontSize: 12, color: "#4b5563", marginTop: 2 }}>
            We're here to help you
          </div>
          <a
            href={`https://wa.me/${SUPPORT_WHATSAPP}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              marginTop: 12,
              width: "100%",
              padding: "9px 0",
              borderRadius: 10,
              border: "none",
              background: "#16a34a",
              color: "#fff",
              fontWeight: 700,
              fontSize: 12.5,
              cursor: "pointer",
              display: "block",
              textAlign: "center",
              textDecoration: "none",
            }}
          >
            Contact Support
          </a>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            style={{
              marginTop: 8,
              width: "100%",
              padding: "9px 0",
              borderRadius: 10,
              border: "1px solid rgba(22,163,74,0.3)",
              background: "transparent",
              color: "#16a34a",
              fontWeight: 700,
              fontSize: 12.5,
              cursor: "pointer",
              display: "block",
              textAlign: "center",
              textDecoration: "none",
            }}
          >
            Email Support
          </a>
        </div>
      </div>
    </aside>
  );
}