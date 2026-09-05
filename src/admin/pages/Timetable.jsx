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
  Printer,
  X,
  CheckSquare,
  Square,
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

const SCHOOL_INFO = {
  name1: "RISING STAR PRIMARY",
  name2: "& SECONDARY SCHOOL",
  academicYear: "2024/2025",
};

const CLASS_ORDER = ["1", "2", "3", "4", "5", "6", "7", "8", "F1", "F2", "F3", "F4"];

const STUDENT_TYPES = [
  { key: "fulltime", label: "Full Time", collectionName: "timetable" },
  { key: "parttime", label: "Part Time", collectionName: "timetablePartTime" },
];

function cleanClassName(val) {
  if (!val) return "";
  return String(val)
    .trim()
    .replace(/FASALKA\s*/gi, "")
    .replace(/CLASS\s*/gi, "")
    .trim()
    .toUpperCase();
}

// Maalmaha Full Time (5 maalmood)
const FULLTIME_DAYS = [
  { key: "Saturday", label: "Saturday" },
  { key: "Sunday", label: "Sunday" },
  { key: "Monday", label: "Monday" },
  { key: "Tuesday", label: "Tuesday" },
  { key: "Wednesday", label: "Wednesday" },
];

// Maalmaha Part Time (Thursday iyo Friday kaliya)
const PARTTIME_DAYS = [
  { key: "Thursday", label: "Thursday" },
  { key: "Friday", label: "Friday" },
];

const DAYS_BY_TYPE = {
  fulltime: FULLTIME_DAYS,
  parttime: PARTTIME_DAYS,
};

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

function PrintStyles() {
  return (
    <style>{`
      @media print {
        @page {
          size: A4 landscape;
          margin: 10mm;
        }

        html, body {
          background: #ffffff !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        .tt-app-shell {
          display: none !important;
        }

        .tt-print-root {
          display: block !important;
        }
      }

      .tt-print-root {
        display: none;
      }

      .tt-print-page {
        width: 100%;
        page-break-after: always;
        font-family: Arial, Helvetica, sans-serif;
        color: #111111;
        background: #ffffff;
        padding: 4mm;
        box-sizing: border-box;
      }
      .tt-print-page:last-child {
        page-break-after: auto;
      }

      .tt-print-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 3px solid #6d5df0;
        padding-bottom: 10px;
        margin-bottom: 14px;
      }

      .tt-print-school-block {
        line-height: 1.2;
      }

      .tt-print-school-name {
        font-size: 17px;
        font-weight: 900;
        color: #2a2350;
        letter-spacing: 0.2px;
      }

      .tt-print-school-year {
        font-size: 12px;
        color: #6b6b7d;
        margin-top: 3px;
      }

      .tt-print-class-badge {
        text-align: right;
      }

      .tt-print-class-badge .cls-label {
        font-size: 11px;
        color: #6b6b7d;
        text-transform: uppercase;
        letter-spacing: 0.6px;
      }

      .tt-print-class-badge .cls-value {
        font-size: 22px;
        font-weight: 900;
        color: #6d5df0;
      }

      .tt-print-table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }

      .tt-print-table th {
        background: #6d5df0;
        color: #ffffff;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.4px;
        padding: 8px 6px;
        text-align: center;
        border: 1px solid #5b4fd6;
      }

      .tt-print-table th.tt-print-th-num {
        width: 32px;
      }

      .tt-print-table td {
        border: 1px solid #d9d6ee;
        padding: 7px 6px;
        vertical-align: top;
        text-align: center;
      }

      .tt-print-td-num {
        font-weight: 800;
        color: #8b87ad;
        background: #f5f3ff;
      }

      .tt-print-table tr:nth-child(even) td:not(.tt-print-td-num) {
        background: #faf9ff;
      }

      .tt-print-time {
        font-weight: 800;
        font-size: 11.5px;
        color: #2a2350;
      }

      .tt-print-subject {
        font-weight: 800;
        font-size: 11px;
        color: #6d5df0;
        margin-top: 2px;
        letter-spacing: 0.2px;
      }

      .tt-print-teacher {
        font-size: 10.5px;
        color: #555566;
        margin-top: 2px;
      }

      .tt-print-empty {
        color: #c7c4de;
      }

      .tt-print-footer {
        margin-top: 10px;
        font-size: 9.5px;
        color: #9c99b3;
        text-align: right;
      }
    `}</style>
  );
}

