// src/pages/Gallery.jsx
import { useEffect, useState, useRef } from "react";
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

// Returns the list of {url, type} media for a gallery doc, whether it
// was created with the new multi-media `mediaItems` array or the old
// single `mediaUrl`/`mediaType` fields — so old posts keep working
// unchanged (shown as a one-item grid/carousel).
function getMediaList(item) {
  if (Array.isArray(item?.mediaItems) && item.mediaItems.length > 0) {
    return item.mediaItems;
  }
  if (item?.mediaUrl) {
    return [{ url: item.mediaUrl, type: item.mediaType || "image" }];
  }
  return [];
}

// ---------------------------------------------------------------------
// Facebook-style multi-photo grid for the feed: 1 photo = full width,
// 2 = side by side, 3 = one big + two stacked, 4+ = 2x2 with a "+N"
// overlay on the last tile when there are more than 4. Tapping ANY tile
// opens the fullscreen Lightbox starting at that photo's index — exactly
// like tapping a Facebook post's photo grid opens the full-screen viewer.
// ---------------------------------------------------------------------
function PostMediaGrid({ media, onOpen }) {
  if (!media || media.length === 0) return null;
  const count = media.length;

  function Tile({ item, idx, overlay }) {
    return (
      <div
        onClick={() => onOpen(idx)}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          cursor: "pointer",
          background: "#000",
        }}
      >
        {item.type === "video" ? (
          <video src={item.url} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} muted />
        ) : (
          <img src={item.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        )}
        {item.type === "video" && !overlay && (
          <span className="gal-video-badge">▶ Video</span>
        )}
        {overlay}
      </div>
    );
  }

  if (count === 1) {
    return (
      <div className="gal-media-wrap" style={{ position: "relative", cursor: "pointer" }}>
        <Tile item={media[0]} idx={0} />
      </div>
    );
  }

  if (count === 2) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, aspectRatio: "16/9", borderRadius: 12, overflow: "hidden" }}>
        {media.map((m, i) => (
          <Tile key={i} item={m} idx={i} />
        ))}
      </div>
    );
  }

  if (count === 3) {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gridTemplateRows: "1fr 1fr",
          gap: 2,
          aspectRatio: "4/3",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <div style={{ gridRow: "1 / 3" }}>
          <Tile item={media[0]} idx={0} />
        </div>
        <Tile item={media[1]} idx={1} />
        <Tile item={media[2]} idx={2} />
      </div>
    );
  }

  // 4 or more
  const extra = count - 4;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "1fr 1fr",
        gap: 2,
        aspectRatio: "1/1",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {media.slice(0, 4).map((m, i) => {
        if (i === 3 && extra > 0) {
          return (
            <Tile
              key={i}
              item={m}
              idx={i}
              overlay={
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(0,0,0,0.55)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontSize: 30,
                    fontWeight: 800,
                  }}
                >
                  +{extra}
                </div>
              }
            />
          );
        }
        return <Tile key={i} item={m} idx={i} />;
      })}
    </div>
  );
}

// ---------------------------------------------------------------------
// Fullscreen photo/video viewer (Facebook-style lightbox): dark
// near-black backdrop, the media centered and scaled to fit, round
// prev/next arrow buttons on the sides, an index counter, and a close
// (✕) button — opened by tapping any photo in a post's grid, starting
// at that exact photo. Supports left/right arrow keys and Escape.
// ---------------------------------------------------------------------
function Lightbox({ media, startIndex, onClose }) {
  const [index, setIndex] = useState(startIndex);

  useEffect(() => {
    setIndex(startIndex);
  }, [startIndex]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setIndex((i) => (i > 0 ? i - 1 : media.length - 1));
      if (e.key === "ArrowRight") setIndex((i) => (i < media.length - 1 ? i + 1 : 0));
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [media, onClose]);

  if (!media || media.length === 0) return null;
  const current = media[Math.min(index, media.length - 1)];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.94)",
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <button
        onClick={onClose}
        aria-label="Close"
        style={{
          position: "absolute",
          top: 18,
          left: 18,
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: "none",
          background: "rgba(255,255,255,0.15)",
          color: "#fff",
          fontSize: 20,
          cursor: "pointer",
          zIndex: 3,
        }}
      >
        ✕
      </button>

      {media.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIndex((i) => (i > 0 ? i - 1 : media.length - 1));
          }}
          aria-label="Previous"
          style={{
            position: "absolute",
            left: 20,
            top: "50%",
            transform: "translateY(-50%)",
            width: 50,
            height: 50,
            borderRadius: "50%",
            border: "none",
            background: "rgba(255,255,255,0.15)",
            color: "#fff",
            fontSize: 26,
            cursor: "pointer",
            zIndex: 3,
          }}
        >
          ‹
        </button>
      )}

      <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: "90vw", maxHeight: "88vh" }}>
        {current.type === "video" ? (
          <video
            src={current.url}
            controls
            autoPlay
            style={{ maxWidth: "90vw", maxHeight: "88vh", display: "block" }}
          />
        ) : (
          <img
            src={current.url}
            alt=""
            style={{ maxWidth: "90vw", maxHeight: "88vh", objectFit: "contain", display: "block" }}
          />
        )}
      </div>

      {media.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIndex((i) => (i < media.length - 1 ? i + 1 : 0));
          }}
          aria-label="Next"
          style={{
            position: "absolute",
            right: 20,
            top: "50%",
            transform: "translateY(-50%)",
            width: 50,
            height: 50,
            borderRadius: "50%",
            border: "none",
            background: "rgba(255,255,255,0.15)",
            color: "#fff",
            fontSize: 26,
            cursor: "pointer",
            zIndex: 3,
          }}
        >
          ›
        </button>
      )}

      {media.length > 1 && (
        <div
          style={{
            position: "absolute",
            bottom: 22,
            left: "50%",
            transform: "translateX(-50%)",
            color: "#fff",
            fontSize: 13.5,
            fontWeight: 600,
            background: "rgba(255,255,255,0.15)",
            padding: "5px 16px",
            borderRadius: 14,
          }}
        >
          {Math.min(index, media.length - 1) + 1} / {media.length}
        </div>
      )}
    </div>
  );
}

