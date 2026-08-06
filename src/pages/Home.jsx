// src/pages/Home.jsx
import "../styles/home.css";
import logo from "../assets/logo.png";
import heroPhoto from "../admin/assets/hero-students.jpg";
import { Link } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { collection, getCountFromServer } from "firebase/firestore";
import { db } from "../firebase/firebase";
import {
  Users,
  UserCog,
  Users2,
  DollarSign,
  Calendar,
  BookOpen,
  Award,
  QrCode,
  ClipboardList,
} from "lucide-react";

// Admin contact info — waxaa loo isticmaalaa qaybta "Contact" iyo "Need Help?"
const SUPPORT_WHATSAPP = "252617390261"; // international format, no + or leading 0
const SUPPORT_EMAIL = "risingstar0261@gmail.com";
const SUPPORT_PHONE_DISPLAY = "+252 61 7390261";
const SUPPORT_LOCATION = "Mogadishu, Somalia";

const NAV_LINKS = [
  { label: "Home", to: "/" },
  { label: "About Us", to: "/about" },
  { label: "Admissions", to: "/admissions" },
  { label: "Academics", to: "/academics" },
  { label: "Library", to: "/library" },
  { label: "Gallery", to: "/gallery" },
  { label: "News & Events", to: "/news" },
  { label: "Contact", to: "/contact" },
];

const FEATURE_STRIP = [
  { icon: "📖", label: "Quality Education" },
  { icon: "👥", label: "Experienced Teachers" },
  { icon: "🛡️", label: "Safe Environment" },
  { icon: "⭐", label: "Holistic Development" },
  { icon: "👨‍👩‍👧", label: "Strong Community" },
];

const PORTALS = [
  {
    key: "student",
    emoji: "🎒",
    title: "Student Portal",
    desc: "Access your profile, materials, results and more.",
    to: "/student-login",
    color: "blue",
  },
  {
    key: "teacher",
    emoji: "👨‍🏫",
    title: "Teacher Portal",
    desc: "Manage classes, resources and assignments.",
    to: "/teacher-login",
    color: "green",
  },
  {
    key: "parent",
    emoji: "👩‍🦱",
    title: "Parent Portal",
    desc: "Track your child's progress and activities.",
    to: "/parent-login",
    color: "purple",
  },
  {
    key: "cashier",
    emoji: "💰",
    title: "Cashier Portal",
    desc: "Record payments and manage school fees.",
    to: "/cashier-login",
    color: "orange",
  },
  {
    key: "admission",
    emoji: "📋",
    title: "Online Admission",
    desc: "Apply online for admissions easily and quickly.",
    to: "/admissions",
    color: "purple",
  },
];

const ABOUT_STATS = [
  { icon: "🎓", value: "800+", label: "Students" },
  { icon: "👥", value: "60+", label: "Teachers" },
  { icon: "🏫", value: "25+", label: "Classrooms" },
  { icon: "🏆", value: "100%", label: "Pass Rate" },
];

