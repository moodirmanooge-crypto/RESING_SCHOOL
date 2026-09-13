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

// Rasiidyada hore (ka hor saxitaanka) ma sitaan "monthBreakdown" — waxay
// kaliya haystaan hal "monthLabel" oo qoraal ah sida "September 2026".
// Tan waxay u rogaysaa "2026-09" haddii ay tahay hal-bil oo qoraalkeedu
// cad yahay; haddii kale (tusaale rasiid dhowr bilood ku daboolaya) waa
// la iska dhaafaa xisaabinta bil-bil ah (wuxuu wali ku jiraa wadarta
// guud ee lacagta, ee ma lagu tirin karo bil gaar ah).
//
// FIIRO GAAR AH: halkan si ula kac ah looga fogaaday "new Date(...)" +
// ".toISOString()" — habkaasi wuxuu keenaa khalad saacadda/goobta
// (timezone) ah: Soomaaliya (UTC+3) wuxuu "September 2026" u rogi lahaa
// "2026-08" (bishii ka horeysay!) maadaama toISOString() uu ku beddelo
// UTC, taasoo dib u dhaqaajisa bisha marka la joogo goob UTC-ka ka
// sarreysa. Halkan waxaa lagu beddelayaa magaca bisha lambar isla
// markiiba, iyada oo aan la isticmaalin Date/timezone gabi ahaanba.
const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

function parseMonthLabelToKey(label) {
  if (!label) return null;
  const match = /^([A-Za-z]+)\s+(\d{4})$/.exec(String(label).trim());
  if (!match) return null;
  const monthIndex = MONTH_NAMES.indexOf(match[1].toLowerCase());
  if (monthIndex === -1) return null;
  return `${match[2]}-${String(monthIndex + 1).padStart(2, "0")}`;
}

// Dhammaan xogta "la bixiyay / lama bixin" ee Cashier-ka (Dashboard,
// Reports, Payments) waxay ka imanayaan collection-ka "receipts" oo
// KELIYA — haddii arday lacag u lahaa aanu weli lahayn rasiid, marnaba
// looma tirinayo mid la bixiyay. Waxay taageeraysaa labada nooc ee
// rasiid: kuwa cusub ee leh "monthBreakdown" (wadarta ugu dambeysa ee
// bil kasta — rasiidka ugu dambeeya ayaa la isticmaalaa), iyo kuwa hore
// ee leh kaliya "monthLabel" + "paidAmount" (dhammaantood waa la isku
// daraa, maadaama midkoodna aanu ahayn wadar guud). Halkan waxaa laga
// soo saarayaa kaliya WADARTA la bixiyay bil kasta — Paid/Partial/Not
// Paid waxaa go'aaminaya bogga isticmaalaya (marka la barbardhigo
// monthlyFee-ga ardayga), ma aha xogta rasiidka qudhiisa.
function buildMonthPaidFromReceipts(receipts) {
  const byStudent = {};
  const legacyBySidMonth = {};

  receipts.forEach((r) => {
    const sid = r.studentId;
    if (!sid) return;
    const breakdown = Array.isArray(r.monthBreakdown) ? r.monthBreakdown : [];

    if (breakdown.length > 0) {
      const ts = r.createdAt?.seconds || 0;
      if (!byStudent[sid]) byStudent[sid] = {};
      breakdown.forEach((m) => {
        const existing = byStudent[sid][m.monthKey];
        if (!existing || ts >= existing._ts) {
          byStudent[sid][m.monthKey] = {
            paidAmount: Number(m.paidAmount) || 0,
            createdAt: r.createdAt || null,
            _ts: ts,
          };
        }
      });
    } else {
      const key = parseMonthLabelToKey(r.monthLabel);
      if (!key) return;
      if (!legacyBySidMonth[sid]) legacyBySidMonth[sid] = {};
      legacyBySidMonth[sid][key] =
        (legacyBySidMonth[sid][key] || 0) + (Number(r.paidAmount) || 0);
      if (!byStudent[sid]) byStudent[sid] = {};
      const ts = r.createdAt?.seconds || 0;
      const existing = byStudent[sid][key];
      if (!existing || ts >= existing._ts) {
        byStudent[sid][key] = {
          ...(byStudent[sid][key] || {}),
          createdAt: r.createdAt || existing?.createdAt || null,
          _ts: ts,
        };
      }
    }
  });

  // Ku dar wadarta rasiidyada hore (legacy) ee la isku daray kor.
  Object.entries(legacyBySidMonth).forEach(([sid, months]) => {
    if (!byStudent[sid]) byStudent[sid] = {};
    Object.entries(months).forEach(([key, legacyAmt]) => {
      const existing = byStudent[sid][key] || {};
      byStudent[sid][key] = {
        ...existing,
        paidAmount: (existing.paidAmount || 0) + legacyAmt,
      };
    });
  });

  return byStudent;
}

