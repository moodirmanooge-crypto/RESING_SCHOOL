// src/admin/pages/Certificates.jsx
// Class Leaving Certificate generator & manager — fully manual entry version.
// Uses CertificateCard.jsx (template-image based) as the render surface.
//
// Flow:
// 1. Admin fills in every field by hand: Full Name, Mother's Name, Place &
//    Date of Birth, Completed School, Year, Roll Number, Date of Issue,
//    Student Photo, and 12 subjects each with a mark.
// 2. Result Average is auto-computed as the mean of the 12 entered marks
//    (live, recalculates as the admin types).
// 3. "Generate Certificate" snapshots the data into Firestore's
//    `certificates` collection (doc id = safe Roll Number, matching the
//    QR code's /verify/:certificateId target) and adds it to the
//    "Issued Certificates" list below.
// 4. Print opens a clean, paper-only view of just the certificate card
//    (no sidebar/form), same pattern as the ID cards. Download saves a PNG.

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  getDoc,
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
const SUBJECT_COUNT = 12;
const VERIFY_BASE_URL =
  typeof window !== "undefined" ? `${window.location.origin}/verify` : "/verify";

function emptySubjects() {
  return Array.from({ length: SUBJECT_COUNT }, () => ({ name: "", marks: "" }));
}

function emptyForm() {
  return {
    fullName: "",
    motherName: "",
    placeOfBirth: "",
    dateOfBirth: "",
    completedSchool: "Rising Star Primary & Secondary School",
    year: "",
    rollNumber: "",
    issueDate: "",
  };
}

// Turns a user-entered Roll Number into a value that's safe to use as a
// Firestore document ID (matches the id encoded in the certificate's own
// QR code, so /verify/:certificateId always resolves to this same doc).
function toSafeDocId(rawId) {
  return rawId.trim().replace(/[\/\s]+/g, "-");
}

// Average of every subject that actually has a numeric mark entered.
function computeAverage(subjects) {
  const marks = subjects
    .map((s) => Number(s.marks))
    .filter((n) => !isNaN(n) && s_hasValue(n));
  if (marks.length === 0) return "";
  const avg = marks.reduce((a, b) => a + b, 0) / marks.length;
  return Math.round(avg * 10) / 10; // one decimal place
}
function s_hasValue(n) {
  return n !== null && n !== undefined && !isNaN(n);
}

