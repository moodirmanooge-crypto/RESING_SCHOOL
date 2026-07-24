// src/admin/pages/Settings.jsx
import { useState, useEffect, useRef } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { db, app } from "../../firebase/firebase";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { Mail, Lock, Eye, EyeOff, ShieldCheck, Camera, Loader2 } from "lucide-react";

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

  4. SAWIRKA PROFILE-KA (photoUrl): admin-ku wuxuu keliya beddeli karaa
     SAWIRKIISA GAARKA AH. Upload-ku wuxuu isticmaalaa Firebase Storage,
     kadibna URL-ka soo baxa waxaa lagu qoraa KELIYA doc-ga
     admin/{adminId} ee session-ka hadda socda — lama taabanayo/lama
     update gareynayo doc-yada admin-yada kale (tusaale: admin1, admin2...).
     Tani waxay ka hortagaysaa in admin-yada ay isku beddelaan sawirrada
     midba midka kale.
*/

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function Settings() {
  const navigate = useNavigate();
  const adminId = localStorage.getItem("adminId");
  const fileInputRef = useRef(null);

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

  // Photo upload state (kept separate from the email/password flow)
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoMessage, setPhotoMessage] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");

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
      setPhotoPreview(data.photoUrl || "");
    } catch (err) {
      console.error("Khalad admin-ka la soo qaadanayay:", err);
      setMessage({ type: "error", text: "Khalad ayaa dhacay markii xogta admin-ka la soo qaadanayay." });
    } finally {
      setPageLoading(false);
    }
  }

  // ---- Profile photo upload: touches ONLY admin/{adminId} (the logged-in
  // admin's own doc). It never reads or writes any other admin document. ----
  function handlePhotoButtonClick() {
    setPhotoMessage(null);
    fileInputRef.current?.click();
  }

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    setPhotoMessage(null);

    if (!adminId) {
      setPhotoMessage({ type: "error", text: "Ma jiro session admin ah. Fadlan mar kale soo gal." });
      return;
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      setPhotoMessage({ type: "error", text: "Fadlan dooro sawir (JPG, PNG, ama WEBP) oo keliya." });
      return;
    }

    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoMessage({ type: "error", text: "Sawirku waa inuu ka yar yahay 5MB." });
      return;
    }

    // Local preview while uploading
    const localUrl = URL.createObjectURL(file);
    setPhotoPreview(localUrl);
    setPhotoUploading(true);

    try {
      const storage = getStorage(app);
      const extension = file.name.split(".").pop() || "jpg";
      // Path is scoped to this admin's own id — no other admin's file can
      // be overwritten by this upload.
      const storageRef = ref(storage, `adminPhotos/${adminId}-${Date.now()}.${extension}`);

      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);

      // Update ONLY this admin's own document.
      await updateDoc(doc(db, "admin", adminId), { photoUrl: downloadUrl });

      setAdminData((prev) => ({ ...prev, photoUrl: downloadUrl }));
      setPhotoPreview(downloadUrl);
      setPhotoMessage({ type: "success", text: "Sawirkaaga si guul leh ayaa loo cusboonaysiiyay." });
    } catch (err) {
      console.error("Khalad photo upload:", err);
      setPhotoMessage({ type: "error", text: "Khalad ayaa dhacay markii sawirka la soo shubayay. Isku day mar kale." });
      setPhotoPreview(adminData?.photoUrl || "");
    } finally {
      setPhotoUploading(false);
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
            Halkan ka beddel email-ka, password-ka, iyo sawirka account-kaaga admin-ka.
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
            <>
              {/* Profile photo card — affects ONLY this admin's own document */}
              <div
                style={{
                  background: "#fff",
                  borderRadius: 18,
                  padding: "26px 26px",
                  boxShadow: "0 4px 18px rgba(17,24,39,0.06)",
                  border: "1px solid rgba(17,24,39,0.05)",
                  marginBottom: 20,
                  display: "flex",
                  alignItems: "center",
                  gap: 20,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <div
                    style={{
                      width: 84,
                      height: 84,
                      borderRadius: "50%",
                      overflow: "hidden",
                      background: "#E6F5EC",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 30,
                      fontWeight: 800,
                      color: "#16a34a",
                      border: "3px solid #F3F4F6",
                    }}
                  >
                    {photoPreview ? (
                      <img
                        src={photoPreview}
                        alt="Sawirka profile-ka"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      (currentIdentity || "A").charAt(0).toUpperCase()
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handlePhotoButtonClick}
                    disabled={photoUploading}
                    title="Beddel sawirka"
                    style={{
                      position: "absolute",
                      bottom: -2,
                      right: -2,
                      width: 30,
                      height: 30,
                      borderRadius: "50%",
                      border: "2px solid #fff",
                      background: photoUploading ? "#86efac" : "#16a34a",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: photoUploading ? "not-allowed" : "pointer",
                    }}
                  >
                    {photoUploading ? (
                      <Loader2 size={14} className="spin" />
                    ) : (
                      <Camera size={14} />
                    )}
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handlePhotoChange}
                    style={{ display: "none" }}
                  />
                </div>

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
                    Sawirka Profile-ka
                  </div>
                  <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "#6B7280", lineHeight: 1.5 }}>
                    Sawirkan waxaa keliya la wada arki doonaa xogtaada gaarka ah — beddelkani
                    kuma saameyn doono admin-yada kale ee nidaamka.
                  </p>
                  <button
                    type="button"
                    onClick={handlePhotoButtonClick}
                    disabled={photoUploading}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 16px",
                      borderRadius: 10,
                      border: "1px solid #E5E7EB",
                      background: "#F9FAFB",
                      color: "#111827",
                      fontWeight: 700,
                      fontSize: 12.5,
                      cursor: photoUploading ? "not-allowed" : "pointer",
                    }}
                  >
                    {photoUploading ? "Waa la soo shubayaa..." : "Dooro Sawir Cusub"}
                  </button>

                  {photoMessage && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: "8px 12px",
                        borderRadius: 8,
                        fontSize: 12.5,
                        fontWeight: 600,
                        background: photoMessage.type === "success" ? "#DCFCE7" : "#FEE2E2",
                        color: photoMessage.type === "success" ? "#166534" : "#DC2626",
                      }}
                    >
                      {photoMessage.text}
                    </div>
                  )}
                </div>
              </div>

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
            </>
          )}
        </div>
      </div>

      <style>{`
        .spin {
          animation: spin 0.9s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
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