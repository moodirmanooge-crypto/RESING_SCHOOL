// src/admin/components/CertificateCard.jsx
// Renders a Class Leaving Certificate using the EXACT printed template
// artwork (certificate-template.png, exported from the school's real
// Illustrator design) as the background, with the student's data
// (mother's name, place & date of birth, year, roll number, result
// average, and up to 12 subjects with marks) overlaid on top at the
// correct positions — the same pattern ManualStudentIdCard.jsx uses for
// ID cards: the template image IS the design, never redrawn in CSS: only
// the blank lines/boxes on it get real text on top.
//
// All positions are percentages of the card, so it scales cleanly for
// on-screen preview, download (html2canvas), and print without the
// overlay drifting off the printed lines.
//
// Props:
//   certificate — { fullName, motherName, placeOfBirth, dateOfBirth,
//                    completedSchool, year, rollNumber, resultAverage,
//                    subjects: [{ name, marks }, ...] (up to 12),
//                    studentPhoto, issueDate }
//   verifyUrl   — full URL this certificate's QR should encode
//                 (VerifyCertificate.jsx renders at /verify/:certificateId)
//   elementId   — DOM id put on the outer wrapper, so callers (e.g.
//                 html2canvas download, print) can target this exact node
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import certificateTemplate from "./assets/certificate-template.png";

// Keeps the template's real aspect ratio (3508 x 2481 px source, A4 landscape).
const CARD_W = 900; // on-screen width; height derived from the ratio
const RATIO = 2481 / 3508;

// The photo box (dashed square) sits between the two language columns.
// Measured directly from the template as % of the card.
const PHOTO_BOX = { left: 43.6, top: 32.2, width: 12.9, height: 24.3 };

// English-column field line positions (right side of the card), each as
// {top, left, right} in % of the card — the value sits ON the underline
// that's already printed in the template, just above it.
const FIELD = {
  motherName: { top: 39.9, left: 63.5, right: 3 },
  placeDob: { top: 44.0, left: 63.9, right: 3 },
  completedSchool: { top: 48.1, left: 66.3, right: 3 },
  year: { top: 52.2, left: 58.7, right: 33 },
  rollNumber: { top: 52.2, left: 84.2, right: 3 },
  resultAverage: { top: 56.3, left: 65.0, right: 3 },
};

// The two 6-row subject tables on the English (right) side.
// Table A: rows 1-6, columns No | Subject | Marks
// Table B: rows 7-12 (labelled 1-6 again on the template, so shown as a
// second physical table), columns No | Subject (marks column not printed
// on the template's second table — its "No/Subject" pair only, matching
// the artwork exactly).
// Row band top/bottom measured from the template; each row's vertical
// center is interpolated across 6 equal rows within that band.
const TABLE_A = {
  subjectLeft: 68.9,
  subjectRight: 79.6,
  marksLeft: 79.9,
  marksRight: 83.6,
  rowTops: [61.0, 63.85, 66.7, 69.55, 72.4, 75.25], // % — row vertical centers
};
const TABLE_B = {
  subjectLeft: 87.9,
  subjectRight: 99.3,
  rowTops: [61.0, 63.85, 66.7, 69.55, 72.4, 75.25],
};

const ISSUE_DATE = { top: 79.9, left: 66.2, right: 3 };

