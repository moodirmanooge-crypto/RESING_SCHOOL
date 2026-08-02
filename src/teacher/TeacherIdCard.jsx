// src/teacher/TeacherIdCard.jsx
// Renders the official Rising Star School Teacher ID card — front + back —
// matching the printed badge-style reference design. Pulls all data
// straight from the teacher's own Firestore record (fullName, username,
// phone, motherName, createdAt, teacherPhoto). The "Teacher ID" shown on
// the card is the teacher's login username (e.g. "guul2"), exactly as
// stored in Firestore doc id / username field — nothing is typed by the
// teacher.
//
// NOTE: this is the teacher's own self-view of their ID card (shown on
// their Profile page). There is intentionally no print/download control
// here — teachers can view their card but cannot print or export it.
//
// On first view (if no card doc exists yet), the full teacher record is
// duplicated into the `teacher_id` Firestore collection, keyed by the
// teacher's username, so issued cards have their own persistent snapshot.
// This write only happens when `readOnly` is false (i.e. the teacher's own
// authenticated Profile page) — public verify views never attempt to
// write to Firestore.
//
// QR CODE: encodes the school's public verify page
// (https://resingstarschools.com/verify/teacher/{teacherUsername}) — NOT
// just the bare website. Scanning it opens TeacherVerify.jsx, which reads
// the teacher_id/{teacherUsername} snapshot from Firestore and renders
// this exact same component (with readOnly) — same design, same data,
// no login required.
//
// CARD SIZE: matches StudentIdCard.jsx exactly (340px wide, 214px min
// height, same border-radius) so both ID card types render at identical
// dimensions across the app.

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
  name2: "PRIMARY & SECONDARY SCHOOL",
  website: "resingstarschools.com",
  location: "Mogadishu, Somalia",
  noticeTell: "+252 61 7390261",
  noticeEmail: "risingstar0261@gmail.com",
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

