// src/pages/About.jsx
import "../styles/about.css";
import logo from "../assets/logo.png";
import heroPhoto from "../admin/assets/hero-students.jpg";
import { Link } from "react-router-dom";
import { useState, useRef, useEffect } from "react";

const SUPPORT_WHATSAPP = "252617390261";
const SUPPORT_EMAIL = "risingstar0261@gmail.com";
const SUPPORT_PHONE_DISPLAY = "+252 61 7390261";
const SUPPORT_LOCATION = "Mogadishu, Somalia";

const NAV_LINKS = [
  { label: "Home", to: "/" },
  { label: "About Us", to: "/about" },
  { label: "Admissions", to: "/admissions" },
  { label: "Academics", to: "/academics" },
  { label: "Gallery", to: "/gallery" },
  { label: "News & Events", to: "/news" },
  { label: "Contact", to: "/contact" },
];

const CORE_VALUES = [
  { icon: "📖", title: "Academic Excellence", desc: "A challenging, well-rounded curriculum that prepares students for national exams and beyond." },
  { icon: "🤝", title: "Character & Integrity", desc: "We build honest, disciplined and respectful young people, not just good test-takers." },
  { icon: "🛡️", title: "Safe Environment", desc: "A secure, caring campus where every child feels protected and free to learn." },
  { icon: "🌍", title: "Global Citizenship", desc: "Preparing students to lead and contribute both locally and on the world stage." },
];

const MISSION_PILLARS = [
  {
    icon: "🏅",
    title: "Excellence in Teaching",
    desc: "Delivering a comprehensive curriculum that blends modern educational methodologies with foundational values to foster critical thinking and lifelong learning.",
  },
  {
    icon: "🌱",
    title: "Holistic Development",
    desc: "Nurturing students' moral, social, and intellectual growth, preparing them to become responsible, ethical, and capable leaders.",
  },
  {
    icon: "🚀",
    title: "Innovation & Future-Readiness",
    desc: "Integrating modern tools, scientific inquiry, and technological literacy to ensure students are fully prepared for higher education and the demands of the modern global workforce.",
  },
];

const HISTORY_TIMELINE = [
  { year: "2023", text: "Rising Star Primary & Secondary School was founded in Mogadishu with a mission to raise the next generation of leaders." },
  { year: "2024", text: "Expanded classrooms and introduced a dedicated science and computer lab for hands-on learning." },
  { year: "2025", text: "Launched our digital school management system, connecting students, teachers, parents and staff." },
  { year: "2026", text: "Continuing to grow — new facilities, more teachers, and an even stronger academic program." },
];

const LEADERSHIP = [
  { name: "Headmaster's Office", role: "School Administration", icon: "🎓" },
  { name: "Academic Committee", role: "Curriculum & Standards", icon: "📚" },
  { name: "Discipline Committee", role: "Student Welfare & Conduct", icon: "🛡️" },
];

const STATS = [
  { icon: "🎓", value: "800+", label: "Students" },
  { icon: "👥", value: "60+", label: "Teachers" },
  { icon: "🏫", value: "25+", label: "Classrooms" },
  { icon: "🏆", value: "100%", label: "Pass Rate" },
];

