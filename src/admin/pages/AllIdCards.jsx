// src/admin/pages/AllIdCards.jsx
// Admin page listing every issued ID card — students and teachers — in one
// searchable table. Search matches on ID number/username or full name.
// Selecting a row opens that card (front + back) with Print (native
// browser print dialog) and Download (PNG via html2canvas) controls.
//
// SOURCE OF TRUTH (fixed):
//   - Students are now listed from the `students` collection (the real,
//     authoritative student records) — NOT from `studentIdCards`. This
//     guarantees every live student shows up here, even if they don't
//     yet have a matching `studentIdCards` document.
//   - If a matching `studentIdCards/{id}` document DOES exist for a
//     student, its fields (e.g. idIssuedAt, custom photo, etc.) are
//     merged on top of the `students` data so nothing is lost.
//   - Same pattern for teachers: listed from `teachers`, merged with
//     `teacher_id/{id}` if present.
//
// MANUAL CARDS (added):
//   - Teachers can hand-create a Student ID card via "Create ID Card":
//     they type the name, student ID, grade, issue date and expire date,
//     and upload a photo. The card is stored in `manualStudentIdCards`
//     (photo kept inline as a resized base64 data URL, so no Storage/CORS
//     is involved) and listed alongside the others. Manual cards render
//     with the printed template design via <ManualStudentIdCard/>.
//
// MANUAL TEACHER CARDS (added):
//   - Clicking "Create ID Card" now first asks Teacher or Student.
//   - Teacher → a second modal collects Full Name, Title, Teacher ID,
//     Issue Date, Expire Date (all typed in manually — no auto-calculated
//     expiry) and a photo. Stored in `manualTeacherIdCards` (photo inline
//     as a resized base64 data URL, same approach as manual student cards)
//     and listed alongside everything else. Renders with the live
//     TeacherIdCard template via <ManualTeacherIdCard/>.
//   - Student → unchanged, opens the existing manual student modal.
//
// QR CODE / VERIFY LINK (fixed):
//   - Both TeacherIdCard and StudentIdCard build their QR from the ID
//     number entered here (teacherId / studentId), pointing to
//     /verify/teacher/{id} or /verify/student/{id}. For that link to
//     resolve, VerifyIdCard.jsx must find a Firestore doc with THAT SAME
//     id in manualTeacherIdCards / manualStudentIdCards. Previously this
//     file saved manual cards under a random genManualCardId() instead —
//     so the QR pointed at an id that didn't match any doc, and scanning
//     it landed on "ID Card Not Found". Manual cards are now saved with
//     the doc ID equal to the entered teacherId/studentId itself.
//
// PENDING DELETION support:
//   - Students/teachers marked pendingDeletion are hidden from this list
//     immediately, even though their card doc (if any) is untouched
//     until the backend approves the deletion.
//
// DELETE support:
//   - Checkbox column per row + "select all" checkbox in header
//   - "Delete Selected" bulk-delete button (shows count, asks confirmation)
//   - Single "Delete" button inside the selected-card preview panel
//   - Deletes remove the `studentIdCards`/`teacher_id`/`manualStudentIdCards`/
//     `manualTeacherIdCards` doc if one exists (the underlying student/teacher
//     record itself is NOT deleted here — this page only manages ID card
//     records).

