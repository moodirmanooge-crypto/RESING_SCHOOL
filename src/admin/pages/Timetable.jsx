//src/admin/pages/Timetable.jsx
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
  Users,
  Loader2,
  Check,
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

// Fixed class order: 1 -> 8 (primary), then F1 -> F4 (secondary/form)
const CLASS_ORDER = ["1", "2", "3", "4", "5", "6", "7", "8", "F1", "F2", "F3", "F4"];
function classRank(className) {
  const idx = CLASS_ORDER.indexOf(String(className || "").toUpperCase());
  return idx === -1 ? 999 : idx;
}

// ---- Maadooyinka lagu kala sortaa heerka fasalka (class level) ----
// Fasallada 1-4 (dugsiga hoose - lower primary), 5-8 (dugsiga dhexe -
// upper primary), F1-F4 (dugsiga sare - secondary) mid kastaa wuxuu
// leeyahay liistadiisa maadooyin oo gaar ah. Tan waxaa loo isticmaalaa
// SubjectSelect si macalinka loogu soo bandhigo kaliya maadooyinka
// ku habboon fasalka la doortay.
const SUBJECTS_LOWER_PRIMARY = [
  "Tarbiyo",
  "Carabi",
  "Somali",
  "Xisaab",
  "Cimi Bulsho",
  "Saynis",
  "English",
];

const SUBJECTS_UPPER_PRIMARY = [
  "Tarbiyo",
  "Carabi",
  "Somali",
  "Xisaab",
  "Cimi Bulsho",
  "Saynis",
  "English",
  "Teknalojiyad",
];

const SUBJECTS_SECONDARY = [
  "Islamic",
  "Arabic",
  "Somali",
  "Juqrafi",
  "Taariikh",
  "Math",
  "Biology",
  "Chemistry",
  "Physics",
  "Business",
  "Technology",
  "English",
];

// ---- Isku dheelitir maadada macalinka (subjects: ["arabic", ...]) iyo
// liiska maadooyinka fasalka (sida "Arabic", "Carabi"). Waxaan u
// isticmaalnaa lower-case comparison + isbeddel fudud si loo
// helo qiimaha saxda ah ee liiska si loo soo bandhigo (display label). ----
const SUBJECT_KEY_ALIASES = {
  arabic: ["arabic", "carabi"],
  islamic: ["islamic", "tarbiyo"],
  somali: ["somali"],
  math: ["math", "xisaab"],
  english: ["english"],
  biology: ["biology"],
  chemistry: ["chemistry"],
  physics: ["physics"],
  business: ["business", "bussiness"],
  technology: ["technology", "teknalojiyad", "teknalogy"],
  geography: ["juqrafi", "geography"],
  history: ["taariikh", "history"],
  science: ["saynis", "science"],
  socialstudies: ["cimi bulsho", "social studies", "socialstudies"],
};

function matchTeacherSubjectToClassList(teacherSubjects, classSubjectList) {
  if (!Array.isArray(teacherSubjects) || teacherSubjects.length === 0) return "";
  const normalizedTeacherSubjects = teacherSubjects.map((s) =>
    String(s || "").trim().toLowerCase()
  );

  for (const classSubj of classSubjectList) {
    const classSubjLower = classSubj.trim().toLowerCase();
    // Direct match against class subject label
    if (normalizedTeacherSubjects.includes(classSubjLower)) return classSubj;

    // Alias-based match (e.g. teacher has "arabic", class list has "Carabi")
    for (const [key, aliases] of Object.entries(SUBJECT_KEY_ALIASES)) {
      if (aliases.includes(classSubjLower) && normalizedTeacherSubjects.some((ts) => aliases.includes(ts))) {
        return classSubj;
      }
    }
  }
  return "";
}

function classLevel(className) {
  const c = String(className || "").toUpperCase();
  if (["1", "2", "3", "4"].includes(c)) return "lower_primary";
  if (["5", "6", "7", "8"].includes(c)) return "upper_primary";
  if (["F1", "F2", "F3", "F4"].includes(c)) return "secondary";
  return "lower_primary";
}

