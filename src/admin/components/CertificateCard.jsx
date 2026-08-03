// src/admin/components/CertificateCard.jsx
// Renders the official "Class 8 Leaving Certificate" design (matching the
// printed reference — Somali on the left, English on the right, subjects
// table, results table) from a certificate data object. Shared by:
//   - admin/pages/Certificates.jsx (preview + snapshot for download)
//   - student/Dashboard.jsx (Certificate tab)
//   - pages/VerifyCertificate.jsx (public verification page)
//
// NOTE: `qrcode` npm package is used to render the QR code as an actual
// scannable image (not a placeholder), pointing at the public verify URL.
import { useEffect, useRef } from "react";
import certificateLogo from "../assets/certificate-logo.png";

const GREEN = "#166534";
const DARK_GREEN = "#0f3d2e";

export default function CertificateCard({ certificate, verifyUrl, elementId = "certificate-render-card" }) {
  const qrRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function renderQr() {
      if (!qrRef.current || !verifyUrl) return;
      try {
        const QRCode = await loadQr();
        if (cancelled) return;
        qrRef.current.innerHTML = "";
        await QRCode.toCanvas(qrRef.current, verifyUrl, {
          width: 80,
          margin: 0,
          color: { dark: "#0f3d2e", light: "#ffffff" },
        });
      } catch (e) {
        console.log("QR render failed:", e);
      }
    }
    renderQr();
    return () => {
      cancelled = true;
    };
  }, [verifyUrl]);

  if (!certificate) return null;

  const {
    fullName,
    motherName,
    dateOfBirth, // typed by hand by the deputy/teacher when generating the certificate
    placeOfBirth, // typed by hand by the deputy/teacher when generating the certificate
    rollNumber, // typed by hand by the deputy/teacher when generating the certificate
    academicYear,
    gradeObtained,
    studentPhoto,
    schoolName,
    className,
    certificateId,
    issueDate,
    topSubjects, // array of up to 6: [{ subject, marks, maxMarks }]
    averageResult, // computed average across topSubjects, as a percentage
  } = certificate;

  const subjects = Array.isArray(topSubjects) ? topSubjects.slice(0, 6) : [];
  // Always render 6 rows so the table layout matches the printed reference,
  // even if fewer than 6 subjects were recorded for this student.
  const subjectRows = Array.from({ length: 6 }, (_, i) => subjects[i] || null);

  return (
    <div
      id={elementId}
      style={{
        width: 1030,
        maxWidth: "100%",
        background: "#fdfdfb",
        borderRadius: 6,
        padding: "26px 34px",
        position: "relative",
        fontFamily: "'Inter','Segoe UI',sans-serif",
        color: "#111827",
        boxSizing: "border-box",
        border: `3px solid ${GREEN}`,
        overflow: "hidden",
      }}
    >
      {/* Thin inner frame, matching the printed reference's double border */}
      <div
        style={{
          position: "absolute",
          top: 8,
          left: 8,
          right: 8,
          bottom: 8,
          border: `1.5px solid ${GREEN}`,
          pointerEvents: "none",
          borderRadius: 3,
        }}
      />

      {/* Header: school name (Somali/English) left, logo center, school name (Arabic) right */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          position: "relative",
          zIndex: 2,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 21, fontWeight: 800, color: DARK_GREEN, lineHeight: 1.15 }}>
            RISING STAR PRIMARY
            <br />
            &amp; SECONDARY SCHOOL
          </div>
          <div style={{ fontSize: 13, color: "#0284C7", fontWeight: 600, marginTop: 4 }}>
            Mogadishu-Somalia
          </div>
        </div>

        <img
          src={certificateLogo}
          alt=""
          style={{ width: 80, height: 80, objectFit: "contain", flexShrink: 0 }}
        />

        <div style={{ flex: 1, textAlign: "right", fontFamily: "serif" }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: DARK_GREEN, lineHeight: 1.3 }}>
            مـدرســة ريـسـن اسـتـار
            <br />
            الأسـاسـيـة والـثـانـويـة
          </div>
          <div style={{ fontSize: 12, color: "#0284C7", fontWeight: 600, marginTop: 2 }}>
            مـقـديـشـو - الـصـومـال
          </div>
        </div>
      </div>

      {/* Two-column bilingual body: Somali on the left, English on the right */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 22,
          marginTop: 18,
          position: "relative",
          zIndex: 2,
        }}
      >
        {/* Somali column */}
        <div style={{ fontSize: 13.5, lineHeight: 2 }}>
          <p style={{ margin: "0 0 8px" }}>
            Xafiiska imtixaadaadka wuxuu halkaan ku cadeynayaa in
          </p>
          <CertLine label="Magaca Hooyada" value={motherName} />
          <CertLine
            label="Goobta &amp; Taariikhda Dhalashada"
            value={`${placeOfBirth || ""}${placeOfBirth && dateOfBirth ? ", " : ""}${dateOfBirth || ""}`}
          />
          <CertLine
            label="Dhameystay/Dhameysatay Dugsiga Dhexe"
            value={schoolName || "Rising Star Primary & Secondary School"}
          />
          <CertLine
            label="Sanadka"
            value={academicYear}
            inline
            extra={<CertLine label="Rool Lam" value={rollNumber} inline noMargin />}
          />
          <CertLine
            label="Celceliska Natiijada Imtixaanka"
            value={averageResult != null ? `${averageResult}%` : ""}
          />
        </div>

        {/* English column */}
        <div style={{ fontSize: 13.5, lineHeight: 2 }}>
          <p style={{ margin: "0 0 8px" }}>Examination Office certifies that</p>
          <CertLine label="Mother's name" value={motherName} />
          <CertLine
            label="Place &amp; Date of birth"
            value={`${placeOfBirth || ""}${placeOfBirth && dateOfBirth ? ", " : ""}${dateOfBirth || ""}`}
          />
          <CertLine
            label="Completed primary school"
            value={schoolName || "Rising Star Primary & Secondary School"}
          />
          <CertLine
            label="Year"
            value={academicYear}
            inline
            extra={<CertLine label="Roll Number" value={rollNumber} inline noMargin />}
          />
          <CertLine label="Result Average" value={averageResult != null ? `${averageResult}%` : ""} />
        </div>
      </div>

      {/* Student photo box, centered under the header — matching the
          dashed placeholder box in the printed reference */}
      <div
        style={{
          position: "absolute",
          top: 150,
          left: "50%",
          transform: "translateX(-50%)",
          width: 96,
          height: 116,
          border: `2px dashed ${GREEN}`,
          borderRadius: 3,
          background: "#fff",
          overflow: "hidden",
          zIndex: 3,
        }}
      >
        {studentPhoto ? (
          <img
            src={studentPhoto}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : null}
      </div>

      {/* Subjects table: Somali headers left, English headers right — the
          6 highest-scoring subjects for this student's Final Exam. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 22,
          marginTop: 18,
          position: "relative",
          zIndex: 2,
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 6, textAlign: "center" }}>
            Hoos waxaa ku qoran natiijada Imtixaanka maado waliba
          </div>
          <SubjectsTable rows={subjectRows} headers={["No", "Maado", "Dhibco"]} />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 6, textAlign: "center" }}>
            Below is the performance of each subject
          </div>
          <SubjectsTable rows={subjectRows} headers={["No", "Subject", "Marks"]} />
        </div>
      </div>

      {/* Footer note + grading rule text, matching the printed reference */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 22,
          marginTop: 14,
          fontSize: 11,
          color: "#374151",
          position: "relative",
          zIndex: 2,
        }}
      >
        <div>
          <p style={{ margin: "0 0 4px" }}>
            Shahaadada Dugsiga Dhexe waxaa la siin karaa ardeyga ugu yaraan 7
            <br />
            Maado ka keena mid kasta 50% maadooyinkaas marki la isku
            <br />
            geeyana celceliskoodu aannu ka yaraan 60%
          </p>
          <p style={{ margin: "6px 0 0" }}>
            Taariikhda la bixiyay Shahaadada: {issueDate || "____/____/______"}
          </p>
          <p style={{ margin: "6px 0 0", color: "#DC2626", fontWeight: 700 }}>
            FG. Tir-tirku waa ay burburinaysaa shahaadada.
          </p>
          <p style={{ margin: "2px 0 0", fontStyle: "italic", fontWeight: 600 }}>
            Agaasimaha Xafiiska Imtixaanaadka
          </p>
        </div>
        <div>
          <p style={{ margin: "0 0 4px" }}>
            This primary certificate is issued to a student who passed at
            <br />
            Least 7 subjects and has attained a minimum of 50% in each,
            <br />
            and also attained an aggregate of 60% of the total marks.
          </p>
          <p style={{ margin: "6px 0 0" }}>Date of issue: {issueDate || "____/____/______"}</p>
          <p style={{ margin: "6px 0 0", color: "#DC2626", fontWeight: 700 }}>
            Note: Alteration renders this certificate invalid.
          </p>
          <p style={{ margin: "2px 0 0", fontStyle: "italic", fontWeight: 600 }}>
            Director of Examination Office
          </p>
        </div>
      </div>

      {/* Certificate ID + QR code, bottom-right, for the public /verify page */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 10,
          marginTop: 14,
          position: "relative",
          zIndex: 2,
        }}
      >
        <div style={{ fontSize: 10, color: "#6B7280", fontFamily: "monospace", textAlign: "right" }}>
          {certificateId}
        </div>
        <div ref={qrRef} style={{ width: 80, height: 80, flexShrink: 0 }} />
      </div>
    </div>
  );
}

