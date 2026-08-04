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

const GREEN = "#2f9e44";
const DARK_GREEN = "#166534";
const BORDER_GREEN = "#3aa856";
const BLUE = "#1f7fb8";
const GUILLOCHE = "#8fc7e0";

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
  // The reference splits the 6 rows into two side-by-side halves (1-3 | 4-6).
  const leftHalf = subjectRows.slice(0, 3);
  const rightHalf = subjectRows.slice(3, 6);

  return (
    <div
      id={elementId}
      style={{
        width: 1040,
        maxWidth: "100%",
        aspectRatio: "1.414 / 1", // A4 landscape
        background: "#fdfdfb",
        padding: 14,
        position: "relative",
        fontFamily: "'Inter','Segoe UI',sans-serif",
        color: "#111827",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {/* ── Decorative security background: guilloche + scalloped border ── */}
      <SecurityBackground />

      {/* ── Inner green frame (double line) ── */}
      <div
        style={{
          position: "absolute",
          top: 30,
          left: 30,
          right: 30,
          bottom: 30,
          border: `2.5px solid ${GREEN}`,
          borderRadius: 4,
          pointerEvents: "none",
          zIndex: 2,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 35,
          left: 35,
          right: 35,
          bottom: 35,
          border: `1px solid ${GREEN}`,
          borderRadius: 3,
          pointerEvents: "none",
          zIndex: 2,
        }}
      />

      {/* ── Content ── */}
      <div
        style={{
          position: "absolute",
          top: 44,
          left: 46,
          right: 46,
          bottom: 44,
          zIndex: 3,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header: school name (Somali/English) left, logo center, Arabic right */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: DARK_GREEN, lineHeight: 1.1, letterSpacing: 0.3 }}>
              RISING STAR PRIMARY
              <br />
              &amp; SECONDARY SCHOOL
            </div>
            <div style={{ fontSize: 16, color: BLUE, fontWeight: 700, marginTop: 4, fontStyle: "italic" }}>
              Mogadishu-Somalia
            </div>
          </div>

          <img
            src={certificateLogo}
            alt=""
            style={{ width: 82, height: 82, objectFit: "contain", flexShrink: 0 }}
          />

          <div style={{ flex: 1, textAlign: "right", fontFamily: "'Traditional Arabic','Amiri',serif" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: DARK_GREEN, lineHeight: 1.35, direction: "rtl" }}>
              مـدرســة ريـسـن اسـتـار
              <br />
              الأسـاسـيـة والـثـانـويـة
            </div>
            <div style={{ fontSize: 13, color: BLUE, fontWeight: 700, marginTop: 2, direction: "rtl" }}>
              مـقـديـشـو - الـصـومـال
            </div>
          </div>
        </div>

        {/* Two-column bilingual body: Somali left, English right, photo box centered */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 108px 1fr",
            gap: 14,
            marginTop: 16,
            alignItems: "start",
          }}
        >
          {/* Somali column */}
          <div style={{ fontSize: 13.5, lineHeight: 1 }}>
            <p style={{ margin: "0 0 10px" }}>Xafiiska imtixaadaadka wuxuu halkaan ku cadeynayaa in</p>
            <CertLine label="Magaca Hooyada" value={motherName} />
            <CertLine
              label="Goobta &amp; Taariikhda Dhalashada"
              value={`${placeOfBirth || ""}${placeOfBirth && dateOfBirth ? ", " : ""}${dateOfBirth || ""}`}
            />
            <CertLine
              label="Dhameystay/Dhameysatay Dugsiga Dhexe"
              value={schoolName || "Rising Star Primary & Secondary School"}
            />
            <div style={{ display: "flex", gap: 14 }}>
              <div style={{ flex: 1 }}>
                <CertLine label="Sanadka" value={academicYear} />
              </div>
              <div style={{ flex: 1 }}>
                <CertLine label="Rool Lam" value={rollNumber} />
              </div>
            </div>
            <CertLine
              label="Celceliska Natiijada Imtixaanka"
              value={averageResult != null ? `${averageResult}%` : ""}
            />
          </div>

          {/* Center photo placeholder (dashed box) */}
          <div
            style={{
              width: 100,
              height: 120,
              border: `2px dashed ${GREEN}`,
              borderRadius: 3,
              background: "#fff",
              overflow: "hidden",
              marginTop: 4,
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

          {/* English column */}
          <div style={{ fontSize: 13.5, lineHeight: 1 }}>
            <p style={{ margin: "0 0 10px" }}>Examination Office certifies that</p>
            <CertLine label="Mother`s name" value={motherName} />
            <CertLine
              label="Place &amp; Date of birth"
              value={`${placeOfBirth || ""}${placeOfBirth && dateOfBirth ? ", " : ""}${dateOfBirth || ""}`}
            />
            <CertLine
              label="Completed primary school"
              value={schoolName || "Rising Star Primary & Secondary School"}
            />
            <div style={{ display: "flex", gap: 14 }}>
              <div style={{ flex: 1 }}>
                <CertLine label="Year" value={academicYear} />
              </div>
              <div style={{ flex: 1 }}>
                <CertLine label="Roll Number" value={rollNumber} />
              </div>
            </div>
            <CertLine label="Result Average" value={averageResult != null ? `${averageResult}%` : ""} />
          </div>
        </div>

        {/* Subjects tables: Somali headers left, English headers right — split
            into two side-by-side halves (rows 1-3 | 4-6), matching the reference. */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 30,
            marginTop: 14,
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, color: DARK_GREEN }}>
              Hoos waxaa ku qoran natiijada Imtixaanka maado waliba
            </div>
            <SplitSubjectsTable
              left={leftHalf}
              right={rightHalf}
              startRight={4}
              headers={["No", "Maado", "Dhibco", "No", "Maado", "Dhibco"]}
              subjectCols={[1, 4]}
            />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, color: DARK_GREEN }}>
              Below is the performance of each subject
            </div>
            <SplitSubjectsTable
              left={leftHalf}
              right={rightHalf}
              startRight={4}
              headers={["No", "Subject", "Marks", "No", "Subject", "Marks"]}
              subjectCols={[1, 4]}
            />
          </div>
        </div>

        {/* Footer note + grading rule text */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 30,
            marginTop: "auto",
            paddingTop: 10,
            fontSize: 11.5,
            color: "#374151",
          }}
        >
          <div>
            <p style={{ margin: "0 0 2px", lineHeight: 1.35 }}>
              Shahaadada Dugsiga Dhexe waxaa la siin karaa ardeyga ugu yaraan 7
              <br />
              Maado ka keena mid kasta 50% maadooyinkaas marki la isku
              <br />
              geeyana celceliskoodu aannu ka yaraan 60%
            </p>
            <p style={{ margin: "4px 0 0" }}>
              Taariikhda la bixiyay Shahaadada:{" "}
              <span style={{ borderBottom: "1px solid #374151", padding: "0 24px" }}>
                {issueDate || ""}
              </span>
            </p>
            <p style={{ margin: "4px 0 0" }}>
              <span style={{ color: "#DC2626", fontWeight: 700 }}>FG.</span>
              <span style={{ color: "#DC2626", fontWeight: 700 }}>
                Tir-tirku waa ay burburinaysaa shahaadada.
              </span>
            </p>
            <p style={{ margin: "6px 0 0", fontStyle: "italic", fontWeight: 700 }}>
              Agaasunaga Xafiiska Imtixaanaadka
            </p>
          </div>
          <div>
            <p style={{ margin: "0 0 2px", lineHeight: 1.35 }}>
              This primary certificate is issued to a student who passed at
              <br />
              Least 7 subjects and has attained a minimum of 50% in each ,
              <br />
              and also attained an aggregate of 60% of the total marks.
            </p>
            <p style={{ margin: "4px 0 0" }}>
              Date of issue:{" "}
              <span style={{ borderBottom: "1px solid #374151", padding: "0 24px" }}>
                {issueDate || ""}
              </span>
            </p>
            <p style={{ margin: "4px 0 0" }}>
              <span style={{ color: "#DC2626", fontWeight: 700 }}>Note:</span>{" "}
              <span style={{ color: "#DC2626", fontWeight: 700 }}>
                Alternation renders this certificate invalid.
              </span>
            </p>
            <p style={{ margin: "6px 0 0", fontStyle: "italic", fontWeight: 700 }}>
              Director of Examination Office
            </p>
          </div>
        </div>

        {/* Certificate ID + QR code, bottom-right, for the public /verify page */}
        <div
          style={{
            position: "absolute",
            right: 0,
            bottom: -30,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div style={{ fontSize: 9, color: "#9CA3AF", fontFamily: "monospace", textAlign: "right" }}>
            {certificateId}
          </div>
          <div ref={qrRef} style={{ width: 56, height: 56, flexShrink: 0 }} />
        </div>
      </div>
    </div>
  );
}

