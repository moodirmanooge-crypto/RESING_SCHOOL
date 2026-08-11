import { useEffect, useMemo, useState } from "react";
import { db } from "../../firebase/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";
import {
  Clock,
  Plus,
  Trash2,
  Save,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  FileEdit,
  Loader2,
  Pencil,
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

// Fixed class order: 1 -> 8 (primary), then F1 -> F4 (secondary/form)
const CLASS_ORDER = ["1", "2", "3", "4", "5", "6", "7", "8", "F1", "F2", "F3", "F4"];
function classRank(className) {
  const idx = CLASS_ORDER.indexOf(String(className || "").toUpperCase());
  return idx === -1 ? 999 : idx;
}

const DAYS = [
  { key: "Saturday", label: "SABTI" },
  { key: "Sunday", label: "AXAD" },
  { key: "Monday", label: "ISNIIN" },
  { key: "Tuesday", label: "TALAADO" },
  { key: "Wednesday", label: "ARBACO" },
];

// ---- Nuuca imtixaanka ee maamulku ka dooran karo fasalka. Sameyska
// (key) halkan waa isla midka ExamCards.jsx iyo ExamPayments.jsx
// isticmaalaan, si dhammaan bogagga isku mid ay noqdaan. ----
const EXAM_TYPES = [
  { key: "monthly1", label: "Monthly 1" },
  { key: "midterm", label: "Mid Term" },
  { key: "monthly2", label: "Monthly 2" },
  { key: "final", label: "Final" },
];
function examTypeLabel(key) {
  return EXAM_TYPES.find((t) => t.key === key)?.label || "Final";
}

function emptyExamSlot() {
  return {
    id: `e_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    startTime: "08:00",
    endTime: "09:00",
    subject: "",
    teacherId: "",
  };
}

// ---- Kala saar imtixaannada marka la eego wakhtiga bilowga, oo ku dar
// examNumber (Imtixaan #1, #2, ...) si midka kore uu had iyo jeer
// noqdo ta 1aad ----
function withExamNumbers(slots) {
  const sorted = [...slots].sort((a, b) =>
    (a.startTime || "").localeCompare(b.startTime || "")
  );
  return sorted.map((s, i) => ({ ...s, examNumber: i + 1 }));
}

function ResponsiveStyles() {
  return (
    <style>{`
      .et-layout { display: flex; min-height: 100vh; background: #0b0a1c; }
      .et-content { flex: 1; min-width: 0; }
      .et-class-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 18px; }
      .et-day-tabs { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; }
      .et-slot-row { display: grid; grid-template-columns: 34px 110px 110px 1fr 1fr 40px; gap: 10px; align-items: center; }
      .et-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }

      @media (max-width: 900px) {
        .et-page-pad { padding: 16px !important; }
        .et-header-row { gap: 10px !important; }
        .et-header-title { font-size: 20px !important; }
        .et-class-grid { grid-template-columns: 1fr 1fr; gap: 12px; }
        .et-toolbar { flex-direction: column; align-items: stretch !important; }
        .et-slot-row { grid-template-columns: 26px 1fr 1fr; }
      }
      @media (max-width: 480px) {
        .et-class-grid { grid-template-columns: 1fr; }
      }
    `}</style>
  );
}

function TeacherSelect({ value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useState(() => ({ current: null }))[0];

  useEffect(() => {
    function handleOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [wrapRef]);

  const selectedLabel = options.find((o) => o.id === value)?.fullName;

  return (
    <div ref={(el) => (wrapRef.current = el)} style={{ position: "relative", width: "100%" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          ...fieldStyle,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span
          style={{
            color: selectedLabel ? "#e5e3f7" : "#8b87ad",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {selectedLabel || "-- Dooro Macalin --"}
        </span>
        <ChevronDown
          size={15}
          color="#8b87ad"
          style={{
            flexShrink: 0,
            transition: "transform .15s",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 50,
            background: "#181430",
            border: "1px solid rgba(139,108,245,0.3)",
            borderRadius: 10,
            boxShadow: "0 16px 40px rgba(0,0,0,0.55)",
            maxHeight: 230,
            overflowY: "auto",
            padding: "6px 0",
          }}
        >
          <div
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            style={{
              padding: "10px 16px",
              fontSize: 13.5,
              color: "#8b87ad",
              background: !value ? "#2563eb" : "transparent",
              cursor: "pointer",
            }}
          >
            -- Dooro Macalin --
          </div>

          {options.length === 0 && (
            <div style={{ padding: "9px 16px", fontSize: 12.5, color: "#8b87ad" }}>
              Macalin looma xilsaarin fasalkan.
            </div>
          )}

          {options.map((opt) => {
            const isSelected = opt.id === value;
            return (
              <div
                key={opt.id}
                onClick={() => {
                  onChange(opt.id);
                  setOpen(false);
                }}
                style={{
                  padding: "10px 16px",
                  fontSize: 13.5,
                  fontWeight: isSelected ? 700 : 500,
                  color: isSelected ? "#fff" : "#e5e3f7",
                  background: isSelected ? "#2563eb" : "transparent",
                  cursor: "pointer",
                }}
              >
                {opt.fullName}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ExamTimetable() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [teachers, setTeachers] = useState({}); // id -> { fullName, subject, classes }
  const [examDocs, setExamDocs] = useState({}); // `${className}__${day}` -> { slots: [] }
  const [examWeekDates, setExamWeekDates] = useState({}); // className -> { startDate, endDate, examType }
  const [selectedClass, setSelectedClass] = useState(null);
  const [activeDay, setActiveDay] = useState(DAYS[0].key);
  const [draftSlots, setDraftSlots] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [draftStartDate, setDraftStartDate] = useState("");
  const [draftEndDate, setDraftEndDate] = useState("");
  const [draftExamType, setDraftExamType] = useState("final");
  const [savingDates, setSavingDates] = useState(false);
  const [deletingDay, setDeletingDay] = useState(null); // day key currently being deleted, for the summary table

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      const [teachersSnap, examSnap, examWeekSnap] = await Promise.all([
        getDocs(collection(db, "teachers")),
        getDocs(collection(db, "examTimetable")),
        getDocs(collection(db, "examWeek")),
      ]);

      const teacherMap = {};
      teachersSnap.docs.forEach((d) => {
        const data = d.data();
        teacherMap[d.id] = {
          fullName: data.fullName || data.username || d.id,
          subject: data.subject || data.subjectName || "",
          classes: Array.isArray(data.classes) ? data.classes : [],
        };
      });
      setTeachers(teacherMap);

      const examMap = {};
      examSnap.docs.forEach((d) => {
        examMap[d.id] = d.data();
      });
      setExamDocs(examMap);

      const weekMap = {};
      examWeekSnap.docs.forEach((d) => {
        weekMap[d.id] = d.data();
      });
      setExamWeekDates(weekMap);
    } catch (err) {
      console.log(err);
      alert("Khalad ayaa dhacay marka xogta la soo qaadanayay: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  const classes = useMemo(() => {
    return [...CLASS_ORDER].sort((a, b) => classRank(a) - classRank(b));
  }, []);

  const teachersForSelectedClass = useMemo(() => {
    if (!selectedClass) return {};
    const filtered = {};
    Object.entries(teachers).forEach(([tid, info]) => {
      const teachesThisClass = (info.classes || []).some(
        (c) => String(c.className || "").toUpperCase() === String(selectedClass).toUpperCase()
      );
      if (teachesThisClass) {
        filtered[tid] = info;
      }
    });
    return filtered;
  }, [teachers, selectedClass]);

  useEffect(() => {
    if (!selectedClass) return;
    const key = `${selectedClass}__${activeDay}`;
    const existing = examDocs[key];
    setDraftSlots(
      existing?.slots?.length
        ? withExamNumbers(existing.slots.map((s) => ({ ...s })))
        : [emptyExamSlot()]
    );
    setDirty(false);
  }, [selectedClass, activeDay, examDocs]);

  useEffect(() => {
    if (!selectedClass) return;
    const wk = examWeekDates[selectedClass];
    setDraftStartDate(wk?.startDate || "");
    setDraftEndDate(wk?.endDate || "");
    setDraftExamType(wk?.examType || "final");
  }, [selectedClass, examWeekDates]);

  function openClass(cls) {
    setSelectedClass(cls);
    setActiveDay(DAYS[0].key);
  }

  // Jump into the editor for a specific day (used by the "Edit" button in
  // the read-only summary table below the slot editor).
  function editDay(dayKey) {
    setActiveDay(dayKey);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Fully delete a day's exam slots for the selected class — removes the
  // examTimetable/{className}__{day} doc and clears that day out of every
  // enrolled student's synced examTimetable field.
  async function deleteDay(dayKey) {
    if (!selectedClass) return;
    const dayLabel = DAYS.find((d) => d.key === dayKey)?.label || dayKey;
    const confirmed = window.confirm(
      `Ma hubtaa inaad rabto inaad tirtirto dhammaan imtixaannada ${dayLabel} ee Fasalka ${selectedClass}?`
    );
    if (!confirmed) return;

    const key = `${selectedClass}__${dayKey}`;
    setDeletingDay(dayKey);
    try {
      await deleteDoc(doc(db, "examTimetable", key));
      const updatedDocs = { ...examDocs };
      delete updatedDocs[key];
      setExamDocs(updatedDocs);

      if (dayKey === activeDay) {
        setDraftSlots([emptyExamSlot()]);
        setDirty(false);
      }

      await syncStudentsExamTimetable(selectedClass, updatedDocs);
    } catch (err) {
      console.log(err);
      alert("Khalad ayaa dhacay marka la tirtirayay: " + err.message);
    } finally {
      setDeletingDay(null);
    }
  }

  // ---- Kaydiyo taariikhda bilowga iyo dhamaadka usbuuca imtixaanka
  // fasalkan, nuuca imtixaanka (Monthly 1 / Mid Term / Monthly 2 / Final),
  // kuna qor ardayda fasalkaas si Student/Parent Dashboard-ku si toos ah
  // uga soo aqriyo. Nuuca imtixaanka halkan lagu doortay ayaa isla markaana
  // ExamPayments.jsx isticmaali doona marka Exam Card la sameenayo. ----
  async function saveExamWeekDates() {
    if (!selectedClass) return;
    if (!draftStartDate || !draftEndDate) {
      alert("Fadlan geli labada taariikh — bilowga iyo dhamaadka imtixaanka.");
      return;
    }
    if (draftEndDate < draftStartDate) {
      alert("Taariikhda dhamaadka waa inay ka dambaysaa ama la mid tahay tan bilowga.");
      return;
    }

    setSavingDates(true);
    try {
      const payload = {
        className: selectedClass,
        startDate: draftStartDate,
        endDate: draftEndDate,
        examType: draftExamType,
        updatedAt: new Date(),
      };
      await setDoc(doc(db, "examWeek", selectedClass), payload);
      setExamWeekDates((prev) => ({ ...prev, [selectedClass]: payload }));

      const studentsSnap = await getDocs(
        query(collection(db, "students"), where("className", "==", selectedClass))
      );
      if (!studentsSnap.empty) {
        const batch = writeBatch(db);
        studentsSnap.docs.forEach((studentDoc) => {
          batch.update(doc(db, "students", studentDoc.id), {
            examWeekStartDate: draftStartDate,
            examWeekEndDate: draftEndDate,
            examWeekExamType: draftExamType,
          });
        });
        await batch.commit();
      }
    } catch (err) {
      console.log(err);
      alert("Khalad ayaa dhacay marka taariikhda la kaydinayay: " + err.message);
    } finally {
      setSavingDates(false);
    }
  }

  function updateSlot(index, field, value) {
    setDraftSlots((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return field === "startTime" ? withExamNumbers(next) : next;
    });
    setDirty(true);
  }

  function addSlot() {
    setDraftSlots((prev) => withExamNumbers([...prev, emptyExamSlot()]));
    setDirty(true);
  }

  function removeSlot(index) {
    setDraftSlots((prev) => withExamNumbers(prev.filter((_, i) => i !== index)));
    setDirty(true);
  }

  // ---- Marka jadwalka imtixaanka maalintaas la kaydiyo, si toos ah
  // ugu qor dhammaan ardayda fasalkaas ku jira (students collection)
  // field "examTimetable" oo ay ku jirto jadwalka toddobaadka
  // imtixaannada fasalkooda, si Student/Parent Dashboard-ku si toos ah
  // uga soo aqriyo. ----
  async function syncStudentsExamTimetable(className, updatedExamDocs) {
    try {
      const studentsSnap = await getDocs(
        query(collection(db, "students"), where("className", "==", className))
      );
      if (studentsSnap.empty) return;

      const weekSchedule = DAYS.map((d) => {
        const key = `${className}__${d.key}`;
        const slots = (updatedExamDocs[key]?.slots || [])
          .slice()
          .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""))
          .map((s) => ({
            examNumber: s.examNumber,
            startTime: s.startTime,
            endTime: s.endTime,
            subject: s.subject || "",
            teacherId: s.teacherId,
            teacherName: teachers[s.teacherId]?.fullName || s.teacherId,
          }));
        return { day: d.key, dayLabel: d.label, slots };
      });

      const batch = writeBatch(db);
      studentsSnap.docs.forEach((studentDoc) => {
        batch.update(doc(db, "students", studentDoc.id), {
          examTimetable: weekSchedule,
          examTimetableUpdatedAt: new Date(),
        });
      });
      await batch.commit();
    } catch (err) {
      console.log("Khalad marka la sync gareynayo exam timetable-ka ardayda:", err);
    }
  }

  async function saveDay() {
    if (!selectedClass) return;
    setSaving(true);
    const key = `${selectedClass}__${activeDay}`;

    // Skip rows with no subject entered to avoid saving blank slots.
    const cleanSlots = withExamNumbers(
      draftSlots.filter((s) => s.subject && s.subject.trim() !== "")
    );

    try {
      let updatedDocs = { ...examDocs };

      if (cleanSlots.length === 0) {
        await deleteDoc(doc(db, "examTimetable", key));
        delete updatedDocs[key];
      } else {
        const payload = {
          className: selectedClass,
          day: activeDay,
          slots: cleanSlots,
          updatedAt: new Date(),
        };
        await setDoc(doc(db, "examTimetable", key), payload);
        updatedDocs[key] = payload;
      }

      setExamDocs(updatedDocs);
      setDraftSlots(cleanSlots.length ? cleanSlots : [emptyExamSlot()]);
      setDirty(false);

      await syncStudentsExamTimetable(selectedClass, updatedDocs);
    } catch (err) {
      console.log(err);
      alert("Khalad ayaa dhacay marka la kaydinayay: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  const slotCountByClass = useMemo(() => {
    const counts = {};
    Object.values(examDocs).forEach((docData) => {
      const cls = docData.className;
      const n = (docData.slots || []).length;
      counts[cls] = (counts[cls] || 0) + n;
    });
    return counts;
  }, [examDocs]);

  const daysScheduledByClass = useMemo(() => {
    const counts = {};
    Object.entries(examDocs).forEach(([key, docData]) => {
      if ((docData.slots || []).length > 0) {
        counts[docData.className] = (counts[docData.className] || 0) + 1;
      }
    });
    return counts;
  }, [examDocs]);

  return (
    <div className="et-layout">
      <ResponsiveStyles />
      <Sidebar />

      <div className="et-content">
        <div style={{ padding: "20px 24px 0" }}>
          <Topbar />
        </div>

        <div className="et-page-pad" style={{ padding: "26px 30px" }}>
          {/* Header */}
          <div
            className="et-header-row"
            style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}
          >
            <div
              style={{
                width: 55,
                height: 55,
                borderRadius: 15,
                background: "linear-gradient(135deg,#6d5df0,#8b6cf5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <FileEdit color="#fff" size={26} />
            </div>
            <div>
              <h1 className="et-header-title" style={{ margin: 0, fontSize: 26, color: "#fff" }}>
                Jadwalka Imtixaanka (Exam Timetable)
              </h1>
              <div style={{ color: "#8b87ad", fontSize: 14 }}>
                Samee jadwalka maadooyinka imtixaanka ee Sabti - Arbaco, fasal kasta
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ color: "#8b87ad", textAlign: "center", padding: 60 }}>
              Xogta ayaa la soo qaadayaa...
            </div>
          ) : !selectedClass ? (
            <div className="et-class-grid">
              {classes.map((cls) => {
                const slotCount = slotCountByClass[cls] || 0;
                const dayCount = daysScheduledByClass[cls] || 0;
                return (
                  <button
                    key={cls}
                    onClick={() => openClass(cls)}
                    style={{
                      background: "linear-gradient(160deg,#151233,#181341)",
                      border: "1px solid rgba(139,108,245,0.25)",
                      borderRadius: 20,
                      padding: "20px 22px",
                      textAlign: "left",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: 14,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 13,
                          background: "linear-gradient(135deg,#F59E0B,#D97706)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: 14,
                          flexShrink: 0,
                        }}
                      >
                        {cls}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 16, color: "#fff" }}>
                          Fasalka: {cls}
                        </div>
                        <div style={{ fontSize: 12.5, color: "#8b87ad", marginTop: 2 }}>
                          {dayCount} maalmood oo la sameeyay
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          background: "rgba(139,108,245,0.1)",
                          border: "1px solid rgba(139,108,245,0.25)",
                          borderRadius: 20,
                          padding: "5px 12px",
                          color: "#c4b8f7",
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        <Clock size={13} /> {slotCount} Imtixaan
                      </span>
                      {examWeekDates[cls]?.startDate && (
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            background: "rgba(34,197,94,0.1)",
                            border: "1px solid rgba(34,197,94,0.3)",
                            borderRadius: 20,
                            padding: "5px 12px",
                            color: "#4ADE80",
                            fontSize: 11.5,
                            fontWeight: 600,
                          }}
                        >
                          <CalendarDays size={13} /> {examWeekDates[cls].startDate} →{" "}
                          {examWeekDates[cls].endDate}
                        </span>
                      )}
                      {examWeekDates[cls]?.examType && (
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            background: "rgba(245,158,11,0.1)",
                            border: "1px solid rgba(245,158,11,0.3)",
                            borderRadius: 20,
                            padding: "5px 12px",
                            color: "#FBBF24",
                            fontSize: 11.5,
                            fontWeight: 600,
                          }}
                        >
                          {examTypeLabel(examWeekDates[cls].examType)}
                        </span>
                      )}
                    </div>

                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#8B5CF6",
                        marginTop: 2,
                      }}
                    >
                      Samee/Wax ka beddel jadwalka{" "}
                      <ChevronDown size={15} style={{ transform: "rotate(-90deg)" }} />
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div>
              {/* Toolbar */}
              <div
                className="et-toolbar"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 18,
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <button
                  onClick={() => setSelectedClass(null)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "transparent",
                    border: "none",
                    color: "#8B5CF6",
                    fontWeight: 700,
                    fontSize: 13.5,
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  <ChevronUp size={16} style={{ transform: "rotate(-90deg)" }} /> Dhamaan Fasallada
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {dirty && (
                    <span style={{ color: "#F59E0B", fontSize: 12.5, fontWeight: 600 }}>
                      Wax lama kaydin
                    </span>
                  )}
                  <button
                    onClick={saveDay}
                    disabled={saving}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px 18px",
                      borderRadius: 12,
                      border: "none",
                      background: saving
                        ? "rgba(139,108,245,0.35)"
                        : "linear-gradient(135deg,#6d5df0,#8b6cf5)",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: saving ? "not-allowed" : "pointer",
                    }}
                  >
                    {saving ? <Loader2 size={15} /> : <Save size={15} />}
                    {saving ? "Kaydinaya..." : "Kaydi Maalinta"}
                  </button>
                </div>
              </div>

              {/* Class title */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 14,
                    background: "linear-gradient(135deg,#F59E0B,#D97706)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 15,
                    flexShrink: 0,
                  }}
                >
                  {selectedClass}
                </div>
                <div style={{ fontWeight: 700, color: "#fff", fontSize: 18 }}>
                  Fasalka: {selectedClass}
                </div>
              </div>

              {/* Exam week date range + exam type */}
              <div
                style={{
                  background: "linear-gradient(160deg,#151233,#181341)",
                  border: "1px solid rgba(139,108,245,0.25)",
                  borderRadius: 16,
                  padding: "16px 20px",
                  marginBottom: 18,
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 14,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: "1 1 160px" }}>
                  <div style={{ color: "#8b87ad", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                    Taariikhda Bilowga Imtixaanka
                  </div>
                  <input
                    type="date"
                    value={draftStartDate}
                    onChange={(e) => setDraftStartDate(e.target.value)}
                    style={fieldStyle}
                  />
                </div>
                <div style={{ flex: "1 1 160px" }}>
                  <div style={{ color: "#8b87ad", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                    Taariikhda Dhamaadka Imtixaanka
                  </div>
                  <input
                    type="date"
                    value={draftEndDate}
                    onChange={(e) => setDraftEndDate(e.target.value)}
                    style={fieldStyle}
                  />
                </div>
                <div style={{ flex: "1 1 160px" }}>
                  <div style={{ color: "#8b87ad", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                    Nuuca Imtixaanka
                  </div>
                  <select
                    value={draftExamType}
                    onChange={(e) => setDraftExamType(e.target.value)}
                    style={fieldStyle}
                  >
                    {EXAM_TYPES.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={saveExamWeekDates}
                  disabled={savingDates}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 18px",
                    borderRadius: 12,
                    border: "none",
                    background: savingDates
                      ? "rgba(139,108,245,0.35)"
                      : "linear-gradient(135deg,#6d5df0,#8b6cf5)",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: savingDates ? "not-allowed" : "pointer",
                    flexShrink: 0,
                  }}
                >
                  {savingDates ? <Loader2 size={15} /> : <CalendarDays size={15} />}
                  {savingDates ? "Kaydinaya..." : "Kaydi Taariikhda"}
                </button>

                {examWeekDates[selectedClass]?.startDate && (
                  <div style={{ width: "100%", color: "#c4b8f7", fontSize: 12.5, marginTop: 4 }}>
                    Imtixaanku wuxuu bilaabmayaa{" "}
                    <strong style={{ color: "#fff" }}>
                      {examWeekDates[selectedClass].startDate}
                    </strong>{" "}
                    wuxuuna dhammaanayaa{" "}
                    <strong style={{ color: "#fff" }}>
                      {examWeekDates[selectedClass].endDate}
                    </strong>{" "}
                    — Nuuca:{" "}
                    <strong style={{ color: "#fff" }}>
                      {examTypeLabel(examWeekDates[selectedClass].examType)}
                    </strong>
                  </div>
                )}
              </div>

              {/* Day tabs (Sabti -> Arbaco) */}
              <div className="et-day-tabs" style={{ marginBottom: 20 }}>
                {DAYS.map((d) => {
                  const isActive = d.key === activeDay;
                  const hasSlots =
                    (examDocs[`${selectedClass}__${d.key}`]?.slots || []).length > 0;
                  return (
                    <button
                      key={d.key}
                      onClick={() => setActiveDay(d.key)}
                      style={{
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "10px 18px",
                        borderRadius: 12,
                        border: isActive
                          ? "1px solid rgba(139,108,245,0.6)"
                          : "1px solid rgba(139,108,245,0.2)",
                        background: isActive
                          ? "linear-gradient(135deg,#6d5df0,#8b6cf5)"
                          : "rgba(255,255,255,0.02)",
                        color: isActive ? "#fff" : "#c4b8f7",
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      {d.label}
                      {hasSlots && (
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: isActive ? "#fff" : "#22C55E",
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Exam slots editor */}
              <div
                style={{
                  background: "linear-gradient(160deg,#151233,#181341)",
                  border: "1px solid rgba(139,108,245,0.25)",
                  borderRadius: 20,
                  padding: "22px 26px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 16,
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 15,
                      fontWeight: 700,
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Clock size={16} color="#8B5CF6" /> Maadooyinka Imtixaanka —{" "}
                    {DAYS.find((d) => d.key === activeDay)?.label}
                  </h3>
                  <button
                    onClick={addSlot}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: "rgba(34,197,94,0.15)",
                      border: "1px solid rgba(34,197,94,0.35)",
                      color: "#22C55E",
                      padding: "8px 14px",
                      borderRadius: 10,
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <Plus size={14} /> Ku dar Maado
                  </button>
                </div>

                {Object.keys(teachersForSelectedClass).length === 0 && (
                  <div
                    style={{
                      background: "rgba(245,158,11,0.1)",
                      border: "1px solid rgba(245,158,11,0.3)",
                      borderRadius: 10,
                      padding: "10px 14px",
                      color: "#F59E0B",
                      fontSize: 12.5,
                      marginBottom: 14,
                    }}
                  >
                    Wali macalin looma xilsaarin fasalkan (Fasalka {selectedClass}). Macalin dooro
                    haddii aad rabto in la xardhiyo cidda imtixaanka la wadaajinayo.
                  </div>
                )}

                <div
                  className="et-slot-row"
                  style={{
                    marginBottom: 6,
                    color: "#8b87ad",
                    fontSize: 11.5,
                    fontWeight: 700,
                    textTransform: "uppercase",
                  }}
                >
                  <div>#</div>
                  <div>Bilow</div>
                  <div>Dhamaad</div>
                  <div>Maadada</div>
                  <div>Macalinka</div>
                  <div></div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10, position: "relative" }}>
                  {draftSlots.map((slot, index) => (
                    <div
                      key={slot.id}
                      className="et-slot-row"
                      style={{
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(139,108,245,0.18)",
                        borderRadius: 12,
                        padding: "10px 12px",
                        position: "relative",
                        zIndex: draftSlots.length - index,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 30,
                          height: 30,
                          borderRadius: "50%",
                          background: "rgba(139,108,245,0.15)",
                          border: "1px solid rgba(139,108,245,0.35)",
                          color: "#c4b8f7",
                          fontWeight: 700,
                          fontSize: 12,
                        }}
                        title={`Imtixaan #${slot.examNumber}`}
                      >
                        {slot.examNumber}
                      </div>

                      <input
                        type="time"
                        value={slot.startTime}
                        onChange={(e) => updateSlot(index, "startTime", e.target.value)}
                        style={fieldStyle}
                      />
                      <input
                        type="time"
                        value={slot.endTime}
                        onChange={(e) => updateSlot(index, "endTime", e.target.value)}
                        style={fieldStyle}
                      />
                      <input
                        type="text"
                        placeholder="Maadada (tusaale: Xisaabta)"
                        value={slot.subject}
                        onChange={(e) => updateSlot(index, "subject", e.target.value)}
                        style={fieldStyle}
                      />
                      <TeacherSelect
                        value={slot.teacherId}
                        options={Object.entries(teachersForSelectedClass).map(([tid, info]) => ({
                          id: tid,
                          fullName: info.fullName,
                        }))}
                        onChange={(tid) => updateSlot(index, "teacherId", tid)}
                      />
                      <button
                        onClick={() => removeSlot(index)}
                        title="Ka saar"
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 10,
                          border: "1px solid rgba(239,68,68,0.35)",
                          background: "rgba(239,68,68,0.12)",
                          color: "#EF4444",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>

                {draftSlots.length === 0 && (
                  <div style={{ color: "#8b87ad", fontSize: 13, textAlign: "center", padding: 20 }}>
                    Weli maado lama darin maalintan.
                  </div>
                )}
              </div>

              {/* Read-only summary of the saved exam week for this class */}
              <ExamWeekSummary
                selectedClass={selectedClass}
                examDocs={examDocs}
                teachers={teachers}
                onEditDay={editDay}
                onDeleteDay={deleteDay}
                deletingDay={deletingDay}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ExamWeekSummary({ selectedClass, examDocs, teachers, onEditDay, onDeleteDay, deletingDay }) {
  const rows = DAYS.map((d) => {
    const key = `${selectedClass}__${d.key}`;
    const slots = withExamNumbers(examDocs[key]?.slots || []);
    return { day: d, slots };
  });

  const anySlots = rows.some((r) => r.slots.length > 0);
  if (!anySlots) return null;

  return (
    <div style={{ marginTop: 24 }}>
      <h3
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 14,
        }}
      >
        <CalendarDays size={16} color="#8B5CF6" /> Jadwalka Imtixaanka — Fasalka {selectedClass}
      </h3>

      <div className="et-table-wrap">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 760 }}>
          <thead>
            <tr>
              <th style={thStyle}>Maalinta</th>
              <th style={thStyle}>Maadooyinka</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ day, slots }) => {
              const hasSlots = slots.length > 0;
              const isDeleting = deletingDay === day.key;
              return (
                <tr key={day.key} style={{ borderTop: "1px solid rgba(139,108,245,0.12)" }}>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{day.label}</td>
                  <td style={tdStyle}>
                    {!hasSlots ? (
                      <span style={{ color: "#8b87ad" }}>Ma jiro imtixaan</span>
                    ) : (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {slots.map((s) => {
                          const teacherName = teachers[s.teacherId]?.fullName || s.teacherId || "-";
                          return (
                            <span
                              key={s.id}
                              style={{
                                background: "rgba(245,158,11,0.1)",
                                border: "1px solid rgba(245,158,11,0.3)",
                                borderRadius: 20,
                                padding: "5px 12px",
                                color: "#FBBF24",
                                fontWeight: 600,
                                fontSize: 12,
                                whiteSpace: "nowrap",
                              }}
                            >
                              #{s.examNumber} · {s.startTime}–{s.endTime} · {s.subject}
                              {s.teacherId ? ` (${teacherName})` : ""}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </td>
                  <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button
                        onClick={() => onEditDay(day.key)}
                        title={`Wax ka beddel ${day.label}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "6px 12px",
                          borderRadius: 8,
                          border: "1px solid rgba(139,108,245,0.35)",
                          background: "rgba(139,108,245,0.12)",
                          color: "#c4b8f7",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        <Pencil size={13} /> Edit
                      </button>
                      {hasSlots && (
                        <button
                          onClick={() => onDeleteDay(day.key)}
                          disabled={isDeleting}
                          title={`Tirtir ${day.label}`}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "6px 12px",
                            borderRadius: 8,
                            border: "1px solid rgba(239,68,68,0.35)",
                            background: "rgba(239,68,68,0.12)",
                            color: "#EF4444",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: isDeleting ? "not-allowed" : "pointer",
                            opacity: isDeleting ? 0.6 : 1,
                          }}
                        >
                          {isDeleting ? <Loader2 size={13} /> : <Trash2 size={13} />}
                          {isDeleting ? "..." : "Delete"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const fieldStyle = {
  width: "100%",
  padding: "8px 10px",
  boxSizing: "border-box",
  border: "1px solid rgba(139,108,245,0.3)",
  borderRadius: 8,
  fontSize: 13,
  color: "#e5e3f7",
  outline: "none",
  background: "rgba(255,255,255,0.03)",
};

const thStyle = {
  textAlign: "left",
  padding: "10px 14px",
  color: "#8b87ad",
  fontSize: 12,
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "10px 14px",
  color: "#e5e3f7",
  fontSize: 13,
};