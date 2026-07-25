// src/admin/pages/ResultsByClass.jsx
//
// Waxa uu ka soo aqriyaa dhammaan "results" ee Firestore, u kala saaraa
// className (hal warqad/jadwal per class), enrich-gareeya xogta ardayga
// (studentPhoto + studentId) laga soo aqriyo "students" collection-ka,
// isla markaana subject-yada si dynamic ah uga soo saaraa xogta results-ka
// (ma aha kuwo hardcode ah). Waxaa laga heli karaa print (Ctrl+P) iyo
// download PDF (per class), sida sawirka model-ka ah ee "Class G8".

import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../../firebase/firebase";
import { collection, getDocs } from "firebase/firestore";
import { Printer, Download, RefreshCcw } from "lucide-react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import logo from "../../assets/logo.png";

// ---- grade helper -----------------------------------------------------
function gradeFor(percent) {
  if (percent >= 90) return { label: "A+", bg: "#DCFCE7", color: "#16A34A" };
  if (percent >= 80) return { label: "A", bg: "#DCFCE7", color: "#16A34A" };
  if (percent >= 70) return { label: "B+", bg: "#FEF9C3", color: "#CA8A04" };
  if (percent >= 60) return { label: "B", bg: "#FEF9C3", color: "#CA8A04" };
  if (percent >= 50) return { label: "C", bg: "#FFE4CC", color: "#EA580C" };
  return { label: "D", bg: "#FEE2E2", color: "#DC2626" };
}

export default function ResultsByClass() {
  const [loading, setLoading] = useState(true);
  const [classGroups, setClassGroups] = useState([]); // [{className, subjects:[], rows:[]}]
  const printRefs = useRef({}); // className -> DOM node, used for per-class PDF export

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);

      // 1) Dhammaan xogta ardayda — u baahan si aan u helno studentId/photo
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

      // 3) U kala saar className, kadibna per-student per-subject
      const byClass = {};
      resultsList.forEach((r) => {
        const cls = (r.className || "Unassigned").toString();
        if (!byClass[cls]) byClass[cls] = {};

        // Ka soo dooro xogta ardayga collection-ka students, haddii la heli
        // karo — sidaas ayaynu u helaynaa studentId sax ah iyo sawirka.
        const linkedStudent = studentsById[r.studentId] || null;

        const studentKey = r.studentId || r.studentName || r.id;
        if (!byClass[cls][studentKey]) {
          byClass[cls][studentKey] = {
            studentKey,
            studentId: linkedStudent?.studentId || r.studentId || "—",
            studentName: linkedStudent?.fullName || r.studentName || "Unknown",
            studentPhoto: linkedStudent?.studentPhoto || "",
            subjects: {}, // subjectName -> { marks, maxMarks }
            totalMarks: 0,
            totalMax: 0,
          };
        }

        const subjectName = (r.subject || "—").toString();
        const marks = Number(r.marks) || 0;
        const maxMarks = Number(r.maxMarks) || 0;

        // Haddii subject-kan mar hore loo diiwaan geliyay ardaygan (isticmaal
        // xogta ugu dambeysa, si aan loo labanlaabin haddii dib loo geliyay).
        byClass[cls][studentKey].subjects[subjectName] = { marks, maxMarks };
      });

      // 4) Isku dar kolonada subject-ka + xisaabi Total/Average per student
      const classGroupsArr = Object.entries(byClass).map(([className, studentsMap]) => {
        const subjectSet = new Set();
        Object.values(studentsMap).forEach((s) => {
          Object.keys(s.subjects).forEach((subj) => subjectSet.add(subj));
        });
        const subjects = Array.from(subjectSet).sort((a, b) =>
          a.localeCompare(b, undefined, { sensitivity: "base" })
        );

        const rows = Object.values(studentsMap).map((s) => {
          let totalMarks = 0;
          let totalMax = 0;
          subjects.forEach((subj) => {
            const v = s.subjects[subj];
            if (v) {
              totalMarks += v.marks;
              totalMax += v.maxMarks;
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

        // Kala sooc studentId ascending (sida sawirka STD001, STD002...)
        rows.sort((a, b) =>
          (a.studentId || "").toString().localeCompare((b.studentId || "").toString(), undefined, {
            numeric: true,
          })
        );

        return { className, subjects, rows };
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

  function handlePrintClass(className) {
    const node = printRefs.current[className];
    if (!node) return;

    const printWindow = window.open("", "_blank", "width=1200,height=800");
    printWindow.document.write(`
      <html>
        <head>
          <title>Class ${className} - Results</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #d1d5db; padding: 6px 8px; font-size: 12px; text-align: center; }
            th { background: #1e3a8a; color: #fff; }
            td.name-cell { text-align: left; }
            img.avatar { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; }
            @media print {
              @page { size: landscape; margin: 12mm; }
            }
          </style>
        </head>
        <body>${node.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  }

  async function handleDownloadPdf(className) {
    const node = printRefs.current[className];
    if (!node) return;

    // Lazy-load html2canvas + jsPDF only when needed, isticmaal CDN ESM
    // build si aan u fududeeyo (uma baahna bundler config gaar ah).
    const [{ default: html2canvas }, jsPDFModule] = await Promise.all([
      import("https://cdn.jsdelivr.net/npm/html2canvas-pro@1.5.8/+esm"),
      import("https://cdn.jsdelivr.net/npm/jspdf@2.5.2/+esm"),
    ]);
    const { jsPDF } = jsPDFModule;

    const canvas = await html2canvas(node, { scale: 2, backgroundColor: "#ffffff" });
    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF({
      orientation: "landscape",
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
            classGroups.map((group) => (
              <div
                key={group.className}
                style={{
                  background: "#fff",
                  borderRadius: 18,
                  boxShadow: "0 4px 18px rgba(17,24,39,0.06)",
                  border: "1px solid rgba(17,24,39,0.05)",
                  marginBottom: 28,
                  overflow: "hidden",
                }}
              >
                {/* Toolbar (not part of the printed/exported area) */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "14px 20px",
                    borderBottom: "1px solid #F3F4F6",
                    background: "#FAFAFB",
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>
                    Class {group.className} · {group.rows.length} student
                    {group.rows.length !== 1 ? "s" : ""}
                  </span>
                  <div style={{ display: "flex", gap: 10 }}>
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

                {/* Printable / exportable area */}
                <div
                  ref={(el) => (printRefs.current[group.className] = el)}
                  style={{ padding: 24, overflowX: "auto" }}
                >
                  {/* Header */}
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
                                style={{
                                  background: g.bg,
                                  color: g.color,
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
            ))}
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