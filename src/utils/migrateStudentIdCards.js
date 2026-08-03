// scripts/migrateStudentIdCards.js
//
// ONE-TIME MIGRATION
// -------------------
// Loops over every document in `students`, and for each one that is
// missing a matching `studentIdCards/{studentId}` document, creates it.
// Safe to run more than once: students who already have a card are
// skipped (no overwrite), so nothing existing gets clobbered.
//
// HOW TO RUN
// ----------
// Drop this file anywhere in your project (e.g. src/scripts/) and, for
// example, wire it to a temporary admin button's onClick, or run it once
// from a dev-only page / useEffect. It uses the same `db` your app
// already uses, so no separate service-account setup is needed — it
// runs with whatever Firestore rules/auth your logged-in admin session
// already has.
//
// WHAT GETS COPIED
// -----------------
// studentIdCards/{studentId} is created with the fields StudentIdCard.jsx
// and AllIdCards.jsx actually read:
//   studentId, fullName, className, studentPhoto, issuedAt
// (issuedAt is copied from the student's own idIssuedAt/createdAt so the
// card's Issue/Expire dates line up with when the student record itself
// was created — falls back to "now" if neither exists.)

import { collection, getDocs, doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/firebase"; // adjust path to match where you drop this file

export async function migrateStudentIdCards() {
  const studentsSnap = await getDocs(collection(db, "students"));

  let created = 0;
  let skippedExisting = 0;
  let skippedNoId = 0;

  for (const studentDoc of studentsSnap.docs) {
    const data = studentDoc.data();
    const studentId = data.studentId;

    if (!studentId) {
      skippedNoId++;
      console.warn(`Skipping students/${studentDoc.id} — no studentId field.`);
      continue;
    }

    const cardRef = doc(db, "studentIdCards", studentId);
    const existing = await getDoc(cardRef);

    if (existing.exists()) {
      skippedExisting++;
      continue;
    }

    await setDoc(cardRef, {
      studentId,
      fullName: data.fullName || "",
      className: data.className || "",
      studentPhoto: data.studentPhoto || "",
      issuedAt: data.idIssuedAt || data.createdAt || serverTimestamp(),
    });

    created++;
    console.log(`Created studentIdCards/${studentId} for ${data.fullName || studentId}`);
  }

  const summary = { created, skippedExisting, skippedNoId, total: studentsSnap.size };
  console.log("Migration complete:", summary);
  return summary;
}