export default function About() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const menuRef = useRef(null);
  const helpRef = useRef(null);

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

  return (
    <div className="about-page">
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
            <Link
              key={l.to}
              to={l.to}
              className={`home-nav-link${l.to === "/about" ? " active" : ""}`}
            >
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

      {/* ---------- About Hero ---------- */}
      <section className="about-hero">
        <span className="about-eyebrow">
          <span className="about-eyebrow-star">★</span> About Rising Star School
        </span>
        <h1 className="about-hero-title">
          Nurturing Minds,
          <br />
          <span className="about-hero-title-accent">Building Futures</span>
        </h1>
        <p className="about-hero-lede">
          Since 2023, Rising Star Primary &amp; Secondary School has been committed
          to academic excellence, character building and innovative learning —
          preparing every child to become a responsible global citizen and future leader.
        </p>

        <div className="about-stats-row">
          {STATS.map((s) => (
            <div className="about-stat-pill" key={s.label}>
              <span className="about-stat-icon">{s.icon}</span>
              <div>
                <div className="about-stat-value">{s.value}</div>
                <div className="about-stat-label">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Mission / Vision / Photo ---------- */}
      <section className="about-mission-grid">
        <div className="about-mission-photo-wrap">
          <img src={heroPhoto} alt="Rising Star School students" className="about-mission-photo" />
        </div>

        <div className="about-mission-cards">
          <div className="about-mission-card">
            <span className="about-mission-card-icon">🔭</span>
            <h3>Our Vision</h3>
            <p>
              To be a leading, world-class educational institution in Mogadishu,
              Somalia, recognized for academic excellence, innovation, and holistic
              development in primary and secondary education, empowering
              generations of students to master languages, advance in sciences,
              and drive positive transformation in their communities and the
              global society.
            </p>
          </div>
          <div className="about-mission-card">
            <span className="about-mission-card-icon">🎯</span>
            <h3>Our Mission</h3>
            <p>
              To cultivate an inspiring, rigorous, and supportive learning
              environment that equips students with exceptional academic
              foundations, advanced linguistic capabilities, and essential
              scientific knowledge.
            </p>
          </div>
        </div>
      </section>

      {/* ---------- Mission Pillars ---------- */}
      <section className="about-section about-section-alt">
        <h2 className="about-section-title">How We Deliver Our Mission</h2>
        <p className="about-section-sub">
          Three pillars that shape every classroom, every lesson, and every student at Rising Star School.
        </p>

        <div className="mission-pillars-grid">
          {MISSION_PILLARS.map((p) => (
            <div className="mission-pillar-card" key={p.title}>
              <span className="mission-pillar-icon">{p.icon}</span>
              <h3 className="mission-pillar-title">{p.title}</h3>
              <p className="mission-pillar-desc">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Core Values ---------- */}
      <section className="about-section">
        <h2 className="about-section-title">What We Stand For</h2>
        <p className="about-section-sub">The values that guide everything we do at Rising Star School.</p>

        <div className="core-values-grid">
          {CORE_VALUES.map((v) => (
            <div className="core-value-card" key={v.title}>
              <span className="core-value-icon">{v.icon}</span>
              <h3 className="core-value-title">{v.title}</h3>
              <p className="core-value-desc">{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- History Timeline ---------- */}
      <section className="about-section about-section-alt">
        <h2 className="about-section-title">Our Journey</h2>
        <p className="about-section-sub">From our founding to today — a growing story of learning and leadership.</p>

        <div className="timeline">
          {HISTORY_TIMELINE.map((t, i) => (
            <div className="timeline-item" key={t.year}>
              <div className="timeline-year">{t.year}</div>
              <div className="timeline-dot" />
              <div className="timeline-text">{t.text}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Leadership ---------- */}
      <section className="about-section">
        <h2 className="about-section-title">School Leadership</h2>
        <p className="about-section-sub">Guiding Rising Star School with care, discipline and vision.</p>

        <div className="leadership-grid">
          {LEADERSHIP.map((l) => (
            <div className="leadership-card" key={l.name}>
              <span className="leadership-icon">{l.icon}</span>
              <h3 className="leadership-name">{l.name}</h3>
              <p className="leadership-role">{l.role}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="about-cta">
        <h2 className="about-cta-title">Ready to Join Rising Star School?</h2>
        <p className="about-cta-text">
          Give your child the foundation they deserve. Admissions are open now.
        </p>
        <div className="about-cta-row">
          <Link to="/admissions" className="hero-cta hero-cta-primary">
            Apply for Admission <span>➜</span>
          </Link>
          <Link to="/contact" className="hero-cta hero-cta-secondary">
            Contact Us <span>➜</span>
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
          "Excellence in Education, Bright Future for Every Child."
        </div>
      </footer>
    </div>
  );
}