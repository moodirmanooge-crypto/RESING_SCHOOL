// src/admin/components/TimePicker12.jsx
//
// Doorashada waqtiga xiisadaha: Saacad (1–12) + Daqiiqad + AM/PM.
// Database-ka waxaa lagu kaydiyaa qaabka 24-saac ("HH:mm") sidii hore:
//   AM: 12:xx AM -> 00:xx, 1:00 AM -> 01:00 ... 11:00 AM -> 11:00
//   PM: 12:00 PM -> 12:00 (duhur), 1:00 PM -> 13:00 ... 11:00 PM -> 23:00
// Sidaas darteed PM-ku wuxuu ka bilaabmaa 13:00 (1:00 duhurnimo), xiisadaha
// galabtana si sax ah ayay u kala horreeyaan (sort) oo ugu muuqdaan meel kasta.
//
// Marka saacad la doorto oo AM/PM aan weli la dooran, si toos ah ayaa loo
// qiyaasaa (saacadaha dugsiga): 6–11 => AM, 12 iyo 1–5 => PM. Waad beddeli
// kartaa mar walba.

import { useEffect, useState } from "react";

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

const pad2 = (n) => String(n).padStart(2, "0");

export function parse24(value) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(value || ""));
  if (!m) return { hour: "", minute: "00", period: "" };
  const h24 = Math.min(Math.max(Number(m[1]), 0), 23);
  const period = h24 >= 12 ? "PM" : "AM";
  const hour = h24 % 12 === 0 ? 12 : h24 % 12;
  return { hour: String(hour), minute: m[2], period };
}

export function to24(hour, minute, period) {
  const h = Number(hour);
  if (!h) return "";
  let h24;
  if (period === "AM") h24 = h === 12 ? 0 : h;
  else h24 = h === 12 ? 12 : h + 12;
  return `${pad2(h24)}:${pad2(Number(minute) || 0)}`;
}

export function format12(value) {
  const { hour, minute, period } = parse24(value);
  if (!hour) return "";
  return `${hour}:${minute} ${period}`;
}

const guessPeriod = (hour) => {
  const h = Number(hour);
  if (h >= 6 && h <= 11) return "AM";
  return "PM";
};

const baseSelect = {
  padding: "8px 6px",
  borderRadius: 8,
  border: "1.5px solid rgba(139,108,245,0.3)",
  background: "#0b0a1c",
  color: "#e5e3f7",
  fontSize: 13.5,
  colorScheme: "dark",
  cursor: "pointer",
};

export default function TimePicker12({ value, onChange, selectStyle, showHint = true }) {
  const [draft, setDraft] = useState(() => parse24(value));

  useEffect(() => {
    const parsed = parse24(value);
    if (parsed.hour) setDraft(parsed);
    else if (!value) setDraft((d) => (d.hour ? { hour: "", minute: "00", period: "" } : d));
  }, [value]);

  const emit = (next) => {
    setDraft(next);
    if (next.hour && next.period) {
      onChange(to24(next.hour, next.minute, next.period));
    } else if (!next.hour) {
      onChange("");
    }
  };

  const handleHour = (hour) => {
    if (!hour) {
      emit({ hour: "", minute: draft.minute, period: draft.period });
      return;
    }
    emit({
      hour,
      minute: draft.minute || "00",
      period: draft.period || guessPeriod(hour),
    });
  };

  const minuteOptions = MINUTES.includes(draft.minute)
    ? MINUTES
    : [...MINUTES, draft.minute].sort();

  const sel = { ...baseSelect, ...(selectStyle || {}) };
  const current24 = draft.hour && draft.period ? to24(draft.hour, draft.minute, draft.period) : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <select
          value={draft.hour}
          onChange={(e) => handleHour(e.target.value)}
          style={{ ...sel, minWidth: 52 }}
          aria-label="Saacadda"
        >
          <option value="">--</option>
          {HOURS.map((h) => (
            <option key={h} value={String(h)}>
              {h}
            </option>
          ))}
        </select>
        <span style={{ color: "#8b87ad", fontWeight: 700 }}>:</span>
        <select
          value={draft.minute}
          onChange={(e) => emit({ ...draft, minute: e.target.value })}
          style={{ ...sel, minWidth: 52 }}
          aria-label="Daqiiqadda"
        >
          {minuteOptions.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select
          value={draft.period}
          onChange={(e) => emit({ ...draft, period: e.target.value })}
          style={{
            ...sel,
            minWidth: 58,
            fontWeight: 700,
            color: draft.period === "PM" ? "#f59e0b" : draft.period === "AM" ? "#38bdf8" : sel.color,
          }}
          aria-label="AM ama PM"
        >
          <option value="">AM/PM</option>
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
      {showHint && current24 && (
        <span style={{ fontSize: 11, color: "#8b87ad" }}>
          {draft.period === "PM" ? "Galab" : "Subax"} · {current24}
        </span>
      )}
    </div>
  );
}