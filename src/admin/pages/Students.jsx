import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db, storage } from "../../firebase/firebase";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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
  FileDown,
  Filter,
  UserCheck,
} from "lucide-react";

const classOptions = ["1", "2", "3", "4", "5", "6", "7", "8", "F1", "F2", "F3", "F4"];

function getStudentPhotoUrl(student) {
  const raw = student?.studentPhoto || student?.photoUrl || student?.photo || "";
  return typeof raw === "string" ? raw.trim() : "";
}

function loadImageAsDataUrl(url) {
  return new Promise((resolve) => {
    if (!url) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || 100;
        canvas.height = img.naturalHeight || 100;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export default function Students() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  // Doorashooyinka Class-ka iyo Type-ka
  const [selectedClass, setSelectedClass] = useState("ALL");
  const [selectedType, setSelectedType] = useState("ALL");

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [editData, setEditData] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportProgress, setExportProgress] = useState({ done: 0, total: 0 });

  useEffect(() => {
    fetchStudents();
  }, []);

  async function fetchStudents() {
    try {
      setLoading(true);
      const [fullTimeSnap, partTimeSnap] = await Promise.all([
        getDocs(collection(db, "students")),
        getDocs(collection(db, "partTimeStudents")),
      ]);

      const fullTimeStudents = fullTimeSnap.docs.map((d) => ({
        id: d.id,
        collection: "students",
        studentType: d.data().studentType || "Full Time",
        ...d.data(),
      }));

      const partTimeStudents = partTimeSnap.docs.map((d) => ({
        id: d.id,
        collection: "partTimeStudents",
        studentType: d.data().studentType || "Part Time",
        ...d.data(),
      }));

      setStudents([...fullTimeStudents, ...partTimeStudents]);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  }

  // Filter-ka Isku dhafka ah (Class + Type + Search)
  const filteredStudents = students.filter((s) => {
    if (s.pendingDeletion) return false;

    const matchesClass =
      selectedClass === "ALL" || String(s.className) === String(selectedClass);

    const matchesType =
      selectedType === "ALL" || String(s.studentType) === String(selectedType);

    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      (s.studentId || "").toLowerCase().includes(q) ||
      (s.parentPassword || "").toLowerCase().includes(q) ||
      (s.fullName || "").toLowerCase().includes(q);

    return matchesClass && matchesType && matchesSearch;
  });

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
      let photoUrl = editData.studentPhoto || "";
      if (photoFile) {
        const photoRef = ref(
          storage,
          `${selectedStudent.collection}/${selectedStudent.studentId}/${Date.now()}_${photoFile.name}`
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

      await updateDoc(
        doc(db, selectedStudent.collection, selectedStudent.id),
        updatedFields
      );

      setStudents((prev) =>
        prev.map((s) =>
          s.id === selectedStudent.id && s.collection === selectedStudent.collection
            ? { ...s, ...updatedFields }
            : s
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

  // ----------------------------------------------------
  // EXPORT PDF: EXCEL TABLE FORMAT WITH SAFE INDEXING
  // ----------------------------------------------------
  async function exportStudentsToPdf(targetStudents = filteredStudents, titleSuffix = "") {
    if (!targetStudents || targetStudents.length === 0) {
      alert("Ma jiraan arday la daabaco.");
      return;
    }

    try {
      setExportingPdf(true);
      setExportProgress({ done: 0, total: targetStudents.length });

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const pageW = 297;
      const margin = 10;

      // Top Header Box
      pdf.setFillColor(20, 16, 51);
      pdf.rect(0, 0, pageW, 20, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(13);
      pdf.text(`Rising Star School — Xogta Ardayda ${titleSuffix}`, margin, 13);

      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Taariikhda: ${new Date().toLocaleDateString("so-SO")}`, pageW - margin, 13, { align: "right" });

      // Pre-load All Photos safely into an array matched by index
      const photoDataList = [];
      for (let i = 0; i < targetStudents.length; i++) {
        const s = targetStudents[i];
        const pUrl = getStudentPhotoUrl(s);
        let imgData = null;
        if (pUrl) {
          imgData = await loadImageAsDataUrl(pUrl);
        }
        photoDataList.push(imgData);
        setExportProgress({ done: i + 1, total: targetStudents.length });
      }

      // Columns Config
      const tableColumns = [
        { header: "Sawir", dataKey: "photo" },
        { header: "ID", dataKey: "studentId" },
        { header: "Magaca Buuxa", dataKey: "fullName" },
        { header: "Fasalka", dataKey: "className" },
        { header: "Nooca", dataKey: "studentType" },
        { header: "Shift", dataKey: "shift" },
        { header: "Tel Waalidka", dataKey: "parentPhone" },
        { header: "Tel Ardayga", dataKey: "studentPhone" },
        { header: "Lacagta ($)", dataKey: "monthlyFee" },
        { header: "Degmada", dataKey: "district" },
        { header: "Pass Waalidka", dataKey: "parentPassword" },
      ];

      const tableRows = targetStudents.map((s) => ({
        studentId: s.studentId || "—",
        fullName: s.fullName || "—",
        className: s.className || "—",
        studentType: s.studentType || "Full Time",
        shift: s.shift || "—",
        parentPhone: s.parentPhone || "—",
        studentPhone: s.studentPhone || "—",
        monthlyFee: s.monthlyFee ? `$${s.monthlyFee}` : "—",
        district: s.district || "—",
        parentPassword: s.parentPassword || "—",
      }));

      autoTable(pdf, {
        startY: 24,
        columns: tableColumns,
        body: tableRows,
        theme: "grid",
        styles: {
          fontSize: 8,
          cellPadding: 2,
          valign: "middle",
          halign: "center",
          overflow: "linebreak",
        },
        headStyles: {
          fillColor: [109, 93, 240],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          halign: "center",
        },
        alternateRowStyles: {
          fillColor: [248, 247, 255],
        },
        columnStyles: {
          photo: { cellWidth: 14 },
          studentId: { cellWidth: 20 },
          fullName: { cellWidth: 45, halign: "left" },
          className: { cellWidth: 16 },
          studentType: { cellWidth: 22 },
          shift: { cellWidth: 18 },
          parentPhone: { cellWidth: 26 },
          studentPhone: { cellWidth: 26 },
          monthlyFee: { cellWidth: 22 },
          district: { cellWidth: 25 },
          parentPassword: { cellWidth: 25 },
        },
        bodyStyles: {
          minCellHeight: 12,
        },
        didDrawCell: (data) => {
          // Safe Image Drawing using data.row.index
          if (data.section === "body" && data.column.dataKey === "photo") {
            const rowIndex = data.row.index;
            if (rowIndex >= 0 && rowIndex < photoDataList.length) {
              const imgData = photoDataList[rowIndex];
              if (imgData) {
                const imgSize = 9;
                const x = data.cell.x + (data.cell.width - imgSize) / 2;
                const y = data.cell.y + (data.cell.height - imgSize) / 2;
                try {
                  pdf.addImage(imgData, "JPEG", x, y, imgSize, imgSize);
                } catch (e) {
                  // Fallback if image fails to render
                }
              }
            }
          }
        },
      });

      pdf.save(`Ardayda_Excel_Format_${selectedClass}_${selectedType}_${Date.now()}.pdf`);
    } catch (err) {
      console.log(err);
      alert("Khalad ayaa dhacay markii PDF-ka la samaynayay: " + err.message);
    } finally {
      setExportingPdf(false);
      setExportProgress({ done: 0, total: 0 });
    }
  }

  async function deleteStudent(student) {
    if (!confirm(`Ma hubtaa inaad tirtirto ${student.fullName}?`)) return;
    try {
      await updateDoc(doc(db, student.collection, student.id), {
        pendingDeletion: true,
        deletionRequestedAt: new Date().toISOString(),
      });

      setStudents((prev) =>
        prev.map((s) =>
          s.id === student.id && s.collection === student.collection
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
            Students Management
          </h1>

          <div style={{ display: "flex", gap: 12, marginBottom: 25, flexWrap: "wrap", alignItems: "center" }}>
            <Link to="/admin/add-student">
              <button style={purpleBtn}>
                <Plus size={17} />
                Add Student
              </button>
            </Link>

            <Link to="/admin/bulk-registration">
              <button style={ghostBtn}>
                <Upload size={17} />
                Bulk
              </button>
            </Link>

            {/* Filter Fasalka */}
            <div style={filterDropdownWrap}>
              <Filter size={15} color="#8b6cf5" />
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                style={filterSelect}
              >
                <option value="ALL">Dhamaan Fasallada</option>
                {classOptions.map((c) => (
                  <option key={c} value={c}>
                    Class {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Nooca Ardayga (Full Time / Part Time) */}
            <div style={filterDropdownWrap}>
              <UserCheck size={15} color="#8b6cf5" />
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                style={filterSelect}
              >
                <option value="ALL">Dhamaan (Full & Part Time)</option>
                <option value="Full Time">Full Time</option>
                <option value="Part Time">Part Time</option>
              </select>
            </div>

            {/* Export PDF Button */}
            <button
              onClick={() =>
                exportStudentsToPdf(
                  filteredStudents,
                  `(${selectedClass === "ALL" ? "Dhamaan Class-yada" : "Class " + selectedClass} - ${selectedType === "ALL" ? "Dhamaan Types" : selectedType})`
                )
              }
              disabled={exportingPdf || loading}
              style={{
                ...ghostBtn,
                opacity: exportingPdf || loading ? 0.6 : 1,
                cursor: exportingPdf || loading ? "not-allowed" : "pointer",
              }}
            >
              {exportingPdf ? (
                <>
                  <Loader2
                    size={17}
                    style={{ animation: "spin 1s linear infinite" }}
                  />
                  PDF ({exportProgress.done}/{exportProgress.total})...
                </>
              ) : (
                <>
                  <FileDown size={17} />
                  Export PDF
                </>
              )}
            </button>

            <div style={searchWrap}>
              <Search size={16} color="#8b87ad" />
              <input
                placeholder="Raadi Magac, ID, ama Password..."
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
                    <div key={`${student.collection}_${student.id}`} style={studentRow}>
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
                            e.currentTarget.style.display = "none";
                            e.currentTarget.nextSibling.style.display = "flex";
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
                      <span
                        style={{
                          ...tag,
                          color: student.studentType === "Part Time" ? "#fbbf24" : "#c4b5fd",
                          borderColor:
                            student.studentType === "Part Time"
                              ? "rgba(251,191,36,0.35)"
                              : "rgba(139,108,245,0.25)",
                          background:
                            student.studentType === "Part Time"
                              ? "rgba(251,191,36,0.12)"
                              : "rgba(139,108,245,0.12)",
                        }}
                      >
                        {student.studentType || "Full Time"}
                      </span>
                      <span style={tag}>{student.studentPhone || "—"}</span>
                      <span style={tag}>${student.monthlyFee || "0"}/bishii</span>

                      {/* Export Hal Arday PDF */}
                      <button
                        onClick={() => exportStudentsToPdf([student], `(${student.fullName})`)}
                        title="Export Hal Arday PDF"
                        style={iconBtnExport}
                      >
                        <FileDown size={15} />
                      </button>

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

      {/* Modal Edit Student */}
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

const filterDropdownWrap = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  background: "rgba(255,255,255,0.03)",
  padding: "0 12px",
  borderRadius: 10,
  border: "1.5px solid rgba(139,108,245,0.35)",
};

const filterSelect = {
  background: "transparent",
  color: "#fff",
  border: "none",
  padding: "12px 0",
  outline: "none",
  fontSize: 13.5,
  fontWeight: 600,
  cursor: "pointer",
};

const purpleBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "linear-gradient(90deg,#6d5df0,#8b6cf5)",
  color: "#fff",
  border: "none",
  padding: "12px 18px",
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
  padding: "12px 18px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 14,
};

const searchWrap = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: 260,
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
  fontSize: 13.5,
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

const iconBtnExport = {
  background: "rgba(16,185,129,0.12)",
  border: "1px solid rgba(16,185,129,0.3)",
  color: "#10b981",
  width: 32,
  height: 32,
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
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