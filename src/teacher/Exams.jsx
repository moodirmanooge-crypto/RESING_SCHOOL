// src/teacher/Exams.jsx
import { useEffect, useState } from "react";
import { db, storage } from "../firebase/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  doc,
  getDoc,
  addDoc,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { FileEdit, FileText, Send } from "lucide-react";

import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import MobileBottomNav from "./MobileBottomNav";

// Nuucyada Exam-ka ee macallinku dooran karo
const examTypes = ["Monthly One", "Term", "Monthly Two", "Final"];

// PART-TIME classes run Thursday & Friday (same rule already used for
// timetablePartTime/attendancePartTime). Every other day is FULL-TIME.
// The exam's own Exam Date decides which type it belongs to — no extra
// picker needed.
const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
function isPartTimeDay(dayName) {
  return dayName === "Thursday" || dayName === "Friday";
}
function getDayName(dateStr) {
  if (!dateStr) return "";
  const dateObj = new Date(`${dateStr}T00:00:00`);
  return WEEKDAYS[dateObj.getDay()];
}

function ExamsStyles() {
  return (
    <style>{`
      .ex-layout { display: flex; min-height: 100vh; background: #05070D; }
      .ex-content { flex: 1; display: flex; flex-direction: column; min-width: 0; }
      .ex-body { padding: 0 20px 30px; }
      .ex-filters-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 16px;
      }
      .ex-history-row { display: flex; align-items: center; gap: 14px; }

      @media (max-width: 900px) {
        .ex-body { padding: 0 14px 90px; }
        .ex-panel { padding: 16px !important; border-radius: 16px !important; }
        .ex-filters-grid { grid-template-columns: 1fr 1fr; gap: 12px; }
        .ex-btn-primary { width: 100%; justify-content: center; }
        .ex-history-row { padding: 12px !important; gap: 10px !important; }
      }

      @media (max-width: 480px) {
        .ex-filters-grid { grid-template-columns: 1fr; }
        .ex-history-row { flex-wrap: wrap; }
      }
    `}</style>
  );
}

