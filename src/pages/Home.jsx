// src/pages/Home.jsx
import "../styles/home.css";
import logo from "../assets/logo.png";
import galleryPhoto from "../admin/assets/student.png";
import { Link } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { collection, getCountFromServer, doc, onSnapshot } from "firebase/firestore";
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
  GraduationCap,
  ShieldCheck,
  TrendingUp,
  Trophy,
  User,
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
  {
    icon: GraduationCap,
    label: "Quality Education",
    desc: "Excellence in teaching & learning",
    color: "green",
  },
  {
    icon: ShieldCheck,
    label: "Safe Environment",
    desc: "Secure and caring school community",
    color: "yellow",
  },
  {
    icon: Award,
    label: "Experienced Staff",
    desc: "Qualified and dedicated teachers",
    color: "purple",
  },
  {
    icon: Users,
    label: "Student Focused",
    desc: "Developing every child's potential",
    color: "orange",
  },
  {
    icon: TrendingUp,
    label: "Modern Facilities",
    desc: "Advanced resources for better learning",
    color: "green",
  },
  {
    icon: Trophy,
    label: "Proven Results",
    desc: "Outstanding academic performance",
    color: "blue",
  },
];

const PORTALS = [
  {
    key: "student",
    icon: GraduationCap,
    title: "Student Portal",
    desc: "Access your profile, materials, results and more.",
    to: "/student-login",
    color: "green",
  },
  {
    key: "teacher",
    icon: Users2,
    title: "Teacher Portal",
    desc: "Manage classes, resources and assignments.",
    to: "/teacher-login",
    color: "gold",
  },
  {
    key: "parent",
    icon: User,
    title: "Parent Portal",
    desc: "Track your child's progress and activities.",
    to: "/parent-login",
    color: "purple",
  },
  {
    key: "cashier",
    icon: DollarSign,
    title: "Cashier Portal",
    desc: "Record payments and manage school fees.",
    to: "/cashier-login",
    color: "orange",
  },
  {
    key: "admission",
    icon: ClipboardList,
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

const GALLERY_PREVIEW = [galleryPhoto, galleryPhoto, galleryPhoto, galleryPhoto, galleryPhoto];

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

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

  const [heroMedia, setHeroMedia] = useState(null); // { mediaUrl, mediaType } | null while waiting

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "settings", "homepage"),
      (snap) => {
        const data = snap.exists() ? snap.data() : null;
        setHeroMedia(data?.mediaUrl ? data : null);
      },
      (err) => console.error("Failed to load homepage media:", err)
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ---- Xannib: F12, right-click, iyo shortcut-yada developer tools ----
  useEffect(() => {
    function handleContextMenu(e) {
      e.preventDefault();
    }

    function handleKeyDown(e) {
      const key = (e.key || "").toLowerCase();

      // F12
      if (key === "f12") {
        e.preventDefault();
        return;
      }

      // Ctrl+Shift+I / J / C  (DevTools, Console, Inspect element)
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (key === "i" || key === "j" || key === "c")
      ) {
        e.preventDefault();
        return;
      }

      // Ctrl+U (View source) iyo Ctrl+S (Save page)
      if ((e.ctrlKey || e.metaKey) && (key === "u" || key === "s")) {
        e.preventDefault();
        return;
      }
    }

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const HERO_STATS = [
    {
      icon: GraduationCap,
      value: statsData.students != null ? `${statsData.students}+` : "…",
      label: "Students Enrolled",
    },
    {
      icon: Users2,
      value: statsData.teachers != null ? `${statsData.teachers}+` : "…",
      label: "Qualified Teachers",
    },
    {
      icon: BookOpen,
      value: statsData.classes != null ? `${statsData.classes}+` : "…",
      label: "Subjects Offered",
    },
    { icon: Trophy, value: "98%", label: "Pass Rate" },
  ];

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
          <div className="menu-wrap" ref={menuRef}>
            <button
              type="button"
              className="nav-dots-btn"
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
        </div>
      </header>

      {/* ---------- Hero Banner ---------- */}
      <section className="hero-banner">
        <div className="hero-banner-inner">
          <span className="hero-badge">
            <Award size={14} /> Excellence in Education
          </span>
          <h1 className="hero-title">
            NURTURING MINDS,
            <br />
            <span className="hero-title-accent">BUILDING FUTURES</span>
          </h1>
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
        </div>

        <div className="hero-photo-box">
          {heroMedia?.mediaUrl ? (
            heroMedia.mediaType === "video" ? (
              <video
                src={heroMedia.mediaUrl}
                className="hero-photo-box-img"
                autoPlay
                loop
                muted
                playsInline
              />
            ) : (
              <img
                src={heroMedia.mediaUrl}
                alt="Rising Star School"
                className="hero-photo-box-img"
              />
            )
          ) : (
            <div className="hero-photo-box-placeholder">
              <span>Sawirka bogga hore ayaa la sugayaa</span>
            </div>
          )}
        </div>
      </section>

      {/* ---------- Feature strip + Stats ---------- */}
      <section className="feature-stats-row">
        <div className="feature-strip-card">
          {FEATURE_STRIP.map((f) => {
            const Icon = f.icon;
            return (
              <div className="feature-item" key={f.label}>
                <span className={`feature-icon-circle feature-icon-${f.color}`}>
                  <Icon size={20} />
                </span>
                <span className="feature-item-label">{f.label}</span>
                <span className="feature-item-desc">{f.desc}</span>
              </div>
            );
          })}
        </div>

        <div className="stats-dark-card">
          {HERO_STATS.map((s) => {
            const Icon = s.icon;
            return (
              <div className="stat-mini-box" key={s.label}>
                <Icon size={22} />
                <span className="stat-mini-value">{s.value}</span>
                <span className="stat-mini-label">{s.label}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---------- Portals ---------- */}
      <section className="school-portals-row">
        <div className="portals-inline-grid">
          {PORTALS.map((p) => {
            const Icon = p.icon;
            return (
              <div className={`portal-box portal-${p.color}`} key={p.key}>
                <span className="portal-icon-circle">
                  <Icon size={26} />
                </span>
                <div className="portal-title">{p.title}</div>
                <p className="portal-desc">{p.desc}</p>
                <Link to={p.to} className="portal-btn">
                  {p.key === "admission" ? "Apply Now" : "Login"} <span>➜</span>
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---------- About Our School ---------- */}
      <section className="about-section-wrap">
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