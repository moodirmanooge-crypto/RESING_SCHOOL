// src/pages/VerifyCertificate.jsx
// Public page the certificate's QR code points to: /verify/:certificateId
// No login required — anyone (an employer, another school, etc.) scanning
// the QR code should be able to confirm the certificate is genuine and see
// its details, straight from Firestore (source of truth), not from any
// image someone could have edited.
import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import CertificateCard from "../admin/components/CertificateCard";

const GREEN = "#166534";

export default function VerifyCertificate() {
  const { certificateId } = useParams();
  const [certificate, setCertificate] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | found | notfound | error

  // Scales the fixed 1000px-wide certificate down to fit the viewport
  // (phones especially), instead of letting it overflow and get cropped.
  const wrapperRef = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setStatus("loading");
      try {
        const snap = await getDoc(doc(db, "certificates", certificateId));
        if (cancelled) return;
        if (snap.exists()) {
          setCertificate({ id: snap.id, ...snap.data() });
          setStatus("found");
        } else {
          setStatus("notfound");
        }
      } catch (e) {
        console.error("Error verifying certificate:", e);
        if (!cancelled) setStatus("error");
      }
    }
    if (certificateId) load();
    return () => {
      cancelled = true;
    };
  }, [certificateId]);

  useEffect(() => {
    function updateScale() {
      if (!wrapperRef.current) return;
      const CERT_WIDTH = 1000;
      const available = wrapperRef.current.offsetWidth;
      const next = available < CERT_WIDTH ? available / CERT_WIDTH : 1;
      setScale(next);
    }
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [status]);

  const verifyUrl = typeof window !== "undefined" ? window.location.href : "";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F3F4F8",
        fontFamily: "'Inter','Segoe UI',sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "40px 16px",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#111827" }}>
          Rising Star Primary & Secondary School
        </div>
        <div style={{ fontSize: 13.5, color: "#6B7280", marginTop: 2 }}>
          Certificate Verification
        </div>
      </div>

      {status === "loading" && (
        <div style={{ color: "#6B7280", fontSize: 14 }}>Checking certificate…</div>
      )}

      {status === "notfound" && (
        <StatusCard
          color="#DC2626"
          bg="#FEE2E2"
          icon="✕"
          title="Certificate Not Found"
          message="This certificate ID does not match any record in our system. It may be invalid or revoked."
        />
      )}

      {status === "error" && (
        <StatusCard
          color="#DC2626"
          bg="#FEE2E2"
          icon="!"
          title="Something Went Wrong"
          message="We couldn't check this certificate right now. Please try again shortly."
        />
      )}

      {status === "found" && certificate && (
        <>
          <StatusCard
            color={GREEN}
            bg="#DCFCE7"
            icon="✓"
            title="Certificate Verified"
            message={`This is a genuine Class ${certificate.className || "8"} Leaving Certificate issued by Rising Star Primary & Secondary School.`}
          />
          {/* Outer wrapper measures the available width; inner div is scaled
              down (not cropped) so the full 1000px-wide certificate always
              fits on screen, phones included. offsetHeight is collapsed to
              match the scaled-down visual height so no blank space is left
              below the certificate. */}
          <div ref={wrapperRef} style={{ marginTop: 24, width: "100%", maxWidth: 900 }}>
            <div
              style={{
                width: 1000,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                height: scale !== 1 ? 707 * scale : undefined,
              }}
            >
              <CertificateCard
                certificate={certificate}
                verifyUrl={verifyUrl}
                elementId="verify-certificate-card"
              />
            </div>
          </div>
        </>
      )}

      <Link to="/" style={{ marginTop: 28, fontSize: 12.5, color: "#6B7280" }}>
        ← Back to homepage
      </Link>
    </div>
  );
}

function StatusCard({ color, bg, icon, title, message }) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 16,
        padding: "22px 26px",
        boxShadow: "0 4px 18px rgba(17,24,39,0.06)",
        border: "1px solid rgba(17,24,39,0.05)",
        maxWidth: 480,
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: bg,
          color: color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 800,
          fontSize: 18,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>{title}</div>
        <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>{message}</div>
      </div>
    </div>
  );
}