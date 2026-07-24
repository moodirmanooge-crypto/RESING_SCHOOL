// src/admin/components/CertificateCard.jsx
// Renders the official "Class 8 Leaving Certificate" design (matching the
// printed reference) from a certificate data object. Shared by:
//   - admin/pages/Certificates.jsx (preview + snapshot for download)
//   - student/Dashboard.jsx (Certificate tab)
//   - pages/VerifyCertificate.jsx (public verification page)
//
// NOTE: `qrcode` npm package is used to render the QR code as an actual
// scannable image (not a placeholder), pointing at the public verify URL.
import { useEffect, useRef } from "react";
import certificateLogo from "../assets/certificate-logo.png";

const GOLD = "#b8860b";
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
          width: 96,
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
    admissionNo,
    academicYear,
    gradeObtained,
    studentPhoto,
    schoolName,
    className,
  } = certificate;

  return (
    <div
      id={elementId}
      style={{
        width: 1000,
        maxWidth: "100%",
        aspectRatio: "1000 / 707",
        background: "#fdfdfb",
        borderRadius: 6,
        padding: "40px 60px",
        position: "relative",
        fontFamily: "'Georgia','Times New Roman',serif",
        color: "#111827",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {/* Corner ribbon flourishes matching the reference design */}
      <CornerRibbon corner="tl" />
      <CornerRibbon corner="tr" />
      <CornerRibbon corner="bl" />
      <CornerRibbon corner="br" />

      {/* Thin gold inner frame */}
      <div
        style={{
          position: "absolute",
          top: 18,
          left: 18,
          right: 18,
          bottom: 18,
          border: `2px solid ${GOLD}`,
          pointerEvents: "none",
          borderRadius: 3,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 22,
          left: 22,
          right: 22,
          bottom: 22,
          border: `1px solid ${DARK_GREEN}`,
          pointerEvents: "none",
          borderRadius: 2,
        }}
      />

      {/* Header: crest logo left, school name center, ribbon badge right */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          position: "relative",
          zIndex: 2,
        }}
      >
        <img
          src={certificateLogo}
          alt=""
          style={{ width: 110, height: 110, objectFit: "contain", flexShrink: 0 }}
        />

        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontSize: 40, fontWeight: 800, color: DARK_GREEN, letterSpacing: 2, lineHeight: 1.05 }}>
            RISING STAR
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: DARK_GREEN, letterSpacing: 1, marginTop: 4 }}>
            {(schoolName || "PRIMARY & SECONDARY SCHOOL").toUpperCase()}
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: DARK_GREEN, marginTop: 3, fontFamily: "serif" }}>
            مدرسة ريسن ستار الإبتدائية والثانوية
          </div>
        </div>

        <RibbonBadge />
      </div>

      <div
        style={{
          textAlign: "center",
          fontSize: 13,
          fontWeight: 700,
          color: GOLD,
          letterSpacing: 2,
          margin: "8px 0 8px",
        }}
      >
        ✦✦ Since 2023 ✦✦
      </div>

      <div
        style={{
          textAlign: "center",
          fontSize: 28,
          fontWeight: 800,
          color: DARK_GREEN,
          letterSpacing: 1,
          margin: "4px 0 2px",
        }}
      >
        ❧ CLASS {className || "8"} LEAVING CERTIFICATE ❧
      </div>
      <div style={{ textAlign: "center", fontStyle: "italic", fontSize: 16, color: "#374151", marginBottom: 18 }}>
        This is to certify that
      </div>

      <div style={{ display: "flex", gap: 34, alignItems: "flex-start" }}>
        <div
          style={{
            width: 132,
            height: 154,
            border: `2px solid ${GOLD}`,
            borderRadius: 4,
            overflow: "hidden",
            flexShrink: 0,
            background: "#e9ebee",
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
            />
          ) : (
            <PersonSilhouette />
          )}
        </div>

        <div style={{ flex: 1, fontSize: 15.5, lineHeight: 2.25, paddingTop: 4 }}>
          <CertLine label="Student Name" value={fullName} />
          <CertLine label="Mother's Name" value={motherName} />
          <CertLine label="Admission No" value={admissionNo} />
          <CertLine label="Academic Year" value={academicYear} />
          <CertLine label="Grade Obtained" value={gradeObtained} />
        </div>
      </div>

      <div style={{ marginTop: 20, fontSize: 14.5, lineHeight: 1.6, color: "#1f2937", textAlign: "center" }}>
        has successfully completed the Class {className || "8"} course of study at{" "}
        <strong style={{ color: DARK_GREEN }}>{schoolName || "Rising Star Primary & Secondary School"}</strong>.
        <br />
        We wish the student all the best in his/her future.
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginTop: 30,
          paddingLeft: 6,
          paddingRight: 6,
        }}
      >
        <div style={{ textAlign: "center", width: 190 }}>
          <SignatureScribble />
          <div style={{ borderBottom: "1.5px solid #374151", marginTop: -6 }} />
          <div style={{ fontSize: 12.5, marginTop: 4, fontWeight: 600, color: DARK_GREEN }}>Deputy Principal</div>
        </div>

        <div ref={qrRef} style={{ width: 86, height: 86, flexShrink: 0 }} />

        <div style={{ textAlign: "center", width: 190 }}>
          <SignatureScribble flip />
          <div style={{ borderBottom: "1.5px solid #374151", marginTop: -6 }} />
          <div style={{ fontSize: 12.5, marginTop: 4, fontWeight: 600, color: DARK_GREEN }}>Principal</div>
          <div style={{ fontSize: 10, color: "#6B7280" }}>
            {schoolName || "Rising Star Primary & Secondary School"}
          </div>
        </div>
      </div>

      <div
        style={{
          textAlign: "center",
          marginTop: 18,
          background: DARK_GREEN,
          color: "#fff",
          padding: "7px 0",
          fontSize: 12.5,
          fontWeight: 700,
          letterSpacing: 1.5,
          borderRadius: 3,
          position: "relative",
          zIndex: 2,
        }}
      >
        • EDUCATION IS LIFE IT SELF •
      </div>
    </div>
  );
}

