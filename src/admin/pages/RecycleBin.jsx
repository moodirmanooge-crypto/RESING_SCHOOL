// src/admin/pages/RecycleBin.jsx — Recycle Bin-ka Admin-ka (/admin/recycle-bin)
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import RecycleBinPanel from "../../shared/RecycleBinPanel.jsx";

export default function AdminRecycleBin() {
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "#F3F4F8",
        fontFamily: "'Inter','Segoe UI',sans-serif",
      }}
    >
      <Sidebar />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: "22px 26px 0" }}>
          <Topbar />
        </div>
        <div style={{ padding: "26px 30px" }}>
          <RecycleBinPanel actorRole="admin" />
        </div>
      </div>
    </div>
  );
}