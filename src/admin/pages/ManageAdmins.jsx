// src/admin/pages/ManageAdmins.jsx
//
// Super Admin only: lists every account in the `admin` collection,
// showing role (Super Admin vs Sub-Admin) and, for sub-admins, which
// sidebar sections they're allowed to use. Lets the Super Admin edit a
// sub-admin's permissions or delete their account. The permanent Super
// Admin account (role === "admin") cannot be deleted from here.

import { useEffect, useState } from "react";
import { db } from "../../firebase/firebase";
import { collection, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { Users, ShieldCheck, Pencil, Trash2, X, Save } from "lucide-react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

// Kept in sync with admin/components/Sidebar.jsx `menus` array.
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

function labelFor(path) {
  return PERMISSION_OPTIONS.find((o) => o.path === path)?.label || path;
}

export default function ManageAdmins() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState(null);
  const [editPermissions, setEditPermissions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    fetchAdmins();
  }, []);

  async function fetchAdmins() {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, "admin"));
      setAdmins(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function openEdit(adminItem) {
    setEditTarget(adminItem);
    setEditPermissions(adminItem.permissions || []);
  }

  function closeEdit() {
    setEditTarget(null);
    setEditPermissions([]);
  }

  function togglePermission(path) {
    setEditPermissions((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    );
  }

  async function saveEdit() {
    if (editPermissions.length === 0) {
      alert("Fadlan dooro ugu yaraan hal shaqo.");
      return;
    }
    try {
      setSaving(true);
      await updateDoc(doc(db, "admin", editTarget.id), {
        permissions: editPermissions,
      });
      setAdmins((prev) =>
        prev.map((a) =>
          a.id === editTarget.id ? { ...a, permissions: editPermissions } : a
        )
      );
      closeEdit();
    } catch (err) {
      console.error(err);
      alert("Khalad ayaa dhacay: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(adminItem) {
    try {
      await deleteDoc(doc(db, "admin", adminItem.id));
      setAdmins((prev) => prev.filter((a) => a.id !== adminItem.id));
      setConfirmDelete(null);
    } catch (err) {
      console.error(err);
      alert("Khalad ayaa dhacay marka la tirtirayay: " + err.message);
    }
  }

  const isSuperAdmin = (a) => a.role === "admin";

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0b0a1c" }}>
      <Sidebar />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: "20px 24px 0" }}>
          <Topbar title="Manage Admins" />
        </div>

        <div style={{ padding: "26px 30px" }}>
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
              <Users color="#fff" size={24} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#fff" }}>
                Manage Admins
              </h1>
              <p style={{ margin: "3px 0 0", color: "#8b87ad", fontSize: 13 }}>
                Dhammaan admin-yada iyo admin-hoosaadyada — samee wax-ka-bedel ama tirtir
              </p>
            </div>
          </div>

          {loading ? (
            <p style={{ color: "#8b87ad" }}>Loading...</p>
          ) : admins.length === 0 ? (
            <p style={{ color: "#8b87ad" }}>Wax admin ah lama helin.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {admins.map((a) => (
                <div
                  key={a.id}
                  style={{
                    background: "linear-gradient(160deg,#1c1840,#211c48)",
                    borderRadius: 16,
                    padding: 18,
                    border: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 14,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: "50%",
                          background: isSuperAdmin(a)
                            ? "linear-gradient(135deg,#f59e0b,#d97706)"
                            : "linear-gradient(135deg,#6d5df0,#8b6cf5)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: 15,
                          flexShrink: 0,
                        }}
                      >
                        {(a.fullName || a.email || "?").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ color: "#fff", fontWeight: 700, fontSize: 14.5 }}>
                          {a.fullName || a.username || "—"}
                          {isSuperAdmin(a) && (
                            <span
                              style={{
                                marginLeft: 8,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                background: "rgba(245,158,11,0.15)",
                                color: "#f59e0b",
                                fontSize: 10.5,
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: 999,
                              }}
                            >
                              <ShieldCheck size={11} /> Super Admin
                            </span>
                          )}
                        </div>
                        <div style={{ color: "#8b87ad", fontSize: 12 }}>
                          {a.email || a.username || "—"}
                        </div>
                      </div>
                    </div>

                    {!isSuperAdmin(a) && (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => openEdit(a)} style={iconBtnEdit}>
                          <Pencil size={14} />
                        </button>
                        {confirmDelete === a.id ? (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              onClick={() => handleDelete(a)}
                              style={{ ...iconBtnDelete, width: "auto", padding: "0 10px" }}
                            >
                              Xaqiiji
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              style={{
                                border: "1px solid rgba(255,255,255,0.15)",
                                background: "transparent",
                                color: "#a9a6c4",
                                fontSize: 12,
                                borderRadius: 8,
                                padding: "0 10px",
                                cursor: "pointer",
                              }}
                            >
                              Jooji
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(a.id)}
                            style={iconBtnDelete}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {!isSuperAdmin(a) && (
                    <div
                      style={{
                        marginTop: 14,
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 6,
                      }}
                    >
                      {(a.permissions || []).length === 0 ? (
                        <span style={{ color: "#6b6890", fontSize: 12 }}>
                          Wax shaqo ah lama dhiibin
                        </span>
                      ) : (
                        a.permissions.map((p) => (
                          <span key={p} style={permTag}>
                            {labelFor(p)}
                          </span>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {editTarget && (
        <div style={overlay}>
          <div style={modal}>
            <div style={modalHeader}>
              <h2 style={{ color: "#fff", margin: 0, fontSize: 18 }}>
                Wax ka bedel: {editTarget.fullName || editTarget.email}
              </h2>
              <button onClick={closeEdit} style={closeBtn}>
                <X size={18} />
              </button>
            </div>

            <div style={modalBody}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: 10,
                }}
              >
                {PERMISSION_OPTIONS.map((opt) => {
                  const checked = editPermissions.includes(opt.path);
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

            <div style={modalFooter}>
              <button onClick={closeEdit} style={cancelBtn}>
                Iska daa
              </button>
              <button onClick={saveEdit} disabled={saving} style={saveBtn}>
                <Save size={15} />
                {saving ? "Kaydinaya..." : "Kaydi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const permTag = {
  background: "rgba(139,108,245,0.12)",
  color: "#c4b5fd",
  fontSize: 11.5,
  padding: "4px 10px",
  borderRadius: 999,
  border: "1px solid rgba(139,108,245,0.25)",
};

const iconBtnEdit = {
  background: "rgba(139,108,245,0.12)",
  border: "1px solid rgba(139,108,245,0.3)",
  color: "#8b6cf5",
  width: 32,
  height: 32,
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const iconBtnDelete = {
  background: "rgba(239,68,68,0.12)",
  border: "1px solid rgba(239,68,68,0.3)",
  color: "#f87171",
  width: 32,
  height: 32,
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const overlay = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(0,0,0,0.65)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: 20,
};

const modal = {
  background: "linear-gradient(160deg,#151233,#181341)",
  border: "1px solid rgba(139,108,245,0.3)",
  borderRadius: 20,
  width: "100%",
  maxWidth: 640,
  maxHeight: "85vh",
  display: "flex",
  flexDirection: "column",
};

const modalHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "20px 24px",
  borderBottom: "1px solid rgba(139,108,245,0.2)",
};

const closeBtn = {
  background: "rgba(255,255,255,0.05)",
  border: "none",
  color: "#fff",
  width: 32,
  height: 32,
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const modalBody = {
  padding: "20px 24px",
  overflowY: "auto",
};

const modalFooter = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 12,
  padding: "16px 24px",
  borderTop: "1px solid rgba(139,108,245,0.2)",
};

const cancelBtn = {
  background: "rgba(255,255,255,0.04)",
  border: "1.5px solid rgba(139,108,245,0.3)",
  color: "#fff",
  padding: "11px 20px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13.5,
};

const saveBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "linear-gradient(90deg,#6d5df0,#8b6cf5)",
  color: "#fff",
  border: "none",
  padding: "11px 20px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 13.5,
};