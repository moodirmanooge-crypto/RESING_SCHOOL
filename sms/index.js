/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const { setGlobalOptions } = require("firebase-functions");
const logger = require("firebase-functions/logger");

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit.
setGlobalOptions({ maxInstances: 10 });

// ============================================================
// SEND SMS — Hormuud SMS API (sendBulkSms)
// ============================================================
const { onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const axios = require("axios");
if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

const HORMUUD_USERNAME = defineSecret("HORMUUD_USERNAME");
const HORMUUD_PASSWORD = defineSecret("HORMUUD_PASSWORD");
const HORMUUD_SENDERID = defineSecret("HORMUUD_SENDERID");

const TOKEN_URL = "https://smsapi.hormuud.com/token";
const SEND_URL = "https://smsapi.hormuud.com/api/SendSMS";

async function getHormuudToken(username, password) {
  const payload = new URLSearchParams();
  payload.append("grant_type", "password");
  payload.append("username", username);
  payload.append("password", password);

  try {
    const res = await axios.post(TOKEN_URL, payload.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    if (!res.data || !res.data.access_token) {
      logger.error("Hormuud token response missing access_token:", res.data);
      throw new HttpsError(
        "internal",
        "Ma helin token Hormuud (access_token) — hubi username/password."
      );
    }
    return res.data.access_token;
  } catch (err) {
    if (err instanceof HttpsError) throw err;

    const hormuudError = err.response?.data || err.message;
    logger.error("Hormuud token error:", hormuudError);
    throw new HttpsError(
      "internal",
      `Hormuud token error: ${JSON.stringify(hormuudError)}`
    );
  }
}

async function sendOneSms(token, mobile, message, senderid) {
  try {
    const res = await axios.post(
      SEND_URL,
      {
        refid: "0",
        mobile,
        message,
        senderid: senderid || "RESING",
        validity: 0,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const code = res.data?.ResponseCode || res.data?.Data?.ResponseCode;
    const ok = String(code) === "200" || res.status === 200;
    return {
      mobile,
      success: ok,
      responseCode: code || String(res.status),
      message: res.data?.ResponseMessage || "Sent",
    };
  } catch (err) {
    return {
      mobile,
      success: false,
      responseCode: err.response?.data?.ResponseCode || "ERROR",
      message: err.response?.data?.ResponseMessage || err.message,
    };
  }
}

function cleanPhone(raw) {
  if (!raw) return null;
  const cleaned = String(raw).trim().replace(/[\s-]/g, "").replace(/^\+/, "");
  return cleaned || null;
}

async function resolveRecipients(audience, targetId) {
  const recipients = [];

  if (audience === "all_parents") {
    const snap = await db.collection("students").get();
    const seen = new Set();
    snap.forEach((doc) => {
      const d = doc.data();
      const phone = cleanPhone(d.parentPhone);
      if (phone && !seen.has(phone)) {
        seen.add(phone);
        recipients.push({ phone, label: `Parent of ${d.fullName || doc.id}` });
      }
    });
  }

  if (audience === "one_parent" && targetId) {
    const doc = await db.collection("students").doc(targetId).get();
    if (doc.exists) {
      const d = doc.data();
      const phone = cleanPhone(d.parentPhone);
      if (phone) recipients.push({ phone, label: `Parent of ${d.fullName || doc.id}` });
    }
  }

  if (audience === "all_teachers" || audience === "one_teacher") {
    const snap = audience === "one_teacher" && targetId
      ? [await db.collection("teachers").doc(targetId).get()]
      : (await db.collection("teachers").get()).docs;

    snap.forEach((doc) => {
      if (!doc.exists) return;
      const d = doc.data();
      const phone = cleanPhone(d.phone || d.teacherPhone || d.mobile);
      if (phone) recipients.push({ phone, label: d.fullName || doc.id });
    });
  }

  if (audience === "all_students" || audience === "one_student") {
    const snap = audience === "one_student" && targetId
      ? [await db.collection("students").doc(targetId).get()]
      : (await db.collection("students").get()).docs;

    snap.forEach((doc) => {
      if (!doc.exists) return;
      const d = doc.data();
      const phone = cleanPhone(d.studentPhone);
      if (phone) recipients.push({ phone, label: d.fullName || doc.id });
    });
  }

  const uniqueMap = new Map();
  recipients.forEach((r) => {
    if (!uniqueMap.has(r.phone)) uniqueMap.set(r.phone, r);
  });
  return Array.from(uniqueMap.values());
}

exports.sendBulkSms = onRequest(
  {
    region: "us-central1",
    secrets: [HORMUUD_USERNAME, HORMUUD_PASSWORD, HORMUUD_SENDERID],
    cors: true,
  },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "https://resingstarschools.com");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    logger.info("sendBulkSms started", {
      audience: req.body?.audience,
      targetId: req.body?.targetId,
    });

    try {
      const { audience, targetId, message } = req.body || {};

      logger.info("Incoming request", {
        audience,
        targetId,
      });

      if (!audience) {
        res.status(400).json({
          error: "Audience is required.",
        });
        return;
      }

      if (!message || !message.trim()) {
        res.status(400).json({
          error: "Message is required.",
        });
        return;
      }

      const recipients = await resolveRecipients(audience, targetId);

      logger.info("Recipients found", {
        count: recipients.length,
      });

      if (recipients.length === 0) {
        res.status(404).json({
          error: "No recipients found.",
        });
        return;
      }

      const token = await getHormuudToken(
        HORMUUD_USERNAME.value(),
        HORMUUD_PASSWORD.value()
      );

      logger.info("Hormuud token received");

      const senderid = HORMUUD_SENDERID.value();

      const results = [];

      for (const r of recipients) {
        // eslint-disable-next-line no-await-in-loop
        const result = await sendOneSms(
          token,
          r.phone,
          message.trim(),
          senderid
        );

        results.push({
          ...result,
          label: r.label,
        });
      }

      res.json({
        total: results.length,
        successCount: results.filter(r => r.success).length,
        failCount: results.filter(r => !r.success).length,
        results,
      });

    } catch (err) {

      logger.error("sendBulkSms FAILED", err);

      if (err instanceof HttpsError) {
        res.status(500).json({
          error: err.message || "Unknown error",
        });
        return;
      }

      res.status(500).json({
        error: err.message || "Unknown error",
      });
    }
  }
);