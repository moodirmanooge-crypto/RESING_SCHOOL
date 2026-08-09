// src/admin/components/CertificateCard.jsx
// Renders a Class Leaving Certificate using the EXACT printed template
// artwork (certificate-template.png) as the background, with the
// student's data overlaid on top at the correct positions.
//
// COORDINATES BELOW WERE RE-MEASURED DIRECTLY ON THE TEMPLATE IMAGE
// (3508 x 2481 px) using a percentage grid overlay, reading the exact
// pixel row of every printed underline and the exact pixel column
// where each blank begins/ends.
//
// Layout: LEFT half = Somali column, RIGHT half = English column.
// Both halves are mirrored horizontally at IDENTICAL row heights, so
// every Somali field and its English twin share the same `top`.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import certificateTemplate from "./assets/certificate-template.png";

const CARD_W = 900;
const RATIO = 2481 / 3508;

// Font sizes — per-field, tuned to match the real printed certificate's
// proportions (wider fields get smaller text so they never overflow).
const FONT = {
  name: 13,
  mother: 12.5,
  dob: 12,
  school: 10.5,
  year: 12.5,
  roll: 12.5,
  result: 12.5,
  issue: 11.5,

  subject: 9.5,
  marks: 9.5,
  number: 9,
};
const FONT_WEIGHT = 600;
const FONT_FAMILY = "Arial, Helvetica, sans-serif";

// Sawirka ardayga (photo box) — dhexda labada dhinac
const PHOTO_BOX = { left: 45.0, top: 33.5, width: 10.3, height: 16.5 };

// Goobaha qoraalada Soomaaliga (Somali Fields) — DHINACA BIDIX (left half)
// Qoraalku wuxuu ku dul dhacaa xariiqda (underline), ee kuma dul dhaco
// label-ka. `left` waa halka blank-ku ka bilaabmayo (label-ka ka dib).
const FIELD_SOMALI = {
  fullName: { top: 38.6, left: 18.0, right: 44.0 },
  motherName: { top: 41.7, left: 25.5, right: 44.0 },
  placeDob: { top: 44.7, left: 34.5, right: 44.0 },
  year: { top: 50.6, left: 21.5, right: 67.0 },
  rollNumber: { top: 50.6, left: 41.0, right: 44.0 },
  resultAverage: { top: 53.6, left: 34.5, right: 44.5 },
};

// Goobaha qoraalada Ingiriiska (English Fields) — DHINACA MIDIG (right half)
const FIELD = {
  fullName: { top: 38.6, left: 65.5, right: 7.5 },
  motherName: { top: 41.7, left: 72.5, right: 7.5 },
  placeDob: { top: 44.7, left: 75.5, right: 7.5 },
  year: { top: 50.6, left: 65.5, right: 24.5 },
  rollNumber: { top: 50.6, left: 84.0, right: 7.5 },
  resultAverage: { top: 53.6, left: 73.5, right: 11.0 },
};

// Miisaska Maadooyinka (Rows Y-axis) — top edge of each row's text line
const ROW_TOPS = [60.8, 63.2, 65.6, 68.0, 70.4, 72.8];

const TABLE_SOMALI_A = {
  subjectLeft: 17.8, subjectRight: 32.5,
  marksLeft: 34.3, marksRight: 39.8,
};
const TABLE_SOMALI_B = {
  subjectLeft: 44.3, subjectRight: 49.5,
  marksLeft: 51.0, marksRight: 55.0,
};

const TABLE_ENGLISH_A = {
  subjectLeft: 60.0, subjectRight: 73.5,
  marksLeft: 75.0, marksRight: 80.5,
};
const TABLE_ENGLISH_B = {
  subjectLeft: 84.0, subjectRight: 89.5,
  marksLeft: 91.0, marksRight: 95.5,
};

// Taariikhda la bixiyay (Date of Issue) — printed as three short slots
// ( __ / __ / __ ) rather than one long blank, on both sides.
const ISSUE_DATE_SOMALI = { top: 78.6, left: 25.0, right: 44.0 };
const ISSUE_DATE = { top: 78.6, left: 71.5, right: 7.5 };

