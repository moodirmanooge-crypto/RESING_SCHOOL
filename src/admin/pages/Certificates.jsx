// src/admin/pages/Certificates.jsx
// Class 8 Leaving Certificate generator & manager.
//
// Flow:
// 1. Admin picks a Class 8 student.
// 2. We auto-pull the student's Final Exam results from `results`
//    (one document per subject, matched by studentId + examType === "Final"),
//    take the 6 highest-scoring subjects, and compute the average.
// 3. Admin fills in Mother's Name, Academic Year, Date of Birth, Place of
//    Birth, Roll Number, and Date of Issue by hand — studentPhoto and
//    fullName are pulled automatically from the student's own record.
// 4. "Generate Certificate" renders the official certificate design (matching
//    the printed reference) into a hidden card, snapshots it with html2canvas,
//    and saves a Firestore doc in `certificates` so it can be re-opened,
//    edited, or re-downloaded later — and so the public verification page
//    (/verify/:certificateId) and QR code have something to check against.
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, storage } from "../../firebase/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import CertificateCard from "../components/CertificateCard";

const GREEN = "#14532d";

// Official Banadir Regional Administration / Education Directorate grading
// scale (TUSAHA DARAJAYNTA - GRADING). Percentage thresholds are inclusive
// of the lower bound shown in the printed reference table.
const GRADING_SCALE = [
  { min: 90, grade: "A" },
  { min: 80, grade: "A-" },
  { min: 75, grade: "B+" },
  { min: 70, grade: "B" },
  { min: 65, grade: "B-" },
  { min: 60, grade: "C+" },
  { min: 55, grade: "C" },
  { min: 50, grade: "C-" },
  { min: 45, grade: "D+" },
  { min: 40, grade: "D" },
  { min: 35, grade: "D-" },
  { min: 0, grade: "E" },
];

function computeGrade(marks, maxMarks) {
  const pct = (Number(marks) / (Number(maxMarks) || 100)) * 100;
  const found = GRADING_SCALE.find((row) => pct >= row.min);
  return found ? found.grade : "E";
}

// A student only qualifies for a Class 8 Leaving Certificate if they have a
// recorded Final Exam result (examType === "Final") and did NOT fail it
// (grade "E" per the official scale = below 35%).
function genCertificateId() {
  // e.g. RS-CERT-8F3K9Q2A
  const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `RS-CERT-${rand}`;
}

// Pulls every `results` document for this student's Final Exam (one doc per
// subject), sorts by marks (highest first), and returns the top 6 along with
// the average across those 6 subjects — this is what feeds the certificate's
// subjects table and "Celceliska Natiijada Imtixaanka / Result Average" line.
async function loadTopSubjectsForStudent(studentId) {
  const snap = await getDocs(
    query(
      collection(db, "results"),
      where("studentId", "==", studentId),
      where("examType", "==", "Final")
    )
  );
  const all = snap.docs.map((d) => d.data());
  const bySubjectPct = all
    .map((r) => ({
      subject: r.subject || "",
      marks: Number(r.marks) || 0,
      maxMarks: Number(r.maxMarks) || 100,
      pct: (Number(r.marks) || 0) / (Number(r.maxMarks) || 100),
    }))
    .sort((a, b) => b.pct - a.pct);

  const top6 = bySubjectPct.slice(0, 6);
  const average =
    top6.length > 0
      ? Math.round(
          (top6.reduce((sum, s) => sum + s.pct, 0) / top6.length) * 100
        )
      : null;

  return { topSubjects: top6.map(({ subject, marks, maxMarks }) => ({ subject, marks, maxMarks })), average };
}

