import { useState } from "react";
import { searchDevices } from "../api/devices";
import { crawlSearch } from "../api/crawl";
import DeviceCard from "../components/DeviceCard";
import WorkerStatus from "../components/WorkerStatus";

export default function Search() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [phase, setPhase] = useState("idle"); // idle | searching | found | notfound | crawling | done | error
  const [crawlOpts, setCrawlOpts] = useState({ num_links: 3, reviews_per_link: 50, platform: "shopee" });
  const [error, setError] = useState("");

  const handleSearch = async () => {
    if (!query.trim()) return;
    setPhase("searching");
    setError("");
    setResults([]);
    try {
      const r = await searchDevices(query);
      if (r.data.length > 0) {
        setResults(r.data);
        setPhase("found");
      } else {
        setPhase("notfound");
      }
    } catch {
      setPhase("error");
      setError("Lỗi kết nối API");
    }
  };

  const handleCrawl = async () => {
    setPhase("crawling");
    setError("");
    try {
      await crawlSearch({ query, ...crawlOpts });
      // After crawl, re-fetch from DB to get full device objects
      const r = await searchDevices(query);
      setResults(r.data);
      setPhase("done");
    } catch (e) {
      setPhase("error");
      setError(e.response?.data?.detail || "Worker offline hoặc lỗi crawl");
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Tìm kiếm thiết bị</h1>
        <WorkerStatus />
      </div>

      {/* Search bar */}
      <div className="flex gap-2 mb-6">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSearch()}
          placeholder="Nhập tên thiết bị... (VD: iPhone 15, ASUS Zenbook)"
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-orange-500"
        />
        <button
          onClick={handleSearch}
          disabled={phase === "searching" || phase === "crawling"}
          className="bg-orange-500 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-orange-600 disabled:opacity-50"
        >
          {phase === "searching" ? "Đang tìm..." : "Tìm"}
        </button>
      </div>

      {/* DB results */}
      {phase === "found" && (
        <div>
          <p className="text-sm text-green-400 mb-4">✓ Tìm thấy {results.length} thiết bị trong kho DB</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {results.map(d => <DeviceCard key={d.id} device={d} />)}
          </div>
        </div>
      )}

      {/* Not found — show crawl form */}
      {(phase === "notfound" || phase === "crawling" || phase === "done") && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
          <p className="text-sm text-yellow-400 mb-4">
            ⚠ Không tìm thấy "{query}" trong DB. Cào mới từ Shopee/Tiki:
          </p>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Số sản phẩm cần lấy</label>
              <input
                type="number" min={1} max={10} value={crawlOpts.num_links}
                onChange={e => setCrawlOpts(o => ({ ...o, num_links: parseInt(e.target.value) || 1 }))}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Reviews / sản phẩm</label>
              <input
                type="number" min={10} max={200} value={crawlOpts.reviews_per_link}
                onChange={e => setCrawlOpts(o => ({ ...o, reviews_per_link: parseInt(e.target.value) || 10 }))}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Nền tảng</label>
              <select
                value={crawlOpts.platform}
                onChange={e => setCrawlOpts(o => ({ ...o, platform: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm"
              >
                <option value="shopee">Shopee</option>
                <option value="tiki">Tiki</option>
                <option value="both">Cả hai</option>
              </select>
            </div>
          </div>
          <button
            onClick={handleCrawl}
            disabled={phase === "crawling"}
            className="bg-orange-500 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600 disabled:opacity-50"
          >
            {phase === "crawling" ? "⏳ Đang cào... (có thể mất vài phút)" : "▶ Bắt đầu cào"}
          </button>
        </div>
      )}

      {/* Crawl results */}
      {phase === "done" && results.length > 0 && (
        <div className="mt-2">
          <p className="text-sm text-green-400 mb-4">✓ Đã cào và phân tích xong {results.length} sản phẩm</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {results.map(d => <DeviceCard key={d.id} device={d} />)}
          </div>
        </div>
      )}

      {phase === "error" && <p className="text-red-400 text-sm mt-4">{error}</p>}
    </div>
  );
}
