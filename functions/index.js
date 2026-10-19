/**
 * =========================================================================
 *  AL-ISRA SCHOOL — Admin & Teacher Email OTP (Cloud Functions v2)
 * =========================================================================
 *
 *  Socodka:
 *    1. adminLoginStart  -> hubi email/username + password (server-side),
 *                           samee OTP 4 lambar ah, u dir email-ka admin-ka.
 *    2. resendAdminOtp   -> code cusub (60s cooldown, ugu badnaan 5 jeer).
 *    3. verifyAdminOtp   -> hubi code-ka (5 daqiiqo, hal mar, 5 isku-day),
 *                           kadib soo celi Firebase custom token
 *                           (claims: role=admin, otpVerified=true).
 *
 *  Teacher-ka: teacherLoginStart / resendTeacherOtp / verifyTeacherOtp —
 *  isla habka, collection "teachers", claims role=teacher.
 *
 *  Xogta OTP-ga waxay ku jirtaa:
 *    adminOtpSessions/{sessionId}   (hash keliya — code plaintext ma jiro)
 *    adminLoginGuards/{key}         (rate limiting + session-ka firfircoon)
 *  Labadaba Firestore Rules waa ka xiran yihiin client-ka.
 *
 *  Secrets (Firebase Secret Manager):
 *    SMTP_USER  -> email-ka wax dira (tusaale Gmail-ka dugsiga)
 *    SMTP_PASS  -> Gmail "App Password" (16 xaraf) ama SMTP password
 * =========================================================================
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

if (admin.apps.length === 0) admin.initializeApp();
const db = admin.firestore();

const SMTP_USER = defineSecret("SMTP_USER");
const SMTP_PASS = defineSecret("SMTP_PASS");

/* ---------------------------- Dejinta ---------------------------------- */
const SMTP_HOST = "smtp.gmail.com";
const SMTP_PORT = 465;
const MAIL_FROM_NAME = "Gallad.Tech_Platforms";
// Logo-ga email-ka: ku dhig faylka "gallad-logo.png" gudaha folder-ka functions/.
// Wuxuu ku dhex jiraa email-ka (inline/CID) — looma baahna link internet.
const LOGO_FILE = path.join(__dirname, "gallad-logo.png");

const OTP_LENGTH = 4;
const OTP_TTL_MS = 5 * 60 * 1000; // 5 daqiiqo
const OTP_MAX_ATTEMPTS = 5; // isku-day khaldan
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 ilbiriqsi
const MAX_SENDS_PER_SESSION = 5; // code-ka koowaad + 4 resend
const MAX_SENDS_PER_ADMIN_HOUR = 10;

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_LOGINS_PER_ID = 8;
const MAX_FAILED_LOGINS_PER_IP = 30;

const SESSIONS = "adminOtpSessions";
const GUARDS = "adminLoginGuards";

const CALL_OPTS = {
  region: "us-central1",
  maxInstances: 10,
  timeoutSeconds: 30,
};

/* ---------------------------- Helpers ---------------------------------- */
const sha256 = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");

function safeEqual(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function generateOtp() {
  // crypto.randomInt waa cryptographically secure; string si "0042" u ilaasho eberka.
  return String(crypto.randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
}

function hashOtp(code, salt, sessionId) {
  return crypto.createHmac("sha256", salt).update(`${sessionId}:${code}`).digest("hex");
}

function maskEmail(email) {
  const [user, domain] = String(email).split("@");
  if (!domain) return "***";
  const visible = user.slice(0, Math.min(2, user.length));
  return `${visible}${"*".repeat(Math.max(3, user.length - visible.length))}@${domain}`;
}

const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || "").trim());

/**
 * Email-ka code-ka loo diro. Macalinka: username-kiisu waa email-kiisa (AddTeacher /
 * Teachers.jsx), sidaa darteed username-ka ayaa ugu horreeya (si email hore oo stale ahi
 * u dhicin); haddii uusan email ahayn, field-ka `email` ayaa la isticmaalaa.
 * Admin: `email` kuu horreeya, kadib username (haddii email yahay).
 */
const emailOf = (roleKey, d) => {
  const order = roleKey === "teacher" ? [d?.username, d?.email] : [d?.email, d?.username];
  return order.map((x) => String(x || "").trim()).find(isValidEmail) || "";
};

