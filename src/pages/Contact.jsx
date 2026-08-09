// src/pages/Contact.jsx
import "../styles/contact.css";
import logo from "../assets/logo.png";
import { Link } from "react-router-dom";
import { useEffect } from "react";
import { MessageCircle, Mail, Phone, MapPin, Clock } from "lucide-react";

const SUPPORT_WHATSAPP = "252617390261";
const SUPPORT_EMAIL = "risingstar0261@gmail.com";
const WHATSAPP_MESSAGE =
  "Salaan, waxaan rabaa inaan wax ka weydiiyo Rising Star School.";

const NAV_LINKS = [
  { label: "Home", to: "/" },
  { label: "About Us", to: "/about" },
  { label: "Admissions", to: "/admissions" },
  { label: "Academics", to: "/academics" },
  { label: "Gallery", to: "/gallery" },
  { label: "News & Events", to: "/news" },
  { label: "Contact", to: "/contact" },
];

export default function Contact() {
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
    <div className="con-page">
      <header className="home-nav">
        <Link to="/" className="brand">
          <img src={logo} className="brand-logo" alt="Rising Star School logo" />
          <div className="brand-text">
            <span className="brand-name">RISING STAR SCHOOL</span>
            <span className="brand-tagline">
              RISING STAR PRIMARY &amp; SECONDARY SCHOOL
            </span>
          </div>
        </Link>

        <nav className="home-nav-links">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={"home-nav-link" + (l.to === "/contact" ? " active" : "")}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="header-actions">
          <div className="menu-wrap">
            <Link to="/admin-login" className="login-portal-btn">
              <span className="login-portal-icon">👤</span>
              Login / Portal
            </Link>
          </div>
        </div>
      </header>

      <section className="con-hero">
        <div className="con-hero-badge">Contact Us</div>
        <h1 className="con-hero-title">Get in Touch</h1>
        <p className="con-hero-sub">
          Choose WhatsApp or Email below to reach our admissions team directly.
        </p>
      </section>

      <div className="con-content">
        <div className="con-methods-grid">
          <div className="con-method-card">
            <div className="con-method-icon whatsapp">
              <MessageCircle size={26} color="#16a34a" />
            </div>
            <h3 className="con-method-title">Chat on WhatsApp</h3>
            <p className="con-method-desc">
              Message us directly for quick answers about admissions, fees,
              or anything else — we usually reply within a few hours.
            </p>
            
            <a
              href={`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(
                WHATSAPP_MESSAGE
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="con-method-btn whatsapp"
            >
              <MessageCircle size={16} />
              Open WhatsApp
            </a>
            <div className="con-method-value">
              0{SUPPORT_WHATSAPP.slice(3)}
            </div>
          </div>

          <div className="con-method-card">
            <div className="con-method-icon email">
              <Mail size={26} color="#2563eb" />
            </div>
            <h3 className="con-method-title">Send an Email</h3>
            <p className="con-method-desc">
              Prefer email? Send us your questions and our admissions team
              will get back to you as soon as possible.
            </p>
            
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="con-method-btn email"
            >
              <Mail size={16} />
              Open Email
            </a>
            <div className="con-method-value">{SUPPORT_EMAIL}</div>
          </div>
        </div>

        <div className="con-info-grid">
          <div className="con-info-box">
            <div className="con-info-icon">
              <Phone size={19} />
            </div>
            <div className="con-info-label">Phone</div>
            <div className="con-info-value">+252 61 7390261</div>
          </div>
          <div className="con-info-box">
            <div className="con-info-icon">
              <MapPin size={19} />
            </div>
            <div className="con-info-label">Location</div>
            <div className="con-info-value">Mogadishu, Somalia</div>
          </div>
          <div className="con-info-box">
            <div className="con-info-icon">
              <Clock size={19} />
            </div>
            <div className="con-info-label">Office Hours</div>
            <div className="con-info-value">Sat–Thu, 8:00 AM – 4:00 PM</div>
          </div>
        </div>
      </div>

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
          <a href="tel:+252617390261">+252 61 7390261</a>
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          <span>Mogadishu, Somalia</span>
        </div>

        <div className="home-footer-quote">
          Excellence in Education, Bright Future for Every Child.
        </div>
      </footer>
    </div>
  );
}