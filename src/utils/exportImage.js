// src/utils/exportImage.js
//
// U beddel qayb ka mid ah bogga sawir (PNG) ama PDF.
// - html2canvas waxaa laga soo raraa CDN (sida Dashboard-ka ardayga hore u sameeyay)
// - jsPDF waa package-ka mashruuca (jspdf)
//
// Qaybta la sawirayo waa la nuqulaa (clone) oo la dhigaa meel aan la arkin oo
// cabbirkeedii dhabta ahaa leh, si sawirku u noqdo mid buuxa oo nadiif ah xitaa
// marka shaashadda lagu yareeyay (mobile).

import jsPDF from "jspdf";

const H2C_SRC = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";

let loading = null;
export function loadHtml2Canvas() {
  if (window.html2canvas) return Promise.resolve(window.html2canvas);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = H2C_SRC;
      script.async = true;
      script.onload = () => resolve(window.html2canvas);
      script.onerror = () => {
        loading = null;
        reject(new Error("html2canvas lama soo rari karin — hubi internet-ka."));
      };
      document.body.appendChild(script);
    });
  }
  return loading;
}

function waitForImages(root) {
  const imgs = [...root.querySelectorAll("img")];
  return Promise.all(
    imgs.map((img) =>
      img.complete && img.naturalWidth
        ? Promise.resolve()
        : new Promise((res) => {
            img.onload = res;
            img.onerror = res;
          })
    )
  );
}

// Sawir hal element -> canvas
export async function captureNode(node, { scale = 2, background = "#ffffff" } = {}) {
  if (!node) throw new Error("Qaybta la sawirayo lama helin.");
  const html2canvas = await loadHtml2Canvas();

  const holder = document.createElement("div");
  holder.setAttribute("aria-hidden", "true");
  Object.assign(holder.style, {
    position: "fixed",
    top: "0",
    left: "0",
    zIndex: "-9999",
    pointerEvents: "none",
    background,
  });
  const clone = node.cloneNode(true);
  clone.style.transform = "none";
  clone.style.margin = "0";
  holder.appendChild(clone);
  document.body.appendChild(holder);

  try {
    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch (e) {
        /* ignore */
      }
    }
    await waitForImages(clone);
    // offsetWidth (ma aha scrollWidth): qurxinta geesaha ee la qariyay lama tiriyo
    const w = Math.ceil(clone.offsetWidth);
    const h = Math.ceil(clone.offsetHeight);
    return await html2canvas(clone, {
      scale,
      backgroundColor: background,
      useCORS: true,
      width: w,
      height: h,
      windowWidth: Math.max(w, window.innerWidth),
      windowHeight: Math.max(h, window.innerHeight),
      scrollX: 0,
      scrollY: 0,
    });
  } finally {
    document.body.removeChild(holder);
  }
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

function triggerDownload(href, filename) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Kaydi PNG. Mobile-ka (haddii la taageero) waxaa la furayaa "Share" si
// ardaygu u doorto "Save Image" -> Gallery / Photos. Haddii kale waa download.
export async function saveCanvasAsImage(canvas, filename, { preferShare = true } = {}) {
  const blob = await canvasToBlob(canvas);
  if (!blob) throw new Error("Sawirka lama samayn karin.");

  const isTouch =
    typeof navigator !== "undefined" &&
    (navigator.maxTouchPoints > 0 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || ""));

  if (preferShare && isTouch && navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: "image/png" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        return "shared";
      }
    } catch (err) {
      if (err && err.name === "AbortError") return "cancelled";
      // haddii share fashilmo -> download caadi ah
    }
  }

  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return "downloaded";
}

// Canvas-yo badan -> hal PDF (A4 landscape), bog kasta hal canvas
export function canvasesToPdf(canvases, filename, { orientation = "landscape" } = {}) {
  const pdf = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 6;

  canvases.forEach((canvas, i) => {
    if (i > 0) pdf.addPage("a4", orientation);
    const maxW = pageW - margin * 2;
    const maxH = pageH - margin * 2;
    const ratio = canvas.width / canvas.height;
    let w = maxW;
    let h = w / ratio;
    if (h > maxH) {
      h = maxH;
      w = h * ratio;
    }
    const x = (pageW - w) / 2;
    const y = (pageH - h) / 2;
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", x, y, w, h);
  });

  pdf.save(filename);
}

export function safeFileName(s) {
  return String(s || "file").replace(/[^\w\-]+/g, "_");
}