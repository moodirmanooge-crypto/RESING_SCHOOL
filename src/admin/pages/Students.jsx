import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db, storage } from "../../firebase/firebase";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import {
  Plus,
  Upload,
  Search,
  GraduationCap,
  Pencil,
  Trash2,
  X,
  Save,
  Loader2,
  User,
  School,
  Wallet,
  Phone,
  Smartphone,
  MapPin,
  BookOpen,
  Heart,
  Lock,
  Camera,
  Hash,
} from "lucide-react";

const classOptions = ["1", "2", "3", "4", "5", "6", "7", "8", "F1", "F2", "F3", "F4"];

// Different registration flows over time have saved the photo URL under
// slightly different field names (studentPhoto is current, but photoUrl
// / photo show up on some older records) — check all of them, and trim
// stray whitespace some records picked up (e.g. a trailing space after
// the URL), which otherwise breaks the browser's ability to load it.
function getStudentPhotoUrl(student) {
  const raw =
    student.studentPhoto || student.photoUrl || student.photo || "";
  return typeof raw === "string" ? raw.trim() : "";
}

export default function Students() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [editData, setEditData] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [saving, setSaving] = useState(false);

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

  // ---- Raadinta arday: ID-giisa ama Password-kiisa ----
  // NOTE: ardayda la calaamadeeyay in la tirtirayo (pendingDeletion)
  // waxaa laga qariyaa liiska front-end-ka ilaa backend-ku uu approve gareeyo.
  const filteredStudents = students.filter((s) => {
    if (s.pendingDeletion) return false;

    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      (s.studentId || "").toLowerCase().includes(q) ||
      (s.parentPassword || "").toLowerCase().includes(q) ||
      (s.fullName || "").toLowerCase().includes(q)
    );
  });

  // ---- Fur modal-ka wax-ka-bedelka ardayga ----
  function openEdit(student) {
    setSelectedStudent(student);
    setEditData({
      fullName: student.fullName || "",
      className: student.className || "",
      monthlyFee: student.monthlyFee || "",
      parentPhone: student.parentPhone || "",
      studentPhone: student.studentPhone || "",
      district: student.district || "",
      previousSchool: student.previousSchool || "",
      orphanStatus: student.orphanStatus || "No",
      parentPassword: student.parentPassword || "",
      studentPhoto: getStudentPhotoUrl(student),
    });
    setPhotoPreview(getStudentPhotoUrl(student) || null);
    setPhotoFile(null);
  }

  function closeEdit() {
    setSelectedStudent(null);
    setEditData(null);
    setPhotoPreview(null);
    setPhotoFile(null);
  }

  function handleEditChange(field, value) {
    setEditData({ ...editData, [field]: value });
  }

  // ---- Sawirka cusub: kaydi file-ka gudaha state-ka si aan u soo
  // shubno Firebase Storage marka la kaydinayo (saveEdit), preview-ga
  // oo kaliya ayaa local ah ilaa saveEdit la riixo. ----
  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function saveEdit() {
    if (!editData.fullName.trim()) {
      alert("Fadlan geli Magaca Ardayga");
      return;
    }
    if (!editData.className) {
      alert("Fadlan dooro Class");
      return;
    }

    try {
      setSaving(true);

      // Haddii sawir cusub la doortay, kor u soo shub Firebase Storage
      // ka hor inta aan Firestore la kaydin, si photoUrl-ku uu noqdo
      // link toos ah oo cusub — isla habka AddStudent.jsx u shaqeeyo.
      let photoUrl = editData.studentPhoto || "";
      if (photoFile) {
        const photoRef = ref(
          storage,
          `students/${selectedStudent.studentId}/${Date.now()}_${photoFile.name}`
        );
        await uploadBytes(photoRef, photoFile);
        photoUrl = (await getDownloadURL(photoRef)).trim();
      }

      const updatedFields = {
        fullName: editData.fullName,
        className: editData.className,
        monthlyFee: editData.monthlyFee,
        parentPhone: editData.parentPhone,
        studentPhone: editData.studentPhone,
        district: editData.district,
        previousSchool: editData.previousSchool,
        orphanStatus: editData.orphanStatus,
        parentPassword: editData.parentPassword,
        studentPhoto: photoUrl,
      };

      await updateDoc(doc(db, "students", selectedStudent.id), updatedFields);

      setStudents((prev) =>
        prev.map((s) =>
          s.id === selectedStudent.id ? { ...s, ...updatedFields } : s
        )
      );

      alert("Ardayga waa la cusboonaysiiyay");
      closeEdit();
    } catch (err) {
      console.log(err);
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  // ---- Tirtirka ardayga ----
  // MUHIIM: Xogta Firestore laftigeeda LAGAMA TIRTIRO halkan. Waxaa kaliya
  // la calaamadeeyaa "pendingDeletion: true" (iyo waqtiga codsiga) si arday-gu
  // uu si toos ah uga qarsoomo liiska front-end-ka. Tirtirka dhabta ah ee
  // Firestore waxaa kaliya sameeya backend-ka marka la ansixiyo (approve).
  async function deleteStudent(student) {
    if (!confirm(`Ma hubtaa inaad tirtirto ${student.fullName}?`)) return;
    try {
      await updateDoc(doc(db, "students", student.id), {
        pendingDeletion: true,
        deletionRequestedAt: new Date().toISOString(),
      });

      setStudents((prev) =>
        prev.map((s) =>
          s.id === student.id
            ? { ...s, pendingDeletion: true, deletionRequestedAt: new Date().toISOString() }
            : s
        )
      );

      alert("SUCCESSFULLY REQUESTED FOR DELETION✅.");
    } catch (err) {
      console.log(err);
      alert(err.message);
    }
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0b0a1c" }}>
      <Sidebar />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: "20px 24px 0" }}>
          <Topbar title="Students" />
        </div>

        <div style={{ padding: "26px 30px" }}>
          <h1 style={{ color: "#fff", marginBottom: 22, fontSize: 26, fontWeight: 800 }}>
            Students
          </h1>

          <div style={{ display: "flex", gap: 15, marginBottom: 25, flexWrap: "wrap" }}>
            <Link to="/admin/add-student">
              <button style={purpleBtn}>
                <Plus size={17} />
                Add Student
              </button>
            </Link>

            <Link to="/admin/bulk-registration">
              <button style={ghostBtn}>
                <Upload size={17} />
                Bulk Registration
              </button>
            </Link>

            <div style={searchWrap}>
              <Search size={16} color="#8b87ad" />
              <input
                placeholder="Raadi ID-ga ama Password-ka ardayga..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={searchInput}
              />
            </div>
          </div>

          <div style={listCard}>
            <h3 style={{ color: "#fff", margin: "0 0 16px", fontSize: 17 }}>
              Student List{" "}
              <span style={{ color: "#8b87ad", fontWeight: 400, fontSize: 14 }}>
                ({filteredStudents.length})
              </span>
            </h3>

            {loading ? (
              <p style={{ color: "#8b87ad" }}>Loading...</p>
            ) : filteredStudents.length === 0 ? (
              <p style={{ color: "#8b87ad" }}>Wax arday ah lama helin.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {filteredStudents.map((student) => {
                  const photoUrl = getStudentPhotoUrl(student);
                  return (
                    <div key={student.id} style={studentRow}>
                      {photoUrl ? (
                        <img
                          src={photoUrl}
                          alt={student.fullName || "Student"}
                          style={{
                            width: 46,
                            height: 46,
                            minWidth: 46,
                            borderRadius: "50%",
                            objectFit: "cover",
                            display: "block",
                          }}
                          onError={(e) => {
                            // If the stored URL is broken/unreachable,
                            // fall back to the initials avatar instead
                            // of a permanently broken image icon.
                            e.currentTarget.style.display = "none";
                            e.currentTarget.nextSibling.style.display =
                              "flex";
                          }}
                        />
                      ) : null}
                      <div
                        style={{
                          width: 46,
                          height: 46,
                          minWidth: 46,
                          borderRadius: "50%",
                          background: "linear-gradient(135deg,#6d5df0,#8b6cf5)",
                          display: photoUrl ? "none" : "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: 15,
                        }}
                      >
                        {(student.fullName || "?").slice(0, 2).toUpperCase()}
                      </div>

                      <div style={{ flex: 1, minWidth: 160 }}>
                        <div style={{ color: "#fff", fontWeight: 600, fontSize: 14.5 }}>
                          {student.fullName || "—"}
                        </div>
                        <div style={{ color: "#8b87ad", fontSize: 12.5, marginTop: 2 }}>
                          ID: {student.studentId || "—"}
                        </div>
                      </div>

                      <span style={tag}>Class {student.className || "—"}</span>
                      <span style={tag}>{student.studentPhone || "—"}</span>
                      <span style={tag}>${student.monthlyFee || "0"}/bishii</span>

                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => openEdit(student)} style={iconBtnEdit}>
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => deleteStudent(student)} style={iconBtnDelete}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---- Modal-ka wax-ka-bedelka ardayga ---- */}
      {editData && (
        <div style={overlay}>
          <div style={modal}>
            <div style={modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <GraduationCap size={20} color="#8b6cf5" />
                <h2 style={{ color: "#fff", margin: 0, fontSize: 19 }}>
                  Wax ka bedel: {selectedStudent.fullName}
                </h2>
              </div>
              <button onClick={closeEdit} style={closeBtn}>
                <X size={18} />
              </button>
            </div>

            <div style={modalBody}>
              {/* ---- Sawirka ardayga ---- */}
              <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 26 }}>
                <label
                  htmlFor="editPhoto"
                  style={{
                    width: 88,
                    height: 88,
                    minWidth: 88,
                    borderRadius: "50%",
                    background: photoPreview
                      ? `url(${photoPreview}) center/cover`
                      : "rgba(139,108,245,0.08)",
                    border: "2px dashed #6d5df0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    overflow: "hidden",
                  }}
                >
                  {!photoPreview && <Camera color="#8b6cf5" size={26} />}
                </label>
                <input
                  id="editPhoto"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  style={{ display: "none" }}
                />
                <div>
                  <div style={{ fontWeight: 700, color: "#fff", fontSize: 15 }}>
                    Sawirka Ardayga
                  </div>
                  <div style={{ color: "#8b87ad", fontSize: 13, marginTop: 4 }}>
                    Riix goobta si aad sawir cusub uga soo dooratid
                  </div>
                  <div style={{ color: "#6b6890", fontSize: 12, marginTop: 4 }}>
                    Student ID: {selectedStudent.studentId}
                  </div>
                </div>
              </div>

              <div style={grid}>
                <Field icon={User} label="Full Name">
                  <input
                    style={input}
                    value={editData.fullName}
                    onChange={(e) => handleEditChange("fullName", e.target.value)}
                  />
                </Field>

                <Field icon={School} label="Class Name">
                  <select
                    style={input}
                    value={editData.className}
                    onChange={(e) => handleEditChange("className", e.target.value)}
                  >
                    <option value="">Select Class</option>
                    {classOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field icon={Wallet} label="Monthly Fee ($)">
                  <input
                    style={input}
                    type="number"
                    value={editData.monthlyFee}
                    onChange={(e) => handleEditChange("monthlyFee", e.target.value)}
                  />
                </Field>

                <Field icon={Phone} label="Parent Phone">
                  <input
                    style={input}
                    value={editData.parentPhone}
                    onChange={(e) => handleEditChange("parentPhone", e.target.value)}
                  />
                </Field>

                <Field icon={Smartphone} label="Student Phone">
                  <input
                    style={input}
                    value={editData.studentPhone}
                    onChange={(e) => handleEditChange("studentPhone", e.target.value)}
                  />
                </Field>

                <Field icon={MapPin} label="District">
                  <input
                    style={input}
                    value={editData.district}
                    onChange={(e) => handleEditChange("district", e.target.value)}
                  />
                </Field>

                <Field icon={BookOpen} label="Previous School">
                  <input
                    style={input}
                    value={editData.previousSchool}
                    onChange={(e) => handleEditChange("previousSchool", e.target.value)}
                  />
                </Field>

                <Field icon={Heart} label="Orphan Status">
                  <select
                    style={input}
                    value={editData.orphanStatus}
                    onChange={(e) => handleEditChange("orphanStatus", e.target.value)}
                  >
                    <option>No</option>
                    <option>Yes</option>
                  </select>
                </Field>

                <Field icon={Lock} label="Parent Password">
                  <input
                    style={input}
                    value={editData.parentPassword}
                    onChange={(e) => handleEditChange("parentPassword", e.target.value)}
                  />
                </Field>

                <Field icon={Hash} label="Student ID">
                  <input style={{ ...input, opacity: 0.6 }} value={selectedStudent.studentId} disabled />
                </Field>
              </div>
            </div>

            <div style={modalFooter}>
              <button onClick={closeEdit} style={cancelBtn}>
                Iska daa
              </button>
              <button onClick={saveEdit} disabled={saving} style={saveBtn}>
                {saving ? (
                  <>
                    <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                    Kaydinaya...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Kaydi Isbedelka
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        input::placeholder { color: #6b6890; }
        select option { background: #1e1a4a; color: #ffffff; }
      `}</style>
    </div>
  );
}

function Field({ icon: Icon, label: labelText, children }) {
  return (
    <div>
      <label style={label}>
        <Icon size={15} color="#8b6cf5" />
        {labelText}
      </label>
      {children}
    </div>
  );
}

const purpleBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "linear-gradient(90deg,#6d5df0,#8b6cf5)",
  color: "#fff",
  border: "none",
  padding: "12px 20px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 14,
  boxShadow: "0 8px 20px rgba(109,93,240,0.3)",
};

const ghostBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "rgba(255,255,255,0.03)",
  color: "#fff",
  border: "1.5px solid rgba(139,108,245,0.35)",
  padding: "12px 20px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 14,
};

const searchWrap = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: 340,
  padding: "0 14px",
  borderRadius: 10,
  border: "1.5px solid rgba(139,108,245,0.3)",
  background: "rgba(255,255,255,0.02)",
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
  marginTop: 26,
  background: "linear-gradient(160deg,#1c1840,#211c48)",
  borderRadius: 16,
  padding: 22,
  border: "1px solid rgba(255,255,255,0.05)",
};

const studentRow = {
  display: "flex",
  alignItems: "center",
  gap: 16,
  padding: "12px 16px",
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

const iconBtnEdit = {
  background: "rgba(139,108,245,0.12)",
  border: "1px solid rgba(139,108,245,0.3)",
  color: "#8b6cf5",
  width: 32,
  height: 32,
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const iconBtnDelete = {
  background: "rgba(239,68,68,0.12)",
  border: "1px solid rgba(239,68,68,0.3)",
  color: "#f87171",
  width: 32,
  height: 32,
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
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
  borderRadius: 20,
  width: "100%",
  maxWidth: 780,
  maxHeight: "90vh",
  display: "flex",
  flexDirection: "column",
};

const modalHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "22px 26px",
  borderBottom: "1px solid rgba(139,108,245,0.2)",
};

const closeBtn = {
  background: "rgba(255,255,255,0.05)",
  border: "none",
  color: "#fff",
  width: 32,
  height: 32,
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const modalBody = {
  padding: "24px 26px",
  overflowY: "auto",
};

const modalFooter = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 12,
  padding: "18px 26px",
  borderTop: "1px solid rgba(139,108,245,0.2)",
};

const cancelBtn = {
  background: "rgba(255,255,255,0.04)",
  border: "1.5px solid rgba(139,108,245,0.3)",
  color: "#fff",
  padding: "12px 22px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 14,
};

const saveBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "linear-gradient(90deg,#6d5df0,#8b6cf5)",
  color: "#fff",
  border: "none",
  padding: "12px 22px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 14,
};

const label = {
  display: "flex",
  alignItems: "center",
  gap: 7,
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

const grid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "20px 24px",
};