// src/pages/Home.jsx
import "../styles/home.css";
import logo from "../assets/logo.png";
import heroPhoto from "../admin/assets/hero-students.jpg";
import { Link } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { collection, getCountFromServer } from "firebase/firestore";
import { db } from "../firebase/firebase";

const ROLES = [
  {
    key: "teacher",
    to: "/teacher-login",
    emoji: "👩‍🏫",
    title: "TEACHER",
    desc: "Manage classes, attendance, exams and more",
    cta: "Go to Teacher Panel",
  },
  {
    key: "student",
    to: "/student-login",
    emoji: "🎓",
    title: "STUDENT",
    desc: "Access results, homework, timetable and profile",
    cta: "Go to Student Portal",
  },
  {
    key: "cashier",
    to: "/cashier-login",
    emoji: "💰",
    title: "CASHIER",
    desc: "Record payments and manage school fees",
    cta: "Go to Cashier Panel",
  },
  {
    key: "parent",
    to: "/parent-login",
    emoji: "👨‍👩‍👧",
    title: "PARENT",
    desc: "Track your child's progress and performance",
    cta: "Go to Parent Portal",
  },
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Admin contact info — waxaa loo isticmaalaa "Need Help?" menu-ga
const SUPPORT_WHATSAPP = "252617390261"; // international format, no + or leading 0
const SUPPORT_EMAIL = "risingstar0261@gmail.com";

function buildCalendarGrid(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: daysInPrevMonth - i, muted: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, muted: false });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ day: cells.length - (firstDay + daysInMonth) + 1, muted: true });
  }
  return cells;
}

function MiniCalendar() {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const cells = buildCalendarGrid(viewYear, viewMonth);
  const isCurrentMonth =
    viewYear === today.getFullYear() && viewMonth === today.getMonth();

  const goPrev = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNext = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const goToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  };

  return (
    <div className="calendar-card">
      <h3 className="calendar-title">Calendar</h3>

      <div className="calendar-nav">
        <button
          type="button"
          className="calendar-arrow"
          aria-label="Previous month"
          onClick={goPrev}
        >
          ‹
        </button>
        <span className="calendar-month-label">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          className="calendar-arrow"
          aria-label="Next month"
          onClick={goNext}
        >
          ›
        </button>
        <button type="button" className="calendar-today-btn" onClick={goToday}>
          Today
        </button>
      </div>

      <div className="calendar-weekdays">
        {WEEKDAYS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>

      <div className="calendar-grid">
        {cells.map((cell, i) => {
          const isToday =
            isCurrentMonth && !cell.muted && cell.day === today.getDate();
          return (
            <span
              key={i}
              className={
                "calendar-cell" +
                (cell.muted ? " muted" : "") +
                (isToday ? " today" : "")
              }
            >
              {cell.day}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const menuRef = useRef(null);
  const helpRef = useRef(null);
  const rolesRef = useRef(null);

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

  const STATS = [
    {
      key: "students",
      icon: "👥",
      value: statsData.students === null ? "…" : String(statsData.students),
      label: "Students",
      color: "green",
    },
    {
      key: "teachers",
      icon: "👤",
      value: statsData.teachers === null ? "…" : String(statsData.teachers),
      label: "Teachers",
      color: "orange",
    },
    {
      key: "classes",
      icon: "📘",
      value: statsData.classes === null ? "…" : String(statsData.classes),
      label: "Classes",
      color: "blue",
    },
    { key: "attendance", icon: "✅", value: "96%", label: "Attendance", color: "green" },
  ];

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

  const scrollToRoles = (e) => {
    e.preventDefault();
    rolesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="home">
      <header className="home-header">
        <div className="brand">
          <img src={logo} className="brand-logo" alt="Rising School logo" />
          <div className="brand-text">
            <span className="brand-name">RISING STAR PRIMARY &amp; SECONDARY SCHOOL</span>
            <span className="brand-tagline">School Management System</span>
          </div>
        </div>

        <div className="header-actions">
          <div className="menu-wrap" ref={helpRef}>
            <button
              type="button"
              className="help-pill"
              onClick={() => setHelpOpen((v) => !v)}
            >
              <span className="help-icon">?</span>
              Need Help?
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
            <button
              type="button"
              className="dots-btn"
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

          <Link to="/profile" className="header-avatar" aria-label="Profile">
            <img src={heroPhoto} alt="" />
          </Link>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="hero-eyebrow">Welcome to</p>
          <h1 className="hero-title">
            RISING STAR
            <br />
            PRIMARY &amp;
            <br />
            SECONDARY SCHOOL
          </h1>
          <h2 className="hero-subtitle">School Management System</h2>
          <div className="hero-rule" />
          <p className="hero-lede">
            Education Is Life It Self
          </p>
          <a href="#roles" className="hero-cta" onClick={scrollToRoles}>
            <span className="hero-cta-icon">▦</span>
            Get Started
          </a>
        </div>

        <div className="hero-art">
          <img src={heroPhoto} alt="Rising Star School students" className="hero-photo" />
        </div>

        <div className="hero-side">
          <MiniCalendar />
        </div>
      </section>

      <section className="stats-grid">
        {STATS.map((s) => (
          <div className={`stat-card stat-${s.color}`} key={s.key}>
            <span className="stat-icon">{s.icon}</span>
            <div className="stat-body">
              <span className="stat-value">{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </div>
            <svg className="stat-sparkline" viewBox="0 0 100 30" preserveAspectRatio="none">
              <polyline points="0,22 15,18 30,24 45,12 60,16 75,6 100,4" />
            </svg>
          </div>
        ))}
      </section>

      <section className="roles-grid" id="roles" ref={rolesRef}>
        {ROLES.map((role) => (
          <Link key={role.key} className={`role-card role-${role.key}`} to={role.to}>
            <span className="role-corner" aria-hidden="true" />
            <span className="role-avatar">{role.emoji}</span>
            <h3 className="role-title">{role.title}</h3>
            <p className="role-desc">{role.desc}</p>
            <span className="role-cta">
              {role.cta}
              <span className="role-arrow">➜</span>
            </span>
          </Link>
        ))}
      </section>

      <footer className="home-footer">
        <span>© {new Date().getFullYear()} Rising Star School. All rights reserved.</span>
        <span className="footer-links">
          <a href="/privacy">Privacy Policy</a>
          <span className="footer-divider">|</span>
          <a href="/terms">Terms of Service</a>
        </span>
      </footer>
    </div>
  );
}