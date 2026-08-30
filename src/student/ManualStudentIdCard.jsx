// src/student/ManualStudentIdCard.jsx
// Renders a MANUALLY-created Student ID card (front + back) using the exact
// printed template design as the background, with the teacher-entered data
// (name, grade, ID No, issue date, expire date) and uploaded photo overlaid
// on top at the correct positions.
//
// FIX (this pass): studentPhoto can now be a real Firebase Storage URL
// (fetched straight from the student's own `students/{id}` record), not
// only a base64 data URL from a manual upload. The front-photo <img> had
// crossOrigin="anonymous" hardcoded on it — harmless for base64 data URLs,
// but for a real cross-origin Storage URL it forces the browser into
// CORS mode, and since the Storage bucket doesn't send CORS headers for
// this origin, the request fails and the photo shows as broken. A plain
// <img> (no crossOrigin) displays a cross-origin URL fine without any
// CORS headers required — same as opening the URL directly in a tab — so
// the attribute is removed. (Only affects display; not related to the
// clip-path/positioning fixes below, which are untouched.)
//
// FIX (earlier pass): the QR overlay on the back had gone missing in a prior
// version of this file — restored below, alongside the grade/photo fixes
// from the previous pass. A real QR code linking to this card's own
// /verify/student/{studentId} page is drawn on top of the printed QR
// placeholder box on ID_Back.png, so scanning it opens THIS card instead of
// the general site.
//
// FIX (earlier pass):
//   1) The GRADE value ("8" etc.) was rendering much smaller than the word
//      "GRADE" printed on the template — maxFontPx for that field is now
//      bumped up to match the template's own letter size.
//   2) The student photo box was a plain rounded rectangle that only
//      approximated the shield/arch shape baked into ID_Front.png — on real
//      photos it visibly poked out past the green outline at the bottom
//      corners. The box position/size AND the clip-path below were
//      re-derived by measuring the actual green outline pixel-by-pixel in
//      ID_Front.png (inner edge of the stroke, so the photo sits just
//      inside the green line without covering it), so the photo now always
//      stays exactly inside the printed frame, top corners to bottom point.
//
// FIX (earlier pass): this file was pointing at src/student/assets/id-front.png
// and id-back.png, which are NOT the real printed template. The actual
// template artwork lives at src/admin/assets/ID_Front.png and ID_Back.png
// (RISING STAR PRIMARY & SECONDARY SCHOOL card).
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
// Used by admin/pages/AllIdCards.jsx for manually-created student cards, and
// by pages/StudentIdVerify.jsx for the public QR-scan verification page.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import idFront from "../admin/assets/ID_Front.png";
import idBack from "../admin/assets/ID_Back.png";

// The card keeps the template's real aspect ratio (851 x 1355 px source).
const CARD_W = 340; // on-screen width; height derived from the ratio
const RATIO = 1355 / 851;

// Label row centers, measured directly from the real ID_Front.png template
// (851x1355 source, as % of card height):
//   GRADE line ~63.1% · ID No ~74.6% · Issue Date line ~80.1% · Expire Date line ~86.9%
const POS = {
  name: 60.5,   // name baseline sits just above the GRADE line
  grade: 66.6, // nudged up slightly to align with the larger GRADE value font
  idNo: 74.6,
  issue: 80.1,  // Issue Date - top row (matches template)
  expire: 86.9, // Expire Date - bottom row (matches template)
};

// Student photo box — measured pixel-by-pixel from the green shield outline
// in ID_Front.png (inner edge of the stroke, so the photo never covers the
// green line). The shield has straight sides down to about 51% of its own
// height, then curves inward to a rounded point at the bottom — that's what
// PHOTO_CLIP traces, in percentages relative to this box (0,0 = top-left,
// 100,100 = bottom-right of the box below).
const PHOTO_BOX = { left: "29.6%", top: "27.2%", width: "44%", height: "30.5%" };
const PHOTO_CLIP =
  "polygon(0.0% 0.0%, 0.0% 1.9%, 0.0% 3.9%, 0.0% 5.8%, 0.0% 7.7%, 0.0% 9.7%, 0.0% 11.6%, 0.0% 13.5%, 0.0% 15.5%, 0.0% 17.4%, 0.0% 19.4%, 0.0% 21.3%, 0.0% 23.2%, 0.0% 25.2%, 0.0% 27.1%, 0.0% 29.0%, 0.0% 31.0%, 0.0% 32.9%, 0.0% 34.8%, 0.0% 36.8%, 0.0% 38.7%, 0.0% 40.6%, 0.0% 42.6%, 0.0% 44.5%, 0.0% 46.5%, 0.0% 48.4%, 0.0% 50.3%, 0.0% 52.3%, 0.0% 54.2%, 0.0% 56.1%, 0.0% 58.1%, 0.0% 60.0%, 0.0% 61.9%, 0.0% 63.9%, 0.0% 65.8%, 0.0% 67.7%, 0.0% 69.7%, 0.0% 71.6%, 0.0% 73.5%, 0.0% 75.5%, 0.0% 77.4%, 0.0% 79.4%, 0.0% 81.3%, 0.7% 83.2%, 1.4% 85.2%, 2.1% 87.1%, 3.2% 89.0%, 5.0% 91.0%, 6.8% 92.9%, 9.6% 94.8%, 13.2% 96.8%, 13.9% 98.7%, 19.6% 100.0%, 50.0% 100.0%, 80.4% 100.0%, 85.8% 98.7%, 86.5% 96.8%, 90.4% 94.8%, 92.9% 92.9%, 95.0% 91.0%, 96.4% 89.0%, 97.5% 87.1%, 98.6% 85.2%, 99.3% 83.2%, 99.6% 81.3%, 99.6% 79.4%, 100.0% 77.4%, 100.0% 75.5%, 100.0% 73.5%, 100.0% 71.6%, 100.0% 69.7%, 100.0% 67.7%, 100.0% 65.8%, 100.0% 63.9%, 100.0% 61.9%, 100.0% 60.0%, 100.0% 58.1%, 100.0% 56.1%, 100.0% 54.2%, 100.0% 52.3%, 100.0% 50.3%, 100.0% 48.4%, 100.0% 46.5%, 100.0% 44.5%, 100.0% 42.6%, 100.0% 40.6%, 100.0% 38.7%, 100.0% 36.8%, 100.0% 34.8%, 100.0% 32.9%, 100.0% 31.0%, 100.0% 29.0%, 100.0% 27.1%, 100.0% 25.2%, 100.0% 23.2%, 100.0% 21.3%, 100.0% 19.4%, 100.0% 17.4%, 100.0% 15.5%, 100.0% 13.5%, 100.0% 11.6%, 100.0% 9.7%, 100.0% 7.7%, 100.0% 5.8%, 100.0% 3.9%, 100.0% 1.9%, 100.0% 0.0%)";

