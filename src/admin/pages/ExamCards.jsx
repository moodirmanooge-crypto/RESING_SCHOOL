import { useEffect, useMemo, useState } from "react";
import { db } from "../../firebase/firebase";
import { collection, getDocs, doc, deleteDoc } from "firebase/firestore";
import { IdCard, Printer, Search, Trash2, X } from "lucide-react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import signatureImg from "../assets/signature.png";

const SCHOOL_NAME_EN = "RISING STAR PRIMARY & SECONDARY SCHOOL";
const SCHOOL_NAME_AR = "مدرسة ريسن استار الأساسية والثانوية";

const CLASS_ORDER = ["1", "2", "3", "4", "5", "6", "7", "8", "F1", "F2", "F3", "F4"];
function classRank(c) {
  const i = CLASS_ORDER.indexOf(String(c || "").toUpperCase());
  return i === -1 ? 999 : i;
}

const EXAM_TYPES = [
  { key: "monthly1", label: "Monthly 1" },
  { key: "midterm", label: "Mid Term" },
  { key: "monthly2", label: "Monthly 2" },
  { key: "final", label: "Final" },
];

// Legacy keys (FinalExam, Monthly 1 ...) -> monthly1 / midterm / monthly2 / final
function normalizeExamType(v) {
  const t = String(v || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (t.includes("monthly1") || t === "m1") return "monthly1";
  if (t.includes("monthly2") || t === "m2") return "monthly2";
  if (t.includes("mid")) return "midterm";
  return "final";
}

function pad4(n) {
  return String(n).padStart(4, "0");
}

function formatDate(ts) {
  if (!ts?.seconds) return new Date().toLocaleDateString("en-GB");
  return new Date(ts.seconds * 1000).toLocaleDateString("en-GB");
}

function ExamCardStyles() {
  return (
    <style>{`
      .ec-layout { display: flex; min-height: 100vh; background: #0b0a1c; }
      .ec-content { flex: 1; min-width: 0; }
      .ec-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(560px, 1fr)); gap: 20px; }
      .ec-card-wrap { position: relative; }
      .ec-card-actions {
        position: absolute;
        top: -12px;
        right: -12px;
        display: flex;
        gap: 6px;
        z-index: 5;
      }
      .ec-select {
        position: absolute;
        top: -12px;
        left: -12px;
        z-index: 5;
        width: 30px;
        height: 30px;
        border-radius: 8px;
        border: 2px solid #8b6cf5;
        background: #151233;
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 4px 10px rgba(0,0,0,0.35);
        font-size: 18px;
        font-weight: 900;
        padding: 0;
      }
      .ec-select.on { background: #6d5df0; }
      .ec-icon-btn {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 4px 10px rgba(0,0,0,0.35);
      }
      @media print {
        /* Margin-ka browser-ka waa la daayay 0; boosaska waxaa lagu xakameeyay mm (hoos) si loo hubiyo isku-dheelitirka */
        @page { size: A4 portrait; margin: 0; }
        html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
        body * { visibility: hidden; }
        .ec-print-area, .ec-print-area * { visibility: visible; }
        .ec-print-area { position: absolute; top: 0; left: 0; width: 100%; box-sizing: border-box; }
        .ec-print-area, .ec-print-area * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
        .ec-grid {
          display: block !important;
        }
        /* Bog A4 (297mm): kor 12mm + 4 kaar x 62mm + 3 farqi x 8mm + hoos 13mm = 297mm.
           Kaar kasta wuxuu leeyahay goob go'an, kaarka koowaad ee bog kasta wuxuu helaa 12mm kor. */
        .ec-card-wrap {
          box-sizing: border-box !important;
          display: flex !important;
          align-items: flex-end !important;
          justify-content: center !important;
          width: 100% !important;
          height: 70mm !important;
          overflow: hidden !important;
          padding: 8mm 12mm 0 !important;
          margin: 0 !important;
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .ec-card-wrap.ec-first {
          height: 74mm !important;
          padding-top: 12mm !important;
        }
        /* Bog cusub kaliya kaarka 4-aad ee la daabacayo (xitaa haddii qaar la qariyay) */
        .ec-card-wrap.ec-break-after {
          page-break-after: always;
          break-after: page;
        }
        .ec-hide-print {
          display: none !important;
        }
        /* zoom 0.76: cabbirka waa la qaybiyay 0.76 si kaarku u noqdo 186mm x 62mm */
        .ec-card {
          zoom: 0.76 !important;
          box-sizing: border-box !important;
          flex: none !important;
          width: calc(186mm / 0.76) !important;
          height: calc(62mm / 0.76) !important;
          padding: 8px 12px !important;
          break-inside: avoid;
          page-break-inside: avoid;
          margin: 0 !important;
          box-shadow: none !important;
          outline: none !important;
        }
        .ec-inner {
          height: 100% !important;
          box-sizing: border-box !important;
          padding: 8px 14px !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: space-between !important;
        }
        .ec-note { font-size: 10.5px !important; line-height: 1.3 !important; }
        .ec-sig-box { height: 44px !important; }
        .ec-sig-img { max-height: 44px !important; }
        .ec-card-actions, .ec-select { display: none !important; }
      }

      @media (max-width: 900px) {
        .ec-page-pad { padding: 16px !important; }
        .ec-grid { grid-template-columns: 1fr; }
        .ec-toolbar { flex-direction: column; align-items: stretch !important; }
      }
    `}</style>
  );
}

function ExamCard({ card, onDelete, onPrintSingle, isPrintHidden, breakAfter, firstInPage, selected, onToggleSelect }) {
  const examLabel = EXAM_TYPES.find((t) => t.key === normalizeExamType(card.examType))?.label || "Final";
  return (
    <div
      className={`ec-card-wrap${isPrintHidden ? " ec-hide-print" : ""}${breakAfter ? " ec-break-after" : ""}${firstInPage ? " ec-first" : ""}`}
    >
      <button
        type="button"
        className={`ec-select${selected ? " on" : ""}`}
        onClick={() => onToggleSelect(card.id)}
        title={selected ? "Ka saar doorashada" : "Dooro Card-kan"}
      >
        {selected ? "✔" : ""}
      </button>

      <div className="ec-card-actions">
        <button
          className="ec-icon-btn"
          onClick={() => onPrintSingle(card)}
          title="Daabac Card-kan Kaliya"
          style={{ background: "#22C55E", color: "#fff" }}
        >
          <Printer size={14} />
        </button>
        <button
          className="ec-icon-btn"
          onClick={() => onDelete(card)}
          title="Tirtir Card-kan"
          style={{ background: "#ef4444", color: "#fff" }}
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div
        className="ec-card"
        style={{
          background: "repeating-linear-gradient(135deg, #FBF4C9 0 40px, #FAF1BE 40px 80px)",
          border: "10px solid transparent",
          borderImage: "repeating-linear-gradient(45deg,#5c3a21 0 6px,#7a4e2a 6px 12px) 12",
          borderRadius: 4,
          outline: selected ? "3px solid #8b6cf5" : "none",
          outlineOffset: 3,
          padding: "18px 24px",
          position: "relative",
          color: "#1a1a1a",
          fontFamily: "Georgia, 'Times New Roman', serif",
        }}
      >
        <div className="ec-inner" style={{ border: "2px solid #6b3f1d", borderRadius: 2, padding: "16px 20px" }}>
          <div style={{ textAlign: "center", marginBottom: 6 }}>
            <div style={{ fontWeight: 800, fontSize: 17, color: "#0f5132", letterSpacing: 0.3 }}>
              {SCHOOL_NAME_EN}
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#0f5132" }}>{SCHOOL_NAME_AR}</div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              margin: "8px 0 10px",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div
              style={{
                border: "1.5px solid #0f5132",
                color: "#0f5132",
                fontWeight: 800,
                fontSize: 18,
                padding: "3px 14px",
                borderRadius: 2,
              }}
            >
              EXAM CARD
            </div>
            <div style={{ fontSize: 13 }}>
              <div>
                DATE: <strong>{formatDate(card.createdAt)}</strong>
              </div>
              <div>
                CARD NO: <strong>{pad4(card.cardNo)}</strong>
              </div>
            </div>
          </div>

          <div style={{ fontSize: 14, marginBottom: 6 }}>
            NAME OF STUDENT: <strong>{card.studentName}</strong>
          </div>
          <div style={{ fontSize: 14, marginBottom: 10, display: "flex", gap: 24 }}>
            <span>
              CLASS: <strong>{card.className}</strong>
            </span>
            <span>
              ROLL NO: <strong>{card.studentId}</strong>
            </span>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 4 }}>
            {EXAM_TYPES.map((t) => (
              <label
                key={t.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontWeight: 700,
                  color: "#0f5132",
                  fontSize: 13.5,
                }}
              >
                <span
                  style={{
                    width: 15,
                    height: 15,
                    border: "1.5px solid #1a1a1a",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    lineHeight: 1,
                    fontSize: 12,
                    fontWeight: 900,
                    color: "#0f5132",
                  }}
                >
                  {t.label === examLabel ? "✔" : ""}
                </span>
                {t.label}
              </label>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              gap: 16,
              marginTop: 14,
            }}
          >
            <div
              className="ec-note"
              style={{
                flex: 1,
                fontSize: 11.5,
                lineHeight: 1.4,
                fontStyle: "italic",
                color: "#3b2a14",
                paddingBottom: 4,
              }}
            >
              <strong>F.G:</strong> Xafido Kaarka waa furaha imtixaankaaga. Haddii uu kaa lumo si deg
              deg ah ula xiriir xafiiska imtixaanaadka.
            </div>
            <div style={{ textAlign: "center", minWidth: 180 }}>
              <div
                className="ec-sig-box"
                style={{
                  height: 56,
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                }}
              >
                <img
                  className="ec-sig-img"
                  src={signatureImg}
                  alt="Principal signature"
                  style={{ maxHeight: 56, maxWidth: 200, objectFit: "contain", display: "block" }}
                />
              </div>
              <div
                style={{
                  borderTop: "1.5px solid #1a1a1a",
                  paddingTop: 4,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                Principal's Signature
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ExamCards() {
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null); // { type: "one"|"all", card? }
  const [printOnlyId, setPrintOnlyId] = useState(null); // card.id la doonayo in kaliya la daabaco
  const [selectedIds, setSelectedIds] = useState([]); // card-yada la doortay
  const [printSelected, setPrintSelected] = useState(false); // daabac kuwa la doortay kaliya

  useEffect(() => {
    load();
  }, []);

  // ---- Marka daabacaadda dhamaato (ama la joojiyo), dib u soo celi
  // muuqaalka grid-ka oo dhammaan card-yada laga arki karo mar kale. ----
  useEffect(() => {
    function handleAfterPrint() {
      setPrintOnlyId(null);
      setPrintSelected(false);
    }
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, []);

  // ---- Kaliya soo aqri examCards collection-ka — waxaa ka buuxiya
  // Cashierka marka uu arday lacagta imtixaanka ka qaado (ExamPayments
  // page-ka). Admin-ku halkan wuxuu daawadaa oo daabici karaa, isla markaana
  // wuu tirtiri karaa card mid mid ama dhammaan fasalka. ----
  async function load() {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, "examCards"));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCards(data);
    } catch (err) {
      console.log(err);
      alert("Khalad ayaa dhacay marka Exam Cards la soo qaadanayay: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  const classes = useMemo(() => {
    const set = new Set(cards.map((c) => c.className).filter(Boolean));
    return [...set].sort((a, b) => classRank(a) - classRank(b));
  }, [cards]);

  const cardsForClass = useMemo(() => {
    if (!selectedClass) return [];
    return cards
      .filter((c) => String(c.className).toUpperCase() === String(selectedClass).toUpperCase())
      .filter((c) => {
        const t = search.toLowerCase();
        return (
          !t ||
          (c.studentName || "").toLowerCase().includes(t) ||
          String(c.studentId).toLowerCase().includes(t)
        );
      })
      .sort((a, b) => (a.studentName || "").localeCompare(b.studentName || ""));
  }, [cards, selectedClass, search]);

  const selectedInView = cardsForClass.filter((c) => selectedIds.includes(c.id));
  const allSelected = cardsForClass.length > 0 && selectedInView.length === cardsForClass.length;

  function isPrintable(c) {
    if (printOnlyId) return c.id === printOnlyId;
    if (printSelected) return selectedIds.includes(c.id);
    return true;
  }
  const printableIds = cardsForClass.filter(isPrintable).map((c) => c.id);

  function toggleSelect(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleSelectAll() {
    if (allSelected) {
      const visible = cardsForClass.map((c) => c.id);
      setSelectedIds((prev) => prev.filter((id) => !visible.includes(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...cardsForClass.map((c) => c.id)])]);
    }
  }

  function handlePrintSelected() {
    if (selectedInView.length === 0) return;
    setPrintOnlyId(null);
    setPrintSelected(true);
    requestAnimationFrame(() => {
      window.print();
    });
  }

  function handlePrint() {
    setPrintSelected(false);
    setPrintOnlyId(null);
    window.print();
  }

  // ---- Kaliya card-kan la doortay ayaa la muujinayaa (kuwa kale si
  // caadi ah waa la qariyaa daabacaadda), kadibna daabacaadda ayaa
  // toos loo furayaa — hal card, hal warqad. ----
  function printSingleCard(card) {
    setPrintSelected(false);
    setPrintOnlyId(card.id);
    requestAnimationFrame(() => {
      window.print();
    });
  }

  function askDeleteOne(card) {
    setConfirmTarget({ type: "one", card });
  }

  function askDeleteAll() {
    if (cardsForClass.length === 0) return;
    setConfirmTarget({ type: "all" });
  }

  async function confirmDelete() {
    if (!confirmTarget) return;
    try {
      setDeleting(true);

      if (confirmTarget.type === "one") {
        await deleteDoc(doc(db, "examCards", confirmTarget.card.id));
        setCards((prev) => prev.filter((c) => c.id !== confirmTarget.card.id));
      } else {
        const idsToDelete = cardsForClass.map((c) => c.id);
        await Promise.all(idsToDelete.map((id) => deleteDoc(doc(db, "examCards", id))));
        setCards((prev) => prev.filter((c) => !idsToDelete.includes(c.id)));
      }

      setConfirmTarget(null);
    } catch (err) {
      console.log(err);
      alert("Khalad ayaa dhacay marka la tirtirayay: " + err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="ec-layout">
      <ExamCardStyles />
      <Sidebar />

      <div className="ec-content">
        <div style={{ padding: "20px 24px 0" }}>
          <Topbar />
        </div>

        <div className="ec-page-pad" style={{ padding: "26px 30px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
            <div
              style={{
                width: 55,
                height: 55,
                borderRadius: 15,
                background: "linear-gradient(135deg,#6d5df0,#8b6cf5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <IdCard color="#fff" size={26} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 26, color: "#fff" }}>Exam Cards</h1>
              <div style={{ color: "#8b87ad", fontSize: 14 }}>
                Exam Cards ardayda cashierku u sameeyay marka lacagta imtixaanka la bixiyay
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ color: "#8b87ad", textAlign: "center", padding: 60 }}>
              Xogta ayaa la soo qaadayaa...
            </div>
          ) : cards.length === 0 ? (
            <div style={{ color: "#8b87ad", textAlign: "center", padding: 60 }}>
              Weli Exam Card lama sameyn. Marka cashierku uu ka qaado lacagta imtixaanka
              ardayda, kaararka halkan ayay ku soo muuqan doonaan.
            </div>
          ) : !selectedClass ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: 16,
              }}
            >
              {classes.map((cls) => {
                const count = cards.filter(
                  (c) => String(c.className).toUpperCase() === cls.toUpperCase()
                ).length;
                return (
                  <button
                    key={cls}
                    onClick={() => setSelectedClass(cls)}
                    style={{
                      background: "linear-gradient(160deg,#151233,#181341)",
                      border: "1px solid rgba(139,108,245,0.25)",
                      borderRadius: 18,
                      padding: "20px",
                      textAlign: "left",
                      cursor: "pointer",
                      color: "#fff",
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 16 }}>Fasalka: {cls}</div>
                    <div style={{ color: "#8b87ad", fontSize: 12.5, marginTop: 4 }}>
                      {count} card oo la sameeyay
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div>
              <div
                className="ec-toolbar"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  marginBottom: 18,
                  flexWrap: "wrap",
                }}
              >
                <button
                  onClick={() => {
                    setSelectedClass(null);
                    setSelectedIds([]);
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#8B5CF6",
                    fontWeight: 700,
                    fontSize: 13.5,
                    cursor: "pointer",
                  }}
                >
                  ← Dhamaan Fasallada
                </button>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ position: "relative" }}>
                    <Search
                      size={14}
                      color="#8b87ad"
                      style={{ position: "absolute", left: 10, top: 10 }}
                    />
                    <input
                      placeholder="Raadi arday..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(139,108,245,0.3)",
                        color: "#e5e3f7",
                        borderRadius: 10,
                        padding: "9px 12px 9px 30px",
                        fontSize: 13,
                        width: 180,
                      }}
                    />
                  </div>

                  <button
                    onClick={toggleSelectAll}
                    disabled={cardsForClass.length === 0}
                    style={{
                      padding: "10px 16px",
                      borderRadius: 12,
                      border: "1px solid rgba(139,108,245,0.4)",
                      background: "transparent",
                      color: "#c4b8f7",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    {allSelected ? "Ka Saar Dhammaan" : "Dooro Dhammaan"}
                  </button>

                  <button
                    onClick={handlePrintSelected}
                    disabled={selectedInView.length === 0}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px 18px",
                      borderRadius: 12,
                      border: "none",
                      background: "linear-gradient(135deg,#16a34a,#22c55e)",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: selectedInView.length === 0 ? "not-allowed" : "pointer",
                      opacity: selectedInView.length === 0 ? 0.5 : 1,
                    }}
                  >
                    <Printer size={15} />
                    Daabac Doortay ({selectedInView.length})
                  </button>

                  <button
                    onClick={handlePrint}
                    disabled={cardsForClass.length === 0}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px 18px",
                      borderRadius: 12,
                      border: "none",
                      background: "linear-gradient(135deg,#6d5df0,#8b6cf5)",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    <Printer size={15} />
                    Daabac Dhammaan
                  </button>

                  <button
                    onClick={askDeleteAll}
                    disabled={cardsForClass.length === 0}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px 18px",
                      borderRadius: 12,
                      border: "1px solid rgba(239,68,68,0.4)",
                      background: "rgba(239,68,68,0.12)",
                      color: "#f87171",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    <Trash2 size={15} />
                    Tirtir Dhammaan
                  </button>
                </div>
              </div>

              <div style={{ color: "#c4b8f7", fontSize: 13, marginBottom: 16 }}>
                Fasalka <strong style={{ color: "#fff" }}>{selectedClass}</strong> —{" "}
                {cardsForClass.length} card
              </div>

              {cardsForClass.length === 0 ? (
                <div style={{ color: "#8b87ad", padding: 30, textAlign: "center" }}>
                  Cardad lama helin fasalkan/raadintan.
                </div>
              ) : (
                <div className="ec-print-area">
                  <div className="ec-grid">
                    {cardsForClass.map((c) => (
                      <ExamCard
                        key={c.id}
                        card={c}
                        onDelete={askDeleteOne}
                        onPrintSingle={printSingleCard}
                        isPrintHidden={!printableIds.includes(c.id)}
                        breakAfter={
                          printableIds.includes(c.id) &&
                          printableIds.indexOf(c.id) % 4 === 3 &&
                          printableIds.indexOf(c.id) !== printableIds.length - 1
                        }
                        firstInPage={
                          printableIds.includes(c.id) && printableIds.indexOf(c.id) % 4 === 0
                        }
                        selected={selectedIds.includes(c.id)}
                        onToggleSelect={toggleSelect}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ---- Popup xaqiijinta tirtiridda ---- */}
      {confirmTarget && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "linear-gradient(160deg,#151233,#181341)",
              border: "1px solid rgba(139,108,245,0.3)",
              borderRadius: 18,
              padding: 26,
              width: 380,
              maxWidth: "90%",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ color: "#fff", margin: 0, fontSize: 17 }}>Xaqiiji Tirtiridda</h3>
              <button
                onClick={() => setConfirmTarget(null)}
                style={{ background: "transparent", border: "none", color: "#8b87ad", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ color: "#c4b8f7", fontSize: 14, lineHeight: 1.5 }}>
              {confirmTarget.type === "one" ? (
                <>
                  Ma hubtaa inaad tirtirayso Exam Card-ka{" "}
                  <strong style={{ color: "#fff" }}>{confirmTarget.card.studentName}</strong>?
                  Tallaabadan lama soo celin karo.
                </>
              ) : (
                <>
                  Ma hubtaa inaad tirtirto <strong style={{ color: "#fff" }}>{cardsForClass.length}</strong>{" "}
                  Exam Card ee fasalka <strong style={{ color: "#fff" }}>{selectedClass}</strong>?
                  Tallaabadan lama soo celin karo.
                </>
              )}
            </p>

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button
                onClick={() => setConfirmTarget(null)}
                style={{
                  flex: 1,
                  padding: "11px 0",
                  borderRadius: 10,
                  border: "1px solid rgba(139,108,245,0.3)",
                  background: "transparent",
                  color: "#fff",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Jooji
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                style={{
                  flex: 1,
                  padding: "11px 0",
                  borderRadius: 10,
                  border: "none",
                  background: "#ef4444",
                  color: "#fff",
                  fontWeight: 700,
                  cursor: deleting ? "not-allowed" : "pointer",
                  opacity: deleting ? 0.7 : 1,
                }}
              >
                {deleting ? "Tirtiraya..." : "Haa, Tirtir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}