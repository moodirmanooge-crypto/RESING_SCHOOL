// src/admin/pages/ExamRooms.jsx
// EXAM ROOMS — the admin creates exam rooms (e.g. "Class 5", "Room A"),
// adds the students they want from any class (A → Z, by class, first N, or
// one by one), then prints an A4 portrait sheet listing each student's ID,
// name, class, and the room they are going to.
//
// Firestore: examRooms/{autoId} = {
//   name, examTitle, examDate,
//   students: [{ docId, studentId, fullName, className }],
//   createdAt, updatedAt
// }
// The "Exam:" name and the date on the Seating List are read from the Exam
// Timetable page (examWeek/{class}.examType / startDate) — the same way the
// Attendance Sheet reads them — unless the admin typed their own below.
import { useEffect, useMemo, useState } from "react";
import { db } from "../../firebase/firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import {
  DoorOpen,
  Plus,
  Trash2,
  Printer,
  Search,
  Users,
  X,
  Save,
  Loader2,
  ArrowDownAZ,
  UserPlus,
  Layers,
  CheckSquare,
  Eraser,
  ClipboardCheck,
  CalendarDays,
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import logo from "../assets/logo.png";
import { SCHOOL_NAME, SCHOOL_CITY } from "../schoolInfo";

const CLASS_ORDER = ["1", "2", "3", "4", "5", "6", "7", "8", "F1", "F2", "F3", "F4"];
const GREEN = "#15803d";

// ---------------- helpers ----------------
function classRank(c) {
  const i = CLASS_ORDER.indexOf(String(c || "").toUpperCase());
  return i < 0 ? 999 : i;
}
function classLabel(c) {
  const v = String(c || "").trim();
  if (!v) return "—";
  return /^\d+$/.test(v) ? `Class ${v}` : v;
}
function byName(a, b) {
  return (a.fullName || "").localeCompare(b.fullName || "", undefined, { sensitivity: "base" });
}
function byClassThenName(a, b) {
  return (
    classRank(a.className) - classRank(b.className) ||
    String(a.className).localeCompare(String(b.className)) ||
    byName(a, b)
  );
}
function byRoomName(a, b) {
  return (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: "base" });
}
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}
function slim(s) {
  return { docId: s.docId, studentId: s.studentId, fullName: s.fullName, className: s.className };
}

// ---------------- PRINT (A4 portrait) ----------------
function roomSectionHtml(room, sortMode, logoUrl, examWeeks) {
  const list = [...(room.students || [])].sort(sortMode === "class" ? byClassThenName : byName);
  const rows = list
    .map(
      (s, i) => `<tr>
        <td class="c">${i + 1}</td>
        <td class="mono">${esc(s.studentId)}</td>
        <td class="name">${esc(s.fullName)}</td>
        <td class="c">${esc(classLabel(s.className))}</td>
        <td class="c room">${esc(room.name)}</td>
      </tr>`
    )
    .join("");
  const examName = roomExamName(room, examWeeks) || "____________";
  const dateTxt = roomExamDateText(room, examWeeks) || "____________";

  return `<section class="page">
    <div class="head">
      <img src="${logoUrl}" alt="" />
      <div>
        <div class="school">${esc(SCHOOL_NAME)}</div>
        <div class="city">${esc(SCHOOL_CITY)}</div>
      </div>
    </div>
    <div class="title">EXAM SEATING LIST</div>
    <div class="room-big">${esc(room.name)}</div>
    <div class="meta">
      <span>Exam: <b>${esc(examName)}</b></span>
      <span>Date: <b>${esc(dateTxt)}</b></span>
      <span>Total students: <b>${list.length}</b></span>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:9%" class="c">#</th>
          <th style="width:19%">Student ID</th>
          <th>Student name</th>
          <th style="width:14%" class="c">Class</th>
          <th style="width:17%" class="c">Exam room</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="printed">Printed: ${esc(new Date().toLocaleString("en-GB"))}</div>
  </section>`;
}

// =====================================================================
// EXAM ATTENDANCE SHEET (A4 portrait)
// Reads the exam week from the Exam Timetable page:
//   examTimetable/{className}__{Day} = { slots: [{ startTime, endTime, subject }] }
//   examWeek/{className}             = { startDate, endDate, examType }
// One page per exam day. Students are grouped by class, because each class
// can sit different subjects on the same day. Each subject has a
// "Present" checkbox and a "Signature" box.
// =====================================================================
const WEEK_DAYS = [
  { key: "Saturday", so: "SABTI", dow: 6 },
  { key: "Sunday", so: "AXAD", dow: 0 },
  { key: "Monday", so: "ISNIIN", dow: 1 },
  { key: "Tuesday", so: "TALAADO", dow: 2 },
  { key: "Wednesday", so: "ARBACO", dow: 3 },
];
const EXAM_TYPE_LABELS = { monthly1: "Monthly 1", midterm: "Mid Term", monthly2: "Monthly 2", final: "Final" };

function ttKey(cls, day) {
  return `${cls}__${day}`;
}
function daySlots(examTT, cls, dayKey) {
  const d = examTT[ttKey(cls, dayKey)] || examTT[ttKey(String(cls).toUpperCase(), dayKey)];
  return (d?.slots || [])
    .filter((s) => s.subject && String(s.subject).trim())
    .slice()
    .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
}
function weekOf(examWeeks, cls) {
  return examWeeks[cls] || examWeeks[String(cls).toUpperCase()] || null;
}
// The calendar date of this weekday inside the class's exam week
function dayDateFor(week, dow) {
  if (!week?.startDate) return null;
  const start = new Date(week.startDate + "T12:00:00");
  const end = week.endDate ? new Date(week.endDate + "T12:00:00") : new Date(start.getTime() + 6 * 864e5);
  for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 864e5)) {
    if (d.getDay() === dow) return d;
  }
  return null;
}
function fmtDate(d) {
  return d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "____________";
}

