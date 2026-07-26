// src/admin/pages/Holidays.jsx
//
// Admin-ku halkan wuxuu ku maamulaa taariikhaha fasaxa school-ka (holidays).
// Fasax kasta wuxuu leeyahay: magac (tusaale "Eid Holiday"), startDate,
// endDate iyo note ikhtiyaari ah. Waxaa lagu kaydiyaa Firestore collection-ka
// "holidays". Boggani wuxuu leeyahay: liis dhammaan fasaxyada (kuwa hore iyo
// kuwa soo socda), form lagu daro fasax cusub, iyo delete.
//
// Teacher Attendance-ka (teacher/Attendance.jsx) ayaa isticmaala collection-kan
// isla markaana hubiya haddii maalinta hadda ay ku jirto fasax ka hor intaanu
// macalinku xaadirin karin — eeg xashida hoose ee "isHolidayToday" helper-ka.

import { useEffect, useState } from "react";
import { db } from "../../firebase/firebase";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { CalendarOff, Plus, Trash2 } from "lucide-react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

function toDateOnly(v) {
  if (!v) return null;
  const d = v?.toDate ? v.toDate() : new Date(v);
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(v) {
  const d = toDateOnly(v);
  if (!d) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function Holidays() {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", startDate: "", endDate: "", note: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    fetchHolidays();
  }, []);

  async function fetchHolidays() {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, "holidays"));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const da = toDateOnly(a.startDate)?.getTime() || 0;
        const db_ = toDateOnly(b.startDate)?.getTime() || 0;
        return db_ - da; // newest first
      });
      setHolidays(list);
    } catch (err) {
      console.error("Khalad ayaa dhacay markii fasaxyada la soo qaadanayay:", err);
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!form.name.trim() || !form.startDate || !form.endDate) {
      setError("Fadlan buuxi magaca fasaxa, taariikhda bilowga iyo dhamaadka.");
      return;
    }

    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    if (end < start) {
      setError("Taariikhda dhamaadka waa inay ka dambeeyaa ta bilowga.");
      return;
    }

    try {
      setSaving(true);
      await addDoc(collection(db, "holidays"), {
        name: form.name.trim(),
        startDate: form.startDate,
        endDate: form.endDate,
        note: form.note.trim(),
        createdAt: serverTimestamp(),
      });
      setForm({ name: "", startDate: "", endDate: "", note: "" });
      await fetchHolidays();
    } catch (err) {
      console.error("Khalad ayaa dhacay markii fasaxa la kaydinayay:", err);
      setError("Khalad ayaa dhacay, isku day mar kale.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Ma hubtaa inaad tirtirto fasaxan?")) return;
    try {
      await deleteDoc(doc(db, "holidays", id));
      setHolidays((prev) => prev.filter((h) => h.id !== id));
    } catch (err) {
      console.error("Khalad ayaa dhacay markii la tirtirayay:", err);
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "#F3F4F8",
        fontFamily: "'Inter','Segoe UI',sans-serif",
      }}
    >
      <Sidebar />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: "22px 26px 0" }}>
          <Topbar />
        </div>

        <div style={{ padding: "26px 30px" }}>
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827" }}>
              School Holidays
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B7280" }}>
              Maalmaha fasaxa school-ka. Xilliyadan gudahood, macalimiinta ma
              xaadirin karaan (clock-in way ka xanibataa).
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1.3fr",
              gap: 20,
              alignItems: "flex-start",
            }}
            className="holiday-grid"
          >
            {/* Add holiday form */}
            <form
              onSubmit={handleSubmit}
              style={{
                background: "#fff",
                borderRadius: 18,
                padding: "22px 22px",
                boxShadow: "0 4px 18px rgba(17,24,39,0.06)",
                border: "1px solid rgba(17,24,39,0.05)",
              }}
            >
              <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#111827" }}>
                Ku dar Fasax Cusub
              </h3>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Magaca Fasaxa</label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Tusaale: Eid Holiday, Summer Break"
                  style={inputStyle}
                />
              </div>

              <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Bilowga</label>
                  <input
                    type="date"
                    name="startDate"
                    value={form.startDate}
                    onChange={handleChange}
                    style={inputStyle}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Dhamaadka</label>
                  <input
                    type="date"
                    name="endDate"
                    value={form.endDate}
                    onChange={handleChange}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Faah faahin (ikhtiyaari)</label>
                <textarea
                  name="note"
                  value={form.note}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Wixii faahfaahin dheeraad ah..."
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>

              {error && (
                <div style={{ color: "#DC2626", fontSize: 12.5, marginBottom: 12 }}>{error}</div>
              )}

              <button
                type="submit"
                disabled={saving}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "12px 20px",
                  borderRadius: 12,
                  border: "none",
                  background: saving ? "#9CA3AF" : "#16a34a",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 13.5,
                  cursor: saving ? "not-allowed" : "pointer",
                  width: "100%",
                  justifyContent: "center",
                }}
              >
                <Plus size={16} />
                {saving ? "Kaydinaya..." : "Kaydi Fasaxa"}
              </button>
            </form>

            {/* Holidays list */}
            <div
              style={{
                background: "#fff",
                borderRadius: 18,
                padding: "22px 22px",
                boxShadow: "0 4px 18px rgba(17,24,39,0.06)",
                border: "1px solid rgba(17,24,39,0.05)",
              }}
            >
              <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#111827" }}>
                Dhammaan Fasaxyada ({holidays.length})
              </h3>

              {loading && (
                <p style={{ fontSize: 13, color: "#9CA3AF" }}>Wax soo rarayaa...</p>
              )}

              {!loading && holidays.length === 0 && (
                <p style={{ fontSize: 13, color: "#9CA3AF" }}>Fasax lama diiwaan gelin.</p>
              )}

              {!loading &&
                holidays.map((h) => {
                  const start = toDateOnly(h.startDate);
                  const end = toDateOnly(h.endDate);
                  const isActive = start && end && today >= start && today <= end;
                  const isUpcoming = start && start > today;

                  return (
                    <div
                      key={h.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        padding: "14px 0",
                        borderTop: "1px solid #F3F4F6",
                      }}
                    >
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 12,
                          background: isActive ? "rgba(220,38,38,0.1)" : "#E6F5EC",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <CalendarOff size={19} color={isActive ? "#DC2626" : "#16a34a"} />
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
                            {h.name}
                          </span>
                          {isActive && (
                            <span
                              style={{
                                background: "rgba(220,38,38,0.12)",
                                color: "#DC2626",
                                fontSize: 11,
                                fontWeight: 700,
                                padding: "2px 10px",
                                borderRadius: 20,
                              }}
                            >
                              Hadda socda
                            </span>
                          )}
                          {isUpcoming && (
                            <span
                              style={{
                                background: "rgba(245,158,11,0.12)",
                                color: "#D97706",
                                fontSize: 11,
                                fontWeight: 700,
                                padding: "2px 10px",
                                borderRadius: 20,
                              }}
                            >
                              Soo socda
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12.5, color: "#6B7280", marginTop: 3 }}>
                          {formatDate(h.startDate)} → {formatDate(h.endDate)}
                        </div>
                        {h.note && (
                          <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 3 }}>
                            {h.note}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handleDelete(h.id)}
                        title="Tirtir"
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "#EF4444",
                          cursor: "pointer",
                          padding: 8,
                          borderRadius: 8,
                          flexShrink: 0,
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .holiday-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

const labelStyle = {
  display: "block",
  fontSize: 12.5,
  fontWeight: 600,
  color: "#374151",
  marginBottom: 6,
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #E5E7EB",
  fontSize: 13.5,
  color: "#111827",
  boxSizing: "border-box",
  fontFamily: "inherit",
};