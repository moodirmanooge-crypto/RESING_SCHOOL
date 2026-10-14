// src/services/adminOtpService.js
// Email OTP — ADMIN + TEACHER (hal fayl oo dhammaystiran).
// OTP-ga waxaa sameeya, kaydiya (hash) oo hubiya Cloud Functions —
// React-ku waa UI keliya.
//
//  Admin:   startAdminLogin, resendAdminOtp, verifyAdminOtp, signOutAdmin,
//           getVerifiedAdminClaims, getPendingOtp, clearPendingOtp, adminOtpClient
//  Teacher: startTeacherLogin, resendTeacherOtp, verifyTeacherOtp, signOutTeacher,
//           getVerifiedTeacherClaims, teacherOtpClient
import { httpsCallable } from "firebase/functions";
import { signInWithCustomToken, signOut } from "firebase/auth";
import { auth, functions } from "../firebase/firebase";

export const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 saacadood

function friendlyError(err) {
  const msg = err?.message || "";
  if (err?.code === "functions/internal" && (!msg || msg === "internal")) {
    return "Khalad server ayaa dhacay. Fadlan isku day mar kale.";
  }
  if (err?.code === "functions/unavailable" && !msg) return "Internet-ka hubi, kadib isku day mar kale.";
  return msg || "Khalad ayaa dhacay. Fadlan isku day mar kale.";
}

function wrap(name) {
  const fn = httpsCallable(functions, name);
  return async (payload) => {
    try {
      const res = await fn(payload);
      return res.data;
    } catch (err) {
      const e = new Error(friendlyError(err));
      e.code = err?.code;
      e.details = err?.details;
      throw e;
    }
  };
}

const safe = (fn) => {
  try {
    return fn();
  } catch {
    return undefined;
  }
};

/* ============================ Qaabka guud ============================= */
/**
 * createOtpClient({ role, fns: {start, resend, verify}, localKeys, onVerified })
 *  - role:       "admin" | "teacher" (waa inuu la mid yahay claims.role)
 *  - localKeys:  keys-ka localStorage ee UI-gu isticmaalo (logout-ka waa la tirtiraa)
 *  - onVerified: (responseData) => profile — kaydi xogta UI kaddib verify
 */
export function createOtpClient({ role, fns, localKeys, onVerified }) {
  const PENDING_KEY = `${role}OtpPending`;
  const callStart = wrap(fns.start);
  const callResend = wrap(fns.resend);
  const callVerify = wrap(fns.verify);

  const getPending = () => {
    const raw = safe(() => sessionStorage.getItem(PENDING_KEY));
    return raw ? safe(() => JSON.parse(raw)) || null : null;
  };
  const setPending = (data) => safe(() => sessionStorage.setItem(PENDING_KEY, JSON.stringify(data)));
  const clearPending = () => safe(() => sessionStorage.removeItem(PENDING_KEY));
  const clearLocal = () => localKeys.forEach((k) => safe(() => localStorage.removeItem(k)));

  async function signOutUser({ keepPending = false } = {}) {
    try {
      if (auth.currentUser) await signOut(auth);
    } catch {
      /* ignore */
    }
    clearLocal();
    if (!keepPending) clearPending();
  }

  async function start(identifier, password) {
    await signOutUser();
    const data = await callStart({ identifier: identifier.trim(), password: password.trim() });
    setPending({ ...data, clientTime: Date.now() });
    return data;
  }

  async function resend() {
    const pending = getPending();
    if (!pending?.otpSessionId) throw new Error("Session-ka lama helin. Fadlan mar kale login samee.");
    const data = await callResend({ otpSessionId: pending.otpSessionId });
    setPending({ ...pending, ...data, alreadySent: false, clientTime: Date.now() });
    return data;
  }

  async function verify(code) {
    const pending = getPending();
    if (!pending?.otpSessionId) throw new Error("Session-ka lama helin. Fadlan mar kale login samee.");
    const data = await callVerify({ otpSessionId: pending.otpSessionId, code: String(code).trim() });
    await signInWithCustomToken(auth, data.token);
    clearPending();
    return onVerified(data);
  }

  /** Claims-ka user-ka hadda jira: role sax + OTP la xaqiijiyey + 12 saacadood gudahood. */
  async function getVerifiedClaims(user) {
    if (!user) return null;
    const res = await user.getIdTokenResult();
    const c = res.claims || {};
    if (c.role !== role || c.otpVerified !== true) return null;
    const authTimeMs = Number(c.auth_time || 0) * 1000;
    if (!authTimeMs || Date.now() - authTimeMs > SESSION_MAX_AGE_MS) return null;
    return c;
  }

  return { start, resend, verify, getPending, clearPending, signOut: signOutUser, getVerifiedClaims };
}

/* =============================== ADMIN ================================= */
export const ADMIN_SESSION_MAX_AGE_MS = SESSION_MAX_AGE_MS;

export const adminOtpClient = createOtpClient({
  role: "admin",
  fns: { start: "adminLoginStart", resend: "resendAdminOtp", verify: "verifyAdminOtp" },
  localKeys: ["adminId", "adminName", "adminRole", "adminPermissions"],
  onVerified: (data) => {
    // Keys-kan waxaa isticmaala Sidebar/Topbar/Settings (UI keliya). Ilaalinta
    // dhabta ah waa Firebase Auth claims (AdminRoute.jsx) + Firestore Rules.
    localStorage.setItem("adminId", data.admin.id);
    localStorage.setItem("adminName", data.admin.name);
    localStorage.setItem("adminRole", data.admin.role || "admin");
    localStorage.setItem("adminPermissions", JSON.stringify(data.admin.permissions || []));
    return data.admin;
  },
});

export const startAdminLogin = adminOtpClient.start;
export const resendAdminOtp = adminOtpClient.resend;
export const verifyAdminOtp = adminOtpClient.verify;
export const getPendingOtp = adminOtpClient.getPending;
export const clearPendingOtp = adminOtpClient.clearPending;
export const signOutAdmin = adminOtpClient.signOut;
export const getVerifiedAdminClaims = async (user) => {
  const c = await adminOtpClient.getVerifiedClaims(user);
  return c && c.adminId ? c : null;
};

/* ============================== TEACHER ================================ */
export const teacherOtpClient = createOtpClient({
  role: "teacher",
  fns: { start: "teacherLoginStart", resend: "resendTeacherOtp", verify: "verifyTeacherOtp" },
  localKeys: ["teacherId", "teacherName", "teacherPhoto"],
  onVerified: (data) => {
    // teacherId = doc id-ga teachers/{id} — boggagga teacher-ku waxay ku akhriyaan.
    localStorage.setItem("teacherId", data.account.id);
    localStorage.setItem("teacherName", data.account.name);
    if (data.account.photo) localStorage.setItem("teacherPhoto", data.account.photo);
    return data.account;
  },
});

export const startTeacherLogin = teacherOtpClient.start;
export const resendTeacherOtp = teacherOtpClient.resend;
export const verifyTeacherOtp = teacherOtpClient.verify;
export const signOutTeacher = teacherOtpClient.signOut;
export const getVerifiedTeacherClaims = async (user) => {
  const c = await teacherOtpClient.getVerifiedClaims(user);
  return c && c.teacherId ? c : null;
};