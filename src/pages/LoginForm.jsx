//src/pages/LoginForm.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/firebase";

export default function LoginForm({ role }) {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // ---- Xannib: F12, right-click, iyo shortcut-yada developer tools ----
  useEffect(() => {
    function handleContextMenu(e) {
      e.preventDefault();
    }

    function handleKeyDown(e) {
      const key = (e.key || "").toLowerCase();

      // F12
      if (key === "f12") {
        e.preventDefault();
        return;
      }

      // Ctrl+Shift+I / J / C  (DevTools, Console, Inspect element)
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (key === "i" || key === "j" || key === "c")
      ) {
        e.preventDefault();
        return;
      }

      // Ctrl+U (View source) iyo Ctrl+S (Save page)
      if ((e.ctrlKey || e.metaKey) && (key === "u" || key === "s")) {
        e.preventDefault();
        return;
      }
    }

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const login = async () => {
    if (!username.trim() || !password.trim()) {
      alert("Fill all fields");
      return;
    }

    setLoading(true);

    try {
      let collectionName = "";

      switch (role) {
        case "Admin":
          collectionName = "admin";
          break;
        case "Teacher":
          collectionName = "teachers";
          break;
        case "Cashier":
          collectionName = "cashier";
          break;
        case "Student":
          collectionName = "students";
          break;
        case "Parent":
          collectionName = "students";
          break;
        default:
          return;
      }

      const snapshot = await getDocs(collection(db, collectionName));

      let found = false;

      snapshot.forEach((item) => {
        const data = item.data();

        if (role === "Admin") {
          if (
            (data.email === username.trim() ||
              data.username === username.trim()) &&
            data.password === password.trim()
          ) {
            found = true;
            localStorage.setItem("adminId", item.id);
            localStorage.setItem("adminName", data.fullName || data.name || data.username || "Admin");
            // Sub-admins have role: "subadmin" and a `permissions` array
            // of sidebar paths (see AddSubAdmin.jsx). The original Super
            // Admin doc has no `role` field or role: "admin" — treat
            // anything else as a sub-admin so Sidebar.jsx knows whether
            // to filter its menu.
            localStorage.setItem("adminRole", data.role || "admin");
            localStorage.setItem(
              "adminPermissions",
              JSON.stringify(Array.isArray(data.permissions) ? data.permissions : [])
            );
          }
        }

        if (role === "Teacher") {
          if (
            (data.username === username.trim() ||
              data.teacherId === username.trim()) &&
            data.password === password.trim()
          ) {
            found = true;
            localStorage.setItem("teacherId", item.id);
            localStorage.setItem(
              "teacherName",
              data.fullName || data.name || data.username || "Teacher"
            );
          }
        }

        if (role === "Cashier") {
          if (
            data.username === username.trim() &&
            data.password === password.trim()
          ) {
            found = true;
            localStorage.setItem("cashierId", item.id);
            localStorage.setItem("cashierName", data.name || data.username || "Cashier");
          }
        }

        if (role === "Student") {
          if (
            (data.studentId === username.trim() ||
              item.id === username.trim()) &&
            data.parentPassword === password.trim()
          ) {
            found = true;
            localStorage.setItem("studentId", item.id);
            localStorage.setItem("studentName", data.fullName || data.name || "Student");
          }
        }

        if (role === "Parent") {
          if (
            (data.studentId === username.trim() ||
              data.parentPhone === username.trim()) &&
            data.parentPassword === password.trim()
          ) {
            found = true;
            localStorage.setItem("studentId", item.id);
            localStorage.setItem("parentName", data.parentName || "Parent");
          }
        }
      });

      if (!found) {
        alert(
          role === "Admin"
            ? "Check your email or password"
            : "Check user or password"
        );
        return;
      }

      if (role === "Admin") navigate("/admin/dashboard");
      if (role === "Teacher") navigate("/teacher/dashboard");
      if (role === "Cashier") navigate("/cashier/dashboard");
      if (role === "Student") navigate("/student/dashboard");
      if (role === "Parent") navigate("/parent/dashboard");
    } catch (error) {
      alert(
        role === "Admin"
          ? "Check your email or password"
          : "Check user or password"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        background: "#eef3fb",
      }}
    >
      <div
        style={{
          width: 430,
          background: "#fff",
          padding: 40,
          borderRadius: 20,
          boxShadow: "0 0 30px rgba(0,0,0,.1)",
        }}
      >
        <h1>{role} Login</h1>

        <br />

        <input
          style={input}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={
            role === "Admin"
              ? "Admin Email or Username"
              : role === "Teacher"
              ? "Teacher Username"
              : role === "Cashier"
              ? "Cashier Username"
              : role === "Parent"
              ? "Student ID / Parent Phone"
              : "Student ID"
          }
        />

        <br />
        <br />

        <input
          type="password"
          style={input}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
        />

        <br />
        <br />

        <button style={button} onClick={login} disabled={loading}>
          {loading ? "LOGGING IN..." : "LOGIN"}
        </button>
      </div>
    </div>
  );
}

const input = {
  width: "100%",
  padding: "15px",
  borderRadius: "10px",
  border: "1px solid #ccc",
  fontSize: "16px",
};

const button = {
  width: "100%",
  padding: "15px",
  background: "#0d6efd",
  color: "#fff",
  border: "none",
  borderRadius: "10px",
  cursor: "pointer",
  fontSize: "18px",
};