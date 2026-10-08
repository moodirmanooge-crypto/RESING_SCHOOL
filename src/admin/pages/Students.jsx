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
  Users,
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
  Clock,
  LayoutGrid,
  List as ListIcon,
} from "lucide-react";

const classOptions = ["1", "2", "3", "4", "5", "6", "7", "8", "F1", "F2", "F3", "F4"];

// ----------------------------------------------------
// Hawlaha yaryar (helpers) — isla sidii hore
// ----------------------------------------------------
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

// Midabka kore ee kaarka (banner) — Free = jaalle, Part Time = buluug, inta kale = cawlan
function getBannerGradient(student) {
  if (student.feeType === "Free") return "linear-gradient(135deg,#f59e0b,#d97706)";
  if (student.studentType === "Part Time") return "linear-gradient(135deg,#0ea5e9,#0369a1)";
  return "linear-gradient(135deg,#94a3b8,#64748b)";
}

// ----------------------------------------------------
// Avatar: sawir ama xarfaha hore haddii sawirku jirin
// ----------------------------------------------------
function Avatar({ student, size = 56 }) {
  const [failed, setFailed] = useState(false);
  const photoUrl = getStudentPhotoUrl(student);
  const showPhoto = photoUrl && !failed;

  return showPhoto ? (
    <img
      src={photoUrl}
      alt={student.fullName || "Student"}
      onError={() => setFailed(true)}
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: 20,
        objectFit: "cover",
        objectPosition: "center top", // wejiga ayaa la muujinayaa
        display: "block",
        background: "#fff",
        border: "3px solid #fff",
        boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
      }}
    />
  ) : (
    <div
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: 16,
        background: "#fff",
        color: "#15803d",
        border: "3px solid #fff",
        boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 800,
        fontSize: size * 0.34,
      }}
    >
      {(student.fullName || "?").trim().slice(0, 2).toUpperCase()}
    </div>
  );
}

