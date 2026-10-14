// src/admin/pages/SchoolAssets.jsx
// Hantida Dugsiga — meel lagu diiwaan geliyo dhammaan waxyaabaha dugsiga
// yaalla (kuraasta, miisaska, sabuuradaha, kombiyuutarrada, iwm), iyo
// soo koobid toos ah oo ardayda: inta wiilal ah iyo inta gabdho ah.
//
// FIRESTORE:
//   schoolAssets/{autoId} = {
//     name, category, quantity, damaged, location, unitPrice,
//     purchaseDate, notes, createdAt, updatedAt
//   }
//   Ardayda waxaa laga akhriyaa `students` + `partTimeStudents` (gender field).

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase/firebase";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import {
  Package,
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  Save,
  Loader2,
  Armchair,
  Table2,
  Presentation,
  Monitor,
  Fan,
  BookOpen,
  Boxes,
  MapPin,
  AlertTriangle,
  Users,
  Minus,
  FileDown,
} from "lucide-react";

// Noocyada hantida — icon + midab mid kasta
const CATEGORIES = [
  { key: "Kuraas", label: "Kuraas", icon: Armchair, color: "#16a34a", soft: "#dcfce7" },
  { key: "Miisas", label: "Miisas", icon: Table2, color: "#0284c7", soft: "#e0f2fe" },
  { key: "Sabuurado", label: "Sabuurado", icon: Presentation, color: "#7c3aed", soft: "#ede9fe" },
  { key: "Kombiyuutarro", label: "Kombiyuutarro", icon: Monitor, color: "#0f766e", soft: "#ccfbf1" },
  { key: "Marawaxado", label: "Marawaxado", icon: Fan, color: "#ea580c", soft: "#ffedd5" },
  { key: "Buugaag", label: "Buugaag", icon: BookOpen, color: "#be123c", soft: "#ffe4e6" },
  { key: "Kale", label: "Qalab Kale", icon: Boxes, color: "#475569", soft: "#f1f5f9" },
];
const catOf = (key) => CATEGORIES.find((c) => c.key === key) || CATEGORIES[CATEGORIES.length - 1];