// The classes of a room, in class order (1 → 8, F1 → F4)
function roomClasses(room) {
  return [...new Set((room.students || []).map((s) => s.className))].sort(
    (a, b) => classRank(a) - classRank(b) || String(a).localeCompare(String(b))
  );
}
// EXAM NAME — shared by the Seating List and the Attendance Sheet.
// 1) the name the admin typed for this room, otherwise
// 2) the exam type set for the room's classes on the Exam Timetable page
//    (examWeek/{class}.examType → "Monthly 1 Exam", "Mid Term Exam", ...).
// Returns "" when neither exists.
function roomExamName(room, examWeeks, preferClass) {
  const typed = String(room.examTitle || "").trim();
  if (typed) return typed;
  const order = preferClass ? [preferClass, ...roomClasses(room)] : roomClasses(room);
  for (const cls of order) {
    const t = weekOf(examWeeks || {}, cls)?.examType;
    if (t) return `${EXAM_TYPE_LABELS[t] || "Final"} Exam`;
  }
  return "";
}
// EXAM DATE for the Seating List — the date typed for the room, otherwise the
// first day of the exam week of the room's classes. Returns "" when unknown.
function roomExamDateText(room, examWeeks) {
  if (room.examDate) return fmtDate(new Date(room.examDate + "T12:00:00"));
  let start = null;
  roomClasses(room).forEach((cls) => {
    const sd = weekOf(examWeeks || {}, cls)?.startDate;
    if (!sd) return;
    const d = new Date(sd + "T12:00:00");
    if (!start || d < start) start = d;
  });
  return start ? fmtDate(start) : "";
}

// For one room: per exam day → every student in the room, each one reading
// the exams of THEIR OWN class (the class they came from) for that day.
function buildRoomSchedule(room, examTT, examWeeks) {
  const students = [...(room.students || [])].sort(byName);
  const classList = [...new Set(students.map((s) => s.className))].sort(
    (a, b) => classRank(a) - classRank(b) || a.localeCompare(b)
  );
  return WEEK_DAYS.map((day) => {
    // per class (used for the on-screen week summary)
    const groups = classList
      .map((cls) => ({ cls, slots: daySlots(examTT, cls, day.key) }))
      .filter((g) => g.slots.length > 0);
    const slotsByClass = Object.fromEntries(groups.map((g) => [g.cls, g.slots]));
    // one row per student, in the room's A → Z order
    const rows = students
      .map((s) => ({ student: s, slots: slotsByClass[s.className] || [] }))
      .filter((r) => r.slots.length > 0);
    const maxSlots = rows.reduce((m, r) => Math.max(m, r.slots.length), 0);
    let date = null;
    for (const g of groups) {
      date = dayDateFor(weekOf(examWeeks, g.cls), day.dow);
      if (date) break;
    }
    return { day, groups, rows, maxSlots, date };
  });
}

function attendancePageHtml(room, entry, examWeeks, logoUrl) {
  const { day, rows, maxSlots, date, groups } = entry;
  const examName = roomExamName(room, examWeeks, groups[0]?.cls) || "Exam";
  const n = Math.max(maxSlots, 1);

  const headTop = Array.from({ length: n })
    .map((_, i) => `<th colspan="3" class="c subj">Exam ${i + 1}</th>`)
    .join("");
  const headSub = Array.from({ length: n })
    .map(() => `<th class="sm">Maado / Subject</th><th class="c sm">Jooga<br/>Present</th><th class="c sm">Saxiix<br/>Signature</th>`)
    .join("");

  const body = rows
    .map(({ student: s, slots }, i) => {
      const cells = Array.from({ length: n })
        .map((_, k) => {
          const sl = slots[k];
          if (!sl) return `<td class="none">—</td><td class="none"></td><td class="none"></td>`;
          return `<td class="subjCell"><div class="sjn">${esc(sl.subject)}</div><div class="sjt">${esc(sl.startTime || "")}${sl.endTime ? "–" + esc(sl.endTime) : ""}</div></td>
            <td class="c"><span class="box"></span></td><td class="sig"></td>`;
        })
        .join("");
      return `<tr>
        <td class="c">${i + 1}</td>
        <td class="mono">${esc(s.studentId)}</td>
        <td class="name">${esc(s.fullName)}</td>
        <td class="c cls">${esc(classLabel(s.className))}</td>
        ${cells}
      </tr>`;
    })
    .join("");

  const nameW = n >= 3 ? 18 : n === 2 ? 22 : 32;
  return `<section class="page">
    <div class="head">
      <img src="${logoUrl}" alt="" />
      <div style="flex:1">
        <div class="school">${esc(SCHOOL_NAME)}</div>
        <div class="city">${esc(SCHOOL_CITY)}</div>
      </div>
      <div class="dayTag">
        <div class="dso">${esc(day.so)}</div>
        <div class="den">${esc(day.key)}</div>
      </div>
    </div>
    <div class="title">EXAM ATTENDANCE SHEET · XAADIRINTA IMTIXAANKA</div>
    <div class="meta">
      <span>Room: <b>${esc(room.name)}</b></span>
      <span>Exam: <b>${esc(examName)}</b></span>
      <span>Date: <b>${esc(fmtDate(date))}</b></span>
      <span>Students: <b>${rows.length}</b></span>
    </div>
    <table>
      <colgroup>
        <col style="width:4%" /><col style="width:8%" /><col style="width:${nameW}%" /><col style="width:8%" />
        ${Array.from({ length: n }).map(() => `<col /><col style="width:6.5%" /><col />`).join("")}
      </colgroup>
      <thead>
        <tr>
          <th rowspan="2" class="c">#</th>
          <th rowspan="2">ID</th>
          <th rowspan="2">Student name</th>
          <th rowspan="2" class="c">Class</th>
          ${headTop}
        </tr>
        <tr>${headSub}</tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
    <div class="foot">
      <div>Present: <span class="line short"></span> &nbsp; Absent: <span class="line short"></span></div>
    </div>
    <div class="foot">
      <div>Invigilator: <span class="line"></span></div>
      <div>Signature: <span class="line short"></span></div>
    </div>
    <div class="printed">Printed: ${esc(new Date().toLocaleString("en-GB"))}</div>
  </section>`;
}

