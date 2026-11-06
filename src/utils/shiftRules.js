// src/utils/shiftRules.js
//
// Xeerka imaanshaha macalimiinta (Shift):
//   - Waqtiga imaanshaha: 7:00 – 7:30 subaxnimo (waqtiga Muqdisho)
//   - Macalinka yimaada 7:30 kadib waxaa loo qorayaa "Daahay" iyo daqiiqadaha uu daahay
//   - Waqtiga waxaa laga qaataa server-ka (Firestore), ma aha saacadda taleefanka,
//     macalinkuna gacanta kuma qori karo — wuxuu riixaa marka uu yimaado oo keliya.
//   - Maalintii hal shift oo keliya.

export const SHIFT_TIMEZONE = "Africa/Mogadishu";
export const ARRIVAL_START = "07:00"; // bilowga waqtiga imaanshaha
export const LATE_AFTER = "07:30"; // wixii ka dambeeya = daahay

const toMin = (hhmm) => {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + m;
};

export function toDateSafe(v) {
  if (!v) return null;
  if (typeof v?.toDate === "function") return v.toDate();
  if (typeof v?.seconds === "number") return new Date(v.seconds * 1000);
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

// Taariikhda iyo saacadda Muqdisho ee waqti la siiyay
export function mogadishuParts(value) {
  const d = toDateSafe(value);
  if (!d) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: SHIFT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t)?.value || "00";
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));
  return {
    dateKey: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: hour * 60 + minute,
    hhmm: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  };
}

export function todayKey() {
  return mogadishuParts(new Date()).dateKey;
}

// { late, lateMinutes, early } — macalinka imaanshihiisa
export function arrivalStatus(clockInAt) {
  const p = mogadishuParts(clockInAt);
  if (!p) return { late: false, lateMinutes: 0, early: false, hhmm: "" };
  const lateMinutes = Math.max(0, p.minutes - toMin(LATE_AFTER));
  return {
    late: lateMinutes > 0,
    lateMinutes,
    early: p.minutes < toMin(ARRIVAL_START),
    hhmm: p.hhmm,
    dateKey: p.dateKey,
  };
}

// Haddii record-ku leeyahay late/lateMinutes la kaydiyay, kuwaas ayaa la isticmaalaa;
// haddii kale (shiftiyadii hore) waxaa laga xisaabiyaa clockInAt.
export function shiftLateInfo(shift) {
  if (typeof shift?.late === "boolean") {
    return { late: shift.late, lateMinutes: Number(shift.lateMinutes) || 0 };
  }
  const s = arrivalStatus(shift?.clockInAt);
  return { late: s.late, lateMinutes: s.lateMinutes };
}

export function shiftDateKey(shift) {
  return shift?.dateKey || mogadishuParts(shift?.clockInAt)?.dateKey || "";
}

export function formatLate(min) {
  const m = Number(min) || 0;
  if (m < 60) return `${m} daqiiqo`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} saac ${r} daq` : `${h} saac`;
}

export function formatTime(value) {
  const d = toDateSafe(value);
  if (!d) return "—";
  return d.toLocaleTimeString("en-GB", { timeZone: SHIFT_TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: true });
}

export function formatDate(value) {
  const d = toDateSafe(value);
  if (!d) return "—";
  return d.toLocaleDateString("en-GB", { timeZone: SHIFT_TIMEZONE, day: "2-digit", month: "short", year: "numeric" });
}

export function formatDuration(ms) {
  if (!ms || ms <= 0) return "—";
  const totalMinutes = Math.round(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h === 0 ? `${m}d` : `${h}s ${m}d`;
}