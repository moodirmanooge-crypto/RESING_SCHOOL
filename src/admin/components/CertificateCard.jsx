// src/admin/components/CertificateCard.jsx
// Renders the official "Class 8 Leaving Certificate" design (matching the
// printed PDF reference — Somali on the left, English on the right, subjects
// tables split into two halves, borders, guilloche security background).
// Shared by:
//   - admin/pages/Certificates.jsx (preview + snapshot for download)
//   - student/Dashboard.jsx (Certificate tab)
//   - pages/VerifyCertificate.jsx (public verification page)
import certificateLogo from "../assets/certificate-logo.png";

const GREEN = "#2f9e44";
const DARK_GREEN = "#0f6b3f";
const BORDER_GREEN = "#3aa856";
const BLUE = "#1f9ed6";
const GUILLOCHE = "#8fc7e0";

// UI-only helper: the English (right-hand) table shows the same subjects, but
// with their names rendered in English. Backend data (topSubjects) is not
// changed — this only affects how the label is displayed on the English side.
function toEnglishSubject(name) {
  if (!name) return "";
  const map = {
    xisaab: "Math",
    somali: "Somali",
    "af somali": "Somali",
    saynis: "Science",
    "cilmi bulsho": "Social",
    cilmibulsho: "Social",
    arabic: "Arabic",
    "af carabi": "Arabic",
    carabi: "Arabic",
    islamic: "Islamic",
    diinta: "Islamic",
    english: "English",
    "af ingiriisi": "English",
    ingiriisi: "English",
  };
  const key = String(name).trim().toLowerCase();
  return map[key] || name;
}

