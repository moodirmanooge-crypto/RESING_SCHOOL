// src/admin/pages/AdminExamPayments.jsx
//
// Bogga Exam Payments ee Admin / Sub-Admin. Wuxuu isticmaalaa isla component-ka
// cashier-ka (src/cashier/ExamPayments.jsx), sidaas lacagta Admin-ku qaado
// Cashier-ku wuu arkaa (iyo ka soo horjeedkeeda).
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import ExamPayments from "../../cashier/ExamPayments.jsx";

export default function AdminExamPayments() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0b0a1c" }}>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      <Sidebar />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: "20px 24px 0" }}>
          <Topbar title="Exam Payments" />
        </div>

        <div style={{ padding: "26px 30px" }}>
          <div style={{ background: "#F5F8F7", borderRadius: 20, padding: "24px 26px" }}>
            <ExamPayments role="admin" />
          </div>
        </div>
      </div>
    </div>
  );
}