export default function CertificateCard({ certificate, verifyUrl, elementId }) {
  const {
    motherName,
    placeOfBirth,
    dateOfBirth,
    completedSchool,
    year,
    rollNumber,
    resultAverage,
    subjects = [],
    studentPhoto,
    issueDate,
  } = certificate || {};

  const placeDobText = [placeOfBirth, dateOfBirth].filter(Boolean).join(", ");
  const firstSix = subjects.slice(0, 6);
  const lastSix = subjects.slice(6, 12);

  const qrSrc = verifyUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=0&data=${encodeURIComponent(
        verifyUrl
      )}`
    : "";

  return (
    <div
      id={elementId}
      style={{
        position: "relative",
        width: CARD_W,
        height: CARD_W * RATIO,
        backgroundImage: `url(${certificateTemplate})`,
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
        borderRadius: 6,
        overflow: "hidden",
        boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
        fontFamily: "'Inter','Segoe UI',sans-serif",
        flexShrink: 0,
      }}
    >
      {/* Student photo — sits inside the dashed square box. */}
      <div
        style={{
          position: "absolute",
          left: `${PHOTO_BOX.left}%`,
          top: `${PHOTO_BOX.top}%`,
          width: `${PHOTO_BOX.width}%`,
          height: `${PHOTO_BOX.height}%`,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {studentPhoto ? (
          <img
            src={studentPhoto}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            crossOrigin="anonymous"
          />
        ) : null}
      </div>

      {/* ── English column fields ── */}
      <FitText text={motherName} {...FIELD.motherName} maxFontPx={CARD_W * 0.017} />
      <FitText text={placeDobText} {...FIELD.placeDob} maxFontPx={CARD_W * 0.017} />
      <FitText text={completedSchool} {...FIELD.completedSchool} maxFontPx={CARD_W * 0.017} />
      <FitText text={year} {...FIELD.year} maxFontPx={CARD_W * 0.017} />
      <FitText text={rollNumber} {...FIELD.rollNumber} maxFontPx={CARD_W * 0.017} />
      <FitText
        text={resultAverage ? `${resultAverage}%` : ""}
        {...FIELD.resultAverage}
        maxFontPx={CARD_W * 0.017}
      />
      <FitText text={issueDate} {...ISSUE_DATE} maxFontPx={CARD_W * 0.017} />

      {/* ── Subjects table A: rows 1-6, Subject + Marks ── */}
      {firstSix.map((s, i) => (
        <div key={`a-${i}`}>
          <FitText
            text={s?.name}
            top={TABLE_A.rowTops[i]}
            left={TABLE_A.subjectLeft}
            right={100 - TABLE_A.subjectRight}
            maxFontPx={CARD_W * 0.015}
            align="left"
          />
          <FitText
            text={s?.marks}
            top={TABLE_A.rowTops[i]}
            left={TABLE_A.marksLeft}
            right={100 - TABLE_A.marksRight}
            maxFontPx={CARD_W * 0.015}
            align="center"
          />
        </div>
      ))}

      {/* ── Subjects table B: rows 7-12, Subject only (matches template) ── */}
      {lastSix.map((s, i) => (
        <FitText
          key={`b-${i}`}
          text={s?.name}
          top={TABLE_B.rowTops[i]}
          left={TABLE_B.subjectLeft}
          right={100 - TABLE_B.subjectRight}
          maxFontPx={CARD_W * 0.015}
          align="left"
        />
      ))}

      {/* ── QR code — verification link, placed bottom-right corner ── */}
      {qrSrc && (
        <div
          style={{
            position: "absolute",
            right: "2.2%",
            bottom: "3%",
            width: "7%",
            aspectRatio: "1 / 1",
            background: "#ffffff",
            border: "1px solid #000000",
            padding: 2,
            boxSizing: "border-box",
          }}
        >
          <img src={qrSrc} alt="QR code" style={{ width: "100%", height: "100%", display: "block" }} />
        </div>
      )}
    </div>
  );
}

// Single-line text overlay that shrinks its font size until the text fits
// within its box, so long values are shown in full rather than clipped or
// overflowing onto neighbouring printed lines.
function FitText({ text, top, left, right, maxFontPx, minFontPx, align = "left" }) {
  const boxRef = useRef(null);
  const spanRef = useRef(null);
  const min = minFontPx || maxFontPx * 0.55;
  const [fontPx, setFontPx] = useState(maxFontPx);

  useLayoutEffect(() => {
    setFontPx(maxFontPx);
  }, [text, maxFontPx]);

  useEffect(() => {
    const box = boxRef.current;
    const span = spanRef.current;
    if (!box || !span) return;
    let size = maxFontPx;
    span.style.fontSize = `${size}px`;
    let guard = 0;
    while (span.scrollWidth > box.clientWidth && size > min && guard < 60) {
      size -= 0.5;
      span.style.fontSize = `${size}px`;
      guard += 1;
    }
    setFontPx(size);
  }, [text, maxFontPx, min]);

  if (!text) return null;

  return (
    <div
      ref={boxRef}
      style={{
        position: "absolute",
        top: `${top}%`,
        left: `${left}%`,
        right: `${right}%`,
        display: "flex",
        justifyContent: align === "center" ? "center" : "flex-start",
        alignItems: "center",
        overflow: "hidden",
        transform: "translateY(-100%)",
      }}
    >
      <span
        ref={spanRef}
        style={{
          whiteSpace: "nowrap",
          fontSize: fontPx,
          fontWeight: 600,
          color: "#111111",
          lineHeight: 1,
        }}
      >
        {text}
      </span>
    </div>
  );
}