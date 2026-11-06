// src/utils/resultsAccess.js
//
// Maamulku wuxuu go'aamiyaa goorta ardaydu arki karaan natiijada imtixaanka
// (bogga Academics). Xogtu waxay ku jirtaa hal doc:
//
//   settings/resultsAccess = {
//     isOpen:   true | false     // furaha guud (Fur / Xir)
//     openAt:   "2026-11-05T08:00" | ""   // ikhtiyaari: ka hor waqtigan waa xiran
//     closeAt:  "2026-11-10T18:00" | ""   // ikhtiyaari: kadib waqtigan si toos ah ayuu u xirmayaa
//     examLabel: "Monthly Two"            // ikhtiyaari: ardayda loo sheego
//     message:  "..."                     // fariinta ardayda marka uu xiran yahay
//     updatedAt, updatedBy
//   }
//
// Haddii doc-gu aanu jirin, natiijadu waa XIRAN tahay ilaa maamulku furo.

import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";

export const resultsAccessRef = () => doc(db, "settings", "resultsAccess");

export const DEFAULT_RESULTS_ACCESS = {
  isOpen: false,
  openAt: "",
  closeAt: "",
  examLabel: "",
  message: "",
};

function toMs(v) {
  if (!v) return 0;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v.seconds === "number") return v.seconds * 1000;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
}

// Xaaladda dhabta ah hadda: { open, reason, opensAt, closesAt }
//   reason: "open" | "off" | "notYet" | "ended"
export function resultsAccessState(cfg, now = Date.now()) {
  const c = { ...DEFAULT_RESULTS_ACCESS, ...(cfg || {}) };
  const openAt = toMs(c.openAt);
  const closeAt = toMs(c.closeAt);
  if (!c.isOpen) return { open: false, reason: "off", opensAt: 0, closesAt: 0 };
  if (openAt && now < openAt) return { open: false, reason: "notYet", opensAt: openAt, closesAt: closeAt };
  if (closeAt && now >= closeAt) return { open: false, reason: "ended", opensAt: openAt, closesAt: closeAt };
  return { open: true, reason: "open", opensAt: openAt, closesAt: closeAt };
}

// La soco isbeddelka (live). Wuxuu soo celinayaa unsubscribe.
export function subscribeResultsAccess(cb) {
  return onSnapshot(
    resultsAccessRef(),
    (snap) => cb(snap.exists() ? { ...DEFAULT_RESULTS_ACCESS, ...snap.data() } : { ...DEFAULT_RESULTS_ACCESS }),
    (err) => {
      console.warn("resultsAccess:", err);
      cb({ ...DEFAULT_RESULTS_ACCESS });
    }
  );
}

// Hal mar ka akhri server-ka (hubin ka hor inta aan natiijada la muujin).
export async function fetchResultsAccess() {
  const snap = await getDoc(resultsAccessRef());
  return snap.exists() ? { ...DEFAULT_RESULTS_ACCESS, ...snap.data() } : { ...DEFAULT_RESULTS_ACCESS };
}

export async function saveResultsAccess(patch, actor = "") {
  await setDoc(
    resultsAccessRef(),
    { ...patch, updatedAt: new Date(), updatedBy: actor || "" },
    { merge: true }
  );
}

export function formatAccessTime(ms) {
  if (!ms) return "";
  return new Date(ms).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}