// src/teacher/TeacherIdCard.jsx
import React, { useEffect } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/firebase";
import schoolLogo from "../admin/assets/logo.png";

const SCHOOL = {
  name1: "RISING STAR PRIMARY",
  name2: "& SECONDARY SCHOOL",
  nameArabic1: "مدرســـة ريسن اســتار",
  nameArabic2: "الأساسية والثانوية",
  nameArabicCity: "مقديشـو-الصومال",
  location: "Mogadishu-Somalia",
  website: "resingstarschools.com",
  noticeOffice: "Main Office Wadajir District",
  noticeCity: "Mogadishu-Somalia",
  noticeEmail: "risingstar0261@gmail.com",
  noticeTell: "+252-617390261",
};

function formatDate(d) {
  if (!d) return null;
  const dateObj = d?.seconds ? new Date(d.seconds * 1000) : new Date(d);
  if (isNaN(dateObj.getTime())) return null;
  const day = String(dateObj.getDate()).padStart(2, "0");
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const year = dateObj.getFullYear();
  return { day, month, year, dateObj, str: `${day}-${month}-${year}` };
}

function addValidityPeriod(issued) {
  if (!issued?.dateObj) return null;
  const expireDate = new Date(issued.dateObj);
  expireDate.setFullYear(expireDate.getFullYear() + 1);
  expireDate.setMonth(11, 31);
  return formatDate(expireDate);
}