export default function CertificateCard({ certificate, verifyUrl, elementId = "certificate-render-card" }) {
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
    topSubjects, // array of up to 12: [{ subject, marks, maxMarks }]
    averageResult, // computed average across topSubjects, as a percentage
  } = certificate;

  const subjects = Array.isArray(topSubjects) ? topSubjects.slice(0, 12) : [];
  // Always render 12 rows so the table layout matches the printed reference,
  // even if fewer than 12 subjects were recorded for this student. The 12 rows
  // are shown as two side-by-side halves (1-6 | 7-12) within each language.
  const subjectRows = Array.from({ length: 12 }, (_, i) => subjects[i] || null);
  const leftHalf = subjectRows.slice(0, 6);
  const rightHalf = subjectRows.slice(6, 12);

  return (
    <div
      id={elementId}
      style={{
        width: 1040,
        maxWidth: "100%",
        aspectRatio: "1.414 / 1", // A4 landscape
        background: "#fdfdfb",
        padding: 12,
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
          top: 26,
          left: 26,
          right: 26,
          bottom: 26,
          border: `2.5px solid ${GREEN}`,
          borderRadius: 4,
          pointerEvents: "none",
          zIndex: 2,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 31,
          left: 31,
          right: 31,
          bottom: 31,
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
          top: 40,
          left: 44,
          right: 44,
          bottom: 40,
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
            <div style={{ fontSize: 24, fontWeight: 800, color: DARK_GREEN, lineHeight: 1.08, letterSpacing: 0.3 }}>
              RISING STAR PRIMARY
              <br />
              &amp; SECONDARY SCHOOL
            </div>
            <div style={{ fontSize: 15, color: BLUE, fontWeight: 700, marginTop: 3, fontStyle: "italic" }}>
              Mogadishu-Somalia
            </div>
          </div>

          <img
            src={certificateLogo}
            alt=""
            style={{ width: 78, height: 78, objectFit: "contain", flexShrink: 0 }}
          />

          <div style={{ flex: 1, textAlign: "right", fontFamily: "'Traditional Arabic','Amiri',serif" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: DARK_GREEN, lineHeight: 1.3, direction: "rtl" }}>
              مـدرســة ريـسـن اسـتـار
              <br />
              الأسـاسـيـة والـثـانـويـة
            </div>
            <div style={{ fontSize: 12, color: BLUE, fontWeight: 700, marginTop: 2, direction: "rtl" }}>
              مـقـديـشـو - الـصـومـال
            </div>
          </div>
        </div>

        {/* Two-column bilingual body: Somali left, English right, photo box centered */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 100px 1fr",
            gap: 14,
            marginTop: 14,
            alignItems: "start",
          }}
        >
          {/* Somali column */}
          <div style={{ fontSize: 12.5 }}>
            <p style={{ margin: "0 0 8px" }}>Xafiiska imtixaadaadka wuxuu halkaan ku cadeynayaa in</p>
            <CertLine label="Magaca Hooyada" value={motherName} />
            <CertLine
              label="Goobta &amp; Taariikhda Dhalashada"
              value={`${placeOfBirth || ""}${placeOfBirth && dateOfBirth ? ", " : ""}${dateOfBirth || ""}`}
            />
            <CertLine
              label="Dhameystay/Dhameysatay Dugsiga Dhexe"
              value={schoolName || "Rising Star Primary & Secondary School"}
            />
            <div style={{ display: "flex", gap: 12 }}>
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
              width: 94,
              height: 112,
              border: `2px dashed ${GREEN}`,
              borderRadius: 3,
              background: "#fff",
              overflow: "hidden",
              marginTop: 2,
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
          <div style={{ fontSize: 12.5 }}>
            <p style={{ margin: "0 0 8px" }}>Examination Office certifies that</p>
            <CertLine label="Mother`s name" value={motherName} />
            <CertLine
              label="Place &amp; Date of birth"
              value={`${placeOfBirth || ""}${placeOfBirth && dateOfBirth ? ", " : ""}${dateOfBirth || ""}`}
            />
            <CertLine
              label="Completed primary school"
              value={schoolName || "Rising Star Primary & Secondary School"}
            />
            <div style={{ display: "flex", gap: 12 }}>
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

        {/* Subjects tables: Somali left, English right — each split into two
            side-by-side halves (rows 1-6 | 7-12), matching the PDF reference.
            The English table renders subject names in English via `english`. */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 26,
            marginTop: 10,
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 3, color: DARK_GREEN }}>
              Hoos waxaa ku qoran natiijada Imtixaanka maado waliba
            </div>
            <SplitSubjectsTable
              left={leftHalf}
              right={rightHalf}
              headers={["No", "Maado", "Dhibco", "No", "Maado", "Dhibco"]}
            />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 3, color: DARK_GREEN }}>
              Below is the performance of each subject
            </div>
            <SplitSubjectsTable
              left={leftHalf}
              right={rightHalf}
              headers={["No", "Subject", "Marks", "No", "Subject", "Marks"]}
              english
            />
          </div>
        </div>

        {/* Footer note + grading rule text */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 26,
            marginTop: "auto",
            paddingTop: 8,
            fontSize: 10.5,
            color: "#374151",
          }}
        >
          <div>
            <p style={{ margin: "0 0 2px", lineHeight: 1.3 }}>
              Shahaadada Dugsiga Dhexe waxaa la siin karaa ardeyga ugu yaraan 7
              <br />
              Maado ka keena mid kasta 50% maadooyinkaas marki la isku
              <br />
              geeyana celceliskoodu aannu ka yaraan 60%
            </p>
            <p style={{ margin: "3px 0 0" }}>
              Taariikhda la bixiyay Shahaadada:{" "}
              <span style={{ borderBottom: "1px solid #374151", padding: "0 22px" }}>
                {issueDate || ""}
              </span>
            </p>
            <p style={{ margin: "3px 0 0" }}>
              <span style={{ color: "#DC2626", fontWeight: 700 }}>FG.</span>
              <span style={{ color: "#DC2626", fontWeight: 700 }}>
                Tir-tiriddu waa ay burburineysaa shahaadada.
              </span>
            </p>
            <p style={{ margin: "4px 0 0", fontStyle: "italic", fontWeight: 700, textAlign: "center" }}>
              Agaasunaga Xafiiska Imtixaanaadka
            </p>
          </div>
          <div>
            <p style={{ margin: "0 0 2px", lineHeight: 1.3 }}>
              This primary certificate is issued to a student who passed at
              <br />
              Least 7 subjects and has attained a minimum of 50% in each .
              <br />
              and also attained an aggregate of 60% of the total marks.
            </p>
            <p style={{ margin: "3px 0 0" }}>
              Date of issue:{" "}
              <span style={{ borderBottom: "1px solid #374151", padding: "0 22px" }}>
                {issueDate || ""}
              </span>
            </p>
            <p style={{ margin: "3px 0 0" }}>
              <span style={{ color: "#DC2626", fontWeight: 700 }}>Note:</span>{" "}
              <span style={{ color: "#DC2626", fontWeight: 700 }}>
                Alternation renders this certificate invalid.
              </span>
            </p>
            <p style={{ margin: "4px 0 0", fontStyle: "italic", fontWeight: 700, textAlign: "center" }}>
              Director of Examination Office
            </p>
          </div>
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
          <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="#dcdcdc" strokeWidth="0.6" />
          </pattern>
          <radialGradient id="fade" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor={GUILLOCHE} stopOpacity="0.5" />
            <stop offset="70%" stopColor={GUILLOCHE} stopOpacity="0.1" />
            <stop offset="100%" stopColor={GUILLOCHE} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Outer hatched margin */}
        <rect x="0" y="0" width="1040" height="735" fill="url(#hatch)" />
        <rect x="22" y="22" width="996" height="691" fill="#fdfdfb" />

        {/* Scalloped security border ring (green wave frame) */}
        <ScallopFrame />

        {/* Central guilloche rosette pattern */}
        <g opacity="0.9">
          <ellipse cx="520" cy="360" rx="380" ry="250" fill="url(#fade)" />
          <GuillocheRosette />
        </g>
      </svg>
    </div>
  );
}

