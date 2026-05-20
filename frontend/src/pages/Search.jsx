import { useState } from "react";
import { crawlSearch } from "../api/crawl";
import { getDevice } from "../api/devices";
import DeviceCard from "../components/DeviceCard";
import WorkerStatus from "../components/WorkerStatus";

export default function Search() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [phase, setPhase] = useState("idle"); // idle | crawling | done | error
  const [numLinks, setNumLinks] = useState(3);
  const [reviewsPerLink, setReviewsPerLink] = useState(30);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    if (!query.trim()) return;
    setPhase("crawling");
    setError("");
    setResults([]);
    try {
      const r = await crawlSearch({ query, num_links: numLinks, reviews_per_link: reviewsPerLink, platform: "tiki" });
      const ids = r.data.devices || [];
      // fetch full device objects
      const devices = await Promise.all(ids.map(id => getDevice(id).then(r => r.data)));
      setResults(devices);
      setPhase("done");
    } catch (e) {
      setPhase("error");
      setError(e.response?.data?.detail || "Worker offline hoặc lỗi crawl");
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Tìm kiếm trực tiếp từ Tiki</h1>
        <WorkerStatus />
      </div>

      {/* Search form */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <div className="flex gap-2 mb-4">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            placeholder="Nhập tên thiết bị... (VD: iPhone 15, Samsung Galaxy S24)"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-orange-500"
          />
          <button
            onClick={handleSearch}
            disabled={phase === "crawling"}
            className="bg-orange-500 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-orange-600 disabled:opacity-50"
          >
            {phase === "crawling" ? "⏳ Đang cào..." : "🔍 Tìm kiếm"}
          </button>
        </div>
        <div className="flex gap-4">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Số sản phẩm</label>
            <input
              type="number" min={1} max={10} value={numLinks}
              onChange={e => setNumLinks(parseInt(e.target.value) || 1)}
              className="w-24 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Reviews / sản phẩm</label>
            <input
              type="number" min={10} max={200} value={reviewsPerLink}
              onChange={e => setReviewsPerLink(parseInt(e.target.value) || 10)}
              className="w-28 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm"
            />
          </div>
        </div>
      </div>

      {phase === "crawling" && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-2xl mb-3">⏳</div>
          <p>Đang cào và phân tích từ Tiki...</p>
          <p className="text-xs text-gray-600 mt-1">Có thể mất 1-3 phút</p>
        </div>
      )}

      {phase === "done" && results.length > 0 && (
        <div>
          <p className="text-sm text-green-400 mb-4">✓ Tìm thấy và phân tích {results.length} sản phẩm từ Tiki</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {results.map(d => <DeviceCard key={d.id} device={d} />)}
          </div>
        </div>
      )}

      {phase === "done" && results.length === 0 && (
        <div className="text-center py-16 text-gray-500">Không tìm thấy sản phẩm phù hợp</div>
      )}

      {phase === "error" && (
        <p className="text-red-400 text-sm mt-4">{error}</p>
      )}
    </div>
  );
}
