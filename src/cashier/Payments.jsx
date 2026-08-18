//src/cashier/Payments.jsx // rise school
import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../firebase/firebase";
import { theme } from "./theme.js";
import ReceiptModal from "./ReceiptModal.jsx";

const SCHOOL_NAME = "Rising School"; // beddel magaca dugsigaaga haddii loo baahdo

const currentMonthKey = () => new Date().toISOString().slice(0, 7); // "2026-07"

const monthLabel = (key) => {
  if (!key) return "—";
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

export default function Payments() {
  const [students, setStudents] = useState([]);
  const [payments, setPayments] = useState({});
  const [search, setSearch] = useState("");
  const [amounts, setAmounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [receiptPayment, setReceiptPayment] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Xogta ardayda saxda ah waxay ku jirtaa collection-ka "students"
      // ee laga sameeyay Add Student / Bulk Registration.
      const studentsSnap = await getDocs(collection(db, "students"));
      const studentData = studentsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        // Ka reeb xogta aan lahayn studentId ama fullName sax ah —
        // taasi waa waxa keenayay safafka "—" ee madhan.
        // Ka reeb sidoo kale ardayda la calaamadeeyay pendingDeletion —
        // isla markiiba ha ka baxeen Cashier/Payments, xitaa haddii
        // backend-ku uusan weli si buuxda uga tirtirin Firestore.
        .filter(
          (s) =>
            !s.pendingDeletion &&
            s.studentId &&
            String(s.studentId).trim() !== "" &&
            s.fullName &&
            String(s.fullName).trim() !== ""
        );

      setStudents(studentData);

      // Liis ka mid ah studentId-yada ardayda wali JIRA — waxa loo
      // isticmaalayaa in payments-ka arday la tirtiray aan lagu
      // muujin miiska (haddii diiwaan-payment uu weli ku hadhay
      // Firestore isaga oo aan si buuxda loo sync-garayn).
      const activeStudentIds = new Set(studentData.map((s) => s.studentId));

      const paymentsSnap = await getDocs(collection(db, "payments"));
      const paymentMap = {};
      paymentsSnap.docs.forEach((d) => {
        const data = d.data();
        const sid = data.studentId;
        if (!sid) return;
        if (!activeStudentIds.has(sid)) return; // arday la tirtiray — iska dhaaf
        // Hay boqolka ugu dambeeyay ee bishaas studentId-gan
        if (
          !paymentMap[sid] ||
          (data.createdAt?.seconds || 0) >
            (paymentMap[sid].createdAt?.seconds || 0)
        ) {
          paymentMap[sid] = data;
        }
      });
      setPayments(paymentMap);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = students.filter((s) => {
    const text = search.toLowerCase();
    return (
      (s.studentId || "").toLowerCase().includes(text) ||
      (s.fullName || "").toLowerCase().includes(text) ||
      (s.className || "").toLowerCase().includes(text)
    );
  });

  const isFreeStudent = (student) => student.feeType === "Free";

  const isPaidThisMonth = (studentId) => {
    const record = payments[studentId];
    if (!record) return false;
    return record.monthKey === currentMonthKey() && record.status === "Paid";
  };

  const savePayment = async (student) => {
    if (isFreeStudent(student)) return;

    const entered = Number(amounts[student.id] || 0);

    if (entered <= 0) {
      alert("Fadlan geli lacagta la bixiyay");
      return;
    }

    const fee = Number(student.monthlyFee || 0);
    const remaining = fee - entered;
    const status = remaining <= 0 ? "Paid" : "Not Paid";
    const monthKey = currentMonthKey();

    // Diiwaan gaar ah oo bishan iyo ardaygan u gaar ah — si aan
    // boqol hore loo tirtirin marka mar kale la kaydiyo.
    const paymentDocId = `${student.studentId}_${monthKey}`;

    try {
      setSavingId(student.id);

      const paymentRecord = {
        studentId: student.studentId,
        studentName: student.fullName,
        className: student.className || "",
        schoolName: SCHOOL_NAME,
        monthlyFee: fee,
        paidAmount: entered,
        remaining: remaining > 0 ? remaining : 0,
        status,
        monthKey,
        monthLabel: monthLabel(monthKey),
        studentPhone: student.studentPhone || "",
        parentPhone: student.parentPhone || "",
        createdAt: serverTimestamp(),
      };

      await setDoc(doc(db, "payments", paymentDocId), paymentRecord);

      setPayments({
        ...payments,
        [student.studentId]: {
          status,
          monthKey,
          monthLabel: monthLabel(monthKey),
          paidAmount: entered,
          remaining: remaining > 0 ? remaining : 0,
          schoolName: SCHOOL_NAME,
          studentName: student.fullName,
        },
      });

      setAmounts({
        ...amounts,
        [student.id]: "",
      });

      // U dir rasiidka automatic — waxaa loo isticmaalayaa taariikhda
      // dhabta ah ee hadda (serverTimestamp weli lama soo celin), si
      // rasiidku u tuso wakhtiga saxda ah ee lacagta la bixiyay.
      setReceiptPayment({
        ...paymentRecord,
        createdAt: { seconds: Math.floor(Date.now() / 1000) },
      });
    } catch (err) {
      console.log(err);
      alert(err.message);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div style={{ fontFamily: theme.font.body }}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Student Payments</h1>
          <p style={styles.subtitle}>
            Diiwaan geli oo la soco lacagaha bilaha ee ardayda
          </p>
        </div>
        <div style={styles.headerStats}>
          <div style={styles.statPill}>
            <span style={styles.statNum}>{students.length}</span>
            <span style={styles.statLabel}>Students</span>
          </div>
          <div style={styles.statPill}>
            <span style={styles.statNum}>
              {
                students.filter(
                  (s) => !isFreeStudent(s) && isPaidThisMonth(s.studentId)
                ).length
              }
            </span>
            <span style={styles.statLabel}>Paid this month</span>
          </div>
        </div>
      </header>

      <div style={styles.searchRow}>
        <span style={styles.searchIcon}>🔍</span>
        <input
          placeholder="Search Student ID / Name / Class"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.search}
        />
      </div>

      <div style={styles.tableCard}>
        {loading ? (
          <div style={styles.emptyState}>
            <div style={styles.spinner} />
            <p style={{ color: theme.colors.inkMuted, marginTop: 12 }}>
              Loading students...
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={styles.emptyState}>
            <span style={{ fontSize: 34 }}>🗂️</span>
            <p style={{ color: theme.colors.inkMuted, marginTop: 8 }}>
              {students.length === 0
                ? "Weli ma jiraan arday xog dhan leh oo diiwaan gashan."
                : "No students match your search."}
            </p>
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>ID</th>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Class</th>
                <th style={styles.th}>Student Phone</th>
                <th style={styles.th}>Parent Phone</th>
                <th style={styles.th}>Monthly Fee</th>
                <th style={styles.th}>Paid</th>
                <th style={styles.th}>Remaining</th>
                <th style={styles.th}>Enter Amount</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Save</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((student, i) => {
                const free = isFreeStudent(student);
                const paidThisMonth = !free && isPaidThisMonth(student.studentId);
                const record = payments[student.studentId];

                const entered = Number(amounts[student.id] || 0);
                const fee = Number(student.monthlyFee || 0);

                let displayPaid = paidThisMonth ? record.paidAmount : entered;
                let displayRemaining = paidThisMonth
                  ? record.remaining
                  : Math.max(fee - entered, 0);

                const status = free
                  ? "Free"
                  : paidThisMonth
                  ? "Paid"
                  : entered > 0
                  ? entered >= fee
                    ? "Paid"
                    : "Not Paid"
                  : "Not Paid";

                const isPaidStatus = status === "Paid";
                const isSaving = savingId === student.id;

                return (
                  <tr
                    key={student.id}
                    style={{
                      background: i % 2 === 0 ? "#FFFFFF" : "#FAFCFB",
                    }}
                  >
                    <td style={styles.td}>
                      <span style={styles.idChip}>{student.studentId}</span>
                    </td>
                    <td style={{ ...styles.td, fontWeight: 600 }}>
                      {student.fullName}
                    </td>
                    <td style={styles.td}>{student.className || "—"}</td>
                    <td style={styles.td}>{student.studentPhone || "—"}</td>
                    <td style={styles.td}>{student.parentPhone || "—"}</td>
                    <td style={{ ...styles.td, ...styles.money }}>
                      {free ? "—" : `$${fee}`}
                    </td>
                    <td style={{ ...styles.td, ...styles.money }}>
                      {free ? "—" : `$${displayPaid}`}
                    </td>
                    <td style={{ ...styles.td, ...styles.money }}>
                      {free ? "—" : `$${displayRemaining}`}
                    </td>
                    <td style={styles.td}>
                      {free ? (
                        <span style={{ color: theme.colors.inkMuted, fontSize: 12.5 }}>
                          —
                        </span>
                      ) : (
                        <input
                          type="number"
                          disabled={paidThisMonth}
                          value={amounts[student.id] || ""}
                          onChange={(e) =>
                            setAmounts({
                              ...amounts,
                              [student.id]: e.target.value,
                            })
                          }
                          style={{
                            ...styles.amountInput,
                            background: paidThisMonth
                              ? "#F0F3F2"
                              : theme.colors.card,
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
                        <span style={{ color: theme.colors.inkMuted, fontSize: 12.5 }}>
                          —
                        </span>
                      ) : (
                        <button
                          onClick={() => savePayment(student)}
                          disabled={paidThisMonth || isSaving}
                          style={{
                            ...styles.saveBtn,
                            background: paidThisMonth
                              ? "#DDE4E2"
                              : theme.colors.mint,
                            color: paidThisMonth
                              ? theme.colors.inkMuted
                              : "#FFFFFF",
                            cursor:
                              paidThisMonth || isSaving
                                ? "not-allowed"
                                : "pointer",
                            opacity: isSaving ? 0.7 : 1,
                          }}
                        >
                          {paidThisMonth ? "Paid" : isSaving ? "Saving…" : "Save"}
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
        <ReceiptModal
          payment={receiptPayment}
          onClose={() => setReceiptPayment(null)}
        />
      )}
    </div>
  );
}

const styles = {
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
  subtitle: {
    color: theme.colors.inkMuted,
    fontSize: 14,
    marginTop: 6,
  },
  headerStats: {
    display: "flex",
    gap: 12,
  },
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
  statLabel: {
    fontSize: 11.5,
    color: theme.colors.inkMuted,
    marginTop: 2,
    whiteSpace: "nowrap",
  },
  searchRow: {
    position: "relative",
    width: 360,
    marginBottom: 20,
  },
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
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13.5,
  },
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
  money: {
    fontVariantNumeric: "tabular-nums",
    fontWeight: 600,
  },
  amountInput: {
    width: 90,
    padding: "8px 10px",
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`,
    fontSize: 13.5,
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
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
  },
  saveBtn: {
    border: "none",
    padding: "9px 18px",
    borderRadius: theme.radius.sm,
    fontWeight: 700,
    fontSize: 13,
  },
};