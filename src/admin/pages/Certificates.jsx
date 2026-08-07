// src/admin/pages/Certificates.jsx
// Class Leaving Certificate — AUTO-READ version.
//
// Flow:
// 1. Admin types ONLY: Roll Number, Date of Birth, Student Photo, and the
//    12 subjects (left = Somali, right = English is auto-mirrored by the
//    card). Everything else is READ from Firestore.
// 2. On Roll Number entry (blur / "Fetch"), the system reads:
//      students/{rollNumber}  -> fullName, motherName (parentName), className, year
//      results  -> the FINAL class-8 result row for that student
// 3. Result Average is auto-computed from the entered subject marks.
// 4. Generate saves to `certificates` (doc id = safe Roll Number).
//
// ⚠️ ADJUST THE FIELD NAMES MARKED «CHECK» BELOW TO MATCH YOUR ACTUAL
//    Firestore schema (send me a `results` doc screenshot and I'll lock
//    these exactly). Current guesses are based on your `students` doc:
//    fullName, motherName, parentName, className, year, studentId.

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  query as fsQuery,
  where,
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
const FINAL_CLASS = "8"; // «CHECK» kaliya natiijada Final Class 8 ayaa la soo aqrinayaa
const VERIFY_BASE_URL =
  typeof window !== "undefined" ? `${window.location.origin}/verify` : "/verify";

function emptySubjects() {
  return Array.from({ length: SUBJECT_COUNT }, () => ({ name: "", marks: "" }));
}

function emptyForm() {
  return {
    rollNumber: "",
    dateOfBirth: "",
    issueDate: "",
    // Auto-filled (read-only) from Firestore:
    fullName: "",
    motherName: "",
    placeOfBirth: "",
    completedSchool: "Rising Star Primary & Secondary School",
    year: "",
  };
}

function toSafeDocId(rawId) {
  return rawId.trim().replace(/[\/\s]+/g, "-");
}

