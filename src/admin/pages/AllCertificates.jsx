// src/admin/pages/AllCertificates.jsx
// Admin page for creating and managing Class Leaving Certificates.
// Mirrors the pattern used by admin/pages/AllIdCards.jsx: a searchable
// table of every issued certificate, a "Create Certificate" flow with a
// live preview, and Print / Download controls on the selected certificate.
//
// Certificates are stored in the `certificates` Firestore collection.
// VerifyCertificate.jsx (public, no login) looks a certificate up by its
// Firestore doc ID at /verify/:certificateId — so the doc ID here is set
// to the entered Roll Number (made filesystem/Firestore-safe), which is
// what the certificate's own QR code encodes. This keeps the same
// "QR opens the original design" guarantee used for the ID cards.
//
// The certificate itself renders via <CertificateCard/>, which overlays
// the entered data onto the real printed certificate artwork
// (certificate-template.png) — never a redrawn approximation of it.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  deleteDoc,
  setDoc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase/firebase";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import CertificateCard from "../components/CertificateCard";
import { Search, Printer, Download, FileBadge, Trash2, Plus } from "lucide-react";
import html2canvas from "html2canvas";

const SUBJECT_COUNT = 12;
const VERIFY_BASE_URL = "https://risingstarschools.com";

function emptySubjects() {
  return Array.from({ length: SUBJECT_COUNT }, () => ({ name: "", marks: "" }));
}

