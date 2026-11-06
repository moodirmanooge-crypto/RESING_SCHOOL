// src/admin/pages/Timetable.jsx
//
// Jadwalka xiisadaha (Full Time / Part Time).
//   - Macalimiinta: kuwa jira oo firfircoon oo keliya (la tirtiray / Recycle Bin lama soo qaado)
//   - Maadada: lagama qoro gacanta — waxaa laga doortaa maadooyinka macalinka loogu
//     diiwaan geliyay (Add Teacher). Marka macalin la doorto, maadadiisa ayaa la qaataa.
//   - Isku dhac: isla macalin laba fasal isla waqti, ama laba xiisadood oo isku dhacaya
//     fasal gudihiisa — waa la muujiyaa, waxaana laga hor istaagaa kaydinta.
//   - "Jadwalka Guud": maamulku wuxuu arkaa dhammaan jadwallada fasallada.
//   - Warqadda jadwalka (sida naqshadda dugsiga) + PDF / sawir.

import { useEffect, useMemo, useState } from "react";
import { db } from "../../firebase/firebase";
import { collection, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";
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
  AlertTriangle,
  CheckCircle2,
  LayoutGrid,
  Eye,
  Download,
  Image as ImageIcon,
  Pencil,
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import TimePicker12 from "../components/TimePicker12";
import ClassTimetableSheet, { FitToWidth } from "../components/ClassTimetableSheet";
import { isRemoved } from "../../utils/activeRecords";
import {
  FULLTIME_DAYS,
  PARTTIME_DAYS,
  DAY_SO,
  CLASS_ORDER,
  cleanClassName,
  norm,
  toMinutes,
  fmtRange,
  sortSessions,
  teacherFitsType,
  teacherTeachesClass,
  subjectsForTeacher,
  resolveTeacher,
  detectClashes,
  clashesForClassDay,
  currentAcademicYear,
} from "../../utils/timetableUtils";
import { captureNode, saveCanvasAsImage, canvasesToPdf, safeFileName } from "../../utils/exportImage";

const STUDENT_TYPES = [
  { key: "fulltime", label: "Full Time", collectionName: "timetable" },
  { key: "parttime", label: "Part Time", collectionName: "timetablePartTime" },
];

const DAYS_BY_TYPE = { fulltime: FULLTIME_DAYS, parttime: PARTTIME_DAYS };

const ACADEMIC_YEAR = currentAcademicYear();
const EMPTY = [];

const P = {
  bg: "#0b0a1c",
  panel: "#151233",
  panel2: "#181430",
  border: "rgba(139,108,245,0.25)",
  dim: "#8b87ad",
  purple: "#6d5df0",
  green: "#22C55E",
  red: "#EF4444",
  amber: "#F59E0B",
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

const sessionSig = (list) =>
  JSON.stringify(
    (list || []).map((s) => [s.startTime || "", s.endTime || "", s.teacherId || "", s.subject || ""])
  );

function PageStyles() {
  return (
    <style>{`
      .tt-row { display: grid; grid-template-columns: 40px minmax(190px,1fr) minmax(190px,1fr) minmax(180px,1.3fr) minmax(160px,1.1fr) 42px; gap: 12px; align-items: center; }
      .tt-select { width: 100%; background: #0b0a1c; color: #fff; border: 1px solid rgba(139,108,245,0.3); padding: 9px 10px; border-radius: 8px; font-size: 13.5px; }
      .tt-select:disabled { opacity: 0.5; cursor: not-allowed; }
      .tt-select.bad { border-color: #EF4444; }
      .tt-select option, .tt-select optgroup { background: #1e1a4a; color: #fff; }
      .tt-tab { padding: 10px 16px; border-radius: 10px; border: 1px solid rgba(139,108,245,0.25); background: #151233; color: #c4b8f7; font-weight: 700; font-size: 13.5px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; }
      .tt-tab.active { background: #6d5df0; border-color: #6d5df0; color: #fff; }
      .tt-btn { display: inline-flex; align-items: center; gap: 6px; border-radius: 9px; padding: 8px 14px; font-weight: 700; font-size: 12.5px; cursor: pointer; border: 1px solid transparent; }
      .tt-btn:disabled { opacity: 0.6; cursor: not-allowed; }
      .tt-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
      @media (max-width: 900px) {
        .tt-page { padding: 16px !important; }
      }
    `}</style>
  );
}

function PrintPreviewModal({ selected, onToggle, onSelectAll, onClose, onPdf, busy }) {
  const totalPossible = CLASS_ORDER.length * STUDENT_TYPES.length;
  const allSelected = selected.length === totalPossible;

  return (
    <div
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
          background: P.panel,
          border: `1px solid ${P.border}`,
          borderRadius: 18,
          width: "min(680px, 100%)",
          maxHeight: "86vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          color: "#fff",
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
            <h3 style={{ margin: 0, fontSize: 17 }}>Daawo &amp; Daabac Jadwalka (PDF)</h3>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: P.dim, cursor: "pointer" }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: "16px 22px", overflowY: "auto" }}>
          <p style={{ color: P.dim, fontSize: 13, marginTop: 0 }}>
            Dooro fasallada — Full Time, Part Time, ama labadaba. Fasal kasta wuxuu noqonayaa bog A4 Landscape
            ah oo leh naqshadda jadwalka dugsiga. PDF-ka waad daabici kartaa ama la wadaagi kartaa.
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

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 10 }}>
            {CLASS_ORDER.map((cls) => (
              <div
                key={cls}
                style={{ background: P.bg, border: "1px solid rgba(139,108,245,0.2)", borderRadius: 10, padding: "10px 12px" }}
              >
                <div style={{ fontWeight: "bold", fontSize: 13.5, marginBottom: 8, color: "#eef0f4" }}>Fasalka: {cls}</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {STUDENT_TYPES.map((t) => {
                    const isChecked = selected.some((item) => item.cls === cls && item.type === t.key);
                    return (
                      <label
                        key={t.key}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          background: isChecked ? "rgba(139,108,245,0.15)" : "transparent",
                          border: `1px solid ${isChecked ? P.purple : "rgba(139,108,245,0.2)"}`,
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
                          style={{ accentColor: P.purple }}
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
              color: P.dim,
              padding: "10px 18px",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Jooji
          </button>
          <button
            onClick={onPdf}
            disabled={selected.length === 0 || busy}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: selected.length === 0 ? "#3a3560" : P.purple,
              color: "#fff",
              border: "none",
              padding: "10px 20px",
              borderRadius: 8,
              cursor: selected.length === 0 || busy ? "not-allowed" : "pointer",
              fontWeight: "bold",
            }}
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {busy ? "Waa la diyaarinayaa..." : `Soo saar PDF (${selected.length})`}
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
  const [view, setView] = useState("classes"); // classes | overview | clashes

  const [studentType, setStudentType] = useState("fulltime");
  const currentDays = DAYS_BY_TYPE[studentType] || FULLTIME_DAYS;
  const [activeDay, setActiveDay] = useState(FULLTIME_DAYS[0].key);
  const [draftSessions, setDraftSessions] = useState([]);

  const activeCollectionName = STUDENT_TYPES.find((t) => t.key === studentType)?.collectionName || "timetable";
  const activeTypeLabel = STUDENT_TYPES.find((t) => t.key === studentType)?.label || "Full Time";
  const timetableDocs = timetableByType[studentType] || {};

  // ---- Daabac / soo deji ----
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [selectedForPrint, setSelectedForPrint] = useState([]);
  const [exportJob, setExportJob] = useState(null); // { list: [{cls,type}], format: "pdf"|"png" }

  useEffect(() => {
    if (!currentDays.some((d) => d.key === activeDay)) setActiveDay(currentDays[0].key);
  }, [studentType, currentDays, activeDay]);

  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    try {
      setLoading(true);
      const [teacherSnap, fullSnap, partSnap] = await Promise.all([
        getDocs(collection(db, "teachers")),
        getDocs(collection(db, "timetable")),
        getDocs(collection(db, "timetablePartTime")),
      ]);

      // Macalimiinta jira oo keliya (la tirtiray / Recycle Bin halkan kuma jiraan)
      setTeachers(
        teacherSnap.docs
          .filter((d) => !isRemoved(d.data()))
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              fullName: data.fullName || d.id,
              username: data.username || d.id,
              classes: Array.isArray(data.classes) ? data.classes : [],
              subjects: Array.isArray(data.subjects) ? data.subjects : [],
              employmentType: data.employmentType,
            };
          })
          .sort((a, b) => a.fullName.localeCompare(b.fullName))
      );

      function buildMap(snap) {
        const ttMap = {};
        snap.docs.forEach((d) => {
          const data = d.data();
          let cls = cleanClassName(data.className);
          let day = data.day;
          if (!cls && d.id.includes("__")) {
            const parts = d.id.split("__");
            cls = cleanClassName(parts[0]);
            day = parts[1];
          }
          if (cls && day) {
            ttMap[`${cls}__${day}`] = {
              docId: d.id,
              className: cls,
              day,
              sessions: Array.isArray(data.sessions) ? data.sessions : [],
            };
          }
        });
        return ttMap;
      }

      setTimetableByType({ fulltime: buildMap(fullSnap), parttime: buildMap(partSnap) });
    } catch (err) {
      console.error("Error loading data:", err);
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  const curKey = selectedClass ? `${cleanClassName(selectedClass)}__${activeDay}` : "";
  const savedSessions = useMemo(() => (curKey ? timetableDocs[curKey]?.sessions || EMPTY : EMPTY), [curKey, timetableDocs]);

  useEffect(() => {
    if (!selectedClass) return;
    setDraftSessions(savedSessions.length > 0 ? savedSessions.map((s) => ({ ...s })) : [emptySession()]);
  }, [selectedClass, activeDay, savedSessions]);

  const isDirty =
    !!selectedClass &&
    sessionSig(draftSessions.filter((s) => s.startTime || s.endTime || s.teacherId || s.subject)) !==
      sessionSig(savedSessions);

  // Jadwalka "nool": kan la kaydiyay + isbeddelka hadda la sameynayo
  const liveDocs = useMemo(() => {
    if (!selectedClass) return timetableDocs;
    return {
      ...timetableDocs,
      [curKey]: { className: cleanClassName(selectedClass), day: activeDay, sessions: draftSessions },
    };
  }, [timetableDocs, selectedClass, curKey, activeDay, draftSessions]);

  const savedClashes = useMemo(() => detectClashes(timetableDocs, teachers), [timetableDocs, teachers]);
  const liveClashes = useMemo(() => detectClashes(liveDocs, teachers), [liveDocs, teachers]);
  const sessionClashMap = useMemo(
    () => (selectedClass ? clashesForClassDay(liveClashes, selectedClass, activeDay) : {}),
    [liveClashes, selectedClass, activeDay]
  );

  const clashCountByClass = useMemo(() => {
    const m = {};
    savedClashes.forEach((c) => {
      m[c.a.cls] = (m[c.a.cls] || 0) + 1;
      if (c.b.cls !== c.a.cls) m[c.b.cls] = (m[c.b.cls] || 0) + 1;
    });
    return m;
  }, [savedClashes]);

  // Macalimiinta nooca hadda (Full Time / Part Time)
  const typeTeachers = useMemo(() => teachers.filter((t) => teacherFitsType(t, studentType)), [teachers, studentType]);
  const classTeachers = useMemo(
    () => (selectedClass ? typeTeachers.filter((t) => teacherTeachesClass(t, selectedClass)) : []),
    [typeTeachers, selectedClass]
  );
  const otherTeachers = useMemo(
    () => typeTeachers.filter((t) => !classTeachers.some((c) => c.id === t.id)),
    [typeTeachers, classTeachers]
  );

  const teacherNameOf = (s) => resolveTeacher(teachers, s)?.fullName || "";

  function sessionsByDayFor(cls, type) {
    const docs = type === studentType ? liveDocs : timetableByType[type] || {};
    const c = cleanClassName(cls);
    const out = {};
    (DAYS_BY_TYPE[type] || FULLTIME_DAYS).forEach((d) => {
      out[d.key] = docs[`${c}__${d.key}`]?.sessions || [];
    });
    return out;
  }

  function classHasData(cls, type = studentType) {
    const docs = timetableByType[type] || {};
    const c = cleanClassName(cls);
    return (DAYS_BY_TYPE[type] || FULLTIME_DAYS).some((d) => (docs[`${c}__${d.key}`]?.sessions || []).length > 0);
  }

  // ---- Wax ka beddelka xiisadaha ----
  function updateSession(index, field, value) {
    setDraftSessions((prev) => {
      const updated = [...prev];
      const row = { ...updated[index], [field]: value };

      if (field === "teacherId") {
        const t = teachers.find((x) => x.id === value);
        row.teacherId = t ? t.id : "";
        row.teacherName = t ? t.fullName : "";
        const subs = subjectsForTeacher(t, selectedClass);
        if (subs.length === 1) row.subject = subs[0];
        else if (!subs.some((x) => norm(x) === norm(row.subject))) row.subject = "";
      }
      updated[index] = row;
      return updated;
    });
  }

  function addSession() {
    setDraftSessions((prev) => {
      const last = sortSessions(prev.filter((s) => s.endTime)).pop();
      const s = emptySession();
      // Xiisadda cusub waxay ka bilaabanaysaa meeshii tii hore ku dhammaatay
      if (last?.endTime) s.startTime = last.endTime;
      return [...prev, s];
    });
  }

  function removeSession(index) {
    setDraftSessions((prev) => prev.filter((_, i) => i !== index));
  }

  async function saveDayTimetable() {
    if (!selectedClass) return;

    const rows = draftSessions.filter((s) => s.startTime || s.endTime || s.teacherId || s.subject);
    const problems = [];
    rows.forEach((s) => {
      const n = draftSessions.indexOf(s) + 1;
      const t = resolveTeacher(teachers, s);
      if (!s.startTime || !s.endTime) problems.push(`#${n}: geli waqtiga bilowga iyo dhammaadka`);
      else if (toMinutes(s.startTime) >= toMinutes(s.endTime))
        problems.push(`#${n}: waqtiga dhammaadku waa inuu ka dambeeyaa bilowga`);
      if (!t) problems.push(`#${n}: dooro macalin jira`);
      else if (!subjectsForTeacher(t, selectedClass).some((x) => norm(x) === norm(s.subject)))
        problems.push(`#${n}: dooro maadada macalinka`);
    });
    if (problems.length) {
      alert("Fadlan sax:\n\n" + problems.join("\n"));
      return;
    }

    const own = Object.entries(sessionClashMap);
    const inClass = liveClashes.some(
      (c) => c.kind === "class" && c.day === activeDay && c.a.cls === cleanClassName(selectedClass)
    );
    if (inClass) {
      alert("Xiisadaha fasalkan waqtigoodu wuu isku dhacayaa. Fadlan sax waqtiyada ka hor intaadan kaydin.");
      return;
    }
    if (own.length) {
      const msgs = own.flatMap(([idx, list]) => list.map((m) => `#${Number(idx) + 1}: ${m}`));
      const ok = window.confirm(
        "Isku dhac ayaa jira:\n\n" + msgs.join("\n") + "\n\nMa rabtaa inaad si kastaba u kaydiso?"
      );
      if (!ok) return;
    }

    setSaving(true);
    const clsKey = cleanClassName(selectedClass);
    const fullKey = `${clsKey}__${activeDay}`;

    const validSessions = sortSessions(rows).map((s, idx) => {
      const t = resolveTeacher(teachers, s);
      return {
        ...s,
        teacherId: t.id,
        teacherName: t.fullName,
        subject: subjectsForTeacher(t, selectedClass).find((x) => norm(x) === norm(s.subject)) || s.subject,
        sessionNumber: idx + 1,
      };
    });

    try {
      if (validSessions.length === 0) {
        await deleteDoc(doc(db, activeCollectionName, fullKey));
        setTimetableByType((prev) => {
          const m = { ...prev[studentType] };
          delete m[fullKey];
          return { ...prev, [studentType]: m };
        });
      } else {
        const payload = {
          className: clsKey,
          day: activeDay,
          sessions: validSessions,
          studentType,
          updatedAt: new Date(),
        };
        await setDoc(doc(db, activeCollectionName, fullKey), payload, { merge: true });
        setTimetableByType((prev) => ({
          ...prev,
          [studentType]: { ...prev[studentType], [fullKey]: { docId: fullKey, ...payload } },
        }));
      }
      alert(`Jadwalka ${activeTypeLabel} — Fasalka ${selectedClass}, ${DAY_SO[activeDay] || activeDay} waa la kaydiyay.`);
    } catch (err) {
      console.error(err);
      alert("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  // ---- Soo deji (PDF / sawir) ----
  function togglePrintClass(cls, type) {
    setSelectedForPrint((prev) =>
      prev.some((i) => i.cls === cls && i.type === type)
        ? prev.filter((i) => !(i.cls === cls && i.type === type))
        : [...prev, { cls, type }]
    );
  }

  function toggleSelectAllForPrint() {
    setSelectedForPrint((prev) => {
      if (prev.length === CLASS_ORDER.length * STUDENT_TYPES.length) return [];
      const all = [];
      CLASS_ORDER.forEach((cls) => STUDENT_TYPES.forEach((t) => all.push({ cls, type: t.key })));
      return all;
    });
  }

  useEffect(() => {
    if (!exportJob) return undefined;
    let cancelled = false;
    (async () => {
      try {
        await new Promise((r) => setTimeout(r, 120));
        const canvases = [];
        for (const item of exportJob.list) {
          const node = document.getElementById(`tt-export-${item.type}-${cleanClassName(item.cls)}`);
          // eslint-disable-next-line no-await-in-loop
          if (node) canvases.push(await captureNode(node));
        }
        if (cancelled || canvases.length === 0) return;
        const first = exportJob.list[0];
        const typeLabel = STUDENT_TYPES.find((t) => t.key === first.type)?.label || "";
        if (exportJob.format === "png") {
          await saveCanvasAsImage(
            canvases[0],
            `Jadwalka-Fasalka-${safeFileName(first.cls)}-${safeFileName(typeLabel)}.png`,
            { preferShare: false }
          );
        } else {
          const name =
            exportJob.list.length === 1
              ? `Jadwalka-Fasalka-${safeFileName(first.cls)}-${safeFileName(typeLabel)}.pdf`
              : `Jadwalka-Fasallada-${exportJob.list.length}.pdf`;
          canvasesToPdf(canvases, name);
        }
        setPrintModalOpen(false);
      } catch (err) {
        console.error(err);
        alert("Soo dejintu way fashilantay: " + err.message);
      } finally {
        if (!cancelled) setExportJob(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [exportJob]);

  const exportBusy = !!exportJob;

  // ---- UI ----
  const totalSavedClashes = savedClashes.length;

  function openClassDay(cls, day) {
    setSelectedClass(cls);
    setActiveDay(day);
    setView("classes");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <>
      <PageStyles />
      <div style={{ display: "flex", minHeight: "100vh", background: P.bg, color: "#fff" }}>
        <Sidebar />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ padding: "20px 24px 0" }}>
            <Topbar />
          </div>

          <div className="tt-page" style={{ padding: "26px 30px" }}>
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                marginBottom: 22,
                flexWrap: "wrap",
              }}
            >
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
                    flexShrink: 0,
                  }}
                >
                  <CalendarDays color="#fff" size={24} />
                </div>
                <div>
                  <h1 style={{ margin: 0, fontSize: 24 }}>Jadwalka (Timetable)</h1>
                  <div style={{ color: P.dim, fontSize: 13 }}>
                    Samee jadwalka fasallada, eeg dhammaan jadwallada, kana saar isku dhacyada xiisadaha
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  setSelectedForPrint(selectedClass ? [{ cls: selectedClass, type: studentType }] : []);
                  setPrintModalOpen(true);
                }}
                className="tt-btn"
                style={{ background: P.panel, borderColor: "rgba(139,108,245,0.35)", color: "#c4b8f7", padding: "12px 18px", fontSize: 13.5 }}
              >
                <Printer size={17} />
                Daawo &amp; Daabac
              </button>
            </div>

            {/* Full Time / Part Time */}
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", marginBottom: 18 }}>
              <div
                style={{
                  display: "inline-flex",
                  background: P.panel,
                  border: `1px solid ${P.border}`,
                  borderRadius: 12,
                  padding: 4,
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
                        background: isActive ? P.purple : "transparent",
                        color: isActive ? "#fff" : P.dim,
                      }}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {!selectedClass && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className={"tt-tab" + (view === "classes" ? " active" : "")} onClick={() => setView("classes")}>
                    <LayoutGrid size={15} /> Fasallada
                  </button>
                  <button className={"tt-tab" + (view === "overview" ? " active" : "")} onClick={() => setView("overview")}>
                    <Eye size={15} /> Jadwalka Guud
                  </button>
                  <button
                    className={"tt-tab" + (view === "clashes" ? " active" : "")}
                    onClick={() => setView("clashes")}
                    style={totalSavedClashes && view !== "clashes" ? { borderColor: P.red, color: "#fca5a5" } : undefined}
                  >
                    <AlertTriangle size={15} /> Isku Dhacyada ({totalSavedClashes})
                  </button>
                </div>
              )}
            </div>

            {loading ? (
              <div style={{ textAlign: "center", color: P.dim, padding: 50 }}>
                <Loader2 className="animate-spin" size={32} style={{ margin: "0 auto 12px" }} />
                Loading Timetable...
              </div>
            ) : selectedClass ? (
              /* ======================== EDITOR ======================== */
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
                  <button
                    onClick={() => setSelectedClass(null)}
                    style={{ background: "transparent", border: "none", color: "#8B5CF6", cursor: "pointer", fontWeight: "bold", fontSize: 14 }}
                  >
                    ← Dhammaan Fasallada
                  </button>

                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {isDirty && <span style={{ color: P.amber, fontSize: 12.5, fontWeight: 700 }}>Wax lama kaydin</span>}
                    <button
                      onClick={saveDayTimetable}
                      disabled={saving}
                      className="tt-btn"
                      style={{ background: P.purple, color: "#fff", padding: "10px 20px", fontSize: 13.5 }}
                    >
                      <Save size={16} /> {saving ? "Kaydinaya..." : "Kaydi Maalinta"}
                    </button>
                  </div>
                </div>

                <h2 style={{ margin: "0 0 6px" }}>Fasalka: {selectedClass}</h2>
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

                {classTeachers.length === 0 && (
                  <div
                    style={{
                      background: "rgba(245,158,11,0.1)",
                      border: "1px solid rgba(245,158,11,0.35)",
                      color: "#FBBF24",
                      borderRadius: 10,
                      padding: "10px 14px",
                      fontSize: 13,
                      marginBottom: 14,
                    }}
                  >
                    Macalin {activeTypeLabel} ah looma diiwaan gelin Fasalka {selectedClass}. Ku dar Add Teacher, ama ka
                    dooro "Macalimiin kale".
                  </div>
                )}

                {/* Maalmaha */}
                <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
                  {currentDays.map((d) => {
                    const key = `${cleanClassName(selectedClass)}__${d.key}`;
                    const hasData = (timetableDocs[key]?.sessions || []).length > 0;
                    const dayClash = savedClashes.some(
                      (c) => c.day === d.key && (c.a.cls === cleanClassName(selectedClass) || c.b.cls === cleanClassName(selectedClass))
                    );
                    const isActive = d.key === activeDay;
                    return (
                      <button
                        key={d.key}
                        onClick={() => {
                          if (isDirty && !window.confirm("Isbeddelka maalintan lama kaydin. Ma ka tagaysaa?")) return;
                          setActiveDay(d.key);
                        }}
                        style={{
                          padding: "10px 18px",
                          borderRadius: 10,
                          border: dayClash ? `1px solid ${P.red}` : "1px solid transparent",
                          background: isActive ? P.purple : P.panel2,
                          color: "#fff",
                          cursor: "pointer",
                          fontWeight: "bold",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        {DAY_SO[d.key]} <span style={{ opacity: 0.7, fontWeight: 600 }}>({d.label})</span>
                        {dayClash ? <AlertTriangle size={14} color="#fca5a5" /> : hasData ? " •" : ""}
                      </button>
                    );
                  })}
                </div>

                {/* Xiisadaha */}
                <div style={{ background: P.panel, padding: 22, borderRadius: 16, marginBottom: 22 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 10, flexWrap: "wrap" }}>
                    <h3 style={{ margin: 0 }}>
                      Xiisadaha — {DAY_SO[activeDay]} ({activeDay})
                    </h3>
                    <button
                      onClick={addSession}
                      className="tt-btn"
                      style={{ background: "rgba(34,197,94,0.15)", color: P.green, borderColor: P.green }}
                    >
                      <Plus size={14} /> Ku dar Xiisad
                    </button>
                  </div>

                  <div className="tt-scroll">
                    <div style={{ minWidth: 900 }}>
                      <div className="tt-row" style={{ color: P.dim, fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>
                        <div>#</div>
                        <div>Bilow</div>
                        <div>Dhammaad</div>
                        <div>Macalinka</div>
                        <div>Maadada</div>
                        <div />
                      </div>

                      {draftSessions.map((s, idx) => {
                        const t = resolveTeacher(teachers, s);
                        const subs = subjectsForTeacher(t, selectedClass);
                        const subjectOk = !s.subject || subs.some((x) => norm(x) === norm(s.subject));
                        const lostTeacher = !!s.teacherId && !t;
                        const timeBad =
                          s.startTime && s.endTime && toMinutes(s.startTime) >= toMinutes(s.endTime);
                        const clashMsgs = sessionClashMap[idx] || [];

                        return (
                          <div
                            key={s.id || idx}
                            style={{
                              marginBottom: 12,
                              padding: clashMsgs.length ? "10px 10px 8px" : 0,
                              borderRadius: 12,
                              background: clashMsgs.length ? "rgba(239,68,68,0.08)" : "transparent",
                              border: clashMsgs.length ? "1px solid rgba(239,68,68,0.35)" : "1px solid transparent",
                            }}
                          >
                            <div className="tt-row">
                              <div style={{ fontWeight: "bold", color: clashMsgs.length ? "#fca5a5" : P.dim }}>#{idx + 1}</div>
                              <div>
                                <TimePicker12 value={s.startTime || ""} onChange={(val) => updateSession(idx, "startTime", val)} />
                              </div>
                              <div>
                                <TimePicker12 value={s.endTime || ""} onChange={(val) => updateSession(idx, "endTime", val)} />
                              </div>
                              <div>
                                <select
                                  className={"tt-select" + (lostTeacher ? " bad" : "")}
                                  value={t?.id || ""}
                                  onChange={(e) => updateSession(idx, "teacherId", e.target.value)}
                                >
                                  <option value="">{lostTeacher ? "⚠ Macalinkii hore ma jiro — dooro" : "-- Dooro Macalin --"}</option>
                                  {classTeachers.length > 0 && (
                                    <optgroup label={`Macalimiinta Fasalka ${selectedClass}`}>
                                      {classTeachers.map((x) => (
                                        <option key={x.id} value={x.id}>
                                          {x.fullName}
                                        </option>
                                      ))}
                                    </optgroup>
                                  )}
                                  {otherTeachers.length > 0 && (
                                    <optgroup label="Macalimiin kale">
                                      {otherTeachers.map((x) => (
                                        <option key={x.id} value={x.id}>
                                          {x.fullName}
                                        </option>
                                      ))}
                                    </optgroup>
                                  )}
                                </select>
                              </div>
                              <div>
                                <select
                                  className={"tt-select" + (!subjectOk ? " bad" : "")}
                                  value={subjectOk ? subs.find((x) => norm(x) === norm(s.subject)) || "" : s.subject}
                                  disabled={!t}
                                  onChange={(e) => updateSession(idx, "subject", e.target.value)}
                                >
                                  <option value="">{t ? "-- Dooro Maadada --" : "Marka hore dooro macalin"}</option>
                                  {!subjectOk && <option value={s.subject}>⚠ {s.subject} (macalinka kuma qorna)</option>}
                                  {subs.map((x) => (
                                    <option key={x} value={x}>
                                      {x}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <button
                                  onClick={() => removeSession(idx)}
                                  title="Ka saar"
                                  style={{
                                    background: "rgba(239,68,68,0.2)",
                                    color: P.red,
                                    border: "none",
                                    padding: 9,
                                    borderRadius: 8,
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

                            {(timeBad || clashMsgs.length > 0) && (
                              <div style={{ marginLeft: 52, marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                                {timeBad && (
                                  <div style={{ color: "#fca5a5", fontSize: 12.5, fontWeight: 600 }}>
                                    ⚠ Waqtiga dhammaadku waa inuu ka dambeeyaa waqtiga bilowga.
                                  </div>
                                )}
                                {clashMsgs.map((m, i) => (
                                  <div key={i} style={{ color: "#fca5a5", fontSize: 12.5, fontWeight: 600, display: "flex", gap: 6 }}>
                                    <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> Isku dhac: {m}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Muuqaalka warqadda jadwalka */}
                <div style={{ background: P.panel, padding: 18, borderRadius: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                    <div>
                      <h3 style={{ margin: 0 }}>Muuqaalka Jadwalka — Fasalka {selectedClass}</h3>
                      <div style={{ color: P.dim, fontSize: 12.5, marginTop: 3 }}>
                        Sidaan ayaa ardaydu u arkaan oo u soo dejistaan (PDF / sawir).
                        {isDirty && " Isbeddelka aan la kaydin waa ku jiraa muuqaalkan."}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="tt-btn"
                        disabled={exportBusy}
                        onClick={() => setExportJob({ list: [{ cls: selectedClass, type: studentType }], format: "pdf" })}
                        style={{ background: P.purple, color: "#fff" }}
                      >
                        <Download size={14} /> PDF
                      </button>
                      <button
                        className="tt-btn"
                        disabled={exportBusy}
                        onClick={() => setExportJob({ list: [{ cls: selectedClass, type: studentType }], format: "png" })}
                        style={{ background: "rgba(34,197,94,0.15)", color: P.green, borderColor: P.green }}
                      >
                        <ImageIcon size={14} /> Sawir
                      </button>
                    </div>
                  </div>
                  <div style={{ borderRadius: 10, overflow: "hidden" }}>
                    <FitToWidth>
                      <ClassTimetableSheet
                        className={selectedClass}
                        typeLabel={activeTypeLabel}
                        days={currentDays}
                        sessionsByDay={sessionsByDayFor(selectedClass, studentType)}
                        teacherNameOf={teacherNameOf}
                        academicYear={ACADEMIC_YEAR}
                      />
                    </FitToWidth>
                  </div>
                </div>
              </div>
            ) : view === "overview" ? (
              /* ======================== JADWALKA GUUD ======================== */
              <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
                {(() => {
                  const empty = CLASS_ORDER.filter((c) => !classHasData(c));
                  return (
                    empty.length > 0 && (
                      <div style={{ background: P.panel, border: `1px solid ${P.border}`, borderRadius: 14, padding: "12px 16px", color: P.dim, fontSize: 13 }}>
                        Weli jadwal {activeTypeLabel} looma samayn:{" "}
                        {empty.map((c) => (
                          <button
                            key={c}
                            onClick={() => setSelectedClass(c)}
                            style={{
                              margin: "2px 4px",
                              padding: "3px 10px",
                              borderRadius: 999,
                              border: "1px solid rgba(139,108,245,0.35)",
                              background: "transparent",
                              color: "#c4b8f7",
                              cursor: "pointer",
                              fontWeight: 700,
                              fontSize: 12,
                            }}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    )
                  );
                })()}

                {CLASS_ORDER.filter((c) => classHasData(c)).map((cls) => {
                  const n = clashCountByClass[cleanClassName(cls)] || 0;
                  return (
                    <div key={cls} style={{ background: P.panel, borderRadius: 16, padding: 16, border: `1px solid ${n ? "rgba(239,68,68,0.45)" : P.border}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontWeight: 800, fontSize: 16 }}>Fasalka {cls}</span>
                          {n ? (
                            <span style={{ color: "#fca5a5", fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <AlertTriangle size={13} /> {n} isku dhac
                            </span>
                          ) : (
                            <span style={{ color: P.green, fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <CheckCircle2 size={13} /> Sax
                            </span>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="tt-btn" onClick={() => setSelectedClass(cls)} style={{ background: "rgba(139,108,245,0.12)", color: "#c4b8f7", borderColor: "rgba(139,108,245,0.35)" }}>
                            <Pencil size={13} /> Wax ka beddel
                          </button>
                          <button
                            className="tt-btn"
                            disabled={exportBusy}
                            onClick={() => setExportJob({ list: [{ cls, type: studentType }], format: "pdf" })}
                            style={{ background: P.purple, color: "#fff" }}
                          >
                            <Download size={13} /> PDF
                          </button>
                        </div>
                      </div>
                      <div style={{ borderRadius: 10, overflow: "hidden" }}>
                        <FitToWidth>
                          <ClassTimetableSheet
                            className={cls}
                            typeLabel={activeTypeLabel}
                            days={currentDays}
                            sessionsByDay={sessionsByDayFor(cls, studentType)}
                            teacherNameOf={teacherNameOf}
                            academicYear={ACADEMIC_YEAR}
                          />
                        </FitToWidth>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : view === "clashes" ? (
              /* ======================== ISKU DHACYADA ======================== */
              <div style={{ background: P.panel, borderRadius: 16, padding: 20, border: `1px solid ${P.border}` }}>
                {savedClashes.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 10px", color: P.green, fontWeight: 700, fontSize: 15 }}>
                    <CheckCircle2 size={34} style={{ marginBottom: 8 }} />
                    <div>Jadwalka {activeTypeLabel} wax isku dhac ah kuma jiraan.</div>
                  </div>
                ) : (
                  <>
                    <div style={{ color: P.dim, fontSize: 13, marginBottom: 14 }}>
                      {savedClashes.length} isku dhac ayaa jira. Riix "Sax" si aad u furto fasalka iyo maalinta.
                    </div>
                    <div className="tt-scroll">
                      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760, fontSize: 13.5 }}>
                        <thead>
                          <tr style={{ color: P.dim, textAlign: "left" }}>
                            <th style={{ padding: "8px 10px" }}>Maalinta</th>
                            <th style={{ padding: "8px 10px" }}>Nooca</th>
                            <th style={{ padding: "8px 10px" }}>Xiisadda 1aad</th>
                            <th style={{ padding: "8px 10px" }}>Xiisadda 2aad</th>
                            <th style={{ padding: "8px 10px" }} />
                          </tr>
                        </thead>
                        <tbody>
                          {[...savedClashes]
                            .sort(
                              (a, b) =>
                                currentDays.findIndex((d) => d.key === a.day) - currentDays.findIndex((d) => d.key === b.day) ||
                                (toMinutes(a.a.start) || 0) - (toMinutes(b.a.start) || 0)
                            )
                            .map((c) => (
                              <tr key={c.id} style={{ borderTop: "1px solid rgba(139,108,245,0.15)" }}>
                                <td style={{ padding: "10px", fontWeight: 700 }}>{DAY_SO[c.day] || c.day}</td>
                                <td style={{ padding: "10px" }}>
                                  {c.kind === "teacher" ? (
                                    <span style={{ color: "#fca5a5", fontWeight: 700 }}>Macalin: {c.teacherName || c.teacherId}</span>
                                  ) : (
                                    <span style={{ color: "#FBBF24", fontWeight: 700 }}>Fasal gudihiisa</span>
                                  )}
                                </td>
                                {[c.a, c.b].map((x, i) => (
                                  <td key={i} style={{ padding: "10px" }}>
                                    <div style={{ fontWeight: 700 }}>
                                      Fasalka {x.cls} · {fmtRange(x.start, x.end)}
                                    </div>
                                    <div style={{ color: P.dim, fontSize: 12.5 }}>
                                      {x.subject || "—"}
                                      {x.teacherName ? ` · ${x.teacherName}` : ""}
                                    </div>
                                  </td>
                                ))}
                                <td style={{ padding: "10px", whiteSpace: "nowrap" }}>
                                  <button className="tt-btn" onClick={() => openClassDay(c.a.cls, c.day)} style={{ background: P.purple, color: "#fff" }}>
                                    <Pencil size={13} /> Sax ({c.a.cls})
                                  </button>
                                  {c.b.cls !== c.a.cls && (
                                    <button
                                      className="tt-btn"
                                      onClick={() => openClassDay(c.b.cls, c.day)}
                                      style={{ background: "transparent", color: "#c4b8f7", borderColor: "rgba(139,108,245,0.35)", marginLeft: 6 }}
                                    >
                                      ({c.b.cls})
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            ) : (
              /* ======================== FASALLADA ======================== */
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
                {CLASS_ORDER.map((cls) => {
                  const c = cleanClassName(cls);
                  let totalSessions = 0;
                  let totalDays = 0;
                  currentDays.forEach((d) => {
                    const n = (timetableDocs[`${c}__${d.key}`]?.sessions || []).length;
                    totalSessions += n;
                    if (n) totalDays += 1;
                  });
                  const clashes = clashCountByClass[c] || 0;

                  return (
                    <button
                      key={cls}
                      onClick={() => setSelectedClass(cls)}
                      style={{
                        background: P.panel,
                        border: `1px solid ${clashes ? "rgba(239,68,68,0.5)" : P.border}`,
                        borderRadius: 16,
                        padding: 20,
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
                            background: P.green,
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
                          <div style={{ fontSize: 12, color: P.dim }}>
                            {totalDays} / {currentDays.length} maalmood oo la sameeyay
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12, color: "#c4b8f7", background: "rgba(139,108,245,0.1)", padding: "6px 10px", borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <Clock size={12} /> {totalSessions} Xiisadood
                        </span>
                        {totalSessions > 0 &&
                          (clashes ? (
                            <span style={{ fontSize: 12, color: "#fca5a5", background: "rgba(239,68,68,0.12)", padding: "6px 10px", borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 700 }}>
                              <AlertTriangle size={12} /> {clashes} isku dhac
                            </span>
                          ) : (
                            <span style={{ fontSize: 12, color: P.green, background: "rgba(34,197,94,0.12)", padding: "6px 10px", borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 700 }}>
                              <CheckCircle2 size={12} /> Sax
                            </span>
                          ))}
                      </div>
                    </button>
                  );
                })}
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
          onClose={() => !exportBusy && setPrintModalOpen(false)}
          onPdf={() => selectedForPrint.length && setExportJob({ list: selectedForPrint, format: "pdf" })}
          busy={exportBusy}
        />
      )}

      {/* Warqadaha la soo dejinayo — meel aan la arkin, cabbirkooda buuxa */}
      {exportJob && (
        <div aria-hidden="true" style={{ position: "fixed", left: -30000, top: 0, pointerEvents: "none" }}>
          {exportJob.list.map(({ cls, type }) => (
            <ClassTimetableSheet
              key={`${type}_${cls}`}
              id={`tt-export-${type}-${cleanClassName(cls)}`}
              className={cls}
              typeLabel={STUDENT_TYPES.find((t) => t.key === type)?.label || "Full Time"}
              days={DAYS_BY_TYPE[type] || FULLTIME_DAYS}
              sessionsByDay={sessionsByDayFor(cls, type)}
              teacherNameOf={teacherNameOf}
              academicYear={ACADEMIC_YEAR}
            />
          ))}
        </div>
      )}
    </>
  );
}