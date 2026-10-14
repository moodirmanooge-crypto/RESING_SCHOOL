// src/admin/pages/Dashboard.jsx
// Dashboard-ka Admin-ka — naqshad cusub (dark green hero, stat cards leh
// sparkline dhab ah, Attendance Overview, Recent Activity, iwm).
// XOGTA OO DHAN waa mid dhab ah oo Firestore laga keenay — wax been ah ma jiraan.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../../firebase/firebase";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { loadFeeLedger, localMonthKey } from "../../utils/feeLedger.js";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import DashboardCard from "../components/DashboardCard";
import SendSmsModal from "../components/SendSmsModal";
import logo from "../assets/logo.png";
import { SCHOOL_NAME, SCHOOL_TAGLINE, SCHOOL_QUOTE } from "../schoolInfo";
import {
  Users,
  UserRound,
  School,
  UsersRound,
  CalendarCheck,
  Play,
  ArrowRight,
  Send,
  FileText,
  UserPlus,
  ClipboardList,
  Wallet,
  Megaphone,
  Clock,
  Trophy,
  GraduationCap,
  BookOpen,
  Globe,
  CalendarDays,
  ChevronDown,
  Activity,
} from "lucide-react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
} from "recharts";

const CLASS_ORDER = ["1", "2", "3", "4", "5", "6", "7", "8", "F1", "F2", "F3", "F4"];
const GREEN = "#15803d";

// =====================================================================
// HELPERS
// =====================================================================
function toDate(v) {
  if (!v) return null;
  if (typeof v.toDate === "function") return v.toDate();
  if (typeof v === "object" && typeof v.seconds === "number") return new Date(v.seconds * 1000);
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function localDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function safeGet(name) {
  try {
    const snap = await getDocs(collection(db, name));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn(`Dashboard: "${name}" lama akhrin karo`, err);
    return [];
  }
}

// Kororka bishan: inta cusub ee bishan / inta jirtay ka hor bishan
function monthGrowth(list) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const dated = list.filter((x) => toDate(x.createdAt));
  if (!dated.length) return null;
  const fresh = dated.filter((x) => toDate(x.createdAt) >= start).length;
  const before = list.length - fresh;
  if (before <= 0) return fresh > 0 ? 100 : 0;
  return Math.round((fresh / before) * 100);
}

// Sparkline: tirada guud dhammaadka bil kasta (8-dii bilood ee u dambeeyay)
function monthlyCumulative(list, months = 8) {
  const now = new Date();
  const out = [];
  for (let i = months - 1; i >= 0; i--) {
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    out.push(
      list.filter((x) => {
        const d = toDate(x.createdAt);
        return !d || d < end;
      }).length
    );
  }
  return out;
}

function normStatus(s) {
  const v = String(s || "").trim().toLowerCase();
  if (["present", "p", "yes", "jooga", "true"].includes(v)) return "present";
  if (["absent", "a", "no", "maqan", "false"].includes(v)) return "absent";
  if (["late", "l", "daahay"].includes(v)) return "late";
  if (["excused", "e", "fasax"].includes(v)) return "excused";
  return null;
}

// Attendance-ka qaabab kala duwan ayuu ku kaydsan karaa — dhammaan waa la akhriyaa:
//   { date, status }                         (hal record = hal doc)
//   { "2026-10-11": "Present", ... }         (taariikh = key)
//   { records: [{date,status}] } / { records: { "2026-10-11": {status} } }
function extractAttendance(docs) {
  const out = [];
  const isDateKey = (k) => /^\d{4}-\d{2}-\d{2}$/.test(k);
  const push = (date, status) => {
    const st = normStatus(typeof status === "object" && status ? status.status : status);
    const d = toDate(date);
    if (st && d) out.push({ date: localDateKey(d), status: st });
  };
  docs.forEach((a) => {
    if (a.status && (a.date || a.createdAt)) push(a.date || a.createdAt, a.status);
    Object.entries(a).forEach(([k, v]) => {
      if (isDateKey(k)) push(k + "T12:00:00", v);
    });
    ["records", "history", "days", "attendance"].forEach((field) => {
      const r = a[field];
      if (Array.isArray(r)) r.forEach((x) => x && push(x.date || x.day || x.createdAt, x.status));
      else if (r && typeof r === "object")
        Object.entries(r).forEach(([k, v]) => isDateKey(k) && push(k + "T12:00:00", v));
    });
  });
  return out;
}

