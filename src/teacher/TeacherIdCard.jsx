// src/teacher/TeacherIdCard.jsx
// Renders the official Rising Star School Teacher ID card — front + back —
// matching the printed reference design exactly. Pulls all data straight
// from the teacher's own Firestore record (fullName, username, phone,
// subjects, createdAt, teacherPhoto). The "Teacher ID" shown on the card
// is the teacher's login username (e.g. "moodir1"), exactly as stored in
// Firestore doc id / username field — nothing is typed by the teacher.
//
// NOTE: this is the teacher's own self-view of their ID card (shown on
// their Profile page). There is intentionally no print/download control
// here — teachers can view their card but cannot print or export it.
//
// On first view (if no card doc exists yet), the full teacher record is
// duplicated into the `teacher_id` Firestore collection, keyed by the
// teacher's username, so issued cards have their own persistent snapshot.
//
// QR CODE: encodes the school's public verify page
// (https://risingstarschools.com/verify/teacher/{teacherUsername}) — NOT
// just the bare website. Scanning it opens TeacherVerify.jsx, which reads
// the teacher_id/{teacherUsername} snapshot from Firestore and displays
// the full ID card details (name, subject, phone, photo, joining date) —
// exactly the same info printed on the card itself.

import { useEffect, useState } from "react";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import schoolLogo from "../admin/assets/logo.png";
import principalSignature from "../admin/assets/signature-principal.png";

const SCHOOL = {
  name1: "RISING STAR",
  name2: "PRIMARY & SECONDARY",
  name3: "SCHOOL",
  tagline: "Teaching Today, Transforming Tomorrow",
  website: "risingstarschools.com",
  location: "Mogadishu, Somalia",
  noticeTell: "+252 61 7390261",
  noticeEmail: "risingstar0261@gmail.com",
};

function formatDate(d) {
  if (!d) return null;
  const dateObj = d?.seconds ? new Date(d.seconds * 1000) : new Date(d);
  if (isNaN(dateObj.getTime())) return null;
  const months = [
    "JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC",
  ];
  const day = String(dateObj.getDate()).padStart(2, "0");
  const month = months[dateObj.getMonth()];
  const year = dateObj.getFullYear();
  return { day, month, year, str: `${day} ${month} ${year}` };
}

