import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../../firebase/firebase";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import {
  Plus,
  Search,
  Users,
  BookOpen,
  School,
  CheckCircle2,
  Pencil,
  Trash2,
  X,
  Clock,
  Save,
  Loader2,
} from "lucide-react";

const weekDays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const classOptions = ["1", "2", "3", "4", "5", "6", "7", "8", "F1", "F2", "F3", "F4"];

const emptySession = () => ({ startTime: "", endTime: "" });

export default function Teachers() {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [editData, setEditData] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTeachers();
  }, []);

  async function fetchTeachers() {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, "teachers"));
      setTeachers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  }

  // NOTE: macalimiinta la calaamadeeyay in la tirtirayo (pendingDeletion)
  // waxaa laga qariyaa liiska front-end-ka ilaa backend-ku uu approve gareeyo.
  const filteredTeachers = teachers.filter((t) => {
    if (t.pendingDeletion) return false;
    return (
      (t.fullName || "").toLowerCase().includes(search.toLowerCase()) ||
      (t.username || "").toLowerCase().includes(search.toLowerCase())
    );
  });

  const totalSubjects = new Set(
    teachers.flatMap((t) => (t.classes || []).map((c) => c.subject).filter(Boolean))
  ).size;

  const totalClasses = new Set(
    teachers.flatMap((t) => (t.classes || []).map((c) => c.className).filter(Boolean))
  ).size;

  // ---- Fur modal-ka wax-ka-bedelka macalinka ----
  function openEdit(teacher) {
    setSelectedTeacher(teacher);
    setEditData({
      fullName: teacher.fullName || "",
      username: teacher.username || "",
      password: teacher.password || "",
      classes: JSON.parse(JSON.stringify(teacher.classes || [])),
    });
  }

  function closeEdit() {
    setSelectedTeacher(null);
    setEditData(null);
  }

  function updateClassBlock(index, field, value) {
    const updated = [...editData.classes];
    updated[index][field] = value;
    setEditData({ ...editData, classes: updated });
  }

  function toggleDay(index, day) {
    const updated = [...editData.classes];
    const days = updated[index].days || [];

    if (days.includes(day)) {
      updated[index].days = days.filter((d) => d !== day);
      const remaining = { ...updated[index].daySessions };
      delete remaining[day];
      updated[index].daySessions = remaining;
    } else {
      updated[index].days = [...days, day];
      updated[index].daySessions = {
        ...updated[index].daySessions,
        [day]: [emptySession()],
      };
    }

    setEditData({ ...editData, classes: updated });
  }

  function addSessionToDay(index, day) {
    const updated = [...editData.classes];
    const existing = updated[index].daySessions[day] || [];
    updated[index].daySessions = {
      ...updated[index].daySessions,
      [day]: [...existing, emptySession()],
    };
    setEditData({ ...editData, classes: updated });
  }

  function removeSessionFromDay(index, day, sIdx) {
    const updated = [...editData.classes];
    const existing = updated[index].daySessions[day] || [];
    if (existing.length === 1) return;
    updated[index].daySessions = {
      ...updated[index].daySessions,
      [day]: existing.filter((_, i) => i !== sIdx),
    };
    setEditData({ ...editData, classes: updated });
  }

  function updateSessionTime(index, day, sIdx, field, value) {
    const updated = [...editData.classes];
    const existing = [...(updated[index].daySessions[day] || [])];
    existing[sIdx] = { ...existing[sIdx], [field]: value };
    updated[index].daySessions = {
      ...updated[index].daySessions,
      [day]: existing,
    };
    setEditData({ ...editData, classes: updated });
  }

  function addClassBlock() {
    setEditData({
      ...editData,
      classes: [
        ...editData.classes,
        { className: "", subject: "", days: [], daySessions: {} },
      ],
    });
  }

  function removeClassBlock(index) {
    if (editData.classes.length === 1) return;
    setEditData({
      ...editData,
      classes: editData.classes.filter((_, i) => i !== index),
    });
  }

  // ---- Kaydi wax-ka-bedelka macalinka ----
  async function saveEdit() {
    if (!editData.fullName.trim() || !editData.username.trim()) {
      alert("Fadlan buuxi Magaca iyo Username-ka");
      return;
    }
    if (editData.password && editData.password.length < 6) {
      alert("Password waa inuu ugu yaraan 6 xaraf ahaadaa");
      return;
    }

    try {
      setSaving(true);

      const updatedFields = {
        fullName: editData.fullName,
        username: editData.username,
        password: editData.password,
        classes: editData.classes,
      };

      const oldId = selectedTeacher.id;
      const newId = editData.username.trim();

      if (newId !== oldId) {
        // FIX: the doc ID must always match the `username` field. Simply
        // calling updateDoc on the old doc only changes the `username`
        // field inside it — the Firestore doc ID itself (oldId) never
        // moves, so it silently drifts out of sync with `username`
        // (breaking QR links / lookups that key off username, e.g. the
        // Teacher ID card flow). Instead: write a new doc under the new
        // id with the full merged record, then remove the old doc so the
        // teacher exists under exactly one id — the current username.
        const fullRecord = { ...selectedTeacher, ...updatedFields };
        delete fullRecord.id; // `id` is a local-only field, not part of the Firestore doc data
        await setDoc(doc(db, "teachers", newId), fullRecord);
        await deleteDoc(doc(db, "teachers", oldId));
      } else {
        await updateDoc(doc(db, "teachers", oldId), updatedFields);
      }

      // Isla markiiba cusboonaysii state-ka local-ka ah si liiska
      // Teacher List uu isla markiiba u muujiyo xogta cusub — iyada
      // oo aan loo baahnayn in bogga dib loo soo shubo (refresh).
      setTeachers((prev) =>
        prev.map((t) =>
          t.id === oldId ? { ...t, ...updatedFields, id: newId } : t
        )
      );

      alert("Macalinka waa la cusboonaysiiyay");
      closeEdit();
    } catch (err) {
      console.log(err);
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  // ---- Tirtirka macalinka ----
  // MUHIIM: Xogta Firestore laftigeeda LAGAMA TIRTIRO halkan. Waxaa kaliya
  // la calaamadeeyaa "pendingDeletion: true" (iyo waqtiga codsiga) si
  // macalinku uu si toos ah uga qarsoomo liiska front-end-ka. Tirtirka
  // dhabta ah ee Firestore waxaa kaliya sameeya backend-ka marka la
  // ansixiyo (approve).
  async function deleteTeacher(teacher) {
    if (!confirm(`Ma hubtaa inaad tirtirto ${teacher.fullName}?`)) return;
    try {
      await updateDoc(doc(db, "teachers", teacher.id), {
        pendingDeletion: true,
        deletionRequestedAt: new Date().toISOString(),
      });

      setTeachers((prev) =>
        prev.map((t) =>
          t.id === teacher.id
            ? { ...t, pendingDeletion: true, deletionRequestedAt: new Date().toISOString() }
            : t
        )
      );

      alert("SUCCESSFULLY REQUESTED FOR DELETION✅.");
    } catch (err) {
      console.log(err);
      alert(err.message);
    }
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0b0a1c" }}>
      <Sidebar />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: "20px 24px 0" }}>
          <Topbar title="Teachers" />
        </div>

        <div style={{ padding: "26px 30px" }}>
          <h1 style={{ color: "#fff", marginBottom: 22, fontSize: 26, fontWeight: 800 }}>
            Teachers
          </h1>

          <div style={{ display: "flex", gap: 15, marginBottom: 25, flexWrap: "wrap" }}>
            <Link to="/admin/add-teacher">
              <button style={purpleBtn}>
                <Plus size={17} />
                Add Teacher
              </button>
            </Link>

            <div style={searchWrap}>
              <Search size={16} color="#8b87ad" />
              <input
                placeholder="Search Teacher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={searchInput}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 20 }}>
            <Card icon={Users} title="Total Teachers" value={teachers.length} color="#6d5df0" />
            <Card icon={CheckCircle2} title="Active" value={teachers.length} color="#22c55e" />
            <Card icon={BookOpen} title="Subjects" value={totalSubjects} color="#f59e0b" />
            <Card icon={School} title="Classes" value={totalClasses} color="#c084fc" />
          </div>

          <div style={listCard}>
            <h3 style={{ color: "#fff", margin: "0 0 16px", fontSize: 17 }}>Teacher List</h3>

            {loading ? (
              <p style={{ color: "#8b87ad" }}>Loading...</p>
            ) : filteredTeachers.length === 0 ? (
              <p style={{ color: "#8b87ad" }}>No Teachers Yet</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {filteredTeachers.map((teacher) => (
                  <div key={teacher.id} style={teacherRow}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        minWidth: 44,
                        borderRadius: "50%",
                        background: teacher.teacherPhoto
                          ? `url(${teacher.teacherPhoto}) center/cover`
                          : "linear-gradient(135deg,#6d5df0,#8b6cf5)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                        fontWeight: 700,
                        fontSize: 15,
                      }}
                    >
                      {!teacher.teacherPhoto &&
                        (teacher.fullName || "?").slice(0, 2).toUpperCase()}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: "#fff", fontWeight: 600, fontSize: 14.5 }}>
                        {teacher.fullName || "—"}
                      </div>
                      <div style={{ color: "#8b87ad", fontSize: 12.5, marginTop: 2 }}>
                        @{teacher.username || "—"}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", maxWidth: 320 }}>
                      {(teacher.classes || []).slice(0, 4).map((c, i) => (
                        <span key={i} style={classTag}>
                          {c.className || "?"} · {c.subject || "?"}
                        </span>
                      ))}
                      {(teacher.classes || []).length > 4 && (
                        <span style={classTag}>+{teacher.classes.length - 4}</span>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => openEdit(teacher)} style={iconBtnEdit}>
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => deleteTeacher(teacher)} style={iconBtnDelete}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---- Modal-ka wax-ka-bedelka macalinka ---- */}
      {editData && (
        <div style={overlay}>
          <div style={modal}>
            <div style={modalHeader}>
              <h2 style={{ color: "#fff", margin: 0, fontSize: 19 }}>
                Wax ka bedel: {selectedTeacher.fullName}
              </h2>
              <button onClick={closeEdit} style={closeBtn}>
                <X size={18} />
              </button>
            </div>

            <div style={modalBody}>
              <div style={topGrid}>
                <Field label="Magaca Macalinka">
                  <input
                    style={input}
                    value={editData.fullName}
                    onChange={(e) => setEditData({ ...editData, fullName: e.target.value })}
                  />
                </Field>

                <Field label="Username">
                  <input
                    style={input}
                    value={editData.username}
                    onChange={(e) => setEditData({ ...editData, username: e.target.value })}
                  />
                </Field>
              </div>

              <div style={{ marginBottom: 24 }}>
                <Field label="Password">
                  <input
                    style={{ ...input, maxWidth: 420 }}
                    type="text"
                    placeholder="Ugu yaraan 6 xaraf"
                    value={editData.password}
                    onChange={(e) => setEditData({ ...editData, password: e.target.value })}
                  />
                </Field>
              </div>

              <hr style={{ margin: "10px 0 22px", border: "none", borderTop: "1px solid rgba(139,108,245,0.2)" }} />

              <h3 style={{ color: "#fff", fontSize: 16, marginBottom: 16 }}>
                Fasalada uu Xaadirin Doono
              </h3>

              {editData.classes.map((block, index) => (
                <div key={index} style={classCard}>
                  <div style={classCardHeader}>
                    <span style={classCardTitle}>Fasalka #{index + 1}</span>
                    {editData.classes.length > 1 && (
                      <button type="button" onClick={() => removeClassBlock(index)} style={removeBtn}>
                        <X size={13} /> Ka saar
                      </button>
                    )}
                  </div>

                  <div style={twoColGrid}>
                    <Field label="Class">
                      <select
                        style={input}
                        value={block.className}
                        onChange={(e) => updateClassBlock(index, "className", e.target.value)}
                      >
                        <option value="">-- Dooro --</option>
                        {classOptions.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Maadada">
                      <input
                        style={input}
                        placeholder="Tusaale: Mathematics"
                        value={block.subject}
                        onChange={(e) => updateClassBlock(index, "subject", e.target.value)}
                      />
                    </Field>
                  </div>

                  <div style={{ marginTop: 18 }}>
                    <label style={label}>Maalmaha Toddobaadka</label>
                    <div style={dayRow}>
                      {weekDays.map((day) => {
                        const active = block.days.includes(day);
                        return (
                          <button
                            type="button"
                            key={day}
                            onClick={() => toggleDay(index, day)}
                            style={{
                              ...dayPill,
                              background: active
                                ? "linear-gradient(90deg,#6d5df0,#8b6cf5)"
                                : "rgba(255,255,255,0.03)",
                              color: active ? "#fff" : "#a9a6c4",
                              borderColor: active ? "transparent" : "rgba(139,108,245,0.3)",
                            }}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {block.days.length > 0 && (
                    <div style={{ marginTop: 20 }}>
                      <label style={label}>Saacadaha Xiisadaha</label>

                      {block.days.map((day) => {
                        const sessions = block.daySessions[day] || [];
                        return (
                          <div key={day} style={dayScheduleCard}>
                            <div style={dayScheduleHeader}>
                              <span style={dayScheduleTitle}>
                                <Clock size={14} color="#8b6cf5" />
                                {day}
                              </span>
                              <button
                                type="button"
                                onClick={() => addSessionToDay(index, day)}
                                style={addSessionBtn}
                              >
                                <Plus size={12} /> Xiisad kale
                              </button>
                            </div>

                            {sessions.map((session, sIdx) => (
                              <div key={sIdx} style={sessionRow}>
                                <span style={sessionLabel}>Xiisadda #{sIdx + 1}</span>

                                <div>
                                  <label style={miniLabel}>Waqtiga Bilowga</label>
                                  <input
                                    type="time"
                                    style={timeInput}
                                    value={session.startTime}
                                    onChange={(e) =>
                                      updateSessionTime(index, day, sIdx, "startTime", e.target.value)
                                    }
                                  />
                                </div>

                                <div>
                                  <label style={miniLabel}>Waqtiga Dhamaadka</label>
                                  <input
                                    type="time"
                                    style={timeInput}
                                    value={session.endTime}
                                    onChange={(e) =>
                                      updateSessionTime(index, day, sIdx, "endTime", e.target.value)
                                    }
                                  />
                                </div>

                                {sessions.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeSessionFromDay(index, day, sIdx)}
                                    style={removeSessionBtn}
                                  >
                                    <X size={14} />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}

              <button type="button" onClick={addClassBlock} style={addBlockBtn}>
                <Plus size={16} /> Ku dar Fasal/Maado Kale
              </button>
            </div>

            <div style={modalFooter}>
              <button onClick={closeEdit} style={cancelBtn}>
                Iska daa
              </button>
              <button onClick={saveEdit} disabled={saving} style={saveBtn}>
                {saving ? (
                  <>
                    <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                    Kaydinaya...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Kaydi Isbedelka
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        input::placeholder { color: #6b6890; }
        select option { background: #1e1a4a; color: #ffffff; }
        input[type="time"]::-webkit-calendar-picker-indicator {
          filter: invert(1);
          opacity: 0.7;
        }
      `}</style>
    </div>
  );
}

function Card({ icon: Icon, title, value, color }) {
  return (
    <div
      style={{
        background: "linear-gradient(160deg,#1c1840,#211c48)",
        borderTop: `4px solid ${color}`,
        borderRadius: 14,
        padding: 20,
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: `${color}22`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 12,
        }}
      >
        <Icon size={18} color={color} />
      </div>
      <h2 style={{ color: "#fff", margin: 0, fontSize: 26 }}>{value}</h2>
      <p style={{ color: "#8b87ad", margin: "4px 0 0", fontSize: 13 }}>{title}</p>
    </div>
  );
}

function Field({ label: labelText, children }) {
  return (
    <div>
      <label style={label}>{labelText}</label>
      {children}
    </div>
  );
}

const purpleBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "linear-gradient(90deg,#6d5df0,#8b6cf5)",
  color: "#fff",
  border: "none",
  padding: "12px 20px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 14,
  boxShadow: "0 8px 20px rgba(109,93,240,0.3)",
};

const searchWrap = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: 300,
  padding: "0 14px",
  borderRadius: 10,
  border: "1.5px solid rgba(139,108,245,0.3)",
  background: "rgba(255,255,255,0.02)",
};

const searchInput = {
  flex: 1,
  padding: "12px 0",
  border: "none",
  outline: "none",
  background: "transparent",
  color: "#e5e3f7",
  fontSize: 14,
};

const listCard = {
  marginTop: 26,
  background: "linear-gradient(160deg,#1c1840,#211c48)",
  borderRadius: 16,
  padding: 22,
  border: "1px solid rgba(255,255,255,0.05)",
};

const teacherRow = {
  display: "flex",
  alignItems: "center",
  gap: 16,
  padding: "14px 16px",
  background: "rgba(255,255,255,0.02)",
  borderRadius: 12,
  border: "1px solid rgba(139,108,245,0.12)",
};

const classTag = {
  background: "rgba(139,108,245,0.12)",
  color: "#c4b5fd",
  fontSize: 11.5,
  padding: "5px 10px",
  borderRadius: 20,
  border: "1px solid rgba(139,108,245,0.25)",
  whiteSpace: "nowrap",
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
  maxWidth: 820,
  maxHeight: "90vh",
  display: "flex",
  flexDirection: "column",
};

const modalHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "22px 26px",
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
  padding: "24px 26px",
  overflowY: "auto",
};

const modalFooter = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 12,
  padding: "18px 26px",
  borderTop: "1px solid rgba(139,108,245,0.2)",
};

const cancelBtn = {
  background: "rgba(255,255,255,0.04)",
  border: "1.5px solid rgba(139,108,245,0.3)",
  color: "#fff",
  padding: "12px 22px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 14,
};

const saveBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "linear-gradient(90deg,#6d5df0,#8b6cf5)",
  color: "#fff",
  border: "none",
  padding: "12px 22px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 14,
};

const label = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  fontSize: 14,
  fontWeight: 600,
  color: "#fff",
  marginBottom: 8,
};

const input = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1.5px solid rgba(139,108,245,0.3)",
  boxSizing: "border-box",
  fontSize: 14,
  color: "#e5e3f7",
  background: "rgba(255,255,255,0.02)",
  outline: "none",
};

const topGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 22,
  marginBottom: 22,
};

const twoColGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 20,
};

const classCard = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(139,108,245,0.2)",
  borderRadius: 16,
  padding: 22,
  marginBottom: 18,
};

const classCardHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 18,
};

const classCardTitle = {
  color: "#8b6cf5",
  fontWeight: 700,
  fontSize: 15,
};

const removeBtn = {
  background: "rgba(239,68,68,0.12)",
  border: "1px solid rgba(239,68,68,0.3)",
  color: "#f87171",
  cursor: "pointer",
  fontSize: 12.5,
  borderRadius: 8,
  padding: "6px 10px",
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
};

const dayRow = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const dayPill = {
  padding: "9px 18px",
  borderRadius: 20,
  border: "1.5px solid",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
};

const addBlockBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "rgba(255,255,255,0.03)",
  border: "1.5px solid rgba(139,108,245,0.4)",
  color: "#8b6cf5",
  padding: "13px 22px",
  borderRadius: 12,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 14,
};

const dayScheduleCard = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(139,108,245,0.15)",
  borderRadius: 12,
  padding: 16,
  marginTop: 12,
};

const dayScheduleHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 12,
};

const dayScheduleTitle = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  fontWeight: 700,
  color: "#fff",
  fontSize: 14,
};

const addSessionBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  background: "rgba(139,108,245,0.1)",
  border: "1px solid rgba(139,108,245,0.4)",
  color: "#8b6cf5",
  borderRadius: 8,
  padding: "6px 12px",
  fontSize: 12,
  cursor: "pointer",
  fontWeight: 600,
};

const sessionRow = {
  display: "flex",
  gap: 16,
  alignItems: "flex-end",
  marginBottom: 12,
  flexWrap: "wrap",
};

const sessionLabel = {
  fontSize: 12.5,
  color: "#a9a6c4",
  minWidth: 80,
  marginBottom: 10,
};

const miniLabel = {
  display: "block",
  fontSize: 11.5,
  color: "#8b87ad",
  marginBottom: 6,
};

const timeInput = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1.5px solid rgba(139,108,245,0.3)",
  background: "rgba(255,255,255,0.02)",
  color: "#e5e3f7",
  fontSize: 13.5,
  colorScheme: "dark",
};

const removeSessionBtn = {
  background: "rgba(239,68,68,0.12)",
  border: "1px solid rgba(239,68,68,0.3)",
  color: "#f87171",
  cursor: "pointer",
  borderRadius: 7,
  width: 28,
  height: 28,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 10,
};