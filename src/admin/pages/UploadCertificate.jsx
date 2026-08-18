// src/admin/pages/UploadCertificate.jsx
//
// Admin page for uploading the single hero photo/video shown on the
// public Home page (the box next to "NURTURING MINDS, BUILDING
// FUTURES"). Uploads the file to Firebase Storage (`homepage/`) and
// writes/overwrites one fixed Firestore doc: `settings/homepage`, with
// { mediaUrl, mediaType, storagePath, updatedAt }. Home.jsx reads this
// same doc live and swaps in whatever is uploaded here — or shows a
// waiting placeholder if nothing has been uploaded yet.

import { useEffect, useState } from "react";
import { db, storage } from "../../firebase/firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { doc, setDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { Image as ImageIcon, Upload, Trash2 } from "lucide-react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

const HOMEPAGE_DOC = doc(db, "settings", "homepage");

export default function UploadCertificate() {
  const [current, setCurrent] = useState(null); // { mediaUrl, mediaType, storagePath, updatedAt }
  const [loading, setLoading] = useState(true);

  const [pending, setPending] = useState(null); // { file, url, type }
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      HOMEPAGE_DOC,
      (snap) => {
        setCurrent(snap.exists() ? snap.data() : null);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPending({
      file,
      url: URL.createObjectURL(file),
      type: file.type.startsWith("video") ? "video" : "image",
    });
    e.target.value = "";
  }

  function cancelPending() {
    setPending(null);
  }

  async function handleUpload() {
    if (!pending) {
      alert("Fadlan dooro sawir ama muuqaal.");
      return;
    }

    try {
      setUploading(true);

      const fileRef = ref(storage, `homepage/${Date.now()}_${pending.file.name}`);
      await uploadBytes(fileRef, pending.file);
      const url = await getDownloadURL(fileRef);

      const oldStoragePath = current?.storagePath;

      await setDoc(HOMEPAGE_DOC, {
        mediaUrl: url,
        mediaType: pending.type,
        storagePath: fileRef.fullPath,
        updatedAt: serverTimestamp(),
      });

      if (oldStoragePath) {
        try {
          await deleteObject(ref(storage, oldStoragePath));
        } catch (e) {
          // Old file may already be gone — ignore.
        }
      }

      setPending(null);
      alert("Waa la cusboonaysiiyay!");
    } catch (err) {
      console.error(err);
      alert("Khalad ayaa dhacay: " + err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleRemoveCurrent() {
    try {
      if (current?.storagePath) {
        try {
          await deleteObject(ref(storage, current.storagePath));
        } catch (e) {
          // Already gone — ignore.
        }
      }
      await setDoc(HOMEPAGE_DOC, {
        mediaUrl: "",
        mediaType: "",
        storagePath: "",
        updatedAt: serverTimestamp(),
      });
      setConfirmDelete(false);
    } catch (err) {
      console.error(err);
      alert("Khalad ayaa dhacay markii la tirtirayay: " + err.message);
    }
  }

  const hasCurrent = current?.mediaUrl;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0b0a1c" }}>
      <Sidebar />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: "20px 24px 0" }}>
          <Topbar title="Upload Certificate" />
        </div>

        <div style={{ padding: "26px 30px" }}>
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
              <ImageIcon color="#fff" size={24} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#fff" }}>
                Upload Certificate
              </h1>
              <p style={{ margin: "3px 0 0", color: "#8b87ad", fontSize: 13 }}>
                Soo geli sawirka ama muuqaalka ku muuqda bogga hore (Home) — halkii uu ku sugnaa "Since 2023"
              </p>
            </div>
          </div>

          {/* Current media */}
          {!loading && (
            <div
              style={{
                background: "linear-gradient(160deg,#151233,#181341)",
                borderRadius: 20,
                padding: 26,
                border: "1px solid rgba(139,108,245,0.25)",
                marginBottom: 24,
              }}
            >
              <p style={{ color: "#a9a6c4", fontSize: 12.5, fontWeight: 700, margin: "0 0 14px" }}>
                Hadda bogga hore ku muuqda
              </p>

              {hasCurrent ? (
                <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
                  <div
                    style={{
                      width: 220,
                      aspectRatio: "4/3",
                      borderRadius: 14,
                      overflow: "hidden",
                      background: "#000",
                      flexShrink: 0,
                    }}
                  >
                    {current.mediaType === "video" ? (
                      <video
                        src={current.mediaUrl}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        muted
                        autoPlay
                        loop
                      />
                    ) : (
                      <img
                        src={current.mediaUrl}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    )}
                  </div>

                  <div>
                    {confirmDelete ? (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={handleRemoveCurrent} style={dangerBtnStyle}>
                          Xaqiiji Tirtirka
                        </button>
                        <button onClick={() => setConfirmDelete(false)} style={ghostBtnStyle}>
                          Jooji
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDelete(true)} style={dangerOutlineBtnStyle}>
                        <Trash2 size={14} /> Ka saar bogga hore
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <p style={{ color: "#8b87ad", fontSize: 13, margin: 0 }}>
                  Weli wax lama soo gelin — bogga hore wuxuu muujinayaa meel banaan oo sugaysa.
                </p>
              )}
            </div>
          )}

          {/* Upload new */}
          <div
            style={{
              background: "linear-gradient(160deg,#151233,#181341)",
              borderRadius: 20,
              padding: 26,
              border: "1px solid rgba(139,108,245,0.25)",
              display: "flex",
              gap: 24,
              flexWrap: "wrap",
            }}
          >
            <div style={{ width: 220, minWidth: 220, display: "flex", flexDirection: "column", gap: 10 }}>
              {pending ? (
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    aspectRatio: "4/3",
                    borderRadius: 16,
                    overflow: "hidden",
                    background: "#000",
                  }}
                >
                  {pending.type === "video" ? (
                    <video src={pending.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted autoPlay loop />
                  ) : (
                    <img src={pending.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  )}
                  <button
                    onClick={cancelPending}
                    style={{
                      position: "absolute",
                      top: 6,
                      right: 6,
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      border: "none",
                      background: "rgba(0,0,0,0.7)",
                      color: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <label
                  htmlFor="homepageFile"
                  style={{
                    width: "100%",
                    aspectRatio: "4/3",
                    borderRadius: 16,
                    border: "2px dashed rgba(139,108,245,0.4)",
                    background: "rgba(139,108,245,0.06)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    overflow: "hidden",
                  }}
                >
                  <Upload size={28} color="#8b6cf5" />
                  <span style={{ color: "#8b87ad", fontSize: 12, marginTop: 8, textAlign: "center", padding: "0 10px" }}>
                    Riix si aad u soo dooratid sawir ama muuqaal
                  </span>
                </label>
              )}
              <input
                id="homepageFile"
                type="file"
                accept="image/*,video/*"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
            </div>

            <div style={{ flex: 1, minWidth: 240, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 12 }}>
              <p style={{ color: "#8b87ad", fontSize: 12.5, margin: 0 }}>
                Sawirka/muuqaalka cusub wuxuu si toos ah ku beddeli doonaa kan hadda bogga hore ku jira, marka aad riixdo "Upload".
              </p>
              <button
                onClick={handleUpload}
                disabled={uploading || !pending}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  justifyContent: "center",
                  background: "linear-gradient(90deg,#6d5df0,#8b6cf5)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 12,
                  padding: "13px 24px",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: uploading || !pending ? "not-allowed" : "pointer",
                  opacity: uploading || !pending ? 0.6 : 1,
                  alignSelf: "flex-start",
                }}
              >
                <Upload size={16} />
                {uploading ? "Soo dhigaya..." : "Upload"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const dangerOutlineBtnStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  border: "1px solid rgba(239,68,68,0.35)",
  background: "rgba(239,68,68,0.12)",
  color: "#f87171",
  fontWeight: 700,
  fontSize: 12.5,
  padding: "10px 16px",
  borderRadius: 10,
  cursor: "pointer",
};

const dangerBtnStyle = {
  border: "none",
  background: "#ef4444",
  color: "#fff",
  fontWeight: 700,
  fontSize: 12.5,
  padding: "10px 16px",
  borderRadius: 10,
  cursor: "pointer",
};

const ghostBtnStyle = {
  border: "1px solid rgba(255,255,255,0.15)",
  background: "transparent",
  color: "#a9a6c4",
  fontWeight: 700,
  fontSize: 12.5,
  padding: "10px 16px",
  borderRadius: 10,
  cursor: "pointer",
};