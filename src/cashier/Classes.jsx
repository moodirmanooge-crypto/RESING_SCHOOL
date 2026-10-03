// src/cashier/Classes.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  writeBatch,
  serverTimestamp,
  query,
  where,
  onSnapshot,
  getDocs,
  runTransaction,
  getDoc,
} from "firebase/firestore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { db } from "../firebase/firebase";
import { theme } from "./theme.js";
import ReceiptModal from "./ReceiptModal.jsx";
import {
  buildFeeLedger,
  studentMonthState,
  receiptMonthKeys,
  purgeDuplicateReceipts,
  localMonthKey,
  monthKeyAdd as ledgerMonthKeyAdd,
  toDateValue,
  ledgerStartMonthKey,
  tsSeconds,
  LEDGER_START_SECONDS,
} from "../utils/feeLedger.js";
import { moveToRecycleBin, currentActor } from "../utils/recycleBin.js";

const SCHOOL_NAME = "Rising Star School";

const academicYearLabel = (dateObj) => {
  const y = dateObj.getFullYear();
  const m = dateObj.getMonth() + 1;
  if (m >= 9) return `${y}/${y + 1}`;
  return `${y - 1}/${y}`;
};

// Lambarka rasiidka (counters/receiptCounterV2): { value, series }.
//  • value  = lambarkii ugu dambeeyay (001, 002, ...)
//  • series = taxanaha; doc ID-ga rasiidku waa "V{series}-{lambar}" (V2-001).
// Marka "Reset — Dhammaan System-ka" la sameeyo, value -> 0 iyo series + 1,
// sidaas rasiidka xiga wuxuu noqdaa 001 (V3-001) mana qariyo rasiidyadii
// Recycle Bin-ka ku jira (haddii dib loo soo celiyo). Isla counter-ka
// ReceiptModal.jsx. Hal transaction ayaa qabsada "count" lambar oo isku xiga,
// si rasiidka loogu daro ISLA batch-ka payments-ka.
const RECEIPT_COUNTER_ID = "receiptCounterV2";

const reserveReceiptNumbers = async (count) => {
  const counterRef = doc(db, "counters", RECEIPT_COUNTER_ID);

  const { first, series } = await runTransaction(db, async (transaction) => {
    const counterDoc = await transaction.get(counterRef);
    const data = counterDoc.exists() ? counterDoc.data() : {};
    const current = Number(data.value || 0);
    const ser = Number(data.series || 2);
    transaction.set(counterRef, { value: current + count, series: ser }, { merge: true });
    return { first: current + 1, series: ser };
  });

  return Array.from({ length: count }, (_, i) => {
    const receiptNo = String(first + i).padStart(3, "0");
    return { receiptNo, docId: `V${series}-${receiptNo}` };
  });
};

// Xogta rasiidka (receipts collection) — waxaa lagu daraa batch-ka.
const buildReceiptRecord = (receiptNo, payment, paidDate) => ({
  receiptNo,
  studentId: payment.studentId || null,
  studentName: payment.studentName || "",
  className: payment.className || "",
  studentPhone: payment.studentPhone || "",
  monthLabel: payment.monthLabel || "",
  monthBreakdown: Array.isArray(payment.monthBreakdown) ? payment.monthBreakdown : [],
  paidAmount: payment.paidAmount ?? 0,
  monthlyFee: payment.monthlyFee ?? 0,
  creditBalanceBefore: payment.creditBalanceBefore ?? 0,
  creditBalanceAfter: payment.creditBalanceAfter ?? 0,
  receiptCashierId: payment.receiptCashierId || "",
  paymentMethod: payment.paymentMethod || "",
  evcNumber: payment.evcNumber || "",
  academicYear: academicYearLabel(paidDate),
  paidAt: paidDate,
  createdAt: serverTimestamp(),
});

// Marka lacag bishan la edit-gareeyo: rasiidkii hore ee bishan ka saar si
// lacagtu aysan labanlaabmin (rasiid hal bil ah -> waa la tirtiraa; rasiid
// bilo badan -> bishan ayaa laga saaraa breakdown-ka iyo lacagta).
const removeMonthFromOldReceipts = (batch, studentReceipts, monthKey) => {
  studentReceipts.forEach((r) => {
    const keys = receiptMonthKeys(r);
    if (!keys.includes(monthKey)) return;

    if (keys.length <= 1) {
      batch.delete(doc(db, "receipts", r.id));
      if (r.receiptCashierId) batch.delete(doc(db, "receiptCashier", r.receiptCashierId));
      return;
    }

    const bd = Array.isArray(r.monthBreakdown) ? r.monthBreakdown : [];
    if (bd.length > 0) {
      const entry = bd.find((m) => m.monthKey === monthKey);
      const newBd = bd.filter((m) => m.monthKey !== monthKey);
      const newPaid = Math.max((Number(r.paidAmount) || 0) - (Number(entry?.paidAmount) || 0), 0);
      batch.update(doc(db, "receipts", r.id), {
        monthBreakdown: newBd,
        paidAmount: newPaid,
      });
    }
  });
};

const baseClasses = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "F1",
  "F2",
  "F3",
  "F4",
];

const fullTimeOptions = baseClasses.map((c) => c);
const partTimeOptions = baseClasses.map((c) => `${c} Part Time`);
const classOptions = [...fullTimeOptions, ...partTimeOptions];

// Waqtiga maxaliga ah (Soomaaliya UTC+3) — toISOString() (UTC) waxay keeni
// jirtay in bilaha si khaldan loo xisaabiyo.
const currentMonthKey = () => localMonthKey();

const monthLabel = (key) => {
  if (!key) return "—";
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

function formatPaidDate(createdAt) {
  if (!createdAt?.seconds) return "—";
  const d = new Date(createdAt.seconds * 1000);
  return d.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
}

function monthKeyAdd(key, n) {
  return ledgerMonthKeyAdd(key, n);
}

function addMonthsToKey(monthKey, months) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  date.setMonth(date.getMonth() + months);
  const newYear = date.getFullYear();
  const newMonth = String(date.getMonth() + 1).padStart(2, "0");
  return `${newYear}-${newMonth}`;
}

function registrationMonthKey(student) {
  // Bilow cusub: lacagta waxay ka bilaabataa bisha nidaamku dib u bilowday
  // (ama bisha ardayga la diiwaangeliyay haddii ay ka dambeyso).
  const startMonth = ledgerStartMonthKey();
  const d = toDateValue(student.createdAt);
  const reg = d ? localMonthKey(d) : currentMonthKey();
  return reg > startMonth ? reg : startMonth;
}

function findNextUnpaidMonth(fullyPaidSet, startKey, safetyCap = 120) {
  let key = startKey;
  for (let i = 0; i < safetyCap; i++) {
    if (!fullyPaidSet.has(key)) return key;
    key = monthKeyAdd(key, 1);
  }
  return key;
}

function distributePayment({ entered, monthlyFee, fullyPaidSet, partialMap, startKey }) {
  const updates = [];
  let cash = entered;
  let cursor = startKey;
  let guard = 0;

  while (cash > 0 && guard < 120) {
    if (fullyPaidSet.has(cursor)) {
      cursor = monthKeyAdd(cursor, 1);
      guard += 1;
      continue;
    }

    const already = partialMap[cursor] || 0;
    const needed = monthlyFee - already;
    const apply = Math.min(cash, needed);
    const newPaid = already + apply;
    const newRemaining = Math.max(monthlyFee - newPaid, 0);
    const status = newRemaining <= 0 ? "Paid" : "Not Paid";

    updates.push({ monthKey: cursor, paidAmount: newPaid, remaining: newRemaining, status });
    cash -= apply;

    if (status === "Paid") {
      fullyPaidSet.add(cursor);
      cursor = monthKeyAdd(cursor, 1);
    } else {
      break;
    }
    guard += 1;
  }

  return updates;
}

