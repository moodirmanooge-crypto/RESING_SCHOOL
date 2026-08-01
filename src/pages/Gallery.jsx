// src/pages/Gallery.jsx
import { useEffect, useState } from "react";
import "../styles/gallery.css";
import logo from "../assets/logo.png";
import { Link } from "react-router-dom";
import { db, storage } from "../firebase/firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  arrayUnion,
  increment,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const NAV_LINKS = [
  { label: "Home", to: "/" },
  { label: "About Us", to: "/about" },
  { label: "Admissions", to: "/admissions" },
  { label: "Academics", to: "/academics" },
  { label: "Gallery", to: "/gallery" },
  { label: "News & Events", to: "/news" },
  { label: "Contact", to: "/contact" },
];

const FILTERS = ["All", "Photos", "Videos"];
const SESSION_KEY = "rs_gallery_user";

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

function formatCount(n) {
  const num = Number(n) || 0;
  if (num < 1000) return String(num);
  if (num < 1000000) {
    const val = num / 1000;
    return (val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)) + "K";
  }
  const val = num / 1000000;
  return (val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)) + "M";
}

export default function Gallery() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [active, setActive] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [toast, setToast] = useState("");

  const [account, setAccount] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupPhoto, setSignupPhoto] = useState(null);
  const [signupPreview, setSignupPreview] = useState(null);
  const [signupError, setSignupError] = useState("");
  const [signingUp, setSigningUp] = useState(false);

  // Guard against double-clicks firing two Firestore writes before the
  // first one resolves, which could otherwise let a single account like
  // a post more than once.
  const [likeBusyId, setLikeBusyId] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) {
      try {
        setAccount(JSON.parse(saved));
      } catch (e) {
        localStorage.removeItem(SESSION_KEY);
      }
    }
    setCheckingSession(false);
  }, []);

  useEffect(() => {
    const q = query(collection(db, "gallery"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setItems(list);
        setLoading(false);
        setActive((prev) =>
          prev ? list.find((i) => i.id === prev.id) || null : null
        );
      },
      (err) => {
        console.error("Failed to load gallery:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const handleSignupPhotoChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setSignupPhoto(f);
    setSignupPreview(URL.createObjectURL(f));
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setSignupError("");

    const name = signupName.trim();
    const email = signupEmail.trim();

    if (!name) {
      setSignupError("Fadlan geli magacaaga.");
      return;
    }
    if (!email) {
      setSignupError("Fadlan geli email-kaaga.");
      return;
    }
    if (!signupPassword.trim()) {
      setSignupError("Fadlan geli password.");
      return;
    }

    try {
      setSigningUp(true);

      const userRef = doc(db, "galleryUsers", name);
      const existing = await getDoc(userRef);

      if (existing.exists()) {
        const data = existing.data();
        if (String(data.password || "") !== signupPassword.trim()) {
          setSignupError(
            "Magacan horey ayaa loo isticmaalay. Haddii adiga tahay, geli password-kaaga saxda ah."
          );
          setSigningUp(false);
          return;
        }
        const sessionData = {
          name: data.name,
          email: data.email,
          photoUrl: data.photoUrl || "",
          role: data.role || "visitor",
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
        setAccount(sessionData);
        setSigningUp(false);
        return;
      }

      let photoUrl = "";
      if (signupPhoto) {
        const photoRef = ref(
          storage,
          `galleryUsers/${name}_${Date.now()}_${signupPhoto.name}`
        );
        await uploadBytes(photoRef, signupPhoto);
        photoUrl = await getDownloadURL(photoRef);
      }

      const userData = {
        name,
        email,
        password: signupPassword.trim(),
        photoUrl,
        role: "visitor",
        createdAt: new Date(),
      };

      await setDoc(userRef, userData);

      const sessionData = { name, email, photoUrl, role: "visitor" };
      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
      setAccount(sessionData);
    } catch (err) {
      console.error(err);
      setSignupError("Khalad ayaa dhacay. Fadlan isku day mar kale.");
    } finally {
      setSigningUp(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY);
    setAccount(null);
  };

  const filtered = items.filter((i) => {
    if (filter === "Photos") return i.mediaType !== "video";
    if (filter === "Videos") return i.mediaType === "video";
    return true;
  });

  // A given account (by name, the unique key we sign up with) can only
  // ever appear once in `likedBy` — that membership check IS the
  // one-like-per-account rule, enforced against the live Firestore doc.
  const hasLiked = (item) =>
    account && Array.isArray(item.likedBy) && item.likedBy.includes(account.name);

  const toggleLike = async (item) => {
    if (!account) return;
    if (likeBusyId === item.id) return; // ignore rapid double-clicks

    try {
      setLikeBusyId(item.id);
      const ref = doc(db, "gallery", item.id);

      if (hasLiked(item)) {
        // Already liked by this account — this click removes their like,
        // it can never add a second one.
        const newLikedBy = (item.likedBy || []).filter((v) => v !== account.name);
        await updateDoc(ref, {
          likedBy: newLikedBy,
          likeCount: Math.max((item.likeCount || 1) - 1, 0),
        });
      } else {
        // Not liked yet — arrayUnion is itself idempotent (Firestore
        // will not add account.name twice even under a race), so this
        // account can only ever contribute one like to this post.
        await updateDoc(ref, {
          likedBy: arrayUnion(account.name),
          likeCount: increment(1),
        });
      }
    } catch (err) {
      console.error("Failed to toggle like:", err);
    } finally {
      setLikeBusyId(null);
    }
  };

  const submitComment = async (e) => {
    e.preventDefault();
    if (!active || !commentText.trim() || !account) return;

    try {
      const ref = doc(db, "gallery", active.id);
      await updateDoc(ref, {
        comments: arrayUnion({
          text: commentText.trim(),
          name: account.name,
          photoUrl: account.photoUrl || "",
          role: account.role || "visitor",
          createdAt: new Date(),
        }),
      });
      setCommentText("");
    } catch (err) {
      console.error("Failed to add comment:", err);
    }
  };

  const shareItem = async (item) => {
    const url = `${window.location.origin}/gallery#${item.id}`;
    try {
      const ref = doc(db, "gallery", item.id);
      await updateDoc(ref, { shareCount: increment(1) });
    } catch (err) {
      // ignore
    }

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Rising Star School Gallery",
          text: item.caption || "Check this out from Rising Star School",
          url,
        });
        return;
      }
      await navigator.clipboard.writeText(url);
      setToast("Link copied to clipboard!");
      setTimeout(() => setToast(""), 2200);
    } catch (err) {
      // Share cancelled or clipboard blocked — ignore silently.
    }
  };

  if (checkingSession) {
    return null;
  }

  return (
    <div className="gal-page">
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
              className={"home-nav-link" + (l.to === "/gallery" ? " active" : "")}
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

      <section className="gal-hero">
        <div className="gal-hero-badge">Gallery</div>
        <h1 className="gal-hero-title">Moments at Rising Star School</h1>
        <p className="gal-hero-sub">
          Photos and videos from school life — like, comment, and share
          your favorites.
        </p>
      </section>

      {!account ? (
        <div className="gal-content">
          <div className="gal-signup-card">
            <h2 className="gal-signup-title">Create Your Account</h2>
            <p className="gal-signup-sub">
              Sign up with your name, email, password and a profile photo to
              like, comment, and share in the gallery.
            </p>

            <form onSubmit={handleSignup} className="gal-signup-form">
              <label htmlFor="signupPhoto" className="gal-signup-photo-input">
                {signupPreview ? (
                  <img src={signupPreview} alt="" />
                ) : (
                  <span>Add Photo</span>
                )}
              </label>
              <input
                id="signupPhoto"
                type="file"
                accept="image/*"
                onChange={handleSignupPhotoChange}
                style={{ display: "none" }}
              />

              <div className="gal-signup-fields">
                <input
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  placeholder="Your name"
                />
                <input
                  type="email"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  placeholder="Your email"
                />
                <input
                  type="password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  placeholder="Password"
                />
              </div>

              {signupError && <div className="gal-signup-error">{signupError}</div>}

              <button type="submit" className="gal-signup-btn" disabled={signingUp}>
                {signingUp ? "Creating..." : "Sign Up & Continue"}
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="gal-content">
          <div className="gal-account-bar">
            <div className="gal-account-info">
              {account.photoUrl ? (
                <img src={account.photoUrl} alt="" className="gal-account-avatar" />
              ) : (
                <span className="gal-account-avatar-fallback">
                  {account.name.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="gal-account-name">{account.name}</span>
            </div>
            <button className="gal-logout-btn" onClick={handleLogout}>
              Log Out
            </button>
          </div>

          <div className="gal-filters">
            {FILTERS.map((f) => (
              <button
                key={f}
                className={"gal-filter-pill" + (filter === f ? " active" : "")}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="gal-empty">Loading gallery...</div>
          ) : filtered.length === 0 ? (
            <div className="gal-empty">
              No {filter !== "All" ? filter.toLowerCase() : "photos or videos"}{" "}
              have been posted yet. Check back soon!
            </div>
          ) : (
            <div className="gal-feed">
              {filtered.map((item) => (
                <div className="gal-post" key={item.id}>
                  <div className="gal-post-header">
                    <img src={logo} alt="" className="gal-post-avatar" />
                    <div className="gal-post-author-block">
                      <div className="gal-post-author-row">
                        <span className="gal-post-author-name">
                          Rising Star School
                        </span>
                        <span className="gal-post-verified">✓</span>
                      </div>
                      <span className="gal-post-date">
                        {formatDate(item.createdAt)}
                      </span>
                    </div>
                  </div>

                  {item.caption && (
                    <div className="gal-caption">{item.caption}</div>
                  )}

                  <div className="gal-media-wrap" onClick={() => setActive(item)}>
                    {item.mediaType === "video" ? (
                      <>
                        <video src={item.mediaUrl} muted />
                        <span className="gal-video-badge">▶ Video</span>
                      </>
                    ) : (
                      <img src={item.mediaUrl} alt={item.caption || "Gallery"} />
                    )}
                  </div>

                  <div className="gal-post-body">
                    {(item.likeCount > 0 || (item.comments || []).length > 0) && (
                      <div className="gal-meta-row">
                        <span>
                          {item.likeCount > 0 ? `♥ ${formatCount(item.likeCount)}` : ""}
                        </span>
                        <span>
                          {(item.comments || []).length > 0
                            ? `${formatCount(item.comments.length)} comments`
                            : ""}
                        </span>
                      </div>
                    )}

                    <div className="gal-actions-row">
                      <button
                        className={
                          "gal-action-btn" + (hasLiked(item) ? " liked" : "")
                        }
                        onClick={() => toggleLike(item)}
                        disabled={likeBusyId === item.id}
                      >
                        {hasLiked(item) ? "♥" : "♡"} Like
                      </button>
                      <button
                        className="gal-action-btn"
                        onClick={() => setActive(item)}
                      >
                        💬 Comment
                      </button>
                      <button
                        className="gal-action-btn"
                        onClick={() => shareItem(item)}
                      >
                        ↗ Share
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {active && account && (
        <div className="gal-modal-overlay" onClick={() => setActive(null)}>
          <div className="gal-modal" onClick={(e) => e.stopPropagation()}>
            <div className="gal-modal-media">
              {active.mediaType === "video" ? (
                <video src={active.mediaUrl} controls autoPlay />
              ) : (
                <img src={active.mediaUrl} alt={active.caption || "Gallery"} />
              )}
            </div>

            <div className="gal-modal-side">
              <div className="gal-modal-header">
                <div className="gal-modal-header-brand">
                  <img src={logo} alt="" className="gal-modal-avatar" />
                  <div>
                    <div className="gal-post-author-row">
                      <strong>Rising Star School</strong>
                      <span className="gal-post-verified">✓</span>
                    </div>
                    <span className="gal-post-date">
                      {formatDate(active.createdAt)}
                    </span>
                  </div>
                </div>
                <button
                  className="gal-modal-close"
                  onClick={() => setActive(null)}
                >
                  ✕
                </button>
              </div>

              {active.caption && (
                <div className="gal-modal-caption">{active.caption}</div>
              )}

              <div className="gal-modal-actions">
                <button
                  className={
                    "gal-action-btn" + (hasLiked(active) ? " liked" : "")
                  }
                  onClick={() => toggleLike(active)}
                  disabled={likeBusyId === active.id}
                >
                  {hasLiked(active) ? "♥" : "♡"} {formatCount(active.likeCount || 0)}
                </button>
                <button className="gal-action-btn" onClick={() => shareItem(active)}>
                  ↗ Share {formatCount(active.shareCount || 0)}
                </button>
              </div>

              <div className="gal-comments-list">
                {(active.comments || []).length === 0 ? (
                  <div className="gal-comment-empty">
                    No comments yet. Be the first!
                  </div>
                ) : (
                  active.comments.map((c, i) => (
                    <div className="gal-comment" key={i}>
                      {c.photoUrl ? (
                        <img src={c.photoUrl} alt="" className="gal-comment-avatar" />
                      ) : (
                        <span className="gal-comment-avatar-fallback">
                          {(c.name || "?").charAt(0).toUpperCase()}
                        </span>
                      )}
                      <div>
                        <span className="gal-comment-name">{c.name || "Visitor"}</span>
                        {c.role === "teacher" && (
                          <span className="gal-post-verified">✓</span>
                        )}
                        <div className="gal-comment-text">{c.text}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <form className="gal-comment-form" onSubmit={submitComment}>
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Write a comment..."
                />
                <button type="submit" className="gal-comment-submit">
                  Post
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="gal-share-toast">{toast}</div>}

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