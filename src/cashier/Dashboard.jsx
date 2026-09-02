// src/cashier/Dashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";

import { db } from "../firebase/firebase";
import { theme } from "./theme.js";

const currentMonthKey = () => new Date().toISOString().slice(0, 7);

const isToday = (ts) => {
  if (!ts || !ts.seconds) return false;
  const d = new Date(ts.seconds * 1000);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
};

function formatDate(ts) {
  if (!ts?.seconds) return "—";
  const d = new Date(ts.seconds * 1000);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Dashboard() {
  const [students, setStudents] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  // State-ka Modal-ka lagu muujinayo liiska
  const [selectedCategory, setSelectedCategory] = useState(null);

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
            s.studentId &&
            String(s.studentId).trim() !== "" &&
            s.fullName &&
            String(s.fullName).trim() !== ""
        );
      setStudents(studentData);

      const paymentsSnap = await getDocs(collection(db, "payments"));
      setPayments(paymentsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const monthKey = currentMonthKey();
    const monthPayments = payments.filter((p) => p.monthKey === monthKey);

    // 1. Today's Payments
    const todaysPaymentsList = monthPayments.filter((p) => isToday(p.createdAt));
    const todaysCollection = todaysPaymentsList.reduce(
      (sum, p) => sum + Number(p.paidAmount || 0),
      0
    );

    // 2. Monthly Payments
    const monthlyCollection = monthPayments.reduce(
      (sum, p) => sum + Number(p.paidAmount || 0),
      0
    );

    // 3. Paid Students
    const paidStudentIds = new Set(
      monthPayments.filter((p) => p.status === "Paid").map((p) => p.studentId)
    );
    const payableStudents = students.filter((s) => s.feeType !== "Free");

    const paidStudentsList = payableStudents.filter((s) =>
      paidStudentIds.has(s.studentId)
    );

    // 4. Remaining Students
    const remainingStudentsList = payableStudents.filter(
      (s) => !paidStudentIds.has(s.studentId)
    );

    return {
      todaysCollection,
      todaysPaymentsList,
      monthlyCollection,
      monthlyPaymentsList: monthPayments,
      studentsPaid: paidStudentsList.length,
      paidStudentsList,
      studentsRemaining: remainingStudentsList.length,
      remainingStudentsList,
    };
  }, [students, payments]);

  // Kaliya 4-ta kaard ee aad rabto ayaan halkan ku reebnay
  const STATS = [
    {
      id: "todays",
      label: "Today's Collection",
      value: `$${stats.todaysCollection}`,
      accent: theme.colors.mint,
      icon: "💵",
      list: stats.todaysPaymentsList,
      type: "payment",
    },
    {
      id: "monthly",
      label: "Monthly Collection",
      value: `$${stats.monthlyCollection}`,
      accent: theme.colors.brand,
      icon: "📈",
      list: stats.monthlyPaymentsList,
      type: "payment",
    },
    {
      id: "paid",
      label: "Students Paid",
      value: stats.studentsPaid,
      accent: theme.colors.mint,
      icon: "✅",
      list: stats.paidStudentsList,
      type: "student",
    },
    {
      id: "remaining",
      label: "Students Remaining",
      value: stats.studentsRemaining,
      accent: theme.colors.amber,
      icon: "⏳",
      list: stats.remainingStudentsList,
      type: "student",
    },
  ];

  return (
    <div>
      <header style={{ marginBottom: 28 }}>
        <h1 style={styles.title}>Cashier Dashboard</h1>
        <p style={styles.subtitle}>Overview of today's payment activity</p>
      </header>

      {loading ? (
        <p style={{ color: theme.colors.inkMuted }}>Loading dashboard...</p>
      ) : (
        <div style={styles.grid}>
          {STATS.map((s) => (
            <div
              key={s.id}
              style={styles.card}
              onClick={() => setSelectedCategory(s)}
              title="Gudaha kaga dhufo si aad u aragto liiska"
            >
              <div style={{ ...styles.iconWrap, background: `${s.accent}1A` }}>
                <span style={{ fontSize: 20 }}>{s.icon}</span>
              </div>
              <div style={styles.value}>{s.value}</div>
              <div style={styles.labelRow}>
                <span style={styles.label}>{s.label}</span>
                <span style={styles.viewBadge}>Eeg Liiska →</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedCategory && (
        <DetailModal
          category={selectedCategory}
          onClose={() => setSelectedCategory(null)}
        />
      )}
    </div>
  );
}

function DetailModal({ category, onClose }) {
  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.card} onClick={(e) => e.stopPropagation()}>
        <div style={modalStyles.header}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>{category.icon}</span>
            <div>
              <h3 style={modalStyles.title}>{category.label}</h3>
              <p style={modalStyles.subtitle}>
                Wadarta: <strong>{category.value}</strong> | Tirada: {category.list.length}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={modalStyles.closeBtn}>
            ✕
          </button>
        </div>

        <div style={modalStyles.body}>
          {category.list.length === 0 ? (
            <p style={{ color: theme.colors.inkMuted, textAlign: "center", margin: "30px 0" }}>
              Lama helin wax xog ah oo ku dhex jirta qaybtan.
            </p>
          ) : (
            <table style={modalStyles.table}>
              <thead>
                <tr>
                  <th style={modalStyles.th}>ID</th>
                  <th style={modalStyles.th}>Magaca Ardayga</th>
                  <th style={modalStyles.th}>Fasalka</th>
                  {category.type === "payment" && <th style={modalStyles.th}>Lacagta Bixiyay</th>}
                  {category.type === "student" && <th style={modalStyles.th}>Monthly Fee</th>}
                  <th style={modalStyles.th}>Taariikhda / Status</th>
                </tr>
              </thead>
              <tbody>
                {category.list.map((item, idx) => (
                  <tr key={idx} style={{ background: idx % 2 === 0 ? "#FFFFFF" : "#FAFCFB" }}>
                    <td style={modalStyles.td}>
                      <span style={modalStyles.idChip}>
                        {item.studentId || item.id}
                      </span>
                    </td>
                    <td style={{ ...modalStyles.td, fontWeight: 600 }}>
                      {item.studentName || item.fullName || "—"}
                    </td>
                    <td style={modalStyles.td}>
                      {item.className || "—"}
                    </td>

                    {/* Amount Column */}
                    {category.type === "payment" && (
                      <td style={{ ...modalStyles.td, color: theme.colors.mintDark, fontWeight: 700 }}>
                        ${item.paidAmount}
                      </td>
                    )}
                    {category.type === "student" && (
                      <td style={{ ...modalStyles.td, fontWeight: 600 }}>
                        ${item.monthlyFee || 0}
                      </td>
                    )}

                    {/* Status or Date Column */}
                    <td style={modalStyles.td}>
                      {category.type === "payment" ? (
                        <span style={modalStyles.dateText}>{formatDate(item.createdAt)}</span>
                      ) : (
                        <span
                          style={{
                            ...modalStyles.badge,
                            color: category.id === "paid" ? theme.colors.mintDark : theme.colors.danger,
                            background: category.id === "paid" ? `${theme.colors.mint}1A` : `${theme.colors.danger}14`,
                          }}
                        >
                          {category.id === "paid" ? "Paid" : "Not Paid"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  title: {
    fontFamily: theme.font.display,
    fontWeight: 800,
    fontSize: 28,
    color: theme.colors.ink,
    margin: 0,
  },
  subtitle: {
    color: theme.colors.inkMuted,
    fontSize: 14,
    marginTop: 6,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 20,
  },
  card: {
    background: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: 24,
    boxShadow: theme.shadow.card,
    border: `1px solid ${theme.colors.border}`,
    cursor: "pointer",
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  value: {
    fontFamily: theme.font.display,
    fontWeight: 800,
    fontSize: 26,
    color: theme.colors.ink,
    fontVariantNumeric: "tabular-nums",
  },
  labelRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  label: {
    color: theme.colors.inkMuted,
    fontSize: 13.5,
    fontWeight: 500,
  },
  viewBadge: {
    fontSize: 11.5,
    fontWeight: 700,
    color: theme.colors.brand,
  },
};

const modalStyles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2000,
    padding: 20,
  },
  card: {
    background: theme.colors.card,
    borderRadius: theme.radius.lg,
    boxShadow: theme.shadow.raised,
    width: "100%",
    maxWidth: 720,
    maxHeight: "85vh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  header: {
    padding: "20px 24px",
    borderBottom: `1px solid ${theme.colors.border}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: theme.colors.surface,
  },
  title: {
    fontFamily: theme.font.display,
    fontWeight: 800,
    fontSize: 18,
    color: theme.colors.ink,
    margin: 0,
  },
  subtitle: {
    fontSize: 12.5,
    color: theme.colors.inkMuted,
    marginTop: 2,
    margin: 0,
  },
  closeBtn: {
    background: "transparent",
    border: `1px solid ${theme.colors.border}`,
    borderRadius: 8,
    width: 32,
    height: 32,
    cursor: "pointer",
    fontSize: 14,
    color: theme.colors.inkMuted,
  },
  body: {
    padding: 20,
    overflowY: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  },
  th: {
    textAlign: "left",
    padding: "10px 12px",
    background: theme.colors.brand,
    color: "#FFFFFF",
    fontWeight: 600,
    fontSize: 12,
  },
  td: {
    padding: "10px 12px",
    borderBottom: `1px solid ${theme.colors.border}`,
    color: theme.colors.ink,
  },
  idChip: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 999,
    background: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    fontSize: 11.5,
    fontWeight: 700,
    color: theme.colors.brand,
  },
  dateText: {
    fontSize: 11.5,
    color: theme.colors.inkMuted,
  },
  badge: {
    padding: "3px 10px",
    borderRadius: 999,
    fontWeight: 700,
    fontSize: 11.5,
  },
};