function CardStyles() {
  return (
    <style>{`
      .tidc-wrap {
        display: flex;
        flex-wrap: wrap;
        gap: 34px;
        justify-content: center;
        padding: 24px 0;
      }

      .tidc-card-outer {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0;
      }

      .tidc-side-label {
        background: #14532d;
        color: #fff;
        font-weight: 800;
        font-size: 13px;
        letter-spacing: 2px;
        padding: 6px 26px;
        border-radius: 8px;
        margin-bottom: -14px;
        z-index: 3;
        position: relative;
        box-shadow: 0 4px 10px rgba(20,83,45,0.3);
      }

      .tidc-card {
        width: 400px;
        max-width: 100%;
        aspect-ratio: 640 / 780;
        border-radius: 22px;
        overflow: hidden;
        position: relative;
        background: #ffffff;
        box-shadow: 0 18px 44px rgba(0,0,0,0.28);
        font-family: 'Poppins','Inter','Segoe UI',system-ui,sans-serif;
        display: flex;
        flex-direction: column;
        border: 1px solid #eef1ee;
      }

      .tidc-band-top {
        position: absolute;
        top: 0; left: 0; right: 0;
        z-index: 0;
      }
      .tidc-band-bottom {
        position: absolute;
        bottom: 0; left: 0; right: 0;
        z-index: 0;
      }
      .tidc-band-top svg, .tidc-band-bottom svg { display: block; width: 100%; }

      .tidc-header {
        position: relative;
        z-index: 2;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        padding: 20px 22px 4px;
        text-align: center;
      }
      .tidc-logo-badge {
        width: 70px;
        height: 70px;
        border-radius: 50%;
        background: #fff;
        border: 2.5px solid #1c6b3a;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        box-shadow: 0 2px 8px rgba(0,0,0,0.12);
        position: relative;
        overflow: hidden;
        margin-bottom: 6px;
      }
      .tidc-logo-badge img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        border-radius: 50%;
      }
      .tidc-school-block { line-height: 1.1; }
      .tidc-school-name1 {
        font-size: 20px;
        font-weight: 800;
        color: #14532d;
        letter-spacing: 0.3px;
      }
      .tidc-school-name2 {
        font-size: 12px;
        font-weight: 700;
        color: #16202b;
        letter-spacing: 1.5px;
        text-transform: uppercase;
      }
      .tidc-school-name3 {
        font-size: 15px;
        font-weight: 700;
        color: #16202b;
        letter-spacing: 4px;
      }

      .tidc-title-bar {
        position: relative;
        z-index: 2;
        margin: 10px 22px 12px;
        background: #14532d;
        border-radius: 8px;
        padding: 8px 16px;
        display: flex;
        align-items: baseline;
        justify-content: center;
        gap: 7px;
        box-shadow: 0 6px 14px rgba(20,83,45,0.25);
      }
      .tidc-title-1 { color: #fff; font-weight: 700; font-size: 16px; letter-spacing: 1px; }
      .tidc-title-2 { color: #f5a623; font-weight: 800; font-size: 16px; letter-spacing: 1px; }

      .tidc-body {
        position: relative;
        z-index: 2;
        flex: 1;
        display: flex;
        padding: 0 22px;
        gap: 12px;
      }

      .tidc-fields {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        gap: 9px;
        min-width: 0;
      }
      .tidc-field-row {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        font-size: 11.5px;
      }
      .tidc-field-icon {
        width: 19px;
        height: 19px;
        border-radius: 6px;
        background: #1c6b3a;
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 9.5px;
        flex-shrink: 0;
      }
      .tidc-field-label {
        font-weight: 700;
        color: #16202b;
        min-width: 96px;
        letter-spacing: 0.2px;
        white-space: nowrap;
        font-size: 10.5px;
        flex-shrink: 0;
        padding-top: 1px;
      }
      .tidc-field-colon { color: #16202b; font-weight: 700; flex-shrink: 0; padding-top: 1px; }
      .tidc-field-value {
        font-weight: 700;
        color: #1c6b3a;
        overflow-wrap: break-word;
        word-break: break-word;
        white-space: normal;
        line-height: 1.25;
        min-width: 0;
      }

      .tidc-photo-wrap {
        width: 88px;
        flex-shrink: 0;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding-top: 2px;
      }
      .tidc-photo {
        width: 86px;
        height: 104px;
        object-fit: cover;
        border-radius: 8px;
        border: 3px solid #1c6b3a;
        background: #eef3ee;
      }
      .tidc-photo-placeholder {
        width: 86px;
        height: 104px;
        border-radius: 8px;
        border: 2px dashed #9db8a4;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 9.5px;
        color: #6b8a73;
        text-align: center;
        padding: 4px;
      }

      /* Signature is now the last element above the bottom band since the
         QR code was removed from the front (QR lives on the back only). */
      .tidc-signature {
        position: relative;
        z-index: 2;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        padding: 4px 22px 0;
        margin-top: 10px;
        margin-bottom: 18px;
      }
      .tidc-signature-img {
        width: 118px;
        height: 34px;
        object-fit: contain;
        object-position: bottom center;
      }
      .tidc-signature-line {
        width: 118px;
        border-top: 1px solid #16202b;
        margin-top: 2px;
        padding-top: 3px;
        text-align: center;
        font-size: 8.5px;
        font-weight: 700;
        color: #16202b;
        letter-spacing: 0.3px;
      }

      .tidc-footer {
        position: relative;
        z-index: 2;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 3px;
        padding: 8px 18px 6px;
        margin-top: 6px;
      }
      .tidc-qr {
        width: 54px;
        height: 54px;
        background: #fff;
        border: 1px solid #d8e3da;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 3px;
      }
      .tidc-qr img { width: 100%; height: 100%; }
      .tidc-qr-caption {
        font-size: 7.5px;
        font-weight: 700;
        color: #14532d;
        letter-spacing: 0.3px;
        text-align: center;
      }

      .tidc-slogan {
        position: relative;
        z-index: 2;
        text-align: center;
        color: #fff;
        font-weight: 700;
        font-size: 12px;
        font-style: italic;
        padding-bottom: 14px;
      }

      /* ---------- BACK ---------- */
      .tidc-back-content {
        position: relative;
        z-index: 2;
        padding: 24px 24px 0;
        flex: 1;
      }
      .tidc-back-header {
        display: flex;
        justify-content: center;
        margin-bottom: 14px;
      }
      .tidc-back-logo {
        width: 68px;
        height: 68px;
        border-radius: 50%;
        background: #fff;
        border: 2.5px solid #1c6b3a;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
      .tidc-back-logo img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        border-radius: 50%;
      }
      .tidc-section-bar {
        background: #14532d;
        color: #fff;
        font-weight: 800;
        font-size: 13px;
        letter-spacing: 0.5px;
        text-align: center;
        border-radius: 8px;
        padding: 8px 12px;
        margin-bottom: 10px;
        box-shadow: 0 6px 14px rgba(20,83,45,0.2);
      }
      .tidc-terms-list {
        list-style: none;
        margin: 0 0 16px;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .tidc-terms-list li {
        font-size: 10.5px;
        color: #16202b;
        display: flex;
        gap: 7px;
        align-items: flex-start;
        line-height: 1.4;
      }
      .tidc-terms-check {
        color: #fff;
        background: #1c6b3a;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        font-size: 8px;
        font-weight: 800;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-top: 1px;
      }

      .tidc-emergency-block {
        background: rgba(28,107,58,0.06);
        border-radius: 10px;
        padding: 12px 14px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 10px;
      }
      .tidc-emergency-row {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 10.5px;
        color: #16202b;
      }
      .tidc-emergency-icon {
        width: 18px; height: 18px;
        border-radius: 5px;
        background: #1c6b3a;
        color: #fff;
        display: flex; align-items: center; justify-content: center;
        font-size: 9px;
        flex-shrink: 0;
      }
      .tidc-emergency-label { font-weight: 700; min-width: 90px; letter-spacing: 0.2px; }

      .tidc-back-qr-wrap {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
        position: relative;
        z-index: 2;
        margin-top: 4px;
      }
    `}</style>
  );
}

