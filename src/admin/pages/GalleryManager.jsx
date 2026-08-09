// src/admin/pages/GalleryManager.jsx
//
// Admin page for posting photos/videos with a caption to the public
// Gallery page, and for editing or deleting posts already made. Uploads
// the file(s) to Firebase Storage (`gallery/`) and writes a doc to
// Firestore `gallery` collection with a `mediaItems` array (one post can
// hold multiple photos/videos, shown one-at-a-time carousel-style on the
// public page, like Facebook). For backward compatibility with posts
// created before multi-media support, the doc's top-level `mediaUrl` /
// `mediaType` / `storagePath` are always kept equal to the FIRST item in
// `mediaItems`, and any post that never had `mediaItems` still renders
// fine everywhere via a fallback that wraps the single mediaUrl/mediaType
// into a one-item list.

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
import { Image as ImageIcon, Upload, Trash2, Heart, MessageCircle, Pencil, X, Save, ChevronLeft, ChevronRight } from "lucide-react";
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

// Returns the list of {url, type, storagePath} media for a gallery doc,
// whether it was created with the new multi-media `mediaItems` array or
// the old single `mediaUrl`/`mediaType`/`storagePath` fields.
function getMediaList(item) {
  if (Array.isArray(item?.mediaItems) && item.mediaItems.length > 0) {
    return item.mediaItems;
  }
  if (item?.mediaUrl) {
    return [{ url: item.mediaUrl, type: item.mediaType || "image", storagePath: item.storagePath || "" }];
  }
  return [];
}

