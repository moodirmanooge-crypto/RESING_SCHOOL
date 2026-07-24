// src/admin/pages/Settings.jsx
import { useState, useEffect } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { Mail, Lock, Eye, EyeOff, ShieldCheck } from "lucide-react";

/*
  Sida ay u shaqeyso (nidaamkan xogta admin-ku ku jirto Firestore, oo aan
  isticmaalin Firebase Auth — login-ku wuxuu ka akhriyaa collection "admin"):

  1. Marka bogga la furo, waxaan ku raadinaa doc-ga admin-ka ee Firestore
     annagoo isticmaalayna "adminId" ee localStorage (kaas oo LoginForm.jsx
     lagu keydiyay marka la soo galay).
  2. Isbedelka email/password waxaa loo baahan yahay in la geliyo
     password-ka HADDA JIRA — waxaan ku hubinaa isaga oo la barbardhigayo
     qiimaha field-ka "password" ee doc-ga (plain text, sidii uu u shaqeeyo
     LoginForm.jsx).
  3. Marka la xaqiijiyo, si toos ah ayaan Firestore ugu update gareynaa
     field-ka "email" iyo/ama "password" doc-ga admin-ka. Marka xigta uu
     login sameeyo, xogtan cusub ayuu isticmaali doonaa (sida LoginForm.jsx
     ayaa u shaqeysa — waxay ka akhrisaa Firestore).
*/