function subjectsForClass(className) {
  const level = classLevel(className);
  if (level === "upper_primary") return SUBJECTS_UPPER_PRIMARY;
  if (level === "secondary") return SUBJECTS_SECONDARY;
  return SUBJECTS_LOWER_PRIMARY;
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
    startTime: "08:00",
    endTime: "08:45",
    teacherId: "",
    subject: "",
  };
}

// ---- Ku dar sessionNumber (Xiisad #1, #2, ...) iyadoo la raacayo
// taxanaha (order) ay ku yaalliin sessions-ka gudaha array-ga — LAMA
// kala sortayo wakhtiga bilowga, si xiisadda cusub aysan meel kale
// ugu boodin marka la kudarayo ama wakhtiga laga beddelo. Xiisadda
// ugu dambeysa ee la darto had iyo jeer waxay ku sii jirtaa hoosta
// liiska ilaa macalinku gacanta ku bedbeddelo taxanaha. ----
function withSessionNumbers(sessions) {
  return sessions.map((s, i) => ({ ...s, sessionNumber: i + 1 }));
}

// ---- Kala soocidda wakhtiga — waxaa loo isticmaalaa KALIYA meelaha
// wax lagu soo bandhigayo (read-only summary), sida jadwalka
// toddobaadka ee WeekSummary, halkaas ku habboon in xiisadaha lagu
// soo bandhigo si kala horreysay (wakhtiga bilowga). Editor-ka
// gudaha (draftSessions) marnaba lama isticmaalo. ----
function sortedBySessionTime(sessions) {
  return [...sessions].sort((a, b) =>
    (a.startTime || "").localeCompare(b.startTime || "")
  );
}

function ResponsiveStyles() {
  return (
    <style>{`
      .tt-layout { display: flex; min-height: 100vh; background: #0b0a1c; }
      .tt-content { flex: 1; min-width: 0; }
      .tt-class-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 18px; }
      .tt-day-tabs { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; }
      .tt-session-row { display: grid; grid-template-columns: 34px 110px 110px 1fr 1fr 40px; gap: 10px; align-items: center; }
      .tt-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }

      @media (max-width: 900px) {
        .tt-page-pad { padding: 16px !important; }
        .tt-header-row { gap: 10px !important; }
        .tt-header-title { font-size: 20px !important; }
        .tt-class-grid { grid-template-columns: 1fr 1fr; gap: 12px; }
        .tt-toolbar { flex-direction: column; align-items: stretch !important; }
        .tt-session-row { grid-template-columns: 26px 1fr 1fr; }
      }
      @media (max-width: 480px) {
        .tt-class-grid { grid-template-columns: 1fr; }
      }
    `}</style>
  );
}