function ClassPrintTable({ cls, type, timetableByType, studentTypeLabel }) {
  const norm = cleanClassName(cls);
  const docs = timetableByType[type] || {};
  const activeDays = DAYS_BY_TYPE[type] || FULLTIME_DAYS;

  const dayData = activeDays.map((d) => {
    const key = `${norm}__${d.key}`;
    const sessions = [...(docs[key]?.sessions || [])].sort((a, b) =>
      (a.startTime || "").localeCompare(b.startTime || "")
    );
    return { ...d, sessions };
  });

  const maxRows = Math.max(1, ...dayData.map((d) => d.sessions.length));
  const rowIndexes = Array.from({ length: maxRows }, (_, i) => i);

  return (
    <div className="tt-print-page">
      <div className="tt-print-header">
        <div className="tt-print-school-block">
          <div className="tt-print-school-name">{SCHOOL_INFO.name1}</div>
          <div className="tt-print-school-name">{SCHOOL_INFO.name2}</div>
          <div className="tt-print-school-year">
            Sannad Dugsiyeedka: {SCHOOL_INFO.academicYear} · {studentTypeLabel}
          </div>
        </div>
        <div className="tt-print-class-badge">
          <div className="cls-label">Jadwalka Fasalka</div>
          <div className="cls-value">Fasalka: {cls}</div>
        </div>
      </div>

      <table className="tt-print-table">
        <thead>
          <tr>
            <th className="tt-print-th-num">#</th>
            {dayData.map((d) => (
              <th key={d.key}>{d.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowIndexes.map((i) => (
            <tr key={i}>
              <td className="tt-print-td-num">{i + 1}</td>
              {dayData.map((d) => {
                const s = d.sessions[i];
                return (
                  <td key={d.key}>
                    {s ? (
                      <>
                        <div className="tt-print-time">
                          {s.startTime} – {s.endTime}
                        </div>
                        <div className="tt-print-subject">
                          {(s.subject || "—").toUpperCase()}
                        </div>
                        <div className="tt-print-teacher">
                          {s.teacherName || "—"}
                        </div>
                      </>
                    ) : (
                      <span className="tt-print-empty">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="tt-print-footer">
        La daabacay: {new Date().toLocaleDateString("en-GB")}
      </div>
    </div>
  );
}

function PrintPreviewModal({ selected, onToggle, onSelectAll, onClose, onPrint }) {
  const totalPossible = CLASS_ORDER.length * STUDENT_TYPES.length;
  const allSelected = selected.length === totalPossible;

  return (
    <div
      className="tt-app-shell"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(5,4,20,0.72)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          background: "#151233",
          border: "1px solid rgba(139,108,245,0.25)",
          borderRadius: 18,
          width: "min(680px, 100%)",
          maxHeight: "86vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 22px",
            borderBottom: "1px solid rgba(139,108,245,0.15)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Printer size={20} color="#8B5CF6" />
            <h3 style={{ margin: 0, fontSize: 17 }}>Daawo &amp; Daabac Jadwalka</h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", color: "#8b87ad", cursor: "pointer" }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: "16px 22px", overflowY: "auto" }}>
          <p style={{ color: "#8b87ad", fontSize: 13, marginTop: 0 }}>
            Dooro Fasallada aad rabto in la daabaco — Full Time, Part Time, ama
            labadaba isku mar. Fasal kasta oo la doorto waxaa lagu sameyn
            doonaa bog A4 Landscape gaar ah, oo muujinaya magaca fasalka iyo
            nooca (Full Time / Part Time).
          </p>

          <button
            onClick={onSelectAll}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(139,108,245,0.1)",
              border: "1px solid rgba(139,108,245,0.3)",
              color: "#c4b8f7",
              borderRadius: 8,
              padding: "8px 14px",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: 13,
              marginBottom: 14,
            }}
          >
            {allSelected ? <CheckSquare size={16} /> : <Square size={16} />}
            {allSelected ? "Ka saar Dhammaan" : "Xulo Dhammaan (Full Time + Part Time)"}
          </button>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
              gap: 10,
            }}
          >
            {CLASS_ORDER.map((cls) => (
              <div
                key={cls}
                style={{
                  background: "#0b0a1c",
                  border: "1px solid rgba(139,108,245,0.2)",
                  borderRadius: 10,
                  padding: "10px 12px",
                }}
              >
                <div style={{ fontWeight: "bold", fontSize: 13.5, marginBottom: 8, color: "#eef0f4" }}>
                  Fasalka: {cls}
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {STUDENT_TYPES.map((t) => {
                    const isChecked = selected.some(
                      (item) => item.cls === cls && item.type === t.key
                    );
                    return (
                      <label
                        key={t.key}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          background: isChecked ? "rgba(139,108,245,0.15)" : "transparent",
                          border: `1px solid ${isChecked ? "#6d5df0" : "rgba(139,108,245,0.2)"}`,
                          borderRadius: 8,
                          padding: "6px 10px",
                          cursor: "pointer",
                          fontSize: 12.5,
                          fontWeight: 600,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => onToggle(cls, t.key)}
                          style={{ accentColor: "#6d5df0" }}
                        />
                        {t.label}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            padding: "16px 22px",
            borderTop: "1px solid rgba(139,108,245,0.15)",
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "1px solid rgba(139,108,245,0.3)",
              color: "#8b87ad",
              padding: "10px 18px",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Jooji
          </button>
          <button
            onClick={onPrint}
            disabled={selected.length === 0}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: selected.length === 0 ? "#3a3560" : "#6d5df0",
              color: "#fff",
              border: "none",
              padding: "10px 20px",
              borderRadius: 8,
              cursor: selected.length === 0 ? "not-allowed" : "pointer",
              fontWeight: "bold",
            }}
          >
            <Printer size={16} />
            Daabac ({selected.length})
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Timetable() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [teachers, setTeachers] = useState([]);
  const [timetableByType, setTimetableByType] = useState({ fulltime: {}, parttime: {} });
  const [selectedClass, setSelectedClass] = useState(null);

  // ---- Full Time / Part Time toggle ----
  const [studentType, setStudentType] = useState("fulltime");
  
  // Maalmaha firfircoon senario-ga hadda la joogo
  const currentDays = DAYS_BY_TYPE[studentType] || FULLTIME_DAYS;
  const [activeDay, setActiveDay] = useState(FULLTIME_DAYS[0].key);

  const [draftSessions, setDraftSessions] = useState([]);

  const activeCollectionName =
    STUDENT_TYPES.find((t) => t.key === studentType)?.collectionName || "timetable";
  const activeTypeLabel =
    STUDENT_TYPES.find((t) => t.key === studentType)?.label || "Full Time";
  const timetableDocs = timetableByType[studentType] || {};

  // ---- Daawo & Daabac (Preview & Print) ----
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [selectedForPrint, setSelectedForPrint] = useState([]);
  const [classesToPrint, setClassesToPrint] = useState([]);

  // Marka studentType uu beddelmo, hubi in activeDay uusana ku jirin maalin hore
  useEffect(() => {
    if (!currentDays.some((d) => d.key === activeDay)) {
      setActiveDay(currentDays[0].key);
    }
  }, [studentType, currentDays, activeDay]);

  function togglePrintClass(cls, type) {
    setSelectedForPrint((prev) => {
      const exists = prev.some((item) => item.cls === cls && item.type === type);
      if (exists) {
        return prev.filter((item) => !(item.cls === cls && item.type === type));
      }
      return [...prev, { cls, type }];
    });
  }

  function toggleSelectAllForPrint() {
    setSelectedForPrint((prev) => {
      const totalPossible = CLASS_ORDER.length * STUDENT_TYPES.length;
      if (prev.length === totalPossible) return [];
      const all = [];
      CLASS_ORDER.forEach((cls) => {
        STUDENT_TYPES.forEach((t) => all.push({ cls, type: t.key }));
      });
      return all;
    });
  }

  function handleStartPrint() {
    if (selectedForPrint.length === 0) return;
    setClassesToPrint(selectedForPrint);
    setPrintModalOpen(false);
  }

  useEffect(() => {
    if (classesToPrint.length === 0) return;

    const timer = setTimeout(() => {
      window.print();
    }, 50);

    const handleAfterPrint = () => setClassesToPrint([]);
    window.addEventListener("afterprint", handleAfterPrint);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [classesToPrint]);

  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    try {
      setLoading(true);

      const teacherSnap = await getDocs(collection(db, "teachers"));
      const tList = teacherSnap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          fullName: data.fullName || d.id,
          username: data.username || d.id,
        };
      });
      setTeachers(tList);

      const [fullSnap, partSnap] = await Promise.all([
        getDocs(collection(db, "timetable")),
        getDocs(collection(db, "timetablePartTime")),
      ]);

      function buildMap(snap) {
        const ttMap = {};
        snap.docs.forEach((d) => {
          const data = d.data();
          const docId = d.id;

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
        return ttMap;
      }

      setTimetableByType({
        fulltime: buildMap(fullSnap),
        parttime: buildMap(partSnap),
      });
    } catch (err) {
      console.error("Error loading data:", err);
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  }

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
        await deleteDoc(doc(db, activeCollectionName, fullKey));
        setTimetableByType((prev) => {
          const newTypeMap = { ...prev[studentType] };
          delete newTypeMap[fullKey];
          return { ...prev, [studentType]: newTypeMap };
        });
      } else {
        const payload = {
          className: clsKey,
          day: activeDay,
          sessions: validSessions,
          studentType: studentType,
          updatedAt: new Date(),
        };

        await setDoc(doc(db, activeCollectionName, fullKey), payload, { merge: true });

        setTimetableByType((prev) => ({
          ...prev,
          [studentType]: {
            ...prev[studentType],
            [fullKey]: { docId: fullKey, ...payload },
          },
        }));
      }

      alert(`Jadwalka ${activeTypeLabel} ee maanta si sax ah ayaa loo kaydiyay!`);
    } catch (err) {
      console.error(err);
      alert("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  }

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
    <>
      <PrintStyles />

      <div className="tt-app-shell" style={{ display: "flex", minHeight: "100vh", background: "#0b0a1c", color: "#fff" }}>
        <Sidebar />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ padding: "20px 24px 0" }}>
            <Topbar />
          </div>

          <div style={{ padding: "26px 30px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
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

              <button
                onClick={() => {
                  setSelectedForPrint(
                    selectedClass ? [{ cls: selectedClass, type: studentType }] : []
                  );
                  setPrintModalOpen(true);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "#151233",
                  border: "1px solid rgba(139,108,245,0.35)",
                  color: "#c4b8f7",
                  padding: "12px 18px",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontWeight: "bold",
                  fontSize: 13.5,
                }}
              >
                <Printer size={17} />
                Daawo &amp; Daabac
              </button>
            </div>

            {/* ---- Full Time / Part Time Toggle ---- */}
            <div
              style={{
                display: "inline-flex",
                background: "#151233",
                border: "1px solid rgba(139,108,245,0.25)",
                borderRadius: 12,
                padding: 4,
                marginBottom: 22,
                gap: 4,
              }}
            >
              {STUDENT_TYPES.map((t) => {
                const isActive = t.key === studentType;
                return (
                  <button
                    key={t.key}
                    onClick={() => setStudentType(t.key)}
                    style={{
                      padding: "10px 20px",
                      borderRadius: 9,
                      border: "none",
                      cursor: "pointer",
                      fontWeight: "bold",
                      fontSize: 13.5,
                      background: isActive ? "#6d5df0" : "transparent",
                      color: isActive ? "#fff" : "#8b87ad",
                      transition: "all 0.15s",
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

          {loading ? (
            <div style={{ textAlign: "center", color: "#8b87ad", padding: 50 }}>
              <Loader2 className="animate-spin" size={32} style={{ margin: "0 auto 12px" }} />
              Loading Timetable...
            </div>
          ) : !selectedClass ? (
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

              <h2 style={{ marginBottom: 6 }}>Fasalka: {selectedClass}</h2>
              <div
                style={{
                  display: "inline-block",
                  fontSize: 12,
                  fontWeight: "bold",
                  color: studentType === "fulltime" ? "#4ade9b" : "#f5a623",
                  background: studentType === "fulltime" ? "rgba(62,207,142,0.12)" : "rgba(245,166,35,0.12)",
                  border: `1px solid ${studentType === "fulltime" ? "rgba(62,207,142,0.35)" : "rgba(245,166,35,0.35)"}`,
                  padding: "4px 10px",
                  borderRadius: 999,
                  marginBottom: 15,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                {activeTypeLabel}
              </div>

              {/* Maalmaha halkan lagu soo saaro waxay ku xiran yihiin nooca (Full Time / Part Time) */}
              <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
                {currentDays.map((d) => {
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

      {printModalOpen && (
        <PrintPreviewModal
          selected={selectedForPrint}
          onToggle={togglePrintClass}
          onSelectAll={toggleSelectAllForPrint}
          onClose={() => setPrintModalOpen(false)}
          onPrint={handleStartPrint}
        />
      )}

      <div className="tt-print-root">
        {classesToPrint.map(({ cls, type }) => (
          <ClassPrintTable
            key={`${type}_${cls}`}
            cls={cls}
            type={type}
            timetableByType={timetableByType}
            studentTypeLabel={STUDENT_TYPES.find((t) => t.key === type)?.label || "Full Time"}
          />
        ))}
      </div>
    </>
  );
}