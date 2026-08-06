// src/pages/Library.jsx
//
// Public library — shows every PDF/book the admin has published via
// admin/pages/LibraryManager.jsx (Firestore collection `library`, cover
// image + PDF stored in Storage under `library/`). Every book here is
// paid — there is no free/download-directly path. Tapping "View" opens
// a full-screen reader so the visitor can read the PDF inline; the
// browser's own Ctrl+S / Ctrl+P save flow, right-click save, and text
// selection are all disabled inside the reader — only the "Download Now"
// button actually saves the file, and it immediately triggers the
// second "Proceed to Payment" style prompt (no separate click, no new
// tab) asking the visitor to send payment to a WhatsApp number and
// submit a short name+phone request (saved to Firestore
// `libraryRequests`); the admin follows up manually once the request +
// payment are visible on their Dashboard.

import { useEffect, useState } from "react";
import "../styles/library.css";
import logo from "../assets/logo.png";
import { Link } from "react-router-dom";
import { db } from "../firebase/firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  increment,
  serverTimestamp,
} from "firebase/firestore";

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

const FILTERS = ["All", "🟢 Primary School", "🟡 Middle School", "🟢 Primary School", "🔵 Secondary School", "Other"];
const PAYMENT_NUMBER = "0617390261";

function formatPrice(price) {
  const n = Number(price) || 0;
  return "$" + n.toLocaleString();
}

