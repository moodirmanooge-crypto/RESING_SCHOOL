// src/admin/pages/AdmissionsList.jsx
import { useEffect, useState } from "react";
import { db } from "../../firebase/firebase";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  doc,
  updateDoc,
} from "firebase/firestore";
import Sidebar from "../components/Sidebar";
import {
  CheckCircle2,
  Clock,
  XCircle,
  Phone,
  Smartphone,
  MapPin,
  X,
  Download,
  User,
} from "lucide-react";

export default function AdmissionsList() {
  const [admissions, setAdmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    const q = query(collection(db, "Admissions"), orderBy("submittedAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setAdmissions(rows);
        setLoading(false);
      },
      (err) => {
        console.log(err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const pendingCount = admissions.filter((a) => a.status === "Pending").length;
  const approvedCount = admissions.filter((a) => a.status === "Approved").length;
  const rejectedCount = admissions.filter((a) => a.status === "Rejected").length;

  const filteredAdmissions =
    filter === "All" ? admissions : admissions.filter((a) => a.status === filter);

  const handleApprove = async (id) => {
    try {
      await updateDoc(doc(db, "Admissions", id), { status: "Approved" });
      setSelected((prev) => (prev && prev.id === id ? { ...prev, status: "Approved" } : prev));
    } catch (err) {
      console.log(err);
      alert("Khalad ayaa dhacay markii la aqoonsanayay codsiga.");
    }
  };

  const handleReject = async (id) => {
    if (!confirm("Ma hubtaa inaad diidayso codsigan?")) return;
    try {
      await updateDoc(doc(db, "Admissions", id), { status: "Rejected" });
      setSelected((prev) => (prev && prev.id === id ? { ...prev, status: "Rejected" } : prev));
    } catch (err) {
      console.log(err);
      alert("Khalad ayaa dhacay markii codsiga la diidayay.");
    }
  };

  // Downloads the admission's stored photo straight to the admin's
  // computer. Firebase Storage's default bucket doesn't allow direct
  // cross-origin fetch() (CORS), so instead of fetching a blob, we let
  // the browser handle the download natively via an <a download> link
  // pointed straight at the Firebase Storage URL — this works because
  // the browser's native download flow isn't subject to the same CORS
  // restriction that fetch() is.
  const handleDownloadPhoto = (admission, e) => {
    if (e) e.stopPropagation();
    if (!admission.studentPhoto) {
      alert("Sawir lama helin codsigan.");
      return;
    }
    const a = document.createElement("a");
    a.href = admission.studentPhoto;
    a.download = `${(admission.studentName || "student").replace(/\s+/g, "_")}_photo.jpg`;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const formatDate = (ts) => {
    if (!ts) return "-";
    try {
      const date = ts.toDate ? ts.toDate() : new Date(ts);
      return date.toLocaleString();
    } catch {
      return "-";
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F7FAF8" }}>
      <Sidebar />

      <div style={{ flex: 1, padding: "28px 32px" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 24,
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#14532d" }}>
              Admissions
            </h1>
            <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 13.5 }}>
              Codsiyada diiwaangelinta ee laga soo diray bogga Admissions
            </p>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <StatPill
              label="Pending"
              count={pendingCount}
              color="#d97706"
              bg="#FEF3C7"
              icon={<Clock size={15} />}
            />
            <StatPill
              label="Approved"
              count={approvedCount}
              color="#15803d"
              bg="#DCFCE7"
              icon={<CheckCircle2 size={15} />}
            />
            <StatPill
              label="Rejected"
              count={rejectedCount}
              color="#b91c1c"
              bg="#FEE2E2"
              icon={<XCircle size={15} />}
            />
            <StatPill
              label="Total"
              count={admissions.length}
              color="#374151"
              bg="#F3F4F6"
              icon={null}
            />
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
          {["All", "Pending", "Approved", "Rejected"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "8px 16px",
                borderRadius: 999,
                border: "1px solid rgba(15,61,46,0.12)",
                background: filter === f ? "#16a34a" : "#fff",
                color: filter === f ? "#fff" : "#374151",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Table */}
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            border: "1px solid rgba(15,61,46,0.08)",
            overflow: "hidden",
            overflowX: "auto",
          }}
        >
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
              Loading...
            </div>
          ) : filteredAdmissions.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
              Codsi lama helin.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
              <thead>
                <tr style={{ background: "#F7FAF8", textAlign: "left" }}>
                  <Th>Photo</Th>
                  <Th>Student Name</Th>
                  <Th>Class</Th>
                  <Th>Parent</Th>
                  <Th>Student Phone</Th>
                  <Th>Parent Phone</Th>
                  <Th>Submitted</Th>
                  <Th>Status</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {filteredAdmissions.map((a) => (
                  <tr
                    key={a.id}
                    style={{
                      borderTop: "1px solid rgba(15,61,46,0.06)",
                      cursor: "pointer",
                    }}
                    onClick={() => setSelected(a)}
                  >
                    <Td>
                      {a.studentPhoto ? (
                        <img
                          src={a.studentPhoto}
                          alt={a.studentName}
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: "50%",
                            objectFit: "cover",
                            border: "1px solid rgba(15,61,46,0.12)",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: "50%",
                            background: "#F3F4F6",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#9CA3AF",
                          }}
                        >
                          <User size={18} />
                        </div>
                      )}
                    </Td>
                    <Td style={{ fontWeight: 700, color: "#111827" }}>
                      {a.studentName}
                    </Td>
                    <Td>{a.desiredClass}</Td>
                    <Td>{a.parentName || "-"}</Td>
                    <Td>{a.studentPhone || "-"}</Td>
                    <Td>{a.parentPhone}</Td>
                    <Td>{formatDate(a.submittedAt)}</Td>
                    <Td>
                      <StatusBadge status={a.status} />
                    </Td>
                    <Td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {a.studentPhoto && (
                          <button
                            onClick={(e) => handleDownloadPhoto(a, e)}
                            title="Download sawirka"
                            style={{
                              padding: "6px 10px",
                              borderRadius: 8,
                              border: "1px solid rgba(15,61,46,0.15)",
                              background: "#F0FDF4",
                              color: "#14532d",
                              fontWeight: 700,
                              fontSize: 12.5,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                            }}
                          >
                            <Download size={13} />
                          </button>
                        )}
                        {a.status !== "Approved" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApprove(a.id);
                            }}
                            style={{
                              padding: "6px 14px",
                              borderRadius: 8,
                              border: "none",
                              background: "#16a34a",
                              color: "#fff",
                              fontWeight: 700,
                              fontSize: 12.5,
                              cursor: "pointer",
                            }}
                          >
                            Approve
                          </button>
                        )}
                        {a.status !== "Rejected" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReject(a.id);
                            }}
                            style={{
                              padding: "6px 14px",
                              borderRadius: 8,
                              border: "1px solid #FCA5A5",
                              background: "#FEF2F2",
                              color: "#b91c1c",
                              fontWeight: 700,
                              fontSize: 12.5,
                              cursor: "pointer",
                            }}
                          >
                            Reject
                          </button>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Detail modal */}
      {selected && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: 16,
          }}
          onClick={() => setSelected(null)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 18,
              width: "100%",
              maxWidth: 480,
              maxHeight: "85vh",
              overflowY: "auto",
              padding: 26,
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelected(null)}
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                border: "none",
                background: "#F3F4F6",
                borderRadius: 8,
                width: 30,
                height: 30,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={16} />
            </button>

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              {selected.studentPhoto ? (
                <img
                  src={selected.studentPhoto}
                  alt={selected.studentName}
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "3px solid #DCFCE7",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: "50%",
                    background: "#F3F4F6",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#9CA3AF",
                  }}
                >
                  <User size={36} />
                </div>
              )}
            </div>

            <h2
              style={{
                margin: "0 0 4px",
                fontSize: 19,
                fontWeight: 800,
                color: "#14532d",
                textAlign: "center",
              }}
            >
              {selected.studentName}
            </h2>
            <div
              style={{
                marginBottom: 16,
                display: "flex",
                justifyContent: "center",
              }}
            >
              <StatusBadge status={selected.status} />
            </div>

            {selected.studentPhoto && (
              <button
                onClick={() => handleDownloadPhoto(selected)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "10px 0",
                  borderRadius: 10,
                  border: "1px solid rgba(15,61,46,0.15)",
                  background: "#F0FDF4",
                  color: "#14532d",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  marginBottom: 14,
                }}
              >
                <Download size={15} />
                Download Sawirka
              </button>
            )}

            <DetailRow label="Date of Birth" value={selected.dob || "-"} />
            <DetailRow label="Desired Class" value={selected.desiredClass} />
            <DetailRow label="Previous School" value={selected.previousSchool || "-"} />
            <DetailRow label="Parent / Guardian" value={selected.parentName || "-"} />
            <DetailRow
              label="Student Phone"
              value={selected.studentPhone || "-"}
              icon={<Smartphone size={13} />}
            />
            <DetailRow
              label="Parent Phone"
              value={selected.parentPhone}
              icon={<Phone size={13} />}
            />
            <DetailRow
              label="Address"
              value={selected.address || "-"}
              icon={<MapPin size={13} />}
            />
            <DetailRow label="Notes" value={selected.notes || "-"} />
            <DetailRow label="Submitted" value={formatDate(selected.submittedAt)} />

            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              {selected.status !== "Approved" && (
                <button
                  onClick={() => handleApprove(selected.id)}
                  style={{
                    flex: 1,
                    padding: "12px 0",
                    borderRadius: 10,
                    border: "none",
                    background: "#16a34a",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  Approve
                </button>
              )}
              {selected.status !== "Rejected" && (
                <button
                  onClick={() => handleReject(selected.id)}
                  style={{
                    flex: 1,
                    padding: "12px 0",
                    borderRadius: 10,
                    border: "1px solid #FCA5A5",
                    background: "#FEF2F2",
                    color: "#b91c1c",
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  Reject
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatPill({ label, count, color, bg, icon }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: bg,
        color,
        padding: "8px 14px",
        borderRadius: 12,
        fontWeight: 700,
        fontSize: 13,
      }}
    >
      {icon}
      {label}: {count}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    Approved: { bg: "#DCFCE7", color: "#15803d" },
    Rejected: { bg: "#FEE2E2", color: "#b91c1c" },
    Pending: { bg: "#FEF3C7", color: "#d97706" },
  };
  const style = map[status] || map.Pending;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 12px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background: style.bg,
        color: style.color,
      }}
    >
      {status || "Pending"}
    </span>
  );
}

function Th({ children }) {
  return (
    <th
      style={{
        padding: "12px 16px",
        fontSize: 12,
        fontWeight: 700,
        color: "#6b7280",
        textTransform: "uppercase",
        letterSpacing: "0.03em",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, style }) {
  return (
    <td style={{ padding: "12px 16px", fontSize: 13.5, color: "#374151", ...style }}>
      {children}
    </td>
  );
}

function DetailRow({ label, value, icon }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "9px 0",
        borderBottom: "1px solid rgba(15,61,46,0.06)",
        fontSize: 13.5,
      }}
    >
      <span style={{ color: "#6b7280", display: "flex", alignItems: "center", gap: 6 }}>
        {icon}
        {label}
      </span>
      <span style={{ color: "#111827", fontWeight: 600, textAlign: "right" }}>{value}</span>
    </div>
  );
}