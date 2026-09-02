import { Link, useLocation } from "react-router-dom";
import { theme } from "./theme.js";

const NAV_ITEMS = [
  { to: "/cashier/dashboard", label: "Dashboard", icon: "📊" },
  { to: "/cashier/payments", label: "Payments", icon: "💳" },
  { to: "/cashier/classes", label: "Classes", icon: "🏫" },
  { to: "/cashier/exam-payments", label: "Exam Payments", icon: "🪪" },
  { to: "/cashier/reports", label: "Reports", icon: "📁" },
  { to: "/cashier/profile", label: "Profile", icon: "👤" },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <div style={styles.sidebar}>
      <div style={styles.brandRow}>
        <span style={styles.brandCoin}>💰</span>
        <div>
          <div style={styles.brandTitle}>CASHIER</div>
          <div style={styles.brandSub}>Finance Desk</div>
        </div>
      </div>

      <nav style={styles.nav}>
        {NAV_ITEMS.map((item) => {
          const active = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              style={{
                ...styles.link,
                ...(active ? styles.linkActive : {}),
              }}
            >
              <span style={styles.linkIcon}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div style={styles.footer}>
        <div style={styles.footerDot} />
        Synced just now
      </div>
    </div>
  );
}

const styles = {
  sidebar: {
    width: 250,
    minHeight: "100vh",
    background: theme.colors.brand,
    padding: "28px 18px",
    display: "flex",
    flexDirection: "column",
    fontFamily: theme.font.body,
  },
  brandRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "0 8px 28px 8px",
    borderBottom: `1px solid rgba(255,255,255,0.12)`,
    marginBottom: 24,
  },
  brandCoin: {
    fontSize: 26,
    width: 44,
    height: 44,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255,255,255,0.08)",
    borderRadius: theme.radius.md,
  },
  brandTitle: {
    color: "#FFFFFF",
    fontFamily: theme.font.display,
    fontWeight: 800,
    fontSize: 16,
    letterSpacing: 1,
  },
  brandSub: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    marginTop: 2,
  },
  nav: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  link: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 14px",
    borderRadius: theme.radius.sm,
    textDecoration: "none",
    color: "rgba(255,255,255,0.75)",
    fontWeight: 600,
    fontSize: 14.5,
    transition: "background .15s ease, color .15s ease",
  },
  linkActive: {
    background: theme.colors.mint,
    color: theme.colors.brandDark,
  },
  linkIcon: {
    fontSize: 16,
    width: 20,
    textAlign: "center",
  },
  footer: {
    marginTop: "auto",
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
    paddingTop: 20,
    borderTop: "1px solid rgba(255,255,255,0.12)",
  },
  footerDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: theme.colors.mint,
  },
};