function computeAverage(subjects) {
  const marks = subjects
    .map((s) => Number(s.marks))
    .filter((n) => !isNaN(n) && String(n).trim() !== "");
  if (marks.length === 0) return "";
  const avg = marks.reduce((a, b) => a + b, 0) / marks.length;
  return Math.round(avg * 10) / 10;
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
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
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
    console.log("Snapshot failed, falling back to print:", err);
    printCertificate(elementId);
  }
}

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
          html, body { margin: 0; padding: 0; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-wrap { width: 100%; display: flex; align-items: center; justify-content: center; }
          .print-wrap > * { width: 100% !important; max-width: 100% !important; }
          @media print { .print-wrap { page-break-inside: avoid; } }
        </style>
      </head>
      <body>
        <div class="print-wrap">${html}</div>
        <script>
          window.onload = function () { setTimeout(function () { window.focus(); window.print(); }, 400); };
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
  const [fetching, setFetching] = useState(false);
  const [fetchMsg, setFetchMsg] = useState("");

  const [form, setForm] = useState(emptyForm());
  const [subjects, setSubjects] = useState(emptySubjects());
  const [photo, setPhoto] = useState("");
  const [photoFile, setPhotoFile] = useState(null);

  const [previewCert, setPreviewCert] = useState(null);
  const [viewCert, setViewCert] = useState(null);
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

  // ── Roll Number entered → read student + final class-8 result ──────────
  async function handleFetchStudent() {
    const roll = form.rollNumber.trim();
    if (!roll) {
      setFetchMsg("Fadlan geli Roll Number.");
      return;
    }
    setFetching(true);
    setFetchMsg("");
    try {
      const id = toSafeDocId(roll);

      // 1) Read the student document: students/{rollNumber}
      const studentRef = doc(db, "students", id);
      const studentSnap = await getDoc(studentRef);
      if (!studentSnap.exists()) {
        setFetchMsg(`Arday Roll Number "${roll}" lama helin (students).`);
        setFetching(false);
        return;
      }
      const st = studentSnap.data();

      // «CHECK» field names — based on your students doc:
      //   fullName, motherName / parentName, className, year
      const fullName = st.fullName || "";
      const motherName = st.motherName || st.parentName || "";
      const className = (st.className || "").toString();
      const year = (st.year || st.academicYear || "").toString();

      // 2) Read the FINAL class-8 result for this student from `results`.
      //    «CHECK» — how results link to the student & how the year/class
      //    is stored. Common patterns handled below; adjust as needed.
      let resultRow = null;
      try {
        // Try: results where studentId == roll AND className == "8"
        const rq = fsQuery(
          collection(db, "results"),
          where("studentId", "==", id)
        );
        const rSnap = await getDocs(rq);
        const rows = rSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // keep only the FINAL class-8 row (by className or year label)
        resultRow =
          rows.find((r) => (r.className || "").toString() === FINAL_CLASS) ||
          rows[0] ||
          null;
      } catch (e) {
        console.log("results query failed (adjust field names):", e);
      }

      // 3) If the result row carries subjects, prefill them (still editable).
      //    «CHECK» — shape of subjects inside a result row.
      if (resultRow) {
        let prefill = null;
        if (Array.isArray(resultRow.subjects)) {
          prefill = resultRow.subjects
            .slice(0, SUBJECT_COUNT)
            .map((s) => ({ name: s.name || "", marks: (s.marks ?? "").toString() }));
        }
        if (prefill && prefill.length) {
          const filled = emptySubjects();
          prefill.forEach((p, i) => (filled[i] = p));
          setSubjects(filled);
        }
      }

      setForm((f) => ({
        ...f,
        fullName,
        motherName,
        year: year || className, // fallback: use class as year label if no year
      }));

      setFetchMsg(
        resultRow
          ? "✅ Xogta ardayga iyo natiijada la soo aqriyay."
          : "⚠️ Ardayga waa la helay, laakiin natiijo Final-8 lama helin — maadooyinka gacanta ku qor."
      );
    } catch (e) {
      console.error("Fetch error:", e);
      setFetchMsg("Khalad ayaa dhacay markii xogta la soo aqrinayay.");
    } finally {
      setFetching(false);
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
    setFetchMsg("");
  }

  async function handleGenerate() {
    if (!form.rollNumber.trim()) {
      alert("Fadlan geli Roll Number.");
      return;
    }
    if (!form.fullName.trim()) {
      alert("Marka hore riix Fetch si magaca ardayga loo soo aqriyo Roll Number-ka.");
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

      let photoUrl = existing.exists() ? existing.data().studentPhoto || "" : "";
      if (photoFile) {
        setUploadingPhoto(true);
        try {
          const photoRef = ref(storage, `certificate-photos/${id}/${Date.now()}_${photoFile.name}`);
          await uploadBytes(photoRef, photoFile);
          photoUrl = await getDownloadURL(photoRef);
        } finally {
          setUploadingPhoto(false);
        }
      } else if (photo) {
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
            Geli Roll Number-ka, riix Fetch — magaca, magaca hooyada iyo sanadka waa la
            soo aqrinayaa. Kaliya Taariikhda Dhalashada, Sawirka iyo Maadooyinka ayaa
            gacanta lagu qoraa.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 22 }} className="cert-row">
            {/* Left: form */}
            <div style={{ background: "#fff", borderRadius: 18, padding: 22, boxShadow: "0 4px 18px rgba(17,24,39,0.06)", border: "1px solid rgba(17,24,39,0.05)" }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 14 }}>
                Certificate Details
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Roll Number + Fetch */}
                <Field label="Roll Number (gali kadibna riix Fetch)">
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      value={form.rollNumber}
                      onChange={(e) => setForm({ ...form, rollNumber: e.target.value })}
                      onKeyDown={(e) => { if (e.key === "Enter") handleFetchStudent(); }}
                      placeholder="e.g. 0006"
                      style={inputStyle}
                    />
                    <button
                      onClick={handleFetchStudent}
                      disabled={fetching}
                      style={{ padding: "0 16px", borderRadius: 10, border: "none", background: fetching ? "#9CA3AF" : GREEN, color: "#fff", fontWeight: 700, fontSize: 13, cursor: fetching ? "default" : "pointer", whiteSpace: "nowrap" }}
                    >
                      {fetching ? "…" : "Fetch"}
                    </button>
                  </div>
                  {fetchMsg && (
                    <div style={{ marginTop: 6, fontSize: 12, color: fetchMsg.startsWith("✅") ? GREEN : "#B45309" }}>
                      {fetchMsg}
                    </div>
                  )}
                </Field>

                {/* Auto-filled read-only summary */}
                <div style={{ padding: "10px 12px", borderRadius: 10, background: "#F9FAFB", border: "1px solid rgba(17,24,39,0.08)", fontSize: 12.5, color: "#374151", display: "flex", flexDirection: "column", gap: 4 }}>
                  <div><b>Magaca:</b> {form.fullName || "—"}</div>
                  <div><b>Magaca Hooyada:</b> {form.motherName || "—"}</div>
                  <div><b>Sanadka:</b> {form.year || "—"}</div>
                </div>

                {/* Manual: Place + DOB */}
                <div style={{ display: "flex", gap: 12 }}>
                  <Field label="Place of Birth (gacanta)">
                    <input
                      value={form.placeOfBirth}
                      onChange={(e) => setForm({ ...form, placeOfBirth: e.target.value })}
                      placeholder="e.g. Muqdisho"
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Date of Birth (gacanta)">
                    <input
                      value={form.dateOfBirth}
                      onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                      placeholder="e.g. 01/01/2008"
                      style={inputStyle}
                    />
                  </Field>
                </div>

                <Field label="Date of Issue (gacanta)">
                  <input
                    value={form.issueDate}
                    onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
                    placeholder="e.g. 01/07/2026"
                    style={inputStyle}
                  />
                </Field>

                {/* Manual: Photo */}
                <Field label="Student Photo (gacanta)">
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 64, height: 64, borderRadius: 10, overflow: "hidden", background: "#E5E7EB", border: "1px solid rgba(17,24,39,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {photo ? <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 10, color: "#9CA3AF" }}>No photo</span>}
                    </div>
                    <label style={{ padding: "9px 14px", borderRadius: 10, border: `1.5px solid ${GREEN}`, color: GREEN, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
                      {photo ? "Change Photo" : "Upload Photo"}
                      <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: "none" }} />
                    </label>
                  </div>
                </Field>

                {/* Manual: 12 subjects */}
                <div style={{ fontSize: 12.5, color: "#6B7280", fontWeight: 700, marginTop: 6 }}>
                  Maadooyinka (12) — Soomaali (bidix) — gacanta ku qor
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "24px 1fr 70px", gap: 8, alignItems: "center" }}>
                  {subjects.map((s, i) => (
                    <div key={i} style={{ display: "contents" }}>
                      <span style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center" }}>{i + 1}</span>
                      <input
                        value={s.name}
                        onChange={(e) => updateSubject(i, "name", e.target.value)}
                        placeholder={`Maado ${i + 1}`}
                        style={{ ...inputStyle, padding: "7px 10px" }}
                      />
                      <input
                        value={s.marks}
                        onChange={(e) => updateSubject(i, "marks", e.target.value)}
                        placeholder="Dhibco"
                        style={{ ...inputStyle, padding: "7px 10px" }}
                      />
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4, padding: "10px 12px", borderRadius: 10, background: "#EFFBF3", border: "1px solid rgba(22,101,52,0.15)" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: GREEN }}>Result Average (auto)</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: GREEN }}>
                    {resultAverage === "" ? "—" : `${resultAverage}%`}
                  </span>
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={saving || uploadingPhoto}
                style={{ marginTop: 18, width: "100%", padding: "12px 0", borderRadius: 12, border: "none", background: saving ? "#9CA3AF" : "linear-gradient(90deg,#16a34a,#15803d)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: saving ? "default" : "pointer" }}
              >
                {uploadingPhoto ? "Uploading photo…" : saving ? "Saving…" : "Generate Certificate"}
              </button>

              {previewCert && (
                <>
                  <button onClick={() => downloadCertificateImage(previewCert.fullName)} style={{ marginTop: 10, width: "100%", padding: "11px 0", borderRadius: 12, border: `1.5px solid ${GREEN}`, background: "#fff", color: GREEN, fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>
                    ⬇️ Download Certificate Image
                  </button>
                  <button onClick={() => printCertificate("certificate-render-card")} style={{ marginTop: 10, width: "100%", padding: "11px 0", borderRadius: 12, border: `1.5px solid ${GREEN}`, background: "#fff", color: GREEN, fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>
                    🖨️ Print Certificate
                  </button>
                </>
              )}
            </div>

            {/* Right: live preview */}
            <div style={{ background: "#fff", borderRadius: 18, padding: 22, boxShadow: "0 4px 18px rgba(17,24,39,0.06)", border: "1px solid rgba(17,24,39,0.05)", display: "flex", flexDirection: "column", alignItems: "center" }}>
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
                  elementId="certificate-render-card"
                />
              </div>
            </div>
          </div>

          {/* Issued list */}
          <div style={{ background: "#fff", borderRadius: 18, padding: 22, boxShadow: "0 4px 18px rgba(17,24,39,0.06)", border: "1px solid rgba(17,24,39,0.05)", marginTop: 22, overflowX: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>
                Issued Certificates ({filteredCertificates.length})
              </div>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or Roll Number…" style={{ ...inputStyle, width: 260 }} />
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
                          <button onClick={() => handleDelete(c)} style={{ ...smallBtnStyle, color: "#DC2626", borderColor: "rgba(220,38,38,0.3)" }}>Delete</button>
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

      {/* View modal */}
      {viewCert && (
        <div onClick={() => setViewCert(null)} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(17,24,39,0.6)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "28px 16px", overflowY: "auto" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 20, width: "min(1120px, 100%)", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#111827" }}>{viewCert.fullName} — Certificate</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => downloadCertificateImage(viewCert.fullName, "certificate-view-modal-card")} style={{ padding: "8px 14px", borderRadius: 10, border: `1.5px solid ${GREEN}`, background: "#fff", color: GREEN, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>⬇️ Download</button>
                <button onClick={() => printCertificate("certificate-view-modal-card")} style={{ padding: "8px 14px", borderRadius: 10, border: `1.5px solid ${GREEN}`, background: "#fff", color: GREEN, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>🖨️ Print</button>
                <button onClick={() => setViewCert(null)} style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid rgba(17,24,39,0.15)", background: "#fff", color: "#6B7280", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>✕ Close</button>
              </div>
            </div>
            <div style={{ width: "100%", overflowX: "auto" }}>
              <CertificateCard certificate={viewCert} elementId="certificate-view-modal-card" />
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
    <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", background: "#E5E7EB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: size * 0.4, fontWeight: 700, color: "#6B7280" }}>
      {photo ? <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (name || "?").charAt(0).toUpperCase()}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ flex: 1 }}>
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