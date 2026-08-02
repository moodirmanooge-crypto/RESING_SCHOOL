// src/admin/pages/Settings.jsx
//
// Personal settings for the currently logged-in admin (Super Admin OR
// sub-admin) — each admin edits ONLY their own account here: their own
// password and their own profile photo. Nothing here is shared between
// admins; the doc read/written is `admin/{adminId}`, where adminId is
// whatever localStorage.getItem("adminId") stored at login (see
// LoginForm.jsx — that's the Firestore doc id, e.g. an email or
// username, unique per admin).

import { useEffect, useState } from "react";
import { db, storage } from "../../firebase/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { Settings as SettingsIcon, Camera, Lock, Save, Loader2, ShieldCheck } from "lucide-react";

export default function Settings() {
  const adminId = localStorage.getItem("adminId") || "";
  const adminRole = localStorage.getItem("adminRole") || "admin";

  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [savingPhoto, setSavingPhoto] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    fetchAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchAdmin() {
    if (!adminId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const snap = await getDoc(doc(db, "admin", adminId));
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() };
        setAdmin(data);
        setPhotoPreview(data.photoUrl || null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  // Saves ONLY this admin's own photo — writes to admin/{adminId}, never
  // touches any other admin's document, so each admin's photo stays
  // separate from every other admin's.
  async function savePhoto() {
    if (!photoFile) {
      alert("Fadlan dooro sawir cusub kahor intaadan kaydin.");
      return;
    }
    try {
      setSavingPhoto(true);

      const photoRef = ref(
        storage,
        `admin/${adminId}/${Date.now()}_${photoFile.name}`
      );
      await uploadBytes(photoRef, photoFile);
      const photoUrl = (await getDownloadURL(photoRef)).trim();

      await updateDoc(doc(db, "admin", adminId), { photoUrl });

      setAdmin((prev) => (prev ? { ...prev, photoUrl } : prev));
      setPhotoFile(null);
      alert("Sawirkaaga waa la cusboonaysiiyay.");
    } catch (err) {
      console.error(err);
      alert("Khalad ayaa dhacay markii sawirka la kaydinayay: " + err.message);
    } finally {
      setSavingPhoto(false);
    }
  }

  // Changes ONLY this admin's own password — writes to admin/{adminId}.
  // Requires the current password to match what's on file first, so an
  // admin can't change another admin's password even if they somehow
  // guessed their adminId.
  async function changePassword() {
    if (!currentPassword.trim()) {
      alert("Fadlan geli password-kaaga hadda jira.");
      return;
    }
    if (!admin || String(admin.password || "") !== currentPassword.trim()) {
      alert("Password-ka hadda jira waa khalad.");
      return;
    }
    if (!newPassword.trim() || newPassword.trim().length < 4) {
      alert("Password-ka cusub waa inuu ugu yaraan 4 xaraf ahaadaa.");
      return;
    }
    if (newPassword.trim() !== confirmPassword.trim()) {
      alert("Password-ka cusub iyo xaqiijintiisu isku mid ma aha.");
      return;
    }

    try {
      setSavingPassword(true);
      await updateDoc(doc(db, "admin", adminId), {
        password: newPassword.trim(),
      });
      setAdmin((prev) => (prev ? { ...prev, password: newPassword.trim() } : prev));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      alert("Password-kaaga waa la beddelay.");
    } catch (err) {
      console.error(err);
      alert("Khalad ayaa dhacay markii password-ka la beddelayay: " + err.message);
    } finally {
      setSavingPassword(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", background: "#0b0a1c" }}>
        <Sidebar />
        <div style={{ flex: 1, padding: 30 }}>
          <p style={{ color: "#8b87ad" }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!admin) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", background: "#0b0a1c" }}>
        <Sidebar />
        <div style={{ flex: 1, padding: 30 }}>
          <p style={{ color: "#8b87ad" }}>
            Xogtaada admin-ka lama helin. Fadlan mar kale soo gal (log in).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0b0a1c" }}>
      <Sidebar />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: "20px 24px 0" }}>
          <Topbar title="Settings" />
        </div>

        <div style={{ padding: "26px 30px", maxWidth: 720 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
            <div
              style={{
                width: 50,
                height: 50,
                borderRadius: 14,
                background: "linear-gradient(135deg,#6d5df0,#8b6cf5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <SettingsIcon color="#fff" size={24} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#fff" }}>
                Settings
              </h1>
              <p style={{ margin: "3px 0 0", color: "#8b87ad", fontSize: 13 }}>
                Halkan waxaad kaliya wax ka bedeli kartaa akoonkaaga gaarka ah
              </p>
            </div>
          </div>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(139,108,245,0.1)",
              border: "1px solid rgba(139,108,245,0.3)",
              color: "#c4b5fd",
              fontSize: 12.5,
              fontWeight: 700,
              padding: "8px 16px",
              borderRadius: 999,
              marginBottom: 24,
            }}
          >
            <ShieldCheck size={14} />
            {admin.fullName || admin.username || adminId}
            {" — "}
            {adminRole === "subadmin" ? "Sub-Admin" : "Super Admin"}
          </div>

          {/* ---- Sawirka ---- */}
          <div
            style={{
              background: "linear-gradient(160deg,#151233,#181341)",
              borderRadius: 20,
              padding: 26,
              border: "1px solid rgba(139,108,245,0.25)",
              marginBottom: 24,
            }}
          >
            <h3 style={{ margin: "0 0 18px", color: "#fff", fontSize: 15.5 }}>
              Sawirka Profile-kaaga
            </h3>

            <div style={{ display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap" }}>
              <label
                htmlFor="adminPhoto"
                style={{
                  width: 96,
                  height: 96,
                  minWidth: 96,
                  borderRadius: "50%",
                  background: photoPreview
                    ? `url(${photoPreview}) center/cover`
                    : "rgba(139,108,245,0.08)",
                  border: "2px dashed #6d5df0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  overflow: "hidden",
                }}
              >
                {!photoPreview && <Camera color="#8b6cf5" size={28} />}
              </label>
              <input
                id="adminPhoto"
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                style={{ display: "none" }}
              />

              <div style={{ flex: 1, minWidth: 200 }}>
                <p style={{ color: "#8b87ad", fontSize: 13, margin: "0 0 14px" }}>
                  Riix goobta si aad sawir cusub uga soo dooratid. Sawirkan waxaa
                  kaliya arkaya adiga — admin-yada kale sawirkooda gaarka ah ayay
                  leeyihiin.
                </p>
                <button
                  onClick={savePhoto}
                  disabled={savingPhoto || !photoFile}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    background: "linear-gradient(90deg,#6d5df0,#8b6cf5)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 10,
                    padding: "11px 22px",
                    fontWeight: 700,
                    fontSize: 13.5,
                    cursor: savingPhoto || !photoFile ? "not-allowed" : "pointer",
                    opacity: savingPhoto || !photoFile ? 0.6 : 1,
                  }}
                >
                  {savingPhoto ? (
                    <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                  ) : (
                    <Save size={15} />
                  )}
                  {savingPhoto ? "Kaydinaya..." : "Kaydi Sawirka"}
                </button>
              </div>
            </div>
          </div>

          {/* ---- Password ---- */}
          <div
            style={{
              background: "linear-gradient(160deg,#151233,#181341)",
              borderRadius: 20,
              padding: 26,
              border: "1px solid rgba(139,108,245,0.25)",
            }}
          >
            <h3
              style={{
                margin: "0 0 18px",
                color: "#fff",
                fontSize: 15.5,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Lock size={17} color="#8b6cf5" />
              Beddel Password-ka
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 380 }}>
              <div>
                <label style={label}>Password-ka Hadda</label>
                <input
                  type="password"
                  style={input}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label style={label}>Password-ka Cusub</label>
                <input
                  type="password"
                  style={input}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label style={label}>Xaqiiji Password-ka Cusub</label>
                <input
                  type="password"
                  style={input}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              <button
                onClick={changePassword}
                disabled={savingPassword}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  background: "linear-gradient(90deg,#6d5df0,#8b6cf5)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  padding: "12px 22px",
                  fontWeight: 700,
                  fontSize: 13.5,
                  cursor: savingPassword ? "not-allowed" : "pointer",
                  opacity: savingPassword ? 0.6 : 1,
                  marginTop: 4,
                }}
              >
                {savingPassword ? (
                  <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                ) : (
                  <Save size={15} />
                )}
                {savingPassword ? "Kaydinaya..." : "Kaydi Password-ka Cusub"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        input::placeholder { color: #6b6890; }
      `}</style>
    </div>
  );
}

const label = {
  display: "block",
  fontSize: 12.5,
  fontWeight: 600,
  color: "#a9a6c4",
  marginBottom: 6,
};

const input = {
  width: "100%",
  padding: "11px 14px",
  boxSizing: "border-box",
  border: "1.5px solid rgba(139,108,245,0.3)",
  borderRadius: 10,
  fontSize: 13.5,
  color: "#e5e3f7",
  background: "rgba(255,255,255,0.02)",
  outline: "none",
};