function formatDate(d) {
  if (!d) return "—";
  const dateObj = d?.seconds ? new Date(d.seconds * 1000) : new Date(d);
  if (isNaN(dateObj.getTime())) return "—";
  return dateObj.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fileToResizedDataUrl(file, maxEdge = 500, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxEdge) {
          height = Math.round((height * maxEdge) / width);
          width = maxEdge;
        } else if (height > maxEdge) {
          width = Math.round((width * maxEdge) / height);
          height = maxEdge;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function downloadCertificateImage(name, elementId = "certificate-render-card") {
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
    link.download = `Certificate-${(name || "student").replace(/\s+/g, "-")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  } catch (err) {
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
      link.download = `Certificate-${(name || "student").replace(/\s+/g, "-")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      alert("Sawirka lama soo dagin (CORS). Shahaadada waa la soo dejiyay iyada oo aan sawirka lahayn.");
    } catch (err2) {
      console.log("Falling back to print view:", err2);
      printCertificate(elementId);
    }
  }
}

// Opens a clean print window containing ONLY the certificate card (no
// sidebar, no form) sized to A4 landscape, and triggers the browser print
// dialog — same paper-output pattern used for ID cards.
function printCertificate(elementId = "certificate-render-card") {
  const node = document.getElementById(elementId);
  if (!node) return;
  const html = node.outerHTML;
  const win = window.open("", "_blank", "width=1200,height=850");
  if (!win) {
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
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [form, setForm] = useState(emptyForm());
  const [subjects, setSubjects] = useState(emptySubjects());
  const [photo, setPhoto] = useState(""); // data URL for instant preview
  const [photoFile, setPhotoFile] = useState(null); // actual File to upload

  const [previewCert, setPreviewCert] = useState(null); // last-generated cert shown big on the right
  const [viewCert, setViewCert] = useState(null); // cert opened from the Issued list modal
  const [search, setSearch] = useState("");

  const resultAverage = useMemo(() => computeAverage(subjects), [subjects]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "certificates"));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setCertificates(list);
    } catch (e) {
      console.error("Error loading certificates:", e);
    } finally {
      setLoading(false);
    }
  }

  const filteredCertificates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return certificates;
    return certificates.filter(
      (c) =>
        (c.fullName || "").toLowerCase().includes(q) ||
        (c.rollNumber || c.id || "").toString().toLowerCase().includes(q)
    );
  }, [certificates, search]);

  function updateSubject(index, field, value) {
    setSubjects((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Fadlan dooro sawir (image file) sax ah.");
      return;
    }
    setPhotoFile(file);
    fileToResizedDataUrl(file)
      .then(setPhoto)
      .catch(() => alert("Sawirka lama akhriyi karin. Isku day mid kale."));
  }

  function resetForm() {
    setForm(emptyForm());
    setSubjects(emptySubjects());
    setPhoto("");
    setPhotoFile(null);
  }

  async function handleGenerate() {
    if (!form.fullName.trim() || !form.rollNumber.trim()) {
      alert("Fadlan buuxi ugu yaraan Magaca Ardayga iyo Roll Number.");
      return;
    }
    setSaving(true);
    try {
      const id = toSafeDocId(form.rollNumber);
      const certRef = doc(db, "certificates", id);

      const existing = await getDoc(certRef);
      if (existing.exists()) {
        const overwrite = window.confirm(
          `Roll Number "${form.rollNumber}" horeyba shahaado ayaa loo sameeyay. Ma rabtaa inaad ku beddesho (overwrite)?`
        );
        if (!overwrite) {
          setSaving(false);
          return;
        }
      }

      // Upload photo to Storage if a new one was picked; otherwise keep
      // whatever was already saved for this cert (on overwrite).
      let photoUrl = existing.exists() ? existing.data().studentPhoto || "" : "";
      if (photoFile) {
        setUploadingPhoto(true);
        try {
          const photoRef = ref(
            storage,
            `certificate-photos/${id}/${Date.now()}_${photoFile.name}`
          );
          await uploadBytes(photoRef, photoFile);
          photoUrl = await getDownloadURL(photoRef);
        } finally {
          setUploadingPhoto(false);
        }
      } else if (photo) {
        // No file object (rare) but we have a data URL — store that directly.
        photoUrl = photo;
      }

      const cleanSubjects = subjects
        .filter((s) => s.name.trim() || s.marks.toString().trim())
        .map((s) => ({ name: s.name.trim(), marks: s.marks.toString().trim() }));

      const certData = {
        fullName: form.fullName.trim(),
        motherName: form.motherName.trim(),
        placeOfBirth: form.placeOfBirth.trim(),
        dateOfBirth: form.dateOfBirth.trim(),
        completedSchool: form.completedSchool.trim(),
        year: form.year.trim(),
        rollNumber: form.rollNumber.trim(),
        issueDate: form.issueDate.trim(),
        resultAverage: resultAverage === "" ? "" : resultAverage,
        subjects: cleanSubjects,
        studentPhoto: photoUrl,
        createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(certRef, certData);
      setPreviewCert({ id, ...certData });
      resetForm();
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
      if (viewCert?.id === cert.id) setViewCert(null);
      await load();
    } catch (e) {
      console.error("Error deleting certificate:", e);
    }
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F3F4F8", fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      <Sidebar />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: "22px 26px 0" }}>
          <Topbar />
        </div>

        <div style={{ padding: "26px 30px" }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#111827", margin: "0 0 4px" }}>
            Class Leaving Certificates
          </h1>
          <p style={{ fontSize: 13.5, color: "#6B7280", margin: "0 0 24px" }}>
            Buuxi xogta ardayga si buuxda, kadibna riix Generate si loo abuuro shahaadada
            oo lagu daro liiska Issued Certificates.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 22 }} className="cert-row">
            {/* Left: full manual form */}
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
                Certificate Details
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <Field label="Full Name (Ardayga)">
                  <input
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    placeholder="e.g. Mohamed Omar Abdulle"
                    style={inputStyle}
                  />
                </Field>
                <Field label="Mother's Name">
                  <input
                    value={form.motherName}
                    onChange={(e) => setForm({ ...form, motherName: e.target.value })}
                    placeholder="e.g. Caasho Ahmed Ali"
                    style={inputStyle}
                  />
                </Field>
                <div style={{ display: "flex", gap: 12 }}>
                  <Field label="Place of Birth">
                    <input
                      value={form.placeOfBirth}
                      onChange={(e) => setForm({ ...form, placeOfBirth: e.target.value })}
                      placeholder="e.g. Muqdisho"
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Date of Birth">
                    <input
                      value={form.dateOfBirth}
                      onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                      placeholder="e.g. 01/01/2008"
                      style={inputStyle}
                    />
                  </Field>
                </div>
                <Field label="Completed Primary School">
                  <input
                    value={form.completedSchool}
                    onChange={(e) => setForm({ ...form, completedSchool: e.target.value })}
                    style={inputStyle}
                  />
                </Field>
                <div style={{ display: "flex", gap: 12 }}>
                  <Field label="Year">
                    <input
                      value={form.year}
                      onChange={(e) => setForm({ ...form, year: e.target.value })}
                      placeholder="e.g. 2026/2027"
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Roll Number">
                    <input
                      value={form.rollNumber}
                      onChange={(e) => setForm({ ...form, rollNumber: e.target.value })}
                      placeholder="e.g. 0001"
                      style={inputStyle}
                    />
                  </Field>
                </div>
                <Field label="Date of Issue">
                  <input
                    value={form.issueDate}
                    onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
                    placeholder="e.g. 01/07/2026"
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
                      {photo ? (
                        <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <span style={{ fontSize: 10, color: "#9CA3AF" }}>No photo</span>
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
                      {photo ? "Change Photo" : "Upload Photo"}
                      <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: "none" }} />
                    </label>
                  </div>
                </Field>

                <div style={{ fontSize: 12.5, color: "#6B7280", fontWeight: 700, marginTop: 6 }}>
                  Maadooyinka (12) — Subject + Marks
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "24px 1fr 70px", gap: 8, alignItems: "center" }}>
                  {subjects.map((s, i) => (
                    <div key={i} style={{ display: "contents" }}>
                      <span style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center" }}>{i + 1}</span>
                      <input
                        value={s.name}
                        onChange={(e) => updateSubject(i, "name", e.target.value)}
                        placeholder={`Subject ${i + 1}`}
                        style={{ ...inputStyle, padding: "7px 10px" }}
                      />
                      <input
                        value={s.marks}
                        onChange={(e) => updateSubject(i, "marks", e.target.value)}
                        placeholder="Marks"
                        style={{ ...inputStyle, padding: "7px 10px" }}
                      />
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 4,
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "#EFFBF3",
                    border: "1px solid rgba(22,101,52,0.15)",
                  }}
                >
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: GREEN }}>Result Average (auto)</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: GREEN }}>
                    {resultAverage === "" ? "—" : `${resultAverage}%`}
                  </span>
                </div>
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
                {uploadingPhoto ? "Uploading photo…" : saving ? "Saving…" : "Generate Certificate"}
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
                  <button
                    onClick={() => printCertificate("certificate-render-card")}
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
                    🖨️ Print Certificate
                  </button>
                </>
              )}
            </div>

            {/* Right: live preview of what's currently in the form / last generated */}
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
              <div style={{ width: "100%", overflowX: "auto" }}>
                <CertificateCard
                  certificate={{
                    fullName: form.fullName,
                    motherName: form.motherName,
                    placeOfBirth: form.placeOfBirth,
                    dateOfBirth: form.dateOfBirth,
                    completedSchool: form.completedSchool,
                    year: form.year,
                    rollNumber: form.rollNumber,
                    resultAverage,
                    subjects,
                    studentPhoto: photo,
                    issueDate: form.issueDate,
                  }}
                  verifyUrl={
                    form.rollNumber
                      ? `${VERIFY_BASE_URL}/${encodeURIComponent(toSafeDocId(form.rollNumber))}`
                      : ""
                  }
                  elementId="certificate-render-card"
                />
              </div>
            </div>
          </div>

          {/* Issued Certificates list */}
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>
                Issued Certificates ({filteredCertificates.length})
              </div>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or Roll Number…"
                style={{ ...inputStyle, width: 260 }}
              />
            </div>
            {loading ? (
              <p style={{ fontSize: 13, color: "#9CA3AF" }}>Loading…</p>
            ) : filteredCertificates.length === 0 ? (
              <p style={{ fontSize: 13, color: "#9CA3AF" }}>No certificates issued yet.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 640 }}>
                <thead>
                  <tr style={{ color: "#9CA3AF", textAlign: "left" }}>
                    <th style={{ fontWeight: 600, paddingBottom: 8 }}>Photo</th>
                    <th style={{ fontWeight: 600, paddingBottom: 8 }}>Student</th>
                    <th style={{ fontWeight: 600, paddingBottom: 8 }}>Year</th>
                    <th style={{ fontWeight: 600, paddingBottom: 8 }}>Roll No</th>
                    <th style={{ fontWeight: 600, paddingBottom: 8 }}>Average</th>
                    <th style={{ fontWeight: 600, paddingBottom: 8 }}>Issued</th>
                    <th style={{ fontWeight: 600, paddingBottom: 8 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCertificates.map((c) => (
                    <tr key={c.id} style={{ borderTop: "1px solid #F3F4F6" }}>
                      <td style={{ padding: "10px 0" }}>
                        <StudentAvatar photo={c.studentPhoto} name={c.fullName} size={36} />
                      </td>
                      <td style={{ padding: "10px 0", color: "#111827", fontWeight: 600 }}>{c.fullName}</td>
                      <td style={{ color: "#6B7280" }}>{c.year}</td>
                      <td style={{ color: "#6B7280", fontFamily: "monospace" }}>{c.rollNumber || c.id}</td>
                      <td style={{ color: "#6B7280" }}>{c.resultAverage !== "" && c.resultAverage != null ? `${c.resultAverage}%` : "—"}</td>
                      <td style={{ color: "#6B7280" }}>{formatDate(c.createdAt)}</td>
                      <td>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => setViewCert(c)} style={smallBtnStyle}>View</button>
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

      {/* Full-screen "View" modal — opened from the Issued Certificates list */}
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
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#111827" }}>
                {viewCert.fullName} — Certificate
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() => downloadCertificateImage(viewCert.fullName, "certificate-view-modal-card")}
                  style={{ padding: "8px 14px", borderRadius: 10, border: `1.5px solid ${GREEN}`, background: "#fff", color: GREEN, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
                >
                  ⬇️ Download
                </button>
                <button
                  onClick={() => printCertificate("certificate-view-modal-card")}
                  style={{ padding: "8px 14px", borderRadius: 10, border: `1.5px solid ${GREEN}`, background: "#fff", color: GREEN, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
                >
                  🖨️ Print
                </button>
                <button
                  onClick={() => setViewCert(null)}
                  style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid rgba(17,24,39,0.15)", background: "#fff", color: "#6B7280", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
                >
                  ✕ Close
                </button>
              </div>
            </div>
            <div style={{ width: "100%", overflowX: "auto" }}>
              <CertificateCard
                certificate={viewCert}
                verifyUrl={`${VERIFY_BASE_URL}/${encodeURIComponent(viewCert.id)}`}
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
        <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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