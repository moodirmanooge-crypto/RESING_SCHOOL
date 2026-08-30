// src/pages/TeacherVerify.jsx
// Public page a Teacher ID card's QR code links to. Reads the teacher's
// snapshot and renders the exact same front + back card design — no login
// required.
//
// FIX (this pass): manually-created teacher cards (via AllIdCards.jsx →
// "Create ID Card" → Teacher) are saved in `manualTeacherIdCards/{teacherId}`,
// NOT in `teacher_id`. This page used to look ONLY at `teacher_id`, so
// scanning a manual card's QR either showed "ID Card lama helin" (if no
// `teacher_id` doc happened to share that id), or — worse — showed a
// completely different teacher's data (if an unrelated `teacher_id` doc
// happened to already exist under that same id, e.g. from an
// auto-generated card). Neither is correct: the QR must always resolve to
// THIS exact card.
//
// Fix: look up `manualTeacherIdCards/{teacherUsername}` FIRST (manual
// cards are the ones this page most commonly needs to resolve now), and
// only fall back to `teacher_id/{teacherUsername}` (the auto-generated
// record TeacherIdCard.jsx creates at issue time) if no manual card exists
// under that id. Whichever is found is rendered through the same
// TeacherIdCard component, so the design shown is identical either way.

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import TeacherIdCard from "../teacher/TeacherIdCard";

export default function TeacherVerify() {
  const { teacherUsername } = useParams();
  const [teacher, setTeacher] = useState(null);
  const [isManual, setIsManual] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        // Manual cards first — this is where admin-created Teacher ID
        // cards actually live, and their QR must resolve to exactly this
        // record, not to an unrelated teacher_id doc that happens to
        // share the same id.
        const manualSnap = await getDoc(doc(db, "manualTeacherIdCards", teacherUsername));
        if (manualSnap.exists()) {
          setTeacher(manualSnap.data());
          setIsManual(true);
          return;
        }

        // Fall back to the auto-generated record for real teacher logins.
        const autoSnap = await getDoc(doc(db, "teacher_id", teacherUsername));
        if (autoSnap.exists()) {
          setTeacher(autoSnap.data());
          setIsManual(false);
          return;
        }

        setNotFound(true);
      } catch (err) {
        console.error("Failed to load teacher ID card:", err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    if (teacherUsername) load();
  }, [teacherUsername]);

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
            Username-kan macallinka lama helin xogta school-ka.
          </p>
        </div>
      ) : (
        <>
          <div style={{ color: "#fff", marginBottom: 8, fontSize: 13, opacity: 0.7 }}>
            Rising Star School — Official Teacher ID Verification
          </div>
          {isManual ? (
            // Manual cards carry their own plain "DD-MM-YYYY" issue/expire
            // strings and photo (teacherPhoto) — TeacherIdCard already
            // knows how to render those via issueDateStr/expireDateStr
            // (see TeacherIdCard.jsx), same as ManualTeacherIdCard does.
            <TeacherIdCard
              teacher={{
                fullName: teacher.fullName,
                title: teacher.title,
                teacherPhoto: teacher.teacherPhoto,
                issueDateStr: teacher.issueDate,
                expireDateStr: teacher.expireDate,
              }}
              teacherUsername={teacher.teacherId || teacherUsername}
              readOnly
            />
          ) : (
            <TeacherIdCard
              teacher={teacher}
              teacherUsername={teacherUsername}
              readOnly
            />
          )}
        </>
      )}
    </div>
  );
}