// src/pages/StudentIdVerify.jsx
// Public page a Student ID card's QR code links to. Reads the student's
// snapshot straight from `studentIdCards/{studentId}` (the same
// persistent record StudentIdCard.jsx creates at issue time) and renders
// the exact same front + back card design — no login required.

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import StudentIdCard from "../student/StudentIdCard";

export default function StudentIdVerify() {
  const { studentId } = useParams();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(doc(db, "studentIdCards", studentId));
        if (snap.exists()) {
          setStudent(snap.data());
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
          <StudentIdCard student={student} studentId={studentId} />
        </>
      )}
    </div>
  );
}