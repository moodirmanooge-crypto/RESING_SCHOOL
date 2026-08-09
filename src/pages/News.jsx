// src/pages/News.jsx
//
// Public "News & Events" feed — reads posts written by the admin from
// the Firestore `news` collection (see admin/pages/NewsManager.jsx).
// Each post shows the school logo, "Rising Star School" as the author
// name with a blue verified tick, the post text, and a like button that
// any visitor can tap (text-only posts, no comments/share — likes only).

import { useEffect, useState } from "react";
import "../styles/news.css";
import logo from "../assets/logo.png";
import { Link } from "react-router-dom";
import { db } from "../firebase/firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  arrayUnion,
  increment,
} from "firebase/firestore";

const NAV_LINKS = [
  { label: "Home", to: "/" },
  { label: "About Us", to: "/about" },
  { label: "Admissions", to: "/admissions" },
  { label: "Academics", to: "/academics" },
  { label: "Gallery", to: "/gallery" },
  { label: "News & Events", to: "/news" },
  { label: "Contact", to: "/contact" },
];

function getVisitorId() {
  let id = localStorage.getItem("rs_visitor_id");
  if (!id) {
    id = "v_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("rs_visitor_id", id);
  }
  return id;
}

function formatDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function News() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const visitorId = getVisitorId();

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

  useEffect(() => {
    const q = query(collection(db, "news"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load news:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const hasLiked = (post) =>
    Array.isArray(post.likedBy) && post.likedBy.includes(visitorId);

  const toggleLike = async (post) => {
    try {
      const ref = doc(db, "news", post.id);
      if (hasLiked(post)) {
        const newLikedBy = (post.likedBy || []).filter((v) => v !== visitorId);
        await updateDoc(ref, {
          likedBy: newLikedBy,
          likeCount: Math.max((post.likeCount || 1) - 1, 0),
        });
      } else {
        await updateDoc(ref, {
          likedBy: arrayUnion(visitorId),
          likeCount: increment(1),
        });
      }
    } catch (err) {
      console.error("Failed to toggle like:", err);
    }
  };

  return (
    <div className="news-page">
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
              className={"home-nav-link" + (l.to === "/news" ? " active" : "")}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="header-actions">
          <div className="menu-wrap">
            <Link to="/admin-login" className="login-portal-btn">
              <span className="login-portal-icon">Login</span>
              Login / Portal
            </Link>
          </div>
        </div>
      </header>

      <section className="news-hero">
        <div className="news-hero-badge">News &amp; Events</div>
        <h1 className="news-hero-title">Latest Updates</h1>
        <p className="news-hero-sub">
          Announcements and updates straight from Rising Star School.
        </p>
      </section>

      <div className="news-content">
        {loading ? (
          <div className="news-empty">Loading news...</div>
        ) : posts.length === 0 ? (
          <div className="news-empty">
            No news posted yet. Check back soon!
          </div>
        ) : (
          <div className="news-list">
            {posts.map((post) => (
              <div className="news-card" key={post.id}>
                <div className="news-card-header">
                  {logo ? (
                    <img src={logo} alt="Rising Star School" className="news-avatar" />
                  ) : (
                    <span className="news-avatar-fallback">R</span>
                  )}
                  <div className="news-author-block">
                    <div className="news-author-name-row">
                      <span className="news-author-name">Rising Star School</span>
                      <span className="news-verified-badge">✓</span>
                    </div>
                    <span className="news-author-meta">
                      {formatDate(post.createdAt)}
                    </span>
                  </div>
                </div>

                <p className="news-body-text">{post.text}</p>

                <div className="news-actions-row">
                  <button
                    className={"news-like-btn" + (hasLiked(post) ? " liked" : "")}
                    onClick={() => toggleLike(post)}
                  >
                    {hasLiked(post) ? "♥" : "♡"} {post.likeCount || 0}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
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
          <a href="tel:+252611234567">+252 61 7390261</a>
          <a href="mailto:risingstar0261@gmail.com">risingstar0261@gmail.com</a>
          <span>Mogadishu, Somalia</span>
        </div>

        <div className="home-footer-quote">
          Excellence in Education, Bright Future for Every Child.
        </div>
      </footer>
    </div>
  );
}