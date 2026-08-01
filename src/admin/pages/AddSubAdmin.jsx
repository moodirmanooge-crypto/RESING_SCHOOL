// src/admin/pages/AddSubAdmin.jsx
//
// Super Admin only: creates a sub-admin account (email + password) and
// assigns which sidebar sections they can access, via a checklist drawn
// from the SAME menu list used by Sidebar.jsx (see PERMISSION_OPTIONS
// below — keep it in sync with admin/components/Sidebar.jsx `menus`).
//
// Saved to Firestore `admin/{email}` with role: "subadmin" and a
// `permissions` array of path strings. Sidebar.jsx filters its menu
// items against this array for any admin whose role !== "admin".

import { useState } from "react";
import { db } from "../../firebase/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { UserPlus, Mail, Lock, User as UserIcon, ShieldCheck } from "lucide-react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

// Kept in sync with admin/components/Sidebar.jsx `menus` array — label +
// path pairs a Super Admin can hand out to a sub-admin.
const PERMISSION_OPTIONS = [
  { label: "Dashboard", path: "/admin/dashboard" },
  { label: "Students", path: "/admin/students" },
  { label: "Teachers", path: "/admin/teachers" },
  { label: "Parents", path: "/admin/parents" },
  { label: "Classes", path: "/admin/classes" },
  { label: "Shifts", path: "/admin/shifts" },
  { label: "Attendance", path: "/admin/attendance" },
  { label: "Holidays", path: "/admin/holidays" },
  { label: "Exams", path: "/admin/exams" },
  { label: "Timetable", path: "/admin/timetable" },
  { label: "Exam Timetable", path: "/admin/exam-timetable" },
  { label: "Exam Cards", path: "/admin/exam-cards" },
  { label: "ID Cards", path: "/admin/id-cards" },
  { label: "Certificates", path: "/admin/certificates" },
  { label: "Results by Class", path: "/admin/results-by-class" },
  { label: "Gallery", path: "/admin/gallery" },
  { label: "News", path: "/admin/news" },
  { label: "Add Cashier", path: "/admin/add-cashier" },
  { label: "Receipts", path: "/admin/receipts" },
  { label: "Messages", path: "/admin/messages" },
  { label: "Reports", path: "/admin/reports" },
  { label: "Settings", path: "/admin/settings" },
];