export default function Students() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Doorashooyinka Class-ka iyo Type-ka
  const [selectedClass, setSelectedClass] = useState("ALL");
  const [selectedType, setSelectedType] = useState("ALL");
  // Filter-ka Free / Paid (ALL | Free | Paid)
  const [feeFilter, setFeeFilter] = useState("ALL");
  // Filter-ka Shift-ka (waxaa laga soo qaadaa xogta ardayda)
  const [selectedShift, setSelectedShift] = useState("ALL");
  // Kaliya ardayda agoonta ah
  const [orphanOnly, setOrphanOnly] = useState(false);
  // Habka loo eego: grid (kaararka) ama list (saf-saf)
  const [viewMode, setViewMode] = useState("grid");
  // Sida loo kala sooco: id | name | class
  const [sortBy, setSortBy] = useState("id");

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

  // Ardayda aan la codsan in la tirtiro
  const activeStudents = students.filter((s) => !s.pendingDeletion);

  // Liiska Shift-yada ee jira (haddii xogtu leedahay)
  const shiftOptions = [
    ...new Set(activeStudents.map((s) => s.shift).filter(Boolean)),
  ];

  // Filter-ka Isku dhafka ah (Class + Type + Fee + Shift + Orphan + Search) iyo kala soocidda
  const filteredStudents = students
    .filter((s) => {
      if (s.pendingDeletion) return false;

      const matchesClass =
        selectedClass === "ALL" || String(s.className) === String(selectedClass);

      const matchesType =
        selectedType === "ALL" || String(s.studentType) === String(selectedType);

      const isFree = s.feeType === "Free";
      const matchesFee =
        feeFilter === "ALL" ||
        (feeFilter === "Free" && isFree) ||
        (feeFilter === "Paid" && !isFree);

      const matchesShift = selectedShift === "ALL" || s.shift === selectedShift;
      const matchesOrphan = !orphanOnly || s.orphanStatus === "Yes";

      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (s.studentId || "").toLowerCase().includes(q) ||
        (s.parentPassword || "").toLowerCase().includes(q) ||
        (s.fullName || "").toLowerCase().includes(q) ||
        (s.parentPhone || "").includes(q) ||
        (s.studentPhone || "").includes(q);

      return (
        matchesClass &&
        matchesType &&
        matchesFee &&
        matchesShift &&
        matchesOrphan &&
        matchesSearch
      );
    })
    .sort((a, b) => {
      if (sortBy === "name") return (a.fullName || "").localeCompare(b.fullName || "");
      if (sortBy === "class")
        return String(a.className || "").localeCompare(String(b.className || ""), undefined, {
          numeric: true,
        });
      return String(a.studentId || "").localeCompare(String(b.studentId || ""), undefined, {
        numeric: true,
      });
    });

  // Liiska loo diyaariyey EXPORT-ka PDF: Fee Type lama akhriyo (had iyo jeer Dhamaan Fee Types)
  const exportStudents = students
    .filter((s) => {
      if (s.pendingDeletion) return false;

      const matchesClass =
        selectedClass === "ALL" || String(s.className) === String(selectedClass);

      const matchesType =
        selectedType === "ALL" || String(s.studentType) === String(selectedType);

      const matchesShift = selectedShift === "ALL" || s.shift === selectedShift;
      const matchesOrphan = !orphanOnly || s.orphanStatus === "Yes";

      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (s.studentId || "").toLowerCase().includes(q) ||
        (s.parentPassword || "").toLowerCase().includes(q) ||
        (s.fullName || "").toLowerCase().includes(q) ||
        (s.parentPhone || "").includes(q) ||
        (s.studentPhone || "").includes(q);

      return matchesClass && matchesType && matchesShift && matchesOrphan && matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === "name") return (a.fullName || "").localeCompare(b.fullName || "");
      if (sortBy === "class")
        return String(a.className || "").localeCompare(String(b.className || ""), undefined, {
          numeric: true,
        });
      return String(a.studentId || "").localeCompare(String(b.studentId || ""), undefined, {
        numeric: true,
      });
    });

  // Tirooyinka kaararka kore (stats)
  const totalCount = activeStudents.length;
  const fullTimeCount = activeStudents.filter((s) => s.studentType !== "Part Time").length;
  const partTimeCount = activeStudents.filter((s) => s.studentType === "Part Time").length;
  const freeStudentsCount = activeStudents.filter((s) => s.feeType === "Free").length;
  const paidStudentsCount = activeStudents.filter((s) => s.feeType !== "Free").length;
  const orphanCount = activeStudents.filter((s) => s.orphanStatus === "Yes").length;
  const classesCount = new Set(activeStudents.map((s) => s.className).filter(Boolean)).size;
  const totalMonthly = activeStudents.reduce(
    (sum, s) => sum + (s.feeType === "Free" ? 0 : Number(s.monthlyFee) || 0),
    0
  );

  // Kaararka kore way is-gaar-gaar yihiin (riix si aad u shaandheyso)
  function resetAllFilters() {
    setSelectedType("ALL");
    setFeeFilter("ALL");
    setOrphanOnly(false);
  }

  const statCards = [
    {
      key: "all",
      icon: Users,
      value: totalCount,
      label: "Dhamaan",
      active: selectedType === "ALL" && feeFilter === "ALL" && !orphanOnly,
      onClick: resetAllFilters,
    },
    {
      key: "full",
      icon: GraduationCap,
      value: fullTimeCount,
      label: "Full Time",
      active: selectedType === "Full Time",
      onClick: () => setSelectedType(selectedType === "Full Time" ? "ALL" : "Full Time"),
    },
    {
      key: "part",
      icon: Clock,
      value: partTimeCount,
      label: "Part Time",
      active: selectedType === "Part Time",
      onClick: () => setSelectedType(selectedType === "Part Time" ? "ALL" : "Part Time"),
    },
    {
      key: "free",
      icon: UserCheck,
      value: freeStudentsCount,
      label: "Free",
      active: feeFilter === "Free",
      onClick: () => setFeeFilter(feeFilter === "Free" ? "ALL" : "Free"),
    },
    {
      key: "paid",
      icon: Wallet,
      value: paidStudentsCount,
      label: "Paid",
      active: feeFilter === "Paid",
      onClick: () => setFeeFilter(feeFilter === "Paid" ? "ALL" : "Paid"),
    },
    {
      key: "orphan",
      icon: Heart,
      value: orphanCount,
      label: "Agoon",
      active: orphanOnly,
      onClick: () => setOrphanOnly(!orphanOnly),
    },
  ];

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
  // EXPORT PDF: EXCEL TABLE FORMAT WITH SAFE INDEXING (isbeddel malahan)
  // ----------------------------------------------------
  async function exportStudentsToPdf(targetStudents = exportStudents, titleSuffix = "") {
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

  // Badhamada yaryar ee kaarka (Export / Edit / Delete)
  function ActionButtons({ student }) {
    return (
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => exportStudentsToPdf([student], `(${student.fullName})`)}
          title="Export Hal Arday PDF"
          style={iconBtnExport}
        >
          <FileDown size={15} />
        </button>
        <button onClick={() => openEdit(student)} title="Edit" style={iconBtnEdit}>
          <Pencil size={15} />
          <span style={{ fontSize: 12.5, fontWeight: 700 }}>Edit</span>
        </button>
        <button onClick={() => deleteStudent(student)} title="Delete" style={iconBtnDelete}>
          <Trash2 size={15} />
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f3f6f4" }}>
      <Sidebar />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: "20px 24px 0" }}>
          <Topbar title="Student List" />
        </div>

        <div style={{ padding: "22px 30px 40px" }}>
          {/* ================= HEADER-KA CAGAARKA ================= */}
          <div style={heroBanner}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={heroKicker}>RISING STAR SCHOOL</div>
              <h1 style={{ margin: "6px 0 4px", fontSize: 28, fontWeight: 800, color: "#fff" }}>
                Student Directory
              </h1>
              <p style={{ margin: 0, fontSize: 13.5, color: "rgba(255,255,255,0.85)" }}>
                Dhamaan ardayda — raadi, shaandhee, oo wax ka bedel.
              </p>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={heroStat}>
                <div style={heroStatValue}>{totalCount}</div>
                <div style={heroStatLabel}>Arday</div>
              </div>
              <div style={heroStat}>
                <div style={heroStatValue}>{classesCount}</div>
                <div style={heroStatLabel}>Fasal</div>
              </div>
              <div style={heroStat}>
                <div style={heroStatValue}>${totalMonthly}</div>
                <div style={heroStatLabel}>Bishii</div>
              </div>

              <Link to="/admin/add-student" style={{ textDecoration: "none" }}>
                <button style={heroBtn}>
                  <Plus size={16} />
                  Add Student
                </button>
              </Link>
              <Link to="/admin/bulk-registration" style={{ textDecoration: "none" }}>
                <button style={heroBtnGhost}>
                  <Upload size={16} />
                  Bulk
                </button>
              </Link>
            </div>
          </div>

          {/* ================= KAARARKA STATS (riix si loo shaandheeyo) ================= */}
          <div style={statsRow}>
            {statCards.map((c) => {
              const Icon = c.icon;
              return (
                <button
                  key={c.key}
                  onClick={c.onClick}
                  style={{
                    ...statCard,
                    ...(c.active ? statCardActive : {}),
                  }}
                >
                  <Icon size={16} color={c.active ? "#16a34a" : "#9ca3af"} />
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#111827", marginTop: 6 }}>
                    {c.value}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#6b7280", fontWeight: 600 }}>
                    {c.label}
                  </div>
                </button>
              );
            })}
          </div>

          {/* ================= TOOLBAR: raadin + filters ================= */}
          <div style={toolbar}>
            <div style={searchWrap}>
              <Search size={16} color="#9ca3af" />
              <input
                placeholder="Raadi magac, ID, telefoon, password..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={searchInput}
              />
            </div>

            {/* Filter Fasalka */}
            <div style={filterDropdownWrap}>
              <Filter size={15} color="#16a34a" />
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

            {/* Filter Nooca Ardayga */}
            <div style={filterDropdownWrap}>
              <UserCheck size={15} color="#16a34a" />
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

            {/* Filter Fee Type */}
            <div style={filterDropdownWrap}>
              <Wallet size={15} color="#16a34a" />
              <select
                value={feeFilter}
                onChange={(e) => setFeeFilter(e.target.value)}
                style={filterSelect}
              >
                <option value="ALL">Dhamaan Fee Types</option>
                <option value="Free">Free</option>
                <option value="Paid">Paid</option>
              </select>
            </div>

            {/* Filter Shift — kaliya haddii xogtu leedahay shift */}
            {shiftOptions.length > 0 && (
              <div style={filterDropdownWrap}>
                <Clock size={15} color="#16a34a" />
                <select
                  value={selectedShift}
                  onChange={(e) => setSelectedShift(e.target.value)}
                  style={filterSelect}
                >
                  <option value="ALL">Dhamaan Shifts</option>
                  {shiftOptions.map((sh) => (
                    <option key={sh} value={sh}>
                      {sh}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Kala soocidda */}
            <div style={filterDropdownWrap}>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={filterSelect}
              >
                <option value="id">Sort: ID</option>
                <option value="name">Sort: Magac</option>
                <option value="class">Sort: Class</option>
              </select>
            </div>

            {/* Export PDF */}
            <button
              onClick={() =>
                exportStudentsToPdf(
                  exportStudents,
                  `(${selectedClass === "ALL" ? "Dhamaan Class-yada" : "Class " + selectedClass} - ${selectedType === "ALL" ? "Dhamaan Types" : selectedType} - Dhamaan Fee Types)`
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
                  <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                  PDF ({exportProgress.done}/{exportProgress.total})...
                </>
              ) : (
                <>
                  <FileDown size={16} />
                  Export PDF
                </>
              )}
            </button>

            {/* Grid / List */}
            <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
              <button
                onClick={() => setViewMode("grid")}
                title="Grid"
                style={{ ...viewBtn, ...(viewMode === "grid" ? viewBtnActive : {}) }}
              >
                <LayoutGrid size={16} />
              </button>
              <button
                onClick={() => setViewMode("list")}
                title="List"
                style={{ ...viewBtn, ...(viewMode === "list" ? viewBtnActive : {}) }}
              >
                <ListIcon size={16} />
              </button>
            </div>
          </div>

          <div style={{ fontSize: 12.5, color: "#6b7280", margin: "4px 2px 14px", fontWeight: 600 }}>
            Muujinaya {filteredStudents.length} ka mid ah {totalCount} arday
          </div>

          {/* ================= LIISKA ARDAYDA ================= */}
          {loading ? (
            <p style={{ color: "#6b7280" }}>Loading...</p>
          ) : filteredStudents.length === 0 ? (
            <div style={emptyBox}>Wax arday ah lama helin.</div>
          ) : viewMode === "grid" ? (
            // ---------- HABKA GRID (kaararka) ----------
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))",
                gap: 18,
              }}
            >
              {filteredStudents.map((student) => (
                <div key={`${student.collection}_${student.id}`} style={card}>
                  {/* Banner-ka midabka leh */}
                  <div style={{ ...cardBanner, background: getBannerGradient(student) }}>
                    <span style={idChip}>ID {student.studentId || "—"}</span>
                  </div>

                  <div style={{ padding: "0 18px 16px" }}>
                    {/* position + zIndex: sawirku wuxuu ka sarreeyaa banner-ka, lagana qarin */}
                    <div style={{ marginTop: -46, position: "relative", zIndex: 2 }}>
                      <Avatar student={student} size={92} />
                    </div>

                    <div style={{ marginTop: 10, fontWeight: 800, fontSize: 15.5, color: "#111827" }}>
                      {student.fullName || "—"}
                    </div>

                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                      <span style={chip}>Class {student.className || "—"}</span>
                      <span
                        style={{
                          ...chip,
                          ...(student.studentType === "Part Time" ? chipBlue : chipGreen),
                        }}
                      >
                        {student.studentType || "Full Time"}
                      </span>
                      {student.orphanStatus === "Yes" && <span style={chipRose}>Agoon</span>}
                    </div>

                    {/* Xogta xiriirka */}
                    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                      <InfoLine icon={User} label="Hooyo" value={student.motherName} />
                      <InfoLine icon={Phone} label="Waalidka" value={student.parentPhone} />
                      <InfoLine icon={Smartphone} label="Ardayga" value={student.studentPhone} />
                      <InfoLine icon={Clock} label="Shift" value={student.shift} />
                      <InfoLine icon={MapPin} label="Degmo" value={student.district} />
                    </div>

                    {/* Lacagta */}
                    <div style={feeBox}>
                      <div>
                        <div style={feeLabel}>NOOCA LACAGTA</div>
                        <div style={feeValue}>
                          {student.feeType === "Free" ? "Free" : "Monthly"}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={feeLabel}>BISHII</div>
                        <div style={feeValue}>${student.monthlyFee || "0"}</div>
                      </div>
                    </div>

                    <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
                      <ActionButtons student={student} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // ---------- HABKA LIST (saf-saf) ----------
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filteredStudents.map((student) => (
                <div key={`${student.collection}_${student.id}`} style={studentRow}>
                  <Avatar student={student} size={46} />

                  <div style={{ flex: 1, minWidth: 170 }}>
                    <div style={{ color: "#111827", fontWeight: 700, fontSize: 14.5 }}>
                      {student.fullName || "—"}
                    </div>
                    <div style={{ color: "#6b7280", fontSize: 12.5, marginTop: 2 }}>
                      ID: {student.studentId || "—"}
                    </div>
                  </div>

                  <span style={chip}>Class {student.className || "—"}</span>
                  <span
                    style={{
                      ...chip,
                      ...(student.studentType === "Part Time" ? chipBlue : chipGreen),
                    }}
                  >
                    {student.studentType || "Full Time"}
                  </span>
                  <span style={chip}>{student.studentPhone || "—"}</span>
                  <span style={chip}>${student.monthlyFee || "0"}/bishii</span>

                  <ActionButtons student={student} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ================= MODAL: EDIT STUDENT ================= */}
      {editData && (
        <div style={overlay}>
          <div style={modal}>
            <div style={modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <GraduationCap size={20} color="#16a34a" />
                <h2 style={{ color: "#111827", margin: 0, fontSize: 19 }}>
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
                      : "rgba(22,163,74,0.08)",
                    border: "2px dashed #16a34a",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    overflow: "hidden",
                  }}
                >
                  {!photoPreview && <Camera color="#16a34a" size={26} />}
                </label>
                <input
                  id="editPhoto"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  style={{ display: "none" }}
                />
                <div>
                  <div style={{ fontWeight: 700, color: "#111827", fontSize: 15 }}>
                    Sawirka Ardayga
                  </div>
                  <div style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>
                    Riix goobta si aad sawir cusub uga soo dooratid
                  </div>
                  <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 4 }}>
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
        input::placeholder { color: #9ca3af; }
        select option { background: #ffffff; color: #111827; }
      `}</style>
    </div>
  );
}

// Hal sadar oo xog ah ee kaarka (icon + calaamad + qiimo)
function InfoLine({ icon: Icon, label: labelText, value }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
      <Icon size={13} color="#16a34a" style={{ flexShrink: 0 }} />
      <span style={{ color: "#9ca3af", minWidth: 58 }}>{labelText}</span>
      <span
        style={{
          color: "#374151",
          fontWeight: 600,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value || "—"}
      </span>
    </div>
  );
}

function Field({ icon: Icon, label: labelText, children }) {
  return (
    <div>
      <label style={label}>
        <Icon size={15} color="#16a34a" />
        {labelText}
      </label>
      {children}
    </div>
  );
}

/* ====================================================
   STYLES (habka iftiinka leh — green, sida sawirka labaad)
   ==================================================== */

const heroBanner = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: 18,
  padding: "26px 30px",
  borderRadius: 20,
  background: "linear-gradient(120deg,#16a34a,#15803d 60%,#166534)",
  boxShadow: "0 14px 30px rgba(22,163,74,0.25)",
};

const heroKicker = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.14em",
  color: "rgba(255,255,255,0.75)",
};

const heroStat = {
  background: "rgba(255,255,255,0.16)",
  border: "1px solid rgba(255,255,255,0.22)",
  borderRadius: 14,
  padding: "10px 18px",
  textAlign: "center",
  minWidth: 70,
};

const heroStatValue = { fontSize: 20, fontWeight: 800, color: "#fff", lineHeight: 1.1 };
const heroStatLabel = { fontSize: 11, color: "rgba(255,255,255,0.8)", fontWeight: 600 };

const heroBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "#fff",
  color: "#15803d",
  border: "none",
  padding: "12px 18px",
  borderRadius: 12,
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 14,
};

const heroBtnGhost = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "rgba(255,255,255,0.14)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.35)",
  padding: "12px 18px",
  borderRadius: 12,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 14,
};

const statsRow = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: 12,
  margin: "18px 0",
};

const statCard = {
  textAlign: "left",
  background: "#fff",
  border: "1.5px solid #e5e7eb",
  borderRadius: 14,
  padding: "12px 14px",
  cursor: "pointer",
};

const statCardActive = {
  borderColor: "#16a34a",
  boxShadow: "0 6px 16px rgba(22,163,74,0.18)",
  background: "#f0fdf4",
};

const toolbar = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 12,
  marginBottom: 10,
};

const searchWrap = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flex: "1 1 240px",
  minWidth: 220,
  padding: "0 14px",
  borderRadius: 10,
  border: "1.5px solid #e5e7eb",
  background: "#f9fafb",
};

const searchInput = {
  flex: 1,
  padding: "11px 0",
  border: "none",
  outline: "none",
  background: "transparent",
  color: "#111827",
  fontSize: 13.5,
};

const filterDropdownWrap = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  background: "#f9fafb",
  padding: "0 12px",
  borderRadius: 10,
  border: "1.5px solid #e5e7eb",
};

const filterSelect = {
  background: "transparent",
  color: "#111827",
  border: "none",
  padding: "11px 0",
  outline: "none",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const ghostBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "#f9fafb",
  color: "#111827",
  border: "1.5px solid #e5e7eb",
  padding: "11px 16px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 13,
};

const viewBtn = {
  width: 38,
  height: 38,
  borderRadius: 10,
  border: "1.5px solid #e5e7eb",
  background: "#fff",
  color: "#6b7280",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const viewBtnActive = {
  background: "#16a34a",
  borderColor: "#16a34a",
  color: "#fff",
};

const emptyBox = {
  background: "#fff",
  border: "1px dashed #d1d5db",
  borderRadius: 14,
  padding: 30,
  textAlign: "center",
  color: "#6b7280",
};

const card = {
  background: "#fff",
  borderRadius: 18,
  border: "1px solid #e5e7eb",
  overflow: "hidden",
  boxShadow: "0 6px 18px rgba(15,23,42,0.05)",
};

const cardBanner = {
  height: 84,
  position: "relative",
};

const idChip = {
  position: "absolute",
  top: 10,
  right: 12,
  zIndex: 1,
  background: "rgba(255,255,255,0.22)",
  color: "#fff",
  fontSize: 11,
  fontWeight: 800,
  padding: "4px 10px",
  borderRadius: 999,
};

const chip = {
  background: "#f3f4f6",
  color: "#4b5563",
  fontSize: 11.5,
  fontWeight: 700,
  padding: "4px 10px",
  borderRadius: 999,
  whiteSpace: "nowrap",
};

const chipGreen = { background: "#dcfce7", color: "#15803d" };
const chipBlue = { background: "#e0f2fe", color: "#0369a1" };
const chipRose = {
  background: "#ffe4e6",
  color: "#be123c",
  fontSize: 11.5,
  fontWeight: 700,
  padding: "4px 10px",
  borderRadius: 999,
};

const feeBox = {
  marginTop: 14,
  display: "flex",
  justifyContent: "space-between",
  background: "#f9fafb",
  border: "1px solid #eef0f2",
  borderRadius: 12,
  padding: "10px 14px",
};

const feeLabel = { fontSize: 10, color: "#9ca3af", fontWeight: 800, letterSpacing: "0.06em" };
const feeValue = { fontSize: 14.5, color: "#111827", fontWeight: 800, marginTop: 2 };

const studentRow = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: "12px 16px",
  background: "#fff",
  borderRadius: 14,
  border: "1px solid #e5e7eb",
  flexWrap: "wrap",
};

const iconBtnExport = {
  background: "#ecfdf5",
  border: "1px solid #a7f3d0",
  color: "#059669",
  width: 34,
  height: 34,
  borderRadius: 9,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const iconBtnEdit = {
  background: "#16a34a",
  border: "none",
  color: "#fff",
  height: 34,
  padding: "0 14px",
  borderRadius: 9,
  display: "flex",
  alignItems: "center",
  gap: 6,
  cursor: "pointer",
};

const iconBtnDelete = {
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#dc2626",
  width: 34,
  height: 34,
  borderRadius: 9,
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
  background: "rgba(15,23,42,0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: 20,
};

const modal = {
  background: "#fff",
  border: "1px solid #e5e7eb",
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
  borderBottom: "1px solid #e5e7eb",
};

const closeBtn = {
  background: "#f3f4f6",
  border: "none",
  color: "#374151",
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
  borderTop: "1px solid #e5e7eb",
};

const cancelBtn = {
  background: "#f9fafb",
  border: "1.5px solid #e5e7eb",
  color: "#374151",
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
  background: "linear-gradient(90deg,#16a34a,#15803d)",
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
  color: "#111827",
  marginBottom: 8,
};

const input = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1.5px solid #e5e7eb",
  boxSizing: "border-box",
  fontSize: 14,
  color: "#111827",
  background: "#f9fafb",
  outline: "none",
};

const grid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "20px 24px",
};