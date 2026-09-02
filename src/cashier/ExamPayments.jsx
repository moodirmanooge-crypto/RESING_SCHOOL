// src/cashier/ExamPayments.jsx
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  runTransaction,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";

import { db } from "../firebase/firebase";
import { theme } from "./theme.js";

const SCHOOL_NAME = "Rising School";

const EXAM_TYPE_LABELS = {
  MonthlyExamTest1: "Monthly Exam Test 1",
  MidtermExam: "Midterm Exam",
  MonthlyTest2: "Monthly Test 2",
  FinalExam: "Final Exam",
};

function examTypeLabel(key) {
  return EXAM_TYPE_LABELS[key] || "Final";
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function isExamWeekActive(wk) {
  if (!wk?.startDate || !wk?.endDate) return false;
  const today = todayISO();
  return today >= wk.startDate && today <= wk.endDate;
}

// Hubinta in magaca fasalka iyo ardaygu isu dhigmaan (Full Time vs Part Time)
function getNormalizedClassName(rawClass, studentType) {
  const cleanClass = String(rawClass || "").trim();
  if (!cleanClass) return "Unknown";
  
  const isPartTime =
    String(studentType || "").toLowerCase() === "part time" ||
    cleanClass.toLowerCase().includes("part time");

  const baseClass = cleanClass.replace(/part\s*time/i, "").trim();

  if (isPartTime) {
    return `${baseClass} Part Time`;
  }
  return baseClass;
}

export default function ExamPayments() {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [examWeeks, setExamWeeks] = useState({});
  const [examTypeByClass, setExamTypeByClass] = useState({});
  const [examCardStatus, setExamCardStatus] = useState({});
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState("All");
  const [amounts, setAmounts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [lastCard, setLastCard] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      // 1. Soo qaad Timetable-ka Imtixaanka
      const examWeekSnap = await getDocs(collection(db, "examWeek"));
      const weekMap = {};
      examWeekSnap.docs.forEach((d) => {
        weekMap[d.id] = d.data();
      });
      setExamWeeks(weekMap);

      const activeEntries = Object.entries(weekMap).filter(([, wk]) => isExamWeekActive(wk));
      
      // Halkan waxaan ku kaydinaynaa nooca imtixaanka ee fasal kasta (tusaale: "1" -> "FinalExam")
      const typeMap = {};
      activeEntries.forEach(([cls, wk]) => {
        typeMap[cls.toUpperCase()] = wk.examType || "FinalExam";
      });
      setExamTypeByClass(typeMap);

      // 2. Soo qaad Ardayda (Cashier collection) si loo arko fee-ga imtixaanka
      // Fiiro gaar ah: Cashier collection waa inuu lahaadaa studentId, className, studentType, examinationFees
      const cashierSnap = await getDocs(collection(db, "cashier"));
      
      const allStudents = cashierSnap.docs
        .map((d) => {
          const data = d.data();
          // Habeey magaca fasalka (tusaale: "1" + "Part Time" -> "1 Part Time")
          const normalizedClass = getNormalizedClassName(data.className, data.studentType);
          return {
            id: d.id,
            ...data,
            normalizedClass, // Fasalka la habeeyay
          };
        })
        .filter(
          (s) =>
            s.studentId &&
            String(s.studentId).trim() !== "" &&
            s.studentName &&
            String(s.studentName).trim() !== ""
        );

      setStudents(allStudents);

      // 3. Soo qaad kaararka imtixaanka ee horay loo bixiyay
      const cardsSnap = await getDocs(collection(db, "examCards"));
      const statusMap = {};
      cardsSnap.docs.forEach((d) => {
        const data = d.data();
        if (!data.studentId) return;
        statusMap[data.studentId] = {
          cardNo: data.cardNo,
          paid: true,
          examType: data.examType || "FinalExam",
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

  // Kala soocidda fasallada firfircoon (Dropdown Options)
  const classOptions = useMemo(() => {
    const activeWeekClasses = Object.entries(examWeeks)
      .filter(([, wk]) => isExamWeekActive(wk))
      .map(([cls]) => cls.trim());

    if (activeWeekClasses.length === 0) return { fullTime: [], partTime: [] };

    const fullTimeSet = new Set();
    const partTimeSet = new Set();

    activeWeekClasses.forEach(cls => {
      // examWeek had iyo jeer waxay isticmaashaa magacyada asalka ah (tusaale: "1", "F1")
      // maadaama jadwalku isku mid u yahay FT/PT
      fullTimeSet.add(cls);
      partTimeSet.add(`${cls} Part Time`);
    });

    return {
      fullTime: Array.from(fullTimeSet).sort((a,b) => a.localeCompare(b, undefined, {numeric: true})),
      partTime: Array.from(partTimeSet).sort((a,b) => a.localeCompare(b, undefined, {numeric: true})),
    };
  }, [examWeeks]);

  // Ardayda miiska lagu muujinayo (ka dib filter)
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      // 1. Search filter
      const t = search.toLowerCase();
      const matchesSearch =
        t === "" ||
        (s.studentId || "").toLowerCase().includes(t) ||
        (s.studentName || "").toLowerCase().includes(t) ||
        (s.normalizedClass || "").toLowerCase().includes(t);

      // 2. Class dropdown filter
      const matchesClass =
        selectedClass === "All" ||
        String(s.normalizedClass || "").toUpperCase() === selectedClass.toUpperCase();

      return matchesSearch && matchesClass;
    });
  }, [students, search, selectedClass]);

  async function savePaymentAndCard(student) {
    const entered = Number(amounts[student.id] || 0);
    
    // Hubi in lacag la geliyay
    if (entered <= 0) {
      alert("Fadlan geli lacagta imtixaanka ee la bixiyay");
      return;
    }

    // Raadi nooca imtixaanka ee fasalkan (FT/PT isku mid bay u yihiin jadwalka)
    const baseClass = (student.className || "").replace(/part\s*time/i, "").trim().toUpperCase();
    const examType = examTypeByClass[baseClass] || "FinalExam";

    setSavingId(student.id);
    try {
      const counterRef = doc(db, "examCardCounters", examType);
      let cardNo = 0;

      // Transaction: Si card number-ka loo siiyo si otomaatig ah oo aan isku dhicin
      await runTransaction(db, async (tx) => {
        const counterSnap = await tx.get(counterRef);
        let current = counterSnap.exists() ? counterSnap.data().lastNumber || 0 : 0;
        const assigned = counterSnap.exists() ? counterSnap.data().assigned || {} : {};

        // Haddii ardaygu horey u lahaa nambar, isticmaal kanas
        if (assigned[student.studentId]) {
          cardNo = assigned[student.studentId];
        } else {
          // Haddii kale, kordhi counter-ka oo sii nambar cusub
          current += 1;
          assigned[student.studentId] = current;
          cardNo = current;
        }

        tx.set(
          counterRef,
          { lastNumber: current, assigned, examType, updatedAt: serverTimestamp() },
          { merge: true }
        );
      });

      // Kaydi diiwaanka kaarka iyo lacag bixinta
      const cardDocId = `${student.studentId}_${examType}`;
      const cardRecord = {
        studentId: student.studentId,
        studentName: student.studentName,
        className: student.normalizedClass, // Isticmaal fasalka saxda ah (FT/PT)
        cardNo,
        examType,
        amountPaid: entered,
        schoolName: SCHOOL_NAME,
        createdAt: serverTimestamp(),
      };

      // 1. Kaydi kaarka (si print loo dhigo)
      await setDoc(doc(db, "examCards", cardDocId), cardRecord);

      // 2. Kaydi taariikhda lacag bixinta imtixaanka (receipts)
      await setDoc(doc(db, "examCardPayments", cardDocId), {
        ...cardRecord,
      });

      // Cusboonaysii state-ka si ay miiska uga muuqato
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

  // Tirada guud ee fasallada firfircoon
  const totalActiveClasses = classOptions.fullTime.length + classOptions.partTime.length;

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
            <span style={styles.statNum}>{filteredStudents.length}</span>
            <span style={styles.statLabel}>Students</span>
          </div>
          <div style={styles.statPill}>
            <span style={styles.statNum}>
              {
                filteredStudents.filter((s) => {
                  // Raadi base class si loo arko nooca imtixaanka jadwalka
                  const baseClass = (s.className || "").replace(/part\s*time/i, "").trim().toUpperCase();
                  const type = examTypeByClass[baseClass];
                  const cardInfo = examCardStatus[s.studentId];
                  return cardInfo?.paid && cardInfo.examType === type;
                }).length
              }
            </span>
            <span style={styles.statLabel}>Cards issued</span>
          </div>
        </div>
      </header>

      {/* Notice Box: Haddii aan jadwalku oolin */}
      {!loading && totalActiveClasses === 0 && (
        <div style={styles.noticeBox}>
          ⚠️ Hadda ma jiro fasal xilli imtixaan ah oo furan. Maamulku waa inuu ka daaraa Exam
          Timetable bogga taariikhda bilowga iyo dhamaadka imtixaanka.
        </div>
      )}

      {/* Control Row: Search Input + Class Filter Dropdown */}
      <div style={styles.controlsRow}>
        <div style={styles.searchRow}>
          <span style={styles.searchIcon}>🔍</span>
          <input
            placeholder="Search Student ID / Name / Class (FT/PT)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.search}
          />
        </div>

        <div style={styles.selectWrapper}>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            style={styles.classSelect}
          >
            <option value="All">Dhammaan Fasallada Socda ({totalActiveClasses})</option>
            
            {classOptions.fullTime.length > 0 && (
              <optgroup label="🏫 Full Time Classes">
                {classOptions.fullTime.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </optgroup>
            )}

            {classOptions.partTime.length > 0 && (
              <optgroup label="⏱️ Part Time Classes">
                {classOptions.partTime.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
      </div>

      <div style={styles.tableCard}>
        {loading ? (
          <div style={styles.emptyState}>
            <div style={styles.spinner} />
            <p style={{ color: theme.colors.inkMuted, marginTop: 12 }}>
              Loading students...
            </p>
          </div>
        ) : filteredStudents.length === 0 ? (
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
                <th style={styles.th}>Class (FT/PT)</th>
                <th style={styles.th}>Nuuca Imtixaanka</th>
                <th style={styles.th}>Exam Fees</th>
                <th style={styles.th}>Enter Amount</th>
                <th style={styles.th}>Card No</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Save</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student, i) => {
                // Raadi base class si loo ogaado nooca imtixaanka
                const baseClass = (student.className || "").replace(/part\s*time/i, "").trim().toUpperCase();
                const studentExamType = examTypeByClass[baseClass];
                
                // Haddii fasalka ardayga aan jadwalka lagu darin, ha soo bandhigin
                if (!studentExamType) return null;

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
                    <td style={{ ...styles.td, fontWeight: 600 }}>{student.studentName}</td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.classChip,
                        color: (student.normalizedClass || "").includes("Part Time") ? "#92400E" : "#1F2937",
                        background: (student.normalizedClass || "").includes("Part Time") ? "#FEF3C7" : "#F3F4F6",
                      }}>
                        {student.normalizedClass || "—"}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.examTypeChip}>{examTypeLabel(studentExamType)}</span>
                    </td>
                    <td style={{ ...styles.td, ...styles.money }}>
                      {student.examinationFees ? `$${student.examinationFees}` : "—"}
                    </td>
                    <td style={styles.td}>
                      {alreadyPaid ? (
                        <span style={{ color: theme.colors.inkMuted, fontSize: 12.5 }}>—</span>
                      ) : (
                        <input
                          type="number"
                          placeholder={student.examinationFees ? `$${student.examinationFees}` : "0"}
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

      {/* Toast Notification */}
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
  controlsRow: {
    display: "flex",
    gap: 16,
    marginBottom: 20,
    flexWrap: "wrap",
    alignItems: "center",
  },
  searchRow: { position: "relative", flex: 1, minWidth: 260 },
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
  selectWrapper: { minWidth: 220 },
  classSelect: {
    width: "100%",
    padding: "12px 16px",
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`,
    background: theme.colors.card,
    fontSize: 14,
    color: theme.colors.ink,
    outline: "none",
    cursor: "pointer",
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
  classChip: {
    display: "inline-block",
    padding: "3px 10px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
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
    zIndex: 1000,
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