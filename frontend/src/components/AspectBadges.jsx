const ASPECT_ICONS = {
  Battery: "🔋", Camera: "📸", Customer_Service: "🤝", Design: "✨",
  Feature: "⚙️", General: "📋", Performance: "⚡", Price: "💰", Screen: "📱",
};

export default function AspectBadges({ aspectScores = {} }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {Object.entries(aspectScores).map(([aspect, pct]) => (
        <span key={aspect}
          className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium border ${
            pct >= 50
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-red-50 text-red-600 border-red-200"
          }`}>
          {ASPECT_ICONS[aspect]} {aspect.replace("_", " ")} {pct}%{pct >= 50 ? "↑" : "↓"}
        </span>
      ))}
    </div>
  );
}
