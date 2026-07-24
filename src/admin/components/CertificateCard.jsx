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
        border: `3px solid ${GOLD}`,
        outline: `10px solid ${DARK_GREEN}`,
        outlineOffset: "-3px",
        borderRadius: 4,
        padding: "34px 56px",
        position: "relative",
        fontFamily: "'Georgia','Times New Roman',serif",
        color: "#111827",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {/* Header: crest logo left, school name center, ribbon badge right */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <img
          src={certificateLogo}
          alt=""
          style={{ width: 108, height: 108, objectFit: "contain", flexShrink: 0 }}
        />

        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontSize: 40, fontWeight: 800, color: DARK_GREEN, letterSpacing: 2, lineHeight: 1 }}>
            RISING STAR
          </div>
          <div style={{ fontSize: 15.5, fontWeight: 700, color: DARK_GREEN, letterSpacing: 1, marginTop: 4 }}>
            {(schoolName || "PRIMARY & SECONDARY SCHOOL").toUpperCase()}
          </div>
        </div>

        <div
          style={{
            width: 84,
            height: 100,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <RibbonBadge />
        </div>
      </div>

      <div
        style={{
          textAlign: "center",
          fontSize: 12.5,
          fontWeight: 700,
          color: GOLD,
          letterSpacing: 2,
          margin: "2px 0 10px",
        }}
      >
        ✦✦ Since 2023 ✦✦
      </div>

      <div
        style={{
          textAlign: "center",
          fontSize: 27,
          fontWeight: 800,
          color: DARK_GREEN,
          letterSpacing: 1,
          margin: "6px 0 4px",
        }}
      >
        ❧ CLASS {className || "8"} LEAVING CERTIFICATE ❧
      </div>
      <div style={{ textAlign: "center", fontStyle: "italic", fontSize: 16, color: "#374151", marginBottom: 20 }}>
        This is to certify that
      </div>

      <div style={{ display: "flex", gap: 34, alignItems: "flex-start" }}>
        <div
          style={{
            width: 130,
            height: 150,
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

        <div style={{ flex: 1, fontSize: 15.5, lineHeight: 2.3, paddingTop: 4 }}>
          <CertLine label="Student Name" value={fullName} />
          <CertLine label="Mother's Name" value={motherName} />
          <CertLine label="Admission No." value={admissionNo} />
          <CertLine label="Academic Year" value={academicYear} />
          <CertLine label="Grade Obtained" value={gradeObtained} />
        </div>
      </div>

      <div style={{ marginTop: 22, fontSize: 14.5, lineHeight: 1.7, color: "#1f2937", textAlign: "center" }}>
        has successfully completed the Class {className || "8"} course of study at{" "}
        <strong>{schoolName || "Rising Star Primary & Secondary School"}</strong>.
        <br />
        We wish the student all the best in his/her future.
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginTop: 34,
        }}
      >
        <div style={{ textAlign: "center", width: 190 }}>
          <SignatureScribble />
          <div style={{ borderBottom: "1.5px solid #374151", marginTop: -6 }} />
          <div style={{ fontSize: 12.5, marginTop: 4, fontWeight: 600 }}>Deputy Principal</div>
        </div>

        <div ref={qrRef} style={{ width: 90, height: 90, flexShrink: 0 }} />

        <div style={{ textAlign: "center", width: 190 }}>
          <SignatureScribble flip />
          <div style={{ borderBottom: "1.5px solid #374151", marginTop: -6 }} />
          <div style={{ fontSize: 12.5, marginTop: 4, fontWeight: 600 }}>Principal</div>
          <div style={{ fontSize: 10, color: "#6B7280" }}>
            {schoolName || "Rising Star Primary & Secondary School"}
          </div>
        </div>
      </div>

      <div
        style={{
          textAlign: "center",
          marginTop: 20,
          background: DARK_GREEN,
          color: "#fff",
          padding: "7px 0",
          fontSize: 12.5,
          fontWeight: 700,
          letterSpacing: 1.5,
          borderRadius: 3,
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

// Simple placeholder silhouette shown when no student photo is available,
// matching the grey "generic person" icon used on the printed template.
function PersonSilhouette() {
  return (
    <svg viewBox="0 0 100 120" width="70%" height="70%">
      <circle cx="50" cy="38" r="26" fill="#c7cbd1" />
      <path d="M10 118 C10 82 90 82 90 118 Z" fill="#c7cbd1" />
    </svg>
  );
}

// Decorative gold ribbon/medal badge used in place of the plain circle,
// to match the printed "SINCE 2023" ribbon graphic.
function RibbonBadge() {
  return (
    <svg viewBox="0 0 100 130" width="100%" height="100%">
      <polygon points="35,60 15,125 50,105 85,125 65,60" fill={GOLD} opacity="0.9" />
      <circle cx="50" cy="45" r="38" fill={GOLD} stroke="#8a6407" strokeWidth="2" />
      <circle cx="50" cy="45" r="30" fill="#fff" />
      <text x="50" y="38" textAnchor="middle" fontSize="9" fontWeight="700" fill={GOLD} fontFamily="Georgia, serif">
        SINCE
      </text>
      <text x="50" y="55" textAnchor="middle" fontSize="12" fontWeight="800" fill={GOLD} fontFamily="Georgia, serif">
        2023
      </text>
    </svg>
  );
}

// Lightweight scribble-style signature placeholder so the signature area
// isn't just a blank line before real signature images are available.
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

// Loads a QR-rendering library from a CDN on demand and normalizes it to a
// simple async `renderTo(container, text)` function, so the caller doesn't
// need to know which underlying library ended up being used.
let qrPromise = null;
function loadQr() {
  if (qrPromise) return qrPromise;
  qrPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    // davidshimjs/qrcodejs — exposes `new QRCode(container, { text, width, height })`
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
    script.onload = () => {
      if (!window.QRCode) {
        reject(new Error("QR library failed to attach to window"));
        return;
      }
      resolve({
        toCanvas: async (container, text, opts = {}) => {
          container.innerHTML = "";
          // qrcodejs renders into the container itself (canvas or img),
          // it doesn't hand back a canvas — so we just let it draw.
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