// src/teacher/Profile.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { LogOut } from "lucide-react";

import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import MobileBottomNav from "./MobileBottomNav";

function ProfileStyles() {
  return (
    <style>{`
      .pf-layout { display: flex; min-height: 100vh; background: #05070D; }
      .pf-content { flex: 1; display: flex; flex-direction: column; min-width: 0; }
      .pf-body { padding: 0 20px 30px; max-width: 640px; box-sizing: border-box; }
      .pf-photo-row { display: flex; align-items: center; gap: 20px; margin-bottom: 20px; flex-wrap: wrap; }

      @media (max-width: 900px) {
        .pf-body { padding: 0 14px 90px; max-width: 100%; }
        .pf-section { padding: 16px !important; border-radius: 16px !important; }
        .pf-photo-row { gap: 14px !important; }
        .pf-btn-primary { width: 100%; text-align: center; justify-content: center; }
      }
    `}</style>
  );
}

// Shrinks an uploaded photo down to a small square-ish JPEG before it's
// stored. Without this, a phone-camera photo can be several MB as a
// base64 string, which is too big for a Firestore document field (1MB
// per doc) — the save silently fails and the photo never makes it to
// other devices, even though it "looks fine" on the device that picked
// it (that device is just showing its own local file preview).
function resizeImageToDataUrl(file, maxSize = 300, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not read the image"));
      img.onload = () => {
        let { width, height } = img;
        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function Profile() {
  const navigate = useNavigate();
  const teacherId = localStorage.getItem("teacherId") || "";

  const [teacher, setTeacher] = useState(null);
  const [loading, setLoading] = useState(true);

  const [username, setUsername] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    loadTeacher();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTeacher = async () => {
    try {
      setLoading(true);

      if (!teacherId) {
        setLoading(false);
        return;
      }

      const snap = await getDoc(doc(db, "teachers", teacherId));
      if (snap.exists()) {
        const data = snap.data();
        setTeacher(data);
        setUsername(data.username || "");
        // Profile-edit photo field mirrors whichever field is already
        // populated on the record (some docs use teacherPhoto, older
        // ones may use photoUrl) so editing here doesn't clobber the
        // photo the ID card reads from.
        setPhotoUrl(data.photoUrl || data.teacherPhoto || "");
      }
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  // Picking a new photo now saves it to Firestore immediately — the
  // teacher doesn't have to separately remember to hit "Save Profile"
  // just to get the photo to sync to their other device (phone).
  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploadingPhoto(true);

      const resizedDataUrl = await resizeImageToDataUrl(file);
      setPhotoUrl(resizedDataUrl);

      if (teacherId) {
        await updateDoc(doc(db, "teachers", teacherId), {
          photoUrl: resizedDataUrl,
          updatedAt: new Date(),
        });
        localStorage.setItem("teacherPhoto", resizedDataUrl);
        setTeacher((prev) => (prev ? { ...prev, photoUrl: resizedDataUrl } : prev));
      }
    } catch (err) {
      console.log(err);
      alert("Sawirka lama kaydin karin. Isku day sawir kale oo yar.");
    } finally {
      setUploadingPhoto(false);
      // allow re-selecting the same file again later
      e.target.value = "";
    }
  };

  const saveProfile = async () => {
    if (!username.trim()) {
      alert("Username cannot be empty");
      return;
    }

    try {
      setSavingProfile(true);

      await updateDoc(doc(db, "teachers", teacherId), {
        username,
        photoUrl,
        updatedAt: new Date(),
      });

      localStorage.setItem("teacherName", username);
      localStorage.setItem("teacherPhoto", photoUrl);
      setTeacher((prev) => (prev ? { ...prev, username, photoUrl } : prev));
      alert("Profile updated successfully");
    } catch (err) {
      console.log(err);
      alert(err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      alert("Please fill all password fields");
      return;
    }

    if (teacher && teacher.password && currentPassword !== teacher.password) {
      alert("Current password is incorrect");
      return;
    }

    if (newPassword !== confirmPassword) {
      alert("New passwords do not match");
      return;
    }

    try {
      setSavingPassword(true);

      await updateDoc(doc(db, "teachers", teacherId), {
        password: newPassword,
        updatedAt: new Date(),
      });

      alert("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.log(err);
      alert(err.message);
    } finally {
      setSavingPassword(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("teacherId");
    localStorage.removeItem("teacherName");
    navigate("/login/teacher");
  };

  const teacherName = localStorage.getItem("teacherName") || "Teacher";

  return (
    <div className="pf-layout">
      <ProfileStyles />
      <Sidebar teacherName={teacherName} />

      <div className="pf-content">
        <Topbar teacherName={teacherName} />

        <div className="pf-body">
          {loading ? (
            <p style={{ color: "#94A3B8" }}>Loading profile...</p>
          ) : (
            <>
              <div className="pf-section" style={section}>
                <h3 style={sectionTitle}>Photo & Username</h3>

                <div className="pf-photo-row">
                  {photoUrl ? (
                    <img src={photoUrl} alt="Profile" style={photoImg} />
                  ) : (
                    <div style={photoPlaceholder}>
                      {(username || "T").charAt(0).toUpperCase()}
                    </div>
                  )}

                  <label
                    style={{
                      ...uploadBtn,
                      opacity: uploadingPhoto ? 0.6 : 1,
                      cursor: uploadingPhoto ? "not-allowed" : "pointer",
                    }}
                  >
                    {uploadingPhoto ? "Uploading..." : "Change Photo"}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      disabled={uploadingPhoto}
                      style={{ display: "none" }}
                    />
                  </label>
                </div>

                <label style={label}>Username</label>
                <input
                  style={input}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />

                <button
                  onClick={saveProfile}
                  disabled={savingProfile}
                  className="pf-btn-primary"
                  style={{ ...btnPrimary, marginTop: 16 }}
                >
                  {savingProfile ? "Saving..." : "Save Profile"}
                </button>
              </div>

              <div className="pf-section" style={section}>
                <h3 style={sectionTitle}>Change Password</h3>

                <label style={label}>Current Password</label>
                <input
                  style={input}
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />

                <label style={label}>New Password</label>
                <input
                  style={input}
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />

                <label style={label}>Confirm New Password</label>
                <input
                  style={input}
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />

                <button
                  onClick={changePassword}
                  disabled={savingPassword}
                  className="pf-btn-primary"
                  style={{ ...btnPrimary, marginTop: 16 }}
                >
                  {savingPassword ? "Saving..." : "Change Password"}
                </button>
              </div>

              <button onClick={logout} style={btnLogout}>
                <LogOut size={18} />
                Logout
              </button>
            </>
          )}
        </div>
      </div>

      {/* Bottom tab bar — mobile only (hidden via CSS on desktop) */}
      <MobileBottomNav />
    </div>
  );
}

const section = {
  background: "#0B1120",
  border: "1px solid rgba(255,255,255,.06)",
  borderRadius: 20,
  padding: 24,
  marginBottom: 24,
};
const sectionTitle = {
  marginTop: 0,
  color: "#fff",
};
const photoImg = {
  width: 80,
  height: 80,
  borderRadius: "50%",
  objectFit: "cover",
  border: "3px solid #6D5DF0",
};
const photoPlaceholder = {
  width: 80,
  height: 80,
  borderRadius: "50%",
  background: "linear-gradient(135deg,#6D5DF0,#8B5CF6)",
  color: "white",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 28,
  fontWeight: "bold",
};
const uploadBtn = {
  background: "#111827",
  border: "1px solid rgba(255,255,255,.1)",
  borderRadius: 10,
  padding: "10px 16px",
  cursor: "pointer",
  fontSize: 14,
  color: "#fff",
};
const label = {
  display: "block",
  fontWeight: "bold",
  marginTop: 12,
  marginBottom: 6,
  color: "#94A3B8",
  fontSize: 13,
};
const input = {
  width: "100%",
  padding: "10px 12px",
  boxSizing: "border-box",
  border: "1px solid rgba(255,255,255,.1)",
  borderRadius: 10,
  background: "#111827",
  color: "#fff",
};
const btnPrimary = {
  background: "linear-gradient(90deg,#6D5DF0,#8B5CF6)",
  color: "white",
  border: "none",
  borderRadius: 10,
  padding: "12px 24px",
  cursor: "pointer",
  fontWeight: "bold",
};
const btnLogout = {
  background: "#EF4444",
  color: "white",
  border: "none",
  borderRadius: 10,
  padding: "12px 24px",
  cursor: "pointer",
  fontWeight: "bold",
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  marginBottom: 30,
  boxSizing: "border-box",
};