export default function Classes() {
  const [regularStudents, setRegularStudents] = useState([]);
  const [partTimeStudents, setPartTimeStudents] = useState([]);
  const [cashierDocs, setCashierDocs] = useState([]);
  const [paymentDocs, setPaymentDocs] = useState([]);
  const [receiptDocs, setReceiptDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const purgedRef = useRef(new Set());

  const [selectedClass, setSelectedClass] = useState(null);
  const [search, setSearch] = useState("");
  const [amounts, setAmounts] = useState({});
  const [monthsSelected, setMonthsSelected] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [savingAll, setSavingAll] = useState(false);
  const [resettingAll, setResettingAll] = useState(false);
  const [resetDialog, setResetDialog] = useState(false);
  const [editingIds, setEditingIds] = useState({});
  const [receiptPayment, setReceiptPayment] = useState(null);
  const [receiptQueue, setReceiptQueue] = useState([]);
  const [profileStudent, setProfileStudent] = useState(null);

  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setLoading(true);

    const toList = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // 1. Ardayda Full Time
    const unsubStudents = onSnapshot(
      collection(db, "students"),
      (snap) => setRegularStudents(toList(snap)),
      (err) => console.error("Error fetching students:", err)
    );

    // 2. Ardayda Part Time
    const unsubPartTime = onSnapshot(
      collection(db, "partTimeStudents"),
      (snap) => setPartTimeStudents(toList(snap)),
      (err) => console.error("Error fetching partTimeStudents:", err)
    );

    // 3. Cashier docs (creditBalance, feeType Paid/Unpaid)
    const unsubCashier = onSnapshot(
      collection(db, "cashier"),
      (snap) => {
        setCashierDocs(toList(snap));
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching cashier collection:", err);
        setLoading(false);
      }
    );

    // 4. Payments (bil kasta)
    const unsubPayments = onSnapshot(
      collection(db, "payments"),
      (snap) => setPaymentDocs(toList(snap)),
      (err) => console.error("Error fetching payments:", err)
    );

    // 5. Receipts — bil waa "la bixiyay" kaliya haddii rasiid daboolayo
    const unsubReceipts = onSnapshot(
      collection(db, "receipts"),
      (snap) => setReceiptDocs(toList(snap)),
      (err) => console.error("Error fetching receipts:", err)
    );

    return () => {
      unsubStudents();
      unsubPartTime();
      unsubCashier();
      unsubPayments();
      unsubReceipts();
    };
  }, []);

  // Ledger-ka lacagaha — isla xisaabinta Dashboard/Reports/Admin ay isticmaalaan
  const ledger = useMemo(
    () =>
      buildFeeLedger({
        students: regularStudents,
        partTimeStudents,
        cashier: cashierDocs,
        payments: paymentDocs,
        receipts: receiptDocs,
      }),
    [regularStudents, partTimeStudents, cashierDocs, paymentDocs, receiptDocs]
  );

  // Rasiidyada labanlaaban (bug-gii hore) backend-ka ka tirtir hal mar
  useEffect(() => {
    const fresh = ledger.duplicateReceipts.filter((r) => !purgedRef.current.has(r.id));
    if (fresh.length === 0) return;
    fresh.forEach((r) => purgedRef.current.add(r.id));
    purgeDuplicateReceipts(fresh);
  }, [ledger]);

  // Dhammaan ardayda jira (Full Time + Part Time), aan pendingDeletion ahayn
  const students = ledger.allStudents;

  const classGroups = useMemo(() => {
    const groups = {};
    classOptions.forEach((c) => (groups[c] = []));

    students.forEach((s) => {
      const cls = s.className || "Unknown";
      if (!groups[cls]) groups[cls] = [];
      groups[cls].push(s);
    });

    const extras = Object.keys(groups)
      .filter((c) => !classOptions.includes(c))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    return [...classOptions, ...extras].map((c) => [c, groups[c]]);
  }, [students]);

  const currentClassStudents = useMemo(() => {
    if (!selectedClass) return [];
    const list = students.filter(
      (s) => (s.className || "Unknown") === selectedClass && s.feeType !== "Free"
    );
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (s) =>
        (s.studentId || "").toLowerCase().includes(q) ||
        (s.fullName || "").toLowerCase().includes(q)
    );
  }, [students, selectedClass, search]);

  const isFreeStudent = (student) => student.feeType === "Free";

  const selectMonths = (student, months) => {
    const fee = Number(student.monthlyFee || 0);
    setMonthsSelected({ ...monthsSelected, [student.id]: months });
    if (months > 0 && fee > 0) {
      setAmounts({ ...amounts, [student.id]: String(fee * months) });
    }
  };

  function getStudentMonthState(studentId) {
    const student = ledger.studentsById[studentId] || { studentId, monthlyFee: 0 };
    const { records, fullyPaidSet, partialMap } = studentMonthState(ledger, student);
    return { records, fullyPaidSet, partialMap };
  }

  const filteredClassStats = useMemo(() => {
    const paidThisMonthCount = currentClassStudents.filter((s) => {
      if (isFreeStudent(s)) return false;
      const { fullyPaidSet } = getStudentMonthState(s.studentId);
      return fullyPaidSet.has(currentMonthKey());
    }).length;
    return { total: currentClassStudents.length, paidThisMonthCount };
  }, [currentClassStudents, ledger]);

  const startEdit = (student) => {
    const fee = Number(student.monthlyFee || 0);
    const { fullyPaidSet, partialMap } = getStudentMonthState(student.studentId);
    const thisMonthKey = currentMonthKey();
    const paidThisMonth = fullyPaidSet.has(thisMonthKey);
    const partialThisMonth = partialMap[thisMonthKey] || 0;
    const prefill = paidThisMonth ? fee : partialThisMonth;

    setAmounts({
      ...amounts,
      [student.id]: String(prefill || ""),
    });
    setEditingIds({ ...editingIds, [student.id]: true });
  };

  const editAll = () => {
    const thisMonthKey = currentMonthKey();
    const targets = currentClassStudents.filter((s) => {
      if (isFreeStudent(s)) return false;
      const { fullyPaidSet } = getStudentMonthState(s.studentId);
      return fullyPaidSet.has(thisMonthKey);
    });

    if (targets.length === 0) {
      alert("Ma jiraan arday 'Paid' ah bishan oo la edit-gareyn karo.");
      return;
    }

    const nextAmounts = { ...amounts };
    const nextEditing = { ...editingIds };

    targets.forEach((student) => {
      const fee = Number(student.monthlyFee || 0);
      nextAmounts[student.id] = String(fee || "");
      nextEditing[student.id] = true;
    });

    setAmounts(nextAmounts);
    setEditingIds(nextEditing);
  };

  // RESET / UNPAID ALL — scope: "class" (fasalkan) ama "system" (dhammaan).
  // Xogtu backend-ka kama baxdo: waxaa loo raraa RECYCLE BIN (Cashier iyo
  // Admin labaduba way ka soo celin karaan). Meelaha kale oo dhan (Classes,
  // Dashboard, Payments, Reports, Receipts, Admin) way ka baxdaa isla markiiba.
  // "system": lambarka rasiidka wuxuu dib uga bilaabmaa 001.
  async function resetPayments(scope) {
    const isSystem = scope === "system";
    if (!isSystem && !selectedClass) return;

    if (isSystem) {
      const typed = window.prompt(
        'DIGNIIN: Dhammaan lacagaha iyo rasiidyada FASALLADA OO DHAN waa la reset-gareynayaa, ' +
          "lambarka rasiidkuna wuxuu ka bilaabmayaa 001. Xogtu waxay gelaysaa Recycle Bin.\n\n" +
          'Si aad u xaqiijiso, qor: RESET'
      );
      if (String(typed || "").trim().toUpperCase() !== "RESET") return;
    }

    try {
      setResettingAll(true);
      setResetDialog(false);

      // Ardayda la saameynayo (Free-ga mooyee)
      const scopeStudents = isSystem
        ? ledger.payableStudents
        : students.filter(
            (s) => (s.className || "Unknown") === selectedClass && s.feeType !== "Free"
          );
      const scopeIds = new Set(scopeStudents.map((s) => s.studentId));

      const trash = [];
      const writes = [];

      // 1) Rasiidyada (kuwa muuqda oo keliya)
      const scopeReceipts = ledger.receipts.filter((r) => scopeIds.has(r.studentId));
      scopeReceipts.forEach((r) => {
        trash.push({ col: "receipts", id: r.id, data: r });
        writes.push({ type: "delete", col: "receipts", id: r.id });
      });

      // 2) Lacagaha bilaha
      ledger.payments
        .filter((p) => scopeIds.has(p.studentId) && p.id)
        .forEach((p) => {
          trash.push({ col: "payments", id: p.id, data: p });
          writes.push({ type: "delete", col: "payments", id: p.id });
        });

      // 3) receiptCashier (bilowga cusub kadib)
      const rcIds = new Set();
      const rcDocs = [];
      if (isSystem) {
        const rcSnap = await getDocs(collection(db, "receiptCashier"));
        rcSnap.docs.forEach((d) => rcDocs.push({ id: d.id, ...d.data() }));
      } else {
        const ids = Array.from(scopeIds);
        for (let i = 0; i < ids.length; i += 10) {
          const rcSnap = await getDocs(
            query(collection(db, "receiptCashier"), where("studentId", "in", ids.slice(i, i + 10)))
          );
          rcSnap.docs.forEach((d) => rcDocs.push({ id: d.id, ...d.data() }));
        }
      }
      const linkedRc = new Set(scopeReceipts.map((r) => r.receiptCashierId).filter(Boolean));
      rcDocs.forEach((rc) => {
        if (!scopeIds.has(rc.studentId)) return;
        const isNew = tsSeconds(rc.createdAt) >= LEDGER_START_SECONDS;
        if (!isNew && !linkedRc.has(rc.id)) return;
        if (rcIds.has(rc.id)) return;
        rcIds.add(rc.id);
        trash.push({ col: "receiptCashier", id: rc.id, data: rc });
        writes.push({ type: "delete", col: "receiptCashier", id: rc.id });
      });

      // 4) Cashier docs: credit 0, Unpaid (xaaladdii hore waa la kaydiyaa)
      const cashierById = {};
      cashierDocs.forEach((c) => {
        cashierById[c.id] = c;
      });
      scopeStudents.forEach((s) => {
        const prev = cashierById[s.id];
        if (prev) {
          trash.push({
            col: "cashier",
            id: s.id,
            mode: "merge",
            data: {
              creditBalance: prev.creditBalance ?? 0,
              feeType: prev.feeType ?? "",
              creditUpdatedAt: prev.creditUpdatedAt ?? null,
            },
          });
        }
        writes.push({
          type: "set",
          merge: true,
          col: "cashier",
          id: s.id,
          data: {
            studentId: s.studentId,
            creditBalance: 0,
            creditUpdatedAt: new Date(),
            feeType: "Unpaid",
          },
        });
      });

      // 5) System reset: lambarka rasiidka 001 ka bilow (taxane cusub)
      let counterMeta = {};
      if (isSystem) {
        const counterRef = doc(db, "counters", RECEIPT_COUNTER_ID);
        const counterSnap = await getDoc(counterRef);
        const prev = counterSnap.exists() ? counterSnap.data() : {};
        const prevSeries = Number(prev.series || 2);
        counterMeta = {
          previousCounter: { value: Number(prev.value || 0), series: prevSeries },
        };
        writes.push({
          type: "set",
          merge: true,
          col: "counters",
          id: RECEIPT_COUNTER_ID,
          data: { value: 0, series: prevSeries + 1, resetAt: new Date() },
        });
      }

      const totalAmount = scopeReceipts.reduce((sum, r) => sum + (Number(r.paidAmount) || 0), 0);

      await moveToRecycleBin({
        type: isSystem ? "systemReset" : "classReset",
        label: isSystem
          ? "Reset — Dhammaan System-ka (fasallada oo dhan)"
          : `Reset — Fasalka ${selectedClass}`,
        className: isSystem ? "ALL" : selectedClass,
        actor: currentActor("cashier"),
        trash,
        writes,
        totalAmount,
        meta: { studentCount: scopeStudents.length, ...counterMeta },
      });

      setAmounts({});
      setMonthsSelected({});
      setEditingIds({});
      setReceiptQueue([]);
      setReceiptPayment(null);

      alert(
        isSystem
          ? `Dhammaan System-ka waa la Reset-gareeyay ($${totalAmount}, ${scopeReceipts.length} rasiid). ` +
              "Xogtu waxay ku jirtaa Recycle Bin. Rasiidka xiga wuxuu noqonayaa N° 001."
          : `Fasalka ${selectedClass} waa la Reset-gareeyay ($${totalAmount}, ${scopeReceipts.length} rasiid). ` +
              "Xogtu waxay ku jirtaa Recycle Bin."
      );
    } catch (err) {
      console.error(err);
      alert("Khalad ayaa dhacay marka xogta la reset-gareynayay: " + (err?.message || ""));
    } finally {
      setResettingAll(false);
    }
  }

  const generateMonthlyRevenuePDF = (paidRecords) => {
    const docPdf = new jsPDF();
    const formattedMonth = monthLabel(currentMonthKey());
    const dateStr = now.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    docPdf.setFontSize(18);
    docPdf.setTextColor(20, 50, 40);
    docPdf.text(SCHOOL_NAME, 14, 18);

    docPdf.setFontSize(12);
    docPdf.setTextColor(100);
    docPdf.text(`Warbixinta Daqliga Bisha: ${formattedMonth}`, 14, 25);
    docPdf.text(`Fasalka: ${selectedClass || "Dhamaan Fasalada"}`, 14, 31);
    docPdf.text(`Taariikhda Xiridda: ${dateStr}`, 14, 37);

    const tableRows = paidRecords.map((item, index) => [
      index + 1,
      item.studentId,
      item.studentName,
      item.className,
      `$${item.paidAmount}`,
      item.status,
    ]);

    const totalRevenue = paidRecords.reduce((sum, item) => sum + Number(item.paidAmount || 0), 0);

    autoTable(docPdf, {
      startY: 44,
      head: [["#", "ID", "Magaca Ardayga", "Fasalka", "Lacagta Bixiyay", "Status"]],
      body: tableRows,
      theme: "striped",
      headStyles: { fillColor: [15, 80, 60] },
    });

    const finalY = docPdf.lastAutoTable.finalY + 10;
    docPdf.setFontSize(14);
    docPdf.setTextColor(0);
    docPdf.text(`Wadarta Daqliga Bisha Soogalay: $${totalRevenue}`, 14, finalY);

    docPdf.save(`Daqliga_${selectedClass}_${currentMonthKey()}.pdf`);
  };

  // Xisaabinta lacagta arday (isku mid Save iyo Save All)
  function computeStudentPayment(student) {
    const monthlyFee = Number(student.monthlyFee || 0);
    if (monthlyFee <= 0) return null;

    let entered = Number(amounts[student.id] || 0);
    if (entered <= 0) {
      entered = monthlyFee;
    }

    const isEditing = !!editingIds[student.id];
    const thisMonthKey = currentMonthKey();
    const { fullyPaidSet, partialMap } = getStudentMonthState(student.studentId);

    const workingFullyPaidSet = new Set(fullyPaidSet);
    const workingPartialMap = { ...partialMap };
    if (isEditing) {
      workingFullyPaidSet.delete(thisMonthKey);
      delete workingPartialMap[thisMonthKey];
    }

    // Edit: lacagta cusub waxay bilaabataa bishan (ma aha bil hore).
    const startKey = isEditing
      ? thisMonthKey
      : findNextUnpaidMonth(workingFullyPaidSet, registrationMonthKey(student));

    const existingCredit = Number(student.creditBalance || 0);
    const cashToDistribute = entered + existingCredit;

    let updates = distributePayment({
      entered: cashToDistribute,
      monthlyFee,
      fullyPaidSet: new Set(workingFullyPaidSet),
      partialMap: { ...workingPartialMap },
      startKey,
    });

    if (updates.length === 0) {
      updates = [{
        monthKey: startKey,
        paidAmount: entered,
        remaining: Math.max(monthlyFee - entered, 0),
        status: entered >= monthlyFee ? "Paid" : "Not Paid"
      }];
    }

    const totalApplied = updates.reduce((sum, u) => {
      const already = workingPartialMap[u.monthKey] || 0;
      return sum + (u.paidAmount - already);
    }, 0);
    const newCreditBalance = Math.max(cashToDistribute - totalApplied, 0);

    const receiptMonthLabel = (() => {
      if (updates.length === 0) return monthLabel(startKey);
      if (updates.length === 1) return monthLabel(updates[0].monthKey);

      const names = updates.map((u) => {
        const [, m] = u.monthKey.split("-");
        const d = new Date(2000, Number(m) - 1, 1);
        return d.toLocaleDateString("en-US", { month: "long" });
      });
      const year = updates[updates.length - 1].monthKey.split("-")[0];

      const joined =
        names.length === 2
          ? `${names[0]} and ${names[1]}`
          : `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;

      return `${joined} ${year} (${updates.length} Months)`;
    })();

    return {
      monthlyFee,
      entered,
      isEditing,
      thisMonthKey,
      updates,
      existingCredit,
      newCreditBalance,
      receiptMonthLabel,
    };
  }

  // Ku dar batch-ka: cashier, payments, receiptCashier, receipts (hal mar)
  function addStudentPaymentToBatch(batch, student, calc, reserved, paidDate) {
    const { receiptNo, docId: receiptDocId } = reserved;
    const {
      monthlyFee,
      entered,
      isEditing,
      thisMonthKey,
      updates,
      existingCredit,
      newCreditBalance,
      receiptMonthLabel,
    } = calc;

    // Edit: rasiidkii hore ee bishan ka saar (lacag labanlaab ma dhacdo)
    if (isEditing) {
      const studentReceipts = ledger.receipts.filter((r) => r.studentId === student.studentId);
      removeMonthFromOldReceipts(batch, studentReceipts, thisMonthKey);
    }

    batch.set(
      doc(db, "cashier", student.id),
      {
        studentId: student.studentId,
        studentName: student.fullName,
        feeType: "Paid",
        creditBalance: newCreditBalance,
        creditUpdatedAt: paidDate,
        className: student.className,
      },
      { merge: true }
    );

    updates.forEach((u) => {
      const paymentDocId = `${student.studentId}_${u.monthKey}`;
      batch.set(doc(db, "payments", paymentDocId), {
        studentId: student.studentId,
        studentName: student.fullName,
        className: student.className || "",
        schoolName: SCHOOL_NAME,
        monthlyFee,
        paidAmount: u.paidAmount,
        remaining: u.remaining,
        status: u.status,
        monthKey: u.monthKey,
        monthLabel: monthLabel(u.monthKey),
        studentPhone: student.studentPhone || "",
        parentPhone: student.parentPhone || "",
        receiptNo,
        createdAt: serverTimestamp(),
      });
    });

    const receiptCashierRef = doc(collection(db, "receiptCashier"));
    batch.set(receiptCashierRef, {
      studentId: student.studentId,
      studentName: student.fullName,
      className: student.className || "",
      schoolName: SCHOOL_NAME,
      monthlyFee,
      paidAmount: entered,
      monthsCovered: updates.map((u) => u.monthKey),
      creditBalanceAfter: newCreditBalance,
      studentPhone: student.studentPhone || "",
      parentPhone: student.parentPhone || "",
      receiptNo,
      createdAt: serverTimestamp(),
    });

    const receiptPayload = {
      studentId: student.studentId,
      studentName: student.fullName,
      className: student.className || "",
      schoolName: SCHOOL_NAME,
      studentPhone: student.studentPhone || "",
      monthLabel: receiptMonthLabel,
      monthBreakdown: updates.map((u) => ({
        monthKey: u.monthKey,
        paidAmount: u.paidAmount,
        remaining: u.remaining,
        status: u.status,
      })),
      paidAmount: entered,
      monthlyFee,
      creditBalanceBefore: existingCredit,
      creditBalanceAfter: newCreditBalance,
      receiptCashierId: receiptCashierRef.id,
    };

    batch.set(
      doc(collection(db, "receipts"), receiptDocId),
      buildReceiptRecord(receiptNo, receiptPayload, paidDate)
    );

    return {
      ...receiptPayload,
      receiptNo,
      createdAt: { seconds: Math.floor(paidDate.getTime() / 1000) },
    };
  }

  async function savePayment(student) {
    if (isFreeStudent(student)) return;

    try {
      const calc = computeStudentPayment(student);
      if (!calc) {
        alert("Ardaygan Monthly Fee sax ah lama helin.");
        return;
      }

      setSavingId(student.id);

      const [reserved] = await reserveReceiptNumbers(1);
      const paidDate = new Date();

      const batch = writeBatch(db);
      const receiptForModal = addStudentPaymentToBatch(batch, student, calc, reserved, paidDate);
      await batch.commit();

      setAmounts((prev) => ({ ...prev, [student.id]: "" }));
      setMonthsSelected((prev) => ({ ...prev, [student.id]: "" }));
      setEditingIds((prev) => {
        const next = { ...prev };
        delete next[student.id];
        return next;
      });

      // Rasiidka hore ayaa la kaydiyay — modal-ku kaliya wuu muujinayaa/print
      setReceiptPayment(receiptForModal);
    } catch (err) {
      console.log(err);
      alert(err?.message || "Khalad aan la garanayn ayaa dhacay marka lacagta la kaydinayay.");
    } finally {
      setSavingId(null);
    }
  }

  async function saveAll() {
    const targets = currentClassStudents.filter((s) => {
      if (isFreeStudent(s)) return false;
      const { fullyPaidSet } = getStudentMonthState(s.studentId);
      const paidThisMonth = fullyPaidSet.has(currentMonthKey());
      return !paidThisMonth || editingIds[s.id];
    });

    if (targets.length === 0) {
      alert("Ma jiro arday la kaydin karo.");
      return;
    }

    try {
      setSavingAll(true);

      const prepared = targets
        .map((student) => ({ student, calc: computeStudentPayment(student) }))
        .filter((x) => x.calc);

      if (prepared.length === 0) {
        alert("Ma jiro arday la kaydin karo.");
        return;
      }

      const receiptNos = await reserveReceiptNumbers(prepared.length);
      const paidDate = new Date();

      const newReceipts = [];
      const reportPaidList = [];

      // ~6 qoraal arday kasta -> 50 arday batch kasta (xadka 500)
      for (let i = 0; i < prepared.length; i += 50) {
        const batch = writeBatch(db);
        prepared.slice(i, i + 50).forEach(({ student, calc }, j) => {
          const receipt = addStudentPaymentToBatch(
            batch,
            student,
            calc,
            receiptNos[i + j],
            paidDate
          );
          newReceipts.push(receipt);
          calc.updates.forEach((u) => {
            reportPaidList.push({
              studentId: student.studentId,
              studentName: student.fullName,
              className: student.className || "",
              paidAmount: u.paidAmount,
              status: u.status,
            });
          });
        });
        await batch.commit();
      }

      setAmounts({});
      setMonthsSelected({});
      setEditingIds((prev) => {
        const next = { ...prev };
        targets.forEach((student) => delete next[student.id]);
        return next;
      });

      setReceiptQueue(newReceipts);

      if (reportPaidList.length > 0) {
        generateMonthlyRevenuePDF(reportPaidList);
      }
    } catch (err) {
      console.log(err);
      alert(err?.message || "Khalad aan la garanayn ayaa dhacay marka lacagta la kaydinayay.");
    } finally {
      setSavingAll(false);
    }
  }

  return (
    <div style={{ fontFamily: theme.font.body }}>
      <div style={styles.calendarWidget}>
        <span style={{ fontSize: 18 }}>📅</span>
        <span style={{ fontWeight: 700 }}>
          {now.toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </span>
        <span style={{ marginLeft: "auto", fontWeight: 800, color: theme.colors.brand }}>
          ⏰ {now.toLocaleTimeString("en-US")}
        </span>
      </div>

      {selectedClass ? (
        <div>
          <button
            onClick={() => {
              setSelectedClass(null);
              setSearch("");
            }}
            style={styles.backBtn}
          >
            ← Dib ugu noqo Fasalada
          </button>

          <header style={styles.header}>
            <div>
              <h1 style={styles.title}>{selectedClass}</h1>
              <p style={styles.subtitle}>
                Diiwaan geli oo la soco lacagaha bilaha ee ardayda fasalkan
              </p>
            </div>
            <div style={styles.headerStats}>
              <div style={styles.statPill}>
                <span style={styles.statNum}>{filteredClassStats.total}</span>
                <span style={styles.statLabel}>Students</span>
              </div>
              <div style={styles.statPill}>
                <span style={styles.statNum}>{filteredClassStats.paidThisMonthCount}</span>
                <span style={styles.statLabel}>Paid this month</span>
              </div>
            </div>
          </header>

          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
            <div style={{ ...styles.searchRow, marginBottom: 0, flex: "0 0 360px" }}>
              <span style={styles.searchIcon}>🔍</span>
              <input
                placeholder="Search Student ID / Name"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={styles.search}
              />
            </div>

            <button
              type="button"
              onClick={editAll}
              disabled={savingAll || resettingAll}
              style={{
                ...styles.editAllBtn,
                cursor: savingAll || resettingAll ? "not-allowed" : "pointer",
                opacity: savingAll || resettingAll ? 0.7 : 1,
              }}
            >
              ✏️ Edit All
            </button>

            <button
              type="button"
              onClick={() => setResetDialog(true)}
              disabled={resettingAll || savingAll}
              style={{
                ...styles.resetAllBtn,
                background: theme.colors.danger || "#E53E3E",
                color: "#FFFFFF",
                cursor: resettingAll || savingAll ? "not-allowed" : "pointer",
                opacity: resettingAll || savingAll ? 0.7 : 1,
              }}
            >
              {resettingAll ? "Resetting…" : "🔄 Reset / Unpaid All"}
            </button>

            <button
              onClick={saveAll}
              disabled={savingAll || resettingAll}
              style={{
                ...styles.saveAllBtn,
                background: theme.colors.brand,
                color: "#FFFFFF",
                cursor: savingAll || resettingAll ? "not-allowed" : "pointer",
                opacity: savingAll || resettingAll ? 0.7 : 1,
              }}
            >
              {savingAll ? "Saving…" : "💾 Save All & PDF Report"}
            </button>
          </div>

          <div style={styles.tableCard}>
            {loading ? (
              <div style={styles.emptyState}>
                <div style={styles.spinner} />
                <p style={{ color: theme.colors.inkMuted, marginTop: 12 }}>
                  Loading students...
                </p>
              </div>
            ) : currentClassStudents.length === 0 ? (
              <div style={styles.emptyState}>
                <span style={{ fontSize: 34 }}>🗂️</span>
                <p style={{ color: theme.colors.inkMuted, marginTop: 8 }}>
                  Wax arday ah kuma jiraan fasalkan.
                </p>
              </div>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>ID</th>
                    <th style={styles.th}>Name</th>
                    <th style={styles.th}>Student Phone</th>
                    <th style={styles.th}>Parent Phone</th>
                    <th style={styles.th}>Monthly Fee</th>
                    <th style={styles.th}>Paid</th>
                    <th style={styles.th}>Remaining</th>
                    <th style={styles.th}>Credit</th>
                    <th style={styles.th}>Months</th>
                    <th style={styles.th}>Enter Amount</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Save</th>
                  </tr>
                </thead>

                <tbody>
                  {currentClassStudents.map((student, i) => {
                    const free = isFreeStudent(student);
                    const fee = Number(student.monthlyFee || 0);
                    const { fullyPaidSet, partialMap, records } = getStudentMonthState(student.studentId);
                    
                    const targetMonth = findNextUnpaidMonth(fullyPaidSet, registrationMonthKey(student));
                    const isCurrentMonthPaid = fullyPaidSet.has(currentMonthKey());

                    const isEditing = !!editingIds[student.id];
                    const locked = isCurrentMonthPaid && !isEditing;

                    const partialAmount = partialMap[targetMonth] || 0;
                    const displayPaid = free
                      ? 0
                      : locked
                      ? fee
                      : partialAmount || (amounts[student.id] ? Number(amounts[student.id]) : 0);

                    const displayRemaining = free ? 0 : Math.max(fee - displayPaid, 0);

                    const status = free
                      ? "Free"
                      : isCurrentMonthPaid
                      ? "Paid"
                      : "Not Paid";

                    const isPaidStatus = status === "Paid";
                    const isSaving = savingId === student.id;

                    const thisMonthRecord = records.find((r) => r.monthKey === currentMonthKey());

                    return (
                      <tr
                        key={student.id}
                        style={{ background: i % 2 === 0 ? "#FFFFFF" : "#FAFCFB" }}
                      >
                        <td style={styles.td}>
                          <span style={styles.idChip}>{student.studentId}</span>
                        </td>
                        <td style={{ ...styles.td, fontWeight: 600 }}>
                          <button
                            onClick={() => setProfileStudent(student)}
                            style={styles.nameBtn}
                            title="Eeg profile-ka lacagaha"
                          >
                            {student.fullName}
                          </button>
                        </td>
                        <td style={styles.td}>{student.studentPhone || "—"}</td>
                        <td style={styles.td}>{student.parentPhone || "—"}</td>
                        <td style={{ ...styles.td, ...styles.money }}>
                          {free ? "—" : `$${fee}`}
                        </td>
                        <td style={{ ...styles.td, ...styles.money }}>
                          {free ? (
                            "—"
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <span>${displayPaid}</span>
                              {locked && thisMonthRecord?.createdAt && (
                                <span style={styles.paidDate}>
                                  {formatPaidDate(thisMonthRecord.createdAt)}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td style={{ ...styles.td, ...styles.money }}>
                          {free ? "—" : `$${displayRemaining}`}
                        </td>
                        <td style={{ ...styles.td, ...styles.money }}>
                          {free || Number(student.creditBalance || 0) <= 0 ? (
                            <span style={{ color: theme.colors.inkMuted, fontSize: 12.5 }}>—</span>
                          ) : (
                            <span style={{ color: theme.colors.mintDark, fontWeight: 700 }}>
                              +${student.creditBalance}
                            </span>
                          )}
                        </td>
                        <td style={styles.td}>
                          {free ? (
                            <span style={{ color: theme.colors.inkMuted, fontSize: 12.5 }}>—</span>
                          ) : locked ? (
                            <span style={{ color: theme.colors.inkMuted, fontSize: 12.5 }}>—</span>
                          ) : (
                            <select
                              value={monthsSelected[student.id] || ""}
                              onChange={(e) => selectMonths(student, Number(e.target.value))}
                              style={{
                                ...styles.monthsSelect,
                                background: theme.colors.card,
                                color: theme.colors.ink,
                              }}
                            >
                              <option value="">Months</option>
                              {Array.from({ length: 12 }, (_, idx) => idx + 1).map((m) => (
                                <option key={m} value={m}>
                                  {m} {m === 1 ? "Month" : "Months"}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td style={styles.td}>
                          {free ? (
                            <span style={{ color: theme.colors.inkMuted, fontSize: 12.5 }}>—</span>
                          ) : locked ? (
                            <button
                              type="button"
                              onClick={() => startEdit(student)}
                              style={styles.editBtn}
                            >
                              ✏️ Edit
                            </button>
                          ) : (
                            <input
                              type="number"
                              value={amounts[student.id] || ""}
                              placeholder={`$${fee}`}
                              onChange={(e) =>
                                setAmounts({ ...amounts, [student.id]: e.target.value })
                              }
                              style={{
                                ...styles.amountInput,
                                background: theme.colors.card,
                                color: theme.colors.ink,
                              }}
                            />
                          )}
                        </td>
                        <td style={styles.td}>
                          <span
                            style={{
                              ...styles.badge,
                              color: free
                                ? theme.colors.brand
                                : isPaidStatus
                                ? theme.colors.mintDark
                                : theme.colors.danger,
                              background: free
                                ? `${theme.colors.brand}14`
                                : isPaidStatus
                                ? `${theme.colors.mint}1A`
                                : `${theme.colors.danger}14`,
                            }}
                          >
                            <span
                              style={{
                                ...styles.badgeDot,
                                background: free
                                  ? theme.colors.brand
                                  : isPaidStatus
                                  ? theme.colors.mint
                                  : theme.colors.danger,
                              }}
                            />
                            {status}
                          </span>
                        </td>
                        <td style={styles.td}>
                          {free ? (
                            <span style={{ color: theme.colors.inkMuted, fontSize: 12.5 }}>—</span>
                          ) : (
                            <button
                              onClick={() => savePayment(student)}
                              disabled={locked || isSaving}
                              style={{
                                ...styles.saveBtn,
                                background: locked ? "#DDE4E2" : theme.colors.mint,
                                color: locked ? theme.colors.inkMuted : "#FFFFFF",
                                cursor: locked || isSaving ? "not-allowed" : "pointer",
                                opacity: isSaving ? 0.7 : 1,
                              }}
                            >
                              {locked ? "Paid" : isSaving ? "Saving…" : "Save"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {receiptPayment && (
            <ReceiptModal payment={receiptPayment} onClose={() => setReceiptPayment(null)} />
          )}

          {!receiptPayment && receiptQueue.length > 0 && (
            <ReceiptModal
              payment={receiptQueue[0]}
              onClose={() => setReceiptQueue((prev) => prev.slice(1))}
            />
          )}

          {resetDialog && (
            <div style={resetStyles.overlay} onClick={() => setResetDialog(false)}>
              <div style={resetStyles.card} onClick={(e) => e.stopPropagation()}>
                <h3 style={resetStyles.title}>🔄 Reset / Unpaid All</h3>
                <p style={resetStyles.text}>
                  Lacagaha iyo rasiidyada waxay ka baxayaan Cashier-ka iyo Admin-ka, laakiin
                  backend-ka way ku jirayaan — <strong>Recycle Bin</strong> ayaad ka soo
                  celin kartaa.
                </p>
                <button
                  type="button"
                  onClick={() => resetPayments("class")}
                  style={{ ...resetStyles.option, borderColor: theme.colors.brand }}
                >
                  <strong>Fasalkan oo keliya — {selectedClass}</strong>
                  <span style={resetStyles.optionSub}>
                    Ardayda fasalkan ayaa noqonaya Unpaid. Lambarka rasiidku wuu sii socdaa.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => resetPayments("system")}
                  style={{ ...resetStyles.option, borderColor: theme.colors.danger || "#E53E3E" }}
                >
                  <strong style={{ color: theme.colors.danger || "#E53E3E" }}>
                    Dhammaan System-ka — fasallada oo dhan
                  </strong>
                  <span style={resetStyles.optionSub}>
                    Arday kasta wuxuu noqonayaa Unpaid, lambarka rasiidkuna wuxuu ka
                    bilaabmayaa 001.
                  </span>
                </button>
                <button type="button" onClick={() => setResetDialog(false)} style={resetStyles.cancel}>
                  Ka noqo
                </button>
              </div>
            </div>
          )}

          {profileStudent && (
            <StudentPaymentProfileModal
              student={profileStudent}
              paymentState={getStudentMonthState(profileStudent.studentId)}
              onClose={() => setProfileStudent(null)}
            />
          )}
        </div>
      ) : (
        <div>
          <header style={{ ...styles.header, marginBottom: 18 }}>
            <div>
              <h1 style={styles.title}>Classes</h1>
              <p style={styles.subtitle}>Dooro fasal si aad u aragto ardayda iyo lacagahooda</p>
            </div>
          </header>

          {loading ? (
            <div style={styles.emptyState}>
              <div style={styles.spinner} />
              <p style={{ color: theme.colors.inkMuted, marginTop: 12 }}>Loading classes...</p>
            </div>
          ) : (
            <>
              {/* Full Time Section */}
              <div style={{ marginBottom: 32 }}>
                <h2 style={styles.sectionHeader}>🏫 Full Time Classes</h2>
                <div style={styles.classGrid}>
                  {classGroups
                    .filter(([name]) => fullTimeOptions.includes(name))
                    .map(([className, list]) => (
                      <button
                        key={className}
                        onClick={() => {
                          setSelectedClass(className);
                          setSearch("");
                        }}
                        style={styles.classCard}
                      >
                        <span style={styles.classCardIcon}>🏫</span>
                        <span style={styles.classCardName}>{className}</span>
                        <span style={styles.classCardCount}>
                          {list.length} {list.length === 1 ? "student" : "students"}
                        </span>
                      </button>
                    ))}
                </div>
              </div>

              {/* Part Time Section */}
              <div style={{ marginBottom: 32 }}>
                <h2 style={styles.sectionHeader}>🌙 Part Time Classes</h2>
                <div style={styles.classGrid}>
                  {classGroups
                    .filter(([name]) => partTimeOptions.includes(name))
                    .map(([className, list]) => (
                      <button
                        key={className}
                        onClick={() => {
                          setSelectedClass(className);
                          setSearch("");
                        }}
                        style={{
                          ...styles.classCard,
                          borderColor: theme.colors.amber || "#D97706",
                        }}
                      >
                        <span style={styles.classCardIcon}>🌙</span>
                        <span style={styles.classCardName}>{className}</span>
                        <span style={styles.classCardCount}>
                          {list.length} {list.length === 1 ? "student" : "students"}
                        </span>
                      </button>
                    ))}
                </div>
              </div>

              {/* Extras (if any) */}
              {classGroups.filter(
                ([name]) => !fullTimeOptions.includes(name) && !partTimeOptions.includes(name)
              ).length > 0 && (
                <div>
                  <h2 style={styles.sectionHeader}>📂 Other Classes</h2>
                  <div style={styles.classGrid}>
                    {classGroups
                      .filter(
                        ([name]) =>
                          !fullTimeOptions.includes(name) && !partTimeOptions.includes(name)
                      )
                      .map(([className, list]) => (
                        <button
                          key={className}
                          onClick={() => {
                            setSelectedClass(className);
                            setSearch("");
                          }}
                          style={styles.classCard}
                        >
                          <span style={styles.classCardIcon}>📁</span>
                          <span style={styles.classCardName}>{className}</span>
                          <span style={styles.classCardCount}>
                            {list.length} {list.length === 1 ? "student" : "students"}
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function StudentPaymentProfileModal({ student, paymentState, onClose }) {
  const { records, fullyPaidSet, partialMap } = paymentState;
  const fee = Number(student.monthlyFee || 0);
  const isFree = student.feeType === "Free";
  const creditBalance = Number(student.creditBalance || 0);

  const thisMonthKey = currentMonthKey();
  const paidThisMonth = fullyPaidSet.has(thisMonthKey);
  const partialThisMonth = partialMap[thisMonthKey] || 0;
  const thisMonthPaid = paidThisMonth ? fee : partialThisMonth;
  const thisMonthRemaining = Math.max(fee - thisMonthPaid, 0);
  const thisMonthStatus = isFree ? "Free" : paidThisMonth ? "Paid" : "Not Paid";

  const monthsPaidCount = fullyPaidSet.size;
  const totalPaidAmount = records.reduce((sum, r) => sum + Number(r.paidAmount || 0), 0);

  const creditMonths = fee > 0 ? Math.floor(creditBalance / fee) : 0;

  const firstPaymentRecord =
    records.length > 0
      ? [...records].sort(
          (a, b) => new Date(a.createdAt?.seconds ? a.createdAt.seconds * 1000 : a.createdAt || 0) -
            new Date(b.createdAt?.seconds ? b.createdAt.seconds * 1000 : b.createdAt || 0)
        )[0]
      : null;
  const paymentStartKey = firstPaymentRecord?.monthKey || registrationMonthKey(student);

  const totalCoveredMonths = monthsPaidCount + creditMonths;
  const nextPaymentKey = addMonthsToKey(paymentStartKey, totalCoveredMonths);

  return (
    <div style={profileStyles.overlay} onClick={onClose}>
      <div style={profileStyles.card} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} style={profileStyles.closeX}>
          ✕
        </button>

        <div style={profileStyles.headerRow}>
          <div style={profileStyles.photoCol}>
            <div style={profileStyles.photoWrap}>
              {student.studentPhoto ? (
                <img src={student.studentPhoto} alt="" style={profileStyles.photo} />
              ) : (
                <span style={profileStyles.photoInitial}>
                  {(student.fullName || "?").charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div style={profileStyles.idBadge}>STUDENT ID</div>
            <div style={profileStyles.idValue}>{student.studentId}</div>
          </div>

          <div style={profileStyles.infoCol}>
            <ProfileRow label="Full Name" value={student.fullName || "—"} strong />
            <ProfileRow label="Mother Name" value={student.motherName || "—"} />
            <ProfileRow label="Class" value={student.className || "—"} />
            <ProfileRow label="Parent Phone" value={student.parentPhone || "—"} />
            <ProfileRow label="Student Phone" value={student.studentPhone || "—"} />
          </div>
        </div>

        {isFree ? (
          <div style={profileStyles.feeBox}>
            <p style={{ color: theme.colors.inkMuted, fontSize: 13.5, margin: 0 }}>
              Ardaygan waa <strong>Free</strong> — lacag bille ah lagama rabo.
            </p>
          </div>
        ) : (
          <>
            <div style={profileStyles.feeBox}>
              <div style={profileStyles.feeBoxTitle}>💰 Fee Information</div>
              <ProfileRow label="Type of Fee" value="Monthly Fee" />
              <ProfileRow label="Monthly Fee Amount" value={`$${fee.toFixed(2)}`} />
              <ProfileRow label="Total Paid (this month)" value={`$${thisMonthPaid.toFixed(2)}`} />
              <ProfileRow label="Remaining (this month)" value={`$${thisMonthRemaining.toFixed(2)}`} danger={thisMonthRemaining > 0} />
              {creditBalance > 0 && (
                <>
                  <ProfileRow label="Credit Balance" value={`$${creditBalance.toFixed(2)}`} />
                  <ProfileRow
                    label="Credit Covers"
                    value={`${creditMonths} ${creditMonths === 1 ? "Month" : "Months"}`}
                  />
                </>
              )}
              <div style={profileStyles.statusRow}>
                <span style={profileStyles.rowLabel}>Status</span>
                <span
                  style={{
                    ...profileStyles.statusPill,
                    background: paidThisMonth ? `${theme.colors.mint}1A` : `${theme.colors.danger}14`,
                    color: paidThisMonth ? theme.colors.mintDark : theme.colors.danger,
                  }}
                >
                  {thisMonthStatus} {paidThisMonth && "✓"}
                </span>
              </div>
            </div>

            <div style={profileStyles.summaryGrid}>
              <div style={profileStyles.summaryCardGreen}>
                <div style={profileStyles.summaryTitle}>📅 Payment Summary</div>
                <div style={profileStyles.summaryBig}>Paid For</div>
                <div style={profileStyles.summaryHuge}>
                  {monthsPaidCount} {monthsPaidCount === 1 ? "Month" : "Months"}
                </div>

                {creditMonths > 0 && (
                  <>
                    <div style={profileStyles.summaryLine} />
                    <div style={profileStyles.summaryBig}>Credit Covers</div>
                    <div
                      style={{
                        fontFamily: theme.font.display,
                        fontWeight: 800,
                        fontSize: 20,
                        color: theme.colors.brand,
                        marginTop: 3,
                      }}
                    >
                      {creditMonths} {creditMonths === 1 ? "Month" : "Months"}
                    </div>
                  </>
                )}

                <div style={profileStyles.summaryLine} />
                <div style={profileStyles.summaryTotal}>Total Paid: ${totalPaidAmount.toFixed(2)}</div>
              </div>
              <div style={profileStyles.summaryCardAmber}>
                <div style={profileStyles.summaryTitleAmber}>💵 Fee Summary</div>
                <ProfileRow label="Monthly Fee" value={`$${fee.toFixed(2)}`} compact />
                <ProfileRow
                  label="Paid Months"
                  value={`${monthsPaidCount} ${monthsPaidCount === 1 ? "Month" : "Months"}`}
                  compact
                />
                <ProfileRow
                  label="Credit Covers"
                  value={`${creditMonths} ${creditMonths === 1 ? "Month" : "Months"}`}
                  compact
                />
                <ProfileRow
                  label="Next Payment Due"
                  value={monthLabel(nextPaymentKey)}
                  compact
                  danger
                />
              </div>
            </div>

            <div style={profileStyles.periodBox}>
              <div style={profileStyles.periodTitle}>📆 Payment Period</div>
              <div style={profileStyles.periodRow}>
                <div>
                  <div style={profileStyles.periodLabel}>Payment Start Date</div>
                  <div style={profileStyles.periodValue}>{monthLabel(paymentStartKey)}</div>
                </div>
                <div style={profileStyles.periodArrow}>TO</div>
                <div style={{ textAlign: "right" }}>
                  <div style={profileStyles.periodLabel}>Next Payment Due</div>
                  <div style={{ ...profileStyles.periodValue, color: theme.colors.danger }}>
                    {monthLabel(nextPaymentKey)}
                  </div>
                </div>
              </div>
            </div>

            {paidThisMonth && (
              <div style={profileStyles.alreadyPaidNotice}>
                ✓ Ardaygan horeyba wuu u bixiyay bishan ({monthLabel(thisMonthKey)}) — waxaad ka
                bedeli kartaa "Edit" ee bogga Classes haddii loo baahdo.
              </div>
            )}

            <div style={profileStyles.monthList}>
              <div style={profileStyles.monthListTitle}>Taariikhda Bilaha</div>
              {records.length === 0 ? (
                <p style={{ color: theme.colors.inkMuted, fontSize: 13, margin: 0 }}>
                  Weli lacag lama bixin ardaygan.
                </p>
              ) : (
                records.map((r) => (
                  <div key={r.monthKey} style={profileStyles.row}>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={profileStyles.rowMonth}>{monthLabel(r.monthKey)}</span>
                      <span style={profileStyles.rowPaidDate}>{formatPaidDate(r.createdAt)}</span>
                    </div>
                    <span style={profileStyles.rowAmount}>${Number(r.paidAmount || 0).toFixed(2)}</span>
                    <span
                      style={{
                        ...profileStyles.rowStatus,
                        color: r.status === "Paid" ? theme.colors.mintDark : theme.colors.danger,
                        background:
                          r.status === "Paid" ? `${theme.colors.mint}1A` : `${theme.colors.danger}14`,
                      }}
                    >
                      {r.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        <div style={profileStyles.footerNote}>
          Fadlan hubi in lacagta la bixiyo ka hor inta uusan bisha xigta bilaabmin.
        </div>
      </div>
    </div>
  );
}

function ProfileRow({ label, value, strong, danger, compact }) {
  return (
    <div style={compact ? profileStyles.compactRow : profileStyles.infoRow}>
      <span style={profileStyles.rowLabel}>{label}</span>
      <span
        style={{
          ...(strong ? profileStyles.rowValueStrong : profileStyles.rowValue),
          color: danger ? theme.colors.danger : strong ? theme.colors.ink : theme.colors.ink,
        }}
      >
        {value}
      </span>
    </div>
  );
}

const styles = {
  sectionHeader: {
    fontFamily: theme.font.display,
    fontSize: 18,
    fontWeight: 800,
    color: theme.colors.ink,
    marginBottom: 14,
  },
  calendarWidget: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    background: theme.colors.card,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    padding: "10px 18px",
    marginBottom: 20,
    fontSize: 14,
    color: theme.colors.ink,
    boxShadow: theme.shadow.card,
  },
  backBtn: {
    background: "transparent",
    border: "none",
    color: theme.colors.brand,
    fontWeight: 700,
    fontSize: 13.5,
    cursor: "pointer",
    padding: 0,
    marginBottom: 18,
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 24,
  },
  title: {
    fontFamily: theme.font.display,
    fontWeight: 800,
    fontSize: 26,
    color: theme.colors.ink,
    margin: 0,
  },
  subtitle: { color: theme.colors.inkMuted, fontSize: 14, marginTop: 6 },
  headerStats: { display: "flex", gap: 12 },
  statPill: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 20px",
    borderRadius: theme.radius.md,
    background: theme.colors.card,
    border: `1px solid ${theme.colors.border}`,
    boxShadow: theme.shadow.card,
    minWidth: 96,
  },
  statNum: {
    fontFamily: theme.font.display,
    fontWeight: 800,
    fontSize: 20,
    color: theme.colors.brand,
  },
  statLabel: { fontSize: 11.5, color: theme.colors.inkMuted, marginTop: 2, whiteSpace: "nowrap" },
  searchRow: { position: "relative", width: 360, marginBottom: 20 },
  searchIcon: {
    position: "absolute",
    left: 14,
    top: "50%",
    transform: "translateY(-50%)",
    fontSize: 14,
    opacity: 0.5,
  },
  search: {
    width: "100%",
    padding: "12px 16px 12px 38px",
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`,
    background: theme.colors.card,
    fontSize: 14,
    color: theme.colors.ink,
    outline: "none",
    boxSizing: "border-box",
  },
  saveAllBtn: {
    border: "none",
    padding: "12px 22px",
    borderRadius: theme.radius.sm,
    fontWeight: 700,
    fontSize: 13.5,
    whiteSpace: "nowrap",
  },
  resetAllBtn: {
    border: "none",
    padding: "12px 22px",
    borderRadius: theme.radius.sm,
    fontWeight: 700,
    fontSize: 13.5,
    whiteSpace: "nowrap",
  },
  editAllBtn: {
    border: `1px solid ${theme.colors.border}`,
    background: theme.colors.card,
    color: theme.colors.brand,
    padding: "12px 22px",
    borderRadius: theme.radius.sm,
    fontWeight: 700,
    fontSize: 13.5,
    whiteSpace: "nowrap",
  },
  tableCard: {
    background: theme.colors.card,
    borderRadius: theme.radius.lg,
    boxShadow: theme.shadow.card,
    border: `1px solid ${theme.colors.border}`,
    overflow: "auto",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "60px 24px",
  },
  spinner: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    border: `3px solid ${theme.colors.border}`,
    borderTopColor: theme.colors.mint,
    animation: "spin 0.8s linear infinite",
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13.5 },
  th: {
    textAlign: "left",
    padding: "14px 16px",
    background: theme.colors.brand,
    color: "#FFFFFF",
    fontWeight: 600,
    fontSize: 12.5,
    letterSpacing: 0.3,
    whiteSpace: "nowrap",
  },
  td: {
    padding: "12px 16px",
    color: theme.colors.ink,
    borderBottom: `1px solid ${theme.colors.border}`,
    whiteSpace: "nowrap",
  },
  idChip: {
    display: "inline-block",
    padding: "3px 10px",
    borderRadius: 999,
    background: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    fontSize: 12,
    fontWeight: 700,
    color: theme.colors.brand,
  },
  nameBtn: {
    background: "transparent",
    border: "none",
    padding: 0,
    color: theme.colors.ink,
    fontWeight: 600,
    fontSize: 13.5,
    cursor: "pointer",
    textDecoration: "underline",
    textDecorationColor: theme.colors.border,
    textUnderlineOffset: 3,
  },
  money: { fontVariantNumeric: "tabular-nums", fontWeight: 600 },
  amountInput: {
    width: 90,
    padding: "8px 10px",
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`,
    fontSize: 13.5,
  },
  monthsSelect: {
    width: 100,
    padding: "8px 10px",
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`,
    fontSize: 13,
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "5px 12px",
    borderRadius: 999,
    fontWeight: 700,
    fontSize: 12.5,
  },
  badgeDot: { width: 6, height: 6, borderRadius: "50%" },
  saveBtn: {
    border: "none",
    padding: "9px 18px",
    borderRadius: theme.radius.sm,
    fontWeight: 700,
    fontSize: 13,
  },
  editBtn: {
    border: `1px solid ${theme.colors.border}`,
    background: theme.colors.card,
    color: theme.colors.brand,
    padding: "8px 14px",
    borderRadius: theme.radius.sm,
    fontWeight: 700,
    fontSize: 12.5,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  paidDate: {
    fontSize: 11,
    color: theme.colors.inkMuted,
    fontWeight: 400,
    marginTop: 2,
  },
  classGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: 16,
  },
  classCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 6,
    padding: "20px 18px",
    borderRadius: theme.radius.lg,
    background: theme.colors.card,
    border: `1px solid ${theme.colors.border}`,
    boxShadow: theme.shadow.card,
    cursor: "pointer",
    textAlign: "left",
    fontFamily: theme.font.body,
  },
  classCardIcon: { fontSize: 24 },
  classCardName: {
    fontFamily: theme.font.display,
    fontWeight: 800,
    fontSize: 16,
    color: theme.colors.ink,
    marginTop: 4,
  },
  classCardCount: { fontSize: 12.5, color: theme.colors.inkMuted },
};

