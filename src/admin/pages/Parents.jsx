import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { Search, Users, User } from "lucide-react";

export default function Parents() {
  const [parents, setParents] = useState([]);
  const [payments, setPayments] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadParents();
    loadPayments();
  }, []);

  async function loadParents() {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, "students"));
      const data = snap.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        // Ka reeb ardayda la calaamadeeyay pendingDeletion — isla markiiba
        // ha ka baxeen liiska Parents, xitaa haddii backend-ku uusan weli
        // si buuxda uga tirtirin Firestore.
        .filter((s) => !s.pendingDeletion);
      setParents(data);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadPayments() {
    try {
      const snap = await getDocs(collection(db, "payments"));
      const map = {};
      snap.docs.forEach((doc) => {
        map[doc.id] = doc.data();
      });
      setPayments(map);
    } catch (err) {
      console.log(err);
    }
  }

  // ---- Xisaabi inta la bixiyay iyo inta la rabo ee arday kasta ----
  // U shaqeeya si dabacsan: haddii payments/{studentId} yahay hal document
  // leh 'amountPaid', ama haddii uu leeyahay liis 'entries'/'history' oo
  // dhammaantood la isku daro.
  //
  // Ardayda "Free" ah (monthlyFee === 0) marwalba waa "Full Paid" —
  // wax lacag ah kama laha school-ka, sidaas darteed ma xiisayn karto
  // in ay lahaadaan payments record, xitaa haddii aan mid la sameyn.
  function getPaymentInfo(studentId, monthlyFee) {
    const record = payments[studentId];
    const fee = Number(monthlyFee) || 0;

    if (fee === 0) {
      return { paidTotal: 0, remaining: 0, status: "Full Paid" };
    }

    let paidTotal = 0;

    if (record) {
      if (Array.isArray(record.entries)) {
        paidTotal = record.entries.reduce(
          (sum, e) => sum + (Number(e.amount) || 0),
          0
        );
      } else if (Array.isArray(record.history)) {
        paidTotal = record.history.reduce(
          (sum, e) => sum + (Number(e.amount) || 0),
          0
        );
      } else if (record.amountPaid !== undefined) {
        paidTotal = Number(record.amountPaid) || 0;
      } else if (record.paid !== undefined) {
        paidTotal = Number(record.paid) || 0;
      } else if (record.status === "Paid") {
        paidTotal = fee;
      }
    }

    const remaining = Math.max(fee - paidTotal, 0);

    let status = "Unpaid";
    if (paidTotal >= fee) status = "Full Paid";
    else if (paidTotal > 0 && paidTotal < fee) status = "Partial";

    return { paidTotal, remaining, status };
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();

    return parents.filter((item) => {
      return (
        String(item.studentId || "").toLowerCase().includes(q) ||
        String(item.fullName || "").toLowerCase().includes(q) ||
        String(item.className || "").toLowerCase().includes(q)
      );
    });
  }, [parents, search]);

  const statusStyle = (status) => {
    if (status === "Full Paid")
      return { color: "#4ade80", background: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.35)" };
    if (status === "Partial")
      return { color: "#f59e0b", background: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.35)" };
    return { color: "#f87171", background: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.35)" };
  };

  return (
    <div style={{ background: "#0b0a1c", minHeight: "100vh", padding: "30px" }}>
      <h1 style={{ color: "#fff", marginBottom: 22, fontSize: 26, fontWeight: 800 }}>
        Parents Information
      </h1>

      <div style={searchWrap}>
        <Search size={16} color="#8b87ad" />
        <input
          type="text"
          placeholder="Search Student ID / Student Name / Class..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={searchInput}
        />
      </div>

      <div style={{ overflowX: "auto", borderRadius: 16, border: "1px solid rgba(139,108,245,0.2)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1150 }}>
          <thead>
            <tr style={{ background: "rgba(139,108,245,0.1)" }}>
              <th style={th}>Photo</th>
              <th style={th}>Student ID</th>
              <th style={th}>Student Name</th>
              <th style={th}>Class</th>
              <th style={th}>Fee</th>
              <th style={th}>Parent Phone</th>
              <th style={th}>Student Phone</th>
              <th style={th}>Password</th>
              <th style={th}>Paid</th>
              <th style={th}>Remaining</th>
              <th style={th}>Payment Status</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td style={td} colSpan={11}>
                  <span style={{ color: "#8b87ad" }}>Loading...</span>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td style={td} colSpan={11}>
                  <span style={{ color: "#8b87ad" }}>Wax arday ah lama helin.</span>
                </td>
              </tr>
            ) : (
              filtered.map((item) => {
                const { paidTotal, remaining, status } = getPaymentInfo(
                  item.studentId,
                  item.monthlyFee
                );
                const st = statusStyle(status);

                return (
                  <tr key={item.id}>
                    <td style={td}>
                      {item.studentPhoto ? (
                        <img
                          src={item.studentPhoto}
                          alt={item.fullName}
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: "50%",
                            objectFit: "cover",
                            border: "1px solid rgba(139,108,245,0.3)",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: "50%",
                            background: "rgba(139,108,245,0.12)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#8b87ad",
                          }}
                        >
                          <User size={17} />
                        </div>
                      )}
                    </td>
                    <td style={td}>{item.studentId}</td>
                    <td style={{ ...td, color: "#fff", fontWeight: 600 }}>{item.fullName}</td>
                    <td style={td}>{item.className}</td>
                    <td style={td}>${item.monthlyFee || 0}</td>
                    <td style={td}>{item.parentPhone}</td>
                    <td style={td}>{item.studentPhone}</td>
                    <td style={td}>{item.parentPassword}</td>
                    <td style={{ ...td, color: "#4ade80" }}>${paidTotal}</td>
                    <td style={{ ...td, color: remaining > 0 ? "#f87171" : "#8b87ad" }}>
                      ${remaining}
                    </td>
                    <td style={td}>
                      <span
                        style={{
                          padding: "5px 12px",
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 700,
                          color: st.color,
                          background: st.background,
                          border: `1px solid ${st.border}`,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {status}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 20 }}>
        <Users size={16} color="#8b87ad" />
        <h3 style={{ margin: 0, color: "#8b87ad", fontWeight: 500, fontSize: 14 }}>
          Total Parents : <span style={{ color: "#8b6cf5", fontWeight: 700 }}>{filtered.length}</span>
        </h3>
      </div>
    </div>
  );
}

const th = {
  padding: "14px 12px",
  color: "#a9a6c4",
  fontSize: 12.5,
  fontWeight: 700,
  textAlign: "left",
  whiteSpace: "nowrap",
  borderBottom: "1px solid rgba(139,108,245,0.2)",
};

const td = {
  padding: "12px",
  color: "#c7c4e0",
  fontSize: 13.5,
  borderBottom: "1px solid rgba(139,108,245,0.1)",
  whiteSpace: "nowrap",
};

const searchWrap = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: 450,
  padding: "0 14px",
  borderRadius: 10,
  border: "1.5px solid rgba(139,108,245,0.3)",
  background: "rgba(255,255,255,0.02)",
  marginBottom: 20,
};

const searchInput = {
  flex: 1,
  padding: "12px 0",
  border: "none",
  outline: "none",
  background: "transparent",
  color: "#e5e3f7",
  fontSize: 14,
};