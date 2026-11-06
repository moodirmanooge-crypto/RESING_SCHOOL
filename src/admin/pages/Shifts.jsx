// src/admin/pages/Shifts.jsx
//
// Imaanshaha macalimiinta (Teacher Shifts / Attendance):
//   - Waqtiga imaanshaha 7:00 – 7:30 subaxnimo; wixii ka dambeeya = "Daahay"
//   - Maanta: imisa yimid, imisa daahay, yaa aan iman
//   - Shaandheyn: taariikh, macalin, xaalad
//   - Soo deji: Excel (CSV) iyo PDF — warbixin loo gudbin karo kormeerka / dowladda

import { useEffect, useState, useMemo } from "react";
import { db } from "../../firebase/firebase";
import { collection, getDocs, doc, deleteDoc } from "firebase/firestore";
import jsPDF from "jspdf";
import {
  Clock,
  Search,
  User,
  Trash2,
  Download,
  FileText,
  CheckCircle2,
  AlertTriangle,
  UserX,
  Users,
  RefreshCcw,
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { isRemoved } from "../../utils/activeRecords";
import {
  ARRIVAL_START,
  LATE_AFTER,
  shiftLateInfo,
  shiftDateKey,
  todayKey,
  toDateSafe,
  formatTime,
  formatDate,
  formatDuration,
  formatLate,
} from "../../utils/shiftRules";

function monthStartKey() {
  const t = todayKey();
  return `${t.slice(0, 8)}01`;
}

export default function Shifts() {
  const [shifts, setShifts] = useState([]);
  const [teachersMap, setTeachersMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | ontime | late | open
  const [fromDate, setFromDate] = useState(monthStartKey());
  const [toDate, setToDate] = useState(todayKey());
  const [deletingId, setDeletingId] = useState(null);
  const [deletingGroupId, setDeletingGroupId] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [teachersSnap, shiftsSnap] = await Promise.all([
        getDocs(collection(db, "teachers")),
        getDocs(collection(db, "shifts")),
      ]);
      const tMap = {};
      teachersSnap.docs.forEach((d) => {
        tMap[d.id] = { id: d.id, ...d.data() };
      });
      setTeachersMap(tMap);

      const list = shiftsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort(
        (a, b) =>
          (toDateSafe(b.clockInAt)?.getTime() || toDateSafe(b.createdAt)?.getTime() || 0) -
          (toDateSafe(a.clockInAt)?.getTime() || toDateSafe(a.createdAt)?.getTime() || 0)
      );
      setShifts(list);
    } catch (err) {
      console.error("Khalad ayaa dhacay markii shifts-ka la soo qaadanayay:", err);
    } finally {
      setLoading(false);
    }
  }

  const activeTeachers = useMemo(
    () =>
      Object.values(teachersMap)
        .filter((t) => !isRemoved(t))
        .sort((a, b) => (a.fullName || "").localeCompare(b.fullName || "")),
    [teachersMap]
  );

  const enriched = useMemo(
    () =>
      shifts.map((s) => {
        const teacher = teachersMap[s.teacherId];
        const { late, lateMinutes } = shiftLateInfo(s);
        return {
          ...s,
          late,
          lateMinutes,
          dateKey: shiftDateKey(s),
          resolvedName: teacher?.fullName || s.teacherName || "Macalin aan la aqoon",
          resolvedPhoto: teacher?.photoUrl || teacher?.teacherPhoto || "",
          resolvedUsername: teacher?.username || s.teacherId || "—",
        };
      }),
    [shifts, teachersMap]
  );

  // ---- Maanta ----
  const today = todayKey();
  const todayShifts = enriched.filter((s) => s.dateKey === today);
  const todayLate = todayShifts.filter((s) => s.late);
  const arrivedIds = new Set(todayShifts.map((s) => s.teacherId));
  const notArrived = activeTeachers.filter((t) => !arrivedIds.has(t.id));

  // ---- Shaandheynta ----
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((s) => {
      if (fromDate && s.dateKey && s.dateKey < fromDate) return false;
      if (toDate && s.dateKey && s.dateKey > toDate) return false;
      if (selectedTeacherId && s.teacherId !== selectedTeacherId) return false;
      if (statusFilter === "late" && !s.late) return false;
      if (statusFilter === "ontime" && s.late) return false;
      if (statusFilter === "open" && s.status !== "open") return false;
      if (q && !`${s.resolvedName} ${s.resolvedUsername}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [enriched, search, selectedTeacherId, statusFilter, fromDate, toDate]);

  const totals = {
    all: filtered.length,
    late: filtered.filter((s) => s.late).length,
    ontime: filtered.filter((s) => !s.late).length,
    open: filtered.filter((s) => s.status === "open").length,
  };

  const groups = useMemo(() => {
    const g = {};
    filtered.forEach((s) => {
      const key = s.teacherId || "unknown";
      if (!g[key]) {
        g[key] = { teacherId: key, name: s.resolvedName, photo: s.resolvedPhoto, username: s.resolvedUsername, records: [] };
      }
      g[key].records.push(s);
    });
    return Object.values(g).sort((a, b) => a.name.localeCompare(b.name));
  }, [filtered]);

  // ---- Soo deji ----
  const periodLabel = `${fromDate || "—"} — ${toDate || "—"}`;

  function rowsForExport() {
    return [...filtered]
      .sort((a, b) => (a.dateKey || "").localeCompare(b.dateKey || "") || a.resolvedName.localeCompare(b.resolvedName))
      .map((s, i) => ({
        no: i + 1,
        name: s.resolvedName,
        date: formatDate(s.clockInAt),
        inTime: formatTime(s.clockInAt),
        outTime: s.clockOutAt ? formatTime(s.clockOutAt) : "—",
        duration: s.status === "open" ? "Weli furan" : formatDuration(s.durationMs),
        status: s.late ? `Daahay (${formatLate(s.lateMinutes)})` : "Waqtigeeda",
      }));
  }

  function downloadCsv() {
    const rows = rowsForExport();
    const head = ["#", "Macalinka", "Taariikh", "Waqtiga uu yimid", "Waqtiga uu tagay", "Muddo", "Xaalad"];
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [
      [esc("Rising Star School — Imaanshaha Macalimiinta")],
      [esc(`Muddada: ${periodLabel}`)],
      [esc(`Waqtiga imaanshaha: ${ARRIVAL_START} – ${LATE_AFTER}`)],
      [],
      head.map(esc),
      ...rows.map((r) => [r.no, r.name, r.date, r.inTime, r.outTime, r.duration, r.status].map(esc)),
      [],
      [esc(`Wadar: ${totals.all}`), esc(`Waqtigeeda: ${totals.ontime}`), esc(`Daahay: ${totals.late}`)],
    ].map((r) => r.join(","));
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Imaanshaha-Macalimiinta_${fromDate}_${toDate}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  function downloadPdf() {
    const rows = rowsForExport();
    const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const W = pdf.internal.pageSize.getWidth();
    const H = pdf.internal.pageSize.getHeight();
    const cols = [
      { k: "no", t: "#", w: 30 },
      { k: "name", t: "Macalinka", w: 210 },
      { k: "date", t: "Taariikh", w: 100 },
      { k: "inTime", t: "Yimid", w: 80 },
      { k: "outTime", t: "Tagay", w: 80 },
      { k: "duration", t: "Muddo", w: 90 },
      { k: "status", t: "Xaalad", w: 170 },
    ];
    const tableW = cols.reduce((s, c) => s + c.w, 0);
    const x0 = (W - tableW) / 2;

    const header = (first) => {
      pdf.setFillColor(15, 92, 46);
      pdf.rect(0, 0, W, first ? 78 : 40, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont(undefined, "bold");
      pdf.setFontSize(first ? 18 : 12);
      pdf.text("RISING STAR SCHOOL — Imaanshaha Macalimiinta", x0, first ? 32 : 25);
      if (first) {
        pdf.setFont(undefined, "normal");
        pdf.setFontSize(10.5);
        pdf.text(
          `Muddada: ${periodLabel}   |   Waqtiga imaanshaha: ${ARRIVAL_START} – ${LATE_AFTER}   |   Wadar: ${totals.all}   Waqtigeeda: ${totals.ontime}   Daahay: ${totals.late}`,
          x0,
          56
        );
      }
      return first ? 100 : 60;
    };

    let y = header(true);
    const drawHead = () => {
      pdf.setFillColor(29, 79, 168);
      pdf.rect(x0, y - 14, tableW, 22, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont(undefined, "bold");
      pdf.setFontSize(10.5);
      let x = x0;
      cols.forEach((c) => {
        pdf.text(c.t, x + 6, y + 1);
        x += c.w;
      });
      y += 22;
    };
    drawHead();

    pdf.setFontSize(10);
    rows.forEach((r, i) => {
      if (y > H - 40) {
        pdf.addPage();
        y = header(false);
        drawHead();
        pdf.setFontSize(10);
      }
      if (i % 2 === 1) {
        pdf.setFillColor(243, 247, 252);
        pdf.rect(x0, y - 13, tableW, 20, "F");
      }
      let x = x0;
      cols.forEach((c) => {
        const late = c.k === "status" && r.status.startsWith("Daahay");
        pdf.setFont(undefined, c.k === "name" || late ? "bold" : "normal");
        pdf.setTextColor(late ? 200 : 20, late ? 30 : 30, late ? 30 : 40);
        if (c.k === "status" && !late) pdf.setTextColor(22, 130, 60);
        const text = pdf.splitTextToSize(String(r[c.k]), c.w - 10)[0] || "";
        pdf.text(text, x + 6, y + 1);
        x += c.w;
      });
      y += 20;
    });

    if (rows.length === 0) {
      pdf.setTextColor(120, 120, 130);
      pdf.text("Muddadan wax shift ah lama helin.", x0 + 6, y + 6);
    }

    const pages = pdf.getNumberOfPages();
    for (let p = 1; p <= pages; p += 1) {
      pdf.setPage(p);
      pdf.setFontSize(9);
      pdf.setTextColor(140, 140, 150);
      pdf.text(`La soo saaray: ${new Date().toLocaleString("en-GB")}   ·   Bogga ${p} / ${pages}`, x0, H - 18);
    }
    pdf.save(`Imaanshaha-Macalimiinta_${fromDate}_${toDate}.pdf`);
  }

  // ---- Tirtir ----
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
        alert("Khalad ayaa dhacay: " + err.message);
      } finally {
        setDeletingId(null);
      }
    } else {
      const group = confirmTarget.group;
      try {
        setDeletingGroupId(group.teacherId);
        const ids = group.records.map((r) => r.id);
        await Promise.all(ids.map((id) => deleteDoc(doc(db, "shifts", id))));
        setShifts((prev) => prev.filter((s) => !ids.includes(s.id)));
        setConfirmTarget(null);
      } catch (err) {
        alert("Khalad ayaa dhacay: " + err.message);
      } finally {
        setDeletingGroupId(null);
      }
    }
  }

  const card = {
    background: "#fff",
    borderRadius: 16,
    border: "1px solid rgba(17,24,39,0.06)",
    boxShadow: "0 4px 18px rgba(17,24,39,0.05)",
  };
  const input = {
    border: "1px solid rgba(17,24,39,0.12)",
    borderRadius: 10,
    padding: "9px 12px",
    fontSize: 13,
    background: "#fff",
    color: "#111827",
    fontFamily: "inherit",
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", width: "100%", background: "#F3F4F8", fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      <Sidebar />

      <div style={{ flex: 1, minWidth: 0, width: "100%" }}>
        <div style={{ padding: "22px 26px 0" }}>
          <Topbar />
        </div>

        <div style={{ padding: "26px 30px" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14, marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 46, height: 46, borderRadius: 12, background: "#E6F5EC", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Clock size={22} color="#16a34a" />
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: 21, fontWeight: 800, color: "#111827" }}>Imaanshaha Macalimiinta (Shifts)</h1>
                <p style={{ margin: "2px 0 0", fontSize: 13, color: "#6B7280" }}>
                  Waqtiga imaanshaha: <b>7:00 – 7:30 subaxnimo</b>. Wixii ka dambeeya waxaa loo qorayaa “Daahay”.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={loadData} style={{ ...btn, background: "#fff", color: "#16a34a", border: "1px solid rgba(22,163,74,0.3)" }}>
                <RefreshCcw size={15} /> Refresh
              </button>
              <button onClick={downloadCsv} disabled={loading} style={{ ...btn, background: "#16a34a", color: "#fff" }}>
                <Download size={15} /> Excel (CSV)
              </button>
              <button onClick={downloadPdf} disabled={loading} style={{ ...btn, background: "#1d4fa8", color: "#fff" }}>
                <FileText size={15} /> PDF
              </button>
            </div>
          </div>

          {/* Maanta */}
          <div style={{ ...card, padding: 18, marginBottom: 18 }}>
            <div style={{ fontWeight: 800, color: "#111827", marginBottom: 12 }}>Maanta — {formatDate(new Date())}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
              <Stat icon={<Users size={20} color="#1d4fa8" />} bg="#EAF1FD" label="Macalimiinta" value={activeTeachers.length} />
              <Stat icon={<CheckCircle2 size={20} color="#16a34a" />} bg="#E6F5EC" label="Waqtigeeda yimid" value={todayShifts.length - todayLate.length} color="#16a34a" />
              <Stat icon={<AlertTriangle size={20} color="#DC2626" />} bg="#FEF2F2" label="Daahay" value={todayLate.length} color="#DC2626" />
              <Stat icon={<UserX size={20} color="#B45309" />} bg="#FEF3C7" label="Weli ma iman" value={notArrived.length} color="#B45309" />
            </div>
            {notArrived.length > 0 && (
              <div style={{ marginTop: 12, fontSize: 12.5, color: "#6B7280" }}>
                <b style={{ color: "#B45309" }}>Weli ma iman:</b>{" "}
                {notArrived.map((t) => (
                  <span key={t.id} style={{ display: "inline-block", margin: "3px 4px", padding: "3px 10px", borderRadius: 999, background: "#FEF3C7", color: "#92400E", fontWeight: 600 }}>
                    {t.fullName || t.id}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Shaandheyn */}
          <div style={{ ...card, padding: 14, marginBottom: 18, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label style={lbl}>
              Laga bilaabo
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={input} />
            </label>
            <label style={lbl}>
              Ilaa
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={input} />
            </label>
            <label style={lbl}>
              Macalinka
              <select value={selectedTeacherId} onChange={(e) => setSelectedTeacherId(e.target.value)} style={{ ...input, minWidth: 180 }}>
                <option value="">Dhammaan macalimiinta</option>
                {activeTeachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName || t.id}
                  </option>
                ))}
              </select>
            </label>
            <label style={lbl}>
              Xaaladda
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={input}>
                <option value="all">Dhammaan</option>
                <option value="ontime">Waqtigeeda</option>
                <option value="late">Daahay</option>
                <option value="open">Weli furan</option>
              </select>
            </label>
            <div style={{ ...input, display: "flex", alignItems: "center", gap: 8, flex: "1 1 200px", padding: "0 12px" }}>
              <Search size={15} color="#9CA3AF" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Raadi macalin..."
                style={{ border: "none", outline: "none", flex: 1, fontSize: 13, background: "transparent", padding: "9px 0" }}
              />
            </div>
            <div style={{ fontSize: 12.5, color: "#6B7280", width: "100%" }}>
              {totals.all} shift · <b style={{ color: "#16a34a" }}>{totals.ontime} waqtigeeda</b> ·{" "}
              <b style={{ color: "#DC2626" }}>{totals.late} daahay</b> · {totals.open} weli furan
            </div>
          </div>

          {loading ? (
            <p style={{ color: "#9CA3AF", fontSize: 14 }}>Loading shifts...</p>
          ) : groups.length === 0 ? (
            <div style={{ ...card, padding: 40, textAlign: "center", color: "#9CA3AF" }}>Muddadan shift lama helin.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {groups.map((group) => {
                const lateN = group.records.filter((r) => r.late).length;
                return (
                  <div key={group.teacherId} style={{ ...card, padding: "18px 20px", overflowX: "auto" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: 14, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        {group.photo ? (
                          <img src={group.photo} alt="" style={{ width: 50, height: 50, borderRadius: "50%", objectFit: "cover", border: "2px solid #16a34a", flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 50, height: 50, borderRadius: "50%", background: "#E6F5EC", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <User size={24} color="#16a34a" />
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 15.5, color: "#111827" }}>{group.name}</div>
                          <div style={{ fontSize: 12.5, color: "#9CA3AF" }}>
                            {group.records.length} shift · <span style={{ color: "#16a34a", fontWeight: 700 }}>{group.records.length - lateN} waqtigeeda</span> ·{" "}
                            <span style={{ color: "#DC2626", fontWeight: 700 }}>{lateN} daahay</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => group.records.length && setConfirmTarget({ type: "group", group })}
                        disabled={deletingGroupId === group.teacherId}
                        style={{ ...btn, border: "1px solid #FCA5A5", background: "#FEF2F2", color: "#DC2626" }}
                      >
                        <Trash2 size={14} /> {deletingGroupId === group.teacherId ? "Tirtiraya..." : "Tirtir Taariikhda"}
                      </button>
                    </div>

                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 680 }}>
                      <thead>
                        <tr style={{ color: "#9CA3AF", textAlign: "left" }}>
                          <th style={th}>Taariikh</th>
                          <th style={th}>Yimid</th>
                          <th style={th}>Tagay</th>
                          <th style={th}>Muddo</th>
                          <th style={th}>Imaanshaha</th>
                          <th style={th}>Shift</th>
                          <th style={th} />
                        </tr>
                      </thead>
                      <tbody>
                        {group.records.map((r) => (
                          <tr key={r.id} style={{ borderTop: "1px solid #E5E7EB" }}>
                            <td style={{ padding: "10px 0", color: "#111827", fontWeight: 600 }}>{formatDate(r.clockInAt)}</td>
                            <td style={{ color: r.late ? "#DC2626" : "#111827", fontWeight: 700 }}>{formatTime(r.clockInAt)}</td>
                            <td style={{ color: "#6B7280" }}>{r.clockOutAt ? formatTime(r.clockOutAt) : "—"}</td>
                            <td style={{ color: "#6B7280" }}>{r.status === "open" ? "—" : formatDuration(r.durationMs)}</td>
                            <td>
                              {r.late ? (
                                <span style={{ ...badge, background: "#FEE2E2", color: "#B91C1C" }}>Daahay · {formatLate(r.lateMinutes)}</span>
                              ) : (
                                <span style={{ ...badge, background: "#DCFCE7", color: "#15803D" }}>Waqtigeeda</span>
                              )}
                            </td>
                            <td>
                              <span style={{ ...badge, background: r.status === "closed" ? "#EEF2FF" : "#FEF3C7", color: r.status === "closed" ? "#4338CA" : "#B45309" }}>
                                {r.status === "closed" ? "Xiran" : "Furan"}
                              </span>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <button
                                onClick={() => setConfirmTarget({ type: "one", record: r })}
                                disabled={deletingId === r.id}
                                style={{ border: "none", background: "#FEF2F2", color: "#DC2626", padding: "6px 10px", borderRadius: 8, cursor: "pointer", display: "inline-flex" }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {confirmTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: 360, maxWidth: "90%" }}>
            <h3 style={{ margin: 0, fontSize: 16, color: "#111827" }}>Xaqiiji Tirtiridda</h3>
            <p style={{ fontSize: 13.5, color: "#6B7280", marginTop: 10, lineHeight: 1.6 }}>
              {confirmTarget.type === "one" ? (
                <>
                  Ma hubtaa inaad tirtirto shift-ka{" "}
                  <strong style={{ color: "#111827" }}>
                    {formatDate(confirmTarget.record.clockInAt)} {formatTime(confirmTarget.record.clockInAt)}
                  </strong>
                  ? Lama soo celin karo.
                </>
              ) : (
                <>
                  Ma hubtaa inaad tirtirto <strong style={{ color: "#111827" }}>{confirmTarget.group.records.length}</strong> shift ee{" "}
                  <strong style={{ color: "#111827" }}>{confirmTarget.group.name}</strong> (muddada la shaandheeyay)? Lama soo celin karo.
                </>
              )}
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => setConfirmTarget(null)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid #E5E7EB", background: "#fff", color: "#374151", fontWeight: 700, cursor: "pointer" }}>
                Jooji
              </button>
              <button
                onClick={confirmDelete}
                disabled={deletingId !== null || deletingGroupId !== null}
                style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: "#DC2626", color: "#fff", fontWeight: 700, cursor: "pointer" }}
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

function Stat({ icon, bg, label, value, color = "#111827" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#F9FAFB", border: "1px solid #EEF0F3", borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      </div>
    </div>
  );
}

const btn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  padding: "9px 14px",
  borderRadius: 10,
  border: "none",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
const lbl = { display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, fontWeight: 700, color: "#6B7280" };
const th = { fontWeight: 600, paddingBottom: 8 };
const badge = { fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap" };