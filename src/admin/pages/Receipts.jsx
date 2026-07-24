// src/admin/pages/Receipts.jsx
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, doc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { Search, Printer, X, Receipt as ReceiptIcon, Trash2 } from "lucide-react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

const SCHOOL_NAME = "RISING STAR PRIMARY & SECONDARY SCHOOL";

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
  const [confirmTarget, setConfirmTarget] = useState(null); // { type: "one"|"all", receipt? }
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
      }}
    >
      <Sidebar />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: "22px 26px 0" }}>
          <Topbar />
        </div>

        <div style={{ padding: "26px 30px" }}>
          {/* Header */}
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
                Dhammaan rasiidhada lacagaha ee laga bixiyay {SCHOOL_NAME}
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

          {/* Search */}
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

          {/* Table */}
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

// Modal-ka daawashada rasiidka — waa isla design-ka warqadda cusub
// (ReceiptModal.jsx), laakiin ka soo akhriya xog rasiid oo hore loo
// kaydiyay (halkii uu ka kordhin lahaa lambar cusub).
function ReceiptViewModal({ receipt, onClose, onDelete, deleting }) {
  const paidDate = receipt.paidAt?.seconds
    ? new Date(receipt.paidAt.seconds * 1000)
    : receipt.createdAt?.seconds
    ? new Date(receipt.createdAt.seconds * 1000)
    : new Date();

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
          <div className="rv-header">
            <div className="rv-school">{SCHOOL_NAME}</div>
            <div className="rv-sub">SCHOOL FEES RECEIPT</div>
            <div className="rv-no">No. {receipt.receiptNo}</div>
          </div>

          <div className="rv-line" />

          <div className="rv-field">
            <span className="rv-label">Received from</span>
            <span className="rv-value">{receipt.studentName || "—"}</span>
          </div>
          <div className="rv-field">
            <span className="rv-label">Class</span>
            <span className="rv-value">{receipt.className || "—"}</span>
          </div>
          <div className="rv-field">
            <span className="rv-label">Month</span>
            <span className="rv-value">{receipt.monthLabel || "—"}</span>
          </div>
          <div className="rv-field">
            <span className="rv-label">Academic Year</span>
            <span className="rv-value">{receipt.academicYear || "—"}</span>
          </div>
          <div className="rv-field">
            <span className="rv-label">Date</span>
            <span className="rv-value">{formatDate(paidDate)}</span>
          </div>
          <div className="rv-field">
            <span className="rv-label">Amount</span>
            <span className="rv-value rv-blank" />
          </div>

          <div className="rv-line" />

          {/* Received by / Signature: waa banaan si loogu saxiixdo
              gacanta warqadda daabacan — marna kama imaanayo Firestore. */}
          <div className="rv-signature-block">
            <span className="rv-label">Received by</span>
            <span className="rv-signature-line" />
          </div>

          <div className="rv-footer">Mahadsanid!</div>
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
        .rv-close-btn {
          background: #ffffff;
          color: #6B7280;
          border: 1px solid #E5E7EB;
        }
        .rv-delete-btn {
          background: #DC2626;
          color: #ffffff;
        }
        .rv-print-btn {
          background: #16a34a;
          color: #ffffff;
        }
        .rv-paper {
          width: 340px;
          background: #FBF6E9;
          padding: 22px 20px;
          font-family: 'Georgia', 'Times New Roman', serif;
          color: #111827;
          box-shadow: 0 10px 30px rgba(0,0,0,0.25);
          border: 3px double #7a1f1f;
        }
        .rv-header { text-align: center; margin-bottom: 12px; }
        .rv-school {
          font-weight: 800;
          font-size: 15px;
          letter-spacing: 0.3px;
          color: #14532d;
          text-transform: uppercase;
        }
        .rv-sub { font-size: 13px; font-weight: 700; color: #111827; margin-top: 4px; }
        .rv-no { font-size: 11.5px; color: #111827; margin-top: 4px; font-weight: 700; }
        .rv-line { border-top: 1px dashed #9CA3AF; margin: 10px 0; }
        .rv-field {
          display: flex;
          align-items: baseline;
          gap: 6px;
          font-size: 12.5px;
          margin-bottom: 8px;
        }
        .rv-label { color: #374151; white-space: nowrap; }
        .rv-value {
          flex: 1;
          border-bottom: 1px solid #9CA3AF;
          padding-bottom: 1px;
          font-weight: 600;
          min-height: 14px;
        }
        .rv-strong { font-weight: 800; }
        .rv-blank { min-height: 14px; }
        .rv-signature-block {
          display: flex;
          align-items: baseline;
          gap: 6px;
          margin-top: 20px;
          font-size: 12.5px;
        }
        .rv-signature-line {
          flex: 1;
          border-bottom: 1px solid #9CA3AF;
          min-height: 18px;
        }
        .rv-footer { text-align: center; font-size: 12px; margin-top: 14px; font-weight: 700; }

        @media print {
          body * { visibility: hidden; }
          .rv-paper, .rv-paper * { visibility: visible; }
          .rv-paper {
            position: absolute; top: 0; left: 0;
            box-shadow: none; width: 80mm;
          }
          .no-print { display: none !important; }
          @page { size: 80mm auto; margin: 0; }
        }
      `}</style>
    </>
  );
}