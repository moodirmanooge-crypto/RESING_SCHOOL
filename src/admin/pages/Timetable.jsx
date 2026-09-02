import { useEffect, useMemo, useState } from "react";
import { db } from "../../firebase/firebase";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import {
  Clock,
  Trash2,
  Save,
  CalendarDays,
  Loader2,
  Plus,
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

const CLASS_ORDER = ["1", "2", "3", "4", "5", "6", "7", "8", "F1", "F2", "F3", "F4"];

function cleanClassName(val) {
  if (!val) return "";
  return String(val)
    .trim()
    .replace(/FASALKA\s*/gi, "")
    .replace(/CLASS\s*/gi, "")
    .trim()
    .toUpperCase();
}

const DAYS = [
  { key: "Saturday", label: "Saturday" },
  { key: "Sunday", label: "Sunday" },
  { key: "Monday", label: "Monday" },
  { key: "Tuesday", label: "Tuesday" },
  { key: "Wednesday", label: "Wednesday" },
];

function emptySession() {
  return {
    id: `s_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    startTime: "",
    endTime: "",
    teacherId: "",
    teacherName: "",
    subject: "",
  };
}

export default function Timetable() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [teachers, setTeachers] = useState([]);
  const [timetableDocs, setTimetableDocs] = useState({});
  const [selectedClass, setSelectedClass] = useState(null);
  const [activeDay, setActiveDay] = useState(DAYS[0].key);
  const [draftSessions, setDraftSessions] = useState([]);

  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    try {
      setLoading(true);

      // 1. Soo qaad macalimiinta dhan
      const teacherSnap = await getDocs(collection(db, "teachers"));
      const tList = teacherSnap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id, // waa username-ka uu AddTeacher ku kaydiyay
          fullName: data.fullName || d.id,
          username: data.username || d.id,
        };
      });
      setTeachers(tList);

      // 2. Soo qaad collection-ka timetable-ka oo dhan
      const ttSnap = await getDocs(collection(db, "timetable"));
      const ttMap = {};

      ttSnap.docs.forEach((d) => {
        const data = d.data();
        const docId = d.id; // Tusaale: "6__Saturday"

        let cls = cleanClassName(data.className);
        let day = data.day;

        if (!cls && docId.includes("__")) {
          const parts = docId.split("__");
          cls = cleanClassName(parts[0]);
          day = parts[1];
        }

        if (cls && day) {
          const key = `${cls}__${day}`;
          ttMap[key] = {
            docId: d.id,
            className: cls,
            day: day,
            sessions: Array.isArray(data.sessions) ? data.sessions : [],
          };
        }
      });

      setTimetableDocs(ttMap);
    } catch (err) {
      console.error("Error loading data:", err);
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  // Marka Fasal ama Maalin cusub la doorto
  useEffect(() => {
    if (!selectedClass) return;
    const clsKey = cleanClassName(selectedClass);
    const fullKey = `${clsKey}__${activeDay}`;
    const found = timetableDocs[fullKey];

    if (found && found.sessions && found.sessions.length > 0) {
      setDraftSessions(found.sessions.map((s) => ({ ...s })));
    } else {
      setDraftSessions([emptySession()]);
    }
  }, [selectedClass, activeDay, timetableDocs]);

  function updateSession(index, field, value) {
    setDraftSessions((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      // Haddii uu macalin doorto, si toos ah u geli teacherName
      if (field === "teacherId") {
        const selectedT = teachers.find((t) => t.id === value || t.username === value);
        if (selectedT) {
          updated[index].teacherName = selectedT.fullName;
        }
      }
      return updated;
    });
  }

  function addSession() {
    setDraftSessions((prev) => [...prev, emptySession()]);
  }

  function removeSession(index) {
    setDraftSessions((prev) => prev.filter((_, i) => i !== index));
  }

  async function saveDayTimetable() {
    if (!selectedClass) return;
    setSaving(true);

    const clsKey = cleanClassName(selectedClass);
    const fullKey = `${clsKey}__${activeDay}`;

    const validSessions = draftSessions
      .filter((s) => s.startTime && s.endTime)
      .map((s, idx) => ({
        ...s,
        sessionNumber: idx + 1,
      }));

    try {
      if (validSessions.length === 0) {
        await deleteDoc(doc(db, "timetable", fullKey));
        const newMap = { ...timetableDocs };
        delete newMap[fullKey];
        setTimetableDocs(newMap);
      } else {
        const payload = {
          className: clsKey,
          day: activeDay,
          sessions: validSessions,
          updatedAt: new Date(),
        };

        await setDoc(doc(db, "timetable", fullKey), payload, { merge: true });

        setTimetableDocs((prev) => ({
          ...prev,
          [fullKey]: { docId: fullKey, ...payload },
        }));
      }

      alert("Jadwalka maanta si sax ah ayaa loo kaydiyay!");
    } catch (err) {
      console.error(err);
      alert("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  // Tirada Xiisadaha Fasal kasta
  const sessionCounts = useMemo(() => {
    const map = {};
    Object.values(timetableDocs).forEach((item) => {
      const cls = cleanClassName(item.className);
      if (cls) {
        const count = (item.sessions || []).length;
        map[cls] = (map[cls] || 0) + count;
      }
    });
    return map;
  }, [timetableDocs]);

  // Tirada Maalmaha uu Fasal kasta leeyahay Xiisado
  const dayCounts = useMemo(() => {
    const map = {};
    Object.values(timetableDocs).forEach((item) => {
      const cls = cleanClassName(item.className);
      if (cls && (item.sessions || []).length > 0) {
        map[cls] = (map[cls] || 0) + 1;
      }
    });
    return map;
  }, [timetableDocs]);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0b0a1c", color: "#fff" }}>
      <Sidebar />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: "20px 24px 0" }}>
          <Topbar />
        </div>

        <div style={{ padding: "26px 30px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
            <div
              style={{
                width: 50,
                height: 50,
                borderRadius: 12,
                background: "linear-gradient(135deg,#6d5df0,#8b6cf5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CalendarDays color="#fff" size={24} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 24 }}>Jadwalka (Timetable)</h1>
              <div style={{ color: "#8b87ad", fontSize: 13 }}>
                Geli ama ka eeg jadwalka fasallada ee Add Teacher lagu soo dhex abuuray
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", color: "#8b87ad", padding: 50 }}>
              <Loader2 className="animate-spin" size={32} style={{ margin: "0 auto 12px" }} />
              Loading Timetable...
            </div>
          ) : !selectedClass ? (
            /* KAADHADHKA FASALLADA */
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
              {CLASS_ORDER.map((cls) => {
                const norm = cleanClassName(cls);
                const totalSessions = sessionCounts[norm] || 0;
                const totalDays = dayCounts[norm] || 0;

                return (
                  <button
                    key={cls}
                    onClick={() => setSelectedClass(cls)}
                    style={{
                      background: "#151233",
                      border: "1px solid rgba(139,108,245,0.25)",
                      borderRadius: 16,
                      padding: "20px",
                      textAlign: "left",
                      cursor: "pointer",
                      color: "#fff",
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 10,
                          background: "#22C55E",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: "bold",
                        }}
                      >
                        {cls}
                      </div>
                      <div>
                        <div style={{ fontWeight: "bold", fontSize: 16 }}>Fasalka: {cls}</div>
                        <div style={{ fontSize: 12, color: "#8b87ad" }}>
                          {totalDays} maalmood oo la sameeyay
                        </div>
                      </div>
                    </div>

                    <div style={{ fontSize: 12, color: "#c4b8f7", background: "rgba(139,108,245,0.1)", padding: "6px 10px", borderRadius: 8 }}>
                      <Clock size={12} style={{ display: "inline", marginRight: 4 }} />
                      {totalSessions} Xiisadood
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            /* GUDAHA FASALKA MARKA LA DOORTO */
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
                <button
                  onClick={() => setSelectedClass(null)}
                  style={{ background: "transparent", border: "none", color: "#8B5CF6", cursor: "pointer", fontWeight: "bold" }}
                >
                  ← Dhamaan Fasallada
                </button>

                <button
                  onClick={saveDayTimetable}
                  disabled={saving}
                  style={{
                    background: "#6d5df0",
                    color: "#fff",
                    border: "none",
                    padding: "10px 20px",
                    borderRadius: 8,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontWeight: "bold",
                  }}
                >
                  <Save size={16} /> {saving ? "Kaydinaya..." : "Kaydi Maalinta"}
                </button>
              </div>

              <h2 style={{ marginBottom: 15 }}>Fasalka: {selectedClass}</h2>

              {/* Tabyada Maalmaha */}
              <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
                {DAYS.map((d) => {
                  const norm = cleanClassName(selectedClass);
                  const key = `${norm}__${d.key}`;
                  const hasData = (timetableDocs[key]?.sessions || []).length > 0;
                  const isActive = d.key === activeDay;

                  return (
                    <button
                      key={d.key}
                      onClick={() => setActiveDay(d.key)}
                      style={{
                        padding: "10px 18px",
                        borderRadius: 10,
                        border: "none",
                        background: isActive ? "#6d5df0" : "#181430",
                        color: "#fff",
                        cursor: "pointer",
                        fontWeight: "bold",
                      }}
                    >
                      {d.label} {hasData && "•"}
                    </button>
                  );
                })}
              </div>

              {/* Form-ka Xiisadaha */}
              <div style={{ background: "#151233", padding: 22, borderRadius: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                  <h3 style={{ margin: 0 }}>Xiisadaha — {activeDay}</h3>
                  <button
                    onClick={addSession}
                    style={{
                      background: "rgba(34,197,94,0.15)",
                      color: "#22C55E",
                      border: "1px solid #22C55E",
                      padding: "6px 14px",
                      borderRadius: 8,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontWeight: "bold",
                    }}
                  >
                    <Plus size={14} /> Ku dar Xiisad
                  </button>
                </div>

                {draftSessions.map((s, idx) => (
                  <div
                    key={s.id || idx}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "35px 1fr 1fr 2fr 2fr 40px",
                      gap: 12,
                      marginBottom: 12,
                      alignItems: "center",
                    }}
                  >
                    <div style={{ fontWeight: "bold", color: "#8b87ad" }}>#{idx + 1}</div>
                    <div>
                      <input
                        type="time"
                        value={s.startTime || ""}
                        onChange={(e) => updateSession(idx, "startTime", e.target.value)}
                        style={{ width: "100%", background: "#0b0a1c", color: "#fff", border: "1px solid rgba(139,108,245,0.3)", padding: 8, borderRadius: 6 }}
                      />
                    </div>
                    <div>
                      <input
                        type="time"
                        value={s.endTime || ""}
                        onChange={(e) => updateSession(idx, "endTime", e.target.value)}
                        style={{ width: "100%", background: "#0b0a1c", color: "#fff", border: "1px solid rgba(139,108,245,0.3)", padding: 8, borderRadius: 6 }}
                      />
                    </div>
                    <div>
                      <select
                        value={s.teacherId || s.teacherName || ""}
                        onChange={(e) => updateSession(idx, "teacherId", e.target.value)}
                        style={{ width: "100%", background: "#0b0a1c", color: "#fff", border: "1px solid rgba(139,108,245,0.3)", padding: 8, borderRadius: 6 }}
                      >
                        <option value="">-- Dooro Macalin --</option>
                        {teachers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.fullName} ({t.username})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Maadada (e.g. Math)"
                        value={s.subject || ""}
                        onChange={(e) => updateSession(idx, "subject", e.target.value)}
                        style={{ width: "100%", background: "#0b0a1c", color: "#fff", border: "1px solid rgba(139,108,245,0.3)", padding: 8, borderRadius: 6 }}
                      />
                    </div>
                    <div>
                      <button
                        onClick={() => removeSession(idx)}
                        style={{
                          background: "rgba(239,68,68,0.2)",
                          color: "#EF4444",
                          border: "none",
                          padding: 8,
                          borderRadius: 6,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}