// Underline-style bilingual field, matching the printed certificate's
// "Label:______________" layout. `inline` renders it as a shorter half-width
// field (used for Year / Roll Number sitting side by side).
function CertLine({ label, value, inline, extra, noMargin }) {
  if (inline) {
    return (
      <div style={{ display: "flex", gap: 16, marginBottom: noMargin ? 0 : 2 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4, flex: 1 }}>
          <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{label}:</span>
          <span style={{ flex: 1, borderBottom: "1px solid #374151", minHeight: 18, paddingLeft: 4 }}>
            {value || ""}
          </span>
        </div>
        {extra}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 2 }}>
      <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{label}:</span>
      <span
        style={{
          flex: 1,
          borderBottom: "1px solid #374151",
          minHeight: 20,
          paddingLeft: 6,
        }}
      >
        {value || ""}
      </span>
    </div>
  );
}

// The 6-row subjects table shared by both the Somali and English columns.
// `rows[i]` is either null (no subject recorded at this position) or
// `{ subject, marks, maxMarks }`.
function SubjectsTable({ rows, headers }) {
  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        fontSize: 11.5,
        border: `1px solid ${GREEN}`,
      }}
    >
      <thead>
        <tr style={{ background: "rgba(22,101,52,0.08)" }}>
          {headers.map((h) => (
            <th
              key={h}
              style={{
                border: `1px solid ${GREEN}`,
                padding: "4px 6px",
                fontWeight: 700,
                textAlign: h === headers[1] ? "left" : "center",
              }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            <td style={{ border: `1px solid ${GREEN}`, padding: "4px 6px", textAlign: "center" }}>
              {i + 1}
            </td>
            <td style={{ border: `1px solid ${GREEN}`, padding: "4px 6px" }}>
              {row ? row.subject : ""}
            </td>
            <td style={{ border: `1px solid ${GREEN}`, padding: "4px 6px", textAlign: "center" }}>
              {row ? row.marks : ""}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Loads a QR-rendering library from a CDN on demand and normalizes it to a
// simple async `toCanvas(container, text)` function, so the caller doesn't
// need to know which underlying library ended up being used.
let qrPromise = null;
function loadQr() {
  if (qrPromise) return qrPromise;
  qrPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
    script.onload = () => {
      if (!window.QRCode) {
        reject(new Error("QR library failed to attach to window"));
        return;
      }
      resolve({
        toCanvas: async (container, text, opts = {}) => {
          container.innerHTML = "";
          new window.QRCode(container, {
            text,
            width: opts.width || 96,
            height: opts.height || 96,
            colorDark: (opts.color && opts.color.dark) || "#000000",
            colorLight: (opts.color && opts.color.light) || "#ffffff",
          });
        },
      });
    };
    script.onerror = reject;
    document.body.appendChild(script);
  });
  return qrPromise;
}