// src/admin/pages/ResultsSubmission.jsx
//
// Maamulka: waqtiga gudbinta natiijada + la socodka macalimiinta.
//   1) Imtixaan kasta (Monthly One / Term / Monthly Two / Final) waxaa loo
//      dhigaa goorta gudbintu bilaabanayso iyo goorta ay dhammaanayso.
//      Macalinku waqtigaas ka hor iyo ka dib ma gudbin karo.
//   2) Liiska macalin kasta + fasal + maado: Gudbiyay / Dhiman.
//   3) Fasax: "U fasax Update" (kii gudbiyay) ama "U fasax gudbin" (kii daahay).
//      Fasaxu hal mar ayuu shaqeeyaa — marka macalinku gudbiyo wuu xirmayaa.

import { useEffect, useMemo, useState } from "react";
import { db } from "../../firebase/firebase";
import { collection, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";
import {
  CalendarClock,
  Save,
  RefreshCcw,
  CheckCircle2,
  XCircle,
  Unlock,
  Search,
  FileText,
  Loader2,
  Clock,
  Undo2,
  Trash2,
  Users,
  ShieldCheck,
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import {
  EXAM_TYPES,
  examTypeKeyOf,
  examTypeLabelOf,
  norm,
  permissionId,
  toDateSafe,
  windowState,
  formatDT,
  toLocalInput,
} from "../../utils/resultsSubmission";

const CLASS_ORDER = ["1", "2", "3", "4", "5", "6", "7", "8", "F1", "F2", "F3", "F4"];
const classRank = (c) => {
  const i = CLASS_ORDER.indexOf(String(c || "").toUpperCase());
  return i === -1 ? 999 : i;
};

const WINDOW_BADGE = {
  unset: { text: "Lama dhigin", bg: "#f3f4f6", color: "#6b7280" },
  upcoming: { text: "Weli ma furmin", bg: "#fef3c7", color: "#b45309" },
  open: { text: "Furan", bg: "#dcfce7", color: "#15803d" },
  closed: { text: "Xiran", bg: "#fee2e2", color: "#b91c1c" },
};

const tsOf = (d) => toDateSafe(d?.lastSubmittedAt || d?.updatedAt)?.getTime() || 0;

export default function ResultsSubmission() {
  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState([]);
  const [windows, setWindows] = useState({});
  const [perms, setPerms] = useState({});
  const [index, setIndex] = useState([]);

  const [drafts, setDrafts] = useState({});
  const [savingKey, setSavingKey] = useState("");
  const [busyRow, setBusyRow] = useState("");

  const [activeType, setActiveType] = useState(EXAM_TYPES[0].key);
  const [classFilter, setClassFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    load();
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  async function load() {
    try {
      setLoading(true);
      const [tSnap, wSnap, pSnap, iSnap] = await Promise.all([
        getDocs(collection(db, "teachers")),
        getDocs(collection(db, "resultsWindow")),
        getDocs(collection(db, "resultsPermissions")),
        getDocs(collection(db, "adminResultsIndex")),
      ]);

      setTeachers(
        tSnap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            fullName: data.fullName || data.username || d.id,
            classes: Array.isArray(data.classes) ? data.classes : [],
          };
        })
      );

      const wMap = {};
      const dMap = {};
      wSnap.docs.forEach((d) => {
        const data = d.data();
        wMap[d.id] = data;
        dMap[d.id] = {
          start: data.startLocal || toLocalInput(data.startAt),
          end: data.endLocal || toLocalInput(data.endAt),
        };
      });
      EXAM_TYPES.forEach((t) => {
        if (!dMap[t.key]) dMap[t.key] = { start: "", end: "" };
      });
      setWindows(wMap);
      setDrafts(dMap);

      const pMap = {};
      pSnap.docs.forEach((d) => {
        pMap[d.id] = { id: d.id, ...d.data() };
      });
      setPerms(pMap);

      setIndex(iSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.log(err);
      alert("Khalad ayaa dhacay marka xogta la soo qaadanayay: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  function setDraft(key, field, value) {
    setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  }

  async function saveWindow(key) {
    const d = drafts[key] || {};
    if (!d.start || !d.end) {
      alert("Fadlan geli goorta bilowga iyo goorta dhammaadka.");
      return;
    }
    if (new Date(d.end) <= new Date(d.start)) {
      alert("Goorta dhammaadku waa inay ka dambaysaa goorta bilowga.");
      return;
    }
    setSavingKey(key);
    try {
      const payload = {
        examTypeKey: key,
        examType: examTypeLabelOf(key),
        startAt: new Date(d.start),
        endAt: new Date(d.end),
        startLocal: d.start,
        endLocal: d.end,
        updatedAt: new Date(),
      };
      await setDoc(doc(db, "resultsWindow", key), payload);
      setWindows((prev) => ({ ...prev, [key]: payload }));
    } catch (err) {
      console.log(err);
      alert(err.message);
    } finally {
      setSavingKey("");
    }
  }

  async function clearWindow(key) {
    if (!window.confirm(`Ma tirtiraysaa waqtiga gudbinta ${examTypeLabelOf(key)}?`)) return;
    setSavingKey(key);
    try {
      await deleteDoc(doc(db, "resultsWindow", key));
      setWindows((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setDrafts((prev) => ({ ...prev, [key]: { start: "", end: "" } }));
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingKey("");
    }
  }

  async function grant(row, reason) {
    setBusyRow(row.key);
    try {
      const payload = {
        allowed: true,
        used: false,
        reason,
        examTypeKey: activeType,
        examType: examTypeLabelOf(activeType),
        teacherId: row.teacherId,
        teacherName: row.teacherName,
        className: row.className,
        subject: row.subject,
        grantedAt: new Date(),
        grantedBy: localStorage.getItem("adminName") || localStorage.getItem("adminEmail") || "admin",
      };
      await setDoc(doc(db, "resultsPermissions", row.pid), payload);
      setPerms((prev) => ({ ...prev, [row.pid]: { id: row.pid, ...payload } }));
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyRow("");
    }
  }

  async function revoke(row) {
    setBusyRow(row.key);
    try {
      await deleteDoc(doc(db, "resultsPermissions", row.pid));
      setPerms((prev) => {
        const next = { ...prev };
        delete next[row.pid];
        return next;
      });
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyRow("");
    }
  }

  const activeWin = windows[activeType];
  const activeWs = windowState(activeWin, now);

  // Macalin kasta + fasal + maado -> gudbiyay mise dhiman
  const rows = useMemo(() => {
    const expected = new Map();
    teachers.forEach((t) =>
      t.classes.forEach((b) => {
        if (!b?.className || !String(b.subject || "").trim()) return;
        const k = `${t.id}|${String(b.className).toUpperCase()}|${norm(b.subject)}`;
        if (!expected.has(k)) {
          expected.set(k, {
            teacherId: t.id,
            teacherName: t.fullName,
            className: String(b.className),
            subject: String(b.subject).trim(),
          });
        }
      })
    );

    const subMap = new Map();
    index
      .filter((d) => (d.examTypeKey || examTypeKeyOf(d.examType)) === activeType)
      .forEach((d) => {
        const k = `${d.teacherId}|${String(d.className || "").toUpperCase()}|${norm(d.subject)}`;
        const prev = subMap.get(k);
        if (!prev || tsOf(d) > tsOf(prev)) subMap.set(k, d);
        if (!expected.has(k)) {
          expected.set(k, {
            teacherId: d.teacherId,
            teacherName: d.teacherName || d.teacherId,
            className: String(d.className || ""),
            subject: d.subject || "General",
          });
        }
      });

    const endAt = toDateSafe(activeWin?.endAt);

    return [...expected.entries()]
      .map(([key, r]) => {
        const sub = subMap.get(key) || null;
        const pid = permissionId(activeType, r.teacherId, r.className, r.subject);
        const perm = perms[pid] || null;
        const permActive = Boolean(perm && perm.allowed && !perm.used);
        const firstAt = toDateSafe(sub?.firstSubmittedAt || sub?.lastSubmittedAt);
        const late = Boolean(sub && (sub.late || (endAt && firstAt && firstAt > endAt)));
        return { ...r, key, sub, pid, perm, permActive, late };
      })
      .sort(
        (a, b) =>
          classRank(a.className) - classRank(b.className) ||
          a.className.localeCompare(b.className) ||
          a.teacherName.localeCompare(b.teacherName) ||
          a.subject.localeCompare(b.subject)
      );
  }, [teachers, index, perms, activeType, activeWin]);

  const classOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.className))).sort(
        (a, b) => classRank(a) - classRank(b) || a.localeCompare(b)
      ),
    [rows]
  );

  const filtered = rows.filter((r) => {
    if (classFilter && r.className !== classFilter) return false;
    if (statusFilter === "submitted" && !r.sub) return false;
    if (statusFilter === "missing" && r.sub) return false;
    if (statusFilter === "permitted" && !r.permActive) return false;
    const q = search.trim().toLowerCase();
    if (q && !`${r.teacherName} ${r.subject} ${r.className}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const counts = {
    total: rows.length,
    submitted: rows.filter((r) => r.sub).length,
    missing: rows.filter((r) => !r.sub).length,
    permitted: rows.filter((r) => r.permActive).length,
  };
  const pct = counts.total ? Math.round((counts.submitted / counts.total) * 100) : 0;

  return (
    <div className="rsub-layout">
      <RsubStyles />
      <Sidebar />

      <div className="rsub-content">
        <div style={{ padding: "22px 26px 0" }}>
          <Topbar />
        </div>

        <div className="rsub-page">
          {/* Header */}
          <div className="rsub-header">
            <div className="rsub-header-icon">
              <CalendarClock size={26} color="#fff" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1>Gudbinta Natiijada (Results Submission)</h1>
              <p>
                Dhig waqtiga macalimiintu soo gudbinayaan natiijada, la soco cidda gudbisay iyo cidda
                dhiman, una fasax update ama gudbin daahday.
              </p>
            </div>
            <button className="rsub-btn ghost" onClick={load} disabled={loading}>
              <RefreshCcw size={15} /> Refresh
            </button>
          </div>

          {loading ? (
            <div className="rsub-card rsub-empty">Xogta ayaa la soo qaadayaa...</div>
          ) : (
            <>
              {/* ---------- 1. Waqtiyada gudbinta ---------- */}
              <div className="rsub-section-title">
                <Clock size={17} /> Waqtiga Gudbinta Imtixaan Kasta
              </div>
              <div className="rsub-window-grid">
                {EXAM_TYPES.map((t) => {
                  const w = windows[t.key];
                  const ws = windowState(w, now);
                  const badge = WINDOW_BADGE[ws];
                  const d = drafts[t.key] || { start: "", end: "" };
                  return (
                    <div key={t.key} className={`rsub-card rsub-window ${t.key === activeType ? "active" : ""}`}>
                      <div className="rsub-window-head">
                        <strong>{t.label}</strong>
                        <span className="rsub-badge" style={{ background: badge.bg, color: badge.color }}>
                          {badge.text}
                        </span>
                      </div>

                      <label>Goorta bilowga</label>
                      <input
                        type="datetime-local"
                        value={d.start}
                        onChange={(e) => setDraft(t.key, "start", e.target.value)}
                      />
                      <label>Goorta dhammaadka</label>
                      <input
                        type="datetime-local"
                        value={d.end}
                        onChange={(e) => setDraft(t.key, "end", e.target.value)}
                      />

                      {w && (
                        <div className="rsub-window-note">
                          {formatDT(w.startAt)} → {formatDT(w.endAt)}
                        </div>
                      )}

                      <div className="rsub-window-actions">
                        <button
                          className="rsub-btn primary"
                          onClick={() => saveWindow(t.key)}
                          disabled={savingKey === t.key}
                        >
                          {savingKey === t.key ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
                          Kaydi
                        </button>
                        {w && (
                          <button
                            className="rsub-btn danger icon"
                            title="Tirtir"
                            onClick={() => clearWindow(t.key)}
                            disabled={savingKey === t.key}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ---------- 2. La socodka macalimiinta ---------- */}
              <div className="rsub-section-title" style={{ marginTop: 28 }}>
                <Users size={17} /> Macalimiinta — Cidda Gudbisay iyo Cidda Dhiman
              </div>

              <div className="rsub-tabs">
                {EXAM_TYPES.map((t) => (
                  <button
                    key={t.key}
                    className={activeType === t.key ? "active" : ""}
                    onClick={() => setActiveType(t.key)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="rsub-stats">
                <div className="rsub-card rsub-stat">
                  <span>Wadarta</span>
                  <strong>{counts.total}</strong>
                  <div className="rsub-progress">
                    <div style={{ width: `${pct}%` }} />
                  </div>
                  <small>{pct}% waa la gudbiyay</small>
                </div>
                <div className="rsub-card rsub-stat good">
                  <span>Gudbiyay</span>
                  <strong>{counts.submitted}</strong>
                </div>
                <div className="rsub-card rsub-stat bad">
                  <span>Dhiman</span>
                  <strong>{counts.missing}</strong>
                </div>
                <div className="rsub-card rsub-stat info">
                  <span>Fasax furan</span>
                  <strong>{counts.permitted}</strong>
                </div>
              </div>

              <div className="rsub-card rsub-window-banner" data-state={activeWs}>
                <Clock size={16} />
                {activeWs === "unset" && (
                  <>Waqtiga gudbinta {examTypeLabelOf(activeType)} weli lama dhigin — macalimiintu ma gudbin karaan.</>
                )}
                {activeWs === "upcoming" && (
                  <>Gudbintu waxay furmaysaa {formatDT(activeWin.startAt)}.</>
                )}
                {activeWs === "open" && (
                  <>Gudbintu waa furan tahay — waxay xirmaysaa {formatDT(activeWin.endAt)}.</>
                )}
                {activeWs === "closed" && (
                  <>
                    Gudbintu waxay xirantay {formatDT(activeWin.endAt)}. Macalimiinta dhiman waxay u
                    baahan yihiin fasaxaaga.
                  </>
                )}
              </div>

              <div className="rsub-filters">
                <div className="rsub-search">
                  <Search size={15} />
                  <input
                    placeholder="Raadi macalin, maado ama fasal..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
                  <option value="">Dhammaan fasallada</option>
                  {classOptions.map((c) => (
                    <option key={c} value={c}>
                      Fasalka {c}
                    </option>
                  ))}
                </select>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">Dhammaan</option>
                  <option value="submitted">Gudbiyay</option>
                  <option value="missing">Dhiman</option>
                  <option value="permitted">Fasax furan</option>
                </select>
              </div>

              <div className="rsub-card rsub-table-card">
                {filtered.length === 0 ? (
                  <div className="rsub-empty">Wax lama helin.</div>
                ) : (
                  <div className="rsub-table-wrap">
                    <table className="rsub-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th className="left">Macalinka</th>
                          <th>Fasalka</th>
                          <th className="left">Maadada</th>
                          <th>Xaaladda</th>
                          <th>Goorta</th>
                          <th>PDF</th>
                          <th>Fasax</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((r, i) => {
                          const busy = busyRow === r.key;
                          return (
                            <tr key={r.key}>
                              <td className="num">{i + 1}</td>
                              <td className="left">
                                <div className="rsub-teacher">
                                  <div className="rsub-avatar">
                                    {(r.teacherName || "?").charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <strong>{r.teacherName}</strong>
                                    <small>{r.teacherId}</small>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span className="rsub-class">{r.className}</span>
                              </td>
                              <td className="left subj">{r.subject}</td>
                              <td>
                                {r.sub ? (
                                  <span className="rsub-chip good">
                                    <CheckCircle2 size={13} /> Gudbiyay
                                    {r.late && <em>daahay</em>}
                                  </span>
                                ) : (
                                  <span className="rsub-chip bad">
                                    <XCircle size={13} /> Dhiman
                                  </span>
                                )}
                                {r.sub?.submitCount > 1 && (
                                  <div className="rsub-sub-note">{r.sub.submitCount} jeer (update)</div>
                                )}
                              </td>
                              <td className="time">
                                {r.sub ? formatDT(r.sub.lastSubmittedAt || r.sub.updatedAt) : "—"}
                              </td>
                              <td>
                                {r.sub?.fileUrl ? (
                                  <a className="rsub-link" href={r.sub.fileUrl} target="_blank" rel="noreferrer">
                                    <FileText size={14} /> Fur
                                  </a>
                                ) : (
                                  <span className="muted">—</span>
                                )}
                              </td>
                              <td>
                                {r.permActive ? (
                                  <div className="rsub-perm">
                                    <span className="rsub-chip info">
                                      <ShieldCheck size={13} />
                                      {r.perm.reason === "update" ? "Update la fasaxay" : "Gudbin la fasaxay"}
                                    </span>
                                    <button
                                      className="rsub-btn ghost sm"
                                      onClick={() => revoke(r)}
                                      disabled={busy}
                                    >
                                      <Undo2 size={13} /> Ka noqo
                                    </button>
                                  </div>
                                ) : r.sub ? (
                                  <button
                                    className="rsub-btn primary sm"
                                    onClick={() => grant(r, "update")}
                                    disabled={busy}
                                  >
                                    {busy ? <Loader2 size={13} className="spin" /> : <Unlock size={13} />}
                                    U fasax Update
                                  </button>
                                ) : activeWs === "closed" ? (
                                  <button
                                    className="rsub-btn warn sm"
                                    onClick={() => grant(r, "late")}
                                    disabled={busy}
                                  >
                                    {busy ? <Loader2 size={13} className="spin" /> : <Unlock size={13} />}
                                    U fasax gudbin
                                  </button>
                                ) : (
                                  <span className="muted">
                                    {activeWs === "open" ? "Sugaya..." : "—"}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function RsubStyles() {
  return (
    <style>{`
      .rsub-layout { display: flex; min-height: 100vh; background: #F3F4F8; font-family: 'Inter','Segoe UI',sans-serif; }
      .rsub-content { flex: 1; min-width: 0; }
      .rsub-page { padding: 24px 30px 40px; }

      .rsub-header { display: flex; align-items: center; gap: 16px; margin-bottom: 22px; flex-wrap: wrap; }
      .rsub-header-icon { width: 54px; height: 54px; border-radius: 16px; background: linear-gradient(135deg,#16a34a,#0f4a2c); display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 10px 22px rgba(22,163,74,0.3); }
      .rsub-header h1 { margin: 0; font-size: 22px; font-weight: 800; color: #111827; }
      .rsub-header p { margin: 4px 0 0; font-size: 13px; color: #6B7280; max-width: 640px; line-height: 1.5; }

      .rsub-card { background: #fff; border: 1px solid rgba(17,24,39,0.06); border-radius: 16px; box-shadow: 0 4px 16px rgba(17,24,39,0.05); }
      .rsub-empty { padding: 40px; text-align: center; color: #9CA3AF; font-size: 14px; }

      .rsub-section-title { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 800; color: #14532d; margin-bottom: 12px; }

      .rsub-window-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
      .rsub-window { padding: 16px; display: flex; flex-direction: column; gap: 6px; border-top: 4px solid #d1d5db; }
      .rsub-window.active { border-top-color: #16a34a; }
      .rsub-window-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
      .rsub-window-head strong { font-size: 15px; color: #111827; }
      .rsub-window label { font-size: 11.5px; font-weight: 700; color: #6B7280; margin-top: 4px; }
      .rsub-window input { border: 1.5px solid rgba(17,24,39,0.12); border-radius: 10px; padding: 9px 10px; font-size: 13px; font-family: inherit; color: #111827; outline: none; width: 100%; box-sizing: border-box; }
      .rsub-window input:focus { border-color: #16a34a; }
      .rsub-window-note { font-size: 11.5px; color: #15803d; font-weight: 600; background: #f0fdf4; border-radius: 8px; padding: 6px 8px; margin-top: 4px; }
      .rsub-window-actions { display: flex; gap: 8px; margin-top: 8px; }
      .rsub-window-actions .primary { flex: 1; justify-content: center; }

      .rsub-badge { font-size: 11px; font-weight: 800; padding: 4px 9px; border-radius: 999px; white-space: nowrap; }

      .rsub-btn { display: inline-flex; align-items: center; gap: 6px; border-radius: 10px; padding: 9px 14px; font-size: 13px; font-weight: 700; cursor: pointer; border: 1px solid transparent; font-family: inherit; white-space: nowrap; }
      .rsub-btn:disabled { opacity: 0.6; cursor: not-allowed; }
      .rsub-btn.primary { background: #16a34a; color: #fff; }
      .rsub-btn.primary:hover:not(:disabled) { background: #15803d; }
      .rsub-btn.warn { background: #f59e0b; color: #fff; }
      .rsub-btn.warn:hover:not(:disabled) { background: #d97706; }
      .rsub-btn.ghost { background: #fff; color: #16a34a; border-color: rgba(22,163,74,0.3); }
      .rsub-btn.danger { background: #fef2f2; color: #dc2626; border-color: #fecaca; }
      .rsub-btn.icon { padding: 9px 11px; }
      .rsub-btn.sm { padding: 6px 10px; font-size: 12px; border-radius: 8px; }

      .rsub-tabs { display: flex; gap: 8px; overflow-x: auto; margin-bottom: 14px; padding-bottom: 2px; }
      .rsub-tabs button { flex-shrink: 0; background: #fff; border: 1.5px solid rgba(17,24,39,0.08); color: #374151; font-weight: 700; font-size: 13.5px; padding: 9px 16px; border-radius: 11px; cursor: pointer; font-family: inherit; }
      .rsub-tabs button.active { background: #14532d; border-color: #14532d; color: #fff; }

      .rsub-stats { display: grid; grid-template-columns: 1.4fr 1fr 1fr 1fr; gap: 12px; margin-bottom: 12px; }
      .rsub-stat { padding: 14px 16px; }
      .rsub-stat span { display: block; font-size: 12px; font-weight: 700; color: #6B7280; }
      .rsub-stat strong { display: block; font-size: 26px; font-weight: 900; color: #111827; margin-top: 2px; }
      .rsub-stat small { font-size: 11.5px; color: #6B7280; font-weight: 600; }
      .rsub-stat.good strong { color: #16a34a; }
      .rsub-stat.bad strong { color: #dc2626; }
      .rsub-stat.info strong { color: #2563eb; }
      .rsub-progress { height: 7px; border-radius: 999px; background: #e5e7eb; overflow: hidden; margin: 8px 0 5px; }
      .rsub-progress div { height: 100%; background: linear-gradient(90deg,#22c55e,#15803d); border-radius: 999px; transition: width .6s ease; }

      .rsub-window-banner { display: flex; align-items: center; gap: 8px; padding: 11px 14px; font-size: 13px; font-weight: 600; margin-bottom: 12px; }
      .rsub-window-banner[data-state="open"] { background: #f0fdf4; color: #15803d; border-color: #bbf7d0; }
      .rsub-window-banner[data-state="closed"] { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }
      .rsub-window-banner[data-state="upcoming"], .rsub-window-banner[data-state="unset"] { background: #fffbeb; color: #b45309; border-color: #fde68a; }

      .rsub-filters { display: flex; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
      .rsub-filters select { border: 1.5px solid rgba(17,24,39,0.1); border-radius: 10px; padding: 9px 12px; font-size: 13px; font-family: inherit; background: #fff; color: #111827; }
      .rsub-search { flex: 1 1 240px; display: flex; align-items: center; gap: 8px; background: #fff; border: 1.5px solid rgba(17,24,39,0.1); border-radius: 10px; padding: 0 12px; color: #9CA3AF; }
      .rsub-search input { border: none; outline: none; flex: 1; padding: 9px 0; font-size: 13px; font-family: inherit; color: #111827; background: transparent; }

      .rsub-table-card { overflow: hidden; }
      .rsub-table-wrap { overflow-x: auto; }
      .rsub-table { width: 100%; min-width: 860px; border-collapse: collapse; font-size: 13px; }
      .rsub-table th { background: #14532d; color: #fff; font-size: 11.5px; font-weight: 800; padding: 11px 12px; text-align: center; white-space: nowrap; }
      .rsub-table td { padding: 11px 12px; border-bottom: 1px solid #F3F4F6; text-align: center; color: #111827; vertical-align: middle; }
      .rsub-table .left { text-align: left; }
      .rsub-table tbody tr:hover td { background: #f9fafb; }
      .rsub-table .num { font-weight: 800; color: #14532d; width: 36px; }
      .rsub-table .subj { font-weight: 700; text-transform: capitalize; }
      .rsub-table .time { font-size: 12px; color: #4B5563; white-space: nowrap; }
      .rsub-table .muted { color: #9CA3AF; font-size: 12px; }

      .rsub-teacher { display: flex; align-items: center; gap: 10px; }
      .rsub-teacher strong { display: block; font-size: 13.5px; }
      .rsub-teacher small { display: block; font-size: 11px; color: #9CA3AF; }
      .rsub-avatar { width: 32px; height: 32px; border-radius: 50%; background: #dcfce7; color: #15803d; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
      .rsub-class { display: inline-block; min-width: 30px; padding: 4px 8px; border-radius: 8px; background: #fef3c7; color: #b45309; font-weight: 800; font-size: 12px; }

      .rsub-chip { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 800; white-space: nowrap; }
      .rsub-chip em { font-style: normal; background: #fef3c7; color: #b45309; padding: 1px 6px; border-radius: 999px; font-size: 10.5px; }
      .rsub-chip.good { background: #dcfce7; color: #15803d; }
      .rsub-chip.bad { background: #fee2e2; color: #b91c1c; }
      .rsub-chip.info { background: #dbeafe; color: #1d4ed8; }
      .rsub-sub-note { font-size: 11px; color: #6B7280; margin-top: 3px; }
      .rsub-perm { display: flex; flex-direction: column; align-items: center; gap: 5px; }
      .rsub-link { display: inline-flex; align-items: center; gap: 4px; color: #16a34a; font-weight: 700; text-decoration: none; font-size: 12.5px; }

      .spin { animation: rsub-spin 1s linear infinite; }
      @keyframes rsub-spin { to { transform: rotate(360deg); } }

      @media (max-width: 1100px) {
        .rsub-window-grid { grid-template-columns: 1fr 1fr; }
      }
      @media (max-width: 760px) {
        .rsub-page { padding: 16px; }
        .rsub-window-grid { grid-template-columns: 1fr; }
        .rsub-stats { grid-template-columns: 1fr 1fr; }
      }
    `}</style>
  );
}