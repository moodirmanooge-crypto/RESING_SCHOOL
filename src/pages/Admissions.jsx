// src/pages/Admissions.jsx
import { useState } from "react";
import "../styles/admissions.css";
import logo from "../assets/logo.png";
import { Link } from "react-router-dom";
import { db } from "../firebase/firebase";
import { doc, setDoc } from "firebase/firestore";

const SUPPORT_WHATSAPP = "252617390261";
const SUPPORT_EMAIL = "risingstar0261@gmail.com";

const NAV_LINKS = [
  { label: "Home", to: "/" },
  { label: "About Us", to: "/about" },
  { label: "Admissions", to: "/admissions" },
  { label: "Academics", to: "/academics" },
  { label: "Gallery", to: "/gallery" },
  { label: "News & Events", to: "/news" },
  { label: "Contact", to: "/contact" },
];

const STEPS = [
  {
    num: "1",
    title: "Submit Application",
    desc: "Fill out the admission form below with your child's details.",
  },
  {
    num: "2",
    title: "Document Review",
    desc: "Our admissions team reviews the application and documents.",
  },
  {
    num: "3",
    title: "Entrance Assessment",
    desc: "A short placement assessment is scheduled for the student.",
  },
  {
    num: "4",
    title: "Confirmation",
    desc: "Families are notified and enrollment is confirmed.",
  },
];

const REQUIRED_DOCS = [
  "Birth certificate (copy)",
  "Previous school report / transfer certificate",
  "2 passport-size photos",
  "Parent/guardian ID (copy)",
];

const classOptions = [
  "Class 1",
  "Class 2",
  "Class 3",
  "Class 4",
  "Class 5",
  "Class 6",
  "Class 7",
  "Class 8",
  "Form 1",
  "Form 2",
  "Form 3",
  "Form 4",
];

