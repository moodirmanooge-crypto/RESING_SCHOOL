// src/admin/pages/GalleryManager.jsx
//
// Admin page for posting photos/videos with a caption to the public
// Gallery page, and for editing or deleting posts already made. Uploads
// the file to Firebase Storage (`gallery/`) and writes a doc to
// Firestore `gallery` collection with the media URL, type, caption,
// likeCount, likedBy[], and comments[] — the same shape the public
// Gallery.jsx reads and lets visitors like/comment/share.

import { useEffect, useState } from "react";
import { db, storage } from "../../firebase/firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { Image as ImageIcon, Upload, Trash2, Heart, MessageCircle, Pencil, X, Save } from "lucide-react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

function formatDate(ts) {
  if (!ts?.seconds) return "—";
  return new Date(ts.seconds * 1000).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function GalleryManager() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mediaType, setMediaType] = useState("image");
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // ---- Edit modal state ----
  const [editTarget, setEditTarget] = useState(null); // the gallery item being edited
  const [editCaption, setEditCaption] = useState("");
  const [editFile, setEditFile] = useState(null); // new media file, if replaced
  const [editPreview, setEditPreview] = useState(null);
  const [editMediaType, setEditMediaType] = useState("image");
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "gallery"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setMediaType(f.type.startsWith("video") ? "video" : "image");
    setPreview(URL.createObjectURL(f));
  };

  const handleUpload = async () => {
    if (!file) {
      alert("Fadlan dooro sawir ama muuqaal.");
      return;
    }

    try {
      setUploading(true);

      const fileRef = ref(storage, `gallery/${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      const mediaUrl = await getDownloadURL(fileRef);

      const docId = `${Date.now()}`;
      await setDoc(doc(db, "gallery", docId), {
        mediaUrl,
        mediaType,
        caption: caption.trim(),
        storagePath: fileRef.fullPath,
        likeCount: 0,
        likedBy: [],
        comments: [],
        createdAt: serverTimestamp(),
      });

      setFile(null);
      setPreview(null);
      setCaption("");
      setMediaType("image");
      alert("Waa la daabacay!");
    } catch (err) {
      console.error(err);
      alert("Khalad ayaa dhacay: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (item) => {
    try {
      if (item.storagePath) {
        try {
          await deleteObject(ref(storage, item.storagePath));
        } catch (e) {
          // File may already be gone from storage — continue removing the doc.
        }
      }
      await deleteDoc(doc(db, "gallery", item.id));
      setConfirmDelete(null);
    } catch (err) {
      console.error(err);
      alert("Khalad ayaa dhacay marka la tirtirayay: " + err.message);
    }
  };

  // ---- Fur modal-ka wax-ka-bedelka post-ga ----
  function openEdit(item) {
    setEditTarget(item);
    setEditCaption(item.caption || "");
    setEditFile(null);
    setEditPreview(item.mediaUrl || null);
    setEditMediaType(item.mediaType || "image");
  }

  function closeEdit() {
    setEditTarget(null);
    setEditCaption("");
    setEditFile(null);
    setEditPreview(null);
    setEditMediaType("image");
  }

  function handleEditFileChange(e) {
    const f = e.target.files[0];
    if (!f) return;
    setEditFile(f);
    setEditMediaType(f.type.startsWith("video") ? "video" : "image");
    setEditPreview(URL.createObjectURL(f));
  }

  // ---- Kaydi wax-ka-bedelka post-ga: qoraalka marwalba, sawirka/muuqaalka
  // kaliya haddii mid cusub la doortay. Haddii sawir cusub la doortay,
  // kii hore Storage-ka waa laga tirtiraa si aan looga tagin file aan
  // la isticmaalin. ----
  async function saveEdit() {
    if (!editTarget) return;

    try {
      setSavingEdit(true);

      const updatedFields = {
        caption: editCaption.trim(),
      };

      if (editFile) {
        const newFileRef = ref(storage, `gallery/${Date.now()}_${editFile.name}`);
        await uploadBytes(newFileRef, editFile);
        const newMediaUrl = await getDownloadURL(newFileRef);

        updatedFields.mediaUrl = newMediaUrl;
        updatedFields.mediaType = editMediaType;
        updatedFields.storagePath = newFileRef.fullPath;

        if (editTarget.storagePath) {
          try {
            await deleteObject(ref(storage, editTarget.storagePath));
          } catch (e) {
            // Old file may already be gone — ignore.
          }
        }
      }

      await updateDoc(doc(db, "gallery", editTarget.id), updatedFields);

      setItems((prev) =>
        prev.map((it) => (it.id === editTarget.id ? { ...it, ...updatedFields } : it))
      );

      alert("Post-ka waa la cusboonaysiiyay.");
      closeEdit();
    } catch (err) {
      console.error(err);
      alert("Khalad ayaa dhacay markii la kaydinayay: " + err.message);
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0b0a1c" }}>
      <Sidebar />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: "20px 24px 0" }}>
          <Topbar title="Gallery" />
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
                Gallery Manager
              </h1>
              <p style={{ margin: "3px 0 0", color: "#8b87ad", fontSize: 13 }}>
                Soo dhig sawiro iyo muuqaallo — waxay isla markiiba ka muuqan doonaan bogga Gallery-ga
              </p>
            </div>
          </div>

          {/* Upload card */}
          <div
            style={{
              background: "linear-gradient(160deg,#151233,#181341)",
              borderRadius: 20,
              padding: 26,
              border: "1px solid rgba(139,108,245,0.25)",
              marginBottom: 30,
              display: "flex",
              gap: 24,
              flexWrap: "wrap",
            }}
          >
            <label
              htmlFor="galleryFile"
              style={{
                width: 220,
                minWidth: 220,
                aspectRatio: "4/3",
                borderRadius: 16,
                border: "2px dashed rgba(139,108,245,0.4)",
                background: preview
                  ? mediaType === "video"
                    ? "#000"
                    : `url(${preview}) center/cover`
                  : "rgba(139,108,245,0.06)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                overflow: "hidden",
                position: "relative",
              }}
            >
              {!preview && (
                <>
                  <Upload size={28} color="#8b6cf5" />
                  <span style={{ color: "#8b87ad", fontSize: 12, marginTop: 8 }}>
                    Riix si aad u soo dooratid
                  </span>
                </>
              )}
              {preview && mediaType === "video" && (
                <video src={preview} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
              )}
            </label>
            <input
              id="galleryFile"
              type="file"
              accept="image/*,video/*"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />

            <div style={{ flex: 1, minWidth: 240, display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ color: "#a9a6c4", fontSize: 12.5, fontWeight: 700, display: "block", marginBottom: 6 }}>
                  Faallo (Caption)
                </label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={4}
                  placeholder="Qor faallo ku saabsan sawirka ama muuqaalka..."
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1.5px solid rgba(139,108,245,0.3)",
                    background: "rgba(255,255,255,0.02)",
                    color: "#e5e3f7",
                    fontSize: 13.5,
                    resize: "vertical",
                    outline: "none",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              <button
                onClick={handleUpload}
                disabled={uploading}
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
                  cursor: uploading ? "not-allowed" : "pointer",
                  opacity: uploading ? 0.7 : 1,
                  alignSelf: "flex-start",
                }}
              >
                <Upload size={16} />
                {uploading ? "Soo dhigaya..." : "Post to Gallery"}
              </button>
            </div>
          </div>

          {/* Posted items grid */}
          {loading ? (
            <p style={{ color: "#8b87ad" }}>Loading...</p>
          ) : items.length === 0 ? (
            <p style={{ color: "#8b87ad" }}>Weli wax lama soo dhigin.</p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 18,
              }}
            >
              {items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    background: "linear-gradient(160deg,#1c1840,#211c48)",
                    borderRadius: 16,
                    overflow: "hidden",
                    border: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <div style={{ width: "100%", aspectRatio: "4/3", background: "#000" }}>
                    {item.mediaType === "video" ? (
                      <video src={item.mediaUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
                    ) : (
                      <img src={item.mediaUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    )}
                  </div>

                  <div style={{ padding: 14 }}>
                    <p
                      style={{
                        color: "#e5e3f7",
                        fontSize: 12.5,
                        margin: "0 0 10px",
                        minHeight: 18,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {item.caption || "—"}
                    </p>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: 11.5,
                        color: "#8b87ad",
                        marginBottom: 10,
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Heart size={12} /> {item.likeCount || 0}
                      </span>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <MessageCircle size={12} /> {(item.comments || []).length}
                      </span>
                      <span>{formatDate(item.createdAt)}</span>
                    </div>

                    <div style={{ display: "flex", gap: 6, marginBottom: confirmDelete === item.id ? 6 : 0 }}>
                      <button
                        onClick={() => openEdit(item)}
                        style={{
                          flex: 1,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          border: "1px solid rgba(139,108,245,0.35)",
                          background: "rgba(139,108,245,0.12)",
                          color: "#c4b5fd",
                          fontWeight: 700,
                          fontSize: 11.5,
                          padding: "7px 0",
                          borderRadius: 8,
                          cursor: "pointer",
                        }}
                      >
                        <Pencil size={12} />
                        Edit
                      </button>

                      {confirmDelete === item.id ? (
                        <div style={{ display: "flex", gap: 6, flex: 1 }}>
                          <button
                            onClick={() => handleDelete(item)}
                            style={{
                              flex: 1,
                              border: "none",
                              background: "#ef4444",
                              color: "#fff",
                              fontWeight: 700,
                              fontSize: 11.5,
                              padding: "7px 0",
                              borderRadius: 8,
                              cursor: "pointer",
                            }}
                          >
                            Xaqiiji
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            style={{
                              flex: 1,
                              border: "1px solid rgba(255,255,255,0.15)",
                              background: "transparent",
                              color: "#a9a6c4",
                              fontWeight: 700,
                              fontSize: 11.5,
                              padding: "7px 0",
                              borderRadius: 8,
                              cursor: "pointer",
                            }}
                          >
                            Jooji
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(item.id)}
                          style={{
                            flex: 1,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            border: "1px solid rgba(239,68,68,0.3)",
                            background: "rgba(239,68,68,0.12)",
                            color: "#f87171",
                            fontWeight: 700,
                            fontSize: 11.5,
                            padding: "7px 0",
                            borderRadius: 8,
                            cursor: "pointer",
                          }}
                        >
                          <Trash2 size={12} />
                          Tirtir
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ---- Edit modal ---- */}
      {editTarget && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            style={{
              background: "linear-gradient(160deg,#151233,#181341)",
              border: "1px solid rgba(139,108,245,0.3)",
              borderRadius: 20,
              width: "100%",
              maxWidth: 560,
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "20px 24px",
                borderBottom: "1px solid rgba(139,108,245,0.2)",
              }}
            >
              <h2 style={{ color: "#fff", margin: 0, fontSize: 18 }}>Wax ka bedel Post-ka</h2>
              <button
                onClick={closeEdit}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "none",
                  color: "#fff",
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "22px 24px" }}>
              <label
                htmlFor="editGalleryFile"
                style={{
                  display: "block",
                  width: "100%",
                  aspectRatio: "4/3",
                  borderRadius: 14,
                  border: "2px dashed rgba(139,108,245,0.4)",
                  background: editPreview
                    ? editMediaType === "video"
                      ? "#000"
                      : `url(${editPreview}) center/cover`
                    : "rgba(139,108,245,0.06)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  overflow: "hidden",
                  marginBottom: 18,
                }}
              >
                {!editPreview && (
                  <>
                    <Upload size={26} color="#8b6cf5" />
                    <span style={{ color: "#8b87ad", fontSize: 12, marginTop: 8 }}>
                      Riix si aad sawir/muuqaal cusub uga soo dooratid
                    </span>
                  </>
                )}
                {editPreview && editMediaType === "video" && (
                  <video src={editPreview} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
                )}
              </label>
              <input
                id="editGalleryFile"
                type="file"
                accept="image/*,video/*"
                onChange={handleEditFileChange}
                style={{ display: "none" }}
              />
              <p style={{ color: "#6b6890", fontSize: 11.5, margin: "-10px 0 18px" }}>
                Haddii aadan sawir/muuqaal cusub dooran, kii hore ayaa sii jiri doona.
              </p>

              <label
                style={{
                  color: "#a9a6c4",
                  fontSize: 12.5,
                  fontWeight: 700,
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Faallo (Caption)
              </label>
              <textarea
                value={editCaption}
                onChange={(e) => setEditCaption(e.target.value)}
                rows={4}
                placeholder="Qor faallo ku saabsan sawirka ama muuqaalka..."
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1.5px solid rgba(139,108,245,0.3)",
                  background: "rgba(255,255,255,0.02)",
                  color: "#e5e3f7",
                  fontSize: 13.5,
                  resize: "vertical",
                  outline: "none",
                  fontFamily: "inherit",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 12,
                padding: "16px 24px",
                borderTop: "1px solid rgba(139,108,245,0.2)",
              }}
            >
              <button
                onClick={closeEdit}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1.5px solid rgba(139,108,245,0.3)",
                  color: "#fff",
                  padding: "11px 20px",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 13.5,
                }}
              >
                Iska daa
              </button>
              <button
                onClick={saveEdit}
                disabled={savingEdit}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: "linear-gradient(90deg,#6d5df0,#8b6cf5)",
                  color: "#fff",
                  border: "none",
                  padding: "11px 20px",
                  borderRadius: 10,
                  cursor: savingEdit ? "not-allowed" : "pointer",
                  opacity: savingEdit ? 0.7 : 1,
                  fontWeight: 700,
                  fontSize: 13.5,
                }}
              >
                <Save size={15} />
                {savingEdit ? "Kaydinaya..." : "Kaydi Isbedelka"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}