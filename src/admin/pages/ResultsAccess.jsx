// src/admin/pages/ResultsAccess.jsx  (/admin/results-access)
//
// Maamulku halkan ayuu ka furaa / ka xiraa natiijada imtixaanka ee ardayda
// ka eegaan bogga Academics. Isbeddelku isla markiiba (live) ayuu gaaraa:
// marka la xiro, ardayga natiijadiisa furan ayaa si toos ah u xirmaya.
import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import {
  Lock,
  Unlock,
  CalendarClock,
  Save,
  Loader2,
  Eye,
  EyeOff,
  Info,
  Clock,
} from "lucide-react";
import {
  subscribeResultsAccess,
  saveResultsAccess,
  resultsAccessState,
  formatAccessTime,
} from "../../utils/resultsAccess";

const EXAM_LABELS = ["", "Monthly One", "Term", "Monthly Two", "Final"];

function actorName() {
  return localStorage.getItem("adminName") || localStorage.getItem("adminId") || "admin";
}

export default function ResultsAccess() {
  const [cfg, setCfg] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);

  const [openAt, setOpenAt] = useState("");
  const [closeAt, setCloseAt] = useState("");
  const [examLabel, setExamLabel] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const unsub = subscribeResultsAccess((c) => {
      setCfg(c);
      setOpenAt(c.openAt || "");
      setCloseAt(c.closeAt || "");
      setExamLabel(c.examLabel || "");
      setMessage(c.message || "");
    });
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => {
      unsub();
      clearInterval(t);
    };
  }, []);

  const state = useMemo(() => (cfg ? resultsAccessState(cfg, now) : null), [cfg, now]);

  async function openNow() {
    setBusy(true);
    try {
      await saveResultsAccess(
        { isOpen: true, openAt: "", closeAt: closeAt && new Date(closeAt).getTime() > Date.now() ? closeAt : "", examLabel, message },
        actorName()
      );
    } catch (e) {
      alert("Khalad: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function closeNow() {
    if (!window.confirm("Ma hubtaa inaad xirto natiijada? Ardayda hadda eegaysa way u xirmi doontaa isla markiiba.")) return;
    setBusy(true);
    try {
      await saveResultsAccess({ isOpen: false, examLabel, message }, actorName());
    } catch (e) {
      alert("Khalad: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveSchedule() {
    if (!openAt && !closeAt) {
      alert("Geli ugu yaraan hal waqti (bilow ama dhammaad).");
      return;
    }
    if (openAt && closeAt && new Date(closeAt) <= new Date(openAt)) {
      alert("Waqtiga xiritaanka waa inuu ka dambeeyaa waqtiga furitaanka.");
      return;
    }
    setBusy(true);
    try {
      await saveResultsAccess({ isOpen: true, openAt, closeAt, examLabel, message }, actorName());
      alert("Jadwalka waa la kaydiyay ✅");
    } catch (e) {
      alert("Khalad: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveDetails() {
    setBusy(true);
    try {
      await saveResultsAccess({ examLabel, message }, actorName());
    } catch (e) {
      alert("Khalad: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  const isOpen = state?.open;
  const statusText = !state
    ? "Soo dejinaya..."
    : state.reason === "open"
    ? state.closesAt
      ? `Furan — wuxuu si toos ah u xirmayaa ${formatAccessTime(state.closesAt)}`
      : "Furan — ardaydu hadda way arki karaan natiijadooda"
    : state.reason === "notYet"
    ? `Xiran — wuxuu furmayaa ${formatAccessTime(state.opensAt)}`
    : state.reason === "ended"
    ? `Xiran — waqtigii wuu dhammaaday (${formatAccessTime(state.closesAt)})`
    : "Xiran — ardaydu ma arki karaan natiijada";

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f4f7f5", fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      <Sidebar />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: "20px 28px 0" }}>
          <Topbar title="Results Access" />
        </div>

        <div style={{ padding: "22px 28px 40px", maxWidth: 980 }}>
          {/* STATUS HERO */}
          <div
            style={{
              ...hero,
              background: isOpen
                ? "linear-gradient(120deg,#0a3a22,#15803d)"
                : "linear-gradient(120deg,#3f1d1d,#991b1b)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 18, flex: 1, minWidth: 260 }}>
              <div style={heroIcon}>{isOpen ? <Unlock size={30} /> : <Lock size={30} />}</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.14em", opacity: 0.8 }}>
                  NATIIJADA ARDAYDA (ACADEMICS)
                </div>
                <h1 style={{ margin: "4px 0 6px", fontSize: 28, fontWeight: 900 }}>
                  {isOpen ? "FURAN" : "XIRAN"}
                  {cfg?.examLabel ? <span style={{ fontWeight: 600, opacity: 0.85 }}> · {cfg.examLabel}</span> : null}
                </h1>
                <div style={{ fontSize: 14, opacity: 0.9 }}>{statusText}</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={openNow} disabled={busy || !cfg || (isOpen && !state?.closesAt)} style={{ ...bigBtn, background: "#fff", color: "#15803d", opacity: busy || (isOpen && !state?.closesAt) ? 0.6 : 1 }}>
                {busy ? <Loader2 size={18} className="ra-spin" /> : <Eye size={18} />} Fur Hadda
              </button>
              <button onClick={closeNow} disabled={busy || !cfg || !cfg.isOpen} style={{ ...bigBtn, background: "#dc2626", color: "#fff", opacity: busy || !cfg?.isOpen ? 0.6 : 1 }}>
                <EyeOff size={18} /> Xir Hadda
              </button>
            </div>
          </div>

          {/* SCHEDULE */}
          <div style={card}>
            <CardHead icon={CalendarClock} title="Jadwal (ikhtiyaari)" sub="Natiijadu ha furanto waqti cayiman, si tooska ahna ha u xiranto" />
            <div style={grid}>
              <div>
                <div style={label}>Ka fur (bilow)</div>
                <input type="datetime-local" value={openAt} onChange={(e) => setOpenAt(e.target.value)} style={input} />
                <div style={hint}>Banaan = isla markiiba</div>
              </div>
              <div>
                <div style={label}>Xir (dhammaad)</div>
                <input type="datetime-local" value={closeAt} onChange={(e) => setCloseAt(e.target.value)} style={input} />
                <div style={hint}>Banaan = furan ilaa aad xirto</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              <button onClick={saveSchedule} disabled={busy} style={primaryBtn}>
                <Save size={16} /> Kaydi Jadwalka
              </button>
              {(openAt || closeAt) && (
                <button
                  onClick={() => {
                    setOpenAt("");
                    setCloseAt("");
                  }}
                  style={outlineBtn}
                >
                  Tirtir waqtiyada
                </button>
              )}
            </div>
          </div>

          {/* DETAILS */}
          <div style={card}>
            <CardHead icon={Info} title="Macluumaadka ardayda loo muujinayo" sub="Imtixaanka la furay iyo fariinta marka uu xiran yahay" />
            <div style={grid}>
              <div>
                <div style={label}>Imtixaanka</div>
                <select value={examLabel} onChange={(e) => setExamLabel(e.target.value)} style={input}>
                  {EXAM_LABELS.map((x) => (
                    <option key={x} value={x}>
                      {x || "— Ha sheegin —"}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div style={label}>Fariinta (marka uu xiran yahay)</div>
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="tusaale: Natiijada Final waxaa la soo dhigayaa Sabtida"
                  style={input}
                />
              </div>
            </div>
            <button onClick={saveDetails} disabled={busy} style={{ ...primaryBtn, marginTop: 14 }}>
              <Save size={16} /> Kaydi
            </button>
          </div>

          {cfg?.updatedAt && (
            <div style={{ fontSize: 12.5, color: "#6b7280", display: "flex", alignItems: "center", gap: 6 }}>
              <Clock size={13} /> Isbeddelkii u dambeeyay: {formatAccessTime(cfg.updatedAt)}
              {cfg.updatedBy ? ` · ${cfg.updatedBy}` : ""}
            </div>
          )}
        </div>
      </div>
      <style>{`.ra-spin{animation:ra-spin 1s linear infinite}@keyframes ra-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function CardHead({ icon: Icon, title, sub }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#16a34a1A", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={19} />
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>{title}</div>
        <div style={{ fontSize: 12.5, color: "#6b7280" }}>{sub}</div>
      </div>
    </div>
  );
}

const hero = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: 18,
  color: "#fff",
  borderRadius: 22,
  padding: "26px 28px",
  marginBottom: 20,
  boxShadow: "0 14px 32px rgba(0,0,0,0.18)",
};
const heroIcon = {
  width: 64,
  height: 64,
  borderRadius: 18,
  background: "rgba(255,255,255,0.16)",
  border: "1px solid rgba(255,255,255,0.3)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};
const bigBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  border: "none",
  borderRadius: 12,
  padding: "13px 20px",
  fontWeight: 800,
  fontSize: 14.5,
  cursor: "pointer",
};
const card = {
  background: "#fff",
  borderRadius: 20,
  padding: "20px 22px",
  boxShadow: "0 6px 20px rgba(17,24,39,0.05)",
  border: "1px solid rgba(17,24,39,0.05)",
  marginBottom: 18,
};
const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 };
const label = { fontSize: 12.5, fontWeight: 700, color: "#374151", marginBottom: 6 };
const hint = { fontSize: 11.5, color: "#9ca3af", marginTop: 4 };
const input = {
  width: "100%",
  height: 42,
  padding: "0 12px",
  boxSizing: "border-box",
  border: "1px solid #e5e7eb",
  borderRadius: 11,
  fontSize: 13.5,
  color: "#111827",
  outline: "none",
  background: "#f9fbfa",
};
const primaryBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  height: 42,
  padding: "0 18px",
  borderRadius: 11,
  border: "none",
  background: "linear-gradient(180deg,#22c55e,#15803d)",
  color: "#fff",
  fontWeight: 700,
  fontSize: 13.5,
  cursor: "pointer",
};
const outlineBtn = {
  height: 42,
  padding: "0 14px",
  borderRadius: 11,
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#374151",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};