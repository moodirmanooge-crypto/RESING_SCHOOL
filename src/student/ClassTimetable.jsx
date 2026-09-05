// src/student/ClassTimetable.jsx
import React, { useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";

/**
 * ClassTimetable
 * -----------------------------------------------------------------------
 * Dark "Student Portal" timetable screen with day tabs and a Download
 * button. Downloading takes an ACTUAL screenshot (PNG) of the currently
 * visible timetable card using html2canvas — so whatever day/table the
 * student is looking at is exactly what gets saved, pixel-for-pixel.
 * -----------------------------------------------------------------------
 */

const DAYS = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];

const PERIOD_COLORS = [
  "#6C5CE7", // 1 - purple
  "#E64980", // 2 - pink
  "#00B8A9", // 3 - teal
  "#2FB170", // 4 - green
  "#D4A72C", // 5 - gold
  "#E67E22", // 6 - orange
];

function CalendarIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function DownloadIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function ClockIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

function ArrowIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function InfoIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8v.01" />
    </svg>
  );
}

function CardStyles() {
  return (
    <style>{`
      .ctt-page {
        min-height: 100%;
        background: #0d1117;
        color: #e6e8ee;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
        padding-bottom: 24px;
      }

      .ctt-card {
        background: #10151d;
        border-radius: 16px;
        border: 1px solid rgba(255,255,255,0.06);
        padding: 18px 16px 20px;
        margin: 0 16px 16px;
      }

      .ctt-header-row {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 4px;
      }

      .ctt-icon-badge {
        width: 40px;
        height: 40px;
        min-width: 40px;
        border-radius: 12px;
        background: linear-gradient(135deg, #7c6cf0, #5b4fd6);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
      }

      .ctt-title {
        font-size: 18px;
        font-weight: 800;
        color: #f4f5f8;
      }

      .ctt-controls-row {
        display: flex;
        gap: 10px;
        margin: 14px 0 14px;
      }

      .ctt-year-pill {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 8px;
        background: #171d27;
        border: 1px solid rgba(255,255,255,0.07);
        border-radius: 10px;
        padding: 10px 12px;
        font-size: 13px;
        color: #b7bdc9;
      }

      .ctt-download-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        background: linear-gradient(135deg, #7c6cf0, #5b4fd6);
        border: none;
        border-radius: 10px;
        padding: 10px 16px;
        color: #fff;
        font-weight: 700;
        font-size: 13.5px;
        cursor: pointer;
      }

      .ctt-download-btn:disabled {
        opacity: 0.6;
        cursor: default;
      }

      .ctt-tabs-row {
        display: flex;
        gap: 8px;
        overflow-x: auto;
        padding-bottom: 6px;
        margin-bottom: 14px;
        scrollbar-width: none;
      }
      .ctt-tabs-row::-webkit-scrollbar { display: none; }

      .ctt-tab {
        display: flex;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
        padding: 9px 14px;
        border-radius: 10px;
        font-size: 13.5px;
        font-weight: 600;
        border: 1px solid rgba(255,255,255,0.08);
        background: #171d27;
        color: #9aa1ae;
        cursor: pointer;
      }

      .ctt-tab.active {
        background: rgba(47,177,112,0.15);
        border-color: #2fb170;
        color: #4ade9b;
      }

      .ctt-tab .dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #4ade9b;
        margin-left: 2px;
      }

      /* --- Snapshot target: this is exactly what gets exported as PNG --- */
      .ctt-snapshot {
        background: #10151d;
        border-radius: 14px;
        border: 1px solid rgba(255,255,255,0.06);
        overflow: hidden;
      }

      .ctt-table-head {
        display: grid;
        grid-template-columns: 40px 1fr 1fr;
        padding: 14px 16px;
        font-size: 12.5px;
        font-weight: 700;
        letter-spacing: 0.4px;
        color: #7d8494;
        border-bottom: 1px solid rgba(255,255,255,0.06);
      }

      .ctt-row {
        display: grid;
        grid-template-columns: 40px 1fr 1fr;
        align-items: center;
        padding: 14px 16px;
        border-bottom: 1px solid rgba(255,255,255,0.05);
      }
      .ctt-row:last-of-type { border-bottom: none; }

      .ctt-period-badge {
        width: 26px;
        height: 26px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-weight: 800;
        font-size: 13px;
      }

      .ctt-time-cell {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 15px;
        font-weight: 600;
        color: #eef0f4;
      }

      .ctt-time-cell .ctt-clock-wrap {
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: #1c2330;
        color: #cfd3dc;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .ctt-time-end-cell {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .ctt-arrow-wrap {
        width: 18px;
        height: 18px;
        color: #6a7180;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .ctt-note-box {
        display: flex;
        gap: 10px;
        align-items: flex-start;
        background: rgba(124,108,240,0.10);
        border: 1px solid rgba(124,108,240,0.25);
        border-radius: 10px;
        padding: 12px 14px;
        margin-top: 14px;
        font-size: 13px;
        color: #b9bdd8;
        line-height: 1.4;
      }

      .ctt-note-box svg { flex-shrink: 0; margin-top: 1px; color: #a79cf5; }

      .ctt-empty {
        padding: 32px 16px;
        text-align: center;
        color: #7d8494;
        font-size: 14px;
      }

      .ctt-watermark {
        text-align: center;
        padding: 10px 0 2px;
        font-size: 11px;
        color: #4c5261;
      }

      .ctt-toast {
        position: fixed;
        left: 50%;
        bottom: 28px;
        transform: translateX(-50%);
        background: #171d27;
        border: 1px solid rgba(255,255,255,0.1);
        color: #eef0f4;
        padding: 10px 16px;
        border-radius: 10px;
        font-size: 13px;
        z-index: 50;
      }
      .ctt-toast.error { border-color: #e64949; color: #ff9d9d; }
    `}</style>
  );
}

