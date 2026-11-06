// src/teacher/ShiftClock.jsx
//
// Macalinka: Fur Shiftka (Clock In) marka uu yimaado, Xir Shiftka (Clock Out) marka uu tago.
//   - Waqtiga waxaa laga qaataa server-ka (Firestore serverTimestamp) — macalinku
//     gacanta kuma qori karo, saacadda taleefanka beddelkeeduna saameyn kuma laha.
//   - Waqtiga imaanshaha: 7:00 – 7:30 subaxnimo. Wixii ka dambeeya -> "Waad daahday".
//   - Maalintii hal shift oo keliya (lama dhaafi karo, dib looma soo celin karo).
//   - Taariikhda shiftiyada oo dhan waa la kaydiyaa ("shifts", hal doc shift kasta).

import { useEffect, useState } from "react";
import { db } from "../firebase/firebase";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { Clock, LogIn, LogOut, History, X, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  ARRIVAL_START,
  LATE_AFTER,
  arrivalStatus,
  shiftLateInfo,
  shiftDateKey,
  todayKey,
  toDateSafe,
  formatTime,
  formatDate,
  formatDuration,
  formatLate,
} from "../utils/shiftRules";

function ShiftClockStyles() {
  return (
    <style>{`
      .sc-card { background: #0B1120; border: 1px solid rgba(255,255,255,.06); border-radius: 20px; padding: 24px; margin-bottom: 24px; }
      .sc-header-row { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }
      .sc-status-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
      .sc-btn-row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 16px; }
      .sc-rule { margin-top: 14px; font-size: 12.5px; color: #94A3B8; background: rgba(139,92,246,0.08); border: 1px solid rgba(139,92,246,0.2); border-radius: 10px; padding: 9px 12px; }
      .sc-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; z-index: 2000; padding: 16px; box-sizing: border-box; }
      .sc-modal { background: #0B1120; border: 1px solid rgba(255,255,255,.08); border-radius: 20px; padding: 24px; width: min(560px, 92vw); max-height: 80vh; overflow-y: auto; box-sizing: border-box; }
      .sc-history-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 12px; background: #111827; border: 1px solid rgba(255,255,255,.06); margin-bottom: 8px; flex-wrap: wrap; }
      @media (max-width: 900px) {
        .sc-card { padding: 16px !important; border-radius: 16px !important; }
        .sc-btn-row button { flex: 1 1 45%; justify-content: center; }
        .sc-modal { padding: 18px; width: 100%; }
      }
      @media (max-width: 480px) { .sc-btn-row button { flex: 1 1 100%; } }
    `}</style>
  );
}

function LateBadge({ shift }) {
  const { late, lateMinutes } = shiftLateInfo(shift);
  return late ? (
    <span style={{ ...pill, background: "rgba(239,68,68,0.15)", color: "#F87171" }}>
      Daahay · {formatLate(lateMinutes)}
    </span>
  ) : (
    <span style={{ ...pill, background: "rgba(34,197,94,0.15)", color: "#4ADE80" }}>Waqtigeeda</span>
  );
}

