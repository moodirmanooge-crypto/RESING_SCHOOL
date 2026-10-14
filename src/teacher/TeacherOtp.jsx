// src/teacher/TeacherOtp.jsx
// Shaashadda code-ka 4 lambar ah ee macalinka (/teacher-verify).
import OtpVerifyPage from "../components/OtpVerifyPage";
import { teacherOtpClient } from "../services/teacherOtpService";

export default function TeacherOtp() {
  return (
    <OtpVerifyPage
      client={teacherOtpClient}
      title="Teacher Verification"
      loginPath="/teacher-login"
      successPath="/teacher/dashboard"
      headFrom="#0f2a5c"
      headTo="#2563eb"
    />
  );
}