const profileStyles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1500,
    padding: 20,
  },
  card: {
    position: "relative",
    background: theme.colors.card,
    borderRadius: theme.radius.lg,
    boxShadow: theme.shadow.raised,
    width: "100%",
    maxWidth: 640,
    maxHeight: "88vh",
    overflowY: "auto",
    padding: "28px 28px 20px",
    fontFamily: theme.font.body,
  },
  closeX: {
    position: "absolute",
    top: 16,
    right: 16,
    background: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: 8,
    width: 30,
    height: 30,
    cursor: "pointer",
    fontSize: 14,
    color: theme.colors.inkMuted,
  },
  headerRow: {
    display: "flex",
    gap: 24,
    marginBottom: 20,
    flexWrap: "wrap",
  },
  photoCol: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    minWidth: 130,
  },
  photoWrap: {
    width: 108,
    height: 108,
    borderRadius: "50%",
    overflow: "hidden",
    border: `3px solid ${theme.colors.mint}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: theme.colors.surface,
  },
  photo: { width: "100%", height: "100%", objectFit: "cover" },
  photoInitial: {
    fontFamily: theme.font.display,
    fontWeight: 800,
    fontSize: 38,
    color: theme.colors.brand,
  },
  idBadge: {
    marginTop: 6,
    fontSize: 10.5,
    fontWeight: 800,
    letterSpacing: 0.5,
    color: "#FFFFFF",
    background: theme.colors.brand,
    padding: "3px 12px",
    borderRadius: 999,
  },
  idValue: {
    fontFamily: theme.font.display,
    fontWeight: 800,
    fontSize: 14,
    color: theme.colors.ink,
  },
  infoCol: { flex: 1, minWidth: 220, display: "flex", flexDirection: "column", gap: 4 },
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    padding: "7px 0",
    borderBottom: `1px solid ${theme.colors.border}`,
    fontSize: 13,
  },
  compactRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    padding: "4px 0",
    fontSize: 12.5,
  },
  rowLabel: { color: theme.colors.inkMuted },
  rowValue: { color: theme.colors.ink, fontWeight: 600 },
  rowValueStrong: {
    color: theme.colors.ink,
    fontWeight: 800,
    fontFamily: theme.font.display,
    fontSize: 15,
  },
  feeBox: {
    background: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    padding: "16px 18px",
    marginBottom: 16,
  },
  feeBoxTitle: {
    fontFamily: theme.font.display,
    fontWeight: 800,
    fontSize: 14,
    color: theme.colors.brand,
    marginBottom: 8,
  },
  statusRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "7px 0",
    fontSize: 13,
  },
  statusPill: {
    fontWeight: 800,
    fontSize: 12,
    padding: "4px 14px",
    borderRadius: 999,
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
    marginBottom: 16,
  },
  summaryCardGreen: {
    background: `${theme.colors.mint}12`,
    border: `1px solid ${theme.colors.mint}55`,
    borderRadius: theme.radius.md,
    padding: 16,
  },
  summaryCardAmber: {
    background: `${theme.colors.amber}14`,
    border: `1px solid ${theme.colors.amber}55`,
    borderRadius: theme.radius.md,
    padding: 16,
  },
  summaryTitle: {
    fontFamily: theme.font.display,
    fontWeight: 800,
    fontSize: 12.5,
    color: theme.colors.mintDark,
    marginBottom: 6,
  },
  summaryTitleAmber: {
    fontFamily: theme.font.display,
    fontWeight: 800,
    fontSize: 12.5,
    color: "#92400E",
    marginBottom: 6,
  },
  summaryBig: { fontSize: 12.5, color: theme.colors.inkMuted },
  summaryHuge: {
    fontFamily: theme.font.display,
    fontWeight: 800,
    fontSize: 24,
    color: theme.colors.mintDark,
    marginTop: 2,
  },
  summaryLine: { borderTop: `1px dashed ${theme.colors.mint}55`, margin: "10px 0" },
  summaryTotal: { fontSize: 13, fontWeight: 700, color: theme.colors.mintDark },
  periodBox: {
    background: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    padding: 16,
    marginBottom: 16,
  },
  periodTitle: {
    fontFamily: theme.font.display,
    fontWeight: 800,
    fontSize: 13,
    color: theme.colors.brand,
    marginBottom: 10,
  },
  periodRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  periodLabel: { fontSize: 11.5, color: theme.colors.inkMuted },
  periodValue: {
    fontFamily: theme.font.display,
    fontWeight: 800,
    fontSize: 14,
    color: theme.colors.mintDark,
    marginTop: 2,
  },
  periodArrow: {
    fontSize: 11,
    fontWeight: 800,
    color: theme.colors.inkMuted,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: "50%",
    width: 32,
    height: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  alreadyPaidNotice: {
    background: `${theme.colors.mint}1A`,
    border: `1px solid ${theme.colors.mint}`,
    color: theme.colors.mintDark,
    borderRadius: theme.radius.sm,
    padding: "10px 14px",
    fontSize: 12.5,
    fontWeight: 600,
    marginBottom: 16,
  },
  monthList: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 },
  monthListTitle: {
    fontFamily: theme.font.display,
    fontWeight: 800,
    fontSize: 13,
    color: theme.colors.ink,
    marginBottom: 4,
  },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 12px",
    borderRadius: theme.radius.sm,
    background: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
  },
  rowMonth: { fontSize: 13, fontWeight: 600, color: theme.colors.ink },
  rowPaidDate: { fontSize: 11, color: theme.colors.inkMuted, marginTop: 2 },
  rowAmount: {
    fontSize: 13,
    fontWeight: 700,
    color: theme.colors.ink,
    fontVariantNumeric: "tabular-nums",
  },
  rowStatus: { fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 999 },
  footerNote: {
    textAlign: "center",
    fontSize: 11.5,
    color: theme.colors.inkMuted,
    borderTop: `1px solid ${theme.colors.border}`,
    paddingTop: 12,
  },
};


const resetStyles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2100,
    padding: 16,
  },
  card: {
    background: "#FFFFFF",
    borderRadius: 16,
    padding: "22px 22px 18px",
    width: 460,
    maxWidth: "100%",
    boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  title: { margin: 0, fontSize: 19, fontWeight: 800, color: "#0F2E26" },
  text: { margin: 0, fontSize: 13.5, color: "#4B5563", lineHeight: 1.5 },
  option: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 4,
    textAlign: "left",
    padding: "12px 14px",
    borderRadius: 12,
    border: "2px solid",
    background: "#FFFFFF",
    cursor: "pointer",
    fontSize: 14.5,
    color: "#0F2E26",
  },
  optionSub: { fontSize: 12.5, color: "#6B7280", fontWeight: 500 },
  cancel: {
    marginTop: 2,
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #E5E7EB",
    background: "#F9FAFB",
    color: "#374151",
    fontWeight: 700,
    cursor: "pointer",
  },
};