// Green scalloped wave frame around the whole certificate (two nested rings).
function ScallopFrame() {
  const build = (x1, y1, x2, y2, R, step, up) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    const n = Math.round(len / step);
    const ux = dx / len;
    const uy = dy / len;
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
  const ring = (inset, R, step, opacity) => {
    const x0 = inset, y0 = inset, x1 = 1040 - inset, y1 = 735 - inset;
    return (
      <g fill="none" stroke={BORDER_GREEN} strokeWidth="1.3" opacity={opacity}>
        <path d={build(x0, y0, x1, y0, R, step, true)} />
        <path d={build(x1, y0, x1, y1, R, step, true)} />
        <path d={build(x1, y1, x0, y1, R, step, true)} />
        <path d={build(x0, y1, x0, y0, R, step, true)} />
      </g>
    );
  };
  return (
    <>
      {ring(24, 16, 32, 1)}
      {ring(14, 20, 40, 0.55)}
    </>
  );
}

// Concentric spirograph-style rosette for the center guilloche.
function GuillocheRosette() {
  const cxN = 520;
  const cyN = 360;
  const rings = [];
  for (let r = 20; r <= 240; r += 11) {
    const pts = [];
    const petals = 14;
    for (let a = 0; a <= 360; a += 3) {
      const rad = (a * Math.PI) / 180;
      const rr = r + Math.sin(rad * petals) * (r * 0.08);
      pts.push(`${(cxN + rr * Math.cos(rad)).toFixed(1)},${(cyN + rr * Math.sin(rad)).toFixed(1)}`);
    }
    rings.push(
      <polyline
        key={r}
        points={pts.join(" ")}
        fill="none"
        stroke={GUILLOCHE}
        strokeWidth="0.35"
        opacity="0.45"
      />
    );
  }
  return <g>{rings}</g>;
}

// Underline-style bilingual field, matching the printed certificate's
// "Label:______________" layout.
function CertLine({ label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 5, marginBottom: 9 }}>
      <span
        style={{ fontWeight: 400, whiteSpace: "nowrap", fontSize: 12.5 }}
        dangerouslySetInnerHTML={{ __html: `${label}:` }}
      />
      <span
        style={{
          flex: 1,
          borderBottom: "1px solid #4b5563",
          minHeight: 14,
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

// The 12-row subjects table, rendered as two side-by-side halves (1-6 | 7-12)
// to match the printed reference. `left`/`right` are arrays of up to 6 rows,
// each either null or `{ subject, marks, maxMarks }`. When `english` is true,
// subject names are shown in English (display-only, backend data unchanged).
function SplitSubjectsTable({ left, right, headers, english }) {
  const cell = {
    border: `1px solid ${GREEN}`,
    padding: "1px 5px",
    fontSize: 11,
    lineHeight: 1.3,
    height: 17,
  };
  const th = { ...cell, fontWeight: 700, background: "rgba(47,158,68,0.10)", textAlign: "center" };
  const numCol = { ...cell, textAlign: "center", width: 20, fontWeight: 700 };
  const subCol = { ...cell, textAlign: "left" };
  const markCol = { ...cell, textAlign: "center", width: 38 };
  const nameOf = (row) => (row ? (english ? toEnglishSubject(row.subject) : row.subject) : "");

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
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const l = left[i];
          const r = right[i];
          return (
            <tr key={i}>
              <td style={numCol}>{i + 1}</td>
              <td style={subCol}>{nameOf(l)}</td>
              <td style={markCol}>{l ? l.marks : ""}</td>
              <td style={numCol}>{i + 7}</td>
              <td style={subCol}>{nameOf(r)}</td>
              <td style={markCol}>{r ? r.marks : ""}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}