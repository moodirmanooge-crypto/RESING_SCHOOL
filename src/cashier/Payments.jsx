// src/cashier/Payments.jsx
import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";

import { db } from "../firebase/firebase";
import { theme } from "./theme.js";

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

export default function Payments() {
  const [students, setStudents] = useState([]);
  const [paymentsByStudent, setPaymentsByStudent] = useState({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const studentsSnap = await getDocs(collection(db, "students"));
      const studentData = studentsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter(
          (s) =>
            !s.pendingDeletion &&
            s.studentId &&
            String(s.studentId).trim() !== "" &&
            s.fullName &&
            String(s.fullName).trim() !== ""
        );
      setStudents(studentData);

      const paymentsSnap = await getDocs(collection(db, "payments"));
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
      (s.className || "").toLowerCase().includes(text) ||
      (s.feeCategory || "").toLowerCase().includes(text)
    );
  });

  const isFreeStudent = (student) => student.feeType === "Free";

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

  const paidThisMonthCount = students.filter((s) => {
    if (isFreeStudent(s)) return false;
    const { fullyPaidSet } = getStudentMonthState(s.studentId);
    return fullyPaidSet.has(currentMonthKey());
  }).length;

  return (
    <div style={{ fontFamily: theme.font.body }}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Student Payments</h1>
          <p style={styles.subtitle}>
            Diiwaan geli oo la soco lacagaha bilaha ee ardayda (daawasho oo kaliya)
          </p>
        </div>
        <div style={styles.headerStats}>
          <div style={styles.statPill}>
            <span style={styles.statNum}>{students.length}</span>
            <span style={styles.statLabel}>Students</span>
          </div>
          <div style={styles.statPill}>
            <span style={styles.statNum}>{paidThisMonthCount}</span>
            <span style={styles.statLabel}>Paid this month</span>
          </div>
        </div>
      </header>

      <div style={styles.collectingForBar}>
        📅 Collecting for: <strong>{monthLabel(currentMonthKey())}</strong>
      </div>

      <div style={{ ...styles.searchRow, width: "auto" }}>
        <span style={styles.searchIcon}>🔍</span>
        <input
          placeholder="Search ID / Name / Class / Category"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...styles.search, width: 360 }}
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
                <th style={styles.th}>Fee Type</th>
                <th style={styles.th}>Fee Category</th>
                <th style={styles.th}>Monthly Fee</th>
                <th style={styles.th}>Paid</th>
                <th style={styles.th}>Remaining</th>
                <th style={styles.th}>Status</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((student, i) => {
                const free = isFreeStudent(student);
                const fee = Number(student.monthlyFee || 0);
                const { fullyPaidSet, partialMap, records } = getStudentMonthState(
                  student.studentId
                );
                const paidThisMonth = !free && fullyPaidSet.has(currentMonthKey());
                const thisMonthRecord = records.find(
                  (r) => r.monthKey === currentMonthKey()
                );

                const nextUnpaid = findNextUnpaidMonth(
                  fullyPaidSet,
                  registrationMonthKey(student)
                );
                const displayRemaining = free
                  ? 0
                  : Math.max(fee - (partialMap[nextUnpaid] || 0), 0);

                const displayPaid = free
                  ? 0
                  : paidThisMonth
                  ? thisMonthRecord?.paidAmount ?? fee
                  : partialMap[currentMonthKey()] || 0;

                const status = free ? "Free" : paidThisMonth ? "Paid" : "Not Paid";
                const isPaidStatus = status === "Paid";

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
                    <td style={styles.td}>
                      <span
                        style={{
                          fontWeight: 600,
                          color: free
                            ? theme.colors.brand
                            : isPaidStatus
                            ? theme.colors.mintDark
                            : theme.colors.danger,
                        }}
                      >
                        {status}
                      </span>
                    </td>
                    <td style={styles.td}>
                      {student.feeCategory || "Standard Fee"}
                    </td>
                    <td style={{ ...styles.td, ...styles.money }}>
                      {free ? "—" : `$${fee}`}
                    </td>
                    <td style={{ ...styles.td, ...styles.money }}>
                      {free ? (
                        "—"
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span>${displayPaid}</span>
                          {paidThisMonth && thisMonthRecord?.createdAt && (
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const styles = {
  collectingForBar: {
    display: "inline-block",
    background: `${theme.colors.brand}0D`,
    border: `1px solid ${theme.colors.brand}33`,
    color: theme.colors.brand,
    fontWeight: 700,
    fontSize: 13,
    padding: "8px 16px",
    borderRadius: theme.radius.sm,
    marginBottom: 12,
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
  paidDate: {
    fontSize: 11,
    color: theme.colors.inkMuted,
    fontWeight: 400,
    marginTop: 2,
  },
};