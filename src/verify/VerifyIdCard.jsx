// src/verify/VerifyIdCard.jsx
// Public page — NO LOGIN REQUIRED — reached when someone scans an ID card's
// QR code. Route: /verify/:type/:id  (type = "teacher" | "student")
//
// This is what the QR code actually opens: a QR code can only encode a URL,
// not a design or a component, so the "open the original card design" ask
// works by having that URL point here, and this page fetches the matching
// record from Firestore and renders it with the SAME card component used in
// the admin panel — so what the scanner sees IS the original card design,
// not a re-description of it.
//
// Lookup order per type:
//   teacher: manualTeacherIdCards/{id}  →  falls back to teacher_id/{id}
//   student: manualStudentIdCards/{id}  →  falls back to studentIdCards/{id}
// A manual-card doc renders via ManualTeacherIdCard/ManualStudentIdCard
// (the template-PNG overlay cards). A record found only in the "live"
// collection renders via TeacherIdCard/StudentIdCard instead, since those
// are built for that data shape.
//
// This file itself needed no change for the QR fix — it was already looking
// up the doc by the exact :id in the URL. The bug was upstream: the QR was
// either encoding the wrong domain (TeacherIdCard.jsx) or the wrong target
// entirely (StudentIdCard.jsx), or the manual card was being saved under a
// different Firestore doc ID than the one baked into its own QR
// (AllIdCards.jsx). With those fixed, this lookup now succeeds.
//
// This route must be registered OUTSIDE any admin/auth-protected layout —
// see the router wiring note at the bottom of this file.
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import ManualTeacherIdCard from "../teacher/ManualTeacherIdCard";
import ManualStudentIdCard from "../student/ManualStudentIdCard";
import TeacherIdCard from "../teacher/TeacherIdCard";
import StudentIdCard from "../student/StudentIdCard";

const wrapStyle = {
  minHeight: "100vh",
  background: "#F3F4F8",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "32px 16px",
  fontFamily: "'Inter','Segoe UI',sans-serif",
};

export default function VerifyIdCard() {
  const { type, id } = useParams();
  const [status, setStatus] = useState("loading"); // loading | found | not-found | error
  const [result, setResult] = useState(null); // { source: "manual" | "live", data }

  useEffect(() => {
    let cancelled = false;

    async function lookup() {
      setStatus("loading");
      try {
        if (type !== "teacher" && type !== "student") {
          if (!cancelled) setStatus("not-found");
          return;
        }

        const manualCollection = type === "teacher" ? "manualTeacherIdCards" : "manualStudentIdCards";
        const liveCollection = type === "teacher" ? "teacher_id" : "studentIdCards";

        // Try the manual-card collection first (matches how the ID was
        // created in AllIdCards.jsx's Create ID Card flow).
        const manualSnap = await getDoc(doc(db, manualCollection, id));
        if (manualSnap.exists()) {
          if (!cancelled) {
            setResult({ source: "manual", data: { id: manualSnap.id, ...manualSnap.data() } });
            setStatus("found");
          }
          return;
        }

        // Fall back to the live collection (real teacher/student record with
        // an issued card doc).
        const liveSnap = await getDoc(doc(db, liveCollection, id));
        if (liveSnap.exists()) {
          if (!cancelled) {
            setResult({ source: "live", data: { id: liveSnap.id, ...liveSnap.data() } });
            setStatus("found");
          }
          return;
        }

        if (!cancelled) setStatus("not-found");
      } catch (err) {
        console.error("Failed to look up ID card:", err);
        if (!cancelled) setStatus("error");
      }
    }

    lookup();
    return () => {
      cancelled = true;
    };
  }, [type, id]);

  if (status === "loading") {
    return (
      <div style={wrapStyle}>
        <p style={{ color: "#6B7280", fontSize: 14 }}>Loading ID card…</p>
      </div>
    );
  }

  if (status === "not-found") {
    return (
      <div style={wrapStyle}>
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          <h2 style={{ color: "#111827", fontSize: 18, marginBottom: 8 }}>ID Card Not Found</h2>
          <p style={{ color: "#6B7280", fontSize: 13.5 }}>
            This ID card could not be verified. It may have been removed, or the code is invalid.
          </p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div style={wrapStyle}>
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          <h2 style={{ color: "#111827", fontSize: 18, marginBottom: 8 }}>Something Went Wrong</h2>
          <p style={{ color: "#6B7280", fontSize: 13.5 }}>
            We couldn't load this ID card right now. Please try again in a moment.
          </p>
        </div>
      </div>
    );
  }

  const { source, data } = result;

  return (
    <div style={wrapStyle}>
      <div style={{ marginBottom: 18, textAlign: "center" }}>
        <h1 style={{ fontSize: 16, fontWeight: 800, color: "#111827", margin: 0 }}>
          Rising Star School — ID Verification
        </h1>
        <p style={{ fontSize: 12.5, color: "#9CA3AF", margin: "4px 0 0" }}>
          This card is issued and verified by Rising Star Primary &amp; Secondary School.
        </p>
      </div>

      {type === "teacher" ? (
        source === "manual" ? (
          <ManualTeacherIdCard card={data} />
        ) : (
          <TeacherIdCard teacher={data} teacherUsername={data.teacherUsername || data.id} readOnly />
        )
      ) : source === "manual" ? (
        <ManualStudentIdCard card={data} />
      ) : (
        <StudentIdCard student={data} studentId={data.studentId || data.id} />
      )}
    </div>
  );
}

// ── Router wiring ───────────────────────────────────────────────────────
// Add this route OUTSIDE your admin-protected route tree, e.g. in your top
// level <Routes>:
//
//   import VerifyIdCard from "./verify/VerifyIdCard";
//   ...
//   <Route path="/verify/:type/:id" element={<VerifyIdCard />} />
//
// It must NOT be nested inside any route that requires the admin to be
// logged in — the person scanning the QR code (a stranger, a security
// guard, a parent) will not have an admin session.