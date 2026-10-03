// src/utils/feeLedger.js
//
// Hal meel oo keliya oo laga xisaabiyo lacagaha ardayda — Cashier (Classes,
// Dashboard, Payments, Reports, Receipts) iyo Admin (Dashboard, Reports,
// Receipts) dhammaantood halkan ayay ka akhriyaan, si labada dhinac ay u
// arkaan isla tirooyin sax ah.
//
// XEERARKA:
//  1. Ardayda la tixgelinayo: collection-ka "students" + "partTimeStudents"
//     (aan pendingDeletion ahayn). Ardayda "Free" ah lagama qaado lacag,
//     marnaba laguma daro xisaabinta.
//  2. Lacagta bil kasta: collection-ka "payments" (hal doc arday+bil kasta:
//     `${studentId}_${YYYY-MM}`) — waa isha runta ah, mana labanlaabmaan.
//  3. Bil waxaa loo tiriyaa "la bixiyay" KALIYA haddii uu jiro rasiid
//     (collection "receipts") oo daboolaya bishaas. Haddii rasiidka la
//     tirtiray, lacagtaas lama soo akhrinayo (lacag aan jirin ma soo baxdo).
//  4. Rasiidyo labanlaaban (bug-gii hore ee ReceiptModal oo rasiid labaad
//     sameyn jiray) waa la iska indho-tiraa, backend-kana waa laga tirtiraa.
//  5. BILOW CUSUB (LEDGER_START): wax kasta oo lacag ah oo ka horreeya
//     waqtigan (rasiid, payments, credit) lama soo akhrinayo — Today's
//     Collection, Monthly, Paid, Reports dhammaan waxay ka bilaabmaan 0.
//     Xogtii hore lama tirtirin; Firestore-ka way ku jirtaa, kaliya lama
//     xisaabinayo. Haddii aad mar kale rabto bilow cusub, beddel waqtigan.

import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import { moveToRecycleBin, currentActor } from "./recycleBin.js";

export const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

const pad2 = (n) => String(n).padStart(2, "0");

// Waqtiga nidaamka lacagaha uu ka bilaabmayo (Muqdisho, UTC+3).
export const LEDGER_START = new Date("2026-10-03T15:45:00+03:00");
export const LEDGER_START_SECONDS = Math.floor(LEDGER_START.getTime() / 1000);

