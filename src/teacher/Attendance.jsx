// src/teacher/Attendance.jsx
import { useEffect, useState } from "react";
import { db } from "../firebase/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  setDoc,
  doc,
  getDoc,
} from "firebase/firestore";
import { Users, UserCheck, UserX, Clock } from "lucide-react";

import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import MobileBottomNav from "./MobileBottomNav";
import { getActiveHolidayToday, formatHolidayDate } from "../utils/holidayCheck";

function AttendanceStyles() {
  return (
    <style>{`
      .att-layout { display: flex; min-height: 100vh; background: #05070D; }
      .att-content { flex: 1; display: flex; flex-direction: column; min-width: 0; }
      .att-body { padding: 0 20px 30px; }
      .att-cards-row {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 20px;
        margin-bottom: 24px;
      }
      .att-filters-row { display: flex; gap: 20px; flex-wrap: wrap; }
      .att-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
      .att-table { width: 100%; border-collapse: collapse; min-width: 560px; }

      @media (max-width: 900px) {
        .att-body { padding: 0 14px 90px; }
        .att-panel { padding: 16px !important; border-radius: 16px !important; }
        .att-cards-row { grid-template-columns: 1fr 1fr; gap: 12px; }
        .att-filters-row { gap: 12px; }
        .att-filters-row > div { min-width: 0 !important; flex: 1 1 45%; }
      }

      @media (max-width: 480px) {
        .att-cards-row { grid-template-columns: 1fr 1fr; }
        .att-filters-row > div { flex: 1 1 100%; }
      }
    `}</style>
  );
}

// Helper: turn a "YYYY-MM-DD" date string into the weekday name used in
// the `timetable` collection (e.g. "Monday", "Tuesday", ...).
function getWeekdayName(dateStr) {
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  // Parse as a local date (avoid timezone shifting the day back by one).
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return days[dt.getDay()];
}

