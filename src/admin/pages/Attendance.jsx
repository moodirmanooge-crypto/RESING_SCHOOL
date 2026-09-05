import { useEffect, useMemo, useState, useRef } from "react";
import { db } from "../../firebase/firebase";
import { collection, getDocs, doc, writeBatch } from "firebase/firestore";
import {
  CalendarCheck,
  Users,
  School,
  Search,
  ChevronDown,
  ChevronUp,
  Clock,
  Check,
  X,
  AlertCircle,
  Loader2,
  Printer,
  Filter,
  Save,
  Download,
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import schoolLogo from "../assets/logo.png";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const CLASS_ORDER = ["1", "2", "3", "4", "5", "6", "7", "8", "F1", "F2", "F3", "F4"];

function formatClassName(className) {
  if (!className) return "";
  let clean = String(className).trim();
  clean = clean.replace(/^fasalka\s*/i, "");
  return `Fasalka ${clean}`;
}

function classRank(className) {
  const clean = String(className || "").replace(/^fasalka\s*/i, "").trim().toUpperCase();
  const idx = CLASS_ORDER.indexOf(clean);
  return idx === -1 ? 999 : idx;
}

function ResponsiveStyles() {
  return (
    <style>{`
      .att-layout { display: flex; min-height: 100vh; background: #0b0a1c; }
      .att-content { flex: 1; min-width: 0; }
      .att-summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 24px; }
      .att-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
      .att-mini-table { width: 100%; border-collapse: collapse; min-width: 750px; }

      .print-only-header { display: none; }

      /* PDF Generation Mode Class */
      body.pdf-export-mode {
        background: #ffffff !important;
      }
      body.pdf-export-mode .no-print, 
      body.pdf-export-mode nav, 
      body.pdf-export-mode sidebar, 
      body.pdf-export-mode header, 
      body.pdf-export-mode .att-summary-grid, 
      body.pdf-export-mode .att-filters-bar, 
      body.pdf-export-mode .att-header-row {
        display: none !important;
      }
      body.pdf-export-mode .att-layout, 
      body.pdf-export-mode .att-content, 
      body.pdf-export-mode .att-page-pad {
        background: #ffffff !important;
        padding: 0 !important;
        margin: 0 !important;
        width: 100% !important;
      }
      body.pdf-export-mode .print-only-header {
        display: flex !important;
        align-items: center;
        justify-content: space-between;
        border-bottom: 2px solid #1e1a4a;
        padding-bottom: 10px !important;
        margin-bottom: 15px !important;
        font-family: Arial, sans-serif;
      }
      body.pdf-export-mode .print-logo-area {
        display: flex !important;
        align-items: center;
        gap: 12px;
      }
      body.pdf-export-mode .print-logo-img {
        width: 55px !important;
        height: 55px !important;
        object-fit: contain;
      }
      body.pdf-export-mode .print-school-title {
        font-size: 16px !important;
        font-weight: 800 !important;
        color: #1e1a4a !important;
        margin: 0 !important;
        text-transform: uppercase;
      }
      body.pdf-export-mode .print-school-sub {
        font-size: 11px !important;
        color: #555555 !important;
        margin: 2px 0 0 0 !important;
      }
      body.pdf-export-mode .print-meta-box {
        text-align: right !important;
        font-size: 10px !important;
        color: #333 !important;
        line-height: 1.4;
      }
      body.pdf-export-mode .att-class-card {
        background: #ffffff !important;
        border: 1px solid #d1d5db !important;
        border-radius: 6px !important;
        padding: 10px !important;
        margin-bottom: 15px !important;
        box-shadow: none !important;
      }
      body.pdf-export-mode .att-class-card * {
        color: #000000 !important;
        text-shadow: none !important;
      }
      body.pdf-export-mode .att-mini-table {
        width: 100% !important;
        min-width: 100% !important;
        table-layout: auto !important;
        border-collapse: collapse !important;
        margin-top: 8px !important;
      }
      body.pdf-export-mode .att-mini-table th {
        background: #f1f5f9 !important;
        color: #0f172a !important;
        border: 1px solid #94a3b8 !important;
        padding: 6px 8px !important;
        font-size: 10px !important;
        font-weight: bold;
        text-align: left;
      }
      body.pdf-export-mode .att-mini-table td {
        border: 1px solid #cbd5e1 !important;
        padding: 5px 8px !important;
        font-size: 10px !important;
        background: #ffffff !important;
        color: #000000 !important;
      }

      @media print {
        @page {
          size: auto;
          margin: 10mm;
        }
        
        html, body {
          background: #ffffff !important;
          color: #000000 !important;
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        .no-print, nav, sidebar, header, .att-summary-grid, .att-filters-bar, .att-header-row {
          display: none !important;
        }

        .att-layout, .att-content, .att-page-pad {
          display: block !important;
          background: #ffffff !important;
          padding: 0 !important;
          margin: 0 !important;
          width: 100% !important;
        }

        .print-only-header {
          display: flex !important;
          align-items: center;
          justify-content: space-between;
          border-bottom: 2px solid #1e1a4a;
          padding-bottom: 10px !important;
          margin-bottom: 15px !important;
          font-family: Arial, sans-serif;
        }

        .print-logo-area {
          display: flex !important;
          align-items: center;
          gap: 12px;
        }

        .print-logo-img {
          width: 55px !important;
          height: 55px !important;
          object-fit: contain;
        }

        .print-school-title {
          font-size: 16px !important;
          font-weight: 800 !important;
          color: #1e1a4a !important;
          margin: 0 !important;
          text-transform: uppercase;
        }

        .print-school-sub {
          font-size: 11px !important;
          color: #555555 !important;
          margin: 2px 0 0 0 !important;
        }

        .print-meta-box {
          text-align: right !important;
          font-size: 10px !important;
          color: #333 !important;
          line-height: 1.4;
        }

        .att-class-card {
          background: #ffffff !important;
          border: 1px solid #d1d5db !important;
          border-radius: 6px !important;
          padding: 10px !important;
          margin-bottom: 15px !important;
          page-break-inside: avoid;
          box-shadow: none !important;
        }

        .att-class-card * {
          color: #000000 !important;
          text-shadow: none !important;
        }

        .att-table-wrap {
          overflow: visible !important;
        }

        .att-mini-table {
          width: 100% !important;
          min-width: 100% !important;
          table-layout: auto !important;
          border-collapse: collapse !important;
          margin-top: 8px !important;
        }

        .att-mini-table th {
          background: #f1f5f9 !important;
          color: #0f172a !important;
          border: 1px solid #94a3b8 !important;
          padding: 6px 8px !important;
          font-size: 10px !important;
          font-weight: bold;
          text-align: left;
        }

        .att-mini-table td {
          border: 1px solid #cbd5e1 !important;
          padding: 5px 8px !important;
          font-size: 10px !important;
          background: #ffffff !important;
          color: #000000 !important;
        }

        .print-badge-present {
          color: #15803d !important;
          font-weight: bold;
        }
        .print-badge-absent {
          color: #b91c1c !important;
          font-weight: bold;
        }
        .print-badge-excused {
          color: #1d4ed8 !important;
          font-weight: bold;
        }
      }

      @media (max-width: 900px) {
        .att-summary-grid { grid-template-columns: 1fr 1fr; gap: 12px; }
        .att-page-pad { padding: 16px !important; }
        .att-class-card { padding: 16px !important; }
        .att-teacher-row { flex-direction: column; align-items: flex-start !important; }
      }
      @media (max-width: 480px) {
        .att-summary-grid { grid-template-columns: 1fr; }
      }
    `}</style>
  );
}

export default function Attendance() {
  const [records, setRecords] = useState([]);
  const [teachers, setTeachers] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedClassFilter, setSelectedClassFilter] = useState("ALL");
  const [selectedTeacherFilter, setSelectedTeacherFilter] = useState("ALL");
  const [timeRangeFilter, setTimeRangeFilter] = useState("ALL");
  const [expandedClass, setExpandedClass] = useState({});
  const [expandedDate, setExpandedDate] = useState({});

  const [pendingChanges, setPendingChanges] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);

  const reportRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const teachersSnap = await getDocs(collection(db, "teachers"));
      const teacherMap = {};
      teachersSnap.docs.forEach((d) => {
        const data = d.data();
        teacherMap[d.id] = {
          fullName: data.fullName || data.username || d.id,
          photoUrl: data.photoUrl || data.photoURL || data.avatar || "",
          subject: data.subject || data.subjectName || "",
        };
      });
      setTeachers(teacherMap);

      const attSnap = await getDocs(collection(db, "attendance"));
      const fullTimeList = attSnap.docs
        .map((d) => ({ id: d.id, ...d.data(), sourceCollection: "attendance" }))
        .filter(
          (r) =>
            r.className &&
            String(r.className).trim() !== "" &&
            r.studentId &&
            String(r.studentId).trim() !== "" &&
            r.date
        );

      // Part-time attendance (Thursday/Friday classes) lives in its own
      // collection — same shape as "attendance", so it's merged straight
      // into the same `records` list and flows through every filter,
      // stat, and edit path below exactly like full-time records do.
      const attPartTimeSnap = await getDocs(collection(db, "attendancePartTime"));
      const partTimeList = attPartTimeSnap.docs
        .map((d) => ({ id: d.id, ...d.data(), sourceCollection: "attendancePartTime" }))
        .filter(
          (r) =>
            r.className &&
            String(r.className).trim() !== "" &&
            r.studentId &&
            String(r.studentId).trim() !== "" &&
            r.date
        );

      setRecords([...fullTimeList, ...partTimeList]);
    } catch (err) {
      console.log(err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const studentStats = useMemo(() => {
    const studentDates = {};

    records.forEach((r) => {
      const sId = r.studentId;
      if (!sId) return;

      if (!studentDates[sId]) studentDates[sId] = {};
      
      const currentStatus = pendingChanges[r.id] || r.status;

      if (!studentDates[sId][r.date]) {
        studentDates[sId][r.date] = [];
      }
      studentDates[sId][r.date].push(currentStatus);
    });

    const stats = {};
    Object.keys(studentDates).forEach((sId) => {
      let presentDays = 0;
      let absentDays = 0;
      let excusedDays = 0;
      const dates = Object.keys(studentDates[sId]);

      dates.forEach((d) => {
        const statuses = studentDates[sId][d];
        if (statuses.includes("Present")) {
          presentDays++;
        } else if (statuses.includes("Excused")) {
          excusedDays++;
        } else {
          absentDays++;
        }
      });

      const validTotalDays = presentDays + absentDays;
      const percent = validTotalDays > 0 ? Math.round((presentDays / validTotalDays) * 100) : 100;

      stats[sId] = {
        presentDays,
        absentDays,
        excusedDays,
        totalDays: validTotalDays,
        percent,
      };
    });

    return stats;
  }, [records, pendingChanges]);

  const filteredRecords = useMemo(() => {
    const now = new Date();

    return records.filter((r) => {
      if (selectedClassFilter !== "ALL") {
        const cleanClass = String(r.className).replace(/^fasalka\s*/i, "").trim().toUpperCase();
        if (cleanClass !== selectedClassFilter.toUpperCase()) {
          return false;
        }
      }

      if (selectedTeacherFilter !== "ALL") {
        if (String(r.teacherId) !== selectedTeacherFilter) {
          return false;
        }
      }

      if (timeRangeFilter !== "ALL" && r.date) {
        const recDate = new Date(r.date);
        const diffTime = Math.abs(now - recDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (timeRangeFilter === "7DAYS" && diffDays > 7) return false;
        if (timeRangeFilter === "30DAYS" && diffDays > 30) return false;
        if (timeRangeFilter === "1YEAR" && diffDays > 365) return false;
      }

      return true;
    });
  }, [records, selectedClassFilter, selectedTeacherFilter, timeRangeFilter]);

  const groupedByClass = useMemo(() => {
    const map = {};

    filteredRecords.forEach((r) => {
      const rawClass = String(r.className || "-").replace(/^fasalka\s*/i, "").trim();
      const teacherId = r.teacherId || "Unknown";

      if (!map[rawClass]) map[rawClass] = {};
      if (!map[rawClass][teacherId]) {
        map[rawClass][teacherId] = { dates: new Set(), records: [] };
      }

      if (r.date) map[rawClass][teacherId].dates.add(r.date);
      map[rawClass][teacherId].records.push(r);
    });

    return map;
  }, [filteredRecords]);

  const teacherOptions = useMemo(() => {
    const teacherIds = Array.from(
      new Set(records.map((r) => r.teacherId).filter(Boolean))
    );
    return teacherIds
      .map((tid) => ({
        id: tid,
        name: teachers[tid]?.fullName || tid,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [records, teachers]);

  const classNames = useMemo(() => {
    const availableClasses = Object.keys(groupedByClass);
    const baseList = selectedClassFilter === "ALL" ? availableClasses : [selectedClassFilter];

    return baseList
      .filter((rawClass) => {
        if (!search.trim()) return true;
        const teacherIdsForClass = Object.keys(groupedByClass[rawClass] || {});
        const matchesClass = formatClassName(rawClass).toLowerCase().includes(search.toLowerCase());
        const matchesTeacher = teacherIdsForClass.some((tid) => {
          const name = teachers[tid]?.fullName || tid;
          return (
            name.toLowerCase().includes(search.toLowerCase()) ||
            tid.toLowerCase().includes(search.toLowerCase())
          );
        });
        return matchesClass || matchesTeacher;
      })
      .sort((a, b) => classRank(a) - classRank(b));
  }, [groupedByClass, search, teachers, selectedClassFilter]);

  const toggleClassExpand = (key) => {
    setExpandedClass((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleDate = (key) => {
    setExpandedDate((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const expandAllSections = () => {
    const openClasses = {};
    const openDates = {};
    classNames.forEach((cn) => {
      const cKey = `class__${cn}`;
      openClasses[cKey] = true;
      const tIds = Object.keys(groupedByClass[cn] || {});
      tIds.forEach((tid) => {
        const tKey = `${cKey}__${tid}`;
        openClasses[`${tKey}__toggle`] = true;
        const dates = Array.from(groupedByClass[cn][tid].dates);
        dates.forEach((d) => {
          openDates[`${tKey}__${d}`] = true;
        });
      });
    });
    setExpandedClass(openClasses);
    setExpandedDate(openDates);
  };

  const handlePrint = () => {
    expandAllSections();
    setTimeout(() => {
      window.print();
    }, 300);
  };

  // Modern PDF Generator function
  const handleDownloadPDF = async () => {
    try {
      setIsDownloadingPDF(true);
      expandAllSections();

      // Add print mode class to document body
      document.body.classList.add("pdf-export-mode");

      await new Promise((resolve) => setTimeout(resolve, 500));

      const input = reportRef.current;
      if (!input) return;

      const canvas = await html2canvas(input, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/jpeg", 1.0);
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = pdfWidth / imgWidth;
      const renderedHeight = imgHeight * ratio;

      pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, renderedHeight);
      pdf.save(`Attendance_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error(err);
      alert("Cillad ayaa ka dhacday soo dejinta PDF-ka: " + err.message);
    } finally {
      // Clean up body class
      document.body.classList.remove("pdf-export-mode");
      setIsDownloadingPDF(false);
    }
  };

  const handleStageStatusChange = (recordId, newStatus) => {
    setPendingChanges((prev) => ({
      ...prev,
      [recordId]: newStatus,
    }));
  };

  const handleSaveChanges = async () => {
    const changeKeys = Object.keys(pendingChanges);
    if (changeKeys.length === 0) return;

    try {
      setIsSaving(true);
      const batch = writeBatch(db);

      // Each record remembers which collection it was loaded from
      // (attendance vs attendancePartTime), so an edit to a part-time
      // record is written back to attendancePartTime and never to the
      // full-time collection — even if the two collections happen to
      // share the same doc ID pattern.
      const recordById = {};
      records.forEach((r) => {
        recordById[r.id] = r;
      });

      changeKeys.forEach((recId) => {
        const newStatus = pendingChanges[recId];
        const sourceCollection = recordById[recId]?.sourceCollection || "attendance";
        const ref = doc(db, sourceCollection, recId);
        batch.update(ref, {
          status: newStatus,
          updatedAt: new Date(),
        });
      });

      await batch.commit();

      setRecords((prev) =>
        prev.map((r) =>
          pendingChanges[r.id] ? { ...r, status: pendingChanges[r.id] } : r
        )
      );
      setPendingChanges({});
      alert("Xogta si guul leh ayaa loo kaydiyay!");
    } catch (err) {
      console.log(err);
      alert("Muu kaydsamin koodka: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const totalTeachers = useMemo(() => {
    return new Set(filteredRecords.map((r) => r.teacherId || "Unknown")).size;
  }, [filteredRecords]);

  const reportDateLabel = useMemo(() => {
    const uniqueDates = Array.from(
      new Set(filteredRecords.map((r) => r.date).filter(Boolean))
    ).sort();

    if (uniqueDates.length === 0) return "—";

    const fmt = (d) => {
      const parsed = new Date(d);
      if (isNaN(parsed.getTime())) return d;
      return parsed.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    };

    if (uniqueDates.length === 1) return fmt(uniqueDates[0]);

    return `${fmt(uniqueDates[0])} - ${fmt(uniqueDates[uniqueDates.length - 1])}`;
  }, [filteredRecords]);

  const hasUnsavedChanges = Object.keys(pendingChanges).length > 0;

  return (
    <div className="att-layout">
      <ResponsiveStyles />
      <div className="no-print">
        <Sidebar />
      </div>

      <div className="att-content">
        <div className="no-print" style={{ padding: "20px 24px 0" }}>
          <Topbar />
        </div>

        <div className="att-page-pad" ref={reportRef} style={{ padding: "26px 30px" }}>
          <div className="print-only-header">
            <div className="print-logo-area">
              <img src={schoolLogo} alt="School Logo" className="print-logo-img" />
              <div>
                <h1 className="print-school-title">Rising Star PRIMARY & SECONDARY SCHOOL</h1>
                <p className="print-school-sub">Diiwaanka Xaadirinta Ardayda (Student Attendance Report)</p>
              </div>
            </div>
            <div className="print-meta-box">
              <div><strong>Fasalka:</strong> {selectedClassFilter === "ALL" ? "Dhammaan" : formatClassName(selectedClassFilter)}</div>
              <div><strong>Macallinka:</strong> {selectedTeacherFilter === "ALL" ? "Dhammaan" : teachers[selectedTeacherFilter]?.fullName || selectedTeacherFilter}</div>
              <div><strong>Taariikhda:</strong> {reportDateLabel}</div>
            </div>
          </div>

          <div
            className="att-header-row no-print"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 24,
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div
                style={{
                  width: 55,
                  height: 55,
                  borderRadius: 15,
                  background: "linear-gradient(135deg,#6d5df0,#8b6cf5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <CalendarCheck color="#fff" size={26} />
              </div>
              <div>
                <h1 className="att-header-title" style={{ margin: 0, fontSize: 26, color: "#fff" }}>
                  Transactions Attendance
                </h1>
                <div style={{ color: "#8b87ad", fontSize: 14 }}>
                  Warbixinta Xaadirinta Fasallada, Macallimiinta, iyo Waqtiyada
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {hasUnsavedChanges && (
                <button
                  onClick={handleSaveChanges}
                  disabled={isSaving}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: "linear-gradient(135deg, #3B82F6, #2563EB)",
                    color: "#fff",
                    border: "none",
                    padding: "12px 20px",
                    borderRadius: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 0 15px rgba(59,130,246,0.5)",
                  }}
                >
                  {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  Save Changes ({Object.keys(pendingChanges).length})
                </button>
              )}

              <button
                onClick={handleDownloadPDF}
                disabled={isDownloadingPDF}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "linear-gradient(135deg, #8B5CF6, #6D5DF0)",
                  color: "#fff",
                  border: "none",
                  padding: "12px 20px",
                  borderRadius: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {isDownloadingPDF ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                Download PDF
              </button>

              <button
                onClick={handlePrint}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "linear-gradient(135deg, #22C55E, #16A34A)",
                  color: "#fff",
                  border: "none",
                  padding: "12px 20px",
                  borderRadius: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <Printer size={18} /> Print A4 Report
              </button>
            </div>
          </div>

          <div
            className="att-filters-bar no-print"
            style={{
              background: "#151233",
              border: "1px solid rgba(139,108,245,0.25)",
              borderRadius: 16,
              padding: "16px 20px",
              marginBottom: 24,
              display: "flex",
              gap: 14,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#8b87ad", fontSize: 14 }}>
              <Filter size={16} /> Filters:
            </div>

            <div>
              <select
                value={selectedClassFilter}
                onChange={(e) => setSelectedClassFilter(e.target.value)}
                style={selectStyle}
              >
                <option value="ALL">Dhammaan Fasallada (All Classes)</option>
                {CLASS_ORDER.map((c) => (
                  <option key={c} value={c}>
                    {formatClassName(c)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={selectedTeacherFilter}
                onChange={(e) => setSelectedTeacherFilter(e.target.value)}
                style={selectStyle}
              >
                <option value="ALL">Dhammaan Macallimiinta (All Teachers)</option>
                {teacherOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={timeRangeFilter}
                onChange={(e) => setTimeRangeFilter(e.target.value)}
                style={selectStyle}
              >
                <option value="ALL">Dhammaan Waqtiga (All Time)</option>
                <option value="7DAYS">1 Todobaad (7 Days)</option>
                <option value="30DAYS">1 Bil (30 Days)</option>
                <option value="1YEAR">1 Sanad (365 Days)</option>
              </select>
            </div>

            <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
              <Search size={16} color="#8b87ad" style={{ position: "absolute", left: 12, top: 11 }} />
              <input
                style={{ ...inputStyle, paddingLeft: 36 }}
                placeholder="Raadi fasal ama macalin..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="att-summary-grid no-print">
            <SummaryCard
              icon={School}
              label="Fasallada la helay"
              value={classNames.length}
              color="#22C55E"
            />
            <SummaryCard
              icon={Users}
              label="Macallimiinta Xaadiriyay"
              value={totalTeachers}
              color="#6d5df0"
            />
            <SummaryCard
              icon={CalendarCheck}
              label="Wadarta Diiwaanka Xaadirinta"
              value={filteredRecords.length}
              color="#F59E0B"
            />
          </div>

          {loading ? (
            <div style={{ color: "#8b87ad", textAlign: "center", padding: 60 }}>
              Soo raraya xogta xaadirinta...
            </div>
          ) : classNames.length === 0 ? (
            <div style={{ color: "#8b87ad", textAlign: "center", padding: 60 }}>
              Ma jiraan xog xaadirineed oo la helay doorashadaada gaarka ah.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {classNames.map((rawClassName) => {
                const teachersMap = groupedByClass[rawClassName] || {};
                const teacherIdsForClass = Object.keys(teachersMap).sort();
                const totalDaysForClass = new Set(
                  teacherIdsForClass.flatMap((tid) => Array.from(teachersMap[tid].dates))
                ).size;
                const classKey = `class__${rawClassName}`;
                const isClassOpen = !!expandedClass[classKey];

                const formattedTitle = formatClassName(rawClassName);

                return (
                  <div
                    key={rawClassName}
                    className="att-class-card"
                    style={{
                      background: "linear-gradient(160deg,#151233,#181341)",
                      border: "1px solid rgba(139,108,245,0.25)",
                      borderRadius: 20,
                      padding: "22px 26px",
                    }}
                  >
                    <div
                      onClick={() => toggleClassExpand(classKey)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 12,
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <div
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: 12,
                            background: "linear-gradient(135deg,#22C55E,#16A34A)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#fff",
                            fontWeight: 700,
                            fontSize: 14,
                            flexShrink: 0,
                          }}
                        >
                          {rawClassName.toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: "#fff", fontSize: 16 }}>
                            {formattedTitle}
                          </div>
                          <div style={{ color: "#8b87ad", fontSize: 12 }}>
                            {teacherIdsForClass.length} macalin · {totalDaysForClass} maalmood
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <Pill icon={Users} text={`${teacherIdsForClass.length} Macalin`} />
                        <Pill icon={CalendarCheck} text={`${totalDaysForClass} Maalmood`} />
                        <span className="no-print">
                          {isClassOpen ? <ChevronUp size={18} color="#8b87ad" /> : <ChevronDown size={18} color="#8b87ad" />}
                        </span>
                      </div>
                    </div>

                    {isClassOpen && (
                      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                        {teacherIdsForClass.map((teacherId) => {
                          const info = teachersMap[teacherId];
                          const teacherInfo = teachers[teacherId] || {};
                          const teacherName = teacherInfo.fullName || teacherId;
                          const teacherPhoto = teacherInfo.photoUrl;
                          const sortedDates = Array.from(info.dates).sort();
                          const tKey = `${classKey}__${teacherId}`;

                          const subjectsInClass = Array.from(
                            new Set(
                              info.records.map((r) => r.subject || r.subjectName).filter(Boolean)
                            )
                          );
                          const subjectLabel =
                            subjectsInClass.length > 0 ? subjectsInClass.join(", ") : teacherInfo.subject || "-";

                          return (
                            <div
                              key={tKey}
                              style={{
                                background: "rgba(255,255,255,0.02)",
                                border: "1px solid rgba(139,108,245,0.18)",
                                borderRadius: 12,
                                padding: "12px 16px",
                              }}
                            >
                              <div
                                className="att-teacher-row"
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  flexWrap: "wrap",
                                  gap: 10,
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                  {teacherPhoto ? (
                                    <img
                                      src={teacherPhoto}
                                      alt={teacherName}
                                      style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: "50%",
                                        objectFit: "cover",
                                        border: "2px solid #8B5CF6",
                                        flexShrink: 0,
                                      }}
                                    />
                                  ) : (
                                    <div
                                      style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: "50%",
                                        background: "linear-gradient(135deg,#6D5DF0,#8B5CF6)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: "#fff",
                                        fontWeight: 700,
                                        fontSize: 13,
                                        flexShrink: 0,
                                      }}
                                    >
                                      {teacherName.charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                  <div>
                                    <div style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>
                                      {teacherName}
                                    </div>
                                    <div style={{ color: "#8b87ad", fontSize: 12 }}>
                                      Maadada: {subjectLabel}
                                    </div>
                                  </div>
                                </div>

                                <div
                                  className="att-pills-row"
                                  onClick={() => toggleClassExpand(`${tKey}__toggle`)}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    cursor: "pointer",
                                  }}
                                >
                                  <span
                                    style={{
                                      background: "rgba(109,93,240,0.18)",
                                      color: "#8B5CF6",
                                      padding: "3px 10px",
                                      borderRadius: 20,
                                      fontSize: 12,
                                      fontWeight: 700,
                                    }}
                                  >
                                    {sortedDates.length} maalmood
                                  </span>
                                  <span className="no-print">
                                    {expandedClass[`${tKey}__toggle`] ? (
                                      <ChevronUp size={16} color="#8b87ad" />
                                    ) : (
                                      <ChevronDown size={16} color="#8b87ad" />
                                    )}
                                  </span>
                                </div>
                              </div>

                              {expandedClass[`${tKey}__toggle`] && (
                                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                                  {sortedDates.map((date) => {
                                    const sessionsOnDate = info.records
                                      .filter((r) => r.date === date)
                                      .sort((a, b) => {
                                        if (a.sessionNumber !== b.sessionNumber) {
                                          return (a.sessionNumber || 0) - (b.sessionNumber || 0);
                                        }
                                        return (a.studentName || "").localeCompare(b.studentName || "");
                                      });
                                    const sessionNums = Array.from(
                                      new Set(sessionsOnDate.map((r) => r.sessionNumber))
                                    ).sort((a, b) => a - b);
                                    const dateKey = `${tKey}__${date}`;
                                    const isDateOpen = !!expandedDate[dateKey];

                                    const presentCount = sessionsOnDate.filter(
                                      (r) => (pendingChanges[r.id] || r.status) === "Present"
                                    ).length;
                                    const absentCount = sessionsOnDate.filter(
                                      (r) => (pendingChanges[r.id] || r.status) === "Absent"
                                    ).length;
                                    const excusedCount = sessionsOnDate.filter(
                                      (r) => (pendingChanges[r.id] || r.status) === "Excused"
                                    ).length;

                                    return (
                                      <div
                                        key={date}
                                        style={{
                                          background: "rgba(139,108,245,0.06)",
                                          border: "1px solid rgba(139,108,245,0.2)",
                                          borderRadius: 10,
                                          overflow: "hidden",
                                        }}
                                      >
                                        <div
                                          onClick={() => toggleDate(dateKey)}
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            padding: "8px 12px",
                                            cursor: "pointer",
                                            flexWrap: "wrap",
                                            gap: 8,
                                          }}
                                        >
                                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <Clock size={13} color="#8b87ad" />
                                            <span style={{ color: "#e5e3f7", fontSize: 13, fontWeight: 600 }}>
                                              {date}
                                            </span>
                                            <span style={{ color: "#8b87ad", fontSize: 12 }}>
                                              ({sessionNums.length} xiisadood · {sessionsOnDate.length} arday)
                                            </span>
                                          </div>
                                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                            <span style={{ color: "#22C55E", fontSize: 12, fontWeight: 700 }}>
                                              {presentCount} Present
                                            </span>
                                            <span style={{ color: "#EF4444", fontSize: 12, fontWeight: 700 }}>
                                              {absentCount} Absent
                                            </span>
                                            {excusedCount > 0 && (
                                              <span style={{ color: "#3B82F6", fontSize: 12, fontWeight: 700 }}>
                                                {excusedCount} Excused
                                              </span>
                                            )}
                                            <span className="no-print">
                                              {isDateOpen ? (
                                                <ChevronUp size={16} color="#8b87ad" />
                                              ) : (
                                                <ChevronDown size={16} color="#8b87ad" />
                                              )}
                                            </span>
                                          </div>
                                        </div>

                                        {isDateOpen && (
                                          <div style={{ padding: "0 10px 10px" }}>
                                            <div className="att-table-wrap">
                                              <table className="att-mini-table">
                                                <thead>
                                                  <tr>
                                                    <MiniTh>Ardayga</MiniTh>
                                                    <MiniTh>ID</MiniTh>
                                                    <MiniTh>Xiisad</MiniTh>
                                                    <MiniTh>Waqti</MiniTh>
                                                    <MiniTh>Status</MiniTh>
                                                    <MiniTh>Joogay / Maqnaa</MiniTh>
                                                    <MiniTh>Natiijada %</MiniTh>
                                                    <MiniTh className="no-print">Wax ka beddel</MiniTh>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {sessionsOnDate.map((r) => {
                                                    const currentStatus = pendingChanges[r.id] || r.status;
                                                    const stat = studentStats[r.studentId] || { presentDays: 0, absentDays: 0, percent: 100 };
                                                    const isPending = !!pendingChanges[r.id];

                                                    return (
                                                      <tr key={r.id} style={{ background: isPending ? "rgba(234, 179, 8, 0.08)" : "transparent" }}>
                                                        <MiniTd>{r.studentName || "-"}</MiniTd>
                                                        <MiniTd>{r.studentId || "-"}</MiniTd>
                                                        <MiniTd>#{r.sessionNumber ?? "-"}</MiniTd>
                                                        <MiniTd>{r.sessionTime || "-"}</MiniTd>
                                                        <MiniTd>
                                                          <span
                                                            className={
                                                              currentStatus === "Present"
                                                                ? "print-badge-present"
                                                                : currentStatus === "Excused"
                                                                ? "print-badge-excused"
                                                                : "print-badge-absent"
                                                            }
                                                          >
                                                            ● {currentStatus === "Excused" ? "Excused (Xaalad)" : currentStatus || "Absent"}
                                                          </span>
                                                        </MiniTd>

                                                        <MiniTd>
                                                          <span style={{ color: "#22C55E", fontWeight: "bold" }}>{stat.presentDays}J</span>
                                                          {" / "}
                                                          <span style={{ color: "#EF4444", fontWeight: "bold" }}>{stat.absentDays}M</span>
                                                        </MiniTd>

                                                        <MiniTd>
                                                          <span
                                                            style={{
                                                              padding: "2px 8px",
                                                              borderRadius: "10px",
                                                              fontSize: "12px",
                                                              fontWeight: "bold",
                                                              background: stat.percent >= 75 ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)",
                                                              color: stat.percent >= 75 ? "#4ADE80" : "#F87171",
                                                            }}
                                                          >
                                                            {stat.percent}% {stat.percent >= 50 ? "Joogay" : "Maqnaa"}
                                                          </span>
                                                        </MiniTd>

                                                        <MiniTd className="no-print">
                                                          <div style={{ display: "flex", gap: 6 }}>
                                                            <button
                                                              onClick={() => handleStageStatusChange(r.id, "Present")}
                                                              title="Present (Jooga)"
                                                              style={{
                                                                ...editBtn,
                                                                background:
                                                                  currentStatus === "Present" ? "#22C55E" : "#1F2937",
                                                                color: currentStatus === "Present" ? "#fff" : "#94A3B8",
                                                              }}
                                                            >
                                                              <Check size={13} />
                                                            </button>
                                                            <button
                                                              onClick={() => handleStageStatusChange(r.id, "Absent")}
                                                              title="Absent (Maqan)"
                                                              style={{
                                                                ...editBtn,
                                                                background:
                                                                  currentStatus === "Absent" ? "#EF4444" : "#1F2937",
                                                                color: currentStatus === "Absent" ? "#fff" : "#94A3B8",
                                                              }}
                                                            >
                                                              <X size={13} />
                                                            </button>
                                                            <button
                                                              onClick={() => handleStageStatusChange(r.id, "Excused")}
                                                              title="Excused / Xaalad Jirto"
                                                              style={{
                                                                ...editBtn,
                                                                background:
                                                                  currentStatus === "Excused" ? "#3B82F6" : "#1F2937",
                                                                color: currentStatus === "Excused" ? "#fff" : "#94A3B8",
                                                              }}
                                                            >
                                                              <AlertCircle size={13} />
                                                            </button>
                                                          </div>
                                                        </MiniTd>
                                                      </tr>
                                                    );
                                                  })}
                                                </tbody>
                                              </table>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color }) {
  return (
    <div
      style={{
        background: "#0B1120",
        border: "1px solid rgba(255,255,255,.06)",
        borderRadius: 20,
        padding: "20px 24px",
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: `${color}22`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={22} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 700, color: "#fff" }}>{value}</div>
        <div style={{ fontSize: 13, color: "#8b87ad" }}>{label}</div>
      </div>
    </div>
  );
}

function Pill({ icon: Icon, text }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        background: "rgba(139,108,245,0.1)",
        border: "1px solid rgba(139,108,245,0.25)",
        borderRadius: 20,
        padding: "6px 14px",
        color: "#c4b8f7",
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      <Icon size={14} />
      {text}
    </div>
  );
}

function MiniTh({ children, className }) {
  return (
    <th
      className={className}
      style={{
        textAlign: "left",
        padding: "8px 10px",
        color: "#8b87ad",
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function MiniTd({ children, className }) {
  return (
    <td
      className={className}
      style={{
        padding: "8px 10px",
        color: "#e5e3f7",
        fontSize: 13,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </td>
  );
}

const editBtn = {
  width: 26,
  height: 26,
  borderRadius: "50%",
  border: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const inputStyle = {
  width: "100%",
  padding: "10px 14px",
  boxSizing: "border-box",
  border: "1.5px solid rgba(139,108,245,0.35)",
  borderRadius: 10,
  fontSize: 13.5,
  color: "#e5e3f7",
  outline: "none",
  background: "rgba(255,255,255,0.02)",
};

const selectStyle = {
  padding: "10px 14px",
  border: "1.5px solid rgba(139,108,245,0.35)",
  borderRadius: 10,
  fontSize: 13.5,
  color: "#e5e3f7",
  outline: "none",
  background: "#151233",
  cursor: "pointer",
};