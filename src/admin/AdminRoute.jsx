// src/admin/AdminRoute.jsx
// Ilaaliya dhammaan routes-ka /admin/*. Ma ku tiirsana localStorage:
// wuxuu hubiyaa Firebase Auth session-ka (custom token uu backend-ku bixiyey
// kaddib OTP sax ah) + claims-ka role=admin & otpVerified=true, kadibna
// wuxuu Firestore ka akhriyaa admin/{adminId} (Rules: admin keliya).
import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase/firebase";
import { getVerifiedAdminClaims, signOutAdmin } from "../services/adminOtpService";

export default function AdminRoute() {
  const location = useLocation();
  const [status, setStatus] = useState("checking"); // checking | ok | denied

  useEffect(() => {
    let cancelled = false;
    const unsub = onAuthStateChanged(auth, async (user) => {
      try {
        const claims = await getVerifiedAdminClaims(user);
        if (!claims) throw new Error("not-verified");

        // Admin-ku weli ma jiraa? (haddii la tirtiray, session-ka ka saar)
        const snap = await getDoc(doc(db, "admin", claims.adminId));
        if (!snap.exists()) throw new Error("admin-removed");
        const data = snap.data();
        if (data.disabled === true || data.active === false) throw new Error("admin-disabled");

        // Xogta UI (Sidebar/Topbar) mar walba ka soo qaad server-ka.
        localStorage.setItem("adminId", claims.adminId);
        localStorage.setItem("adminName", data.fullName || data.name || data.username || "Admin");
        localStorage.setItem("adminRole", data.role || "admin");
        localStorage.setItem(
          "adminPermissions",
          JSON.stringify(Array.isArray(data.permissions) ? data.permissions : [])
        );
        if (!cancelled) setStatus("ok");
      } catch {
        if (user) await signOutAdmin();
        else await signOutAdmin({ keepPending: true });
        if (!cancelled) setStatus("denied");
      }
    });
    // Hubin joogto ah: session-ka 12 saacadood kadib wuu dhacayaa.
    const timer = setInterval(async () => {
      const ok = await getVerifiedAdminClaims(auth.currentUser).catch(() => null);
      if (!ok && !cancelled) {
        await signOutAdmin();
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
          background: "#0b0a1c",
          color: "#cbd5e1",
          fontFamily: "'Segoe UI', Arial, sans-serif",
          fontSize: 14,
          gap: 12,
        }}
      >
        <style>{`@keyframes ar-spin{to{transform:rotate(360deg)}}`}</style>
        <span
          style={{
            width: 22,
            height: 22,
            border: "3px solid rgba(148,163,184,.35)",
            borderTopColor: "#3b82f6",
            borderRadius: "50%",
            animation: "ar-spin .8s linear infinite",
          }}
        />
        Hubinaya session-ka admin-ka...
      </div>
    );
  }

  if (status === "denied") {
    return <Navigate to="/admin-login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}