function printAttendance(roomList, examTT, examWeeks, dayFilter = "ALL") {
  const logoUrl = new URL(logo, window.location.href).href;
  const pages = [];
  roomList.forEach((room) => {
    if (!(room.students || []).length) return;
    buildRoomSchedule(room, examTT, examWeeks)
      .filter((e) => e.rows.length > 0 && (dayFilter === "ALL" || e.day.key === dayFilter))
      .forEach((e) => pages.push(attendancePageHtml(room, e, examWeeks, logoUrl)));
  });
  if (!pages.length) {
    alert(
      "No exams were found for the students in this room on that day.\n" +
        "First create the timetable on the Exam Timetable page (for each class in this room)."
    );
    return;
  }
  const html = `<!doctype html><html><head><meta charset="utf-8" />
  <title>Exam Attendance — ${esc(roomList.map((r) => r.name).join(", "))}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm 10mm 12mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0 auto; max-width: 190mm; padding: 6mm 0; }
    @media print { body { max-width: none; padding: 0; } }
    .page + .page { break-before: page; page-break-before: always; }
    .head { display: flex; align-items: center; gap: 12px; border-bottom: 3px solid #15803d; padding-bottom: 8px; }
    .head img { width: 58px; height: 58px; object-fit: contain; }
    .school { font-size: 16px; font-weight: 800; text-transform: uppercase; color: #0f4a2c; line-height: 1.2; }
    .city { font-size: 10px; letter-spacing: .18em; color: #15803d; font-weight: 700; margin-top: 3px; }
    .dayTag { text-align: center; background: #0f4a2c; color: #fff; border-radius: 8px; padding: 6px 14px; }
    .dso { font-size: 18px; font-weight: 900; letter-spacing: .05em; }
    .den { font-size: 10px; opacity: .85; }
    .title { text-align: center; margin: 10px 0 8px; font-size: 13px; font-weight: 800; letter-spacing: .1em; color: #374151; }
    .meta { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 6px; font-size: 11.5px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 6px 10px; margin-bottom: 10px; }
    .subjCell { padding: 2px 5px; line-height: 1.15; }
    .sjn { font-weight: 700; font-size: 10.5px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    .sjt { font-size: 8.5px; color: #4b5563; }
    .cls { font-weight: 700; color: #0f4a2c; font-size: 10.5px; }
    .none { background: #f3f4f6; color: #9ca3af; text-align: center; }
    table { width: 100%; border-collapse: collapse; font-size: 11.5px; table-layout: fixed; }
    thead { display: table-header-group; }
    th { background: #0f4a2c; color: #fff; text-align: left; padding: 5px 6px; font-size: 10px; text-transform: uppercase; letter-spacing: .03em; border: 1px solid #0f4a2c; }
    th.subj { background: #166534; }
    th.sm { background: #dcfce7; color: #14532d; font-size: 8.5px; line-height: 1.2; }
    .sn { font-size: 10.5px; font-weight: 800; text-transform: none; }
    .st { font-size: 9px; font-weight: 400; opacity: .9; }
    td { border: 1px solid #c7cdd4; padding: 0 6px; height: 9.5mm; vertical-align: middle; }
    tr { page-break-inside: avoid; break-inside: avoid; }
    .c { text-align: center; }
    .mono { font-family: "Courier New", monospace; font-weight: 700; font-size: 11px; }
    .name { font-weight: 600; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    .box { display: inline-block; width: 15px; height: 15px; border: 1.6px solid #111; border-radius: 2px; vertical-align: middle; }
    .sig { background: #fff; }
    .foot { margin-top: 14px; display: flex; justify-content: space-between; font-size: 11.5px; }
    .line { display: inline-block; border-bottom: 1px solid #111; width: 190px; margin-left: 6px; }
    .line.short { width: 110px; }
    .printed { margin-top: 8px; font-size: 9px; color: #6b7280; text-align: right; }
  </style></head><body>
  ${pages.join("")}
  <script>window.onload = function () { setTimeout(function () { window.print(); }, 300); };</script>
  </body></html>`;
  const w = window.open("", "_blank");
  if (!w) {
    alert("Please allow pop-ups so you can print.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function printRooms(roomList, sortMode, examWeeks = {}) {
  const printable = roomList.filter((r) => (r.students || []).length > 0);
  if (!printable.length) {
    alert("No room has any students yet.");
    return;
  }
  const logoUrl = new URL(logo, window.location.href).href;
  const html = `<!doctype html><html><head><meta charset="utf-8" />
  <title>Exam Seating — ${esc(printable.map((r) => r.name).join(", "))}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm 12mm 14mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; }
    .page + .page { break-before: page; page-break-before: always; }
    .head { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid #15803d; padding-bottom: 10px; }
    .head img { width: 66px; height: 66px; object-fit: contain; }
    .school { font-size: 18px; font-weight: 800; text-transform: uppercase; color: #0f4a2c; line-height: 1.2; }
    .city { font-size: 11px; letter-spacing: .18em; color: #15803d; font-weight: 700; margin-top: 3px; }
    .title { text-align: center; margin: 14px 0 2px; font-size: 13px; font-weight: 800; letter-spacing: .12em; color: #374151; }
    .room-big { text-align: center; font-size: 28px; font-weight: 900; color: #0f4a2c; margin: 0 0 10px; }
    .meta { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 6px; font-size: 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 7px 10px; margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
    thead { display: table-header-group; }
    th { background: #0f4a2c; color: #fff; text-align: left; padding: 7px 8px; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
    td { border-bottom: 1px solid #d1d5db; padding: 6px 8px; }
    tr { page-break-inside: avoid; break-inside: avoid; }
    tbody tr:nth-child(even) td { background: #f9fafb; }
    .c { text-align: center; }
    .mono { font-family: "Courier New", monospace; font-weight: 700; }
    .name { font-weight: 600; }
    .room { font-weight: 700; color: #0f4a2c; }
    .foot { margin-top: 26px; display: flex; justify-content: space-between; font-size: 12px; }
    .line { display: inline-block; border-bottom: 1px solid #111; width: 190px; margin-left: 6px; }
    .line.short { width: 130px; }
    .printed { margin-top: 10px; font-size: 9.5px; color: #6b7280; text-align: right; }
  </style></head><body>
  ${printable.map((r) => roomSectionHtml(r, sortMode, logoUrl, examWeeks)).join("")}
  <script>window.onload = function () { setTimeout(function () { window.print(); }, 300); };</script>
  </body></html>`;

  const w = window.open("", "_blank");
  if (!w) {
    alert("Please allow pop-ups so you can print.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

// =====================================================================
export default function ExamRooms() {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const [newRoom, setNewRoom] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  // picker
  const [classFilter, setClassFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [checked, setChecked] = useState(() => new Set());
  const [firstN, setFirstN] = useState("");
  const [showAssigned, setShowAssigned] = useState(false);

  // room panel
  const [roomSort, setRoomSort] = useState("name"); // "name" | "class"
  const [roomSearch, setRoomSearch] = useState("");
  const [examTitle, setExamTitle] = useState("");
  const [examDate, setExamDate] = useState("");

  // exam week (read from the Exam Timetable page)
  const [examTT, setExamTT] = useState({});
  const [examWeeks, setExamWeeks] = useState({});
  const [attDay, setAttDay] = useState("ALL");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [stSnap, rmSnap, ttSnap, wkSnap] = await Promise.all([
        getDocs(collection(db, "students")),
        getDocs(collection(db, "examRooms")),
        getDocs(collection(db, "examTimetable")).catch(() => null),
        getDocs(collection(db, "examWeek")).catch(() => null),
      ]);
      const tt = {};
      ttSnap?.docs.forEach((d) => (tt[d.id] = d.data()));
      setExamTT(tt);
      const wk = {};
      wkSnap?.docs.forEach((d) => (wk[d.id] = d.data()));
      setExamWeeks(wk);
      const st = stSnap.docs
        .map((d) => {
          const x = d.data();
          return {
            docId: d.id,
            studentId: String(x.studentId || x.studentID || d.id),
            fullName: x.fullName || x.name || "—",
            className: String(x.className || "").trim(),
            pendingDeletion: !!x.pendingDeletion,
          };
        })
        .filter((s) => !s.pendingDeletion && s.className && s.className !== "Qalin Jabis");
      setStudents(st);

      setRooms(
        rmSnap.docs.map((d) => {
          const x = d.data();
          return { id: d.id, ...x, students: Array.isArray(x.students) ? x.students : [] };
        })
      );
    } catch (err) {
      console.log(err);
      alert("An error occurred while loading the data: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  const sortedRooms = useMemo(() => [...rooms].sort(byRoomName), [rooms]);
  const selectedRoom = rooms.find((r) => r.id === selectedId) || null;

  // The exam week for the classes in this room (per day: which classes sit which subjects)
  const roomSchedule = useMemo(
    () => (selectedRoom ? buildRoomSchedule(selectedRoom, examTT, examWeeks) : []),
    [selectedRoom, examTT, examWeeks]
  );
  const scheduledDays = roomSchedule.filter((e) => e.groups.length > 0);

  useEffect(() => {
    setExamTitle(selectedRoom?.examTitle || "");
    setExamDate(selectedRoom?.examDate || "");
    setChecked(new Set());
    setRoomSearch("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // which room each student is in (a student can only be in one room)
  const assignedMap = useMemo(() => {
    const m = new Map();
    rooms.forEach((r) => (r.students || []).forEach((s) => m.set(s.docId, r.name)));
    return m;
  }, [rooms]);

  const classes = useMemo(() => {
    const set = new Set(students.map((s) => s.className));
    return [...set].sort((a, b) => classRank(a) - classRank(b) || a.localeCompare(b));
  }, [students]);

  const unassignedByClass = useMemo(() => {
    const c = {};
    students.forEach((s) => {
      if (!assignedMap.has(s.docId)) c[s.className] = (c[s.className] || 0) + 1;
    });
    return c;
  }, [students, assignedMap]);

  // The list before the search is applied (class + assigned filters only) — used to count letters
  const baseList = useMemo(
    () =>
      students
        .filter((s) => classFilter === "ALL" || s.className === classFilter)
        .filter((s) => showAssigned || !assignedMap.has(s.docId)),
    [students, classFilter, showAssigned, assignedMap]
  );

  // How many students start with each letter (A–Z)
  const letterCounts = useMemo(() => {
    const c = {};
    baseList.forEach((s) => {
      const L = (s.fullName || "").trim().charAt(0).toUpperCase();
      if (L) c[L] = (c[L] || 0) + 1;
    });
    return c;
  }, [baseList]);

  // Search: only names that START WITH the typed letter(s)
  // (e.g. "c" → Cabdi, Cali... ; "ax" → Axmed...). Typing digits matches the start of the ID.
  const pickerList = useMemo(() => {
    const q = search.trim().toLowerCase();
    return baseList
      .filter((s) => !q || s.fullName.trim().toLowerCase().startsWith(q) || s.studentId.toLowerCase().startsWith(q))
      .sort(byName);
  }, [baseList, search]);

  const selectable = useMemo(() => pickerList.filter((s) => !assignedMap.has(s.docId)), [pickerList, assignedMap]);
  const allVisibleChecked = selectable.length > 0 && selectable.every((s) => checked.has(s.docId));

  const roomStudents = useMemo(() => {
    if (!selectedRoom) return [];
    const q = roomSearch.trim().toLowerCase();
    return [...selectedRoom.students]
      .sort(roomSort === "class" ? byClassThenName : byName)
      .filter((s) => !q || (s.fullName || "").trim().toLowerCase().startsWith(q) || String(s.studentId).toLowerCase().startsWith(q));
  }, [selectedRoom, roomSort, roomSearch]);

  const totalAssigned = assignedMap.size;
  const totalUnassigned = students.length - students.filter((s) => assignedMap.has(s.docId)).length;

  // ---------------- actions ----------------
  function toggle(docId) {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(docId) ? next.delete(docId) : next.add(docId);
      return next;
    });
  }

  function toggleAllVisible() {
    setChecked((prev) => {
      const next = new Set(prev);
      if (allVisibleChecked) selectable.forEach((s) => next.delete(s.docId));
      else selectable.forEach((s) => next.add(s.docId));
      return next;
    });
  }

  // Select the first N students in alphabetical order (A → Z) from the current list
  function selectFirstN() {
    const n = parseInt(firstN, 10);
    if (!(n > 0)) {
      alert("Enter a number (e.g. 30).");
      return;
    }
    setChecked(new Set(selectable.slice(0, n).map((s) => s.docId)));
  }

  async function createRoom(e) {
    e?.preventDefault();
    const name = newRoom.trim();
    if (!name) return;
    if (rooms.some((r) => (r.name || "").trim().toLowerCase() === name.toLowerCase())) {
      alert("A room with this name already exists.");
      return;
    }
    setCreating(true);
    try {
      const payload = { name, examTitle: "", examDate: "", students: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
      const ref = await addDoc(collection(db, "examRooms"), payload);
      setRooms((prev) => [...prev, { ...payload, id: ref.id, students: [] }]);
      setSelectedId(ref.id);
      setNewRoom("");
    } catch (err) {
      console.log(err);
      alert("Error creating the room: " + err.message);
    } finally {
      setCreating(false);
    }
  }

  async function saveStudents(room, list, extra = {}) {
    const sorted = [...list].sort(byName);
    await updateDoc(doc(db, "examRooms", room.id), { students: sorted, updatedAt: serverTimestamp(), ...extra });
    setRooms((prev) => prev.map((r) => (r.id === room.id ? { ...r, ...extra, students: sorted } : r)));
  }

  // A student can be in ONE room only. Right before saving, the rooms are
  // re-read from the database (another admin, or another browser tab, may
  // have placed a student in a different room in the meantime) — anyone
  // already in another room is skipped and named in a warning.
  async function addChecked() {
    if (!selectedRoom || checked.size === 0) return;
    setBusy(true);
    try {
      const fresh = await getDocs(collection(db, "examRooms"));
      const freshRooms = fresh.docs.map((d) => {
        const x = d.data();
        return { id: d.id, ...x, students: Array.isArray(x.students) ? x.students : [] };
      });
      const takenBy = new Map();
      freshRooms.forEach((r) => r.students.forEach((s) => takenBy.set(s.docId, r.name)));

      const wanted = students.filter((s) => checked.has(s.docId));
      const blocked = wanted.filter((s) => takenBy.has(s.docId));
      const picks = wanted.filter((s) => !takenBy.has(s.docId)).map(slim);

      // keep the screen in sync with what the database says
      setRooms(freshRooms);
      const current = freshRooms.find((r) => r.id === selectedRoom.id);
      if (!current) {
        alert("This room no longer exists (it was deleted).");
        setSelectedId(null);
        return;
      }

      if (picks.length) {
        const seen = new Set();
        const merged = [...current.students, ...picks].filter((s) => !seen.has(s.docId) && seen.add(s.docId));
        await saveStudents(current, merged);
      }
      setChecked(new Set());

      if (blocked.length) {
        const list = blocked
          .slice(0, 12)
          .map((s) => `• ${s.fullName} → ${takenBy.get(s.docId)}`)
          .join("\n");
        alert(
          `${blocked.length} student(s) were NOT added because they are already in another room:\n\n${list}` +
            (blocked.length > 12 ? `\n...and ${blocked.length - 12} more` : "") +
            `\n\nRemove them from that room first if you want to move them.`
        );
      }
    } catch (err) {
      console.log(err);
      alert("Error adding students: " + err.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeFromRoom(docId) {
    if (!selectedRoom) return;
    setBusy(true);
    try {
      await saveStudents(selectedRoom, selectedRoom.students.filter((s) => s.docId !== docId));
    } catch (err) {
      console.log(err);
      alert("Error: " + err.message);
    } finally {
      setBusy(false);
    }
  }

  async function clearRoom() {
    if (!selectedRoom || !selectedRoom.students.length) return;
    if (!window.confirm(`Remove all students from "${selectedRoom.name}"?`)) return;
    setBusy(true);
    try {
      await saveStudents(selectedRoom, []);
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteRoom(room) {
    if (!window.confirm(`Are you sure you want to delete the room "${room.name}"? (The students will become free again.)`)) return;
    setBusy(true);
    try {
      await deleteDoc(doc(db, "examRooms", room.id));
      setRooms((prev) => prev.filter((r) => r.id !== room.id));
      if (selectedId === room.id) setSelectedId(null);
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveDetails() {
    if (!selectedRoom) return;
    setBusy(true);
    try {
      const extra = { examTitle: examTitle.trim(), examDate };
      await updateDoc(doc(db, "examRooms", selectedRoom.id), { ...extra, updatedAt: serverTimestamp() });
      setRooms((prev) => prev.map((r) => (r.id === selectedRoom.id ? { ...r, ...extra } : r)));
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setBusy(false);
    }
  }

  // What the sheets will show when the admin leaves the fields empty (from the Exam Timetable)
  const autoExamName = selectedRoom ? roomExamName({ ...selectedRoom, examTitle: "" }, examWeeks) : "";
  const autoExamDate = selectedRoom ? roomExamDateText({ ...selectedRoom, examDate: "" }, examWeeks) : "";

  const detailsDirty =
    selectedRoom && ((selectedRoom.examTitle || "") !== examTitle.trim() || (selectedRoom.examDate || "") !== examDate);

  // =====================================================================
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f4f7f5", fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      <Sidebar />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: "20px 28px 0" }}>
          <Topbar title="Exam Rooms" />
        </div>

        <div style={{ padding: "22px 28px 36px" }} className="er-pad">
          {/* ---------- HERO ---------- */}
          <div style={hero}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
              <div style={heroIcon}>
                <DoorOpen size={28} color="#fff" />
              </div>
              <div style={{ minWidth: 0 }}>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#fff" }}>Exam Seating Rooms</h1>
                <div style={{ color: "#bbf7d0", fontSize: 13.5, marginTop: 3 }}>
                  Create exam rooms, add students, then print an A4 sheet
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <HeroStat label="Rooms" value={rooms.length} />
              <HeroStat label="Assigned" value={totalAssigned} />
              <HeroStat label="Unassigned" value={loading ? "…" : totalUnassigned} warn={totalUnassigned > 0} />
              <button onClick={() => printRooms(sortedRooms, roomSort, examWeeks)} style={heroPrintBtn}>
                <Printer size={16} /> Print all rooms
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ ...card, textAlign: "center", color: "#6b7280", padding: 60 }}>
              <Loader2 size={26} className="er-spin" /> <div style={{ marginTop: 8 }}>Loading data...</div>
            </div>
          ) : (
            <div className="er-grid">
              {/* ---------- LEFT: ROOMS ---------- */}
              <div style={card}>
                <CardHead icon={Layers} title="Rooms" sub={`${rooms.length} rooms · A → Z`} />

                <form onSubmit={createRoom} style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  <input
                    list="er-class-names"
                    value={newRoom}
                    onChange={(e) => setNewRoom(e.target.value)}
                    placeholder="Room name (e.g. Class 5)"
                    style={{ ...input, flex: 1 }}
                  />
                  <datalist id="er-class-names">
                    {CLASS_ORDER.map((c) => (
                      <option key={c} value={classLabel(c)} />
                    ))}
                  </datalist>
                  <button type="submit" disabled={creating || !newRoom.trim()} style={{ ...primaryBtn, padding: "0 14px", opacity: creating || !newRoom.trim() ? 0.6 : 1 }}>
                    {creating ? <Loader2 size={16} className="er-spin" /> : <Plus size={16} />}
                  </button>
                </form>

                {sortedRooms.length === 0 ? (
                  <Empty icon={DoorOpen} text="No room has been created yet. Create the first one above." />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {sortedRooms.map((r) => {
                      const active = r.id === selectedId;
                      return (
                        <div
                          key={r.id}
                          onClick={() => setSelectedId(r.id)}
                          className="er-room"
                          style={{
                            ...roomItem,
                            background: active ? "linear-gradient(90deg,#22a447,#15803d)" : "#f9fbfa",
                            borderColor: active ? "#15803d" : "#eef2ef",
                            color: active ? "#fff" : "#111827",
                          }}
                        >
                          <div style={{ ...roomBadge, background: active ? "rgba(255,255,255,0.2)" : "#dcfce7", color: active ? "#fff" : GREEN }}>
                            <DoorOpen size={17} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
                            <div style={{ fontSize: 12, opacity: active ? 0.9 : 0.65 }}>
                              {r.students.length} students{roomExamName(r, examWeeks) ? ` · ${roomExamName(r, examWeeks)}` : ""}
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteRoom(r);
                            }}
                            title="Delete room"
                            style={{ ...iconGhost, color: active ? "#fecaca" : "#dc2626" }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ---------- RIGHT: DETAILS ---------- */}
              {!selectedRoom ? (
                <div style={{ ...card, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 320 }}>
                  <Empty icon={DoorOpen} text="Select a room on the left or create a new one." />
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
                  {/* Room header */}
                  <div style={card}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ ...roomBadge, width: 50, height: 50, borderRadius: 15, background: "linear-gradient(135deg,#16a34a,#0f4a2c)", color: "#fff" }}>
                          <DoorOpen size={24} />
                        </div>
                        <div>
                          <div style={{ fontSize: 21, fontWeight: 900, color: "#0f2a1c" }}>{selectedRoom.name}</div>
                          <div style={{ fontSize: 13, color: "#6b7280" }}>{selectedRoom.students.length} students in this room</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button onClick={clearRoom} disabled={busy || !selectedRoom.students.length} style={{ ...outlineBtn, opacity: !selectedRoom.students.length ? 0.5 : 1 }}>
                          <Eraser size={15} /> Clear
                        </button>
                        <button onClick={() => printRooms([selectedRoom], roomSort, examWeeks)} disabled={!selectedRoom.students.length} style={{ ...primaryBtn, opacity: !selectedRoom.students.length ? 0.5 : 1 }}>
                          <Printer size={16} /> Print A4
                        </button>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16, alignItems: "flex-end" }}>
                      <div style={{ flex: "2 1 220px" }}>
                        <div style={label}>Exam name (shown on the sheet)</div>
                        <input value={examTitle} onChange={(e) => setExamTitle(e.target.value)} placeholder={autoExamName ? `Auto: ${autoExamName}` : "e.g. Final Exam 2026"} style={input} />
                        {!examTitle.trim() && autoExamName && (
                          <div style={{ fontSize: 11.5, color: "#15803d", marginTop: 4 }}>Read from the Exam Timetable: {autoExamName}</div>
                        )}
                      </div>
                      <div style={{ flex: "1 1 160px" }}>
                        <div style={label}>Exam date</div>
                        <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} style={input} />
                        {!examDate && autoExamDate && (
                          <div style={{ fontSize: 11.5, color: "#15803d", marginTop: 4 }}>Read from the Exam Timetable: {autoExamDate}</div>
                        )}
                      </div>
                      <button onClick={saveDetails} disabled={busy || !detailsDirty} style={{ ...primaryBtn, opacity: busy || !detailsDirty ? 0.55 : 1 }}>
                        <Save size={15} /> Save
                      </button>
                    </div>
                  </div>

                  {/* ---------- EXAM WEEK + ATTENDANCE SHEET ---------- */}
                  <div style={card}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#2563eb1A", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <ClipboardCheck size={19} />
                        </div>
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>Exam Attendance Sheet</div>
                          <div style={{ fontSize: 12.5, color: "#6b7280" }}>From the Exam Timetable — one page per exam day, with a Present box and Signature</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <select value={attDay} onChange={(e) => setAttDay(e.target.value)} style={{ ...input, width: 170, cursor: "pointer" }}>
                          <option value="ALL">Whole week</option>
                          {scheduledDays.map((e) => (
                            <option key={e.day.key} value={e.day.key}>
                              {e.day.so} ({e.day.key})
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => printAttendance([selectedRoom], examTT, examWeeks, attDay)}
                          disabled={!selectedRoom.students.length || !scheduledDays.length}
                          style={{
                            ...primaryBtn,
                            background: "linear-gradient(180deg,#3b82f6,#1d4ed8)",
                            boxShadow: "0 6px 14px rgba(29,78,216,0.25)",
                            opacity: !selectedRoom.students.length || !scheduledDays.length ? 0.5 : 1,
                          }}
                        >
                          <Printer size={16} /> Print Attendance
                        </button>
                      </div>
                    </div>

                    {!selectedRoom.students.length ? (
                      <Empty icon={CalendarDays} text="Add students to the room first." small />
                    ) : !scheduledDays.length ? (
                      <div style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#b45309", borderRadius: 12, padding: "12px 14px", fontSize: 13 }}>
                        No exam timetable was found for the classes in this room. Go to the <b>Exam Timetable</b> page and enter the subjects for each class (Saturday–Wednesday).
                      </div>
                    ) : (
                      <div className="er-week">
                        {roomSchedule.map((e) => {
                          const has = e.groups.length > 0;
                          const active = attDay === e.day.key;
                          return (
                            <div
                              key={e.day.key}
                              onClick={() => has && setAttDay(active ? "ALL" : e.day.key)}
                              style={{
                                borderRadius: 14,
                                padding: "10px 12px",
                                border: `1.5px solid ${active ? "#1d4ed8" : has ? "#e5e7eb" : "#f1f5f2"}`,
                                background: active ? "#eff6ff" : has ? "#fff" : "#f9fafb",
                                cursor: has ? "pointer" : "default",
                                opacity: has ? 1 : 0.6,
                                minWidth: 0,
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
                                <span style={{ fontWeight: 900, fontSize: 13.5, color: "#0f2a1c" }}>{e.day.so}</span>
                                <span style={{ fontSize: 11, color: "#6b7280" }}>
                                  {e.date ? e.date.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : ""}
                                </span>
                              </div>
                              {!has ? (
                                <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 6 }}>No exam</div>
                              ) : (
                                e.groups.map((g) => (
                                  <div key={g.cls} style={{ marginTop: 7 }}>
                                    <div style={{ fontSize: 11, fontWeight: 800, color: GREEN }}>{classLabel(g.cls)}</div>
                                    {g.slots.map((s, i) => (
                                      <div key={i} style={{ fontSize: 12, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                        {i + 1}. {s.subject} <span style={{ color: "#9ca3af", fontSize: 11 }}>{s.startTime}</span>
                                      </div>
                                    ))}
                                  </div>
                                ))
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="er-split">
                    {/* Students in the room */}
                    <div style={card}>
                      <CardHead icon={Users} title="Students in the Room" sub={`${selectedRoom.students.length} students`} />
                      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                        <div style={{ ...searchWrap, flex: "1 1 160px" }}>
                          <Search size={15} color="#6b7280" />
                          <input value={roomSearch} onChange={(e) => setRoomSearch(e.target.value)} placeholder="Search..." style={bareInput} />
                        </div>
                        <Seg value={roomSort} onChange={setRoomSort} options={[{ v: "name", l: "A → Z" }, { v: "class", l: "By class" }]} />
                      </div>

                      {roomStudents.length === 0 ? (
                        <Empty icon={Users} text={selectedRoom.students.length ? "No match found." : "No students yet — add them from the right-hand side."} small />
                      ) : (
                        <div style={listBox}>
                          {roomStudents.map((s, i) => (
                            <div key={s.docId} style={rowItem}>
                              <div style={numBadge}>{i + 1}</div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={rowName}>{s.fullName}</div>
                                <div style={rowSub}>ID: {s.studentId}</div>
                              </div>
                              <span style={classChip}>{classLabel(s.className)}</span>
                              <button onClick={() => removeFromRoom(s.docId)} disabled={busy} style={iconGhost} title="Remove from room">
                                <X size={15} color="#dc2626" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Add students */}
                    <div style={card}>
                      <CardHead icon={UserPlus} title="Add Students" sub="Select from any class" />

                      {/* class chips */}
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                        <Chip active={classFilter === "ALL"} onClick={() => setClassFilter("ALL")}>
                          All
                        </Chip>
                        {classes.map((c) => (
                          <Chip key={c} active={classFilter === c} onClick={() => setClassFilter(c)}>
                            {classLabel(c)} <span style={{ opacity: 0.65 }}>({unassignedByClass[c] || 0})</span>
                          </Chip>
                        ))}
                      </div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                        <div style={{ ...searchWrap, flex: "1 1 170px" }}>
                          <Search size={15} color="#6b7280" />
                          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Type a letter (e.g. C) or ID..." style={bareInput} />
                          {search && (
                            <button onClick={() => setSearch("")} style={{ ...iconGhost, width: 24, height: 24 }} title="Clear">
                              <X size={14} color="#6b7280" />
                            </button>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <input
                            type="number"
                            min="1"
                            value={firstN}
                            onChange={(e) => setFirstN(e.target.value)}
                            placeholder="N"
                            style={{ ...input, width: 70 }}
                            title="How many students A → Z"
                          />
                          <button onClick={selectFirstN} style={outlineBtn} title="Select the first N students in alphabetical order">
                            <ArrowDownAZ size={15} /> First N
                          </button>
                        </div>
                      </div>

                      {/* A–Z letter bar: click a letter → everyone whose name starts with it */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
                        {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((L) => {
                          const n = letterCounts[L] || 0;
                          const active = search.trim().toUpperCase() === L;
                          return (
                            <button
                              key={L}
                              disabled={!n}
                              onClick={() => setSearch(active ? "" : L)}
                              title={n ? `${n} students start with ${L}` : `No one starts with ${L}`}
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: 8,
                                border: `1px solid ${active ? GREEN : "#e5e7eb"}`,
                                background: active ? GREEN : n ? "#fff" : "#f9fafb",
                                color: active ? "#fff" : n ? "#111827" : "#d1d5db",
                                fontWeight: 800,
                                fontSize: 12.5,
                                cursor: n ? "pointer" : "not-allowed",
                              }}
                            >
                              {L}
                            </button>
                          );
                        })}
                      </div>

                      {search.trim() && (
                        <div style={{ fontSize: 12.5, color: "#4b5563", marginBottom: 8 }}>
                          <b style={{ color: GREEN }}>{pickerList.length}</b> students start with "
                          <b>{search.trim().toUpperCase()}</b>"
                        </div>
                      )}

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                        <button onClick={toggleAllVisible} disabled={!selectable.length} style={{ ...linkBtn, opacity: selectable.length ? 1 : 0.5 }}>
                          <CheckSquare size={15} /> {allVisibleChecked ? "Deselect all" : `Select all (${selectable.length})`}
                        </button>
                        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#4b5563", cursor: "pointer" }}>
                          <input type="checkbox" checked={showAssigned} onChange={(e) => setShowAssigned(e.target.checked)} />
                          Show students already in a room
                        </label>
                      </div>

                      {pickerList.length === 0 ? (
                        <Empty icon={Users} text="No free students in this list." small />
                      ) : (
                        <div style={listBox}>
                          {pickerList.map((s) => {
                            const inRoom = assignedMap.get(s.docId);
                            const isChecked = checked.has(s.docId);
                            return (
                              <label
                                key={s.docId}
                                style={{
                                  ...rowItem,
                                  cursor: inRoom ? "not-allowed" : "pointer",
                                  opacity: inRoom ? 0.55 : 1,
                                  background: isChecked ? "#ecfdf3" : "transparent",
                                  borderRadius: 10,
                                }}
                              >
                                <input
                                  type="checkbox"
                                  disabled={!!inRoom}
                                  checked={isChecked}
                                  onChange={() => toggle(s.docId)}
                                  style={{ width: 17, height: 17, accentColor: GREEN, flexShrink: 0 }}
                                />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={rowName}>{s.fullName}</div>
                                  <div style={rowSub}>ID: {s.studentId}</div>
                                </div>
                                {inRoom ? (
                                  <span style={{ ...classChip, background: "#fef3c7", color: "#b45309" }}>{inRoom}</span>
                                ) : (
                                  <span style={classChip}>{classLabel(s.className)}</span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      )}

                      <button
                        onClick={addChecked}
                        disabled={busy || checked.size === 0}
                        style={{ ...primaryBtn, width: "100%", justifyContent: "center", marginTop: 12, padding: "12px 0", opacity: busy || checked.size === 0 ? 0.55 : 1 }}
                      >
                        {busy ? <Loader2 size={16} className="er-spin" /> : <UserPlus size={16} />}
                        Add {checked.size || ""} students to "{selectedRoom.name}"
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .er-grid { display: grid; grid-template-columns: 300px 1fr; gap: 20px; align-items: start; }
        .er-split { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
        .er-week { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
        @media (max-width: 1100px) { .er-week { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
        @media (max-width: 600px) { .er-week { grid-template-columns: 1fr 1fr; } }
        .er-room { transition: transform .15s ease, box-shadow .15s ease; }
        .er-room:hover { transform: translateY(-2px); box-shadow: 0 8px 18px rgba(17,24,39,0.08); }
        .er-spin { animation: er-spin 1s linear infinite; }
        @keyframes er-spin { to { transform: rotate(360deg); } }
        @media (max-width: 1300px) { .er-split { grid-template-columns: 1fr; } }
        @media (max-width: 900px) {
          .er-grid { grid-template-columns: 1fr; }
          .er-pad { padding: 16px !important; }
        }
      `}</style>
    </div>
  );
}

// ---------------- small components ----------------
function CardHead({ icon: Icon, title, sub }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#16a34a1A", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={19} />
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>{title}</div>
        {sub && <div style={{ fontSize: 12.5, color: "#6b7280" }}>{sub}</div>}
      </div>
    </div>
  );
}

function HeroStat({ label, value, warn }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 14, padding: "8px 14px", minWidth: 84 }}>
      <div style={{ fontSize: 20, fontWeight: 900, color: warn ? "#fde68a" : "#fff", lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: "#bbf7d0", fontWeight: 600 }}>{label}</div>
    </div>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 12px",
        borderRadius: 999,
        border: `1px solid ${active ? "#15803d" : "#e5e7eb"}`,
        background: active ? "#15803d" : "#fff",
        color: active ? "#fff" : "#374151",
        fontSize: 12.5,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function Seg({ value, onChange, options }) {
  return (
    <div style={{ display: "flex", background: "#f1f5f2", borderRadius: 11, padding: 3 }}>
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          style={{
            border: "none",
            padding: "7px 12px",
            borderRadius: 9,
            fontSize: 12.5,
            fontWeight: 700,
            cursor: "pointer",
            background: value === o.v ? "#fff" : "transparent",
            color: value === o.v ? GREEN : "#6b7280",
            boxShadow: value === o.v ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
          }}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

function Empty({ icon: Icon, text, small }) {
  return (
    <div style={{ textAlign: "center", padding: small ? "22px 6px" : "40px 10px", color: "#9ca3af", fontSize: 13 }}>
      <Icon size={small ? 26 : 36} color="#d1d5db" />
      <div style={{ marginTop: 8 }}>{text}</div>
    </div>
  );
}

// ---------------- styles ----------------
const hero = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  flexWrap: "wrap",
  background: "radial-gradient(circle at 80% 20%, #1f7a43 0%, transparent 45%), linear-gradient(120deg,#0a3a22 0%,#0f5130 55%,#14653a 100%)",
  borderRadius: 22,
  padding: "22px 26px",
  marginBottom: 20,
  boxShadow: "0 14px 34px rgba(10,58,34,0.25)",
};
const heroIcon = {
  width: 56,
  height: 56,
  borderRadius: 16,
  background: "rgba(255,255,255,0.14)",
  border: "1px solid rgba(255,255,255,0.25)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};
const heroPrintBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "11px 18px",
  borderRadius: 12,
  border: "1.5px solid #4ade80",
  background: "linear-gradient(180deg,#22c55e,#15803d)",
  color: "#fff",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
};
const card = {
  background: "#fff",
  borderRadius: 20,
  padding: "18px 20px",
  boxShadow: "0 6px 20px rgba(17,24,39,0.05)",
  border: "1px solid rgba(17,24,39,0.05)",
  minWidth: 0,
};
const label = { fontSize: 12, fontWeight: 700, color: "#4b5563", marginBottom: 6 };
const input = {
  width: "100%",
  height: 42,
  padding: "0 12px",
  boxSizing: "border-box",
  border: "1px solid #e5e7eb",
  borderRadius: 11,
  fontSize: 13.5,
  color: "#111827",
  outline: "none",
  background: "#f9fbfa",
};
const searchWrap = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  height: 42,
  padding: "0 12px",
  border: "1px solid #e5e7eb",
  borderRadius: 11,
  background: "#f9fbfa",
};
const bareInput = { flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontSize: 13.5, color: "#111827" };
const primaryBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  height: 42,
  padding: "0 16px",
  borderRadius: 11,
  border: "none",
  background: "linear-gradient(180deg,#22c55e,#15803d)",
  color: "#fff",
  fontWeight: 700,
  fontSize: 13.5,
  cursor: "pointer",
  boxShadow: "0 6px 14px rgba(21,128,61,0.25)",
  whiteSpace: "nowrap",
};
const outlineBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  height: 42,
  padding: "0 12px",
  borderRadius: 11,
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#374151",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
const linkBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  border: "none",
  background: "transparent",
  color: GREEN,
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
  padding: 0,
};
const iconGhost = {
  width: 32,
  height: 32,
  borderRadius: 9,
  border: "none",
  background: "transparent",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  flexShrink: 0,
};
const roomItem = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 10px 10px 12px",
  borderRadius: 14,
  border: "1px solid",
  cursor: "pointer",
};
const roomBadge = { width: 36, height: 36, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
const listBox = { maxHeight: 470, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2, paddingRight: 4 };
const rowItem = { display: "flex", alignItems: "center", gap: 10, padding: "8px 8px", borderBottom: "1px solid #f1f5f2" };
const rowName = { fontSize: 13.5, fontWeight: 700, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const rowSub = { fontSize: 11.5, color: "#6b7280", fontFamily: "monospace" };
const numBadge = {
  width: 28,
  height: 28,
  borderRadius: 9,
  background: "#f1f5f2",
  color: "#374151",
  fontWeight: 800,
  fontSize: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};
const classChip = {
  padding: "3px 10px",
  borderRadius: 99,
  background: "#dcfce7",
  color: GREEN,
  fontSize: 11.5,
  fontWeight: 700,
  whiteSpace: "nowrap",
  flexShrink: 0,
};