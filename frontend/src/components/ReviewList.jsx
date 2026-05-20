import { useState } from "react";

const ASPECTS = ["Battery","Camera","Customer_Service","Design","Feature","General","Performance","Price","Screen"];

export default function ReviewList({ reviews = [] }) {
  const [filterAspect, setFilterAspect] = useState("");
  const [filterSentiment, setFilterSentiment] = useState("");

  const filtered = reviews.filter(r => {
    const aspects = r.aspects || [];
    if (!filterAspect && !filterSentiment) return true;
    if (filterAspect && filterSentiment) {
      return aspects.some(a => a.aspect === filterAspect && a.sentiment?.toLowerCase() === filterSentiment);
    }
    if (filterAspect) return aspects.some(a => a.aspect === filterAspect);
    if (filterSentiment) return aspects.some(a => a.sentiment?.toLowerCase() === filterSentiment);
    return true;
  });

  return (
    <div>
      <div className="flex gap-2 mb-3 flex-wrap">
        <select value={filterAspect} onChange={e => setFilterAspect(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-xs rounded px-2 py-1 text-gray-300">
          <option value="">Tất cả khía cạnh</option>
          {ASPECTS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filterSentiment} onChange={e => setFilterSentiment(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-xs rounded px-2 py-1 text-gray-300">
          <option value="">Tất cả cảm xúc</option>
          <option value="positive">Positive</option>
          <option value="negative">Negative</option>
        </select>
        <span className="text-xs text-gray-500 self-center">{filtered.length} reviews</span>
      </div>
      <div className="flex flex-col gap-3 max-h-96 overflow-y-auto">
        {filtered.map((r, i) => (
          <div key={r.id ?? i} className="bg-gray-900 border border-gray-800 rounded-lg p-3">
            <div className="flex flex-wrap gap-1 mb-2">
              {(r.aspects || []).map((a, j) => (
                <span key={a.aspect ?? j} className={`text-xs px-2 py-0.5 rounded font-mono ${
                  a.sentiment?.toLowerCase() === "positive"
                    ? "bg-green-900/40 text-green-400"
                    : "bg-red-900/40 text-red-400"
                }`}>
                  {a.aspect} {a.confidence ? `${Math.round(a.confidence * 100)}%` : ""}
                </span>
              ))}
            </div>
            <p className="text-sm text-gray-300">{r.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