export default function Dashboard() {
  const [students, setStudents] = useState([]);
  const [receipts, setReceipts] = useState([]);
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
            !s.pendingDeletion &&
            s.studentId &&
            String(s.studentId).trim() !== "" &&
            s.fullName &&
            String(s.fullName).trim() !== ""
        );
      setStudents(studentData);

      // Liiska ID-yada ardayda jira ee la ogolyahay (aan pendingDeletion ahayn)
      const validStudentIds = new Set(studentData.map((s) => s.studentId));

      const receiptsSnap = await getDocs(collection(db, "receipts"));
      const receiptData = receiptsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        // Marnaba soo aqrin rasiidka ardayda aan jirin (la tirtiray ama aan collection-ka students ku jirin)
        .filter((r) => r.studentId && validStudentIds.has(r.studentId));
      setReceipts(receiptData);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const monthKey = currentMonthKey();

    // Ardayda Free ah waa in aan lagu darin xisaabinta lacagaha ee guud
    const feePayingStudentIds = new Set(
      students.filter((s) => s.feeType !== "Free").map((s) => s.studentId)
    );
    const payableStudents = students.filter((s) => s.feeType !== "Free");

    const feeReceipts = receipts.filter((r) => feePayingStudentIds.has(r.studentId));

    // 1. Today's Payments — lacagta dhabta ah ee la helay maanta (receipt.paidAmount
    // waa lacagta dhab ahaan la geliyay dhaqdhaqaaqaan, ma aha wadar guud oo bille ah).
    const todaysPaymentsList = feeReceipts.filter((r) => isToday(r.createdAt));
    const todaysCollection = todaysPaymentsList.reduce(
      (sum, r) => sum + Number(r.paidAmount || 0),
      0
    );

    // Wadarta la bixiyay bil kasta, arday kasta — collection-ka "receipts" oo keliya.
    const monthPaid = buildMonthPaidFromReceipts(feeReceipts);

    // 2. Monthly Payments — wadarta la bixiyay ee bishan (xisaabinta ugu dambeysa ee bil kasta).
    let monthlyCollection = 0;
    const paidStudentIds = new Set();
    const monthlyPaymentsList = [];
    payableStudents.forEach((s) => {
      const m = monthPaid[s.studentId]?.[monthKey];
      if (m) {
        monthlyCollection += m.paidAmount;
        const fee = Number(s.monthlyFee || 0);
        if (fee > 0 && m.paidAmount >= fee) paidStudentIds.add(s.studentId);
        monthlyPaymentsList.push({
          studentId: s.studentId,
          studentName: s.fullName,
          className: s.className,
          paidAmount: m.paidAmount,
          monthLabel: monthKey,
          createdAt: null,
        });
      }
    });

    // 3. Paid Students
    const paidStudentsList = payableStudents.filter((s) =>
      paidStudentIds.has(s.studentId)
    );

    // 4. Remaining Students
    const remainingStudentsList = payableStudents.filter(
      (s) => !paidStudentIds.has(s.studentId)
    );

    // 5. Wadarta Guud ee Lacagta la Qaaday (bishan oo kaliya, si ay ula jaanqaado Monthly Collection)
    const allTimeCollected = monthlyCollection;
    const allTimePaymentsList = monthlyPaymentsList;

    // 6. Wadarta Guud ee Lacagta ay Ardaydu ku Diiwaan Gashan yihiin (Monthly Fee guud)
    const totalRegisteredFees = payableStudents.reduce(
      (sum, s) => sum + Number(s.monthlyFee || 0),
      0
    );

    // 7. Tirada Ardayda Lacag-bixiya (kuwa aan Free ahayn ee lacagta bille laga qaadanayo)
    const feePayingStudentsCount = payableStudents.length;

    return {
      todaysCollection,
      todaysPaymentsList,
      monthlyCollection,
      monthlyPaymentsList,
      studentsPaid: paidStudentsList.length,
      paidStudentsList,
      studentsRemaining: remainingStudentsList.length,
      remainingStudentsList,
      allTimeCollected,
      allTimePaymentsList,
      totalRegisteredFees,
      feePayingStudentsCount,
      feePayingStudentsList: payableStudents,
    };
  }, [students, receipts]);

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
      <header style={styles.headerRow}>
        <div>
          <h1 style={styles.title}>Cashier Dashboard</h1>
          <p style={styles.subtitle}>Overview of today's payment activity</p>
        </div>

        {!loading && (
          <div style={styles.summaryRow}>
            <div
              style={{ ...styles.summaryPill, cursor: "pointer" }}
              onClick={() =>
                setSelectedCategory({
                  id: "allTime",
                  icon: "🏦",
                  label: "Wadarta Guud ee La Qaaday",
                  value: `$${stats.allTimeCollected}`,
                  list: stats.allTimePaymentsList,
                  type: "payment",
                })
              }
              title="Gudaha kaga dhufo si aad u aragto diiwaanka lacagaha ka dhisay wadartan"
            >
              <span style={styles.summaryLabel}>Wadarta Guud ee La Qaaday</span>
              <span style={styles.summaryValue}>${stats.allTimeCollected}</span>
            </div>
            <div
              style={{ ...styles.summaryPill, cursor: "pointer" }}
              onClick={() =>
                setSelectedCategory({
                  id: "feePaying",
                  icon: "🧑‍🎓",
                  label: "Ardayda Lacag Laga Qaadanayo",
                  value: stats.feePayingStudentsCount,
                  list: stats.feePayingStudentsList,
                  type: "student",
                })
              }
              title="Gudaha kaga dhufo si aad u aragto liiska ardayda"
            >
              <span style={styles.summaryLabel}>Ardayda Lacag Laga Qaadanayo</span>
              <span style={styles.summaryValue}>{stats.feePayingStudentsCount}</span>
            </div>
            <div
              style={{ ...styles.summaryPill, cursor: "pointer" }}
              onClick={() =>
                setSelectedCategory({
                  id: "registered",
                  icon: "📋",
                  label: "Wadarta Ku Diiwaan Gashan",
                  value: `$${stats.totalRegisteredFees}`,
                  list: stats.feePayingStudentsList,
                  type: "student",
                })
              }
              title="Gudaha kaga dhufo si aad u aragto liiska ardayda"
            >
              <span style={styles.summaryLabel}>Wadarta Ku Diiwaan Gashan</span>
              <span style={styles.summaryValue}>${stats.totalRegisteredFees}</span>
            </div>
          </div>
        )}
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
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={modalStyles.dateText}>{formatDate(item.createdAt)}</span>
                          {item.monthLabel && (
                            <span
                              style={{
                                ...modalStyles.dateText,
                                fontWeight: 700,
                                color: theme.colors.brand,
                              }}
                            >
                              Bisha: {item.monthLabel}
                            </span>
                          )}
                        </div>
                      ) : category.id === "paid" || category.id === "remaining" ? (
                        <span
                          style={{
                            ...modalStyles.badge,
                            color: category.id === "paid" ? theme.colors.mintDark : theme.colors.danger,
                            background: category.id === "paid" ? `${theme.colors.mint}1A` : `${theme.colors.danger}14`,
                          }}
                        >
                          {category.id === "paid" ? "Paid" : "Not Paid"}
                        </span>
                      ) : (
                        <span style={modalStyles.dateText}>—</span>
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
  headerRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 28,
  },
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
  summaryRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
  },
  summaryPill: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 20px",
    borderRadius: theme.radius.md,
    background: theme.colors.card,
    border: `1px solid ${theme.colors.border}`,
    boxShadow: theme.shadow.card,
    minWidth: 150,
  },
  summaryLabel: {
    fontSize: 11.5,
    color: theme.colors.inkMuted,
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  summaryValue: {
    fontFamily: theme.font.display,
    fontWeight: 800,
    fontSize: 20,
    color: theme.colors.brand,
    marginTop: 2,
    fontVariantNumeric: "tabular-nums",
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