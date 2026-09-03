import { useEffect, useMemo, useState } from "react";
import { db } from "../../firebase/firebase";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
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
  Loader2,
  Printer,
  Filter,
  UserCheck,
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

const CLASS_ORDER = ["1", "2", "3", "4", "5", "6", "7", "8", "F1", "F2", "F3", "F4"];
function classRank(className) {
  const idx = CLASS_ORDER.indexOf(String(className || "").toUpperCase());
  return idx === -1 ? 999 : idx;
}

function ResponsiveStyles() {
  return (
    <style>{`
      .att-layout { display: flex; min-height: 100vh; background: #0b0a1c; }
      .att-content { flex: 1; min-width: 0; }
      .att-summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 24px; }
      .att-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
      .att-mini-table { width: 100%; border-collapse: collapse; min-width: 620px; }

      /* ========================================================= */
      /* PERFECT A4 PRINT STYLES                                   */
      /* ========================================================= */
      .print-only-header { display: none; }

      @media print {
        @page {
          size: A4 auto;
          margin: 10mm;
        }
        
        body {
          background: #ffffff !important;
          color: #000000 !important;
          margin: 0 !important;
          padding: 0 !important;
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
          justify-content: space-between;
          align-items: center;
          background: #111111 !important;
          color: #ffffff !important;
          padding: 10px 16px !important;
          font-family: sans-serif;
          margin-bottom: 15px !important;
          border-radius: 4px;
        }
        .print-only-header h2 {
          margin: 0;
          font-size: 15px;
          font-weight: bold;
          color: #ffffff !important;
        }
        .print-only-header p {
          margin: 0;
          font-size: 11px;
          color: #cccccc !important;
        }

        .att-class-card {
          background: #ffffff !important;
          border: 1px solid #000000 !important;
          border-radius: 0 !important;
          padding: 10px !important;
          margin-bottom: 15px !important;
          page-break-inside: avoid;
          box-shadow: none !important;
        }

        .att-class-card * {
          color: #000000 !important;
          text-shadow: none !important;
        }

        .att-mini-table {
          width: 100% !important;
          min-width: 100% !important;
          border-collapse: collapse !important;
          margin-top: 8px !important;
        }

        .att-mini-table th {
          background: #333333 !important;
          color: #ffffff !important;
          border: 1px solid #333333 !important;
          padding: 6px 8px !important;
          font-size: 11px !important;
          text-align: left;
        }

        .att-mini-table td {
          border: 1px solid #cccccc !important;
          padding: 5px 8px !important;
          font-size: 11px !important;
          background: #ffffff !important;
          color: #000000 !important;
        }

        .print-badge-present {
          color: #059669 !important;
          font-weight: bold;
        }
        .print-badge-absent {
          color: #dc2626 !important;
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
  const [savingId, setSavingId] = useState(null);

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
      const list = attSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter(
          (r) =>
            r.className &&
            String(r.className).trim() !== "" &&
            r.studentId &&
            String(r.studentId).trim() !== "" &&
            r.date
        );
      setRecords(list);
    } catch (err) {
      console.log(err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Filter records based on Class, Teacher, and Time Range
  const filteredRecords = useMemo(() => {
    const now = new Date();

    return records.filter((r) => {
      // 1. Class Filter
      if (selectedClassFilter !== "ALL") {
        if (String(r.className).toUpperCase() !== selectedClassFilter.toUpperCase()) {
          return false;
        }
      }

      // 2. Teacher Filter
      if (selectedTeacherFilter !== "ALL") {
        if (String(r.teacherId) !== selectedTeacherFilter) {
          return false;
        }
      }

      // 3. Time Range Filter
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

  // Group filtered records by Class -> Teacher -> Dates & Records
  const groupedByClass = useMemo(() => {
    const map = {};

    filteredRecords.forEach((r) => {
      const className = String(r.className || "-").toUpperCase();
      const teacherId = r.teacherId || "Unknown";

      if (!map[className]) map[className] = {};
      if (!map[className][teacherId]) {
        map[className][teacherId] = { dates: new Set(), records: [] };
      }

      if (r.date) map[className][teacherId].dates.add(r.date);
      map[className][teacherId].records.push(r);
    });

    return map;
  }, [filteredRecords]);

  // Filtered Teacher options for Dropdown
  const teacherOptions = useMemo(() => {
    const teacherIds = Array.from(
      new Set(records.map((r) => r.teacherId).filter(Boolean))
    );
    return teacherIds.map((tid) => ({
      id: tid,
      name: teachers[tid]?.fullName || tid,
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [records, teachers]);

  const classNames = useMemo(() => {
    const availableClasses = Object.keys(groupedByClass);
    const baseList = selectedClassFilter === "ALL" ? availableClasses : [selectedClassFilter];

    return baseList
      .filter((className) => {
        if (!search.trim()) return true;
        const teacherIdsForClass = Object.keys(groupedByClass[className] || {});
        const matchesClass = className.toLowerCase().includes(search.toLowerCase());
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

  const handlePrint = () => {
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

    setTimeout(() => {
      window.print();
    }, 300);
  };

  const updateStatus = async (record, newStatus) => {
    if (record.status === newStatus || savingId === record.id) return;

    const prevStatus = record.status;
    setSavingId(record.id);
    setRecords((prev) =>
      prev.map((r) => (r.id === record.id ? { ...r, status: newStatus } : r))
    );

    try {
      await updateDoc(doc(db, "attendance", record.id), {
        status: newStatus,
        updatedAt: new Date(),
      });
    } catch (err) {
      console.log(err);
      alert("Khalad ayaa dhacay marka la kaydinayay: " + err.message);
      setRecords((prev) =>
        prev.map((r) => (r.id === record.id ? { ...r, status: prevStatus } : r))
      );
    } finally {
      setSavingId(null);
    }
  };

  const totalTeachers = useMemo(() => {
    return new Set(filteredRecords.map((r) => r.teacherId || "Unknown")).size;
  }, [filteredRecords]);

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

        <div className="att-page-pad" style={{ padding: "26px 30px" }}>
          {/* Black Banner Bar specifically for A4 Printing */}
          <div className="print-only-header">
            <div>
              <h2>
                Rising Star School — Attendance Report (Fasalka: {selectedClassFilter} | Macallinka:{" "}
                {selectedTeacherFilter === "ALL"
                  ? "Dhammaan"
                  : teachers[selectedTeacherFilter]?.fullName || selectedTeacherFilter}
                )
              </h2>
            </div>
            <div>
              <p>Taariikhda: {new Date().toLocaleDateString()}</p>
            </div>
          </div>

          {/* Header */}
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

          {/* Filters Bar */}
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

            {/* Filter by Class */}
            <div>
              <select
                value={selectedClassFilter}
                onChange={(e) => setSelectedClassFilter(e.target.value)}
                style={selectStyle}
              >
                <option value="ALL">Dhammaan Fasallada (All Classes)</option>
                {CLASS_ORDER.map((c) => (
                  <option key={c} value={c}>
                    Fasalka {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter by Teacher */}
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

            {/* Filter by Time Range */}
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

            {/* Search Input */}
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

          {/* Summary Cards */}
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

          {/* Content */}
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
              {classNames.map((className) => {
                const teachersMap = groupedByClass[className] || {};
                const teacherIdsForClass = Object.keys(teachersMap).sort();
                const totalDaysForClass = new Set(
                  teacherIdsForClass.flatMap((tid) => Array.from(teachersMap[tid].dates))
                ).size;
                const classKey = `class__${className}`;
                const isClassOpen = !!expandedClass[classKey];

                return (
                  <div
                    key={className}
                    className="att-class-card"
                    style={{
                      background: "linear-gradient(160deg,#151233,#181341)",
                      border: "1px solid rgba(139,108,245,0.25)",
                      borderRadius: 20,
                      padding: "22px 26px",
                    }}
                  >
                    {/* Class header */}
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
                            fontSize: 15,
                            flexShrink: 0,
                          }}
                        >
                          {className}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: "#fff", fontSize: 16 }}>
                            Fasalka: {className}
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

                    {/* Teachers list inside class */}
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

                                    const presentCount = sessionsOnDate.filter((r) => r.status === "Present").length;
                                    const absentCount = sessionsOnDate.filter((r) => r.status === "Absent").length;

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
                                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <span style={{ color: "#22C55E", fontSize: 12, fontWeight: 700 }}>
                                              {presentCount} Present
                                            </span>
                                            <span style={{ color: "#EF4444", fontSize: 12, fontWeight: 700 }}>
                                              {absentCount} Absent
                                            </span>
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
                                                    <MiniTh className="no-print">Wax ka beddel</MiniTh>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {sessionsOnDate.map((r) => (
                                                    <tr key={r.id}>
                                                      <MiniTd>{r.studentName || "-"}</MiniTd>
                                                      <MiniTd>{r.studentId || "-"}</MiniTd>
                                                      <MiniTd>#{r.sessionNumber ?? "-"}</MiniTd>
                                                      <MiniTd>{r.sessionTime || "-"}</MiniTd>
                                                      <MiniTd>
                                                        <span
                                                          className={
                                                            r.status === "Present"
                                                              ? "print-badge-present"
                                                              : "print-badge-absent"
                                                          }
                                                        >
                                                          ● {r.status || "Absent"}
                                                        </span>
                                                      </MiniTd>
                                                      <MiniTd className="no-print">
                                                        <div style={{ display: "flex", gap: 6 }}>
                                                          <button
                                                            onClick={() => updateStatus(r, "Present")}
                                                            disabled={savingId === r.id}
                                                            title="Present"
                                                            style={{
                                                              ...editBtn,
                                                              background:
                                                                r.status === "Present" ? "#22C55E" : "#1F2937",
                                                              color: r.status === "Present" ? "#fff" : "#94A3B8",
                                                            }}
                                                          >
                                                            {savingId === r.id ? <Loader2 size={13} /> : <Check size={13} />}
                                                          </button>
                                                          <button
                                                            onClick={() => updateStatus(r, "Absent")}
                                                            disabled={savingId === r.id}
                                                            title="Absent"
                                                            style={{
                                                              ...editBtn,
                                                              background:
                                                                r.status === "Absent" ? "#EF4444" : "#1F2937",
                                                              color: r.status === "Absent" ? "#fff" : "#94A3B8",
                                                            }}
                                                          >
                                                            {savingId === r.id ? <Loader2 size={13} /> : <X size={13} />}
                                                          </button>
                                                        </div>
                                                      </MiniTd>
                                                    </tr>
                                                  ))}
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
  width: 24,
  height: 24,
  borderRadius: "50%",
  border: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
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