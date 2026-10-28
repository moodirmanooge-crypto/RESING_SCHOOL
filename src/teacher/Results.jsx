// src/teacher/Results.jsx
import { useEffect, useState } from "react";
import { db, storage } from "../firebase/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  setDoc,
  addDoc,
  doc,
  getDoc,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import jsPDF from "jspdf";
import {
  BarChart3,
  Printer,
  Send,
  Lock,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";

import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import MobileBottomNav from "./MobileBottomNav";
import {
  examTypeKeyOf,
  norm,
  permissionId,
  submissionStatus,
  formatDT,
} from "../utils/resultsSubmission";

function ResultsStyles() {
  return (
    <style>{`
      .res-layout { display: flex; min-height: 100vh; background: #05070D; }
      .res-content { flex: 1; display: flex; flex-direction: column; min-width: 0; }
      .res-body { padding: 0 20px 30px; }
      .res-filters-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 16px;
      }
      .res-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
      .res-table { width: 100%; border-collapse: collapse; margin-top: 12px; min-width: 480px; }

      @media (max-width: 900px) {
        .res-body { padding: 0 14px 90px; }
        .res-panel { padding: 16px !important; border-radius: 16px !important; }
        .res-filters-grid { grid-template-columns: 1fr 1fr; gap: 12px; }
        .res-filters-grid button { width: 100%; justify-content: center; }
      }

      @media (max-width: 480px) {
        .res-filters-grid { grid-template-columns: 1fr; }
      }
    `}</style>
  );
}

// PART-TIME classes run Thursday & Friday (same rule already used for
// timetablePartTime/attendancePartTime/Exams.jsx).
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
// ---- Marks-ka imtixaanka (examMarksConfig) ----
// Waa isla qaabka ExamTimetable.jsx (admin).
function marksConfigIdFor(className, examType) {
  return `${String(className).toUpperCase()}__${examTypeKeyOf(examType)}`;
}

function normalizeTypes(employmentType) {
  if (Array.isArray(employmentType)) return employmentType;
  if (typeof employmentType === "string" && employmentType) return [employmentType];
  return [];
}

// Nooca macalinka ayaa ka horreeya (eeg Exams.jsx).
function isPartTimeExam(exam, employmentTypes = []) {
  const ft = employmentTypes.includes("Full Time");
  const pt = employmentTypes.includes("Part Time");
  if (ft && !pt) return false;
  if (pt && !ft) return true;
  if (!exam) return false;
  if (exam.studentType) return exam.studentType === "Part Time";
  return isPartTimeDay(getDayName(exam.examDate));
}

const TONES = {
  success: { bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.35)", color: "#4ADE80", Icon: CheckCircle2 },
  info: { bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.4)", color: "#93C5FD", Icon: ShieldCheck },
  warn: { bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.35)", color: "#FBBF24", Icon: Clock },
  danger: { bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.4)", color: "#F87171", Icon: AlertTriangle },
};

export default function Results() {
  const [classes, setClasses] = useState([]);
  const [exams, setExams] = useState([]);

  const [selectedClass, setSelectedClass] = useState("");
  const [selectedExam, setSelectedExam] = useState("");

  const [students, setStudents] = useState([]);
  const [marks, setMarks] = useState({});

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [teacherPhoto, setTeacherPhoto] = useState("");
  const [employmentTypes, setEmploymentTypes] = useState([]);
  const [maxMarks, setMaxMarks] = useState(null);
  const [maxSource, setMaxSource] = useState("");
  const [maxInput, setMaxInput] = useState("");
  const [savingMax, setSavingMax] = useState(false);

  // Waqtiga gudbinta (maamulka) + fasaxa macalinkan
  const [submitWin, setSubmitWin] = useState(null);
  const [permission, setPermission] = useState(null);
  const [now, setNow] = useState(() => new Date());

  const teacherId = localStorage.getItem("teacherId") || "";
  const teacherName = localStorage.getItem("teacherName") || "Teacher";

  useEffect(() => {
    loadClasses();
    loadTeacherPhoto();
    // Saacadda ha socoto si xaaladdu isku beddesho marka waqtigu furmo/xirmo
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedClass) {
      loadExamsForClass(selectedClass);
    } else {
      setExams([]);
    }
    setSelectedExam("");
    setStudents([]);
    setMarks({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass]);

  useEffect(() => {
    if (selectedClass && selectedExam) {
      loadStudentsAndResults(selectedClass, selectedExam);
    } else {
      setStudents([]);
      setMarks({});
      setMaxMarks(null);
      setMaxSource("");
      setMaxInput("");
      setSubmitWin(null);
      setPermission(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedExam, employmentTypes]);

  const loadTeacherPhoto = async () => {
    try {
      if (!teacherId) return;
      const teacherSnap = await getDoc(doc(db, "teachers", teacherId));
      if (teacherSnap.exists()) {
        const data = teacherSnap.data();
        setTeacherPhoto(data.photoUrl || data.teacherPhoto || "");
      }
    } catch (err) {
      console.log(err);
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
      setEmploymentTypes(normalizeTypes(data.employmentType));

      const teacherClasses = Array.isArray(data.classes) ? data.classes : [];
      const uniqueClassNames = Array.from(
        new Set(teacherClasses.map((c) => c.className).filter(Boolean))
      );
      setClasses(uniqueClassNames.map((className) => ({ id: className, className })));
    } catch (err) {
      console.log(err);
    }
  };

  const loadExamsForClass = async (className) => {
    try {
      const snap = await getDocs(
        query(
          collection(db, "messages"),
          where("senderId", "==", teacherId),
          where("type", "==", "exam"),
          where("className", "==", className)
        )
      );
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const aTime = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
          const bTime = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
          return bTime - aTime;
        });
      setExams(list);
    } catch (err) {
      console.log(err);
    }
  };

  // Soo qaad waqtiga gudbinta imtixaankan iyo fasaxa macalinkan
  const fetchSubmissionContext = async (examObj, className) => {
    if (!examObj) return { win: null, perm: null, key: "" };
    const key = examTypeKeyOf(examObj.examType);
    const subj = (examObj.subject || "").trim() || "General";
    const [wSnap, pSnap] = await Promise.all([
      getDoc(doc(db, "resultsWindow", key)),
      getDoc(doc(db, "resultsPermissions", permissionId(key, teacherId, className, subj))),
    ]);
    return {
      key,
      win: wSnap.exists() ? wSnap.data() : null,
      perm: pSnap.exists() ? { id: pSnap.id, ...pSnap.data() } : null,
    };
  };

  const loadStudentsAndResults = async (className, examId) => {
    try {
      setLoading(true);

      const examObj = exams.find((e) => e.id === examId) || null;
      const partTime = isPartTimeExam(examObj, employmentTypes);
      const studentCollectionName = partTime ? "partTimeStudents" : "students";
      const resultsCollectionName = partTime ? "resultsPartTime" : "results";

      const [studentsSnap, resultsSnap, ctx] = await Promise.all([
        getDocs(query(collection(db, studentCollectionName), where("className", "==", className))),
        getDocs(query(collection(db, resultsCollectionName), where("examId", "==", examId))),
        fetchSubmissionContext(examObj, className),
      ]);

      const studentList = studentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setStudents(studentList);

      const existing = {};
      resultsSnap.docs.forEach((d) => {
        const r = d.data();
        existing[r.studentId] = r.marks;
      });
      const initial = {};
      studentList.forEach((s) => {
        initial[s.id] = existing[s.id] !== undefined ? String(existing[s.id]) : "";
      });
      setMarks(initial);

      setSubmitWin(ctx.win);
      setPermission(ctx.perm);

      await loadMaxConfig(examObj, className);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMaxConfig = async (examObj, className) => {
    if (!examObj) return null;
    const id = marksConfigIdFor(className, examObj.examType);
    const snap = await getDoc(doc(db, "examMarksConfig", id));
    return snap.exists() ? { id, ...snap.data() } : { id, maxMarks: null };
  };

  const loadMaxConfig = async (examObj, className) => {
    try {
      const cfg = await fetchMaxConfig(examObj, className);
      if (cfg && Number(cfg.maxMarks) > 0) {
        setMaxMarks(Number(cfg.maxMarks));
        setMaxSource(cfg.source || "");
      } else {
        setMaxMarks(null);
        setMaxSource("");
      }
      setMaxInput("");
    } catch (err) {
      console.log(err);
    }
  };

  const saveMaxMarks = async () => {
    const n = Number(maxInput);
    if (!(n > 0)) {
      alert("Fadlan geli tiro ka weyn 0 (tusaale: 50 ama 100).");
      return;
    }
    try {
      setSavingMax(true);
      const exam = currentExam || {};
      const cfg = await fetchMaxConfig(exam, selectedClass);
      if (cfg && Number(cfg.maxMarks) > 0) {
        setMaxMarks(Number(cfg.maxMarks));
        setMaxSource(cfg.source || "");
        alert(`Imtixaankan hore ayaa loo dhigay ${cfg.maxMarks} marks. Isla kaas ayaa la isticmaalayaa.`);
        return;
      }
      await setDoc(doc(db, "examMarksConfig", cfg.id), {
        className: selectedClass,
        examType: examTypeKeyOf(exam.examType),
        maxMarks: n,
        source: "teacher",
        setByTeacherId: teacherId,
        setByTeacherName: teacherName,
        updatedAt: new Date(),
      });
      setMaxMarks(n);
      setMaxSource("teacher");
    } catch (err) {
      console.log(err);
      alert(err.message);
    } finally {
      setSavingMax(false);
    }
  };

  // Marks-ka: 0 ilaa maxMarks oo keliya. Wax ka badan lama qori karo.
  const setMark = (studentId, raw) => {
    const v = String(raw).replace(",", ".").trim();
    if (v === "") {
      setMarks((prev) => ({ ...prev, [studentId]: "" }));
      return;
    }
    if (!/^\d+(\.\d{0,2})?$/.test(v)) return; // kaliya tiro (0, 1, 2 ... ama 7.5)
    if (maxMarks && Number(v) > maxMarks) return; // kama badan karo xadka maamulka
    setMarks((prev) => ({ ...prev, [studentId]: v }));
  };

  const currentExam = exams.find((e) => e.id === selectedExam);
  const alreadySubmitted = currentExam?.resultsSent === true;
  const status = selectedExam
    ? submissionStatus({ win: submitWin, permission, submitted: alreadySubmitted, now })
    : null;
  const canEdit = Boolean(status?.canEdit);

  const getGrade = (m, max) => {
    const pct = (m / max) * 100;
    if (pct >= 90) return "A+";
    if (pct >= 80) return "A";
    if (pct >= 70) return "B";
    if (pct >= 60) return "C";
    if (pct >= 50) return "D";
    return "F";
  };

  const buildSummaryPdf = (studentsWithMarks, exam) => {
    const ranked = [...studentsWithMarks].sort((a, b) => b.marks - a.marks);

    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();

    pdf.setFillColor(11, 17, 32);
    pdf.rect(0, 0, pageWidth, 90, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(20);
    pdf.text("RiSING ERP - Exam Results", 40, 40);
    pdf.setFontSize(11);
    pdf.setTextColor(200, 200, 210);
    pdf.text(
      `${exam.examType || exam.examName || ""}  -  Fasalka ${selectedClass}  -  ${exam.subject || ""}`,
      40,
      60
    );

    pdf.setTextColor(20, 20, 30);
    pdf.setFontSize(11);
    let y = 120;
    pdf.setFont(undefined, "bold");
    pdf.text("NO", 40, y);
    pdf.text("Student Name", 80, y);
    pdf.text("Student ID", 300, y);
    pdf.text("Marks", 400, y);
    pdf.text("Grade", 460, y);
    y += 10;
    pdf.setDrawColor(200, 200, 200);
    pdf.line(40, y, pageWidth - 40, y);
    y += 20;

    pdf.setFont(undefined, "normal");
    ranked.forEach((s, i) => {
      if (y > 780) {
        pdf.addPage();
        y = 60;
      }
      const grade = getGrade(s.marks, Number(s.maxMarks) || 100);
      const position = i + 1;
      pdf.setFont(undefined, position === 1 ? "bold" : "normal");
      pdf.text(String(position), 40, y);
      pdf.text(String(s.studentName || "-"), 80, y);
      pdf.text(String(s.studentId || "-"), 300, y);
      pdf.text(`${s.marks} / ${s.maxMarks}`, 400, y);
      pdf.text(grade, 460, y);
      y += 22;
    });

    pdf.setFont(undefined, "normal");
    y += 10;
    pdf.setDrawColor(200, 200, 200);
    pdf.line(40, y, pageWidth - 40, y);
    y += 30;
    pdf.setFontSize(10);
    pdf.setTextColor(120, 120, 130);
    pdf.text(`Teacher: ${teacherName}`, 40, y);
    pdf.text(`Exam Date: ${exam.examDate || "-"}`, 250, y);

    return pdf;
  };

  const saveAndSendResults = async () => {
    if (!selectedClass || !selectedExam) {
      alert("Fadlan dooro Class-ka iyo Exam-ka");
      return;
    }

    const studentsWithMarks = students.filter(
      (s) => marks[s.id] !== "" && marks[s.id] !== undefined
    );
    if (studentsWithMarks.length === 0) {
      alert("Fadlan geli buundooyinka ugu yaraan hal arday");
      return;
    }

    try {
      setSaving(true);
      const exam = currentExam || {};

      // 1) Dib u hubi waqtiga + fasaxa (server-ka ka soo qaad, ha ku kalsoonaan state-ka)
      const ctx = await fetchSubmissionContext(exam, selectedClass);
      setSubmitWin(ctx.win);
      setPermission(ctx.perm);
      const st = submissionStatus({
        win: ctx.win,
        permission: ctx.perm,
        submitted: exam.resultsSent === true,
        now: new Date(),
      });
      if (!st.canEdit) {
        alert(st.text);
        return;
      }

      // 2) Xadka marks-ka
      const cfg = await fetchMaxConfig(exam, selectedClass);
      const max = Number(cfg?.maxMarks) || 0;
      if (!(max > 0)) {
        alert("Marka hore dhig imisa lagu saxayo imtixaankan (Total Marks).");
        return;
      }
      setMaxMarks(max);
      setMaxSource(cfg.source || "");
      const invalid = studentsWithMarks.filter((s) => {
        const n = Number(marks[s.id]);
        return isNaN(n) || n > max || n < 0;
      });
      if (invalid.length > 0) {
        alert(
          `Marks-ku waa inuu u dhexeeyaa 0 iyo ${max}. Hubi: ${invalid
            .map((s) => s.fullName)
            .join(", ")}`
        );
        return;
      }

      const subjectName = (exam.subject || "").trim() || "General";
      const examTypeName = exam.examType || "";
      const typeKey = examTypeKeyOf(examTypeName);
      const partTime = isPartTimeExam(exam, employmentTypes);
      const resultsCollectionName = partTime ? "resultsPartTime" : "results";
      const studentTypeLabel = partTime ? "Part Time" : "Full Time";
      const isUpdate = st.code === "update";
      const isLate = st.code === "late";

      const resultsForPdf = [];

      // Isla doc-ga ayaa la cusbooneysiiyaa (examId_studentId), sidaas darteed
      // update-ku si toos ah ayuu uga muuqdaa Academics iyo Results by Class.
      for (const student of studentsWithMarks) {
        const scoreValue = Number(marks[student.id]);
        resultsForPdf.push({
          studentId: student.studentId || student.id,
          studentName: student.fullName,
          marks: scoreValue,
          maxMarks: max,
        });

        // eslint-disable-next-line no-await-in-loop
        await setDoc(doc(db, resultsCollectionName, `${selectedExam}_${student.id}`), {
          examId: selectedExam,
          examName: exam.examName || "",
          examType: examTypeName,
          examTypeKey: typeKey,
          subject: subjectName,
          className: selectedClass,
          studentId: student.id,
          studentName: student.fullName,
          studentType: studentTypeLabel,
          marks: scoreValue,
          maxMarks: max,
          teacherId,
          teacherName,
          updatedAt: new Date(),
        });
      }

      const pdf = buildSummaryPdf(resultsForPdf, {
        ...exam,
        subject: subjectName,
        examType: examTypeName,
      });
      const pdfBlob = pdf.output("blob");

      const timestamp = Date.now();
      const fileName = `${timestamp}_${selectedClass}_${examTypeName || exam.examName || "exam"}_results.pdf`;

      const teacherStorageRef = ref(storage, `teacher-results/${teacherName}/${fileName}`);
      await uploadBytes(teacherStorageRef, pdfBlob);
      const pdfUrl = await getDownloadURL(teacherStorageRef);

      const adminStorageRef = ref(storage, `admin-results/${selectedClass}/${fileName}`);
      await uploadBytes(adminStorageRef, pdfBlob);
      const adminPdfUrl = await getDownloadURL(adminStorageRef);

      await addDoc(collection(db, "messages"), {
        senderName: teacherName,
        senderRole: "Teacher",
        senderId: teacherId,
        senderPhoto: teacherPhoto,
        text: isUpdate
          ? `Macallinka ${teacherName} wuxuu cusbooneysiiyay (update) natiijada exam-ka (${examTypeName || exam.examName}) - Fasalka ${selectedClass} (${subjectName}).`
          : `Macallinka ${teacherName} wuxuu dhammaystiray sax-gareynta exam-ka (${examTypeName || exam.examName}) - Fasalka ${selectedClass} (${subjectName})${isLate ? " — gudbin daahday (fasax maamul)" : ""}.`,
        type: "results",
        examId: selectedExam,
        examName: exam.examName || "",
        examType: examTypeName,
        examDate: exam.examDate || "",
        className: selectedClass,
        subject: subjectName,
        studentType: studentTypeLabel,
        isLatestExam: true,
        isUpdate,
        isLate,
        fileUrl: pdfUrl,
        adminFileUrl: adminPdfUrl,
        fileName: `${examTypeName || exam.examName || "exam"}_results.pdf`,
        studentCount: resultsForPdf.length,
        read: false,
        createdAt: serverTimestamp(),
      });

      // Index-ka maamulka: cidda gudbisay, goorta, imisa jeer
      const idxRef = doc(db, "adminResultsIndex", `${selectedClass}_${selectedExam}`);
      const idxSnap = await getDoc(idxRef);
      const prevIdx = idxSnap.exists() ? idxSnap.data() : {};
      await setDoc(
        idxRef,
        {
          className: selectedClass,
          classKey: String(selectedClass).toUpperCase(),
          examId: selectedExam,
          examName: exam.examName || "",
          examType: examTypeName,
          examTypeKey: typeKey,
          subject: subjectName,
          subjectKey: norm(subjectName),
          studentType: studentTypeLabel,
          teacherId,
          teacherName,
          fileUrl: adminPdfUrl,
          studentCount: resultsForPdf.length,
          late: Boolean(prevIdx.late) || isLate,
          wasUpdated: Boolean(prevIdx.wasUpdated) || isUpdate,
          submitCount: increment(1),
          lastSubmittedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          ...(prevIdx.firstSubmittedAt ? {} : { firstSubmittedAt: serverTimestamp() }),
        },
        { merge: true }
      );

      // Xir imtixaanka
      await setDoc(
        doc(db, "messages", selectedExam),
        { resultsSent: true, resultsSentAt: serverTimestamp(), studentType: studentTypeLabel },
        { merge: true }
      );

      // Fasaxa waa la isticmaalay -> mar kale ayuu xirmayaa
      if (ctx.perm && (isUpdate || isLate)) {
        await setDoc(
          doc(db, "resultsPermissions", ctx.perm.id),
          { used: true, usedAt: new Date() },
          { merge: true }
        );
        setPermission({ ...ctx.perm, used: true });
      }

      setExams((prev) =>
        prev.map((e) =>
          e.id === selectedExam ? { ...e, resultsSent: true, studentType: studentTypeLabel } : e
        )
      );

      alert(
        isUpdate
          ? "Natiijada waa la cusbooneysiiyay. Meel kasta oo laga eego waa la beddelay."
          : "Natiijooyinka waa la kaydiyay oo warqad PDF ah ayaa Admin loo diray."
      );
    } catch (err) {
      console.log(err);
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const printResults = () => {
    window.print();
  };

  const tone = status ? TONES[status.tone] : null;

  return (
    <div className="res-layout">
      <ResultsStyles />
      <Sidebar teacherName={teacherName} />

      <div className="res-content">
        <Topbar teacherName={teacherName} />

        <div className="res-body">
          {/* Filters */}
          <div className="res-panel" style={filterCard}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <div style={iconCircle}>
                <BarChart3 size={20} color="#8B5CF6" />
              </div>
              <h3 style={{ margin: 0, color: "#fff" }}>Results</h3>
            </div>

            <div className="res-filters-grid">
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
                {classes.length === 0 && (
                  <p style={{ color: "#F59E0B", fontSize: 12, marginTop: 6 }}>
                    Ma jiraan classes la helay teacher-kan.
                  </p>
                )}
              </div>

              <div>
                <label style={label}>Exam</label>
                <select
                  style={input}
                  value={selectedExam}
                  onChange={(e) => setSelectedExam(e.target.value)}
                  disabled={!selectedClass}
                >
                  <option value="">Select Exam</option>
                  {exams.map((e, i) => (
                    <option key={e.id} value={e.id}>
                      {e.examType || e.examName || "Exam"} ({e.subject || "no subject"}) —{" "}
                      {isPartTimeExam(e, employmentTypes) ? "Part Time" : "Full Time"}
                      {e.resultsSent ? " ✓ La gudbiyay" : ""}
                      {i === 0 ? " - Ugu dambeeyay" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {students.length > 0 && canEdit && (
                <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
                  <button
                    style={btnPrimarySmall}
                    onClick={saveAndSendResults}
                    disabled={saving || !maxMarks}
                  >
                    <Send size={14} style={{ marginRight: 6 }} />
                    {saving
                      ? "Sending..."
                      : status?.code === "update"
                      ? "Update & Send"
                      : "Save & Send"}
                  </button>
                </div>
              )}

              {students.length > 0 && (
                <div style={{ display: "flex", alignItems: "flex-end" }}>
                  <button style={btnSecondary} onClick={printResults}>
                    <Printer size={16} style={{ marginRight: 6 }} />
                    Print
                  </button>
                </div>
              )}
            </div>

            {/* Xaaladda gudbinta */}
            {status && !loading && (
              <div
                style={{
                  marginTop: 16,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  background: tone.bg,
                  border: `1px solid ${tone.border}`,
                  color: tone.color,
                  borderRadius: 12,
                  padding: "12px 14px",
                  fontSize: 13.5,
                  fontWeight: 600,
                  lineHeight: 1.5,
                }}
              >
                {status.code === "locked" ? (
                  <Lock size={17} style={{ flexShrink: 0, marginTop: 1 }} />
                ) : (
                  <tone.Icon size={17} style={{ flexShrink: 0, marginTop: 1 }} />
                )}
                <div>
                  {status.text}
                  {submitWin?.startAt && submitWin?.endAt && (
                    <div style={{ fontSize: 12, fontWeight: 500, opacity: 0.85, marginTop: 4 }}>
                      Waqtiga gudbinta: {formatDT(submitWin.startAt)} → {formatDT(submitWin.endAt)}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Total Marks (imisa lagu saxayo) */}
          {selectedExam && students.length > 0 && canEdit && (
            <div className="res-panel" style={{ ...filterCard, padding: "14px 20px" }}>
              {maxMarks ? (
                <div style={{ color: "#C4B5FD", fontSize: 14, fontWeight: 600 }}>
                  Imtixaankan waxaa lagu saxayaa{" "}
                  <span style={{ color: "#fff", fontSize: 16 }}>{maxMarks}</span> marks
                  {maxSource === "admin" ? " (maamulka ayaa dhigay)" : " (macalin ayaa dhigay)"}
                  <div style={{ color: "#94A3B8", fontSize: 12, fontWeight: 500, marginTop: 4 }}>
                    Arday kasta waxaad siin kartaa 0 ilaa {maxMarks} oo keliya — ka badan lama qori karo.
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 220px" }}>
                    <label style={label}>Imtixaanku waa imisa lagu saxayaa? (Total Marks)</label>
                    <input
                      style={input}
                      type="number"
                      min="1"
                      placeholder="tusaale: 50"
                      value={maxInput}
                      onChange={(e) => setMaxInput(e.target.value)}
                    />
                  </div>
                  <button style={btnPrimarySmall} onClick={saveMaxMarks} disabled={savingMax}>
                    {savingMax ? "Saving..." : "Dhig"}
                  </button>
                  <div style={{ width: "100%", color: "#F59E0B", fontSize: 12 }}>
                    Maamulku wuu ka tegay. Marka aad dhigto, dhamaan macalimiinta kale iyo maadooyinka
                    fasalkan isla midkaas ayay isticmaali doonaan.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Results table */}
          <div className="res-panel" style={tableCard}>
            {loading ? (
              <p style={{ padding: 20, color: "#94A3B8" }}>Loading students...</p>
            ) : !selectedExam ? (
              <p style={{ padding: 20, color: "#94A3B8" }}>Select a class and exam to view results.</p>
            ) : students.length === 0 ? (
              <p style={{ padding: 20, color: "#94A3B8" }}>No students found for this class.</p>
            ) : (
              <div className="res-table-wrap">
                <table className="res-table">
                  <thead>
                    <tr>
                      <th style={th}>Name</th>
                      <th style={th}>ID</th>
                      <th style={th}>Marks{maxMarks ? ` (0 – ${maxMarks})` : ""}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => (
                      <tr key={s.id}>
                        <td style={{ ...td, display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={avatar}>{(s.fullName || "?").charAt(0).toUpperCase()}</div>
                          {s.fullName}
                        </td>
                        <td style={td}>{s.studentId}</td>
                        <td style={td}>
                          <input
                            style={{
                              ...input,
                              width: 100,
                              opacity: canEdit && maxMarks ? 1 : 0.6,
                            }}
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            placeholder={maxMarks ? `/ ${maxMarks}` : ""}
                            disabled={!canEdit || !maxMarks}
                            value={marks[s.id] ?? ""}
                            onChange={(e) => setMark(s.id, e.target.value)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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
  marginBottom: 20,
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
const btnPrimarySmall = {
  background: "linear-gradient(90deg,#6D5DF0,#8B5CF6)",
  color: "white",
  border: "none",
  borderRadius: 10,
  padding: "10px 18px",
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: 13,
  display: "inline-flex",
  alignItems: "center",
};
const btnSecondary = {
  background: "#111827",
  border: "1px solid rgba(255,255,255,.1)",
  borderRadius: 10,
  padding: "10px 18px",
  cursor: "pointer",
  color: "#fff",
  fontSize: 13,
  display: "inline-flex",
  alignItems: "center",
};