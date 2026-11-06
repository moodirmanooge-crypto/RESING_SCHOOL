// src/admin/components/ClassTimetableSheet.jsx
//
// Warqadda "Class Timetable" ee fasal — naqshadda dugsiga (logo, cagaar/buluug,
// maalmaha safaf ahaan, xiisadaha tiirar ahaan, maado + macalin unug kasta).
// Waxaa isticmaala:
//   - Maamulka (Timetable.jsx): muuqaal, daawasho guud, PDF
//   - Ardayga (student/Dashboard.jsx): eeg + soo deji PDF / sawir
//
// Warqaddu waxay leedahay ballac go'an (SHEET_WIDTH). Shaashadaha yaryar waxaa
// lagu muujiyaa <FitToWidth> oo yareeya si ay ugu filnaato, laakiin sawirka/PDF-ka
// waxaa had iyo jeer laga qaadaa cabbirka buuxa.

import { useLayoutEffect, useRef, useState } from "react";
import {
  BookOpen,
  Calculator,
  FlaskConical,
  Users,
  Monitor,
  Feather,
  Clock,
  CalendarDays,
  GraduationCap,
  Target,
  Check,
  Star,
} from "lucide-react";
import logo from "../assets/logo.png";
import { DAY_SO, fmt12, ampm, fmtRange, sortSessions, subjectKind, toMinutes } from "../../utils/timetableUtils";

export const SHEET_WIDTH = 1500;

const C = {
  green: "#178a3e",
  greenDark: "#0e6a2e",
  blue: "#1b4fa8",
  blueDark: "#143c84",
  gold: "#f5b01a",
  ink: "#10233f",
  cellBorder: "#d6e2f3",
};

function SubjectIcon({ subject }) {
  const kind = subjectKind(subject);
  const common = { size: 27, strokeWidth: 2.1 };
  switch (kind) {
    case "arabic":
      return <span className="cts-ic-ar">ض</span>;
    case "english":
      return <span className="cts-ic-abc">ABC</span>;
    case "math":
      return <Calculator {...common} color={C.green} />;
    case "science":
      return <FlaskConical {...common} color={C.green} />;
    case "social":
      return <Users {...common} color={C.green} />;
    case "tech":
      return <Monitor {...common} color={C.blue} />;
    case "somali":
      return <Feather {...common} color={C.blue} />;
    case "islamic":
    default:
      return <BookOpen {...common} color={C.blue} />;
  }
}

function SheetStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Barlow:wght@500;600;700&family=Dancing+Script:wght@600;700&display=swap');

      .cts-root {
        position: relative;
        width: ${SHEET_WIDTH}px;
        box-sizing: border-box;
        background: #ffffff;
        color: ${C.ink};
        font-family: 'Barlow', 'Segoe UI', Arial, sans-serif;
        overflow: hidden;
        padding: 26px 26px 22px;
        border-radius: 6px;
      }
      .cts-root * { box-sizing: border-box; }

      /* Qurxinta geesaha (cagaar / buluug / dahab) */
      .cts-swoosh { position: absolute; pointer-events: none; border-radius: 50%; }
      .cts-sw-tl1 { width: 420px; height: 160px; left: -210px; top: -95px; background: ${C.green}; transform: rotate(-18deg); }
      .cts-sw-tl2 { width: 420px; height: 160px; left: -190px; top: -70px; border: 6px solid ${C.gold}; background: transparent; transform: rotate(-18deg); }
      .cts-sw-tr1 { width: 460px; height: 170px; right: -230px; top: -100px; background: ${C.blue}; transform: rotate(16deg); }
      .cts-sw-tr2 { width: 460px; height: 170px; right: -210px; top: -78px; border: 6px solid ${C.gold}; background: transparent; transform: rotate(16deg); }
      .cts-sw-br1 { width: 520px; height: 150px; right: -260px; bottom: -125px; background: ${C.green}; transform: rotate(-12deg); }
      .cts-sw-br2 { width: 520px; height: 150px; right: -230px; bottom: -112px; border: 6px solid ${C.gold}; background: transparent; transform: rotate(-12deg); }
      .cts-sw-bl1 { width: 380px; height: 140px; left: -200px; bottom: -100px; background: ${C.blue}; transform: rotate(12deg); }

      /* Header */
      .cts-header { position: relative; z-index: 1; display: grid; grid-template-columns: 250px 1fr 260px; align-items: center; gap: 18px; margin-bottom: 18px; }
      .cts-logo-wrap { display: flex; justify-content: center; }
      .cts-logo { width: 220px; height: 220px; object-fit: contain; }
      .cts-head-mid { text-align: center; }
      .cts-title { margin: 0; font-family: 'Barlow Condensed', 'Arial Narrow', Arial, sans-serif; font-weight: 800; font-size: 52px; line-height: 1; letter-spacing: 0.5px; color: ${C.greenDark}; }
      .cts-tagline { display: flex; align-items: center; justify-content: center; gap: 14px; margin: 10px 0 14px; font-size: 24px; font-style: italic; font-weight: 600; color: ${C.blue}; }
      .cts-tagline i { display: block; width: 110px; height: 3px; background: ${C.blue}; border-radius: 3px; }
      .cts-banner { display: inline-flex; align-items: stretch; border-radius: 999px; overflow: hidden; box-shadow: 0 6px 14px rgba(16,35,63,0.15); }
      .cts-banner-green { display: flex; align-items: center; gap: 16px; background: linear-gradient(90deg, ${C.greenDark}, ${C.green}); color: #fff; padding: 12px 34px 12px 26px; font-family: 'Barlow Condensed', 'Arial Narrow', Arial, sans-serif; font-weight: 700; font-size: 46px; line-height: 1; clip-path: polygon(0 0, 100% 0, calc(100% - 26px) 100%, 0 100%); padding-right: 54px; }
      .cts-banner-blue { display: flex; align-items: center; background: linear-gradient(90deg, ${C.blue}, ${C.blueDark}); color: #fff; padding: 12px 30px 12px 26px; margin-left: -26px; font-family: 'Barlow Condensed', 'Arial Narrow', Arial, sans-serif; font-weight: 700; font-size: 32px; line-height: 1; }
      .cts-pill { display: inline-block; margin-top: 14px; padding: 8px 30px; border-radius: 999px; background: #e7f6ee; border: 2px solid #a7dcbc; color: #0f3d22; font-weight: 700; font-size: 22px; }
      .cts-pill b { color: ${C.green}; }

      .cts-head-right { position: relative; display: flex; flex-direction: column; align-items: center; gap: 10px; }
      .cts-quote { font-size: 26px; font-style: italic; font-weight: 600; color: ${C.blueDark}; text-align: center; line-height: 1.25; }
      .cts-quote-star { display: flex; align-items: center; gap: 10px; color: ${C.blue}; }
      .cts-quote-star i { display: block; width: 26px; height: 3px; background: ${C.blue}; border-radius: 3px; }
      .cts-books { position: relative; width: 180px; height: 120px; }
      .cts-book { position: absolute; left: 10px; height: 26px; border-radius: 6px; box-shadow: inset 0 -5px 0 rgba(0,0,0,0.15); }
      .cts-book.b1 { bottom: 0; width: 160px; background: ${C.gold}; }
      .cts-book.b2 { bottom: 26px; width: 150px; left: 18px; background: ${C.green}; }
      .cts-book.b3 { bottom: 52px; width: 140px; left: 8px; background: ${C.blue}; }
      .cts-cap { position: absolute; left: 40px; bottom: 70px; color: #0b1220; }

      /* Jadwalka */
      .cts-table { position: relative; z-index: 1; width: 100%; border-collapse: separate; border-spacing: 5px; table-layout: fixed; }
      .cts-th-day, .cts-day { width: 225px; }
      .cts-th-day, .cts-th-period { border-radius: 8px; }
      .cts-th-day { background: linear-gradient(180deg, ${C.blue}, ${C.blueDark}); color: #fff; padding: 12px 14px; text-align: left; }
      .cts-th-period { background: linear-gradient(180deg, ${C.green}, ${C.greenDark}); color: #fff; padding: 10px 6px; text-align: center; font-family: 'Barlow Condensed', 'Arial Narrow', Arial, sans-serif; }
      .cts-th-period .cts-pn { display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 26px; font-weight: 700; }
      .cts-th-period .cts-pt { font-size: 23px; font-weight: 700; margin-top: 2px; letter-spacing: 0.3px; }
      .cts-day-inner { display: flex; align-items: center; gap: 14px; }
      .cts-day-ic { width: 52px; height: 52px; border-radius: 10px; background: rgba(255,255,255,0.14); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
      .cts-day-name { font-family: 'Barlow Condensed', 'Arial Narrow', Arial, sans-serif; font-weight: 700; font-size: 30px; line-height: 1.05; }
      .cts-day-en { font-family: 'Barlow Condensed', 'Arial Narrow', Arial, sans-serif; font-weight: 600; font-size: 21px; opacity: 0.95; white-space: nowrap; }
      .cts-day { background: linear-gradient(180deg, ${C.blue}, ${C.blueDark}); color: #fff; padding: 12px 14px; border-radius: 8px; }
      .cts-cell { background: #fff; border: 2px solid ${C.cellBorder}; border-radius: 8px; padding: 10px 6px; text-align: center; vertical-align: middle; height: 104px; }
      .cts-cell-row { display: flex; align-items: center; justify-content: center; gap: 4px 8px; flex-wrap: wrap; }
      .cts-subject { font-weight: 700; font-size: 20px; color: #0b1a33; line-height: 1.1; overflow-wrap: normal; word-break: normal; }
      .cts-teacher { margin-top: 7px; font-size: 16px; color: #1f2d44; font-weight: 500; line-height: 1.2; }
      .cts-ctime { margin-top: 4px; font-size: 14px; color: ${C.green}; font-weight: 700; }
      .cts-empty { color: #b9c6db; font-size: 26px; font-weight: 700; }
      .cts-ic-ar { font-family: 'Times New Roman', serif; font-size: 34px; font-weight: 700; color: ${C.green}; line-height: 1; }
      .cts-ic-abc { display: inline-block; background: ${C.blue}; color: #fff; font-weight: 800; font-size: 16px; padding: 4px 6px; border-radius: 6px; letter-spacing: 0.5px; font-family: Arial, sans-serif; }
      .cts-nodata { padding: 50px 20px; text-align: center; font-size: 26px; color: #6b7a90; font-weight: 600; background: #f6f9fd; border: 2px dashed ${C.cellBorder}; border-radius: 12px; }

      /* Footer */
      .cts-footer { position: relative; z-index: 1; display: grid; grid-template-columns: 1fr 1.25fr 1fr; gap: 20px; align-items: center; margin-top: 14px; }
      .cts-foot-green { display: flex; align-items: center; gap: 18px; background: linear-gradient(90deg, ${C.greenDark}, ${C.green}); color: #fff; border-radius: 12px; padding: 14px 22px; }
      .cts-foot-green b { display: block; font-family: 'Barlow Condensed', 'Arial Narrow', Arial, sans-serif; font-size: 30px; font-weight: 700; line-height: 1.05; }
      .cts-foot-green span { display: block; font-size: 18px; font-style: italic; opacity: 0.95; margin-top: 2px; }
      .cts-foot-goal { display: flex; align-items: center; gap: 16px; background: #eaf2fd; border-radius: 12px; padding: 12px 20px; }
      .cts-foot-goal b { display: block; font-size: 21px; color: ${C.blueDark}; margin-bottom: 4px; }
      .cts-foot-goal div div { display: flex; align-items: center; gap: 8px; font-size: 17px; color: #1f2d44; margin-top: 2px; }
      .cts-foot-sign { text-align: center; font-family: 'Dancing Script', cursive; font-size: 38px; color: ${C.blueDark}; font-weight: 700; position: relative; }
      .cts-foot-sign small { display: block; font-family: 'Barlow', Arial, sans-serif; font-size: 13px; color: #8090a8; font-weight: 600; margin-top: 4px; letter-spacing: 0.4px; }
    `}</style>
  );
}

/**
 * Props:
 *   id            — id-ga root-ka (sawir/PDF ayaa loo isticmaalaa)
 *   className     — "4"
 *   typeLabel     — "Full Time" | "Part Time"
 *   days          — [{ key, label, so }]
 *   sessionsByDay — { Saturday: [ {startTime, endTime, subject, teacherId, teacherName} ] }
 *   teacherNameOf — (session) => string
 *   academicYear  — "2025/2026"
 */
export default function ClassTimetableSheet({
  id,
  className,
  typeLabel = "Full Time",
  days = [],
  sessionsByDay = {},
  teacherNameOf = (s) => s?.teacherName || "",
  academicYear = "",
}) {
  const rows = days.map((d) => ({
    ...d,
    so: d.so || DAY_SO[d.key] || d.label,
    sessions: sortSessions(sessionsByDay[d.key] || []),
  }));
  const periods = Math.max(0, ...rows.map((r) => r.sessions.length));
  const hasAny = periods > 0;

  // Waqtiga tiir kasta: haddii maalmaha oo dhan isku waqti yihiin, madaxa ayaa
  // lagu qoraa; haddii kale unug kasta waqtigiisa ayaa lagu qoraa.
  const columns = Array.from({ length: periods }, (_, i) => {
    const ranges = rows
      .map((r) => r.sessions[i])
      .filter(Boolean)
      .map((s) => `${s.startTime}|${s.endTime}`);
    const uniform = ranges.length > 0 && ranges.every((x) => x === ranges[0]);
    const [start, end] = (ranges[0] || "|").split("|");
    return { idx: i, uniform, start, end };
  });

  const ordinal = (n) => `${n}-aad`;

  // Goorta dugsigu bilaabmo iyo dhammaado (ugu horraysa / ugu dambaysa)
  let dayStart = "";
  let dayEnd = "";
  rows.forEach((r) =>
    r.sessions.forEach((s) => {
      const a = toMinutes(s.startTime);
      const b = toMinutes(s.endTime);
      if (a !== null && (dayStart === "" || a < toMinutes(dayStart))) dayStart = s.startTime;
      if (b !== null && (dayEnd === "" || b > toMinutes(dayEnd))) dayEnd = s.endTime;
    })
  );

  return (
    <div className="cts-root" id={id}>
      <SheetStyles />
      <div className="cts-swoosh cts-sw-tl1" />
      <div className="cts-swoosh cts-sw-tl2" />
      <div className="cts-swoosh cts-sw-tr1" />
      <div className="cts-swoosh cts-sw-tr2" />
      <div className="cts-swoosh cts-sw-br1" />
      <div className="cts-swoosh cts-sw-br2" />
      <div className="cts-swoosh cts-sw-bl1" />

      <header className="cts-header">
        <div className="cts-logo-wrap">
          <img src={logo} alt="Rising Star School" className="cts-logo" crossOrigin="anonymous" />
        </div>

        <div className="cts-head-mid">
          <h1 className="cts-title">RISING STAR PRIMARY &amp; SECONDARY SCHOOL</h1>
          <div className="cts-tagline">
            <i />
            <span>Knowledge &nbsp;•&nbsp; Discipline &nbsp;•&nbsp; A Brighter Future</span>
            <i />
          </div>
          <div className="cts-banner">
            <div className="cts-banner-green">
              <BookOpen size={46} strokeWidth={2.2} />
              Class Timetable
            </div>
            <div className="cts-banner-blue">Jadwalka Xiisadaha Ardayda</div>
          </div>
          <div>
            <div className="cts-pill">
              Fasalka <b>{className || "—"}</b> &nbsp;·&nbsp; {typeLabel}
              {hasAny && (
                <>
                  {" "}
                  &nbsp;·&nbsp; {periods} Xiisadood Maalin kasta
                </>
              )}
              {academicYear && <> &nbsp;·&nbsp; {academicYear}</>}
            </div>
          </div>
        </div>

        <div className="cts-head-right">
          <div className="cts-quote">
            “Aqoon waa iftiin
            <br />
            mustaqbalka.”
          </div>
          <div className="cts-quote-star">
            <i />
            <Star size={22} fill={C.blue} color={C.blue} />
            <i />
          </div>
          <div className="cts-books">
            <div className="cts-book b1" />
            <div className="cts-book b2" />
            <div className="cts-book b3" />
            <div className="cts-cap">
              <GraduationCap size={88} strokeWidth={1.8} />
            </div>
          </div>
        </div>
      </header>

      {hasAny ? (
        <table className="cts-table">
          <thead>
            <tr>
              <th className="cts-th-day">
                <div className="cts-day-inner">
                  <div className="cts-day-ic">
                    <CalendarDays size={32} color="#fff" />
                  </div>
                  <div>
                    <div className="cts-day-name">Maalinta</div>
                    <div className="cts-day-en">(Day)</div>
                  </div>
                </div>
              </th>
              {columns.map((c) => (
                <th key={c.idx} className="cts-th-period">
                  <div className="cts-pn">
                    <Clock size={24} color="#fff" strokeWidth={2.4} />
                    {ordinal(c.idx + 1)}
                  </div>
                  <div className="cts-pt">
                    {c.uniform ? `${fmt12(c.start)} – ${fmt12(c.end)}` : "Waqti kala duwan"}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <th className="cts-day">
                  <div className="cts-day-inner">
                    <div className="cts-day-ic">
                      <CalendarDays size={32} color="#fff" />
                    </div>
                    <div style={{ textAlign: "left" }}>
                      <div className="cts-day-name">{r.so}</div>
                      <div className="cts-day-en">({r.label})</div>
                    </div>
                  </div>
                </th>
                {columns.map((c) => {
                  const s = r.sessions[c.idx];
                  if (!s) {
                    return (
                      <td key={c.idx} className="cts-cell">
                        <span className="cts-empty">—</span>
                      </td>
                    );
                  }
                  const teacher = teacherNameOf(s);
                  return (
                    <td key={c.idx} className="cts-cell">
                      <div className="cts-cell-row">
                        <SubjectIcon subject={s.subject} />
                        <span className="cts-subject">{s.subject || "—"}</span>
                      </div>
                      <div className="cts-teacher">Macalin: {teacher || "—"}</div>
                      {!c.uniform && <div className="cts-ctime">{fmtRange(s.startTime, s.endTime)}</div>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="cts-nodata">Fasalkan weli jadwal xiisadeed looma samayn.</div>
      )}

      <footer className="cts-footer">
        <div className="cts-foot-green">
          <GraduationCap size={54} strokeWidth={1.8} />
          <div>
            <b>Dugsiga Rising Star</b>
            <span>Waxbarasho tayo leh &nbsp;•&nbsp; Mustaqbal ifaya</span>
          </div>
        </div>
        <div className="cts-foot-goal">
          <Target size={52} color={C.green} strokeWidth={2} />
          <div>
            <b>Ujeedada Maalintan:</b>
            <div>
              <Check size={18} color={C.blue} strokeWidth={3} /> Ardaydu waa inay yimaadaan waqtiga saxda ah.
            </div>
            <div>
              <Check size={18} color={C.blue} strokeWidth={3} /> Maalin kasta waxaa la qaataa{" "}
              {hasAny ? periods : "—"} xiisadood.
            </div>
          </div>
        </div>
        <div className="cts-foot-sign">
          Nabad • Aqoon • Guul
          <small>
            {dayStart && dayEnd ? `Waqtiga: ${fmt12(dayStart)} ${ampm(dayStart)} – ${fmt12(dayEnd)} ${ampm(dayEnd)} · ` : ""}
            La daabacay: {new Date().toLocaleDateString("en-GB")}
          </small>
        </div>
      </footer>
    </div>
  );
}

// Warqadda ku yaree si ay ugu filnaato ballaca meesha (mobile / panel yar).
// Qaybta gudaha had iyo jeer waa "absolute", sidaas darteed cabbirkeedu
// saameyn kuma laha ballaca meesha — taas ayaa ka hortagta wareeg cabbir-qaadis ah.
export function FitToWidth({ width = SHEET_WIDTH, children, maxScale = 1 }) {
  const outerRef = useRef(null);
  const innerRef = useRef(null);
  const [box, setBox] = useState({ scale: 1, height: 0 });

  useLayoutEffect(() => {
    const measure = () => {
      const outer = outerRef.current;
      const inner = innerRef.current;
      if (!outer || !inner) return;
      const w = outer.clientWidth;
      if (!w) return;
      const scale = Math.min(maxScale, w / width);
      const height = Math.round(inner.offsetHeight * scale);
      setBox((prev) =>
        Math.abs(prev.scale - scale) < 0.001 && Math.abs(prev.height - height) < 1 ? prev : { scale, height }
      );
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const ro = new ResizeObserver(() => window.requestAnimationFrame(measure));
    if (outerRef.current) ro.observe(outerRef.current);
    if (innerRef.current) ro.observe(innerRef.current);
    return () => ro.disconnect();
  }, [width, maxScale]);

  return (
    <div ref={outerRef} style={{ width: "100%", height: box.height || 200, overflow: "hidden", position: "relative" }}>
      <div
        ref={innerRef}
        style={{
          width,
          transform: `scale(${box.scale})`,
          transformOrigin: "top left",
          position: "absolute",
          top: 0,
          left: 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}