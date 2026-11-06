// src/utils/timetableUtils.js
//
// Waxyaabaha ay wadaagaan:
//   - src/admin/pages/Timetable.jsx        (maamulka: samee / daawo / isku dhac)
//   - src/admin/components/ClassTimetableSheet.jsx (warqadda jadwalka)
//   - src/student/Dashboard.jsx            (ardayga: eeg + soo deji)

export const FULLTIME_DAYS = [
  { key: "Saturday", label: "Saturday", so: "Sabti" },
  { key: "Sunday", label: "Sunday", so: "Axad" },
  { key: "Monday", label: "Monday", so: "Isniin" },
  { key: "Tuesday", label: "Tuesday", so: "Talaado" },
  { key: "Wednesday", label: "Wednesday", so: "Arbaco" },
];

export const PARTTIME_DAYS = [
  { key: "Thursday", label: "Thursday", so: "Khamiis" },
  { key: "Friday", label: "Friday", so: "Jimce" },
];

export const DAY_SO = {
  Saturday: "Sabti",
  Sunday: "Axad",
  Monday: "Isniin",
  Tuesday: "Talaado",
  Wednesday: "Arbaco",
  Thursday: "Khamiis",
  Friday: "Jimce",
};

export const CLASS_ORDER = ["1", "2", "3", "4", "5", "6", "7", "8", "F1", "F2", "F3", "F4"];

export function cleanClassName(val) {
  if (!val) return "";
  return String(val)
    .trim()
    .replace(/FASALKA\s*/gi, "")
    .replace(/CLASS\s*/gi, "")
    .trim()
    .toUpperCase();
}

// Sannad-dugsiyeedka hadda: Sebtember ilaa Ogosto, tusaale "2026/2027"
export function currentAcademicYear(date = new Date()) {
  const y = date.getFullYear();
  return date.getMonth() >= 8 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
}

export const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

// "13:45" -> 825 (daqiiqo). Waqti khaldan -> null
export function toMinutes(t) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t || ""));
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