function BandTop() {
  return (
    <svg viewBox="0 0 400 46" preserveAspectRatio="none">
      <path d="M0,0 H400 V14 C300,32 260,4 200,18 C140,32 100,8 0,20 Z" fill="#f5a623" />
      <path d="M0,0 H400 V6 C300,22 260,-2 200,10 C140,22 100,0 0,12 Z" fill="#14532d" />
    </svg>
  );
}

function BandBottom() {
  return (
    <svg viewBox="0 0 400 70" preserveAspectRatio="none">
      <path d="M0,70 H400 V26 C300,4 260,40 200,22 C140,4 100,32 0,16 Z" fill="#f5a623" />
      <path d="M0,70 H400 V38 C300,18 260,50 200,34 C140,18 100,44 0,30 Z" fill="#14532d" />
    </svg>
  );
}

function CardFront({ teacher, teacherUsername }) {
  const joined = formatDate(teacher?.createdAt);

  const motherNameText =
    teacher?.motherName || teacher?.matherName || teacher?.parentName || "—";

  const fullNameText =
    teacher?.fullName ||
    teacher?.name ||
    [teacher?.firstName, teacher?.lastName].filter(Boolean).join(" ") ||
    "—";

  const photoSrc = teacher?.teacherPhoto || teacher?.photoUrl || "";

  return (
    <div className="tidc-card-outer">
      <span className="tidc-side-label">FRONT</span>
      <div className="tidc-card" id="tidc-print-front">
        <div className="tidc-band-top"><BandTop /></div>

        <div className="tidc-header">
          <div className="tidc-logo-badge">
            <img src={schoolLogo} alt="Rising Star School logo" />
          </div>
          <div className="tidc-school-block">
            <div className="tidc-school-name1">{SCHOOL.name1}</div>
            <div className="tidc-school-name2">{SCHOOL.name2}</div>
            <div className="tidc-school-name3">{SCHOOL.name3}</div>
          </div>
        </div>

        <div className="tidc-title-bar">
          <span className="tidc-title-1">TEACHER</span>
          <span className="tidc-title-2">ID CARD</span>
        </div>

        <div className="tidc-body">
          <div className="tidc-fields">
            <div className="tidc-field-row">
              <span className="tidc-field-icon">🪪</span>
              <span className="tidc-field-label">TEACHER ID</span>
              <span className="tidc-field-colon">:</span>
              <span className="tidc-field-value">{teacherUsername || "—"}</span>
            </div>
            <div className="tidc-field-row">
              <span className="tidc-field-icon">👤</span>
              <span className="tidc-field-label">TEACHER NAME</span>
              <span className="tidc-field-colon">:</span>
              <span className="tidc-field-value">{fullNameText}</span>
            </div>
            <div className="tidc-field-row">
              <span className="tidc-field-icon">👥</span>
              <span className="tidc-field-label">MOTHER'S NAME</span>
              <span className="tidc-field-colon">:</span>
              <span className="tidc-field-value">{motherNameText}</span>
            </div>
            <div className="tidc-field-row">
              <span className="tidc-field-icon">📞</span>
              <span className="tidc-field-label">PHONE NUMBER</span>
              <span className="tidc-field-colon">:</span>
              <span className="tidc-field-value">{teacher?.phone || teacher?.phoneNumber || "—"}</span>
            </div>
            <div className="tidc-field-row">
              <span className="tidc-field-icon">📅</span>
              <span className="tidc-field-label">DATE OF JOINING</span>
              <span className="tidc-field-colon">:</span>
              <span className="tidc-field-value">{joined?.str || "—"}</span>
            </div>
          </div>

          <div className="tidc-photo-wrap">
            {photoSrc ? (
              <img className="tidc-photo" src={photoSrc} alt={fullNameText} />
            ) : (
              <div className="tidc-photo-placeholder">No Photo</div>
            )}
          </div>
        </div>

        <div className="tidc-signature">
          <img
            className="tidc-signature-img"
            src={principalSignature}
            alt="Principal's signature"
          />
          <div className="tidc-signature-line">PRINCIPAL'S SIGNATURE</div>
        </div>

        <div className="tidc-band-bottom"><BandBottom /></div>
        <div className="tidc-slogan">"Education Is Life It Self"</div>
      </div>
    </div>
  );
}