function formatDate(d) {
  if (!d) return "—";
  const dateObj = d?.seconds ? new Date(d.seconds * 1000) : new Date(d);
  if (isNaN(dateObj.getTime())) return "—";
  return dateObj.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Turns a user-entered Roll Number into a value that's safe to use as a
// Firestore document ID (matches the id encoded in the certificate's own
// QR code, so /verify/:certificateId always resolves to this same doc).
function toSafeDocId(rawId) {
  return rawId.trim().replace(/[\/\s]+/g, "-");
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

const tableCardStyle = {
  background: "#fff",
  borderRadius: 18,
  padding: "22px 24px",
  boxShadow: "0 4px 18px rgba(17,24,39,0.06)",
  border: "1px solid rgba(17,24,39,0.05)",
};

const modalInput = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(17,24,39,0.12)",
  fontSize: 13.5,
  outline: "none",
  boxSizing: "border-box",
};

export default function AllCertificates() {
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null); // certificate object

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const [deletingOne, setDeletingOne] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    fullName: "",
    motherName: "",
    placeOfBirth: "",
    dateOfBirth: "",
    completedSchool: "Rising Star Primary & Secondary School",
    year: "",
    rollNumber: "",
    resultAverage: "",
    issueDate: "",
  });
  const [subjects, setSubjects] = useState(emptySubjects());
  const [photo, setPhoto] = useState("");

  const printRef = useRef(null);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, "certificates"));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCertificates(list);
    } catch (err) {
      console.error("Failed to load certificates:", err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return certificates;
    return certificates.filter((c) => {
      const idValue = (c.rollNumber || c.id || "").toString().toLowerCase();
      const nameValue = (c.fullName || "").toString().toLowerCase();
      return idValue.includes(q) || nameValue.includes(q);
    });
  }, [certificates, query]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id));

  function toggleRowSelected(c) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(c.id)) next.delete(c.id);
      else next.add(c.id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filtered.forEach((c) => next.delete(c.id));
      } else {
        filtered.forEach((c) => next.add(c.id));
      }
      return next;
    });
  }

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
      window.alert("Fadlan dooro sawir (image file) sax ah.");
      return;
    }
    fileToResizedDataUrl(file)
      .then(setPhoto)
      .catch(() => window.alert("Sawirka lama akhriyi karin. Isku day mid kale."));
  }

  function closeCreate() {
    if (creating) return;
    setCreateOpen(false);
  }

  async function handleCreate() {
    if (!form.fullName.trim() || !form.rollNumber.trim()) {
      window.alert("Fadlan buuxi ugu yaraan Magaca Ardayga iyo Roll Number.");
      return;
    }
    try {
      setCreating(true);
      // Doc ID = Roll Number, so this certificate's own QR code
      // (/verify/{rollNumber}) always resolves to this exact doc.
      const id = toSafeDocId(form.rollNumber);
      const certRef = doc(db, "certificates", id);

      const existing = await getDoc(certRef);
      if (existing.exists()) {
        const overwrite = window.confirm(
          `Roll Number "${form.rollNumber}" horeyba shahaado ayaa loo sameeyay. Ma rabtaa inaad ku beddesho (overwrite) shahaadadii hore?`
        );
        if (!overwrite) {
          setCreating(false);
          return;
        }
      }

      const data = {
        fullName: form.fullName.trim(),
        motherName: form.motherName.trim(),
        placeOfBirth: form.placeOfBirth.trim(),
        dateOfBirth: form.dateOfBirth.trim(),
        completedSchool: form.completedSchool.trim(),
        year: form.year.trim(),
        rollNumber: form.rollNumber.trim(),
        resultAverage: form.resultAverage.trim(),
        issueDate: form.issueDate.trim(),
        subjects: subjects
          .filter((s) => s.name.trim() || s.marks.toString().trim())
          .map((s) => ({ name: s.name.trim(), marks: s.marks.toString().trim() })),
        studentPhoto: photo || "",
        createdAt: serverTimestamp(),
      };
      await setDoc(certRef, data);

      setForm({
        fullName: "",
        motherName: "",
        placeOfBirth: "",
        dateOfBirth: "",
        completedSchool: "Rising Star Primary & Secondary School",
        year: "",
        rollNumber: "",
        resultAverage: "",
        issueDate: "",
      });
      setSubjects(emptySubjects());
      setPhoto("");
      setCreateOpen(false);
      await fetchAll();
    } catch (err) {
      console.error("Failed to create certificate:", err);
      window.alert("Khalad ayaa dhacay markii shahaadada la abuurayay. Fadlan isku day mar kale.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteSingle() {
    if (!selected) return;
    const confirmed = window.confirm(
      `Ma hubtaa inaad tirtirto shahaadadan (${selected.rollNumber || selected.id})? Tallaabadan lama soo celin karo.`
    );
    if (!confirmed) return;
    try {
      setDeletingOne(true);
      await deleteDoc(doc(db, "certificates", selected.id));
      setCertificates((prev) => prev.filter((c) => c.id !== selected.id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(selected.id);
        return next;
      });
      setSelected(null);
    } catch (err) {
      console.error("Failed to delete certificate:", err);
      window.alert("Khalad ayaa dhacay markii la tirtirayay shahaadada. Fadlan isku day mar kale.");
    } finally {
      setDeletingOne(false);
    }
  }

  async function handleDeleteSelected() {
    const targets = selectedIds.size > 0 ? certificates.filter((c) => selectedIds.has(c.id)) : filtered;
    if (targets.length === 0) {
      window.alert("Xulashadan wax shahaado ah oo la tirtiro ma laha.");
      return;
    }
    const confirmed = window.confirm(
      `Ma hubtaa inaad tirtirto ${targets.length} shahaado? Tallaabadan lama soo celin karo.`
    );
    if (!confirmed) return;
    try {
      setDeleting(true);
      const chunkSize = 450;
      for (let i = 0; i < targets.length; i += chunkSize) {
        const chunk = targets.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        chunk.forEach((c) => batch.delete(doc(db, "certificates", c.id)));
        await batch.commit();
      }
      const deletedIds = new Set(targets.map((c) => c.id));
      setCertificates((prev) => prev.filter((c) => !deletedIds.has(c.id)));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        deletedIds.forEach((id) => next.delete(id));
        return next;
      });
      if (selected && deletedIds.has(selected.id)) setSelected(null);
    } catch (err) {
      console.error("Failed to bulk-delete certificates:", err);
      window.alert("Khalad ayaa dhacay markii la tirtirayay shahaadaha. Fadlan isku day mar kale.");
    } finally {
      setDeleting(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  async function handleDownload() {
    if (!printRef.current) return;
    const canvas = await html2canvas(printRef.current, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
    });
    const link = document.createElement("a");
    link.download = `certificate-${selected?.rollNumber || selected?.id || "card"}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F3F4F8", fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      <Sidebar />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: "22px 26px 0" }} className="cert-print-hide">
          <Topbar />
        </div>

        <div style={{ padding: "26px 30px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 12, flexWrap: "wrap" }} className="cert-print-hide">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <FileBadge size={22} color="#166534" />
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827" }}>
                All Certificates
              </h1>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={() => setCreateOpen(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "9px 16px",
                  borderRadius: 10,
                  border: "none",
                  background: "linear-gradient(90deg,#166534,#14532d)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 12.5,
                  cursor: "pointer",
                }}
              >
                <Plus size={14} /> Create Certificate
              </button>

              <button
                onClick={handleDeleteSelected}
                disabled={deleting || filtered.length === 0}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "9px 16px",
                  borderRadius: 10,
                  border: "1px solid rgba(220,38,38,0.3)",
                  background: selectedIds.size > 0 ? "#DC2626" : "transparent",
                  color: selectedIds.size > 0 ? "#fff" : "#DC2626",
                  fontWeight: 700,
                  fontSize: 12.5,
                  cursor: deleting || filtered.length === 0 ? "not-allowed" : "pointer",
                  opacity: deleting || filtered.length === 0 ? 0.6 : 1,
                }}
              >
                <Trash2 size={14} />
                {deleting
                  ? "Deleting..."
                  : selectedIds.size > 0
                  ? `Delete Selected (${selectedIds.size})`
                  : "Delete All Shown"}
              </button>
            </div>
          </div>

          <div
            style={{ ...tableCardStyle, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginBottom: 20 }}
            className="cert-print-hide"
          >
            <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
              <Search size={16} color="#9CA3AF" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by Roll Number or name..."
                style={{
                  width: "100%",
                  padding: "10px 12px 10px 36px",
                  borderRadius: 10,
                  border: "1px solid rgba(17,24,39,0.1)",
                  fontSize: 13.5,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: selected ? "0.9fr 1.6fr" : "1fr", gap: 20, alignItems: "start" }}>
            <div style={{ ...tableCardStyle, overflowX: "auto" }} className="cert-print-hide">
              <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: "#111827" }}>
                {loading ? "Loading..." : `${filtered.length} certificate${filtered.length !== 1 ? "s" : ""} found`}
              </h3>

              {!loading && filtered.length === 0 && (
                <p style={{ fontSize: 13, color: "#9CA3AF" }}>Wax natiijo ah lama helin.</p>
              )}

              {filtered.length > 0 && (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 420 }}>
                  <thead>
                    <tr style={{ color: "#9CA3AF", textAlign: "left" }}>
                      <th style={{ fontWeight: 600, paddingBottom: 8, width: 28 }}>
                        <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAll} style={{ cursor: "pointer" }} />
                      </th>
                      <th style={{ fontWeight: 600, paddingBottom: 8 }}>Roll No</th>
                      <th style={{ fontWeight: 600, paddingBottom: 8 }}>Name</th>
                      <th style={{ fontWeight: 600, paddingBottom: 8 }}>Issued</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => {
                      const isSelected = selected?.id === c.id;
                      const isChecked = selectedIds.has(c.id);
                      return (
                        <tr
                          key={c.id}
                          style={{ borderTop: "1px solid #F3F4F6", cursor: "pointer", background: isSelected ? "#EFFBF3" : "transparent" }}
                        >
                          <td style={{ padding: "10px 0" }} onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" checked={isChecked} onChange={() => toggleRowSelected(c)} style={{ cursor: "pointer" }} />
                          </td>
                          <td style={{ color: "#111827", fontWeight: 700 }} onClick={() => setSelected(c)}>{c.rollNumber || c.id}</td>
                          <td style={{ color: "#374151" }} onClick={() => setSelected(c)}>{c.fullName || "—"}</td>
                          <td style={{ color: "#9CA3AF" }} onClick={() => setSelected(c)}>{formatDate(c.createdAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {selected && (
              <div style={{ ...tableCardStyle, overflowX: "auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }} className="cert-print-hide">
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111827" }}>
                    Certificate — {selected.fullName}
                  </h3>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={handlePrint}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "none", background: "#14532d", color: "#fff", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
                    >
                      <Printer size={14} /> Print
                    </button>
                    <button
                      onClick={handleDownload}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "1px solid rgba(20,83,45,0.3)", background: "transparent", color: "#14532d", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
                    >
                      <Download size={14} /> Download
                    </button>
                    <button
                      onClick={handleDeleteSingle}
                      disabled={deletingOne}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "1px solid rgba(220,38,38,0.3)", background: "#DC2626", color: "#fff", fontWeight: 700, fontSize: 12.5, cursor: deletingOne ? "not-allowed" : "pointer", opacity: deletingOne ? 0.6 : 1 }}
                    >
                      <Trash2 size={14} /> {deletingOne ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>

                <div ref={printRef} id="cert-printable">
                  <CertificateCard
                    certificate={selected}
                    verifyUrl={`${VERIFY_BASE_URL}/verify/${encodeURIComponent(selected.id)}`}
                    elementId="cert-print-front"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {createOpen && (
        <div
          onClick={closeCreate}
          className="cert-print-hide"
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(17,24,39,0.6)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "32px 16px", overflowY: "auto" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 16, padding: 24, width: "min(1100px, 100%)", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#111827" }}>Create Certificate</h3>
              <button onClick={closeCreate} style={{ border: "none", background: "transparent", fontSize: 20, color: "#6B7280", cursor: "pointer", lineHeight: 1 }}>✕</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: 22 }} className="cert-create-row">
              {/* Left: form fields */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: "70vh", overflowY: "auto", paddingRight: 4 }}>
                <ModalField label="Full Name (Ardayga)">
                  <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="e.g. Mohamed Omar Abdulle" style={modalInput} />
                </ModalField>
                <ModalField label="Mother's Name">
                  <input value={form.motherName} onChange={(e) => setForm({ ...form, motherName: e.target.value })} placeholder="e.g. Caasho Ahmed Ali" style={modalInput} />
                </ModalField>
                <div style={{ display: "flex", gap: 12 }}>
                  <ModalField label="Place of Birth" style={{ flex: 1 }}>
                    <input value={form.placeOfBirth} onChange={(e) => setForm({ ...form, placeOfBirth: e.target.value })} placeholder="e.g. Muqdisho" style={modalInput} />
                  </ModalField>
                  <ModalField label="Date of Birth" style={{ flex: 1 }}>
                    <input value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} placeholder="e.g. 01/01/2008" style={modalInput} />
                  </ModalField>
                </div>
                <ModalField label="Completed Primary School">
                  <input value={form.completedSchool} onChange={(e) => setForm({ ...form, completedSchool: e.target.value })} style={modalInput} />
                </ModalField>
                <div style={{ display: "flex", gap: 12 }}>
                  <ModalField label="Year" style={{ flex: 1 }}>
                    <input value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="e.g. 2026/2027" style={modalInput} />
                  </ModalField>
                  <ModalField label="Roll Number" style={{ flex: 1 }}>
                    <input value={form.rollNumber} onChange={(e) => setForm({ ...form, rollNumber: e.target.value })} placeholder="e.g. 0001" style={modalInput} />
                  </ModalField>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <ModalField label="Result Average" style={{ flex: 1 }}>
                    <input value={form.resultAverage} onChange={(e) => setForm({ ...form, resultAverage: e.target.value })} placeholder="e.g. 89" style={modalInput} />
                  </ModalField>
                  <ModalField label="Date of Issue" style={{ flex: 1 }}>
                    <input value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} placeholder="e.g. 01/07/2026" style={modalInput} />
                  </ModalField>
                </div>

                <ModalField label="Student Photo">
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 64, height: 64, borderRadius: 10, overflow: "hidden", background: "#E5E7EB", border: "1px solid rgba(17,24,39,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {photo ? <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 10, color: "#9CA3AF" }}>No photo</span>}
                    </div>
                    <label style={{ padding: "9px 14px", borderRadius: 10, border: "1.5px solid #166534", color: "#166534", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
                      {photo ? "Change Photo" : "Upload Photo"}
                      <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: "none" }} />
                    </label>
                  </div>
                </ModalField>

                <div style={{ fontSize: 12.5, color: "#6B7280", fontWeight: 700, marginTop: 6 }}>
                  Maadooyinka (12) — Subject + Marks
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "24px 1fr 70px", gap: 8, alignItems: "center" }}>
                  {subjects.map((s, i) => (
                    <>
                      <span key={`no-${i}`} style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center" }}>{i + 1}</span>
                      <input
                        key={`name-${i}`}
                        value={s.name}
                        onChange={(e) => updateSubject(i, "name", e.target.value)}
                        placeholder={`Subject ${i + 1}`}
                        style={{ ...modalInput, padding: "7px 10px" }}
                      />
                      <input
                        key={`marks-${i}`}
                        value={s.marks}
                        onChange={(e) => updateSubject(i, "marks", e.target.value)}
                        placeholder="Marks"
                        style={{ ...modalInput, padding: "7px 10px" }}
                      />
                    </>
                  ))}
                </div>

                <button
                  onClick={handleCreate}
                  disabled={creating}
                  style={{ marginTop: 10, padding: "12px 0", borderRadius: 12, border: "none", background: creating ? "#9CA3AF" : "linear-gradient(90deg,#166534,#14532d)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: creating ? "default" : "pointer" }}
                >
                  {creating ? "Creating…" : "Create Certificate"}
                </button>
              </div>

              {/* Right: live preview */}
              <div>
                <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 600, marginBottom: 8 }}>Preview</div>
                <div style={{ overflowX: "auto" }}>
                  <CertificateCard
                    certificate={{
                      ...form,
                      subjects,
                      studentPhoto: photo,
                    }}
                    verifyUrl={
                      form.rollNumber
                        ? `${VERIFY_BASE_URL}/verify/${encodeURIComponent(toSafeDocId(form.rollNumber))}`
                        : ""
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          .cert-print-hide { display: none !important; }
          body * { visibility: hidden; }
          #cert-printable, #cert-printable * { visibility: visible; }
          #cert-printable {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
          }
        }
        @media (max-width: 900px) {
          .cert-create-row { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function ModalField({ label, children, style }) {
  return (
    <div style={style}>
      <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 4, fontWeight: 600 }}>{label}</div>
      {children}
    </div>
  );
}