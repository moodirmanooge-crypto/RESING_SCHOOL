// src/student/StudentIdCard.jsx
// Renders the official Rising Star School Student ID card — front + back —
// matching the printed reference design exactly. Pulls all data from the
// student's own Firestore record (fullName, studentId, className, shift,
// studentPhoto); nothing is typed here. Includes a "Print ID Card" button
// that opens a clean print window with both sides, sized for a standard
// CR80 card (85.6mm x 54mm) at 300dpi print scale.
//
// On first render (if no card doc exists yet), the full student record is
// duplicated into the `studentIdCards` Firestore collection, keyed by
// studentId, so issued cards have their own persistent snapshot.

import { useEffect, useState } from "react";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import schoolLogo from "../assets/rising-star-logo.png";

const SCHOOL = {
  name1: "RISING STAR",
  name2: "SCHOOL",
  tagline: "Education Is Life It Self",
  phone: "+252 61 2345678",
  website: "www.risingstarschool.so",
  location: "Mogadishu, Somalia",
  noticeTitle: "NB",
  noticeBody:
    "If you accidently find this card, please contact the following address.",
  noticeTell: "+252-61 7390261",
  noticeEmail: "risingstar0261@gmail.com",
  noticeWeb: "resingstarschools.com",
  officeLabel: "Admission & Student Affairs Office",
};

function formatDate(d) {
  if (!d) return null;
  const dateObj = d?.seconds ? new Date(d.seconds * 1000) : new Date(d);
  if (isNaN(dateObj.getTime())) return null;
  const day = String(dateObj.getDate()).padStart(2, "0");
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const year = dateObj.getFullYear();
  return { day, month, year, str: `${day}/${month}/${year}` };
}

// ID cards are valid for exactly one year from the issue date.
function formatExpiry(d) {
  if (!d) return null;
  const dateObj = d?.seconds ? new Date(d.seconds * 1000) : new Date(d);
  if (isNaN(dateObj.getTime())) return null;
  const expiryObj = new Date(dateObj);
  expiryObj.setFullYear(expiryObj.getFullYear() + 1);
  const day = String(expiryObj.getDate()).padStart(2, "0");
  const month = String(expiryObj.getMonth() + 1).padStart(2, "0");
  const year = expiryObj.getFullYear();
  return { day, month, year, str: `${day}/${month}/${year}` };
}

