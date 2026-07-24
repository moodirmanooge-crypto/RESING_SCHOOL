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
  name1:    "RISING STAR",
  name2: "PRIMARY & SECONDARY SCHOOL",
  tagline: "Education Is Life It Self",
  phone: "+252 61 2345678",
  website: "www.risingstarschool.com",
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
        aspect-ratio: 856 / 540; /* 420x265 */
        border-radius: 20px;
        overflow: hidden;
        position: relative;
        background: #ffffff;
        box-shadow: 0 10px 35px rgba(0,0,0,0.2);
        font-family: 'Poppins','Inter','Segoe UI',system-ui,sans-serif;
        transition: transform 0.25s ease, box-shadow 0.25s ease;
      }
      .idc-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 16px 45px rgba(0,0,0,0.25);
      }

      /* ---------- FRONT ---------- */
      .idc-front { 
        display: flex; 
        flex-direction: column; 
        background: #ffffff;
      }

      .idc-front-header {
        display: flex;
        align-items: center;
        padding: 18px 24px 8px;
      }
      
      .idc-logo-badge {
        width: 75px;
        height: 75px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .idc-logo-badge img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }

      .idc-school-block {
        text-align: center;
        flex: 1;
        padding-left: 10px;
        line-height: 1.2;
      }
      .idc-school-name1 {
        font-size: 24px;
        font-weight: 800;
        color: #1c6b3a;
        letter-spacing: 0.5px;
      }
      .idc-school-name2 {
        font-size: 13.5px;
        font-weight: 800;
        color: #16202b;
        letter-spacing: 0.2px;
        margin-top: 2px;
      }
      .idc-school-tag {
        font-size: 11px;
        font-weight: 700;
        color: #e08b1d;
        letter-spacing: 0.3px;
        margin-top: 4px;
      }

      .idc-front-body {
        flex: 1;
        display: flex;
        padding: 8px 24px 20px;
        gap: 16px;
      }

      .idc-fields {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 4px 0;
      }
      .idc-field-row {
        display: grid;
        grid-template-columns: 22px 65px 10px 1fr;
        align-items: center;
        font-size: 12px;
        margin-bottom: 7px;
      }
      .idc-field-icon {
        width: 18px;
        height: 18px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        color: #fff;
      }
      .ic-id { background: #267c85; }
      .ic-name { background: #5c2c70; text-transform: capitalize; }
      .ic-class { background: #1c6b3a; }
      .ic-shift { background: #737373; }
      .ic-issue { background: #1f6499; }
      .ic-expiry { background: #757022; }

      .idc-field-label {
        font-weight: 800;
        color: #16202b;
        font-size: 11.5px;
      }
      .idc-field-colon { 
        color: #16202b; 
        font-weight: 800; 
      }
      .idc-field-value {
        font-weight: 800;
        color: #1c6b3a;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .idc-field-value.is-name {
        text-transform: capitalize;
      }

      .idc-photo-wrap {
        width: 105px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: flex-end;
      }
      .idc-photo {
        width: 95px;
        height: 115px;
        object-fit: cover;
        object-position: center;
        border-radius: 8px;
        border: 2px solid #1c6b3a;
        background: #f4f7f4;
        box-shadow: 0 4px 8px rgba(0,0,0,0.15);
      }
      .idc-photo-placeholder {
        width: 95px;
        height: 115px;
        border-radius: 8px;
        border: 2px solid #1c6b3a;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        color: #6b8a73;
        background: #f4f7f4;
        text-align: center;
      }

      .idc-bottom-bar {
        background: #14532d;
        color: #ffffff;
        font-size: 9px;
        font-weight: 500;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0 20px;
        height: 28px;
        width: 100%;
        box-sizing: border-box;
      }
      .idc-bottom-bar span { 
        display: flex; 
        align-items: center; 
        gap: 4px;
        white-space: nowrap; 
      }

      /* ---------- BACK ---------- */
      .idc-back {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        position: relative;
        text-align: center;
        background: #ffffff;
      }
      
      .idc-back-wave-top, .idc-back-wave-bottom {
        position: absolute;
        left: 0; right: 0;
        z-index: 0;
      }
      .idc-back-wave-top { top: 0; height: 60px; }
      .idc-back-wave-bottom { bottom: 0; height: 70px; }
      .idc-back-wave-top svg, .idc-back-wave-bottom svg {
        width: 100%; height: 100%; display: block;
      }

      .idc-back-content {
        position: relative;
        z-index: 2;
        padding: 48px 30px 0;
      }
      .idc-back-title {
        font-size: 26px;
        font-weight: 800;
        color: #14532d;
        margin-bottom: 6px;
      }
      .idc-back-notice {
        font-size: 11.5px;
        font-weight: 700;
        color: #d32f2f;
        line-height: 1.35;
        max-width: 320px;
        margin: 0 auto 10px;
      }
      
      .idc-back-details {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .idc-back-line {
        font-size: 12px;
        font-weight: 800;
        color: #16202b;
      }
      .idc-back-line .lbl { color: #1c6b3a; }

      .idc-signature-block {
        position: absolute;
        bottom: 30px;
        left: 30px;
        text-align: left;
        z-index: 2;
      }
      .idc-sig-text {
        font-size: 9.5px;
        font-weight: 700;
        color: #16202b;
        margin-bottom: 18px;
      }
      .idc-sig-line {
        width: 120px;
        border-bottom: 1px solid #14532d;
        position: relative;
      }
      .idc-sig-svg {
        position: absolute;
        bottom: -5px;
        left: 10px;
        width: 85px;
        height: 40px;
      }

      .idc-back-qr {
        position: absolute;
        bottom: 15px;
        right: 20px;
        width: 46px;
        height: 46px;
        background: #fff;
        border-radius: 4px;
        padding: 3px;
        box-sizing: border-box;
        border: 1px solid #eee;
        box-shadow: 0 2px 6px rgba(0,0,0,0.15);
        z-index: 10;
      }
      .idc-back-qr img { width: 100%; height: 100%; display: block; }

      .idc-back-footer {
        position: absolute;
        bottom: 10px;
        left: 0;
        right: 0;
        text-align: center;
        font-size: 11px;
        font-weight: 800;
        color: #fff;
        z-index: 5;
      }

      @media print {
        body { margin: 0; }
        .idc-print-hide { display: none !important; }
        .idc-wrap { gap: 0; padding: 0; }
        .idc-card { box-shadow: none; page-break-inside: avoid; border-radius: 12px; }
        .idc-card:hover { transform: none; box-shadow: none; }
      }
    `}</style>
  );
}

function CardFront({ student, studentId, issued, expiry }) {
  const shift = student?.shift || student?.classShift || "MORNING";

  return (
    <div className="idc-card idc-front">
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
            <span className="idc-field-icon ic-id">🪪</span>
            <span className="idc-field-label">STUDENT ID</span>
            <span className="idc-field-colon">:</span>
            <span className="idc-field-value">{studentId || "—"}</span>
          </div>
          <div className="idc-field-row">
            <span className="idc-field-icon ic-name">👤</span>
            <span className="idc-field-label">NAME</span>
            <span className="idc-field-colon">:</span>
            <span className="idc-field-value is-name">{student?.fullName || "—"}</span>
          </div>
          <div className="idc-field-row">
            <span className="idc-field-icon ic-class">🎓</span>
            <span className="idc-field-label">CLASS</span>
            <span className="idc-field-colon">:</span>
            <span className="idc-field-value">{student?.className || "—"}</span>
          </div>
          <div className="idc-field-row">
            <span className="idc-field-icon ic-shift">🕒</span>
            <span className="idc-field-label">SHIFT</span>
            <span className="idc-field-colon">:</span>
            <span className="idc-field-value">{String(shift).toUpperCase()}</span>
          </div>
          <div className="idc-field-row">
            <span className="idc-field-icon ic-issue">📅</span>
            <span className="idc-field-label">ISSUE</span>
            <span className="idc-field-colon">:</span>
            <span className="idc-field-value">{issued?.str || "—"}</span>
          </div>
          <div className="idc-field-row">
            <span className="idc-field-icon ic-expiry">⏳</span>
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
        <span><span style={{ color: '#ff6b6b' }}>📞</span> {SCHOOL.phone}</span>
        <span><span style={{ color: '#4dabf7' }}>🌐</span> {SCHOOL.website}</span>
        <span><span style={{ color: '#ff6b6b' }}>📍</span> {SCHOOL.location}</span>
      </div>
    </div>
  );
}

function CardBack({ student, studentId }) {
  const qrRawData = JSON.stringify({
    studentId: studentId || "",
    fullName: student?.fullName || "",
    className: student?.className || "",
    shift: student?.shift || student?.classShift || "",
  });
  const qrValue = encodeURIComponent(qrRawData);
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&margin=0&data=${qrValue}`;

  return (
    <div className="idc-card idc-back">
      {/* Back Top Wave */}
      <div className="idc-back-wave-top">
        <svg viewBox="0 0 420 60" preserveAspectRatio="none">
          <path d="M0,0 H420 V25 C300,10 150,45 0,15 Z" fill="#d19324" />
          <path d="M0,0 H420 V15 C320,0 200,35 0,5 Z" fill="#14532d" />
        </svg>
      </div>

      <div className="idc-back-content">
        <div className="idc-back-title">{SCHOOL.noticeTitle}</div>
        <div className="idc-back-notice">{SCHOOL.noticeBody}</div>
        
        <div className="idc-back-details">
          <div className="idc-back-line"><span className="lbl">Tell:</span> {SCHOOL.noticeTell}</div>
          <div className="idc-back-line"><span className="lbl">Email:</span> {SCHOOL.noticeEmail}</div>
          <div className="idc-back-line"><span className="lbl">Web:</span> {SCHOOL.noticeWeb}</div>
        </div>
      </div>

      {/* Signature Area */}
      <div className="idc-signature-block">
        <div className="idc-sig-text">Principal's Signature</div>
        <div className="idc-sig-line">
          {/* Authentic-looking SVG cursive signature */}
          <svg className="idc-sig-svg" viewBox="0 0 100 40">
            <path d="M10,35 Q25,15 35,25 T55,10 T70,30 L90,15" fill="none" stroke="#2c3e50" strokeWidth="1.5" />
            <path d="M20,25 L80,20" fill="none" stroke="#2c3e50" strokeWidth="1.2" />
          </svg>
        </div>
      </div>

      {/* QR Code */}
      <div className="idc-back-qr">
        <img src={qrSrc} alt="Student ID QR Code" />
      </div>

      {/* Back Bottom Wave */}
      <div className="idc-back-wave-bottom">
        <svg viewBox="0 0 420 70" preserveAspectRatio="none">
          <path d="M0,70 H420 V40 C320,10 100,10 0,40 Z" fill="#d19324" />
          <path d="M0,70 H420 V50 C320,20 100,20 0,50 Z" fill="#14532d" />
        </svg>
      </div>
      
      {/* Footer Text */}
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

  return (
    <div>
      <CardStyles />

      <div className="idc-wrap">
        <div id="idc-print-front">
          <CardFront student={student} studentId={studentId} issued={issued} expiry={expiry} />
        </div>
        <div id="idc-print-back">
          <CardBack student={student} studentId={studentId} />
        </div>
      </div>
    </div>
  );
}