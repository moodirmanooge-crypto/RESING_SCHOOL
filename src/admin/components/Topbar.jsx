import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Bell, Mail, Calendar, Menu, ChevronDown, Camera } from "lucide-react";
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../firebase/firebase";
import { SCHOOL_NAME } from "../schoolInfo";

// `title` (ikhtiyaari): boggaga kale waxay soo diri karaan magaca boggooda.
// Haddii aan la soo dirin (sida Dashboard), magaca dugsiga ayaa la muujinayaa.
export default function Topbar({ title }) {
  const navigate = useNavigate();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoFailed, setPhotoFailed] = useState(false);
  const [adminName, setAdminName] = useState("Admin User");
  const [adminRoleLabel, setAdminRoleLabel] = useState("Super Admin");
  const [uploading, setUploading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const fileInputRef = useRef(null);

  const adminId = localStorage.getItem("adminId") || "";
  const adminRole = localStorage.getItem("adminRole") || "admin";

  useEffect(() => {
    const msgQ = query(collection(db, "messages"), where("read", "==", false));
    const unsubMsg = onSnapshot(msgQ, (snap) => setUnreadMessages(snap.docs.length), (err) => console.log(err));

    const notifQ = query(collection(db, "notifications"), where("read", "==", false));
    const unsubNotif = onSnapshot(notifQ, (snap) => setUnreadNotifications(snap.docs.length), (err) => console.log(err));

    return () => {
      unsubMsg();
      unsubNotif();
    };
  }, []);

  useEffect(() => {
    setAdminRoleLabel(adminRole === "subadmin" ? "Sub-Admin" : "Super Admin");
    async function loadAdminPhoto() {
      if (!adminId) return;
      try {
        const snap = await getDoc(doc(db, "admin", adminId));
        if (snap.exists()) {
          const data = snap.data();
          if (data.photoUrl) {
            setPhotoUrl(data.photoUrl);
            setPhotoFailed(false);
          }
          if (data.fullName || data.username) setAdminName(data.fullName || data.username);
          setAdminRoleLabel((data.role || adminRole) === "subadmin" ? "Sub-Admin" : "Super Admin");
        }
      } catch (err) {
        console.log(err);
      }
    }
    loadAdminPhoto();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminId]);

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file || !adminId) return;
    try {
      setUploading(true);
      const storageRef = ref(storage, `adminPhotos/${adminId}-${Date.now()}-${file.name}`);
      await uploadBytes(storageRef, file);
      const url = (await getDownloadURL(storageRef)).trim();
      await updateDoc(doc(db, "admin", adminId), { photoUrl: url });
      setPhotoUrl(url);
      setPhotoFailed(false);
    } catch (err) {
      console.error("Khalad sawirka admin-ka la soo shubayay:", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Raadinta: Enter -> bogga Student List
  function handleSearchKey(e) {
    if (e.key === "Enter" && searchText.trim()) {
      navigate(`/admin/students?q=${encodeURIComponent(searchText.trim())}`);
    }
  }

  const initials = (adminName || "A")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div style={bar}>
      {/* LEFT: menu + magaca */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0, flex: "1 1 280px" }}>
        <div style={menuBtn}>
          <Menu size={20} />
        </div>
        <div style={titleText} title={title || SCHOOL_NAME}>
          {title || SCHOOL_NAME}
        </div>
      </div>

      {/* RIGHT */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={searchBox}>
          <Search size={17} color="#6B7280" />
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={handleSearchKey}
            placeholder="Search students, teachers, classes..."
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#111827", fontSize: 13.5, minWidth: 0 }}
          />
        </div>

        <IconButton onClick={() => navigate("/admin/messages")} badge={unreadNotifications}>
          <Bell size={19} color="#374151" />
        </IconButton>
        <IconButton onClick={() => navigate("/admin/messages")} badge={unreadMessages}>
          <Mail size={19} color="#374151" />
        </IconButton>
        <IconButton onClick={() => navigate("/admin/holidays")}>
          <Calendar size={19} color="#374151" />
        </IconButton>

        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 4 }}>
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{ position: "relative", width: 46, height: 46, flexShrink: 0, cursor: "pointer" }}
            title="Beddel sawirka profile-ka"
          >
            {photoUrl && !photoFailed ? (
              <img
                src={photoUrl}
                alt=""
                onError={() => setPhotoFailed(true)}
                style={{ ...avatarBase, objectFit: "cover", opacity: uploading ? 0.5 : 1 }}
              />
            ) : (
              <div style={{ ...avatarBase, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#16a34a,#0f4a2c)", color: "#fff", fontWeight: 800, fontSize: 15, opacity: uploading ? 0.5 : 1 }}>
                {initials}
              </div>
            )}
            <div style={camBadge}>
              <Camera size={9} color="#fff" />
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: "none" }} />
          </div>
          <div style={{ lineHeight: 1.25 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", whiteSpace: "nowrap" }}>{adminName}</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>{adminRoleLabel}</div>
          </div>
          <ChevronDown size={17} color="#374151" />
        </div>
      </div>
    </div>
  );
}

function IconButton({ children, onClick, badge }) {
  return (
    <div onClick={onClick} style={iconBtn}>
      {children}
      {badge > 0 && <span style={badgeStyle}>{badge > 9 ? "9+" : badge}</span>}
    </div>
  );
}

const bar = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 16,
};
const menuBtn = {
  width: 46,
  height: 46,
  borderRadius: 13,
  background: "linear-gradient(135deg,#0f4a2c,#0a2f1c)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  cursor: "pointer",
  color: "#fff",
  flexShrink: 0,
  boxShadow: "0 6px 14px rgba(10,47,28,0.25)",
};
const titleText = {
  fontSize: 16,
  fontWeight: 800,
  color: "#0f2a1c",
  letterSpacing: "0.01em",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};
const searchBox = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: 340,
  maxWidth: "100%",
  height: 46,
  borderRadius: 14,
  background: "#fff",
  border: "1px solid rgba(17,24,39,0.08)",
  boxShadow: "0 2px 10px rgba(17,24,39,0.05)",
  padding: "0 16px",
};
const iconBtn = {
  width: 46,
  height: 46,
  borderRadius: "50%",
  background: "#fff",
  border: "1px solid rgba(17,24,39,0.08)",
  boxShadow: "0 2px 10px rgba(17,24,39,0.05)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  position: "relative",
  cursor: "pointer",
};
const badgeStyle = {
  position: "absolute",
  top: -3,
  right: -3,
  minWidth: 19,
  height: 19,
  borderRadius: 999,
  background: "#EF4444",
  color: "#fff",
  fontSize: 10,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  fontWeight: 800,
  border: "2px solid #fff",
  padding: "0 4px",
};
const avatarBase = { width: 46, height: 46, borderRadius: "50%", border: "2px solid #fff", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" };
const camBadge = {
  position: "absolute",
  bottom: -1,
  right: -1,
  width: 18,
  height: 18,
  borderRadius: "50%",
  background: "#16a34a",
  border: "2px solid #fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};