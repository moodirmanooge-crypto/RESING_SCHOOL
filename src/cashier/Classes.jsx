// src/cashier/Classes.jsx
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  writeBatch,
  serverTimestamp,
  query,
  where,
  onSnapshot,
  getDocs,
} from "firebase/firestore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { db } from "../firebase/firebase";
import { theme } from "./theme.js";
import ReceiptModal from "./ReceiptModal.jsx";

const SCHOOL_NAME = "Rising Star School";

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

const currentMonthKey = () => new Date().toISOString().slice(0, 7);

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
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return d.toISOString().slice(0, 7);
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
  const ts = student.createdAt;
  if (ts?.seconds) {
    return new Date(ts.seconds * 1000).toISOString().slice(0, 7);
  }
  return currentMonthKey();
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

// Kalasoocida fasalka saxda ah
function getNormalizedClassName(student) {
  const rawClass = String(student.className || "").trim();
  if (!rawClass) return "Unknown";

  const isPartTime =
    student.isPartTime === true ||
    student.studyType === "Part Time" ||
    student.sourceCollection === "partTimeStudents" ||
    rawClass.toLowerCase().includes("part time");

  const cleanBase = rawClass.replace(/part\s*time/i, "").trim();

  if (isPartTime) {
    return `${cleanBase} Part Time`;
  }
  return cleanBase;
}

