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
import { CheckCircle2, Clock, Phone, Mail, MapPin, X } from "lucide-react";

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

          <div style={{ display: "flex", gap: 12 }}>
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
              label="Total"
              count={admissions.length}
              color="#374151"
              bg="#F3F4F6"
              icon={null}
            />
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          {["All", "Pending", "Approved"].map((f) => (
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
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F7FAF8", textAlign: "left" }}>
                  <Th>Student Name</Th>
                  <Th>Class</Th>
                  <Th>Parent</Th>
                  <Th>Phone</Th>
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
                    <Td style={{ fontWeight: 700, color: "#111827" }}>
                      {a.studentName}
                    </Td>
                    <Td>{a.desiredClass}</Td>
                    <Td>{a.parentName || "-"}</Td>
                    <Td>{a.parentPhone}</Td>
                    <Td>{formatDate(a.submittedAt)}</Td>
                    <Td>
                      <StatusBadge status={a.status} />
                    </Td>
                    <Td>
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

            <h2 style={{ margin: "0 0 4px", fontSize: 19, fontWeight: 800, color: "#14532d" }}>
              {selected.studentName}
            </h2>
            <div style={{ marginBottom: 16 }}>
              <StatusBadge status={selected.status} />
            </div>

            <DetailRow label="Date of Birth" value={selected.dob || "-"} />
            <DetailRow label="Desired Class" value={selected.desiredClass} />
            <DetailRow label="Previous School" value={selected.previousSchool || "-"} />
            <DetailRow label="Parent / Guardian" value={selected.parentName || "-"} />
            <DetailRow
              label="Phone"
              value={selected.parentPhone}
              icon={<Phone size={13} />}
            />
            <DetailRow
              label="Email"
              value={selected.parentEmail || "-"}
              icon={<Mail size={13} />}
            />
            <DetailRow
              label="Address"
              value={selected.address || "-"}
              icon={<MapPin size={13} />}
            />
            <DetailRow label="Notes" value={selected.notes || "-"} />
            <DetailRow label="Submitted" value={formatDate(selected.submittedAt)} />

            {selected.status !== "Approved" && (
              <button
                onClick={() => handleApprove(selected.id)}
                style={{
                  marginTop: 18,
                  width: "100%",
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
                Approve Application
              </button>
            )}
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
  const isApproved = status === "Approved";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 12px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background: isApproved ? "#DCFCE7" : "#FEF3C7",
        color: isApproved ? "#15803d" : "#d97706",
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