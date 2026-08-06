// src/admin/components/CertificateCard.jsx
// Renders a Class Leaving Certificate using the EXACT printed template
// artwork (certificate-template.png) as the background, with the
// student's data overlaid on top at the correct positions.
//
// IMPORTANT LAYOUT NOTE (fixed in this version):
// On the real template the LEFT half of the card is the Somali column
// ("Magaca Hooyada", "Goobta & Taariikhda Dhalashada", ...) and the RIGHT
// half is the English column ("Mother's name", "Place & Date of birth",
// ...). Earlier versions of this file mistakenly mirrored the Somali
// fields onto the English (right) side, which is why values landed on
// top of the English labels. All `left`/`right` values below were
// re-measured directly on the template image (pixel scan of the
// underline rows) so each value now sits on its own column's own line.
//
// Every `top` value = the y-position of the printed underline for that
// row (same for both columns, since the two halves are mirrored
// horizontally at identical heights). Values are anchored so the text
// baseline sits just above that underline.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import certificateTemplate from "./assets/certificate-template.png";

const CARD_W = 900;
const RATIO = 2481 / 3508;

// Meesha sawirka ardayga uu galayo (photo box) — dhexda labada dhinac
const PHOTO_BOX = { left: 45.2, top: 33.4, width: 9.6, height: 15.4 };

// Goobaha qoraalada Soomaaliga (Somali Fields) — DHINACA BIDIX (left half)
const FIELD_SOMALI = {
  fullName: { top: 37.9, left: 11.0, right: 56.0 },
  motherName: { top: 41.0, left: 19.5, right: 56.0 },
  placeDob: { top: 44.1, left: 27.5, right: 56.0 },
  completedSchool: { top: 47.2, left: 34.0, right: 56.0 },
  year: { top: 50.3, left: 13.0, right: 80.0 },
  rollNumber: { top: 50.3, left: 37.5, right: 56.0 },
  resultAverage: { top: 53.4, left: 29.0, right: 56.0 },
};

// Goobaha qoraalada Ingiriiska (English Fields) — DHINACA MIDIG (right half)
const FIELD = {
  fullName: { top: 37.9, left: 64.5, right: 3.0 },
  motherName: { top: 41.0, left: 64.5, right: 3.0 },
  placeDob: { top: 44.1, left: 69.0, right: 3.0 },
  completedSchool: { top: 47.2, left: 72.0, right: 3.0 },
  year: { top: 50.3, left: 59.5, right: 29.0 },
  rollNumber: { top: 50.3, left: 79.5, right: 3.0 },
  resultAverage: { top: 53.4, left: 67.5, right: 3.0 },
};

// Miisaska Maadooyinka (Rows Y-axis)
const ROW_TOPS = [60.5, 62.7, 64.9, 67.1, 69.3, 71.5];

const TABLE_SOMALI_A = {
  subjectLeft: 12.0, subjectRight: 23.5,
  marksLeft: 23.8, marksRight: 28.5,
};
const TABLE_SOMALI_B = {
  subjectLeft: 30.2, subjectRight: 41.5,
  marksLeft: 41.8, marksRight: 46.5,
};

const TABLE_ENGLISH_A = {
  subjectLeft: 59.5, subjectRight: 71.2,
  marksLeft: 71.5, marksRight: 76.5,
};
const TABLE_ENGLISH_B = {
  subjectLeft: 77.8, subjectRight: 89.5,
  marksLeft: 89.8, marksRight: 94.8,
};

// Taariikhda la bixiyay (Date of Issue) — labada dhinac
const ISSUE_DATE_SOMALI = { top: 83.3, left: 20.5, right: 56.0 };
const ISSUE_DATE = { top: 83.3, left: 70.0, right: 3.0 };

