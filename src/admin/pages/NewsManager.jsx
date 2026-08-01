// src/admin/pages/NewsManager.jsx
//
// Admin page for posting text-only news/announcements to the public
// News & Events page. Writes to Firestore `news` collection; the admin
// avatar and "Rising Star School" name + verified tick are rendered by
// the public News.jsx page itself, not stored per-post.

import { useEffect, useState } from "react";
import { db } from "../../firebase/firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { Newspaper, Send, Trash2, Heart } from "lucide-react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import logo from "../../assets/logo.png";

function formatDate(ts) {
  if (!ts?.seconds) return "—";
  return new Date(ts.seconds * 1000).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NewsManager() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    const q = query(collection(db, "news"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const handlePost = async () => {
    if (!text.trim()) {
      alert("Fadlan qor qoraalka wararka.");
      return;
    }

    try {
      setPosting(true);
      const docId = `${Date.now()}`;
      await setDoc(doc(db, "news", docId), {
        text: text.trim(),
        likeCount: 0,
        likedBy: [],
        createdAt: serverTimestamp(),
      });
      setText("");
    } catch (err) {
      console.error(err);
      alert("Khalad ayaa dhacay: " + err.message);
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (post) => {
    try {
      await deleteDoc(doc(db, "news", post.id));
      setConfirmDelete(null);
    } catch (err) {
      console.error(err);
      alert("Khalad ayaa dhacay marka la tirtirayay: " + err.message);
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0b0a1c" }}>
      <Sidebar />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: "20px 24px 0" }}>
          <Topbar title="News" />
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
              <Newspaper color="#fff" size={24} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#fff" }}>
                News &amp; Events
              </h1>
              <p style={{ margin: "3px 0 0", color: "#8b87ad", fontSize: 13 }}>
                Qor war cusub — isla markiiba wuxuu ka muuqan doonaa bogga News-ka
              </p>
            </div>
          </div>

          {/* Composer */}
          <div
            style={{
              background: "linear-gradient(160deg,#151233,#181341)",
              borderRadius: 20,
              padding: 22,
              border: "1px solid rgba(139,108,245,0.25)",
              marginBottom: 30,
              display: "flex",
              gap: 16,
            }}
          >
            <img
              src={logo}
              alt=""
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                objectFit: "cover",
                flexShrink: 0,
                border: "2px solid #8b6cf5",
              }}
            />

            <div style={{ flex: 1, minWidth: 0 }}>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                placeholder="Maxaa ka socda dugsiga maanta? Qor war cusub..."
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1.5px solid rgba(139,108,245,0.3)",
                  background: "rgba(255,255,255,0.02)",
                  color: "#e5e3f7",
                  fontSize: 14,
                  resize: "vertical",
                  outline: "none",
                  fontFamily: "inherit",
                  marginBottom: 12,
                }}
              />

              <button
                onClick={handlePost}
                disabled={posting}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: "linear-gradient(90deg,#6d5df0,#8b6cf5)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 12,
                  padding: "11px 22px",
                  fontWeight: 700,
                  fontSize: 13.5,
                  cursor: posting ? "not-allowed" : "pointer",
                  opacity: posting ? 0.7 : 1,
                }}
              >
                <Send size={15} />
                {posting ? "Soo dirayaa..." : "Post"}
              </button>
            </div>
          </div>

          {/* Posted list */}
          {loading ? (
            <p style={{ color: "#8b87ad" }}>Loading...</p>
          ) : posts.length === 0 ? (
            <p style={{ color: "#8b87ad" }}>Weli war lama qorin.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {posts.map((post) => (
                <div
                  key={post.id}
                  style={{
                    background: "linear-gradient(160deg,#1c1840,#211c48)",
                    borderRadius: 16,
                    padding: 18,
                    border: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 12,
                      marginBottom: 10,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <img
                        src={logo}
                        alt=""
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: "50%",
                          objectFit: "cover",
                          border: "1.5px solid #8b6cf5",
                        }}
                      />
                      <div>
                        <div style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>
                          Rising Star School
                        </div>
                        <div style={{ color: "#8b87ad", fontSize: 11.5 }}>
                          {formatDate(post.createdAt)}
                        </div>
                      </div>
                    </div>

                    {confirmDelete === post.id ? (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() => handleDelete(post)}
                          style={{
                            border: "none",
                            background: "#ef4444",
                            color: "#fff",
                            fontWeight: 700,
                            fontSize: 11.5,
                            padding: "6px 12px",
                            borderRadius: 8,
                            cursor: "pointer",
                          }}
                        >
                          Xaqiiji
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          style={{
                            border: "1px solid rgba(255,255,255,0.15)",
                            background: "transparent",
                            color: "#a9a6c4",
                            fontWeight: 700,
                            fontSize: 11.5,
                            padding: "6px 12px",
                            borderRadius: 8,
                            cursor: "pointer",
                          }}
                        >
                          Jooji
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(post.id)}
                        style={{
                          border: "1px solid rgba(239,68,68,0.3)",
                          background: "rgba(239,68,68,0.12)",
                          color: "#f87171",
                          fontWeight: 700,
                          fontSize: 11.5,
                          padding: "6px 10px",
                          borderRadius: 8,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <Trash2 size={12} />
                        Tirtir
                      </button>
                    )}
                  </div>

                  <p
                    style={{
                      color: "#e5e3f7",
                      fontSize: 13.5,
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                      margin: "0 0 10px",
                    }}
                  >
                    {post.text}
                  </p>

                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      color: "#8b87ad",
                      fontSize: 12,
                      borderTop: "1px solid rgba(255,255,255,0.06)",
                      paddingTop: 10,
                      width: "100%",
                    }}
                  >
                    <Heart size={13} /> {post.likeCount || 0} likes
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}