function CardStyles() {
  return (
    <style>{`
      .tidc-wrap {
        display: flex;
        flex-wrap: wrap;
        gap: 32px;
        justify-content: center;
        padding: 24px 0;
      }

      .tidc-card {
        width: 440px;
        height: 275px;
        border-radius: 0px;
        overflow: hidden;
        position: relative;
        background: #d8f1fd;
        box-shadow: 0 10px 25px rgba(0,0,0,0.15);
        font-family: 'Times New Roman', Times, Georgia, serif;
        border: 1px solid #bce2f7;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
      }

      /* Guilloche-style fine wavy background watermark */
      .tidc-watermark {
        position: absolute;
        inset: 0;
        opacity: 0.55;
        background-image: 
          radial-gradient(ellipse at 50% 50%, rgba(56, 182, 255, 0.4) 0%, transparent 80%),
          repeating-linear-gradient(45deg, rgba(0, 166, 81, 0.08) 0px, rgba(0, 166, 81, 0.08) 2px, transparent 2px, transparent 10px),
          repeating-linear-gradient(-45deg, rgba(0, 153, 229, 0.12) 0px, rgba(0, 153, 229, 0.12) 2px, transparent 2px, transparent 12px);
        pointer-events: none;
        z-index: 0;
      }

      /* ---------- FRONT ---------- */
      .tidc-front-header {
        position: relative;
        z-index: 1;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        padding: 10px 14px 2px;
      }

      .tidc-school-block-en { 
        line-height: 1.1; 
        text-align: left; 
        font-family: Arial, Helvetica, sans-serif;
      }

      .tidc-school-name1 {
        font-size: 13.5px;
        font-weight: 900;
        color: #006837;
        letter-spacing: -0.2px;
      }

      .tidc-school-name2 {
        font-size: 13.5px;
        font-weight: 900;
        color: #006837;
        letter-spacing: -0.2px;
      }

      .tidc-school-location {
        font-size: 10px;
        font-weight: 500;
        color: #0099e5;
        margin-top: 2px;
      }

      .tidc-logo-badge {
        width: 46px;
        height: 46px;
        min-width: 46px;
        border-radius: 50%;
        background: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        flex-shrink: 0;
      }

      .tidc-logo-badge img { 
        width: 100%; 
        height: 100%; 
        object-fit: contain; 
      }

      .tidc-school-block-ar {
        line-height: 1.25;
        text-align: right;
        direction: rtl;
        font-family: Arial, Tahoma, sans-serif;
      }

      .tidc-school-name-ar {
        font-size: 13.5px;
        font-weight: 900;
        color: #006837;
      }

      .tidc-school-city-ar {
        font-size: 9px;
        font-weight: 600;
        color: #0099e5;
        margin-top: 1px;
      }

      /* Green Pill with Cyan edge for ID CARD */
      .tidc-title-bar-wrap {
        position: relative;
        z-index: 1;
        display: flex;
        justify-content: center;
        margin-top: -2px;
      }

      .tidc-title-bar {
        background: #008744;
        color: #ffffff;
        font-weight: 900;
        font-size: 18px;
        letter-spacing: 1px;
        padding: 2px 22px;
        border-radius: 20px;
        box-shadow: 4px 0 0 #0099e5;
        font-family: Arial, Helvetica, sans-serif;
      }

      .tidc-body {
        position: relative;
        z-index: 1;
        flex: 1;
        display: flex;
        gap: 12px;
        padding: 6px 14px 10px;
      }

      .tidc-photo-frame {
        width: 112px;
        height: 138px;
        flex-shrink: 0;
        border: 1px solid #000000;
        background: #ffffff;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .tidc-photo-frame img { 
        width: 100%; 
        height: 100%; 
        object-fit: cover; 
      }

      .tidc-photo-placeholder svg { 
        width: 50px; 
        height: 50px; 
        color: #cccccc; 
      }

      .tidc-fields {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        min-width: 0;
        padding-top: 0px;
      }

      .tidc-field-row {
        margin-bottom: 2px;
      }

      .tidc-field-label {
        font-weight: 700;
        color: #000000;
        font-size: 16px;
        line-height: 1.1;
      }

      .tidc-field-value {
        font-weight: 400;
        color: #000000;
        font-size: 16px;
        line-height: 1.25;
        overflow-wrap: break-word;
      }

      .tidc-field-inline-row {
        display: flex;
        align-items: baseline;
        gap: 6px;
        line-height: 1.25;
      }

      .tidc-field-inline-row .tidc-field-value.expire { 
        color: #ff0000; 
        font-weight: 700; 
      }

      .tidc-qr-wrap {
        position: absolute;
        right: 14px;
        bottom: 12px;
        width: 72px;
        height: 72px;
        background: #ffffff;
        border: 1px solid #000000;
        padding: 2px;
        box-sizing: border-box;
        z-index: 2;
      }

      .tidc-qr-wrap img { 
        width: 100%; 
        height: 100%; 
        display: block; 
      }

      /* ---------- BACK ---------- */
      .tidc-back {
        background: #d8f1fd;
      }

      .tidc-back-content {
        position: relative;
        z-index: 1;
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 20px;
      }

      .tidc-back-nb {
        color: #ff0000;
        font-size: 32px;
        font-weight: 700;
        margin-bottom: 4px;
        line-height: 1;
      }

      .tidc-back-line {
        font-size: 16.5px;
        color: #000000;
        line-height: 1.35;
        font-weight: 400;
      }

      /* Green Diamonds in Corners */
      .tidc-back-diamond {
        position: absolute;
        width: 28px;
        height: 28px;
        background: #008744;
        transform: rotate(45deg);
        z-index: 2;
        border: 1px solid #ffffff;
      }

      .tidc-back-diamond.tl { top: 12px; left: 12px; }
      .tidc-back-diamond.tr { top: 12px; right: 12px; }
      .tidc-back-diamond.bl { bottom: 12px; left: 12px; }
      .tidc-back-diamond.br { bottom: 12px; right: 12px; }

      /* Blue Trapezoid Shapes at Top and Bottom */
      .tidc-back-bar {
        position: absolute;
        left: 0;
        right: 0;
        height: 30px;
        background: #0099e5;
        z-index: 1;
      }

      .tidc-back-bar.top { 
        top: 0; 
        clip-path: polygon(22% 0%, 78% 0%, 68% 100%, 32% 100%); 
      }

      .tidc-back-bar.bottom { 
        bottom: 0; 
        clip-path: polygon(32% 0%, 68% 0%, 78% 100%, 22% 100%); 
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

function CardFront({ teacher, teacherUsername, issued, expired }) {
  const fullNameText =
    teacher?.fullName ||
    teacher?.name ||
    [teacher?.firstName, teacher?.lastName].filter(Boolean).join(" ") ||
    "Mukhtar Mohamed Salad";

  const titleText =
    teacher?.title ||
    teacher?.designation ||
    teacher?.role ||
    "Teacher";

  const photoSrc = teacher?.teacherPhoto || teacher?.photoUrl || "";

  const verifyUrl = `https://${SCHOOL.website}/verify/teacher/${encodeURIComponent(
    teacherUsername || "SS001"
  )}`;
  
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=0&data=${encodeURIComponent(
    verifyUrl
  )}`;

  return (
    <div className="tidc-card" id="tidc-print-front">
      <div className="tidc-watermark" />

      <div className="tidc-front-header">
        <div className="tidc-school-block-en">
          <div className="tidc-school-name1">{SCHOOL.name1}</div>
          <div className="tidc-school-name2">{SCHOOL.name2}</div>
          <div className="tidc-school-location">{SCHOOL.location}</div>
        </div>

        <div className="tidc-logo-badge">
          <img src={schoolLogo} alt="Rising Star School logo" />
        </div>

        <div className="tidc-school-block-ar">
          <div className="tidc-school-name-ar">{SCHOOL.nameArabic1}</div>
          <div className="tidc-school-name-ar">{SCHOOL.nameArabic2}</div>
          <div className="tidc-school-city-ar">{SCHOOL.nameArabicCity}</div>
        </div>
      </div>

      <div className="tidc-title-bar-wrap">
        <div className="tidc-title-bar">ID CARD</div>
      </div>

      <div className="tidc-body">
        <div className="tidc-photo-frame">
          {photoSrc ? (
            <img src={photoSrc} alt={fullNameText} />
          ) : (
            <div className="tidc-photo-placeholder">
              <PersonIcon />
            </div>
          )}
        </div>

        <div className="tidc-fields">
          <div className="tidc-field-row">
            <div className="tidc-field-label">Name</div>
            <div className="tidc-field-value">{fullNameText}</div>
          </div>

          <div className="tidc-field-row">
            <div className="tidc-field-label">Title</div>
            <div className="tidc-field-value">{titleText}</div>
          </div>

          <div className="tidc-field-inline-row">
            <span className="tidc-field-label">Issue Date:</span>
            <span className="tidc-field-value">{issued?.str || "01-06-2026"}</span>
          </div>

          <div className="tidc-field-inline-row">
            <span className="tidc-field-label">Expire Date:</span>
            <span className="tidc-field-value expire">{expired?.str || "31-12-2027"}</span>
          </div>

          <div className="tidc-field-row" style={{ marginTop: 2 }}>
            <div className="tidc-field-label">ID No</div>
            <div className="tidc-field-value">{teacherUsername || "SS001"}</div>
          </div>
        </div>
      </div>

      <div className="tidc-qr-wrap">
        <img src={qrSrc} alt="QR code" />
      </div>
    </div>
  );
}

function CardBack() {
  return (
    <div className="tidc-card tidc-back" id="tidc-print-back">
      <div className="tidc-watermark" />
      <div className="tidc-back-bar top" />
      <div className="tidc-back-bar bottom" />
      <div className="tidc-back-diamond tl" />
      <div className="tidc-back-diamond tr" />
      <div className="tidc-back-diamond bl" />
      <div className="tidc-back-diamond br" />

      <div className="tidc-back-content">
        <div className="tidc-back-nb">NB:</div>
        <div className="tidc-back-line">
          if you find this ID, please return it
          <br />
          to the {SCHOOL.noticeOffice}
          <br />
          {SCHOOL.noticeCity}
          <br />
          Email:{SCHOOL.noticeEmail}
          <br />
          Tel: {SCHOOL.noticeTell}
        </div>
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

  const issued = formatDate(teacher?.issuedAt || teacher?.createdAt);
  const expired = addValidityPeriod(issued);

  return (
    <div>
      <CardStyles />

      <div className="tidc-wrap">
        <CardFront
          teacher={teacher}
          teacherUsername={teacherUsername}
          issued={issued}
          expired={expired}
        />
        <CardBack />
      </div>
    </div>
  );
}