// src/utils/attendanceReport.js
//
// Warbixinta Xaadirinta Ardayda (kormeerka / dowladda):
//  - buildAttendanceReport(): xogta xaadirinta -> fasal kasta, arday kasta, maalin kasta
//  - downloadAttendancePdf(): PDF A4 (koobnaan guud + fasal kasta + diiwaanka bisha)
//  - downloadAttendanceCsv(): Excel (CSV) — "register" ama "detail"
//
// Maalinta ardayga: haddii uu joogay ugu yaraan hal xiisad -> Joogay (J).
// Haddii kale, haddii xiisad "Excused" ah jirto -> Xaalad (X). Haddii kale -> Maqan (M).
// Joogitaanka % = Joogay ÷ (Joogay + Maqan). Maalmaha Xaaladda laguma darin.

import jsPDF from "jspdf";

export const CLASS_ORDER = ["1", "2", "3", "4", "5", "6", "7", "8", "F1", "F2", "F3", "F4"];

export const SCHOOL_NAME = "RISING STAR PRIMARY & SECONDARY SCHOOL";

export function formatClassName(className) {
  if (!className) return "";
  const clean = String(className).trim().replace(/^fasalka\s*/i, "");
  return `Fasalka ${clean}`;
}

export function classRank(className) {
  const raw = String(className || "").replace(/^fasalka\s*/i, "").trim().toUpperCase();
  const partTime = /PART\s*TIME/.test(raw);
  const clean = raw.replace(/PART\s*TIME/, "").trim();
  const idx = CLASS_ORDER.indexOf(clean);
  // Part Time fasallada waxay ka dambeeyaan Full Time-ka
  return (idx === -1 ? 999 : idx) + (partTime ? 100 : 0);
}

// Fasalka saxda ah ee xaadirin kasta: xaadirinta Part Time (attendancePartTime)
// waxay gashaa "5 Part Time", ma aha fasalka Full Time ee "5".
export function recordClassKey(r) {
  const base = String(r.className || "-")
    .replace(/^fasalka\s*/i, "")
    .replace(/part\s*time/i, "")
    .trim();
  const partTime =
    r.sourceCollection === "attendancePartTime" ||
    r.studentType === "Part Time" ||
    /part\s*time/i.test(String(r.className || ""));
  return partTime ? `${base} Part Time` : base;
}

// ---------------------------------------------------------------- taariikhaha
const SO_DAYS = ["Axad", "Isniin", "Talaado", "Arbaco", "Khamiis", "Jimce", "Sabti"];
const SO_DAYS_SHORT = ["Ax", "Is", "Ta", "Ar", "Kh", "Ji", "Sa"];
const SO_MONTHS = [
  "Janaayo", "Febraayo", "Maarso", "Abriil", "Maajo", "Juun",
  "Luulyo", "Agoosto", "Sebtembar", "Oktoobar", "Nofembar", "Desembar",
];