export default function Exams() {
  const [examDate, setExamDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  // Nuuca Exam-ka: Monthly One / Term / Monthly Two / Final
  const [examType, setExamType] = useState("");
  // Fayl-ka PDF-ga exam-ka ee macallinku doorto
  const [examFile, setExamFile] = useState(null);
  // Sawirka profile-ka macallinka - waxaa loo isticmaali doonaa fariinta Messages
  const [teacherPhoto, setTeacherPhoto] = useState("");

  // Class-yada macallinku wax ku dhigo, iyo doorashada class/subject
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]); // <-- subjects-ka waxaa laga soo saarayaa Firestore
  const [selectedClass, setSelectedClass] = useState("");
  const [subject, setSubject] = useState("");

  const [saving, setSaving] = useState(false);

  // Taariikhda dhammaan exam-yadii uu macalinku hore u diray
  const [examHistory, setExamHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const teacherId = localStorage.getItem("teacherId") || "";
  const teacherName = localStorage.getItem("teacherName") || "Teacher";

  useEffect(() => {
    loadTeacherPhoto();
    loadExamHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTeacherPhoto = async () => {
    try {
      if (!teacherId) return;
      const teacherSnap = await getDoc(doc(db, "teachers", teacherId));
      if (teacherSnap.exists()) {
        const data = teacherSnap.data();
        setTeacherPhoto(data.photoUrl || "");

        const teacherClasses = Array.isArray(data.classes) ? data.classes : [];

        // Class-yada macallinka
        const uniqueClassNames = Array.from(
          new Set(teacherClasses.map((c) => c.className).filter(Boolean))
        );
        setClasses(uniqueClassNames.map((className) => ({ id: className, className })));

        // Subjects-ka waxaa laga soo saarayaa isla classes array-ga (field: subject)
        const uniqueSubjects = Array.from(
          new Set(teacherClasses.map((c) => c.subject).filter(Boolean))
        );
        setSubjects(uniqueSubjects);
      }
    } catch (err) {
      console.log(err);
    }
  };

  // Soo qaad dhammaan exam-yada uu macalinkan kan soo diray, kuwa ugu
  // dambeeya marka hore
  const loadExamHistory = async () => {
    try {
      setLoadingHistory(true);
      const snap = await getDocs(
        query(
          collection(db, "messages"),
          where("senderId", "==", teacherId),
          where("type", "==", "exam")
        )
      );
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const aTime = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
          const bTime = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
          return bTime - aTime;
        });
      setExamHistory(list);
    } catch (err) {
      console.log(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  function formatDate(ts) {
    if (!ts) return "—";
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleString();
  }

  // Ku shub PDF-ga exam-ka Storage, kadibna hal fariin oo keliya
  // ugu dir Admin - nuuca, taariikhda iyo PDF-ka.
  const saveAndSendExam = async () => {
    if (!selectedClass || !subject) {
      alert("Fadlan dooro Class-ka iyo Subject-ka");
      return;
    }

    if (!examType) {
      alert("Fadlan dooro Nuuca Exam-ka");
      return;
    }

    if (!examFile) {
      alert("Dooro PDF-ga Exam-ka");
      return;
    }

    try {
      setSaving(true);

      const storageRef = ref(
        storage,
        `teacher-exams/${teacherName}/${Date.now()}_${examFile.name}`
      );
      await uploadBytes(storageRef, examFile);
      const pdfUrl = await getDownloadURL(storageRef);

      const partTime = isPartTimeDay(getDayName(examDate));

      await addDoc(collection(db, "messages"), {
        senderName: teacherName,
        senderRole: "Teacher",
        senderId: teacherId,
        senderPhoto: teacherPhoto,
        text: `Macallinka ${teacherName} wuxuu soo diray exam-ka (${examType}) - Fasalka ${selectedClass} (${subject}).`,
        type: "exam",
        examType,
        examDate,
        className: selectedClass,
        subject,
        studentType: partTime ? "Part Time" : "Full Time",
        fileUrl: pdfUrl,
        fileName: examFile.name,
        read: false,
        createdAt: serverTimestamp(),
      });

      alert("Exam-ka  si guul leh ayaa loogu diray maamulka.");

      setExamType("");
      setExamFile(null);
      setSelectedClass("");
      setSubject("");
      loadExamHistory();
    } catch (err) {
      console.log(err);
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ex-layout">
      <ExamsStyles />
      <Sidebar teacherName={teacherName} />

      <div className="ex-content">
        <Topbar teacherName={teacherName} />

        <div className="ex-body">
          {/* Create Exam */}
          <div className="ex-panel" style={filterCard}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <div style={iconCircle}>
                <FileEdit size={20} color="#8B5CF6" />
              </div>
              <h3 style={{ margin: 0, color: "#fff" }}>Create Exam</h3>
            </div>

            <div className="ex-filters-grid">
              <div>
                <label style={label}>Class</label>
                <select
                  style={input}
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
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
                <label style={label}>Subject</label>
                <select
                  style={input}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                >
                  <option value="">Select Subject</option>
                  {subjects.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={label}>Exam Type</label>
                <select
                  style={input}
                  value={examType}
                  onChange={(e) => setExamType(e.target.value)}
                >
                  <option value="">Select Exam Type</option>
                  {examTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={label}>Exam Date</label>
                <input
                  style={input}
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                />
              </div>

              <div>
                <label style={label}>Exam PDF</label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setExamFile(e.target.files[0])}
                  style={input}
                />
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <button
                onClick={saveAndSendExam}
                disabled={saving}
                className="ex-btn-primary"
                style={btnPrimary}
              >
                {saving ? (
                  "Sending..."
                ) : (
                  <>
                    <Send size={16} style={{ marginRight: 8 }} />
                    Send Exam
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Exam history - dhammaan PDF-yada iyo taariiqda la diray */}
          <div className="ex-panel" style={tableCard}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 20px 0" }}>
              <div style={iconCircle}>
                <FileText size={20} color="#22C55E" />
              </div>
              <h3 style={{ margin: 0, color: "#fff" }}>Exams-kii hore loo diray</h3>
            </div>

            {loadingHistory ? (
              <p style={{ padding: 20, color: "#94A3B8" }}>Loading...</p>
            ) : examHistory.length === 0 ? (
              <p style={{ padding: 20, color: "#94A3B8" }}>
                Weli exam lama dirin.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 20 }}>
                {examHistory.map((exam) => (
                  <a
                    key={exam.id}
                    href={exam.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="ex-history-row"
                    style={historyRow}
                  >
                    <div style={iconCircleSmall}>
                      <FileText size={18} color="#8B5CF6" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>
                        {exam.examType || "—"}
                      </div>
                      <div style={{ color: "#94A3B8", fontSize: 12.5, marginTop: 2 }}>
                        Fasalka {exam.className || "—"} • {exam.subject || "—"} &nbsp;•&nbsp;
                        Exam Date: {exam.examDate || "—"} &nbsp;•&nbsp; Sent:{" "}
                        {formatDate(exam.createdAt)}
                        {exam.studentType && <> &nbsp;•&nbsp; {exam.studentType}</>}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom tab bar — mobile only (hidden via CSS on desktop) */}
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
const iconCircleSmall = {
  width: 36,
  height: 36,
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
  marginBottom: 20,
  overflow: "hidden",
};
const btnPrimary = {
  background: "linear-gradient(90deg,#6D5DF0,#8B5CF6)",
  color: "white",
  border: "none",
  borderRadius: 10,
  padding: "14px 28px",
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: 15,
  display: "flex",
  alignItems: "center",
};
const historyRow = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  background: "#111827",
  border: "1px solid rgba(255,255,255,.06)",
  borderRadius: 14,
  padding: "12px 16px",
  textDecoration: "none",
  cursor: "pointer",
  minWidth: 0,
};