export default function CertificateCard({ certificate, verifyUrl, elementId }) {
  const {
    fullName,
    motherName,
    placeOfBirth,
    dateOfBirth,
    year,
    rollNumber,
    resultAverage,
    subjects = [],
    studentPhoto,
    issueDate,
  } = certificate || {};

  const placeDobText = [placeOfBirth, dateOfBirth].filter(Boolean).join(" - ");
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
        fontFamily: FONT_FAMILY,
        flexShrink: 0,
      }}
    >
      {/* Student photo — centered inside the dashed photo box */}
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

      {/* Somali column (left half) */}
      <FitText text={fullName} {...FIELD_SOMALI.fullName} maxFontPx={FONT.name} />
      <FitText text={motherName} {...FIELD_SOMALI.motherName} maxFontPx={FONT.mother} />
      <FitText text={placeDobText} {...FIELD_SOMALI.placeDob} maxFontPx={FONT.dob} />
      <FitText text={year} {...FIELD_SOMALI.year} maxFontPx={FONT.year} />
      <FitText text={rollNumber} {...FIELD_SOMALI.rollNumber} maxFontPx={FONT.roll} />
      <FitText
        text={resultAverage !== "" && resultAverage != null ? `${resultAverage}%` : ""}
        {...FIELD_SOMALI.resultAverage}
        maxFontPx={FONT.result}
      />
      <FitText text={issueDate} {...ISSUE_DATE_SOMALI} maxFontPx={FONT.issue} />

      {/* English column (right half) */}
      <FitText text={fullName} {...FIELD.fullName} maxFontPx={FONT.name} />
      <FitText text={motherName} {...FIELD.motherName} maxFontPx={FONT.mother} />
      <FitText text={placeDobText} {...FIELD.placeDob} maxFontPx={FONT.dob} />
      <FitText text={year} {...FIELD.year} maxFontPx={FONT.year} />
      <FitText text={rollNumber} {...FIELD.rollNumber} maxFontPx={FONT.roll} />
      <FitText
        text={resultAverage !== "" && resultAverage != null ? `${resultAverage}%` : ""}
        {...FIELD.resultAverage}
        maxFontPx={FONT.result}
      />
      <FitText text={issueDate} {...ISSUE_DATE} maxFontPx={FONT.issue} />

      {/* Subjects - Somali A (left table, cols 1-6) */}
      {firstSix.map((s, i) => (
        <div key={`so-a-${i}`}>
          <FitText text={s?.name} top={ROW_TOPS[i]} left={TABLE_SOMALI_A.subjectLeft} right={100 - TABLE_SOMALI_A.subjectRight} maxFontPx={FONT.subject} align="left" />
          <FitText text={s?.marks} top={ROW_TOPS[i]} left={TABLE_SOMALI_A.marksLeft} right={100 - TABLE_SOMALI_A.marksRight} maxFontPx={FONT.marks} align="center" />
        </div>
      ))}

      {/* Subjects - Somali B (left table, cols 7-12) */}
      {lastSix.map((s, i) => (
        <div key={`so-b-${i}`}>
          <FitText text={s?.name} top={ROW_TOPS[i]} left={TABLE_SOMALI_B.subjectLeft} right={100 - TABLE_SOMALI_B.subjectRight} maxFontPx={FONT.subject} align="left" />
          <FitText text={s?.marks} top={ROW_TOPS[i]} left={TABLE_SOMALI_B.marksLeft} right={100 - TABLE_SOMALI_B.marksRight} maxFontPx={FONT.marks} align="center" />
        </div>
      ))}

      {/* Subjects - English A (right table, cols 1-6) */}
      {firstSix.map((s, i) => (
        <div key={`en-a-${i}`}>
          <FitText text={s?.name} top={ROW_TOPS[i]} left={TABLE_ENGLISH_A.subjectLeft} right={100 - TABLE_ENGLISH_A.subjectRight} maxFontPx={FONT.subject} align="left" />
          <FitText text={s?.marks} top={ROW_TOPS[i]} left={TABLE_ENGLISH_A.marksLeft} right={100 - TABLE_ENGLISH_A.marksRight} maxFontPx={FONT.marks} align="center" />
        </div>
      ))}

      {/* Subjects - English B (right table, cols 7-12) */}
      {lastSix.map((s, i) => (
        <div key={`en-b-${i}`}>
          <FitText text={s?.name} top={ROW_TOPS[i]} left={TABLE_ENGLISH_B.subjectLeft} right={100 - TABLE_ENGLISH_B.subjectRight} maxFontPx={FONT.subject} align="left" />
          <FitText text={s?.marks} top={ROW_TOPS[i]} left={TABLE_ENGLISH_B.marksLeft} right={100 - TABLE_ENGLISH_B.marksRight} maxFontPx={FONT.marks} align="center" />
        </div>
      ))}

      {/* QR code */}
      {qrSrc && (
        <div
          style={{
            position: "absolute",
            right: "2.5%",
            bottom: "3.5%",
            width: "6.5%",
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

// FitText: dul dhigaya qoraalka xariiqda (underline) sawirka, isaga oo
// automatic-ka u yareeya font-size-ka haddii qoraalku aad u dheer yahay
// si aanu uga baxsan goobtiisa.
function FitText({ text, top, left, right, maxFontPx, minFontPx, align = "left" }) {
  const boxRef = useRef(null);
  const spanRef = useRef(null);
  const min = minFontPx || maxFontPx * 0.5;
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
        top: `${top - 2.5}%`,
        height: "2.8%",
        left: `${left}%`,
        right: `${right}%`,
        display: "flex",
        justifyContent: align === "center" ? "center" : "flex-start",
        alignItems: "flex-end",
        overflow: "hidden",
      }}
    >
      <span
        ref={spanRef}
        style={{
          whiteSpace: "nowrap",
          fontSize: fontPx,
          fontFamily: FONT_FAMILY,
          fontWeight: FONT_WEIGHT,
          letterSpacing: "0px",
          color: "#111111",
          lineHeight: 1,
          transform: "translateY(-0.5px)",
        }}
      >
        {text}
      </span>
    </div>
  );
}