//src/student/Dashboard.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import StudentIdCard from "./StudentIdCard";
import CertificateCard from "../admin/components/CertificateCard";
import schoolLogo from "../assets/logo.png";

// Midabada waxaa laga soo qaatay logada dugsiga:
// cagaar (wareegga + caleemaha), buluug (gaashaanka), oranji/jaalle (qorraxda).
const COLORS = {
  bg: "#f2f7f4",
  panel: "#ffffff",
  panelSoft: "#f6faf7",
  border: "#e1ebe5",
  text: "#0f2a1d",
  textDim: "#5f7268",
  accent: "#1f9d4c", // cagaar
  accentDark: "#0f5c2e",
  accentSoft: "rgba(31,157,76,0.10)",
  blue: "#1d6fd1", // buluug
  blueSoft: "rgba(29,111,209,0.10)",
  orange: "#f7941d", // qorraxda
  sun: "#fbbf24",
  orangeSoft: "rgba(247,148,29,0.12)",
  warn: "#e88a0c",
  danger: "#e5484d",
};

const BADGE_COLORS = [
  "#1f9d4c",
  "#1d6fd1",
  "#f7941d",
  "#0f8b8d",
  "#2fae63",
  "#3b82f6",
  "#e88a0c",
];

function subjectIcon(subject) {
  const s = (subject || "").toLowerCase();
  if (s.includes("islam")) return "🌙";
  if (s.includes("arab") || s.includes("afso")) return "📖";
  if (s.includes("somali")) return "⭐";
  if (s.includes("cilmi") || s.includes("bio") || s.includes("bilis")) return "🧪";
  if (s.includes("say") || s.includes("science")) return "🌐";
  if (s.includes("xisaab") || s.includes("math")) return "🧮";
  if (s.includes("english") || s.includes("ingiriis")) return "💬";
  return "📘";
}

const CLASS_ORDER = ["1", "2", "3", "4", "5", "6", "7", "8", "F1", "F2", "F3", "F4"];
function classRank(className) {
  const idx = CLASS_ORDER.indexOf(String(className || "").toUpperCase());
  return idx === -1 ? 999 : idx;
}
function groupByClass(items) {
  const groups = {};
  items.forEach((item) => {
    const key = String(item.className || "Unknown").toUpperCase();
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });
  return Object.entries(groups).sort(
    ([a], [b]) => classRank(a) - classRank(b)
  );
}

const DAYS = [
  { key: "Saturday", label: "Saturday" },
  { key: "Sunday", label: "Sunday" },
  { key: "Monday", label: "Monday" },
  { key: "Tuesday", label: "Tuesday" },
  { key: "Wednesday", label: "Wednesday" },
];

const FULL_TIME_DAYS = DAYS;
const PART_TIME_DAYS = [
  { key: "Thursday", label: "Thursday" },
  { key: "Friday", label: "Friday" },
];

// ---- Xogta Developer-ka: 3-da luqadood (Soomaali / English / Carabi) ----
// Halkan ayaad ka bedeli kartaa qoraalka haddii mustaqbalka wax isbedel ah timaado.
const DEVELOPER_INFO = {
  so: {
    tabLabel: "🇸🇴 Soomaali",
    heading: "Ku Saabsan Developer-ka",
    paragraphs: [
      "GALLAD.TECH_PLATFORMS waa madal teknoolojiyadeed iyo xalal dijitaal ah oo uu aasaasay Gulled Ibrahim Dahir, kuna takhasustay dhisidda adeegyo dijitaal ah oo casri ah, la isku halayn karo, isla markaana si fudud loo isticmaali karo.",
      "Waxaan naqshadeynaa oo horumarinnaa websites, mobile applications, business systems, iyo xalal dijitaal ah oo gaar loo sameeyo, kuwaas oo ka caawiya ganacsiyada, hay'adaha iyo shaqsiyaadka inay horumariyaan adeeggooda ayna ka faa'iideystaan teknoolojiyadda.",
    ],
    developerLabel: "Developer:",
    platformLabel: "Platform:",
    contactLabel: "La xiriir Developer-ka",
    quote: "“Waxaan fikradaha u beddelnaa xalal dijitaal ah oo casri ah.”",
  },
  en: {
    tabLabel: "🇬🇧 English",
    heading: "About the Developer",
    paragraphs: [
      "GALLAD.TECH_PLATFORMS is a technology and digital solutions platform founded by Gulled Ibrahim Dahir, focused on creating modern, reliable, and user-friendly digital products.",
      "We design and develop websites, mobile applications, business systems, and customized digital solutions that help businesses, organizations, and individuals improve their services and grow through technology.",
    ],
    developerLabel: "Developer:",
    platformLabel: "Platform:",
    contactLabel: "Contact the Developer",
    quote: "“Turning ideas into modern digital solutions.”",
  },
  ar: {
    tabLabel: "🇸🇦 العربية",
    heading: "عن المطوّر",
    paragraphs: [
      "GALLAD.TECH_PLATFORMS هي منصة متخصصة في التكنولوجيا والحلول الرقمية، أسسها Gulled Ibrahim Dahir، وتركّز على إنشاء منتجات رقمية حديثة وموثوقة وسهلة الاستخدام.",
      "نقوم بتصميم وتطوير المواقع الإلكترونية، وتطبيقات الهاتف المحمول، وأنظمة الأعمال، والحلول الرقمية المخصصة التي تساعد الشركات والمؤسسات والأفراد على تطوير خدماتهم والاستفادة من التكنولوجيا لتحقيق النمو.",
    ],
    developerLabel: "المطوّر:",
    platformLabel: "المنصة:",
    contactLabel: "للتواصل مع المطوّر",
    quote: "«نحوّل الأفكار إلى حلول رقمية حديثة.»",
  },
};

const DEVELOPER_NAME = "Gulled Ibrahim Dahir";
const DEVELOPER_PLATFORM = "GALLAD.TECH_PLATFORMS";
const DEVELOPER_CONTACT_URL = "https://galladtech.com/bio";
// Sawirka wuxuu ku jiraa folder-ka public/ -> waxaa laga helaa "/gulled.png"
const DEVELOPER_PHOTO = "/gulled.png";

// Types the given text out one character at a time, once, starting after
// `startDelay` ms. Used once for the lede — the single deliberate
// "written by hand" moment on this page, not repeated elsewhere.
function TypewriterText({ text, startDelay = 0, speed = 18, className, style }) {
  const [shown, setShown] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let i = 0;
    let timer;
    setShown("");
    setDone(false);
    const startTimer = setTimeout(() => {
      timer = setInterval(() => {
        i += 1;
        setShown(text.slice(0, i));
        if (i >= text.length) {
          clearInterval(timer);
          setDone(true);
        }
      }, speed);
    }, startDelay);

    return () => {
      clearTimeout(startTimer);
      clearInterval(timer);
    };
  }, [text, startDelay, speed]);

  return (
    <p className={className} style={style}>
      {shown}
      {!done && <span className="typewriter-cursor">&nbsp;</span>}
    </p>
  );
}