function CardStyles() {
  return (
    <style>{`
      .tidc-wrap {
        display: flex;
        flex-wrap: wrap;
        gap: 28px;
        justify-content: center;
        padding: 24px 0;
      }

      /* Same footprint as StudentIdCard's .idc-card */
      .tidc-card {
        width: 340px;
        max-width: 100%;
        min-height: 214px;
        border-radius: 14px;
        overflow: hidden;
        position: relative;
        background: #ffffff;
        box-shadow: 0 18px 44px rgba(0,0,0,0.35);
        font-family: 'Poppins','Inter','Segoe UI',system-ui,sans-serif;
        border: 1px solid #e8e8e8;
        display: flex;
        flex-direction: column;
      }

      .tidc-hole {
        position: absolute;
        top: 6px;
        left: 50%;
        transform: translateX(-50%);
        width: 40px;
        height: 11px;
        background: rgba(255,255,255,0.55);
        border: 1.5px solid rgba(255,255,255,0.85);
        border-radius: 7px;
        z-index: 5;
      }

      .tidc-front-header {
        background: #14532d;
        padding: 14px 14px 10px;
        display: flex;
        align-items: center;
        gap: 8px;
        position: relative;
      }
      .tidc-front-header::after {
        content: "";
        position: absolute;
        left: 0; right: 0; bottom: -3px;
        height: 3px;
        background: #f5a623;
      }
      .tidc-logo-badge {
        width: 42px;
        height: 42px;
        min-width: 42px;
        border-radius: 50%;
        background: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        overflow: hidden;
        box-shadow: 0 2px 6px rgba(0,0,0,0.2);
      }
      .tidc-logo-badge img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .tidc-school-block { line-height: 1.1; color: #fff; }
      .tidc-school-name1 {
        font-size: 14px;
        font-weight: 900;
        letter-spacing: 0.3px;
      }
      .tidc-school-name2 {
        font-size: 8.5px;
        font-weight: 700;
        letter-spacing: 0.2px;
        margin-top: 1px;
      }

      .tidc-front-body {
        position: relative;
        flex: 1;
        display: flex;
        padding: 11px 12px 0;
        gap: 9px;
      }

      .tidc-side-label {
        writing-mode: vertical-rl;
        transform: rotate(180deg);
        background: #14532d;
        color: #fff;
        font-weight: 800;
        font-size: 9px;
        letter-spacing: 1.6px;
        padding: 8px 4px;
        border-radius: 5px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        align-self: stretch;
      }

      .tidc-photo-wrap {
        width: 82px;
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .tidc-photo {
        width: 76px;
        height: 90px;
        object-fit: cover;
        border-radius: 6px;
        border: 2px solid #14532d;
        background: #eef1ee;
      }
      .tidc-photo-placeholder {
        width: 76px;
        height: 90px;
        border-radius: 6px;
        border: 2px solid #14532d;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #eef1ee;
        overflow: hidden;
      }
      .tidc-photo-placeholder svg { width: 44px; height: 44px; color: #b9c2ba; }

      .tidc-fields {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 6px;
        min-width: 0;
        padding-top: 2px;
      }
      .tidc-field-row {
        display: flex;
        align-items: baseline;
        gap: 5px;
        font-size: 8px;
      }
      .tidc-field-label {
        font-weight: 800;
        color: #16202b;
        min-width: 66px;
        letter-spacing: 0.1px;
        flex-shrink: 0;
        text-transform: uppercase;
      }
      .tidc-field-colon { color: #16202b; font-weight: 700; flex-shrink: 0; }
      .tidc-field-value {
        font-weight: 700;
        color: #14532d;
        border-bottom: 1px solid #16202b33;
        flex: 1;
        padding-bottom: 1px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .tidc-front-footer {
        position: relative;
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        padding: 5px 12px 9px;
        margin-top: 4px;
      }
      .tidc-signature-block { text-align: center; }
      .tidc-signature-img { height: 22px; object-fit: contain; }
      .tidc-signature-line {
        border-top: 1.5px solid #16202b;
        margin-top: 2px;
        padding-top: 2px;
        font-size: 6.5px;
        font-weight: 800;
        letter-spacing: 0.6px;
        color: #16202b;
      }
      .tidc-slogan-badge {
        display: flex;
        align-items: center;
        gap: 4px;
        color: #14532d;
        font-weight: 800;
        font-size: 6.8px;
        letter-spacing: 0.2px;
      }

      .tidc-front-wave {
        height: 16px;
        background: linear-gradient(90deg, #14532d, #f5a623 50%, #14532d);
        position: relative;
        flex-shrink: 0;
      }
      .tidc-front-wave::before {
        content: "";
        position: absolute;
        top: -10px; left: 0; right: 0;
        height: 12px;
        background: #fff;
        border-radius: 50% 50% 0 0 / 100% 100% 0 0;
      }

      /* ---------- BACK ---------- */
      .tidc-back-header {
        background: #14532d;
        padding: 10px 14px 11px;
        text-align: center;
        position: relative;
        flex-shrink: 0;
      }
      .tidc-back-header::after {
        content: "";
        position: absolute;
        left: 0; right: 0; bottom: -3px;
        height: 3px;
        background: #f5a623;
      }
      .tidc-back-title {
        color: #fff;
        font-weight: 900;
        font-size: 14px;
        letter-spacing: 0.4px;
      }
      .tidc-back-subtitle {
        color: #cfe8d7;
        font-weight: 700;
        font-size: 7.5px;
        letter-spacing: 0.7px;
        margin-top: 2px;
      }

      .tidc-back-body {
        flex: 1;
        padding: 8px 14px 4px;
        display: flex;
        flex-direction: column;
      }

      .tidc-rights-badge {
        background: #eaf3ec;
        color: #14532d;
        font-weight: 800;
        font-size: 7.5px;
        letter-spacing: 0.3px;
        text-align: center;
        padding: 3px 0;
        border-radius: 4px;
        margin-bottom: 5px;
        flex-shrink: 0;
      }

      .tidc-rights-list {
        list-style: none;
        margin: 0 0 5px;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex-shrink: 0;
      }
      .tidc-rights-list li {
        display: flex;
        gap: 4px;
        font-size: 5.6px;
        line-height: 1.25;
        color: #232b26;
      }
      .tidc-rights-check {
        color: #16a34a;
        font-weight: 900;
        flex-shrink: 0;
      }

      .tidc-return-block {
        border-top: 1px solid #dfe6e0;
        padding-top: 4px;
        text-align: center;
        flex-shrink: 0;
      }
      .tidc-return-title {
        font-weight: 800;
        font-size: 6.2px;
        color: #14532d;
        letter-spacing: 0.2px;
        margin-bottom: 2px;
      }
      .tidc-return-row {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 3px;
        font-size: 5.5px;
        color: #232b26;
        margin-bottom: 1px;
      }
      .tidc-return-icon { flex-shrink: 0; }

      .tidc-back-footer {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
        padding: 6px 0 10px;
        flex-shrink: 0;
      }
      .tidc-verify-label {
        font-weight: 800;
        font-size: 6.5px;
        color: #14532d;
        letter-spacing: 0.3px;
      }
      .tidc-qr {
        width: 46px;
        height: 46px;
        background: #fff;
        border: 1px solid #dfe6e0;
        border-radius: 5px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2px;
        box-sizing: border-box;
        flex-shrink: 0;
      }
      .tidc-qr img { width: 100%; height: 100%; display: block; }

      .tidc-back-wave {
        height: 20px;
        position: relative;
        background: #14532d;
        flex-shrink: 0;
      }
      .tidc-back-wave::before {
        content: "";
        position: absolute;
        top: -10px; left: 0; right: 0;
        height: 12px;
        background: #fff;
        border-radius: 50% 50% 0 0 / 100% 100% 0 0;
      }
      .tidc-back-wave-triangle {
        position: absolute;
        bottom: 0; left: 50%;
        transform: translateX(-50%);
        width: 0; height: 0;
        border-left: 16px solid transparent;
        border-right: 16px solid transparent;
        border-bottom: 10px solid #2563a8;
      }
      .tidc-back-wave-star {
        position: absolute;
        bottom: 1px; left: 50%;
        transform: translateX(-50%);
        color: #fff;
        font-size: 8px;
      }

      @media print {
        body { margin: 0; }
        .tidc-print-hide { display: none !important; }
        .tidc-wrap { gap: 0; padding: 0; }
        .tidc-card { box-shadow: none; page-break-inside: avoid; }
      }
    `}</style>
  );
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z" />
    </svg>
  );
}

