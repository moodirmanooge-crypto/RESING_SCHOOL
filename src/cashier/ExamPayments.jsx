// src/cashier/ExamPayments.jsx
//
// Bogga qaadista lacagta Exam Card-ka. Waxaa isticmaala Cashier-ka (role="cashier")
// iyo Admin / Sub-Admin (role="admin", via admin/pages/AdminExamPayments.jsx).
// Labaduba isla `examCards` collection ayay qoraan, sidaas Cashier-ku wuxuu isla
// markiiba arkaa ardayga/fasalka uu Admin-ku qaaday (iyo ka soo horjeedkeeda).
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  setDoc,
  runTransaction,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";

import { db } from "../firebase/firebase";
import { theme } from "./theme.js";
import { currentActor } from "../utils/recycleBin.js";

const SCHOOL_NAME = "Rising School";

// Sameysyada nuuca imtixaanka — isku mid la ExamTimetable.jsx (monthly1, midterm, ...).
// Sameysyadii hore (FinalExam, ...) waa la fahmayaa si xogta jirta aysan u lumin.
const EXAM_TYPE_LABELS = {
  monthly1: "Monthly 1",
  midterm: "Mid Term",
  monthly2: "Monthly 2",
  final: "Final",
};

const LEGACY_EXAM_TYPES = {
  MonthlyExamTest1: "monthly1",
  MidtermExam: "midterm",
  MonthlyTest2: "monthly2",
  FinalExam: "final",
};

function normalizeExamType(key) {
  if (!key) return "final";
  if (LEGACY_EXAM_TYPES[key]) return LEGACY_EXAM_TYPES[key];
  return EXAM_TYPE_LABELS[key] ? key : "final";
}

function examTypeLabel(key) {
  return EXAM_TYPE_LABELS[normalizeExamType(key)];
}

