import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, doc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { Search, Printer, X, Receipt as ReceiptIcon, Trash2 } from "lucide-react";

import schoolLogo from "../assets/logo.png";
import principalSignature from "../assets/signature-principal.png";

const SCHOOL_NAME_LINE1 = "DUGSIGA HOOSE / DHEXE &";
const SCHOOL_NAME_LINE2 = "SARE RISING STAR SCHOOL";
const ARABIC_NAME_LINE1 = "مدرسة ريسن استار";
const ARABIC_NAME_LINE2 = "الأساسية والثانوية";

const SCHOOL_LOCATION = "Muqdisho - Soomaaliya";
const ARABIC_LOCATION = "مقديشو - الصومال";
const SCHOOL_PHONES = "858516 / 0615860629 / 0617636461 / 0617536461";
const SCHOOL_EMAIL = "israpp@hotmail.com";

const USD_TO_SOS_RATE = 28;

function formatDate(value) {
  if (!value) return "—";
  const d = value?.seconds ? new Date(value.seconds * 1000) : new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ---- Amount -> Words (English) ----
const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
];

function threeDigitsToWords(n) {
  let str = "";
  if (n >= 100) {
    str += ONES[Math.floor(n / 100)] + " Hundred ";
    n %= 100;
  }
  if (n >= 20) {
    str += TENS[Math.floor(n / 10)] + " ";
    n %= 10;
  }
  if (n > 0) {
    str += ONES[n] + " ";
  }
  return str.trim();
}

function integerToWords(num) {
  if (num === 0) return "Zero";
  const parts = [];
  const million = Math.floor(num / 1000000);
  const thousand = Math.floor((num % 1000000) / 1000);
  const rest = num % 1000;

  if (million) parts.push(`${threeDigitsToWords(million)} Million`);
  if (thousand) parts.push(`${threeDigitsToWords(thousand)} Thousand`);
  if (rest) parts.push(threeDigitsToWords(rest));

  return parts.join(" ").trim();
}

function amountToWords(amount) {
  const num = Number(amount) || 0;
  const dollars = Math.floor(num);
  const cents = Math.round((num - dollars) * 100);

  let words = `${integerToWords(dollars)} Dollar${dollars === 1 ? "" : "s"}`;
  if (cents > 0) {
    words += ` and ${integerToWords(cents)} Cent${cents === 1 ? "" : "s"}`;
  }
  return words;
}

const cardStyle = {
  background: "#fff",
  borderRadius: 18,
  boxShadow: "0 4px 18px rgba(17,24,39,0.06)",
  border: "1px solid rgba(17,24,39,0.05)",
};