export function localDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDate(s) {
  const d = new Date(`${s}T12:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

export function fmtDate(s) {
  if (!s) return "—";
  const d = parseDate(s);
  if (!d) return String(s);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function dayName(s) {
  const d = parseDate(s);
  return d ? SO_DAYS[d.getDay()] : "";
}

function monthLabel(ym) {
  const [y, m] = ym.split("-").map(Number);
  return `${SO_MONTHS[m - 1] || ym} ${y}`;
}

export function periodLabel(from, to) {
  if (!from && !to) return "Dhammaan";
  return `${fmtDate(from)} — ${fmtDate(to)}`;
}

// Doorashooyin degdeg ah oo muddada ah
export function quickRanges(records = []) {
  const now = new Date();
  const today = localDateStr(now);
  const y = now.getFullYear();
  const m = now.getMonth();
  const monthStart = localDateStr(new Date(y, m, 1));
  const prevStart = localDateStr(new Date(y, m - 1, 1));
  const prevEnd = localDateStr(new Date(y, m, 0));
  const weekStart = localDateStr(new Date(y, m, now.getDate() - 6));
  const syStartYear = m >= 8 ? y : y - 1; // sannad dugsiyeedku wuxuu bilaabmaa Sebtembar
  const syStart = `${syStartYear}-09-01`;
  const dates = records.map((r) => r.date).filter(Boolean).sort();
  return [
    { key: "week", label: "7-dii maalmood", from: weekStart, to: today },
    { key: "month", label: "Bishan", from: monthStart, to: today },
    { key: "prev", label: "Bishii hore", from: prevStart, to: prevEnd },
    { key: "year", label: "Sannad dugsiyeedka", from: syStart, to: today },
    { key: "all", label: "Dhammaan", from: dates[0] || "", to: dates[dates.length - 1] || today },
  ];
}

// ---------------------------------------------------------------- xogta
function statusCode(s) {
  if (s === "Present") return "P";
  if (s === "Excused") return "E";
  return "A";
}

export function rating(percent) {
  if (percent == null) return "—";
  if (percent >= 90) return "Wanaagsan";
  if (percent >= 75) return "Fiican";
  return "Digniin";
}

export function buildAttendanceReport(records, { classKey = "ALL", from = "", to = "", teacherName } = {}) {
  const tName = (id) => (teacherName ? teacherName(id) : id) || "-";

  const inRange = records
    .filter((r) => {
      if (!r.date) return false;
      if (from && r.date < from) return false;
      if (to && r.date > to) return false;
      if (classKey !== "ALL" && recordClassKey(r).toUpperCase() !== String(classKey).toUpperCase()) return false;
      return true;
    })
    .sort(
      (a, b) =>
        classRank(recordClassKey(a)) - classRank(recordClassKey(b)) ||
        a.date.localeCompare(b.date) ||
        (a.sessionNumber || 0) - (b.sessionNumber || 0) ||
        String(a.studentName || "").localeCompare(String(b.studentName || ""))
    );

  const map = {};
  inRange.forEach((r) => {
    const key = recordClassKey(r);
    if (!map[key]) {
      map[key] = {
        key,
        label: formatClassName(key),
        partTime: /part\s*time/i.test(key),
        dates: new Set(),
        teachers: new Set(),
        subjects: new Set(),
        students: {},
        recordCount: 0,
      };
    }
    const c = map[key];
    c.dates.add(r.date);
    c.recordCount += 1;
    if (r.teacherId) c.teachers.add(tName(r.teacherId));
    if (r.subject) c.subjects.add(r.subject);

    const sid = String(r.studentId);
    if (!c.students[sid]) {
      c.students[sid] = { id: sid, name: "", raw: {}, sessP: 0, sessA: 0, sessE: 0 };
    }
    const st = c.students[sid];
    if (r.studentName) st.name = r.studentName;
    const code = statusCode(r.status);
    if (code === "P") st.sessP += 1;
    else if (code === "E") st.sessE += 1;
    else st.sessA += 1;
    (st.raw[r.date] = st.raw[r.date] || []).push(code);
  });

  const classes = Object.values(map)
    .map((c) => {
      const dates = Array.from(c.dates).sort();
      const students = Object.values(c.students)
        .map((st) => {
          const days = {};
          let present = 0;
          let absent = 0;
          let excused = 0;
          Object.entries(st.raw).forEach(([d, codes]) => {
            const v = codes.includes("P") ? "P" : codes.includes("E") ? "E" : "A";
            days[d] = v;
            if (v === "P") present += 1;
            else if (v === "E") excused += 1;
            else absent += 1;
          });
          const counted = present + absent;
          return {
            id: st.id,
            name: st.name || st.id,
            days,
            present,
            absent,
            excused,
            recorded: present + absent + excused,
            sessP: st.sessP,
            sessA: st.sessA,
            sessE: st.sessE,
            percent: counted > 0 ? Math.round((present / counted) * 100) : null,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      const months = [];
      dates.forEach((d) => {
        const ym = d.slice(0, 7);
        let mo = months[months.length - 1];
        if (!mo || mo.ym !== ym) {
          mo = { ym, label: monthLabel(ym), dates: [] };
          months.push(mo);
        }
        mo.dates.push(d);
      });

      const present = students.reduce((s, x) => s + x.present, 0);
      const absent = students.reduce((s, x) => s + x.absent, 0);
      const excused = students.reduce((s, x) => s + x.excused, 0);
      return {
        key: c.key,
        label: c.label,
        partTime: c.partTime,
        typeLabel: c.partTime ? "Part Time" : "Full Time",
        dates,
        months,
        students,
        teachers: Array.from(c.teachers).sort(),
        subjects: Array.from(c.subjects).sort(),
        recordCount: c.recordCount,
        present,
        absent,
        excused,
        percent: present + absent > 0 ? Math.round((present / (present + absent)) * 100) : null,
        lowCount: students.filter((s) => s.percent != null && s.percent < 75).length,
      };
    })
    .sort((a, b) => classRank(a.key) - classRank(b.key));

  const allDates = new Set(inRange.map((r) => r.date));
  const present = classes.reduce((s, c) => s + c.present, 0);
  const absent = classes.reduce((s, c) => s + c.absent, 0);
  const excused = classes.reduce((s, c) => s + c.excused, 0);

  return {
    from,
    to,
    classKey,
    classes,
    records: inRange,
    teacherNameOf: tName,
    overall: {
      classCount: classes.length,
      studentCount: classes.reduce((s, c) => s + c.students.length, 0),
      dayCount: allDates.size,
      recordCount: inRange.length,
      present,
      absent,
      excused,
      percent: present + absent > 0 ? Math.round((present / (present + absent)) * 100) : null,
      lowCount: classes.reduce((s, c) => s + c.lowCount, 0),
    },
  };
}

function fileBase(report) {
  const cls = report.classKey === "ALL" ? "Dhammaan" : formatClassName(report.classKey);
  return `Xaadirinta-Ardayda_${cls}_${report.from || "bilow"}_${report.to || "dhammaad"}`.replace(/[^\w\-]+/g, "_");
}

const pct = (p) => (p == null ? "—" : `${p}%`);
const LETTER = { P: "J", A: "M", E: "X" };

// ---------------------------------------------------------------- Excel (CSV)
export function downloadAttendanceCsv(report, mode = "register") {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [];
  const push = (arr = []) => lines.push(arr.map(esc).join(","));

  push([SCHOOL_NAME]);
  push([mode === "detail" ? "Xaadirinta Ardayda — Faahfaahin (xiisad kasta)" : "Diiwaanka Xaadirinta Ardayda (Attendance Register)"]);
  push([`Muddada: ${periodLabel(report.from, report.to)}`]);
  push([`Fasalka: ${report.classKey === "ALL" ? "Dhammaan fasallada" : formatClassName(report.classKey)}`]);
  push([`La soo saaray: ${new Date().toLocaleString("en-GB")}`]);
  push([]);

  if (mode === "detail") {
    push(["#", "Taariikh", "Maalin", "Fasalka", "Ardayga", "ID", "Maadada", "Macalinka", "Xiisad", "Waqti", "Xaalad"]);
    report.records.forEach((r, i) => {
      push([
        i + 1,
        fmtDate(r.date),
        dayName(r.date),
        formatClassName(recordClassKey(r)),
        r.studentName || "-",
        r.studentId || "-",
        r.subject || "-",
        report.teacherNameOf(r.teacherId),
        r.sessionNumber ?? "-",
        r.sessionTime || "-",
        r.status === "Present" ? "Joogay" : r.status === "Excused" ? "Xaalad" : "Maqan",
      ]);
    });
  } else {
    push(["KOOBNAANTA FASALLADA"]);
    push(["Fasalka", "Nooca", "Arday", "Maalmo", "Joogay", "Maqan", "Xaalad", "Joogitaan %", "Arday ka hooseeya 75%"]);
    report.classes.forEach((c) =>
      push([c.label, c.typeLabel, c.students.length, c.dates.length, c.present, c.absent, c.excused, pct(c.percent), c.lowCount])
    );
    push([]);
    push(["J = Joogay", "M = Maqan", "X = Xaalad / Fasax", "Bannaan = lama diiwaan gelin"]);

    report.classes.forEach((c) => {
      push([]);
      push([`=== ${c.label} (${c.typeLabel}) ===`]);
      c.months.forEach((mo) => {
        push([]);
        push([`Bisha: ${mo.label}`]);
        push([
          "#",
          "Magaca Ardayga",
          "ID",
          ...mo.dates.map((d) => {
            const dt = parseDate(d);
            return dt ? `${String(dt.getDate()).padStart(2, "0")} ${SO_DAYS_SHORT[dt.getDay()]}` : d;
          }),
          "Joogay",
          "Maqan",
          "Xaalad",
          "%",
        ]);
        c.students.forEach((s, i) => {
          let p = 0;
          let a = 0;
          let e = 0;
          const cells = mo.dates.map((d) => {
            const v = s.days[d];
            if (v === "P") p += 1;
            else if (v === "A") a += 1;
            else if (v === "E") e += 1;
            return v ? LETTER[v] : "";
          });
          push([i + 1, s.name, s.id, ...cells, p, a, e, p + a > 0 ? `${Math.round((p / (p + a)) * 100)}%` : "—"]);
        });
      });
      push([]);
      push([`Wadarta muddada — ${c.label}`]);
      push(["#", "Magaca Ardayga", "ID", "Maalmo", "Joogay", "Maqan", "Xaalad", "Xiisado Joogay", "Xiisado Maqan", "Joogitaan %", "Qiimeyn"]);
      c.students.forEach((s, i) =>
        push([i + 1, s.name, s.id, s.recorded, s.present, s.absent, s.excused, s.sessP, s.sessA, pct(s.percent), rating(s.percent)])
      );
    });
  }

  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileBase(report)}${mode === "detail" ? "_Faahfaahin" : "_Diiwaan"}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// ---------------------------------------------------------------- PDF
function loadImageDataUrl(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        // logada yar ka dhig si PDF-ku u fududaado
        const k = Math.min(1, 200 / Math.max(img.naturalWidth, img.naturalHeight, 1));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.naturalWidth * k));
        c.height = Math.max(1, Math.round(img.naturalHeight * k));
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/png"));
      } catch (e) {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

const C = {
  green: [15, 92, 46],
  gold: [245, 180, 0],
  blue: [29, 79, 168],
  ink: [25, 30, 45],
  muted: [110, 116, 130],
  line: [200, 206, 216],
  zebra: [244, 247, 252],
  P: { t: [22, 130, 60], f: [222, 245, 230] },
  A: { t: [200, 30, 30], f: [253, 226, 226] },
  E: { t: [29, 78, 216], f: [224, 234, 255] },
};

export async function downloadAttendancePdf(report, { mode = "full", logoUrl } = {}) {
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 28;
  const CW = W - M * 2;
  const BOTTOM = H - 34;
  const logo = await loadImageDataUrl(logoUrl);
  const period = periodLabel(report.from, report.to);

  const font = (style = "normal", size = 9, color = C.ink) => {
    pdf.setFont("helvetica", style);
    pdf.setFontSize(size);
    pdf.setTextColor(...color);
  };
  const fit = (text, w) => {
    let s = String(text ?? "");
    if (pdf.getTextWidth(s) <= w) return s;
    while (s.length > 1 && pdf.getTextWidth(`${s}...`) > w) s = s.slice(0, -1);
    return `${s}...`;
  };

  let y = 0;
  const pageHeader = () => {
    pdf.setFillColor(...C.green);
    pdf.rect(0, 0, W, 58, "F");
    pdf.setFillColor(...C.gold);
    pdf.rect(0, 58, W, 3, "F");
    let tx = M;
    if (logo) {
      try {
        pdf.addImage(logo, "PNG", M, 8, 42, 42);
        tx = M + 52;
      } catch (e) {
        /* logo la'aan */
      }
    }
    font("bold", 15, [255, 255, 255]);
    pdf.text(SCHOOL_NAME, tx, 27);
    font("normal", 9.5, [225, 240, 230]);
    pdf.text("Warbixinta Xaadirinta Ardayda  ·  Student Attendance Report", tx, 43);
    font("bold", 9.5, [255, 255, 255]);
    pdf.text(`Muddada: ${period}`, W - M, 27, { align: "right" });
    font("normal", 8.5, [225, 240, 230]);
    pdf.text(
      report.classKey === "ALL" ? "Dhammaan fasallada" : formatClassName(report.classKey),
      W - M,
      43,
      { align: "right" }
    );
    y = 82;
  };
  const newPage = () => {
    pdf.addPage();
    pageHeader();
  };
  const ensure = (h) => {
    if (y + h > BOTTOM) newPage();
  };

  // Shax guud. cols: {t, w, align, get(row,i), style(row)->{t,f,bold}}
  const table = (cols, rows, { rowH = 17, headH = 20, size = 8.5, headSize = 8.5, borders = false, onNewPage } = {}) => {
    const x0 = M;
    const tw = cols.reduce((s, c) => s + c.w, 0);
    const drawHead = () => {
      pdf.setFillColor(...C.blue);
      pdf.rect(x0, y, tw, headH, "F");
      font("bold", headSize, [255, 255, 255]);
      let x = x0;
      cols.forEach((c) => {
        const parts = String(c.t).split("\n");
        const lh = headSize + 1.5;
        const startY = y + headH / 2 - ((parts.length - 1) * lh) / 2 + headSize / 3;
        parts.forEach((p, i) => {
          const ty = startY + i * lh;
          if (c.align === "center") pdf.text(fit(p, c.w - 2), x + c.w / 2, ty, { align: "center" });
          else if (c.align === "right") pdf.text(fit(p, c.w - 6), x + c.w - 4, ty, { align: "right" });
          else pdf.text(fit(p, c.w - 8), x + 4, ty);
        });
        x += c.w;
      });
      y += headH;
    };
    drawHead();
    rows.forEach((row, i) => {
      if (y + rowH > BOTTOM) {
        newPage();
        if (onNewPage) onNewPage();
        drawHead();
      }
      if (!borders && i % 2 === 1) {
        pdf.setFillColor(...C.zebra);
        pdf.rect(x0, y, tw, rowH, "F");
      }
      let x = x0;
      cols.forEach((c) => {
        const val = c.get(row, i);
        const st = c.style ? c.style(row, val) || {} : {};
        if (st.f) {
          pdf.setFillColor(...st.f);
          pdf.rect(x, y, c.w, rowH, "F");
        }
        if (borders) {
          pdf.setDrawColor(...C.line);
          pdf.setLineWidth(0.4);
          pdf.rect(x, y, c.w, rowH, "S");
        }
        font(st.bold ? "bold" : "normal", size, st.t || C.ink);
        const ty = y + rowH / 2 + size / 3;
        const s = String(val ?? "");
        if (c.align === "center") pdf.text(fit(s, c.w - 2), x + c.w / 2, ty, { align: "center" });
        else if (c.align === "right") pdf.text(fit(s, c.w - 6), x + c.w - 4, ty, { align: "right" });
        else pdf.text(fit(s, c.w - 8), x + 4, ty);
        x += c.w;
      });
      if (!borders) {
        pdf.setDrawColor(230, 233, 240);
        pdf.setLineWidth(0.4);
        pdf.line(x0, y + rowH, x0 + tw, y + rowH);
      }
      y += rowH;
    });
  };

  const pctStyle = (p) =>
    p == null ? { t: C.muted } : p >= 75 ? { t: C.P.t, bold: true } : { t: C.A.t, bold: true };

  const signatures = () => {
    y += 30;
    ensure(90);
    font("bold", 10, C.ink);
    const sigW = (CW - 40) / 3;
    [
      "Saxiixa Maamulaha Dugsiga",
      "Saxiixa Kormeeraha / Wasaaradda",
      "Shaabadda Dugsiga",
    ].forEach((label, i) => {
      const sx = M + i * (sigW + 20);
      pdf.text(label, sx, y);
      pdf.setDrawColor(...C.ink);
      pdf.setLineWidth(0.6);
      if (i < 2) {
        pdf.line(sx, y + 34, sx + sigW, y + 34);
        font("normal", 8.5, C.muted);
        pdf.text("Magaca & Taariikhda: ______________________", sx, y + 52);
        font("bold", 10, C.ink);
      } else {
        pdf.setLineDashPattern([3, 2], 0);
        pdf.roundedRect(sx, y + 8, 120, 50, 5, 5, "S");
        pdf.setLineDashPattern([], 0);
      }
    });
    y += 64;
  };

  // ---------------- Bogga 1: koobnaanta guud
  pageHeader();
  font("bold", 14, C.ink);
  pdf.text("Koobnaanta Guud", M, y);
  y += 14;

  const o = report.overall;
  const boxes = [
    ["Fasallada", String(o.classCount)],
    ["Ardayda", String(o.studentCount)],
    ["Maalmaha dugsiga", String(o.dayCount)],
    ["Joogitaanka guud", pct(o.percent)],
    ["Arday ka hooseeya 75%", String(o.lowCount)],
  ];
  const gap = 10;
  const bw = (CW - gap * (boxes.length - 1)) / boxes.length;
  boxes.forEach(([label, value], i) => {
    const bx = M + i * (bw + gap);
    pdf.setFillColor(246, 249, 246);
    pdf.setDrawColor(...C.line);
    pdf.roundedRect(bx, y, bw, 50, 6, 6, "FD");
    pdf.setFillColor(...(i === 4 ? C.A.t : C.green));
    pdf.rect(bx, y + 8, 3, 34, "F");
    font("bold", 18, i === 4 && o.lowCount > 0 ? C.A.t : C.ink);
    pdf.text(value, bx + 14, y + 26);
    font("normal", 8.5, C.muted);
    pdf.text(label, bx + 14, y + 41);
  });
  y += 68;

  if (report.classes.length === 0) {
    font("normal", 11, C.muted);
    pdf.text("Muddadan iyo doorashadan wax xaadirin ah lama helin.", M, y + 10);
  } else {
    table(
      [
        { t: "#", w: 28, align: "center", get: (_, i) => i + 1 },
        { t: "Fasalka", w: 150, get: (c) => c.label, style: () => ({ bold: true }) },
        { t: "Nooca", w: 80, get: (c) => c.typeLabel },
        { t: "Arday", w: 60, align: "center", get: (c) => c.students.length },
        { t: "Maalmo", w: 60, align: "center", get: (c) => c.dates.length },
        { t: "Joogay", w: 70, align: "center", get: (c) => c.present, style: () => ({ t: C.P.t }) },
        { t: "Maqan", w: 70, align: "center", get: (c) => c.absent, style: () => ({ t: C.A.t }) },
        { t: "Xaalad", w: 70, align: "center", get: (c) => c.excused, style: () => ({ t: C.E.t }) },
        { t: "Joogitaan %", w: 90, align: "center", get: (c) => pct(c.percent), style: (c) => pctStyle(c.percent) },
        { t: "Ka hooseeya 75%", w: CW - 678, align: "center", get: (c) => c.lowCount, style: (c) => (c.lowCount ? { t: C.A.t, bold: true } : {}) },
      ],
      report.classes,
      { rowH: 19, headH: 22, size: 9.5, headSize: 9 }
    );
    y += 16;
    ensure(30);
    font("normal", 8.5, C.muted);
    pdf.text(
      "Joogitaanka % = maalmaha uu joogay ÷ (joogay + maqan). Maalmaha Xaaladda (fasax/cudur) laguma darin. Maalinta ardaygu wuxuu \"Joogay\" yahay haddii uu joogay ugu yaraan hal xiisad.",
      M,
      y,
      { maxWidth: CW }
    );
  }
  signatures(); // saxiixyada iyo shaabadda — bogga koowaad

  // ---------------- Fasal kasta
  report.classes.forEach((c) => {
    newPage();
    const classTitle = () => {
      pdf.setFillColor(232, 243, 236);
      pdf.roundedRect(M, y - 4, CW, 40, 5, 5, "F");
      pdf.setFillColor(...C.green);
      pdf.rect(M, y - 4, 4, 40, "F");
      font("bold", 14, C.green);
      pdf.text(`${c.label}  ·  ${c.typeLabel}`, M + 14, y + 12);
      font("normal", 8.5, C.muted);
      pdf.text(
        fit(
          `Arday: ${c.students.length}   ·   Maalmo: ${c.dates.length}   ·   Joogitaan: ${pct(c.percent)}   ·   Macalimiinta: ${c.teachers.join(", ") || "-"}`,
          CW - 24
        ),
        M + 14,
        y + 27
      );
      y += 48;
    };
    classTitle();

    font("bold", 11, C.ink);
    pdf.text("Koobnaanta Ardayda", M, y + 4);
    y += 12;

    const contLabel = () => {
      font("bold", 10, C.muted);
      pdf.text(`${c.label} (sii socota)`, M, y);
      y += 10;
    };

    table(
      [
        { t: "#", w: 26, align: "center", get: (_, i) => i + 1 },
        { t: "Magaca Ardayga", w: 200, get: (s) => s.name, style: () => ({ bold: true }) },
        { t: "ID", w: 92, get: (s) => s.id },
        { t: "Maalmo", w: 56, align: "center", get: (s) => s.recorded },
        { t: "Joogay", w: 56, align: "center", get: (s) => s.present, style: () => ({ t: C.P.t }) },
        { t: "Maqan", w: 56, align: "center", get: (s) => s.absent, style: () => ({ t: C.A.t }) },
        { t: "Xaalad", w: 56, align: "center", get: (s) => s.excused, style: () => ({ t: C.E.t }) },
        { t: "Xiisado J / M", w: 82, align: "center", get: (s) => `${s.sessP} / ${s.sessA}` },
        { t: "Joogitaan %", w: 76, align: "center", get: (s) => pct(s.percent), style: (s) => pctStyle(s.percent) },
        {
          t: "Qiimeyn",
          w: CW - 700,
          align: "center",
          get: (s) => rating(s.percent),
          style: (s) => (s.percent == null ? { t: C.muted } : s.percent < 75 ? { t: C.A.t, bold: true } : { t: C.P.t }),
        },
      ],
      c.students,
      { onNewPage: contLabel }
    );

    if (mode === "full") {
      c.months.forEach((mo) => {
        y += 18;
        // haddii diiwaanka bishu ku eg yahay hal bog, ha kala jebin
        const gridH = 30 + 24 + 15 * c.students.length + 20;
        ensure(gridH <= BOTTOM - 82 ? gridH : 24 + 24 + 15 * Math.min(3, c.students.length));
        font("bold", 11, C.ink);
        pdf.text(`Diiwaanka Bisha: ${mo.label}`, M, y);
        font("normal", 8, C.muted);
        pdf.text(`${c.label} · ${mo.dates.length} maalmood`, W - M, y, { align: "right" });
        y += 8;

        const fixed = 22 + 58 + 4 * 28;
        let nameW = 150;
        let dateW = (CW - fixed - nameW) / Math.max(mo.dates.length, 1);
        if (dateW < 15) {
          nameW = 110;
          dateW = (CW - fixed - nameW) / mo.dates.length;
        }
        dateW = Math.min(dateW, 34);
        nameW = CW - fixed - dateW * mo.dates.length; // magaca ayaa qaata booska haray

        const monthStat = (s) => {
          let p = 0;
          let a = 0;
          let e = 0;
          mo.dates.forEach((d) => {
            const v = s.days[d];
            if (v === "P") p += 1;
            else if (v === "A") a += 1;
            else if (v === "E") e += 1;
          });
          return { p, a, e, pc: p + a > 0 ? Math.round((p / (p + a)) * 100) : null };
        };
        const statsCache = new Map(c.students.map((s) => [s.id, monthStat(s)]));

        const cols = [
          { t: "#", w: 22, align: "center", get: (_, i) => i + 1 },
          { t: "Magaca Ardayga", w: nameW, get: (s) => s.name, style: () => ({ bold: true }) },
          { t: "ID", w: 58, get: (s) => s.id },
          ...mo.dates.map((d) => {
            const dt = parseDate(d);
            return {
              t: dt ? `${dt.getDate()}\n${SO_DAYS_SHORT[dt.getDay()]}` : d,
              w: dateW,
              align: "center",
              get: (s) => (s.days[d] ? LETTER[s.days[d]] : ""),
              style: (s) => {
                const v = s.days[d];
                return v ? { t: C[v].t, f: C[v].f, bold: true } : {};
              },
            };
          }),
          { t: "J", w: 28, align: "center", get: (s) => statsCache.get(s.id).p, style: () => ({ t: C.P.t, bold: true }) },
          { t: "M", w: 28, align: "center", get: (s) => statsCache.get(s.id).a, style: () => ({ t: C.A.t, bold: true }) },
          { t: "X", w: 28, align: "center", get: (s) => statsCache.get(s.id).e, style: () => ({ t: C.E.t, bold: true }) },
          { t: "%", w: 28, align: "center", get: (s) => pct(statsCache.get(s.id).pc), style: (s) => pctStyle(statsCache.get(s.id).pc) },
        ];
        table(cols, c.students, {
          rowH: 15,
          headH: 24,
          size: 7.5,
          headSize: 7,
          borders: true,
          onNewPage: () => {
            font("bold", 10, C.muted);
            pdf.text(`${c.label} · ${mo.label} (sii socota)`, M, y);
            y += 10;
          },
        });
        y += 12;
        font("normal", 7.5, C.muted);
        pdf.text("J = Joogay   ·   M = Maqan   ·   X = Xaalad / Fasax   ·   Bannaan = lama diiwaan gelin", M, y);
      });
    }
  });

  // ---------------- Footer
  const pages = pdf.getNumberOfPages();
  const stamp = new Date().toLocaleString("en-GB");
  for (let p = 1; p <= pages; p += 1) {
    pdf.setPage(p);
    pdf.setDrawColor(...C.line);
    pdf.setLineWidth(0.5);
    pdf.line(M, H - 26, W - M, H - 26);
    font("normal", 8, C.muted);
    pdf.text(`Rising Star School  ·  Warbixinta Xaadirinta Ardayda  ·  La soo saaray: ${stamp}`, M, H - 14);
    pdf.text(`Bogga ${p} / ${pages}`, W - M, H - 14, { align: "right" });
  }

  pdf.save(`${fileBase(report)}${mode === "full" ? "" : "_Kooban"}.pdf`);
}