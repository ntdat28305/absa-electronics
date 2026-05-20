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
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <select value={filterAspect} onChange={e => setFilterAspect(e.target.value)}
          className="bg-white border border-gray-200 text-xs rounded-lg px-2.5 py-1.5 text-gray-600 shadow-sm">
          <option value="">Tất cả khía cạnh</option>
          {ASPECTS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filterSentiment} onChange={e => setFilterSentiment(e.target.value)}
          className="bg-white border border-gray-200 text-xs rounded-lg px-2.5 py-1.5 text-gray-600 shadow-sm">
          <option value="">Tất cả cảm xúc</option>
          <option value="positive">Positive</option>
          <option value="negative">Negative</option>
        </select>
        <span className="text-xs text-gray-400 self-center">{filtered.length} reviews</span>
      </div>
      <div className="flex flex-col gap-2.5 max-h-96 overflow-y-auto pr-1">
        {filtered.map((r, i) => (
          <div key={r.id ?? i} className="bg-gray-50 border border-gray-100 rounded-xl p-3.5">
            <div className="flex flex-wrap gap-1 mb-2">
              {(r.aspects || []).map((a, j) => (
                <span key={a.aspect ?? j} className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                  a.sentiment?.toLowerCase() === "positive"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-red-50 text-red-600 border-red-200"
                }`}>
                  {a.aspect} {a.confidence ? `${Math.round(a.confidence * 100)}%` : ""}
                </span>
              ))}
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{r.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
