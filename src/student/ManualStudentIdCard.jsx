// src/student/ManualStudentIdCard.jsx
// Renders a MANUALLY-created Student ID card (front + back) using the exact
// printed template design as the background, with the teacher-entered data
// (name, grade, ID No, issue date, expire date) and uploaded photo overlaid
// on top at the correct positions.
//
// The template artwork itself is never redrawn here — the two PNGs below ARE
// the design (front is the blank template, back is unchanged). Only the data
// is positioned over the front. All positions are percentages of the card, so
// the card scales cleanly for on-screen preview, download (html2canvas), and
// print without the overlay drifting.
//
// The full name auto-shrinks to fit on its single line, so long names like
// "GUULEED IBRAAHIM DAAHIR" are shown in full instead of being clipped.
//
// Used by admin/pages/AllIdCards.jsx for manually-created student cards.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import idFront from "./assets/id-front.png";
import idBack from "./assets/id-back.png";

// The card keeps the template's real aspect ratio (851 x 1355 px source).
const CARD_W = 340; // on-screen width; height derived from the ratio
const RATIO = 1355 / 851;

// Label row centers, measured directly from the real id-front.png template
// (851x1355 source, as % of card height):
//   GRADE line ~63.1% · ID No ~74.6% · Issue Date line ~80.1% · Expire Date line ~86.9%
const POS = {
  name: 60.5,   // name baseline sits just above the GRADE line
  grade: 67.7,
  idNo: 74.6,
  issue: 80.1,  // Issue Date - top row (matches template)
  expire: 86.9, // Expire Date - bottom row (matches template)
};

export default function ManualStudentIdCard({ card }) {
  const {
    fullName,
    studentId,
    grade,
    className,
    studentPhoto, // data URL (base64) uploaded by the teacher
    issueDate,
    expireDate,
  } = card || {};

  const gradeText = grade || className || "";

  return (
    <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
      {/* FRONT */}
      <div
        style={{
          position: "relative",
          width: CARD_W,
          height: CARD_W * RATIO,
          backgroundImage: `url(${idFront})`,
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
          borderRadius: 10,
          overflow: "hidden",
          boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
          fontFamily: "'Inter','Segoe UI',sans-serif",
          flexShrink: 0,
        }}
      >
        {/* Student photo — sits inside the green notch box.
            Box interior ≈ x 26%..75%, y 26.6%..57.8% of the card. */}
        <div
          style={{
            position: "absolute",
            left: "26%",
            top: "26.6%",
            width: "49%",
            height: "31.2%",
            overflow: "hidden",
            borderBottomLeftRadius: "40% 20%",
            borderBottomRightRadius: "40% 20%",
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

        {/* Name — centered, auto-shrinks to fit its line. */}
        <FitText
          text={fullName || ""}
          top={`${POS.name}%`}
          left="6%"
          right="6%"
          maxFontPx={CARD_W * 0.066}
          minFontPx={CARD_W * 0.03}
          bold
          color="#111827"
          align="center"
        />

        {/* GRADE value — sits in the gap between the word "GRADE" (ends ~56.6%)
            and the right green dash (starts ~64.3%). */}
        <FitText
          text={gradeText}
          top={`${POS.grade}%`}
          left="57.5%"
          right="35.2%"
          maxFontPx={CARD_W * 0.05}
          minFontPx={CARD_W * 0.028}
          bold
          color="#1e2a78"
          align="center"
        />

        {/* ID No value — on the "ID No:#" line. */}
        <FitText
          text={studentId || ""}
          top={`${POS.idNo}%`}
          left="45%"
          right="7%"
          maxFontPx={CARD_W * 0.05}
          minFontPx={CARD_W * 0.03}
          color="#111827"
          align="left"
        />

        {/* Issue Date value — top row (matches template). */}
        <FitText
          text={issueDate || ""}
          top={`${POS.issue}%`}
          left="45%"
          right="7%"
          maxFontPx={CARD_W * 0.05}
          minFontPx={CARD_W * 0.03}
          color="#111827"
          align="left"
        />

        {/* Expire Date value — bottom row (matches template). */}
        <FitText
          text={expireDate || ""}
          top={`${POS.expire}%`}
          left="45%"
          right="7%"
          maxFontPx={CARD_W * 0.05}
          minFontPx={CARD_W * 0.03}
          color="#111827"
          align="left"
        />
      </div>

      {/* BACK (unchanged template) */}
      <div
        style={{
          width: CARD_W,
          height: CARD_W * RATIO,
          backgroundImage: `url(${idBack})`,
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
          borderRadius: 10,
          boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
          flexShrink: 0,
        }}
      />
    </div>
  );
}

// A single-line text overlay that shrinks its font size until the text fits
// within its box, so long values are shown in full (never clipped). Sits
// absolutely-positioned over the card background.
function FitText({ text, top, left, right, maxFontPx, minFontPx, bold, color, align }) {
  const boxRef = useRef(null);
  const spanRef = useRef(null);
  const [fontPx, setFontPx] = useState(maxFontPx);

  useLayoutEffect(() => {
    setFontPx(maxFontPx); // reset before measuring for the new text
  }, [text, maxFontPx]);

  useEffect(() => {
    const box = boxRef.current;
    const span = spanRef.current;
    if (!box || !span) return;
    let size = maxFontPx;
    span.style.fontSize = `${size}px`;
    // Shrink until the text fits the available width (or we hit the minimum).
    let guard = 0;
    while (span.scrollWidth > box.clientWidth && size > minFontPx && guard < 60) {
      size -= 0.5;
      span.style.fontSize = `${size}px`;
      guard += 1;
    }
    setFontPx(size);
  }, [text, maxFontPx, minFontPx]);

  return (
    <div
      ref={boxRef}
      style={{
        position: "absolute",
        top,
        left,
        right,
        display: "flex",
        justifyContent: align === "center" ? "center" : "flex-start",
        alignItems: "center",
        overflow: "hidden",
        transform: "translateY(-50%)",
      }}
    >
      <span
        ref={spanRef}
        style={{
          whiteSpace: "nowrap",
          fontSize: fontPx,
          fontWeight: bold ? 800 : 600,
          color,
          lineHeight: 1,
        }}
      >
        {text}
      </span>
    </div>
  );
}