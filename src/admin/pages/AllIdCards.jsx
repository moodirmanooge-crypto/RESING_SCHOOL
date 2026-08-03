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
// PENDING DELETION support:
//   - Students/teachers marked pendingDeletion are hidden from this list
//     immediately, even though their card doc (if any) is untouched
//     until the backend approves the deletion.
//
// DELETE support:
//   - Checkbox column per row + "select all" checkbox in header
//   - "Delete Selected" bulk-delete button (shows count, asks confirmation)
//   - Single "Delete" button inside the selected-card preview panel
//   - Deletes remove the `studentIdCards`/`teacher_id` doc if one exists
//     (the underlying student/teacher record itself is NOT deleted here —
//     this page only manages ID card records).

import { useEffect, useMemo, useState } from "react";
import { useRef } from "react";
import { collection, getDocs, doc, deleteDoc, writeBatch } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import StudentIdCard from "../../student/StudentIdCard";
import TeacherIdCard from "../../teacher/TeacherIdCard";
import { Search, Printer, Download, IdCard, GraduationCap, Users, Trash2 } from "lucide-react";
import html2canvas from "html2canvas";
import { migrateStudentIdCards } from "../../utils/migrateStudentIdCards";

function formatDate(d) {
  if (!d) return "—";
  const dateObj = d?.seconds ? new Date(d.seconds * 1000) : new Date(d);
  if (isNaN(dateObj.getTime())) return "—";
  return dateObj.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
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
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all"); // all | student | teacher
  const [selected, setSelected] = useState(null); // { type, data }

  // Deletion state
  const [selectedIds, setSelectedIds] = useState(new Set()); // keys: `${type}-${id}`
  const [deleting, setDeleting] = useState(false); // bulk-delete in progress
  const [deletingOne, setDeletingOne] = useState(false); // single-delete in progress

  const printRef = useRef(null);

  useEffect(() => {
    fetchAllCards();
  }, []);

  async function fetchAllCards() {
    try {
      setLoading(true);
      const [studentCardSnap, teacherCardSnap, studentsSnap, teachersSnap] = await Promise.all([
        getDocs(collection(db, "studentIdCards")),
        getDocs(collection(db, "teacher_id")),
        // Source of truth for students.
        getDocs(collection(db, "students")),
        // Source of truth for teachers.
        getDocs(collection(db, "teachers")),
      ]);

      // Map studentId -> studentIdCards doc data (if one exists), so we
      // can merge it onto the student's own record below.
      const cardByStudentId = new Map();
      studentCardSnap.docs.forEach((d) => {
        const data = d.data();
        if (data.studentId) {
          cardByStudentId.set(data.studentId, { cardDocId: d.id, ...data });
        }
      });

      // Build the student list starting from `students` (every real,
      // live student), merging in studentIdCards data when present.
      const allStudents = studentsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((s) => !s.pendingDeletion)
        .map((s) => {
          const card = s.studentId ? cardByStudentId.get(s.studentId) : null;
          return {
            type: "student",
            // If a studentIdCards doc exists, its id is what deletion
            // should target; otherwise fall back to the students doc id
            // (nothing to delete from studentIdCards in that case).
            id: card ? card.cardDocId : s.id,
            hasCardDoc: !!card,
            ...s,
            ...(card ? { ...card, cardDocId: undefined } : {}),
          };
        });

      // Map teacher_id doc id -> its data (teacher_id doc id == teachers
      // doc id / username).
      const cardByTeacherId = new Map();
      teacherCardSnap.docs.forEach((d) => {
        cardByTeacherId.set(d.id, { cardDocId: d.id, ...d.data() });
      });

      const allTeachers = teachersSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((t) => !t.pendingDeletion)
        .map((t) => {
          const card = cardByTeacherId.get(t.id);
          return {
            type: "teacher",
            id: t.id,
            hasCardDoc: !!card,
            ...t,
            ...(card ? { ...card, cardDocId: undefined } : {}),
          };
        });

      setStudents(allStudents);
      setTeachers(allTeachers);
    } catch (err) {
      console.error("Failed to load ID cards:", err);
    } finally {
      setLoading(false);
    }
  }

  const combined = useMemo(() => {
    const all = [...students, ...teachers];
    return all;
  }, [students, teachers]);

  const filtered = useMemo(() => {
    let list = combined;
    if (typeFilter !== "all") {
      list = list.filter((r) => r.type === typeFilter);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const idValue = (r.type === "student" ? r.studentId : r.teacherUsername || r.id || "").toString().toLowerCase();
        const nameValue = (r.fullName || r.name || "").toString().toLowerCase();
        return idValue.includes(q) || nameValue.includes(q);
      });
    }
    return list;
  }, [combined, query, typeFilter]);

  function rowKey(r) {
    return `${r.type}-${r.id}`;
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

  // Tirtir hal card oo la doortay (ka mid ah preview panel-ka).
  // Fadlan ogow: kani wuxuu tirtiraa kaliya studentIdCards/teacher_id
  // doc-ga (haddii uu jiro) — ma tirtirayo record-ka asalka ah ee
  // students/teachers collection-ka.
  async function handleDeleteSingle() {
    if (!selected) return;
    if (!selected.data.hasCardDoc) {
      window.alert("Ardaygan/macallinkan ID card gaar ah lama sameynin weli — ma jiro wax la tirtiro.");
      return;
    }
    const idLabel = selected.type === "student"
      ? (selected.data.studentId || selected.data.id)
      : (selected.data.teacherUsername || selected.data.id);
    const confirmed = window.confirm(
      `Ma hubtaa inaad tirtirto ID card-kan (${idLabel})? Tallaabadan lama soo celin karo.`
    );
    if (!confirmed) return;

    try {
      setDeletingOne(true);
      const collectionName = selected.type === "student" ? "studentIdCards" : "teacher_id";
      await deleteDoc(doc(db, collectionName, selected.data.id));

      // Ka saar liiska local state-ka si UI-gu si degdeg ah u cusboonaysiiyo
      if (selected.type === "student") {
        setStudents((prev) => prev.filter((s) => s.id !== selected.data.id));
      } else {
        setTeachers((prev) => prev.filter((t) => t.id !== selected.data.id));
      }
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(rowKey({ type: selected.type, id: selected.data.id }));
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
          const collectionName = r.type === "student" ? "studentIdCards" : "teacher_id";
          batch.delete(doc(db, collectionName, r.id));
        });
        await batch.commit();
      }

      const deletedKeys = new Set(targets.map(rowKey));
      // Card doc-ga waa la tirtiray — student/teacher-ka qudhiisu wali
      // wuu joogaa, ee kaliya `hasCardDoc` ayaa loo beddelayaa false.
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
      if (selected && deletedKeys.has(rowKey({ type: selected.type, id: selected.data.id }))) {
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
      ? (selected.data.teacherUsername || selected.data.id)
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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }} className="idcards-print-hide">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <IdCard size={22} color="#16a34a" />
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827" }}>
                All ID Cards
              </h1>
            </div>

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
                      const idValue = r.type === "student" ? r.studentId : (r.teacherUsername || r.id);
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
                  {selected.type === "student" ? (
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
      `}</style>
    </div>
  );
}