const COLORS = {
  positive: "bg-green-900/40 text-green-400 border border-green-800",
  negative: "bg-red-900/40 text-red-400 border border-red-800",
};
const ASPECT_ICONS = {
  Battery: "🔋", Camera: "📸", Customer_Service: "🤝", Design: "✨",
  Feature: "⚙️", General: "📋", Performance: "⚡", Price: "💰", Screen: "📱",
};

export default function AspectBadges({ aspectScores = {} }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {Object.entries(aspectScores).map(([aspect, pct]) => (
        <span key={aspect} className={`text-xs px-2 py-0.5 rounded font-mono ${pct >= 50 ? COLORS.positive : COLORS.negative}`}>
          {ASPECT_ICONS[aspect] || "•"} {aspect} {pct}%{pct >= 50 ? "↑" : "↓"}
        </span>
      ))}
    </div>
  );
}
