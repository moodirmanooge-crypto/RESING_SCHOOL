import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../firebase/firebase";
import { theme } from "./theme.js";

const SCHOOL_NAME = "Rising School";

// ---- Nuuca imtixaanka ee maamulku ka doortay Exam Timetable-ka fasalka
// (isla EXAM_TYPES ee ExamTimetable.jsx iyo ExamCards.jsx isticmaalaan) ----
const EXAM_TYPE_LABELS = {
  monthly1: "Monthly 1",
  midterm: "Mid Term",
  monthly2: "Monthly 2",
  final: "Final",
};
function examTypeLabel(key) {
  return EXAM_TYPE_LABELS[key] || "Final";
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ---- Fasallada xilliga imtixaanku uu maamulku daaray ee weli socda
// (maanta u dhexeeya startDate iyo endDate) ayaa la soo aqriyaa
// examWeek collection-ka, si cashierka loogu bandhigo kaliya fasallada
// imtixaanku maanta socdo. ----
function isExamWeekActive(wk) {
  if (!wk?.startDate || !wk?.endDate) return false;
  const today = todayISO();
  return today >= wk.startDate && today <= wk.endDate;
}

export default function ExamPayments() {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [examWeeks, setExamWeeks] = useState({}); // className -> {startDate,endDate,examType}
  const [examTypeByClass, setExamTypeByClass] = useState({}); // CLASSNAME (upper) -> examType
  const [examCardStatus, setExamCardStatus] = useState({}); // studentId -> {cardNo, paid, examType}
  const [search, setSearch] = useState("");
  const [amounts, setAmounts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [lastCard, setLastCard] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      const examWeekSnap = await getDocs(collection(db, "examWeek"));
      const weekMap = {};
      examWeekSnap.docs.forEach((d) => {
        weekMap[d.id] = d.data();
      });
      setExamWeeks(weekMap);

      const activeEntries = Object.entries(weekMap).filter(([, wk]) => isExamWeekActive(wk));
      const activeClasses = new Set(activeEntries.map(([cls]) => cls.toUpperCase()));

      const typeMap = {};
      activeEntries.forEach(([cls, wk]) => {
        typeMap[cls.toUpperCase()] = wk.examType || "final";
      });
      setExamTypeByClass(typeMap);

      const studentsSnap = await getDocs(collection(db, "students"));
      const studentData = studentsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter(
          (s) =>
            s.studentId &&
            String(s.studentId).trim() !== "" &&
            s.fullName &&
            String(s.fullName).trim() !== "" &&
            activeClasses.has(String(s.className || "").toUpperCase())
        );
      setStudents(studentData);

      // Xagee la joogaa — arday kastoo horey loo sameeyay Exam Card
      // nuucan (examType) xilligan (si aan loo soo bandhigin sidii mid
      // aan la bixin). Nuuca card-ka waa la kaydiyaa si loo barbardhigo
      // nuuca hadda socda ee fasalkiisa.
      const cardsSnap = await getDocs(collection(db, "examCards"));
      const statusMap = {};
      cardsSnap.docs.forEach((d) => {
        const data = d.data();
        if (!data.studentId) return;
        statusMap[data.studentId] = {
          cardNo: data.cardNo,
          paid: true,
          examType: data.examType || "final",
        };
      });
      setExamCardStatus(statusMap);
    } catch (err) {
      console.log(err);
      alert("Khalad ayaa dhacay marka xogta la soo qaadanayay: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  const filtered = students.filter((s) => {
    const t = search.toLowerCase();
    return (
      (s.studentId || "").toLowerCase().includes(t) ||
      (s.fullName || "").toLowerCase().includes(t) ||
      (s.className || "").toLowerCase().includes(t)
    );
  });

  // ---- Marka cashierku "Save" riixo: 1) kaydi diiwaanka lacagta
  // examCardPayments gudihiisa, 2) samee Card No otomatig ah (counter
  // gaar u leh nuuca imtixaanka ee fasalkan hadda socda — Monthly 1,
  // Mid Term, Monthly 2 ama Final, sidii Exam Timetable-ka loo doortay),
  // 3) kaydi examCards gudihiisa oo leh examType-kaas oo sax ah, si
  // Admin-ka Exam Cards page-ku si toos ah ugu daawado tick-ga saxda ah. ----
  async function savePaymentAndCard(student) {
    const entered = Number(amounts[student.id] || 0);
    if (entered <= 0) {
      alert("Fadlan geli lacagta imtixaanka ee la bixiyay");
      return;
    }

    const examType = examTypeByClass[String(student.className || "").toUpperCase()] || "final";

    setSavingId(student.id);
    try {
      const counterRef = doc(db, "examCardCounters", examType);
      let cardNo = 0;

      await runTransaction(db, async (tx) => {
        const counterSnap = await tx.get(counterRef);
        let current = counterSnap.exists() ? counterSnap.data().lastNumber || 0 : 0;
        const assigned = counterSnap.exists() ? counterSnap.data().assigned || {} : {};

        if (assigned[student.studentId]) {
          cardNo = assigned[student.studentId];
        } else {
          current += 1;
          assigned[student.studentId] = current;
          cardNo = current;
        }

        tx.set(
          counterRef,
          { lastNumber: current, assigned, examType, updatedAt: new Date() },
          { merge: true }
        );
      });

      const cardDocId = `${student.studentId}_${examType}`;
      const cardRecord = {
        studentId: student.studentId,
        studentName: student.fullName,
        className: student.className || "",
        cardNo,
        examType,
        amountPaid: entered,
        schoolName: SCHOOL_NAME,
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, "examCards", cardDocId), cardRecord);

      // Diiwaanka lacagta gaarka ah, si loo hayo tarikhda bixinta.
      await setDoc(doc(db, "examCardPayments", cardDocId), {
        ...cardRecord,
      });

      setExamCardStatus((prev) => ({
        ...prev,
        [student.studentId]: { cardNo, paid: true, examType },
      }));
      setAmounts((prev) => ({ ...prev, [student.id]: "" }));
      setLastCard({ ...cardRecord, createdAt: { seconds: Math.floor(Date.now() / 1000) } });
    } catch (err) {
      console.log(err);
      alert("Khalad ayaa dhacay marka la kaydinayay: " + err.message);
    } finally {
      setSavingId(null);
    }
  }

  const activeClassLabel = useMemo(() => {
    const active = Object.entries(examWeeks).filter(([, wk]) => isExamWeekActive(wk));
    if (active.length === 0) return null;
    return active.map(([cls]) => cls).join(", ");
  }, [examWeeks]);

  return (
    <div style={{ fontFamily: theme.font.body }}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Exam Payments</h1>
          <p style={styles.subtitle}>
            Qaado lacagta imtixaanka ardayda fasallada xilliga imtixaanku hadda socdo
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
                students.filter((s) => {
                  const cardInfo = examCardStatus[s.studentId];
                  const type = examTypeByClass[String(s.className || "").toUpperCase()] || "final";
                  return cardInfo?.paid && cardInfo.examType === type;
                }).length
              }
            </span>
            <span style={styles.statLabel}>Cards issued</span>
          </div>
        </div>
      </header>

      {!loading && !activeClassLabel && (
        <div style={styles.noticeBox}>
          Hadda ma jiro fasal xilli imtixaan ah oo furan. Maamulku waa inuu ka daaraa Exam
          Timetable bogga taariikhda bilowga iyo dhamaadka imtixaanka.
        </div>
      )}

      {!loading && activeClassLabel && (
        <div style={styles.activeBox}>
          Xilliga imtixaanku hadda wuu socdaa fasallada: <strong>{activeClassLabel}</strong>
        </div>
      )}

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
              Arday lama helin fasallada xilliga imtixaanku hadda socdo.
            </p>
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>ID</th>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Class</th>
                <th style={styles.th}>Nuuca Imtixaanka</th>
                <th style={styles.th}>Enter Amount</th>
                <th style={styles.th}>Card No</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Save</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((student, i) => {
                const studentExamType =
                  examTypeByClass[String(student.className || "").toUpperCase()] || "final";
                const cardInfo = examCardStatus[student.studentId];
                const alreadyPaid = !!cardInfo?.paid && cardInfo.examType === studentExamType;
                const isSaving = savingId === student.id;

                return (
                  <tr
                    key={student.id}
                    style={{ background: i % 2 === 0 ? "#FFFFFF" : "#FAFCFB" }}
                  >
                    <td style={styles.td}>
                      <span style={styles.idChip}>{student.studentId}</span>
                    </td>
                    <td style={{ ...styles.td, fontWeight: 600 }}>{student.fullName}</td>
                    <td style={styles.td}>{student.className || "—"}</td>
                    <td style={styles.td}>
                      <span style={styles.examTypeChip}>{examTypeLabel(studentExamType)}</span>
                    </td>
                    <td style={styles.td}>
                      {alreadyPaid ? (
                        <span style={{ color: theme.colors.inkMuted, fontSize: 12.5 }}>—</span>
                      ) : (
                        <input
                          type="number"
                          value={amounts[student.id] || ""}
                          onChange={(e) =>
                            setAmounts({ ...amounts, [student.id]: e.target.value })
                          }
                          style={styles.amountInput}
                        />
                      )}
                    </td>
                    <td style={styles.td}>
                      {alreadyPaid ? `#${String(cardInfo.cardNo).padStart(4, "0")}` : "—"}
                    </td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.badge,
                          color: alreadyPaid ? theme.colors.mintDark : theme.colors.danger,
                          background: alreadyPaid
                            ? `${theme.colors.mint}1A`
                            : `${theme.colors.danger}14`,
                        }}
                      >
                        <span
                          style={{
                            ...styles.badgeDot,
                            background: alreadyPaid ? theme.colors.mint : theme.colors.danger,
                          }}
                        />
                        {alreadyPaid ? "Card Issued" : "Not Paid"}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <button
                        onClick={() => savePaymentAndCard(student)}
                        disabled={alreadyPaid || isSaving}
                        style={{
                          ...styles.saveBtn,
                          background: alreadyPaid ? "#DDE4E2" : theme.colors.mint,
                          color: alreadyPaid ? theme.colors.inkMuted : "#FFFFFF",
                          cursor: alreadyPaid || isSaving ? "not-allowed" : "pointer",
                          opacity: isSaving ? 0.7 : 1,
                        }}
                      >
                        {alreadyPaid ? "Issued" : isSaving ? "Saving…" : "Save"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {lastCard && (
        <div style={styles.toast}>
          Exam Card #{String(lastCard.cardNo).padStart(4, "0")} ({examTypeLabel(lastCard.examType)}
          ) waa la sameeyay ardayga <strong>{lastCard.studentName}</strong>.
          <button onClick={() => setLastCard(null)} style={styles.toastClose}>
            ✕
          </button>
        </div>
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
    marginBottom: 20,
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
  noticeBox: {
    background: "#FEF3C7",
    border: "1px solid #FDE68A",
    color: "#92400E",
    borderRadius: theme.radius.sm,
    padding: "12px 16px",
    fontSize: 13.5,
    marginBottom: 18,
  },
  activeBox: {
    background: `${theme.colors.mint}1A`,
    border: `1px solid ${theme.colors.mint}`,
    color: theme.colors.mintDark,
    borderRadius: theme.radius.sm,
    padding: "12px 16px",
    fontSize: 13.5,
    marginBottom: 18,
  },
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
  examTypeChip: {
    display: "inline-block",
    padding: "3px 10px",
    borderRadius: 999,
    background: "#FEF3C7",
    border: "1px solid #FDE68A",
    fontSize: 12,
    fontWeight: 700,
    color: "#92400E",
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
  badgeDot: { width: 6, height: 6, borderRadius: "50%" },
  saveBtn: {
    border: "none",
    padding: "9px 18px",
    borderRadius: theme.radius.sm,
    fontWeight: 700,
    fontSize: 13,
  },
  toast: {
    position: "fixed",
    bottom: 24,
    right: 24,
    background: theme.colors.ink,
    color: "#fff",
    padding: "14px 20px",
    borderRadius: theme.radius.md,
    fontSize: 13.5,
    display: "flex",
    alignItems: "center",
    gap: 14,
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
  },
  toastClose: {
    background: "transparent",
    border: "none",
    color: "#fff",
    cursor: "pointer",
    fontSize: 14,
    opacity: 0.7,
  },
};