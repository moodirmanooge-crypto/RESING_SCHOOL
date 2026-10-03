import { useEffect, useMemo, useState, Fragment } from "react";
import { theme } from "./theme.js";
import { loadFeeLedger, localMonthKey } from "../utils/feeLedger.js";

// Waqtiga maxaliga ah (Soomaaliya), ma aha UTC
const currentMonthKey = () => localMonthKey();

const monthLabel = (monthKey) => {
  const [year, month] = monthKey.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleString("default", { month: "long", year: "numeric" });
};

export default function Reports() {
  const [students, setStudents] = useState([]);
  const [monthPaid, setMonthPaid] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey());
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Ardayda lacag bixiya oo keliya (Free-ga iyo akoonnada cashier-ka
      // laga reebay), Full Time + Part Time — isla xisaabinta Admin-ka
      const ledger = await loadFeeLedger();
      setStudents(ledger.payableStudents);
      setMonthPaid(ledger.monthPaid);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };


  // Every month that has at least one receipt touching it, newest first.
  // Current month is always included so a fresh month with no receipts
  // yet still shows up in the dropdown.
  const availableMonths = useMemo(() => {
    const set = new Set();
    Object.values(monthPaid).forEach((months) => {
      Object.keys(months).forEach((k) => set.add(k));
    });
    set.add(currentMonthKey());
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [monthPaid]);

  const rows = useMemo(() => {
    return students.map((student) => {
      const record = monthPaid[student.studentId]?.[selectedMonth];
      const fee = Number(student.monthlyFee || 0);
      const paid = record ? Number(record.paidAmount || 0) : 0;
      const remaining = Math.max(fee - paid, 0);

      // Three-way status: nothing paid yet, partially paid, or fully paid —
      // computed directly from paid vs. fee, not a stored status field.
      let status = "Not Paid";
      if (fee > 0 && paid >= fee) status = "Paid";
      else if (paid > 0) status = "Partial";

      return {
        id: student.id,
        studentId: student.studentId,
        studentName: student.fullName || student.studentName,
        className: student.className,
        studentPhone: student.studentPhone,
        parentPhone: student.parentPhone,
        fee,
        paid,
        remaining,
        status,
        createdAt: record ? record.createdAt : null,
      };
    });
  }, [students, monthPaid, selectedMonth]);

  const filteredRows = rows.filter((r) => {
    const text = search.toLowerCase();
    return (
      (r.studentId || "").toLowerCase().includes(text) ||
      (r.studentName || "").toLowerCase().includes(text) ||
      (r.className || "").toLowerCase().includes(text)
    );
  });

  const totals = useMemo(() => {
    const collected = rows.reduce((sum, r) => sum + r.paid, 0);
    const outstanding = rows.reduce((sum, r) => sum + r.remaining, 0);
    const paidCount = rows.filter((r) => r.status === "Paid").length;
    const partialRows = rows.filter((r) => r.status === "Partial");
    const partialCount = partialRows.length;
    const partialOutstanding = partialRows.reduce(
      (sum, r) => sum + r.remaining,
      0
    );
    const notPaidCount = rows.filter((r) => r.status === "Not Paid").length;
    return {
      collected,
      outstanding,
      paidCount,
      partialCount,
      partialOutstanding,
      notPaidCount,
    };
  }, [rows]);

  const statusStyle = (status) => {
    if (status === "Paid")
      return {
        color: theme.colors.mintDark,
        bg: `${theme.colors.mint}1A`,
        dot: theme.colors.mint,
      };
    if (status === "Partial")
      return {
        color: "#B8760A",
        bg: `${theme.colors.amber}22`,
        dot: theme.colors.amber,
      };
    return {
      color: theme.colors.danger,
      bg: `${theme.colors.danger}14`,
      dot: theme.colors.danger,
    };
  };

  const formatDate = (ts) => {
    if (!ts || !ts.seconds) return "—";
    return new Date(ts.seconds * 1000).toLocaleString();
  };

  return (
    <div style={{ fontFamily: theme.font.body }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={styles.title}>Reports</h1>
        <p style={styles.subtitle}>
          Full payment history — every month is saved and can be reviewed
          anytime
        </p>
      </header>

      {loading ? (
        <p style={{ color: theme.colors.inkMuted }}>Loading reports...</p>
      ) : (
        <>
          <div style={styles.summaryGrid}>
            <SummaryCard
              icon="💰"
              label="Total Collected"
              value={`$${totals.collected}`}
              accent={theme.colors.mint}
            />
            <SummaryCard
              icon="✅"
              label="Students Paid"
              value={totals.paidCount}
              accent={theme.colors.mint}
            />
            <SummaryCard
              icon="🟡"
              label={`Partial · $${totals.partialOutstanding} left`}
              value={totals.partialCount}
              accent={theme.colors.amber}
            />
            <SummaryCard
              icon="⏳"
              label="Students Not Paid"
              value={totals.notPaidCount}
              accent={theme.colors.danger}
            />
            <SummaryCard
              icon="📉"
              label="Total Outstanding"
              value={`$${totals.outstanding}`}
              accent={theme.colors.danger}
            />
          </div>

          <div style={styles.controlsRow}>
            <input
              placeholder="Search Student ID / Name / Class"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={styles.search}
            />

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={styles.monthSelect}
            >
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.tableCard}>
            {filteredRows.length === 0 ? (
              <p style={{ padding: 24, color: theme.colors.inkMuted }}>
                No students match your search.
              </p>
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
                    <th style={styles.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r, i) => {
                    const sStyle = statusStyle(r.status);
                    const isPartial = r.status === "Partial";
                    const isExpanded = expandedId === r.id;

                    return (
                      <Fragment key={r.id}>
                        <tr
                          onClick={() =>
                            isPartial &&
                            setExpandedId(isExpanded ? null : r.id)
                          }
                          style={{
                            background: i % 2 === 0 ? "#FFFFFF" : "#FAFCFB",
                            cursor: isPartial ? "pointer" : "default",
                          }}
                        >
                          <td style={styles.td}>{r.studentId || "—"}</td>
                          <td style={{ ...styles.td, fontWeight: 600 }}>
                            {r.studentName || "—"}
                          </td>
                          <td style={styles.td}>{r.className || "—"}</td>
                          <td style={styles.td}>{r.studentPhone || "—"}</td>
                          <td style={styles.td}>{r.parentPhone || "—"}</td>
                          <td style={{ ...styles.td, ...styles.money }}>
                            ${r.fee}
                          </td>
                          <td style={{ ...styles.td, ...styles.money }}>
                            ${r.paid}
                          </td>
                          <td style={{ ...styles.td, ...styles.money }}>
                            ${r.remaining}
                          </td>
                          <td style={styles.td}>
                            <span
                              style={{
                                ...styles.badge,
                                color: sStyle.color,
                                background: sStyle.bg,
                              }}
                            >
                              <span
                                style={{
                                  ...styles.badgeDot,
                                  background: sStyle.dot,
                                }}
                              />
                              {r.status}
                              {isPartial && (
                                <span style={{ marginLeft: 4 }}>
                                  {isExpanded ? "▲" : "▼"}
                                </span>
                              )}
                            </span>
                          </td>
                        </tr>

                        {isPartial && isExpanded && (
                          <tr>
                            <td colSpan={9} style={styles.detailCell}>
                              <div style={styles.detailBox}>
                                <div style={styles.detailItem}>
                                  <span style={styles.detailLabel}>
                                    Paid so far
                                  </span>
                                  <span style={styles.detailValue}>
                                    ${r.paid} of ${r.fee}
                                  </span>
                                </div>
                                <div style={styles.detailItem}>
                                  <span style={styles.detailLabel}>
                                    Still owing
                                  </span>
                                  <span
                                    style={{
                                      ...styles.detailValue,
                                      color: theme.colors.danger,
                                    }}
                                  >
                                    ${r.remaining}
                                  </span>
                                </div>
                                <div style={styles.detailItem}>
                                  <span style={styles.detailLabel}>
                                    Last payment recorded
                                  </span>
                                  <span style={styles.detailValue}>
                                    {formatDate(r.createdAt)}
                                  </span>
                                </div>
                                <div style={styles.detailItem}>
                                  <span style={styles.detailLabel}>
                                    Contact
                                  </span>
                                  <span style={styles.detailValue}>
                                    {r.studentPhone || "—"} /{" "}
                                    {r.parentPhone || "—"}
                                  </span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value, accent }) {
  return (
    <div style={styles.summaryCard}>
      <div
        style={{
          ...styles.summaryIcon,
          background: `${accent}1A`,
        }}
      >
        <span style={{ fontSize: 18 }}>{icon}</span>
      </div>
      <div style={styles.summaryValue}>{value}</div>
      <div style={styles.summaryLabel}>{label}</div>
    </div>
  );
}

const styles = {
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
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 16,
    marginBottom: 22,
  },
  summaryCard: {
    background: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: 20,
    boxShadow: theme.shadow.card,
    border: `1px solid ${theme.colors.border}`,
  },
  summaryIcon: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.sm,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  summaryValue: {
    fontFamily: theme.font.display,
    fontWeight: 800,
    fontSize: 22,
    color: theme.colors.ink,
    fontVariantNumeric: "tabular-nums",
  },
  summaryLabel: {
    color: theme.colors.inkMuted,
    fontSize: 12.5,
    marginTop: 4,
    fontWeight: 500,
  },
  controlsRow: {
    display: "flex",
    gap: 12,
    marginBottom: 20,
    flexWrap: "wrap",
  },
  search: {
    width: 320,
    padding: "12px 16px",
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`,
    background: theme.colors.card,
    fontSize: 14,
    color: theme.colors.ink,
    outline: "none",
  },
  monthSelect: {
    padding: "12px 16px",
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`,
    background: theme.colors.card,
    fontSize: 14,
    color: theme.colors.ink,
    outline: "none",
    fontWeight: 600,
    minWidth: 200,
  },
  tableCard: {
    background: theme.colors.card,
    borderRadius: theme.radius.lg,
    boxShadow: theme.shadow.card,
    border: `1px solid ${theme.colors.border}`,
    overflow: "auto",
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
  detailCell: {
    padding: 0,
    borderBottom: `1px solid ${theme.colors.border}`,
    background: "#FFF9EC",
  },
  detailBox: {
    display: "flex",
    flexWrap: "wrap",
    gap: 28,
    padding: "16px 24px",
  },
  detailItem: {
    display: "flex",
    flexDirection: "column",
    gap: 3,
  },
  detailLabel: {
    fontSize: 11.5,
    color: theme.colors.inkMuted,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: 700,
    color: theme.colors.ink,
  },
};