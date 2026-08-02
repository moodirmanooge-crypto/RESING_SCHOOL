import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Bell, Mail, Calendar, Menu, ChevronDown, Camera } from "lucide-react";
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../firebase/firebase";

import avatar from "../assets/avatar.png";

export default function Topbar() {
  const navigate = useNavigate();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [photoUrl, setPhotoUrl] = useState("");
  const [adminName, setAdminName] = useState("Admin User");
  const [adminRoleLabel, setAdminRoleLabel] = useState("Super Admin");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Every admin (Super Admin or sub-admin) has their own Firestore doc id,
  // stored at login time in localStorage.adminId (see LoginForm.jsx). Using
  // that here — instead of a hard-coded "admin" doc id — is what makes each
  // admin's photo/name their own instead of one shared record everyone
  // reads and overwrites.
  const adminId = localStorage.getItem("adminId") || "";
  const adminRole = localStorage.getItem("adminRole") || "admin";

  useEffect(() => {
    const msgQ = query(collection(db, "messages"), where("read", "==", false));
    const unsubMsg = onSnapshot(
      msgQ,
      (snap) => setUnreadMessages(snap.docs.length),
      (err) => console.log(err)
    );

    const notifQ = query(collection(db, "notifications"), where("read", "==", false));
    const unsubNotif = onSnapshot(
      notifQ,
      (snap) => setUnreadNotifications(snap.docs.length),
      (err) => console.log(err)
    );

    return () => {
      unsubMsg();
      unsubNotif();
    };
  }, []);

  // Load THIS admin's own saved profile photo + name (admin/{adminId}) on
  // mount — never the shared "admin/admin" doc, so each admin only ever
  // sees their own photo here.
  useEffect(() => {
    async function loadAdminPhoto() {
      if (!adminId) return;
      try {
        const snap = await getDoc(doc(db, "admin", adminId));
        if (snap.exists()) {
          const data = snap.data();
          if (data.photoUrl) setPhotoUrl(data.photoUrl);
          if (data.fullName || data.username) {
            setAdminName(data.fullName || data.username);
          }
          setAdminRoleLabel(
            (data.role || adminRole) === "subadmin" ? "Sub-Admin" : "Super Admin"
          );
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
      // Path is namespaced by adminId too, so each admin's uploaded files
      // never collide with another admin's in Storage.
      const storageRef = ref(storage, `adminPhotos/${adminId}-${Date.now()}-${file.name}`);
      await uploadBytes(storageRef, file);
      const url = (await getDownloadURL(storageRef)).trim();

      await updateDoc(doc(db, "admin", adminId), { photoUrl: url });
      setPhotoUrl(url);
    } catch (err) {
      console.error("Khalad sawirka admin-ka la soo shubayay:", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 16,
      }}
    >
      {/* LEFT */}
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          background: "linear-gradient(135deg,#16a34a,#15803d)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          cursor: "pointer",
          color: "#fff",
          flexShrink: 0,
        }}
      >
        <Menu size={20} />
      </div>

      {/* RIGHT */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            width: 240,
            height: 42,
            borderRadius: 30,
            background: "#F9FAFB",
            border: "1.5px solid rgba(17,24,39,0.08)",
            padding: "0 16px",
          }}
        >
          <Search size={16} color="#9CA3AF" />
          <input
            placeholder="Search anything..."
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#111827",
              fontSize: 13.5,
            }}
          />
        </div>

        <IconButton onClick={() => navigate("/admin/messages")} badge={unreadNotifications} badgeColor="#EF4444">
          <Bell size={18} color="#6B7280" />
        </IconButton>

        <IconButton onClick={() => navigate("/admin/messages")} badge={unreadMessages} badgeColor="#16a34a">
          <Mail size={18} color="#6B7280" />
        </IconButton>

        <IconButton onClick={() => navigate("/admin/reports")}>
          <Calendar size={18} color="#6B7280" />
        </IconButton>

        <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              position: "relative",
              width: 40,
              height: 40,
              flexShrink: 0,
              cursor: "pointer",
            }}
            title="Beddel sawirka profile-ka"
          >
            <img
              src={photoUrl || avatar}
              alt="Admin"
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                objectFit: "cover",
                opacity: uploading ? 0.5 : 1,
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: -2,
                right: -2,
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: "#16a34a",
                border: "2px solid #fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Camera size={9} color="#fff" />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              style={{ display: "none" }}
            />
          </div>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#111827" }}>{adminName}</div>
            <div style={{ fontSize: 11.5, color: "#9CA3AF" }}>{adminRoleLabel}</div>
          </div>
          <ChevronDown size={16} color="#9CA3AF" />
        </div>
      </div>
    </div>
  );
}

function IconButton({ children, onClick, badge, badgeColor = "#EF4444" }) {
  return (
    <div
      onClick={onClick}
      style={{
        width: 42,
        height: 42,
        borderRadius: "50%",
        background: "#F9FAFB",
        border: "1.5px solid rgba(17,24,39,0.08)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        position: "relative",
        cursor: "pointer",
      }}
    >
      {children}
      {badge > 0 && (
        <span
          style={{
            position: "absolute",
            top: 2,
            right: 2,
            minWidth: 16,
            height: 16,
            borderRadius: "50%",
            background: badgeColor,
            color: "#fff",
            fontSize: 9.5,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            fontWeight: 700,
            border: "2px solid #fff",
            padding: "0 3px",
          }}
        >
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </div>
  );
}