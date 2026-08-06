// src/teacher/ManualTeacherIdCard.jsx
// Renders a MANUALLY-created Teacher ID card (front + back) for cards typed
// in by an admin via the "Create ID Card" → Teacher flow in
// admin/pages/AllIdCards.jsx.
//
// Unlike ManualStudentIdCard (which overlays data on static template PNGs),
// TeacherIdCard already builds the card live in CSS/JSX from data props, so
// this file is a thin adapter: it maps the manual card's field names
// (fullName, title, teacherId, issueDate, expireDate, teacherPhoto) onto the
// props TeacherIdCard expects, and tells it to skip the Firestore
// `teacher_id` sync — manual cards persist to their own `manualTeacherIdCards`
// collection instead (handled in AllIdCards.jsx), so TeacherIdCard must not
// also try to write a `teacher_id` doc for them.
//
// NOTE on the QR code: TeacherIdCard builds the QR from `teacherUsername`
// (here, the entered Teacher ID), pointing at /verify/teacher/{teacherUsername}.
// For the QR to resolve correctly, AllIdCards.jsx must save this card's
// Firestore doc under that SAME id (see the fix in AllIdCards.jsx) — this
// component itself needs no change for that.
import TeacherIdCard from "./TeacherIdCard";

export default function ManualTeacherIdCard({ card }) {
  const {
    fullName,
    title,
    teacherId,
    issueDate,
    expireDate,
    teacherPhoto, // data URL (base64) uploaded by the admin
  } = card || {};

  return (
    <TeacherIdCard
      teacher={{
        fullName,
        title,
        teacherPhoto,
        issueDateStr: issueDate,
        expireDateStr: expireDate,
      }}
      teacherUsername={teacherId}
      readOnly
      skipFirestoreSync
    />
  );
}