export default function CertificateCard({ certificate, verifyUrl, elementId }) {
  const {
    fullName,
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
        fontFamily: "'Inter','Segoe UI',sans-serif",
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
      <FitText text={fullName} {...FIELD_SOMALI.fullName} maxFontPx={CARD_W * 0.015} />
      <FitText text={motherName} {...FIELD_SOMALI.motherName} maxFontPx={CARD_W * 0.015} />
      <FitText text={placeDobText} {...FIELD_SOMALI.placeDob} maxFontPx={CARD_W * 0.015} />
      <FitText text={completedSchool} {...FIELD_SOMALI.completedSchool} maxFontPx={CARD_W * 0.015} />
      <FitText text={year} {...FIELD_SOMALI.year} maxFontPx={CARD_W * 0.015} />
      <FitText text={rollNumber} {...FIELD_SOMALI.rollNumber} maxFontPx={CARD_W * 0.015} />
      <FitText
        text={resultAverage !== "" && resultAverage != null ? `${resultAverage}%` : ""}
        {...FIELD_SOMALI.resultAverage}
        maxFontPx={CARD_W * 0.015}
      />
      <FitText text={issueDate} {...ISSUE_DATE_SOMALI} maxFontPx={CARD_W * 0.015} />

      {/* English column (right half) */}
      <FitText text={fullName} {...FIELD.fullName} maxFontPx={CARD_W * 0.015} />
      <FitText text={motherName} {...FIELD.motherName} maxFontPx={CARD_W * 0.015} />
      <FitText text={placeDobText} {...FIELD.placeDob} maxFontPx={CARD_W * 0.015} />
      <FitText text={completedSchool} {...FIELD.completedSchool} maxFontPx={CARD_W * 0.015} />
      <FitText text={year} {...FIELD.year} maxFontPx={CARD_W * 0.015} />
      <FitText text={rollNumber} {...FIELD.rollNumber} maxFontPx={CARD_W * 0.015} />
      <FitText
        text={resultAverage !== "" && resultAverage != null ? `${resultAverage}%` : ""}
        {...FIELD.resultAverage}
        maxFontPx={CARD_W * 0.015}
      />
      <FitText text={issueDate} {...ISSUE_DATE} maxFontPx={CARD_W * 0.015} />

      {/* Subjects - Somali A (left table, cols 1-6) */}
      {firstSix.map((s, i) => (
        <div key={`so-a-${i}`}>
          <FitText text={s?.name} top={ROW_TOPS[i]} left={TABLE_SOMALI_A.subjectLeft} right={100 - TABLE_SOMALI_A.subjectRight} maxFontPx={CARD_W * 0.012} align="left" />
          <FitText text={s?.marks} top={ROW_TOPS[i]} left={TABLE_SOMALI_A.marksLeft} right={100 - TABLE_SOMALI_A.marksRight} maxFontPx={CARD_W * 0.012} align="center" />
        </div>
      ))}

      {/* Subjects - Somali B (left table, cols 7-12) */}
      {lastSix.map((s, i) => (
        <div key={`so-b-${i}`}>
          <FitText text={s?.name} top={ROW_TOPS[i]} left={TABLE_SOMALI_B.subjectLeft} right={100 - TABLE_SOMALI_B.subjectRight} maxFontPx={CARD_W * 0.012} align="left" />
          <FitText text={s?.marks} top={ROW_TOPS[i]} left={TABLE_SOMALI_B.marksLeft} right={100 - TABLE_SOMALI_B.marksRight} maxFontPx={CARD_W * 0.012} align="center" />
        </div>
      ))}

      {/* Subjects - English A (right table, cols 1-6) */}
      {firstSix.map((s, i) => (
        <div key={`en-a-${i}`}>
          <FitText text={s?.name} top={ROW_TOPS[i]} left={TABLE_ENGLISH_A.subjectLeft} right={100 - TABLE_ENGLISH_A.subjectRight} maxFontPx={CARD_W * 0.012} align="left" />
          <FitText text={s?.marks} top={ROW_TOPS[i]} left={TABLE_ENGLISH_A.marksLeft} right={100 - TABLE_ENGLISH_A.marksRight} maxFontPx={CARD_W * 0.012} align="center" />
        </div>
      ))}

      {/* Subjects - English B (right table, cols 7-12) */}
      {lastSix.map((s, i) => (
        <div key={`en-b-${i}`}>
          <FitText text={s?.name} top={ROW_TOPS[i]} left={TABLE_ENGLISH_B.subjectLeft} right={100 - TABLE_ENGLISH_B.subjectRight} maxFontPx={CARD_W * 0.012} align="left" />
          <FitText text={s?.marks} top={ROW_TOPS[i]} left={TABLE_ENGLISH_B.marksLeft} right={100 - TABLE_ENGLISH_B.marksRight} maxFontPx={CARD_W * 0.012} align="center" />
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
        // Box-ka waxaa lagu dhejiyaa si uu qoraalku ku dhammaado xariiqda
        // (`top`) dushiisa — box-ku wuxuu bilaabmaa 2.2% ka sarreeya
        // xariiqda, si qoraalka fontka ah uu si sax ah ugu dul dhigmo.
        top: `${top - 2.2}%`,
        height: "2.2%",
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
          fontWeight: 600,
          color: "#111111",
          lineHeight: 1,
          transform: "translateY(-1px)",
        }}
      >
        {text}
      </span>
    </div>
  );
}