export default function ShiftClock() {
  const teacherId = localStorage.getItem("teacherId") || "";
  const teacherName = localStorage.getItem("teacherName") || "Teacher";

  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadShifts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchShifts() {
    if (!teacherId) return [];
    const snap = await getDocs(query(collection(db, "shifts"), where("teacherId", "==", teacherId)));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (toDateSafe(b.clockInAt)?.getTime() || 0) - (toDateSafe(a.clockInAt)?.getTime() || 0));
  }

  async function loadShifts() {
    try {
      setLoading(true);
      setShifts(await fetchShifts());
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  }

  const today = todayKey();
  const openShift = shifts.find((s) => s.status === "open") || null;
  const todayShift = shifts.find((s) => shiftDateKey(s) === today) || null;
  const openIsOld = openShift && shiftDateKey(openShift) !== today;

  async function clockIn() {
    if (!teacherId) {
      alert("Teacher ID lama helin. Fadlan mar labaad soo gal.");
      return;
    }
    try {
      setBusy(true);
      // Dib u hubi server-ka: maanta shift ma la furay? (qalab kale ka furay)
      const latest = await fetchShifts();
      if (latest.some((s) => shiftDateKey(s) === todayKey())) {
        setShifts(latest);
        alert("Maanta shiftkaaga hore ayaa loo furay. Maalintii hal mar ayaa la furi karaa.");
        return;
      }
      if (latest.some((s) => s.status === "open")) {
        setShifts(latest);
        alert("Marka hore xir shiftkii hore ee furnaa.");
        return;
      }

      const ref = await addDoc(collection(db, "shifts"), {
        teacherId,
        teacherName,
        clockInAt: serverTimestamp(),
        clockOutAt: null,
        durationMs: null,
        status: "open",
        createdAt: serverTimestamp(),
      });

      // Waqtiga dhabta ah ee server-ka -> daahay mise waqtigiisa
      const snap = await getDoc(ref);
      const clockInAt = toDateSafe(snap.data()?.clockInAt) || new Date();
      const st = arrivalStatus(clockInAt);
      await updateDoc(ref, {
        dateKey: st.dateKey,
        arrivalTime: st.hhmm,
        late: st.late,
        lateMinutes: st.lateMinutes,
      });

      setShifts(await fetchShifts());
      alert(
        st.late
          ? `Shiftka waa la furay ${formatTime(clockInAt)}.\n\nWaad daahday — ${formatLate(st.lateMinutes)}. (Waqtiga imaanshaha waa ${ARRIVAL_START} – ${LATE_AFTER})`
          : `Shiftka waa la furay ${formatTime(clockInAt)}. Waqtigeeda ayaad timid ✓`
      );
    } catch (err) {
      console.log(err);
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function clockOut() {
    if (!openShift) return;
    try {
      setBusy(true);
      const ref = doc(db, "shifts", openShift.id);
      await updateDoc(ref, { clockOutAt: serverTimestamp(), status: "closed" });
      const data = (await getDoc(ref)).data() || {};
      const inAt = toDateSafe(data.clockInAt);
      const outAt = toDateSafe(data.clockOutAt) || new Date();
      const durationMs = inAt ? Math.max(0, outAt.getTime() - inAt.getTime()) : null;
      const extra = { durationMs };
      if (typeof data.late !== "boolean" && inAt) {
        const st = arrivalStatus(inAt);
        Object.assign(extra, { dateKey: st.dateKey, arrivalTime: st.hhmm, late: st.late, lateMinutes: st.lateMinutes });
      }
      await updateDoc(ref, extra);
      setShifts(await fetchShifts());
      alert(`Shiftka waa la xiray. Wakhtiga la shaqeeyay: ${formatDuration(durationMs)}`);
    } catch (err) {
      console.log(err);
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sc-card">
      <ShiftClockStyles />

      <div className="sc-header-row">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "rgba(139,92,246,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Clock size={20} color="#8B5CF6" />
          </div>
          <div>
            <h3 style={{ margin: 0, color: "#fff" }}>My Shift</h3>
            <div style={{ color: "#94A3B8", fontSize: 12.5 }}>{formatDate(new Date())}</div>
          </div>
        </div>

        <button onClick={() => setShowHistory(true)} style={btnHistory}>
          <History size={15} style={{ marginRight: 6 }} />
          Shift History
        </button>
      </div>

      {loading ? (
        <p style={{ color: "#94A3B8", margin: 0 }}>Loading shift status...</p>
      ) : openShift ? (
        <>
          {openIsOld && (
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
                background: "rgba(245,158,11,0.1)",
                border: "1px solid rgba(245,158,11,0.35)",
                color: "#FBBF24",
                borderRadius: 10,
                padding: "9px 12px",
                fontSize: 13,
                marginBottom: 12,
              }}
            >
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              Shiftkii {formatDate(openShift.clockInAt)} lama xirin. Xir si aad maanta u furto shift cusub.
            </div>
          )}
          <div className="sc-status-row">
            <span style={{ ...pill, background: "rgba(34,197,94,0.15)", color: "#22C55E" }}>● Shiftka waa furan yahay</span>
            <span style={{ color: "#CBD5E1", fontSize: 13.5 }}>
              Waqtiga aad timid: <b style={{ color: "#fff" }}>{formatTime(openShift.clockInAt)}</b>
            </span>
            <LateBadge shift={openShift} />
          </div>

          <div className="sc-btn-row">
            <button onClick={clockOut} disabled={busy} style={btnDanger}>
              <LogOut size={16} style={{ marginRight: 8 }} />
              {busy ? "Xirayaa..." : "Xir Shiftka (Clock Out)"}
            </button>
          </div>
        </>
      ) : todayShift ? (
        <>
          <div className="sc-status-row">
            <span style={{ ...pill, background: "rgba(139,92,246,0.15)", color: "#A78BFA" }}>
              <CheckCircle2 size={13} style={{ marginRight: 5, verticalAlign: -2 }} />
              Maanta shiftkaaga waa la xiray
            </span>
            <span style={{ color: "#CBD5E1", fontSize: 13.5 }}>
              {formatTime(todayShift.clockInAt)} → {formatTime(todayShift.clockOutAt)} · {formatDuration(todayShift.durationMs)}
            </span>
            <LateBadge shift={todayShift} />
          </div>
          <div className="sc-rule">Shift cusub waxaad furi kartaa berri. Maalintii hal shift oo keliya ayaa la furi karaa.</div>
        </>
      ) : (
        <>
          <div className="sc-status-row">
            <span style={{ ...pill, background: "rgba(148,163,184,0.15)", color: "#94A3B8" }}>● Maanta shift lama furin</span>
          </div>

          <div className="sc-btn-row">
            <button onClick={clockIn} disabled={busy} style={btnPrimary}>
              <LogIn size={16} style={{ marginRight: 8 }} />
              {busy ? "Furayaa..." : "Waan imid — Fur Shiftka (Clock In)"}
            </button>
          </div>
        </>
      )}

      <div className="sc-rule">
        ⏰ Waqtiga imaanshaha: <b style={{ color: "#fff" }}>7:00 – 7:30 subaxnimo</b>. Macalinka yimaada 7:30 kadib waxaa
        loo qorayaa <b style={{ color: "#F87171" }}>"Daahay"</b>. Waqtiga si toos ah ayaa loo qaadaa marka aad riixdo — lama
        beddeli karo.
      </div>

      {showHistory && (
        <div className="sc-modal-overlay" onClick={() => setShowHistory(false)}>
          <div className="sc-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: "#fff" }}>Taariikhda Shiftiyada</h3>
              <button onClick={() => setShowHistory(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}>
                <X size={22} />
              </button>
            </div>

            {shifts.length === 0 ? (
              <p style={{ color: "#94A3B8" }}>Weli shift lama furin.</p>
            ) : (
              shifts.map((s) => {
                const isOpen = s.status === "open";
                return (
                  <div key={s.id} className="sc-history-row">
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>
                        {formatDate(s.clockInAt)} · {formatTime(s.clockInAt)} → {isOpen ? "Weli furan" : formatTime(s.clockOutAt)}
                      </div>
                      <div style={{ color: "#94A3B8", fontSize: 12.5, marginTop: 2 }}>
                        {isOpen ? "Wali lama xirin" : `Muddo: ${formatDuration(s.durationMs)}`}
                      </div>
                    </div>
                    <LateBadge shift={s} />
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const pill = {
  padding: "4px 12px",
  borderRadius: 20,
  fontWeight: 700,
  fontSize: 12.5,
  display: "inline-flex",
  alignItems: "center",
};
const btnPrimary = {
  background: "linear-gradient(90deg,#6D5DF0,#8B5CF6)",
  color: "white",
  border: "none",
  borderRadius: 10,
  padding: "12px 22px",
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: 14,
  display: "inline-flex",
  alignItems: "center",
};
const btnDanger = {
  background: "#EF4444",
  color: "white",
  border: "none",
  borderRadius: 10,
  padding: "12px 22px",
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: 14,
  display: "inline-flex",
  alignItems: "center",
};
const btnHistory = {
  background: "none",
  border: "1px solid rgba(139,92,246,.4)",
  color: "#8B5CF6",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: "bold",
  borderRadius: 10,
  padding: "8px 16px",
  display: "inline-flex",
  alignItems: "center",
};