export default function Classes() {
  const [regularStudents, setRegularStudents] = useState({});
  const [partTimeStudents, setPartTimeStudents] = useState({});
  const [cashierDocs, setCashierDocs] = useState([]);

  const [paymentsByStudent, setPaymentsByStudent] = useState({});
  const [loading, setLoading] = useState(true);

  const [selectedClass, setSelectedClass] = useState(null);
  const [search, setSearch] = useState("");
  const [amounts, setAmounts] = useState({});
  const [monthsSelected, setMonthsSelected] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [savingAll, setSavingAll] = useState(false);
  const [resettingAll, setResettingAll] = useState(false);
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

    // 1. Soo akhrinta collection-ka regular students[cite: 9]
    const unsubStudents = onSnapshot(
      collection(db, "students"),
      (snap) => {
        const map = {};
        snap.docs.forEach((d) => {
          const data = d.data();
          const sId = data.studentId || d.id;
          map[sId] = { ...data, sourceCollection: "students" };
        });
        setRegularStudents(map);
      },
      (err) => console.error("Error fetching students:", err)
    );

    // 2. Soo akhrinta collection-ka partTimeStudents[cite: 9]
    const unsubPartTime = onSnapshot(
      collection(db, "partTimeStudents"),
      (snap) => {
        const map = {};
        snap.docs.forEach((d) => {
          const data = d.data();
          const sId = data.studentId || d.id;
          map[sId] = {
            ...data,
            isPartTime: true,
            sourceCollection: "partTimeStudents",
          };
        });
        setPartTimeStudents(map);
      },
      (err) => console.error("Error fetching partTimeStudents:", err)
    );

    // 3. Soo akhrinta cashier docs[cite: 9]
    const unsubCashier = onSnapshot(
      collection(db, "cashier"),
      (snap) => {
        setCashierDocs(snap.docs);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching cashier collection:", err);
        setLoading(false);
      }
    );

    const unsubPayments = onSnapshot(
      collection(db, "payments"),
      (paymentsSnap) => {
        const byStudent = {};
        paymentsSnap.docs.forEach((d) => {
          const data = d.data();
          const sid = data.studentId;
          if (!sid) return;
          if (!byStudent[sid]) byStudent[sid] = [];
          byStudent[sid].push(data);
        });
        Object.keys(byStudent).forEach((sid) => {
          byStudent[sid].sort((a, b) => (a.monthKey || "").localeCompare(b.monthKey || ""));
        });
        setPaymentsByStudent(byStudent);
      },
      (err) => {
        console.error("Error fetching payments:", err);
      }
    );

    return () => {
      unsubStudents();
      unsubPartTime();
      unsubCashier();
      unsubPayments();
    };
  }, []);

  // Isku dubaridka iyo sifeynta ardayda (Filter-garaynta sugan) oo laga hortagayo Unknown iyo Race Condition
  const students = useMemo(() => {
    const allStudentsMap = { ...regularStudents, ...partTimeStudents };

    return cashierDocs
      .map((d) => {
        const data = d.data();
        const sid = data.studentId || d.id;
        const mainData = allStudentsMap[sid];

        // Haddii uusan ardaygu ka jirin students ama partTimeStudents, iska reeb si uusan ugu soo bixin Unknown
        if (!mainData) return null;

        const merged = {
          id: d.id,
          fullName: data.studentName || data.fullName,
          ...mainData,
          ...data,
        };

        const actualClass = getNormalizedClassName(merged);

        return {
          ...merged,
          className: actualClass,
        };
      })
      .filter(
        (s) =>
          s !== null &&
          !s.pendingDeletion &&
          s.studentId &&
          String(s.studentId).trim() !== ""
      );
  }, [regularStudents, partTimeStudents, cashierDocs]);

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
    const list = students.filter((s) => (s.className || "Unknown") === selectedClass);
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
    const records = paymentsByStudent[studentId] || [];
    const fullyPaidSet = new Set();
    const partialMap = {};
    records.forEach((r) => {
      if (!r.monthKey) return;
      if (r.status === "Paid") fullyPaidSet.add(r.monthKey);
      else if (r.paidAmount) partialMap[r.monthKey] = r.paidAmount;
    });
    return { records, fullyPaidSet, partialMap };
  }

  const filteredClassStats = useMemo(() => {
    const paidThisMonthCount = currentClassStudents.filter((s) => {
      if (isFreeStudent(s)) return false;
      const { fullyPaidSet } = getStudentMonthState(s.studentId);
      return fullyPaidSet.has(currentMonthKey()) || s.feeType === "Paid";
    }).length;
    return { total: currentClassStudents.length, paidThisMonthCount };
  }, [currentClassStudents, paymentsByStudent]);

  const startEdit = (student) => {
    const fee = Number(student.monthlyFee || 0);
    const { fullyPaidSet, partialMap } = getStudentMonthState(student.studentId);
    const thisMonthKey = currentMonthKey();
    const paidThisMonth = fullyPaidSet.has(thisMonthKey) || student.feeType === "Paid";
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
      return fullyPaidSet.has(thisMonthKey) || s.feeType === "Paid";
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

  async function resetClassPayments() {
    if (!selectedClass) return;
    const confirmReset = window.confirm(
      `Ma weyddiisanaysaa in dhammaan lacagaha iyo rasiidhyada ardayda fasalka "${selectedClass}" laga dhigo Unpaid (Tir dhan)?`
    );
    if (!confirmReset) return;

    try {
      setResettingAll(true);
      const batch = writeBatch(db);

      const studentDocIds = currentClassStudents.map((s) => s.id);

      studentDocIds.forEach((id) => {
        batch.update(doc(db, "cashier", id), {
          creditBalance: 0,
          feeType: "Unpaid",
        });
      });

      const paymentsSnap = await getDocs(
        query(collection(db, "payments"), where("className", "==", selectedClass))
      );
      paymentsSnap.docs.forEach((docSnap) => batch.delete(docSnap.ref));

      const receiptCashierSnap = await getDocs(
        query(collection(db, "receiptCashier"), where("className", "==", selectedClass))
      );
      receiptCashierSnap.docs.forEach((docSnap) => batch.delete(docSnap.ref));

      await batch.commit();

      setAmounts({});
      setMonthsSelected({});
      setEditingIds({});
      setReceiptQueue([]);
      setReceiptPayment(null);

      alert(`Dhamaan xogta fasalka ${selectedClass} waa la Reset-gareeyay.`);
    } catch (err) {
      console.error(err);
      alert("Khalad ayaa dhacay marka xogta la tirayay.");
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

  async function savePayment(student) {
    if (isFreeStudent(student)) return;

    try {
      const monthlyFee = Number(student.monthlyFee || 0);
      if (monthlyFee <= 0) {
        alert("Ardaygan Monthly Fee sax ah lama helin.");
        return;
      }

      let entered = Number(amounts[student.id] || 0);
      if (entered <= 0) {
        entered = monthlyFee;
      }

      const { fullyPaidSet, partialMap } = getStudentMonthState(student.studentId);

      const workingFullyPaidSet = new Set(fullyPaidSet);
      const workingPartialMap = { ...partialMap };
      if (editingIds[student.id]) {
        workingFullyPaidSet.delete(currentMonthKey());
        delete workingPartialMap[currentMonthKey()];
      }

      const startKey = findNextUnpaidMonth(
        workingFullyPaidSet,
        registrationMonthKey(student)
      );

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

      setSavingId(student.id);

      const batch = writeBatch(db);

      batch.update(doc(db, "cashier", student.id), {
        feeType: "Paid",
        creditBalance: newCreditBalance,
        className: student.className,
      });

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
        createdAt: serverTimestamp(),
      });

      await batch.commit();

      setAmounts((prev) => ({ ...prev, [student.id]: "" }));
      setMonthsSelected((prev) => ({ ...prev, [student.id]: "" }));
      setEditingIds((prev) => {
        const next = { ...prev };
        delete next[student.id];
        return next;
      });

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

      setReceiptPayment({
        studentId: student.studentId,
        studentName: student.fullName,
        className: student.className || "",
        schoolName: SCHOOL_NAME,
        monthLabel: receiptMonthLabel,
        paidAmount: entered,
        creditBalanceAfter: newCreditBalance,
        createdAt: { seconds: Math.floor(Date.now() / 1000) },
      });
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
      const paidThisMonth = fullyPaidSet.has(currentMonthKey()) || s.feeType === "Paid";
      return !paidThisMonth || editingIds[s.id];
    });

    if (targets.length === 0) {
      alert("Ma jiro arday la kaydin karo.");
      return;
    }

    try {
      setSavingAll(true);

      const batch = writeBatch(db);
      const newReceipts = [];
      const reportPaidList = [];

      targets.forEach((student) => {
        const monthlyFee = Number(student.monthlyFee || 0);
        if (monthlyFee <= 0) return;

        let entered = Number(amounts[student.id] || 0);
        if (entered <= 0) {
          entered = monthlyFee;
        }

        const { fullyPaidSet, partialMap } = getStudentMonthState(student.studentId);

        const workingFullyPaidSet = new Set(fullyPaidSet);
        const workingPartialMap = { ...partialMap };
        if (editingIds[student.id]) {
          workingFullyPaidSet.delete(currentMonthKey());
          delete workingPartialMap[currentMonthKey()];
        }

        const startKey = findNextUnpaidMonth(
          workingFullyPaidSet,
          registrationMonthKey(student)
        );

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

        batch.update(doc(db, "cashier", student.id), {
          feeType: "Paid",
          creditBalance: newCreditBalance,
          className: student.className,
        });

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
            createdAt: serverTimestamp(),
          });

          reportPaidList.push({
            studentId: student.studentId,
            studentName: student.fullName,
            className: student.className || "",
            paidAmount: u.paidAmount,
            status: u.status,
          });
        });

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

        newReceipts.push({
          studentId: student.studentId,
          studentName: student.fullName,
          className: student.className || "",
          schoolName: SCHOOL_NAME,
          monthLabel: receiptMonthLabel,
          paidAmount: entered,
          creditBalanceAfter: newCreditBalance,
          createdAt: { seconds: Math.floor(Date.now() / 1000) },
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
          createdAt: serverTimestamp(),
        });
      });

      await batch.commit();

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
              onClick={resetClassPayments}
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
                    const isCurrentMonthPaid = fullyPaidSet.has(currentMonthKey()) || student.feeType === "Paid";

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
  const paidThisMonth = fullyPaidSet.has(thisMonthKey) || student.feeType === "Paid";
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