export default function GalleryManager() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // ---- New post: multi-file selection ----
  // Each entry: { file, url (local object URL preview), type }
  const [pendingFiles, setPendingFiles] = useState([]);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Which slide (0-indexed) each grid card is currently showing.
  const [gridSlide, setGridSlide] = useState({});

  // ---- Edit modal state ----
  const [editTarget, setEditTarget] = useState(null); // the gallery item being edited
  const [editCaption, setEditCaption] = useState("");
  // Existing kept items: { url, type, storagePath, isNew:false }
  // Newly added items:   { file, url (local preview), type, isNew:true }
  const [editItems, setEditItems] = useState([]);
  const [removedOriginalPaths, setRemovedOriginalPaths] = useState([]);
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

  // ---- New post: file selection (multiple) ----
  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;
    const mapped = selected.map((f) => ({
      file: f,
      url: URL.createObjectURL(f),
      type: f.type.startsWith("video") ? "video" : "image",
    }));
    setPendingFiles((prev) => [...prev, ...mapped]);
    e.target.value = ""; // allow re-selecting the same file again later
  };

  function removePendingFile(index) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }

  const handleUpload = async () => {
    if (pendingFiles.length === 0) {
      alert("Fadlan dooro ugu yaraan hal sawir ama muuqaal.");
      return;
    }

    try {
      setUploading(true);

      const uploadedItems = [];
      for (const pf of pendingFiles) {
        const fileRef = ref(storage, `gallery/${Date.now()}_${pf.file.name}`);
        await uploadBytes(fileRef, pf.file);
        const url = await getDownloadURL(fileRef);
        uploadedItems.push({ url, type: pf.type, storagePath: fileRef.fullPath });
      }

      const docId = `${Date.now()}`;
      await setDoc(doc(db, "gallery", docId), {
        mediaItems: uploadedItems,
        // Kept for backward compatibility with any code/readers still
        // expecting a single mediaUrl/mediaType/storagePath.
        mediaUrl: uploadedItems[0].url,
        mediaType: uploadedItems[0].type,
        storagePath: uploadedItems[0].storagePath,
        caption: caption.trim(),
        likeCount: 0,
        likedBy: [],
        comments: [],
        createdAt: serverTimestamp(),
      });

      setPendingFiles([]);
      setCaption("");
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
      const media = getMediaList(item);
      for (const m of media) {
        if (m.storagePath) {
          try {
            await deleteObject(ref(storage, m.storagePath));
          } catch (e) {
            // File may already be gone from storage — continue removing the doc.
          }
        }
      }
      await deleteDoc(doc(db, "gallery", item.id));
      setConfirmDelete(null);
    } catch (err) {
      console.error(err);
      alert("Khalad ayaa dhacay marka la tirtirayay: " + err.message);
    }
  };

  function gridPrev(itemId, count) {
    setGridSlide((prev) => {
      const cur = prev[itemId] || 0;
      return { ...prev, [itemId]: cur > 0 ? cur - 1 : count - 1 };
    });
  }
  function gridNext(itemId, count) {
    setGridSlide((prev) => {
      const cur = prev[itemId] || 0;
      return { ...prev, [itemId]: cur < count - 1 ? cur + 1 : 0 };
    });
  }

  // ---- Fur modal-ka wax-ka-bedelka post-ga ----
  function openEdit(item) {
    setEditTarget(item);
    setEditCaption(item.caption || "");
    const media = getMediaList(item);
    setEditItems(media.map((m) => ({ url: m.url, type: m.type, storagePath: m.storagePath || "", isNew: false })));
    setRemovedOriginalPaths([]);
  }

  function closeEdit() {
    setEditTarget(null);
    setEditCaption("");
    setEditItems([]);
    setRemovedOriginalPaths([]);
  }

  function handleEditFileChange(e) {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;
    const mapped = selected.map((f) => ({
      file: f,
      url: URL.createObjectURL(f),
      type: f.type.startsWith("video") ? "video" : "image",
      isNew: true,
    }));
    setEditItems((prev) => [...prev, ...mapped]);
    e.target.value = "";
  }

  function removeEditItem(index) {
    setEditItems((prev) => {
      const target = prev[index];
      if (target && !target.isNew && target.storagePath) {
        setRemovedOriginalPaths((paths) => [...paths, target.storagePath]);
      }
      return prev.filter((_, i) => i !== index);
    });
  }

  // ---- Kaydi wax-ka-bedelka post-ga: qoraalka marwalba, iyo liiska
  // sawirrada/muuqaallada — kuwa cusub waa la soo shubaa (upload), kuwa
  // la tuuray Storage-ka waa laga tirtiraa, kuwa la haystay ayaa sii
  // ahaanaya sidoodii. ----
  async function saveEdit() {
    if (!editTarget) return;
    if (editItems.length === 0) {
      alert("Post-ku waa in uu leeyahay ugu yaraan hal sawir ama muuqaal.");
      return;
    }

    try {
      setSavingEdit(true);

      const finalItems = [];
      for (const it of editItems) {
        if (it.isNew) {
          const newFileRef = ref(storage, `gallery/${Date.now()}_${it.file.name}`);
          await uploadBytes(newFileRef, it.file);
          const url = await getDownloadURL(newFileRef);
          finalItems.push({ url, type: it.type, storagePath: newFileRef.fullPath });
        } else {
          finalItems.push({ url: it.url, type: it.type, storagePath: it.storagePath });
        }
      }

      for (const path of removedOriginalPaths) {
        try {
          await deleteObject(ref(storage, path));
        } catch (e) {
          // Already gone — ignore.
        }
      }

      const updatedFields = {
        caption: editCaption.trim(),
        mediaItems: finalItems,
        mediaUrl: finalItems[0].url,
        mediaType: finalItems[0].type,
        storagePath: finalItems[0].storagePath,
      };

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
                Soo dhig sawiro/muuqaallo (hal ama dhowr sawir hal post) — waxay isla markiiba ka muuqan doonaan bogga Gallery-ga
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
            <div style={{ width: 220, minWidth: 220, display: "flex", flexDirection: "column", gap: 10 }}>
              <label
                htmlFor="galleryFile"
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
                  Riix si aad u soo dooratid (dhowr sawir/muuqaal ayaad dooran kartaa)
                </span>
              </label>
              <input
                id="galleryFile"
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleFileChange}
                style={{ display: "none" }}
              />

              {pendingFiles.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {pendingFiles.map((pf, i) => (
                    <div
                      key={i}
                      style={{
                        position: "relative",
                        width: 56,
                        height: 56,
                        borderRadius: 8,
                        overflow: "hidden",
                        background: "#000",
                        border: "1px solid rgba(139,108,245,0.3)",
                      }}
                    >
                      {pf.type === "video" ? (
                        <video src={pf.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
                      ) : (
                        <img src={pf.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      )}
                      <button
                        onClick={() => removePendingFile(i)}
                        style={{
                          position: "absolute",
                          top: 2,
                          right: 2,
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          border: "none",
                          background: "rgba(0,0,0,0.7)",
                          color: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

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
                {uploading
                  ? "Soo dhigaya..."
                  : `Post to Gallery${pendingFiles.length > 1 ? ` (${pendingFiles.length})` : ""}`}
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
              {items.map((item) => {
                const media = getMediaList(item);
                const slide = Math.min(gridSlide[item.id] || 0, media.length - 1);
                const current = media[slide];

                return (
                  <div
                    key={item.id}
                    style={{
                      background: "linear-gradient(160deg,#1c1840,#211c48)",
                      borderRadius: 16,
                      overflow: "hidden",
                      border: "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <div style={{ width: "100%", aspectRatio: "4/3", background: "#000", position: "relative" }}>
                      {current?.type === "video" ? (
                        <video src={current.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
                      ) : (
                        <img src={current?.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      )}

                      {media.length > 1 && (
                        <>
                          <button
                            onClick={() => gridPrev(item.id, media.length)}
                            style={carouselArrowStyle("left")}
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <button
                            onClick={() => gridNext(item.id, media.length)}
                            style={carouselArrowStyle("right")}
                          >
                            <ChevronRight size={16} />
                          </button>
                          <div
                            style={{
                              position: "absolute",
                              top: 8,
                              right: 8,
                              background: "rgba(0,0,0,0.6)",
                              color: "#fff",
                              fontSize: 11,
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: 10,
                            }}
                          >
                            {slide + 1}/{media.length}
                          </div>
                        </>
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
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <Heart size={12} /> {item.likeCount || 0}
                        </span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
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
                );
              })}
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
              <label style={{ color: "#a9a6c4", fontSize: 12.5, fontWeight: 700, display: "block", marginBottom: 8 }}>
                Sawiro/Muuqaallo ({editItems.length})
              </label>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
                {editItems.map((it, i) => (
                  <div
                    key={i}
                    style={{
                      position: "relative",
                      width: 84,
                      height: 84,
                      borderRadius: 12,
                      overflow: "hidden",
                      background: "#000",
                      border: "1px solid rgba(139,108,245,0.3)",
                    }}
                  >
                    {it.type === "video" ? (
                      <video src={it.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
                    ) : (
                      <img src={it.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    )}
                    <button
                      onClick={() => removeEditItem(i)}
                      style={{
                        position: "absolute",
                        top: 3,
                        right: 3,
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        border: "none",
                        background: "rgba(0,0,0,0.75)",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}

                <label
                  htmlFor="editGalleryFile"
                  style={{
                    width: 84,
                    height: 84,
                    borderRadius: 12,
                    border: "2px dashed rgba(139,108,245,0.4)",
                    background: "rgba(139,108,245,0.06)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  <Upload size={18} color="#8b6cf5" />
                  <span style={{ color: "#8b87ad", fontSize: 9.5, marginTop: 4 }}>Kudar</span>
                </label>
                <input
                  id="editGalleryFile"
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={handleEditFileChange}
                  style={{ display: "none" }}
                />
              </div>

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

function carouselArrowStyle(side) {
  return {
    position: "absolute",
    top: "50%",
    [side]: 6,
    transform: "translateY(-50%)",
    width: 26,
    height: 26,
    borderRadius: "50%",
    border: "none",
    background: "rgba(0,0,0,0.55)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    padding: 0,
  };
}