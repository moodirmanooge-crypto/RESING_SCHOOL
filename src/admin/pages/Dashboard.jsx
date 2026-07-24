// src/admin/pages/Dashboard.jsx
//admind dashboard.jsx
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Send, Clock, IdCard } from "lucide-react";
import { db } from "../../firebase/firebase";
import { collection, getDocs } from "firebase/firestore";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import DashboardCard from "../components/DashboardCard";
import SendSmsModal from "../components/SendSmsModal";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const CLASS_COLORS = ["#6D5DF0", "#f59e0b", "#22c55e", "#c084fc", "#ef4444", "#0ea5e9"];

// Compares docs created in the current calendar month vs the previous one,
// using each doc's createdAt timestamp. Returns null when there isn't
// enough createdAt data to compute a meaningful percentage (so the UI can
// hide the badge instead of showing a made-up number).
function computeMonthGrowth(docsList) {
  const withDates = docsList.filter((d) => d.createdAt?.seconds);
  if (withDates.length === 0) return null;

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000;
  const lastMonthStart =
    new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime() / 1000;

  const thisMonthCount = withDates.filter((d) => d.createdAt.seconds >= thisMonthStart).length;
  const lastMonthCount = withDates.filter(
    (d) => d.createdAt.seconds >= lastMonthStart && d.createdAt.seconds < thisMonthStart
  ).length;

  if (lastMonthCount === 0) {
    return thisMonthCount > 0 ? 100 : 0;
  }
  return Math.round(((thisMonthCount - lastMonthCount) / lastMonthCount) * 100);
}