export default function Settings() {
  const navigate = useNavigate();
  const adminId = localStorage.getItem("adminId");

  const [adminData, setAdminData] = useState(null);
  const [currentIdentity, setCurrentIdentity] = useState(""); // email or username shown
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  const [pageLoading, setPageLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null); // { type: "success" | "error", text }

  useEffect(() => {
    loadAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAdmin() {
    if (!adminId) {
      setMessage({ type: "error", text: "Ma jiro session admin ah. Fadlan mar kale soo gal." });
      setPageLoading(false);
      return;
    }

    try {
      const snap = await getDoc(doc(db, "admin", adminId));
      if (!snap.exists()) {
        setMessage({ type: "error", text: "Xogta admin-kan lama helin. Fadlan mar kale soo gal." });
        setPageLoading(false);
        return;
      }
      const data = snap.data();
      setAdminData(data);
      setCurrentIdentity(data.email || data.username || "");
    } catch (err) {
      console.error("Khalad admin-ka la soo qaadanayay:", err);
      setMessage({ type: "error", text: "Khalad ayaa dhacay markii xogta admin-ka la soo qaadanayay." });
    } finally {
      setPageLoading(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setMessage(null);

    if (!adminId || !adminData) {
      setMessage({ type: "error", text: "Ma jiro session admin ah. Fadlan mar kale soo gal." });
      return;
    }

    const wantsEmailChange = newEmail.trim() !== "" && newEmail.trim() !== (adminData.email || "");
    const wantsPasswordChange = newPassword.trim() !== "";

    if (!wantsEmailChange && !wantsPasswordChange) {
      setMessage({ type: "error", text: "Fadlan geli email cusub ama password cusub si aad wax u beddesho." });
      return;
    }

    if (!currentPassword) {
      setMessage({ type: "error", text: "Waxaad u baahan tahay inaad gelisid password-kaaga hadda jira si loo xaqiijiyo isbedelka." });
      return;
    }

    if (currentPassword !== adminData.password) {
      setMessage({ type: "error", text: "Password-ka hadda jira ee aad gelisay sax ma aha." });
      return;
    }

    if (wantsPasswordChange) {
      if (newPassword.length < 4) {
        setMessage({ type: "error", text: "Password-ka cusub waa inuu ka koobnaadaa ugu yaraan 4 xaraf." });
        return;
      }
      if (newPassword !== confirmPassword) {
        setMessage({ type: "error", text: "Password-ka cusub iyo xaqiijinta password-ku isku mid ma aha." });
        return;
      }
    }

    setLoading(true);
    try {
      const updates = {};
      if (wantsEmailChange) updates.email = newEmail.trim();
      if (wantsPasswordChange) updates.password = newPassword.trim();

      await updateDoc(doc(db, "admin", adminId), updates);

      const updatedData = { ...adminData, ...updates };
      setAdminData(updatedData);
      setCurrentIdentity(updatedData.email || updatedData.username || "");

      setMessage({
        type: "success",
        text: "Xogta si guul leh ayaa loo cusboonaysiiyay. Marka aad mar kale soo gasho, xogtan cusub ayaa loo isticmaali doonaa.",
      });
      setNewEmail("");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error("Khalad settings update:", err);
      setMessage({ type: "error", text: "Khalad ayaa dhacay markii la kaydinayay. Fadlan isku day mar kale." });
    } finally {
      setLoading(false);
    }
  }

  if (pageLoading) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", background: "#F3F4F8" }}>
        <Sidebar />
        <div style={{ flex: 1, padding: 30, fontFamily: "'Inter','Segoe UI',sans-serif" }}>
          <Topbar />
          <p style={{ marginTop: 20, color: "#6B7280", fontSize: 14 }}>Soo raraya...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "#F3F4F8",
        fontFamily: "'Inter','Segoe UI',sans-serif",
      }}
    >
      <Sidebar />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: "22px 26px 0" }}>
          <Topbar />
        </div>

        <div style={{ padding: "26px 30px", maxWidth: 640 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: "0 0 4px" }}>
            Settings
          </h1>
          <p style={{ fontSize: 13.5, color: "#6B7280", margin: "0 0 24px" }}>
            Halkan ka beddel email-ka iyo password-ka account-ka admin-ka.
          </p>

          {!adminId || !adminData ? (
            <div
              style={{
                background: "#FEE2E2",
                color: "#DC2626",
                padding: "16px 18px",
                borderRadius: 14,
                fontSize: 13.5,
                fontWeight: 600,
              }}
            >
              {message?.text || "Ma jiro session admin ah. Fadlan mar kale soo gal."}
            </div>
          ) : (
            <form
              onSubmit={handleSave}
              style={{
                background: "#fff",
                borderRadius: 18,
                padding: "26px 26px",
                boxShadow: "0 4px 18px rgba(17,24,39,0.06)",
                border: "1px solid rgba(17,24,39,0.05)",
              }}
            >
              {/* Current identity display */}
              <div style={{ marginBottom: 22 }}>
                <label style={labelStyle}>Email/Username-ka Hadda</label>
                <div style={{ ...inputWrapStyle, background: "#F9FAFB" }}>
                  <Mail size={16} color="#9CA3AF" />
                  <input
                    type="text"
                    value={currentIdentity}
                    disabled
                    style={{ ...inputStyle, color: "#6B7280" }}
                  />
                </div>
              </div>

              {/* New email */}
              <div style={{ marginBottom: 22 }}>
                <label style={labelStyle}>Email Cusub (ka bogeeya haddii aadan beddelin)</label>
                <div style={inputWrapStyle}>
                  <Mail size={16} color="#9CA3AF" />
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="tusaale@rising.edu"
                    style={inputStyle}
                  />
                </div>
              </div>

              <hr style={{ border: "none", borderTop: "1px solid #F3F4F6", margin: "22px 0" }} />

              {/* New password */}
              <div style={{ marginBottom: 18 }}>
                <label style={labelStyle}>Password Cusub (ka bogeeya haddii aadan beddelin)</label>
                <div style={inputWrapStyle}>
                  <Lock size={16} color="#9CA3AF" />
                  <input
                    type={showNewPw ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Ugu yaraan 4 xaraf"
                    style={inputStyle}
                  />
                  <button type="button" onClick={() => setShowNewPw((s) => !s)} style={eyeBtnStyle}>
                    {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: 22 }}>
                <label style={labelStyle}>Xaqiiji Password Cusub</label>
                <div style={inputWrapStyle}>
                  <Lock size={16} color="#9CA3AF" />
                  <input
                    type={showNewPw ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ku celi password-ka cusub"
                    style={inputStyle}
                  />
                </div>
              </div>

              <hr style={{ border: "none", borderTop: "1px solid #F3F4F6", margin: "22px 0" }} />

              {/* Current password (required for both) */}
              <div style={{ marginBottom: 22 }}>
                <label style={labelStyle}>
                  <ShieldCheck size={14} style={{ marginRight: 4, verticalAlign: "-2px" }} />
                  Password-ka Hadda Jira (waajib si loo xaqiijiyo)
                </label>
                <div style={inputWrapStyle}>
                  <Lock size={16} color="#9CA3AF" />
                  <input
                    type={showCurrentPw ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Geli password-kaaga hadda"
                    style={inputStyle}
                  />
                  <button type="button" onClick={() => setShowCurrentPw((s) => !s)} style={eyeBtnStyle}>
                    {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {message && (
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: 10,
                    fontSize: 13,
                    marginBottom: 18,
                    background: message.type === "success" ? "#DCFCE7" : "#FEE2E2",
                    color: message.type === "success" ? "#166534" : "#DC2626",
                    fontWeight: 600,
                  }}
                >
                  {message.text}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "13px 0",
                  borderRadius: 12,
                  border: "none",
                  background: loading ? "#86efac" : "#16a34a",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "Kaydinaya..." : "Kaydi Isbedelada"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

const labelStyle = {
  display: "block",
  fontSize: 12.5,
  fontWeight: 700,
  color: "#374151",
  marginBottom: 8,
};

const inputWrapStyle = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  border: "1px solid #E5E7EB",
  borderRadius: 12,
  padding: "11px 14px",
  background: "#fff",
};

const inputStyle = {
  border: "none",
  outline: "none",
  flex: 1,
  fontSize: 13.5,
  color: "#111827",
  background: "transparent",
};

const eyeBtnStyle = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  color: "#9CA3AF",
  display: "flex",
  alignItems: "center",
};