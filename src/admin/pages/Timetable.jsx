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

// Xogta iskoolka ee lagu daabaco boggaga A4-ka — la mid ah magaca/website-ka
// ee ku muuqda ID Card-ka ardayga, si dukumentiyada la daabaco oo dhan ay
// isku mid u yihiin (branding sax ah, mid keliya oo la isticmaalo app-ka oo dhan).
const SCHOOL_INFO = {
  name1: "RISING STAR PRIMARY",
  name2: "& SECONDARY SCHOOL",
  academicYear: "2024/2025",
};

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

// ---------------------------------------------------------------------
// PRINT STYLES — waxaa lagu daabacayaa A4 Landscape, bog kasta oo Fasal.
// Habka la isticmaalay: "print isolation" — marka daabacaadu bilaabmayso,
// dhammaan boggaha (Sidebar/Topbar/modal-ka) waa la qariyaa (.tt-app-shell),
// oo kaliya .tt-print-root (bogagga jadwalka) ayaa la muujiyaa.
// ---------------------------------------------------------------------
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

        /* Qari dhammaan app-ka (sidebar, topbar, modal, kaadhadhka) */
        .tt-app-shell {
          display: none !important;
        }

        .tt-print-root {
          display: block !important;
        }
      }

      /* Marka aan la daabacayn (screen-ka caadiga ah), boggagga daabacaadda
         ha la muujin — waxay ku jiraan DOM-ka si print-ku u shaqeeyo. */
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

// ---------------------------------------------------------------------
// TABLE-ka hal Fasal — waxa uu ka soo ururiyaa xogta timetableDocs
// (5-ta maalmood), oo isu geeya hal grid: safaf = xiisad #, tiirar = maalin.
// Sabab: waqtiyada maalin walba way iskala duwan yihiin, marka lama isku
// xidhin karo waqtiga (sida sida bogga arday-ku u dhigmo), ee waa la isu
// geeyaa taxane ahaan sida maalinta laga sameeyay.
// ---------------------------------------------------------------------
function ClassPrintTable({ cls, timetableDocs }) {
  const norm = cleanClassName(cls);

  const dayData = DAYS.map((d) => {
    const key = `${norm}__${d.key}`;
    const sessions = [...(timetableDocs[key]?.sessions || [])].sort((a, b) =>
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
            Sannad Dugsiyeedka: {SCHOOL_INFO.academicYear}
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

// ---------------------------------------------------------------------
// MODAL-ka doorashada Fasallada — "Dhammaan Fasallada" ama gaar ah.
// ---------------------------------------------------------------------
function PrintPreviewModal({ selected, onToggle, onSelectAll, onClose, onPrint }) {
  const allSelected = selected.length === CLASS_ORDER.length;

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
          width: "min(560px, 100%)",
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
            Dooro Fasallada aad rabto in la daabaco — waxaa la sameyn doonaa
            bog A4 Landscape ah oo gaar ah Fasal kasta.
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
            {allSelected ? "Ka saar Dhammaan" : "Xulo Dhammaan Fasallada"}
          </button>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
              gap: 10,
            }}
          >
            {CLASS_ORDER.map((cls) => {
              const isChecked = selected.includes(cls);
              return (
                <label
                  key={cls}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: isChecked ? "rgba(139,108,245,0.15)" : "#0b0a1c",
                    border: `1px solid ${isChecked ? "#6d5df0" : "rgba(139,108,245,0.2)"}`,
                    borderRadius: 8,
                    padding: "9px 10px",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => onToggle(cls)}
                    style={{ accentColor: "#6d5df0" }}
                  />
                  Fasalka: {cls}
                </label>
              );
            })}
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
  const [timetableDocs, setTimetableDocs] = useState({});
  const [selectedClass, setSelectedClass] = useState(null);
  const [activeDay, setActiveDay] = useState(DAYS[0].key);
  const [draftSessions, setDraftSessions] = useState([]);

  // ---- Daawo & Daabac (Preview & Print) ----
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [selectedForPrint, setSelectedForPrint] = useState([]);
  const [classesToPrint, setClassesToPrint] = useState([]);

  function togglePrintClass(cls) {
    setSelectedForPrint((prev) =>
      prev.includes(cls) ? prev.filter((c) => c !== cls) : [...prev, cls]
    );
  }

  function toggleSelectAllForPrint() {
    setSelectedForPrint((prev) =>
      prev.length === CLASS_ORDER.length ? [] : [...CLASS_ORDER]
    );
  }

  function handleStartPrint() {
    if (selectedForPrint.length === 0) return;
    setClassesToPrint(selectedForPrint);
    setPrintModalOpen(false);
  }

  // Marka classesToPrint la buuxiyo, bogagga A4-ka ayaa DOM-ka ku soo daray
  // (tt-print-root). Waan sugaynaa hal frame si render-ku u dhammaado,
  // kadibna waxaan wacnaa window.print(). Marka daabacaaddu dhammaato ama
  // la joojiyo, waxaan nadiifinaynaa classesToPrint si bogagga aan mar kale
  // uga muuqan screen-ka.
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

              {/* Furaha Daawo & Daabac ee Fasal kasta ama Fasallo badan
                  ugu daabaca warqad A4 Landscape ah. */}
              <button
                onClick={() => {
                  setSelectedForPrint(selectedClass ? [selectedClass] : []);
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

      {/* Modal-ka doorashada Fasallada ee la daabacayo */}
      {printModalOpen && (
        <PrintPreviewModal
          selected={selectedForPrint}
          onToggle={togglePrintClass}
          onSelectAll={toggleSelectAllForPrint}
          onClose={() => setPrintModalOpen(false)}
          onPrint={handleStartPrint}
        />
      )}

      {/* Bogagga A4 Landscape ee dhabta ah — waxay ku jiraan DOM-ka had iyo
          jeer (qarsoon marka aan la daabacayn), oo waxay soo baxaan
          Fasal kasta oo la doortay, hal bog gaar ah oo bog kale ka
          go'ay (page-break) marka la daabaco. */}
      <div className="tt-print-root">
        {classesToPrint.map((cls) => (
          <ClassPrintTable key={cls} cls={cls} timetableDocs={timetableDocs} />
        ))}
      </div>
    </>
  );
}