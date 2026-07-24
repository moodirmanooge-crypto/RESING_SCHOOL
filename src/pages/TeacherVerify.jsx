// src/pages/TeacherVerify.jsx
// Public verification page — this is what opens when someone scans the
// QR code printed on a Teacher ID card. No login required.
//
// It reads the teacher's persistent snapshot from
// `teacher_id/{teacherUsername}` (written once by TeacherIdCard.jsx the
// first time the teacher views their own card) and displays the same
// details that are printed on the physical/digital card: photo, full
// name, teacher ID (username), subject, phone, and date of joining —
// plus a green "Verified" badge confirming the card is genuine.

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import schoolLogo from "../admin/assets/logo.png";

const SCHOOL = {
  name: "RISING STAR PRIMARY & SECONDARY SCHOOL",
  website: "risingstarschools.com",
  location: "Mogadishu, Somalia",
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
  return `${day} ${month} ${year}`;
}

function VerifyStyles() {
  return (
    <style>{`
      .tv-page {
        min-height: 100vh;
        background: linear-gradient(180deg, #0f2e1c 0%, #14532d 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 28px 16px;
        font-family: 'Poppins','Inter','Segoe UI',system-ui,sans-serif;
      }
      .tv-card {
        width: 420px;
        max-width: 100%;
        background: #fff;
        border-radius: 22px;
        box-shadow: 0 20px 50px rgba(0,0,0,0.35);
        overflow: hidden;
      }
      .tv-header {
        background: #14532d;
        padding: 22px 22px 18px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        text-align: center;
      }
      .tv-logo {
        width: 62px;
        height: 62px;
        border-radius: 50%;
        background: #fff;
        border: 2px solid #f5a623;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .tv-logo img { width: 100%; height: 100%; object-fit: contain; }
      .tv-school-name {
        color: #fff;
        font-weight: 700;
        font-size: 13px;
        letter-spacing: 0.4px;
        line-height: 1.3;
      }
      .tv-badge {
        margin-top: 4px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: #1c6b3a;
        color: #fff;
        font-weight: 700;
        font-size: 11px;
        letter-spacing: 0.5px;
        padding: 5px 14px;
        border-radius: 20px;
      }
      .tv-body {
        padding: 22px;
        display: flex;
        gap: 16px;
      }
      .tv-photo {
        width: 92px;
        height: 110px;
        object-fit: cover;
        border-radius: 8px;
        border: 3px solid #1c6b3a;
        flex-shrink: 0;
        background: #eef3ee;
      }
      .tv-photo-placeholder {
        width: 92px;
        height: 110px;
        border-radius: 8px;
        border: 2px dashed #9db8a4;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        color: #6b8a73;
        text-align: center;
        flex-shrink: 0;
      }
      .tv-fields { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 10px; }
      .tv-field-label {
        font-size: 10.5px;
        font-weight: 700;
        color: #6b8a73;
        letter-spacing: 0.5px;
        text-transform: uppercase;
      }
      .tv-field-value {
        font-size: 14px;
        font-weight: 700;
        color: #14532d;
        overflow-wrap: break-word;
      }
      .tv-footer {
        padding: 14px 22px 20px;
        border-top: 1px solid #eef1ee;
        text-align: center;
        font-size: 11px;
        color: #6b8a73;
      }
      .tv-state {
        color: #fff;
        text-align: center;
        font-size: 15px;
        padding: 40px 20px;
      }
    `}</style>
  );
}

export default function TeacherVerify() {
  const { teacherUsername } = useParams();
  const [teacher, setTeacher] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | found | notfound | error

  useEffect(() => {
    let cancelled = false;

    async function fetchRecord() {
      if (!teacherUsername) {
        setStatus("notfound");
        return;
      }
      try {
        const cardRef = doc(db, "teacher_id", teacherUsername);
        const snap = await getDoc(cardRef);
        if (cancelled) return;
        if (snap.exists()) {
          setTeacher(snap.data());
          setStatus("found");
        } else {
          setStatus("notfound");
        }
      } catch (err) {
        console.error("Failed to load teacher_id record:", err);
        if (!cancelled) setStatus("error");
      }
    }

    fetchRecord();
    return () => {
      cancelled = true;
    };
  }, [teacherUsername]);

  if (status === "loading") {
    return (
      <div className="tv-page">
        <VerifyStyles />
        <p className="tv-state">Loading teacher ID…</p>
      </div>
    );
  }

  if (status === "notfound") {
    return (
      <div className="tv-page">
        <VerifyStyles />
        <div className="tv-card">
          <div className="tv-header">
            <div className="tv-logo"><img src={schoolLogo} alt="School logo" /></div>
            <div className="tv-school-name">{SCHOOL.name}</div>
          </div>
          <p className="tv-state" style={{ color: "#b91c1c", padding: 30 }}>
            No teacher ID card found for this code.
          </p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="tv-page">
        <VerifyStyles />
        <p className="tv-state">Something went wrong. Please try again later.</p>
      </div>
    );
  }

  // Show ALL subjects, comma-separated — matches TeacherIdCard.jsx exactly,
  // handling subjects stored as an array, a comma/semicolon-separated
  // string, or a single value.
  let subjectText = "—";
  if (Array.isArray(teacher?.subjects) && teacher.subjects.length > 0) {
    subjectText = teacher.subjects.filter(Boolean).join(", ");
  } else if (typeof teacher?.subjects === "string" && teacher.subjects.trim()) {
    subjectText = teacher.subjects
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .join(", ");
  } else if (teacher?.subject) {
    subjectText = teacher.subject;
  }

  const fullNameText =
    teacher?.fullName ||
    teacher?.name ||
    [teacher?.firstName, teacher?.lastName].filter(Boolean).join(" ") ||
    "—";

  const photoSrc = teacher?.teacherPhoto || teacher?.photoUrl || "";
  const joinedStr = formatDate(teacher?.createdAt);

  return (
    <div className="tv-page">
      <VerifyStyles />
      <div className="tv-card">
        <div className="tv-header">
          <div className="tv-logo"><img src={schoolLogo} alt="School logo" /></div>
          <div className="tv-school-name">{SCHOOL.name}</div>
          <span className="tv-badge">✔ VERIFIED TEACHER</span>
        </div>

        <div className="tv-body">
          {photoSrc ? (
            <img className="tv-photo" src={photoSrc} alt={fullNameText} />
          ) : (
            <div className="tv-photo-placeholder">No Photo</div>
          )}

          <div className="tv-fields">
            <div>
              <div className="tv-field-label">Teacher ID</div>
              <div className="tv-field-value">{teacherUsername}</div>
            </div>
            <div>
              <div className="tv-field-label">Teacher Name</div>
              <div className="tv-field-value">{fullNameText}</div>
            </div>
            <div>
              <div className="tv-field-label">Subject</div>
              <div className="tv-field-value">{subjectText}</div>
            </div>
            <div>
              <div className="tv-field-label">Phone Number</div>
              <div className="tv-field-value">{teacher?.phone || teacher?.phoneNumber || "—"}</div>
            </div>
            <div>
              <div className="tv-field-label">Date of Joining</div>
              <div className="tv-field-value">{joinedStr || "—"}</div>
            </div>
          </div>
        </div>

        <div className="tv-footer">
          {SCHOOL.website} • {SCHOOL.location}
        </div>
      </div>
    </div>
  );
}