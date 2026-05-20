const ASPECT_ICONS = {
  Battery: "🔋", Camera: "📸", Customer_Service: "🤝", Design: "✨",
  Feature: "⚙️", General: "📋", Performance: "⚡", Price: "💰", Screen: "📱",
};

export default function AspectProgressBars({ aspectScores = {} }) {
  return (
    <div className="flex flex-col gap-2">
      {Object.entries(aspectScores).map(([aspect, pct]) => (
        <div key={aspect} className="flex items-center gap-3">
          <span className="w-32 text-xs text-gray-400 font-mono shrink-0">
            {ASPECT_ICONS[aspect]} {aspect}
          </span>
          <div className="flex-1 h-2 bg-gray-800 rounded overflow-hidden">
            <div
              className={`h-full rounded transition-all ${pct >= 50 ? "bg-green-500" : "bg-red-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className={`text-xs font-mono w-10 text-right ${pct >= 50 ? "text-green-400" : "text-red-400"}`}>
            {pct}%
          </span>
        </div>
      ))}
    </div>
  );
}
