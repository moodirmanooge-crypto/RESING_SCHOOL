import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../firebase/firebase";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import {
  School,
  Users,
  ArrowLeft,
  Pencil,
  X,
  Save,
  Loader2,
  Search,
  GraduationCap,
} from "lucide-react";

const classOptions = ["1", "2", "3", "4", "5", "6", "7", "8", "F1", "F2", "F3", "F4"];
// A dedicated bucket for students who finished school (F4 students at
// year-end) — not a real class, just a permanent read-only archive. It
// always shows up alongside the real classes below, even with 0
// students, and is offered as a destination in the move dropdown.
const GRADUATES_KEY = "Qalin Jabis";
const renameTargetOptions = [...classOptions, GRADUATES_KEY];

export default function Classes() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [selectedClass, setSelectedClass] = useState(null); // fasalka la furay
  const [renaming, setRenaming] = useState(null); // fasalka wax laga bedelayo
  const [newClassName, setNewClassName] = useState("");
  const [saving, setSaving] = useState(false);

  // ---- "Ma jiraa arday dhacay?" step inside the move modal ----
  const [hasFailed, setHasFailed] = useState(null);
  const [failedStudentIds, setFailedStudentIds] = useState(new Set());

  // ---- Read-only profile viewer for a graduated student ----
  const [viewingStudent, setViewingStudent] = useState(null);

  useEffect(() => {
    fetchStudents();
  }, []);

  async function fetchStudents() {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, "students"));
      setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  }

  // ---- Isku duub ardayda class-kood, ku dar dhammaan class-yada
  // aan ardayna lahayn (0 arday) si liiska fasalada uu buuxo — iyo
  // qaybta "Qalin Jabis" oo had iyo jeer muuqata, xitaa 0 arday ----
  const classGroups = useMemo(() => {
    const groups = {};
    classOptions.forEach((c) => (groups[c] = []));
    groups[GRADUATES_KEY] = [];

    students.forEach((s) => {
      const cls = s.className || "Unknown";
      if (!groups[cls]) groups[cls] = [];
      groups[cls].push(s);
    });

    const realClasses = Object.entries(groups)
      .filter(([name]) => name !== GRADUATES_KEY)
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));

    // Qalin Jabis always sits last, after every real class.
    return [...realClasses, [GRADUATES_KEY, groups[GRADUATES_KEY]]];
  }, [students]);

  // Total count of everyone in the Qalin Jabis bucket, shown on its card.
  const graduatesTotal = useMemo(
    () => students.filter((s) => (s.className || "Unknown") === GRADUATES_KEY).length,
    [students]
  );

  const currentClassStudents = useMemo(() => {
    if (!selectedClass) return [];
    const list = students.filter((s) => (s.className || "Unknown") === selectedClass);
    const q = search.toLowerCase();
    if (!q) return list;
    return list.filter(
      (s) =>
        (s.fullName || "").toLowerCase().includes(q) ||
        (s.studentId || "").toLowerCase().includes(q)
    );
  }, [students, selectedClass, search]);

  // Students currently in the class being moved — used inside the modal
  // to let the admin pick who "failed" and should stay behind.
  const affectedStudents = useMemo(() => {
    if (!renaming) return [];
    return students.filter((s) => (s.className || "Unknown") === renaming);
  }, [students, renaming]);

  // ---- Fur modal-ka "Edit Class" (u beddel magaca fasalka + dhammaan
  // ardayda ku jira, tusaale Class 7 -> Class 8, ama F4 -> Qalin Jabis) ----
  function openRename(className) {
    setRenaming(className);
    setNewClassName(className);
    setHasFailed(null);
    setFailedStudentIds(new Set());
  }

  function closeRename() {
    if (saving) return;
    setRenaming(null);
    setNewClassName("");
    setHasFailed(null);
    setFailedStudentIds(new Set());
  }

  function toggleFailedStudent(studentId) {
    setFailedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  async function saveRename() {
    if (!newClassName.trim()) {
      alert("Fadlan dooro fasalka cusub");
      return;
    }
    if (newClassName === renaming) {
      closeRename();
      return;
    }
    if (hasFailed === null) {
      alert("Fadlan jawaab su'aasha: Ma jiraa arday dhacay?");
      return;
    }

    // Only students NOT marked as "failed" (kept behind) actually move —
    // when hasFailed is false, that's simply everyone in the class.
    const toMove = affectedStudents.filter((s) => !failedStudentIds.has(s.id));
    const staying = affectedStudents.filter((s) => failedStudentIds.has(s.id));

    if (toMove.length === 0) {
      alert(
        staying.length > 0
          ? "Dhammaan ardayda waa la doortay inay dhaceen — mid uun lama wareejin."
          : "Fasalkan wax arday ah kuma jiraan."
      );
      closeRename();
      return;
    }

    try {
      setSaving(true);

      // ---- Isticmaal batch si dhammaan ardayda la wareejinayo loo
      // beddelo hal mar (si mid uusan ka soo hadhin) ----
      const batch = writeBatch(db);
      toMove.forEach((student) => {
        batch.update(doc(db, "students", student.id), {
          className: newClassName,
        });
      });
      await batch.commit();

      const movedIds = new Set(toMove.map((s) => s.id));
      setStudents((prev) =>
        prev.map((s) => (movedIds.has(s.id) ? { ...s, className: newClassName } : s))
      );

      const renamingLabel = renaming === GRADUATES_KEY ? GRADUATES_KEY : `Class ${renaming}`;
      const newLabel = newClassName === GRADUATES_KEY ? GRADUATES_KEY : `Class ${newClassName}`;

      let message = `${toMove.length} arday ayaa laga bedelay ${renamingLabel} una guuriyay ${newLabel}`;
      if (staying.length > 0) {
        message += `\n${staying.length} arday ayaa lagu reebay ${renamingLabel} (waxay dhaceen).`;
      }
      alert(message);

      if (selectedClass === renaming && toMove.length === affectedStudents.length) {
        setSelectedClass(newClassName);
      }
      closeRename();
    } catch (err) {
      console.log(err);
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  // ---- Boggu marka fasal la furay (liiska ardayda) ----
  if (selectedClass) {
    const isGraduates = selectedClass === GRADUATES_KEY;
    return (
      <div style={{ display: "flex", minHeight: "100vh", background: "#0b0a1c" }}>
        <Sidebar />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ padding: "20px 24px 0" }}>
            <Topbar title="Classes" />
          </div>

          <div style={{ padding: "26px 30px" }}>
            <button onClick={() => setSelectedClass(null)} style={backBtn}>
              <ArrowLeft size={16} />
              Dib ugu noqo Fasalada
            </button>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 18,
                marginBottom: 22,
                flexWrap: "wrap",
                gap: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={classIconBig}>
                  {isGraduates ? (
                    <GraduationCap size={24} color="#eab308" />
                  ) : (
                    <School size={24} color="#8b6cf5" />
                  )}
                </div>
                <div>
                  <h1 style={{ margin: 0, color: "#fff", fontSize: 24, fontWeight: 800 }}>
                    {isGraduates ? GRADUATES_KEY : `Class ${selectedClass}`}
                  </h1>
                  <p style={{ margin: "3px 0 0", color: "#8b87ad", fontSize: 13 }}>
                    {isGraduates
                      ? `${graduatesTotal} total student`
                      : `${currentClassStudents.length} arday oo ku jira fasalkan`}
                  </p>
                </div>
              </div>

              {/* Qalin Jabis is a permanent read-only archive — no Edit
                  button here, students only leave it via being moved out
                  of their original class before graduating. */}
              {!isGraduates && (
                <button onClick={() => openRename(selectedClass)} style={editClassBtn}>
                  <Pencil size={16} />
                  Edit Class
                </button>
              )}
            </div>

            <div style={searchWrap}>
              <Search size={16} color="#8b87ad" />
              <input
                placeholder={
                  isGraduates
                    ? "Raadi qalin-jabiye magac ama ID..."
                    : "Raadi arday magac ama ID..."
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={searchInput}
              />
            </div>

            <div style={listCard}>
              {currentClassStudents.length === 0 ? (
                <p style={{ color: "#8b87ad" }}>
                  {isGraduates
                    ? "Wax arday ah wali lama wareejin qaybtan."
                    : "Wax arday ah kuma jiraan fasalkan."}
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {currentClassStudents.map((s) => (
                    <div
                      key={s.id}
                      style={isGraduates ? { ...studentRow, cursor: "pointer" } : studentRow}
                      onClick={isGraduates ? () => setViewingStudent(s) : undefined}
                    >
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          minWidth: 42,
                          borderRadius: "50%",
                          background: (s.studentPhoto || s.photoURL)
                            ? `url(${s.studentPhoto || s.photoURL}) center/cover`
                            : "linear-gradient(135deg,#6d5df0,#8b6cf5)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: 13,
                        }}
                      >
                        {!(s.studentPhoto || s.photoURL) &&
                          (s.fullName || "?").slice(0, 2).toUpperCase()}
                      </div>

                      <div style={{ flex: 1, minWidth: 160 }}>
                        <div style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>
                          {s.fullName || "—"}
                        </div>
                        <div style={{ color: "#8b87ad", fontSize: 12, marginTop: 2 }}>
                          ID: {s.studentId || "—"}
                        </div>
                      </div>

                      <span style={tag}>{s.studentPhone || "—"}</span>
                      <span style={tag}>${s.monthlyFee || 0}/bishii</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {renaming && (
          <RenameModal
            renaming={renaming}
            newClassName={newClassName}
            setNewClassName={setNewClassName}
            saving={saving}
            onClose={closeRename}
            onSave={saveRename}
            affectedStudents={affectedStudents}
            hasFailed={hasFailed}
            setHasFailed={setHasFailed}
            failedStudentIds={failedStudentIds}
            toggleFailedStudent={toggleFailedStudent}
          />
        )}

        {viewingStudent && (
          <StudentProfileModal
            student={viewingStudent}
            onClose={() => setViewingStudent(null)}
          />
        )}

        <style>{`
          input::placeholder { color: #6b6890; }
          select option { background: #1e1a4a; color: #ffffff; }
        `}</style>
      </div>
    );
  }

  // ---- Boggu marka aan wax fasal ah la furin (liiska fasalada oo dhan) ----
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0b0a1c" }}>
      <Sidebar />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: "20px 24px 0" }}>
          <Topbar title="Classes" />
        </div>

        <div style={{ padding: "26px 30px" }}>
          <h1 style={{ color: "#fff", marginBottom: 6, fontSize: 26, fontWeight: 800 }}>
            Classes
          </h1>
          <p style={{ color: "#8b87ad", marginBottom: 26, fontSize: 14 }}>
            Riix fasal si aad u aragto ardayda ku jira. Ardayda F4 ee
            qalin-jabisay waxaad ugu wareejin kartaa qaybta "{GRADUATES_KEY}"
            ee hoose.
          </p>

          {loading ? (
            <p style={{ color: "#8b87ad" }}>Loading...</p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 18,
              }}
            >
              {classGroups.map(([className, list]) => {
                const isGraduates = className === GRADUATES_KEY;
                return (
                  <div
                    key={className}
                    style={isGraduates ? { ...classCard, ...graduatesCard } : classCard}
                  >
                    <div
                      onClick={() => {
                        setSelectedClass(className);
                        setSearch("");
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      <div style={isGraduates ? { ...classIcon, ...graduatesIcon } : classIcon}>
                        {isGraduates ? (
                          <GraduationCap size={22} color="#eab308" />
                        ) : (
                          <School size={22} color="#8b6cf5" />
                        )}
                      </div>
                      <h3 style={{ color: "#fff", margin: "14px 0 4px", fontSize: 18 }}>
                        {isGraduates ? className : `Class ${className}`}
                      </h3>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#8b87ad", fontSize: 13 }}>
                        <Users size={14} />
                        {isGraduates ? `${list.length} total student` : `${list.length} arday`}
                      </div>
                    </div>

                    {/* Qalin Jabis has no Edit button on its card either —
                        it's a permanent read-only archive. */}
                    {!isGraduates && (
                      <button
                        onClick={() => openRename(className)}
                        style={editClassBtnSmall}
                      >
                        <Pencil size={13} />
                        Edit
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {renaming && (
        <RenameModal
          renaming={renaming}
          newClassName={newClassName}
          setNewClassName={setNewClassName}
          saving={saving}
          onClose={closeRename}
          onSave={saveRename}
          affectedStudents={affectedStudents}
          hasFailed={hasFailed}
          setHasFailed={setHasFailed}
          failedStudentIds={failedStudentIds}
          toggleFailedStudent={toggleFailedStudent}
        />
      )}

      <style>{`
        input::placeholder { color: #6b6890; }
        select option { background: #1e1a4a; color: #ffffff; }
      `}</style>
    </div>
  );
}

// ---- Modal-ka wax-ka-bedelka fasalka. Hadda wuxuu ka kooban yahay:
//   1) Dooro fasalka cusub (ama Qalin Jabis)
//   2) "Ma jiraa arday dhacay?" — Haa / Maya
//   3) Haddii Haa: liis checkbox ah oo ardayda fasalka ku jira, si
//      maamulku u doorto (select) kuwa dhacay by ID. Kuwaas waxaa lagu
//      reebayaa fasalkii hore; intii kale (aan la doorin) waxaa loo
//      wareejinayaa fasalka cusub.
function RenameModal({
  renaming,
  newClassName,
  setNewClassName,
  saving,
  onClose,
  onSave,
  affectedStudents,
  hasFailed,
  setHasFailed,
  failedStudentIds,
  toggleFailedStudent,
}) {
  const renamingLabel = renaming === GRADUATES_KEY ? GRADUATES_KEY : `Class ${renaming}`;
  const newLabel = newClassName === GRADUATES_KEY ? GRADUATES_KEY : `Class ${newClassName}`;
  const movingCount = affectedStudents.length - failedStudentIds.size;

  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={modalHeader}>
          <h2 style={{ color: "#fff", margin: 0, fontSize: 18 }}>
            Edit {renamingLabel}
          </h2>
          <button onClick={onClose} style={closeBtn}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "22px 26px", maxHeight: "60vh", overflowY: "auto" }}>
          <label style={label}>Guuri Ardayda Una</label>
          <select
            style={input}
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
          >
            {renameTargetOptions.map((c) => (
              <option key={c} value={c}>
                {c === GRADUATES_KEY ? c : `Class ${c}`}
              </option>
            ))}
          </select>

          <div style={{ marginTop: 20 }}>
            <label style={label}>Ma jiraa arday dhacay?</label>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => setHasFailed(true)}
                style={hasFailed === true ? yesNoBtnActive : yesNoBtn}
              >
                Haa
              </button>
              <button
                type="button"
                onClick={() => {
                  setHasFailed(false);
                }}
                style={hasFailed === false ? yesNoBtnActive : yesNoBtn}
              >
                Maya
              </button>
            </div>
          </div>

          {hasFailed === true && (
            <div style={{ marginTop: 18 }}>
              <label style={label}>
                Dooro Ardayda Dhacay (ID) — waxaa lagu reebayaa {renamingLabel}
              </label>
              {affectedStudents.length === 0 ? (
                <p style={{ color: "#8b87ad", fontSize: 13 }}>
                  Fasalkan wax arday ah kuma jiraan.
                </p>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    maxHeight: 220,
                    overflowY: "auto",
                    border: "1px solid rgba(139,108,245,0.2)",
                    borderRadius: 10,
                    padding: 10,
                  }}
                >
                  {affectedStudents.map((s) => {
                    const checked = failedStudentIds.has(s.id);
                    return (
                      <label
                        key={s.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "8px 10px",
                          borderRadius: 8,
                          background: checked
                            ? "rgba(239,68,68,0.1)"
                            : "rgba(255,255,255,0.02)",
                          border: checked
                            ? "1px solid rgba(239,68,68,0.35)"
                            : "1px solid rgba(139,108,245,0.12)",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleFailedStudent(s.id)}
                          style={{ cursor: "pointer" }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: "#fff", fontSize: 13.5, fontWeight: 600 }}>
                            {s.fullName || "—"}
                          </div>
                          <div style={{ color: "#8b87ad", fontSize: 11.5 }}>
                            ID: {s.studentId || "—"}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <p style={{ color: "#8b87ad", fontSize: 12.5, marginTop: 16, lineHeight: 1.6 }}>
            {hasFailed === true
              ? `${movingCount} arday ayaa loo wareejin doonaa ${newLabel}. ${failedStudentIds.size} arday oo la doortay ayaa lagu reebi doonaa ${renamingLabel} (waxay dhaceen).`
              : `Dhammaan ardayda hadda ku jira ${renamingLabel} ayaa si otomaatig ah loogu wareejin doonaa ${newLabel}.`}{" "}
            Ardayda fasalada kale (attendance, exams, iwm) waxba kama bedelaan.
          </p>
        </div>

        <div style={modalFooter}>
          <button onClick={onClose} style={cancelBtn}>
            Iska daa
          </button>
          <button onClick={onSave} disabled={saving} style={saveBtn}>
            {saving ? (
              <>
                <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                Kaydinaya...
              </>
            ) : (
              <>
                <Save size={16} />
                Kaydi
              </>
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ---- Read-only profile view for a graduated ("Qalin Jabis") student.
// Shows exactly what was recorded at original registration — photo,
// full name, mother's name, phones, district, previous school, fee
// type, etc. Nothing here is editable; this is an archive lookup only. ----
function StudentProfileModal({ student, onClose }) {
  const photo = student.studentPhoto || student.photoURL || "";
  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={modalHeader}>
          <h2 style={{ color: "#fff", margin: 0, fontSize: 18 }}>
            Xogta Ardayga (Qalin Jabis)
          </h2>
          <button onClick={onClose} style={closeBtn}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "22px 26px", maxHeight: "65vh", overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 22 }}>
            <div
              style={{
                width: 84,
                height: 84,
                minWidth: 84,
                borderRadius: "50%",
                background: photo
                  ? `url(${photo}) center/cover`
                  : "linear-gradient(135deg,#6d5df0,#8b6cf5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 700,
                fontSize: 24,
                border: "2px solid rgba(234,179,8,0.4)",
              }}
            >
              {!photo && (student.fullName || "?").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ color: "#fff", fontWeight: 800, fontSize: 19 }}>
                {student.fullName || "—"}
              </div>
              <div style={{ color: "#8b87ad", fontSize: 13, marginTop: 4 }}>
                ID: {student.studentId || "—"}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <ProfileField label="Magaca Hooyada" value={student.motherName} />
            <ProfileField label="Fasalkii uu ku qalin-jabiyay" value={student.className} />
            <ProfileField label="Shift" value={student.shift} />
            <ProfileField label="Fee Type" value={student.feeType} />
            <ProfileField
              label="Monthly Fee"
              value={
                student.monthlyFee !== undefined && student.monthlyFee !== ""
                  ? `$${student.monthlyFee}`
                  : ""
              }
            />
            <ProfileField label="Parent Phone" value={student.parentPhone} />
            <ProfileField label="Student Phone" value={student.studentPhone} />
            <ProfileField label="District" value={student.district} />
            <ProfileField label="Previous School" value={student.previousSchool} />
            <ProfileField label="Orphan Status" value={student.orphanStatus} />
          </div>
        </div>

        <div style={modalFooter}>
          <button onClick={onClose} style={cancelBtn}>
            Xir
          </button>
        </div>
      </div>
    </div>
  );
}

function ProfileField({ label: labelText, value }) {
  return (
    <div>
      <div style={{ color: "#8b87ad", fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>
        {labelText}
      </div>
      <div style={{ color: "#e5e3f7", fontSize: 14 }}>{value || "—"}</div>
    </div>
  );
}

const backBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "rgba(255,255,255,0.03)",
  border: "1.5px solid rgba(139,108,245,0.3)",
  color: "#c4b5fd",
  padding: "9px 16px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
};

const classIconBig = {
  width: 52,
  height: 52,
  minWidth: 52,
  borderRadius: 14,
  background: "rgba(139,108,245,0.12)",
  border: "1px solid rgba(139,108,245,0.3)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const editClassBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "linear-gradient(90deg,#6d5df0,#8b6cf5)",
  color: "#fff",
  border: "none",
  padding: "11px 18px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 13.5,
  boxShadow: "0 8px 20px rgba(109,93,240,0.3)",
};

const editClassBtnSmall = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "rgba(139,108,245,0.1)",
  border: "1px solid rgba(139,108,245,0.3)",
  color: "#c4b5fd",
  padding: "7px 12px",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 12,
  marginTop: 14,
};

const searchWrap = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: 320,
  padding: "0 14px",
  borderRadius: 10,
  border: "1.5px solid rgba(139,108,245,0.3)",
  background: "rgba(255,255,255,0.02)",
  marginBottom: 20,
};

const searchInput = {
  flex: 1,
  padding: "12px 0",
  border: "none",
  outline: "none",
  background: "transparent",
  color: "#e5e3f7",
  fontSize: 14,
};

const listCard = {
  background: "linear-gradient(160deg,#1c1840,#211c48)",
  borderRadius: 16,
  padding: 20,
  border: "1px solid rgba(255,255,255,0.05)",
};

const studentRow = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: "12px 14px",
  background: "rgba(255,255,255,0.02)",
  borderRadius: 12,
  border: "1px solid rgba(139,108,245,0.12)",
  flexWrap: "wrap",
};

const tag = {
  background: "rgba(139,108,245,0.12)",
  color: "#c4b5fd",
  fontSize: 12,
  padding: "6px 12px",
  borderRadius: 20,
  border: "1px solid rgba(139,108,245,0.25)",
  whiteSpace: "nowrap",
};

const classCard = {
  background: "linear-gradient(160deg,#1c1840,#211c48)",
  borderRadius: 16,
  padding: 20,
  border: "1px solid rgba(255,255,255,0.05)",
};

// Graduates card gets a gold accent border so it visually stands apart
// from the regular class cards in the grid.
const graduatesCard = {
  border: "1px solid rgba(234,179,8,0.35)",
};

const classIcon = {
  width: 46,
  height: 46,
  borderRadius: 12,
  background: "rgba(139,108,245,0.12)",
  border: "1px solid rgba(139,108,245,0.3)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const graduatesIcon = {
  background: "rgba(234,179,8,0.12)",
  border: "1px solid rgba(234,179,8,0.35)",
};

const overlay = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(0,0,0,0.65)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: 20,
};

const modal = {
  background: "linear-gradient(160deg,#151233,#181341)",
  border: "1px solid rgba(139,108,245,0.3)",
  borderRadius: 18,
  width: "100%",
  maxWidth: 460,
  maxHeight: "90vh",
  display: "flex",
  flexDirection: "column",
};

const modalHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "20px 24px",
  borderBottom: "1px solid rgba(139,108,245,0.2)",
};

const closeBtn = {
  background: "rgba(255,255,255,0.05)",
  border: "none",
  color: "#fff",
  width: 30,
  height: 30,
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const modalFooter = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 12,
  padding: "16px 24px",
  borderTop: "1px solid rgba(139,108,245,0.2)",
};

const cancelBtn = {
  background: "rgba(255,255,255,0.04)",
  border: "1.5px solid rgba(139,108,245,0.3)",
  color: "#fff",
  padding: "11px 20px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13.5,
};

const saveBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "linear-gradient(90deg,#6d5df0,#8b6cf5)",
  color: "#fff",
  border: "none",
  padding: "11px 20px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 13.5,
};

const label = {
  display: "block",
  fontSize: 13.5,
  fontWeight: 600,
  color: "#fff",
  marginBottom: 8,
};

const input = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1.5px solid rgba(139,108,245,0.3)",
  boxSizing: "border-box",
  fontSize: 14,
  color: "#e5e3f7",
  background: "rgba(255,255,255,0.02)",
  outline: "none",
};

const yesNoBtn = {
  flex: 1,
  padding: "11px 0",
  borderRadius: 10,
  border: "1.5px solid rgba(139,108,245,0.3)",
  background: "rgba(255,255,255,0.02)",
  color: "#c4b5fd",
  fontWeight: 700,
  fontSize: 13.5,
  cursor: "pointer",
};

const yesNoBtnActive = {
  ...yesNoBtn,
  background: "linear-gradient(90deg,#6d5df0,#8b6cf5)",
  color: "#fff",
  border: "1.5px solid transparent",
};