async function downloadCertificateImage(fullName, elementId = "certificate-render-card") {
  const node = document.getElementById(elementId);
  if (!node) return;
  try {
    if (!window.html2canvas) {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src =
          "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
      });
    }
    // Snapshot at the card's real rendered size so the A4-landscape
    // proportions are preserved in the downloaded image (aspectRatio can
    // otherwise collapse under html2canvas).
    const rect = node.getBoundingClientRect();
    const canvas = await window.html2canvas(node, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      allowTaint: false,
      width: Math.ceil(rect.width),
      height: Math.ceil(rect.height),
      windowWidth: document.documentElement.scrollWidth,
    });
    const link = document.createElement("a");
    link.download = `Certificate-${(fullName || "student").replace(/\s+/g, "-")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  } catch (err) {
    // Most common cause here: the student's photo came from a storage URL
    // without CORS headers, which "taints" the canvas and blocks
    // toDataURL(). Retry once, skipping the photo, so the admin still gets
    // a certificate image instead of a silent failure / print fallback.
    console.log("Snapshot with photo failed, retrying without photo:", err);
    try {
      const rect = node.getBoundingClientRect();
      const canvas = await window.html2canvas(node, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        allowTaint: false,
        width: Math.ceil(rect.width),
        height: Math.ceil(rect.height),
        windowWidth: document.documentElement.scrollWidth,
        ignoreElements: (el) => el.tagName === "IMG",
      });
      const link = document.createElement("a");
      link.download = `Certificate-${(fullName || "student").replace(/\s+/g, "-")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      alert(
        "Sawirka ardayga lama soo dagin (CORS). Shahaadada waa la soo dejiyay iyada oo aan sawirka lahayn."
      );
    } catch (err2) {
      console.log("Falling back to print view:", err2);
      printCertificate(false, elementId);
    }
  }
}

