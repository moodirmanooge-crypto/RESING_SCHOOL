// src/utils/holidayCheck.js
//
// Helper function loo isticmaalo Teacher Attendance page-ka si loo hubiyo
// in maanta uu ku jiro fasax. Haddii maanta uu ku jiro fasax, wuxuu soo
// celiyaa xogta fasaxa; haddii kale wuxuu soo celiyaa null.

import { db } from "../firebase/firebase";
import { collection, getDocs } from "firebase/firestore";

function toDateOnly(v) {
  if (!v) return null;
  const d = v?.toDate ? v.toDate() : new Date(v);
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

export function formatHolidayDate(v) {
  const d = toDateOnly(v);
  if (!d) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export async function getActiveHolidayToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const snap = await getDocs(collection(db, "holidays"));
  const holidays = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const active = holidays.find((h) => {
    const start = toDateOnly(h.startDate);
    const end = toDateOnly(h.endDate);
    if (!start || !end) return false;
    return today >= start && today <= end;
  });

  return active || null;
}