const GALLERY_PREVIEW = [heroPhoto, heroPhoto, heroPhoto, heroPhoto, heroPhoto];

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const menuRef = useRef(null);
  const helpRef = useRef(null);

  const [statsData, setStatsData] = useState({
    students: null,
    teachers: null,
    classes: null,
  });

  useEffect(() => {
    async function loadStats() {
      try {
        const [studentsSnap, teachersSnap, classesSnap] = await Promise.all([
          getCountFromServer(collection(db, "students")),
          getCountFromServer(collection(db, "teachers")),
          getCountFromServer(collection(db, "classes")),
        ]);

        setStatsData({
          students: studentsSnap.data().count,
          teachers: teachersSnap.data().count,
          classes: classesSnap.data().count,
        });
      } catch (err) {
        console.error("Failed to load home stats:", err);
      }
    }

    loadStats();
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
      if (helpRef.current && !helpRef.current.contains(e.target)) {
        setHelpOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="home">
      {/* ---------- Top Nav ---------- */}
      <header className="home-nav">
        <Link to="/" className="brand">
          <img src={logo} className="brand-logo" alt="Rising Star School logo" />
          <div className="brand-text">
            <span className="brand-name">RISING STAR SCHOOL</span>
            <span className="brand-tagline">RISING STAR PRIMARY &amp; SECONDARY SCHOOL</span>
          </div>
        </Link>

        <nav className="home-nav-links">
          {NAV_LINKS.map((l) => (
            <Link key={l.to} to={l.to} className="home-nav-link">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="header-actions">
          <div className="menu-wrap" ref={helpRef}>
            <button
              type="button"
              className="help-pill-hidden"
              onClick={() => setHelpOpen((v) => !v)}
              aria-label="Need help?"
            >
              ?
            </button>

            {helpOpen && (
              <div className="dots-menu help-menu">
                <a
                  href={`https://wa.me/${SUPPORT_WHATSAPP}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="dots-menu-item"
                >
                  💬 WhatsApp: 0{SUPPORT_WHATSAPP.slice(3)}
                </a>
                <a href={`mailto:${SUPPORT_EMAIL}`} className="dots-menu-item">
                  📧 {SUPPORT_EMAIL}
                </a>
              </div>
            )}
          </div>

          <div className="menu-wrap" ref={menuRef}>
            <Link to="/admin-login" className="login-portal-btn">
              <span className="login-portal-icon">👤</span>
              Login / Portal
            </Link>

            <button
              type="button"
              className="dots-btn-hidden"
              aria-label="More options"
              onClick={() => setMenuOpen((v) => !v)}
            >
              ⋮
            </button>

            {menuOpen && (
              <div className="dots-menu">
                <Link to="/admin-login" className="dots-menu-item">
                  👑 Admin Login
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ---------- Hero + System Panel ---------- */}
      <section className="hero-grid">
        <div className="hero-left">
          <div className="hero-card">
            <h1 className="hero-title">
              NURTURING MINDS,
              <br />
              <span className="hero-title-accent">BUILDING FUTURES</span>
            </h1>
            <div className="hero-rule" />
            <p className="hero-lede">
              Providing quality education in a safe, caring and inspiring
              environment where every child can achieve greatness.
            </p>

            <div className="hero-cta-row">
              <Link to="/admissions" className="hero-cta hero-cta-primary">
                Apply for Admission <span>➜</span>
              </Link>
              <Link to="/about" className="hero-cta hero-cta-secondary">
                Learn More <span>➜</span>
              </Link>
            </div>

            <img src={heroPhoto} alt="Rising Star School students" className="hero-photo" />

            <div className="feature-strip">
              {FEATURE_STRIP.map((f) => (
                <span key={f.label} className="feature-strip-item">
                  <span className="feature-strip-icon">{f.icon}</span>
                  {f.label}
                </span>
              ))}
            </div>
          </div>

          {/* About Our School */}
          <div className="about-preview-card">
            <h2 className="about-preview-title">About Our School</h2>
            <p className="about-preview-text">
              At Rising Star School, we are dedicated to nurturing young
              minds through academic excellence, character building and
              innovative learning. Our mission is to prepare students to
              become responsible global citizens and future leaders.
            </p>

            <div className="about-stats-grid">
              {ABOUT_STATS.map((s) => (
                <div className="about-stat-box" key={s.label}>
                  <span className="about-stat-icon">{s.icon}</span>
                  <span className="about-stat-value">{s.value}</span>
                  <span className="about-stat-label">{s.label}</span>
                </div>
              ))}
            </div>

            <h3 className="gallery-preview-title">Gallery</h3>
            <div className="gallery-preview-grid">
              {GALLERY_PREVIEW.map((img, i) => (
                <img key={i} src={img} alt="" className="gallery-preview-img" />
              ))}
            </div>
            <Link to="/gallery" className="view-more-btn">
              View More Photos <span>➜</span>
            </Link>
          </div>
        </div>

        <aside className="hero-right">
          <div className="portals-card">
            <h3 className="portals-title">
              <span className="portals-title-icon">🌐</span>
              Online System
            </h3>
            <div className="portals-grid">
              {PORTALS.map((p) => (
                <div className={`portal-box portal-${p.color}`} key={p.key}>
                  <span className="portal-emoji">{p.emoji}</span>
                  <div className="portal-title">{p.title}</div>
                  <p className="portal-desc">{p.desc}</p>
                  <Link to={p.to} className="portal-btn">
                    {p.key === "admission" ? "Apply Now" : "Login"}
                  </Link>

                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="home-footer">
        <div className="home-footer-left">
          <img src={logo} className="footer-logo" alt="Rising Star School logo" />
          <div>
            <div className="footer-school-name">RISING STAR SCHOOL</div>
            <div className="footer-school-tagline">
              RISING STAR PRIMARY &amp; SECONDARY SCHOOL
            </div>
          </div>
        </div>

        <div className="home-footer-contact">
          <a href={`tel:${SUPPORT_PHONE_DISPLAY.replace(/\s/g, "")}`}>
            📞 {SUPPORT_PHONE_DISPLAY}
          </a>
          <a href={`mailto:${SUPPORT_EMAIL}`}>✉️ {SUPPORT_EMAIL}</a>
          <span>📍 {SUPPORT_LOCATION}</span>
        </div>

        <div className="home-footer-quote">
          “Excellence in Education, Bright Future for Every Child.”
        </div>
      </footer>
    </div>
  );
}