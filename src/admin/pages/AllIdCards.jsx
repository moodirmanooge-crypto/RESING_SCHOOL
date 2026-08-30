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
// STUDENT CARD CREATION — NOW AUTO-FILLED FROM `students` (changed):
//   - The "Create Student ID Card" modal used to ask the admin to type in
//     Full Name, Grade/Class, Issue Date and Expire Date by hand. That is
//     gone. The admin now ONLY types the Student ID (which matches the
//     `studentId` field AND the doc ID inside the `students` collection,
//     e.g. "0001").
//   - On submit, the app looks up `students/{studentId}` in Firestore
//     directly (getDoc by doc ID). If no matching student document
//     exists, it shows an error and creates nothing.
//   - If found, `fullName` and `className` (the grade) are read straight
//     from that student document — never typed in.
//   - Issue Date is always today's date (the day the card is created),
//     computed automatically. Expire Date is always Issue Date + 1 year,
//     computed automatically (same one-year rule StudentIdCard.jsx already
//     used for auto-generated cards). Neither date is ever typed in.
//   - Everything else about manual student cards — Firestore doc ID
//     equal to the Student ID, the QR verify link, ManualStudentIdCard
//     rendering — is unchanged.
//
// MANUAL TEACHER CARDS (added):
//   - Clicking "Create ID Card" now first asks Teacher or Student.
//   - Teacher → a second modal collects Full Name, Title, Teacher ID,
//     Issue Date, Expire Date (all typed in manually — no auto-calculated
//     expiry) and a photo. Stored in `manualTeacherIdCards` (photo inline
//     as a resized base64 data URL, same approach as manual student cards)
//     and listed alongside everything else. Renders with the live
//     TeacherIdCard template via <ManualTeacherIdCard/>.
//   - Student → unchanged in flow (Teacher/Student picker), but the
//     Student modal itself now only asks for the Student ID as described
//     above.
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
// BULK PDF DOWNLOAD (added):
//   - "Download PDF (Selected)" appears next to "Delete Selected" once at
//     least one row's checkbox is ticked. It downloads ONE PDF PER
//     checked card (both Student and Teacher), each file named by that
//     card's own ID — not a single combined PDF.
//   - Because only the currently-selected card is actually mounted in the
//     preview panel, each queued card is rendered one at a time into an
//     off-screen container (bulkPdfRef), given a moment for its photo/QR
//     <img> tags to finish loading, captured with html2canvas, and saved
//     as its own PDF — then the next card in the queue is rendered the
//     same way. This reuses the exact same capture/PDF logic as the
//     single-card "Download PDF" button below.
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