// Bogga "About Developer": sawirka, magaca, madasha, 3-da luqadood iyo
// badhanka la xiriirka.
function DeveloperProfile() {
  const [lang, setLang] = useState("so");
  const [photoOk, setPhotoOk] = useState(true);
  const info = DEVELOPER_INFO[lang];
  const isRtl = lang === "ar";

  return (
    <section className="rs-panel dev-card" style={{ ...styles.panel, padding: 0 }}>
      {/* Banner */}
      <div className="dev-banner">
        <div className="dev-banner-glow" />
      </div>

      <div className="dev-body">
        {/* Sawirka + magaca */}
        <div className="dev-identity">
          <div className="dev-photo-ring">
            {photoOk ? (
              <img
                src={DEVELOPER_PHOTO}
                alt={DEVELOPER_NAME}
                className="dev-photo"
                onError={() => setPhotoOk(false)}
              />
            ) : (
              <div className="dev-photo dev-photo-fallback">GI</div>
            )}
          </div>
          <div className="dev-name">{DEVELOPER_NAME}</div>
          <div className="dev-platform-chip">{DEVELOPER_PLATFORM}</div>
        </div>

        {/* Qoraalka */}
        <div className="dev-content">
          <div className="dev-lang-tabs">
            {Object.entries(DEVELOPER_INFO).map(([key, val]) => (
              <button
                key={key}
                type="button"
                onClick={() => setLang(key)}
                className={"dev-lang-tab" + (lang === key ? " active" : "")}
              >
                {val.tabLabel}
              </button>
            ))}
          </div>

          <div dir={isRtl ? "rtl" : "ltr"} style={{ textAlign: isRtl ? "right" : "left" }}>
            <h2 className="dev-heading">{info.heading}</h2>

            <TypewriterText
              key={lang}
              text={info.paragraphs[0]}
              startDelay={150}
              speed={14}
              className="dev-paragraph"
            />
            {info.paragraphs.slice(1).map((p, i) => (
              <p key={`${lang}-${i}`} className="dev-paragraph dev-fade">
                {p}
              </p>
            ))}

            <div className="dev-meta">
              <div className="dev-meta-row">
                <span className="dev-meta-label">{info.developerLabel}</span>
                <span className="dev-meta-value">{DEVELOPER_NAME}</span>
              </div>
              <div className="dev-meta-row">
                <span className="dev-meta-label">{info.platformLabel}</span>
                <span className="dev-meta-value">{DEVELOPER_PLATFORM}</span>
              </div>
              <div className="dev-meta-row">
                <span className="dev-meta-label">Bio:</span>
                <a
                  href={DEVELOPER_CONTACT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="dev-meta-link"
                  dir="ltr"
                >
                  {DEVELOPER_CONTACT_URL}
                </a>
              </div>
            </div>

            <blockquote className="dev-quote">{info.quote}</blockquote>
          </div>
        </div>
      </div>
    </section>
  );
}

function ResponsiveStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

      .rs-page {
        min-height: 100vh;
        background:
          radial-gradient(1100px 500px at 100% -10%, rgba(29,111,209,0.08), transparent 60%),
          radial-gradient(900px 500px at -10% 110%, rgba(31,157,76,0.10), transparent 60%),
          ${COLORS.bg};
        color: ${COLORS.text};
        font-family: 'Plus Jakarta Sans','Inter','Segoe UI',system-ui,sans-serif;
      }
      .rs-layout { display: flex; min-height: 100vh; }

      /* ---------- Sidebar (cagaarka logada) ---------- */
      .rs-sidebar {
        width: 264px;
        flex-shrink: 0;
        position: sticky;
        top: 0;
        height: 100vh;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 22px 18px 16px;
        background: linear-gradient(170deg, #0e5a2c 0%, #13773b 55%, #0c4a25 100%);
        color: #fff;
        box-shadow: 6px 0 30px rgba(15,92,46,0.18);
        overflow: hidden;
      }
      .rs-sidebar::before {
        content: "";
        position: absolute;
        right: -90px; top: -90px;
        width: 240px; height: 240px; border-radius: 50%;
        background: radial-gradient(circle, rgba(251,191,36,0.35), transparent 70%);
        pointer-events: none;
      }
      .rs-brand { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px; position: relative; }
      .rs-logo-ring {
        width: 92px; height: 92px; border-radius: 50%;
        background: #fff;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 0 0 4px rgba(255,255,255,0.18), 0 12px 26px rgba(0,0,0,0.25);
        overflow: hidden;
      }
      .rs-logo-ring img { width: 90%; height: 90%; object-fit: contain; }
      .rs-brand-title { font-size: 15px; font-weight: 800; letter-spacing: 0.02em; }
      .rs-brand-sub {
        font-size: 10.5px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase;
        color: ${COLORS.sun};
      }
      .rs-nav { display: flex; flex-direction: column; gap: 4px; flex: 1; min-height: 0; overflow-y: auto; position: relative; padding-right: 2px; }
      .rs-nav::-webkit-scrollbar { width: 5px; }
      .rs-nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 6px; }
      .rs-nav-item {
        display: flex; align-items: center; gap: 12px;
        padding: 11px 14px;
        border-radius: 12px;
        border: 1px solid transparent;
        background: transparent;
        color: rgba(255,255,255,0.82);
        font-size: 14px; font-weight: 600;
        cursor: pointer; text-align: left;
        font-family: inherit;
        transition: background .18s ease, transform .18s ease;
      }
      .rs-nav-item:hover { background: rgba(255,255,255,0.08); transform: translateX(3px); }
      .rs-nav-item.active {
        background: #fff;
        color: ${COLORS.accentDark};
        font-weight: 800;
        box-shadow: 0 8px 20px rgba(0,0,0,0.18);
      }
      .rs-nav-icon {
        width: 30px; height: 30px; border-radius: 9px;
        display: flex; align-items: center; justify-content: center;
        background: rgba(255,255,255,0.12);
        font-size: 15px; flex-shrink: 0;
      }
      .rs-nav-item.active .rs-nav-icon { background: ${COLORS.orangeSoft}; }
      .rs-nav-label { flex: 1; }
      .rs-nav-badge {
        background: ${COLORS.orange}; color: #fff;
        font-size: 11px; font-weight: 800;
        padding: 1px 8px; border-radius: 999px;
      }

      .rs-logout {
        padding: 11px 14px;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.25);
        background: rgba(0,0,0,0.12);
        color: #fff;
        font-size: 13px; font-weight: 700;
        cursor: pointer; font-family: inherit;
      }
      .rs-logout:hover { background: rgba(229,72,77,0.35); }

      /* ---------- Main ---------- */
      .rs-main { flex: 1; padding: 30px 38px 40px; overflow-y: auto; min-width: 0; }

      .rs-hero {
        position: relative;
        overflow: hidden;
        display: flex; align-items: center; justify-content: space-between; gap: 18px;
        padding: 26px 30px;
        margin-bottom: 24px;
        border-radius: 22px;
        background: linear-gradient(120deg, ${COLORS.accentDark} 0%, ${COLORS.accent} 52%, ${COLORS.blue} 100%);
        color: #fff;
        box-shadow: 0 18px 40px rgba(15,92,46,0.22);
      }
      .rs-hero::after {
        content: ""; position: absolute; right: 110px; top: -70px;
        width: 220px; height: 220px; border-radius: 50%;
        background: radial-gradient(circle, rgba(251,191,36,0.55), rgba(247,148,29,0.15) 45%, transparent 70%);
        pointer-events: none;
      }
      .rs-hero-left { position: relative; z-index: 1; min-width: 0; }
      .rs-hero-eyebrow {
        display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
        font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;
        color: rgba(255,255,255,0.85); margin-bottom: 8px;
      }
      .rs-hero-title { margin: 0; font-size: 30px; font-weight: 800; line-height: 1.15; }
      .rs-hero-sub { margin: 6px 0 0; font-size: 14px; color: rgba(255,255,255,0.85); }
      .rs-hero-class {
        position: relative; z-index: 1; flex-shrink: 0;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        width: 88px; height: 88px; border-radius: 22px;
        background: rgba(255,255,255,0.16);
        border: 1px solid rgba(255,255,255,0.3);
        backdrop-filter: blur(4px);
      }
      .rs-hero-class small { font-size: 10.5px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.85; }
      .rs-hero-class strong { font-size: 30px; font-weight: 800; line-height: 1.1; }

      .rs-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
      .rs-detail-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
      .rs-detail-item {
        background: ${COLORS.panelSoft};
        border: 1px solid ${COLORS.border};
        border-radius: 14px;
        padding: 14px 16px;
      }
      .rs-payment-summary-row { display: flex; gap: 16px; margin-bottom: 20px; }
      .rs-table-wrap { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
      .rs-table { width: 100%; border-collapse: collapse; min-width: 420px; }
      .rs-table tbody tr:hover td { background: ${COLORS.panelSoft}; }
      .rs-bottom-nav { display: none; }
      .rs-mobile-topbar { display: none; }
      .rs-day-tabs { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; margin-bottom: 16px; }

      .rs-stat {
        display: flex; align-items: center; gap: 16px;
        transition: transform .18s ease, box-shadow .18s ease;
      }
      .rs-stat:hover { transform: translateY(-3px); box-shadow: 0 16px 34px rgba(15,42,29,0.10) !important; }
      .rs-stat-icon {
        width: 54px; height: 54px; border-radius: 16px;
        display: flex; align-items: center; justify-content: center;
        font-size: 24px; flex-shrink: 0;
      }

      /* ---------- About Developer ---------- */
      .dev-banner {
        position: relative; height: 150px; overflow: hidden;
        background: linear-gradient(120deg, ${COLORS.accentDark} 0%, ${COLORS.accent} 50%, ${COLORS.blue} 100%);
      }
      .dev-banner-glow {
        position: absolute; right: 12%; top: -90px;
        width: 260px; height: 260px; border-radius: 50%;
        background: radial-gradient(circle, rgba(251,191,36,0.6), rgba(247,148,29,0.15) 45%, transparent 70%);
      }
      /* Sawirku had iyo jeer wuxuu dul fadhiyaa banner-ka (lama daboolo) */
      .dev-body { position: relative; z-index: 2; display: grid; grid-template-columns: 270px 1fr; gap: 30px; padding: 0 30px 30px; }
      .dev-identity { display: flex; flex-direction: column; align-items: center; text-align: center; margin-top: -78px; }
      .dev-photo-ring {
        width: 156px; height: 156px; border-radius: 50%; padding: 5px;
        background: conic-gradient(from 200deg, ${COLORS.accent}, ${COLORS.blue}, ${COLORS.orange}, ${COLORS.accent});
        box-shadow: 0 16px 36px rgba(15,42,29,0.25);
      }
      .dev-photo {
        width: 100%; height: 100%; border-radius: 50%;
        object-fit: cover; object-position: center top;
        border: 5px solid #fff; display: block; box-sizing: border-box;
        background: ${COLORS.panelSoft};
      }
      .dev-photo-fallback { display: flex; align-items: center; justify-content: center; font-size: 40px; font-weight: 800; color: ${COLORS.accent}; }
      .dev-name { margin-top: 14px; font-size: 20px; font-weight: 800; color: ${COLORS.text}; }
      .dev-platform-chip {
        margin-top: 8px; font-size: 11.5px; font-weight: 800; letter-spacing: 0.6px;
        color: ${COLORS.blue}; background: ${COLORS.blueSoft};
        border: 1px solid rgba(29,111,209,0.25);
        padding: 5px 12px; border-radius: 999px;
      }
      .dev-content { padding-top: 24px; min-width: 0; }
      .dev-lang-tabs { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 18px; }
      .dev-lang-tab {
        border: 1px solid ${COLORS.border}; background: ${COLORS.panelSoft};
        color: ${COLORS.textDim}; font-weight: 700; font-size: 13px;
        padding: 9px 15px; border-radius: 12px; cursor: pointer; font-family: inherit;
      }
      .dev-lang-tab.active { background: ${COLORS.accent}; border-color: ${COLORS.accent}; color: #fff; box-shadow: 0 8px 18px rgba(31,157,76,0.25); }
      .dev-heading { margin: 0 0 14px; font-size: 24px; font-weight: 800; color: ${COLORS.text}; }
      .dev-paragraph { margin: 0 0 12px; font-size: 14.5px; line-height: 1.8; color: #3d5247; min-height: 1.8em; }
      .dev-fade { animation: devFade .6s ease both; animation-delay: .3s; }
      @keyframes devFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
      .typewriter-cursor { display: inline-block; width: 2px; margin-inline-start: 2px; background: ${COLORS.accent}; animation: devBlink 0.9s steps(1) infinite; }
      @keyframes devBlink { 50% { opacity: 0; } }
      .dev-meta { display: flex; flex-direction: column; gap: 9px; margin: 18px 0; padding: 16px 18px; background: ${COLORS.panelSoft}; border: 1px solid ${COLORS.border}; border-radius: 14px; }
      .dev-meta-row { display: flex; gap: 10px; flex-wrap: wrap; font-size: 14px; align-items: baseline; }
      .dev-meta-label { color: ${COLORS.textDim}; font-weight: 600; }
      .dev-meta-value { color: ${COLORS.text}; font-weight: 800; }
      .dev-meta-link { color: ${COLORS.blue}; font-weight: 800; text-decoration: none; word-break: break-all; }
      .dev-meta-link:hover { text-decoration: underline; }
      .dev-quote {
        margin: 0; padding: 16px 20px;
        border-inline-start: 4px solid ${COLORS.orange};
        background: linear-gradient(90deg, ${COLORS.orangeSoft}, transparent);
        border-radius: 12px; color: ${COLORS.text};
        font-size: 15.5px; font-weight: 700; font-style: italic;
      }

      /* ---------- Mobile ---------- */
      @media (max-width: 1100px) {
        .rs-grid { grid-template-columns: repeat(2, 1fr); }
      }

      @media (max-width: 860px) {
        .rs-layout { flex-direction: column; }
        .rs-sidebar { display: none; }
        .rs-mobile-topbar {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding: 12px 16px;
          background: linear-gradient(120deg, #0e5a2c, #13773b);
          color: #fff;
          position: sticky; top: 0; z-index: 20;
          box-shadow: 0 6px 18px rgba(15,92,46,0.2);
        }
        .rs-mobile-brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .rs-mobile-brand .rs-logo-ring { width: 40px; height: 40px; box-shadow: 0 0 0 2px rgba(255,255,255,0.25); }
        .rs-main { padding: 16px 14px 96px 14px; }
        .rs-hero { padding: 20px 18px; border-radius: 18px; }
        .rs-hero-title { font-size: 22px; }
        .rs-hero-class { width: 64px; height: 64px; border-radius: 16px; }
        .rs-hero-class strong { font-size: 22px; }
        .rs-grid { grid-template-columns: 1fr; gap: 12px; }
        .rs-detail-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
        .rs-payment-summary-row { flex-direction: column; gap: 10px; }
        .rs-panel { padding: 16px; border-radius: 16px; }
        .rs-stat-value { font-size: 22px !important; }

        .dev-body { grid-template-columns: 1fr; padding: 0 18px 22px; gap: 10px; }
        .dev-banner { height: 120px; }
        .dev-photo-ring { width: 136px; height: 136px; }
        .dev-identity { margin-top: -70px; }
        .dev-content { padding-top: 8px; }
        .dev-heading { font-size: 20px; }

        .rs-bottom-nav {
          display: flex; position: fixed; bottom: 0; left: 0; right: 0;
          background: #fff;
          border-top: 1px solid ${COLORS.border};
          box-shadow: 0 -8px 24px rgba(15,42,29,0.08);
          padding: 8px 4px calc(8px + env(safe-area-inset-bottom));
          z-index: 30; overflow-x: auto;
        }
        .rs-bottom-nav-item {
          flex: 1; min-width: 64px;
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          background: transparent; border: none;
          color: ${COLORS.textDim};
          font-size: 10.5px; font-weight: 600;
          padding: 6px 2px; position: relative; white-space: nowrap;
          font-family: inherit;
        }
        .rs-bottom-nav-item.active { color: ${COLORS.accent}; font-weight: 800; }
        .rs-bottom-dot { width: 18px; height: 3px; border-radius: 999px; background: ${COLORS.orange}; }
        .rs-bottom-badge {
          position: absolute; top: -2px; right: 18%;
          background: ${COLORS.orange}; color: #fff;
          font-size: 10px; font-weight: 800; padding: 1px 5px; border-radius: 999px;
        }
      }

      @media (max-width: 420px) {
        .rs-detail-grid { grid-template-columns: 1fr; }
      }
    `}</style>
  );
}

const NAV_ITEMS = [
  { key: "overview", label: "Overview", icon: "🏠" },
  { key: "certificate", label: "Certificate", icon: "🎓" },
  { key: "timetable", label: "Timetable", icon: "🗓️" },
  { key: "examTimetable", label: "Exam Timetable", icon: "📝" },
  { key: "attendance", label: "Attendance", icon: "📅" },
  { key: "payments", label: "Payments", icon: "💳" },
  { key: "messages", label: "Messages", icon: "💬" },
  { key: "developer", label: "About Developer", icon: "👨‍💻" },
];

async function downloadTimetableImage({ className, studentType, dayLabel }) {
  const node = document.getElementById("student-timetable-card");
  if (!node) return;

  const scrollWrap = node.querySelector(".rs-table-wrap");

  const prevNodeWidth = node.style.width;
  const prevWrapOverflow = scrollWrap ? scrollWrap.style.overflow : null;
  const prevWrapWidth = scrollWrap ? scrollWrap.style.width : null;

  try {
    if (!window.html2canvas) {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
      });
    }

    if (scrollWrap) {
      const fullWidth = scrollWrap.scrollWidth;
      scrollWrap.style.overflow = "visible";
      scrollWrap.style.width = `${fullWidth}px`;
      node.style.width = `${fullWidth}px`;
    }

    const canvas = await window.html2canvas(node, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      width: scrollWrap ? scrollWrap.scrollWidth : node.scrollWidth,
      windowWidth: scrollWrap ? scrollWrap.scrollWidth : node.scrollWidth,
    });
    const link = document.createElement("a");
    const safeType = (studentType || "full-time").toLowerCase().replace(/\s+/g, "-");
    link.download = `Timetable-${className || "class"}-${safeType}-${dayLabel || "day"}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  } catch (err) {
    console.log("Falling back to print view:", err);
    window.print();
  } finally {
    if (scrollWrap) {
      scrollWrap.style.overflow = prevWrapOverflow || "";
      scrollWrap.style.width = prevWrapWidth || "";
    }
    node.style.width = prevNodeWidth || "";
  }
}

async function downloadCertificateImage(fullName) {
  const node = document.getElementById("certificate-render-card");
  if (!node) return;

  try {
    if (!window.html2canvas) {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
      });
    }

    const canvas = await window.html2canvas(node, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
    });
    const link = document.createElement("a");
    link.download = `Certificate-${(fullName || "student").replace(/\s+/g, "-")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  } catch (err) {
    console.log("Falling back to print view:", err);
    window.print();
  }
}

export default function StudentDashboard() {
  const navigate = useNavigate();
  const studentId = localStorage.getItem("studentId");
  const storedStudentType = localStorage.getItem("studentType"); // fulltime, parttime, ama private

  const [student, setStudent] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [messages, setMessages] = useState([]);
  const [payments, setPayments] = useState([]);
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);

  const [timetableByDay, setTimetableByDay] = useState({});
  const [examTimetableByDay, setExamTimetableByDay] = useState({});
  const [examWeek, setExamWeek] = useState(null);
  const [timetableDays, setTimetableDays] = useState(FULL_TIME_DAYS);
  const [activeTimetableDay, setActiveTimetableDay] = useState(FULL_TIME_DAYS[0].key);
  const [activeExamDay, setActiveExamDay] = useState(DAYS[0].key);
  const [teacherNames, setTeacherNames] = useState({});
  const [certificate, setCertificate] = useState(null);

  useEffect(() => {
    if (!studentId) {
      navigate("/student-login");
      return;
    }

    const load = async () => {
      try {
        let className = null;
        let studentSnap = null;
        let studentTypeLabel = "Full Time";

        // Ka baadh collection-yada adigoo isticmaalaya localStorage studentType ama si tartiib ah u raadi
        if (storedStudentType === "private") {
          studentSnap = await getDoc(doc(db, "PrivateStudent", studentId));
          studentTypeLabel = "Private";
        } else if (storedStudentType === "parttime") {
          studentSnap = await getDoc(doc(db, "partTimeStudents", studentId));
          studentTypeLabel = "Part Time";
        } else {
          // Default ama fulltime
          studentSnap = await getDoc(doc(db, "students", studentId));
          if (!studentSnap.exists()) {
            studentSnap = await getDoc(doc(db, "partTimeStudents", studentId));
            if (studentSnap.exists()) studentTypeLabel = "Part Time";
            else {
              studentSnap = await getDoc(doc(db, "PrivateStudent", studentId));
              if (studentSnap.exists()) studentTypeLabel = "Private";
            }
          }
        }

        let isPartTime = studentTypeLabel === "Part Time";
        let isPrivate = studentTypeLabel === "Private";

        if (studentSnap && studentSnap.exists()) {
          const sData = studentSnap.data();
          const data = {
            id: studentSnap.id,
            ...sData,
            studentType: studentTypeLabel,
          };
          setStudent(data);
          className = data.className;
        }

        // Attendance-ka lagama soo saaro ardayda Private-ka ah
        if (!isPrivate) {
          try {
            const attQ = query(
              collection(db, "attendance"),
              where("studentId", "==", studentId)
            );
            const attSnap = await getDocs(attQ);
            setAttendance(attSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
          } catch (e) {
            setAttendance([]);
          }
        } else {
          setAttendance([]);
        }

        try {
          const teachersSnap = await getDocs(collection(db, "teachers"));
          const map = {};
          teachersSnap.docs.forEach((d) => {
            const data = d.data();
            map[d.id] = data.fullName || data.username || d.id;
          });
          setTeacherNames(map);
        } catch (e) {
          setTeacherNames({});
        }

        const timetableCollectionName = isPartTime
          ? "timetablePartTime"
          : "timetable";
        const activeDaysForType = isPartTime ? PART_TIME_DAYS : FULL_TIME_DAYS;
        setTimetableDays(activeDaysForType);
        setActiveTimetableDay(activeDaysForType[0].key);

        if (className) {
          try {
            const ttMap = {};
            await Promise.all(
              activeDaysForType.map(async (d) => {
                const snap = await getDoc(
                  doc(db, timetableCollectionName, `${className}__${d.key}`)
                );
                if (snap.exists()) ttMap[d.key] = snap.data();
              })
            );
            setTimetableByDay(ttMap);
          } catch (e) {
            setTimetableByDay({});
          }

          try {
            const examMap = {};
            await Promise.all(
              DAYS.map(async (d) => {
                const snap = await getDoc(
                  doc(db, "examTimetable", `${className}__${d.key}`)
                );
                if (snap.exists()) examMap[d.key] = snap.data();
              })
            );
            setExamTimetableByDay(examMap);
          } catch (e) {
            setExamTimetableByDay({});
          }

          try {
            const wkSnap = await getDoc(doc(db, "examWeek", className));
            if (wkSnap.exists()) setExamWeek(wkSnap.data());
          } catch (e) {
            setExamWeek(null);
          }

          if (String(className).toUpperCase() === "8") {
            try {
              const certQ = query(
                collection(db, "certificates"),
                where("studentId", "==", studentId)
              );
              const certSnap = await getDocs(certQ);
              if (!certSnap.empty) {
                setCertificate({ id: certSnap.docs[0].id, ...certSnap.docs[0].data() });
              } else {
                setCertificate(null);
              }
            } catch (e) {
              setCertificate(null);
            }
          }
        }
      } finally {
        setLoading(false);
      }
    };

    load();

    let unsubscribeBroadcast = () => {};
    let unsubscribeIndividual = () => {};
    let broadcastMsgs = [];
    let individualMsgs = [];

    function mergeAndSetMessages() {
      const all = [...broadcastMsgs, ...individualMsgs];
      const seen = new Map();
      all.forEach((m) => seen.set(m.id, m));
      const merged = Array.from(seen.values()).sort((a, b) => {
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime;
      });
      setMessages(merged);
    }

    try {
      const broadcastQ = query(
        collection(db, "messages"),
        where("audienceGroup", "==", "student"),
        where("scope", "==", "broadcast")
      );
      unsubscribeBroadcast = onSnapshot(broadcastQ, (snap) => {
        broadcastMsgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        mergeAndSetMessages();
      });
    } catch (e) {
      broadcastMsgs = [];
    }

    try {
      const individualQ = query(
        collection(db, "messages"),
        where("audienceGroup", "==", "student"),
        where("scope", "==", "individual"),
        where("recipientId", "==", studentId)
      );
      unsubscribeIndividual = onSnapshot(individualQ, (snap) => {
        individualMsgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        mergeAndSetMessages();
      });
    } catch (e) {
      individualMsgs = [];
    }

    let unsubscribe = () => {};
    try {
      const paymentsQ = query(
        collection(db, "payments"),
        where("studentId", "==", studentId)
      );
      unsubscribe = onSnapshot(paymentsQ, (snap) => {
        setPayments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      });
    } catch (e) {
      setPayments([]);
    }

    return () => {
      unsubscribe();
      unsubscribeBroadcast();
      unsubscribeIndividual();
    };
  }, [studentId, navigate, storedStudentType]);

  const logout = () => {
    localStorage.removeItem("studentId");
    localStorage.removeItem("studentName");
    localStorage.removeItem("studentType");
    navigate("/student-login");
  };

  const attendanceStats = attendance.reduce(
    (acc, a) => {
      const status = (a.status || "").toLowerCase();
      if (status === "present") acc.present += 1;
      else if (status === "absent") acc.absent += 1;
      else if (status === "late") acc.late += 1;
      acc.total += 1;
      return acc;
    },
    { present: 0, absent: 0, late: 0, total: 0 }
  );
  const attendanceRate =
    attendanceStats.total > 0
      ? Math.round((attendanceStats.present / attendanceStats.total) * 100)
      : null;

  const isFreeStudent = String(student?.feeType || "").toLowerCase() === "free";
  const isPrivateStudent = String(student?.studentType || "").toLowerCase() === "private";

  const sortedPayments = [...payments].sort((a, b) => {
    if (a.monthKey && b.monthKey) return b.monthKey.localeCompare(a.monthKey);
    const aTime = a.createdAt?.seconds || 0;
    const bTime = b.createdAt?.seconds || 0;
    return bTime - aTime;
  });

  const totalPaid = payments.reduce(
    (sum, p) => sum + (Number(p.paidAmount) || 0),
    0
  );
  const monthlyFee =
    Number(student?.monthlyFee) ||
    Number(sortedPayments[0]?.monthlyFee) ||
    0;

  const latestPayment = sortedPayments[0];
  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const isCurrentMonthPaid =
    isFreeStudent ||
    (latestPayment?.monthKey === currentMonthKey &&
      latestPayment?.status === "Paid");

  const isClass8 = String(student?.className || "").toUpperCase() === "8";
  
  // Halkan ayaa laga reebayaa Attendance-ka haddii uu yahay Private student
  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (item.key === "certificate" && !isClass8) return false;
    if (item.key === "attendance" && isPrivateStudent) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="rs-page" style={{ alignItems: "center", justifyContent: "center", display: "flex" }}>
        <ResponsiveStyles />
        <div style={{ color: COLORS.textDim, fontSize: 14, letterSpacing: 1 }}>LOADING…</div>
      </div>
    );
  }

  return (
    <div className="rs-page">
      <ResponsiveStyles />

      <div className="rs-mobile-topbar">
        <div className="rs-mobile-brand">
          <div className="rs-logo-ring">
            <img src={schoolLogo} alt="Rising Star School" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800 }}>Rising Star School</div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: COLORS.sun, letterSpacing: "0.12em" }}>
              STUDENT PORTAL
            </div>
          </div>
        </div>
        <button onClick={logout} style={styles.logoutBtnMobile}>
          Log out
        </button>
      </div>

      <div className="rs-layout">
        <aside className="rs-sidebar">
          <div className="rs-brand">
            <div className="rs-logo-ring">
              <img src={schoolLogo} alt="Rising Star School" />
            </div>
            <div className="rs-brand-title">RISING STAR SCHOOL</div>
            <div className="rs-brand-sub">Student Portal</div>
          </div>

          <nav className="rs-nav">
            {visibleNavItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={"rs-nav-item" + (tab === item.key ? " active" : "")}
              >
                <span className="rs-nav-icon">{item.icon}</span>
                <span className="rs-nav-label">{item.label}</span>
                {item.key === "messages" && messages.length > 0 && (
                  <span className="rs-nav-badge">{messages.length}</span>
                )}
              </button>
            ))}
          </nav>

          <button onClick={logout} className="rs-logout">
            ⎋ Log out
          </button>
        </aside>

        <main className="rs-main">
          <header className="rs-hero">
            <div className="rs-hero-left">
              <div className="rs-hero-eyebrow">
                <span>Student ID {studentId}</span>
                {student?.studentType && (
                  <span
                    style={{
                      ...styles.studentTypeBadge,
                      ...(student.studentType === "Part Time"
                        ? styles.studentTypeBadgePartTime
                        : student.studentType === "Private"
                        ? styles.studentTypeBadgePrivate
                        : styles.studentTypeBadgeFullTime),
                    }}
                  >
                    {student.studentType}
                  </span>
                )}
              </div>
              <h1 className="rs-hero-title">
                {student?.fullName ? `Welcome, ${student.fullName.split(" ")[0]} 👋` : "Welcome"}
              </h1>
              <p className="rs-hero-sub">
                {NAV_ITEMS.find((n) => n.key === tab)?.label || "Overview"} · Rising Star School
              </p>
            </div>
            <div className="rs-hero-class">
              <small>Class</small>
              <strong>{student?.className || "—"}</strong>
            </div>
          </header>

          {tab === "overview" && (
            <section className="rs-grid">
              <StatCard
                icon="📅"
                label="Attendance rate"
                value={isPrivateStudent ? "N/A" : attendanceRate !== null ? `${attendanceRate}%` : "No data"}
                accent={COLORS.accent}
                soft={COLORS.accentSoft}
              />
              <StatCard
                icon="💳"
                label={student?.feeType === "Free" ? "Fee Status" : "Monthly Fee"}
                value={
                  student?.feeType === "Free"
                    ? "Free"
                    : `$${Number(student?.monthlyFee || 0).toLocaleString()}`
                }
                accent={COLORS.blue}
                soft={COLORS.blueSoft}
              />
              <StatCard
                icon="💬"
                label="Messages from admin"
                value={messages.length}
                accent={COLORS.orange}
                soft={COLORS.orangeSoft}
              />
              <div className="rs-panel" style={{ ...styles.panel, gridColumn: "1 / -1" }}>
                <div style={styles.panelTitle}>Student details</div>
                <div className="rs-detail-grid">
                  <Detail label="Full name" value={student?.fullName} />
                  <Detail label="Class" value={student?.className} />
                  <Detail label="District" value={student?.district} />
                  <Detail label="Student type" value={student?.studentType} />
                  <Detail label="Monthly fee" value={student?.monthlyFee} />
                  <Detail label="Parent phone" value={student?.parentPhone} />
                  <Detail label="Student phone" value={student?.studentPhone} />
                </div>
              </div>
            </section>
          )}

          {tab === "idCard" && (
            <section className="rs-panel" style={styles.panel}>
              <div style={styles.panelTitle}>My Student ID Card</div>
              <StudentIdCard student={student} studentId={studentId} />
            </section>
          )}

          {tab === "certificate" && isClass8 && (
            <section className="rs-panel" style={styles.panel}>
              <div style={styles.panelTitle}>My Class 8 Leaving Certificate</div>
              {certificate ? (
                <div style={{ overflowX: "auto" }}>
                  <CertificateCard
                    certificate={certificate}
                    verifyUrl={`${window.location.origin}/verify/${certificate.certificateId}`}
                  />
                  <button
                    onClick={() => downloadCertificateImage(certificate.fullName)}
                    style={{
                      marginTop: 16,
                      padding: "11px 20px",
                      borderRadius: 10,
                      border: "none",
                      background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentDark})`,
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    ⬇️ Download Certificate
                  </button>
                </div>
              ) : (
                <EmptyState text="Your leaving certificate has not been issued yet. Please check with the school administration." />
              )}
            </section>
          )}

          {tab === "timetable" && (
            <section className="rs-panel" style={styles.panel}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  marginBottom: 16,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={styles.timetableIconBadge}>🗓️</div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.text, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span>Class Timetable – {student?.className || "—"}</span>
                      {student?.studentType && (
                        <span
                          style={{
                            ...styles.studentTypeBadge,
                            ...(student.studentType === "Part Time"
                              ? styles.studentTypeBadgePartTime
                              : student.studentType === "Private"
                              ? styles.studentTypeBadgePrivate
                              : styles.studentTypeBadgeFullTime),
                          }}
                        >
                          {student.studentType}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div style={styles.academicYearPill}>🗓️ Academic Year 2024/2025</div>
                  <button
                    onClick={() =>
                      downloadTimetableImage({
                        className: student?.className,
                        studentType: student?.studentType,
                        dayLabel: timetableDays.find((d) => d.key === activeTimetableDay)?.label,
                      })
                    }
                    style={styles.downloadBtn}
                  >
                    ⬇️ Download
                  </button>
                </div>
              </div>

              <div className="rs-day-tabs">
                {timetableDays.map((d) => {
                  const isActive = d.key === activeTimetableDay;
                  const hasData = (timetableByDay[d.key]?.sessions || []).length > 0;
                  return (
                    <button
                      key={d.key}
                      onClick={() => setActiveTimetableDay(d.key)}
                      style={{
                        ...styles.dayTabBtn,
                        ...(isActive ? styles.dayTabBtnActive : {}),
                      }}
                    >
                      📅 {d.label}
                      {hasData && (
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: isActive ? "#fff" : COLORS.accent,
                            marginLeft: 6,
                            display: "inline-block",
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {(() => {
                const sessions = [...(timetableByDay[activeTimetableDay]?.sessions || [])].sort(
                  (a, b) => (a.startTime || "").localeCompare(b.startTime || "")
                );
                if (sessions.length === 0) {
                  return <EmptyState text={`No ${student?.studentType || ""} timetable set for this day yet.`} />;
                }
                return (
                  <div id="student-timetable-card" style={styles.ttCard}>
                    <div className="rs-table-wrap">
                      <div style={styles.ttCardHeaderRow}>
                        <div style={styles.ttColNum}>#</div>
                        <div style={styles.ttColStart}>START</div>
                        <div style={styles.ttColEnd}>END</div>
                        <div style={styles.ttColSubject}>SUBJECT</div>
                        <div style={styles.ttColTeacher}>TEACHER</div>
                      </div>
                      {sessions.map((s, i) => {
                        const badgeColor = BADGE_COLORS[i % BADGE_COLORS.length];
                        const teacherName =
                          s.teacherName || teacherNames[s.teacherId] || s.teacherId || "—";
                        return (
                          <div key={s.id || i} style={styles.ttRow}>
                            <div style={{ ...styles.ttNumBadge, background: badgeColor }}>
                              {s.sessionNumber ?? i + 1}
                            </div>
                            <div style={styles.ttColStart}>
                              <span style={styles.ttClockIcon}>🕐</span> {s.startTime}
                            </div>
                            <div style={styles.ttColEnd}>
                              <span style={{ color: COLORS.textDim, marginRight: 6 }}>→</span>
                              <span style={styles.ttClockIcon}>🕐</span> {s.endTime}
                            </div>
                            <div style={styles.ttColSubject}>
                              <span style={{ marginRight: 8 }}>{subjectIcon(s.subject)}</span>
                              {(s.subject || "—").toUpperCase()}
                            </div>
                            <div style={styles.ttColTeacher}>{teacherName}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={styles.ttFooterNote}>
                      ℹ️ Timetable is subject to change. Please check regularly for updates.
                    </div>
                  </div>
                );
              })()}
            </section>
          )}

          {tab === "examTimetable" && (
            <section className="rs-panel" style={styles.panel}>
              <div style={styles.panelTitle}>Exam Timetable — {student?.className || "—"}</div>
              {examWeek?.startDate && (
                <div style={{ color: COLORS.textDim, fontSize: 13, marginBottom: 14 }}>
                  Exams run from <strong style={{ color: COLORS.text }}>{examWeek.startDate}</strong>{" "}
                  to <strong style={{ color: COLORS.text }}>{examWeek.endDate}</strong>
                </div>
              )}
              <div className="rs-day-tabs">
                {DAYS.map((d) => {
                  const isActive = d.key === activeExamDay;
                  const hasData = (examTimetableByDay[d.key]?.slots || []).length > 0;
                  return (
                    <button
                      key={d.key}
                      onClick={() => setActiveExamDay(d.key)}
                      style={{
                        ...styles.dayTabBtn,
                        ...(isActive ? styles.dayTabBtnActive : {}),
                      }}
                    >
                      {d.label}
                      {hasData && (
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: isActive ? "#fff" : COLORS.orange,
                            marginLeft: 6,
                            display: "inline-block",
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {(() => {
                const slots = [...(examTimetableByDay[activeExamDay]?.slots || [])].sort(
                  (a, b) => (a.startTime || "").localeCompare(b.startTime || "")
                );
                if (slots.length === 0) {
                  return <EmptyState text="No exam scheduled for this day." />;
                }
                return (
                  <div className="rs-table-wrap">
                    <table className="rs-table" style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>#</th>
                          <th style={styles.th}>Start</th>
                          <th style={styles.th}>End</th>
                          <th style={styles.th}>Subject</th>
                        </tr>
                      </thead>
                      <tbody>
                        {slots.map((s) => (
                          <tr key={s.id}>
                            <td style={styles.td}>{s.examNumber}</td>
                            <td style={styles.td}>{s.startTime}</td>
                            <td style={styles.td}>{s.endTime}</td>
                            <td style={styles.td}>{s.subject || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </section>
          )}

          {tab === "attendance" && !isPrivateStudent && (
            <section className="rs-panel" style={styles.panel}>
              <div style={styles.panelTitle}>Attendance — all classes</div>
              {attendance.length === 0 ? (
                <EmptyState text="No attendance records yet." />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                  {groupByClass(attendance).map(([className, classAttendance]) => (
                    <div key={className}>
                      <div style={styles.classGroupLabel}>Class {className}</div>
                      <div className="rs-table-wrap">
                        <table className="rs-table" style={styles.table}>
                          <thead>
                            <tr>
                              <th style={styles.th}>Date</th>
                              <th style={styles.th}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {classAttendance.map((a) => (
                              <tr key={a.id}>
                                <td style={styles.td}>{a.date || "—"}</td>
                                <td style={styles.td}>
                                  <StatusPill status={a.status} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {tab === "payments" && (
            <section className="rs-panel" style={styles.panel}>
              <div style={styles.panelTitle}>Payments</div>
              {isFreeStudent ? (
                <>
                  <div className="rs-payment-summary-row">
                    <div style={styles.paymentSummaryCard}>
                      <div style={styles.detailLabel}>Fee status</div>
                      <div
                        className="rs-stat-value"
                        style={{ ...styles.statValue, color: COLORS.accent }}
                      >
                        Free
                      </div>
                    </div>
                    <div style={styles.paymentSummaryCard}>
                      <div style={styles.detailLabel}>Total paid</div>
                      <div
                        className="rs-stat-value"
                        style={{ ...styles.statValue, color: COLORS.accent }}
                      >
                        Free
                      </div>
                    </div>
                    <div style={styles.paymentSummaryCard}>
                      <div style={styles.detailLabel}>This month</div>
                      <div
                        style={{
                          ...styles.statValue,
                          fontSize: 18,
                          color: COLORS.accent,
                        }}
                      >
                        Free
                      </div>
                    </div>
                  </div>
                  <EmptyState text="This student is registered as Free. No fees apply." />
                </>
              ) : (
                <>
                  <div className="rs-payment-summary-row">
                    <div style={styles.paymentSummaryCard}>
                      <div style={styles.detailLabel}>Monthly fee</div>
                      <div className="rs-stat-value" style={styles.statValue}>${monthlyFee.toLocaleString()}</div>
                    </div>
                    <div style={styles.paymentSummaryCard}>
                      <div style={styles.detailLabel}>Total paid</div>
                      <div className="rs-stat-value" style={{ ...styles.statValue, color: COLORS.accent }}>
                        ${totalPaid.toLocaleString()}
                      </div>
                    </div>
                    <div style={styles.paymentSummaryCard}>
                      <div style={styles.detailLabel}>This month</div>
                      <div
                        style={{
                          ...styles.statValue,
                          fontSize: 18,
                          color: isCurrentMonthPaid ? COLORS.accent : COLORS.danger,
                        }}
                      >
                        {isCurrentMonthPaid ? "Paid" : "Not Paid"}
                      </div>
                    </div>
                  </div>
                  {sortedPayments.length === 0 ? (
                    <EmptyState text="No payments have been recorded yet." />
                  ) : (
                    <div className="rs-table-wrap">
                      <table className="rs-table" style={styles.table}>
                        <thead>
                          <tr>
                            <th style={styles.th}>Month</th>
                            <th style={styles.th}>School</th>
                            <th style={styles.th}>Paid</th>
                            <th style={styles.th}>Remaining</th>
                            <th style={styles.th}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedPayments.map((p) => (
                            <tr key={p.id}>
                              <td style={styles.td}>{p.monthLabel || p.monthKey || "—"}</td>
                              <td style={styles.td}>{p.schoolName || "—"}</td>
                              <td style={styles.td}>${Number(p.paidAmount || 0).toLocaleString()}</td>
                              <td style={styles.td}>${Number(p.remaining || 0).toLocaleString()}</td>
                              <td style={styles.td}>
                                <StatusPill status={p.status} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {tab === "messages" && (
            <section className="rs-panel" style={styles.panel}>
              <div style={styles.panelTitle}>Messages from admin</div>
              {messages.length === 0 ? (
                <EmptyState text="No messages yet." />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {messages.map((m) => (
                    <div key={m.id} style={styles.messageCard}>
                      <div style={styles.messageTitle}>{m.subject || m.title || "Announcement"}</div>
                      <div style={styles.messageBody}>{m.text || m.body}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {tab === "developer" && <DeveloperProfile />}
        </main>
      </div>

<nav className="rs-bottom-nav">
        {visibleNavItems.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`rs-bottom-nav-item${tab === item.key ? " active" : ""}`}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</span>
            <span>{item.label}</span>
            {item.key === "messages" && messages.length > 0 && (
              <span className="rs-bottom-badge">{messages.length}</span>
            )}
            {tab === item.key && <span className="rs-bottom-dot" />}
          </button>
        ))}
      </nav>
    </div>
  );
}

function StatCard({ label, value, accent, soft, icon }) {
  return (
    <div className="rs-panel rs-stat" style={styles.panel}>
      <div style={{ ...styles.statBar, background: accent }} />
      {icon && (
        <div className="rs-stat-icon" style={{ background: soft || COLORS.accentSoft }}>
          {icon}
        </div>
      )}
      <div style={{ minWidth: 0 }}>
        <div style={styles.statLabel}>{label}</div>
        <div className="rs-stat-value" style={{ ...styles.statValue, color: accent || COLORS.text }}>
          {value}
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div className="rs-detail-item">
      <div style={styles.detailLabel}>{label}</div>
      <div style={styles.detailValue}>{value || "—"}</div>
    </div>
  );
}

function EmptyState({ text }) {
  return <div style={styles.empty}>{text}</div>;
}

function StatusPill({ status }) {
  const s = (status || "").toLowerCase();
  const map = {
    present: { bg: "rgba(62,207,142,0.15)", color: COLORS.accent },
    absent: { bg: "rgba(239,90,111,0.15)", color: COLORS.danger },
    late: { bg: "rgba(245,166,35,0.15)", color: COLORS.warn },
    paid: { bg: "rgba(62,207,142,0.15)", color: COLORS.accent },
    "not paid": { bg: "rgba(239,90,111,0.15)", color: COLORS.danger },
  };
  const style = map[s] || { bg: "rgba(139,151,176,0.15)", color: COLORS.textDim };
  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        textTransform: "capitalize",
        background: style.bg,
        color: style.color,
      }}
    >
      {status || "—"}
    </span>
  );
}

const styles = {
  logoutBtnMobile: {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.35)",
    background: "rgba(0,0,0,0.12)",
    color: "#fff",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    flexShrink: 0,
  },
  studentTypeBadge: {
    fontSize: 10.5,
    letterSpacing: 0.6,
    fontWeight: 800,
    padding: "3px 10px",
    borderRadius: 999,
    textTransform: "uppercase",
  },
  studentTypeBadgeFullTime: {
    background: "#fff",
    color: COLORS.accent,
    border: "1px solid rgba(31,157,76,0.35)",
  },
  studentTypeBadgePartTime: {
    background: "#fff7ed",
    color: COLORS.warn,
    border: "1px solid rgba(247,148,29,0.4)",
  },
  studentTypeBadgePrivate: {
    background: "#eff6ff",
    color: COLORS.blue,
    border: "1px solid rgba(29,111,209,0.35)",
  },
  paymentSummaryCard: {
    background: COLORS.panelSoft,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 14,
    padding: 16,
    flex: 1,
  },
  panel: {
    background: COLORS.panel,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 20,
    padding: 22,
    position: "relative",
    overflow: "hidden",
    boxShadow: "0 8px 24px rgba(15,42,29,0.06)",
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: 800,
    marginBottom: 16,
    color: COLORS.text,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  classGroupLabel: {
    fontSize: 13,
    fontWeight: 800,
    color: COLORS.accent,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statBar: {
    position: "absolute",
    top: 0,
    left: 0,
    height: 4,
    width: "100%",
  },
  statLabel: { fontSize: 13, color: COLORS.textDim, marginBottom: 6, fontWeight: 600 },
  statValue: { fontSize: 28, fontWeight: 800, lineHeight: 1.1 },
  detailLabel: {
    fontSize: 11.5,
    color: COLORS.textDim,
    marginBottom: 4,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  detailValue: { fontSize: 14.5, fontWeight: 700, color: COLORS.text, wordBreak: "break-word" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left",
    fontSize: 11.5,
    color: "#fff",
    background: COLORS.accent,
    padding: "11px 12px",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    whiteSpace: "nowrap",
    fontWeight: 800,
  },
  td: {
    padding: "12px",
    borderBottom: `1px solid ${COLORS.border}`,
    fontSize: 14,
    whiteSpace: "nowrap",
    color: COLORS.text,
  },
  empty: {
    padding: "36px 0",
    textAlign: "center",
    color: COLORS.textDim,
    fontSize: 14,
    background: COLORS.panelSoft,
    borderRadius: 14,
    border: `1px dashed ${COLORS.border}`,
  },
  messageCard: {
    background: COLORS.panelSoft,
    border: `1px solid ${COLORS.border}`,
    borderLeft: `4px solid ${COLORS.orange}`,
    borderRadius: 14,
    padding: 16,
  },
  messageTitle: { fontWeight: 800, marginBottom: 6, fontSize: 14.5, color: COLORS.text },
  messageBody: { fontSize: 13.5, color: COLORS.textDim, lineHeight: 1.6 },
  dayTabBtn: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    padding: "9px 16px",
    borderRadius: 12,
    border: `1px solid ${COLORS.border}`,
    background: "#fff",
    color: COLORS.textDim,
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  dayTabBtnActive: {
    background: COLORS.accent,
    borderColor: COLORS.accent,
    color: "#fff",
    boxShadow: "0 8px 18px rgba(31,157,76,0.25)",
  },

  timetableIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.blue})`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 19,
    flexShrink: 0,
  },
  academicYearPill: {
    background: COLORS.orangeSoft,
    border: "1px solid rgba(247,148,29,0.3)",
    borderRadius: 12,
    padding: "8px 14px",
    fontSize: 12.5,
    fontWeight: 700,
    color: COLORS.warn,
    whiteSpace: "nowrap",
  },
  downloadBtn: {
    background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentDark})`,
    border: "none",
    borderRadius: 12,
    padding: "9px 16px",
    fontSize: 12.5,
    fontWeight: 800,
    color: "#fff",
    cursor: "pointer",
    whiteSpace: "nowrap",
    boxShadow: "0 8px 18px rgba(31,157,76,0.25)",
  },
  ttCard: {
    background: "#fff",
    border: `1px solid ${COLORS.border}`,
    borderRadius: 18,
    padding: "18px 20px",
  },
  ttCardHeaderRow: {
    display: "grid",
    gridTemplateColumns: "44px 110px 130px 1fr 1fr",
    gap: 10,
    padding: "0 4px 12px",
    borderBottom: `2px solid ${COLORS.accentSoft}`,
    color: COLORS.textDim,
    fontSize: 11.5,
    fontWeight: 800,
    letterSpacing: 0.5,
    minWidth: 640,
  },
  ttRow: {
    display: "grid",
    gridTemplateColumns: "44px 110px 130px 1fr 1fr",
    gap: 10,
    alignItems: "center",
    padding: "14px 4px",
    borderBottom: `1px solid ${COLORS.border}`,
    minWidth: 640,
  },
  ttNumBadge: {
    width: 30,
    height: 30,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontWeight: 800,
    fontSize: 13,
  },
  ttColNum: { textAlign: "left" },
  ttColStart: { fontWeight: 700, color: COLORS.text, fontSize: 14, whiteSpace: "nowrap" },
  ttColEnd: { fontWeight: 700, color: COLORS.text, fontSize: 14, whiteSpace: "nowrap" },
  ttColSubject: { fontWeight: 800, color: COLORS.text, fontSize: 13.5, letterSpacing: 0.3 },
  ttColTeacher: { fontWeight: 600, color: COLORS.textDim, fontSize: 13 },
  ttClockIcon: { marginRight: 4 },
  ttFooterNote: {
    marginTop: 14,
    background: COLORS.blueSoft,
    border: "1px solid rgba(29,111,209,0.2)",
    borderRadius: 12,
    padding: "10px 14px",
    fontSize: 12.5,
    color: COLORS.blue,
    fontWeight: 600,
  },
};