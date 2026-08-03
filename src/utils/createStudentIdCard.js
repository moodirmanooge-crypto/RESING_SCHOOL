// src/utils/createStudentIdCard.js
//
// Call this right after you successfully create a new student document
// (i.e. right after your existing setDoc/addDoc call in the Admissions
// form's submit handler). It creates the matching studentIdCards/{studentId}
// doc so the card shows up in "All ID Cards" immediately — no separate
// migration ever needed again for new students.
//
// USAGE (inside your Admissions save handler, after the student doc write):
//
//   import { createStudentIdCard } from "../utils/createStudentIdCard";
//   ...
//   await setDoc(doc(db, "students", newStudentDocId), studentData);
//   await createStudentIdCard(studentData); // <-- add this line
//
// `studentData` just needs to be the same object you saved for the
// student (must include studentId, fullName, className, studentPhoto).

import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/firebase"; // adjust path to match your project

export async function createStudentIdCard(studentData) {
  if (!studentData?.studentId) {
    console.warn("createStudentIdCard: missing studentId, skipping card creation.");
    return;
  }

  const cardRef = doc(db, "studentIdCards", studentData.studentId);

  await setDoc(cardRef, {
    studentId: studentData.studentId,
    fullName: studentData.fullName || "",
    className: studentData.className || "",
    studentPhoto: studentData.studentPhoto || "",
    issuedAt: studentData.idIssuedAt || studentData.createdAt || serverTimestamp(),
  });
}