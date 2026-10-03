// src/shared/RecycleBinPanel.jsx
//
// Recycle Bin — Cashier (/cashier/recycle-bin) iyo Admin (/admin/recycle-bin)
// labaduba isla bogan ayay isticmaalaan. Waxaa ku jira wax kasta oo la
// tirtiray ama la reset-gareeyay (rasiidyo, lacagaha bilaha, credit), cidda
// samaysay iyo goorta. "Soo Celi" (Restore) wuxuu dib ugu celiyaa meelihii
// ay ku jireen — Cashier iyo Admin labadaba.

import { useEffect, useMemo, useState } from "react";
import {
  currentActor,
  listRecycleGroups,
  listRecycleItems,
  restoreRecycleGroup,
} from "../utils/recycleBin.js";

const TYPE_INFO = {
  systemReset: { label: "Reset — System", color: "#DC2626", bg: "#FEE2E2" },
  classReset: { label: "Reset — Fasal", color: "#D97706", bg: "#FEF3C7" },
  receiptDelete: { label: "Rasiid la tirtiray", color: "#2563EB", bg: "#DBEAFE" },
};

function toDate(v) {
  if (!v) return null;
  if (typeof v.toDate === "function") return v.toDate();
  if (v.seconds !== undefined) return new Date(v.seconds * 1000);
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function fmtDateTime(v) {
  const d = toDate(v);
  if (!d) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const roleLabel = (r) => (r === "admin" ? "Admin" : "Cashier");

export default function RecycleBinPanel({ actorRole = "cashier" }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("deleted");
  const [openId, setOpenId] = useState(null);
  const [items, setItems] = useState({});
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      setGroups(await listRecycleGroups());
    } catch (err) {
      console.error(err);
      alert("Recycle Bin lama soo akhrin karin: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function toggle(group) {
    if (openId === group.id) {
      setOpenId(null);
      return;
    }
    setOpenId(group.id);
    if (!items[group.id]) {
      try {
        const list = await listRecycleItems(group.id);
        setItems((prev) => ({ ...prev, [group.id]: list }));
      } catch (err) {
        console.error(err);
      }
    }
  }

  async function restore(group) {
    const ok = window.confirm(
      `Ma soo celinaysaa "${group.label}"?\n\n` +
        "Rasiidyada iyo lacagaha waxay dib ugu soo laabanayaan Cashier-ka iyo Admin-ka."
    );
    if (!ok) return;
    try {
      setBusyId(group.id);
      const res = await restoreRecycleGroup(group.id, currentActor(actorRole));
      alert(
        `Waa la soo celiyay: ${res.restored} xog.` +
          (res.skipped > 0
            ? `\n${res.skipped} waa laga booday — lacag cusub ayaa la geliyay kadib tirtiridda (xogta cusub lama burburin).`
            : "")
      );
      await load();
    } catch (err) {
      console.error(err);
      alert("Soo celintu way fashilantay: " + err.message);
    } finally {
      setBusyId(null);
    }
  }

  const visible = useMemo(() => {
    if (filter === "all") return groups;
    return groups.filter((g) => (g.status || "deleted") === filter);
  }, [groups, filter]);

  const deletedTotal = useMemo(
    () =>
      groups
        .filter((g) => (g.status || "deleted") === "deleted")
        .reduce((sum, g) => sum + (Number(g.totalAmount) || 0), 0),
    [groups]
  );

  return (
    <div style={st.wrap}>
      <div style={st.header}>
        <div>
          <h1 style={st.title}>🗑️ Recycle Bin</h1>
          <p style={st.sub}>
            Wax kasta oo la tirtiray ama la reset-gareeyay halkan ayay ku jiraan (backend-ka
            way ku kaydsan yihiin). Riix <strong>Soo Celi</strong> si aad dib ugu soo celiso.
          </p>
        </div>
        <div style={st.stat}>
          <span style={st.statLabel}>Lacagta Recycle Bin-ka</span>
          <span style={st.statValue}>${deletedTotal.toLocaleString()}</span>
        </div>
      </div>

      <div style={st.tabs}>
        {[
          ["deleted", "La tirtiray"],
          ["restored", "La soo celiyay"],
          ["all", "Dhammaan"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            style={{ ...st.tab, ...(filter === key ? st.tabActive : {}) }}
          >
            {label}
          </button>
        ))}
        <button type="button" onClick={load} style={{ ...st.tab, marginLeft: "auto" }}>
          ↻ Cusbooneysii
        </button>
      </div>

      {loading ? (
        <div style={st.empty}>Loading...</div>
      ) : visible.length === 0 ? (
        <div style={st.empty}>Recycle Bin-ku waa madhan yahay.</div>
      ) : (
        <div style={st.list}>
          {visible.map((g) => {
            const info = TYPE_INFO[g.type] || { label: g.type, color: "#374151", bg: "#F3F4F6" };
            const restored = g.status === "restored";
            const groupItems = items[g.id] || [];
            const receipts = groupItems
              .filter((it) => it.col === "receipts")
              .map((it) => it.data || {})
              .sort((a, b) => String(a.receiptNo || "").localeCompare(String(b.receiptNo || "")));

            return (
              <div key={g.id} style={st.card}>
                <div style={st.cardRow}>
                  <span style={{ ...st.badge, color: info.color, background: info.bg }}>
                    {info.label}
                  </span>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={st.cardTitle}>{g.label}</div>
                    <div style={st.cardMeta}>
                      {fmtDateTime(g.deletedAt)} · waxaa sameeyay{" "}
                      <strong>
                        {roleLabel(g.deletedBy?.role)} ({g.deletedBy?.name || "—"})
                      </strong>
                    </div>
                    {restored && (
                      <div style={{ ...st.cardMeta, color: "#16A34A" }}>
                        ✓ La soo celiyay {fmtDateTime(g.restoredAt)} —{" "}
                        {roleLabel(g.restoredBy?.role)} ({g.restoredBy?.name || "—"})
                      </div>
                    )}
                  </div>
                  <div style={st.amountBox}>
                    <div style={st.amount}>${Number(g.totalAmount || 0).toLocaleString()}</div>
                    <div style={st.cardMeta}>{g.receiptCount || 0} rasiid</div>
                  </div>
                  <div style={st.actions}>
                    <button type="button" onClick={() => toggle(g)} style={st.btnGhost}>
                      {openId === g.id ? "Qari" : "Eeg"}
                    </button>
                    {!restored && (
                      <button
                        type="button"
                        onClick={() => restore(g)}
                        disabled={busyId === g.id}
                        style={{ ...st.btnRestore, opacity: busyId === g.id ? 0.6 : 1 }}
                      >
                        {busyId === g.id ? "Soo celinaya..." : "↩ Soo Celi"}
                      </button>
                    )}
                  </div>
                </div>

                {openId === g.id && (
                  <div style={st.detail}>
                    {receipts.length === 0 ? (
                      <div style={st.cardMeta}>
                        Rasiid ma ku jiro — {groupItems.length} xog kale (lacagaha bilaha / credit).
                      </div>
                    ) : (
                      <div style={{ overflowX: "auto" }}>
                        <table style={st.table}>
                          <thead>
                            <tr>
                              <th style={st.th}>N°</th>
                              <th style={st.th}>ID</th>
                              <th style={st.th}>Ardayga</th>
                              <th style={st.th}>Fasalka</th>
                              <th style={st.th}>Bisha</th>
                              <th style={st.th}>Lacagta</th>
                              <th style={st.th}>Taariikhda</th>
                            </tr>
                          </thead>
                          <tbody>
                            {receipts.map((r, i) => (
                              <tr key={i}>
                                <td style={st.td}>{r.receiptNo || "—"}</td>
                                <td style={st.td}>{r.studentId || "—"}</td>
                                <td style={{ ...st.td, fontWeight: 600 }}>{r.studentName || "—"}</td>
                                <td style={st.td}>{r.className || "—"}</td>
                                <td style={st.td}>{r.monthLabel || "—"}</td>
                                <td style={{ ...st.td, fontWeight: 700 }}>
                                  ${Number(r.paidAmount || 0).toLocaleString()}
                                </td>
                                <td style={st.td}>{fmtDateTime(r.createdAt || r.paidAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const st = {
  wrap: { fontFamily: "'Inter','Segoe UI',sans-serif", color: "#111827" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 18,
  },
  title: { margin: 0, fontSize: 26, fontWeight: 800, color: "#111827" },
  sub: { margin: "6px 0 0", fontSize: 14, color: "#6B7280", maxWidth: 620, lineHeight: 1.5 },
  stat: {
    background: "#FFFFFF",
    borderRadius: 14,
    padding: "12px 18px",
    border: "1px solid #E5E7EB",
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  statLabel: { fontSize: 12, color: "#6B7280" },
  statValue: { fontSize: 20, fontWeight: 800, color: "#DC2626" },
  tabs: { display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  tab: {
    padding: "8px 14px",
    borderRadius: 999,
    border: "1px solid #E5E7EB",
    background: "#FFFFFF",
    color: "#374151",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
  },
  tabActive: { background: "#111827", color: "#FFFFFF", borderColor: "#111827" },
  empty: {
    background: "#FFFFFF",
    borderRadius: 14,
    padding: 40,
    textAlign: "center",
    color: "#6B7280",
    border: "1px solid #E5E7EB",
  },
  list: { display: "flex", flexDirection: "column", gap: 12 },
  card: {
    background: "#FFFFFF",
    borderRadius: 14,
    border: "1px solid #E5E7EB",
    padding: "14px 16px",
    boxShadow: "0 2px 10px rgba(17,24,39,0.04)",
  },
  cardRow: { display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" },
  badge: {
    fontSize: 12,
    fontWeight: 800,
    padding: "5px 10px",
    borderRadius: 999,
    whiteSpace: "nowrap",
  },
  cardTitle: { fontSize: 15, fontWeight: 700, color: "#111827" },
  cardMeta: { fontSize: 12.5, color: "#6B7280", marginTop: 3 },
  amountBox: { textAlign: "right", minWidth: 90 },
  amount: { fontSize: 18, fontWeight: 800, color: "#111827" },
  actions: { display: "flex", gap: 8 },
  btnGhost: {
    padding: "8px 14px",
    borderRadius: 10,
    border: "1px solid #E5E7EB",
    background: "#FFFFFF",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
    color: "#374151",
  },
  btnRestore: {
    padding: "8px 14px",
    borderRadius: 10,
    border: "none",
    background: "#16A34A",
    color: "#FFFFFF",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  },
  detail: { marginTop: 12, borderTop: "1px dashed #E5E7EB", paddingTop: 12 },
  table: { width: "100%", borderCollapse: "collapse", minWidth: 640 },
  th: {
    textAlign: "left",
    fontSize: 12,
    color: "#6B7280",
    fontWeight: 700,
    padding: "6px 8px",
    borderBottom: "1px solid #E5E7EB",
  },
  td: { fontSize: 13, padding: "7px 8px", borderBottom: "1px solid #F3F4F6", color: "#111827" },
};