function activityTime(d) {
  const now = new Date();
  const today = localDateKey(now);
  const yest = localDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const k = localDateKey(d);
  if (k === today) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (k === yest) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatTimeOnly(v) {
  const d = toDate(v);
  return d ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
}

function formatShiftDuration(ms) {
  if (!ms || ms <= 0) return "—";
  const total = Math.round(ms / 60000);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

// =====================================================================
export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [range, setRange] = useState(14);
  const [adminFirstName, setAdminFirstName] = useState("");

  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [exams, setExams] = useState([]);
  const [results, setResults] = useState([]);
  const [messages, setMessages] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [feeStats, setFeeStats] = useState({ total: 0, collected: 0, pending: 0 });

  useEffect(() => {
    loadAll();
    loadAdminName();
  }, []);

  async function loadAdminName() {
    const adminId = localStorage.getItem("adminId");
    if (!adminId) return;
    try {
      const snap = await getDoc(doc(db, "admin", adminId));
      if (snap.exists()) {
        const n = snap.data().fullName || snap.data().username || "";
        setAdminFirstName(n.split(" ")[0] || "");
      }
    } catch (e) {
      console.log(e);
    }
  }

  async function loadAll() {
    setLoading(true);
    const [ft, pt, tch, att, exm, res, msg, sh, pay] = await Promise.all([
      safeGet("students"),
      safeGet("partTimeStudents"),
      safeGet("teachers"),
      safeGet("attendance"),
      safeGet("exams"),
      safeGet("results"),
      safeGet("messages"),
      safeGet("shifts"),
      safeGet("payments"),
    ]);

    setStudents(
      [
        ...ft.map((s) => ({ ...s, studentType: s.studentType || "Full Time" })),
        ...pt.map((s) => ({ ...s, studentType: s.studentType || "Part Time" })),
      ].filter((s) => !s.pendingDeletion && s.className !== "Qalin Jabis")
    );
    setTeachers(tch);
    setAttendance(extractAttendance(att));
    setExams(exm);
    setResults(res);
    setMessages(msg);
    setShifts(sh);
    setPayments(pay);

    // Lacagta — isla xisaabinta Cashier-ka (utils/feeLedger.js)
    try {
      const ledger = await loadFeeLedger();
      const monthKey = localMonthKey();
      let total = 0;
      let collected = 0;
      let pending = 0;
      ledger.payableStudents.forEach((s) => {
        const fee = Number(s.monthlyFee) || 0;
        const paid = Number(ledger.monthPaid[s.studentId]?.[monthKey]?.paidAmount) || 0;
        total += fee;
        collected += paid;
        pending += Math.max(fee - paid, 0);
      });
      setFeeStats({ total, collected, pending });
    } catch (err) {
      console.warn("Fee ledger:", err);
    }

    setLoading(false);
  }

  // ---------------- Derived ----------------
  // Waalid kasta hal mar (ardaygii ugu horreeyay ee lambarkaas leh)
  const uniqueParents = useMemo(() => {
    const seen = new Set();
    return [...students]
      .sort((a, b) => (toDate(a.createdAt) || 0) - (toDate(b.createdAt) || 0))
      .filter((s) => {
        const p = (s.parentPhone || "").trim();
        if (!p || seen.has(p)) return false;
        seen.add(p);
        return true;
      });
  }, [students]);

  const classBreakdown = useMemo(() => {
    const counts = {};
    students.forEach((s) => {
      const c = (s.className || "").trim();
      if (c) counts[c] = (counts[c] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, label: /^\d+$/.test(name) ? `Class ${name}` : name, value }))
      .sort((a, b) => {
        const ia = CLASS_ORDER.indexOf(a.name);
        const ib = CLASS_ORDER.indexOf(b.name);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });
  }, [students]);

  const gender = useMemo(() => {
    const male = students.filter((s) => s.gender === "Male").length;
    const female = students.filter((s) => s.gender === "Female").length;
    return { male, female, unknown: students.length - male - female };
  }, [students]);

  // Attendance: maalin kasta -> present / absent / rate
  const attendanceDays = useMemo(() => {
    const map = {};
    attendance.forEach((r) => {
      if (!map[r.date]) map[r.date] = { present: 0, absent: 0 };
      if (r.status === "absent") map[r.date].absent += 1;
      else if (r.status !== "excused") map[r.date].present += 1;
    });
    return Object.entries(map)
      .map(([date, v]) => ({
        date,
        ...v,
        rate: v.present + v.absent ? Math.round((v.present / (v.present + v.absent)) * 100) : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [attendance]);

  const chartDays = useMemo(() => {
    const now = new Date();
    const from = localDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - range + 1));
    return attendanceDays
      .filter((d) => d.date >= from)
      .map((d) => {
        const [y, m, day] = d.date.split("-").map(Number);
        return {
          ...d,
          label: new Date(y, m - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        };
      });
  }, [attendanceDays, range]);

  const avgAttendance = useMemo(() => {
    const p = chartDays.reduce((s, d) => s + d.present, 0);
    const t = chartDays.reduce((s, d) => s + d.present + d.absent, 0);
    return t ? Math.round((p / t) * 100) : null;
  }, [chartDays]);

  const todayKey = localDateKey(new Date());
  const latestDay = attendanceDays[attendanceDays.length - 1];
  const attendanceCard = useMemo(() => {
    const last14 = attendanceDays.slice(-14);
    const lastWeek = attendanceDays.slice(-7);
    const prevWeek = attendanceDays.slice(-14, -7);
    const avg = (arr) => {
      const p = arr.reduce((s, d) => s + d.present, 0);
      const t = arr.reduce((s, d) => s + d.present + d.absent, 0);
      return t ? (p / t) * 100 : null;
    };
    const a = avg(lastWeek);
    const b = avg(prevWeek);
    return {
      value: latestDay ? `${latestDay.rate}%` : "—",
      spark: last14.map((d) => d.rate),
      growth: a !== null && b !== null ? Math.round(a - b) : null,
    };
  }, [attendanceDays, latestDay]);

  // Recent activity — dhacdooyin dhab ah oo la isku daray
  const activities = useMemo(() => {
    const list = [];
    students.forEach((s) => {
      const d = toDate(s.createdAt);
      if (d)
        list.push({
          d,
          type: "student",
          title: "New student registered",
          sub: `${s.fullName || "Arday"} joined ${s.className ? (/^\d+$/.test(s.className) ? "Class " + s.className : s.className) : ""}`,
        });
    });
    teachers.forEach((t) => {
      const d = toDate(t.createdAt);
      if (d)
        list.push({
          d,
          type: "teacher",
          title: "New teacher added",
          sub: `${t.fullName || t.name || t.id}${t.subject ? " joined as " + t.subject + " Teacher" : ""}`,
        });
    });
    exams.forEach((e) => {
      const d = toDate(e.createdAt);
      if (d)
        list.push({
          d,
          type: "exam",
          title: "Exam published",
          sub: `${e.examName || "Exam"}${e.subject ? " - " + e.subject : ""}${e.className ? " · Class " + e.className : ""}`,
        });
    });
    payments.forEach((p) => {
      const d = toDate(p.createdAt || p.paidAt || p.date);
      const amt = Number(p.amount ?? p.paidAmount ?? p.total);
      if (d && Number.isFinite(amt) && amt > 0)
        list.push({
          d,
          type: "payment",
          title: "Fee payment received",
          sub: `$${amt} payment from ${p.studentName || p.studentId || "arday"}`,
        });
    });
    messages
      .filter((m) => m.scope === "broadcast" || m.audienceGroup === "broadcast")
      .forEach((m) => {
        const d = toDate(m.createdAt);
        if (d) list.push({ d, type: "notice", title: "Notice sent", sub: m.subject || "Ogeysiis" });
      });
    // Maalmaha attendance la qaaday
    attendanceDays.slice(-3).forEach((day) => {
      const [y, mo, dd] = day.date.split("-").map(Number);
      list.push({
        d: new Date(y, mo - 1, dd, 8, 0),
        type: "attendance",
        title: "Attendance marked",
        sub: `${day.present + day.absent} arday · ${day.rate}% present`,
      });
    });
    return list.sort((a, b) => b.d - a.d).slice(0, 6);
  }, [students, teachers, exams, payments, messages, attendanceDays]);

  const upcomingExams = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return exams
      .map((e) => ({ ...e, dateObj: toDate(e.date) }))
      .filter((e) => e.dateObj && e.dateObj >= now)
      .sort((a, b) => a.dateObj - b.dateObj)
      .slice(0, 4);
  }, [exams]);

  const notices = useMemo(
    () =>
      messages
        .filter((m) => m.scope === "broadcast" || m.audienceGroup === "broadcast")
        .sort((a, b) => (toDate(b.createdAt) || 0) - (toDate(a.createdAt) || 0))
        .slice(0, 4),
    [messages]
  );

  const todaysShifts = useMemo(() => {
    const byId = {};
    teachers.forEach((t) => (byId[t.id] = t));
    return shifts
      .filter((s) => {
        const d = toDate(s.clockInAt);
        return d && localDateKey(d) === todayKey;
      })
      .map((s) => {
        const t = byId[s.teacherId];
        return {
          ...s,
          resolvedName: t?.fullName || s.teacherName || "Macalin",
          resolvedPhoto: t?.photoUrl || t?.teacherPhoto || "",
        };
      })
      .sort((a, b) => (toDate(b.clockInAt) || 0) - (toDate(a.clockInAt) || 0));
  }, [shifts, teachers, todayKey]);

  const topPerformers = useMemo(() => {
    const by = {};
    results.forEach((r) => {
      const k = r.studentId || r.studentName || r.id;
      if (!by[k]) by[k] = { name: r.studentName || "—", className: r.className || "", marks: 0, max: 0, n: 0 };
      by[k].marks += Number(r.marks) || 0;
      by[k].max += Number(r.maxMarks) || 0;
      by[k].n += 1;
    });
    return Object.values(by)
      .filter((s) => s.max > 0)
      .map((s) => ({ ...s, avg: Math.round((s.marks / s.max) * 100) }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 5);
  }, [results]);

  const feePercent = feeStats.total > 0 ? Math.round((feeStats.collected / feeStats.total) * 100) : 0;
  const L = (v) => (loading ? "…" : v);

  // =====================================================================
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f4f7f5", fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      <Sidebar />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: "20px 28px 0" }}>
          <Topbar />
        </div>

        <div style={{ padding: "20px 28px 36px" }}>
          {/* ======================= HERO ======================= */}
          <div style={hero}>
            {/* Qurxin: xariiqyo diagonal ah + icons fudud */}
            <div style={stripeBlue} className="rs-hide-sm" />
            <div style={stripeGreen} className="rs-hide-sm" />
            <GraduationCap size={90} style={{ ...ghostIcon, top: 18, left: "52%" }} />
            <BookOpen size={110} style={{ ...ghostIcon, top: 26, right: "30%" }} className="rs-hide-sm" />
            <Globe size={120} style={{ ...ghostIcon, bottom: -20, left: "56%" }} />

            <div style={{ display: "flex", alignItems: "center", gap: 30, position: "relative", zIndex: 1, flex: 1, minWidth: 0 }}>
              <div style={heroLogo} className="rs-hide-sm">
                <img src={logo} alt="" style={{ width: "88%", height: "88%", objectFit: "contain" }} />
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={welcome}>
                  Welcome back{adminFirstName ? "," : "!"}{" "}
                  {adminFirstName && <b style={{ color: "#fff", fontWeight: 700 }}>{adminFirstName}!</b>}
                </div>
                <h1 style={heroTitle}>
                  {(() => {
                    const words = SCHOOL_NAME.split(" ");
                    const last = words.pop();
                    return (
                      <>
                        {words.join(" ")} <span style={{ color: "#bef264" }}>{last}</span>
                      </>
                    );
                  })()}
                </h1>
                <div style={tagline}>{SCHOOL_TAGLINE}</div>

                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 22 }}>
                  <button onClick={() => navigate("/admin/reports")} style={heroBtnPrimary}>
                    <Play size={17} fill="#fff" /> Explore Dashboard <ArrowRight size={17} />
                  </button>
                  <button onClick={() => setSmsModalOpen(true)} style={heroBtnOutline}>
                    <Send size={17} /> Send SMS
                  </button>
                  <button onClick={() => navigate("/admin/results-by-class")} style={heroBtnOutline}>
                    <FileText size={17} /> Exam Results
                  </button>
                </div>
              </div>
            </div>

            <div style={heroRight} className="rs-hide-md">
              <div style={quote}>“{SCHOOL_QUOTE}”</div>
              <div style={{ width: 54, height: 3, background: "#86efac", borderRadius: 4, marginTop: 10 }} />
              <BooksIllustration />
            </div>
          </div>

          {smsModalOpen && <SendSmsModal onClose={() => setSmsModalOpen(false)} />}

          {/* ======================= STAT CARDS ======================= */}
          <div style={statGrid}>
            <DashboardCard
              title="Students"
              value={L(students.length.toLocaleString())}
              icon={Users}
              color="#16a34a"
              growth={monthGrowth(students)}
              spark={monthlyCumulative(students)}
              onClick={() => navigate("/admin/students")}
            />
            <DashboardCard
              title="Teachers"
              value={L(teachers.length)}
              icon={UserRound}
              color="#f59e0b"
              growth={monthGrowth(teachers)}
              spark={monthlyCumulative(teachers)}
              onClick={() => navigate("/admin/teachers")}
            />
            <DashboardCard
              title="Parents"
              value={L(uniqueParents.length)}
              icon={UsersRound}
              color="#3b82f6"
              growth={monthGrowth(uniqueParents)}
              spark={monthlyCumulative(uniqueParents)}
              onClick={() => navigate("/admin/parents")}
            />
            <DashboardCard
              title="Classes"
              value={L(classBreakdown.length)}
              icon={School}
              color="#9333ea"
              growth={null}
              spark={classBreakdown.map((c) => c.value)}
              onClick={() => navigate("/admin/classes")}
            />
            <DashboardCard
              title="Attendance"
              value={L(attendanceCard.value)}
              icon={CalendarCheck}
              color="#e11d48"
              growth={attendanceCard.growth}
              growthLabel="vs last week"
              spark={attendanceCard.spark}
              onClick={() => navigate("/admin/attendance")}
            />
          </div>

          {/* ======================= ATTENDANCE + ACTIVITY ======================= */}
          <div style={{ ...row, gridTemplateColumns: "1.65fr 1fr" }} className="rs-row">
            <div style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                  <IconBubble icon={CalendarDays} color="#16a34a" />
                  <div>
                    <div style={cardTitle}>Attendance Overview</div>
                    <div style={cardSub}>Daily attendance rate for the last {range} days</div>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
                  <div style={selectWrap}>
                    <select value={range} onChange={(e) => setRange(Number(e.target.value))} style={selectEl}>
                      <option value={7}>Last 7 Days</option>
                      <option value={14}>Last 14 Days</option>
                      <option value={30}>Last 30 Days</option>
                    </select>
                    <ChevronDown size={15} color="#374151" style={{ pointerEvents: "none", marginLeft: -20 }} />
                  </div>
                  {avgAttendance !== null && (
                    <div style={avgBadge}>
                      <Users size={22} color={GREEN} />
                      <div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: "#111827", lineHeight: 1 }}>{avgAttendance}%</div>
                        <div style={{ fontSize: 11.5, color: "#4b5563" }}>Average Attendance</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {chartDays.length === 0 ? (
                <EmptyState icon={CalendarCheck} text={loading ? "Loading..." : `Xogta attendance-ka ${range}-kii maalmood ee u dambeeyay lama helin.`} />
              ) : (
                <>
                  <div style={{ height: 250, marginTop: 10 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartDays} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                        <CartesianGrid stroke="#eef2ef" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11.5, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="c" tick={{ fontSize: 11.5, fill: "#6b7280" }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <YAxis yAxisId="r" orientation="right" domain={[0, 100]} hide />
                        <Tooltip
                          contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12.5 }}
                          formatter={(v, n) => (n === "Attendance Rate" ? [`${v}%`, n] : [v, n])}
                        />
                        <Bar yAxisId="c" dataKey="present" name="Present" stackId="a" fill={GREEN} maxBarSize={30} />
                        <Bar yAxisId="c" dataKey="absent" name="Absent" stackId="a" fill="#dfe6ee" radius={[6, 6, 0, 0]} maxBarSize={30} />
                        <Line yAxisId="r" type="monotone" dataKey="rate" name="Attendance Rate" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 4, fill: "#fff", stroke: "#2563eb", strokeWidth: 2 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ display: "flex", justifyContent: "center", gap: 26, marginTop: 8, fontSize: 13, color: "#374151" }}>
                    <Legend color={GREEN} label="Present" />
                    <Legend color="#cbd5e1" label="Absent" />
                    <Legend color="#2563eb" label="Attendance Rate" line />
                  </div>
                </>
              )}
            </div>

            <div style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Clock size={22} color="#111827" />
                  <div style={cardTitle}>Recent Activity</div>
                </div>
                <span style={viewAll} onClick={() => navigate("/admin/reports")}>
                  View All
                </span>
              </div>
              {activities.length === 0 ? (
                <EmptyState icon={Activity} text={loading ? "Loading..." : "Weli wax dhaqdhaqaaq ah lama diiwaan gelin."} />
              ) : (
                activities.map((a, i) => <ActivityRow key={i} a={a} last={i === activities.length - 1} />)
              )}
            </div>
          </div>

          {/* ======================= FEES / CLASSES / GENDER ======================= */}
          <div style={{ ...row, gridTemplateColumns: "1fr 1.3fr 1fr" }} className="rs-row">
            {/* Fee Collection */}
            <div style={card}>
              <CardHead icon={Wallet} color="#16a34a" title="Fee Collection" sub="This month" />
              <div style={{ height: 170, position: "relative" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Collected", value: feeStats.collected },
                        { name: "Pending", value: feeStats.pending || (feeStats.collected ? 0 : 1) },
                      ]}
                      innerRadius={58}
                      outerRadius={76}
                      paddingAngle={2}
                      dataKey="value"
                      startAngle={90}
                      endAngle={-270}
                      stroke="none"
                    >
                      <Cell fill={GREEN} />
                      <Cell fill="#e5efe8" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div style={donutCenter}>
                  <div style={{ fontSize: 26, fontWeight: 800, color: "#111827" }}>{feePercent}%</div>
                  <div style={{ fontSize: 11.5, color: "#6b7280" }}>Collected</div>
                </div>
              </div>
              {[
                { label: "Total Fees", value: feeStats.total, color: "#0f4a2c" },
                { label: "Collected", value: feeStats.collected, color: "#22c55e" },
                { label: "Pending", value: feeStats.pending, color: "#ef4444" },
              ].map((r) => (
                <div key={r.label} style={kvRow}>
                  <Legend color={r.color} label={r.label} />
                  <b style={{ color: "#111827" }}>${r.value.toLocaleString()}</b>
                </div>
              ))}
            </div>

            {/* Students by Class */}
            <div style={card}>
              <CardHead icon={School} color="#9333ea" title="Students by Class" sub={`${students.length} arday · ${classBreakdown.length} fasal`} />
              {classBreakdown.length === 0 ? (
                <EmptyState icon={School} text={loading ? "Loading..." : "Fasallo lama helin."} />
              ) : (
                <div style={{ height: 250 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={classBreakdown} margin={{ top: 10, right: 6, left: -22, bottom: 0 }}>
                      <CartesianGrid stroke="#f1f5f2" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11.5, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip cursor={{ fill: "rgba(22,163,74,0.06)" }} contentStyle={{ borderRadius: 12, fontSize: 12.5 }} formatter={(v) => [v, "Arday"]} labelFormatter={(l) => (/^\d+$/.test(l) ? `Class ${l}` : l)} />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={34}>
                        {classBreakdown.map((c) => (
                          <Cell key={c.name} fill={String(c.name).startsWith("F") ? "#4f46e5" : "#16a34a"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Gender */}
            <div style={card}>
              <CardHead icon={Users} color="#0284c7" title="Wiilal & Gabdho" sub="Boys & Girls" />
              <div style={{ height: 150, position: "relative" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Male", value: gender.male },
                        { name: "Female", value: gender.female },
                        { name: "?", value: gender.unknown },
                      ]}
                      innerRadius={48}
                      outerRadius={66}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      <Cell fill="#0ea5e9" />
                      <Cell fill="#ec4899" />
                      <Cell fill="#e5e7eb" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div style={donutCenter}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#111827" }}>{students.length}</div>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>Arday</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
                <MiniStat emoji="👦" label="Wiilal" value={gender.male} color="#0369a1" bg="#e0f2fe" />
                <MiniStat emoji="👧" label="Gabdho" value={gender.female} color="#be185d" bg="#fce7f3" />
              </div>
              {gender.unknown > 0 && (
                <div style={{ fontSize: 12, color: "#b45309", marginTop: 10, fontWeight: 600 }}>
                  ⚠ {gender.unknown} arday gender lama calaamadin
                </div>
              )}
            </div>
          </div>

          {/* ======================= EXAMS / NOTICES / SHIFTS / CALENDAR ======================= */}
          <div style={{ ...row, gridTemplateColumns: "repeat(4, 1fr)" }} className="rs-row-4">
            <div style={card}>
              <CardHead icon={ClipboardList} color="#16a34a" title="Upcoming Exams" action={() => navigate("/admin/exams")} />
              {upcomingExams.length === 0 ? (
                <EmptyState icon={ClipboardList} text={loading ? "Loading..." : "Imtixaano soo socda lama helin."} small />
              ) : (
                upcomingExams.map((e) => (
                  <ListItem
                    key={e.id}
                    icon={ClipboardList}
                    color="#16a34a"
                    title={e.examName || "Exam"}
                    sub={`${e.dateObj.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}${e.className ? " · Class " + e.className : ""}`}
                  />
                ))
              )}
            </div>

            <div style={card}>
              <CardHead icon={Megaphone} color="#e11d48" title="Notice Board" action={() => navigate("/admin/messages")} />
              {notices.length === 0 ? (
                <EmptyState icon={Megaphone} text={loading ? "Loading..." : "Ogeysiisyo lama helin."} small />
              ) : (
                notices.map((n) => (
                  <ListItem
                    key={n.id}
                    icon={Megaphone}
                    color="#e11d48"
                    title={n.subject || "Notice"}
                    sub={toDate(n.createdAt) ? toDate(n.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : ""}
                  />
                ))
              )}
            </div>

            <div style={card}>
              <CardHead icon={Clock} color="#8b5cf6" title="Teacher Shifts" sub="Today" action={() => navigate("/admin/shifts")} />
              {todaysShifts.filter((s) => s.status === "open").length > 0 && (
                <div style={liveChip}>● {todaysShifts.filter((s) => s.status === "open").length} macalin shift furan</div>
              )}
              {todaysShifts.length === 0 ? (
                <EmptyState icon={Clock} text={loading ? "Loading..." : "Maanta shift lama furin."} small />
              ) : (
                todaysShifts.slice(0, 4).map((s) => {
                  const open = s.status === "open";
                  return (
                    <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                      <PersonAvatar photo={s.resolvedPhoto} name={s.resolvedName} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={itemTitle}>{s.resolvedName}</div>
                        <div style={itemSub}>
                          {formatTimeOnly(s.clockInAt)} → {open ? "Weli furan" : formatTimeOnly(s.clockOutAt)}
                          {!open && s.durationMs ? ` · ${formatShiftDuration(s.durationMs)}` : ""}
                        </div>
                      </div>
                      <span style={{ ...pill, background: open ? "#dcfce7" : "#ede9fe", color: open ? "#15803d" : "#6d28d9" }}>
                        {open ? "Furan" : "Xiran"}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            <div style={card}>
              <CardHead icon={CalendarDays} color="#0284c7" title="Calendar" />
              <MiniCalendar />
            </div>
          </div>

          {/* ======================= TOP PERFORMERS / TEACHERS ======================= */}
          <div style={{ ...row, gridTemplateColumns: "1fr 1fr" }} className="rs-row">
            <div style={card}>
              <CardHead icon={Trophy} color="#f59e0b" title="Top Performers" sub="Celceliska natiijooyinka" action={() => navigate("/admin/results-by-class")} />
              {topPerformers.length === 0 ? (
                <EmptyState icon={Trophy} text={loading ? "Loading..." : "Natiijooyin lama helin."} small />
              ) : (
                topPerformers.map((s, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: i ? "1px solid #f1f5f2" : "none" }}>
                    <div style={{ ...rankBadge, background: ["#fef3c7", "#e5e7eb", "#fed7aa"][i] || "#f3f4f6", color: ["#b45309", "#4b5563", "#c2410c"][i] || "#6b7280" }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={itemTitle}>{s.name}</div>
                      <div style={itemSub}>
                        {s.className ? `Class ${s.className} · ` : ""}
                        {s.n} maaddo
                      </div>
                    </div>
                    <div style={{ width: 110 }}>
                      <div style={{ height: 7, background: "#f1f5f2", borderRadius: 99, overflow: "hidden" }}>
                        <div style={{ width: `${s.avg}%`, height: "100%", background: s.avg >= 50 ? "#16a34a" : "#ef4444", borderRadius: 99 }} />
                      </div>
                    </div>
                    <b style={{ width: 44, textAlign: "right", color: s.avg >= 50 ? "#15803d" : "#dc2626" }}>{s.avg}%</b>
                  </div>
                ))
              )}
            </div>

            <div style={card}>
              <CardHead icon={UserRound} color="#f59e0b" title={`Teachers (${teachers.length})`} action={() => navigate("/admin/teachers")} />
              {teachers.length === 0 ? (
                <EmptyState icon={UserRound} text={loading ? "Loading..." : "Macalimiin lama helin."} small />
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                  {teachers.slice(0, 8).map((t) => (
                    <div key={t.id} style={teacherTile}>
                      <PersonAvatar photo={t.photoUrl || t.teacherPhoto} name={t.fullName || t.name || t.id} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ ...itemTitle, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.fullName || t.name || t.id}</div>
                        <div style={itemSub}>{t.subject || "—"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .rs-stat { transition: transform .18s ease, box-shadow .18s ease; }
        .rs-stat:hover { transform: translateY(-3px); box-shadow: 0 14px 30px rgba(17,24,39,0.10) !important; }
        @media (max-width: 1280px) { .rs-hide-md { display: none !important; } }
        @media (max-width: 1150px) {
          .rs-row { grid-template-columns: 1fr !important; }
          .rs-row-4 { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 760px) {
          .rs-row-4 { grid-template-columns: 1fr !important; }
          .rs-hide-sm { display: none !important; }
        }
      `}</style>
    </div>
  );
}

// =====================================================================
// SMALL COMPONENTS
// =====================================================================
function IconBubble({ icon: Icon, color, size = 50 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: `${color}1A`, color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <Icon size={size * 0.46} />
    </div>
  );
}

function CardHead({ icon, color, title, sub, action }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <IconBubble icon={icon} color={color} size={40} />
        <div style={{ minWidth: 0 }}>
          <div style={{ ...cardTitle, fontSize: 16 }}>{title}</div>
          {sub && <div style={{ ...cardSub, fontSize: 12.5 }}>{sub}</div>}
        </div>
      </div>
      {action && (
        <span style={viewAll} onClick={action}>
          View All
        </span>
      )}
    </div>
  );
}

const ACTIVITY_STYLE = {
  student: { icon: UserPlus, color: "#16a34a", bg: "#dcfce7" },
  teacher: { icon: UserRound, color: "#d97706", bg: "#fef3c7" },
  exam: { icon: FileText, color: "#9333ea", bg: "#f3e8ff" },
  payment: { icon: Wallet, color: "#e11d48", bg: "#ffe4e6" },
  notice: { icon: Megaphone, color: "#0284c7", bg: "#e0f2fe" },
  attendance: { icon: CalendarDays, color: "#2563eb", bg: "#dbeafe" },
};

function ActivityRow({ a, last }) {
  const st = ACTIVITY_STYLE[a.type] || ACTIVITY_STYLE.notice;
  const Icon = st.icon;
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "center", padding: "11px 0", borderBottom: last ? "none" : "1px solid #f1f5f2" }}>
      <div style={{ width: 44, height: 44, borderRadius: "50%", background: st.bg, color: st.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={20} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{a.title}</div>
        <div style={{ fontSize: 12.5, color: "#6b7280", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.sub}</div>
      </div>
      <div style={{ fontSize: 12, color: "#6b7280", whiteSpace: "nowrap", alignSelf: "flex-start", marginTop: 2 }}>{activityTime(a.d)}</div>
    </div>
  );
}

function ListItem({ icon: Icon, color, title, sub }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
      <div style={{ width: 38, height: 38, borderRadius: 12, background: `${color}14`, color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={17} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={itemTitle}>{title}</div>
        <div style={itemSub}>{sub}</div>
      </div>
    </div>
  );
}

function PersonAvatar({ photo, name }) {
  const [failed, setFailed] = useState(false);
  if (photo && !failed)
    return <img src={photo} alt="" onError={() => setFailed(true)} style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  return (
    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#dcfce7", color: GREEN, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
      {(name || "?").charAt(0).toUpperCase()}
    </div>
  );
}

function MiniStat({ emoji, label, value, color, bg }) {
  return (
    <div style={{ background: bg, borderRadius: 14, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 20 }}>{emoji}</span>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 12, color: "#4b5563", fontWeight: 600 }}>{label}</div>
      </div>
    </div>
  );
}

function Legend({ color, label, line }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#374151", fontSize: 13 }}>
      {line ? (
        <span style={{ position: "relative", width: 22, height: 10, display: "inline-block" }}>
          <span style={{ position: "absolute", top: 4, left: 0, right: 0, height: 2.5, background: color }} />
          <span style={{ position: "absolute", top: 0, left: 6, width: 10, height: 10, borderRadius: "50%", background: "#fff", border: `2px solid ${color}`, boxSizing: "border-box" }} />
        </span>
      ) : (
        <span style={{ width: 11, height: 11, borderRadius: "50%", background: color, display: "inline-block" }} />
      )}
      {label}
    </span>
  );
}

function EmptyState({ icon: Icon, text, small }) {
  return (
    <div style={{ textAlign: "center", padding: small ? "18px 6px" : "50px 10px", color: "#9ca3af", fontSize: 13 }}>
      <Icon size={small ? 26 : 36} color="#d1d5db" />
      <div style={{ marginTop: 8 }}>{text}</div>
    </div>
  );
}

function MiniCalendar() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  return (
    <div>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: "#111827", marginBottom: 10, textAlign: "center" }}>
        {now.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, fontSize: 11, color: "#9ca3af", textAlign: "center", marginBottom: 6, fontWeight: 600 }}>
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d} style={{ color: d === "Fr" ? "#16a34a" : undefined }}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
        {cells.map((d, i) => (
          <div
            key={i}
            style={{
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              borderRadius: 9,
              color: d === today ? "#fff" : d ? "#374151" : "transparent",
              background: d === today ? "linear-gradient(135deg,#16a34a,#0f4a2c)" : "transparent",
              fontWeight: d === today ? 800 : 500,
              boxShadow: d === today ? "0 4px 10px rgba(22,163,74,0.35)" : "none",
            }}
          >
            {d || ""}
          </div>
        ))}
      </div>
    </div>
  );
}

// Sawir yar oo buugaag + globe ah (SVG) — qurxinta hero-ga dhinaca midig
function BooksIllustration() {
  return (
    <svg width="230" height="150" viewBox="0 0 230 150" style={{ position: "absolute", right: 10, bottom: 0 }} aria-hidden="true">
      {/* globe */}
      <g transform="translate(168 52)">
        <circle r="36" fill="#1e6b8f" />
        <path d="M-20 -22c10 6 6 16 16 18s8 14 18 12M8 -32c-4 10 6 14 14 12M-34 6c10-2 14 8 22 6" stroke="#7bc47f" strokeWidth="9" fill="none" strokeLinecap="round" />
        <ellipse rx="36" ry="13" fill="none" stroke="rgba(255,255,255,0.25)" />
        <path d="M0 -36V36" stroke="rgba(255,255,255,0.25)" />
        <path d="M-44 -6a44 44 0 0 0 76 34" stroke="#c8a24a" strokeWidth="4" fill="none" />
        <rect x="-6" y="40" width="12" height="18" fill="#8b6b2e" />
        <rect x="-22" y="56" width="44" height="6" rx="3" fill="#6b5222" />
      </g>
      {/* books */}
      <rect x="6" y="122" width="150" height="20" rx="4" fill="#7c2d12" />
      <rect x="6" y="122" width="150" height="5" rx="2" fill="#f5e6c8" />
      <rect x="16" y="102" width="132" height="20" rx="4" fill="#14532d" />
      <rect x="16" y="102" width="132" height="5" rx="2" fill="#f5e6c8" />
      <rect x="10" y="82" width="140" height="20" rx="4" fill="#1e3a8a" />
      <rect x="10" y="82" width="140" height="5" rx="2" fill="#f5e6c8" />
      <rect x="24" y="64" width="112" height="18" rx="4" fill="#92400e" />
      <rect x="24" y="64" width="112" height="4" rx="2" fill="#f5e6c8" />
      <path d="M40 88h40M44 108h60M30 128h70" stroke="#d4af37" strokeWidth="2" />
    </svg>
  );
}

// =====================================================================
// STYLES
// =====================================================================
const hero = {
  position: "relative",
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  gap: 20,
  background: "radial-gradient(circle at 75% 30%, #1f7a43 0%, transparent 45%), linear-gradient(120deg,#0a3a22 0%,#0f5130 50%,#14653a 100%)",
  borderRadius: 24,
  padding: "30px 34px",
  minHeight: 250,
  color: "#fff",
  boxShadow: "0 18px 40px rgba(10,58,34,0.28)",
};
const stripeBlue = {
  position: "absolute",
  top: -50,
  right: 26,
  width: 26,
  height: 260,
  background: "#2563eb",
  transform: "rotate(35deg)",
  opacity: 0.9,
};
const stripeGreen = { ...stripeBlue, right: 62, width: 10, background: "#86efac", opacity: 0.8 };
const ghostIcon = { position: "absolute", color: "#fff", opacity: 0.06, pointerEvents: "none" };
const heroLogo = {
  width: 170,
  height: 170,
  minWidth: 170,
  borderRadius: "50%",
  background: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 0 0 6px rgba(255,255,255,0.15), 0 14px 30px rgba(0,0,0,0.35)",
  overflow: "hidden",
};
const welcome = { fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic", fontSize: 22, color: "#bbf7d0" };
const heroTitle = {
  margin: "8px 0 6px",
  fontSize: "clamp(26px, 3.1vw, 46px)",
  fontWeight: 900,
  lineHeight: 1.08,
  letterSpacing: "0.005em",
  textShadow: "0 2px 10px rgba(0,0,0,0.25)",
  maxWidth: 720,
};
const tagline = { fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic", fontSize: 19, color: "rgba(255,255,255,0.92)" };
const heroBtnPrimary = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  padding: "13px 22px",
  borderRadius: 12,
  border: "1.5px solid #4ade80",
  background: "linear-gradient(180deg,#22c55e,#15803d)",
  color: "#fff",
  fontWeight: 700,
  fontSize: 15,
  cursor: "pointer",
  boxShadow: "0 8px 18px rgba(34,197,94,0.35)",
};
const heroBtnOutline = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  padding: "13px 24px",
  borderRadius: 12,
  border: "1.5px solid rgba(255,255,255,0.85)",
  background: "rgba(0,0,0,0.12)",
  color: "#fff",
  fontWeight: 700,
  fontSize: 15,
  cursor: "pointer",
};
const heroRight = { position: "relative", width: 250, minWidth: 250, alignSelf: "stretch", zIndex: 1, paddingTop: 20 };
const quote = { fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic", fontSize: 19, lineHeight: 1.45, color: "#f0fdf4", maxWidth: 200 };

const statGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 18, margin: "22px 0" };
const row = { display: "grid", gap: 20, marginBottom: 20 };
const card = {
  background: "#fff",
  borderRadius: 20,
  padding: "20px 22px",
  boxShadow: "0 6px 20px rgba(17,24,39,0.05)",
  border: "1px solid rgba(17,24,39,0.05)",
  minWidth: 0,
};
const cardTitle = { fontSize: 19, fontWeight: 800, color: "#111827" };
const cardSub = { fontSize: 14, color: "#6b7280", marginTop: 2 };
const viewAll = { fontSize: 13, color: "#15803d", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" };
const selectWrap = { display: "flex", alignItems: "center", border: "1px solid #e5e7eb", borderRadius: 12, paddingRight: 12, background: "#fff" };
const selectEl = {
  appearance: "none",
  WebkitAppearance: "none",
  border: "none",
  outline: "none",
  background: "transparent",
  padding: "10px 30px 10px 16px",
  fontSize: 13.5,
  fontWeight: 600,
  color: "#111827",
  cursor: "pointer",
};
const avgBadge = { display: "flex", alignItems: "center", gap: 12, background: "#effaf2", borderRadius: 14, padding: "10px 18px" };
const donutCenter = { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center" };
const kvRow = { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13.5, padding: "6px 0" };
const itemTitle = { fontSize: 13.5, fontWeight: 700, color: "#111827" };
const itemSub = { fontSize: 12, color: "#6b7280", marginTop: 1 };
const pill = { padding: "3px 10px", borderRadius: 99, fontWeight: 700, fontSize: 11, flexShrink: 0 };
const liveChip = { display: "inline-block", background: "#dcfce7", color: "#15803d", fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 99, marginBottom: 12 };
const rankBadge = { width: 30, height: 30, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, flexShrink: 0 };
const teacherTile = { display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 14, background: "#f9fbfa", border: "1px solid #eef2ef" };