export default function Attendance() {
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [existingSessions, setExistingSessions] = useState([]);
  const [sessionSaved, setSessionSaved] = useState(false);

  // Whether the selected class actually has a lesson scheduled today
  // (checked against the `timetable` collection, doc id `${className}__${weekday}`).
  const [isScheduledToday, setIsScheduledToday] = useState(true);
  const [checkingSchedule, setCheckingSchedule] = useState(false);

  // Whether today falls inside an active school holiday range. While a
  // holiday is active, teachers cannot take/save attendance at all,
  // regardless of the selected class or its timetable schedule.
  const [activeHoliday, setActiveHoliday] = useState(null);
  const [checkingHoliday, setCheckingHoliday] = useState(true);

  const teacherId = localStorage.getItem("teacherId") || "";
  const teacherName = localStorage.getItem("teacherName") || "Teacher";

  useEffect(() => {
    loadClasses();
    checkHoliday();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedClass) {
      checkScheduleThenLoadStudents(selectedClass, date);
    } else {
      setStudents([]);
      setAttendance({});
      setExistingSessions([]);
      setSessionSaved(false);
      setIsScheduledToday(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass, date]);

  const checkHoliday = async () => {
    try {
      setCheckingHoliday(true);
      const holiday = await getActiveHolidayToday();
      setActiveHoliday(holiday);
    } catch (err) {
      console.log(err);
    } finally {
      setCheckingHoliday(false);
    }
  };

  // ---- Kaliya fasallada macallinkan gaarkiisa ah ayaa la soo aqrinayaa ----
  // Waxaa laga soo aqriyaa document-ka teachers/{teacherId} ee macallinku
  // ku diiwaan gashan yahay, oo leh field-ka `classes` (array ah). Marnaba
  // lama scan gareeyo dhammaan collection-ka teachers, si aan macallin
  // kastaa u arag KALIYA fasallada uu isaga leeyahay — fasallada
  // macalimiinta kale ha soo bixin gabi ahaanba.
  const loadClasses = async () => {
    try {
      if (!teacherId) {
        setClasses([]);
        return;
      }

      const teacherSnap = await getDoc(doc(db, "teachers", teacherId));

      if (!teacherSnap.exists()) {
        setClasses([]);
        return;
      }

      const data = teacherSnap.data();
      const teacherClasses = Array.isArray(data.classes) ? data.classes : [];

      const uniqueClassNames = Array.from(
        new Set(
          teacherClasses
            .map((c) => c.className)
            .filter((cn) => cn && String(cn).trim() !== "")
        )
      ).sort();

      const uniqueClasses = uniqueClassNames.map((className) => ({
        id: className,
        className,
      }));

      setClasses(uniqueClasses);
    } catch (err) {
      console.log(err);
    }
  };

  // Checks the `timetable` collection for a document `${className}__${weekday}`
  // ONLY to decide whether the teacher is allowed to SAVE attendance today
  // (isScheduledToday controls the save-lock banner/button). The student
  // list itself is ALWAYS loaded once a class is selected — every student
  // registered in that class must show up (with photo, name, class), even
  // if the class has no lesson scheduled for today's weekday and even if
  // they have no attendance record yet for this date.
  const checkScheduleThenLoadStudents = async (className, dateStr) => {
    try {
      setCheckingSchedule(true);
      const weekday = getWeekdayName(dateStr);

      const timetableSnap = await getDocs(
        query(
          collection(db, "timetable"),
          where("className", "==", className),
          where("day", "==", weekday)
        )
      );

      const scheduledToday = !timetableSnap.empty;
      setIsScheduledToday(scheduledToday);

      // Always load the class roster, regardless of whether today has a
      // scheduled lesson. The lock (isScheduledToday) only disables the
      // Save button / mark buttons further down, it no longer hides students.
      await loadStudents(className, dateStr);
    } catch (err) {
      console.log(err);
    } finally {
      setCheckingSchedule(false);
    }
  };

  const loadStudents = async (className, dateStr) => {
    try {
      setLoading(true);
      setSessionSaved(false);

      const snap = await getDocs(
        query(collection(db, "students"), where("className", "==", className))
      );
      // Ka reeb ardayda la calaamadeeyay pendingDeletion — isla markiiba
      // ha ka baxeen liiska Attendance ee macallinka, xitaa haddii
      // backend-ku uusan weli si buuxda uga tirtirin Firestore.
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((s) => !s.pendingDeletion);
      setStudents(list);

      // Check Firestore itself (not local state) for any attendance already
      // saved today for this class + teacher. This is what makes the lock
      // survive a page refresh — sessionSaved was previously just local
      // React state, so reloading the page reset it to false and let the
      // teacher save a duplicate session for the same day.
      const existingSnap = await getDocs(
        query(
          collection(db, "attendance"),
          where("className", "==", className),
          where("date", "==", dateStr),
          where("teacherId", "==", teacherId)
        )
      );

      const sessionNumbers = new Set();
      existingSnap.docs.forEach((d) => {
        const data = d.data();
        if (typeof data.sessionNumber === "number") {
          sessionNumbers.add(data.sessionNumber);
        }
      });
      const sessionsArr = Array.from(sessionNumbers).sort((a, b) => a - b);
      setExistingSessions(sessionsArr);

      const alreadySavedToday = sessionsArr.length > 0;
      setSessionSaved(alreadySavedToday);

      if (alreadySavedToday) {
        // Show what was actually recorded instead of resetting to "Present".
        const latestSession = Math.max(...sessionsArr);
        const savedMap = {};
        existingSnap.docs.forEach((d) => {
          const data = d.data();
          if (data.sessionNumber === latestSession) {
            savedMap[data.studentId] = data.status;
          }
        });
        setAttendance(savedMap);
      } else {
        // No attendance saved yet for this date/class: show every student
        // with a neutral "Not Marked" status instead of defaulting to
        // "Present", so the teacher explicitly marks each one.
        const initial = {};
        list.forEach((s) => {
          initial[s.id] = "Not Marked";
        });
        setAttendance(initial);
      }
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  const setStatus = (studentId, status) => {
    if (sessionSaved || !isScheduledToday || activeHoliday) return;
    setAttendance({ ...attendance, [studentId]: status });
  };

  const markAll = (status) => {
    if (sessionSaved || !isScheduledToday || activeHoliday) return;
    const updated = {};
    students.forEach((s) => {
      updated[s.id] = status;
    });
    setAttendance(updated);
  };

  const saveAttendance = async () => {
    if (activeHoliday) {
      alert(
        `Waxa lagu jiraa xiliga fasaxa "${activeHoliday.name}" ilaa ` +
          `${formatHolidayDate(activeHoliday.endDate)}. Ma xaadirin kartid ilaa ` +
          `xiliga imaanshaha school-ku uu isku soo noqdo.`
      );
      return;
    }

    if (!selectedClass) {
      alert("Please select a class first");
      return;
    }

    if (!isScheduledToday) {
      alert("Xiisad malihid maanta.");
      return;
    }

    if (sessionSaved) {
      alert("Xiisaddan horey ayaa loo kaydiyay. Ma kaydin kartid mar labaad.");
      return;
    }

    try {
      setSaving(true);

      const nextSessionNumber =
        existingSessions.length > 0 ? Math.max(...existingSessions) + 1 : 1;

      const sessionStartTime = new Date();
      const timeLabel = sessionStartTime.toLocaleTimeString();

      for (const student of students) {
        const docId = `${selectedClass}_${student.id}_${date}_s${nextSessionNumber}`;

        await setDoc(doc(db, "attendance", docId), {
          studentId: student.id,
          studentName: student.fullName,
          className: selectedClass,
          teacherId,
          date,
          sessionNumber: nextSessionNumber,
          sessionTime: timeLabel,
          status: attendance[student.id] === "Present" ? "Present" : "Absent",
          updatedAt: new Date(),
        });
      }

      setExistingSessions([...existingSessions, nextSessionNumber]);
      setSessionSaved(true);

      alert(
        `Attendance saved successfully (Xiisadda #${nextSessionNumber} - ${timeLabel})`
      );
    } catch (err) {
      console.log(err);
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const presentCount = students.filter((s) => attendance[s.id] === "Present").length;
  const absentCount = students.filter((s) => attendance[s.id] === "Absent").length;
  const notMarkedCount = students.filter(
    (s) => !attendance[s.id] || attendance[s.id] === "Not Marked"
  ).length;
  const totalCount = students.length;
  const presentPct = totalCount ? ((presentCount / totalCount) * 100).toFixed(2) : "0.00";
  const absentPct = totalCount ? ((absentCount / totalCount) * 100).toFixed(2) : "0.00";

  const filteredStudents = students.filter((s) =>
    (s.fullName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.studentId || s.id || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const locked = sessionSaved || !isScheduledToday || !!activeHoliday;

  return (
    <div className="att-layout">
      <AttendanceStyles />
      <Sidebar teacherName={teacherName} />

      <div className="att-content">
        <Topbar teacherName={teacherName} />

        <div className="att-body">
          {!checkingHoliday && activeHoliday && (
            <div style={lockedBanner}>
              🚫 Waxa lagu jiraa xiliga fasaxa "{activeHoliday.name}" ilaa{" "}
              {formatHolidayDate(activeHoliday.endDate)} — ma xaadirin kartid
              ilaa xiliga imaanshaha school-ku uu isku soo noqdo.
            </div>
          )}

          {!activeHoliday && selectedClass && !checkingSchedule && !isScheduledToday && (
            <div style={lockedBanner}>
              🚫 Xiisad malihid maanta ({date}) fasalka {selectedClass}. Fadlan
              dooro maalinta jadwalka ku qoran ama fasal kale.
            </div>
          )}

          {!activeHoliday && sessionSaved && isScheduledToday && (
            <div style={lockedBanner}>
              🔒 Xaadirintii maalintan ({date}) waa la kaydiyay ee waa la
              xiray. Waxaad mar kale furan kartaa maalinta soo socota.
            </div>
          )}

          {/* Summary cards */}
          <div className="att-cards-row">
            <div className="att-panel" style={card}>
              <div style={{ ...iconCircle, background: "rgba(109,93,240,0.15)" }}>
                <Users size={20} color="#6D5DF0" />
              </div>
              <div>
                <div style={cardValue}>{totalCount}</div>
                <div style={cardLabel}>Total Students</div>
              </div>
            </div>

            <div className="att-panel" style={card}>
              <div style={{ ...iconCircle, background: "rgba(34,197,94,0.15)" }}>
                <UserCheck size={20} color="#22C55E" />
              </div>
              <div>
                <div style={cardValue}>{presentCount}</div>
                <div style={cardLabel}>Present ({presentPct}%)</div>
              </div>
            </div>

            <div className="att-panel" style={card}>
              <div style={{ ...iconCircle, background: "rgba(239,68,68,0.15)" }}>
                <UserX size={20} color="#EF4444" />
              </div>
              <div>
                <div style={cardValue}>{absentCount}</div>
                <div style={cardLabel}>Absent ({absentPct}%)</div>
              </div>
            </div>

            <div className="att-panel" style={card}>
              <div style={{ ...iconCircle, background: "rgba(23,162,184,0.15)" }}>
                <Clock size={20} color="#17A2B8" />
              </div>
              <div>
                <div style={cardValue}>{existingSessions.length}</div>
                <div style={cardLabel}>Xiisadaha Maanta</div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="att-panel" style={filterCard}>
            <div className="att-filters-row">
              <div>
                <label style={label}>Class</label>
                <select
                  style={input}
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  disabled={!!activeHoliday}
                >
                  <option value="">Select Class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.className}>
                      {c.className}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={label}>Date</label>
                <input
                  type="date"
                  style={input}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={!!activeHoliday}
                />
              </div>

              <div style={{ flex: 1, minWidth: 220 }}>
                <label style={label}>Search Student</label>
                <input
                  style={input}
                  placeholder="Search by name or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              <button
                style={{
                  ...btnAction,
                  background: "#22C55E",
                  opacity: locked ? 0.5 : 1,
                  cursor: locked ? "not-allowed" : "pointer",
                }}
                onClick={() => markAll("Present")}
                disabled={locked}
              >
                ✓ Mark All Present
              </button>
              <button
                style={{
                  ...btnAction,
                  background: "#EF4444",
                  opacity: locked ? 0.5 : 1,
                  cursor: locked ? "not-allowed" : "pointer",
                }}
                onClick={() => markAll("Absent")}
                disabled={locked}
              >
                ✕ Mark All Absent
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="att-panel" style={tableCard}>
            {checkingHoliday ? (
              <p style={{ padding: 20, color: "#94A3B8" }}>Checking holidays...</p>
            ) : activeHoliday ? (
              <p style={{ padding: 20, color: "#94A3B8" }}>
                Xiisad malihid — waxa lagu jiraa xiliga fasaxa.
              </p>
            ) : checkingSchedule ? (
              <p style={{ padding: 20, color: "#94A3B8" }}>Checking schedule...</p>
            ) : loading ? (
              <p style={{ padding: 20, color: "#94A3B8" }}>Loading students...</p>
            ) : !selectedClass ? (
              <p style={{ padding: 20, color: "#94A3B8" }}>
                Select a class to load students.
              </p>
            ) : students.length === 0 ? (
              <p style={{ padding: 20, color: "#94A3B8" }}>
                No students found in this class.
              </p>
            ) : (
              <div className="att-table-wrap">
                <table className="att-table">
                  <thead>
                    <tr>
                      <th style={th}>#</th>
                      <th style={th}>Student Name</th>
                      <th style={th}>Student ID</th>
                      <th style={th}>Status</th>
                      <th style={th}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((s, i) => (
                      <tr key={s.id}>
                        <td style={td}>{i + 1}</td>
                        <td style={{ ...td, display: "flex", alignItems: "center", gap: 10 }}>
                          <div
                            style={{
                              ...avatar,
                              background: s.studentPhoto
                                ? `url(${s.studentPhoto}) center/cover`
                                : "linear-gradient(135deg,#6D5DF0,#8B5CF6)",
                            }}
                          >
                            {!s.studentPhoto &&
                              (s.fullName || "?").charAt(0).toUpperCase()}
                          </div>
                          {s.fullName}
                        </td>
                        <td style={td}>
                          <span style={idBadge}>{s.studentId || s.id}</span>
                        </td>
                        <td style={td}>
                          <span
                            style={{
                              ...statusBadge,
                              background:
                                attendance[s.id] === "Present"
                                  ? "rgba(34,197,94,0.15)"
                                  : attendance[s.id] === "Absent"
                                  ? "rgba(239,68,68,0.15)"
                                  : "rgba(148,163,184,0.15)",
                              color:
                                attendance[s.id] === "Present"
                                  ? "#22C55E"
                                  : attendance[s.id] === "Absent"
                                  ? "#EF4444"
                                  : "#94A3B8",
                            }}
                          >
                            ● {attendance[s.id] || "Not Marked"}
                          </span>
                        </td>
                        <td style={td}>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              onClick={() => setStatus(s.id, "Present")}
                              disabled={locked}
                              title="Present"
                              style={{
                                ...circleBtn,
                                background:
                                  attendance[s.id] === "Present" ? "#22C55E" : "#1F2937",
                                color: attendance[s.id] === "Present" ? "white" : "#94A3B8",
                                cursor: locked ? "not-allowed" : "pointer",
                                opacity: locked ? 0.6 : 1,
                              }}
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => setStatus(s.id, "Absent")}
                              disabled={locked}
                              title="Absent"
                              style={{
                                ...circleBtn,
                                background:
                                  attendance[s.id] === "Absent" ? "#EF4444" : "#1F2937",
                                color: attendance[s.id] === "Absent" ? "white" : "#94A3B8",
                                cursor: locked ? "not-allowed" : "pointer",
                                opacity: locked ? 0.6 : 1,
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {!activeHoliday && isScheduledToday && students.length > 0 && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <button
                onClick={saveAttendance}
                disabled={saving || locked}
                style={{
                  ...btnPrimary,
                  opacity: locked ? 0.6 : 1,
                  cursor: locked ? "not-allowed" : "pointer",
                }}
              >
                {saving
                  ? "Saving..."
                  : sessionSaved
                  ? "✅ Xiisaddan waa la Kaydiyay"
                  : "💾 Save Attendance"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom tab bar — mobile only (hidden via CSS on desktop) */}
      <MobileBottomNav />
    </div>
  );
}

const lockedBanner = {
  background: "rgba(239,68,68,0.12)",
  border: "1px solid rgba(239,68,68,0.3)",
  color: "#FCA5A5",
  padding: "12px 16px",
  borderRadius: 12,
  marginBottom: 20,
  fontSize: 14,
  fontWeight: "bold",
};
const card = {
  background: "#0B1120",
  border: "1px solid rgba(255,255,255,.06)",
  borderRadius: 20,
  padding: 20,
  display: "flex",
  alignItems: "center",
  gap: 16,
};
const iconCircle = {
  width: 48,
  height: 48,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};
const cardValue = {
  fontSize: 26,
  fontWeight: "bold",
  color: "#fff",
};
const cardLabel = {
  color: "#94A3B8",
  fontSize: 13,
};
const filterCard = {
  background: "#0B1120",
  border: "1px solid rgba(255,255,255,.06)",
  borderRadius: 20,
  padding: 20,
  marginBottom: 20,
};
const label = {
  display: "block",
  fontWeight: "bold",
  marginBottom: 6,
  fontSize: 13,
  color: "#94A3B8",
};
const input = {
  padding: "10px 12px",
  border: "1px solid rgba(255,255,255,.1)",
  borderRadius: 10,
  minWidth: 200,
  width: "100%",
  boxSizing: "border-box",
  background: "#111827",
  color: "#fff",
};
const btnAction = {
  color: "white",
  border: "none",
  borderRadius: 10,
  padding: "10px 18px",
  fontWeight: "bold",
  fontSize: 14,
};
const tableCard = {
  background: "#0B1120",
  border: "1px solid rgba(255,255,255,.06)",
  borderRadius: 20,
  overflow: "hidden",
};
const th = {
  textAlign: "left",
  padding: "14px 16px",
  borderBottom: "1px solid rgba(255,255,255,.08)",
  color: "#94A3B8",
  fontSize: 13,
};
const td = {
  padding: "14px 16px",
  borderBottom: "1px solid rgba(255,255,255,.05)",
  fontSize: 14,
  color: "#E5E7EB",
};
const avatar = {
  width: 32,
  height: 32,
  borderRadius: "50%",
  background: "linear-gradient(135deg,#6D5DF0,#8B5CF6)",
  color: "white",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: "bold",
  fontSize: 13,
};
const idBadge = {
  background: "rgba(109,93,240,0.15)",
  color: "#8B5CF6",
  padding: "4px 10px",
  borderRadius: 6,
  fontSize: 13,
  fontWeight: "bold",
};
const statusBadge = {
  padding: "6px 12px",
  borderRadius: 20,
  fontSize: 13,
  fontWeight: "bold",
};
const circleBtn = {
  width: 32,
  height: 32,
  borderRadius: "50%",
  border: "none",
  fontWeight: "bold",
};
const btnPrimary = {
  background: "linear-gradient(90deg,#6D5DF0,#8B5CF6)",
  color: "white",
  border: "none",
  borderRadius: 10,
  padding: "14px 28px",
  fontWeight: "bold",
  fontSize: 15,
};