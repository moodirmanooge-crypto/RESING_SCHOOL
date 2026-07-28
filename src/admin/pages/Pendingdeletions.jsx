import { useEffect, useState } from "react";
import { db } from "../../firebase/firebase";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { Check, X, Loader2, AlertTriangle } from "lucide-react";

export default function PendingDeletions() {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    fetchPending();
  }, []);

  async function fetchPending() {
    try {
      setLoading(true);
      const q = query(
        collection(db, "students"),
        where("pendingDeletion", "==", true)
      );
      const snap = await getDocs(q);
      setPending(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  }

  // ---- DIID: pendingDeletion -> false, ardaygu wuu ku soo noqonayaa liiska ----
  async function rejectDeletion(student) {
    try {
      setBusyId(student.id);
      await updateDoc(doc(db, "students", student.id), {
        pendingDeletion: false,
        deletionRequestedAt: null,
      });
      setPending((prev) => prev.filter((s) => s.id !== student.id));
    } catch (err) {
      console.log(err);
      alert(err.message);
    } finally {
      setBusyId(null);
    }
  }

  // ---- ANSIXI: si buuxda uga tirtir Firestore (students + dhammaan
  // collection-yada la xiriira, si aan mar dambe loogu arag "Paid"
  // ama xog kale oo hadhay).. ----
  async function approveDeletion(student) {
    if (
      !confirm(
        `Ma hubtaa inaad si joogto ah uga tirtirto ${student.fullName}? Tallaabadan lama soo celin karo.`
      )
    )
      return;

    try {
      setBusyId(student.id);
      const studentId = student.studentId;

      const batch = writeBatch(db);
      batch.delete(doc(db, "students", student.id));
      batch.delete(doc(db, "attendance", studentId));
      batch.delete(doc(db, "cashier", studentId));
      batch.delete(doc(db, "studentIdCards", studentId));

      const paymentsSnap = await getDocs(
        query(collection(db, "payments"), where("studentId", "==", studentId))
      );
      paymentsSnap.docs.forEach((d) => batch.delete(doc(db, "payments", d.id)));

      await batch.commit();

      // Ka saar liiska macallinka
      if (student.className) {
        const teachersSnap = await getDocs(collection(db, "teachers"));
        for (const teacherDoc of teachersSnap.docs) {
          const data = teacherDoc.data();
          const teacherClasses = Array.isArray(data.classes) ? data.classes : [];
          const teachesThisClass = teacherClasses.some(
            (c) => c.className === student.className
          );
          if (teachesThisClass) {
            const students = Array.isArray(data.students) ? data.students : [];
            await updateDoc(doc(db, "teachers", teacherDoc.id), {
              students: students.filter((s) => s.studentId !== studentId),
            });
          }
        }
      }

      setPending((prev) => prev.filter((s) => s.id !== student.id));
      alert(`${student.fullName} waa la tirtiray si joogto ah.`);
    } catch (err) {
      console.log(err);
      alert(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0b0a1c" }}>
      <Sidebar />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: "20px 24px 0" }}>
          <Topbar title="Pending Deletions" />
        </div>

        <div style={{ padding: "26px 30px" }}>
          <h1 style={{ color: "#fff", marginBottom: 6, fontSize: 26, fontWeight: 800 }}>
            Codsiyada Tirtirka Ardayda
          </h1>
          <p style={{ color: "#8b87ad", marginBottom: 22, fontSize: 14 }}>
            Ansixi (Approve) ama diid (Reject) codsiyada laga soo diray "Students"
          </p>

          <div style={listCard}>
            {loading ? (
              <p style={{ color: "#8b87ad" }}>Loading...</p>
            ) : pending.length === 0 ? (
              <p style={{ color: "#8b87ad" }}>Ma jiraan codsi tirtir ah oo sugaya.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {pending.map((student) => {
                  const isBusy = busyId === student.id;
                  return (
                    <div key={student.id} style={row}>
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          minWidth: 44,
                          borderRadius: "50%",
                          background: student.studentPhoto
                            ? `url(${student.studentPhoto}) center/cover`
                            : "linear-gradient(135deg,#6d5df0,#8b6cf5)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: 14,
                        }}
                      >
                        {!student.studentPhoto &&
                          (student.fullName || "?").slice(0, 2).toUpperCase()}
                      </div>

                      <div style={{ flex: 1, minWidth: 160 }}>
                        <div style={{ color: "#fff", fontWeight: 600, fontSize: 14.5 }}>
                          {student.fullName || "—"}
                        </div>
                        <div style={{ color: "#8b87ad", fontSize: 12.5, marginTop: 2 }}>
                          ID: {student.studentId || "—"} · Class {student.className || "—"}
                        </div>
                      </div>

                      <span style={warnTag}>
                        <AlertTriangle size={13} />
                        Sugaya Ansixinta
                      </span>

                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => rejectDeletion(student)}
                          disabled={isBusy}
                          style={{ ...btnReject, opacity: isBusy ? 0.6 : 1 }}
                        >
                          {isBusy ? (
                            <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
                          ) : (
                            <X size={15} />
                          )}
                          Diid
                        </button>
                        <button
                          onClick={() => approveDeletion(student)}
                          disabled={isBusy}
                          style={{ ...btnApprove, opacity: isBusy ? 0.6 : 1 }}
                        >
                          {isBusy ? (
                            <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
                          ) : (
                            <Check size={15} />
                          )}
                          Ansixi
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const listCard = {
  marginTop: 10,
  background: "linear-gradient(160deg,#1c1840,#211c48)",
  borderRadius: 16,
  padding: 22,
  border: "1px solid rgba(255,255,255,0.05)",
};

const row = {
  display: "flex",
  alignItems: "center",
  gap: 16,
  padding: "12px 16px",
  background: "rgba(255,255,255,0.02)",
  borderRadius: 12,
  border: "1px solid rgba(239,68,68,0.18)",
  flexWrap: "wrap",
};

const warnTag = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "rgba(234,179,8,0.12)",
  color: "#facc15",
  fontSize: 12,
  padding: "6px 12px",
  borderRadius: 20,
  border: "1px solid rgba(234,179,8,0.3)",
  whiteSpace: "nowrap",
};

const btnReject = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "rgba(255,255,255,0.04)",
  border: "1.5px solid rgba(139,108,245,0.3)",
  color: "#fff",
  padding: "9px 16px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
};

const btnApprove = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "linear-gradient(90deg,#dc2626,#ef4444)",
  border: "none",
  color: "#fff",
  padding: "9px 16px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 13,
};