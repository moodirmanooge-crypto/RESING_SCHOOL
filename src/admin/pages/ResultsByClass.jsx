// src/admin/pages/ResultsByClass.jsx
//
// Natiijooyinka fasal kasta, imtixaan kasta (Monthly One / Term / Monthly Two / Final).
// - Labada collection: results (Full Time) + resultsPartTime (Part Time)
// - Maado kasta waxaa la qaataa natiijada UGU DAMBEYSAY (updatedAt), sidaas
//   darteed marka macalinku update sameeyo (fasax maamul), halkan si sax ah
//   ayay isu beddeshaa.

import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../../firebase/firebase";
import { collection, getDocs } from "firebase/firestore";
import { Printer, Download, RefreshCcw } from "lucide-react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import logo from "../../assets/logo.png";
import { EXAM_TYPES, examTypeKeyOf, examTypeLabelOf } from "../../utils/resultsSubmission";

// ---- grade helper -----------------------------------------------------
function gradeFor(percent) {
  if (percent >= 90) return { label: "A+", bg: "#f3f4f6", color: "#111827", border: "#111827" };
  if (percent >= 80) return { label: "A", bg: "#f3f4f6", color: "#111827", border: "#111827" };
  if (percent >= 70) return { label: "B+", bg: "#ffffff", color: "#374151", border: "#4b5563" };
  if (percent >= 60) return { label: "B", bg: "#ffffff", color: "#374151", border: "#4b5563" };
  if (percent >= 50) return { label: "C", bg: "#ffffff", color: "#4b5563", border: "#9ca3af" };
  return { label: "D", bg: "#ffffff", color: "#000000", border: "#000000" };
}

