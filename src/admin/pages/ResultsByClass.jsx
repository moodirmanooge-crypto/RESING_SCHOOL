// src/admin/pages/ResultsByClass.jsx

import { useEffect, useRef, useState } from "react";
import { db } from "../../firebase/firebase";
import { collection, getDocs } from "firebase/firestore";
import { Printer, Download, RefreshCcw } from "lucide-react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import logo from "../../assets/logo.png";

// ---- grade helper -----------------------------------------------------
function gradeFor(percent) {
  if (percent >= 90) return { label: "A+", bg: "#f3f4f6", color: "#111827", border: "#111827" };
  if (percent >= 80) return { label: "A", bg: "#f3f4f6", color: "#111827", border: "#111827" };
  if (percent >= 70) return { label: "B+", bg: "#ffffff", color: "#374151", border: "#4b5563" };
  if (percent >= 60) return { label: "B", bg: "#ffffff", color: "#374151", border: "#4b5563" };
  if (percent >= 50) return { label: "C", bg: "#ffffff", color: "#4b5563", border: "#9ca3af" };
  return { label: "D", bg: "#ffffff", color: "#000000", border: "#000000" };
}

// ---- taariikh/wakhti helpers -------------------------------------------
function toDateSafe(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate(); // Firestore Timestamp
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

function extractSubmittedDate(r) {
  const candidates = [
    r.createdAt,
    r.submittedAt,
    r.examDate,
    r.dateSubmitted,
    r.timestamp,
    r.updatedAt,
  ];
  for (const c of candidates) {
    const d = toDateSafe(c);
    if (d) return d;
  }
  return null;
}

export default function ResultsByClass() {
  const [loading, setLoading] = useState(true);
  const [classGroups, setClassGroups] = useState([]); 
  const printRefs = useRef({}); 
  const [pendingAction, setPendingAction] = useState({}); 
  // Per-class page orientation for Print/Download PDF — "landscape" (the
  // original, wide table layout) or "portrait" (normal upright A4).
  // Defaults to "landscape" so existing behavior is unchanged unless the
  // admin picks "Portrait" for a given class.
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

      // 1) Dhammaan xogta ardayda
      const studentsSnap = await getDocs(collection(db, "students"));
      const studentsById = {};
      studentsSnap.docs.forEach((d) => {
        const data = d.data();
        studentsById[d.id] = {
          docId: d.id,
          studentId: data.studentId || d.id,
          fullName: data.fullName || data.name || "—",
          studentPhoto: data.studentPhoto || data.photoUrl || "",
          className: data.className || "",
        };
      });

      // 2) Dhammaan natiijooyinka
      const resultsSnap = await getDocs(collection(db, "results"));
      const resultsList = resultsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // 3) U kala saar className
      const byClass = {};
      resultsList.forEach((r) => {
        const cls = (r.className || "Unassigned").toString();
        if (!byClass[cls]) byClass[cls] = {};

        const linkedStudent = studentsById[r.studentId] || null;
        const studentKey = r.studentId || r.studentName || r.id;

        if (!byClass[cls][studentKey]) {
          byClass[cls][studentKey] = {
            studentKey,
            studentId: linkedStudent?.studentId || r.studentId || "—",
            studentName: linkedStudent?.fullName || r.studentName || "Unknown",
            studentPhoto: linkedStudent?.studentPhoto || "",
            subjects: {},
            totalMarks: 0,
            totalMax: 0,
          };
        }

        const subjectName = (r.subject || "—").toString();
        const marks = Number(r.marks) || 0;
        const maxMarks = Number(r.maxMarks) || 0;
        const submittedAt = extractSubmittedDate(r);

        byClass[cls][studentKey].subjects[subjectName] = { marks, maxMarks, submittedAt };
      });

      // 4) Isku dar xogta fasalada
      const classGroupsArr = Object.entries(byClass).map(([className, studentsMap]) => {
        const subjectSet = new Set();
        Object.values(studentsMap).forEach((s) => {
          Object.keys(s.subjects).forEach((subj) => subjectSet.add(subj));
        });
        const subjects = Array.from(subjectSet).sort((a, b) =>
          a.localeCompare(b, undefined, { sensitivity: "base" })
        );

        let earliestSubmitted = null;

        const rows = Object.values(studentsMap).map((s) => {
          let totalMarks = 0;
          let totalMax = 0;
          let studentEarliest = null;
          subjects.forEach((subj) => {
            const v = s.subjects[subj];
            if (v) {
              totalMarks += v.marks;
              totalMax += v.maxMarks;
              if (v.submittedAt) {
                if (!studentEarliest || v.submittedAt < studentEarliest) {
                  studentEarliest = v.submittedAt;
                }
                if (!earliestSubmitted || v.submittedAt < earliestSubmitted) {
                  earliestSubmitted = v.submittedAt;
                }
              }
            }
          });
          const average = totalMax > 0 ? (totalMarks / totalMax) * 100 : 0;
          return {
            ...s,
            totalMarks,
            totalMax,
            average: Math.round(average * 100) / 100,
            submittedAt: studentEarliest,
          };
        });

        rows.sort((a, b) =>
          (a.studentId || "").toString().localeCompare((b.studentId || "").toString(), undefined, {
            numeric: true,
          })
        );

        return { className, subjects, rows, submittedAt: earliestSubmitted };
      });

      classGroupsArr.sort((a, b) =>
        a.className.localeCompare(b.className, undefined, { numeric: true })
      );

      setClassGroups(classGroupsArr);
    } catch (error) {
      console.error("Khalad ayaa dhacay markii natiijooyinka la soo qaadanayay:", error);
    } finally {
      setLoading(false);
    }
  }

  // B&W Ready HTML Builder
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
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              box-sizing: border-box;
            }
            body { 
              font-family: Arial, sans-serif; 
              padding: 10px;
              color: #000;
              background: #fff;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-top: 10px;
            }
            th, td { 
              border: 1px solid #000 !important; 
              padding: 6px 6px; 
              font-size: 11px; 
              text-align: center; 
              color: #000 !important;
            }
            th { 
              background-color: #000 !important; 
              color: #fff !important; 
              font-weight: bold;
            }
            td.name-cell { text-align: left; }
            img.avatar { 
              width: 24px; 
              height: 24px; 
              border-radius: 50%; 
              object-fit: cover;
              filter: grayscale(100%);
            }
            .grade-badge {
              border: 1px solid #000 !important;
              background: transparent !important;
              color: #000 !important;
              font-weight: bold;
              padding: 2px 6px;
              border-radius: 4px;
            }
            .class-page { page-break-after: always; }
            .class-page:last-child { page-break-after: auto; }
            
            @media print {
              @page { 
                size: ${pageOrientation === "portrait" ? "A4 portrait" : "landscape"}; 
                margin: 10mm; 
              }
              body { 
                filter: grayscale(100%); /* Force High Contrast B&W */
              }
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
      const pdf = new jsPDF({
        orientation: pageOrientation,
        unit: "pt",
        format: "a4",
      });
      
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
      pdf.save(`Class-${className}-Results.pdf`);
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
              justifySpaceBetween: "space-between",
              alignItems: "center",
              marginBottom: 20,
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827" }}>
                Results by Class
              </h1>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B7280" }}>
                Dhammaan natiijooyinka, loo kala saaray fasal walba jadwal gaar ah.
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
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>
                        Class {group.className} · {group.rows.length} student
                        {group.rows.length !== 1 ? "s" : ""}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      {/* Page orientation toggle — A4 Landscape (original,
                          wide table) or A4 Portrait (normal upright page). */}
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

                      {/* Always Enabled Print & Download Buttons */}
                      <button
                        onClick={() => handlePrintClass(group.className)}
                        title="Print this class results"
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
                        title="Download PDF"
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
                            Submitted: {formatDateTime(group.submittedAt)}
                          </p>
                        </div>
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>
                        CLASS: {group.className}
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
                              {subj}
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
                                  <span style={{ fontWeight: 600 }}>{row.studentName}</span>
                                </div>
                              </td>
                              {group.subjects.map((subj) => (
                                <td key={subj} style={tdStyle}>
                                  {row.subjects[subj] ? row.subjects[subj].marks : "—"}
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
};