function clientIp(request) {
  const raw = request.rawRequest;
  const fwd = raw?.headers?.["x-forwarded-for"];
  return String((fwd ? String(fwd).split(",")[0] : raw?.ip) || "unknown").trim();
}

const genericLoginError = () =>
  new HttpsError("permission-denied", "Email/username ama password waa khalad.");

/** Rate limiting: tirinta isku-dayada khaldan ee login-ka (id + IP). */
async function assertNotLocked(keys) {
  const now = Date.now();
  const snaps = await db.getAll(...keys.map((k) => db.collection(GUARDS).doc(k.id)));
  snaps.forEach((snap, i) => {
    const d = snap.exists ? snap.data() : null;
    if (d && d.failWindowStart && now - d.failWindowStart < LOGIN_WINDOW_MS && (d.failCount || 0) >= keys[i].max) {
      const mins = Math.ceil((LOGIN_WINDOW_MS - (now - d.failWindowStart)) / 60000);
      throw new HttpsError(
        "resource-exhausted",
        `Isku-dayo badan oo khaldan. Fadlan isku day ${mins} daqiiqo kadib.`
      );
    }
  });
}

async function recordFailure(keys) {
  const now = Date.now();
  await Promise.all(
    keys.map((k) =>
      db.runTransaction(async (tx) => {
        const ref = db.collection(GUARDS).doc(k.id);
        const snap = await tx.get(ref);
        const d = snap.exists ? snap.data() : {};
        const fresh = !d.failWindowStart || now - d.failWindowStart >= LOGIN_WINDOW_MS;
        tx.set(
          ref,
          { failWindowStart: fresh ? now : d.failWindowStart, failCount: fresh ? 1 : (d.failCount || 0) + 1 },
          { merge: true }
        );
      })
    )
  );
}

async function clearFailures(id) {
  await db.collection(GUARDS).doc(id).set({ failCount: 0, failWindowStart: 0 }, { merge: true });
}

/* ------------------------------ Roles ---------------------------------- */
/**
 * Role kasta: collection-ka Firestore, fields-ka login-ka lagu raadiyo,
 * claims-ka custom token-ka iyo xogta loo celinayo frontend-ka.
 * guardPrefix: admin wuxuu isticmaalaa "" (keys-kii hore), teacher "teacher_".
 */
const ROLES = {
  admin: {
    collection: "admin",
    portal: "Admin Portal",
    label: "Admin",
    guardPrefix: "",
    uidPrefix: "admin_",
    lookupFields: ["email", "username"],
    passwordOf: (d) => d.password,
    contactHint: "La xiriir Super Admin-ka",
    claims: (id, d) => ({
      role: "admin",
      adminLevel: d.role === "subadmin" ? "subadmin" : "admin",
      adminId: id,
      otpVerified: true,
    }),
    profile: (id, d) => ({
      id,
      name: d.fullName || d.name || d.username || "Admin",
      role: d.role || "admin",
      permissions: Array.isArray(d.permissions) ? d.permissions : [],
    }),
  },
  teacher: {
    collection: "teachers",
    portal: "Teacher Portal",
    label: "Macalin",
    guardPrefix: "teacher_",
    uidPrefix: "teacher_",
    lookupFields: ["email", "username", "teacherId"],
    passwordOf: (d) => d.password,
    contactHint: "La xiriir maamulka dugsiga",
    claims: (id) => ({ role: "teacher", teacherId: id, otpVerified: true }),
    profile: (id, d) => ({
      id,
      name: d.fullName || d.name || d.username || "Teacher",
      photo: d.teacherPhoto || d.photoUrl || "",
    }),
  },
};

const accountIdOf = (s) => s.accountId || s.adminId; // sessions-kii hore (admin)
const roleOf = (s) => s.role || "admin";
const otpGuardId = (cfg, accountId) => `${cfg.guardPrefix}otp_${sha256(accountId)}`;

/** Account-ka ka raadi email / username / teacherId ama doc id. */
async function findAccounts(cfg, identifier) {
  const col = db.collection(cfg.collection);
  const variants = [...new Set([identifier, identifier.toLowerCase()])];
  const queries = [];
  for (const field of cfg.lookupFields) {
    for (const v of variants) queries.push(col.where(field, "==", v).limit(5).get());
  }
  const idLookups = variants
    .filter((v) => !v.includes("/"))
    .map((v) => col.doc(v).get());
  const [qs, ids] = await Promise.all([Promise.all(queries), Promise.all(idLookups)]);
  const map = new Map();
  qs.forEach((snap) => snap.forEach((d) => map.set(d.id, d)));
  ids.forEach((d) => d && d.exists && map.set(d.id, d));
  return [...map.values()];
}