/**
 * Downloads a DOM node as a PNG image.
 * Uses html2canvas to actually rasterize the visible timetable card,
 * so the file the student gets is a real screenshot, not a text export.
 */
async function downloadNodeAsImage(node, filename) {
  const canvas = await html2canvas(node, {
    backgroundColor: "#10151d",
    scale: Math.min(window.devicePixelRatio || 1, 3) || 2,
    useCORS: true,
  });

  const dataUrl = canvas.toDataURL("image/png");

  // Trigger a normal browser file download.
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function ClassTimetable({
  className = "7",
  academicYear = "2024/2025",
  schedule = {},
}) {
  const [activeDay, setActiveDay] = useState(DAYS[0]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [toast, setToast] = useState(null);
  const snapshotRef = useRef(null);

  const periods = useMemo(() => schedule[activeDay] || [], [schedule, activeDay]);

  const handleDownload = async () => {
    if (!snapshotRef.current || isDownloading) return;
    setIsDownloading(true);
    setToast(null);
    try {
      const safeDay = activeDay.toLowerCase();
      const safeClass = String(className).toLowerCase();
      await downloadNodeAsImage(
        snapshotRef.current,
        `timetable-grade-${safeClass}-${safeDay}.png`
      );
      setToast({ type: "ok", text: "Timetable saved as image." });
    } catch (err) {
      console.error("Timetable download failed:", err);
      setToast({ type: "error", text: "Could not save the image. Please try again." });
    } finally {
      setIsDownloading(false);
      setTimeout(() => setToast(null), 2500);
    }
  };

  return (
    <div className="ctt-page">
      <CardStyles />

      <div className="ctt-card">
        <div className="ctt-header-row">
          <div className="ctt-icon-badge">
            <CalendarIcon />
          </div>
          <div className="ctt-title">Class Timetable – {className}</div>
        </div>

        <div className="ctt-controls-row">
          <div className="ctt-year-pill">
            <CalendarIcon width="14" height="14" />
            <span>Academic Year {academicYear}</span>
          </div>

          <button
            className="ctt-download-btn"
            onClick={handleDownload}
            disabled={isDownloading || periods.length === 0}
          >
            <DownloadIcon />
            {isDownloading ? "Saving..." : "Download"}
          </button>
        </div>

        <div className="ctt-tabs-row">
          {DAYS.map((day) => {
            const hasClasses = (schedule[day] || []).length > 0;
            return (
              <button
                key={day}
                className={`ctt-tab${day === activeDay ? " active" : ""}`}
                onClick={() => setActiveDay(day)}
              >
                <CalendarIcon width="14" height="14" />
                {day}
                {hasClasses && <span className="dot" />}
              </button>
            );
          })}
        </div>

        {/* Everything inside ctt-snapshot is exactly what gets exported. */}
        <div className="ctt-snapshot" ref={snapshotRef}>
          <div className="ctt-table-head">
            <span>#</span>
            <span>START</span>
            <span>END</span>
          </div>

          {periods.length === 0 ? (
            <div className="ctt-empty">No classes scheduled for {activeDay}.</div>
          ) : (
            periods.map((p, idx) => {
              const color = PERIOD_COLORS[(p.period - 1) % PERIOD_COLORS.length];
              return (
                <div className="ctt-row" key={`${activeDay}-${p.period}-${idx}`}>
                  <span className="ctt-period-badge" style={{ background: color }}>
                    {p.period}
                  </span>
                  <span className="ctt-time-cell">
                    <span className="ctt-clock-wrap">
                      <ClockIcon />
                    </span>
                    {p.start}
                  </span>
                  <span className="ctt-time-end-cell">
                    <span className="ctt-arrow-wrap">
                      <ArrowIcon />
                    </span>
                    <span className="ctt-time-cell">
                      <span className="ctt-clock-wrap">
                        <ClockIcon />
                      </span>
                      {p.end}
                    </span>
                  </span>
                </div>
              );
            })
          )}

          <div className="ctt-watermark">Rising School · Student Portal</div>
        </div>

        <div className="ctt-note-box">
          <InfoIcon />
          <span>Timetable is subject to change. Please check regularly for updates.</span>
        </div>
      </div>

      {toast && (
        <div className={`ctt-toast${toast.type === "error" ? " error" : ""}`}>
          {toast.text}
        </div>
      )}
    </div>
  );
}

/**
 * Example schedule shape (pass this in as the `schedule` prop):
 *
 * const schedule = {
 *   Saturday: [
 *     { period: 1, start: "07:30", end: "08:15" },
 *     { period: 3, start: "08:45", end: "09:30" },
 *     { period: 4, start: "09:30", end: "10:00" },
 *     { period: 5, start: "10:00", end: "10:30" },
 *     { period: 6, start: "11:00", end: "11:30" },
 *     { period: 2, start: "20:15", end: "20:45" },
 *   ],
 *   Sunday: [ ... ],
 *   Monday: [ ... ],
 * };
 */