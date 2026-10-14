// src/admin/AdminOtp.jsx
// Shaashadda code-ka 4 lambar ah ee admin-ka (/admin-verify).
import OtpVerifyPage from "../components/OtpVerifyPage";
import { adminOtpClient } from "../services/adminOtpService";

export default function AdminOtp() {
  return (
    <OtpVerifyPage
      client={adminOtpClient}
      title="Admin Verification"
      loginPath="/admin-login"
      successPath="/admin/dashboard"
    />
  );
}