/* ---------------------------- Email ------------------------------------ */
let transporter = null;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER.value(), pass: SMTP_PASS.value() },
    });
  }
  return transporter;
}

async function sendOtpEmail(to, name, code, portal = "Admin Portal") {
  // Emulator-ka keliya: haddii SMTP_PASS = "emulator", code-ka log-ka ayaa lagu qoraa
  // (tijaabo local ah). Production-ka marnaba ma dhaco.
  if (process.env.FUNCTIONS_EMULATOR === "true" && SMTP_PASS.value() === "emulator") {
    logger.info(`[EMULATOR] OTP for ${to}: ${code}`);
    return;
  }

  const safeName = String(name || "User").replace(/[<>&"]/g, "");
  const hasLogo = fs.existsSync(LOGO_FILE);
  const html = `
  <div style="font-family:Segoe UI,Arial,sans-serif;background:#eef3fb;padding:28px">
    <div style="max-width:460px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(15,23,42,.12)">
      <div style="background:linear-gradient(135deg,#0b1220,#1e3a8a);padding:22px 26px;color:#fff">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          ${hasLogo ? `<td style="padding-right:14px;vertical-align:middle"><img src="cid:galladlogo" alt="Gallad Tech" width="52" height="52" style="display:block;width:52px;height:52px;border-radius:50%;background:#fff;object-fit:contain"></td>` : ""}
          <td style="vertical-align:middle">
            <div style="font-size:18px;font-weight:800;letter-spacing:.3px;color:#ffffff">GALLAD TECH PLATFORMS</div>
            <div style="font-size:13px;color:#c7d2fe">${portal} • Verification Code</div>
          </td>
        </tr></table>
      </div>
      <div style="padding:26px">
        <p style="margin:0 0 10px;color:#0f172a;font-size:15px">Salaan ${safeName},</p>
        <p style="margin:0 0 18px;color:#334155;font-size:14px;line-height:1.5">
          Code-kaaga xaqiijinta ee galitaanka ${portal}-ka waa:
        </p>
        <div style="text-align:center;margin:0 0 18px">
          <span style="display:inline-block;letter-spacing:14px;font-size:34px;font-weight:800;color:#1d4ed8;background:#eff6ff;border:2px dashed #93c5fd;border-radius:12px;padding:14px 10px 14px 24px">${code}</span>
        </div>
        <p style="margin:0 0 8px;color:#334155;font-size:13.5px">
          ⏱ Code-kani wuxuu dhacayaa <b>5 daqiiqo</b> kadib, hal mar oo keliya ayaana la isticmaali karaa.
        </p>
        <p style="margin:0;color:#64748b;font-size:12.5px;line-height:1.5">
          Haddii aadan adigu isku dayin inaad gasho, iska dhaaf email-kan oo isla markiiba beddel password-kaaga.
          Code-kan cidna ha la wadaagin.
        </p>
      </div>
      <div style="padding:14px 26px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:11.5px;text-align:center">
        © ${new Date().getFullYear()} GALLAD TECH PLATFORMS
      </div>
    </div>
  </div>`;

  await getTransporter().sendMail({
    from: `"${MAIL_FROM_NAME}" <${SMTP_USER.value()}>`,
    to,
    subject: `${code} — GALLAD TECH PLATFORMS verification code`,
    text:
      `Salaan ${safeName},\n\nCode-kaaga xaqiijinta ${portal}-ka waa: ${code}\n\n` +
      `Wuxuu dhacayaa 5 daqiiqo kadib, hal mar oo keliya ayaana la isticmaali karaa.\n` +
      `Haddii aadan adigu isku dayin, iska dhaaf email-kan oo beddel password-kaaga.\n\n— GALLAD TECH PLATFORMS`,
    html,
    attachments: hasLogo ? [{ filename: "gallad-logo.png", path: LOGO_FILE, cid: "galladlogo" }] : [],
  });
}

/* ------------------- OTP session creation / sending -------------------- */
/**
 * Samee (ama dib u cusboonaysii) OTP session, kaydi hash-ka, dir email-ka.
 * Transaction-ku wuxuu xaqiijiyaa cooldown-ka iyo xadka hal saacadood.
 */
async function issueOtp({ roleKey, accountId, data, sessionId, ip }) {
  const cfg = ROLES[roleKey];
  const now = Date.now();
  const code = generateOtp();
  const salt = crypto.randomBytes(16).toString("hex");
  const guardRef = db.collection(GUARDS).doc(otpGuardId(cfg, accountId));
  const isNew = !sessionId;
  const sid = sessionId || crypto.randomBytes(32).toString("hex");
  const sessionRef = db.collection(SESSIONS).doc(sid);
  const email = emailOf(roleKey, data);

  await db.runTransaction(async (tx) => {
    const [gSnap, sSnap] = await Promise.all([tx.get(guardRef), tx.get(sessionRef)]);
    const g = gSnap.exists ? gSnap.data() : {};
    const s = sSnap.exists ? sSnap.data() : null;

    if (!isNew) {
      if (!s || accountIdOf(s) !== accountId || roleOf(s) !== roleKey || g.activeSessionId !== sid) {
        throw new HttpsError("failed-precondition", "Session-kan ma shaqaynayo. Fadlan mar kale login samee.");
      }
      if (s.used) throw new HttpsError("failed-precondition", "Code-kan horay ayaa loo isticmaalay. Login mar kale samee.");
      if ((s.sendCount || 0) >= MAX_SENDS_PER_SESSION) {
        throw new HttpsError("resource-exhausted", "Code badan ayaa la diray. Fadlan mar kale login samee.");
      }
    }

    if (g.lastSentAt && now - g.lastSentAt < RESEND_COOLDOWN_MS) {
      const wait = Math.ceil((RESEND_COOLDOWN_MS - (now - g.lastSentAt)) / 1000);
      throw new HttpsError("resource-exhausted", `Fadlan sug ${wait} ilbiriqsi ka hor code cusub.`, {
        retryAfter: wait,
      });
    }

    const hourFresh = !g.hourWindowStart || now - g.hourWindowStart >= 60 * 60 * 1000;
    const hourCount = hourFresh ? 0 : g.hourCount || 0;
    if (hourCount >= MAX_SENDS_PER_ADMIN_HOUR) {
      throw new HttpsError("resource-exhausted", "Code badan ayaa saacaddan la diray. Fadlan sug wax yar.");
    }

    tx.set(
      guardRef,
      {
        activeSessionId: sid,
        lastSentAt: now,
        hourWindowStart: hourFresh ? now : g.hourWindowStart,
        hourCount: hourCount + 1,
      },
      { merge: true }
    );

    tx.set(sessionRef, {
      role: roleKey,
      accountId,
      email,
      codeHash: hashOtp(code, salt, sid),
      salt,
      expiresAt: now + OTP_TTL_MS,
      attempts: 0,
      used: false,
      sendCount: (s?.sendCount || 0) + 1,
      createdAt: s?.createdAt || now,
      lastSentAt: now,
      ip,
      // Firestore TTL policy (ikhtiyaari) ayaa tirtiri kara docs-ka duugoobay.
      deleteAfter: admin.firestore.Timestamp.fromMillis(now + 24 * 60 * 60 * 1000),
    });
  });

  try {
    await sendOtpEmail(email, data.fullName || data.username, code, cfg.portal);
  } catch (err) {
    logger.error("OTP email failed", { role: roleKey, accountId, error: err.message });
    // Session-ka bixi si code aan la dirin uusan u shaqayn, cooldown-kana fur.
    await Promise.all([
      sessionRef.set({ used: true, sendFailed: true }, { merge: true }),
      guardRef.set({ lastSentAt: 0 }, { merge: true }),
    ]);
    throw new HttpsError("unavailable", "Email-ka lama diri karo hadda. Fadlan isku day mar kale.");
  }

  return {
    otpSessionId: sid,
    maskedEmail: maskEmail(email),
    expiresAt: now + OTP_TTL_MS,
    resendAvailableAt: now + RESEND_COOLDOWN_MS,
    serverNow: Date.now(),
  };
}

/* --------------------------- Shared handlers --------------------------- */
async function handleLoginStart(roleKey, request) {
  const cfg = ROLES[roleKey];
  const identifier = String(request.data?.identifier || "").trim();
  const password = String(request.data?.password || "").trim();
  if (!identifier || !password || identifier.length > 200 || password.length > 200) {
    throw new HttpsError("invalid-argument", "Fadlan buuxi email/username iyo password.");
  }

  const ip = clientIp(request);
  const guardKeys = [
    { id: `${cfg.guardPrefix}id_${sha256(identifier.toLowerCase())}`, max: MAX_FAILED_LOGINS_PER_ID },
    { id: `ip_${sha256(ip)}`, max: MAX_FAILED_LOGINS_PER_IP },
  ];
  await assertNotLocked(guardKeys);

  const candidates = await findAccounts(cfg, identifier);
  const match = candidates.find((d) => {
    const pw = cfg.passwordOf(d.data());
    return typeof pw === "string" && pw.length > 0 && safeEqual(pw.trim(), password);
  });

  if (!match) {
    await recordFailure(guardKeys);
    throw genericLoginError();
  }

  const data = match.data();
  if (data.disabled === true || data.active === false) {
    throw new HttpsError("permission-denied", `Account-kan waa la xannibay. ${cfg.contactHint}.`);
  }
  if (!emailOf(roleKey, data)) {
    throw new HttpsError(
      "failed-precondition",
      `${cfg.label}-kan email sax ah looma diiwaangelin. ${cfg.contactHint} si email loogu daro.`
    );
  }

  await clearFailures(guardKeys[0].id);

  // Haddii code dhowaan la diray oo weli shaqaynayo, ha dirin mid cusub (cooldown).
  const guardSnap = await db.collection(GUARDS).doc(otpGuardId(cfg, match.id)).get();
  const g = guardSnap.exists ? guardSnap.data() : {};
  if (g.activeSessionId && g.lastSentAt && Date.now() - g.lastSentAt < RESEND_COOLDOWN_MS) {
    const sSnap = await db.collection(SESSIONS).doc(g.activeSessionId).get();
    const s = sSnap.exists ? sSnap.data() : null;
    if (
      s && accountIdOf(s) === match.id && roleOf(s) === roleKey &&
      !s.used && s.expiresAt > Date.now() && s.attempts < OTP_MAX_ATTEMPTS
    ) {
      return {
        otpSessionId: g.activeSessionId,
        maskedEmail: maskEmail(s.email),
        expiresAt: s.expiresAt,
        resendAvailableAt: g.lastSentAt + RESEND_COOLDOWN_MS,
        alreadySent: true,
        serverNow: Date.now(),
      };
    }
  }

  return issueOtp({ roleKey, accountId: match.id, data, sessionId: null, ip });
}

async function handleResend(roleKey, request) {
  const cfg = ROLES[roleKey];
  const sessionId = String(request.data?.otpSessionId || "");
  if (!/^[a-f0-9]{64}$/.test(sessionId)) {
    throw new HttpsError("invalid-argument", "Session khaldan. Fadlan mar kale login samee.");
  }
  const sSnap = await db.collection(SESSIONS).doc(sessionId).get();
  if (!sSnap.exists || roleOf(sSnap.data()) !== roleKey) {
    throw new HttpsError("not-found", "Session-ka lama helin. Fadlan mar kale login samee.");
  }

  const accountId = accountIdOf(sSnap.data());
  const aSnap = await db.collection(cfg.collection).doc(accountId).get();
  if (!aSnap.exists) throw new HttpsError("permission-denied", `${cfg.label}-kan lama helin.`);
  const data = aSnap.data();
  if (!emailOf(roleKey, data)) {
    throw new HttpsError("failed-precondition", `${cfg.label}-kan email sax ah ma laha.`);
  }

  return issueOtp({ roleKey, accountId, data, sessionId, ip: clientIp(request) });
}

async function handleVerify(roleKey, request) {
  const cfg = ROLES[roleKey];
  const sessionId = String(request.data?.otpSessionId || "");
  const code = String(request.data?.code || "").trim();
  if (!/^[a-f0-9]{64}$/.test(sessionId)) {
    throw new HttpsError("invalid-argument", "Session khaldan. Fadlan mar kale login samee.");
  }
  if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code)) {
    throw new HttpsError("invalid-argument", `Fadlan geli code ${OTP_LENGTH} lambar ah.`);
  }

  const sessionRef = db.collection(SESSIONS).doc(sessionId);

  // Transaction: hubinta + calaamadaynta "used" waa isku mar (hal mar oo keliya).
  const outcome = await db.runTransaction(async (tx) => {
    const sSnap = await tx.get(sessionRef);
    if (!sSnap.exists || roleOf(sSnap.data()) !== roleKey) {
      return { error: ["not-found", "Session-ka lama helin. Fadlan mar kale login samee."] };
    }
    const s = sSnap.data();
    const accountId = accountIdOf(s);
    const guardRef = db.collection(GUARDS).doc(otpGuardId(cfg, accountId));
    const gSnap = await tx.get(guardRef);
    const g = gSnap.exists ? gSnap.data() : {};

    if (s.used) return { error: ["failed-precondition", "Code-kan horay ayaa loo isticmaalay. Login mar kale samee."] };
    if (g.activeSessionId !== sessionId) {
      return { error: ["failed-precondition", "Code cusub ayaa la diray. Isticmaal code-ka ugu dambeeyay."] };
    }
    if (Date.now() > s.expiresAt) return { error: ["deadline-exceeded", "Code-ku wuu dhacay. Riix 'Resend Code'."] };
    if ((s.attempts || 0) >= OTP_MAX_ATTEMPTS) {
      return { error: ["resource-exhausted", "Isku-dayo badan oo khaldan. Codso code cusub."] };
    }

    const ok = safeEqual(hashOtp(code, s.salt, sessionId), s.codeHash);
    if (!ok) {
      const attempts = (s.attempts || 0) + 1;
      tx.update(sessionRef, { attempts });
      const left = OTP_MAX_ATTEMPTS - attempts;
      return {
        error: [
          left > 0 ? "permission-denied" : "resource-exhausted",
          left > 0 ? `Code-ku waa khalad. ${left} isku-day ayaa kuu haray.` : "Isku-dayo badan oo khaldan. Codso code cusub.",
          { attemptsLeft: left },
        ],
      };
    }

    tx.update(sessionRef, { used: true, usedAt: Date.now() });
    tx.set(guardRef, { activeSessionId: null, lastSentAt: 0 }, { merge: true });
    return { accountId };
  });

  if (outcome.error) throw new HttpsError(...outcome.error);

  const aSnap = await db.collection(cfg.collection).doc(outcome.accountId).get();
  if (!aSnap.exists) throw new HttpsError("permission-denied", `${cfg.label}-kan lama helin.`);
  const data = aSnap.data();

  const uid = `${cfg.uidPrefix}${sha256(outcome.accountId).slice(0, 40)}`;
  let token;
  try {
    token = await admin.auth().createCustomToken(uid, cfg.claims(outcome.accountId, data));
  } catch (err) {
    logger.error("createCustomToken failed — hubi IAM 'Service Account Token Creator'", { error: err.message });
    throw new HttpsError("internal", "Session-ka lama abuuri karo. La xiriir maamulka nidaamka.");
  }

  return { token, account: cfg.profile(outcome.accountId, data) };
}

/* ============================== ADMIN ================================== */
exports.adminLoginStart = onCall({ ...CALL_OPTS, secrets: [SMTP_USER, SMTP_PASS] }, (req) =>
  handleLoginStart("admin", req)
);
exports.resendAdminOtp = onCall({ ...CALL_OPTS, secrets: [SMTP_USER, SMTP_PASS] }, (req) =>
  handleResend("admin", req)
);
exports.verifyAdminOtp = onCall(CALL_OPTS, async (req) => {
  const res = await handleVerify("admin", req);
  // Frontend-ka admin-ku wuxuu filayaa `admin` (sidii hore).
  return { token: res.token, admin: res.account };
});

/* ============================== TEACHER ================================ */
exports.teacherLoginStart = onCall({ ...CALL_OPTS, secrets: [SMTP_USER, SMTP_PASS] }, (req) =>
  handleLoginStart("teacher", req)
);
exports.resendTeacherOtp = onCall({ ...CALL_OPTS, secrets: [SMTP_USER, SMTP_PASS] }, (req) =>
  handleResend("teacher", req)
);
exports.verifyTeacherOtp = onCall(CALL_OPTS, (req) => handleVerify("teacher", req));