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

const GOLD = "#b8860b";
const DARK_GREEN = "#0f3d2e";
const GREEN = "#166534";

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
        width: 900,
        maxWidth: "100%",
        background: "#fdfdfb",
        border: `10px solid ${DARK_GREEN}`,
        borderRadius: 4,
        padding: "36px 44px",
        position: "relative",
        fontFamily: "'Georgia','Times New Roman',serif",
        color: "#111827",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <div style={{ width: 90 }} />
        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontSize: 34, fontWeight: 800, color: DARK_GREEN, letterSpacing: 2 }}>
            RISING STAR
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: DARK_GREEN, letterSpacing: 1 }}>
            {(schoolName || "PRIMARY & SECONDARY SCHOOL").toUpperCase()}
          </div>
        </div>
        <div
          style={{
            width: 90,
            height: 90,
            borderRadius: "50%",
            border: `2px solid ${GOLD}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 700,
            color: GOLD,
            textAlign: "center",
            flexShrink: 0,
          }}
        >
          SINCE
          <br />
          2023
        </div>
      </div>

      <div
        style={{
          textAlign: "center",
          fontSize: 24,
          fontWeight: 800,
          color: DARK_GREEN,
          letterSpacing: 1,
          margin: "18px 0 6px",
        }}
      >
        CLASS {className || "8"} LEAVING CERTIFICATE
      </div>
      <div style={{ textAlign: "center", fontStyle: "italic", fontSize: 15, color: "#374151", marginBottom: 22 }}>
        This is to certify that
      </div>

      <div style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>
        <div
          style={{
            width: 120,
            height: 140,
            border: `2px solid ${GOLD}`,
            borderRadius: 4,
            overflow: "hidden",
            flexShrink: 0,
            background: "#e5e7eb",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {studentPhoto ? (
            <img
              src={studentPhoto}
              alt=""
              crossOrigin="anonymous"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span style={{ fontSize: 11, color: "#9CA3AF" }}>No photo</span>
          )}
        </div>

        <div style={{ flex: 1, fontSize: 15, lineHeight: 2.2 }}>
          <CertLine label="Student Name" value={fullName} />
          <CertLine label="Mother's Name" value={motherName} />
          <CertLine label="Academic Year" value={academicYear} />
          <CertLine label="Grade Obtained" value={gradeObtained} />
        </div>
      </div>

      <div style={{ marginTop: 24, fontSize: 14, lineHeight: 1.7, color: "#1f2937" }}>
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
          marginTop: 40,
        }}
      >
        <div style={{ textAlign: "center", width: 180 }}>
          <div style={{ borderBottom: "1.5px solid #374151", height: 30 }} />
          <div style={{ fontSize: 12.5, marginTop: 4 }}>Deputy Principal</div>
        </div>

        <div ref={qrRef} style={{ width: 96, height: 96 }} />

        <div style={{ textAlign: "center", width: 180 }}>
          <div style={{ borderBottom: "1.5px solid #374151", height: 30 }} />
          <div style={{ fontSize: 12.5, marginTop: 4 }}>Principal</div>
        </div>
      </div>

      <div
        style={{
          textAlign: "center",
          marginTop: 22,
          background: DARK_GREEN,
          color: "#fff",
          padding: "6px 0",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: 1.5,
          borderRadius: 3,
        }}
      >
        EDUCATION IS LIFE IT SELF
      </div>
    </div>
  );
}

function CertLine({ label, value }) {
  return (
    <div style={{ borderBottom: "1px dotted #9CA3AF", paddingBottom: 2 }}>
      <span style={{ fontWeight: 700 }}>{label}:</span> {value || "—"}
    </div>
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