const emptyForm = {
  name: "",
  category: "Kuraas",
  quantity: "",
  damaged: "0",
  location: "",
  unitPrice: "",
  purchaseDate: "",
  notes: "",
};

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export default function SchoolAssets() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState({ full: [], part: [] });

  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("ALL");
  const [damagedOnly, setDamagedOnly] = useState(false);

  const [editing, setEditing] = useState(null); // null | "new" | asset
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // ---------- Live data ----------
  useEffect(() => {
    const unsubAssets = onSnapshot(
      collection(db, "schoolAssets"),
      (snap) => {
        setAssets(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.log(err);
        setLoading(false);
      }
    );
    const unsubFull = onSnapshot(collection(db, "students"), (snap) =>
      setStudents((p) => ({ ...p, full: snap.docs.map((d) => d.data()) }))
    );
    const unsubPart = onSnapshot(collection(db, "partTimeStudents"), (snap) =>
      setStudents((p) => ({ ...p, part: snap.docs.map((d) => d.data()) }))
    );
    return () => {
      unsubAssets();
      unsubFull();
      unsubPart();
    };
  }, []);

  // ---------- Xisaabinta ardayda ----------
  const studentStats = useMemo(() => {
    const all = [...students.full, ...students.part].filter(
      (s) => !s.pendingDeletion && s.className !== "Qalin Jabis"
    );
    const male = all.filter((s) => s.gender === "Male").length;
    const female = all.filter((s) => s.gender === "Female").length;
    return { total: all.length, male, female, unknown: all.length - male - female };
  }, [students]);

  // ---------- Xisaabinta hantida ----------
  const totals = useMemo(() => {
    const byCat = {};
    CATEGORIES.forEach((c) => (byCat[c.key] = { qty: 0, damaged: 0 }));
    let units = 0;
    let damaged = 0;
    let value = 0;
    assets.forEach((a) => {
      const q = num(a.quantity);
      const d = Math.min(num(a.damaged), q);
      const k = catOf(a.category).key;
      byCat[k].qty += q;
      byCat[k].damaged += d;
      units += q;
      damaged += d;
      value += q * num(a.unitPrice);
    });
    return { byCat, units, damaged, value };
  }, [assets]);

  const usableChairs = totals.byCat.Kuraas.qty - totals.byCat.Kuraas.damaged;
  const usableDesks = totals.byCat.Miisas.qty - totals.byCat.Miisas.damaged;

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return assets
      .filter((a) => catFilter === "ALL" || catOf(a.category).key === catFilter)
      .filter((a) => !damagedOnly || num(a.damaged) > 0)
      .filter(
        (a) =>
          !q ||
          (a.name || "").toLowerCase().includes(q) ||
          (a.location || "").toLowerCase().includes(q) ||
          (a.notes || "").toLowerCase().includes(q)
      )
      .sort((a, b) => (a.category || "").localeCompare(b.category || "") || (a.name || "").localeCompare(b.name || ""));
  }, [assets, search, catFilter, damagedOnly]);

  // ---------- Form ----------
  function openNew(category = "Kuraas") {
    setForm({ ...emptyForm, category });
    setEditing("new");
  }

  function openEdit(a) {
    setForm({
      name: a.name || "",
      category: catOf(a.category).key,
      quantity: String(a.quantity ?? ""),
      damaged: String(a.damaged ?? "0"),
      location: a.location || "",
      unitPrice: a.unitPrice ? String(a.unitPrice) : "",
      purchaseDate: a.purchaseDate || "",
      notes: a.notes || "",
    });
    setEditing(a);
  }

  function closeForm() {
    if (saving) return;
    setEditing(null);
    setForm(emptyForm);
  }

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  async function saveForm() {
    const quantity = Math.floor(num(form.quantity));
    const damaged = Math.floor(num(form.damaged));
    const name = form.name.trim() || catOf(form.category).label;

    if (!quantity) return alert("Fadlan geli tirada (quantity) — waa inay ka weyn tahay 0");
    if (damaged > quantity) return alert("Tirada jaban kama badnaan karto tirada guud");

    const payload = {
      name,
      category: form.category,
      quantity,
      damaged,
      location: form.location.trim(),
      unitPrice: num(form.unitPrice),
      purchaseDate: form.purchaseDate,
      notes: form.notes.trim(),
      updatedAt: serverTimestamp(),
    };

    try {
      setSaving(true);
      if (editing === "new") {
        await addDoc(collection(db, "schoolAssets"), { ...payload, createdAt: serverTimestamp() });
      } else {
        await updateDoc(doc(db, "schoolAssets", editing.id), payload);
      }
      setEditing(null);
      setForm(emptyForm);
    } catch (err) {
      console.log(err);
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeAsset(a) {
    if (!confirm(`Ma hubtaa inaad tirtirto "${a.name}" (${a.quantity})?`)) return;
    try {
      await deleteDoc(doc(db, "schoolAssets", a.id));
    } catch (err) {
      alert(err.message);
    }
  }

  // Badhamada +/- si degdeg ah tirada loogu beddelo
  async function bump(a, delta) {
    const next = Math.max(0, num(a.quantity) + delta);
    if (next === 0) return removeAsset(a);
    try {
      await updateDoc(doc(db, "schoolAssets", a.id), {
        quantity: next,
        damaged: Math.min(num(a.damaged), next),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      alert(err.message);
    }
  }

  function exportCsv() {
    const rows = [
      ["Magaca", "Nooca", "Tirada", "Jaban", "Shaqaynaya", "Goobta", "Qiimaha Halkii ($)", "Qiimaha Guud ($)", "Taariikhda", "Faahfaahin"],
      ...filtered.map((a) => [
        a.name,
        catOf(a.category).label,
        num(a.quantity),
        num(a.damaged),
        num(a.quantity) - num(a.damaged),
        a.location || "",
        num(a.unitPrice) || "",
        num(a.unitPrice) ? num(a.unitPrice) * num(a.quantity) : "",
        a.purchaseDate || "",
        (a.notes || "").replace(/\n/g, " "),
      ]),
      [],
      ["Ardayda guud", studentStats.total],
      ["Wiilal", studentStats.male],
      ["Gabdho", studentStats.female],
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Hantida_Dugsiga_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const malePct = studentStats.total ? Math.round((studentStats.male / studentStats.total) * 100) : 0;
  const femalePct = studentStats.total ? Math.round((studentStats.female / studentStats.total) * 100) : 0;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f3f6f4" }}>
      <Sidebar />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: "20px 24px 0" }}>
          <Topbar title="School Assets" />
        </div>

        <div style={{ padding: "22px 30px 40px" }}>
          {/* ================= HERO ================= */}
          <div style={hero}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={heroKicker}>RISING STAR SCHOOL</div>
              <h1 style={{ margin: "6px 0 4px", fontSize: 28, fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: 10 }}>
                <Package size={26} /> Hantida Dugsiga
              </h1>
              <p style={{ margin: 0, fontSize: 13.5, color: "rgba(255,255,255,0.85)" }}>
                Kuraasta, miisaska iyo dhammaan qalabka dugsiga — iyo tirada ardayda wiilal iyo gabdho.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={heroStat}>
                <div style={heroStatValue}>{totals.units}</div>
                <div style={heroStatLabel}>Alaab guud</div>
              </div>
              <div style={heroStat}>
                <div style={heroStatValue}>{totals.damaged}</div>
                <div style={heroStatLabel}>Jaban</div>
              </div>
              {totals.value > 0 && (
                <div style={heroStat}>
                  <div style={heroStatValue}>${totals.value.toLocaleString()}</div>
                  <div style={heroStatLabel}>Qiimaha</div>
                </div>
              )}
              <button onClick={() => openNew()} style={heroBtn}>
                <Plus size={16} /> Ku dar Hanti
              </button>
            </div>
          </div>

          {/* ================= ARDAYDA: WIILAL / GABDHO ================= */}
          <div style={panelRow}>
            <div style={{ ...panel, flex: "2 1 420px" }}>
              <div style={panelHead}>
                <Users size={17} color="#16a34a" />
                <span>Ardayda Dugsiga</span>
                <span style={{ marginLeft: "auto", fontSize: 12, color: "#6b7280", fontWeight: 600 }}>
                  si toos ah looga soo qaaday diiwaanka
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 14 }}>
                <GenderTile label="Dhammaan" value={studentStats.total} color="#111827" bg="#f9fafb" emoji="🎓" />
                <GenderTile label="Wiilal" value={studentStats.male} color="#0369a1" bg="#e0f2fe" emoji="👦" pct={malePct} />
                <GenderTile label="Gabdho" value={studentStats.female} color="#be185d" bg="#fce7f3" emoji="👧" pct={femalePct} />
              </div>

              <div style={genderBar}>
                <div style={{ width: `${malePct}%`, background: "#0ea5e9" }} />
                <div style={{ width: `${femalePct}%`, background: "#ec4899" }} />
              </div>

              {studentStats.unknown > 0 && (
                <div style={warnLine}>
                  <AlertTriangle size={14} />
                  {studentStats.unknown} arday weli lama calaamadin Gender — ka buuxi Student List → Edit.
                </div>
              )}
            </div>

            {/* Kuraas / Miisas vs Ardayda */}
            <div style={{ ...panel, flex: "1 1 280px" }}>
              <div style={panelHead}>
                <Armchair size={17} color="#16a34a" />
                <span>Ma ku filan yihiin?</span>
              </div>
              <CapacityRow label="Kuraas shaqaynaya" have={usableChairs} need={studentStats.total} />
              <CapacityRow label="Miisas shaqaynaya" have={usableDesks} need={studentStats.total} perUnit={2} />
              <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 10 }}>
                Miis kasta waxaa loo xisaabiyay 2 arday.
              </div>
            </div>
          </div>

          {/* ================= KAARARKA NOOCYADA ================= */}
          <div style={catGrid}>
            {CATEGORIES.map((c) => {
              const Icon = c.icon;
              const t = totals.byCat[c.key];
              const active = catFilter === c.key;
              return (
                <button
                  key={c.key}
                  onClick={() => setCatFilter(active ? "ALL" : c.key)}
                  style={{ ...catCard, ...(active ? { borderColor: c.color, boxShadow: `0 0 0 3px ${c.soft}` } : {}) }}
                >
                  <div style={{ ...catIcon, background: c.soft, color: c.color }}>
                    <Icon size={20} />
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#111827", marginTop: 10 }}>{t.qty}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#4b5563" }}>{c.label}</div>
                  <div style={{ fontSize: 11, color: t.damaged ? "#dc2626" : "#9ca3af", marginTop: 4, fontWeight: 600 }}>
                    {t.damaged ? `${t.damaged} jaban` : "Dhammaan way shaqeeyaan"}
                  </div>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      openNew(c.key);
                    }}
                    style={{ ...catAdd, color: c.color }}
                    title={`Ku dar ${c.label}`}
                  >
                    <Plus size={14} />
                  </span>
                </button>
              );
            })}
          </div>

          {/* ================= TOOLBAR ================= */}
          <div style={toolbar}>
            <div style={searchWrap}>
              <Search size={16} color="#9ca3af" />
              <input
                placeholder="Raadi magac, goob ama faahfaahin..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={searchInput}
              />
            </div>
            <label style={checkLabel}>
              <input
                type="checkbox"
                checked={damagedOnly}
                onChange={(e) => setDamagedOnly(e.target.checked)}
                style={{ accentColor: "#dc2626", width: 16, height: 16 }}
              />
              Kaliya kuwa jaban
            </label>
            {catFilter !== "ALL" && (
              <button onClick={() => setCatFilter("ALL")} style={ghostBtn}>
                <X size={14} /> {catOf(catFilter).label}
              </button>
            )}
            <button onClick={exportCsv} style={{ ...ghostBtn, marginLeft: "auto" }} disabled={!filtered.length}>
              <FileDown size={15} /> Export Excel (CSV)
            </button>
          </div>

          {/* ================= LIISKA HANTIDA ================= */}
          {loading ? (
            <p style={{ color: "#6b7280" }}>Loading...</p>
          ) : filtered.length === 0 ? (
            <div style={emptyBox}>
              <Package size={34} color="#d1d5db" />
              <div style={{ marginTop: 10, fontWeight: 700, color: "#374151" }}>
                {assets.length ? "Wax natiijo ah lama helin" : "Weli hanti lama diiwaan gelin"}
              </div>
              {!assets.length && (
                <button onClick={() => openNew()} style={{ ...saveBtn, marginTop: 14 }}>
                  <Plus size={16} /> Ku dar hantida ugu horreysa
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
              {filtered.map((a) => {
                const c = catOf(a.category);
                const Icon = c.icon;
                const q = num(a.quantity);
                const d = Math.min(num(a.damaged), q);
                const okPct = q ? Math.round(((q - d) / q) * 100) : 0;
                return (
                  <div key={a.id} style={assetCard}>
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ ...catIcon, background: c.soft, color: c.color, width: 46, height: 46 }}>
                        <Icon size={22} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>{a.name}</div>
                        <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
                          <span style={{ ...chip, background: c.soft, color: c.color }}>{c.label}</span>
                          {a.location && (
                            <span style={{ ...chip, display: "inline-flex", alignItems: "center", gap: 3 }}>
                              <MapPin size={10} /> {a.location}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 26, fontWeight: 800, color: "#111827", lineHeight: 1 }}>{q}</div>
                        <div style={{ fontSize: 10.5, color: "#9ca3af", fontWeight: 700 }}>TIRADA</div>
                      </div>
                    </div>

                    <div style={condBar}>
                      <div style={{ width: `${okPct}%`, background: "#22c55e" }} />
                      <div style={{ width: `${100 - okPct}%`, background: "#ef4444" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, marginTop: 6 }}>
                      <span style={{ color: "#15803d" }}>✓ {q - d} shaqaynaya</span>
                      <span style={{ color: d ? "#dc2626" : "#9ca3af" }}>✕ {d} jaban</span>
                    </div>

                    {(num(a.unitPrice) > 0 || a.purchaseDate || a.notes) && (
                      <div style={metaBox}>
                        {num(a.unitPrice) > 0 && (
                          <div>
                            💵 ${num(a.unitPrice)} halkii · <b>${(num(a.unitPrice) * q).toLocaleString()}</b> guud
                          </div>
                        )}
                        {a.purchaseDate && <div>📅 La iibsaday: {a.purchaseDate}</div>}
                        {a.notes && <div style={{ color: "#6b7280" }}>📝 {a.notes}</div>}
                      </div>
                    )}

                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
                      <div style={stepper}>
                        <button onClick={() => bump(a, -1)} style={stepBtn} title="Ka dhim 1">
                          <Minus size={14} />
                        </button>
                        <span style={{ minWidth: 26, textAlign: "center", fontWeight: 800, fontSize: 13 }}>{q}</span>
                        <button onClick={() => bump(a, 1)} style={stepBtn} title="Ku dar 1">
                          <Plus size={14} />
                        </button>
                      </div>
                      <button onClick={() => openEdit(a)} style={{ ...editBtn, marginLeft: "auto" }}>
                        <Pencil size={14} /> Edit
                      </button>
                      <button onClick={() => removeAsset(a)} style={delBtn} title="Tirtir">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ================= MODAL: KU DAR / WAX KA BEDEL ================= */}
      {editing && (
        <div style={overlay} onClick={closeForm}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Package size={20} color="#16a34a" />
                <h2 style={{ margin: 0, fontSize: 18, color: "#111827" }}>
                  {editing === "new" ? "Ku dar Hanti Cusub" : `Wax ka bedel: ${editing.name}`}
                </h2>
              </div>
              <button onClick={closeForm} style={closeBtn}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "20px 24px", overflowY: "auto" }}>
              <label style={label}>Nooca</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8 }}>
                {CATEGORIES.map((c) => {
                  const Icon = c.icon;
                  const active = form.category === c.key;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setField("category", c.key)}
                      style={{
                        ...catPick,
                        ...(active ? { borderColor: c.color, background: c.soft, color: c.color } : {}),
                      }}
                    >
                      <Icon size={16} /> {c.label}
                    </button>
                  );
                })}
              </div>

              <div style={formGrid}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={label}>Magaca / Sharaxaad</label>
                  <input
                    style={input}
                    placeholder={`Tusaale: ${form.category === "Kuraas" ? "Kuraas caag ah" : form.category === "Miisas" ? "Miis labo qof" : catOf(form.category).label}`}
                    value={form.name}
                    onChange={(e) => setField("name", e.target.value)}
                  />
                </div>
                <div>
                  <label style={label}>Tirada guud *</label>
                  <input style={input} type="number" min="1" placeholder="0" value={form.quantity} onChange={(e) => setField("quantity", e.target.value)} />
                </div>
                <div>
                  <label style={label}>Inta jaban</label>
                  <input style={input} type="number" min="0" placeholder="0" value={form.damaged} onChange={(e) => setField("damaged", e.target.value)} />
                </div>
                <div>
                  <label style={label}>Goobta (fasal / qol)</label>
                  <input style={input} placeholder="Tusaale: Class 5, Xafiiska" value={form.location} onChange={(e) => setField("location", e.target.value)} />
                </div>
                <div>
                  <label style={label}>Qiimaha halkii ($)</label>
                  <input style={input} type="number" min="0" placeholder="Ikhtiyaari" value={form.unitPrice} onChange={(e) => setField("unitPrice", e.target.value)} />
                </div>
                <div>
                  <label style={label}>Taariikhda la iibsaday</label>
                  <input style={input} type="date" value={form.purchaseDate} onChange={(e) => setField("purchaseDate", e.target.value)} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={label}>Faahfaahin</label>
                  <textarea
                    style={{ ...input, minHeight: 70, resize: "vertical", fontFamily: "inherit" }}
                    placeholder="Wax kale oo la xusayo..."
                    value={form.notes}
                    onChange={(e) => setField("notes", e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div style={modalFooter}>
              <button onClick={closeForm} style={cancelBtn}>
                Iska daa
              </button>
              <button onClick={saveForm} disabled={saving} style={saveBtn}>
                {saving ? (
                  <>
                    <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Kaydinaya...
                  </>
                ) : (
                  <>
                    <Save size={16} /> Kaydi
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        input::placeholder, textarea::placeholder { color: #9ca3af; }
      `}</style>
    </div>
  );
}

function GenderTile({ label: l, value, color, bg, emoji, pct }) {
  return (
    <div style={{ background: bg, borderRadius: 14, padding: "14px 16px" }}>
      <div style={{ fontSize: 20 }}>{emoji}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color, marginTop: 4, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#4b5563", marginTop: 4 }}>
        {l}
        {pct !== undefined && <span style={{ color, marginLeft: 6 }}>{pct}%</span>}
      </div>
    </div>
  );
}

function CapacityRow({ label: l, have, need, perUnit = 1 }) {
  const seats = have * perUnit;
  const enough = seats >= need;
  const pct = need ? Math.min(100, Math.round((seats / need) * 100)) : 100;
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: "#111827" }}>
        <span>{l}</span>
        <span>{have}</span>
      </div>
      <div style={{ height: 8, background: "#f3f4f6", borderRadius: 999, marginTop: 6, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: enough ? "#22c55e" : "#f59e0b" }} />
      </div>
      <div style={{ fontSize: 12, marginTop: 4, fontWeight: 600, color: enough ? "#15803d" : "#b45309" }}>
        {need === 0
          ? "Arday lama diiwaan gelin"
          : enough
          ? `✓ Way ku filan yihiin (${seats - need} dheeraad ah)`
          : `⚠ Waxaa dhiman ${Math.ceil((need - seats) / perUnit)}`}
      </div>
    </div>
  );
}

// =================== STYLES ===================
const hero = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: 18,
  padding: "26px 30px",
  borderRadius: 20,
  background: "linear-gradient(120deg,#16a34a,#15803d 60%,#166534)",
  boxShadow: "0 14px 30px rgba(22,163,74,0.25)",
};
const heroKicker = { fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", color: "rgba(255,255,255,0.75)" };
const heroStat = {
  background: "rgba(255,255,255,0.16)",
  border: "1px solid rgba(255,255,255,0.22)",
  borderRadius: 14,
  padding: "10px 18px",
  textAlign: "center",
  minWidth: 74,
};
const heroStatValue = { fontSize: 20, fontWeight: 800, color: "#fff", lineHeight: 1.1 };
const heroStatLabel = { fontSize: 11, color: "rgba(255,255,255,0.85)", fontWeight: 600 };
const heroBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "#fff",
  color: "#15803d",
  border: "none",
  padding: "12px 18px",
  borderRadius: 12,
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 14,
};
const panelRow = { display: "flex", gap: 16, flexWrap: "wrap", margin: "18px 0" };
const panel = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 18, padding: "18px 20px" };
const panelHead = { display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 800, color: "#111827" };
const genderBar = { display: "flex", height: 10, borderRadius: 999, overflow: "hidden", background: "#f3f4f6", marginTop: 14 };
const warnLine = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  marginTop: 12,
  fontSize: 12.5,
  color: "#b45309",
  background: "#fffbeb",
  border: "1px solid #fde68a",
  padding: "8px 12px",
  borderRadius: 10,
  fontWeight: 600,
};
const catGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, marginBottom: 16 };
const catCard = {
  position: "relative",
  textAlign: "left",
  background: "#fff",
  border: "1.5px solid #e5e7eb",
  borderRadius: 16,
  padding: 14,
  cursor: "pointer",
};
const catIcon = { width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
const catAdd = {
  position: "absolute",
  top: 10,
  right: 10,
  width: 26,
  height: 26,
  borderRadius: 8,
  background: "#f9fafb",
  border: "1px solid #e5e7eb",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
const toolbar = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 12,
  marginBottom: 14,
};
const searchWrap = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flex: "1 1 260px",
  padding: "0 14px",
  borderRadius: 10,
  border: "1.5px solid #e5e7eb",
  background: "#f9fafb",
};
const searchInput = { flex: 1, padding: "11px 0", border: "none", outline: "none", background: "transparent", color: "#111827", fontSize: 13.5 };
const checkLabel = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "#f9fafb",
  border: "1.5px solid #e5e7eb",
  borderRadius: 10,
  padding: "10px 14px",
  fontSize: 13,
  fontWeight: 600,
  color: "#111827",
  cursor: "pointer",
};
const ghostBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  background: "#f9fafb",
  color: "#111827",
  border: "1.5px solid #e5e7eb",
  padding: "10px 14px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 13,
};
const emptyBox = {
  background: "#fff",
  border: "1px dashed #d1d5db",
  borderRadius: 16,
  padding: 40,
  textAlign: "center",
  color: "#6b7280",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
};
const assetCard = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 18, padding: 16, boxShadow: "0 6px 18px rgba(15,23,42,0.04)" };
const chip = { background: "#f3f4f6", color: "#4b5563", fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" };
const condBar = { display: "flex", height: 7, borderRadius: 999, overflow: "hidden", background: "#f3f4f6", marginTop: 14 };
const metaBox = {
  marginTop: 12,
  background: "#f9fafb",
  border: "1px solid #eef0f2",
  borderRadius: 12,
  padding: "8px 12px",
  fontSize: 12.5,
  color: "#374151",
  display: "flex",
  flexDirection: "column",
  gap: 3,
};
const stepper = { display: "inline-flex", alignItems: "center", gap: 4, background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: 3 };
const stepBtn = {
  width: 28,
  height: 28,
  borderRadius: 8,
  border: "none",
  background: "#fff",
  color: "#374151",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
};
const editBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "#16a34a",
  color: "#fff",
  border: "none",
  height: 34,
  padding: "0 14px",
  borderRadius: 9,
  fontWeight: 700,
  fontSize: 12.5,
  cursor: "pointer",
};
const delBtn = {
  width: 34,
  height: 34,
  borderRadius: 9,
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#dc2626",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};
const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(15,23,42,0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: 20,
};
const modal = {
  background: "#fff",
  borderRadius: 20,
  width: "100%",
  maxWidth: 640,
  maxHeight: "92vh",
  display: "flex",
  flexDirection: "column",
  boxShadow: "0 24px 60px rgba(0,0,0,0.25)",
};
const modalHeader = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 24px", borderBottom: "1px solid #e5e7eb" };
const modalFooter = { display: "flex", justifyContent: "flex-end", gap: 12, padding: "16px 24px", borderTop: "1px solid #e5e7eb" };
const closeBtn = {
  background: "#f3f4f6",
  border: "none",
  color: "#374151",
  width: 32,
  height: 32,
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};
const label = { display: "block", fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 7 };
const input = {
  width: "100%",
  padding: "11px 13px",
  borderRadius: 10,
  border: "1.5px solid #e5e7eb",
  boxSizing: "border-box",
  fontSize: 14,
  color: "#111827",
  background: "#f9fafb",
  outline: "none",
};
const formGrid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 18px", marginTop: 18 };
const catPick = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "10px 8px",
  borderRadius: 10,
  border: "1.5px solid #e5e7eb",
  background: "#f9fafb",
  color: "#374151",
  fontWeight: 700,
  fontSize: 12.5,
  cursor: "pointer",
};
const cancelBtn = {
  background: "#f9fafb",
  border: "1.5px solid #e5e7eb",
  color: "#374151",
  padding: "11px 20px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13.5,
};
const saveBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "linear-gradient(90deg,#16a34a,#15803d)",
  color: "#fff",
  border: "none",
  padding: "11px 20px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 13.5,
};