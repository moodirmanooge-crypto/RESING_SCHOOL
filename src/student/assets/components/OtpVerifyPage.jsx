// src/components/OtpVerifyPage.jsx
// Shaashad guud oo code-ka 4 lambar ah (Admin + Teacher). Code-ka waxaa
// hubiya backend-ka (Cloud Functions) — halkan waa UI keliya.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MailCheck, ShieldCheck, ArrowLeft, RotateCw, Clock } from "lucide-react";

const LENGTH = 4;
const ACCENT = "#2563eb";
const ACCENT_DARK = "#1d4ed8";

/**
 * Props:
 *  client      — createOtpClient(...) (getPending, resend, verify, clearPending)
 *  title       — "Admin Verification" / "Teacher Verification"
 *  loginPath   — "/admin-login" / "/teacher-login"
 *  successPath — "/admin/dashboard" / "/teacher/dashboard"
 *  headFrom/headTo — midabada header-ka
 */
// Waqtiyada server-ka u beddel saacadda browser-ka (clock skew).
function deadlines(p) {
  if (!p) return { expiresAt: 0, resendAt: 0 };
  const offset = p.serverNow && p.clientTime ? p.clientTime - p.serverNow : 0;
  return {
    expiresAt: (p.expiresAt || 0) + offset,
    resendAt: (p.resendAvailableAt || 0) + offset,
  };
}

