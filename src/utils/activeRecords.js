// src/utils/activeRecords.js
//
// HAL MEEL oo go'aamisa:
//   1) Arday / macalin "la tirtiray" (pendingDeletion, Recycle Bin, ...) —
//      MARNABA meelna kama muuqdo ilaa laga soo celiyo.
//   2) Arday labanlaab ah (laba jeer la diiwaan geliyay, fasallo kala duwan) —
//      hal mar oo keliya ayuu ka muuqdaa, fasalkiisa saxda ah.
//
// Bog kasta (Admin, Cashier, Teacher) wuxuu isticmaalaa isla shuruucdan,
// sidaas arday ama macalin ma kala duwanaan karo bog iyo bog kale.

import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/firebase";

// ---------------------------------------------------------------------------
// 1) LA TIRTIRAY?
// ---------------------------------------------------------------------------
const REMOVED_STATUSES = new Set([
  "deleted",
  "removed",
  "recycled",
  "trashed",
  "pending deletion",
  "pendingdeletion",
]);

// true  -> ha muujin meelna (waa la tirtiray ama wuxuu ku jiraa Recycle Bin)
// false -> waa firfircoon
export function isRemoved(r) {
  if (!r) return true;
  if (
    r.pendingDeletion === true ||
    r.deleted === true ||
    r.isDeleted === true ||
    r.inRecycleBin === true ||
    r.recycled === true ||
    r.trashed === true
  ) {
    return true;
  }
  const st = String(r.status || "").trim().toLowerCase();
  return REMOVED_STATUSES.has(st);
}

export const isActive = (r) => !isRemoved(r);

// ---------------------------------------------------------------------------
// 2) LABANLAAB (DUPLICATES)
// ---------------------------------------------------------------------------
export const normalizeName = (n) => String(n || "").trim().replace(/\s+/g, " ").toLowerCase();

export const recordKey = (s) => `${s.collection}/${s.id}`;

const photoOf = (s) => String(s?.studentPhoto || s?.photoURL || s?.photoUrl || "").trim();

function completeness(s) {
  return (
    ["motherName", "parentPhone", "studentPhone", "district", "shift", "previousSchool"].filter(
      (k) => s[k]
    ).length + (photoOf(s) ? 2 : 0)
  );
}

function tsOf(v) {
  if (!v) return 0;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v.seconds === "number") return v.seconds * 1000;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
}
const recencyOf = (s) => Math.max(tsOf(s.updatedAt), tsOf(s.createdAt));

export function idCompare(a, b) {
  return String(a.studentId || a.id).localeCompare(String(b.studentId || b.id), undefined, {
    numeric: true,
  });
}

// duplicateOf waxaa lagu qoraa doc-ga labanlaabka ("students/0003").
// Marka la qoro, ardaygaas wuxuu noqdaa labanlaab joogto ah — xitaa haddii
// magaca kan asalka ah la beddelo.
function dupTargetKey(s) {
  const v = s.duplicateOf;
  if (!v) return "";
  if (typeof v === "string") return v.includes("/") ? v : "";
  if (v.collection && v.id) return `${v.collection}/${v.id}`;
  return "";
}

// Isku qof ma yihiin? (magac isku mid, ama mid bilowga kan kale)
export function isSamePerson(a, b) {
  const n = normalizeName(a.fullName);
  const kn = normalizeName(b.fullName);
  if (!n || !kn) return false;

  const ma = normalizeName(a.motherName);
  const mb = normalizeName(b.motherName);
  const mothersDiffer = ma && mb && ma !== mb;

  if (n === kn) return !mothersDiffer;

  // "Ilwaad Xasan Maxamed" iyo "Ilwaad Xasan Maxamed Cabdulaahi" —
  // kaliya haddii magaca gaaban uu yahay 3 eray ama ka badan, oo ay isku
  // fasal yihiin ama isku hooyo.
  const shorter = n.length < kn.length ? n : kn;
  const isPrefix = kn.startsWith(n + " ") || n.startsWith(kn + " ");
  if (!isPrefix || shorter.split(" ").length < 3) return false;
  if (mothersDiffer) return false;
  const sameClass = String(a.className || "") === String(b.className || "");
  const sameMother = ma && mb && ma === mb;
  return sameClass || sameMother;
}