export default function Receipts() {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [deletingAll, setDeletingAll] = useState(false);

  useEffect(() => {
    fetchReceipts();
  }, []);

  async function fetchReceipts() {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, "receipts"));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const at = a.createdAt?.seconds || 0;
        const bt = b.createdAt?.seconds || 0;
        if (bt !== at) return bt - at;
        return String(b.receiptNo).localeCompare(String(a.receiptNo));
      });
      setReceipts(list);
    } catch (err) {
      console.error("Khalad ayaa dhacay markii rasiidhada la soo qaadanayay:", err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return receipts;
    return receipts.filter((r) => {
      return (
        String(r.receiptNo || "").toLowerCase().includes(q) ||
        String(r.studentName || "").toLowerCase().includes(q) ||
        String(r.className || "").toLowerCase().includes(q) ||
        String(r.monthLabel || "").toLowerCase().includes(q)
      );
    });
  }, [receipts, query]);

  const totalCollected = useMemo(
    () => filtered.reduce((sum, r) => sum + (Number(r.paidAmount) || 0), 0),
    [filtered]
  );

  function askDeleteOne(receipt) {
    setConfirmTarget({ type: "one", receipt });
  }

  function askDeleteAll() {
    if (filtered.length === 0) return;
    setConfirmTarget({ type: "all" });
  }

  async function confirmDelete() {
    if (!confirmTarget) return;

    if (confirmTarget.type === "one") {
      const receipt = confirmTarget.receipt;
      try {
        setDeletingId(receipt.id);
        await deleteDoc(doc(db, "receipts", receipt.id));
        setReceipts((prev) => prev.filter((r) => r.id !== receipt.id));
        if (selected?.id === receipt.id) setSelected(null);
        setConfirmTarget(null);
      } catch (err) {
        console.error("Khalad ayaa dhacay markii rasiidka la tirtirayay:", err);
        alert("Khalad ayaa dhacay: " + err.message);
      } finally {
        setDeletingId(null);
      }
    } else {
      try {
        setDeletingAll(true);
        const idsToDelete = filtered.map((r) => r.id);
        await Promise.all(idsToDelete.map((id) => deleteDoc(doc(db, "receipts", id))));
        setReceipts((prev) => prev.filter((r) => !idsToDelete.includes(r.id)));
        if (selected && idsToDelete.includes(selected.id)) setSelected(null);
        setConfirmTarget(null);
      } catch (err) {
        console.error("Khalad ayaa dhacay markii dhammaan rasiidhada la tirtirayay:", err);
        alert("Khalad ayaa dhacay: " + err.message);
      } finally {
        setDeletingAll(false);
      }
    }
  }

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "#F3F4F8",
        fontFamily: "'Inter','Segoe UI',sans-serif",
        width: "100%",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: "26px 30px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 14,
              marginBottom: 22,
            }}
          >
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#111827" }}>
                Receipts
              </h1>
              <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "#6B7280" }}>
                Dhammaan rasiidhada lacagaha ee laga bixiyay {SCHOOL_NAME_LINE2}
              </p>
            </div>

            <div
              style={{
                ...cardStyle,
                padding: "12px 20px",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: "#E6F5EC",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ReceiptIcon size={19} color="#16a34a" />
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: "#9CA3AF" }}>
                  {query ? "Natiijooyinka" : "Wadarta"} Rasiidhada
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>
                  {filtered.length}
                </div>
              </div>
              <div style={{ width: 1, height: 30, background: "#F3F4F6" }} />
              <div>
                <div style={{ fontSize: 11.5, color: "#9CA3AF" }}>Wadarta Lacagta</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#16a34a" }}>
                  ${totalCollected.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              ...cardStyle,
              padding: "14px 18px",
              marginBottom: 20,
              display: "flex",
              gap: 14,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "#F9FAFB",
                border: "1px solid #F3F4F6",
                borderRadius: 12,
                padding: "10px 14px",
                flex: 1,
                minWidth: 220,
              }}
            >
              <Search size={16} color="#9CA3AF" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Raadi lambarka rasiidka, magaca ardayga, fasalka, ama bisha..."
                style={{
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  flex: 1,
                  fontSize: 13.5,
                  color: "#111827",
                }}
              />
              {query && (
                <X
                  size={16}
                  color="#9CA3AF"
                  style={{ cursor: "pointer" }}
                  onClick={() => setQuery("")}
                />
              )}
            </div>

            {filtered.length > 0 && (
              <button
                onClick={askDeleteAll}
                disabled={deletingAll}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  border: "1px solid #FCA5A5",
                  background: "#FEF2F2",
                  color: "#DC2626",
                  fontWeight: 700,
                  fontSize: 12.5,
                  padding: "10px 16px",
                  borderRadius: 10,
                  cursor: deletingAll ? "not-allowed" : "pointer",
                  opacity: deletingAll ? 0.7 : 1,
                  whiteSpace: "nowrap",
                }}
              >
                <Trash2 size={14} />
                {deletingAll ? "Tirtiraya..." : "Tirtir Dhammaan"}
              </button>
            )}
          </div>

          <div style={{ ...cardStyle, padding: "20px 22px", overflowX: "auto" }}>
            {loading && (
              <p style={{ fontSize: 13, color: "#9CA3AF", padding: "20px 0", textAlign: "center" }}>
                Soo dejinaya rasiidhada...
              </p>
            )}

            {!loading && filtered.length === 0 && (
              <p style={{ fontSize: 13, color: "#9CA3AF", padding: "20px 0", textAlign: "center" }}>
                {query ? "Wax rasiid ah oo la mid ah lama helin." : "Rasiid lama helin weli."}
              </p>
            )}

            {!loading && filtered.length > 0 && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 700 }}>
                <thead>
                  <tr style={{ color: "#9CA3AF", textAlign: "left" }}>
                    <th style={{ fontWeight: 600, paddingBottom: 10 }}>No</th>
                    <th style={{ fontWeight: 600, paddingBottom: 10 }}>Student</th>
                    <th style={{ fontWeight: 600, paddingBottom: 10 }}>Class</th>
                    <th style={{ fontWeight: 600, paddingBottom: 10 }}>Month</th>
                    <th style={{ fontWeight: 600, paddingBottom: 10 }}>Date</th>
                    <th style={{ fontWeight: 600, paddingBottom: 10 }}>Amount</th>
                    <th style={{ fontWeight: 600, paddingBottom: 10 }}></th>
                    <th style={{ fontWeight: 600, paddingBottom: 10 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} style={{ borderTop: "1px solid #F3F4F6" }}>
                      <td style={{ padding: "10px 0", fontWeight: 700, color: "#111827" }}>
                        {r.receiptNo}
                      </td>
                      <td style={{ color: "#111827", fontWeight: 600 }}>{r.studentName || "—"}</td>
                      <td style={{ color: "#6B7280" }}>{r.className || "—"}</td>
                      <td style={{ color: "#6B7280" }}>{r.monthLabel || "—"}</td>
                      <td style={{ color: "#6B7280" }}>{formatDate(r.paidAt || r.createdAt)}</td>
                      <td style={{ color: "#16a34a", fontWeight: 700 }}>
                        ${Number(r.paidAmount || 0).toLocaleString()}
                      </td>
                      <td>
                        <button
                          onClick={() => setSelected(r)}
                          style={{
                            border: "none",
                            background: "#E6F5EC",
                            color: "#16a34a",
                            fontWeight: 700,
                            fontSize: 12,
                            padding: "6px 12px",
                            borderRadius: 8,
                            cursor: "pointer",
                          }}
                        >
                          View
                        </button>
                      </td>
                      <td>
                        <button
                          onClick={() => askDeleteOne(r)}
                          disabled={deletingId === r.id}
                          style={{
                            border: "none",
                            background: "#FEF2F2",
                            color: "#DC2626",
                            fontWeight: 700,
                            fontSize: 12,
                            padding: "6px 10px",
                            borderRadius: 8,
                            cursor: deletingId === r.id ? "not-allowed" : "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {selected && (
        <ReceiptViewModal
          receipt={selected}
          onClose={() => setSelected(null)}
          onDelete={() => askDeleteOne(selected)}
          deleting={deletingId === selected.id}
        />
      )}

      {confirmTarget && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 3000,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 24,
              width: 360,
              maxWidth: "90%",
              fontFamily: "'Inter','Segoe UI',sans-serif",
            }}
          >
            <h3 style={{ margin: 0, fontSize: 16, color: "#111827" }}>Xaqiiji Tirtiridda</h3>
            <p style={{ fontSize: 13.5, color: "#6B7280", marginTop: 10, lineHeight: 1.6 }}>
              {confirmTarget.type === "one" ? (
                <>
                  Ma hubtaa inaad tirtirto rasiidka{" "}
                  <strong style={{ color: "#111827" }}>
                    {confirmTarget.receipt.receiptNo}
                  </strong>
                  ? Tallaabadan lama soo celin karo.
                </>
              ) : (
                <>
                  Ma hubtaa inaad tirtirto dhammaan{" "}
                  <strong style={{ color: "#111827" }}>{filtered.length}</strong> rasiid?
                  Tallaabadan lama soo celin karo.
                </>
              )}
            </p>

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button
                onClick={() => setConfirmTarget(null)}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 10,
                  border: "1px solid #E5E7EB",
                  background: "#fff",
                  color: "#374151",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Jooji
              </button>
              <button
                onClick={confirmDelete}
                disabled={deletingId !== null || deletingAll}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 10,
                  border: "none",
                  background: "#DC2626",
                  color: "#fff",
                  fontWeight: 700,
                  cursor: deletingId !== null || deletingAll ? "not-allowed" : "pointer",
                  opacity: deletingId !== null || deletingAll ? 0.7 : 1,
                }}
              >
                {deletingAll || deletingId ? "Tirtiraya..." : "Haa, Tirtir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReceiptViewModal({ receipt, onClose, onDelete, deleting }) {
  const paidDate = receipt.paidAt?.seconds
    ? new Date(receipt.paidAt.seconds * 1000)
    : receipt.createdAt?.seconds
    ? new Date(receipt.createdAt.seconds * 1000)
    : new Date();

  const totalPaidAmount = Number(receipt.paidAmount) || 0;
  const sosAmount = Math.round(totalPaidAmount * USD_TO_SOS_RATE);
  const amountWords = amountToWords(totalPaidAmount);

  return (
    <>
      <div className="rv-overlay">
        <div className="rv-actions no-print">
          <button onClick={onClose} className="rv-close-btn">
            Xir
          </button>
          <button onClick={onDelete} disabled={deleting} className="rv-delete-btn">
            <Trash2 size={14} style={{ marginRight: 6, verticalAlign: "-2px" }} />
            {deleting ? "Tirtiraya..." : "Tirtir"}
          </button>
          <button onClick={() => window.print()} className="rv-print-btn">
            <Printer size={14} style={{ marginRight: 6, verticalAlign: "-2px" }} />
            Print
          </button>
        </div>

        <div className="rv-paper">
          <div className="rc-frame">
            <div className="rc-outer">
              <div className="rc-top">
                <div className="rc-school-left">
                  <div className="rc-school-line1">{SCHOOL_NAME_LINE1}</div>
                  <div className="rc-school-line2">{SCHOOL_NAME_LINE2}</div>
                  <div className="rc-school-location">{SCHOOL_LOCATION}</div>
                </div>

                <img src={schoolLogo} alt="Logo" className="rc-logo" />

                <div className="rc-school-right" dir="rtl">
                  <div className="rc-arabic-line1">{ARABIC_NAME_LINE1}</div>
                  <div className="rc-arabic-line2">{ARABIC_NAME_LINE2}</div>
                  <div className="rc-arabic-location">{ARABIC_LOCATION}</div>
                </div>
              </div>

              <div className="rc-header-details">
                <div>{SCHOOL_NAME_LINE1} {SCHOOL_NAME_LINE2}</div>
                <div>Tel. {SCHOOL_PHONES} E-mail: {SCHOOL_EMAIL}</div>
              </div>

              <div className="rc-divider" />

              <div className="rc-body">
                <div className="rc-voucher-row">
                  <div className="rc-voucher-title">
                    RECEIPT VOUCHER
                    <div className="rc-voucher-sub">(Warqadda Lacag Qaabashada)</div>
                  </div>
                  <div className="rc-no">
                    N° <span className="rc-no-value">{receipt.receiptNo}</span>
                  </div>
                </div>

                <div className="rc-field">
                  <span className="rc-label">Date:</span>
                  <span className="rc-value">{formatDate(paidDate)}</span>
                </div>

                <div className="rc-field">
                  <span className="rc-label">Student ID:</span>
                  <span className="rc-value rc-id-val">{receipt.studentId || ""}</span>
                </div>

                <div className="rc-field-block">
                  <div className="rc-field-top">
                    <span className="rc-label">Received from:</span>
                    <span className="rc-value rc-value-strong">{receipt.studentName || "—"}</span>
                  </div>
                  <div className="rc-field-caption">(Laga qaday)</div>
                </div>

                <div className="rc-amount-block">
                  <div className="rc-amount-top">
                    <span className="rc-label">Amount of So Sh.</span>
                    <span className="rc-amount-box-sos">{sosAmount ? sosAmount.toLocaleString() : ""}</span>
                    <span className="rc-usd-group">
                      <span className="rc-usd-tag">US$</span>
                      <span className="rc-amount-box-usd">{totalPaidAmount}</span>
                    </span>
                  </div>
                  <div className="rc-field-caption">(Lacag dhan)</div>
                </div>

                <div className="rc-field">
                  <span className="rc-label">
                    In words <em>(Eray ahaan)</em>:
                  </span>
                  <span className="rc-value">{amountWords} Only</span>
                </div>

                <div className="rc-being-row">
                  <div className="rc-being-of">
                    <span className="rc-label">
                      Being of: <em>(Taasoo ah)</em>:
                    </span>
                    <span className="rc-value">{receipt.monthLabel || "Monthly Fee"}</span>
                  </div>
                  <div className="rc-side-fields">
                    <div className="rc-field-inline">
                      <span className="rc-label">Class:</span>
                      <span className="rc-value">{receipt.className || "—"}</span>
                    </div>
                    <div className="rc-field-inline">
                      <span className="rc-label">Tel.</span>
                      <span className="rc-value">{receipt.studentPhone || "—"}</span>
                    </div>
                  </div>
                </div>

                <div className="rc-bottom-row">
                  <div className="rc-payment-method">
                    <span className="rc-method-tag">PAYMENT METHOD</span>
                    <span className="rc-evc-label">EVC</span>
                    <span className="rc-evc-box rc-evc-checked">✓</span>
                  </div>

                  <img src={schoolLogo} alt="Stamp" className="rc-stamp" />

                  <div className="rc-signature">
                    <div className="rc-sig-title">PRINCIPAL SIGNATURE</div>
                    <img src={principalSignature} alt="Principal Signature" className="rc-sig-img" />
                    <div className="rc-sig-line" />
                  </div>
                </div>
              </div>

              <div className="rc-footer-note">
                <span className="rc-footer-icon">!</span> N.B. NOT REFUNDABLE.
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .rv-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.55);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 2000;
          gap: 14px;
        }
        .rv-actions { display: flex; gap: 10px; }
        .rv-close-btn, .rv-print-btn, .rv-delete-btn {
          border: none;
          border-radius: 10px;
          padding: 10px 18px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
        }
        .rv-close-btn { background: #ffffff; color: #6B7280; border: 1px solid #E5E7EB; }
        .rv-delete-btn { background: #DC2626; color: #ffffff; }
        .rv-print-btn { background: #16a34a; color: #ffffff; }

        .rv-paper {
          width: 650px;
          max-width: 95vw;
          background: #ffffff;
          padding: 0;
          font-family: 'Poppins', 'Segoe UI', Arial, sans-serif;
          color: #0b1f4d;
          box-shadow: 0 10px 30px rgba(0,0,0,0.25);
          box-sizing: border-box;
        }

        .rc-frame { border: 2px solid #0b1f4d; padding: 3px; box-sizing: border-box; }
        .rc-outer { border: 2px solid #0b1f4d; padding: 10px 14px; box-sizing: border-box; }

        .rc-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .rc-school-left { text-align: left; flex: 1; }
        .rc-school-right { text-align: right; flex: 1; }
        .rc-school-line1, .rc-arabic-line1 { font-weight: 800; font-size: 12px; color: #0b1f4d; }
        .rc-school-line2, .rc-arabic-line2 { font-weight: 800; font-size: 12px; color: #0b1f4d; }
        .rc-school-location, .rc-arabic-location { font-size: 9.5px; color: #475569; margin-top: 1px; }

        .rc-logo { width: 55px; height: 55px; object-fit: contain; flex-shrink: 0; }
        .rc-header-details { text-align: center; font-size: 9.5px; font-weight: 700; color: #0b1f4d; margin-top: 4px; }
        .rc-divider { border-top: 1.5px solid #0b1f4d; margin: 6px 0; }

        .rc-body { display: flex; flex-direction: column; gap: 6px; }
        .rc-voucher-row { display: flex; align-items: center; justify-content: space-between; }
        .rc-voucher-title { font-weight: 900; font-size: 15px; letter-spacing: 0.5px; color: #0b1f4d; text-align: center; flex: 1; }
        .rc-voucher-sub { font-size: 9px; font-style: italic; font-weight: 500; color: #475569; }

        .rc-no { font-size: 12px; font-weight: 700; color: #0b1f4d; white-space: nowrap; }
        .rc-no-value { color: #dc2626; font-weight: 900; font-size: 15px; }

        .rc-field { display: flex; align-items: baseline; gap: 6px; font-size: 11px; }
        .rc-field em { font-size: 9px; font-style: italic; color: #475569; font-weight: 400; }
        .rc-label { font-weight: 700; white-space: nowrap; color: #0b1f4d; }
        .rc-value { flex: 1; border-bottom: 1px solid #64748b; padding-bottom: 1px; font-weight: 600; min-height: 14px; }
        .rc-id-val { max-width: 120px; font-weight: 800; }
        .rc-value-strong { font-weight: 800; font-size: 12px; }

        .rc-field-block, .rc-amount-block { padding: 1px 0; }
        .rc-field-top { display: flex; align-items: baseline; gap: 6px; font-size: 11px; }
        .rc-field-caption { font-style: italic; font-size: 8.5px; color: #475569; margin-top: 1px; }

        .rc-amount-top { display: flex; align-items: stretch; gap: 6px; }
        .rc-amount-top .rc-label { align-self: center; }
        .rc-amount-box-sos { flex: 1; border: 1.5px solid #0b1f4d; border-radius: 4px; padding: 3px 6px; font-weight: 800; font-size: 11.5px; text-align: right; display: flex; align-items: center; justify-content: flex-end; }
        .rc-usd-group { display: flex; align-items: stretch; border: 1.5px solid #0b1f4d; border-radius: 4px; overflow: hidden; flex-shrink: 0; }
        .rc-usd-tag { background: #0b1f4d; color: #fff; font-weight: 800; font-size: 10.5px; padding: 3px 6px; display: flex; align-items: center; }
        .rc-amount-box-usd { padding: 3px 8px; font-weight: 800; font-size: 11.5px; min-width: 35px; text-align: right; display: flex; align-items: center; justify-content: flex-end; }

        .rc-being-row { display: flex; gap: 10px; }
        .rc-being-of { flex: 1; display: flex; align-items: baseline; gap: 6px; font-size: 11px; }
        .rc-side-fields { display: flex; flex-direction: column; gap: 3px; min-width: 150px; }
        .rc-field-inline { display: flex; align-items: baseline; gap: 6px; font-size: 10.5px; }

        .rc-bottom-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 2px; }
        .rc-payment-method { display: flex; align-items: center; gap: 5px; }
        .rc-method-tag { background: #0b1f4d; color: #fff; font-size: 9px; font-weight: 800; padding: 3px 6px; border-radius: 4px; white-space: nowrap; }
        .rc-evc-label { font-weight: 700; font-size: 10.5px; color: #0b1f4d; }
        .rc-evc-box { width: 16px; height: 16px; border: 1.5px solid #0b1f4d; border-radius: 3px; display: inline-flex; align-items: center; justify-content: center; font-weight: 900; font-size: 11px; color: #16a34a; }

        .rc-stamp { width: 45px; height: 45px; object-fit: contain; opacity: 0.85; flex-shrink: 0; }
        .rc-signature { text-align: center; min-width: 120px; }
        .rc-sig-title { font-size: 8.5px; font-weight: 800; color: #0b1f4d; letter-spacing: 0.3px; }
        .rc-sig-img { height: 24px; object-fit: contain; margin-top: 1px; }
        .rc-sig-line { border-bottom: 1px solid #64748b; height: 2px; }

        .rc-footer-note { display: flex; align-items: center; gap: 6px; background: #0b1f4d; color: #fff; font-size: 9.5px; font-style: italic; font-weight: 700; padding: 4px 10px; margin: 8px -14px -10px; }
        .rc-footer-icon { width: 12px; height: 12px; border-radius: 50%; background: #fff; color: #0b1f4d; display: inline-flex; align-items: center; justify-content: center; font-weight: 900; font-size: 8.5px; }

        /* PRINT CONFIGURATION FOR EXACT A5 LANDSCAPE FIT */
        @media print {
          @page {
            size: A5 landscape !important;
            margin: 0 !important;
          }

          html, body {
            width: 100% !important;
            height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          body * {
            visibility: hidden;
          }

          .rv-overlay, .rv-overlay * {
            visibility: visible;
          }

          .rv-overlay {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            background: #ffffff !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .rv-paper {
            width: 210mm !important;
            height: 148mm !important;
            max-width: 100% !important;
            max-height: 100% !important;
            box-shadow: none !important;
            padding: 8mm !important;
            margin: 0 auto !important;
            box-sizing: border-box !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
          }

          .rc-frame {
            width: 100% !important;
            height: 100% !important;
            box-sizing: border-box !important;
          }

          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}