export default function AddSubAdmin() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [permissions, setPermissions] = useState([]);
  const [saving, setSaving] = useState(false);

  const togglePermission = (path) => {
    setPermissions((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    );
  };

  const toggleAll = () => {
    if (permissions.length === PERMISSION_OPTIONS.length) {
      setPermissions([]);
    } else {
      setPermissions(PERMISSION_OPTIONS.map((o) => o.path));
    }
  };

  const resetForm = () => {
    setFullName("");
    setEmail("");
    setPassword("");
    setPermissions([]);
  };

  const handleCreate = async () => {
    if (!fullName.trim()) {
      alert("Fadlan geli magaca admin-ka.");
      return;
    }
    if (!email.trim()) {
      alert("Fadlan geli email-ka.");
      return;
    }
    if (!password.trim()) {
      alert("Fadlan geli password.");
      return;
    }
    if (permissions.length === 0) {
      alert("Fadlan dooro ugu yaraan hal shaqo (qayb) uu admin-kani qaban karo.");
      return;
    }

    try {
      setSaving(true);

      const adminRef = doc(db, "admin", email.trim());
      const existing = await getDoc(adminRef);
      if (existing.exists()) {
        alert("Email-kan horey admin ayaa u isticmaalay. Fadlan email kale isticmaal.");
        setSaving(false);
        return;
      }

      await setDoc(adminRef, {
        fullName: fullName.trim(),
        email: email.trim(),
        username: email.trim(),
        password: password.trim(),
        role: "subadmin",
        permissions,
        createdAt: new Date(),
      });

      alert("Admin-ka cusub waa la sameeyay.");
      resetForm();
    } catch (err) {
      console.error(err);
      alert("Khalad ayaa dhacay: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0b0a1c" }}>
      <Sidebar />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: "20px 24px 0" }}>
          <Topbar title="Add Sub-Admin" />
        </div>

        <div style={{ padding: "26px 30px", maxWidth: 900 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
            <div
              style={{
                width: 50,
                height: 50,
                borderRadius: 14,
                background: "linear-gradient(135deg,#6d5df0,#8b6cf5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <UserPlus color="#fff" size={24} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#fff" }}>
                Add Sub-Admin
              </h1>
              <p style={{ margin: "3px 0 0", color: "#8b87ad", fontSize: 13 }}>
                Samee admin-hoosaad oo email + password leh, kadibna dooro
                qaybaha uu maamuli karo.
              </p>
            </div>
          </div>

          <div
            style={{
              background: "linear-gradient(160deg,#151233,#181341)",
              borderRadius: 20,
              padding: 26,
              border: "1px solid rgba(139,108,245,0.25)",
              marginBottom: 24,
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
              <Field icon={UserIcon} label="Full Name">
                <input
                  style={input}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Ahmed Ali"
                />
              </Field>

              <Field icon={Mail} label="Email">
                <input
                  style={input}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. ahmed@risingstar.so"
                />
              </Field>

              <Field icon={Lock} label="Password">
                <input
                  style={input}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </Field>
            </div>
          </div>

          <div
            style={{
              background: "linear-gradient(160deg,#151233,#181341)",
              borderRadius: 20,
              padding: 26,
              border: "1px solid rgba(139,108,245,0.25)",
              marginBottom: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ShieldCheck size={18} color="#8b6cf5" />
                <h3 style={{ margin: 0, color: "#fff", fontSize: 15.5 }}>
                  Shaqooyinka Uu Qaban Karo
                </h3>
              </div>
              <button onClick={toggleAll} style={toggleAllBtn}>
                {permissions.length === PERMISSION_OPTIONS.length
                  ? "Ka saar Dhammaan"
                  : "Dooro Dhammaan"}
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 10,
              }}
            >
              {PERMISSION_OPTIONS.map((opt) => {
                const checked = permissions.includes(opt.path);
                return (
                  <label
                    key={opt.path}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: checked
                        ? "1.5px solid rgba(139,108,245,0.6)"
                        : "1.5px solid rgba(255,255,255,0.08)",
                      background: checked
                        ? "rgba(139,108,245,0.12)"
                        : "rgba(255,255,255,0.02)",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePermission(opt.path)}
                      style={{ accentColor: "#8b6cf5", width: 16, height: 16 }}
                    />
                    <span style={{ color: "#e5e3f7", fontSize: 13 }}>{opt.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={saving}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "linear-gradient(90deg,#6d5df0,#8b6cf5)",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              padding: "13px 28px",
              fontWeight: 700,
              fontSize: 14.5,
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            <UserPlus size={17} />
            {saving ? "Samaynaya..." : "Samee Admin-ka"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ icon: Icon, label, children }) {
  return (
    <div>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontWeight: 600,
          marginBottom: 8,
          color: "#fff",
          fontSize: 13.5,
        }}
      >
        <Icon size={15} color="#8b6cf5" />
        {label}
      </label>
      {children}
    </div>
  );
}

const input = {
  width: "100%",
  padding: "12px 14px",
  boxSizing: "border-box",
  border: "1.5px solid rgba(139,108,245,0.3)",
  borderRadius: 10,
  fontSize: 14,
  color: "#e5e3f7",
  background: "rgba(255,255,255,0.02)",
  outline: "none",
};

const toggleAllBtn = {
  border: "1px solid rgba(139,108,245,0.35)",
  background: "rgba(139,108,245,0.1)",
  color: "#8b6cf5",
  fontWeight: 700,
  fontSize: 12,
  padding: "7px 14px",
  borderRadius: 8,
  cursor: "pointer",
};