function CardFront({ teacher, teacherUsername, joined }) {
  const motherNameText =
    teacher?.motherName || teacher?.matherName || teacher?.parentName || "—";

  const fullNameText =
    teacher?.fullName ||
    teacher?.name ||
    [teacher?.firstName, teacher?.lastName].filter(Boolean).join(" ") ||
    "—";

  const photoSrc = teacher?.teacherPhoto || teacher?.photoUrl || "";

  return (
    <div className="tidc-card" id="tidc-print-front">
      <div className="tidc-hole" />

      <div className="tidc-front-header">
        <div className="tidc-logo-badge">
          <img src={schoolLogo} alt="Rising Star School logo" />
        </div>
        <div className="tidc-school-block">
          <div className="tidc-school-name1">RISING STAR</div>
          <div className="tidc-school-name2">{SCHOOL.name2}</div>
        </div>
      </div>

      <div className="tidc-front-body">
        <div className="tidc-side-label">TEACHER ID CARD</div>

        <div className="tidc-photo-wrap">
          {photoSrc ? (
            <img className="tidc-photo" src={photoSrc} alt={fullNameText} />
          ) : (
            <div className="tidc-photo-placeholder">
              <PersonIcon />
            </div>
          )}
        </div>

        <div className="tidc-fields">
          <div className="tidc-field-row">
            <span className="tidc-field-label">TEACHER ID</span>
            <span className="tidc-field-colon">:</span>
            <span className="tidc-field-value">{teacherUsername || "—"}</span>
          </div>
          <div className="tidc-field-row">
            <span className="tidc-field-label">NAME</span>
            <span className="tidc-field-colon">:</span>
            <span className="tidc-field-value">{fullNameText}</span>
          </div>
          <div className="tidc-field-row">
            <span className="tidc-field-label">MOTHER'S NAME</span>
            <span className="tidc-field-colon">:</span>
            <span className="tidc-field-value">{motherNameText}</span>
          </div>
          <div className="tidc-field-row">
            <span className="tidc-field-label">PHONE</span>
            <span className="tidc-field-colon">:</span>
            <span className="tidc-field-value">{teacher?.phone || teacher?.phoneNumber || "—"}</span>
          </div>
          <div className="tidc-field-row">
            <span className="tidc-field-label">JOINED</span>
            <span className="tidc-field-colon">:</span>
            <span className="tidc-field-value">{joined?.str || "—"}</span>
          </div>
        </div>
      </div>

      <div className="tidc-front-footer">
        <div className="tidc-signature-block">
          <img className="tidc-signature-img" src={principalSignature} alt="Principal's signature" />
          <div className="tidc-signature-line">PRINCIPAL</div>
        </div>
        <div className="tidc-slogan-badge">★ EDUCATION IS LIFE IT SELF</div>
      </div>

      <div className="tidc-front-wave" />
    </div>
  );
}