// Bisha hadda (waqtiga maxaliga ah — Soomaaliya UTC+3), ma aha UTC.
export function localMonthKey(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

export function monthKeyAdd(key, n) {
  const [y, m] = String(key).split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return localMonthKey(d);
}

export function monthKeyLabel(key) {
  if (!key) return "—";
  const [y, m] = String(key).split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function toDateValue(v) {
  if (!v) return null;
  if (typeof v.toDate === "function") return v.toDate();
  if (v.seconds !== undefined) return new Date(v.seconds * 1000);
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export function tsSeconds(v) {
  const d = toDateValue(v);
  return d ? Math.floor(d.getTime() / 1000) : 0;
}

// Bisha ugu horreysa ee lacag laga qaadi karo (bilowga cusub)
export function ledgerStartMonthKey() {
  return localMonthKey(LEDGER_START);
}

// Waqtiga rasiidka: createdAt (server) ama paidAt (marka server-ku weli
// uusan soo celin createdAt)
export function receiptSeconds(r) {
  return tsSeconds(r?.createdAt) || tsSeconds(r?.paidAt);
}

export function isAfterLedgerStart(r) {
  return receiptSeconds(r) >= LEDGER_START_SECONDS;
}

export function isTodayValue(v) {
  const d = toDateValue(v);
  if (!d) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function isFreeFeeType(v) {
  return String(v || "").trim().toLowerCase() === "free";
}

// Fasalka saxda ah (Full Time / "X Part Time")
export function normalizeClassName(student) {
  const rawClass = String(student.className || "").trim();
  if (!rawClass) return "Unknown";

  const isPartTime =
    student.isPartTime === true ||
    student.studyType === "Part Time" ||
    student.sourceCollection === "partTimeStudents" ||
    rawClass.toLowerCase().includes("part time");

  const cleanBase = rawClass.replace(/part\s*time/i, "").trim();
  return isPartTime ? `${cleanBase} Part Time` : cleanBase;
}

// Bilaha (YYYY-MM) uu rasiid daboolayo. Rasiidyada cusub waxay leeyihiin
// "monthBreakdown"; kuwa hore waxaa laga akhriyaa qoraalka monthLabel, sida:
//   "October 2026"
//   "October and November 2026 (2 Months)"
//   "November, December, and January 2027 (3 Months)"
export function receiptMonthKeys(r) {
  const breakdown = Array.isArray(r?.monthBreakdown) ? r.monthBreakdown : [];
  if (breakdown.length > 0) {
    return breakdown.map((m) => m && m.monthKey).filter(Boolean);
  }

  const label = String(r?.monthLabel || "").toLowerCase();
  if (!label) return [];

  const yearMatches = label.match(/\b(19|20)\d{2}\b/g);
  if (!yearMatches) return [];
  let year = Number(yearMatches[yearMatches.length - 1]);

  const re = new RegExp(`\\b(${MONTH_NAMES.join("|")})\\b`, "g");
  const idxs = [];
  let m;
  while ((m = re.exec(label)) !== null) {
    idxs.push(MONTH_NAMES.indexOf(m[1]));
  }
  if (idxs.length === 0) return [];

  // Dib ayaa looga socdaa: haddii bishii hore ay ka weyn tahay tan ku xigta
  // (tusaale December -> January), sannadkii hore ayay ahayd.
  const keys = [];
  for (let i = idxs.length - 1; i >= 0; i--) {
    if (i < idxs.length - 1 && idxs[i] > idxs[i + 1]) year -= 1;
    keys.unshift(`${year}-${pad2(idxs[i] + 1)}`);
  }
  return keys;
}

// Rasiidyo labanlaaban: isla arday, isla lacag, isla monthLabel, oo la
// sameeyay 10 daqiiqo gudahood. Kan la hayo: kan leh monthBreakdown, haddii
// kale kan ugu horreeya.
export function splitDuplicateReceipts(receipts) {
  const groups = {};
  receipts.forEach((r) => {
    const k = `${r.studentId}|${Number(r.paidAmount) || 0}|${String(r.monthLabel || "").trim().toLowerCase()}`;
    if (!groups[k]) groups[k] = [];
    groups[k].push(r);
  });

  const kept = [];
  const duplicates = [];

  Object.values(groups).forEach((list) => {
    if (list.length === 1) {
      kept.push(list[0]);
      return;
    }
    const sorted = [...list].sort((a, b) => {
      const ta = tsSeconds(a.createdAt) || tsSeconds(a.paidAt);
      const tb = tsSeconds(b.createdAt) || tsSeconds(b.paidAt);
      return ta - tb;
    });

    const clusters = [];
    sorted.forEach((r) => {
      const t = tsSeconds(r.createdAt) || tsSeconds(r.paidAt);
      const last = clusters[clusters.length - 1];
      if (last && t && last.t && Math.abs(t - last.t) <= 600) {
        last.items.push(r);
      } else {
        clusters.push({ t, items: [r] });
      }
    });

    clusters.forEach(({ items }) => {
      if (items.length === 1) {
        kept.push(items[0]);
        return;
      }
      const withBreakdown = items.find(
        (x) => Array.isArray(x.monthBreakdown) && x.monthBreakdown.length > 0
      );
      const keep = withBreakdown || items[0];
      kept.push(keep);
      items.forEach((x) => {
        if (x !== keep) duplicates.push(x);
      });
    });
  });

  return { kept, duplicates };
}

// Dhisidda ledger-ka oo dhan. Input: liisas {id, ...data} ah.
export function buildFeeLedger({
  students = [],
  partTimeStudents = [],
  cashier = [],
  payments = [],
  receipts = [],
}) {
  // 1. Cashier docs (doc id = studentId)
  const cashierBySid = {};
  cashier.forEach((c) => {
    const sid = c.studentId || c.id;
    if (sid) cashierBySid[sid] = c;
  });

  // 2. Ardayda (students + partTimeStudents)
  const mainBySid = {};
  students.forEach((s) => {
    const sid = s.studentId || s.id;
    if (sid) mainBySid[sid] = { ...s, sourceCollection: "students" };
  });
  partTimeStudents.forEach((s) => {
    const sid = s.studentId || s.id;
    if (sid) mainBySid[sid] = { ...s, isPartTime: true, sourceCollection: "partTimeStudents" };
  });

  const allStudents = [];
  Object.entries(mainBySid).forEach(([sid, main]) => {
    if (main.pendingDeletion) return;
    if (!String(sid).trim()) return;

    const c = cashierBySid[sid] || {};
    const fullName = main.fullName || c.studentName || c.fullName || "";
    if (!String(fullName).trim()) return;

    const isFree = isFreeFeeType(main.feeType);
    // Credit-ka hore (ka hor bilowga cusub) lama tiriyo
    const creditIsCurrent = tsSeconds(c.creditUpdatedAt) >= LEDGER_START_SECONDS;
    const rawFee =
      main.monthlyFee !== undefined && main.monthlyFee !== null && String(main.monthlyFee).trim() !== ""
        ? main.monthlyFee
        : c.monthlyFee;

    const merged = {
      ...c,
      ...main,
      id: cashierBySid[sid] ? c.id : sid, // doc id-ga collection-ka "cashier"
      studentDocId: main.id || sid,
      hasCashierDoc: !!cashierBySid[sid],
      studentId: sid,
      fullName,
      studentPhone: main.studentPhone || c.studentPhone || "",
      parentPhone: main.parentPhone || c.parentPhone || "",
      monthlyFee: isFree ? 0 : Number(rawFee) || 0,
      creditBalance: isFree || !creditIsCurrent ? 0 : Number(c.creditBalance || 0),
      isFree,
      // feeType: "Free" ama xaaladda cashier-ka (Paid/Unpaid). Ha isticmaalin
      // tan si loo go'aamiyo "bishan waa la bixiyay" — eeg monthPaid.
      feeType: isFree ? "Free" : c.feeType || main.feeType || "",
    };
    merged.className = normalizeClassName(merged);
    allStudents.push(merged);
  });

  const payableStudents = allStudents.filter((s) => !s.isFree);
  const payableIds = new Set(payableStudents.map((s) => s.studentId));
  const studentsById = {};
  allStudents.forEach((s) => {
    studentsById[s.studentId] = s;
  });

  // 3. Rasiidyada (ardayda lacag bixiya oo jira oo keliya) + ka saar labanlaab
  const validReceipts = receipts.filter(
    (r) => r.studentId && payableIds.has(r.studentId) && isAfterLedgerStart(r)
  );
  const { kept, duplicates } = splitDuplicateReceipts(validReceipts);

  const coveredBySid = {};
  kept.forEach((r) => {
    if (!coveredBySid[r.studentId]) coveredBySid[r.studentId] = new Set();
    receiptMonthKeys(r).forEach((k) => coveredBySid[r.studentId].add(k));
  });

  // 4. Payments sax ah: arday jira + lacag bixiye + rasiid daboolaya bishaas
  const validPayments = payments
    .filter(
      (p) =>
        p.studentId &&
        p.monthKey &&
        payableIds.has(p.studentId) &&
        coveredBySid[p.studentId] &&
        coveredBySid[p.studentId].has(p.monthKey)
    )
    .map((p) => ({ ...p, paidAmount: Number(p.paidAmount) || 0 }));

  const paymentsBySid = {};
  const monthPaid = {};
  validPayments.forEach((p) => {
    if (!paymentsBySid[p.studentId]) paymentsBySid[p.studentId] = [];
    paymentsBySid[p.studentId].push(p);

    if (!monthPaid[p.studentId]) monthPaid[p.studentId] = {};
    monthPaid[p.studentId][p.monthKey] = {
      paidAmount: p.paidAmount,
      status: p.status,
      remaining: p.remaining,
      createdAt: p.createdAt || null,
    };
  });
  Object.values(paymentsBySid).forEach((list) =>
    list.sort((a, b) => String(a.monthKey).localeCompare(String(b.monthKey)))
  );

  return {
    allStudents,
    payableStudents,
    freeStudents: allStudents.filter((s) => s.isFree),
    studentsById,
    payableIds,
    receipts: kept,
    duplicateReceipts: duplicates,
    payments: validPayments,
    paymentsBySid,
    monthPaid,
    coveredBySid,
  };
}

// Xaaladda bil kasta ee arday (Paid = paidAmount >= monthlyFee)
export function studentMonthState(ledger, student) {
  const fee = Number(student.monthlyFee || 0);
  const months = ledger.monthPaid[student.studentId] || {};
  const fullyPaidSet = new Set();
  const partialMap = {};
  Object.entries(months).forEach(([k, m]) => {
    const paid = Number(m.paidAmount) || 0;
    if ((fee > 0 && paid >= fee) || (m.status === "Paid" && paid > 0)) fullyPaidSet.add(k);
    else if (paid > 0) partialMap[k] = paid;
  });
  return {
    months,
    fullyPaidSet,
    partialMap,
    records: ledger.paymentsBySid[student.studentId] || [],
  };
}

// Tirtir rasiidyada labanlaaban backend-ka (aamusnaan).
export async function purgeDuplicateReceipts(duplicates) {
  if (!duplicates || duplicates.length === 0) return;
  try {
    for (let i = 0; i < duplicates.length; i += 400) {
      const batch = writeBatch(db);
      duplicates.slice(i, i + 400).forEach((r) => batch.delete(doc(db, "receipts", r.id)));
      await batch.commit();
    }
  } catch (err) {
    console.error("Rasiidyada labanlaaban lama tirtiri karin:", err);
  }
}

const docsOf = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

// Soo akhri wax walba oo dhis ledger-ka.
export async function loadFeeLedger({ cleanup = true } = {}) {
  const [stSnap, ptSnap, cSnap, pSnap, rSnap] = await Promise.all([
    getDocs(collection(db, "students")),
    getDocs(collection(db, "partTimeStudents")),
    getDocs(collection(db, "cashier")),
    getDocs(collection(db, "payments")),
    getDocs(collection(db, "receipts")),
  ]);

  const ledger = buildFeeLedger({
    students: docsOf(stSnap),
    partTimeStudents: docsOf(ptSnap),
    cashier: docsOf(cSnap),
    payments: docsOf(pSnap),
    receipts: docsOf(rSnap),
  });

  if (cleanup && ledger.duplicateReceipts.length > 0) {
    await purgeDuplicateReceipts(ledger.duplicateReceipts);
  }

  return ledger;
}

// ---------------------------------------------------------------------------
// TIRTIRIDDA RASIIDKA — waxay u gudbaysaa RECYCLE BIN (backend-ka way ku jirtaa)
// ---------------------------------------------------------------------------
// Marka rasiid la tirtiro:
//  • doc-ga "receipts" waxaa loo raraa Recycle Bin
//  • bil kasta oo uu daboolayay: haddii aysan jirin rasiid kale oo daboolaya,
//    doc-ga "payments/{sid}_{month}" waxaa loo raraa Recycle Bin (bishu waxay
//    noqotaa Not Paid); haddii rasiid kale (leh monthBreakdown) daboolayo,
//    payments-ka waxaa lagu celiyaa qiimaha rasiidkaas (nuqulka hore waa la
//    kaydiyaa si loo soo celin karo)
//  • "receiptCashier" ee u dhigma waxaa loo raraa Recycle Bin
//  • creditBalance-ka ardayga waa la celiyaa; feeType "Paid" -> "Unpaid"
//    haddii bishan aan la bixin
// Cashier iyo Admin labaduba meelahooda kama arkaan; Recycle Bin-ka ayay ka
// soo celin karaan.
export async function deleteReceiptsCascade(receiptsToDelete, actorRole = "cashier") {
  const list = (receiptsToDelete || []).filter((r) => r && r.id);
  if (list.length === 0) return;

  const deleteIds = new Set(list.map((r) => r.id));
  const thisMonth = localMonthKey();

  const trash = [];
  const writes = [];

  // Rasiidyo aan arday lahayn
  list
    .filter((r) => !r.studentId)
    .forEach((r) => {
      trash.push({ col: "receipts", id: r.id, data: r });
      writes.push({ type: "delete", col: "receipts", id: r.id });
    });

  const bySid = {};
  list
    .filter((r) => r.studentId)
    .forEach((r) => {
      if (!bySid[r.studentId]) bySid[r.studentId] = [];
      bySid[r.studentId].push(r);
    });

  for (const [sid, toDelete] of Object.entries(bySid)) {
    const [allRecSnap, rcSnap, cashierSnap, paySnap] = await Promise.all([
      getDocs(query(collection(db, "receipts"), where("studentId", "==", sid))),
      getDocs(query(collection(db, "receiptCashier"), where("studentId", "==", sid))),
      getDocs(query(collection(db, "cashier"), where("studentId", "==", sid))),
      getDocs(query(collection(db, "payments"), where("studentId", "==", sid))),
    ]);

    const allRec = docsOf(allRecSnap);
    const remaining = allRec.filter((r) => !deleteIds.has(r.id) && isAfterLedgerStart(r));
    const remainingKept = splitDuplicateReceipts(remaining).kept;
    const paymentsById = {};
    docsOf(paySnap).forEach((p) => {
      paymentsById[p.id] = p;
    });

    toDelete.forEach((r) => {
      const fresh = allRec.find((x) => x.id === r.id) || r;
      trash.push({ col: "receipts", id: r.id, data: fresh });
      writes.push({ type: "delete", col: "receipts", id: r.id });
    });

    // Bilaha la saameeyay
    const affected = new Set();
    toDelete.forEach((r) => receiptMonthKeys(r).forEach((k) => affected.add(k)));

    affected.forEach((monthKey) => {
      const payId = `${sid}_${monthKey}`;
      const existing = paymentsById[payId];
      if (!existing) return;

      const covering = remainingKept.filter((r) => receiptMonthKeys(r).includes(monthKey));
      if (covering.length === 0) {
        trash.push({ col: "payments", id: payId, data: existing });
        writes.push({ type: "delete", col: "payments", id: payId });
        return;
      }
      const withBd = covering
        .filter((r) => Array.isArray(r.monthBreakdown) && r.monthBreakdown.length > 0)
        .sort((a, b) => receiptSeconds(b) - receiptSeconds(a));
      if (withBd.length > 0) {
        const entry = withBd[0].monthBreakdown.find((m) => m.monthKey === monthKey);
        if (entry) {
          trash.push({ col: "payments", id: payId, data: existing });
          writes.push({
            type: "set",
            merge: true,
            col: "payments",
            id: payId,
            data: {
              paidAmount: Number(entry.paidAmount) || 0,
              remaining: Number(entry.remaining) || 0,
              status: entry.status || "Not Paid",
            },
          });
        }
      }
    });

    // receiptCashier u dhigma
    const rcDocs = docsOf(rcSnap);
    const usedRc = new Set();
    toDelete.forEach((r) => {
      let match = null;
      if (r.receiptCashierId) {
        match = rcDocs.find((rc) => rc.id === r.receiptCashierId) || null;
      }
      if (!match) {
        const keys = receiptMonthKeys(r).slice().sort().join(",");
        match = rcDocs.find(
          (rc) =>
            !usedRc.has(rc.id) &&
            Number(rc.paidAmount) === Number(r.paidAmount) &&
            (Array.isArray(rc.monthsCovered) ? rc.monthsCovered.slice().sort().join(",") : "") === keys
        );
      }
      if (match && !usedRc.has(match.id)) {
        usedRc.add(match.id);
        trash.push({ col: "receiptCashier", id: match.id, data: match });
        writes.push({ type: "delete", col: "receiptCashier", id: match.id });
      }
    });

    // Cashier doc: credit + feeType
    const cashierDocSnap = cashierSnap.docs[0];
    if (cashierDocSnap) {
      const cData = cashierDocSnap.data();
      const updates = {};

      if (remainingKept.length === 0) {
        updates.creditBalance = 0;
        updates.creditUpdatedAt = new Date();
      } else {
        const latestDeleted = [...toDelete].sort(
          (a, b) => receiptSeconds(b) - receiptSeconds(a)
        )[0];
        const latestRemainingTs = Math.max(...remainingKept.map((r) => receiptSeconds(r)));
        if (
          latestDeleted &&
          latestDeleted.creditBalanceBefore !== undefined &&
          receiptSeconds(latestDeleted) >= latestRemainingTs
        ) {
          updates.creditBalance = Number(latestDeleted.creditBalanceBefore) || 0;
          updates.creditUpdatedAt = new Date();
        }
      }

      const stillPaidThisMonth = remainingKept.some((r) => receiptMonthKeys(r).includes(thisMonth));
      if (!stillPaidThisMonth && cData.feeType === "Paid") {
        updates.feeType = "Unpaid";
      }

      if (Object.keys(updates).length > 0) {
        trash.push({
          col: "cashier",
          id: cashierDocSnap.id,
          mode: "merge",
          data: {
            creditBalance: cData.creditBalance ?? 0,
            feeType: cData.feeType ?? "",
            creditUpdatedAt: cData.creditUpdatedAt ?? null,
          },
        });
        writes.push({ type: "update", col: "cashier", id: cashierDocSnap.id, data: updates });
      }
    }
  }

  const total = list.reduce((sum, r) => sum + (Number(r.paidAmount) || 0), 0);
  const label =
    list.length === 1
      ? `Rasiid N° ${list[0].receiptNo || list[0].id} — ${list[0].studentName || list[0].studentId || ""}`
      : `${list.length} rasiid la tirtiray`;

  await moveToRecycleBin({
    type: "receiptDelete",
    label,
    className: list.length === 1 ? list[0].className || "" : "",
    actor: currentActor(actorRole),
    trash,
    writes,
    totalAmount: total,
  });
}