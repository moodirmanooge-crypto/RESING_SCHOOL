// src/admin/pages/EditTeacher.jsx
// Lets the admin fill in / fix the fields an existing teacher is missing
// for their ID card (fatherName, phone, subjects), plus fullName/username.
// Loads the teacher by their Firestore doc id (= username) and updates
// only the relevant fields, without touching classes/password.
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "../../firebase/firebase";
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import {
  GraduationCap,
  User,
  Users,
  Phone,
  Mail,
  BookOpen,
  Loader2,
  Save,
} from "lucide-react";

export default function EditTeacher() {
  const { username } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const [fullName, setFullName] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [subjectsText, setSubjectsText] = useState("");

  useEffect(() => {
    loadTeacher();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  const loadTeacher = async () => {
    try {
      setLoading(true);
      const snap = await getDoc(doc(db, "teachers", username));
      if (!snap.exists()) {
        setNotFound(true);
        return;
      }
      const data = snap.data();
      setFullName(data.fullName || "");
      setFatherName(data.fatherName || data.parentName || "");
      setPhone(data.phone || data.phoneNumber || "");
      setEmail(data.email || (String(username).includes("@") ? username : ""));
      const subjects = Array.isArray(data.subjects) ? data.subjects : [];
      setSubjectsText(subjects.join(", "));
    } catch (err) {
      console.log(err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();

    if (!fullName.trim()) {
      alert("Fadlan geli magaca macalinka");
      return;
    }

    // Email-ka: OTP code-ka marka macalinku galayo Teacher Portal-ka halkan ayaa loo diraa.
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(cleanEmail)) {
      alert("Fadlan geli email sax ah — code-ka login-ka (OTP) halkan ayaa loo diraa.");
      return;
    }

    try {
      setSaving(true);

      const dup = await getDocs(query(collection(db, "teachers"), where("email", "==", cleanEmail)));
      if (dup.docs.some((d) => d.id !== username)) {
        alert("Email-kan macalin kale ayaa isticmaala. Fadlan email kale geli.");
        return;
      }

      const uniqueSubjects = [
        ...new Set(
          subjectsText
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
        ),
      ];

      await updateDoc(doc(db, "teachers", username), {
        fullName,
        fatherName,
        parentName: fatherName, // keep old field in sync too
        phone,
        phoneNumber: phone, // keep old field in sync too
        subjects: uniqueSubjects,
        email: cleanEmail,
      });

      alert("Macluumaadka macalinka waa la cusboonaysiiyay");
      navigate("/admin/teachers");
    } catch (err) {
      console.log(err);
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ background: "#0b0a1c", minHeight: "100vh", padding: 30, color: "#a9a6c4" }}>
        Loading...
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={{ background: "#0b0a1c", minHeight: "100vh", padding: 30, color: "#f87171" }}>
        Macalinkan lama helin (username: {username})
      </div>
    );
  }

  return (
    <div style={{ background: "#0b0a1c", minHeight: "100vh", padding: "30px" }}>
      <div
        style={{
          background: "linear-gradient(160deg,#151233,#181341)",
          borderRadius: 24,
          padding: "36px 40px",
          border: "1px solid rgba(139,108,245,0.25)",
          maxWidth: 700,
          margin: "0 auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
          <div
            style={{
              width: 52,
              height: 52,
              minWidth: 52,
              borderRadius: 14,
              background: "linear-gradient(135deg,#6d5df0,#8b6cf5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 8px 20px rgba(109,93,240,0.3)",
            }}
          >
            <GraduationCap color="#fff" size={26} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#fff" }}>
              Wax ka beddel Macalinka
            </h1>
            <p style={{ margin: "4px 0 0", color: "#8b87ad", fontSize: 13.5 }}>
              Username: <strong style={{ color: "#8b6cf5" }}>{username}</strong> — buuxi fields-ka
              ID Card-ka u baahan yahay.
            </p>
          </div>
        </div>

        <form onSubmit={save}>
          <Field icon={User} label="Magaca Macalinka">
            <input style={input} value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </Field>

          <div style={{ height: 18 }} />

          <Field icon={Users} label="Father's Name (Magaca Aabaha)">
            <input style={input} value={fatherName} onChange={(e) => setFatherName(e.target.value)} />
          </Field>

          <div style={{ height: 18 }} />

          <Field icon={Mail} label="Email-ka Macalinka (OTP code-ka halkan ayaa loo diraa)">
            <input
              style={input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Tusaale: cabdi@gmail.com"
            />
          </Field>

          <div style={{ height: 18 }} />

          <Field icon={Phone} label="Phone Number">
            <input style={input} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>

          <div style={{ height: 18 }} />

          <Field icon={BookOpen} label="Subjects (comma-separated, tusaale: Mathematics, English)">
            <input
              style={input}
              value={subjectsText}
              onChange={(e) => setSubjectsText(e.target.value)}
              placeholder="Mathematics, English"
            />
          </Field>

          <button type="submit" disabled={saving} style={submitBtn}>
            {saving ? (
              <>
                <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
                Kaydinaya...
              </>
            ) : (
              <>
                <Save size={18} />
                Kaydi Isbeddelka
              </>
            )}
          </button>
        </form>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        input::placeholder { color: #6b6890; }
      `}</style>
    </div>
  );
}

function Field({ icon: Icon, label: labelText, children }) {
  return (
    <div>
      <label style={label}>
        <Icon size={15} color="#8b6cf5" />
        {labelText}
      </label>
      {children}
    </div>
  );
}

const label = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  fontSize: 14,
  fontWeight: 600,
  color: "#fff",
  marginBottom: 8,
};

const input = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1.5px solid rgba(139,108,245,0.3)",
  boxSizing: "border-box",
  fontSize: 14,
  color: "#e5e3f7",
  background: "rgba(255,255,255,0.02)",
  outline: "none",
};

const submitBtn = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  background: "linear-gradient(90deg,#6d5df0,#8b6cf5)",
  color: "#fff",
  border: "none",
  padding: "16px",
  width: "100%",
  borderRadius: 14,
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 15,
  boxShadow: "0 10px 24px rgba(109,93,240,0.35)",
  marginTop: 28,
};