// Formats a Firestore Timestamp / Date / date-like value into just the
// time portion (e.g. "08:32 AM"), for showing on the shift tracker card.
function formatTimeOnly(v) {
  if (!v) return "—";
  const d = v.toDate ? v.toDate() : new Date(v);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatShiftDuration(ms) {
  if (!ms || ms <= 0) return "—";
  const totalMinutes = Math.round(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

const cardStyle = {
  background: "#fff",
  borderRadius: 18,
  padding: "20px 22px",
  boxShadow: "0 4px 18px rgba(17,24,39,0.06)",
  border: "1px solid rgba(17,24,39,0.05)",
  minWidth: 0,
};

const cardTitleStyle = {
  margin: "0 0 14px",
  fontSize: 15,
  color: "#111827",
  fontWeight: 700,
};

function MiniCalendar() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const monthLabel = now.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#111827", marginBottom: 10, textAlign: "center" }}>
        {monthLabel}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, fontSize: 10.5, color: "#9CA3AF", textAlign: "center", marginBottom: 4 }}>
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
        {cells.map((d, i) => (
          <div
            key={i}
            style={{
              height: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11.5,
              borderRadius: "50%",
              color: d === today ? "#fff" : d ? "#374151" : "transparent",
              background: d === today ? "#16a34a" : "transparent",
              fontWeight: d === today ? 700 : 400,
            }}
          >
            {d || ""}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [teachersCount, setTeachersCount] = useState(0);
  const [parentsCount, setParentsCount] = useState(0);
  const [classesCount, setClassesCount] = useState(0);
  const [cashiersCount, setCashiersCount] = useState(0);
  const [classBreakdown, setClassBreakdown] = useState([]);
  const [feeStats, setFeeStats] = useState({ total: 0, collected: 0, pending: 0 });
  const [teachersList, setTeachersList] = useState([]);
  const [examsByClass, setExamsByClass] = useState([]);
  const [resultsSummary, setResultsSummary] = useState([]);
  const [attendanceStats, setAttendanceStats] = useState({ present: 0, absent: 0, late: 0, total: 0 });
  const [upcomingExams, setUpcomingExams] = useState([]);
  const [notices, setNotices] = useState([]);
  const [todaysShifts, setTodaysShifts] = useState([]);
  const [growth, setGrowth] = useState({
    students: null,
    teachers: null,
    cashiers: null,
    parents: null,
    classes: null,
  });

  const [loading, setLoading] = useState(true);
  const [smsModalOpen, setSmsModalOpen] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    try {
      setLoading(true);

      const studentsSnap = await getDocs(collection(db, "students"));
      const studentsList = studentsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setStudents(studentsList);

      const teachersSnap = await getDocs(collection(db, "teachers"));
      const teachersList = teachersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTeachersCount(teachersList.length);

      // Build a teacherId -> name/photo lookup, reused below for the shift
      // tracker card so it can show who's clocked in without extra reads.
      const teachersById = {};
      teachersList.forEach((t) => {
        teachersById[t.id] = t;
      });

      const cashierSnap = await getDocs(collection(db, "cashier"));
      // Only count cashier docs whose ID is a real username-style string,
      // not the numeric/padded-number placeholder docs (e.g. "0001", "0002").
      const cashierList = cashierSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((c) => !/^\d+$/.test(c.id));
      setCashiersCount(cashierList.length);

      const uniqueParentPhones = new Set(
        studentsList
          .map((s) => s.parentPhone)
          .filter((phone) => phone && phone.trim() !== "")
      );
      setParentsCount(uniqueParentPhones.size);

      // Class breakdown (for pie chart)
      const classCounts = {};
      studentsList.forEach((s) => {
        const cls = s.className && s.className.trim() !== "" ? s.className : null;
        if (cls) classCounts[cls] = (classCounts[cls] || 0) + 1;
      });
      const breakdown = Object.entries(classCounts).map(([name, count], i) => ({
        name,
        value: count,
        color: CLASS_COLORS[i % CLASS_COLORS.length],
      }));
      setClassBreakdown(breakdown);
      setClassesCount(breakdown.length);

      // Growth badges — computed from real createdAt timestamps, month over
      // month. null means "not enough data", which hides the badge in the UI
      // instead of showing a fake percentage.
      setGrowth({
        students: computeMonthGrowth(studentsList),
        teachers: computeMonthGrowth(teachersList),
        cashiers: computeMonthGrowth(cashierList),
        parents: null, // parents aren't a real collection with createdAt — no reliable growth signal
        classes: null, // classes are derived from student.className, not their own dated docs
      });

      // Fee stats — pulled from the real "payments" collection (source of truth
      // for money actually collected) and the "monthlyFee" field on each student
      // (source of truth for what's expected). Student docs do NOT have
      // totalFee/paidFee fields, so those can't be used.
      const paymentsSnap = await getDocs(collection(db, "payments"));
      const paymentsList = paymentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const collected = paymentsList.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      const expectedTotal = studentsList.reduce(
        (sum, s) => sum + (Number(s.monthlyFee) || 0),
        0
      );

      setFeeStats({
        total: expectedTotal,
        collected,
        pending: Math.max(expectedTotal - collected, 0),
      });

      // Full teachers list (for the Teachers table on the dashboard)
      setTeachersList(
        teachersList.map((t) => ({
          id: t.id,
          fullName: t.fullName || t.name || t.id,
          subject: t.subject || "—",
          username: t.username || t.id,
        }))
      );

      // Exams grouped by class
      const examsSnap = await getDocs(collection(db, "exams"));
      const examsList = examsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const examsByClassMap = {};
      examsList.forEach((e) => {
        const cls = e.className || e.classId || "Unassigned";
        if (!examsByClassMap[cls]) examsByClassMap[cls] = [];
        examsByClassMap[cls].push(e);
      });
      const examsByClassArr = Object.entries(examsByClassMap)
        .map(([className, list]) => ({ className, exams: list }))
        .sort((a, b) => a.className.localeCompare(b.className, undefined, { numeric: true }));
      setExamsByClass(examsByClassArr);

      // Results — combine all marks per student into a single row per
      // student with a computed average (sum of marks / sum of maxMarks),
      // like a spreadsheet summary row.
      const resultsSnap = await getDocs(collection(db, "results"));
      const resultsList = resultsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const byStudent = {};
      resultsList.forEach((r) => {
        const key = r.studentId || r.studentName || r.id;
        if (!byStudent[key]) {
          byStudent[key] = {
            studentId: r.studentId || "",
            studentName: r.studentName || "Unknown",
            className: r.className || "",
            subjects: [],
            totalMarks: 0,
            totalMax: 0,
          };
        }
        const marks = Number(r.marks) || 0;
        const maxMarks = Number(r.maxMarks) || 0;
        byStudent[key].subjects.push({ subject: r.subject || "—", marks, maxMarks });
        byStudent[key].totalMarks += marks;
        byStudent[key].totalMax += maxMarks;
      });
      const resultsSummary = Object.values(byStudent).map((s) => ({
        ...s,
        average: s.totalMax > 0 ? Math.round((s.totalMarks / s.totalMax) * 100) : 0,
      }));
      setResultsSummary(resultsSummary);

      // Attendance overview — today's real attendance records from the
      // "attendance" collection (status field: Present / Absent / Late).
      const attendanceSnap = await getDocs(collection(db, "attendance"));
      const attendanceList = attendanceSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const todayStr = new Date().toISOString().slice(0, 10);
      const todaysRecords = attendanceList.filter((a) => {
        if (a.date) return String(a.date).slice(0, 10) === todayStr;
        if (a.createdAt?.seconds) {
          return new Date(a.createdAt.seconds * 1000).toISOString().slice(0, 10) === todayStr;
        }
        return false;
      });
      const present = todaysRecords.filter((a) => (a.status || "").toLowerCase() === "present").length;
      const absent = todaysRecords.filter((a) => (a.status || "").toLowerCase() === "absent").length;
      const late = todaysRecords.filter((a) => (a.status || "").toLowerCase() === "late").length;
      setAttendanceStats({ present, absent, late, total: todaysRecords.length });

      // Upcoming exams — real exam docs with a date in the future, soonest first
      const now2 = new Date();
      const withDates = examsList
        .filter((e) => e.date)
        .map((e) => ({ ...e, dateObj: new Date(e.date) }))
        .filter((e) => !isNaN(e.dateObj.getTime()) && e.dateObj >= now2)
        .sort((a, b) => a.dateObj - b.dateObj)
        .slice(0, 4);
      setUpcomingExams(withDates);

      // Notice board — real broadcast messages from admin, most recent first
      const messagesSnap = await getDocs(collection(db, "messages"));
      const messagesList = messagesSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((m) => m.scope === "broadcast" || m.audienceGroup === "broadcast");
      messagesList.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setNotices(messagesList.slice(0, 4));

      // Teacher Shifts — every shift doc whose clockInAt falls on today's
      // calendar date, newest first, enriched with the teacher's name/photo
      // (falling back to whatever the shift doc itself stored).
      const shiftsSnap = await getDocs(collection(db, "shifts"));
      const shiftsList = shiftsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const todaysShiftsList = shiftsList
        .filter((s) => {
          const d = s.clockInAt?.toDate ? s.clockInAt.toDate() : new Date(s.clockInAt);
          if (isNaN(d.getTime())) return false;
          return d.toISOString().slice(0, 10) === todayStr;
        })
        .map((s) => {
          const teacher = teachersById[s.teacherId];
          return {
            ...s,
            resolvedName: teacher?.fullName || s.teacherName || "Macalin aan la aqoon",
            resolvedPhoto: teacher?.photoUrl || teacher?.teacherPhoto || "",
          };
        })
        .sort((a, b) => {
          const at = a.clockInAt?.seconds || 0;
          const bt = b.clockInAt?.seconds || 0;
          return bt - at;
        });
      setTodaysShifts(todaysShiftsList);
    } catch (error) {
      console.error("Khalad ayaa dhacay markii xogta Dashboard laga soo qaadanayay:", error);
    } finally {
      setLoading(false);
    }
  }

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Overview chart: real student registrations for the current month, grouped
  // by week, using each student's actual createdAt timestamp.
  const overviewData = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const monthLabel = now.toLocaleDateString("en-GB", { month: "short" });
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Build week buckets: 1-7, 8-14, 15-21, 22-28, 29-end
    const weekStarts = [1, 8, 15, 22, 29].filter((d) => d <= daysInMonth);
    const buckets = weekStarts.map((start, i) => {
      const end = i + 1 < weekStarts.length ? weekStarts[i + 1] - 1 : daysInMonth;
      return { start, end, label: `${monthLabel} ${start}` };
    });

    const withDates = students.filter((s) => s.createdAt?.seconds);

    let running = 0;
    return buckets.map((b) => {
      const count = withDates.filter((s) => {
        const d = new Date(s.createdAt.seconds * 1000);
        return d.getFullYear() === year && d.getMonth() === month && d.getDate() >= b.start && d.getDate() <= b.end;
      }).length;
      running += count;
      return { day: b.label, value: running };
    });
  }, [students]);

  const feePercent =
    feeStats.total > 0 ? Math.round((feeStats.collected / feeStats.total) * 100) : 0;

  const activeShiftsCount = todaysShifts.filter((s) => s.status === "open").length;

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "#F3F4F8",
        fontFamily: "'Inter','Segoe UI',sans-serif",
      }}
    >
      <Sidebar />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: "22px 26px 0" }}>
          <Topbar />
        </div>

        <div style={{ padding: "26px 30px" }}>
          <div
            style={{
              background: "linear-gradient(120deg,#0f3d2e,#166534 55%,#22a05f)",
              borderRadius: 20,
              padding: "32px 34px",
              marginBottom: 24,
              color: "#fff",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <p style={{ margin: "0 0 6px", fontSize: 14, opacity: 0.85 }}>Welcome back,</p>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, lineHeight: 1.15 }}>
              RISING STAR PRIMARY & SECONDRY SCHOOL!
            </h1>
            <p style={{ margin: "10px 0 20px", fontSize: 14, opacity: 0.9, maxWidth: 420 }}>
              Smart Management, EDUCATION IS LIFE IT SELF.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button
                onClick={() => navigate("/admin/reports")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "12px 22px",
                  borderRadius: 14,
                  border: "none",
                  background: "#fff",
                  color: "#166534",
                  fontWeight: 700,
                  fontSize: 13.5,
                  cursor: "pointer",
                }}
              >
                Explore Dashboard
                <Send size={15} />
              </button>

              <button
                onClick={() => setSmsModalOpen(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "12px 22px",
                  borderRadius: 14,
                  border: "1.5px solid rgba(255,255,255,0.5)",
                  background: "rgba(255,255,255,0.12)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 13.5,
                  cursor: "pointer",
                }}
              >
                Send SMS
                <Send size={15} />
              </button>

              <button
                onClick={() => navigate("/admin/exam-cards")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "12px 22px",
                  borderRadius: 14,
                  border: "1.5px solid rgba(255,255,255,0.5)",
                  background: "rgba(255,255,255,0.12)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 13.5,
                  cursor: "pointer",
                }}
              >
                Exam Cards
                <IdCard size={15} />
              </button>
            </div>
          </div>

          {smsModalOpen && <SendSmsModal onClose={() => setSmsModalOpen(false)} />}

          {/* Stat cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "20px",
              marginBottom: 24,
            }}
          >
            <DashboardCard
              title="Students"
              value={loading ? "..." : students.length}
              icon="🎓"
              color="#16a34a"
              percent={growth.students !== null ? `${growth.students}%` : null}
            />
            <DashboardCard
              title="Teachers"
              value={loading ? "..." : teachersCount}
              icon="🧑‍🏫"
              color="#f59e0b"
              percent={growth.teachers !== null ? `${growth.teachers}%` : null}
            />
            <DashboardCard
              title="Cashiers"
              value={loading ? "..." : cashiersCount}
              icon="💰"
              color="#0ea5e9"
              percent={growth.cashiers !== null ? `${growth.cashiers}%` : null}
            />
            <DashboardCard
              title="Parents"
              value={loading ? "..." : parentsCount}
              icon="👨‍👩‍👧"
              color="#7c3aed"
              percent={growth.parents !== null ? `${growth.parents}%` : null}
            />
            <DashboardCard
              title="Classes"
              value={loading ? "..." : classesCount}
              icon="🏫"
              color="#ec4899"
              percent={growth.classes !== null ? `${growth.classes}%` : null}
            />
          </div>

          {/* Overview + Fee Collection */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.6fr 1fr",
              gap: 20,
              marginBottom: 24,
            }}
            className="dash-row"
          >
            {/* Overview chart */}
            <div
              style={{
                background: "#fff",
                borderRadius: 18,
                padding: "22px 24px",
                boxShadow: "0 4px 18px rgba(17,24,39,0.06)",
                border: "1px solid rgba(17,24,39,0.05)",
                minWidth: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <h3 style={{ margin: 0, fontSize: 16, color: "#111827", fontWeight: 700 }}>
                  Overview
                </h3>
                <span style={{ fontSize: 12.5, color: "#6D5DF0", fontWeight: 600 }}>
                  This Month
                </span>
              </div>

              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={overviewData}>
                    <CartesianGrid stroke="#F0F0F5" vertical={false} />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 11, fill: "#9CA3AF" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#9CA3AF" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#6D5DF0"
                      strokeWidth={3}
                      dot={{ r: 4, fill: "#6D5DF0" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Fee Collection */}
            <div
              style={{
                background: "#fff",
                borderRadius: 18,
                padding: "22px 24px",
                boxShadow: "0 4px 18px rgba(17,24,39,0.06)",
                border: "1px solid rgba(17,24,39,0.05)",
                minWidth: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 14,
                }}
              >
                <h3 style={{ margin: 0, fontSize: 16, color: "#111827", fontWeight: 700 }}>
                  Fee Collection
                </h3>
                <span style={{ fontSize: 12.5, color: "#6D5DF0", fontWeight: 600 }}>
                  This Month
                </span>
              </div>

              <div style={{ height: 160, position: "relative" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Collected", value: feeStats.collected || 1 },
                        { name: "Pending", value: feeStats.pending || 0 },
                      ]}
                      innerRadius={55}
                      outerRadius={72}
                      paddingAngle={2}
                      dataKey="value"
                      startAngle={90}
                      endAngle={-270}
                    >
                      <Cell fill="#6D5DF0" />
                      <Cell fill="#EDE9FE" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%,-50%)",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#111827" }}>
                    {feePercent}%
                  </div>
                  <div style={{ fontSize: 11.5, color: "#9CA3AF" }}>Collected</div>
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                {[
                  { label: "Total Fees", value: feeStats.total, color: "#6D5DF0" },
                  { label: "Collected", value: feeStats.collected, color: "#22c55e" },
                  { label: "Pending", value: feeStats.pending, color: "#ef4444" },
                ].map((row) => (
                  <div
                    key={row.label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: 13,
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 8, color: "#6B7280" }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: row.color,
                          display: "inline-block",
                        }}
                      />
                      {row.label}
                    </span>
                    <span style={{ fontWeight: 700, color: "#111827" }}>
                      ${row.value.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Attendance Overview + Upcoming Exams + Notice Board + Calendar */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr 1fr",
              gap: 20,
              marginBottom: 24,
            }}
            className="dash-row-4"
          >
            {/* Attendance Overview — real attendance docs for today */}
            <div style={cardStyle}>
              <h3 style={cardTitleStyle}>Attendance Overview</h3>
              {attendanceStats.total === 0 && !loading ? (
                <p style={{ fontSize: 13, color: "#9CA3AF" }}>
                  Xogta imaanshaha maanta lama helin.
                </p>
              ) : (
                <>
                  <div style={{ width: 130, height: 130, margin: "0 auto", position: "relative" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Present", value: attendanceStats.present },
                            { name: "Absent", value: attendanceStats.absent },
                            { name: "Late", value: attendanceStats.late },
                          ]}
                          innerRadius={45}
                          outerRadius={62}
                          paddingAngle={2}
                          dataKey="value"
                          startAngle={90}
                          endAngle={-270}
                        >
                          <Cell fill="#16a34a" />
                          <Cell fill="#ef4444" />
                          <Cell fill="#f59e0b" />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%,-50%)",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: 20, fontWeight: 800, color: "#111827" }}>
                        {attendanceStats.total > 0
                          ? Math.round((attendanceStats.present / attendanceStats.total) * 100)
                          : 0}
                        %
                      </div>
                      <div style={{ fontSize: 10, color: "#9CA3AF" }}>Present</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 14, fontSize: 12.5 }}>
                    {[
                      { label: "Present", value: attendanceStats.present, color: "#16a34a" },
                      { label: "Absent", value: attendanceStats.absent, color: "#ef4444" },
                      { label: "Late", value: attendanceStats.late, color: "#f59e0b" },
                    ].map((row) => (
                      <div
                        key={row.label}
                        style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}
                      >
                        <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#6B7280" }}>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: row.color, display: "inline-block" }} />
                          {row.label}
                        </span>
                        <span style={{ fontWeight: 700, color: "#111827" }}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Upcoming Exams — real exam docs with a future date */}
            <div style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ ...cardTitleStyle, margin: 0 }}>Upcoming Exams</h3>
                <span
                  style={{ fontSize: 12, color: "#16a34a", fontWeight: 600, cursor: "pointer" }}
                  onClick={() => navigate("/admin/exams")}
                >
                  View All
                </span>
              </div>
              {upcomingExams.length === 0 && !loading && (
                <p style={{ fontSize: 13, color: "#9CA3AF" }}>Imtixaano soo socda lama helin.</p>
              )}
              {upcomingExams.map((e) => (
                <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      background: "#E6F5EC",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    📋
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>
                      {e.examName || "Exam"}
                    </div>
                    <div style={{ fontSize: 11.5, color: "#9CA3AF" }}>
                      {e.dateObj.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      {e.className ? ` · Class ${e.className}` : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Notice Board — driven by broadcast messages sent from admin */}
            <div style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ ...cardTitleStyle, margin: 0 }}>Notice Board</h3>
                <span
                  style={{ fontSize: 12, color: "#16a34a", fontWeight: 600, cursor: "pointer" }}
                  onClick={() => navigate("/admin/messages")}
                >
                  View All
                </span>
              </div>
              {notices.length === 0 && !loading && (
                <p style={{ fontSize: 13, color: "#9CA3AF" }}>Ogeysiisyo lama helin.</p>
              )}
              {notices.map((n) => (
                <div key={n.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      background: "#FEE2E2",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      fontSize: 15,
                    }}
                  >
                    📢
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>
                      {n.subject || "Notice"}
                    </div>
                    <div style={{ fontSize: 11.5, color: "#9CA3AF" }}>
                      {n.createdAt?.seconds
                        ? new Date(n.createdAt.seconds * 1000).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Calendar — current month, today highlighted */}
            <div style={cardStyle}>
              <h3 style={cardTitleStyle}>Calendar</h3>
              <MiniCalendar />
            </div>
          </div>

          {/* Teacher Shifts (today) + Students by Class */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 20,
              marginBottom: 24,
            }}
            className="dash-row"
          >
            {/* Teacher Shifts — today's clock-in/clock-out activity,
                pulled live from the "shifts" collection */}
            <div style={cardStyle}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 14,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      background: "rgba(139,92,246,0.12)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Clock size={17} color="#8B5CF6" />
                  </div>
                  <h3 style={{ margin: 0, fontSize: 15, color: "#111827", fontWeight: 700 }}>
                    Teacher Shifts (Today)
                  </h3>
                </div>
                <span
                  style={{ fontSize: 12, color: "#16a34a", fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
                  onClick={() => navigate("/admin/shifts")}
                >
                  View All
                </span>
              </div>

              {!loading && activeShiftsCount > 0 && (
                <div
                  style={{
                    display: "inline-block",
                    background: "rgba(34,197,94,0.12)",
                    color: "#16a34a",
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "4px 12px",
                    borderRadius: 20,
                    marginBottom: 12,
                  }}
                >
                  ● {activeShiftsCount} macalin oo hadda shift furan
                </div>
              )}

              {todaysShifts.length === 0 && !loading && (
                <p style={{ fontSize: 13, color: "#9CA3AF" }}>
                  Maanta wali cid shift furan ama xiray lama helin.
                </p>
              )}

              {todaysShifts.slice(0, 5).map((s) => {
                const isOpen = s.status === "open";
                return (
                  <div
                    key={s.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: 12,
                    }}
                  >
                    {s.resolvedPhoto ? (
                      <img
                        src={s.resolvedPhoto}
                        alt=""
                        style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          background: "#E6F5EC",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          fontSize: 12.5,
                          fontWeight: 800,
                          color: "#16a34a",
                        }}
                      >
                        {(s.resolvedName || "?").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>
                        {s.resolvedName}
                      </div>
                      <div style={{ fontSize: 11.5, color: "#9CA3AF" }}>
                        {formatTimeOnly(s.clockInAt)}
                        {" → "}
                        {isOpen ? "Weli furan" : formatTimeOnly(s.clockOutAt)}
                        {!isOpen && s.durationMs ? ` · ${formatShiftDuration(s.durationMs)}` : ""}
                      </div>
                    </div>
                    <span
                      style={{
                        background: isOpen ? "rgba(34,197,94,0.15)" : "rgba(109,93,240,0.15)",
                        color: isOpen ? "#22C55E" : "#8B5CF6",
                        padding: "3px 10px",
                        borderRadius: 20,
                        fontWeight: 700,
                        fontSize: 11,
                        flexShrink: 0,
                      }}
                    >
                      {isOpen ? "Furan" : "Xiran"}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Students by Class */}
            <div
              style={{
                background: "#fff",
                borderRadius: 18,
                padding: "22px 24px",
                boxShadow: "0 4px 18px rgba(17,24,39,0.06)",
                border: "1px solid rgba(17,24,39,0.05)",
                minWidth: 0,
              }}
            >
              <h3 style={{ margin: "0 0 14px", fontSize: 16, color: "#111827", fontWeight: 700 }}>
                Students by Class
              </h3>

              {classBreakdown.length === 0 && !loading && (
                <p style={{ fontSize: 13, color: "#9CA3AF" }}>Fasallo lama helin.</p>
              )}

              {classBreakdown.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                  <div style={{ width: 140, height: 140, position: "relative", flexShrink: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={classBreakdown}
                          innerRadius={42}
                          outerRadius={68}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {classBreakdown.map((entry, idx) => (
                            <Cell key={idx} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%,-50%)",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: 20, fontWeight: 800, color: "#111827" }}>
                        {students.length}
                      </div>
                      <div style={{ fontSize: 10.5, color: "#9CA3AF" }}>Total</div>
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {classBreakdown.map((entry) => (
                      <div
                        key={entry.name}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          fontSize: 13,
                          marginBottom: 8,
                        }}
                      >
                        <span style={{ display: "flex", alignItems: "center", gap: 8, color: "#6B7280" }}>
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: entry.color,
                              display: "inline-block",
                            }}
                          />
                          {entry.name}
                        </span>
                        <span style={{ fontWeight: 700, color: "#111827" }}>{entry.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Banner */}
          <div
            style={{
              background: "linear-gradient(160deg,#16a34a,#15803d)",
              borderRadius: 18,
              padding: "26px 24px",
              color: "#fff",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              minWidth: 0,
              marginBottom: 20,
            }}
          >
            <div>
              <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800 }}>
                Let's make this year amazing! 🚀
              </h3>
              <p style={{ margin: 0, fontSize: 13.5, opacity: 0.9, lineHeight: 1.5 }}>
                Stay organized and keep your school running smoothly.
              </p>
            </div>
            <div style={{ fontSize: 48, textAlign: "center", marginTop: 20 }}>🏫</div>
          </div>

          {/* Teachers list */}
          <div
            style={{
              background: "#fff",
              borderRadius: 18,
              padding: "22px 24px",
              boxShadow: "0 4px 18px rgba(17,24,39,0.06)",
              border: "1px solid rgba(17,24,39,0.05)",
              marginTop: 20,
              overflowX: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: "#111827", fontWeight: 700 }}>
                Teachers ({teachersList.length})
              </h3>
            </div>

            {teachersList.length === 0 && !loading && (
              <p style={{ fontSize: 13, color: "#9CA3AF" }}>Macalimiin lama helin.</p>
            )}

            {teachersList.length > 0 && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 480 }}>
                <thead>
                  <tr style={{ color: "#9da6b4", textAlign: "left" }}>
                    <th style={{ fontWeight: 600, paddingBottom: 8 }}>Full Name</th>
                    <th style={{ fontWeight: 600, paddingBottom: 8 }}>Subject</th>
                    <th style={{ fontWeight: 600, paddingBottom: 8 }}>Username</th>
                  </tr>
                </thead>
                <tbody>
                  {teachersList.map((t) => (
                    <tr key={t.id} style={{ borderTop: "1px solid #F3F4F6" }}>
                      <td style={{ padding: "10px 0", color: "#111827", fontWeight: 600 }}>{t.fullName}</td>
                      <td style={{ color: "#6B7280" }}>{t.subject}</td>
                      <td style={{ color: "#6B7280" }}>{t.username}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Exams grouped by class */}
          <div
            style={{
              background: "#fff",
              borderRadius: 18,
              padding: "22px 24px",
              boxShadow: "0 4px 18px rgba(17,24,39,0.06)",
              border: "1px solid rgba(17,24,39,0.05)",
              marginTop: 20,
            }}
          >
            <h3 style={{ margin: "0 0 14px", fontSize: 16, color: "#111827", fontWeight: 700 }}>
              Exams by Class
            </h3>

            {examsByClass.length === 0 && !loading && (
              <p style={{ fontSize: 13, color: "#9CA3AF" }}>Imtixaano lama helin.</p>
            )}

            {examsByClass.map((group) => (
              <div key={group.className} style={{ marginBottom: 18 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 13.5,
                    color: "#16a34a",
                    marginBottom: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      background: "#E6F5EC",
                      padding: "3px 10px",
                      borderRadius: 20,
                      fontSize: 12,
                    }}
                  >
                    Class {group.className}
                  </span>
                  <span style={{ color: "#9CA3AF", fontWeight: 500 }}>
                    {group.exams.length} exam{group.exams.length !== 1 ? "s" : ""}
                  </span>
                </div>

                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ color: "#9CA3AF", textAlign: "left" }}>
                      <th style={{ fontWeight: 600, paddingBottom: 6 }}>Exam Name</th>
                      <th style={{ fontWeight: 600, paddingBottom: 6 }}>Subject</th>
                      <th style={{ fontWeight: 600, paddingBottom: 6 }}>Max Marks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.exams.map((e) => (
                      <tr key={e.id} style={{ borderTop: "1px solid #F3F4F6" }}>
                        <td style={{ padding: "8px 0", color: "#111827", fontWeight: 600 }}>
                          {e.examName || "—"}
                        </td>
                        <td style={{ color: "#6B7280" }}>{e.subject || "—"}</td>
                        <td style={{ color: "#6B7280" }}>{e.maxMarks || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          {/* Results summary — every subject's marks combined per student,
              like a spreadsheet total/average column */}
          <div
            style={{
              background: "#fff",
              borderRadius: 18,
              padding: "22px 24px",
              boxShadow: "0 4px 18px rgba(17,24,39,0.06)",
              border: "1px solid rgba(17,24,39,0.05)",
              marginTop: 20,
              overflowX: "auto",
            }}
          >
            <h3 style={{ margin: "0 0 14px", fontSize: 16, color: "#111827", fontWeight: 700 }}>
              Results Summary
            </h3>

            {resultsSummary.length === 0 && !loading && (
              <p style={{ fontSize: 13, color: "#9CA3AF" }}>Natiijooyin lama helin.</p>
            )}

            {resultsSummary.length > 0 && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 560 }}>
                <thead>
                  <tr style={{ color: "#9CA3AF", textAlign: "left" }}>
                    <th style={{ fontWeight: 600, paddingBottom: 8 }}>Student</th>
                    <th style={{ fontWeight: 600, paddingBottom: 8 }}>Class</th>
                    <th style={{ fontWeight: 600, paddingBottom: 8 }}>Subjects Taken</th>
                    <th style={{ fontWeight: 600, paddingBottom: 8 }}>Total Marks</th>
                    <th style={{ fontWeight: 600, paddingBottom: 8 }}>Average</th>
                  </tr>
                </thead>
                <tbody>
                  {resultsSummary.map((s) => (
                    <tr key={s.studentId || s.studentName} style={{ borderTop: "1px solid #F3F4F6" }}>
                      <td style={{ padding: "10px 0", color: "#111827", fontWeight: 600 }}>
                        {s.studentName}
                      </td>
                      <td style={{ color: "#6B7280" }}>{s.className || "—"}</td>
                      <td style={{ color: "#6B7280" }}>{s.subjects.length}</td>
                      <td style={{ color: "#6B7280" }}>
                        {s.totalMarks} / {s.totalMax}
                      </td>
                      <td>
                        <span
                          style={{
                            background: s.average >= 50 ? "#DCFCE7" : "#FEE2E2",
                            color: s.average >= 50 ? "#16A34A" : "#DC2626",
                            fontSize: 12,
                            fontWeight: 700,
                            padding: "3px 10px",
                            borderRadius: 20,
                          }}
                        >
                          {s.average}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 1100px) {
          .dash-row {
            grid-template-columns: 1fr !important;
          }
          .dash-row-4 {
            grid-template-columns: 1fr 1fr !important;
          }
        }
        @media (max-width: 640px) {
          .dash-row-4 {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}