function toDateSafe(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value?.seconds) return new Date(value.seconds * 1000);
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function formatDateTime(date) {
  if (!date) return "—";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Goorta ugu dambeysay ee natiijadan la kaydiyay (update-ka ayaa ka horreeya)
function latestDate(r) {
  return (
    toDateSafe(r.updatedAt) ||
    toDateSafe(r.submittedAt) ||
    toDateSafe(r.createdAt) ||
    toDateSafe(r.timestamp) ||
    null
  );
}

export default function ResultsByClass() {
  const [loading, setLoading] = useState(true);
  const [rawResults, setRawResults] = useState([]);
  const [studentsById, setStudentsById] = useState({});
  const [examFilter, setExamFilter] = useState("");
  const printRefs = useRef({});
  const [pendingAction, setPendingAction] = useState({});
  const [orientation, setOrientation] = useState({});

  useEffect(() => {
    fetchData();
  }, []);

  function getOrientation(className) {
    return orientation[className] || "landscape";
  }

  function setClassOrientation(className, value) {
    setOrientation((prev) => ({ ...prev, [className]: value }));
  }

  async function fetchData() {
    try {
      setLoading(true);

      const [studentsSnap, partTimeStudentsSnap, resultsSnap, resultsPtSnap] = await Promise.all([
        getDocs(collection(db, "students")),
        getDocs(collection(db, "partTimeStudents")),
        getDocs(collection(db, "results")),
        getDocs(collection(db, "resultsPartTime")),
      ]);

      const map = {};
      studentsSnap.docs.forEach((d) => {
        const data = d.data();
        map[d.id] = {
          studentId: data.studentId || d.id,
          fullName: data.fullName || data.name || "—",
          studentPhoto: data.studentPhoto || data.photoUrl || "",
          studentType: "Full Time",
        };
      });
      partTimeStudentsSnap.docs.forEach((d) => {
        const data = d.data();
        map[d.id] = {
          studentId: data.studentId || d.id,
          fullName: data.fullName || data.name || "—",
          studentPhoto: data.studentPhoto || data.photoUrl || "",
          studentType: "Part Time",
        };
      });
      setStudentsById(map);

      const list = [
        ...resultsSnap.docs.map((d) => ({ id: d.id, _coll: "results", ...d.data() })),
        ...resultsPtSnap.docs.map((d) => ({ id: d.id, _coll: "resultsPartTime", ...d.data() })),
      ].map((r) => ({ ...r, _typeKey: r.examTypeKey || examTypeKeyOf(r.examType) }));
      setRawResults(list);

      // Default: imtixaanka natiijadiisa ugu dambeysay la soo gudbiyay
      if (!examFilter && list.length > 0) {
        const newest = [...list].sort(
          (a, b) => (latestDate(b)?.getTime() || 0) - (latestDate(a)?.getTime() || 0)
        )[0];
        setExamFilter(newest._typeKey);
      }
    } catch (error) {
      console.error("Khalad ayaa dhacay markii natiijooyinka la soo qaadanayay:", error);
    } finally {
      setLoading(false);
    }
  }

  // Imtixaannada xog leh (tab-yada)
  const availableTypes = useMemo(() => {
    const set = new Set(rawResults.map((r) => r._typeKey));
    const ordered = EXAM_TYPES.map((t) => t.key).filter((k) => set.has(k));
    const extra = [...set].filter((k) => !EXAM_TYPES.some((t) => t.key === k));
    return [...ordered, ...extra];
  }, [rawResults]);

  const classGroups = useMemo(() => {
    const byClass = {};

    rawResults
      .filter((r) => !examFilter || r._typeKey === examFilter)
      .forEach((r) => {
        const rawClass = (r.className || "Unassigned").toString().trim();
        const linkedStudent = studentsById[r.studentId] || null;
        const studentType =
          linkedStudent?.studentType ||
          r.studentType ||
          (r._coll === "resultsPartTime" ? "Part Time" : "Full Time");
        const cls = `${rawClass} (${studentType})`;

        if (!byClass[cls]) byClass[cls] = {};
        const studentKey = r.studentId || r.studentName || r.id;

        if (!byClass[cls][studentKey]) {
          byClass[cls][studentKey] = {
            studentKey,
            studentId: linkedStudent?.studentId || r.studentId || "—",
            studentName: linkedStudent?.fullName || r.studentName || "Unknown",
            studentPhoto: linkedStudent?.studentPhoto || "",
            studentType,
            subjects: {},
          };
        }

        const subjectLabel = (r.subject || "—").toString().trim().replace(/\s+/g, " ");
        const subjectKey = subjectLabel.toLowerCase();
        const when = latestDate(r);
        const prev = byClass[cls][studentKey].subjects[subjectKey];

        // Kan ugu dambeeyay ayaa guuleysta (update-ka macalinka)
        if (!prev || (when?.getTime() || 0) >= (prev.submittedAt?.getTime() || 0)) {
          byClass[cls][studentKey].subjects[subjectKey] = {
            marks: Number(r.marks) || 0,
            maxMarks: Number(r.maxMarks) || 0,
            submittedAt: when,
            label: subjectLabel,
          };
        }
      });

    const groups = Object.entries(byClass).map(([className, studentsMap]) => {
      const subjectLabels = {};
      Object.values(studentsMap).forEach((s) =>
        Object.entries(s.subjects).forEach(([subj, v]) => {
          if (!subjectLabels[subj]) subjectLabels[subj] = v.label;
        })
      );
      const subjects = Object.keys(subjectLabels).sort((a, b) =>
        subjectLabels[a].localeCompare(subjectLabels[b], undefined, { sensitivity: "base" })
      );

      let latestSubmitted = null;
      const rows = Object.values(studentsMap).map((s) => {
        let totalMarks = 0;
        let totalMax = 0;
        subjects.forEach((subj) => {
          const v = s.subjects[subj];
          if (v) {
            totalMarks += v.marks;
            totalMax += v.maxMarks;
            if (v.submittedAt && (!latestSubmitted || v.submittedAt > latestSubmitted)) {
              latestSubmitted = v.submittedAt;
            }
          }
        });
        const average = totalMax > 0 ? (totalMarks / totalMax) * 100 : 0;
        return {
          ...s,
          totalMarks,
          totalMax,
          average: Math.round(average * 100) / 100,
        };
      });

      rows.sort((a, b) =>
        (a.studentId || "").toString().localeCompare((b.studentId || "").toString(), undefined, {
          numeric: true,
        })
      );

      return { className, subjects, subjectLabels, rows, submittedAt: latestSubmitted };
    });

    groups.sort((a, b) => a.className.localeCompare(b.className, undefined, { numeric: true }));
    return groups;
  }, [rawResults, studentsById, examFilter]);

  const examLabel = examFilter ? examTypeLabelOf(examFilter) : "Dhammaan";

  function buildPrintHtml(classNamesList, pageOrientation) {
    const sections = classNamesList
      .map((className) => {
        const node = printRefs.current[className];
        return node ? `<div class="class-page">${node.innerHTML}</div>` : "";
      })
      .filter(Boolean)
      .join("");

    return `
      <html>
        <head>
          <title>Results - ${classNamesList.join(", ")}</title>
          <style>
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; padding: 10px; color: #000; background: #fff; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #000 !important; padding: 6px 6px; font-size: 11px; text-align: center; color: #000 !important; }
            th { background-color: #000 !important; color: #fff !important; font-weight: bold; }
            td.name-cell { text-align: left; }
            img.avatar { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; filter: grayscale(100%); }
            .grade-badge { border: 1px solid #000 !important; background: transparent !important; color: #000 !important; font-weight: bold; padding: 2px 6px; border-radius: 4px; }
            .class-page { page-break-after: always; }
            .class-page:last-child { page-break-after: auto; }
            @media print {
              @page { size: ${pageOrientation === "portrait" ? "A4 portrait" : "landscape"}; margin: 10mm; }
              body { filter: grayscale(100%); }
            }
          </style>
        </head>
        <body>${sections}</body>
      </html>
    `;
  }

  function openAndPrint(classNamesList, pageOrientation, onDone) {
    const printWindow = window.open("", "_blank", "width=1200,height=800");
    if (!printWindow) {
      window.alert("Browser-ku wuu xannibay print window-ka (popup blocker). Fadlan u oggolow popups-ka.");
      if (onDone) onDone(false);
      return;
    }
    printWindow.document.write(buildPrintHtml(classNamesList, pageOrientation));
    printWindow.document.close();

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (onDone) onDone(true);
      printWindow.close();
    };

    printWindow.addEventListener("afterprint", finish);
    printWindow.addEventListener("beforeunload", finish);

    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  }

  function handlePrintClass(className) {
    if (pendingAction[className]) return;
    const node = printRefs.current[className];
    if (!node) return;

    setPendingAction((prev) => ({ ...prev, [className]: "print" }));
    openAndPrint([className], getOrientation(className), () => {
      setPendingAction((prev) => {
        const next = { ...prev };
        delete next[className];
        return next;
      });
    });
  }

  async function handleDownloadPdf(className) {
    if (pendingAction[className]) return;
    const node = printRefs.current[className];
    if (!node) return;

    setPendingAction((prev) => ({ ...prev, [className]: "pdf" }));

    try {
      const [{ default: html2canvas }, jsPDFModule] = await Promise.all([
        import("https://cdn.jsdelivr.net/npm/html2canvas-pro@1.5.8/+esm"),
        import("https://cdn.jsdelivr.net/npm/jspdf@2.5.2/+esm"),
      ]);
      const { jsPDF } = jsPDFModule;

      const canvas = await html2canvas(node, { scale: 2, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL("image/png");

      const pageOrientation = getOrientation(className);
      const pdf = new jsPDF({ orientation: pageOrientation, unit: "pt", format: "a4" });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgRatio = canvas.height / canvas.width;
      let renderWidth = pageWidth - 40;
      let renderHeight = renderWidth * imgRatio;

      if (renderHeight > pageHeight - 40) {
        renderHeight = pageHeight - 40;
        renderWidth = renderHeight / imgRatio;
      }

      pdf.addImage(imgData, "PNG", 20, 20, renderWidth, renderHeight);
      pdf.save(`Class-${className.replace(/[\s()]/g, "_")}-${examLabel.replace(/\s/g, "_")}-Results.pdf`);
    } catch (err) {
      console.error("Khalad ayaa dhacay markii PDF-ka la sameynayay:", err);
      window.alert("Khalad ayaa dhacay markii PDF-ka la soo saarayay.");
    } finally {
      setPendingAction((prev) => {
        const next = { ...prev };
        delete next[className];
        return next;
      });
    }
  }

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "#F3F4F8",
        fontFamily: "'Inter','Segoe UI',sans-serif",
      }}
    >
      <Sidebar />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: "22px 26px 0" }}>
          <Topbar />
        </div>

        <div style={{ padding: "26px 30px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827" }}>
                Results by Class (Full Time & Part Time)
              </h1>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B7280" }}>
                Natiijooyinka fasal kasta iyo imtixaan kasta — update-ka macalimiinta si toos ah
                ayuu halkan uga muuqdaa.
              </p>
            </div>
            <button
              onClick={fetchData}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 18px",
                borderRadius: 12,
                border: "1px solid rgba(22,163,74,0.3)",
                background: "#fff",
                color: "#16a34a",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              <RefreshCcw size={15} />
              Refresh
            </button>
          </div>

          {/* Imtixaan doorasho */}
          {!loading && availableTypes.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
              {availableTypes.map((k) => {
                const active = examFilter === k;
                return (
                  <button
                    key={k}
                    onClick={() => setExamFilter(k)}
                    style={{
                      padding: "9px 16px",
                      borderRadius: 11,
                      border: active ? "1.5px solid #14532d" : "1.5px solid rgba(17,24,39,0.1)",
                      background: active ? "#14532d" : "#fff",
                      color: active ? "#fff" : "#374151",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    {examTypeLabelOf(k)}
                  </button>
                );
              })}
            </div>
          )}

          {loading && (
            <div style={{ background: "#fff", borderRadius: 16, padding: 40, textAlign: "center", color: "#9CA3AF" }}>
              Natiijooyinka ayaa la soo rarayaa...
            </div>
          )}

          {!loading && classGroups.length === 0 && (
            <div style={{ background: "#fff", borderRadius: 16, padding: 40, textAlign: "center", color: "#9CA3AF" }}>
              Natiijooyin lama helin.
            </div>
          )}

          {!loading &&
            classGroups.map((group) => {
              const currentOrientation = getOrientation(group.className);
              return (
                <div
                  key={group.className}
                  style={{
                    background: "#ffffff",
                    borderRadius: 18,
                    boxShadow: "0 4px 18px rgba(17,24,39,0.06)",
                    border: "1px solid rgba(17,24,39,0.05)",
                    marginBottom: 28,
                    overflow: "hidden",
                  }}
                >
                  {/* Action Toolbar */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "14px 20px",
                      borderBottom: "1px solid #F3F4F6",
                      background: "#FAFAFB",
                      flexWrap: "wrap",
                      gap: 10,
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>
                      Class: {group.className} · {examLabel} · {group.rows.length} student
                      {group.rows.length !== 1 ? "s" : ""}
                    </span>

                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <div
                        style={{
                          display: "inline-flex",
                          border: "1px solid rgba(17,24,39,0.12)",
                          borderRadius: 10,
                          overflow: "hidden",
                        }}
                      >
                        <button
                          onClick={() => setClassOrientation(group.className, "portrait")}
                          title="A4 Portrait"
                          style={{
                            padding: "8px 12px",
                            border: "none",
                            background: currentOrientation === "portrait" ? "#16a34a" : "#fff",
                            color: currentOrientation === "portrait" ? "#fff" : "#374151",
                            fontWeight: 700,
                            fontSize: 12,
                            cursor: "pointer",
                          }}
                        >
                          Portrait
                        </button>
                        <button
                          onClick={() => setClassOrientation(group.className, "landscape")}
                          title="A4 Landscape"
                          style={{
                            padding: "8px 12px",
                            border: "none",
                            borderLeft: "1px solid rgba(17,24,39,0.12)",
                            background: currentOrientation === "landscape" ? "#16a34a" : "#fff",
                            color: currentOrientation === "landscape" ? "#fff" : "#374151",
                            fontWeight: 700,
                            fontSize: 12,
                            cursor: "pointer",
                          }}
                        >
                          Landscape
                        </button>
                      </div>

                      <button
                        onClick={() => handlePrintClass(group.className)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "8px 14px",
                          borderRadius: 10,
                          border: "1px solid rgba(22,163,74,0.3)",
                          background: "#fff",
                          color: "#16a34a",
                          fontWeight: 700,
                          fontSize: 12.5,
                          cursor: "pointer",
                        }}
                      >
                        <Printer size={14} />
                        Print
                      </button>
                      <button
                        onClick={() => handleDownloadPdf(group.className)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "8px 14px",
                          borderRadius: 10,
                          border: "none",
                          background: "#16a34a",
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: 12.5,
                          cursor: "pointer",
                        }}
                      >
                        <Download size={14} />
                        Download PDF
                      </button>
                    </div>
                  </div>

                  {/* Printable Area */}
                  <div
                    ref={(el) => (printRefs.current[group.className] = el)}
                    style={{ padding: 24, overflowX: "auto" }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 18,
                        flexWrap: "wrap",
                        gap: 12,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <img src={logo} alt="" style={{ width: 56, height: 56, objectFit: "contain" }} />
                        <div>
                          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#111827" }}>
                            RISING STAR SCHOOL
                          </h2>
                          <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "#6B7280" }}>
                            Last updated: {formatDateTime(group.submittedAt)}
                          </p>
                        </div>
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", textAlign: "right" }}>
                        CLASS: {group.className}
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#4B5563" }}>
                          EXAM: {examLabel.toUpperCase()}
                        </div>
                      </div>
                    </div>

                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                      <thead>
                        <tr>
                          <th style={thStyle}>#</th>
                          <th style={thStyle}>Student ID</th>
                          <th style={{ ...thStyle, textAlign: "left" }}>Student Name</th>
                          {group.subjects.map((subj) => (
                            <th key={subj} style={thStyle}>
                              {group.subjectLabels[subj]}
                            </th>
                          ))}
                          <th style={thStyle}>Total</th>
                          <th style={thStyle}>Average</th>
                          <th style={thStyle}>Grade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.rows.map((row, idx) => {
                          const g = gradeFor(row.average);
                          return (
                            <tr key={row.studentKey} style={{ borderTop: "1px solid #E5E7EB" }}>
                              <td style={tdStyle}>{idx + 1}</td>
                              <td style={tdStyle}>{row.studentId}</td>
                              <td style={{ ...tdStyle, textAlign: "left" }} className="name-cell">
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  {row.studentPhoto ? (
                                    <img
                                      src={row.studentPhoto}
                                      alt=""
                                      className="avatar"
                                      style={{
                                        width: 28,
                                        height: 28,
                                        borderRadius: "50%",
                                        objectFit: "cover",
                                        flexShrink: 0,
                                      }}
                                    />
                                  ) : (
                                    <div
                                      style={{
                                        width: 28,
                                        height: 28,
                                        borderRadius: "50%",
                                        background: "#E6F5EC",
                                        color: "#16a34a",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: 11,
                                        fontWeight: 800,
                                        flexShrink: 0,
                                      }}
                                    >
                                      {(row.studentName || "?").charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                  <span style={{ fontWeight: 700 }}>{row.studentName}</span>
                                </div>
                              </td>
                              {group.subjects.map((subj) => (
                                <td key={subj} style={tdStyle}>
                                  {row.subjects[subj]
                                    ? `${row.subjects[subj].marks}/${row.subjects[subj].maxMarks}`
                                    : "—"}
                                </td>
                              ))}
                              <td style={{ ...tdStyle, fontWeight: 700 }}>
                                {row.totalMarks}/{row.totalMax}
                              </td>
                              <td style={{ ...tdStyle, fontWeight: 700 }}>{row.average}%</td>
                              <td style={tdStyle}>
                                <span
                                  className="grade-badge"
                                  style={{
                                    background: g.bg,
                                    color: g.color,
                                    border: `1px solid ${g.border}`,
                                    padding: "3px 10px",
                                    borderRadius: 20,
                                    fontWeight: 700,
                                    fontSize: 11.5,
                                  }}
                                >
                                  {g.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

const thStyle = {
  background: "#1e3a8a",
  color: "#fff",
  padding: "8px 10px",
  fontWeight: 700,
  fontSize: 11.5,
  whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "8px 10px",
  color: "#111827",
  whiteSpace: "nowrap",
  fontWeight: 700,
};