// Taariikhda maanta ee waqtiga maxaliga ah (Soomaaliya UTC+3) — toISOString()
// waxay bixin jirtay maalin hore saacadaha 00:00–03:00.
function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// Lacag qaadistu waxay furan tahay laga bilaabo taariikhda Admin-ku u dhigay
// Cashier-ka (paymentStartDate) ilaa dhamaadka imtixaanka — MA aha maalinta
// imtixaanku bilaabmayo. Haddii paymentStartDate aan la dhigin (xog hore),
// waxaa la isticmaalayaa bilowga imtixaanka sidii hore.
function isPaymentWindowOpen(wk) {
  if (!wk?.startDate || !wk?.endDate) return false;
  const from = wk.paymentStartDate || wk.startDate;
  const today = todayISO();
  return today >= from && today <= wk.endDate;
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

function baseClassOf(student) {
  return String(student.className || "")
    .replace(/part\s*time/i, "")
    .trim()
    .toUpperCase();
}

function cardKey(studentId, examType) {
  return `${studentId}_${examType}`;
}

function safeActorName(role) {
  try {
    const a = currentActor(role);
    if (!a) return "";
    if (typeof a === "string") return a;
    return a.name || a.fullName || a.email || a.username || "";
  } catch {
    return "";
  }
}

export default function ExamPayments({ role = "cashier" }) {
  const actorRole = role === "admin" ? "admin" : "cashier";

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

  // Kaararka la bixiyay — LIVE, si Cashier-ku u arko isla markiiba waxa Admin-ku qaaday
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "examCards"),
      (snap) => {
        const statusMap = {};
        snap.docs.forEach((d) => {
          const data = d.data();
          if (!data.studentId) return;
          const type = normalizeExamType(data.examType);
          statusMap[cardKey(data.studentId, type)] = {
            cardNo: data.cardNo,
            paid: true,
            examType: type,
            amountPaid: data.amountPaid,
            collectedBy: data.collectedBy || "cashier",
            collectedByName: data.collectedByName || "",
          };
        });
        setExamCardStatus(statusMap);
      },
      (err) => console.log("examCards snapshot error:", err)
    );
    return () => unsub();
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

      // Nooca imtixaanka ee fasal kasta oo lacag qaadistiisu furan tahay
      const typeMap = {};
      Object.entries(weekMap)
        .filter(([, wk]) => isPaymentWindowOpen(wk))
        .forEach(([cls, wk]) => {
          typeMap[cls.trim().toUpperCase()] = normalizeExamType(wk.examType);
        });
      setExamTypeByClass(typeMap);

      // 2. Soo qaad DHAMMAAN ardayda (Full Time + Part Time, kuwa Free ahna ku jira)
      // iyo xogta cashier-ka (examinationFees)
      const [studentsSnap, partTimeSnap, cashierSnap] = await Promise.all([
        getDocs(collection(db, "students")),
        getDocs(collection(db, "partTimeStudents")),
        getDocs(collection(db, "cashier")),
      ]);

      const cashierMap = {};
      cashierSnap.docs.forEach((d) => {
        cashierMap[d.id] = d.data();
      });

      const build = (snap, isPartTime) =>
        snap.docs
          .map((d) => {
            const data = d.data();
            if (data.pendingDeletion) return null;
            const c = cashierMap[d.id] || {};
            const studentType = isPartTime ? "Part Time" : data.studentType || "Full Time";
            const studentId = data.studentId || c.studentId || d.id;
            const studentName = data.fullName || c.studentName || "";
            if (!String(studentId).trim() || !String(studentName).trim()) return null;
            return {
              id: d.id,
              ...c,
              ...data,
              studentId,
              studentName,
              studentType,
              examinationFees: c.examinationFees ?? data.examinationFees,
              normalizedClass: getNormalizedClassName(data.className, studentType),
            };
          })
          .filter(Boolean);

      setStudents([...build(studentsSnap, false), ...build(partTimeSnap, true)]);
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
      .filter(([, wk]) => isPaymentWindowOpen(wk))
      .map(([cls]) => cls.trim());

    if (activeWeekClasses.length === 0) return { fullTime: [], partTime: [] };

    const fullTimeSet = new Set();
    const partTimeSet = new Set();

    activeWeekClasses.forEach((cls) => {
      // examWeek had iyo jeer waxay isticmaashaa magacyada asalka ah (tusaale: "1", "F1")
      // maadaama jadwalku isku mid u yahay FT/PT
      fullTimeSet.add(cls);
      partTimeSet.add(`${cls} Part Time`);
    });

    return {
      fullTime: Array.from(fullTimeSet).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
      ),
      partTime: Array.from(partTimeSet).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
      ),
    };
  }, [examWeeks]);

  // Ardayda fasallada lacag qaadistoodu furan tahay (dhamaan fasalka, Free-gana ku jira)
  const activeStudents = useMemo(
    () => students.filter((s) => !!examTypeByClass[baseClassOf(s)]),
    [students, examTypeByClass]
  );

  // Ardayda miiska lagu muujinayo (ka dib filter)
  const filteredStudents = useMemo(() => {
    return activeStudents
      .filter((s) => {
        const t = search.toLowerCase();
        const matchesSearch =
          t === "" ||
          (s.studentId || "").toLowerCase().includes(t) ||
          (s.studentName || "").toLowerCase().includes(t) ||
          (s.normalizedClass || "").toLowerCase().includes(t);

        const matchesClass =
          selectedClass === "All" ||
          String(s.normalizedClass || "").toUpperCase() === selectedClass.toUpperCase();

        return matchesSearch && matchesClass;
      })
      .sort(
        (a, b) =>
          String(a.normalizedClass).localeCompare(String(b.normalizedClass), undefined, {
            numeric: true,
          }) ||
          String(a.studentId).localeCompare(String(b.studentId), undefined, { numeric: true })
      );
  }, [activeStudents, search, selectedClass]);

  // Warbixin kooban oo fasal kasta: imisa la qaaday, imisa Admin, imisa Cashier
  const classSummary = useMemo(() => {
    const map = {};
    activeStudents.forEach((s) => {
      const key = s.normalizedClass;
      if (!map[key]) map[key] = { total: 0, issued: 0, admin: 0, cashier: 0 };
      map[key].total += 1;
      const type = examTypeByClass[baseClassOf(s)];
      const info = examCardStatus[cardKey(s.studentId, type)];
      if (info) {
        map[key].issued += 1;
        if (info.collectedBy === "admin") map[key].admin += 1;
        else map[key].cashier += 1;
      }
    });
    return Object.entries(map).sort(([a], [b]) =>
      a.localeCompare(b, undefined, { numeric: true })
    );
  }, [activeStudents, examTypeByClass, examCardStatus]);

  async function savePaymentAndCard(student) {
    const entered = Number(amounts[student.id] || 0);

    // Hubi in lacag la geliyay (Free-gana waa la bixiyaa lacagta imtixaanka)
    if (entered <= 0) {
      alert("Fadlan geli lacagta imtixaanka ee la bixiyay");
      return;
    }

    // Nooca imtixaanka ee fasalkan (FT/PT isku mid bay u yihiin jadwalka)
    const examType = examTypeByClass[baseClassOf(student)];
    if (!examType) {
      alert("Fasalkan lacag qaadistiisu hadda ma furna.");
      return;
    }

    setSavingId(student.id);
    try {
      const cardDocId = cardKey(student.studentId, examType);

      // Hubi in qof kale (Admin/Cashier) uusan hore u qaadin — lacag labanlaab ma dhacdo
      const existing = await getDoc(doc(db, "examCards", cardDocId));
      if (existing.exists()) {
        const ex = existing.data();
        alert(
          `Ardaygan horey ayaa loo qaaday (${ex.collectedBy === "admin" ? "Admin" : "Cashier"}${
            ex.collectedByName ? ` — ${ex.collectedByName}` : ""
          }). Lacag dambe lama qaadi karo.`
        );
        return;
      }

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
      const collectedByName = safeActorName(actorRole);
      const cardRecord = {
        studentId: student.studentId,
        studentName: student.studentName,
        className: student.normalizedClass, // Isticmaal fasalka saxda ah (FT/PT)
        feeType: student.feeType || "",
        cardNo,
        examType,
        amountPaid: entered,
        schoolName: SCHOOL_NAME,
        collectedBy: actorRole, // "admin" ama "cashier"
        collectedByName,
        createdAt: serverTimestamp(),
      };

      // 1. Kaydi kaarka (si print loo dhigo)
      await setDoc(doc(db, "examCards", cardDocId), cardRecord);

      // 2. Kaydi taariikhda lacag bixinta imtixaanka (receipts)
      await setDoc(doc(db, "examCardPayments", cardDocId), {
        ...cardRecord,
      });

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

  const issuedCount = filteredStudents.filter((s) => {
    const type = examTypeByClass[baseClassOf(s)];
    return !!examCardStatus[cardKey(s.studentId, type)];
  }).length;

  return (
    <div style={{ fontFamily: theme.font.body }}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Exam Payments</h1>
          <p style={styles.subtitle}>
            Qaado lacagta imtixaanka ardayda fasallada lacag aruurintoodu furan tahay (Free-gana ku jira)
          </p>
        </div>
        <div style={styles.headerStats}>
          <div style={styles.statPill}>
            <span style={styles.statNum}>{filteredStudents.length}</span>
            <span style={styles.statLabel}>Students</span>
          </div>
          <div style={styles.statPill}>
            <span style={styles.statNum}>{issuedCount}</span>
            <span style={styles.statLabel}>Cards issued</span>
          </div>
        </div>
      </header>

      {/* Notice Box: Haddii aan jadwalku oolin */}
      {!loading && totalActiveClasses === 0 && (
        <div style={styles.noticeBox}>
          ⚠️ Hadda ma jiro fasal lacag aruurintiisu furan tahay. Maamulku waa inuu ka daaraa Exam
          Timetable bogga taariikhda bilowga lacag aruurinta, bilowga iyo dhamaadka imtixaanka.
        </div>
      )}

      {/* Warbixin kooban oo fasal kasta (riix si aad u shaandheyso) */}
      {classSummary.length > 0 && (
        <div style={styles.summaryRow}>
          {classSummary.map(([cls, s]) => (
            <button
              key={cls}
              type="button"
              onClick={() => setSelectedClass(selectedClass === cls ? "All" : cls)}
              style={{
                ...styles.summaryChip,
                ...(selectedClass === cls ? styles.summaryChipActive : {}),
              }}
            >
              <strong>{cls}</strong>
              <span>
                {s.issued}/{s.total} la qaaday
              </span>
              <span style={styles.summarySub}>
                Admin: {s.admin} · Cashier: {s.cashier}
              </span>
            </button>
          ))}
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
              Arday lama helin fasallada lacag aruurintoodu hadda furan tahay.
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
                <th style={styles.th}>Collected By</th>
                <th style={styles.th}>Save</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student, i) => {
                const studentExamType = examTypeByClass[baseClassOf(student)];
                if (!studentExamType) return null;

                const cardInfo = examCardStatus[cardKey(student.studentId, studentExamType)];
                const alreadyPaid = !!cardInfo?.paid;
                const isSaving = savingId === student.id;
                const isFreeStudent = student.feeType === "Free";

                return (
                  <tr
                    key={student.id}
                    style={{ background: i % 2 === 0 ? "#FFFFFF" : "#FAFCFB" }}
                  >
                    <td style={styles.td}>
                      <span style={styles.idChip}>{student.studentId}</span>
                    </td>
                    <td style={{ ...styles.td, fontWeight: 600 }}>
                      {student.studentName}
                      {isFreeStudent && <span style={styles.freeChip}>Free</span>}
                    </td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.classChip,
                          color: (student.normalizedClass || "").includes("Part Time")
                            ? "#92400E"
                            : "#1F2937",
                          background: (student.normalizedClass || "").includes("Part Time")
                            ? "#FEF3C7"
                            : "#F3F4F6",
                        }}
                      >
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
                        <span style={{ color: theme.colors.inkMuted, fontSize: 12.5 }}>
                          {cardInfo.amountPaid ? `$${cardInfo.amountPaid}` : "—"}
                        </span>
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
                      {alreadyPaid ? (
                        <span
                          style={{
                            ...styles.collectorChip,
                            ...(cardInfo.collectedBy === "admin" ? styles.collectorAdmin : {}),
                          }}
                          title={cardInfo.collectedByName || ""}
                        >
                          {cardInfo.collectedBy === "admin" ? "Admin" : "Cashier"}
                          {cardInfo.collectedByName ? ` · ${cardInfo.collectedByName}` : ""}
                        </span>
                      ) : (
                        "—"
                      )}
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
  summaryRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 18,
  },
  summaryChip: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 2,
    padding: "10px 14px",
    borderRadius: theme.radius.sm,
    background: theme.colors.card,
    border: `1px solid ${theme.colors.border}`,
    color: theme.colors.ink,
    fontSize: 12.5,
    cursor: "pointer",
    textAlign: "left",
  },
  summaryChipActive: {
    borderColor: theme.colors.mint,
    boxShadow: `0 0 0 2px ${theme.colors.mint}33`,
  },
  summarySub: { fontSize: 11, color: theme.colors.inkMuted },
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
  freeChip: {
    display: "inline-block",
    marginLeft: 8,
    padding: "2px 8px",
    borderRadius: 999,
    background: "#E0F2FE",
    color: "#0369A1",
    fontSize: 11,
    fontWeight: 700,
  },
  collectorChip: {
    display: "inline-block",
    padding: "3px 10px",
    borderRadius: 999,
    background: "#F3F4F6",
    color: "#374151",
    fontSize: 12,
    fontWeight: 700,
  },
  collectorAdmin: {
    background: "#EDE9FE",
    color: "#5B21B6",
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