// Verify-link QR code shown on the back — mirrors StudentIdCard.jsx's own
// /verify/student/{id} pattern so a manual card's QR resolves the same way.
const SCHOOL_WEBSITE = "resingstarschools.com";
function qrSrc(studentId) {
  const qrTarget = `https://${SCHOOL_WEBSITE}/verify/student/${encodeURIComponent(studentId)}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=0&data=${encodeURIComponent(qrTarget)}`;
}

// Position of the printed QR placeholder box on ID_Back.png, as % of the
// card (estimated from a screenshot of the template — send the raw
// src/admin/assets/ID_Back.png file to get this pixel-exact like the front
// photo/GRADE positions were).
const QR_BOX = { left: "33%", top: "70%", width: "36%", height: "20.7%" };

export default function ManualStudentIdCard({ card }) {
  const {
    fullName,
    studentId,
    grade,
    className,
    studentPhoto, // data URL (manual upload) OR a Firebase Storage URL (auto-fetched from students/{id})
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
        {/* Student photo — clipped to the exact shield outline printed on
            the template (straight sides, then a rounded point at the
            bottom), so it can never poke out past the green line. */}
        <div
          style={{
            position: "absolute",
            left: PHOTO_BOX.left,
            top: PHOTO_BOX.top,
            width: PHOTO_BOX.width,
            height: PHOTO_BOX.height,
            overflow: "hidden",
            clipPath: PHOTO_CLIP,
            WebkitClipPath: PHOTO_CLIP,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {studentPhoto ? (
            // No crossOrigin attribute here: studentPhoto can now be either
            // a base64 data URL (manual upload, no CORS involved) or a real
            // Firebase Storage URL fetched from the student's own record.
            // A plain <img> displays a cross-origin URL fine without CORS
            // headers; forcing crossOrigin="anonymous" only breaks display
            // when the Storage bucket doesn't send CORS headers for this
            // origin, which is exactly what was happening here.
            <img
              src={studentPhoto}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
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
          color="#111827"
          align="center"
        />

        {/* GRADE value — sits in the gap between the word "GRADE" (ends ~56.7%)
            and the right green dash, which ID_Front.png now has shifted
            further right (starts ~70.7%) to give multi-character grades
            like "F4" enough room without touching "GRADE". Font size now
            matches the template's own "GRADE" letter size (previously much
            smaller). */}
        <FitText
          text={gradeText}
          top={`${POS.grade}%`}
          left="57.1%"
          right="29.8%"
          maxFontPx={CARD_W * 0.08}
          minFontPx={CARD_W * 0.032}
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

      {/* BACK — template background unchanged, but the printed QR box is no
          longer just decorative artwork: a real QR code pointing at this
          card's own /verify/student/{studentId} page is overlaid directly
          on top of it (same link pattern StudentIdCard.jsx uses), so
          scanning it opens this exact card instead of the general site. */}
      <div
        style={{
          position: "relative",
          width: CARD_W,
          height: CARD_W * RATIO,
          backgroundImage: `url(${idBack})`,
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
          borderRadius: 10,
          boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        {studentId ? (
          <img
            src={qrSrc(studentId)}
            alt="Verify QR code"
            crossOrigin="anonymous"
            style={{
              position: "absolute",
              left: QR_BOX.left,
              top: QR_BOX.top,
              width: QR_BOX.width,
              height: QR_BOX.height,
              objectFit: "contain",
              background: "#fff",
            }}
          />
        ) : null}
      </div>
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