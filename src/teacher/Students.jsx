import { useEffect, useState } from "react";
import { db } from "../firebase/firebase";
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { GraduationCap, Search, X, CalendarCheck2, BookOpen } from "lucide-react";

import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import MobileBottomNav from "./MobileBottomNav";

function StudentsStyles() {
  return (
    <style>{`
      .st-layout { display: flex; min-height: 100vh; background: #05070D; }
      .st-content { flex: 1; display: flex; flex-direction: column; min-width: 0; }
      .st-body { padding: 0 20px 30px; }
      .st-filters-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
      }
      .st-main-row { display: flex; gap: 20px; align-items: flex-start; flex-wrap: wrap; }
      .st-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
      .st-table { width: 100%; border-collapse: collapse; min-width: 620px; }

      @media (max-width: 900px) {
        .st-body { padding: 0 14px 90px; }
        .st-panel { padding: 16px !important; border-radius: 16px !important; }
        .st-filters-grid { grid-template-columns: 1fr; gap: 12px; }
        .st-main-row { gap: 14px; }
      }
    `}</style>
  );
}

export default function Students() {
  const [classes, setClasses] = useState([]);
  const [teacherClassEntries, setTeacherClassEntries] = useState([]);
  const [classSubjects, setClassSubjects] = useState([]);
  
  const [allStudents, setAllStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [attendanceMap, setAttendanceMap] = useState({});

  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [searchText, setSearchText] = useState("");

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [loading, setLoading] = useState(true);

  const teacherId = localStorage.getItem("teacherId") || "";
  const teacherName = localStorage.getItem("teacherName") || "Teacher";

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      const subjects = Array.from(
        new Set(
          teacherClassEntries
            .filter((c) => c.className === selectedClass)
            .map((c) => c.subject)
            .filter((subj) => subj && String(subj).trim() !== "")
        )
      ).sort();
      setClassSubjects(subjects);
    } else {
      setClassSubjects([]);
    }
    setSelectedSubject("");
  }, [selectedClass, teacherClassEntries]);

  useEffect(() => {
    applyFiltersAndCalculateAttendance();
  }, [selectedClass, selectedSubject, searchText, allStudents]);

  const loadData = async () => {
    try {
      setLoading(true);

      if (!teacherId) {
        setClasses([]);
        setAllStudents([]);
        return;
      }

      const teacherSnap = await getDoc(doc(db, "teachers", teacherId));

      if (!teacherSnap.exists()) {
        setClasses([]);
        setAllStudents([]);
        return;
      }

      const data = teacherSnap.data();
      const teacherClasses = Array.isArray(data.classes) ? data.classes : [];
      setTeacherClassEntries(teacherClasses);

      const uniqueClassNames = Array.from(
        new Set(teacherClasses.map((c) => c.className).filter(Boolean))
      );

      const classList = uniqueClassNames.map((className) => ({
        id: className,
        className,
      }));
      setClasses(classList);

      // Default class selection
      if (uniqueClassNames.length > 0) {
        setSelectedClass(uniqueClassNames[0]);
      }

      // Load Students
      let students = [];
      if (uniqueClassNames.length > 0) {
        const studentsSnap = await getDocs(
          query(
            collection(db, "students"),
            where("className", "in", uniqueClassNames.slice(0, 10))
          )
        );
        students = studentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }
      setAllStudents(students);

      // Load Attendance Records
      await fetchAttendanceData(uniqueClassNames);
    } catch (err) {
      console.log("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendanceData = async (uniqueClassNames) => {
    if (uniqueClassNames.length === 0) return;

    try {
      const attSnap = await getDocs(
        query(
          collection(db, "attendance"),
          where("className", "in", uniqueClassNames.slice(0, 10))
        )
      );

      const perStudent = {};

      attSnap.docs.forEach((d) => {
        const rec = d.data();
        const sid = rec.studentId || rec.id;
        const subj = rec.subject || "";

        if (sid) {
          if (!perStudent[sid]) perStudent[sid] = { total: 0, present: 0, bySubject: {} };

          // Total overall
          perStudent[sid].total += 1;
          if (
            rec.status === "Present" ||
            rec.status === "present" ||
            rec.present === true
          ) {
            perStudent[sid].present += 1;
          }

          // Subject specific
          if (subj) {
            if (!perStudent[sid].bySubject[subj]) {
              perStudent[sid].bySubject[subj] = { total: 0, present: 0 };
            }
            perStudent[sid].bySubject[subj].total += 1;
            if (
              rec.status === "Present" ||
              rec.status === "present" ||
              rec.present === true
            ) {
              perStudent[sid].bySubject[subj].present += 1;
            }
          }
        }
      });

      setAttendanceMap(perStudent);
    } catch (err) {
      console.log("Error fetching attendance:", err);
    }
  };

  const applyFiltersAndCalculateAttendance = () => {
    let list = [...allStudents];

    if (selectedClass) {
      list = list.filter((s) => s.className === selectedClass);
    }

    if (searchText.trim() !== "") {
      const text = searchText.toLowerCase();
      list = list.filter(
        (s) =>
          (s.fullName || "").toLowerCase().includes(text) ||
          (s.studentId || s.id || "").toLowerCase().includes(text) ||
          (s.studentPhone || "").toLowerCase().includes(text)
      );
    }

    setFilteredStudents(list);
  };

  const getStudentAttData = (student) => {
    const sid = student.studentId || student.id;
    const att = attendanceMap[sid] || attendanceMap[student.id];

    if (!att) return { present: 0, total: 0, pct: 0 };

    if (selectedSubject && att.bySubject && att.bySubject[selectedSubject]) {
      const subjData = att.bySubject[selectedSubject];
      const pct = subjData.total > 0 ? Math.round((subjData.present / subjData.total) * 100) : 0;
      return { present: subjData.present, total: subjData.total, pct };
    }

    const pct = att.total > 0 ? Math.round((att.present / att.total) * 100) : 0;
    return { present: att.present, total: att.total, pct };
  };

  const attendanceColor = (pct) => {
    if (pct >= 85) return { bg: "rgba(34,197,94,.15)", fg: "#22C55E" };
    if (pct >= 65) return { bg: "rgba(59,130,246,.15)", fg: "#3B82F6" };
    if (pct >= 50) return { bg: "rgba(234,179,8,.15)", fg: "#EAB308" };
    return { bg: "rgba(239,68,68,.15)", fg: "#EF4444" };
  };

  return (
    <div className="st-layout">
      <StudentsStyles />
      <Sidebar teacherName={teacherName} />

      <div className="st-content">
        <Topbar teacherName={teacherName} />

        <div className="st-body">
          {/* Filters Panel */}
          <div className="st-panel" style={filterCard}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <div style={iconCircle}>
                <GraduationCap size={20} color="#8B5CF6" />
              </div>
              <h3 style={{ margin: 0, color: "#fff" }}>Ardayda & Xaadirinta</h3>
            </div>

            <div className="st-filters-grid">
              <div>
                <label style={label}>Fasalka (Class)</label>
                <select
                  style={input}
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                >
                  <option value="">Dhammaan Fasallada</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.className}>
                      {c.className}
                    </option>
                  ))}
                </select>
              </div>

              {classSubjects.length > 0 && (
                <div>
                  <label style={label}>Maadada (Subject)</label>
                  <select
                    style={input}
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                  >
                    <option value="">Dhammaan Maadadooyinka</option>
                    {classSubjects.map((subj) => (
                      <option key={subj} value={subj}>
                        {subj}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label style={label}>Raadi Arday</label>
                <div style={{ position: "relative" }}>
                  <Search
                    size={16}
                    color="#94A3B8"
                    style={{ position: "absolute", left: 12, top: 12 }}
                  />
                  <input
                    style={{ ...input, paddingLeft: 36 }}
                    placeholder="Magaca ama ID-ga..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Student List Table */}
          {loading ? (
            <div className="st-panel" style={tableCard}>
              <p style={{ padding: 20, color: "#94A3B8" }}>Loading students...</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="st-panel" style={tableCard}>
              <p style={{ padding: 20, color: "#94A3B8" }}>Somalida: Arday ma la helin.</p>
            </div>
          ) : (
            <div className="st-main-row">
              <div className="st-panel" style={{ ...tableCard, flex: 2, minWidth: 320 }}>
                <div className="st-table-wrap">
                  <table className="st-table">
                    <thead>
                      <tr>
                        <th style={th}>Photo</th>
                        <th style={th}>Name</th>
                        <th style={th}>Class</th>
                        <th style={th}>
                          Attendance % {selectedSubject ? `(${selectedSubject})` : ""}
                        </th>
                        <th style={th}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((s) => {
                        const att = getStudentAttData(s);
                        const ac = attendanceColor(att.pct);
                        return (
                          <tr key={s.id}>
                            <td style={td}>
                              {s.studentPhoto ? (
                                <img
                                  src={s.studentPhoto}
                                  alt={s.fullName || "Student"}
                                  style={avatarPhoto}
                                />
                              ) : (
                                <div style={avatar}>
                                  {(s.fullName || "?").charAt(0).toUpperCase()}
                                </div>
                              )}
                            </td>
                            <td style={td}>{s.fullName}</td>
                            <td style={td}>{s.className}</td>
                            <td style={td}>
                              {att.total > 0 ? (
                                <span
                                  style={{
                                    background: ac.bg,
                                    color: ac.fg,
                                    padding: "4px 12px",
                                    borderRadius: 20,
                                    fontWeight: 700,
                                    fontSize: 13,
                                  }}
                                >
                                  {att.pct}% ({att.present}/{att.total})
                                </span>
                              ) : (
                                <span style={{ color: "#94A3B8", fontSize: 13 }}>0% (0/0)</span>
                              )}
                            </td>
                            <td style={td}>
                              <button
                                style={btnSecondary}
                                onClick={() => setSelectedStudent(s)}
                              >
                                View Profile
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* View Profile Drawer */}
              {selectedStudent && (
                <div className="st-panel" style={profileCard}>
                  <button style={closeBtn} onClick={() => setSelectedStudent(null)}>
                    <X size={16} />
                  </button>

                  <div style={profilePhotoWrap}>
                    {selectedStudent.studentPhoto ? (
                      <img
                        src={selectedStudent.studentPhoto}
                        alt={selectedStudent.fullName}
                        style={profilePhoto}
                      />
                    ) : (
                      <div style={profilePlaceholder}>
                        {(selectedStudent.fullName || "?").charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <h3 style={{ textAlign: "center", marginBottom: 4, color: "#fff" }}>
                    {selectedStudent.fullName}
                  </h3>
                  <p style={{ textAlign: "center", color: "#94A3B8", marginTop: 0 }}>
                    {selectedStudent.className} | ID: {selectedStudent.studentId || selectedStudent.id}
                  </p>

                  {(() => {
                    const att = getStudentAttData(selectedStudent);
                    return (
                      <div style={attSummary}>
                        <CalendarCheck2 size={20} color="#8B5CF6" />
                        <div>
                          <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>
                            {att.pct}% Joogitaan
                          </div>
                          <div style={{ color: "#94A3B8", fontSize: 12 }}>
                            {att.present} / {att.total} Xiisadood oo xaadirin ah
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <MobileBottomNav />
    </div>
  );
}

const filterCard = {
  background: "#0B1120",
  border: "1px solid rgba(255,255,255,.06)",
  borderRadius: 20,
  padding: 20,
  marginBottom: 20,
};
const iconCircle = {
  width: 40,
  height: 40,
  borderRadius: "50%",
  background: "rgba(139,92,246,0.15)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};
const label = {
  display: "block",
  fontWeight: "bold",
  marginBottom: 6,
  fontSize: 13,
  color: "#94A3B8",
};
const input = {
  width: "100%",
  padding: "10px 12px",
  boxSizing: "border-box",
  border: "1px solid rgba(255,255,255,.1)",
  borderRadius: 10,
  background: "#111827",
  color: "#fff",
};
const tableCard = {
  background: "#0B1120",
  border: "1px solid rgba(255,255,255,.06)",
  borderRadius: 20,
  overflow: "hidden",
};
const th = {
  textAlign: "left",
  padding: "12px 20px",
  borderBottom: "1px solid rgba(255,255,255,.08)",
  color: "#94A3B8",
  fontSize: 13,
  whiteSpace: "nowrap",
};
const td = {
  padding: "12px 20px",
  borderBottom: "1px solid rgba(255,255,255,.05)",
  fontSize: 14,
  color: "#E5E7EB",
  whiteSpace: "nowrap",
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
  flexShrink: 0,
};
const avatarPhoto = {
  width: 32,
  height: 32,
  borderRadius: "50%",
  objectFit: "cover",
  flexShrink: 0,
  display: "block",
};
const btnSecondary = {
  background: "#111827",
  border: "1px solid rgba(255,255,255,.1)",
  borderRadius: 10,
  padding: "8px 16px",
  cursor: "pointer",
  color: "#fff",
  fontSize: 13,
};
const profileCard = {
  flex: 1,
  minWidth: 280,
  background: "#0B1120",
  border: "1px solid rgba(255,255,255,.06)",
  borderRadius: 20,
  padding: 24,
  position: "relative",
};
const closeBtn = {
  position: "absolute",
  top: 14,
  right: 14,
  background: "#111827",
  border: "1px solid rgba(255,255,255,.1)",
  borderRadius: 8,
  width: 28,
  height: 28,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#fff",
  cursor: "pointer",
};
const profilePhotoWrap = {
  display: "flex",
  justifyContent: "center",
  marginBottom: 12,
};
const profilePhoto = {
  width: 90,
  height: 90,
  borderRadius: "50%",
  objectFit: "cover",
};
const profilePlaceholder = {
  width: 90,
  height: 90,
  borderRadius: "50%",
  background: "linear-gradient(135deg,#6D5DF0,#8B5CF6)",
  color: "white",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 32,
  fontWeight: "bold",
};
const attSummary = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  background: "rgba(139,92,246,0.1)",
  border: "1px solid rgba(139,92,246,.25)",
  borderRadius: 14,
  padding: "10px 14px",
  marginTop: 14,
};