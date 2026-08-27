// src/pages/StudentIdVerify.jsx
// Public page a Student ID card's QR code links to. No login required.
//
// FIX: this page used to read ONLY from `studentIdCards/{studentId}` — the
// collection StudentIdCard.jsx (the auto-generated card) writes to. Manual
// cards created via AllIdCards.jsx's "Create ID Card" flow are saved in a
// DIFFERENT collection, `manualStudentIdCards`, using ManualStudentIdCard.jsx
// as their design. So scanning a manual card's QR always missed here and
// fell through to "ID Card lama helin" (or, depending on the router's
// fallback handling, back out to the site) — never the card itself.
//
// Now this page checks `manualStudentIdCards/{studentId}` FIRST (that's
// where AllIdCards.jsx actually saves manual cards, keyed by the exact
// Student ID typed in), and falls back to `studentIdCards/{studentId}` for
// cards issued the automatic way. Whichever collection the record is found
// in decides which card component renders it, so the scanner always sees
// the exact same design that was printed/downloaded.
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import StudentIdCard from "../student/StudentIdCard";
import ManualStudentIdCard from "../student/ManualStudentIdCard";

export default function StudentIdVerify() {
  const { studentId } = useParams();
  const [student, setStudent] = useState(null);
  const [isManual, setIsManual] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        // Manual cards first — this is where AllIdCards.jsx's "Create ID
        // Card" flow actually saves them, under the exact Student ID typed
        // in (matching what the card's own QR encodes).
        const manualSnap = await getDoc(doc(db, "manualStudentIdCards", studentId));
        if (manualSnap.exists()) {
          setStudent(manualSnap.data());
          setIsManual(true);
          return;
        }

        // Fall back to the auto-generated card's collection.
        const snap = await getDoc(doc(db, "studentIdCards", studentId));
        if (snap.exists()) {
          setStudent(snap.data());
          setIsManual(false);
        } else {
          setNotFound(true);
        }
      } catch (err) {
        console.error("Failed to load student ID card:", err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    if (studentId) load();
  }, [studentId]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0b1120",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "30px 16px",
      }}
    >
      {loading ? (
        <p style={{ color: "#8b97b0", fontSize: 14 }}>Loading...</p>
      ) : notFound ? (
        <div style={{ textAlign: "center", color: "#fff" }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>ID Card lama helin</h2>
          <p style={{ color: "#8b97b0", fontSize: 13.5, marginTop: 8 }}>
            Lambarka Student ID-gan lama helin xogta school-ka.
          </p>
        </div>
      ) : (
        <>
          <div style={{ color: "#fff", marginBottom: 8, fontSize: 13, opacity: 0.7 }}>
            Rising Star School — Official Student ID Verification
          </div>
          {isManual ? (
            <ManualStudentIdCard card={student} />
          ) : (
            <StudentIdCard student={student} studentId={studentId} />
          )}
        </>
      )}
    </div>
  );
}