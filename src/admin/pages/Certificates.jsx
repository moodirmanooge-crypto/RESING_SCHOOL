// src/admin/pages/Certificates.jsx
// Class 8 Leaving Certificate generator & manager.
//
// Flow:
// 1. Admin picks a Class 8 student.
// 2. Admin fills in Mother's Name, Academic Year, Grade Obtained (studentPhoto
//    and fullName are pulled automatically from the student's own record —
//    nothing typed twice).
// 3. "Generate Certificate" renders the official certificate design (matching
//    the printed reference) into a hidden card, snapshots it with html2canvas,
//    and saves a Firestore doc in `certificates` so it can be re-opened,
//    edited, or re-downloaded later — and so the public verification page
//    (/verify/:certificateId) and QR code have something to check against.
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase/firebase";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import CertificateCard from "../components/CertificateCard";

const GREEN = "#14532d";

function genCertificateId() {
  // e.g. RS-CERT-8F3K9Q2A
  const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `RS-CERT-${rand}`;
}

async function downloadCertificateImage(fullName) {
  const node = document.getElementById("certificate-render-card");
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
    const canvas = await window.html2canvas(node, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
    });
    const link = document.createElement("a");
    link.download = `Certificate-${(fullName || "student").replace(/\s+/g, "-")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  } catch (err) {
    console.log("Falling back to print view:", err);
    window.print();
  }
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
  });
  const [previewCert, setPreviewCert] = useState(null); // the cert currently rendered in the hidden card
  const [search, setSearch] = useState("");

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

  function pickStudent(id) {
    setSelectedStudentId(id);
    const existing = certificates.find((c) => c.studentId === id);
    if (existing) {
      setForm({
        motherName: existing.motherName || "",
        academicYear: existing.academicYear || "",
        gradeObtained: existing.gradeObtained || "",
      });
      setPreviewCert(existing);
    } else {
      setForm({ motherName: "", academicYear: "", gradeObtained: "" });
      setPreviewCert(null);
    }
  }

  async function handleGenerate() {
    if (!selectedStudent) return;
    if (!form.motherName || !form.academicYear || !form.gradeObtained) {
      alert("Fadlan buuxi Mother's Name, Academic Year, iyo Grade Obtained.");
      return;
    }
    setSaving(true);
    try {
      const certId = existingCertForStudent?.id || genCertificateId();
      const certData = {
        certificateId: certId,
        studentId: selectedStudent.id,
        fullName: selectedStudent.fullName || "",
        className: selectedStudent.className || "8",
        studentPhoto: selectedStudent.studentPhoto || "",
        motherName: form.motherName,
        academicYear: form.academicYear,
        gradeObtained: form.gradeObtained,
        schoolName: "Rising Star Primary & Secondary School",
        createdAt: existingCertForStudent?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(doc(db, "certificates", certId), certData, { merge: true });
      setPreviewCert(certData);
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
                        }}
                      >
                        <span>{s.fullName || "Unnamed student"}</span>
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
                    <Field label="Academic Year">
                      <input
                        value={form.academicYear}
                        onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
                        placeholder="e.g. 2025/2026"
                        style={inputStyle}
                      />
                    </Field>
                    <Field label="Grade Obtained">
                      <input
                        value={form.gradeObtained}
                        onChange={(e) => setForm({ ...form, gradeObtained: e.target.value })}
                        placeholder="e.g. A / 88%"
                        style={inputStyle}
                      />
                    </Field>
                  </div>

                  <button
                    onClick={handleGenerate}
                    disabled={saving}
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
                    {saving
                      ? "Saving…"
                      : existingCertForStudent
                      ? "Update Certificate"
                      : "Generate Certificate"}
                  </button>

                  {previewCert && (
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
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 560 }}>
                <thead>
                  <tr style={{ color: "#9CA3AF", textAlign: "left" }}>
                    <th style={{ fontWeight: 600, paddingBottom: 8 }}>Student</th>
                    <th style={{ fontWeight: 600, paddingBottom: 8 }}>Academic Year</th>
                    <th style={{ fontWeight: 600, paddingBottom: 8 }}>Grade</th>
                    <th style={{ fontWeight: 600, paddingBottom: 8 }}>Certificate ID</th>
                    <th style={{ fontWeight: 600, paddingBottom: 8 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {certificates.map((c) => (
                    <tr key={c.id} style={{ borderTop: "1px solid #F3F4F6" }}>
                      <td style={{ padding: "10px 0", color: "#111827", fontWeight: 600 }}>{c.fullName}</td>
                      <td style={{ color: "#6B7280" }}>{c.academicYear}</td>
                      <td style={{ color: "#6B7280" }}>{c.gradeObtained}</td>
                      <td style={{ color: "#6B7280", fontFamily: "monospace" }}>{c.certificateId}</td>
                      <td>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => pickStudent(c.studentId)}
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

      <style>{`
        @media (max-width: 980px) {
          .cert-row { grid-template-columns: 1fr !important; }
        }
      `}</style>
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