function CardBack({ teacherUsername }) {
  const verifyUrl = `https://${SCHOOL.website}/verify/teacher/${encodeURIComponent(
    teacherUsername || ""
  )}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&margin=0&data=${encodeURIComponent(
    verifyUrl
  )}`;

  return (
    <div className="tidc-card-outer">
      <span className="tidc-side-label">BACK</span>
      <div className="tidc-card" id="tidc-print-back">
        <div className="tidc-band-top"><BandTop /></div>

        <div className="tidc-back-content">
          <div className="tidc-back-header">
            <div className="tidc-back-logo">
              <img src={schoolLogo} alt="Rising Star School logo" />
            </div>
          </div>

          <div className="tidc-section-bar">TERMS &amp; CONDITIONS</div>
          <ul className="tidc-terms-list">
            <li><span className="tidc-terms-check">✔</span> This ID card is the property of Rising Star School.</li>
            <li><span className="tidc-terms-check">✔</span> This card is issued for official identification only.</li>
            <li><span className="tidc-terms-check">✔</span> This card is non-transferable and must be surrendered upon request.</li>
            <li><span className="tidc-terms-check">✔</span> If found, please return it to the school administration.</li>
          </ul>

          <div className="tidc-section-bar">IN CASE OF EMERGENCY</div>
          <div className="tidc-emergency-block">
            <div className="tidc-emergency-row">
              <span className="tidc-emergency-icon">📞</span>
              <span className="tidc-emergency-label">CONTACT NUMBER</span>
              <span>: {SCHOOL.noticeTell}</span>
            </div>
            <div className="tidc-emergency-row">
              <span className="tidc-emergency-icon">✉</span>
              <span className="tidc-emergency-label">EMAIL</span>
              <span>: {SCHOOL.noticeEmail}</span>
            </div>
            <div className="tidc-emergency-row">
              <span className="tidc-emergency-icon">🌐</span>
              <span className="tidc-emergency-label">WEBSITE</span>
              <span>: {SCHOOL.website}</span>
            </div>
            <div className="tidc-emergency-row">
              <span className="tidc-emergency-icon">📍</span>
              <span className="tidc-emergency-label">ADDRESS</span>
              <span>: {SCHOOL.location}</span>
            </div>
          </div>

          <div className="tidc-back-qr-wrap">
            <div className="tidc-qr">
              <img src={qrSrc} alt="QR code" />
            </div>
            <div className="tidc-qr-caption">
              SCAN TO VERIFY
              <br />
              TEACHER ID
            </div>
          </div>
        </div>

        <div className="tidc-band-bottom"><BandBottom /></div>
        <div className="tidc-slogan">"Excellence Today, Leaders Tomorrow"</div>
      </div>
    </div>
  );
}

// Teacher self-view: front + back only, no print/export control.
// Nothing in this component lets the signed-in teacher download,
// print, or otherwise take a copy of their own ID card — it is
// view-only on their Profile page.
export default function TeacherIdCard({ teacher, teacherUsername }) {
  // Duplicate the full teacher record into `teacher_id/{teacherUsername}`
  // the first time this card is viewed, so each issued card has its own
  // persistent snapshot independent of later edits to the original
  // teacher record. This is also the exact record TeacherVerify.jsx reads
  // when the QR code is scanned.
  useEffect(() => {
    if (!teacherUsername || !teacher) return;

    let cancelled = false;

    async function ensureCardRecord() {
      try {
        const cardRef = doc(db, "teacher_id", teacherUsername);
        const existing = await getDoc(cardRef);
        if (!existing.exists() && !cancelled) {
          await setDoc(cardRef, {
            ...teacher,
            teacherUsername,
            issuedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        console.error("Failed to save teacher_id record:", err);
      }
    }

    ensureCardRecord();
    return () => {
      cancelled = true;
    };
  }, [teacherUsername, teacher]);

  return (
    <div>
      <CardStyles />

      <div className="tidc-wrap">
        <CardFront teacher={teacher} teacherUsername={teacherUsername} />
        <CardBack teacherUsername={teacherUsername} />
      </div>
    </div>
  );
}