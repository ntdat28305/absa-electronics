const ASPECT_ICONS = {
  Battery: "🔋", Camera: "📸", Customer_Service: "🤝", Design: "✨",
  Feature: "⚙️", General: "📋", Performance: "⚡", Price: "💰", Screen: "📱",
};

export default function AspectProgressBars({ aspectScores = {} }) {
  return (
    <div className="flex flex-col gap-3">
      {Object.entries(aspectScores).map(([aspect, pct]) => (
        <div key={aspect} className="flex items-center gap-3">
          <span className="w-36 text-xs text-gray-600 font-medium shrink-0 flex items-center gap-1.5">
            {ASPECT_ICONS[aspect]} {aspect.replace("_", " ")}
          </span>
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${pct >= 50 ? "bg-emerald-500" : "bg-red-400"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className={`text-xs font-semibold w-10 text-right ${pct >= 50 ? "text-emerald-600" : "text-red-500"}`}>
            {pct}%
          </span>
        </div>
      ))}
    </div>
  );
}