export default function Admissions() {
  const [form, setForm] = useState({
    studentName: "",
    dob: "",
    desiredClass: "",
    previousSchool: "",
    parentName: "",
    parentPhone: "",
    parentEmail: "",
    address: "",
    notes: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      !form.studentName.trim() ||
      !form.desiredClass ||
      !form.parentPhone.trim()
    ) {
      alert(
        "Fadlan buuxi meelaha muhiimka ah: Magaca ardayga, Fasalka, iyo Telefoonka waalidka."
      );
      return;
    }

    try {
      setSubmitting(true);

      // ✅ Collection-ka "Admissions" — document id-giisu waa magaca
      // ardayga uu waalidku soo qoray (marka mid isku magac ah horeba jiro,
      // waxaan ku daraynaa taariikh/waqti si document-ku u kala duwanaado).
      const cleanName = form.studentName.trim().replace(/\s+/g, " ");
      const docId = `${cleanName}_${Date.now()}`;

      await setDoc(doc(db, "Admissions", docId), {
        studentName: form.studentName,
        dob: form.dob,
        desiredClass: form.desiredClass,
        previousSchool: form.previousSchool,
        parentName: form.parentName,
        parentPhone: form.parentPhone,
        parentEmail: form.parentEmail,
        address: form.address,
        notes: form.notes,
        status: "Pending",
        submittedAt: new Date(),
      });

      setSubmitted(true);
    } catch (err) {
      console.log(err);
      alert(
        "Khalad ayaa dhacay markii codsigaaga la kaydinayay. Fadlan mar kale isku day."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSubmitted(false);
    setForm({
      studentName: "",
      dob: "",
      desiredClass: "",
      previousSchool: "",
      parentName: "",
      parentPhone: "",
      parentEmail: "",
      address: "",
      notes: "",
    });
  };

  return (
    <div className="adm-page">
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
              className={
                "home-nav-link" + (l.to === "/admissions" ? " active" : "")
              }
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="header-actions">
          <div className="menu-wrap">
            <button
              type="button"
              className="help-pill-hidden"
              aria-label="Need help?"
            >
              ?
            </button>
          </div>

          <div className="menu-wrap">
            <Link to="/admin-login" className="login-portal-btn">
              <span className="login-portal-icon">Login</span>
              Login / Portal
            </Link>
          </div>
        </div>
      </header>

      <section className="adm-hero">
        <div className="adm-hero-badge">Admissions</div>
        <h1 className="adm-hero-title">Join Rising Star School</h1>
        <p className="adm-hero-sub">
          Applications for the current academic year are open. Fill in the
          form below to start your child's journey with us.
        </p>
        <span className="adm-status-pill">
          <span className="adm-status-dot" />
          Enrollment is currently OPEN
        </span>
      </section>

      <div className="adm-content">
        <section className="adm-steps-card">
          <h2 className="adm-section-title">How Admission Works</h2>
          <div className="adm-steps-grid">
            {STEPS.map((s) => (
              <div className="adm-step" key={s.num}>
                <div className="adm-step-num">{s.num}</div>
                <div className="adm-step-title">{s.title}</div>
                <div className="adm-step-desc">{s.desc}</div>
              </div>
            ))}
          </div>
        </section>

        <div className="adm-main-grid">
          <section className="adm-form-card">
            <h2 className="adm-section-title">Application Form</h2>

            {submitted ? (
              <div className="adm-success">
                <div className="adm-success-icon">Done</div>
                <h3>Application Received!</h3>
                <p>
                  Thank you, {form.studentName || "future student"}! Our
                  admissions team will contact {form.parentName || "you"}{" "}
                  shortly at <strong>{form.parentPhone}</strong>.
                </p>
                <button
                  type="button"
                  className="adm-reset-btn"
                  onClick={resetForm}
                >
                  Submit Another Application
                </button>
              </div>
            ) : (
              <form className="adm-form" onSubmit={handleSubmit}>
                <div className="adm-form-section-label">
                  Student Information
                </div>
                <div className="adm-form-grid">
                  <div className="adm-field">
                    <label>Student Full Name *</label>
                    <input
                      name="studentName"
                      value={form.studentName}
                      onChange={handleChange}
                      placeholder="e.g. Ahmed Ali"
                    />
                  </div>
                  <div className="adm-field">
                    <label>Date of Birth</label>
                    <input
                      type="date"
                      name="dob"
                      value={form.dob}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="adm-field">
                    <label>Desired Class *</label>
                    <select
                      name="desiredClass"
                      value={form.desiredClass}
                      onChange={handleChange}
                    >
                      <option value="">Select class</option>
                      {classOptions.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="adm-field">
                    <label>Previous School</label>
                    <input
                      name="previousSchool"
                      value={form.previousSchool}
                      onChange={handleChange}
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div className="adm-form-section-label">
                  Parent / Guardian Information
                </div>
                <div className="adm-form-grid">
                  <div className="adm-field">
                    <label>Parent / Guardian Name</label>
                    <input
                      name="parentName"
                      value={form.parentName}
                      onChange={handleChange}
                      placeholder="e.g. Faadumo Xasan"
                    />
                  </div>
                  <div className="adm-field">
                    <label>Phone Number *</label>
                    <input
                      name="parentPhone"
                      value={form.parentPhone}
                      onChange={handleChange}
                      placeholder="61xxxxxxx"
                    />
                  </div>
                  <div className="adm-field">
                    <label>Email</label>
                    <input
                      type="email"
                      name="parentEmail"
                      value={form.parentEmail}
                      onChange={handleChange}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="adm-field">
                    <label>Address</label>
                    <input
                      name="address"
                      value={form.address}
                      onChange={handleChange}
                      placeholder="District / area"
                    />
                  </div>
                </div>

                <div className="adm-field adm-field-full">
                  <label>Additional Notes</label>
                  <textarea
                    name="notes"
                    rows={4}
                    value={form.notes}
                    onChange={handleChange}
                    placeholder="Anything else we should know?"
                  />
                </div>

                <button
                  type="submit"
                  className="adm-submit-btn"
                  disabled={submitting}
                  style={{
                    opacity: submitting ? 0.7 : 1,
                    cursor: submitting ? "not-allowed" : "pointer",
                  }}
                >
                  {submitting ? "Kaydinaya..." : "Submit Application"}
                </button>
              </form>
            )}
          </section>

          <aside className="adm-sidebar">
            <div className="adm-side-card">
              <h3 className="adm-side-title">Required Documents</h3>
              <ul className="adm-doc-list">
                {REQUIRED_DOCS.map((d) => (
                  <li key={d}>
                    <span className="adm-doc-check">Yes</span>
                    {d}
                  </li>
                ))}
              </ul>
            </div>

            <div className="adm-side-card adm-contact-card">
              <h3 className="adm-side-title">Need Help?</h3>
              <p className="adm-side-text">
                Our admissions team is happy to answer any questions.
              </p>
              <a
                href={`https://wa.me/${SUPPORT_WHATSAPP}`}
                target="_blank"
                rel="noopener noreferrer"
                className="adm-contact-link"
              >
                WhatsApp: 0{SUPPORT_WHATSAPP.slice(3)}
              </a>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="adm-contact-link">
                {SUPPORT_EMAIL}
              </a>
            </div>
          </aside>
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
          <a href="tel:+252611234567">+252 61 7390261</a>
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