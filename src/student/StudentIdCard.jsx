// src/student/StudentIdCard.jsx
// Renders the official Rising Star School Student ID card — front + back —
// matching the printed reference design exactly. Pulls all data from the
// student's own Firestore record (fullName, studentId, className, shift,
// studentPhoto); nothing is typed here. Includes a "Print ID Card" button
// that opens a clean print window with both sides, sized for a standard
// CR80 card (85.6mm x 54mm) at 300dpi print scale.

import schoolLogo from "../assets/rising-star-logo.png";
import principalSignature from "../admin/assets/signature-principal.png";

const SCHOOL = {
  name1: "RISING STAR",
  name2: "PRIMARY & SECONDARY SCHOOL",
  address1: "Wadajir District, Ceelqalow Area",
  address2: "Near Hormuud Company, Mogadishu - Somalia",
  phone: "+252 61 1234567 / +252 61 7654321",
  email: "info@resingstarschools.com",
  website: "resingstarschools.com",
  slogan: "EDUCATION IS LIFE IT SELF",
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
      .idc-wrap {
        display: flex;
        flex-wrap: wrap;
        gap: 28px;
        justify-content: center;
        padding: 24px 0;
      }

      .idc-card {
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
      }

      /* ---------- FRONT ---------- */
      .idc-front { display: flex; flex-direction: column; }

      .idc-front-header {
        background: #14532d;
        padding: 10px 14px;
        display: flex;
        align-items: center;
        gap: 8px;
        position: relative;
      }
      .idc-front-header::after {
        content: "";
        position: absolute;
        left: 0; right: 0; bottom: -3px;
        height: 3px;
        background: #f5a623;
      }
      .idc-logo-badge {
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
      .idc-logo-badge img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .idc-school-block { line-height: 1.1; color: #fff; }
      .idc-school-name1 {
        font-size: 14px;
        font-weight: 900;
        letter-spacing: 0.3px;
      }
      .idc-school-name2 {
        font-size: 8.5px;
        font-weight: 700;
        letter-spacing: 0.2px;
        margin-top: 1px;
      }

      .idc-front-body {
        position: relative;
        flex: 1;
        display: flex;
        padding: 11px 12px 0;
        gap: 9px;
      }

      .idc-side-label {
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

      .idc-photo-wrap {
        width: 82px;
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .idc-photo {
        width: 76px;
        height: 90px;
        object-fit: cover;
        border-radius: 6px;
        border: 2px solid #14532d;
        background: #eef1ee;
      }
      .idc-photo-placeholder {
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
      .idc-photo-placeholder svg { width: 44px; height: 44px; color: #b9c2ba; }

      .idc-fields {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 7px;
        min-width: 0;
        padding-top: 2px;
      }
      .idc-field-row {
        display: flex;
        align-items: baseline;
        gap: 5px;
        font-size: 9px;
      }
      .idc-field-label {
        font-weight: 800;
        color: #16202b;
        min-width: 58px;
        letter-spacing: 0.1px;
        flex-shrink: 0;
      }
      .idc-field-colon { color: #16202b; font-weight: 700; flex-shrink: 0; }
      .idc-field-value {
        font-weight: 600;
        color: #16202b;
        border-bottom: 1px solid #16202b33;
        flex: 1;
        padding-bottom: 1px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .idc-front-footer {
        position: relative;
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        padding: 5px 12px 9px;
        margin-top: 4px;
      }
      .idc-signature-block {
        text-align: center;
      }
      .idc-signature-img {
        height: 22px;
        object-fit: contain;
      }
      .idc-signature-line {
        border-top: 1.5px solid #16202b;
        margin-top: 2px;
        padding-top: 2px;
        font-size: 6.5px;
        font-weight: 800;
        letter-spacing: 0.6px;
        color: #16202b;
      }
      .idc-slogan-badge {
        display: flex;
        align-items: center;
        gap: 4px;
        color: #14532d;
        font-weight: 800;
        font-size: 6.8px;
        letter-spacing: 0.2px;
      }

      .idc-front-wave {
        height: 16px;
        background: linear-gradient(90deg, #14532d, #f5a623 50%, #14532d);
        position: relative;
      }
      .idc-front-wave::before {
        content: "";
        position: absolute;
        top: -10px; left: 0; right: 0;
        height: 12px;
        background: #fff;
        border-radius: 50% 50% 0 0 / 100% 100% 0 0;
      }

      /* ---------- BACK ---------- */
      .idc-back { display: flex; flex-direction: column; }

      .idc-back-header {
        background: #14532d;
        padding: 10px 14px 11px;
        text-align: center;
        position: relative;
        flex-shrink: 0;
      }
      .idc-back-header::after {
        content: "";
        position: absolute;
        left: 0; right: 0; bottom: -3px;
        height: 3px;
        background: #f5a623;
      }
      .idc-back-title {
        color: #fff;
        font-weight: 900;
        font-size: 14px;
        letter-spacing: 0.4px;
      }
      .idc-back-subtitle {
        color: #cfe8d7;
        font-weight: 700;
        font-size: 7.5px;
        letter-spacing: 0.7px;
        margin-top: 2px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
      }

      .idc-back-body {
        flex: 1;
        padding: 8px 14px 4px;
        display: flex;
        flex-direction: column;
      }

      .idc-rights-badge {
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

      .idc-rights-list {
        list-style: none;
        margin: 0 0 5px;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex-shrink: 0;
      }
      .idc-rights-list li {
        display: flex;
        gap: 4px;
        font-size: 5.6px;
        line-height: 1.25;
        color: #232b26;
      }
      .idc-rights-check {
        color: #16a34a;
        font-weight: 900;
        flex-shrink: 0;
      }

      .idc-return-block {
        border-top: 1px solid #dfe6e0;
        padding-top: 4px;
        text-align: center;
        flex-shrink: 0;
      }
      .idc-return-title {
        font-weight: 800;
        font-size: 6.2px;
        color: #14532d;
        letter-spacing: 0.2px;
        margin-bottom: 2px;
      }
      .idc-return-row {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 3px;
        font-size: 5.5px;
        color: #232b26;
        margin-bottom: 1px;
      }
      .idc-return-icon { flex-shrink: 0; }

      /* Back-body now grows to fit its content (no overflow:hidden / no
         forced aspect-ratio height), so the return-info block and the
         QR footer both always have the room they need and never get
         visually clipped. */
      .idc-back-footer {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
        padding: 6px 0 10px;
        flex-shrink: 0;
      }
      .idc-verify-label {
        font-weight: 800;
        font-size: 6.5px;
        color: #14532d;
        letter-spacing: 0.3px;
      }
      .idc-qr {
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
      .idc-qr img {
        width: 100%;
        height: 100%;
        display: block;
      }

      .idc-back-wave {
        height: 20px;
        position: relative;
        background: #14532d;
        flex-shrink: 0;
      }
      .idc-back-wave::before {
        content: "";
        position: absolute;
        top: -10px; left: 0; right: 0;
        height: 12px;
        background: #fff;
        border-radius: 50% 50% 0 0 / 100% 100% 0 0;
      }
      .idc-back-wave-triangle {
        position: absolute;
        bottom: 0; left: 50%;
        transform: translateX(-50%);
        width: 0; height: 0;
        border-left: 16px solid transparent;
        border-right: 16px solid transparent;
        border-bottom: 10px solid #2563a8;
      }
      .idc-back-wave-star {
        position: absolute;
        bottom: 1px; left: 50%;
        transform: translateX(-50%);
        color: #fff;
        font-size: 8px;
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

function CardFront({ student, studentId, issued }) {
  const shift = student?.shift || student?.classShift || "";

  return (
    <div className="idc-card idc-front" id="idc-print-front">
      <div className="idc-front-header">
        <div className="idc-logo-badge">
          <img src={schoolLogo} alt="Rising Star School logo" />
        </div>
        <div className="idc-school-block">
          <div className="idc-school-name1">RISING STAR</div>
          <div className="idc-school-name2">{SCHOOL.name2}</div>
        </div>
      </div>

      <div className="idc-front-body">
        <div className="idc-side-label">STUDENT ID CARD</div>

        <div className="idc-photo-wrap">
          {student?.studentPhoto ? (
            <img className="idc-photo" src={student.studentPhoto} alt={student.fullName || "Student"} />
          ) : (
            <div className="idc-photo-placeholder">
              <PersonIcon />
            </div>
          )}
        </div>

        <div className="idc-fields">
          <div className="idc-field-row">
            <span className="idc-field-label">NAME</span>
            <span className="idc-field-colon">:</span>
            <span className="idc-field-value">{student?.fullName || "—"}</span>
          </div>
          <div className="idc-field-row">
            <span className="idc-field-label">STUDENT ID</span>
            <span className="idc-field-colon">:</span>
            <span className="idc-field-value">{studentId || "—"}</span>
          </div>
          <div className="idc-field-row">
            <span className="idc-field-label">CLASS</span>
            <span className="idc-field-colon">:</span>
            <span className="idc-field-value">{student?.className || "—"}</span>
          </div>
          <div className="idc-field-row">
            <span className="idc-field-label">SHIFT</span>
            <span className="idc-field-colon">:</span>
            <span className="idc-field-value">{shift ? String(shift).toUpperCase() : "—"}</span>
          </div>
          <div className="idc-field-row">
            <span className="idc-field-label">ISSUE</span>
            <span className="idc-field-colon">:</span>
            <span className="idc-field-value">{issued?.str || "—"}</span>
          </div>
        </div>
      </div>

      <div className="idc-front-footer">
        <div className="idc-signature-block">
          <img className="idc-signature-img" src={principalSignature} alt="Principal's signature" />
          <div className="idc-signature-line">PRINCIPAL</div>
        </div>
        <div className="idc-slogan-badge">★ {SCHOOL.slogan}</div>
      </div>

      <div className="idc-front-wave" />
    </div>
  );
}

function CardBack({ student, studentId }) {
  // Points straight at the public verify page for this exact card — the
  // same design/data, scanned no-login-required. Uses the bare domain
  // (no "www.") because that's the DNS record that's actually live —
  // "www.resingstarschools.com" has no A/CNAME record yet, which is why
  // scanning previously hit ERR_NAME_NOT_RESOLVED.
  const verifyUrl = `https://resingstarschools.com/verify/student/${studentId || ""}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=0&data=${encodeURIComponent(
    verifyUrl
  )}`;

  return (
    <div className="idc-card idc-back" id="idc-print-back">
      <div className="idc-back-header">
        <div className="idc-back-title">RISING STAR</div>
        <div className="idc-back-subtitle">★ PRIMARY &amp; SECONDARY SCHOOL ★</div>
      </div>

      <div className="idc-back-body">
        <div className="idc-rights-badge">CARD HOLDER RIGHTS</div>

        <ul className="idc-rights-list">
          <li>
            <span className="idc-rights-check">✔</span>
            This card is the property of Rising Star Primary &amp; Secondary School.
          </li>
          <li>
            <span className="idc-rights-check">✔</span>
            This card must be carried by the student at all times within the school premises and during school activities.
          </li>
          <li>
            <span className="idc-rights-check">✔</span>
            This card is non-transferable and must be used only by the person to whom it is issued.
          </li>
          <li>
            <span className="idc-rights-check">✔</span>
            If this card is lost or found, please report to the school office immediately.
          </li>
          <li>
            <span className="idc-rights-check">✔</span>
            Misuse of this card may result in disciplinary action.
          </li>
        </ul>

        <div className="idc-return-block">
          <div className="idc-return-title">IN CASE OF FINDING THIS CARD, PLEASE RETURN TO:</div>
          <div className="idc-return-row">
            <span className="idc-return-icon">📍</span>
            <span>{SCHOOL.address1}, {SCHOOL.address2}</span>
          </div>
          <div className="idc-return-row">
            <span className="idc-return-icon">📞</span>
            <span>{SCHOOL.phone}</span>
          </div>
          <div className="idc-return-row">
            <span className="idc-return-icon">✉️</span>
            <span>{SCHOOL.email}</span>
          </div>
          <div className="idc-return-row">
            <span className="idc-return-icon">🌐</span>
            <span>{SCHOOL.website}</span>
          </div>
        </div>

        <div className="idc-back-footer">
          <div className="idc-verify-label">SCAN TO VERIFY</div>
          <div className="idc-qr">
            <img src={qrSrc} alt="QR code" />
          </div>
        </div>
      </div>

      <div className="idc-back-wave">
        <div className="idc-back-wave-triangle" />
        <div className="idc-back-wave-star">★</div>
      </div>
    </div>
  );
}

export default function StudentIdCard({ student, studentId }) {
  const issuedSource = student?.idIssuedAt || student?.createdAt;
  const issued = formatDate(issuedSource);

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
        <CardFront student={student} studentId={studentId} issued={issued} />
        <CardBack student={student} studentId={studentId} />
      </div>

      <div className="idc-print-hide" style={{ textAlign: "center", marginTop: 8 }}>
        <button
          onClick={handlePrint}
          style={{
            background: "#14532d",
            color: "#fff",
            border: "none",
            padding: "10px 24px",
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Print ID Card
        </button>
      </div>
    </div>
  );
}