// Wuxuu soo celinayaa { kept, hidden }.
//   kept   -> arday kasta hal mar (kan xogta ugu buuxda leh)
//   hidden -> labanlaabyada; mid kasta wuxuu leeyahay duplicateOfId,
//             duplicateOfCollection iyo duplicateOfKey
// existingKeys: dhammaan doc-yada jira (xitaa kuwa la tirtiray) — si
// labanlaab ku xiran arday ku jira Recycle Bin uusan dib ugu soo noqon.
export function dedupeStudents(list, existingKeys) {
  const keys = existingKeys || new Set(list.map(recordKey));
  const linkedHidden = [];
  const candidates = [];

  for (const s of list) {
    const target = dupTargetKey(s);
    if (target && target !== recordKey(s) && keys.has(target)) {
      const [col, ...rest] = target.split("/");
      linkedHidden.push({
        ...s,
        duplicateOfKey: target,
        duplicateOfCollection: col,
        duplicateOfId: rest.join("/"),
      });
    } else {
      candidates.push(s);
    }
  }

  const sorted = [...candidates].sort(
    (a, b) => completeness(b) - completeness(a) || recencyOf(b) - recencyOf(a) || idCompare(a, b)
  );

  const kept = [];
  const hidden = [];
  for (const s of sorted) {
    const dup = kept.find((k) => isSamePerson(s, k));
    if (dup) {
      hidden.push({
        ...s,
        duplicateOfKey: recordKey(dup),
        duplicateOfCollection: dup.collection,
        duplicateOfId: dup.id,
      });
    } else {
      kept.push(s);
    }
  }

  return { kept, hidden: [...linkedHidden, ...hidden] };
}

// ---------------------------------------------------------------------------
// 3) SOO QAADIS
// ---------------------------------------------------------------------------

// Dhammaan ardayda (Full Time + Part Time), xitaa kuwa la tirtiray.
export async function loadAllStudentsRaw() {
  const [fullSnap, partSnap] = await Promise.all([
    getDocs(collection(db, "students")),
    getDocs(collection(db, "partTimeStudents")),
  ]);
  return [
    ...fullSnap.docs.map((d) => ({
      id: d.id,
      collection: "students",
      studentType: d.data().studentType || "Full Time",
      ...d.data(),
    })),
    ...partSnap.docs.map((d) => ({
      id: d.id,
      collection: "partTimeStudents",
      studentType: d.data().studentType || "Part Time",
      ...d.data(),
    })),
  ];
}

// Liis buuxa -> { students, duplicates, removed, all }
//   students   -> ardayda la muujinayo (firfircoon, labanlaab la'aan)
//   duplicates -> labanlaabyada la qariyay
//   removed    -> ardayda la tirtiray / Recycle Bin
export function splitStudents(raw) {
  const keys = new Set(raw.map(recordKey));
  const active = raw.filter((s) => !isRemoved(s));
  const removed = raw.filter(isRemoved);
  const { kept, hidden } = dedupeStudents(active, keys);
  return { students: kept, duplicates: hidden, removed, all: raw };
}

export async function loadActiveStudents() {
  return splitStudents(await loadAllStudentsRaw());
}

// Hubi magaca ka hor diiwaan-gelinta / wax ka beddelka.
// Wuxuu soo celinayaa { active, removed } — arday hore u jira (haddii uu jiro).
export function findSameStudent(raw, candidate, excludeKey = "") {
  const others = raw.filter((s) => recordKey(s) !== excludeKey);
  const exact = (s) =>
    normalizeName(s.fullName) === normalizeName(candidate.fullName) && isSamePerson(candidate, s);
  return {
    active: others.find((s) => !isRemoved(s) && exact(s)) || null,
    removed: others.find((s) => isRemoved(s) && exact(s)) || null,
  };
}

// Macallimiinta firfircoon (kuwa la tirtiray / Recycle Bin laga saaray).
export async function loadActiveTeachers() {
  const snap = await getDocs(collection(db, "teachers"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((t) => !isRemoved(t));
}