// "13:45" -> "01:45"  (12-saac, bilaa AM/PM)
export function fmt12(t) {
  const mins = toMinutes(t);
  if (mins === null) return "—";
  let h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  h = h % 12 === 0 ? 12 : h % 12;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function ampm(t) {
  const mins = toMinutes(t);
  if (mins === null) return "";
  return Math.floor(mins / 60) % 24 < 12 ? "AM" : "PM";
}

// "08:00 – 08:45 AM"
export function fmtRange(start, end) {
  if (!start && !end) return "";
  return `${fmt12(start)} – ${fmt12(end)} ${ampm(end || start)}`.trim();
}

export function sortSessions(sessions) {
  return [...(sessions || [])].sort(
    (a, b) => (toMinutes(a.startTime) ?? 9999) - (toMinutes(b.startTime) ?? 9999)
  );
}

// Nooca maadada -> calaamadda warqadda jadwalka
export function subjectKind(subject) {
  const s = norm(subject);
  if (!s) return "book";
  if (/(tarbi|islam|quraan|qur'aan|diin|fiqh)/.test(s)) return "islamic";
  if (/(carab|arab|afcarab)/.test(s)) return "arabic";
  if (/(english|ingiriis|ingriis)/.test(s)) return "english";
  if (/(somali|soomaali|af-?soomaali|afsoomaali)/.test(s)) return "somali";
  if (/(xisaab|math|maths|mathematics)/.test(s)) return "math";
  if (/(say|scien|cilmi ?bil|bio|chem|kimi|fiis|phys|bayoloji)/.test(s)) return "science";
  if (/(cilmi ?bul|social|bulsho|taariikh|history|juqraaf|geograph)/.test(s)) return "social";
  if (/(tech|tekno|ict|comput|kombi)/.test(s)) return "tech";
  return "book";
}

// ---------------------------------------------------------------------------
// Macalimiinta: kuwa jira oo keliya, iyo maadooyinka ay ku qoran yihiin
// ---------------------------------------------------------------------------

export function normalizeTypes(employmentType) {
  if (Array.isArray(employmentType)) return employmentType;
  if (typeof employmentType === "string" && employmentType) return [employmentType];
  return [];
}

// Macalinku ma u shaqeeyaa noocan (fulltime / parttime)?
// Haddii aan nooc loo dhigin, waa la oggol yahay.
export function teacherFitsType(teacher, typeKey) {
  const types = normalizeTypes(teacher?.employmentType);
  if (types.length === 0) return true;
  return typeKey === "parttime" ? types.includes("Part Time") : types.includes("Full Time");
}

export function teacherTeachesClass(teacher, cls) {
  const c = cleanClassName(cls);
  return (teacher?.classes || []).some((b) => cleanClassName(b?.className) === c);
}

// Maadooyinka macalinku ku qoran yahay fasalkan. Haddii fasalkan aan
// loogu qorin, waxaa la soo celinayaa dhammaan maadooyinkiisa.
export function subjectsForTeacher(teacher, cls) {
  if (!teacher) return [];
  const c = cleanClassName(cls);
  const blocks = Array.isArray(teacher.classes) ? teacher.classes : [];
  const forClass = blocks
    .filter((b) => cleanClassName(b?.className) === c)
    .map((b) => String(b?.subject || "").trim())
    .filter(Boolean);
  const pool = forClass.length
    ? forClass
    : [
        ...(Array.isArray(teacher.subjects) ? teacher.subjects : []),
        ...blocks.map((b) => b?.subject),
      ]
        .map((s) => String(s || "").trim())
        .filter(Boolean);
  const seen = new Map();
  pool.forEach((s) => {
    const k = norm(s);
    if (!seen.has(k)) seen.set(k, s);
  });
  return [...seen.values()];
}

// Macalinka xiisadda (kaliya kuwa firfircoon)
export function resolveTeacher(teachers, s) {
  if (!s) return null;
  const key = s.teacherId || "";
  if (key) return teachers.find((t) => t.id === key || t.username === key) || null;
  if (s.teacherName) return teachers.find((t) => t.fullName === s.teacherName) || null;
  return null;
}

// ---------------------------------------------------------------------------
// Isku dhac (clash) — isla macalin, isla maalin, waqti isku dhacaya
// ---------------------------------------------------------------------------
//
// docs: { "4__Saturday": { className, day, sessions: [...] }, ... }
// Waxay soo celisaa liis:
//   { id, kind: "teacher" | "class", day, teacherId, teacherName,
//     a: { cls, idx, start, end, subject }, b: {...} }
// kind "class"  = isla fasal, laba xiisadood oo waqtigoodu isku dhacayo
// kind "teacher"= isla macalin, laba fasal oo kala duwan isla waqtiga

function overlaps(a, b) {
  return a.s !== null && a.e !== null && b.s !== null && b.e !== null && a.s < b.e && b.s < a.e;
}

export function detectClashes(docs, teachers = []) {
  const byDay = {};
  Object.values(docs || {}).forEach((d) => {
    const cls = cleanClassName(d.className);
    const day = d.day;
    if (!cls || !day) return;
    (d.sessions || []).forEach((s, idx) => {
      const t = resolveTeacher(teachers, s);
      byDay[day] = byDay[day] || [];
      byDay[day].push({
        cls,
        idx,
        id: s.id || `${cls}_${idx}`,
        s: toMinutes(s.startTime),
        e: toMinutes(s.endTime),
        start: s.startTime,
        end: s.endTime,
        subject: s.subject || "",
        teacherId: t ? t.id : s.teacherId || "",
        teacherName: t ? t.fullName : s.teacherName || "",
      });
    });
  });

  const out = [];
  Object.entries(byDay).forEach(([day, list]) => {
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        if (!overlaps(a, b)) continue;
        if (a.cls === b.cls) {
          out.push({
            id: `class|${day}|${a.cls}|${a.id}|${b.id}`,
            kind: "class",
            day,
            teacherId: "",
            teacherName: "",
            a,
            b,
          });
        } else if (a.teacherId && a.teacherId === b.teacherId) {
          out.push({
            id: `teacher|${day}|${a.teacherId}|${a.cls}|${a.id}|${b.cls}|${b.id}`,
            kind: "teacher",
            day,
            teacherId: a.teacherId,
            teacherName: a.teacherName || b.teacherName,
            a,
            b,
          });
        }
      }
    }
  });
  return out;
}

// Isku dhacyada ku saabsan hal fasal + maalin -> { [sessionIdx]: [qoraal, ...] }
export function clashesForClassDay(clashes, cls, day) {
  const c = cleanClassName(cls);
  const map = {};
  const push = (idx, msg) => {
    map[idx] = map[idx] || [];
    map[idx].push(msg);
  };
  clashes
    .filter((x) => x.day === day && (x.a.cls === c || x.b.cls === c))
    .forEach((x) => {
      if (x.kind === "class") {
        push(x.a.idx, `Waqtigu wuxuu ku dhacayaa xiisadda #${x.b.idx + 1} ee fasalkan`);
        push(x.b.idx, `Waqtigu wuxuu ku dhacayaa xiisadda #${x.a.idx + 1} ee fasalkan`);
      } else {
        const mine = x.a.cls === c ? x.a : x.b;
        const other = x.a.cls === c ? x.b : x.a;
        push(
          mine.idx,
          `${x.teacherName || "Macalinkan"} isla waqtigan wuxuu ku jiraa Fasalka ${other.cls} (${fmtRange(
            other.start,
            other.end
          )}${other.subject ? ` · ${other.subject}` : ""})`
        );
      }
    });
  return map;
}