// ── Decorative security background: guilloche radial pattern + scalloped
//    security border, approximating the engraved artwork in the reference. ──
function SecurityBackground() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 1,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1040 735"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          {/* Fine diagonal guilloche hatch fill for the outer margin */}
          <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="#d9d9d9" strokeWidth="0.6" />
          </pattern>
          {/* A single scallop arc, tiled along the border */}
          <pattern id="scallopTop" width="46" height="46" patternUnits="userSpaceOnUse">
            <path d="M0,40 A23,23 0 0 1 46,40" fill="none" stroke={BORDER_GREEN} strokeWidth="1.3" />
            <path d="M0,32 A23,23 0 0 1 46,32" fill="none" stroke={BORDER_GREEN} strokeWidth="0.8" />
          </pattern>
          <radialGradient id="fade" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor={GUILLOCHE} stopOpacity="0.55" />
            <stop offset="70%" stopColor={GUILLOCHE} stopOpacity="0.12" />
            <stop offset="100%" stopColor={GUILLOCHE} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Outer hatched margin */}
        <rect x="0" y="0" width="1040" height="735" fill="url(#hatch)" />
        <rect x="26" y="26" width="988" height="683" fill="#fdfdfb" />

        {/* Scalloped security border ring (green wave frame) */}
        <ScallopFrame />

        {/* Central guilloche rosette pattern */}
        <g opacity="0.9">
          <ellipse cx="520" cy="360" rx="360" ry="230" fill="url(#fade)" />
          <GuillocheRosette cx={520} cy={360} />
        </g>
      </svg>
    </div>
  );
}

