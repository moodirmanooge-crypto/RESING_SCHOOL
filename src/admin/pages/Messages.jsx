import { useEffect, useState, useRef } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../../firebase/firebase";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import MessagesCard from "../components/MessagesCard";
import {
  Bell,
  Search,
  FileText,
  Trash2,
  CheckCheck,
  Mail,
  MailOpen,
  Paperclip,
} from "lucide-react";

const NOTIFICATION_SOUND_URL =
  "https://actions.google.com/sounds/v1/alarms/beep_short.ogg";

export default function Messages() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("All");
  const [selected, setSelected] = useState(null);
  const [deletingAll, setDeletingAll] = useState(false);

  const audioRef = useRef(null);
  const isFirstLoad = useRef(true);
  const knownIds = useRef(new Set());

  useEffect(() => {
    const q = query(collection(db, "messages"), orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        if (isFirstLoad.current) {
          list.forEach((m) => knownIds.current.add(m.id));
          isFirstLoad.current = false;
        } else {
          const newOnes = list.filter((m) => !knownIds.current.has(m.id));
          if (newOnes.length > 0) {
            newOnes.forEach((m) => knownIds.current.add(m.id));
            playNotificationSound();
          }
        }

        setMessages(list);
        setLoading(false);
      },
      (err) => {
        console.log(err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  function playNotificationSound() {
    try {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.log(err);
    }
  }

  const unreadCount = messages.filter((m) => !m.read).length;

  const roles = ["All", ...new Set(messages.map((m) => m.senderRole).filter(Boolean))];

  const filtered = messages.filter((m) => {
    const q = search.toLowerCase();
    const matchesSearch =
      (m.senderName || "").toLowerCase().includes(q) ||
      (m.text || "").toLowerCase().includes(q);
    const matchesRole = filterRole === "All" || m.senderRole === filterRole;
    return matchesSearch && matchesRole;
  });

  async function openMessage(msg) {
    setSelected(msg);
    if (!msg.read) {
      try {
        setMessages((prev) =>
          prev.map((m) => (m.id === msg.id ? { ...m, read: true } : m))
        );
        await updateDoc(doc(db, "messages", msg.id), { read: true });
      } catch (err) {
        console.log(err);
      }
    }
  }

  async function markAllRead() {
    try {
      const unreadIds = messages.filter((m) => !m.read).map((m) => m.id);
      setMessages((prev) => prev.map((m) => ({ ...m, read: true })));
      await Promise.all(
        unreadIds.map((id) => updateDoc(doc(db, "messages", id), { read: true }))
      );
    } catch (err) {
      console.log(err);
    }
  }

  async function deleteMessage(id) {
    if (!confirm("Ma hubtaa inaad tirtirto fariintan?")) return;
    try {
      await deleteDoc(doc(db, "messages", id));
      if (selected?.id === id) setSelected(null);
    } catch (err) {
      console.log(err);
    }
  }

  async function deleteAllMessages() {
    if (filtered.length === 0) return;
    if (
      !confirm(
        `Ma hubtaa inaad tirtirto dhammaan ${filtered.length} fariimood? Tallaabadan lama soo celin karo.`
      )
    )
      return;

    try {
      setDeletingAll(true);
      const idsToDelete = filtered.map((m) => m.id);
      await Promise.all(idsToDelete.map((id) => deleteDoc(doc(db, "messages", id))));
      if (selected && idsToDelete.includes(selected.id)) setSelected(null);
    } catch (err) {
      console.log(err);
      alert("Khalad ayaa dhacay marka la tirtirayay: " + err.message);
    } finally {
      setDeletingAll(false);
    }
  }

  function formatDate(ts) {
    if (!ts) return "—";
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleString();
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0b0a1c" }}>
      <audio ref={audioRef} src={NOTIFICATION_SOUND_URL} preload="auto" />

      <Sidebar />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: "20px 24px 0" }}>
          <Topbar title="Messages" />
        </div>

        <div style={{ padding: "26px 30px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 22,
              flexWrap: "wrap",
              gap: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={bellWrap}>
                <Bell color="#8b6cf5" size={22} />
                {unreadCount > 0 && <span style={bellBadge}>{unreadCount}</span>}
              </div>
              <div>
                <h1 style={{ margin: 0, color: "#fff", fontSize: 24, fontWeight: 800 }}>
                  Fariimaha Soo Gala
                </h1>
                <p style={{ margin: "3px 0 0", color: "#8b87ad", fontSize: 13 }}>
                  Cabashooyinka, PDF-yada iyo fariimaha maamulayaasha ay soo diraan
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {unreadCount > 0 && (
                <button onClick={markAllRead} style={markAllBtn}>
                  <CheckCheck size={16} />
                  Calaamadee dhammaan la akhriyay
                </button>
              )}

              {filtered.length > 0 && (
                <button
                  onClick={deleteAllMessages}
                  disabled={deletingAll}
                  style={{
                    ...deleteAllBtn,
                    opacity: deletingAll ? 0.7 : 1,
                    cursor: deletingAll ? "not-allowed" : "pointer",
                  }}
                >
                  <Trash2 size={16} />
                  {deletingAll ? "Tirtiraya..." : "Tirtir Dhammaan"}
                </button>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: 14, marginBottom: 22, flexWrap: "wrap" }}>
            <div style={searchWrap}>
              <Search size={16} color="#8b87ad" />
              <input
                placeholder="Raadi fariin ama cid..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={searchInput}
              />
            </div>

            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              style={roleSelect}
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 24 }}>
            <MessagesCard messages={messages} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1.6fr", gap: 20, alignItems: "start" }}>
            <div style={listCard}>
              {loading ? (
                <p style={{ color: "#8b87ad" }}>Loading...</p>
              ) : filtered.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 0" }}>
                  <Mail size={40} color="#4b4772" />
                  <p style={{ color: "#8b87ad", marginTop: 12 }}>Weli fariin lama helin.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {filtered.map((msg) => (
                    <div
                      key={msg.id}
                      onClick={() => openMessage(msg)}
                      style={{
                        ...msgRow,
                        borderColor:
                          selected?.id === msg.id
                            ? "rgba(139,108,245,0.6)"
                            : "rgba(139,108,245,0.12)",
                        background: !msg.read
                          ? "rgba(139,108,245,0.08)"
                          : "rgba(255,255,255,0.02)",
                      }}
                    >
                      <div
                        style={{
                          ...senderAvatar,
                          background: msg.senderPhoto
                            ? `url(${msg.senderPhoto}) center/cover`
                            : "linear-gradient(135deg,#6D5DF0,#8B5CF6)",
                        }}
                      >
                        {!msg.senderPhoto &&
                          (msg.senderName || "?").charAt(0).toUpperCase()}
                      </div>

                      {msg.read ? (
                        <MailOpen size={15} color="#6b6890" />
                      ) : (
                        <Mail size={15} color="#8b6cf5" />
                      )}

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <span
                            style={{
                              color: "#fff",
                              fontWeight: msg.read ? 500 : 700,
                              fontSize: 13.5,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {msg.senderName || "Qof aan la aqoon"}
                          </span>
                          <span style={{ color: "#6b6890", fontSize: 11, whiteSpace: "nowrap" }}>
                            {formatDate(msg.createdAt)}
                          </span>
                        </div>
                        <div
                          style={{
                            color: "#a9a6c4",
                            fontSize: 12.5,
                            marginTop: 3,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {msg.text || "—"}
                        </div>
                        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                          <span style={roleTag}>{msg.senderRole || "—"}</span>
                          {msg.fileUrl && (
                            <span style={{ ...roleTag, display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <Paperclip size={11} /> PDF
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={detailCard}>
              {!selected ? (
                <div style={{ textAlign: "center", padding: "60px 0", color: "#6b6890" }}>
                  <FileText size={40} style={{ margin: "0 auto 12px" }} />
                  <p>Dooro fariin si aad faahfaahinteeda u aragto.</p>
                </div>
              ) : (
                <>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 18,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div
                        style={{
                          ...senderAvatarLarge,
                          background: selected.senderPhoto
                            ? `url(${selected.senderPhoto}) center/cover`
                            : "linear-gradient(135deg,#6D5DF0,#8B5CF6)",
                        }}
                      >
                        {!selected.senderPhoto &&
                          (selected.senderName || "?").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h2 style={{ margin: 0, color: "#fff", fontSize: 19 }}>
                          {selected.senderName || "Qof aan la aqoon"}
                        </h2>
                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                          <span style={roleTag}>{selected.senderRole || "—"}</span>
                          <span style={{ color: "#6b6890", fontSize: 12.5 }}>
                            {formatDate(selected.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button onClick={() => deleteMessage(selected.id)} style={deleteBtn}>
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <div style={messageBody}>{selected.text || "—"}</div>

                  {selected.fileUrl && (
                    <a
                      href={selected.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={pdfLink}
                    >
                      <FileText size={18} />
                      {selected.fileName || "Fiiri Faylka PDF"}
                    </a>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        input::placeholder { color: #6b6890; }
        select option { background: #1e1a4a; color: #ffffff; }
      `}</style>
    </div>
  );
}

const bellWrap = {
  position: "relative",
  width: 46,
  height: 46,
  borderRadius: 12,
  background: "rgba(139,108,245,0.1)",
  border: "1px solid rgba(139,108,245,0.3)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const bellBadge = {
  position: "absolute",
  top: -6,
  right: -6,
  minWidth: 20,
  height: 20,
  borderRadius: "50%",
  background: "#ef4444",
  color: "#fff",
  fontSize: 11,
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 4px",
};

const markAllBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "rgba(255,255,255,0.03)",
  border: "1.5px solid rgba(139,108,245,0.35)",
  color: "#8b6cf5",
  padding: "10px 16px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
};

const deleteAllBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "rgba(239,68,68,0.12)",
  border: "1.5px solid rgba(239,68,68,0.35)",
  color: "#f87171",
  padding: "10px 16px",
  borderRadius: 10,
  fontWeight: 600,
  fontSize: 13,
};

const searchWrap = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: 320,
  padding: "0 14px",
  borderRadius: 10,
  border: "1.5px solid rgba(139,108,245,0.3)",
  background: "rgba(255,255,255,0.02)",
};

const searchInput = {
  flex: 1,
  padding: "12px 0",
  border: "none",
  outline: "none",
  background: "transparent",
  color: "#e5e3f7",
  fontSize: 14,
};

const roleSelect = {
  padding: "0 14px",
  borderRadius: 10,
  border: "1.5px solid rgba(139,108,245,0.3)",
  background: "rgba(255,255,255,0.02)",
  color: "#e5e3f7",
  fontSize: 14,
  outline: "none",
};

const listCard = {
  background: "linear-gradient(160deg,#1c1840,#211c48)",
  borderRadius: 16,
  padding: 16,
  border: "1px solid rgba(255,255,255,0.05)",
  maxHeight: 620,
  overflowY: "auto",
};

const msgRow = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid",
  cursor: "pointer",
};

const senderAvatar = {
  width: 32,
  height: 32,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#fff",
  fontWeight: 700,
  fontSize: 13,
  flexShrink: 0,
};

const senderAvatarLarge = {
  width: 52,
  height: 52,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#fff",
  fontWeight: 700,
  fontSize: 18,
  flexShrink: 0,
};

const roleTag = {
  background: "rgba(139,108,245,0.12)",
  color: "#c4b5fd",
  fontSize: 10.5,
  padding: "3px 9px",
  borderRadius: 20,
  border: "1px solid rgba(139,108,245,0.25)",
};

const detailCard = {
  background: "linear-gradient(160deg,#1c1840,#211c48)",
  borderRadius: 16,
  padding: 26,
  border: "1px solid rgba(255,255,255,0.05)",
  minHeight: 620,
};

const messageBody = {
  color: "#c7c4e0",
  fontSize: 14.5,
  lineHeight: 1.7,
  whiteSpace: "pre-wrap",
};

const pdfLink = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  marginTop: 22,
  background: "rgba(139,108,245,0.1)",
  border: "1px solid rgba(139,108,245,0.35)",
  color: "#c4b5fd",
  padding: "12px 18px",
  borderRadius: 12,
  textDecoration: "none",
  fontWeight: 600,
  fontSize: 13.5,
};

const deleteBtn = {
  background: "rgba(239,68,68,0.12)",
  border: "1px solid rgba(239,68,68,0.3)",
  color: "#f87171",
  width: 34,
  height: 34,
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};