import { useState } from "react";
import { crawlSearch } from "../api/crawl";
import { getDevice } from "../api/devices";
import DeviceCard from "../components/DeviceCard";
import WorkerStatus from "../components/WorkerStatus";

export default function Search() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [phase, setPhase] = useState("idle");
  const [numLinks, setNumLinks] = useState(3);
  const [reviewsPerLink, setReviewsPerLink] = useState(30);
  const [platform, setPlatform] = useState("tiki");
  const [error, setError] = useState("");

  const handleSearch = async () => {
    if (!query.trim()) return;
    setPhase("crawling");
    setError("");
    setResults([]);
    try {
      const r = await crawlSearch({ query, num_links: numLinks, reviews_per_link: reviewsPerLink, platform });
      const ids = r.data.devices || [];
      const devices = await Promise.all(ids.map(id => getDevice(id).then(r => r.data)));
      setResults(devices);
      setPhase("done");
    } catch (e) {
      setPhase("error");
      setError(e.response?.data?.detail || "Worker offline hoặc lỗi crawl");
    }
  };

  const platformLabel = platform === "tiki" ? "Tiki" : "Shopee";

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Tìm kiếm trực tiếp từ {platformLabel}</h1>
        <WorkerStatus />
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 mb-6">
        {/* Platform toggle */}
        <div className="flex gap-2 mb-4">
          {["tiki", "shopee"].map(p => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              className={`px-4 py-1.5 rounded-xl text-sm font-semibold border transition-colors ${
                platform === p
                  ? "bg-blue-500 text-white border-blue-500"
                  : "bg-white text-gray-500 border-gray-200 hover:border-blue-300"
              }`}
            >
              {p === "tiki" ? "Tiki" : "Shopee"}
            </button>
          ))}
        </div>

        <div className="flex gap-2 mb-4">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            placeholder={`Nhập tên thiết bị... (VD: iPhone 15, Samsung Galaxy S24)`}
            className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 shadow-sm transition-all"
          />
          <button
            onClick={handleSearch}
            disabled={phase === "crawling"}
            className="bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 shadow-sm transition-colors"
          >
            {phase === "crawling" ? "⏳ Đang cào..." : "Tìm kiếm"}
          </button>
        </div>

        <div className="flex gap-6">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">Số sản phẩm</label>
            <input
              type="number" min={1} max={10} value={numLinks}
              onChange={e => setNumLinks(parseInt(e.target.value) || 1)}
              className="w-24 bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">Reviews / sản phẩm</label>
            <input
              type="number" min={10} max={200} value={reviewsPerLink}
              onChange={e => setReviewsPerLink(parseInt(e.target.value) || 10)}
              className="w-28 bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>
        </div>
      </div>

      {phase === "crawling" && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-3xl mb-3">⏳</div>
          <p className="text-sm">Đang cào và phân tích từ {platformLabel}...</p>
          <p className="text-xs text-gray-300 mt-1">Có thể mất 1-3 phút</p>
        </div>
      )}

      {phase === "done" && results.length > 0 && (
        <div>
          <p className="text-sm text-emerald-600 bg-emerald-50 px-4 py-2.5 rounded-xl mb-4 border border-emerald-100">
            ✓ Tìm thấy và phân tích {results.length} sản phẩm từ {platformLabel}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {results.map(d => <DeviceCard key={d.id} device={d} />)}
          </div>
        </div>
      )}

      {phase === "done" && results.length === 0 && (
        <div className="text-center py-16 text-gray-400">Không tìm thấy sản phẩm phù hợp</div>
      )}

      {phase === "error" && (
        <p className="text-red-500 text-xs bg-red-50 px-4 py-2.5 rounded-xl mt-4 border border-red-100">{error}</p>
      )}
    </div>
  );
}
