import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  doc,
  runTransaction,
  collection,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import { theme } from "./theme.js";
import schoolLogo from "../assets/logo.png";
import principalSignature from "../admin/assets/signature-principal.png";
import { receiptA5Css } from "./receiptA5Styles.js";

const SCHOOL_NAME_LINE1 = "DUGSIGA HOOSE / DHEXE &";
const SCHOOL_NAME_LINE2 = "SARE RISING STAR SCHOOL";
const ARABIC_NAME_LINE1 = "مدرسة ريسن استار";
const ARABIC_NAME_LINE2 = "الأساسية والثانوية";

const SCHOOL_LOCATION = "Muqdisho - Soomaaliya";
const ARABIC_LOCATION = "مقديشو - الصومال";
const SCHOOL_PHONES = "858516 / 061739026/ 0616274790";
const SCHOOL_EMAIL = "resingstarschools.com";

// 1 USD = 28 So Sh (Somali Shilling)
const USD_TO_SOS_RATE = 28;

const academicYearLabel = (dateObj) => {
  const y = dateObj.getFullYear();
  const m = dateObj.getMonth() + 1;
  if (m >= 9) return `${y}/${y + 1}`;
  return `${y - 1}/${y}`;
};

function calculateMonthRange(receipt) {
  const startMonthStr = receipt.monthLabel || "";
  const totalAmount =
    (Number(receipt.paidAmount) || 0) + (Number(receipt.creditAmount) || 0) ||
    Number(receipt.totalPaid) ||
    Number(receipt.paidAmount) ||
    0;
  const monthlyFee = Number(receipt.monthlyFee) || 19;

  const monthCount = Math.max(1, Math.round(totalAmount / monthlyFee));

  if (!startMonthStr && !receipt.paidAt && !receipt.createdAt) {
    return "Monthly Fee";
  }

  let startDate = new Date();
  if (receipt.paidAt?.seconds) {
    startDate = new Date(receipt.paidAt.seconds * 1000);
  } else if (receipt.createdAt?.seconds) {
    startDate = new Date(receipt.createdAt.seconds * 1000);
  }

  if (startMonthStr) {
    const parsedDate = new Date(Date.parse(startMonthStr));
    if (!isNaN(parsedDate.getTime())) {
      startDate = parsedDate;
    }
  }

  if (monthCount <= 1) {
    return `Monthly Fee — ${
      startMonthStr ||
      startDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })
    }`;
  }

  const endDate = new Date(
    startDate.getFullYear(),
    startDate.getMonth() + monthCount - 1,
    1
  );

  const startFormatted = startDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const endFormatted = endDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return `Monthly Fee — ${startFormatted} to ${endFormatted} (${monthCount} Months)`;
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

const getNextReceiptNumber = async () => {
  // Taxanaha cusub (001 ka bilaabmay) — isla Classes.jsx
  const counterRef = doc(db, "counters", "receiptCounterV2");

  const nextNumber = await runTransaction(db, async (transaction) => {
    const counterDoc = await transaction.get(counterRef);
    const current = counterDoc.exists() ? Number(counterDoc.data().value || 0) : 0;
    const next = current + 1;
    transaction.set(counterRef, { value: next }, { merge: true });
    return next;
  });

  return String(nextNumber).padStart(3, "0");
};

const saveReceiptRecord = async (receiptNo, payment, paidDate) => {
  try {
    const receiptRef = doc(collection(db, "receipts"), `V2-${receiptNo}`);
    await setDoc(receiptRef, {
      receiptNo,
      studentId: payment.studentId || null,
      studentName: payment.studentName || "",
      className: payment.className || "",
      studentPhone: payment.studentPhone || "",
      monthLabel: payment.monthLabel || "",
      paidAmount: payment.paidAmount ?? 0,
      paymentMethod: payment.paymentMethod || "",
      evcNumber: payment.evcNumber || "",
      academicYear: academicYearLabel(paidDate),
      paidAt: paidDate,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error("Khalad ayaa dhacay markii rasiidka la kaydinayay:", err);
  }
};

export default function ReceiptModal({ payment, onClose }) {
  // Haddii rasiidka horay loo kaydiyay (Classes.jsx ayaa hadda ku kaydiya
  // isla batch-ka lacagta), lambarkiisa ayaa la isticmaalaa — rasiid labaad
  // MA samaynayo (taasi waxay keeni jirtay lacag labanlaaban/aan jirin).
  const [receiptNo, setReceiptNo] = useState(payment?.receiptNo || null);
  const [loading, setLoading] = useState(!payment?.receiptNo);

  useEffect(() => {
    if (payment?.receiptNo) return undefined;

    let cancelled = false;

    const prepareReceipt = async () => {
      try {
        const no = await getNextReceiptNumber();
        if (cancelled) return;
        setReceiptNo(no);

        const paidDate = payment.createdAt?.seconds
          ? new Date(payment.createdAt.seconds * 1000)
          : new Date();
        await saveReceiptRecord(no, payment, paidDate);
      } catch (err) {
        console.log(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    prepareReceipt();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!payment) return null;

  const paidDate = payment.createdAt?.seconds
    ? new Date(payment.createdAt.seconds * 1000)
    : new Date();

  const dateStr = paidDate.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const totalPaidAmount =
    (Number(payment.paidAmount) || 0) + (Number(payment.creditAmount) || 0) ||
    Number(payment.totalPaid) ||
    Number(payment.paidAmount) ||
    0;

  const amountWords = amountToWords(totalPaidAmount);
  const monthDescription = calculateMonthRange(payment);
  const isEvc = true;

  // Portal -> <body>, si daabacaaddu u noqoto hal bog A5 portrait oo nadiif ah
  return createPortal(
    <div className="rc-print-portal">
      <div className="receipt-overlay">
        <div className="receipt-modal-actions no-print">
          <button onClick={onClose} className="receipt-close-btn">
            Xir
          </button>
          <button onClick={() => window.print()} className="receipt-print-btn">
            🖨️ Print
          </button>
        </div>

        <div className="receipt-paper">
          {loading ? (
            <p style={{ textAlign: "center", padding: 20, fontSize: 12 }}>
              Diyaarinaya rasiidka...
            </p>
          ) : (
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
                      N° <span className="rc-no-value">{receiptNo}</span>
                    </div>
                  </div>

                  <div className="rc-field">
                    <span className="rc-label">Date:</span>
                    <span className="rc-value">{dateStr}</span>
                  </div>

                  <div className="rc-field">
                    <span className="rc-label">Student ID:</span>
                    <span className="rc-value rc-id-val">{payment.studentId || ""}</span>
                  </div>

                  <div className="rc-field-block">
                    <div className="rc-field-top">
                      <span className="rc-label">Received from:</span>
                      <span className="rc-value rc-value-strong">{payment.studentName}</span>
                    </div>
                    <div className="rc-field-caption">(Laga qaday)</div>
                  </div>

                  <div className="rc-amount-block">
                    <div className="rc-amount-top">
                      <span className="rc-label">Amount:</span>
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
                      <span className="rc-value">{monthDescription}</span>
                    </div>
                    <div className="rc-side-fields">
                      <div className="rc-field-inline">
                        <span className="rc-label">Class:</span>
                        <span className="rc-value">{payment.className || "—"}</span>
                      </div>
                      <div className="rc-field-inline">
                        <span className="rc-label">Tel.</span>
                        <span className="rc-value">{payment.studentPhone || "—"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rc-bottom-row">
                    <div className="rc-payment-method">
                      <span className="rc-method-tag">PAYMENT METHOD</span>
                      <span className="rc-evc-label">EVC</span>
                      <span className={`rc-evc-box ${isEvc ? "rc-evc-checked" : ""}`}>
                        {isEvc ? "✓" : ""}
                      </span>
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
          )}
        </div>
      </div>

      <style>{`
        .receipt-modal-actions {
          display: flex;
          gap: 10px;
        }

        .receipt-close-btn, .receipt-print-btn {
          border: none;
          border-radius: 10px;
          padding: 10px 18px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
        }

        .receipt-close-btn {
          background: #ffffff;
          color: ${theme.colors.inkMuted || "#6B7280"};
          border: 1px solid ${theme.colors.border || "#E5E7EB"};
        }

        .receipt-print-btn {
          background: ${theme.colors.mint || "#16a34a"};
          color: #ffffff;
        }

        ${receiptA5Css({ overlay: "receipt-overlay", paper: "receipt-paper" })}
      `}</style>
    </div>,
    document.body
  );
}