function CardStyles() {
  return (
    <style>{`
      .idc-wrap {
        display: flex;
        flex-wrap: wrap;
        gap: 28px;
        justify-content: center;
        padding: 24px 0;
      }

      .idc-card {
        width: 420px;
        max-width: 100%;
        aspect-ratio: 856 / 540;
        border-radius: 18px;
        overflow: hidden;
        position: relative;
        background: #ffffff;
        box-shadow: 0 18px 44px rgba(0,0,0,0.35);
        font-family: 'Poppins','Inter','Segoe UI',system-ui,sans-serif;
        transition: transform 0.25s ease, box-shadow 0.25s ease;
      }
      .idc-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 24px 54px rgba(0,0,0,0.4);
      }

      /* ---------- FRONT ---------- */
      .idc-front { display: flex; flex-direction: column; }

      .idc-wave-top {
        position: absolute;
        top: 0; left: 0; right: 0;
        height: 46%;
        background: #ffffff;
        overflow: hidden;
      }
      .idc-wave-top svg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }

      .idc-front-header {
        position: relative;
        z-index: 2;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px 18px 6px;
      }
      .idc-logo-badge {
        width: 54px;
        height: 54px;
        min-width: 54px;
        min-height: 54px;
        border-radius: 50%;
        background: #fff;
        border: 2px solid #1c6b3a;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        overflow: hidden;
        box-shadow: 0 2px 6px rgba(0,0,0,0.15);
        box-sizing: border-box;
      }
      .idc-logo-badge img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 50%;
        display: block;
      }
      .idc-school-block { line-height: 1.05; }
      .idc-school-name1 {
        font-size: 19px;
        font-weight: 800;
        color: #1c6b3a;
        letter-spacing: 0.3px;
      }
      .idc-school-name2 {
        font-size: 15px;
        font-weight: 700;
        color: #16202b;
        letter-spacing: 3px;
      }
      .idc-school-tag {
        font-size: 8.5px;
        font-weight: 700;
        color: #e08b1d;
        letter-spacing: 0.4px;
        margin-top: 2px;
      }

      .idc-front-body {
        position: relative;
        z-index: 2;
        flex: 1;
        display: flex;
        padding: 8px 18px 0;
        gap: 10px;
      }

      .idc-fields {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 6px;
        min-width: 0;
      }
      .idc-field-row {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 11px;
      }
      .idc-field-icon {
        width: 18px;
        height: 18px;
        border-radius: 5px;
        background: #1c6b3a;
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        flex-shrink: 0;
      }
      .idc-field-label {
        font-weight: 700;
        color: #16202b;
        min-width: 46px;
        letter-spacing: 0.2px;
      }
      .idc-field-colon { color: #16202b; font-weight: 700; }
      .idc-field-value {
        font-weight: 700;
        color: #1c6b3a;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .idc-photo-wrap {
        width: 88px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .idc-photo {
        width: 84px;
        height: 100px;
        object-fit: cover;
        border-radius: 8px;
        border: 2px solid #1c6b3a;
        background: #eef3ee;
        box-shadow: 0 4px 10px rgba(0,0,0,0.18);
      }
      .idc-photo-placeholder {
        width: 84px;
        height: 100px;
        border-radius: 8px;
        border: 2px solid #1c6b3a;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 9px;
        color: #6b8a73;
        text-align: center;
        padding: 4px;
        background: #eef3ee;
      }

      .idc-front-footer {
        position: relative;
        z-index: 2;
        background: #1c6b3a;
        margin-top: auto;
        padding: 8px 18px 10px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        width: 100%;
        box-sizing: border-box;
      }
      .idc-qr {
        width: 46px;
        height: 46px;
        min-width: 46px;
        background: #fff;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 3px;
        box-sizing: border-box;
      }
      .idc-qr img { width: 100%; height: 100%; }
      .idc-signature {
        text-align: right;
      }
      .idc-signature-line {
        font-family: 'Brush Script MT', cursive;
        font-size: 20px;
        color: #fff;
        line-height: 1;
      }
      .idc-signature-label {
        font-size: 8.5px;
        font-weight: 700;
        color: #fdf3e0;
        letter-spacing: 1px;
        margin-top: 2px;
      }

      .idc-bottom-bar {
        background: #14532d;
        color: #eafaf0;
        font-size: 8px;
        display: flex;
        justify-content: space-around;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        flex-wrap: wrap;
        text-align: center;
      }
      .idc-bottom-bar span { white-space: nowrap; }

      /* ---------- BACK ---------- */
      .idc-back {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        position: relative;
        color: #16202b;
        text-align: center;
      }
      .idc-back-wave-top, .idc-back-wave-bottom {
        position: absolute;
        left: 0; right: 0;
        height: 60px;
        overflow: hidden;
        z-index: 0;
      }
      .idc-back-wave-top { top: 0; }
      .idc-back-wave-bottom { bottom: 0; }
      .idc-back-wave-top svg, .idc-back-wave-bottom svg {
        width: 100%; height: 100%;
      }

      .idc-back-content {
        position: relative;
        z-index: 2;
        padding: 26px 30px 0;
      }
      .idc-back-title {
        font-size: 26px;
        font-weight: 800;
        color: #14532d;
        margin-bottom: 14px;
      }
      .idc-back-notice {
        font-size: 12px;
        font-weight: 700;
        color: #c0392b;
        line-height: 1.5;
        max-width: 320px;
        margin: 0 auto 14px;
      }
      .idc-back-line {
        font-size: 12.5px;
        font-weight: 700;
        margin: 5px 0;
        color: #16202b;
      }
      .idc-back-line b { color: #14532d; }

      .idc-back-footer {
        position: relative;
        z-index: 2;
        font-size: 12px;
        font-weight: 800;
        color: #fff;
        padding: 10px 12px 14px;
      }

      @media print {
        body { margin: 0; }
        .idc-print-hide { display: none !important; }
        .idc-wrap { gap: 0; padding: 0; }
        .idc-card { box-shadow: none; page-break-inside: avoid; }
        .idc-card:hover { transform: none; box-shadow: none; }
      }
    `}</style>
  );
}

