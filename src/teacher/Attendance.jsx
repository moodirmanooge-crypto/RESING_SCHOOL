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
  serverTimestamp,
} from "firebase/firestore";
import { Users, UserCheck, UserX, Clock, Lock, Play } from "lucide-react";

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

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export default function Attendance() {
  const [classes, setClasses] = useState([]);
  const [teacherClassEntries, setTeacherClassEntries] = useState([]);
  const [teacherRawData, setTeacherRawData] = useState(null); // Firestore Data
  const [selectedClass, setSelectedClass] = useState("");
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [classSubjects, setClassSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("");

  const [existingSessions, setExistingSessions] = useState([]);
  const [selectedSessionNumber, setSelectedSessionNumber] = useState(null);
  const [sessionSaved, setSessionSaved] = useState(false);

  const [activeHoliday, setActiveHoliday] = useState(null);
  const [checkingHoliday, setCheckingHoliday] = useState(true);

  // Status for validation of day schedule
  const [isDayAllowed, setIsDayAllowed] = useState(true);
  const [dayErrorMsg, setDayErrorMsg] = useState("");

  const teacherId = localStorage.getItem("teacherId") || "";
  const teacherName = localStorage.getItem("teacherName") || "Teacher";

  useEffect(() => {
    loadClasses();
    checkHoliday();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      loadSubjectsForClass(selectedClass);
    } else {
      setClassSubjects([]);
    }
    setSelectedSubject("");
  }, [selectedClass]);

  // Validate day schedule whenever class, subject, or date changes
  useEffect(() => {
    validateTeacherDaySchedule();
  }, [selectedClass, selectedSubject, date, teacherClassEntries]);

  useEffect(() => {
    if (selectedClass && isDayAllowed) {
      loadStudents(selectedClass, date, selectedSubject);
    } else {
      setStudents([]);
      setAttendance({});
      setExistingSessions([]);
      setSelectedSessionNumber(null);
      setSessionSaved(false);
    }
  }, [selectedClass, date, selectedSubject, isDayAllowed]);

  useEffect(() => {
    if (selectedClass && selectedSessionNumber !== null && isDayAllowed) {
      loadAttendanceForSession(
        selectedClass,
        date,
        selectedSubject,
        selectedSessionNumber
      );
    }
  }, [selectedSessionNumber]);

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
      setTeacherRawData(data); // Save complete teacher profile data

      const teacherClasses = Array.isArray(data.classes) ? data.classes : [];
      setTeacherClassEntries(teacherClasses);

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

  const loadSubjectsForClass = (className) => {
    const subjects = Array.from(
      new Set(
        teacherClassEntries
          .filter((c) => c.className === className)
          .map((c) => c.subject)
          .filter((subj) => subj && String(subj).trim() !== "")
      )
    ).sort();
    setClassSubjects(subjects);
  };

  // Check if current date's day of week matches teacher's assigned days
  const validateTeacherDaySchedule = () => {
    if (!selectedClass) {
      setIsDayAllowed(true);
      setDayErrorMsg("");
      return;
    }

    const selectedDateObj = new Date(`${date}T00:00:00`);
    const dayName = WEEKDAYS[selectedDateObj.getDay()];

    const matchedEntries = teacherClassEntries.filter((c) => {
      if (c.className !== selectedClass) return false;
      if (selectedSubject && c.subject !== selectedSubject) return false;
      return true;
    });

    if (matchedEntries.length === 0) {
      setIsDayAllowed(true);
      setDayErrorMsg("");
      return;
    }

    const isAssignedToday = matchedEntries.some((entry) => {
      if (Array.isArray(entry.days)) {
        return entry.days.includes(dayName);
      }
      return true;
    });

    if (!isAssignedToday) {
      setIsDayAllowed(false);
      setDayErrorMsg(
        `Maanta oo ah ${dayName} Kuma samaysna jadwalkaaga fasalka ${selectedClass}. Kaliya maalmaha laguugusoo qoray ayaad xaadirin kartaa.`
      );
    } else {
      setIsDayAllowed(true);
      setDayErrorMsg("");
    }
  };

  const loadStudents = async (className, dateStr, subject) => {
    try {
      setLoading(true);

      const snap = await getDocs(
        query(collection(db, "students"), where("className", "==", className))
      );
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((s) => !s.pendingDeletion);
      setStudents(list);

      const constraints = [
        where("className", "==", className),
        where("date", "==", dateStr),
        where("teacherId", "==", teacherId),
      ];
      if (subject) {
        constraints.push(where("subject", "==", subject));
      }

      const existingSnap = await getDocs(
        query(collection(db, "attendance"), ...constraints)
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

      const defaultSession =
        sessionsArr.length > 0 ? Math.max(...sessionsArr) : 1;
      setSelectedSessionNumber(defaultSession);

      applySessionData(list, existingSnap.docs, defaultSession);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  const applySessionData = (studentList, existingDocs, sessionNumber) => {
    const savedMap = {};
    let foundAny = false;
    existingDocs.forEach((d) => {
      const data = d.data();
      if (data.sessionNumber === sessionNumber) {
        savedMap[data.studentId] = data.status;
        foundAny = true;
      }
    });

    if (foundAny) {
      setAttendance(savedMap);
      setSessionSaved(true);
    } else {
      const initial = {};
      studentList.forEach((s) => {
        initial[s.id] = "Not Marked";
      });
      setAttendance(initial);
      setSessionSaved(false);
    }
  };

  const loadAttendanceForSession = async (
    className,
    dateStr,
    subject,
    sessionNumber
  ) => {
    try {
      const constraints = [
        where("className", "==", className),
        where("date", "==", dateStr),
        where("teacherId", "==", teacherId),
      ];
      if (subject) {
        constraints.push(where("subject", "==", subject));
      }
      const existingSnap = await getDocs(
        query(collection(db, "attendance"), ...constraints)
      );
      applySessionData(students, existingSnap.docs, sessionNumber);
    } catch (err) {
      console.log(err);
    }
  };

  const setStatus = (studentId, status) => {
    if (sessionSaved || activeHoliday || !isDayAllowed) return;
    setAttendance({ ...attendance, [studentId]: status });
  };

  const markAll = (status) => {
    if (sessionSaved || activeHoliday || !isDayAllowed) return;
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
          `${formatHolidayDate(activeHoliday.endDate)}.`
      );
      return;
    }

    if (!isDayAllowed) {
      alert(dayErrorMsg);
      return;
    }

    if (!selectedClass) {
      alert("Please select a class first");
      return;
    }

    if (classSubjects.length > 0 && !selectedSubject) {
      alert("Fadlan dooro maadada (subject) aad wax ka xaadirinayso.");
      return;
    }

    if (sessionSaved) {
      alert("Xiisaddan horey ayaa loo kaydiyay. Ma kaydin kartid mar labaad.");
      return;
    }

    try {
      setSaving(true);

      const sessionNumberToSave = selectedSessionNumber || 1;
      const timeLabel = new Date().toLocaleTimeString();

      for (const student of students) {
        const docId = selectedSubject
          ? `${selectedClass}_${selectedSubject}_${student.id}_${date}_s${sessionNumberToSave}`
          : `${selectedClass}_${student.id}_${date}_s${sessionNumberToSave}`;

        await setDoc(doc(db, "attendance", docId), {
          studentId: student.id,
          studentName: student.fullName,
          className: selectedClass,
          subject: selectedSubject || null,
          teacherId,
          date,
          sessionNumber: sessionNumberToSave,
          sessionTime: timeLabel,
          sessionTimestamp: serverTimestamp(),
          status: attendance[student.id] === "Present" ? "Present" : "Absent",
          updatedAt: serverTimestamp(),
        });
      }

      const updatedSessions = !existingSessions.includes(sessionNumberToSave)
        ? [...existingSessions, sessionNumberToSave].sort((a, b) => a - b)
        : existingSessions;

      setExistingSessions(updatedSessions);
      setSessionSaved(true);

      alert(
        `Xiisadda #${sessionNumberToSave} Waa La Kaydiyay! System-ku waa xiray xaadirintan.`
      );
    } catch (err) {
      console.log(err);
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  // CHECK IF SECOND SESSION IS SCHEDULED OR ALLOWED
  const startNextSession = () => {
    const selectedDateObj = new Date(`${date}T00:00:00`);
    const dayName = WEEKDAYS[selectedDateObj.getDay()];

    const nextSessionNum =
      existingSessions.length > 0 ? Math.max(...existingSessions) + 1 : 1;

    let hasNextSession = false;

    // 1. Firestore `daySessions` Check
    if (teacherRawData && teacherRawData.daySessions) {
      const dayData = teacherRawData.daySessions[dayName];
      if (
        dayData &&
        (Array.isArray(dayData) ? dayData.length >= nextSessionNum : dayData[nextSessionNum - 1] || dayData[nextSessionNum])
      ) {
        hasNextSession = true;
      }
    }

    // 2. Schedule Classes Entry Check (Count subjects/classes assigned for the day)
    if (!hasNextSession && teacherClassEntries.length > 0) {
      const todayClassesCount = teacherClassEntries.filter((c) => {
        if (c.className !== selectedClass) return false;
        if (Array.isArray(c.days)) return c.days.includes(dayName);
        return true;
      }).length;

      if (todayClassesCount >= nextSessionNum) {
        hasNextSession = true;
      }
    }

    // Hadii uusan xiisad labaad lahayn, alert sii
    if (!hasNextSession) {
      alert("Malihiid xiisad kale maanta.");
      return;
    }

    // Hadii uu leeyahay xiisad labaad, sii wada xaadirinta!
    setSelectedSessionNumber(nextSessionNum);
    const freshAttendance = {};
    students.forEach((s) => {
      freshAttendance[s.id] = "Not Marked";
    });
    setAttendance(freshAttendance);
    setSessionSaved(false);
  };

  const presentCount = students.filter((s) => attendance[s.id] === "Present").length;
  const absentCount = students.filter((s) => attendance[s.id] === "Absent").length;
  const totalCount = students.length;
  const presentPct = totalCount ? ((presentCount / totalCount) * 100).toFixed(2) : "0.00";
  const absentPct = totalCount ? ((absentCount / totalCount) * 100).toFixed(2) : "0.00";

  const filteredStudents = students.filter((s) =>
    (s.fullName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.studentId || s.id || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const locked =
    sessionSaved ||
    !!activeHoliday ||
    !isDayAllowed ||
    (classSubjects.length > 0 && !selectedSubject);

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
              {formatHolidayDate(activeHoliday.endDate)}.
            </div>
          )}

          {!activeHoliday && !isDayAllowed && (
            <div style={lockedBanner}>⚠️ {dayErrorMsg}</div>
          )}

          {!activeHoliday && isDayAllowed && sessionSaved && (
            <div style={{ ...lockedBanner, background: "rgba(245,158,11,0.12)", borderColor: "rgba(245,158,11,0.3)", color: "#FBBF24" }}>
              🔒 Xiisadda #{selectedSessionNumber} waa la kaydiyay, system-kuna waa xiray. Haddii aad leedahay xiisad kale, riix badhanka hoose si aad u furto Xiisadda Labaad.
            </div>
          )}

          {/* Cards */}
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

              {classSubjects.length > 0 && (
                <div>
                  <label style={label}>Subject</label>
                  <select
                    style={input}
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    disabled={!!activeHoliday}
                  >
                    <option value="">Dooro maadada...</option>
                    {classSubjects.map((subj) => (
                      <option key={subj} value={subj}>
                        {subj}
                      </option>
                    ))}
                  </select>
                </div>
              )}

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

              {selectedClass &&
                isDayAllowed &&
                (classSubjects.length === 0 || selectedSubject) && (
                  <div>
                    <label style={label}>Xiisadda (Session)</label>
                    <select
                      style={input}
                      value={selectedSessionNumber ?? ""}
                      onChange={(e) =>
                        setSelectedSessionNumber(Number(e.target.value))
                      }
                      disabled={!!activeHoliday}
                    >
                      {existingSessions.map((n) => (
                        <option key={n} value={n}>
                          Xiisadda #{n} (Kaydsan)
                        </option>
                      ))}
                      {!existingSessions.includes(selectedSessionNumber) && (
                        <option value={selectedSessionNumber}>
                          Xiisadda #{selectedSessionNumber} (Furan)
                        </option>
                      )}
                    </select>
                  </div>
                )}

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
            ) : !isDayAllowed ? (
              <p style={{ padding: 20, color: "#EF4444", fontWeight: "bold" }}>
                🚫 {dayErrorMsg}
              </p>
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

          {!activeHoliday && isDayAllowed && students.length > 0 && (
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 14, marginTop: 20 }}>
              {sessionSaved ? (
                <button
                  onClick={startNextSession}
                  style={{
                    ...btnPrimary,
                    background: "linear-gradient(90deg, #F59E0B, #D97706)",
                  }}
                >
                  <Play size={18} style={{ marginRight: 8, verticalAlign: "middle" }} />
                  Fur Xiisadda Labaad (#
                  {existingSessions.length > 0
                    ? Math.max(...existingSessions) + 1
                    : 1}
                  )
                </button>
              ) : (
                <button
                  onClick={saveAttendance}
                  disabled={saving || locked}
                  style={{
                    ...btnPrimary,
                    opacity: locked ? 0.6 : 1,
                    cursor: locked ? "not-allowed" : "pointer",
                  }}
                >
                  {saving ? "Saving..." : "💾 Save Attendance"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

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
  cursor: "pointer",
};