// Underline-style field, matching the printed certificate's
// "Label: ______________" layout instead of a boxed/dotted row.
function CertLine({ label, value }) {
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

function PersonSilhouette() {
  return (
    <svg viewBox="0 0 100 120" width="70%" height="70%">
      <circle cx="50" cy="38" r="26" fill="#c7cbd1" />
      <path d="M10 118 C10 82 90 82 90 118 Z" fill="#c7cbd1" />
    </svg>
  );
}

function RibbonBadge() {
  return (
    <div style={{ width: 92, height: 108, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg viewBox="0 0 100 130" width="100%" height="100%">
        <polygon points="35,58 15,124 50,104 85,124 65,58" fill={GOLD} opacity="0.92" />
        <circle cx="50" cy="42" r="38" fill={GOLD} stroke="#8a6407" strokeWidth="2" />
        <circle cx="50" cy="42" r="30" fill="#fff" />
        <text x="50" y="35" textAnchor="middle" fontSize="9" fontWeight="700" fill={GOLD} fontFamily="Georgia, serif">
          SINCE
        </text>
        <text x="50" y="52" textAnchor="middle" fontSize="13" fontWeight="800" fill={GOLD} fontFamily="Georgia, serif">
          2023
        </text>
      </svg>
    </div>
  );
}

function SignatureScribble({ flip }) {
  return (
    <svg
      viewBox="0 0 190 46"
      width="100%"
      height="42"
      style={{ transform: flip ? "scaleX(-1)" : "none" }}
    >
      <path
        d="M8 34 C 22 10, 34 40, 48 18 S 70 8, 82 26 S 108 6, 122 22 S 150 34, 168 14"
        fill="none"
        stroke="#1d3b8f"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Decorative gold-and-green ribbon flourish drawn at each corner of the
// certificate, matching the diagonal ribbon border in the reference design.
function CornerRibbon({ corner }) {
  const positions = {
    tl: { top: -6, left: -6, transform: "none" },
    tr: { top: -6, right: -6, transform: "scaleX(-1)" },
    bl: { bottom: -6, left: -6, transform: "scaleY(-1)" },
    br: { bottom: -6, right: -6, transform: "scale(-1,-1)" },
  };
  const pos = positions[corner];

  return (
    <svg
      viewBox="0 0 140 140"
      width="130"
      height="130"
      style={{ position: "absolute", ...pos, zIndex: 1, pointerEvents: "none" }}
    >
      <path
        d="M0 40 C 30 40, 40 30, 40 0 L 60 0 C 60 45, 45 60, 0 60 Z"
        fill={DARK_GREEN}
      />
      <path
        d="M0 55 C 35 55, 55 35, 55 0 L 68 0 C 68 50, 50 68, 0 68 Z"
        fill="none"
        stroke={GOLD}
        strokeWidth="4"
      />
      <path
        d="M0 75 C 45 75, 75 45, 75 0 L 84 0 C 84 65, 65 84, 0 84 Z"
        fill="none"
        stroke={GOLD}
        strokeWidth="3"
      />
    </svg>
  );
}

// Loads a QR-rendering library from a CDN on demand and normalizes it to a
// simple async `renderTo(container, text)` function, so the caller doesn't
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