// ============================================================
// TeacherSelect — dropdown gaar ah (ma aha native <select>) si
// theme-ka mugdiga ah (dark theme) loo maamulo si buuxda oo
// aanu kula dhicin row-yada kale ee list-ka.
// ============================================================
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

  const selectedOption = options.find((o) => o.id === value);
  const selectedLabel = selectedOption?.fullName;
  const selectedPhoto = selectedOption?.photoUrl;

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
            display: "flex",
            alignItems: "center",
            gap: 8,
            overflow: "hidden",
            minWidth: 0,
          }}
        >
          {selectedPhoto && (
            <img
              src={selectedPhoto}
              alt=""
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                objectFit: "cover",
                flexShrink: 0,
              }}
            />
          )}
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
            style={{
              padding: "9px 16px",
              fontSize: 12.5,
              fontWeight: 700,
              color: "#8b87ad",
              textTransform: "uppercase",
              letterSpacing: 0.4,
            }}
          >
            Dooro Macalin
          </div>

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
            onMouseEnter={(e) => {
              if (value) e.currentTarget.style.background = "rgba(139,108,245,0.12)";
            }}
            onMouseLeave={(e) => {
              if (value) e.currentTarget.style.background = "transparent";
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
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 16px",
                  fontSize: 13.5,
                  fontWeight: isSelected ? 700 : 500,
                  color: isSelected ? "#fff" : "#e5e3f7",
                  background: isSelected ? "#2563eb" : "transparent",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "rgba(139,108,245,0.12)";
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "transparent";
                }}
              >
                {opt.photoUrl ? (
                  <img
                    src={opt.photoUrl}
                    alt=""
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      objectFit: "cover",
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      background: "rgba(139,108,245,0.25)",
                      color: "#c4b8f7",
                      fontSize: 11,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {String(opt.fullName || "?").charAt(0).toUpperCase()}
                  </div>
                )}
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {opt.fullName}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// SubjectSelect — dropdown la mid ah TeacherSelect, laakiin waxa
// uu soo bandhigayaa maadooyinka ku habboon heerka fasalka la
// doortay (dugsiga hoose / dhexe / sare). Isla theme-ka mugdiga
// ah ayuu isticmaalaa si aanu kala duwanaan la arag.
// ============================================================
function SubjectSelect({ value, options, onChange }) {
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
            color: value ? "#e5e3f7" : "#8b87ad",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {value || "-- Dooro Maadada --"}
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
            style={{
              padding: "9px 16px",
              fontSize: 12.5,
              fontWeight: 700,
              color: "#8b87ad",
              textTransform: "uppercase",
              letterSpacing: 0.4,
            }}
          >
            Dooro Maadada
          </div>

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
            onMouseEnter={(e) => {
              if (value) e.currentTarget.style.background = "rgba(139,108,245,0.12)";
            }}
            onMouseLeave={(e) => {
              if (value) e.currentTarget.style.background = "transparent";
            }}
          >
            -- Dooro Maadada --
          </div>

          {options.length === 0 && (
            <div style={{ padding: "9px 16px", fontSize: 12.5, color: "#8b87ad" }}>
              Fasalkan maadooyin looma helin.
            </div>
          )}

          {options.map((subj) => {
            const isSelected = subj === value;
            return (
              <div
                key={subj}
                onClick={() => {
                  onChange(subj);
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
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "rgba(139,108,245,0.12)";
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "transparent";
                }}
              >
                {subj}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


export default function Timetable() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [teachers, setTeachers] = useState({}); // id -> { fullName, photoUrl, subject, classes }
  const [timetableDocs, setTimetableDocs] = useState({}); // `${className}__${day}` -> { sessions: [] }
  const [selectedClass, setSelectedClass] = useState(null);
  const [activeDay, setActiveDay] = useState(DAYS[0].key);
  const [draftSessions, setDraftSessions] = useState([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      const [teachersSnap, ttSnap] = await Promise.all([
        getDocs(collection(db, "teachers")),
        getDocs(collection(db, "timetable")),
      ]);

      const teacherMap = {};
      teachersSnap.docs.forEach((d) => {
        const data = d.data();
        teacherMap[d.id] = {
          fullName: data.fullName || data.username || d.id,
          photoUrl: data.photoUrl || data.photoURL || data.avatar || data.teacherPhoto || "",
          subject: data.subject || data.subjectName || "",
          // subjects: array of subject keys the teacher teaches, e.g. ["arabic"]
          subjects: Array.isArray(data.subjects) ? data.subjects : [],
          // classes: [{ className, subject, dayValid, ... }]
          classes: Array.isArray(data.classes) ? data.classes : [],
        };
      });
      setTeachers(teacherMap);

      const ttMap = {};
      ttSnap.docs.forEach((d) => {
        ttMap[d.id] = d.data();
      });
      setTimetableDocs(ttMap);
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

  // ---- Macallimiinta u gaarka ah fasalka la doortay kaliya ----
  // Macallin wuxuu ku muuqdaa liiska haddii uu leeyahay class
  // gudaha `classes[]` oo className-kiisu la mid yahay fasalka la doortay.
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

  // ---- Maadooyinka ku habboon heerka fasalka la doortay ----
  // 1-4 = dugsiga hoose, 5-8 = dugsiga dhexe, F1-F4 = dugsiga sare.
  // Mid kastaa liistadiisa maadooyin ayaa lagu soo bandhigayaa
  // SubjectSelect-ka gudaha row-ka xiisadda.
  const subjectOptionsForSelectedClass = useMemo(() => {
    if (!selectedClass) return [];
    return subjectsForClass(selectedClass);
  }, [selectedClass]);

  // Whenever the selected class or active day changes, load the draft
  // sessions for that class/day from the loaded timetable docs.
  // NOTE: we keep whatever order is already saved in Firestore (which
  // itself preserves insertion order) instead of re-sorting by time,
  // so rows never jump around when this effect re-runs.
  useEffect(() => {
    if (!selectedClass) return;
    const key = `${selectedClass}__${activeDay}`;
    const existing = timetableDocs[key];
    setDraftSessions(
      existing?.sessions?.length
        ? withSessionNumbers(existing.sessions.map((s) => ({ ...s })))
        : [emptySession()]
    );
    setDirty(false);
  }, [selectedClass, activeDay, timetableDocs]);

  function openClass(cls) {
    setSelectedClass(cls);
    setActiveDay(DAYS[0].key);
  }

  function updateSession(index, field, value) {
    setDraftSessions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      // Kaliya dib u tir sessionNumber-yada (taxanaha isku mid ah wuu sii ahaanayaa) —
      // marnaba lama kala sortayo wakhtiga, si rowga aanu meel kale ugu booddin.
      return withSessionNumbers(next);
    });
    setDirty(true);
  }

  function addSession() {
    // Ku dar xiisadda cusub hoosta liiska si joogto ah (append), mana
    // sortayo array-ga — sidaa darteed xiisadda cusub had iyo jeer
    // waxay ku sii jirtaa hoosta ilaa loo bedbeddelo gacanta.
    setDraftSessions((prev) => withSessionNumbers([...prev, emptySession()]));
    setDirty(true);
  }

  function removeSession(index) {
    setDraftSessions((prev) => withSessionNumbers(prev.filter((_, i) => i !== index)));
    setDirty(true);
  }

  // ---- Marka jadwalka maalintaas la kaydiyo, si toos ah ugu qor
  // dhammaan ardayda fasalkaas ku jira (students collection) field
  // "timetable" oo ay ku jirto full jadwalka toddobaadka fasalkooda,
  // si ay Student Dashboard-ku si toos ah uga soo aqriyo. ----
  async function syncStudentsTimetable(className, updatedTimetableDocs) {
    try {
      const studentsSnap = await getDocs(
        query(collection(db, "students"), where("className", "==", className))
      );
      if (studentsSnap.empty) return;

      // Isku dar jadwalka toddobaadka oo dhan ee fasalkan (5-ta maalmood).
      // Halkan waxaa lagu soo bandhigayaa xiisadaha si kala horreysay
      // (wakhtiga bilowga) sababtoo ah tani waa view/summary oo kaliya —
      // kuma saameeyo sida xiisadaha loogu darayo editor-ka.
      const weekSchedule = DAYS.map((d) => {
        const key = `${className}__${d.key}`;
        const sessions = sortedBySessionTime(updatedTimetableDocs[key]?.sessions || []).map(
          (s) => ({
            sessionNumber: s.sessionNumber,
            startTime: s.startTime,
            endTime: s.endTime,
            teacherId: s.teacherId,
            teacherName: teachers[s.teacherId]?.fullName || s.teacherId,
            subject: s.subject || "",
          })
        );
        return { day: d.key, dayLabel: d.label, sessions };
      });

      const batch = writeBatch(db);
      studentsSnap.docs.forEach((studentDoc) => {
        batch.update(doc(db, "students", studentDoc.id), {
          timetable: weekSchedule,
          timetableUpdatedAt: new Date(),
        });
      });
      await batch.commit();
    } catch (err) {
      console.log("Khalad marka la sync gareynayo timetable-ka ardayda:", err);
    }
  }

  async function saveDay() {
    if (!selectedClass) return;
    setSaving(true);
    const key = `${selectedClass}__${activeDay}`;

    // Skip rows with no teacher selected to avoid saving blank sessions.
    // Order is preserved as-is (no time-based sorting) so the saved
    // sessions array keeps matching what the teacher sees in the editor.
    const cleanSessions = withSessionNumbers(
      draftSessions.filter((s) => s.teacherId && s.teacherId.trim() !== "")
    );

    try {
      let updatedDocs = { ...timetableDocs };

      if (cleanSessions.length === 0) {
        await deleteDoc(doc(db, "timetable", key));
        delete updatedDocs[key];
      } else {
        const payload = {
          className: selectedClass,
          day: activeDay,
          sessions: cleanSessions,
          updatedAt: new Date(),
        };
        await setDoc(doc(db, "timetable", key), payload);
        updatedDocs[key] = payload;
      }

      setTimetableDocs(updatedDocs);
      setDraftSessions(cleanSessions.length ? cleanSessions : [emptySession()]);
      setDirty(false);

      // ---- Toos u qor ardayda fasalkan jadwalkooda cusub ----
      await syncStudentsTimetable(selectedClass, updatedDocs);
    } catch (err) {
      console.log(err);
      alert("Khalad ayaa dhacay marka la kaydinayay: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  // Count sessions scheduled per class (across all days) for the class cards.
  const sessionCountByClass = useMemo(() => {
    const counts = {};
    Object.values(timetableDocs).forEach((docData) => {
      const cls = docData.className;
      const n = (docData.sessions || []).length;
      counts[cls] = (counts[cls] || 0) + n;
    });
    return counts;
  }, [timetableDocs]);

  const daysScheduledByClass = useMemo(() => {
    const counts = {};
    Object.entries(timetableDocs).forEach(([key, docData]) => {
      if ((docData.sessions || []).length > 0) {
        counts[docData.className] = (counts[docData.className] || 0) + 1;
      }
    });
    return counts;
  }, [timetableDocs]);

  return (
    <div className="tt-layout">
      <ResponsiveStyles />
      <Sidebar />

      <div className="tt-content">
        <div style={{ padding: "20px 24px 0" }}>
          <Topbar />
        </div>

        <div className="tt-page-pad" style={{ padding: "26px 30px" }}>
          {/* Header */}
          <div
            className="tt-header-row"
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
              <CalendarDays color="#fff" size={26} />
            </div>
            <div>
              <h1 className="tt-header-title" style={{ margin: 0, fontSize: 26, color: "#fff" }}>
                Jadwalka (Timetable)
              </h1>
              <div style={{ color: "#8b87ad", fontSize: 14 }}>
                Samee jadwalka xiisadaha maalinlaha ah ee fasal kasta iyo macalinka xiisad walba
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ color: "#8b87ad", textAlign: "center", padding: 60 }}>
              Xogta ayaa la soo qaadayaa...
            </div>
          ) : !selectedClass ? (
            <div className="tt-class-grid">
              {classes.map((cls) => {
                const sessionCount = sessionCountByClass[cls] || 0;
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
                          background: "linear-gradient(135deg,#22C55E,#16A34A)",
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
                        <Clock size={13} /> {sessionCount} Xiisadood
                      </span>
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
                className="tt-toolbar"
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
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 18,
                }}
              >
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 14,
                    background: "linear-gradient(135deg,#22C55E,#16A34A)",
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

              {/* Day tabs */}
              <div className="tt-day-tabs" style={{ marginBottom: 20 }}>
                {DAYS.map((d) => {
                  const isActive = d.key === activeDay;
                  const hasSessions =
                    (timetableDocs[`${selectedClass}__${d.key}`]?.sessions || []).length > 0;
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
                      {hasSessions && (
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

              {/* Sessions editor */}
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
                    <Clock size={16} color="#8B5CF6" /> Xiisadaha —{" "}
                    {DAYS.find((d) => d.key === activeDay)?.label}
                  </h3>
                  <button
                    onClick={addSession}
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
                    <Plus size={14} /> Ku dar Xiisad
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
                    Wali macalin looma xilsaarin fasalkan (Fasalka {selectedClass}). Aad Teachers
                    ku dar fasalkan macalin.
                  </div>
                )}

                <div
                  className="tt-session-row"
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
                  <div>Macalinka</div>
                  <div>Maadada</div>
                  <div></div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10, position: "relative" }}>
                  {draftSessions.map((session, index) => (
                    <div
                      key={session.id}
                      className="tt-session-row"
                      style={{
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(139,108,245,0.18)",
                        borderRadius: 12,
                        padding: "10px 12px",
                        position: "relative",
                        zIndex: draftSessions.length - index,
                      }}
                    >
                      {/* Xiisad #N - taxanaha waa mid joogto ah, ma ahan mid ku
                          xiran wakhtiga bilowga, sidaas darteed rowga hoosta
                          ah wuu sii ahaanayaa #N ilaa la bedbeddelo gacanta */}
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
                        title={`Xiisad #${session.sessionNumber}`}
                      >
                        {session.sessionNumber}
                      </div>

                      <input
                        type="time"
                        value={session.startTime}
                        onChange={(e) => updateSession(index, "startTime", e.target.value)}
                        style={fieldStyle}
                      />
                      <input
                        type="time"
                        value={session.endTime}
                        onChange={(e) => updateSession(index, "endTime", e.target.value)}
                        style={fieldStyle}
                      />
                      <TeacherSelect
                        value={session.teacherId}
                        options={Object.entries(teachersForSelectedClass).map(([tid, info]) => ({
                          id: tid,
                          fullName: info.fullName,
                          photoUrl: info.photoUrl,
                        }))}
                        onChange={(tid) => {
                          updateSession(index, "teacherId", tid);
                          // ---- Toos u buuxi maadada iyadoo la eegayo
                          // liiska subjects ee macalinka (subjects: [...])
                          // oo lala barbardhigayo maadooyinka fasalkan.
                          // Haddii aan la helin waxba lama beddelo. ----
                          const info = teachersForSelectedClass[tid];
                          if (info) {
                            const matched = matchTeacherSubjectToClassList(
                              info.subjects,
                              subjectOptionsForSelectedClass
                            );
                            if (matched) {
                              updateSession(index, "subject", matched);
                            } else if (info.subject) {
                              updateSession(index, "subject", info.subject);
                            }
                          }
                        }}
                      />
                      <SubjectSelect
                        value={session.subject}
                        options={subjectOptionsForSelectedClass}
                        onChange={(subj) => updateSession(index, "subject", subj)}
                      />
                      <button
                        onClick={() => removeSession(index)}
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

                {draftSessions.length === 0 && (
                  <div style={{ color: "#8b87ad", fontSize: 13, textAlign: "center", padding: 20 }}>
                    Weli xiisad lama darin maalintan.
                  </div>
                )}
              </div>

              {/* Editable summary of the saved week for this class — clicking
                  a day switches the active day tab so it opens directly in
                  the session editor above; each session chip also has quick
                  edit / delete controls. */}
              <WeekSummary
                selectedClass={selectedClass}
                timetableDocs={timetableDocs}
                teachers={teachers}
                activeDay={activeDay}
                onEditDay={(dayKey) => setActiveDay(dayKey)}
                onQuickRemoveSession={async (dayKey, sessionId) => {
                  const key = `${selectedClass}__${dayKey}`;
                  const existing = timetableDocs[key];
                  if (!existing) return;
                  const remaining = withSessionNumbers(
                    (existing.sessions || []).filter((s) => s.id !== sessionId)
                  );
                  setSaving(true);
                  try {
                    let updatedDocs = { ...timetableDocs };
                    if (remaining.length === 0) {
                      await deleteDoc(doc(db, "timetable", key));
                      delete updatedDocs[key];
                    } else {
                      const payload = {
                        className: selectedClass,
                        day: dayKey,
                        sessions: remaining,
                        updatedAt: new Date(),
                      };
                      await setDoc(doc(db, "timetable", key), payload);
                      updatedDocs[key] = payload;
                    }
                    setTimetableDocs(updatedDocs);
                    if (dayKey === activeDay) {
                      setDraftSessions(remaining.length ? remaining : [emptySession()]);
                    }
                    await syncStudentsTimetable(selectedClass, updatedDocs);
                  } catch (err) {
                    console.log(err);
                    alert("Khalad ayaa dhacay marka la tirtirayay: " + err.message);
                  } finally {
                    setSaving(false);
                  }
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WeekSummary({
  selectedClass,
  timetableDocs,
  teachers,
  activeDay,
  onEditDay,
  onQuickRemoveSession,
}) {
  const rows = DAYS.map((d) => {
    const key = `${selectedClass}__${d.key}`;
    // Summary view sorts by time for readability — this doesn't touch the editor state.
    const sessions = sortedBySessionTime(
      withSessionNumbers(timetableDocs[key]?.sessions || [])
    );
    return { day: d, sessions };
  });

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
          marginBottom: 6,
        }}
      >
        <Users size={16} color="#8B5CF6" /> Jadwalka Toddobaadka — Fasalka {selectedClass}
      </h3>
      <div style={{ color: "#8b87ad", fontSize: 12.5, marginBottom: 14 }}>
        Taabo maalin si aad ugu darto ama uga wax bedbeddesho, ama taabo ✕ xiisad si aad si degdeg
        ah uga tirtirto.
      </div>

      <div className="tt-table-wrap">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 700 }}>
          <thead>
            <tr>
              <th style={thStyle}>Maalinta</th>
              <th style={thStyle}>Xiisadaha</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ day, sessions }) => {
              const isActiveRow = day.key === activeDay;
              return (
                <tr
                  key={day.key}
                  style={{
                    borderTop: "1px solid rgba(139,108,245,0.12)",
                    background: isActiveRow ? "rgba(139,108,245,0.08)" : "transparent",
                    cursor: "pointer",
                  }}
                  onClick={() => onEditDay?.(day.key)}
                >
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{day.label}</td>
                  <td style={tdStyle}>
                    {sessions.length === 0 ? (
                      <span style={{ color: "#8b87ad" }}>Ma jiraan xiisad</span>
                    ) : (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {sessions.map((s) => {
                          const teacherName = teachers[s.teacherId]?.fullName || s.teacherId;
                          return (
                            <span
                              key={s.id}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                background: "rgba(139,108,245,0.1)",
                                border: "1px solid rgba(139,108,245,0.25)",
                                borderRadius: 20,
                                padding: "5px 8px 5px 12px",
                                color: "#c4b8f7",
                                fontWeight: 600,
                                fontSize: 12,
                                whiteSpace: "nowrap",
                              }}
                            >
                              #{s.sessionNumber} · {s.startTime}–{s.endTime} · {teacherName}
                              {s.subject ? ` (${s.subject})` : ""}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onQuickRemoveSession?.(day.key, s.id);
                                }}
                                title="Ka tirtir xiisaddan"
                                style={{
                                  width: 18,
                                  height: 18,
                                  borderRadius: "50%",
                                  border: "none",
                                  background: "rgba(239,68,68,0.2)",
                                  color: "#EF4444",
                                  fontSize: 11,
                                  lineHeight: "18px",
                                  padding: 0,
                                  cursor: "pointer",
                                  flexShrink: 0,
                                }}
                              >
                                ✕
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditDay?.(day.key);
                      }}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        background: "rgba(34,197,94,0.12)",
                        border: "1px solid rgba(34,197,94,0.3)",
                        color: "#22C55E",
                        padding: "6px 12px",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <Plus size={12} /> Wax ka beddel
                    </button>
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