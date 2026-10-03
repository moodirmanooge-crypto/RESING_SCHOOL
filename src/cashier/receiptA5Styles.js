// src/cashier/receiptA5Styles.js
//
// Qaabka rasiidka — A5 PORTRAIT (148mm x 210mm), shaashadda iyo daabacaadda.
// Waxaa isticmaala: cashier/ReceiptModal.jsx (marka lacag la qaado) iyo
// cashier/Receipts.jsx (marka rasiid hore la furo / print).
//
// Daabacaadda: rasiidka waxaa lagu soo bandhigaa portal (div.rc-print-portal)
// oo toos ugu jira <body>. Marka la print-gareeyo, wax kasta oo kale waa la
// qariyaa (display:none) — sidaas darteed hal bog A5 ah oo keliya ayaa soo
// baxa, bog cad oo dheeraad ahna ma jiro.

export function receiptA5Css({ overlay, paper }) {
  return `
    .${overlay} {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.55);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      z-index: 2000;
      gap: 12px;
      padding: 18px 12px 24px;
      overflow-y: auto;
      box-sizing: border-box;
    }

    .${paper} {
      width: 148mm;
      height: 210mm;
      max-width: 100%;
      flex-shrink: 0;
      background: #ffffff;
      padding: 6mm;
      box-sizing: border-box;
      font-family: 'Poppins', 'Segoe UI', Arial, sans-serif;
      color: #0b1f4d;
      box-shadow: 0 10px 30px rgba(0,0,0,0.25);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .${paper} .rc-frame {
      height: 100%;
      border: 2px solid #0b1f4d;
      padding: 1.2mm;
      box-sizing: border-box;
      display: flex;
    }

    .${paper} .rc-outer {
      flex: 1;
      border: 2px solid #0b1f4d;
      padding: 4mm 5mm 0;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .${paper} .rc-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 3mm;
    }
    .${paper} .rc-school-left { text-align: left; flex: 1.25; min-width: 0; }
    .${paper} .rc-school-right { text-align: right; flex: 1; min-width: 0; }
    .${paper} .rc-school-line1, .${paper} .rc-arabic-line1,
    .${paper} .rc-school-line2, .${paper} .rc-arabic-line2 {
      font-weight: 900;
      font-size: 11.5px;
      line-height: 1.3;
      color: #0b1f4d;
    }
    .${paper} .rc-arabic-line1, .${paper} .rc-arabic-line2 { font-size: 14.5px; }
    .${paper} .rc-school-location, .${paper} .rc-arabic-location {
      font-size: 11.5px;
      font-weight: 600;
      color: #1e293b;
      margin-top: 2px;
    }
    .${paper} .rc-logo {
      width: 20mm;
      height: 20mm;
      object-fit: contain;
      flex-shrink: 0;
    }

    .${paper} .rc-header-details {
      text-align: center;
      font-size: 10.5px;
      font-weight: 800;
      line-height: 1.45;
      color: #0b1f4d;
      margin-top: 2mm;
    }
    .${paper} .rc-divider { border-top: 2px solid #0b1f4d; margin: 2mm 0; }

    .${paper} .rc-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 2.2mm;
      min-height: 0;
    }

    .${paper} .rc-voucher-row {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.5mm;
    }
    .${paper} .rc-voucher-title {
      font-weight: 900;
      font-size: 22px;
      letter-spacing: 0.8px;
      color: #0b1f4d;
      text-align: center;
    }
    .${paper} .rc-voucher-sub { font-size: 12.5px; font-style: italic; font-weight: 600; color: #1e293b; }
    .${paper} .rc-no {
      font-size: 16px;
      font-weight: 800;
      color: #0b1f4d;
      white-space: nowrap;
      border: 2px solid #0b1f4d;
      border-radius: 4px;
      padding: 1mm 4mm;
    }
    .${paper} .rc-no-value { color: #dc2626; font-weight: 900; font-size: 21px; }

    .${paper} .rc-field,
    .${paper} .rc-field-top,
    .${paper} .rc-being-of,
    .${paper} .rc-field-inline {
      display: flex;
      align-items: baseline;
      gap: 2mm;
      font-size: 14.5px;
      min-width: 0;
    }
    .${paper} .rc-field em, .${paper} .rc-being-of em {
      font-size: 12px;
      font-style: italic;
      color: #1e293b;
      font-weight: 500;
    }
    .${paper} .rc-label { font-weight: 800; white-space: nowrap; color: #0b1f4d; }
    .${paper} .rc-value {
      flex: 1;
      min-width: 0;
      border-bottom: 1.5px solid #334155;
      padding-bottom: 2px;
      font-weight: 700;
      color: #000000;
      min-height: 20px;
      overflow-wrap: anywhere;
    }
    .${paper} .rc-id-val { font-weight: 900; }
    .${paper} .rc-value-strong { font-weight: 900; font-size: 16px; }

    .${paper} .rc-field-block, .${paper} .rc-amount-block { padding: 0; }
    .${paper} .rc-field-caption {
      font-style: italic;
      font-size: 11.5px;
      font-weight: 500;
      color: #1e293b;
      margin-top: 2px;
    }

    .${paper} .rc-amount-top { display: flex; align-items: center; gap: 3mm; }
    .${paper} .rc-amount-top .rc-label { font-size: 14.5px; }
    .${paper} .rc-usd-group {
      display: flex;
      align-items: stretch;
      border: 2px solid #0b1f4d;
      border-radius: 5px;
      overflow: hidden;
      flex-shrink: 0;
    }
    .${paper} .rc-usd-tag {
      background: #0b1f4d;
      color: #fff;
      font-weight: 900;
      font-size: 16px;
      padding: 1.5mm 4mm;
      display: flex;
      align-items: center;
    }
    .${paper} .rc-amount-box-usd {
      padding: 1.5mm 5mm;
      font-weight: 900;
      font-size: 22px;
      color: #000000;
      min-width: 24mm;
      display: flex;
      align-items: center;
      justify-content: flex-end;
    }

    .${paper} .rc-being-row { display: flex; flex-direction: column; gap: 2.2mm; }
    .${paper} .rc-side-fields {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4mm;
      min-width: 0;
    }

    .${paper} .rc-bottom-row {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 3mm;
      margin-top: 1mm;
      flex-shrink: 0;
    }
    .${paper} .rc-payment-method { display: flex; align-items: center; gap: 1.5mm; }
    .${paper} .rc-method-tag {
      background: #0b1f4d;
      color: #fff;
      font-size: 12px;
      font-weight: 900;
      padding: 1.5mm 2.5mm;
      border-radius: 4px;
      white-space: nowrap;
    }
    .${paper} .rc-evc-label { font-weight: 900; font-size: 15px; color: #0b1f4d; }
    .${paper} .rc-evc-box {
      width: 22px;
      height: 22px;
      border: 2px solid #0b1f4d;
      border-radius: 4px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 15px;
      color: #16a34a;
    }
    .${paper} .rc-stamp {
      width: 17mm;
      height: 17mm;
      object-fit: contain;
      opacity: 0.85;
      flex-shrink: 0;
    }
    .${paper} .rc-signature {
      text-align: center;
      width: 46mm;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .${paper} .rc-sig-title { font-size: 12px; font-weight: 900; color: #0b1f4d; letter-spacing: 0.4px; }
    .${paper} .rc-sig-img {
      width: 44mm;
      height: 24mm;
      object-fit: contain;
      /* sawirka saxiixu wuxuu leeyahay meel madhan oo badan — dhex u soo jiid */
      margin: -4.5mm 0 -5mm;
      /* xarriiqyada saxiixa ka dhig kuwo madow oo qaro weyn si ay u muuqdaan */
      filter: brightness(0.35) contrast(1.6)
        drop-shadow(0 0 0.35px #0b1f4d) drop-shadow(0 0 0.35px #0b1f4d);
    }
    .${paper} .rc-sig-line { border-bottom: 1.5px solid #0b1f4d; height: 2px; width: 100%; }

    .${paper} .rc-footer-note {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 2mm;
      background: #0b1f4d;
      color: #fff;
      font-size: 13.5px;
      font-style: italic;
      font-weight: 900;
      padding: 2.2mm 4mm;
      margin: 3mm -5mm 0;
      flex-shrink: 0;
    }
    .${paper} .rc-footer-icon {
      width: 17px;
      height: 17px;
      border-radius: 50%;
      background: #fff;
      color: #0b1f4d;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 11.5px;
    }

    /* ===== DAABACAADDA: A5 PORTRAIT, hal bog ===== */
    @media print {
      @page {
        size: A5 portrait;
        margin: 0;
      }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        width: 148mm !important;
        height: 210mm !important;
        overflow: hidden !important;
      }
      body > *:not(.rc-print-portal) {
        display: none !important;
      }
      .rc-print-portal .${overlay} {
        position: static !important;
        inset: auto !important;
        background: #ffffff !important;
        padding: 0 !important;
        margin: 0 !important;
        display: block !important;
        overflow: visible !important;
      }
      .rc-print-portal .${paper} {
        width: 148mm !important;
        height: 210mm !important;
        max-width: none !important;
        margin: 0 !important;
        box-shadow: none !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      .no-print {
        display: none !important;
      }
    }
  `;
}