// Opens a clean print window containing ONLY the certificate (no sidebar,
// no form) sized to A4 landscape, and triggers the browser print dialog.
// `grayscale` prints the certificate in black & white; otherwise full color.
function printCertificate(grayscale, elementId = "certificate-render-card") {
  const node = document.getElementById(elementId);
  if (!node) return;
  const html = node.outerHTML;
  const win = window.open("", "_blank", "width=1200,height=850");
  if (!win) {
    // Popup blocked — fall back to printing the current window.
    window.print();
    return;
  }
  win.document.open();
  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Certificate</title>
        <meta charset="utf-8" />
        <style>
          @page { size: A4 landscape; margin: 0; }
          html, body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-wrap {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            ${grayscale ? "filter: grayscale(100%);" : ""}
          }
          .print-wrap > * {
            width: 100% !important;
            max-width: 100% !important;
          }
          @media print {
            .print-wrap { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="print-wrap">${html}</div>
        <script>
          window.onload = function () {
            setTimeout(function () {
              window.focus();
              window.print();
            }, 400);
          };
          window.onafterprint = function () { window.close(); };
        <\/script>
      </body>
    </html>
  `);
  win.document.close();
}

export default function Certificates() {
  const [students, setStudents] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [form, setForm] = useState({
    motherName: "",
    academicYear: "",
    gradeObtained: "",
    // Hand-typed by the deputy/teacher when generating the certificate —
    // not pulled from any student record.
    dateOfBirth: "",
    placeOfBirth: "",
    rollNumber: "",
    issueDate: "",
  });
  const [previewCert, setPreviewCert] = useState(null); // the cert currently rendered in the hidden card
  const [search, setSearch] = useState("");
  // Maps studentId -> { marks, maxMarks, grade, passed } from the Final Exam.
  const [finalResults, setFinalResults] = useState({});
  // Maps studentId -> { topSubjects, average } once loaded on selection.
  const [subjectsData, setSubjectsData] = useState({});
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  // Lets the admin upload/override the photo used on the certificate,
  // e.g. when the student's own record has no photo on file.
  const [uploadedPhoto, setUploadedPhoto] = useState(""); // data URL for instant preview
  const [uploadedPhotoFile, setUploadedPhotoFile] = useState(null); // actual File to upload on generate
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  // The certificate currently opened in the full-screen "View" modal (from the
  // Issued Certificates list), or null when the modal is closed.
  const [viewCert, setViewCert] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const studentsSnap = await getDocs(collection(db, "students"));
      const studentsList = studentsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((s) => String(s.className || "").trim().toUpperCase() === "8");
      setStudents(studentsList);

      const certsSnap = await getDocs(collection(db, "certificates"));
      const certsList = certsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      certsList.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setCertificates(certsList);

      // Pull each Class 8 student's Final Exam result (examType === "Final")
      // so we know who actually qualifies for a leaving certificate. This is
      // the pass/fail check only — the full per-subject breakdown used on
      // the certificate itself is loaded separately, on selection, by
      // loadTopSubjectsForStudent().
      const resultsMap = {};
      await Promise.all(
        studentsList.map(async (s) => {
          try {
            const resSnap = await getDocs(
              query(
                collection(db, "results"),
                where("studentId", "==", s.id),
                where("examType", "==", "Final")
              )
            );
            if (resSnap.empty) return;
            // Overall pass/fail is based on the average across all recorded
            // Final subjects for the student (matches the certificate's own
            // "aggregate" rule), not a single subject.
            const docsData = resSnap.docs.map((d) => d.data());
            const avgPct =
              docsData.reduce(
                (sum, r) => sum + (Number(r.marks) || 0) / (Number(r.maxMarks) || 100),
                0
              ) / docsData.length;
            const marksSum = docsData.reduce((sum, r) => sum + (Number(r.marks) || 0), 0);
            const maxSum = docsData.reduce((sum, r) => sum + (Number(r.maxMarks) || 100), 0);
            const grade = computeGrade(marksSum, maxSum);
            resultsMap[s.id] = {
              marks: marksSum,
              maxMarks: maxSum,
              grade,
              passed: avgPct * 100 >= 35,
            };
          } catch (e) {
            console.error("Error loading final result for student", s.id, e);
          }
        })
      );
      setFinalResults(resultsMap);
    } catch (e) {
      console.error("Error loading certificates data:", e);
    } finally {
      setLoading(false);
    }
  }

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => (s.fullName || "").toLowerCase().includes(q));
  }, [students, search]);

  const selectedStudent = students.find((s) => s.id === selectedStudentId) || null;

  // A student may already have a certificate — look it up so the admin can
  // see/edit/re-download instead of accidentally creating a duplicate.
  const existingCertForStudent = certificates.find(
    (c) => c.studentId === selectedStudentId
  );

  async function pickStudent(id) {
    const result = finalResults[id];
    if (!result) {
      alert("Ardaygan wali ma helin natiijada Final Exam. Shahaado lama siin karo.");
      return;
    }
    if (!result.passed) {
      alert(
        `Ardaygan wuu ku dhacay Final Exam-ka (celceliska ${Math.round(
          (result.marks / (result.maxMarks || 1)) * 100
        )}%). Shahaado lama siin karo.`
      );
      return;
    }

    setSelectedStudentId(id);
    // Reset any in-progress photo upload from a previously selected student.
    setUploadedPhoto("");
    setUploadedPhotoFile(null);

    const existing = certificates.find((c) => c.studentId === id);
    if (existing) {
      setForm({
        motherName: existing.motherName || "",
        academicYear: existing.academicYear || "",
        gradeObtained: existing.gradeObtained || result.grade,
        dateOfBirth: existing.dateOfBirth || "",
        placeOfBirth: existing.placeOfBirth || "",
        rollNumber: existing.rollNumber || "",
        issueDate: existing.issueDate || "",
      });
      setPreviewCert(existing);
      // Reuse the already-saved subjects/average instead of re-fetching.
      if (existing.topSubjects) {
        setSubjectsData((prev) => ({
          ...prev,
          [id]: { topSubjects: existing.topSubjects, average: existing.averageResult },
        }));
      }
    } else {
      setForm({
        motherName: "",
        academicYear: "",
        gradeObtained: result.grade,
        dateOfBirth: "",
        placeOfBirth: "",
        rollNumber: "",
        issueDate: "",
      });
      setPreviewCert(null);
    }

    // Fetch the top-6 subjects + average for this student if we don't
    // already have them cached.
    if (!subjectsData[id]) {
      setLoadingSubjects(true);
      try {
        const data = await loadTopSubjectsForStudent(id);
        setSubjectsData((prev) => ({ ...prev, [id]: data }));
      } catch (e) {
        console.error("Error loading subjects for student", id, e);
      } finally {
        setLoadingSubjects(false);
      }
    }
  }

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Fadlan dooro sawir (image file) sax ah.");
      return;
    }
    setUploadedPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setUploadedPhoto(reader.result);
    reader.readAsDataURL(file);
  }

  async function handleGenerate() {
    if (!selectedStudent) return;
    const result = finalResults[selectedStudent.id];
    if (!result || !result.passed) {
      alert("Ardaygan uma qalmo shahaado - Final Exam lama helin ama wuu ku dhacay.");
      return;
    }
    if (!form.motherName || !form.academicYear) {
      alert("Fadlan buuxi Mother's Name iyo Academic Year.");
      return;
    }
    setSaving(true);
    try {
      const certId = existingCertForStudent?.id || genCertificateId();

      // If the admin picked a new photo for this certificate, upload it to
      // Storage first and use its URL; otherwise fall back to whatever
      // photo the certificate already had, or the student's own record.
      let photoUrl =
        existingCertForStudent?.studentPhoto || selectedStudent.studentPhoto || "";

      if (uploadedPhotoFile) {
        setUploadingPhoto(true);
        try {
          const photoRef = ref(
            storage,
            `certificate-photos/${selectedStudent.id}/${Date.now()}_${uploadedPhotoFile.name}`
          );
          await uploadBytes(photoRef, uploadedPhotoFile);
          photoUrl = await getDownloadURL(photoRef);
        } finally {
          setUploadingPhoto(false);
        }
      }

      const subjectInfo = subjectsData[selectedStudent.id] || { topSubjects: [], average: null };

      const certData = {
        certificateId: certId,
        studentId: selectedStudent.id,
        fullName: selectedStudent.fullName || "",
        className: selectedStudent.className || "8",
        studentPhoto: photoUrl,
        motherName: form.motherName,
        academicYear: form.academicYear,
        // Hand-typed by the deputy/teacher generating the certificate.
        dateOfBirth: form.dateOfBirth,
        placeOfBirth: form.placeOfBirth,
        rollNumber: form.rollNumber,
        issueDate: form.issueDate,
        // Grade always comes from the actual Final Exam result, computed
        // with the official Banadir grading scale - never typed by hand -
        // so it can't drift from what the student actually scored.
        gradeObtained: result.grade,
        finalExamMarks: result.marks,
        finalExamMaxMarks: result.maxMarks,
        // The 6 highest-scoring subjects and their average, auto-pulled from
        // the `results` collection at selection time — displayed on the
        // certificate's subjects table and "Result Average" line.
        topSubjects: subjectInfo.topSubjects,
        averageResult: subjectInfo.average,
        schoolName: "Rising Star Primary & Secondary School",
        createdAt: existingCertForStudent?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(doc(db, "certificates", certId), certData, { merge: true });
      setPreviewCert(certData);
      setUploadedPhoto("");
      setUploadedPhotoFile(null);
      await load();
    } catch (e) {
      console.error("Error saving certificate:", e);
      alert("Khalad ayaa dhacay markii shahaadada la keydin lahaa.");
    } finally {
      setSaving(false);
    }
  }


  async function handleDelete(cert) {
    if (!window.confirm(`Ma hubtaa inaad tirtirto shahaadada ${cert.fullName}?`)) return;
    try {
      await deleteDoc(doc(db, "certificates", cert.id));
      if (previewCert?.id === cert.id) setPreviewCert(null);
      await load();
    } catch (e) {
      console.error("Error deleting certificate:", e);
    }
  }

  const verifyBaseUrl =
    typeof window !== "undefined" ? `${window.location.origin}/verify` : "/verify";

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F3F4F8", fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      <Sidebar />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: "22px 26px 0" }}>
          <Topbar />
        </div>

        <div style={{ padding: "26px 30px" }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#111827", margin: "0 0 4px" }}>
            Class 8 Leaving Certificates
          </h1>
          <p style={{ fontSize: 13.5, color: "#6B7280", margin: "0 0 24px" }}>
            Generate official leaving certificates for students finishing Class 8, with a
            scannable QR code that links to a public verification page.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 22 }} className="cert-row">
            {/* Left: student picker + form */}
            <div
              style={{
                background: "#fff",
                borderRadius: 18,
                padding: 22,
                boxShadow: "0 4px 18px rgba(17,24,39,0.06)",
                border: "1px solid rgba(17,24,39,0.05)",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 14 }}>
                1. Select Class 8 Student
              </div>

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name…"
                style={inputStyle}
              />

              {loading ? (
                <p style={{ fontSize: 13, color: "#9CA3AF", marginTop: 12 }}>Loading…</p>
              ) : filteredStudents.length === 0 ? (
                <p style={{ fontSize: 13, color: "#9CA3AF", marginTop: 12 }}>
                  No Class 8 students found.
                </p>
              ) : (
                <div style={{ maxHeight: 220, overflowY: "auto", marginTop: 12, marginBottom: 18 }}>
                  {filteredStudents.map((s) => {
                    const hasCert = certificates.some((c) => c.studentId === s.id);
                    const isActive = s.id === selectedStudentId;
                    const result = finalResults[s.id];
                    const eligible = result && result.passed;
                    return (
                      <button
                        key={s.id}
                        onClick={() => pickStudent(s.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          width: "100%",
                          textAlign: "left",
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: `1px solid ${isActive ? GREEN : "rgba(17,24,39,0.08)"}`,
                          background: isActive ? "rgba(22,163,74,0.08)" : "#fff",
                          marginBottom: 6,
                          cursor: "pointer",
                          fontSize: 13.5,
                          color: "#111827",
                          opacity: eligible ? 1 : 0.55,
                        }}
                      >
                        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <StudentAvatar photo={s.studentPhoto} name={s.fullName} />
                          {s.fullName || "Unnamed student"}
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {hasCert && (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: "#16a34a",
                                background: "#DCFCE7",
                                padding: "2px 8px",
                                borderRadius: 999,
                              }}
                            >
                              Has certificate
                            </span>
                          )}
                          {!result && (
                            <span style={statusBadgeStyle("#92400E", "#FEF3C7")}>
                              No Final Exam
                            </span>
                          )}
                          {result && !result.passed && (
                            <span style={statusBadgeStyle("#991B1B", "#FEE2E2")}>
                              Failed ({result.grade})
                            </span>
                          )}
                          {result && result.passed && !hasCert && (
                            <span style={statusBadgeStyle("#1D4ED8", "#DBEAFE")}>
                              Eligible ({result.grade})
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedStudent && (
                <>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", margin: "18px 0 14px" }}>
                    2. Certificate Details
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <Field label="Student Name (from record)">
                      <input value={selectedStudent.fullName || ""} disabled style={inputStyleDisabled} />
                    </Field>
                    <Field label="Mother's Name">
                      <input
                        value={form.motherName}
                        onChange={(e) => setForm({ ...form, motherName: e.target.value })}
                        placeholder="e.g. Amina Yusuf"
                        style={inputStyle}
                      />
                    </Field>
                    <Field label="Date of Birth">
                      <input
                        value={form.dateOfBirth}
                        onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                        placeholder="e.g. 12/05/2011"
                        style={inputStyle}
                      />
                    </Field>
                    <Field label="Place of Birth">
                      <input
                        value={form.placeOfBirth}
                        onChange={(e) => setForm({ ...form, placeOfBirth: e.target.value })}
                        placeholder="e.g. Mogadishu"
                        style={inputStyle}
                      />
                    </Field>
                    <Field label="Roll Number">
                      <input
                        value={form.rollNumber}
                        onChange={(e) => setForm({ ...form, rollNumber: e.target.value })}
                        placeholder="e.g. 0245"
                        style={inputStyle}
                      />
                    </Field>
                    <Field label="Academic Year">
                      <input
                        value={form.academicYear}
                        onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
                        placeholder="e.g. 2025/2026"
                        style={inputStyle}
                      />
                    </Field>
                    <Field label="Date of Issue">
                      <input
                        value={form.issueDate}
                        onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
                        placeholder="e.g. 15/07/2026"
                        style={inputStyle}
                      />
                    </Field>
                    <Field label="Student Photo">
                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <div
                          style={{
                            width: 64,
                            height: 64,
                            borderRadius: 10,
                            overflow: "hidden",
                            background: "#E5E7EB",
                            border: "1px solid rgba(17,24,39,0.1)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          {uploadedPhoto || selectedStudent.studentPhoto ? (
                            <img
                              src={uploadedPhoto || selectedStudent.studentPhoto}
                              alt=""
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          ) : (
                            <span style={{ fontSize: 11, color: "#9CA3AF" }}>No photo</span>
                          )}
                        </div>
                        <label
                          style={{
                            padding: "9px 14px",
                            borderRadius: 10,
                            border: `1.5px solid ${GREEN}`,
                            color: GREEN,
                            fontWeight: 700,
                            fontSize: 12.5,
                            cursor: "pointer",
                          }}
                        >
                          {uploadedPhotoFile ? "Change Photo" : "Upload Photo"}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoChange}
                            style={{ display: "none" }}
                          />
                        </label>
                      </div>
                      <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 6 }}>
                        Sawirkan wuxuu isticmaalmayaa shahaadada kaliya, kama beddelayo sawirka
                        diiwaanka ardayga.
                      </p>
                    </Field>
                    <Field label="Grade Obtained (Final Exam - auto)">
                      <input
                        value={
                          finalResults[selectedStudent.id]
                            ? `${finalResults[selectedStudent.id].grade}`
                            : ""
                        }
                        disabled
                        style={inputStyleDisabled}
                      />
                    </Field>
                    <Field label="Top 6 Subjects &amp; Average (auto, from Final Exam results)">
                      {loadingSubjects && !subjectsData[selectedStudent.id] ? (
                        <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>Loading results…</p>
                      ) : subjectsData[selectedStudent.id]?.topSubjects?.length ? (
                        <div
                          style={{
                            border: "1px solid rgba(17,24,39,0.1)",
                            borderRadius: 10,
                            padding: "8px 10px",
                            fontSize: 12.5,
                          }}
                        >
                          {subjectsData[selectedStudent.id].topSubjects.map((s, i) => (
                            <div
                              key={i}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                padding: "3px 0",
                                color: "#374151",
                              }}
                            >
                              <span>{s.subject}</span>
                              <span style={{ fontWeight: 600 }}>
                                {s.marks}/{s.maxMarks}
                              </span>
                            </div>
                          ))}
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              marginTop: 6,
                              paddingTop: 6,
                              borderTop: "1px solid rgba(17,24,39,0.08)",
                              fontWeight: 700,
                              color: GREEN,
                            }}
                          >
                            <span>Average</span>
                            <span>{subjectsData[selectedStudent.id].average}%</span>
                          </div>
                        </div>
                      ) : (
                        <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>
                          No subject results found for this student's Final Exam.
                        </p>
                      )}
                    </Field>
                  </div>

                  <button
                    onClick={handleGenerate}
                    disabled={saving || uploadingPhoto}
                    style={{
                      marginTop: 18,
                      width: "100%",
                      padding: "12px 0",
                      borderRadius: 12,
                      border: "none",
                      background: saving ? "#9CA3AF" : "linear-gradient(90deg,#16a34a,#15803d)",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: saving ? "default" : "pointer",
                    }}
                  >
                    {uploadingPhoto
                      ? "Uploading photo…"
                      : saving
                      ? "Saving…"
                      : existingCertForStudent
                      ? "Update Certificate"
                      : "Generate Certificate"}
                  </button>

                  {previewCert && (
                    <>
                      <button
                        onClick={() => downloadCertificateImage(previewCert.fullName)}
                        style={{
                          marginTop: 10,
                          width: "100%",
                          padding: "11px 0",
                          borderRadius: 12,
                          border: `1.5px solid ${GREEN}`,
                          background: "#fff",
                          color: GREEN,
                          fontWeight: 700,
                          fontSize: 13.5,
                          cursor: "pointer",
                        }}
                      >
                        ⬇️ Download Certificate Image
                      </button>

                      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                        <button
                          onClick={() => printCertificate(false)}
                          style={{
                            flex: 1,
                            padding: "11px 0",
                            borderRadius: 12,
                            border: `1.5px solid ${GREEN}`,
                            background: "#fff",
                            color: GREEN,
                            fontWeight: 700,
                            fontSize: 13.5,
                            cursor: "pointer",
                          }}
                        >
                          🖨️ Print (Color)
                        </button>
                        <button
                          onClick={() => printCertificate(true)}
                          style={{
                            flex: 1,
                            padding: "11px 0",
                            borderRadius: 12,
                            border: "1.5px solid #374151",
                            background: "#fff",
                            color: "#374151",
                            fontWeight: 700,
                            fontSize: 13.5,
                            cursor: "pointer",
                          }}
                        >
                          🖨️ Print (B&amp;W)
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Right: live preview */}
            <div
              style={{
                background: "#fff",
                borderRadius: 18,
                padding: 22,
                boxShadow: "0 4px 18px rgba(17,24,39,0.06)",
                border: "1px solid rgba(17,24,39,0.05)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 14, alignSelf: "flex-start" }}>
                Preview
              </div>
              {previewCert ? (
                <div style={{ width: "100%", overflowX: "auto" }}>
                  <CertificateCard
                    certificate={previewCert}
                    verifyUrl={`${verifyBaseUrl}/${previewCert.certificateId}`}
                  />
                </div>
              ) : selectedStudent ? (
                <div style={{ width: "100%", overflowX: "auto" }}>
                  <CertificateCard
                    certificate={{
                      fullName: selectedStudent.fullName,
                      studentPhoto: uploadedPhoto || selectedStudent.studentPhoto,
                      className: selectedStudent.className || "8",
                      motherName: form.motherName,
                      dateOfBirth: form.dateOfBirth,
                      placeOfBirth: form.placeOfBirth,
                      rollNumber: form.rollNumber,
                      academicYear: form.academicYear,
                      issueDate: form.issueDate,
                      gradeObtained: finalResults[selectedStudent.id]?.grade,
                      topSubjects: subjectsData[selectedStudent.id]?.topSubjects || [],
                      averageResult: subjectsData[selectedStudent.id]?.average,
                      certificateId: "PREVIEW",
                    }}
                    verifyUrl={`${verifyBaseUrl}/PREVIEW`}
                  />
                </div>
              ) : (
                <p style={{ fontSize: 13, color: "#9CA3AF" }}>
                  Select a student and fill in the details to preview their certificate.
                </p>
              )}
            </div>
          </div>

          {/* All issued certificates */}
          <div
            style={{
              background: "#fff",
              borderRadius: 18,
              padding: 22,
              boxShadow: "0 4px 18px rgba(17,24,39,0.06)",
              border: "1px solid rgba(17,24,39,0.05)",
              marginTop: 22,
              overflowX: "auto",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 14 }}>
              Issued Certificates ({certificates.length})
            </div>
            {certificates.length === 0 && !loading ? (
              <p style={{ fontSize: 13, color: "#9CA3AF" }}>No certificates issued yet.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 640 }}>
                <thead>
                  <tr style={{ color: "#9CA3AF", textAlign: "left" }}>
                    <th style={{ fontWeight: 600, paddingBottom: 8 }}>Photo</th>
                    <th style={{ fontWeight: 600, paddingBottom: 8 }}>Student</th>
                    <th style={{ fontWeight: 600, paddingBottom: 8 }}>Academic Year</th>
                    <th style={{ fontWeight: 600, paddingBottom: 8 }}>Grade</th>
                    <th style={{ fontWeight: 600, paddingBottom: 8 }}>Average</th>
                    <th style={{ fontWeight: 600, paddingBottom: 8 }}>Certificate ID</th>
                    <th style={{ fontWeight: 600, paddingBottom: 8 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {certificates.map((c) => (
                    <tr key={c.id} style={{ borderTop: "1px solid #F3F4F6" }}>
                      <td style={{ padding: "10px 0" }}>
                        <StudentAvatar photo={c.studentPhoto} name={c.fullName} size={36} />
                      </td>
                      <td style={{ padding: "10px 0", color: "#111827", fontWeight: 600 }}>{c.fullName}</td>
                      <td style={{ color: "#6B7280" }}>{c.academicYear}</td>
                      <td style={{ color: "#6B7280" }}>{c.gradeObtained}</td>
                      <td style={{ color: "#6B7280" }}>{c.averageResult != null ? `${c.averageResult}%` : "—"}</td>
                      <td style={{ color: "#6B7280", fontFamily: "monospace" }}>{c.certificateId}</td>
                      <td>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => setViewCert(c)}
                            style={smallBtnStyle}
                          >
                            View
                          </button>
                          <button
                            onClick={() => handleDelete(c)}
                            style={{ ...smallBtnStyle, color: "#DC2626", borderColor: "rgba(220,38,38,0.3)" }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Full-screen "View" modal: opened from the Issued Certificates list,
          shows the whole certificate with its own Download / Print actions. */}
      {viewCert && (
        <div
          onClick={() => setViewCert(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(17,24,39,0.6)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "28px 16px",
            overflowY: "auto",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 20,
              width: "min(1120px, 100%)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 14,
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 16, color: "#111827" }}>
                {viewCert.fullName} — Certificate
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() => downloadCertificateImage(viewCert.fullName, "certificate-view-modal-card")}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 10,
                    border: `1.5px solid ${GREEN}`,
                    background: "#fff",
                    color: GREEN,
                    fontWeight: 700,
                    fontSize: 12.5,
                    cursor: "pointer",
                  }}
                >
                  ⬇️ Download
                </button>
                <button
                  onClick={() => printCertificate(false, "certificate-view-modal-card")}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 10,
                    border: `1.5px solid ${GREEN}`,
                    background: "#fff",
                    color: GREEN,
                    fontWeight: 700,
                    fontSize: 12.5,
                    cursor: "pointer",
                  }}
                >
                  🖨️ Print (Color)
                </button>
                <button
                  onClick={() => printCertificate(true, "certificate-view-modal-card")}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 10,
                    border: "1.5px solid #374151",
                    background: "#fff",
                    color: "#374151",
                    fontWeight: 700,
                    fontSize: 12.5,
                    cursor: "pointer",
                  }}
                >
                  🖨️ Print (B&W)
                </button>
                <button
                  onClick={() => setViewCert(null)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 10,
                    border: "1px solid rgba(17,24,39,0.15)",
                    background: "#fff",
                    color: "#6B7280",
                    fontWeight: 700,
                    fontSize: 12.5,
                    cursor: "pointer",
                  }}
                >
                  ✕ Close
                </button>
              </div>
            </div>
            <div style={{ width: "100%", overflowX: "auto" }}>
              <CertificateCard
                certificate={viewCert}
                verifyUrl={`${verifyBaseUrl}/${viewCert.certificateId}`}
                elementId="certificate-view-modal-card"
              />
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 980px) {
          .cert-row { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

// Small round avatar used both in the student picker list and the
// "Issued Certificates" table, so the admin can see everyone's photo at a
// glance instead of names only. Falls back to an initial when there's no
// photo on file, instead of leaving a blank gap.
function StudentAvatar({ photo, name, size = 26 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        background: "#E5E7EB",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        fontSize: size * 0.4,
        fontWeight: 700,
        color: "#6B7280",
      }}
    >
      {photo ? (
        <img
          src={photo}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        (name || "?").charAt(0).toUpperCase()
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 4, fontWeight: 600 }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(17,24,39,0.12)",
  fontSize: 13.5,
  outline: "none",
  boxSizing: "border-box",
};

const inputStyleDisabled = {
  ...inputStyle,
  background: "#F3F4F6",
  color: "#6B7280",
};

function statusBadgeStyle(color, bg) {
  return {
    fontSize: 10.5,
    fontWeight: 700,
    color,
    background: bg,
    padding: "2px 7px",
    borderRadius: 999,
    whiteSpace: "nowrap",
  };
}

const smallBtnStyle = {
  padding: "5px 12px",
  borderRadius: 8,
  border: "1px solid rgba(17,24,39,0.12)",
  background: "#fff",
  fontSize: 12,
  fontWeight: 600,
  color: "#374151",
  cursor: "pointer",
};