// DashboardCard.jsx — kaarka tirada (stat card) ee Dashboard-ka
// Props:
//   title, value, color
//   icon     : lucide component (ama emoji string — sidii hore)
//   growth   : number | null   -> "↑ 12% this month" (null = la qariyo)
//   growthLabel : qoraalka ka dambeeya boqolleyda (default "this month")
//   spark    : [number]        -> xogta dhabta ah ee sparkline-ka
//   percent  : (hore) string   -> wali waa la taageeraa
import { useId } from "react";
import { MoreVertical, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, YAxis } from "recharts";

export default function DashboardCard({
  title,
  value,
  icon: Icon,
  color = "#16a34a",
  growth = null,
  growthLabel = "this month",
  spark = [],
  percent,
  onClick,
}) {
  const gradId = "g" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const data = (spark.length ? spark : [0, 0]).map((v, i) => ({ i, v }));

  // Taageero API-gii hore ("12%")
  let g = growth;
  if (g === null && typeof percent === "string") {
    const n = parseFloat(percent);
    g = Number.isFinite(n) ? n : null;
  }
  const up = g > 0;
  const down = g < 0;
  const trendColor = down ? "#dc2626" : up ? "#16a34a" : "#6b7280";
  const TrendIcon = down ? ArrowDown : up ? ArrowUp : Minus;

  return (
    <div
      onClick={onClick}
      className="rs-stat"
      style={{
        position: "relative",
        background: `linear-gradient(135deg,#ffffff 55%, ${color}12)`,
        borderRadius: 20,
        padding: "18px 18px 10px",
        boxShadow: "0 6px 20px rgba(17,24,39,0.06)",
        border: `1px solid ${color}22`,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minWidth: 0,
        cursor: onClick ? "pointer" : "default",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: "50%",
              background: `${color}1F`,
              color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              flexShrink: 0,
            }}
          >
            {typeof Icon === "string" ? Icon : Icon ? <Icon size={26} strokeWidth={2.2} /> : null}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#111827", lineHeight: 1.05 }}>{value}</div>
            <div style={{ fontSize: 14, color: "#4B5563", marginTop: 3, fontWeight: 500 }}>{title}</div>
          </div>
        </div>
        <MoreVertical size={18} color="#6B7280" />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13.5,
          color: trendColor,
          fontWeight: 600,
          minHeight: 18,
          visibility: g === null ? "hidden" : "visible",
        }}
      >
        <TrendIcon size={15} />
        <span>
          {g !== null ? `${Math.abs(g)}%` : ""} {growthLabel}
        </span>
      </div>

      <div style={{ height: 52, margin: "0 -18px -10px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <YAxis hide domain={["dataMin - 1", "dataMax + 1"]} />
            <Area
              type="monotone"
              dataKey="v"
              stroke={color}
              strokeWidth={2.5}
              fill={`url(#${gradId})`}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}