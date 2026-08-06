// src/student/StudentIdCard.jsx
import React from "react";
import schoolLogo from "../assets/rising-star-logo.png";

const SCHOOL = {
  name1: "RISING STAR PRIMARY",
  name2: "& SECONDARY SCHOOL",
  slogan: '"Education is life it`s self"',
  officeLine1: "Primary Office: Wadajir,",
  officeLine2: "Mogadishu-Somalia",
  phone: "+252-617390261",
  email: "risingstar0261@gmail.com",
  website: "resingstarschools.com",
};

// Card is valid for exactly one year from the issue date.
function formatDate(d) {
  if (!d) return null;
  const dateObj = d?.seconds ? new Date(d.seconds * 1000) : new Date(d);
  if (isNaN(dateObj.getTime())) return null;
  const day = String(dateObj.getDate()).padStart(2, "0");
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const year = dateObj.getFullYear();
  return { day, month, year, dateObj, str: `${day}-${month}-${year}` };
}

function addOneYear(issued) {
  if (!issued?.dateObj) return null;
  const expireDate = new Date(issued.dateObj);
  expireDate.setFullYear(expireDate.getFullYear() + 1);
  return formatDate(expireDate);
}

function CardStyles() {
  return (
    <style>{`
      .idc-wrap {
        display: flex;
        flex-wrap: wrap;
        gap: 32px;
        justify-content: center;
        padding: 24px 0;
      }

      .idc-card {
        width: 320px;
        height: 500px;
        border-radius: 0px;
        overflow: hidden;
        position: relative;
        background: #ffffff;
        box-shadow: 0 10px 25px rgba(0,0,0,0.15);
        font-family: Arial, Helvetica, sans-serif;
        border: 1px solid #dcdcdc;
        box-sizing: border-box;
      }

      /* ---------- FRONT ---------- */
      .idc-front {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        padding: 14px 16px 16px;
        position: relative;
        background: #ffffff;
      }

      .idc-front-header {
        display: flex;
        align-items: center;
        gap: 10px;
        text-align: left;
        width: 100%;
        margin-bottom: 6px;
      }

      .idc-logo-badge {
        width: 52px;
        height: 52px;
        min-width: 52px;
        border-radius: 50%;
        flex-shrink: 0;
        overflow: hidden;
      }

      .idc-logo-badge img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }

      .idc-school-block { 
        line-height: 1.15; 
      }

      .idc-school-name1 {
        font-size: 14px;
        font-weight: 900;
        color: #008744;
        letter-spacing: -0.2px;
      }

      .idc-school-name2 {
        font-size: 14px;
        font-weight: 900;
        color: #008744;
        letter-spacing: -0.2px;
      }

      .idc-school-slogan {
        font-size: 9.5px;
        font-style: italic;
        color: #111111;
        margin-top: 3px;
      }

      .idc-title {
        font-size: 16px;
        font-weight: 900;
        color: #000000;
        letter-spacing: 0.5px;
        margin-top: 4px;
        margin-bottom: 4px;
        width: 100%;
        text-align: center;
      }

      /* Green/blue chevron wave background for Front Photo */
      .idc-wave-wrap {
        position: relative;
        width: 100%;
        height: 155px;
        display: flex;
        justify-content: center;
        align-items: flex-end;
      }

      .idc-wave-svg {
        position: absolute;
        top: 0;
        left: -16px;
        width: calc(100% + 32px);
        height: 100%;
        z-index: 0;
        pointer-events: none;
      }

      .idc-photo-frame {
        position: relative;
        z-index: 1;
        width: 124px;
        height: 138px;
        border: 2px solid #00a651;
        border-radius: 12px 12px 55px 55px;
        background: #ffffff;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .idc-photo-frame img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .idc-photo-placeholder svg { 
        width: 56px; 
        height: 56px; 
        color: #cccccc; 
      }

      .idc-student-name {
        margin-top: 10px;
        font-size: 18px;
        font-weight: 800;
        color: #000000;
        line-height: 1.2;
      }

      .idc-grade-badge {
        margin-top: 4px;
        font-size: 15px;
        font-weight: 800;
        color: #1e295d;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }

      .idc-grade-badge .dash { 
        color: #00a651; 
        font-weight: 900; 
        font-size: 18px;
      }

      /* Fixed Info Block Spacing & Layout */
      .idc-info-block {
        margin-top: 12px;
        width: 82%;
        display: flex;
        flex-direction: column;
        gap: 3px;
      }

      .idc-info-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 15px;
        color: #000000;
        line-height: 1.25;
      }

      .idc-info-label { 
        font-weight: 500; 
        text-align: left; 
        white-space: nowrap;
      }

      .idc-info-value { 
        font-weight: 500; 
        text-align: right; 
        white-space: nowrap;
      }

      .idc-barcode-wrap {
        margin-top: 10px;
        width: 100%;
        display: flex;
        justify-content: center;
      }

      .idc-barcode-wrap img {
        height: 38px;
        max-width: 80%;
        object-fit: contain;
      }

      /* ---------- BACK ---------- */
      .idc-back {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        background: #e0f4ff;
      }

      .idc-back-wave-top {
        position: absolute;
        top: 0; left: 0; right: 0;
        width: 100%;
        height: 90px;
        z-index: 0;
      }

      .idc-back-wave-bottom {
        position: absolute;
        bottom: 0; left: 0; right: 0;
        width: 100%;
        height: 90px;
        z-index: 0;
      }

      .idc-back-content {
        position: relative;
        z-index: 1;
        padding-top: 105px;
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
      }

      .idc-back-intro {
        font-size: 14.5px;
        color: #000000;
        margin-bottom: 2px;
        font-weight: 500;
      }

      .idc-back-school {
        font-size: 16.5px;
        font-weight: 900;
        color: #000000;
        margin-bottom: 4px;
        letter-spacing: 0.2px;
      }

      .idc-back-address {
        font-size: 14.5px;
        color: #000000;
        line-height: 1.35;
        margin-bottom: 22px;
        font-weight: 500;
      }

      .idc-back-contact-row {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 12px;
        width: 80%;
        justify-content: flex-start;
      }

      .idc-contact-icon {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        border: 2px solid #00a651;
        background: #ffffff;
        color: #00a651;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .idc-contact-icon svg { 
        width: 18px; 
        height: 18px; 
      }

      .idc-back-contact-text {
        font-size: 14px;
        color: #000000;
        font-weight: 600;
        text-align: left;
      }

      .idc-back-qr-wrap {
        margin-top: 10px;
        padding: 5px;
        background: #ffffff;
        border: 2px solid #00a651;
        border-radius: 0px;
        display: inline-block;
      }

      .idc-back-qr-wrap img {
        width: 95px;
        height: 95px;
        display: block;
      }

      @media print {
        body { margin: 0; }
        .idc-print-hide { display: none !important; }
        .idc-wrap { gap: 0; padding: 0; }
        .idc-card { box-shadow: none; page-break-inside: avoid; }
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

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 6-10 7L2 6" />
    </svg>
  );
}

// Chevron wave shapes behind photo
function ChevronWave() {
  return (
    <svg className="idc-wave-svg" viewBox="0 0 320 155" preserveAspectRatio="none">
      {/* Blue inner chevron layer */}
      <path d="M0,0 L160,110 L320,0 L320,40 L160,150 L0,40 Z" fill="#0099e5" />
      {/* Green outer chevron layer */}
      <path d="M0,0 L160,85 L320,0 L320,30 L160,115 L0,30 Z" fill="#00a651" />
    </svg>
  );
}

// Back card top background curves
function BackWaveTop() {
  return (
    <svg className="idc-back-wave-top" viewBox="0 0 320 90" preserveAspectRatio="none">
      <path d="M0,0 H320 V50 C240,85 80,75 0,45 Z" fill="#00a651" />
      <path d="M0,0 H320 V35 C240,70 80,60 0,30 Z" fill="#0099e5" />
    </svg>
  );
}

// Back card bottom background curves
function BackWaveBottom() {
  return (
    <svg className="idc-back-wave-bottom" viewBox="0 0 320 90" preserveAspectRatio="none">
      <path d="M0,90 H320 V40 C240,10 80,20 0,50 Z" fill="#0099e5" />
      <path d="M0,90 H320 V55 C240,25 80,35 0,65 Z" fill="#00a651" />
    </svg>
  );
}

function CardFront({ student, studentId, issued, expired }) {
  const fullNameText = student?.fullName || "Mohamed Omar Abdulle";
  const gradeText = student?.className
    ? `GRADE ${student.className}`
    : "GRADE 6";

  return (
    <div className="idc-card idc-front" id="idc-print-front">
      <div className="idc-front-header">
        <div className="idc-logo-badge">
          <img src={schoolLogo} alt="Rising Star School logo" />
        </div>
        <div className="idc-school-block">
          <div className="idc-school-name1">{SCHOOL.name1}</div>
          <div className="idc-school-name2">{SCHOOL.name2}</div>
          <div className="idc-school-slogan">{SCHOOL.slogan}</div>
        </div>
      </div>

      <div className="idc-title">STUDENT ID CARD</div>

      <div className="idc-wave-wrap">
        <ChevronWave />
        <div className="idc-photo-frame">
          {student?.studentPhoto ? (
            <img src={student.studentPhoto} alt={fullNameText} />
          ) : (
            <div className="idc-photo-placeholder">
              <PersonIcon />
            </div>
          )}
        </div>
      </div>

      <div className="idc-student-name">{fullNameText}</div>
      <div className="idc-grade-badge">
        <span className="dash">—</span>
        <span>{gradeText}</span>
        <span className="dash">—</span>
      </div>

      <div className="idc-info-block">
        <div className="idc-info-row">
          <span className="idc-info-label">ID No:#</span>
          <span className="idc-info-value">{studentId || "0001"}</span>
        </div>
        <div className="idc-info-row">
          <span className="idc-info-label">Issue Date:</span>
          <span className="idc-info-value">{issued?.str || "30-07-2026"}</span>
        </div>
        <div className="idc-info-row">
          <span className="idc-info-label">Expire Date:</span>
          <span className="idc-info-value">{expired?.str || "30-07-2027"}</span>
        </div>
      </div>

      <div className="idc-barcode-wrap">
        <img
          src={`https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(
            studentId || "0001"
          )}&code=Code128&translate-esc=false`}
          alt="Student ID barcode"
        />
      </div>
    </div>
  );
}

function CardBack({ student, studentId }) {
  // FIX: previously this fell back through student?.idCardPageUrl,
  // student?.idCardImageUrl, student?.idCardFrontUrl, or even the raw
  // photo URL before ever reaching the /verify/student/{id} link — so the
  // QR often opened a photo or an unrelated URL instead of the card's
  // own verification page. It must ALWAYS point at /verify/student/{id},
  // matching the route VerifyIdCard.jsx listens on and the id under which
  // the card doc is actually saved in Firestore.
  const qrTarget = `https://${SCHOOL.website}/verify/student/${encodeURIComponent(
    studentId || student?.id || ""
  )}`;

  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=0&data=${encodeURIComponent(
    qrTarget
  )}`;

  return (
    <div className="idc-card idc-back" id="idc-print-back">
      <BackWaveTop />
      <BackWaveBottom />

      <div className="idc-back-content">
        <div className="idc-back-intro">if you found  Please return to</div>
        <div className="idc-back-school">RISING STAR SCHOOL</div>
        <div className="idc-back-address">
          {SCHOOL.officeLine1}
          <br />
          {SCHOOL.officeLine2}
        </div>

        <div className="idc-back-contact-row">
          <div className="idc-contact-icon">
            <PhoneIcon />
          </div>
          <div className="idc-back-contact-text">{SCHOOL.phone}</div>
        </div>

        <div className="idc-back-contact-row">
          <div className="idc-contact-icon">
            <MailIcon />
          </div>
          <div className="idc-back-contact-text">{SCHOOL.email}</div>
        </div>

        <div className="idc-back-qr-wrap">
          <img src={qrSrc} alt="QR code" />
        </div>
      </div>
    </div>
  );
}

export default function StudentIdCard({ student, studentId }) {
  const issuedSource = student?.idIssuedAt || student?.createdAt;
  const issued = formatDate(issuedSource);
  const expired = addOneYear(issued);

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
        <CardFront student={student} studentId={studentId} issued={issued} expired={expired} />
        <CardBack student={student} studentId={studentId} />
      </div>

      <div className="idc-print-hide" style={{ textAlign: "center", marginTop: 8 }}>
        <button
          onClick={handlePrint}
          style={{
            background: "#00a651",
            color: "#fff",
            border: "none",
            padding: "10px 24px",
            borderRadius: 6,
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Print ID Card
        </button>
      </div>
    </div>
  );
}