// src/utils/recycleBin.js
//
// RECYCLE BIN — marka Cashier ama Admin uu tirtiro rasiid, ama uu sameeyo
// "Reset / Unpaid All", xogtu backend-ka kama baxdo: waxaa loo raraa
//   • recycleBinGroups/{groupId}  — hal tallaabo (Reset fasal, Reset system,
//                                   tirtiridda rasiid) + cidda samaysay
//   • recycleBin/{itemId}          — nuqul buuxa oo doc kasta (receipts,
//                                   payments, receiptCashier, cashier)
// kadibna meelaha ay ku jireen (Cashier + Admin) way ka baxaan. Recycle Bin
// ka ayaa laga soo celin karaa (Restore).

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase/firebase";

const BATCH_LIMIT = 400;

// Firestore ma aqbalo "undefined" — ka saar
function clean(value) {
  if (value === undefined) return null;
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(clean);
  if (typeof value === "object") {
    // Timestamp / Date / DocumentReference — sidooda u daa
    if (typeof value.toDate === "function" || value instanceof Date || value.firestore) {
      return value;
    }
    const out = {};
    Object.entries(value).forEach(([k, v]) => {
      if (v !== undefined) out[k] = clean(v);
    });
    return out;
  }
  return value;
}

function stripId(data) {
  const { id, ...rest } = data || {};
  return rest;
}

const secondsOf = (v) => {
  if (!v) return 0;
  if (typeof v.toDate === "function") return Math.floor(v.toDate().getTime() / 1000);
  if (v.seconds !== undefined) return v.seconds;
  const d = new Date(v);
  return isNaN(d.getTime()) ? 0 : Math.floor(d.getTime() / 1000);
};

export function currentActor(role) {
  if (role === "admin") {
    return {
      role: "admin",
      id: localStorage.getItem("adminId") || "",
      name: localStorage.getItem("adminName") || "Admin",
    };
  }
  return {
    role: "cashier",
    id: localStorage.getItem("cashierId") || "",
    name: localStorage.getItem("cashierName") || "Cashier",
  };
}

async function runOps(ops) {
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    ops.slice(i, i + BATCH_LIMIT).forEach((op) => op(batch));
    await batch.commit();
  }
}

// trash:  [{ col, id, data, mode: "set" | "merge" }]  — nuqulka la kaydinayo
// writes: [{ type: "delete" | "set" | "update", col, id, data, merge }]
export async function moveToRecycleBin({ type, label, className = "", actor, trash, writes, totalAmount = 0, meta = {} }) {
  const deletedAt = new Date();

  const groupRef = await addDoc(collection(db, "recycleBinGroups"), clean({
    type,
    label,
    className,
    itemCount: trash.length,
    receiptCount: trash.filter((t) => t.col === "receipts").length,
    totalAmount: Number(totalAmount) || 0,
    deletedAt,
    deletedAtServer: serverTimestamp(),
    deletedBy: actor || currentActor("cashier"),
    status: "deleted",
    ...meta,
  }));

  // 1) Marka hore nuqullada kaydi (xogtu ma lumayso haddii wax dhacaan)
  await runOps(
    trash.map((t) => (batch) => {
      const ref = doc(collection(db, "recycleBin"));
      batch.set(ref, clean({
        groupId: groupRef.id,
        col: t.col,
        docId: t.id,
        mode: t.mode || "set",
        data: stripId(t.data),
        deletedAt,
      }));
    })
  );

  // 2) Kadib ka saar / beddel meelaha asalka ah
  await runOps(
    writes.map((w) => (batch) => {
      const ref = doc(db, w.col, w.id);
      if (w.type === "delete") batch.delete(ref);
      else if (w.type === "update") batch.update(ref, clean(w.data));
      else batch.set(ref, clean(w.data), w.merge ? { merge: true } : undefined);
    })
  );

  return groupRef.id;
}

export async function listRecycleGroups() {
  const snap = await getDocs(collection(db, "recycleBinGroups"));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => secondsOf(b.deletedAt) - secondsOf(a.deletedAt));
}

export async function listRecycleItems(groupId) {
  const snap = await getDocs(query(collection(db, "recycleBin"), where("groupId", "==", groupId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Soo celi koox. Xeerar si aan loo burburin xog cusub oo dambe:
//  • receipts / receiptCashier: haddii doc-gu hadda jiro, waa laga boodayaa
//  • payments: waa la soo celinayaa kaliya haddii aan lacag cusub oo ka
//    dambeysa tirtiridda la gelin bishaas
//  • cashier (credit/feeType): kaliya haddii aan lacag cusub la gelin
export async function restoreRecycleGroup(groupId, actor) {
  const groupRef = doc(db, "recycleBinGroups", groupId);
  const groupSnap = await getDoc(groupRef);
  if (!groupSnap.exists()) throw new Error("Kooxdan lama helin.");
  const group = groupSnap.data();
  if (group.status === "restored") return { restored: 0, skipped: 0 };

  const deletedSec = secondsOf(group.deletedAt);
  const items = await listRecycleItems(groupId);

  const current = await Promise.all(
    items.map((it) => getDoc(doc(db, it.col, it.docId)))
  );

  let restored = 0;
  let skipped = 0;
  const ops = [];

  items.forEach((it, i) => {
    const cur = current[i];
    const ref = doc(db, it.col, it.docId);

    if (it.col === "cashier") {
      if (!cur.exists()) {
        skipped += 1;
        return;
      }
      if (secondsOf(cur.data().creditUpdatedAt) > deletedSec) {
        skipped += 1;
        return;
      }
      ops.push((b) => b.set(ref, clean(it.data), { merge: true }));
      restored += 1;
      return;
    }

    if (cur.exists()) {
      const newer = secondsOf(cur.data().createdAt) > deletedSec;
      if (it.col !== "payments" || newer) {
        skipped += 1;
        return;
      }
    }
    ops.push((b) => b.set(ref, clean(it.data)));
    restored += 1;
  });

  await runOps(ops);

  await updateDoc(groupRef, clean({
    status: "restored",
    restoredAt: new Date(),
    restoredBy: actor || currentActor("cashier"),
    restoredCount: restored,
    skippedCount: skipped,
  }));

  return { restored, skipped };
}