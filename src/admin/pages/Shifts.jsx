// src/admin/pages/Shifts.jsx
import { useEffect, useState, useMemo } from "react";
import { db } from "../../firebase/firebase";
import { collection, getDocs, doc, deleteDoc } from "firebase/firestore";
import { Clock, Search, User, Trash2 } from "lucide-react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

function formatDateTime(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(ms) {
  if (!ms || ms <= 0) return "—";
  const totalMinutes = Math.round(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export default function Shifts() {
  const [shifts, setShifts] = useState([]);
  const [teachersMap, setTeachersMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deletingGroupId, setDeletingGroupId] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null); // { type: "one"|"group", record?, group? }

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      const teachersSnap = await getDocs(collection(db, "teachers"));
      const tMap = {};
      teachersSnap.docs.forEach((d) => {
        tMap[d.id] = { id: d.id, ...d.data() };
      });
      setTeachersMap(tMap);

      const shiftsSnap = await getDocs(collection(db, "shifts"));
      const shiftsList = shiftsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Newest first, using clockInAt (fallback to createdAt)
      shiftsList.sort((a, b) => {
        const aTime = a.clockInAt?.seconds || a.createdAt?.seconds || 0;
        const bTime = b.clockInAt?.seconds || b.createdAt?.seconds || 0;
        return bTime - aTime;
      });

      setShifts(shiftsList);
    } catch (err) {
      console.error("Khalad ayaa dhacay markii shifts-ka la soo qaadanayay:", err);
    } finally {
      setLoading(false);
    }
  }

  // Enrich each shift record with the teacher's name + photo, pulling from
  // the teacher doc first (source of truth for photo/name) and falling
  // back to whatever the shift doc itself stored (teacherName) if the
  // teacher doc is missing/deleted.
  const enrichedShifts = useMemo(() => {
    return shifts.map((s) => {
      const teacher = teachersMap[s.teacherId];
      return {
        ...s,
        resolvedName: teacher?.fullName || s.teacherName || "Macalin aan la aqoon",
        resolvedPhoto: teacher?.photoUrl || teacher?.teacherPhoto || "",
        resolvedUsername: teacher?.username || s.teacherId || "—",
      };
    });
  }, [shifts, teachersMap]);

  const filteredShifts = useMemo(() => {
    let list = enrichedShifts;
    if (selectedTeacherId) {
      list = list.filter((s) => s.teacherId === selectedTeacherId);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (s) =>
          s.resolvedName.toLowerCase().includes(q) ||
          s.resolvedUsername.toLowerCase().includes(q)
      );
    }
    return list;
  }, [enrichedShifts, search, selectedTeacherId]);

  // Group shifts by teacher, so each teacher gets their own history section.
  const shiftsByTeacher = useMemo(() => {
    const groups = {};
    filteredShifts.forEach((s) => {
      const key = s.teacherId || "unknown";
      if (!groups[key]) {
        groups[key] = {
          teacherId: key,
          name: s.resolvedName,
          photo: s.resolvedPhoto,
          username: s.resolvedUsername,
          records: [],
        };
      }
      groups[key].records.push(s);
    });
    return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredShifts]);

  const teacherOptions = useMemo(
    () =>
      Object.values(teachersMap).sort((a, b) =>
        (a.fullName || "").localeCompare(b.fullName || "")
      ),
    [teachersMap]
  );

  function askDeleteOne(record) {
    setConfirmTarget({ type: "one", record });
  }

  function askDeleteGroup(group) {
    if (group.records.length === 0) return;
    setConfirmTarget({ type: "group", group });
  }

  async function confirmDelete() {
    if (!confirmTarget) return;

    if (confirmTarget.type === "one") {
      const record = confirmTarget.record;
      try {
        setDeletingId(record.id);
        await deleteDoc(doc(db, "shifts", record.id));
        setShifts((prev) => prev.filter((s) => s.id !== record.id));
        setConfirmTarget(null);
      } catch (err) {
        console.error("Khalad ayaa dhacay markii shift-ka la tirtirayay:", err);
        alert("Khalad ayaa dhacay: " + err.message);
      } finally {
        setDeletingId(null);
      }
    } else {
      const group = confirmTarget.group;
      try {
        setDeletingGroupId(group.teacherId);
        const idsToDelete = group.records.map((r) => r.id);
        await Promise.all(idsToDelete.map((id) => deleteDoc(doc(db, "shifts", id))));
        setShifts((prev) => prev.filter((s) => !idsToDelete.includes(s.id)));
        setConfirmTarget(null);
      } catch (err) {
        console.error("Khalad ayaa dhacay markii shifts-ka la tirtirayay:", err);
        alert("Khalad ayaa dhacay: " + err.message);
      } finally {
        setDeletingGroupId(null);
      }
    }
  }

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        width: "100%",
        background: "#F3F4F8",
        fontFamily: "'Inter','Segoe UI',sans-serif",
      }}
    >
      <Sidebar />

      <div style={{ flex: 1, minWidth: 0, width: "100%" }}>
        <div style={{ padding: "22px 26px 0" }}>
          <Topbar />
        </div>

        <div style={{ padding: "26px 30px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 14,
              marginBottom: 22,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: "#E6F5EC",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Clock size={22} color="#16a34a" />
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#111827" }}>
                  Teacher Shifts
                </h1>
                <p style={{ margin: "2px 0 0", fontSize: 13, color: "#6B7280" }}>
                  Dhammaan wakhtiga macalimiintu ay clock-in/clock-out sameeyeen
                </p>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "#fff",
                border: "1px solid rgba(17,24,39,0.08)",
                borderRadius: 12,
                padding: "10px 14px",
                minWidth: 260,
              }}
            >
              <Search size={16} color="#9CA3AF" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Raadi macalin (magac ama username)..."
                style={{
                  border: "none",
                  outline: "none",
                  flex: 1,
                  fontSize: 13.5,
                  background: "transparent",
                }}
              />
            </div>
          </div>

          {/* Teacher filter pills */}
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 22,
            }}
          >
            <button
              onClick={() => setSelectedTeacherId(null)}
              style={{
                padding: "8px 16px",
                borderRadius: 999,
                border: selectedTeacherId === null ? "none" : "1px solid rgba(17,24,39,0.1)",
                background: selectedTeacherId === null ? "#16a34a" : "#fff",
                color: selectedTeacherId === null ? "#fff" : "#374151",
                fontWeight: 700,
                fontSize: 12.5,
                cursor: "pointer",
              }}
            >
              Dhammaan Macalimiinta
            </button>
            {teacherOptions.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTeacherId(t.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 14px 6px 6px",
                  borderRadius: 999,
                  border: selectedTeacherId === t.id ? "none" : "1px solid rgba(17,24,39,0.1)",
                  background: selectedTeacherId === t.id ? "#16a34a" : "#fff",
                  color: selectedTeacherId === t.id ? "#fff" : "#374151",
                  fontWeight: 600,
                  fontSize: 12.5,
                  cursor: "pointer",
                }}
              >
                {t.photoUrl || t.teacherPhoto ? (
                  <img
                    src={t.photoUrl || t.teacherPhoto}
                    alt=""
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: selectedTeacherId === t.id ? "rgba(255,255,255,0.25)" : "#E6F5EC",
                      color: selectedTeacherId === t.id ? "#fff" : "#16a34a",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    {(t.fullName || "?").charAt(0).toUpperCase()}
                  </span>
                )}
                {t.fullName || t.id}
              </button>
            ))}
          </div>

          {loading ? (
            <p style={{ color: "#9CA3AF", fontSize: 14 }}>Loading shifts...</p>
          ) : shiftsByTeacher.length === 0 ? (
            <div
              style={{
                background: "#fff",
                borderRadius: 18,
                padding: 40,
                textAlign: "center",
                color: "#9CA3AF",
                border: "1px solid rgba(17,24,39,0.05)",
              }}
            >
              Shift lama helin.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              {shiftsByTeacher.map((group) => (
                <div
                  key={group.teacherId}
                  style={{
                    background: "#fff",
                    borderRadius: 18,
                    padding: "20px 22px",
                    boxShadow: "0 4px 18px rgba(17,24,39,0.06)",
                    border: "1px solid rgba(17,24,39,0.05)",
                    overflowX: "auto",
                  }}
                >
                  {/* Teacher header */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 14,
                      marginBottom: 16,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      {group.photo ? (
                        <img
                          src={group.photo}
                          alt={group.name}
                          style={{
                            width: 52,
                            height: 52,
                            borderRadius: "50%",
                            objectFit: "cover",
                            border: "2px solid #16a34a",
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 52,
                            height: 52,
                            borderRadius: "50%",
                            background: "#E6F5EC",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <User size={24} color="#16a34a" />
                        </div>
                      )}
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 15.5, color: "#111827" }}>
                          {group.name}
                        </div>
                        <div style={{ fontSize: 12.5, color: "#9CA3AF" }}>
                          @{group.username} &nbsp;•&nbsp; {group.records.length} shift
                          {group.records.length !== 1 ? "s" : ""}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => askDeleteGroup(group)}
                      disabled={deletingGroupId === group.teacherId}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        border: "1px solid #FCA5A5",
                        background: "#FEF2F2",
                        color: "#DC2626",
                        fontWeight: 700,
                        fontSize: 12.5,
                        padding: "8px 14px",
                        borderRadius: 10,
                        cursor: deletingGroupId === group.teacherId ? "not-allowed" : "pointer",
                        opacity: deletingGroupId === group.teacherId ? 0.7 : 1,
                        whiteSpace: "nowrap",
                      }}
                    >
                      <Trash2 size={14} />
                      {deletingGroupId === group.teacherId
                        ? "Tirtiraya..."
                        : "Tirtir Taariikhda"}
                    </button>
                  </div>

                  {/* History table for this teacher */}
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 560 }}>
                    <thead>
                      <tr style={{ color: "#9CA3AF", textAlign: "left" }}>
                        <th style={{ fontWeight: 600, paddingBottom: 8 }}>Clock In</th>
                        <th style={{ fontWeight: 600, paddingBottom: 8 }}>Clock Out</th>
                        <th style={{ fontWeight: 600, paddingBottom: 8 }}>Duration</th>
                        <th style={{ fontWeight: 600, paddingBottom: 8 }}>Status</th>
                        <th style={{ fontWeight: 600, paddingBottom: 8 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.records.map((r) => (
                        <tr key={r.id} style={{ borderTop: "1px solid #94b2f0" }}>
                          <td style={{ padding: "10px 0", color: "#111827", fontWeight: 600 }}>
                            {formatDateTime(r.clockInAt)}
                          </td>
                          <td style={{ color: "#6B7280" }}>
                            {r.clockOutAt ? formatDateTime(r.clockOutAt) : "—"}
                          </td>
                          <td style={{ color: "#6B7280" }}>{formatDuration(r.durationMs)}</td>
                          <td>
                            <span
                              style={{
                                background:
                                  r.status === "closed" ? "#DCFCE7" : "#FEF3C7",
                                color: r.status === "closed" ? "#16A34A" : "#B45309",
                                fontSize: 11.5,
                                fontWeight: 700,
                                padding: "3px 10px",
                                borderRadius: 20,
                                textTransform: "capitalize",
                              }}
                            >
                              {r.status || "open"}
                            </span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <button
                              onClick={() => askDeleteOne(r)}
                              disabled={deletingId === r.id}
                              style={{
                                border: "none",
                                background: "#FEF2F2",
                                color: "#DC2626",
                                fontWeight: 700,
                                fontSize: 12,
                                padding: "6px 10px",
                                borderRadius: 8,
                                cursor: deletingId === r.id ? "not-allowed" : "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {confirmTarget && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 3000,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 24,
              width: 360,
              maxWidth: "90%",
              fontFamily: "'Inter','Segoe UI',sans-serif",
            }}
          >
            <h3 style={{ margin: 0, fontSize: 16, color: "#111827" }}>Xaqiiji Tirtiridda</h3>
            <p style={{ fontSize: 13.5, color: "#6B7280", marginTop: 10, lineHeight: 1.6 }}>
              {confirmTarget.type === "one" ? (
                <>
                  Ma hubtaa inaad tirtirto shift-kan ee{" "}
                  <strong style={{ color: "#111827" }}>
                    {formatDateTime(confirmTarget.record.clockInAt)}
                  </strong>
                  ? Tallaabadan lama soo celin karo.
                </>
              ) : (
                <>
                  Ma hubtaa inaad tirtirto dhammaan{" "}
                  <strong style={{ color: "#111827" }}>
                    {confirmTarget.group.records.length}
                  </strong>{" "}
                  shift ee{" "}
                  <strong style={{ color: "#111827" }}>{confirmTarget.group.name}</strong>?
                  Tallaabadan lama soo celin karo.
                </>
              )}
            </p>

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button
                onClick={() => setConfirmTarget(null)}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 10,
                  border: "1px solid #E5E7EB",
                  background: "#fff",
                  color: "#374151",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Jooji
              </button>
              <button
                onClick={confirmDelete}
                disabled={deletingId !== null || deletingGroupId !== null}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 10,
                  border: "none",
                  background: "#DC2626",
                  color: "#fff",
                  fontWeight: 700,
                  cursor:
                    deletingId !== null || deletingGroupId !== null
                      ? "not-allowed"
                      : "pointer",
                  opacity: deletingId !== null || deletingGroupId !== null ? 0.7 : 1,
                }}
              >
                {deletingId || deletingGroupId ? "Tirtiraya..." : "Haa, Tirtir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}