// One-at-a-time media carousel (used inside the comments side-modal),
// with prev/next arrows and dot indicators when a post has more than
// one photo/video, plus basic touch-swipe support for mobile.
function MediaCarousel({ media, videoBadge = true }) {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef(null);

  useEffect(() => {
    setIndex(0);
  }, [media]);

  if (!media || media.length === 0) return null;
  const safeIndex = Math.min(index, media.length - 1);
  const current = media[safeIndex];

  function goPrev(e) {
    e.stopPropagation();
    setIndex((i) => (i > 0 ? i - 1 : media.length - 1));
  }
  function goNext(e) {
    e.stopPropagation();
    setIndex((i) => (i < media.length - 1 ? i + 1 : 0));
  }

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX;
  }
  function handleTouchEnd(e) {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) {
      if (dx > 0) setIndex((i) => (i > 0 ? i - 1 : media.length - 1));
      else setIndex((i) => (i < media.length - 1 ? i + 1 : 0));
    }
    touchStartX.current = null;
  }

  return (
    <div
      className="gal-media-wrap"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{ position: "relative" }}
    >
      {current.type === "video" ? (
        <>
          <video src={current.url} muted />
          {videoBadge && <span className="gal-video-badge">▶ Video</span>}
        </>
      ) : (
        <img src={current.url} alt="" />
      )}

      {media.length > 1 && (
        <>
          <button onClick={goPrev} style={carouselArrowStyle("left")} aria-label="Previous">
            ‹
          </button>
          <button onClick={goNext} style={carouselArrowStyle("right")} aria-label="Next">
            ›
          </button>
          <div
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              background: "rgba(0,0,0,0.6)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              padding: "3px 10px",
              borderRadius: 12,
              zIndex: 2,
            }}
          >
            {safeIndex + 1}/{media.length}
          </div>
          <div
            style={{
              position: "absolute",
              bottom: 10,
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              gap: 6,
              zIndex: 2,
            }}
          >
            {media.map((_, i) => (
              <span
                key={i}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: i === safeIndex ? "#fff" : "rgba(255,255,255,0.45)",
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function carouselArrowStyle(side) {
  return {
    position: "absolute",
    top: "50%",
    [side]: 8,
    transform: "translateY(-50%)",
    width: 34,
    height: 34,
    borderRadius: "50%",
    border: "none",
    background: "rgba(0,0,0,0.5)",
    color: "#fff",
    fontSize: 20,
    lineHeight: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    padding: 0,
    zIndex: 2,
  };
}

export default function Gallery() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [active, setActive] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [toast, setToast] = useState("");

  // Fullscreen photo viewer (Facebook-style) — { media, startIndex } | null
  const [lightbox, setLightbox] = useState(null);

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
    const media = getMediaList(i);
    const hasVideo = media.some((m) => m.type === "video");
    const hasPhoto = media.some((m) => m.type !== "video");
    if (filter === "Photos") return hasPhoto;
    if (filter === "Videos") return hasVideo;
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
              {filtered.map((item) => {
                const media = getMediaList(item);
                return (
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

                    <PostMediaGrid
                      media={media}
                      onOpen={(idx) => setLightbox({ media, startIndex: idx })}
                    />

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
                );
              })}
            </div>
          )}
        </div>
      )}

      {active && account && (
        <div className="gal-modal-overlay" onClick={() => setActive(null)}>
          <div className="gal-modal" onClick={(e) => e.stopPropagation()}>
            <div className="gal-modal-media">
              <MediaCarousel media={getMediaList(active)} videoBadge={false} />
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

      {lightbox && (
        <Lightbox
          media={lightbox.media}
          startIndex={lightbox.startIndex}
          onClose={() => setLightbox(null)}
        />
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