export default function Library() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");

  const [reading, setReading] = useState(null);
  const [paying, setPaying] = useState(null);

  const [reqName, setReqName] = useState("");
  const [reqPhone, setReqPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const q = query(collection(db, "library"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setBooks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load library:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // While the full-screen reader is open, block the browser's own
  // Ctrl+S (save page) and Ctrl+P (print) shortcuts, and block
  // Ctrl+A / text selection so the visitor cannot select-all and copy
  // the book text out from underneath the PDF viewer overlay. The PDF
  // itself is shown in an <iframe>, so this only affects the page
  // chrome around it, not the PDF's own internal viewer controls.
  useEffect(() => {
    if (!reading) return;

    function handleKeyDown(e) {
      const key = e.key ? e.key.toLowerCase() : "";
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      if (isCtrlOrCmd && (key === "s" || key === "p" || key === "a")) {
        e.preventDefault();
        e.stopPropagation();
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [reading]);

  const filtered = books.filter((b) => {
    const matchesFilter = filter === "All" || b.category === filter;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      String(b.title || "").toLowerCase().includes(q) ||
      String(b.author || "").toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  function openReader(book) {
    setReading(book);

    try {
      updateDoc(doc(db, "library", book.id), { viewCount: increment(1) });
    } catch (err) {
      // non-critical
    }
  }

  function closeReader() {
    setReading(null);
  }

  // "Download Now" no longer opens a separate tab/link — it immediately
  // moves the visitor into the payment step, same modal flow, no new
  // browser tab.
  function handleDownloadClick(book) {
    openPayment(book);
  }

  function openPayment(book) {
    setPaying(book);
    setReqName("");
    setReqPhone("");
    setSubmitted(false);
    setFormError("");
  }

  function closePayment() {
    setPaying(null);
  }

  async function submitRequest(e) {
    e.preventDefault();
    setFormError("");

    if (!reqName.trim()) {
      setFormError("Fadlan geli magacaaga.");
      return;
    }
    if (!reqPhone.trim()) {
      setFormError("Fadlan geli lambarkaaga telefoonka.");
      return;
    }

    try {
      setSubmitting(true);
      const docId = String(Date.now());
      await setDoc(doc(db, "libraryRequests", docId), {
        bookId: paying.id,
        bookTitle: paying.title || "",
        bookPrice: paying.price || 0,
        name: reqName.trim(),
        phone: reqPhone.trim(),
        status: "Pending",
        createdAt: serverTimestamp(),
      });

      try {
        await updateDoc(doc(db, "library", paying.id), {
          requestCount: increment(1),
        });
      } catch (err) {
        // non-critical
      }

      setSubmitted(true);
    } catch (err) {
      console.error("Failed to submit library request:", err);
      setFormError("Khalad ayaa dhacay. Fadlan isku day mar kale.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="lib-page">
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
              className={"home-nav-link" + (l.to === "/library" ? " active" : "")}
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

      <section className="lib-hero">
        <div className="lib-hero-badge">Library</div>
        <h1 className="lib-hero-title">School Library and Bookshop</h1>
        <p className="lib-hero-sub">
          Browse our collection of PDF books and materials. Read the book,
          then complete payment to keep your copy.
        </p>
      </section>

      <div className="lib-content">
        <div className="lib-toolbar">
          <div className="lib-search-wrap">
            <span>Search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title or author..."
            />
          </div>
          {FILTERS.map((f) => (
            <button
              key={f}
              className={"lib-filter-pill" + (filter === f ? " active" : "")}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="lib-empty">Loading library...</div>
        ) : filtered.length === 0 ? (
          <div className="lib-empty">No books found.</div>
        ) : (
          <div className="lib-grid">
            {filtered.map((book) => (
              <div className="lib-card" key={book.id}>
                <div className="lib-cover-wrap" onClick={() => openReader(book)}>
                  {book.coverUrl ? (
                    <img src={book.coverUrl} alt={book.title || "Book cover"} />
                  ) : (
                    <div className="lib-cover-fallback">
                      <span style={{ fontSize: 30 }}>Book</span>
                      <span className="lib-cover-fallback-title">
                        {book.title || "Untitled"}
                      </span>
                    </div>
                  )}
                  {book.category && (
                    <span className="lib-category-badge">{book.category}</span>
                  )}
                </div>

                <div className="lib-card-body">
                  <div className="lib-card-title">{book.title || "Untitled"}</div>
                  <div className="lib-card-author">{book.author || "Unknown author"}</div>

                  <div className="lib-card-footer">
                    <span className="lib-card-price">{formatPrice(book.price)}</span>
                    <button className="lib-card-btn" onClick={() => openReader(book)}>
                      View
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Full-screen reader. Sits in its own fixed-position layer above
          everything (including the nav bar), so "View" always opens a
          large, full-viewport reading surface — not a small card. */}
      {reading && (
        <div className="lib-reader-fullscreen">
          <div className="lib-reader-fs-header">
            <div>
              <h2 className="lib-modal-title">{reading.title || "Untitled"}</h2>
              <div className="lib-modal-author">
                by {reading.author || "Unknown author"}
              </div>
            </div>
            <div className="lib-reader-fs-header-right">
              <span className="lib-card-price">{formatPrice(reading.price)}</span>
              <button className="lib-modal-close" onClick={closeReader}>
                Close
              </button>
            </div>
          </div>

          <div className="lib-reader-fs-frame-wrap" onContextMenu={(e) => e.preventDefault()}>
            {reading.pdfUrl ? (
              <iframe
                src={reading.pdfUrl + "#toolbar=0"}
                title={reading.title || "Book"}
                className="lib-reader-fs-frame"
              />
            ) : (
              <div className="lib-empty">This book has no file yet.</div>
            )}
          </div>

          <div className="lib-reader-actions">
            <button
              className="lib-download-btn"
              onClick={() => handleDownloadClick(reading)}
            >
              Download Now
            </button>
            <button
              className="lib-buy-btn"
              onClick={() => openPayment(reading)}
            >
              Proceed to Payment
            </button>
          </div>
        </div>
      )}

      {paying && (
        <div className="lib-modal-overlay" onClick={closePayment}>
          <div className="lib-modal" onClick={(e) => e.stopPropagation()}>
            <button className="lib-modal-close" onClick={closePayment}>
              Close
            </button>

            <div className="lib-modal-body">
              <h2 className="lib-modal-title">{paying.title || "Untitled"}</h2>
              <div className="lib-modal-author">
                by {paying.author || "Unknown author"}
              </div>

              <div className="lib-modal-price-row">
                <span className="lib-modal-price-label">Price</span>
                <span className="lib-modal-price-value">{formatPrice(paying.price)}</span>
              </div>

              {submitted ? (
                <div className="lib-request-success">
                  <div className="lib-request-success-icon">Done</div>
                  <h3>Request Sent!</h3>
                  <p>
                    Thank you, {reqName}. Please wait while the admin
                    confirms your payment - you will be contacted shortly.
                  </p>
                </div>
              ) : (
                <>
                  <div className="lib-payment-note">
                    Fadlan qiimaha ku dir lambarkan: <strong>{PAYMENT_NUMBER}</strong>,
                    kadibna buuxi foomka hoose oo Submit garee.
                  </div>

                  <form onSubmit={submitRequest}>
                    <div className="lib-form-fields">
                      <input
                        value={reqName}
                        onChange={(e) => setReqName(e.target.value)}
                        placeholder="Your name"
                      />
                      <input
                        value={reqPhone}
                        onChange={(e) => setReqPhone(e.target.value)}
                        placeholder="Your phone number"
                      />
                    </div>

                    {formError && (
                      <div style={{ color: "#b91c1c", fontSize: 12.5, marginBottom: 12 }}>
                        {formError}
                      </div>
                    )}

                    <button type="submit" className="lib-buy-btn" disabled={submitting}>
                      {submitting ? "Sending..." : "Submit"}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}

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