function Wave({ variant = "front-top" }) {
  if (variant === "front-top") {
    return (
      <svg viewBox="0 0 420 210" preserveAspectRatio="none">
        <path d="M0,0 H420 V150 C320,190 260,120 180,150 C100,180 60,140 0,170 Z" fill="#14532d" />
        <path d="M0,0 H420 V165 C330,195 270,140 190,165 C110,190 60,155 0,180 Z" fill="#f5a623" opacity="0.9" />
        <path d="M0,0 H420 V178 C340,200 280,160 200,178 C120,196 70,168 0,190 Z" fill="#ffffff" />
      </svg>
    );
  }
  if (variant === "back-top") {
    return (
      <svg viewBox="0 0 420 60" preserveAspectRatio="none">
        <path d="M0,0 H420 V20 C320,45 260,10 180,25 C100,40 60,15 0,30 Z" fill="#14532d" />
        <path d="M0,0 H420 V12 C330,30 270,5 190,15 C110,25 60,8 0,18 Z" fill="#f5a623" opacity="0.9" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 420 60" preserveAspectRatio="none">
      <path d="M0,60 H420 V25 C320,5 260,40 180,28 C100,16 60,45 0,32 Z" fill="#14532d" />
      <path d="M0,60 H420 V38 C330,20 270,50 190,40 C110,30 60,50 0,42 Z" fill="#1c6b3a" opacity="0.85" />
    </svg>
  );
}

function CardFront({ student, studentId, issued, expiry }) {
  const shift = student?.shift || student?.classShift || "MORNING";
  const qrValue = encodeURIComponent(
    `Rising Star School | Student ID: ${studentId} | Name: ${student?.fullName || ""} | Class: ${student?.className || ""}`
  );
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=0&data=${qrValue}`;

  return (
    <div className="idc-card idc-front">
      <div className="idc-wave-top">
        <Wave variant="front-top" />
      </div>

      <div className="idc-front-header">
        <div className="idc-logo-badge">
          <img src={schoolLogo} alt="Rising Star School logo" />
        </div>
        <div className="idc-school-block">
          <div className="idc-school-name1">{SCHOOL.name1}</div>
          <div className="idc-school-name2">{SCHOOL.name2}</div>
          <div className="idc-school-tag">{SCHOOL.tagline}</div>
        </div>
      </div>

      <div className="idc-front-body">
        <div className="idc-fields">
          <div className="idc-field-row">
            <span className="idc-field-icon">🪪</span>
            <span className="idc-field-label">STUDENT ID</span>
            <span className="idc-field-colon">:</span>
            <span className="idc-field-value">{studentId || "—"}</span>
          </div>
          <div className="idc-field-row">
            <span className="idc-field-icon">👤</span>
            <span className="idc-field-label">NAME</span>
            <span className="idc-field-colon">:</span>
            <span className="idc-field-value">{student?.fullName || "—"}</span>
          </div>
          <div className="idc-field-row">
            <span className="idc-field-icon">🎓</span>
            <span className="idc-field-label">CLASS</span>
            <span className="idc-field-colon">:</span>
            <span className="idc-field-value">{student?.className || "—"}</span>
          </div>
          <div className="idc-field-row">
            <span className="idc-field-icon">🕒</span>
            <span className="idc-field-label">SHIFT</span>
            <span className="idc-field-colon">:</span>
            <span className="idc-field-value">{String(shift).toUpperCase()}</span>
          </div>
          <div className="idc-field-row">
            <span className="idc-field-icon">📅</span>
            <span className="idc-field-label">ISSUE</span>
            <span className="idc-field-colon">:</span>
            <span className="idc-field-value">{issued?.str || "—"}</span>
          </div>
          <div className="idc-field-row">
            <span className="idc-field-icon">⏳</span>
            <span className="idc-field-label">EXPIRY</span>
            <span className="idc-field-colon">:</span>
            <span className="idc-field-value">{expiry?.str || "—"}</span>
          </div>
        </div>

        <div className="idc-photo-wrap">
          {student?.studentPhoto ? (
            <img className="idc-photo" src={student.studentPhoto} alt={student.fullName || "Student"} />
          ) : (
            <div className="idc-photo-placeholder">No Photo</div>
          )}
        </div>
      </div>


      <div className="idc-bottom-bar">
        <span>📞 {SCHOOL.phone}</span>
        <span>🌐 {SCHOOL.website}</span>
        <span>📍 {SCHOOL.location}</span>
      </div>
    </div>
  );
}

function CardBack() {
  return (
    <div className="idc-card idc-back">
      <div className="idc-back-wave-top"><Wave variant="back-top" /></div>

      <div className="idc-back-content">
        <div className="idc-back-title">{SCHOOL.noticeTitle}</div>
        <div className="idc-back-notice">{SCHOOL.noticeBody}</div>
        <div className="idc-back-line"><b>Tell:</b> {SCHOOL.noticeTell}</div>
        <div className="idc-back-line"><b>Email:</b> {SCHOOL.noticeEmail}</div>
        <div className="idc-back-line"><b>Web:</b> {SCHOOL.noticeWeb}</div>
      </div>

      <div className="idc-back-wave-bottom"><Wave variant="back-bottom" /></div>
      <div className="idc-back-footer">{SCHOOL.officeLabel}</div>
    </div>
  );
}

export default function StudentIdCard({ student, studentId }) {
  const issuedSource = student?.idIssuedAt || student?.createdAt;
  const issued = formatDate(issuedSource);
  const expiry = formatExpiry(issuedSource);
  const [saving, setSaving] = useState(false);

  // Duplicate the full student record into `studentIdCards/{studentId}`
  // the first time this card is issued/viewed, so each issued card has
  // its own persistent snapshot independent of later edits to the
  // original student record.
  useEffect(() => {
    if (!studentId || !student) return;

    let cancelled = false;

    async function ensureCardRecord() {
      try {
        setSaving(true);
        const cardRef = doc(db, "studentIdCards", studentId);
        const existing = await getDoc(cardRef);
        if (!existing.exists() && !cancelled) {
          await setDoc(cardRef, {
            ...student,
            studentId,
            issuedAt: serverTimestamp(),
            idIssuedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        console.error("Failed to save studentIdCards record:", err);
      } finally {
        if (!cancelled) setSaving(false);
      }
    }

    ensureCardRecord();
    return () => {
      cancelled = true;
    };
  }, [studentId, student]);

  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "width=900,height=650");
    if (!printWindow) return;

    const frontHtml = document.getElementById("idc-print-front")?.outerHTML || "";
    const backHtml = document.getElementById("idc-print-back")?.outerHTML || "";
    const stylesHtml = Array.from(document.querySelectorAll("style"))
      .map((s) => s.outerHTML)
      .join("\n");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Student ID Card - ${student?.fullName || studentId}</title>
          <meta charset="utf-8" />
          ${stylesHtml}
          <style>
            body { margin: 0; padding: 24px; display: flex; gap: 24px; flex-wrap: wrap; justify-content: center; background: #eee; font-family: sans-serif; }
            .idc-card { box-shadow: none; }
          </style>
        </head>
        <body>
          ${frontHtml}
          ${backHtml}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  return (
    <div>
      <CardStyles />

      <div className="idc-wrap">
        <div id="idc-print-front">
          <CardFront student={student} studentId={studentId} issued={issued} expiry={expiry} />
        </div>
        <div id="idc-print-back">
          <CardBack />
        </div>
      </div>

      

    </div>
  );
}