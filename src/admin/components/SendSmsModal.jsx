//src/admin/components/SendSmsModal.jsx
import { useEffect, useState } from "react";
import { X, Send, Users, GraduationCap, User, CheckCircle2, XCircle } from "lucide-react";
import { db } from "../../firebase/firebase";
import { collection, getDocs } from "firebase/firestore";
import app from "../../firebase/firebase";


/**
 * SendSmsModal
 * ---------------------------------------------------------------------
 * A modal the admin opens from the Dashboard by tapping "Send SMS".
 * Steps:
 *   1. Pick an audience: All Parents / All Teachers / One Teacher /
 *      All Students / One Student.
 *   2. If "One Teacher" or "One Student" is picked, choose the person
 *      from a dropdown (loaded live from Firestore).
 *   3. Type the message.
 *   4. Tap "Send" -> calls the "sendBulkSms" Cloud Function, which
 *      looks the phone number(s) up in Firestore itself and sends the
 *      real SMS through Hormuud.
 *
 * Usage in Dashboard.jsx:
 *   import SendSmsModal from "../components/SendSmsModal";
 *   const [smsOpen, setSmsOpen] = useState(false);
 *   ...
 *   <button onClick={() => setSmsOpen(true)}>Send SMS</button>
 *   {smsOpen && <SendSmsModal onClose={() => setSmsOpen(false)} />}
 * ---------------------------------------------------------------------
 */

const AUDIENCES = [
  { id: "all_parents", label: "Dhamaan Waalidiinta", icon: Users, needsPicker: false },
  { id: "one_parent", label: "Waalid Gaar ah", icon: User, needsPicker: "students" },
  { id: "all_teachers", label: "Dhamaan Macalimiinta", icon: Users, needsPicker: false },
  { id: "one_teacher", label: "Macalin Gaar ah", icon: User, needsPicker: "teachers" },
  { id: "all_students", label: "Dhamaan Ardayda", icon: GraduationCap, needsPicker: false },
  { id: "one_student", label: "Arday Gaar ah", icon: User, needsPicker: "students" },
];