// Formats a JS Date as DD-MM-YYYY, matching the manual-card date fields
// (e.g. "01-07-2026") that ManualStudentIdCard already expects as plain
// strings.
function toDDMMYYYY(dateObj) {
  const day = String(dateObj.getDate()).padStart(2, "0");
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const year = dateObj.getFullYear();
  return `${day}-${month}-${year}`;
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

// The label a card should be saved/downloaded under — its own ID, not a
// Firestore doc id that might differ.
function cardLabel(r) {
  return r.type === "teacher"
    ? r.teacherId || r.teacherUsername || r.id
    : r.studentId || r.id;
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

  // Student creation form — the admin only types the Student ID. Everything
  // else (fullName, grade, issueDate, expireDate) is fetched/computed
  // automatically from the matching `students/{studentId}` Firestore doc,
  // and is kept here only to drive the live preview once fetched.
  const [createStudentId, setCreateStudentId] = useState("");
  const [createLookup, setCreateLookup] = useState(null); // fetched student doc data, or null
  const [createLookupError, setCreateLookupError] = useState("");
  const [fetchingStudent, setFetchingStudent] = useState(false); // Fetch button in progress
  // No manual photo upload for student cards anymore — the photo always
  // comes straight from the student's own `studentPhoto` field in
  // Firestore, loaded by handleFetchStudent below.

  // Teacher creation — the admin only types the Teacher ID or Email that
  // matches a doc in the `teachers` collection (doc ID can be either, per
  // how this school's records are stored). Everything else (fullName,
  // title, photo) is fetched from that doc; issue/expire dates are
  // computed the same way as the student flow (today, +1 year).
  const [createTeacherLookupInput, setCreateTeacherLookupInput] = useState("");
  const [teacherLookup, setTeacherLookup] = useState(null); // fetched teacher doc data, or null
  const [teacherLookupResolvedId, setTeacherLookupResolvedId] = useState(""); // canonical teacherId (username field) to save/display/QR
  const [teacherLookupError, setTeacherLookupError] = useState("");
  const [fetchingTeacher, setFetchingTeacher] = useState(false);

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
    // Reset the student lookup flow so re-opening starts clean.
    setCreateStudentId("");
    setCreateLookup(null);
    setCreateLookupError("");
    // Reset the teacher lookup flow too.
    setCreateTeacherLookupInput("");
    setTeacherLookup(null);
    setTeacherLookupResolvedId("");
    setTeacherLookupError("");
  }

  // ── Create a manual student ID card ────────────────────────────────────
  // Every time the admin edits the Student ID field, clear any previous
  // lookup result/error — a stale fetched name/photo must never be shown
  // next to a Student ID it doesn't belong to. The admin must press
  // "Fetch" again (or Create, which fetches fresh) after changing the ID.
  function handleCreateStudentIdChange(value) {
    setCreateStudentId(value);
    setCreateLookup(null);
    setCreateLookupError("");
  }

  // Looks up `students/{studentId}` in Firestore and loads fullName,
  // className (grade), and studentPhoto straight into the preview — no
  // manual typing or photo upload involved. Used by both the "Fetch"
  // button (preview-only) and handleCreateCard (fetch-then-save).
  async function fetchStudentById(rawId) {
    const studentSnap = await getDoc(doc(db, "students", rawId));
    if (!studentSnap.exists()) {
      return null;
    }
    return studentSnap.data();
  }

  async function handleFetchStudent() {
    const rawId = createStudentId.trim();
    if (!rawId) {
      window.alert("Fadlan geli Student ID-ga.");
      return;
    }
    try {
      setFetchingStudent(true);
      setCreateLookupError("");
      const studentData = await fetchStudentById(rawId);
      if (!studentData) {
        setCreateLookup(null);
        setCreateLookupError(`Student ID "${rawId}" lama helin students collection-ka. Fadlan hubi ID-ga.`);
        return;
      }
      setCreateLookup(studentData);
    } catch (err) {
      console.error("Failed to fetch student:", err);
      window.alert("Khalad ayaa dhacay markii xogta ardayga la soo aqrinayay. Fadlan isku day mar kale.");
    } finally {
      setFetchingStudent(false);
    }
  }

  async function handleCreateCard() {
    const rawId = createStudentId.trim();
    if (!rawId) {
      window.alert("Fadlan geli Student ID-ga.");
      return;
    }
    try {
      setCreating(true);
      setCreateLookupError("");

      // The Student ID entered here is the doc ID inside `students`
      // (matches the `studentId` field on that same doc, e.g. "0001").
      // Always re-fetch fresh on submit (in case the admin pressed Create
      // without pressing Fetch first, or the record changed since) — if it
      // doesn't exist, stop and show an error; no card is created without
      // a real, matching student record.
      const studentData = await fetchStudentById(rawId);
      if (!studentData) {
        setCreateLookup(null);
        setCreateLookupError(`Student ID "${rawId}" lama helin students collection-ka. Fadlan hubi ID-ga.`);
        setCreating(false);
        return;
      }
      setCreateLookup(studentData);

      // FIX: the doc ID must equal the entered Student ID (not a random
      // genManualCardId()) so the card's own QR code — which encodes
      // /verify/student/{studentId} — actually finds this doc.
      const id = toSafeDocId(rawId);
      const cardRef = doc(db, "manualStudentIdCards", id);

      // Guard against silently overwriting a different existing card that
      // happens to share this Student ID.
      const existing = await getDoc(cardRef);
      if (existing.exists()) {
        const overwrite = window.confirm(
          `Student ID "${rawId}" horeyba ID card ayaa loo sameeyay. Ma rabtaa inaad ku beddesho (overwrite) card-kii hore?`
        );
        if (!overwrite) {
          setCreating(false);
          return;
        }
      }

      // Issue Date is always today; Expire Date is always Issue Date + 1
      // year — both computed here, never typed in.
      const today = new Date();
      const issueDateStr = toDDMMYYYY(today);
      const expireDateObj = new Date(today);
      expireDateObj.setFullYear(expireDateObj.getFullYear() + 1);
      const expireDateStr = toDDMMYYYY(expireDateObj);

      const data = {
        manual: true,
        fullName: (studentData.fullName || "").trim(),
        studentId: rawId,
        grade: studentData.className || "",
        issueDate: issueDateStr,
        expireDate: expireDateStr,
        studentPhoto: studentData.studentPhoto || "",
        issuedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      };
      await setDoc(cardRef, data);
      // Reset the form and refresh the list.
      setCreateStudentId("");
      setCreateLookup(null);
      setCreateLookupError("");
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
  // Clears any previous lookup whenever the admin edits the lookup input —
  // a stale fetched name/photo must never be shown next to an ID it
  // doesn't belong to.
  function handleTeacherLookupInputChange(value) {
    setCreateTeacherLookupInput(value);
    setTeacherLookup(null);
    setTeacherLookupResolvedId("");
    setTeacherLookupError("");
  }

  // Looks up `teachers/{idOrEmail}` — this school's teacher docs are keyed
  // either by a short ID (e.g. "0001") or by the teacher's email, both of
  // which work as direct doc IDs here. Returns the doc data, or null if no
  // matching teacher exists.
  async function fetchTeacherById(rawInput) {
    const teacherSnap = await getDoc(doc(db, "teachers", rawInput));
    if (!teacherSnap.exists()) {
      return null;
    }
    return teacherSnap.data();
  }

  async function handleFetchTeacher() {
    const rawInput = createTeacherLookupInput.trim();
    if (!rawInput) {
      window.alert("Fadlan geli Teacher ID ama Email-ka.");
      return;
    }
    try {
      setFetchingTeacher(true);
      setTeacherLookupError("");
      const teacherData = await fetchTeacherById(rawInput);
      if (!teacherData) {
        setTeacherLookup(null);
        setTeacherLookupResolvedId("");
        setTeacherLookupError(`"${rawInput}" lama helin teachers collection-ka. Fadlan hubi ID-ga ama Email-ka.`);
        return;
      }
      setTeacherLookup(teacherData);
      // The card's own displayed ID / doc ID / QR link always use the
      // teacher's canonical `username` field, even if the admin looked the
      // record up by email — falls back to whatever was typed if the doc
      // has no username field.
      setTeacherLookupResolvedId(teacherData.username || rawInput);
    } catch (err) {
      console.error("Failed to fetch teacher:", err);
      window.alert("Khalad ayaa dhacay markii xogta macallinka la soo aqrinayay. Fadlan isku day mar kale.");
    } finally {
      setFetchingTeacher(false);
    }
  }

  async function handleCreateTeacherCard() {
    const rawInput = createTeacherLookupInput.trim();
    if (!rawInput) {
      window.alert("Fadlan geli Teacher ID ama Email-ka.");
      return;
    }
    try {
      setCreating(true);
      setTeacherLookupError("");

      // Always re-fetch fresh on submit (in case the admin pressed Create
      // without pressing Fetch first, or the record changed since) — if it
      // doesn't exist, stop and show an error; no card is created without
      // a real, matching teacher record.
      const teacherData = await fetchTeacherById(rawInput);
      if (!teacherData) {
        setTeacherLookup(null);
        setTeacherLookupResolvedId("");
        setTeacherLookupError(`"${rawInput}" lama helin teachers collection-ka. Fadlan hubi ID-ga ama Email-ka.`);
        setCreating(false);
        return;
      }
      setTeacherLookup(teacherData);
      const resolvedId = teacherData.username || rawInput;
      setTeacherLookupResolvedId(resolvedId);

      // FIX: same as the student flow above — the doc ID must equal the
      // resolved Teacher ID so /verify/teacher/{teacherId} resolves.
      const id = toSafeDocId(resolvedId);
      const cardRef = doc(db, "manualTeacherIdCards", id);

      const existing = await getDoc(cardRef);
      if (existing.exists()) {
        const overwrite = window.confirm(
          `Teacher ID "${resolvedId}" horeyba ID card ayaa loo sameeyay. Ma rabtaa inaad ku beddesho (overwrite) card-kii hore?`
        );
        if (!overwrite) {
          setCreating(false);
          return;
        }
      }

      // Issue Date is always today; Expire Date is always Issue Date + 1
      // year — computed here, same rule as the student flow.
      const today = new Date();
      const issueDateStr = toDDMMYYYY(today);
      const expireDateObj = new Date(today);
      expireDateObj.setFullYear(expireDateObj.getFullYear() + 1);
      const expireDateStr = toDDMMYYYY(expireDateObj);

      const data = {
        manual: true,
        fullName: (teacherData.fullName || "").trim(),
        title: teacherData.title || teacherData.designation || teacherData.role || "Teacher",
        teacherId: resolvedId,
        issueDate: issueDateStr,
        expireDate: expireDateStr,
        teacherPhoto: teacherData.teacherPhoto || "",
        issuedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      };
      await setDoc(cardRef, data);
      // Reset the form and refresh the list.
      setCreateTeacherLookupInput("");
      setTeacherLookup(null);
      setTeacherLookupResolvedId("");
      setTeacherLookupError("");
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

  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Shared capture+save routine: given the DOM node holding a rendered
  // card (front+back) and the label to save it under, produces one PDF
  // and triggers its download. Used by both the single "Download PDF"
  // button and the bulk "Download PDF (Selected)" flow below, so both
  // always produce identical PDFs.
  async function captureNodeToPdf(node, label) {
    const [{ default: html2canvasPro }, jsPDFModule] = await Promise.all([
      import("https://cdn.jsdelivr.net/npm/html2canvas-pro@1.5.8/+esm"),
      import("https://cdn.jsdelivr.net/npm/jspdf@2.5.2/+esm"),
    ]);
    const { jsPDF } = jsPDFModule;

    const canvas = await html2canvasPro(node, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
    });
    const imgData = canvas.toDataURL("image/png");

    // ID cards are tall/portrait content, so the PDF page follows that
    // shape rather than the fixed A4 landscape used for results sheets.
    const imgRatio = canvas.height / canvas.width;
    const pdf = new jsPDF({
      orientation: imgRatio >= 1 ? "portrait" : "landscape",
      unit: "pt",
      format: "a4",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let renderWidth = pageWidth - 40;
    let renderHeight = renderWidth * imgRatio;

    if (renderHeight > pageHeight - 40) {
      renderHeight = pageHeight - 40;
      renderWidth = renderHeight / imgRatio;
    }

    const x = (pageWidth - renderWidth) / 2;
    const y = (pageHeight - renderHeight) / 2;

    pdf.addImage(imgData, "PNG", x, y, renderWidth, renderHeight);
    pdf.save(`id-card-${label || "card"}.pdf`);
  }

  async function handleDownloadPdf() {
    if (!printRef.current || downloadingPdf) return;
    try {
      setDownloadingPdf(true);
      const label = selected?.type === "teacher"
        ? (selected.data.teacherId || selected.data.teacherUsername || selected.data.id)
        : (selected?.data.studentId || selected?.data.id);
      await captureNodeToPdf(printRef.current, label);
    } catch (err) {
      console.error("Failed to generate ID card PDF:", err);
      window.alert("Khalad ayaa dhacay markii PDF-ka la soo saarayay. Fadlan isku day mar kale.");
    } finally {
      setDownloadingPdf(false);
    }
  }

  // ── Bulk "Download PDF (Selected)" ──────────────────────────────────────
  // Only the currently-selected card is mounted in the visible preview
  // panel, so to capture every checked card we render them one at a time
  // into an off-screen container (bulkPdfNode), wait for that card's own
  // <img> tags (photo, QR code) to finish loading, capture it, save its
  // PDF, then move on to the next one in the queue.
  const [bulkPdfQueue, setBulkPdfQueue] = useState([]); // remaining cards still to process
  const [bulkPdfCurrent, setBulkPdfCurrent] = useState(null); // card currently rendered off-screen
  const [bulkPdfRunning, setBulkPdfRunning] = useState(false);
  const [bulkPdfDone, setBulkPdfDone] = useState(0); // how many completed so far, for the button label
  const [bulkPdfTotal, setBulkPdfTotal] = useState(0);
  const bulkPdfRef = useRef(null);

  function handleDownloadSelectedPdf() {
    if (bulkPdfRunning) return;
    const targets = combined.filter((r) => selectedIds.has(rowKey(r)));
    if (targets.length === 0) {
      window.alert("Fadlan xulo ugu yaraan hal ID card (checkbox) si aad PDF ugu soo dejiso.");
      return;
    }
    setBulkPdfRunning(true);
    setBulkPdfTotal(targets.length);
    setBulkPdfDone(0);
    setBulkPdfQueue(targets.slice(1));
    setBulkPdfCurrent(targets[0]);
  }

  function advanceBulkPdfQueue() {
    setBulkPdfDone((prev) => prev + 1);
    setBulkPdfQueue((prev) => {
      if (prev.length === 0) {
        setBulkPdfCurrent(null);
        setBulkPdfRunning(false);
        return prev;
      }
      const [next, ...rest] = prev;
      setBulkPdfCurrent(next);
      return rest;
    });
  }

  useEffect(() => {
    if (!bulkPdfCurrent) return;
    let cancelled = false;

    async function run() {
      // Let React finish mounting the off-screen card before we touch its DOM.
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const node = bulkPdfRef.current;
      if (!node || cancelled) {
        if (!cancelled) advanceBulkPdfQueue();
        return;
      }

      // Wait for every <img> in this card (photo, QR code) to finish
      // loading — otherwise html2canvas can capture it blank.
      const imgs = Array.from(node.querySelectorAll("img"));
      await Promise.all(
        imgs.map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = resolve;
              })
        )
      );
      if (cancelled) return;

      try {
        await captureNodeToPdf(node, cardLabel(bulkPdfCurrent));
      } catch (err) {
        console.error("Failed to generate PDF for", cardLabel(bulkPdfCurrent), err);
      } finally {
        if (!cancelled) advanceBulkPdfQueue();
      }
    }

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulkPdfCurrent]);

  // Live preview data for the "Create Student ID Card" modal. Before a
  // lookup has run (or after one failed), the preview shows the typed
  // Student ID with everything else blank — nothing is guessed.
  const previewToday = toDDMMYYYY(new Date());
  const previewExpire = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return toDDMMYYYY(d);
  })();

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

              {/* Bulk PDF download — one PDF per checked card (student or
                  teacher), only shown once at least one row is checked. */}
              {selectedIds.size > 0 && (
                <button
                  onClick={handleDownloadSelectedPdf}
                  disabled={bulkPdfRunning}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "9px 16px",
                    borderRadius: 10,
                    border: "1px solid rgba(37,99,235,0.3)",
                    background: bulkPdfRunning ? "#E5E7EB" : "#EFF6FF",
                    color: "#2563eb",
                    fontWeight: 700,
                    fontSize: 12.5,
                    cursor: bulkPdfRunning ? "not-allowed" : "pointer",
                    opacity: bulkPdfRunning ? 0.7 : 1,
                  }}
                >
                  <Download size={14} />
                  {bulkPdfRunning
                    ? `Generating PDFs... (${bulkPdfDone}/${bulkPdfTotal})`
                    : `Download PDF (Selected) (${selectedIds.size})`}
                </button>
              )}

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
                      onClick={handleDownloadPdf}
                      disabled={downloadingPdf}
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
                        cursor: downloadingPdf ? "not-allowed" : "pointer",
                        opacity: downloadingPdf ? 0.6 : 1,
                      }}
                    >
                      <Download size={14} /> {downloadingPdf ? "Generating..." : "Download PDF"}
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

      {/* Off-screen container used only during bulk PDF generation — never
          visible to the admin, exists purely so html2canvas has a real
          mounted card (with its photo/QR <img> tags actually loaded) to
          capture for each queued item in turn. */}
      {bulkPdfCurrent && (
        <div style={{ position: "fixed", left: -9999, top: 0, pointerEvents: "none" }} aria-hidden="true">
          <div ref={bulkPdfRef}>
            {bulkPdfCurrent.manual && bulkPdfCurrent.type === "teacher" ? (
              <ManualTeacherIdCard card={bulkPdfCurrent} />
            ) : bulkPdfCurrent.manual ? (
              <ManualStudentIdCard card={bulkPdfCurrent} />
            ) : bulkPdfCurrent.type === "student" ? (
              <StudentIdCard student={bulkPdfCurrent} studentId={bulkPdfCurrent.studentId} />
            ) : (
              <TeacherIdCard
                teacher={bulkPdfCurrent}
                teacherUsername={bulkPdfCurrent.teacherUsername || bulkPdfCurrent.id}
              />
            )}
          </div>
        </div>
      )}

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
              {/* Left: only the Student ID is entered. Everything else is
                  fetched from Firestore (`students/{studentId}`) or
                  computed automatically on submit. */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <ModalField label="Student ID">
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      value={createStudentId}
                      onChange={(e) => handleCreateStudentIdChange(e.target.value)}
                      placeholder="e.g. 0001"
                      style={{ ...modalInput, flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={handleFetchStudent}
                      disabled={fetchingStudent}
                      style={{
                        padding: "0 16px",
                        borderRadius: 10,
                        border: "1.5px solid #16a34a",
                        background: fetchingStudent ? "#E5E7EB" : "#F0FDF4",
                        color: "#16a34a",
                        fontWeight: 700,
                        fontSize: 12.5,
                        cursor: fetchingStudent ? "default" : "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {fetchingStudent ? "Fetching…" : "Fetch"}
                    </button>
                  </div>
                  <div style={{ fontSize: 11.5, color: "#9CA3AF", marginTop: 6 }}>
                    Magaca, Grade-ka, Sawirka, Issue Date iyo Expire Date waxaa
                    si toos ah looga soo qaadanayaa xogta ardaygan ee
                    Firestore — riix "Fetch" si aad u aragto preview-ka, ama
                    toos u riix "Create ID Card".
                  </div>
                </ModalField>

                {createLookupError && (
                  <div style={{ fontSize: 12.5, color: "#DC2626", background: "#FEF2F2", border: "1px solid rgba(220,38,38,0.25)", borderRadius: 8, padding: "8px 10px" }}>
                    {createLookupError}
                  </div>
                )}

                {createLookup && !createLookupError && (
                  <div style={{ fontSize: 12.5, color: "#16a34a", background: "#F0FDF4", border: "1px solid rgba(22,163,74,0.25)", borderRadius: 8, padding: "8px 10px" }}>
                    Waa la helay: {createLookup.fullName} — Grade {createLookup.className || "—"}
                  </div>
                )}

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

              {/* Right: live preview. Shows the fetched student's data once
                  a lookup has run (name/grade from Firestore, dates
                  computed automatically); blank fields otherwise. */}
              <div>
                <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 600, marginBottom: 8 }}>Preview</div>
                <ManualStudentIdCard
                  card={{
                    fullName: createLookup?.fullName || "",
                    studentId: createStudentId,
                    grade: createLookup?.className || "",
                    issueDate: createLookup ? previewToday : "",
                    expireDate: createLookup ? previewExpire : "",
                    studentPhoto: createLookup?.studentPhoto || "",
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
              {/* Left: only the Teacher ID or Email is entered. Everything
                  else is fetched from Firestore (`teachers/{idOrEmail}`)
                  or computed automatically on submit. */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <ModalField label="Teacher ID ama Email">
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      value={createTeacherLookupInput}
                      onChange={(e) => handleTeacherLookupInputChange(e.target.value)}
                      placeholder="e.g. 0001 ama teacher@email.com"
                      style={{ ...modalInput, flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={handleFetchTeacher}
                      disabled={fetchingTeacher}
                      style={{
                        padding: "0 16px",
                        borderRadius: 10,
                        border: "1.5px solid #7c3aed",
                        background: fetchingTeacher ? "#E5E7EB" : "#F5F3FF",
                        color: "#7c3aed",
                        fontWeight: 700,
                        fontSize: 12.5,
                        cursor: fetchingTeacher ? "default" : "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {fetchingTeacher ? "Fetching…" : "Fetch"}
                    </button>
                  </div>
                  <div style={{ fontSize: 11.5, color: "#9CA3AF", marginTop: 6 }}>
                    Magaca, Title-ka, Sawirka, Issue Date iyo Expire Date
                    waxaa si toos ah looga soo qaadanayaa xogta macallinkan ee
                    Firestore — riix "Fetch" si aad u aragto preview-ka, ama
                    toos u riix "Create ID Card".
                  </div>
                </ModalField>

                {teacherLookupError && (
                  <div style={{ fontSize: 12.5, color: "#DC2626", background: "#FEF2F2", border: "1px solid rgba(220,38,38,0.25)", borderRadius: 8, padding: "8px 10px" }}>
                    {teacherLookupError}
                  </div>
                )}

                {teacherLookup && !teacherLookupError && (
                  <div style={{ fontSize: 12.5, color: "#7c3aed", background: "#F5F3FF", border: "1px solid rgba(124,58,237,0.25)", borderRadius: 8, padding: "8px 10px" }}>
                    Waa la helay: {teacherLookup.fullName} — ID {teacherLookupResolvedId}
                  </div>
                )}

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

              {/* Right: live preview. Shows the fetched teacher's data once
                  a lookup has run (name/title/photo from Firestore, dates
                  computed automatically); blank fields otherwise. */}
              <div>
                <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 600, marginBottom: 8 }}>Preview</div>
                <ManualTeacherIdCard
                  card={{
                    fullName: teacherLookup?.fullName || "",
                    title: teacherLookup ? (teacherLookup.title || teacherLookup.designation || teacherLookup.role || "Teacher") : "",
                    teacherId: teacherLookupResolvedId || createTeacherLookupInput,
                    issueDate: teacherLookup ? previewToday : "",
                    expireDate: teacherLookup ? previewExpire : "",
                    teacherPhoto: teacherLookup?.teacherPhoto || "",
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