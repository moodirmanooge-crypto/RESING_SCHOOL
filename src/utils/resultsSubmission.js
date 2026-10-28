// src/utils/resultsSubmission.js
//
// Xeerarka gudbinta natiijada (Results Submission) ee ay wadaagaan:
//   - src/teacher/Results.jsx          (macalinka)
//   - src/admin/pages/ResultsSubmission.jsx (maamulka)
//   - src/admin/pages/ResultsByClass.jsx
//
// Firestore:
//   resultsWindow/{examTypeKey}     -> { startAt, endAt, startLocal, endLocal, examType }
//   resultsPermissions/{permId}     -> { allowed, used, reason: "update"|"late", ... }
//   adminResultsIndex/{class_examId}-> gudbin kasta (teacherId, className, subject, examTypeKey ...)

export const EXAM_TYPES = [
  { key: "monthly1", label: "Monthly One" },
  { key: "midterm", label: "Term" },
  { key: "monthly2", label: "Monthly Two" },
  { key: "final", label: "Final" },
];

const LABEL_TO_KEY = {
  "monthly one": "monthly1",
  "monthly 1": "monthly1",
  monthly1: "monthly1",
  term: "midterm",
  "mid term": "midterm",
  midterm: "midterm",
  "monthly two": "monthly2",
  "monthly 2": "monthly2",
  monthly2: "monthly2",
  final: "final",
};

export function examTypeKeyOf(type) {
  const t = String(type || "").trim().toLowerCase();
  if (!t) return "final";
  return LABEL_TO_KEY[t] || t.replace(/\s+/g, "");
}

export function examTypeLabelOf(key) {
  return EXAM_TYPES.find((e) => e.key === key)?.label || key;
}

export const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

// Fasaxa maamulku siiyo macalin: hal imtixaan + fasal + maado
export function permissionId(examTypeKey, teacherId, className, subject) {
  const safe = (s) => String(s || "").trim().replace(/\//g, "-");
  return `${examTypeKey}__${safe(teacherId)}__${safe(className).toUpperCase()}__${safe(norm(subject || "General"))}`;
}

export function toDateSafe(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (typeof value?.seconds === "number") return new Date(value.seconds * 1000);
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

// "unset" | "upcoming" | "open" | "closed"
export function windowState(win, now = new Date()) {
  const start = toDateSafe(win?.startAt);
  const end = toDateSafe(win?.endAt);
  if (!start || !end) return "unset";
  if (now < start) return "upcoming";
  if (now > end) return "closed";
  return "open";
}

export function formatDT(value) {
  const d = toDateSafe(value);
  if (!d) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Date -> "YYYY-MM-DDTHH:mm" (datetime-local input)
export function toLocalInput(value) {
  const d = toDateSafe(value);
  if (!d) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

// Xaaladda macalinka ee hal imtixaan.
// Fasax firfircoon (allowed && !used) ayaa ka horreeya wax kasta.
export function submissionStatus({ win, permission, submitted, now = new Date() }) {
  const permActive = Boolean(permission && permission.allowed && !permission.used);
  if (permActive) {
    return submitted
      ? {
          canEdit: true,
          code: "update",
          tone: "info",
          text: "Maamulku wuxuu kuu fasaxay inaad wax ka beddesho natiijadan. Marka aad mar kale gudbiso, waa la xiri doonaa.",
        }
      : {
          canEdit: true,
          code: "late",
          tone: "info",
          text: "Maamulku wuxuu kuu fasaxay gudbin daahday. Marka aad gudbiso, waa la xiri doonaa.",
        };
  }
  if (submitted) {
    return {
      canEdit: false,
      code: "locked",
      tone: "success",
      text: "Natiijadan waa la gudbiyay. Wax kama beddeli kartid ilaa maamulku kuu fasaxo update.",
    };
  }
  const ws = windowState(win, now);
  if (ws === "open") {
    return {
      canEdit: true,
      code: "open",
      tone: "success",
      text: `Waqtiga gudbinta waa furan yahay — wuxuu xirmayaa ${formatDT(win.endAt)}.`,
    };
  }
  if (ws === "upcoming") {
    return {
      canEdit: false,
      code: "upcoming",
      tone: "warn",
      text: `Weli lama gaarin waqtiga gudbinta. Wuxuu furmayaa ${formatDT(win.startAt)}. Hadda natiijo ma gelin kartid.`,
    };
  }
  if (ws === "closed") {
    return {
      canEdit: false,
      code: "closed",
      tone: "danger",
      text: `Waqtiga gudbinta wuu dhammaaday (${formatDT(win.endAt)}). Ma gudbin kartid ilaa maamulku kuu fasaxo.`,
    };
  }
  return {
    canEdit: false,
    code: "unset",
    tone: "warn",
    text: "Maamulku weli ma dhigin waqtiga gudbinta natiijada imtixaankan.",
  };
}