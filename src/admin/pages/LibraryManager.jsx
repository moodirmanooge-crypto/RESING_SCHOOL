// src/admin/pages/LibraryManager.jsx
//
// Admin page for publishing paid PDF books to the public Library page.
// Uploads a cover image and the PDF file to Firebase Storage
// (`library/`), writes a doc to Firestore `library` collection with
// title/author/category/price/description/coverUrl/pdfUrl, plus
// viewCount and requestCount (incremented by the public page). Also
// shows every purchase request submitted from the public Library page
// (Firestore `libraryRequests`), so the admin can follow up once
// payment is confirmed.

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
import {
  BookOpen,
  Upload,
  Trash2,
  Eye,
  ShoppingCart,
  Pencil,
  X,
  Save,
  FileText,
  Phone,
  User,
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

const CATEGORIES = ["🟢 Primary School", "🟡 Middle School", "🔵 Secondary School", "Other"];

function formatDate(ts) {
  if (!ts?.seconds) return "—";
  return new Date(ts.seconds * 1000).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function LibraryManager() {
  const [tab, setTab] = useState("books"); // books | requests

  const [books, setBooks] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Upload form
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);

  // Edit modal
  const [editTarget, setEditTarget] = useState(null);
  const [editData, setEditData] = useState(null);
  const [editCoverFile, setEditCoverFile] = useState(null);
  const [editCoverPreview, setEditCoverPreview] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [confirmDeleteBook, setConfirmDeleteBook] = useState(null);
  const [confirmDeleteReq, setConfirmDeleteReq] = useState(null);

  useEffect(() => {
    const qBooks = query(collection(db, "library"), orderBy("createdAt", "desc"));
    const unsubBooks = onSnapshot(
      qBooks,
      (snap) => {
        setBooks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setLoading(false);
      }
    );

    const qReq = query(collection(db, "libraryRequests"), orderBy("createdAt", "desc"));
    const unsubReq = onSnapshot(qReq, (snap) => {
      setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubBooks();
      unsubReq();
    };
  }, []);

  function resetForm() {
    setCoverFile(null);
    setCoverPreview(null);
    setPdfFile(null);
    setTitle("");
    setAuthor("");
    setCategory(CATEGORIES[0]);
    setPrice("");
    setDescription("");
  }

  function handleCoverChange(e) {
    const f = e.target.files[0];
    if (!f) return;
    setCoverFile(f);
    setCoverPreview(URL.createObjectURL(f));
  }

  function handlePdfChange(e) {
    const f = e.target.files[0];
    if (!f) return;
    setPdfFile(f);
  }

  async function handlePublish() {
    if (!title.trim()) {
      alert("Fadlan geli cinwaanka buugga.");
      return;
    }
    if (!price || Number(price) <= 0) {
      alert("Fadlan geli qiimo sax ah.");
      return;
    }
    if (!pdfFile) {
      alert("Fadlan soo geli file-ka PDF-ka.");
      return;
    }

    try {
      setUploading(true);

      let coverUrl = "";
      if (coverFile) {
        const coverRef = ref(storage, `library/covers/${Date.now()}_${coverFile.name}`);
        await uploadBytes(coverRef, coverFile);
        coverUrl = await getDownloadURL(coverRef);
      }

      const pdfRef = ref(storage, `library/pdfs/${Date.now()}_${pdfFile.name}`);
      await uploadBytes(pdfRef, pdfFile);
      const pdfUrl = await getDownloadURL(pdfRef);

      const docId = `${Date.now()}`;
      await setDoc(doc(db, "library", docId), {
        title: title.trim(),
        author: author.trim(),
        category,
        price: Number(price),
        description: description.trim(),
        coverUrl,
        pdfUrl,
        pdfStoragePath: pdfRef.fullPath,
        coverStoragePath: coverFile ? `library/covers/${Date.now()}_${coverFile.name}` : "",
        viewCount: 0,
        requestCount: 0,
        createdAt: serverTimestamp(),
      });

      resetForm();
      alert("Buugga waa la daabacay!");
    } catch (err) {
      console.error(err);
      alert("Khalad ayaa dhacay: " + err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteBook(book) {
    try {
      if (book.coverStoragePath) {
        try {
          await deleteObject(ref(storage, book.coverStoragePath));
        } catch (e) {
          // ignore
        }
      }
      if (book.pdfStoragePath) {
        try {
          await deleteObject(ref(storage, book.pdfStoragePath));
        } catch (e) {
          // ignore
        }
      }
      await deleteDoc(doc(db, "library", book.id));
      setConfirmDeleteBook(null);
    } catch (err) {
      console.error(err);
      alert("Khalad ayaa dhacay marka la tirtirayay: " + err.message);
    }
  }

  function openEdit(book) {
    setEditTarget(book);
    setEditData({
      title: book.title || "",
      author: book.author || "",
      category: book.category || CATEGORIES[0],
      price: book.price || "",
      description: book.description || "",
    });
    setEditCoverFile(null);
    setEditCoverPreview(book.coverUrl || null);
  }

  function closeEdit() {
    setEditTarget(null);
    setEditData(null);
    setEditCoverFile(null);
    setEditCoverPreview(null);
  }

  function handleEditCoverChange(e) {
    const f = e.target.files[0];
    if (!f) return;
    setEditCoverFile(f);
    setEditCoverPreview(URL.createObjectURL(f));
  }

  async function saveEdit() {
    if (!editTarget) return;
    if (!editData.title.trim()) {
      alert("Fadlan geli cinwaanka buugga.");
      return;
    }
    if (!editData.price || Number(editData.price) <= 0) {
      alert("Fadlan geli qiimo sax ah.");
      return;
    }

    try {
      setSavingEdit(true);

      const updatedFields = {
        title: editData.title.trim(),
        author: editData.author.trim(),
        category: editData.category,
        price: Number(editData.price),
        description: editData.description.trim(),
      };

      if (editCoverFile) {
        const newCoverRef = ref(
          storage,
          `library/covers/${Date.now()}_${editCoverFile.name}`
        );
        await uploadBytes(newCoverRef, editCoverFile);
        updatedFields.coverUrl = await getDownloadURL(newCoverRef);
        updatedFields.coverStoragePath = newCoverRef.fullPath;

        if (editTarget.coverStoragePath) {
          try {
            await deleteObject(ref(storage, editTarget.coverStoragePath));
          } catch (e) {
            // ignore
          }
        }
      }

      await updateDoc(doc(db, "library", editTarget.id), updatedFields);
      alert("Buugga waa la cusboonaysiiyay.");
      closeEdit();
    } catch (err) {
      console.error(err);
      alert("Khalad ayaa dhacay: " + err.message);
    } finally {
      setSavingEdit(false);
    }
  }

  async function markRequestFulfilled(reqItem) {
    try {
      await updateDoc(doc(db, "libraryRequests", reqItem.id), {
        status: reqItem.status === "Fulfilled" ? "Pending" : "Fulfilled",
      });
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDeleteRequest(reqItem) {
    try {
      await deleteDoc(doc(db, "libraryRequests", reqItem.id));
      setConfirmDeleteReq(null);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0b0a1c" }}>
      <Sidebar />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: "20px 24px 0" }}>
          <Topbar title="Library" />
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
              <BookOpen color="#fff" size={24} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#fff" }}>
                Library Manager
              </h1>
              <p style={{ margin: "3px 0 0", color: "#8b87ad", fontSize: 13 }}>
                Daabac buugag PDF ah, sii wad codsiyada iibinta
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
            <button
              onClick={() => setTab("books")}
              style={{
                padding: "10px 20px",
                borderRadius: 10,
                border: tab === "books" ? "none" : "1px solid rgba(139,108,245,0.3)",
                background: tab === "books" ? "linear-gradient(90deg,#6d5df0,#8b6cf5)" : "transparent",
                color: "#fff",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              <BookOpen size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
              Books ({books.length})
            </button>
            <button
              onClick={() => setTab("requests")}
              style={{
                padding: "10px 20px",
                borderRadius: 10,
                border: tab === "requests" ? "none" : "1px solid rgba(139,108,245,0.3)",
                background: tab === "requests" ? "linear-gradient(90deg,#6d5df0,#8b6cf5)" : "transparent",
                color: "#fff",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                position: "relative",
              }}
            >
              <ShoppingCart size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
              Purchase Requests ({requests.length})
            </button>
          </div>

          {tab === "books" && (
            <>
              {/* Upload card */}
              <div
                style={{
                  background: "linear-gradient(160deg,#151233,#181341)",
                  borderRadius: 20,
                  padding: 26,
                  border: "1px solid rgba(139,108,245,0.25)",
                  marginBottom: 30,
                }}
              >
                <h3 style={{ margin: "0 0 18px", color: "#fff", fontSize: 15.5 }}>
                  Publish a New Book
                </h3>

                <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
                  <label
                    htmlFor="coverFile"
                    style={{
                      width: 150,
                      minWidth: 150,
                      aspectRatio: "3/4",
                      borderRadius: 12,
                      border: "2px dashed rgba(139,108,245,0.4)",
                      background: coverPreview
                        ? `url(${coverPreview}) center/cover`
                        : "rgba(139,108,245,0.06)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      overflow: "hidden",
                    }}
                  >
                    {!coverPreview && (
                      <>
                        <Upload size={22} color="#8b6cf5" />
                        <span style={{ color: "#8b87ad", fontSize: 11, marginTop: 6, textAlign: "center" }}>
                          Cover Image
                        </span>
                      </>
                    )}
                  </label>
                  <input
                    id="coverFile"
                    type="file"
                    accept="image/*"
                    onChange={handleCoverChange}
                    style={{ display: "none" }}
                  />

                  <div style={{ flex: 1, minWidth: 260, display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label style={fieldLabel}>Title</label>
                        <input
                          style={input}
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="e.g. Advanced Mathematics"
                        />
                      </div>
                      <div>
                        <label style={fieldLabel}>Author</label>
                        <input
                          style={input}
                          value={author}
                          onChange={(e) => setAuthor(e.target.value)}
                          placeholder="e.g. Ahmed Hassan"
                        />
                      </div>
                      <div>
                        <label style={fieldLabel}>Category</label>
                        <select
                          style={input}
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={fieldLabel}>Price ($)</label>
                        <input
                          style={input}
                          type="number"
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                          placeholder="e.g. 10"
                        />
                      </div>
                    </div>

                    <div>
                      <label style={fieldLabel}>Description</label>
                      <textarea
                        style={{ ...input, resize: "vertical", fontFamily: "inherit" }}
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Short description of the book..."
                      />
                    </div>

                    <div>
                      <label style={fieldLabel}>PDF File</label>
                      <label
                        htmlFor="pdfFile"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          border: "1.5px dashed rgba(139,108,245,0.4)",
                          borderRadius: 10,
                          padding: "10px 14px",
                          color: pdfFile ? "#c4b5fd" : "#8b87ad",
                          fontSize: 12.5,
                          cursor: "pointer",
                        }}
                      >
                        <FileText size={15} />
                        {pdfFile ? pdfFile.name : "Riix si aad PDF uga soo dooratid"}
                      </label>
                      <input
                        id="pdfFile"
                        type="file"
                        accept="application/pdf"
                        onChange={handlePdfChange}
                        style={{ display: "none" }}
                      />
                    </div>

                    <button
                      onClick={handlePublish}
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
                      {uploading ? "Soo dhigaya..." : "Publish Book"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Books grid */}
              {loading ? (
                <p style={{ color: "#8b87ad" }}>Loading...</p>
              ) : books.length === 0 ? (
                <p style={{ color: "#8b87ad" }}>Weli buug lama daabicin.</p>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                    gap: 18,
                  }}
                >
                  {books.map((book) => (
                    <div
                      key={book.id}
                      style={{
                        background: "linear-gradient(160deg,#1c1840,#211c48)",
                        borderRadius: 16,
                        overflow: "hidden",
                        border: "1px solid rgba(255,255,255,0.05)",
                      }}
                    >
                      <div style={{ width: "100%", aspectRatio: "3/4", background: "#000" }}>
                        {book.coverUrl ? (
                          <img
                            src={book.coverUrl}
                            alt=""
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : (
                          <div
                            style={{
                              width: "100%",
                              height: "100%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#6b6890",
                            }}
                          >
                            <BookOpen size={30} />
                          </div>
                        )}
                      </div>

                      <div style={{ padding: 14 }}>
                        <p
                          style={{
                            color: "#e5e3f7",
                            fontSize: 13,
                            fontWeight: 700,
                            margin: "0 0 3px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                          }}
                        >
                          {book.title}
                        </p>
                        <p style={{ color: "#8b87ad", fontSize: 11.5, margin: "0 0 10px" }}>
                          ${book.price}
                        </p>

                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 11,
                            color: "#8b87ad",
                            marginBottom: 10,
                          }}
                        >
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <Eye size={11} /> {book.viewCount || 0}
                          </span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <ShoppingCart size={11} /> {book.requestCount || 0}
                          </span>
                        </div>

                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => openEdit(book)} style={iconBtnEdit}>
                            <Pencil size={12} />
                          </button>

                          {confirmDeleteBook === book.id ? (
                            <div style={{ display: "flex", gap: 6, flex: 1 }}>
                              <button
                                onClick={() => handleDeleteBook(book)}
                                style={{
                                  flex: 1,
                                  border: "none",
                                  background: "#ef4444",
                                  color: "#fff",
                                  fontWeight: 700,
                                  fontSize: 11,
                                  padding: "7px 0",
                                  borderRadius: 8,
                                  cursor: "pointer",
                                }}
                              >
                                Xaqiiji
                              </button>
                              <button
                                onClick={() => setConfirmDeleteBook(null)}
                                style={{
                                  flex: 1,
                                  border: "1px solid rgba(255,255,255,0.15)",
                                  background: "transparent",
                                  color: "#a9a6c4",
                                  fontWeight: 700,
                                  fontSize: 11,
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
                              onClick={() => setConfirmDeleteBook(book.id)}
                              style={{ ...iconBtnDelete, flex: 1 }}
                            >
                              <Trash2 size={12} /> Tirtir
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === "requests" && (
            <div
              style={{
                background: "linear-gradient(160deg,#151233,#181341)",
                borderRadius: 20,
                border: "1px solid rgba(139,108,245,0.25)",
                overflow: "hidden",
              }}
            >
              {requests.length === 0 ? (
                <p style={{ color: "#8b87ad", padding: 24 }}>Weli codsi lama helin.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {requests.map((r) => (
                    <div
                      key={r.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 14,
                        padding: "16px 20px",
                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ color: "#fff", fontWeight: 700, fontSize: 13.5 }}>
                          {r.bookTitle || "—"}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: 14,
                            marginTop: 4,
                            color: "#8b87ad",
                            fontSize: 12,
                            flexWrap: "wrap",
                          }}
                        >
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <User size={12} /> {r.name}
                          </span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <Phone size={12} /> {r.phone}
                          </span>
                          <span>${r.bookPrice}</span>
                          <span>{formatDate(r.createdAt)}</span>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button
                          onClick={() => markRequestFulfilled(r)}
                          style={{
                            border: "1px solid rgba(34,197,94,0.35)",
                            background:
                              r.status === "Fulfilled"
                                ? "rgba(34,197,94,0.2)"
                                : "rgba(34,197,94,0.08)",
                            color: "#4ade80",
                            fontWeight: 700,
                            fontSize: 11.5,
                            padding: "8px 14px",
                            borderRadius: 8,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {r.status === "Fulfilled" ? "✓ Fulfilled" : "Mark Fulfilled"}
                        </button>

                        {confirmDeleteReq === r.id ? (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              onClick={() => handleDeleteRequest(r)}
                              style={{
                                border: "none",
                                background: "#ef4444",
                                color: "#fff",
                                fontWeight: 700,
                                fontSize: 11.5,
                                padding: "8px 12px",
                                borderRadius: 8,
                                cursor: "pointer",
                              }}
                            >
                              Xaqiiji
                            </button>
                            <button
                              onClick={() => setConfirmDeleteReq(null)}
                              style={{
                                border: "1px solid rgba(255,255,255,0.15)",
                                background: "transparent",
                                color: "#a9a6c4",
                                fontWeight: 700,
                                fontSize: 11.5,
                                padding: "8px 12px",
                                borderRadius: 8,
                                cursor: "pointer",
                              }}
                            >
                              Jooji
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteReq(r.id)}
                            style={iconBtnDelete}
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit modal */}
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
              <h2 style={{ color: "#fff", margin: 0, fontSize: 18 }}>Wax ka bedel Buugga</h2>
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
                htmlFor="editCoverFile"
                style={{
                  display: "block",
                  width: 150,
                  aspectRatio: "3/4",
                  borderRadius: 12,
                  border: "2px dashed rgba(139,108,245,0.4)",
                  background: editCoverPreview
                    ? `url(${editCoverPreview}) center/cover`
                    : "rgba(139,108,245,0.06)",
                  cursor: "pointer",
                  marginBottom: 18,
                }}
              />
              <input
                id="editCoverFile"
                type="file"
                accept="image/*"
                onChange={handleEditCoverChange}
                style={{ display: "none" }}
              />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={fieldLabel}>Title</label>
                  <input
                    style={input}
                    value={editData.title}
                    onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                  />
                </div>
                <div>
                  <label style={fieldLabel}>Author</label>
                  <input
                    style={input}
                    value={editData.author}
                    onChange={(e) => setEditData({ ...editData, author: e.target.value })}
                  />
                </div>
                <div>
                  <label style={fieldLabel}>Category</label>
                  <select
                    style={input}
                    value={editData.category}
                    onChange={(e) => setEditData({ ...editData, category: e.target.value })}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={fieldLabel}>Price ($)</label>
                  <input
                    style={input}
                    type="number"
                    value={editData.price}
                    onChange={(e) => setEditData({ ...editData, price: e.target.value })}
                  />
                </div>
              </div>

              <label style={fieldLabel}>Description</label>
              <textarea
                style={{ ...input, resize: "vertical", fontFamily: "inherit" }}
                rows={3}
                value={editData.description}
                onChange={(e) => setEditData({ ...editData, description: e.target.value })}
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

const fieldLabel = {
  color: "#a9a6c4",
  fontSize: 11.5,
  fontWeight: 700,
  display: "block",
  marginBottom: 5,
};

const input = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1.5px solid rgba(139,108,245,0.3)",
  background: "rgba(255,255,255,0.02)",
  color: "#e5e3f7",
  fontSize: 12.5,
  outline: "none",
};

const iconBtnEdit = {
  background: "rgba(139,108,245,0.12)",
  border: "1px solid rgba(139,108,245,0.3)",
  color: "#c4b5fd",
  width: 32,
  height: 32,
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const iconBtnDelete = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 5,
  border: "1px solid rgba(239,68,68,0.3)",
  background: "rgba(239,68,68,0.12)",
  color: "#f87171",
  fontWeight: 700,
  fontSize: 11,
  padding: "7px 10px",
  borderRadius: 8,
  cursor: "pointer",
};