// Green scalloped wave frame around the whole certificate.
function ScallopFrame() {
  const R = 15;
  const step = 30;
  const paths = [];
  const build = (x1, y1, x2, y2, up) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    const n = Math.round(len / step);
    const ux = dx / len;
    const uy = dy / len;
    // perpendicular (points inward)
    const px = up ? uy : -uy;
    const py = up ? -ux : ux;
    let d = `M ${x1} ${y1}`;
    for (let i = 0; i < n; i++) {
      const sx = x1 + ux * step * i;
      const sy = y1 + uy * step * i;
      const ex = x1 + ux * step * (i + 1);
      const ey = y1 + uy * step * (i + 1);
      const cx = (sx + ex) / 2 + px * R;
      const cy = (sy + ey) / 2 + py * R;
      d += ` Q ${cx} ${cy} ${ex} ${ey}`;
    }
    return d;
  };
  const inset = 30;
  const x0 = inset, y0 = inset, x1 = 1040 - inset, y1 = 735 - inset;
  return (
    <g fill="none" stroke={BORDER_GREEN} strokeWidth="1.4">
      <path d={build(x0, y0, x1, y0, true)} />
      <path d={build(x1, y0, x1, y1, true)} />
      <path d={build(x1, y1, x0, y1, true)} />
      <path d={build(x0, y1, x0, y0, true)} />
      <path d={build(x0, y0, x1, y0, false)} opacity="0.5" />
      <path d={build(x1, y0, x1, y1, false)} opacity="0.5" />
      <path d={build(x1, y1, x0, y1, false)} opacity="0.5" />
      <path d={build(x0, y1, x0, y0, false)} opacity="0.5" />
    </g>
  );
}

// Concentric spirograph-style rosette for the center guilloche.
function GuillocheRosette({ cx, cy }) {
  const cxN = 520;
  const cyN = 360;
  const rings = [];
  for (let r = 20; r <= 220; r += 12) {
    const pts = [];
    const petals = 12;
    for (let a = 0; a <= 360; a += 3) {
      const rad = (a * Math.PI) / 180;
      const rr = r + Math.sin(rad * petals) * (r * 0.09);
      pts.push(`${(cxN + rr * Math.cos(rad)).toFixed(1)},${(cyN + rr * Math.sin(rad)).toFixed(1)}`);
    }
    rings.push(
      <polyline
        key={r}
        points={pts.join(" ")}
        fill="none"
        stroke={GUILLOCHE}
        strokeWidth="0.4"
        opacity="0.5"
      />
    );
  }
  return <g>{rings}</g>;
}

// Underline-style bilingual field, matching the printed certificate's
// "Label:______________" layout.
function CertLine({ label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 5, marginBottom: 11 }}>
      <span style={{ fontWeight: 400, whiteSpace: "nowrap", fontSize: 13.5 }}
        dangerouslySetInnerHTML={{ __html: `${label}:` }}
      />
      <span
        style={{
          flex: 1,
          borderBottom: "1px solid #4b5563",
          minHeight: 15,
          paddingLeft: 4,
          fontWeight: 600,
          lineHeight: 1.1,
        }}
      >
        {value || ""}
      </span>
    </div>
  );
}

// The 6-row subjects table, rendered as two side-by-side halves (1-3 | 4-6)
// to match the printed reference. `left`/`right` are arrays of up to 3 rows,
// each either null or `{ subject, marks, maxMarks }`.
function SplitSubjectsTable({ left, right, startRight, headers, subjectCols }) {
  const cell = {
    border: `1px solid ${GREEN}`,
    padding: "2px 5px",
    fontSize: 11.5,
    lineHeight: 1.35,
    height: 19,
  };
  const th = { ...cell, fontWeight: 700, background: "rgba(47,158,68,0.10)", textAlign: "center" };
  const numCol = { ...cell, textAlign: "center", width: 22, fontWeight: 700 };
  const subCol = { ...cell, textAlign: "left" };
  const markCol = { ...cell, textAlign: "center", width: 40 };

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", border: `1px solid ${GREEN}` }}>
      <thead>
        <tr>
          {headers.map((h, i) => (
            <th key={i} style={th}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {[0, 1, 2].map((i) => {
          const l = left[i];
          const r = right[i];
          return (
            <tr key={i}>
              <td style={numCol}>{i + 1}</td>
              <td style={subCol}>{l ? l.subject : ""}</td>
              <td style={markCol}>{l ? l.marks : ""}</td>
              <td style={numCol}>{startRight + i}</td>
              <td style={subCol}>{r ? r.subject : ""}</td>
              <td style={markCol}>{r ? r.marks : ""}</td>
            </tr>
          );
        })}
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