export default function SendSmsModal({ onClose }) {
  const [audience, setAudience] = useState("all_parents");
  const [message, setMessage] = useState("");
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [targetId, setTargetId] = useState("");
  const [teacherSearch, setTeacherSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [loadingLists, setLoadingLists] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null); // { successCount, failCount, results }
  const [errorMsg, setErrorMsg] = useState("");

  const currentAudience = AUDIENCES.find((a) => a.id === audience);

  // Load teacher/student lists once, lazily, when needed for the picker.
  useEffect(() => {
    async function loadPickerData() {
      if (currentAudience?.needsPicker === "teachers" && teachers.length === 0) {
        setLoadingLists(true);
        const snap = await getDocs(collection(db, "teachers"));
        setTeachers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoadingLists(false);
      }
      if (currentAudience?.needsPicker === "students" && students.length === 0) {
        setLoadingLists(true);
        const snap = await getDocs(collection(db, "students"));
        setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoadingLists(false);
      }
    }
    loadPickerData();
    setTargetId("");
    setTeacherSearch("");
    setStudentSearch("");
    setResult(null);
    setErrorMsg("");
  }, [audience]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filtered lists based on what the admin types in the search box.
  // Teacher: searchable by full name OR username.
  // Student: searchable by full name OR student ID.
  const filteredTeachers = teachers.filter((t) => {
    const q = teacherSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      (t.fullName || "").toLowerCase().includes(q) ||
      (t.username || "").toLowerCase().includes(q) ||
      (t.id || "").toLowerCase().includes(q)
    );
  });

  const filteredStudents = students.filter((s) => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      (s.fullName || "").toLowerCase().includes(q) ||
      (s.studentId || "").toLowerCase().includes(q) ||
      (s.id || "").toLowerCase().includes(q)
    );
  });

  async function handleSend() {
    setErrorMsg("");
    setResult(null);

    if (!message.trim()) {
      setErrorMsg("Fadlan qor fariinta aad rabto in la diro.");
      return;
    }
    if (currentAudience.needsPicker && !targetId) {
      setErrorMsg("Fadlan dooro qofka aad rabto in fariinta loo diro.");
      return;
    }

    try {
      setSending(true);
      const response = await fetch(
        "https://us-central1-one-click-onilne.cloudfunctions.net/sendBulkSms",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            audience,
            targetId: currentAudience.needsPicker ? targetId : null,
            message: message.trim(),
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "SMS send failed");
      }
      setResult(data);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "SMS send failed.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 20,
          width: "100%",
          maxWidth: 480,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 22px",
            borderBottom: "1px solid #F3F4F6",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "linear-gradient(135deg,#16a34a,#15803d)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Send size={17} color="#fff" />
            </div>
            <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 800, color: "#111827" }}>
              Send SMS
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "#F3F4F6",
              borderRadius: 8,
              width: 30,
              height: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <X size={16} color="#6B7280" />
          </button>
        </div>

        <div style={{ padding: "20px 22px" }}>
          {/* Audience selector */}
          <label style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 8, display: "block" }}>
            Ay u dirto
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
            {AUDIENCES.map((a) => {
              const Icon = a.icon;
              const active = audience === a.id;
              return (
                <button
                  key={a.id}
                  onClick={() => setAudience(a.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: active ? "1.5px solid #16a34a" : "1px solid #E5E7EB",
                    background: active ? "#EFFBF3" : "#fff",
                    color: active ? "#14532d" : "#4b5563",
                    fontWeight: active ? 700 : 500,
                    fontSize: 12.5,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <Icon size={15} />
                  {a.label}
                </button>
              );
            })}
          </div>

          {/* Picker for one_teacher / one_student */}
          {currentAudience.needsPicker === "teachers" && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, display: "block" }}>
                Dooro Macalinka
              </label>
              <input
                type="text"
                value={teacherSearch}
                onChange={(e) => setTeacherSearch(e.target.value)}
                placeholder="Ka raadi magaca ama username-ka macalinka..."
                style={{ ...selectStyle, marginBottom: 8 }}
              />
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                style={selectStyle}
              >
                <option value="">
                  {loadingLists
                    ? "Soo raraya..."
                    : filteredTeachers.length === 0
                    ? "-- Lama helin macalin --"
                    : "-- Dooro macalin --"}
                </option>
                {filteredTeachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName || t.id} {t.username ? `(@${t.username})` : ""} {t.subject ? `— ${t.subject}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {currentAudience.needsPicker === "students" && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, display: "block" }}>
                {audience === "one_parent" ? "Dooro Ardayga (si loo helo Waalidkiisa)" : "Dooro Ardayga"}
              </label>
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Ka raadi magaca ama Student ID-ga..."
                style={{ ...selectStyle, marginBottom: 8 }}
              />
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                style={selectStyle}
              >
                <option value="">
                  {loadingLists
                    ? "Soo raraya..."
                    : filteredStudents.length === 0
                    ? "-- Lama helin arday --"
                    : "-- Dooro arday --"}
                </option>
                {filteredStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName || s.id} {s.studentId ? `(ID: ${s.studentId})` : ""} {s.className ? `— Class ${s.className}` : ""}
                  </option>
                ))}
              </select>
              {audience === "one_parent" && targetId && (
                <div style={{ fontSize: 12, color: "#6B7280", marginTop: 6 }}>
                  {(() => {
                    const s = students.find((st) => st.id === targetId);
                    return s?.parentPhone
                      ? `SMS-ku wuxuu ku baxayaa: ${s.parentPhone}`
                      : "⚠️ Ardaygan lambar waalid ah lama duubin (parentPhone).";
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Message */}
          <label style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, display: "block" }}>
            Fariinta
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Qor fariinta halkan..."
            rows={4}
            style={{
              width: "100%",
              borderRadius: 12,
              border: "1px solid #E5E7EB",
              padding: "10px 12px",
              fontSize: 13.5,
              fontFamily: "inherit",
              resize: "vertical",
              boxSizing: "border-box",
              marginBottom: 6,
            }}
          />
          <div style={{ fontSize: 11.5, color: "#9CA3AF", marginBottom: 16 }}>
            {message.length} xaraf
          </div>

          {errorMsg && (
            <div
              style={{
                background: "#FEF2F2",
                color: "#DC2626",
                fontSize: 13,
                padding: "10px 12px",
                borderRadius: 10,
                marginBottom: 14,
              }}
            >
              {errorMsg}
            </div>
          )}

          {result && (
            <div
              style={{
                background: "#F0FDF4",
                border: "1px solid rgba(22,163,74,0.2)",
                borderRadius: 12,
                padding: "12px 14px",
                marginBottom: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <CheckCircle2 size={16} color="#16a34a" />
                <span style={{ fontSize: 13.5, fontWeight: 700, color: "#14532d" }}>
                  {result.successCount} / {result.total} SMS ayaa si guul ah loo diray
                </span>
              </div>
              {result.failCount > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <XCircle size={16} color="#DC2626" />
                  <span style={{ fontSize: 12.5, color: "#DC2626" }}>
                    {result.failCount} lambar ayaan si guul ah loo dirin
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={sending}
            style={{
              width: "100%",
              padding: "13px 0",
              borderRadius: 12,
              border: "none",
              background: sending ? "#9CA3AF" : "linear-gradient(90deg,#16a34a,#15803d)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              cursor: sending ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Send size={16} />
            {sending ? "Dirayaa..." : "Dir SMS"}
          </button>
        </div>
      </div>
    </div>
  );
}

const selectStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #E5E7EB",
  fontSize: 13.5,
  fontFamily: "inherit",
  background: "#fff",
  boxSizing: "border-box",
};