function CardBack({ teacherUsername }) {
  const verifyUrl = `https://${SCHOOL.website}/verify/teacher/${encodeURIComponent(
    teacherUsername || ""
  )}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=0&data=${encodeURIComponent(
    verifyUrl
  )}`;

  return (
    <div className="tidc-card" id="tidc-print-back">
      <div className="tidc-hole" />

      <div className="tidc-back-header">
        <div className="tidc-back-title">RISING STAR</div>
        <div className="tidc-back-subtitle">★ PRIMARY &amp; SECONDARY SCHOOL ★</div>
      </div>

      <div className="tidc-back-body">
        <div className="tidc-rights-badge">CARD HOLDER RIGHTS</div>

        <ul className="tidc-rights-list">
          <li>
            <span className="tidc-rights-check">✔</span>
            This card is the property of Rising Star Primary &amp; Secondary School.
          </li>
          <li>
            <span className="tidc-rights-check">✔</span>
            This card must be carried by the teacher at all times within the school premises.
          </li>
          <li>
            <span className="tidc-rights-check">✔</span>
            This card is non-transferable and must be used only by the person to whom it is issued.
          </li>
          <li>
            <span className="tidc-rights-check">✔</span>
            If this card is lost or found, please report to the school office immediately.
          </li>
          <li>
            <span className="tidc-rights-check">✔</span>
            Misuse of this card may result in disciplinary action.
          </li>
        </ul>

        <div className="tidc-return-block">
          <div className="tidc-return-title">IN CASE OF FINDING THIS CARD, PLEASE RETURN TO:</div>
          <div className="tidc-return-row">
            <span className="tidc-return-icon">📍</span>
            <span>{SCHOOL.location}</span>
          </div>
          <div className="tidc-return-row">
            <span className="tidc-return-icon">📞</span>
            <span>{SCHOOL.noticeTell}</span>
          </div>
          <div className="tidc-return-row">
            <span className="tidc-return-icon">✉️</span>
            <span>{SCHOOL.noticeEmail}</span>
          </div>
          <div className="tidc-return-row">
            <span className="tidc-return-icon">🌐</span>
            <span>{SCHOOL.website}</span>
          </div>
        </div>

        <div className="tidc-back-footer">
          <div className="tidc-verify-label">SCAN TO VERIFY</div>
          <div className="tidc-qr">
            <img src={qrSrc} alt="QR code" />
          </div>
        </div>
      </div>

      <div className="tidc-back-wave">
        <div className="tidc-back-wave-triangle" />
        <div className="tidc-back-wave-star">★</div>
      </div>
    </div>
  );
}

export default function TeacherIdCard({ teacher, teacherUsername, readOnly = false }) {
  useEffect(() => {
    if (readOnly || !teacherUsername || !teacher) return;

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
  }, [teacherUsername, teacher, readOnly]);

  const joined = formatDate(teacher?.createdAt);

  return (
    <div>
      <CardStyles />

      <div className="tidc-wrap">
        <CardFront teacher={teacher} teacherUsername={teacherUsername} joined={joined} />
        <CardBack teacherUsername={teacherUsername} />
      </div>
    </div>
  );
}