function fmt(sec) {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function OtpVerifyPage({
  client,
  title = "Verification",
  loginPath,
  successPath,
  headFrom = "#0b1220",
  headTo = "#1e3a8a",
}) {
  const getPendingOtp = client.getPending;
  const clearPendingOtp = client.clearPending;
  const navigate = useNavigate();
  const [pending, setPending] = useState(() => getPendingOtp());
  const [digits, setDigits] = useState(Array(LENGTH).fill(""));
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState(() =>
    getPendingOtp()?.alreadySent ? "Code hore ayaa loo diray email-kaaga — weli wuu shaqaynayaa." : ""
  );
  const [now, setNow] = useState(() => Date.now());
  const inputs = useRef([]);

  useEffect(() => {
    if (!pending?.otpSessionId) navigate(loginPath, { replace: true });
  }, [pending, navigate, loginPath]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  const { expiresAt, resendAt } = deadlines(pending);
  const expiresIn = (expiresAt - now) / 1000;
  const resendIn = (resendAt - now) / 1000;
  const expired = expiresIn <= 0;

  // Session-kii wuu dhammaaday (used / not found / limit) — dib ugu celi login-ka.
  function maybeRestart(err) {
    if (err.code === "functions/not-found" || /login/i.test(err.message || "")) {
      setTimeout(() => {
        clearPendingOtp();
        navigate(loginPath, { replace: true });
      }, 2500);
    }
  }

  async function submit(codeArg) {
    const code = codeArg ?? digits.join("");
    if (code.length !== LENGTH || verifying) return;
    if (expired) {
      setError("Code-ku wuu dhacay. Riix 'Resend Code' si laguugu soo diro mid cusub.");
      return;
    }
    setVerifying(true);
    setError("");
    setInfo("");
    try {
      await client.verify(code);
      navigate(successPath, { replace: true });
    } catch (err) {
      setError(err.message);
      setDigits(Array(LENGTH).fill(""));
      inputs.current[0]?.focus();
      maybeRestart(err);
    } finally {
      setVerifying(false);
    }
  }

  async function resend() {
    if (resending || resendIn > 0) return;
    setResending(true);
    setError("");
    setInfo("");
    try {
      await client.resend();
      setPending(getPendingOtp());
      setDigits(Array(LENGTH).fill(""));
      setInfo("Code cusub ayaa loo diray email-kaaga.");
      inputs.current[0]?.focus();
    } catch (err) {
      setError(err.message);
      maybeRestart(err);
    } finally {
      setResending(false);
    }
  }

  function setDigit(i, value) {
    const v = value.replace(/\D/g, "");
    if (!v) {
      const next = [...digits];
      next[i] = "";
      setDigits(next);
      return;
    }
    // Paste / autofill: buuxi dhowr sanduuq hal mar.
    const next = [...digits];
    let idx = i;
    for (const ch of v) {
      if (idx >= LENGTH) break;
      next[idx++] = ch;
    }
    setDigits(next);
    if (idx < LENGTH) inputs.current[idx]?.focus();
    else inputs.current[LENGTH - 1]?.blur();
    if (next.every((d) => d !== "")) submit(next.join(""));
  }

  function onKeyDown(i, e) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      const next = [...digits];
      next[i - 1] = "";
      setDigits(next);
      inputs.current[i - 1]?.focus();
      e.preventDefault();
    } else if (e.key === "ArrowLeft" && i > 0) inputs.current[i - 1]?.focus();
    else if (e.key === "ArrowRight" && i < LENGTH - 1) inputs.current[i + 1]?.focus();
    else if (e.key === "Enter") submit();
  }

  function backToLogin() {
    clearPendingOtp();
    navigate(loginPath, { replace: true });
  }

  if (!pending?.otpSessionId) return null;

  const complete = digits.every((d) => d !== "");

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#eef3fb",
        padding: 20,
        fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Arial, sans-serif",
      }}
    >
      <style>{`
        .otp-card { width:100%; max-width:460px; background:#fff; border-radius:28px;
          box-shadow:0 30px 80px rgba(15,23,42,0.18); overflow:hidden; }
        .otp-head { background:linear-gradient(160deg,${headFrom},${headTo}); color:#fff; padding:28px 32px; }
        .otp-body { padding:30px 32px 32px; }
        .otp-boxes { display:flex; gap:14px; justify-content:center; margin:6px 0 10px; }
        .otp-box { width:62px; height:68px; text-align:center; font-size:28px; font-weight:800;
          color:#0f172a; border:2px solid #e2e8f0; border-radius:16px; background:#f8fafc; outline:none;
          transition:border-color .15s, box-shadow .15s, background .15s; }
        .otp-box:focus { border-color:${ACCENT}; background:#fff; box-shadow:0 0 0 4px rgba(37,99,235,.15); }
        .otp-box.err { border-color:#ef4444; }
        .otp-btn { width:100%; border:none; border-radius:14px; padding:16px; color:#fff; font-size:16px;
          font-weight:700; display:flex; align-items:center; justify-content:center; gap:10px; }
        .otp-link { background:none; border:none; padding:0; font-size:13px; font-weight:700;
          display:inline-flex; align-items:center; gap:6px; }
        @media (max-width: 420px) {
          .otp-head, .otp-body { padding-left:20px; padding-right:20px; }
          .otp-box { width:54px; height:60px; font-size:24px; }
          .otp-boxes { gap:10px; }
        }
      `}</style>

      <div className="otp-card">
        <div className="otp-head">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 12,
                background: "rgba(255,255,255,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ShieldCheck size={24} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>{title}</div>
              <div style={{ fontSize: 12.5, opacity: 0.85 }}>Tallaabada 2aad ee galitaanka</div>
            </div>
          </div>
        </div>

        <div className="otp-body">
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div
              style={{
                width: 70,
                height: 70,
                borderRadius: "50%",
                background: "rgba(37,99,235,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 14px",
              }}
            >
              <MailCheck size={32} color={ACCENT} />
            </div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0f172a" }}>
              Geli code-ka <span style={{ color: ACCENT }}>4 lambar</span>
            </h1>
            <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "#64748b", lineHeight: 1.5 }}>
              Code ayaa loo diray email-kaaga
              <br />
              <b style={{ color: "#0f172a" }}>{pending.maskedEmail}</b>
            </p>
          </div>

          <div className="otp-boxes" onPaste={(e) => {
            const t = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, LENGTH);
            if (t) {
              e.preventDefault();
              setDigit(0, t);
            }
          }}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => (inputs.current[i] = el)}
                className={`otp-box${error ? " err" : ""}`}
                value={d}
                inputMode="numeric"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                maxLength={i === 0 ? LENGTH : 1}
                aria-label={`Lambarka ${i + 1}`}
                disabled={verifying}
                onChange={(e) => setDigit(i, e.target.value)}
                onKeyDown={(e) => onKeyDown(i, e)}
                onFocus={(e) => e.target.select()}
              />
            ))}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              fontSize: 12.5,
              color: expired ? "#ef4444" : "#64748b",
              marginBottom: 14,
            }}
          >
            <Clock size={14} />
            {expired ? "Code-ku wuu dhacay" : `Code-ku wuxuu dhacayaa ${fmt(expiresIn)}`}
          </div>

          {error && (
            <div
              role="alert"
              style={{
                background: "#fef2f2",
                color: "#b91c1c",
                border: "1px solid #fecaca",
                borderRadius: 12,
                padding: "10px 14px",
                fontSize: 13,
                marginBottom: 14,
                textAlign: "center",
              }}
            >
              {error}
            </div>
          )}
          {info && !error && (
            <div
              style={{
                background: "#f0fdf4",
                color: "#15803d",
                border: "1px solid #bbf7d0",
                borderRadius: 12,
                padding: "10px 14px",
                fontSize: 13,
                marginBottom: 14,
                textAlign: "center",
              }}
            >
              {info}
            </div>
          )}

          <button
            className="otp-btn"
            onClick={() => submit()}
            disabled={!complete || verifying || expired}
            style={{
              background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT_DARK})`,
              opacity: !complete || verifying || expired ? 0.6 : 1,
              cursor: !complete || verifying || expired ? "not-allowed" : "pointer",
            }}
          >
            {verifying ? "VERIFYING..." : "VERIFY"}
          </button>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 18,
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <button className="otp-link" onClick={backToLogin} style={{ color: "#64748b", cursor: "pointer" }}>
              <ArrowLeft size={14} /> Back to login
            </button>
            <button
              className="otp-link"
              onClick={resend}
              disabled={resending || resendIn > 0}
              style={{
                color: resendIn > 0 || resending ? "#94a3b8" : ACCENT,
                cursor: resendIn > 0 || resending ? "not-allowed" : "pointer",
              }}
            >
              <RotateCw size={14} />
              {resending ? "Sending..." : resendIn > 0 ? `Resend Code (${fmt(resendIn)})` : "Resend Code"}
            </button>
          </div>

          <p style={{ margin: "18px 0 0", fontSize: 11.5, color: "#94a3b8", textAlign: "center" }}>
            Code-ka hal mar oo keliya ayaa la isticmaali karaa. Haddii email-ku kuu iman waayo, eeg Spam folder-ka.
          </p>
        </div>
      </div>
    </div>
  );
}