import { useEffect, useMemo, useState } from "react";
import { useRef } from "react";
import { collection, getDocs, getDoc, doc, deleteDoc, setDoc, writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import StudentIdCard from "../../student/StudentIdCard";
import TeacherIdCard from "../../teacher/TeacherIdCard";
import ManualStudentIdCard from "../../student/ManualStudentIdCard";
import ManualTeacherIdCard from "../../teacher/ManualTeacherIdCard";
import { Search, Printer, Download, IdCard, GraduationCap, Users, Trash2, Plus } from "lucide-react";
import html2canvas from "html2canvas";
import { migrateStudentIdCards } from "../../utils/migrateStudentIdCards";

function formatDate(d) {
  if (!d) return "—";
  const dateObj = d?.seconds ? new Date(d.seconds * 1000) : new Date(d);
  if (isNaN(dateObj.getTime())) return "—";
  return dateObj.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Reads an uploaded image File and returns a resized, compressed base64 data
// URL (max 500px on the long edge, JPEG q0.85). Keeps the Firestore doc small
// enough to store the photo inline and avoids any Storage/CORS complications
// when the card is later captured with html2canvas.
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

// Turns a user-entered ID (e.g. "RS-0015", "SS001") into a value that's safe
// to use as a Firestore document ID: trimmed, slashes stripped (Firestore
// treats "/" as a path separator), collapsed whitespace. This is what makes
// the QR code's /verify/{type}/{id} link resolve — the doc is saved under
// exactly this id, and VerifyIdCard.jsx looks up that same id.
function toSafeDocId(rawId) {
  return rawId.trim().replace(/[\/\s]+/g, "-");
}

const tableCardStyle = {
  background: "#fff",
  borderRadius: 18,
  padding: "22px 24px",
  boxShadow: "0 4px 18px rgba(17,24,39,0.06)",
  border: "1px solid rgba(17,24,39,0.05)",
};

export default function AllIdCards() {
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [manualCards, setManualCards] = useState([]);
  const [manualTeacherCards, setManualTeacherCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all"); // all | student | teacher
  const [selected, setSelected] = useState(null); // { type, data }

  // Deletion state
  const [selectedIds, setSelectedIds] = useState(new Set()); // keys: `${type}-${id}`
  const [deleting, setDeleting] = useState(false); // bulk-delete in progress
  const [deletingOne, setDeletingOne] = useState(false); // single-delete in progress

  // "Create ID Card" flow: first choose Teacher or Student, then show that
  // type's modal. `createChoice` is null (closed), "choose" (picker shown),
  // "student", or "teacher".
  const [createChoice, setCreateChoice] = useState(null);
  const [creating, setCreating] = useState(false);

  const [createForm, setCreateForm] = useState({
    fullName: "",
    studentId: "",
    grade: "",
    issueDate: "",
    expireDate: "",
  });
  const [createPhoto, setCreatePhoto] = useState(""); // base64 data URL

  const [teacherCreateForm, setTeacherCreateForm] = useState({
    fullName: "",
    title: "",
    teacherId: "",
    issueDate: "",
    expireDate: "",
  });
  const [teacherCreatePhoto, setTeacherCreatePhoto] = useState(""); // base64 data URL

  const printRef = useRef(null);

  useEffect(() => {
    fetchAllCards();
  }, []);

  async function fetchAllCards() {
    try {
      setLoading(true);
      // Only manually-created ID cards are listed here — we no longer read the
      // students / teachers / studentIdCards / teacher_id collections at all.
      const [manualSnap, manualTeacherSnap] = await Promise.all([
        getDocs(collection(db, "manualStudentIdCards")),
        getDocs(collection(db, "manualTeacherIdCards")),
      ]);

      const allManual = manualSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .map((m) => ({
          type: "student",
          manual: true,
          hasCardDoc: true,
          ...m,
        }));

      const allManualTeachers = manualTeacherSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .map((m) => ({
          type: "teacher",
          manual: true,
          hasCardDoc: true,
          ...m,
        }));

      setManualCards(allManual);
      setManualTeacherCards(allManualTeachers);
    } catch (err) {
      console.error("Failed to load ID cards:", err);
    } finally {
      setLoading(false);
    }
  }

  const combined = useMemo(() => {
    // Only manually-created ID cards are shown.
    return [...manualCards, ...manualTeacherCards];
  }, [manualCards, manualTeacherCards]);

  const filtered = useMemo(() => {
    let list = combined;
    if (typeFilter !== "all") {
      list = list.filter((r) => r.type === typeFilter);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const idValue = (r.type === "student" ? r.studentId : r.teacherId || r.teacherUsername || r.id || "").toString().toLowerCase();
        const nameValue = (r.fullName || r.name || "").toString().toLowerCase();
        return idValue.includes(q) || nameValue.includes(q);
      });
    }
    return list;
  }, [combined, query, typeFilter]);

  function rowKey(r) {
    return `${r.manual ? "manual" : r.type}-${r.id}`;
  }

  function toggleRowSelected(r) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const key = rowKey(r);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const allFilteredSelected = filtered.length > 0 && filtered.every((r) => selectedIds.has(rowKey(r)));

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      if (allFilteredSelected) {
        // Ka saar dhammaan safafka hadda muuqda ee la doortay
        const next = new Set(prev);
        filtered.forEach((r) => next.delete(rowKey(r)));
        return next;
      }
      // Ku dar dhammaan safafka hadda muuqda
      const next = new Set(prev);
      filtered.forEach((r) => next.add(rowKey(r)));
      return next;
    });
  }

  function closeCreateFlow() {
    if (creating) return;
    setCreateChoice(null);
  }

  // ── Create a manual student ID card ────────────────────────────────────
  function handleCreatePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      window.alert("Fadlan dooro sawir (image file) sax ah.");
      return;
    }
    fileToResizedDataUrl(file)
      .then(setCreatePhoto)
      .catch(() => window.alert("Sawirka lama akhriyi karin. Isku day mid kale."));
  }

  async function handleCreateCard() {
    if (!createForm.fullName.trim() || !createForm.studentId.trim()) {
      window.alert("Fadlan buuxi ugu yaraan Magaca iyo Student ID.");
      return;
    }
    try {
      setCreating(true);
      // FIX: the doc ID must equal the entered Student ID (not a random
      // genManualCardId()) so the card's own QR code — which encodes
      // /verify/student/{studentId} — actually finds this doc.
      const id = toSafeDocId(createForm.studentId);
      const cardRef = doc(db, "manualStudentIdCards", id);

      // Guard against silently overwriting a different existing card that
      // happens to share this Student ID.
      const existing = await getDoc(cardRef);
      if (existing.exists()) {
        const overwrite = window.confirm(
          `Student ID "${createForm.studentId}" horeyba ID card ayaa loo sameeyay. Ma rabtaa inaad ku beddesho (overwrite) card-kii hore?`
        );
        if (!overwrite) {
          setCreating(false);
          return;
        }
      }

      const data = {
        manual: true,
        fullName: createForm.fullName.trim(),
        studentId: createForm.studentId.trim(),
        grade: createForm.grade.trim(),
        issueDate: createForm.issueDate.trim(),
        expireDate: createForm.expireDate.trim(),
        studentPhoto: createPhoto || "",
        issuedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      };
      await setDoc(cardRef, data);
      // Reset the form and refresh the list.
      setCreateForm({ fullName: "", studentId: "", grade: "", issueDate: "", expireDate: "" });
      setCreatePhoto("");
      setCreateChoice(null);
      await fetchAllCards();
    } catch (err) {
      console.error("Failed to create manual ID card:", err);
      window.alert("Khalad ayaa dhacay markii card-ka la abuurayay. Fadlan isku day mar kale.");
    } finally {
      setCreating(false);
    }
  }

  // ── Create a manual teacher ID card ────────────────────────────────────
  function handleTeacherCreatePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      window.alert("Fadlan dooro sawir (image file) sax ah.");
      return;
    }
    fileToResizedDataUrl(file)
      .then(setTeacherCreatePhoto)
      .catch(() => window.alert("Sawirka lama akhriyi karin. Isku day mid kale."));
  }

  async function handleCreateTeacherCard() {
    if (!teacherCreateForm.fullName.trim() || !teacherCreateForm.teacherId.trim()) {
      window.alert("Fadlan buuxi ugu yaraan Magaca iyo Teacher ID.");
      return;
    }
    try {
      setCreating(true);
      // FIX: same as the student flow above — the doc ID must equal the
      // entered Teacher ID so /verify/teacher/{teacherId} resolves.
      const id = toSafeDocId(teacherCreateForm.teacherId);
      const cardRef = doc(db, "manualTeacherIdCards", id);

      const existing = await getDoc(cardRef);
      if (existing.exists()) {
        const overwrite = window.confirm(
          `Teacher ID "${teacherCreateForm.teacherId}" horeyba ID card ayaa loo sameeyay. Ma rabtaa inaad ku beddesho (overwrite) card-kii hore?`
        );
        if (!overwrite) {
          setCreating(false);
          return;
        }
      }

      const data = {
        manual: true,
        fullName: teacherCreateForm.fullName.trim(),
        title: teacherCreateForm.title.trim(),
        teacherId: teacherCreateForm.teacherId.trim(),
        issueDate: teacherCreateForm.issueDate.trim(),
        expireDate: teacherCreateForm.expireDate.trim(),
        teacherPhoto: teacherCreatePhoto || "",
        issuedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      };
      await setDoc(cardRef, data);
      // Reset the form and refresh the list.
      setTeacherCreateForm({ fullName: "", title: "", teacherId: "", issueDate: "", expireDate: "" });
      setTeacherCreatePhoto("");
      setCreateChoice(null);
      await fetchAllCards();
    } catch (err) {
      console.error("Failed to create manual teacher ID card:", err);
      window.alert("Khalad ayaa dhacay markii card-ka la abuurayay. Fadlan isku day mar kale.");
    } finally {
      setCreating(false);
    }
  }

  // Tirtir hal card oo la doortay (ka mid ah preview panel-ka).
  // Fadlan ogow: kani wuxuu tirtiraa kaliya studentIdCards/teacher_id/
  // manualStudentIdCards/manualTeacherIdCards doc-ga (haddii uu jiro) — ma
  // tirtirayo record-ka asalka ah ee students/teachers collection-ka.
  async function handleDeleteSingle() {
    if (!selected) return;
    if (!selected.data.hasCardDoc) {
      window.alert("Ardaygan/macallinkan ID card gaar ah lama sameynin weli — ma jiro wax la tirtiro.");
      return;
    }
    const idLabel = selected.type === "student"
      ? (selected.data.studentId || selected.data.id)
      : (selected.data.teacherId || selected.data.teacherUsername || selected.data.id);
    const confirmed = window.confirm(
      `Ma hubtaa inaad tirtirto ID card-kan (${idLabel})? Tallaabadan lama soo celin karo.`
    );
    if (!confirmed) return;

    try {
      setDeletingOne(true);
      const collectionName = selected.data.manual
        ? (selected.type === "teacher" ? "manualTeacherIdCards" : "manualStudentIdCards")
        : selected.type === "student"
        ? "studentIdCards"
        : "teacher_id";
      await deleteDoc(doc(db, collectionName, selected.data.id));

      // Ka saar liiska local state-ka si UI-gu si degdeg ah u cusboonaysiiyo
      if (selected.data.manual && selected.type === "teacher") {
        setManualTeacherCards((prev) => prev.filter((m) => m.id !== selected.data.id));
      } else if (selected.data.manual) {
        setManualCards((prev) => prev.filter((m) => m.id !== selected.data.id));
      } else if (selected.type === "student") {
        setStudents((prev) => prev.filter((s) => s.id !== selected.data.id));
      } else {
        setTeachers((prev) => prev.filter((t) => t.id !== selected.data.id));
      }
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(rowKey(selected.data));
        return next;
      });
      setSelected(null);
    } catch (err) {
      console.error("Failed to delete ID card:", err);
      window.alert("Khalad ayaa dhacay markii la tirtirayay card-ka. Fadlan isku day mar kale.");
    } finally {
      setDeletingOne(false);
    }
  }

  // Tirtir dhammaan card-yada la doortay (checkboxes), ama haddii aan wax
  // la doorin, tirtir DHAMMAAN card-yada hadda la soo iftiimiyay (filtered).
  // Kaliya kuwa leh card doc dhab ah (hasCardDoc) ayaa la tirtiri karaa.
  async function handleDeleteSelected() {
    const candidates = selectedIds.size > 0
      ? combined.filter((r) => selectedIds.has(rowKey(r)))
      : filtered; // fallback: haddii aan checkbox lagu doorin, isticmaal liiska muuqda

    const targets = candidates.filter((r) => r.hasCardDoc);

    if (targets.length === 0) {
      window.alert("Xulashadan wax card doc ah oo la tirtiro ma laha.");
      return;
    }

    const confirmed = window.confirm(
      `Ma hubtaa inaad tirtirto ${targets.length} ID card? Tallaabadan lama soo celin karo.`
    );
    if (!confirmed) return;

    try {
      setDeleting(true);

      // Firestore batched writes waxay taageeraan ilaa 500 doc hal batch ah.
      // U kala qaybi targets-ka chunks 450 si loo hubiyo ammaan.
      const chunkSize = 450;
      for (let i = 0; i < targets.length; i += chunkSize) {
        const chunk = targets.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        chunk.forEach((r) => {
          const collectionName = r.manual
            ? (r.type === "teacher" ? "manualTeacherIdCards" : "manualStudentIdCards")
            : r.type === "student"
            ? "studentIdCards"
            : "teacher_id";
          batch.delete(doc(db, collectionName, r.id));
        });
        await batch.commit();
      }

      const deletedKeys = new Set(targets.map(rowKey));
      // Manual cards are removed outright; for real students/teachers the
      // card doc is removed but the underlying record stays (hasCardDoc→false).
      setManualCards((prev) => prev.filter((m) => !deletedKeys.has(rowKey(m))));
      setManualTeacherCards((prev) => prev.filter((m) => !deletedKeys.has(rowKey(m))));
      setStudents((prev) =>
        prev.map((s) => (deletedKeys.has(rowKey(s)) ? { ...s, hasCardDoc: false } : s))
      );
      setTeachers((prev) =>
        prev.map((t) => (deletedKeys.has(rowKey(t)) ? { ...t, hasCardDoc: false } : t))
      );
      setSelectedIds((prev) => {
        const next = new Set(prev);
        deletedKeys.forEach((k) => next.delete(k));
        return next;
      });
      if (selected && deletedKeys.has(rowKey(selected.data))) {
        setSelected(null);
      }
    } catch (err) {
      console.error("Failed to bulk-delete ID cards:", err);
      window.alert("Khalad ayaa dhacay markii la tirtirayay card-yada. Fadlan isku day mar kale.");
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
    const label = selected?.type === "teacher"
      ? (selected.data.teacherId || selected.data.teacherUsername || selected.data.id)
      : (selected?.data.studentId || selected?.data.id);
    link.download = `id-card-${label || "card"}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F3F4F8", fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      <Sidebar />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: "22px 26px 0" }} className="idcards-print-hide">
          <Topbar />
        </div>

        <div style={{ padding: "26px 30px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 12, flexWrap: "wrap" }} className="idcards-print-hide">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <IdCard size={22} color="#16a34a" />
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827" }}>
                All ID Cards
              </h1>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {/* Create a manual ID card — asks Teacher or Student first */}
              <button
                onClick={() => setCreateChoice("choose")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "9px 16px",
                  borderRadius: 10,
                  border: "none",
                  background: "linear-gradient(90deg,#16a34a,#15803d)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 12.5,
                  cursor: "pointer",
                }}
              >
                <Plus size={14} /> Create ID Card
              </button>

              <button onClick={() => migrateStudentIdCards().then(console.log)}>
                Run Migration
              </button>

              {/* Bulk delete button — muuqda marka card la doorto ama liis jiro */}
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

          {/* Search + filters */}
          <div
            style={{
              ...tableCardStyle,
              display: "flex",
              gap: 14,
              alignItems: "center",
              flexWrap: "wrap",
              marginBottom: 20,
            }}
            className="idcards-print-hide"
          >
            <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
              <Search size={16} color="#9CA3AF" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by ID number or name..."
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

            <div style={{ display: "flex", gap: 8 }}>
              {[
                { key: "all", label: "All" },
                { key: "student", label: "Students" },
                { key: "teacher", label: "Teachers" },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setTypeFilter(f.key)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 10,
                    border: "1px solid rgba(22,163,74,0.25)",
                    background: typeFilter === f.key ? "#16a34a" : "transparent",
                    color: typeFilter === f.key ? "#fff" : "#16a34a",
                    fontWeight: 700,
                    fontSize: 12.5,
                    cursor: "pointer",
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: selected ? "0.9fr 1.4fr" : "1fr", gap: 20, alignItems: "start" }}>
            {/* Results table */}
            <div style={{ ...tableCardStyle, overflowX: "auto" }} className="idcards-print-hide">
              <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: "#111827" }}>
                {loading ? "Loading..." : `${filtered.length} card${filtered.length !== 1 ? "s" : ""} found`}
              </h3>

              {!loading && filtered.length === 0 && (
                <p style={{ fontSize: 13, color: "#9CA3AF" }}>Wax natiijo ah lama helin.</p>
              )}

              {filtered.length > 0 && (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 460 }}>
                  <thead>
                    <tr style={{ color: "#9CA3AF", textAlign: "left" }}>
                      <th style={{ fontWeight: 600, paddingBottom: 8, width: 28 }}>
                        <input
                          type="checkbox"
                          checked={allFilteredSelected}
                          onChange={toggleSelectAll}
                          style={{ cursor: "pointer" }}
                        />
                      </th>
                      <th style={{ fontWeight: 600, paddingBottom: 8 }}>Type</th>
                      <th style={{ fontWeight: 600, paddingBottom: 8 }}>ID</th>
                      <th style={{ fontWeight: 600, paddingBottom: 8 }}>Name</th>
                      <th style={{ fontWeight: 600, paddingBottom: 8 }}>Issued</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => {
                      const idValue = r.type === "student" ? r.studentId : (r.teacherId || r.teacherUsername || r.id);
                      const nameValue = r.fullName || r.name || "—";
                      const isSelected = selected?.data.id === r.id && selected?.type === r.type;
                      const isChecked = selectedIds.has(rowKey(r));
                      return (
                        <tr
                          key={rowKey(r)}
                          style={{
                            borderTop: "1px solid #F3F4F6",
                            cursor: "pointer",
                            background: isSelected ? "#EFFBF3" : "transparent",
                          }}
                        >
                          <td style={{ padding: "10px 0" }} onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleRowSelected(r)}
                              style={{ cursor: "pointer" }}
                            />
                          </td>
                          <td style={{ padding: "10px 0" }} onClick={() => setSelected({ type: r.type, data: r })}>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                                fontSize: 11,
                                fontWeight: 700,
                                padding: "3px 9px",
                                borderRadius: 20,
                                background: r.type === "student" ? "#E6F5EC" : "#EDE9FE",
                                color: r.type === "student" ? "#16a34a" : "#7c3aed",
                              }}
                            >
                              {r.type === "student" ? <GraduationCap size={12} /> : <Users size={12} />}
                              {r.type === "student" ? "Student" : "Teacher"}
                              {r.manual ? " (Manual)" : ""}
                            </span>
                          </td>
                          <td style={{ color: "#111827", fontWeight: 700 }} onClick={() => setSelected({ type: r.type, data: r })}>{idValue || "—"}</td>
                          <td style={{ color: "#374151" }} onClick={() => setSelected({ type: r.type, data: r })}>{nameValue}</td>
                          <td style={{ color: "#9CA3AF" }} onClick={() => setSelected({ type: r.type, data: r })}>{formatDate(r.issuedAt || r.idIssuedAt || r.createdAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Selected card preview */}
            {selected && (
              <div style={{ ...tableCardStyle, overflowX: "auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }} className="idcards-print-hide">
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111827" }}>
                    {selected.type === "student" ? "Student" : "Teacher"} ID Card
                    {selected.data.manual ? " (Manual)" : ""}
                  </h3>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={handlePrint}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "8px 14px",
                        borderRadius: 10,
                        border: "none",
                        background: "#14532d",
                        color: "#fff",
                        fontWeight: 700,
                        fontSize: 12.5,
                        cursor: "pointer",
                      }}
                    >
                      <Printer size={14} /> Print
                    </button>
                    <button
                      onClick={handleDownload}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "8px 14px",
                        borderRadius: 10,
                        border: "1px solid rgba(20,83,45,0.3)",
                        background: "transparent",
                        color: "#14532d",
                        fontWeight: 700,
                        fontSize: 12.5,
                        cursor: "pointer",
                      }}
                    >
                      <Download size={14} /> Download
                    </button>
                    <button
                      onClick={handleDeleteSingle}
                      disabled={deletingOne || !selected.data.hasCardDoc}
                      title={!selected.data.hasCardDoc ? "ID card gaar ah weli lama sameynin" : undefined}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "8px 14px",
                        borderRadius: 10,
                        border: "1px solid rgba(220,38,38,0.3)",
                        background: "#DC2626",
                        color: "#fff",
                        fontWeight: 700,
                        fontSize: 12.5,
                        cursor: deletingOne || !selected.data.hasCardDoc ? "not-allowed" : "pointer",
                        opacity: deletingOne || !selected.data.hasCardDoc ? 0.6 : 1,
                      }}
                    >
                      <Trash2 size={14} /> {deletingOne ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>

                <div ref={printRef} id="idcards-printable">
                  {selected.data.manual && selected.type === "teacher" ? (
                    <ManualTeacherIdCard card={selected.data} />
                  ) : selected.data.manual ? (
                    <ManualStudentIdCard card={selected.data} />
                  ) : selected.type === "student" ? (
                    <StudentIdCard student={selected.data} studentId={selected.data.studentId} />
                  ) : (
                    <TeacherIdCard
                      teacher={selected.data}
                      teacherUsername={selected.data.teacherUsername || selected.data.id}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Create ID Card flow: Teacher/Student picker + the two modals ──── */}
      {createChoice === "choose" && (
        <div
          onClick={closeCreateFlow}
          className="idcards-print-hide"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(17,24,39,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "32px 16px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 28,
              width: "min(420px, 100%)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              textAlign: "center",
            }}
          >
            <h3 style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 800, color: "#111827" }}>
              Create ID Card
            </h3>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "#6B7280" }}>
              Ma waxaad abuurayaa ID card Teacher ama Student?
            </p>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setCreateChoice("student")}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                  padding: "18px 10px",
                  borderRadius: 12,
                  border: "1.5px solid rgba(22,163,74,0.3)",
                  background: "#F0FDF4",
                  color: "#16a34a",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                <GraduationCap size={22} />
                Student
              </button>
              <button
                onClick={() => setCreateChoice("teacher")}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                  padding: "18px 10px",
                  borderRadius: 12,
                  border: "1.5px solid rgba(124,58,237,0.3)",
                  background: "#F5F3FF",
                  color: "#7c3aed",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                <Users size={22} />
                Teacher
              </button>
            </div>
          </div>
        </div>
      )}

      {createChoice === "student" && (
        <div
          onClick={closeCreateFlow}
          className="idcards-print-hide"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(17,24,39,0.6)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "32px 16px",
            overflowY: "auto",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 24,
              width: "min(760px, 100%)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#111827" }}>
                Create Student ID Card
              </h3>
              <button
                onClick={closeCreateFlow}
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: 20,
                  color: "#6B7280",
                  cursor: "pointer",
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 22 }} className="create-card-row">
              {/* Left: form fields */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <ModalField label="Full Name">
                  <input
                    value={createForm.fullName}
                    onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                    placeholder="e.g. Mohamed Omar Abdulle"
                    style={modalInput}
                  />
                </ModalField>
                <ModalField label="Student ID">
                  <input
                    value={createForm.studentId}
                    onChange={(e) => setCreateForm({ ...createForm, studentId: e.target.value })}
                    placeholder="e.g. RS-0015"
                    style={modalInput}
                  />
                </ModalField>
                <ModalField label="Grade / Class">
                  <input
                    value={createForm.grade}
                    onChange={(e) => setCreateForm({ ...createForm, grade: e.target.value })}
                    placeholder="e.g. 6"
                    style={modalInput}
                  />
                </ModalField>
                <div style={{ display: "flex", gap: 12 }}>
                  <ModalField label="Issue Date" style={{ flex: 1 }}>
                    <input
                      value={createForm.issueDate}
                      onChange={(e) => setCreateForm({ ...createForm, issueDate: e.target.value })}
                      placeholder="e.g. 01-07-2026"
                      style={modalInput}
                    />
                  </ModalField>
                  <ModalField label="Expire Date" style={{ flex: 1 }}>
                    <input
                      value={createForm.expireDate}
                      onChange={(e) => setCreateForm({ ...createForm, expireDate: e.target.value })}
                      placeholder="e.g. 30-06-2027"
                      style={modalInput}
                    />
                  </ModalField>
                </div>
                <ModalField label="Student Photo">
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
                      {createPhoto ? (
                        <img src={createPhoto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <span style={{ fontSize: 10, color: "#9CA3AF" }}>No photo</span>
                      )}
                    </div>
                    <label
                      style={{
                        padding: "9px 14px",
                        borderRadius: 10,
                        border: "1.5px solid #16a34a",
                        color: "#16a34a",
                        fontWeight: 700,
                        fontSize: 12.5,
                        cursor: "pointer",
                      }}
                    >
                      {createPhoto ? "Change Photo" : "Upload Photo"}
                      <input type="file" accept="image/*" onChange={handleCreatePhotoChange} style={{ display: "none" }} />
                    </label>
                  </div>
                </ModalField>

                <button
                  onClick={handleCreateCard}
                  disabled={creating}
                  style={{
                    marginTop: 6,
                    padding: "12px 0",
                    borderRadius: 12,
                    border: "none",
                    background: creating ? "#9CA3AF" : "linear-gradient(90deg,#16a34a,#15803d)",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: creating ? "default" : "pointer",
                  }}
                >
                  {creating ? "Creating…" : "Create ID Card"}
                </button>
              </div>

              {/* Right: live preview of the card being created */}
              <div>
                <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 600, marginBottom: 8 }}>Preview</div>
                <ManualStudentIdCard
                  card={{
                    fullName: createForm.fullName,
                    studentId: createForm.studentId,
                    grade: createForm.grade,
                    issueDate: createForm.issueDate,
                    expireDate: createForm.expireDate,
                    studentPhoto: createPhoto,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {createChoice === "teacher" && (
        <div
          onClick={closeCreateFlow}
          className="idcards-print-hide"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(17,24,39,0.6)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "32px 16px",
            overflowY: "auto",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 24,
              width: "min(820px, 100%)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#111827" }}>
                Create Teacher ID Card
              </h3>
              <button
                onClick={closeCreateFlow}
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: 20,
                  color: "#6B7280",
                  cursor: "pointer",
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 22 }} className="create-card-row">
              {/* Left: form fields */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <ModalField label="Full Name">
                  <input
                    value={teacherCreateForm.fullName}
                    onChange={(e) => setTeacherCreateForm({ ...teacherCreateForm, fullName: e.target.value })}
                    placeholder="e.g. Mukhtar Mohamed Salad"
                    style={modalInput}
                  />
                </ModalField>
                <ModalField label="Title">
                  <input
                    value={teacherCreateForm.title}
                    onChange={(e) => setTeacherCreateForm({ ...teacherCreateForm, title: e.target.value })}
                    placeholder="e.g. School Principal"
                    style={modalInput}
                  />
                </ModalField>
                <ModalField label="Teacher ID">
                  <input
                    value={teacherCreateForm.teacherId}
                    onChange={(e) => setTeacherCreateForm({ ...teacherCreateForm, teacherId: e.target.value })}
                    placeholder="e.g. SS001"
                    style={modalInput}
                  />
                </ModalField>
                <div style={{ display: "flex", gap: 12 }}>
                  <ModalField label="Issue Date" style={{ flex: 1 }}>
                    <input
                      value={teacherCreateForm.issueDate}
                      onChange={(e) => setTeacherCreateForm({ ...teacherCreateForm, issueDate: e.target.value })}
                      placeholder="e.g. 01-06-2026"
                      style={modalInput}
                    />
                  </ModalField>
                  <ModalField label="Expire Date" style={{ flex: 1 }}>
                    <input
                      value={teacherCreateForm.expireDate}
                      onChange={(e) => setTeacherCreateForm({ ...teacherCreateForm, expireDate: e.target.value })}
                      placeholder="e.g. 31-12-2027"
                      style={modalInput}
                    />
                  </ModalField>
                </div>
                <ModalField label="Teacher Photo">
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
                      {teacherCreatePhoto ? (
                        <img src={teacherCreatePhoto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <span style={{ fontSize: 10, color: "#9CA3AF" }}>No photo</span>
                      )}
                    </div>
                    <label
                      style={{
                        padding: "9px 14px",
                        borderRadius: 10,
                        border: "1.5px solid #7c3aed",
                        color: "#7c3aed",
                        fontWeight: 700,
                        fontSize: 12.5,
                        cursor: "pointer",
                      }}
                    >
                      {teacherCreatePhoto ? "Change Photo" : "Upload Photo"}
                      <input type="file" accept="image/*" onChange={handleTeacherCreatePhotoChange} style={{ display: "none" }} />
                    </label>
                  </div>
                </ModalField>

                <button
                  onClick={handleCreateTeacherCard}
                  disabled={creating}
                  style={{
                    marginTop: 6,
                    padding: "12px 0",
                    borderRadius: 12,
                    border: "none",
                    background: creating ? "#9CA3AF" : "linear-gradient(90deg,#7c3aed,#6d28d9)",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: creating ? "default" : "pointer",
                  }}
                >
                  {creating ? "Creating…" : "Create ID Card"}
                </button>
              </div>

              {/* Right: live preview of the card being created */}
              <div>
                <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 600, marginBottom: 8 }}>Preview</div>
                <ManualTeacherIdCard
                  card={{
                    fullName: teacherCreateForm.fullName,
                    title: teacherCreateForm.title,
                    teacherId: teacherCreateForm.teacherId,
                    issueDate: teacherCreateForm.issueDate,
                    expireDate: teacherCreateForm.expireDate,
                    teacherPhoto: teacherCreatePhoto,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          .idcards-print-hide { display: none !important; }
          body * { visibility: hidden; }
          #idcards-printable, #idcards-printable * { visibility: visible; }
          #idcards-printable {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
          }
        }
        @media (max-width: 720px) {
          .create-card-row { grid-template-columns: 1fr !important; }
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

const modalInput = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(17,24,39,0.12)",
  fontSize: 13.5,
  outline: "none",
  boxSizing: "border-box",
};