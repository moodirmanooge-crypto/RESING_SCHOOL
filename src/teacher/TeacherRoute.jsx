// src/teacher/TeacherRoute.jsx
// Ilaaliya dhammaan routes-ka /teacher/*. Wuxuu hubiyaa Firebase Auth
// session-ka (custom token kaddib email OTP sax ah) + claims role=teacher
// & otpVerified=true, kadibna teachers/{teacherId} ka akhriyaa Firestore.
import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase/firebase";
import { getVerifiedTeacherClaims, signOutTeacher } from "../services/teacherOtpService";

export default function TeacherRoute() {
  const location = useLocation();
  const [status, setStatus] = useState("checking"); // checking | ok | denied

  useEffect(() => {
    let cancelled = false;
    const unsub = onAuthStateChanged(auth, async (user) => {
      try {
        const claims = await getVerifiedTeacherClaims(user);
        if (!claims) throw new Error("not-verified");

        // Macalinku weli ma jiraa? (haddii la tirtiray, session-ka ka saar)
        const snap = await getDoc(doc(db, "teachers", claims.teacherId));
        if (!snap.exists()) throw new Error("teacher-removed");
        const data = snap.data();
        if (data.disabled === true || data.active === false) throw new Error("teacher-disabled");

        // Xogta UI (Sidebar/Topbar/Dashboard) mar walba ka soo qaad server-ka.
        localStorage.setItem("teacherId", claims.teacherId);
        localStorage.setItem("teacherName", data.fullName || data.name || data.username || "Teacher");
        if (data.teacherPhoto && !localStorage.getItem("teacherPhoto")) {
          localStorage.setItem("teacherPhoto", data.teacherPhoto);
        }
        if (!cancelled) setStatus("ok");
      } catch {
        if (user) await signOutTeacher();
        else await signOutTeacher({ keepPending: true });
        if (!cancelled) setStatus("denied");
      }
    });
    // Hubin joogto ah: session-ka 12 saacadood kadib wuu dhacayaa.
    const timer = setInterval(async () => {
      const ok = await getVerifiedTeacherClaims(auth.currentUser).catch(() => null);
      if (!ok && !cancelled) {
        await signOutTeacher();
        setStatus("denied");
      }
    }, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
      unsub();
    };
  }, []);

  if (status === "checking") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#eef3fb",
          color: "#334155",
          fontFamily: "'Segoe UI', Arial, sans-serif",
          fontSize: 14,
          gap: 12,
        }}
      >
        <style>{`@keyframes tr-spin{to{transform:rotate(360deg)}}`}</style>
        <span
          style={{
            width: 22,
            height: 22,
            border: "3px solid rgba(37,99,235,.25)",
            borderTopColor: "#2563eb",
            borderRadius: "50%",
            animation: "tr-spin .8s linear infinite",
          }}
        />
        Hubinaya session-ka macalinka...
      </div>
    );
  }

  if (status === "denied") {
    return <Navigate to="/teacher-login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}