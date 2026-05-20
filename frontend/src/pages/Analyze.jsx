import { useState } from "react";
import { crawlLink } from "../api/crawl";
import { getDevice } from "../api/devices";
import DeviceCard from "../components/DeviceCard";
import DeviceCardSkeleton from "../components/DeviceCardSkeleton";
import WorkerStatus from "../components/WorkerStatus";

export default function Analyze() {
  const [url, setUrl] = useState("");
  const [count, setCount] = useState(50);
  const [phase, setPhase] = useState("idle"); // idle | crawling | done | error
  const [device, setDevice] = useState(null);
  const [error, setError] = useState("");

  const isValidUrl = (s) => s.includes("tiki.vn") || s.includes("shopee.vn");

  const handleAnalyze = async () => {
    if (!isValidUrl(url)) { setError("Chỉ hỗ trợ link Tiki hoặc Shopee"); return; }
    setPhase("crawling");
    setError("");
    setDevice(null);
    try {
      const r = await crawlLink({ url, count });
      const deviceId = r.data.devices?.[0];
      if (!deviceId) throw new Error("Không nhận được ID thiết bị từ worker");
      const dr = await getDevice(deviceId);
      setDevice(dr.data);
      setPhase("done");
    } catch (e) {
      setPhase("error");
      setError(e.response?.data?.detail || e.message || "Worker offline hoặc lỗi crawl");
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Phân tích link sản phẩm</h1>
        <WorkerStatus />
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 mb-6">
        <label className="text-xs font-medium text-gray-500 block mb-1.5">Link sản phẩm Tiki / Shopee</label>
        <input
          value={url}
          onChange={e => { setUrl(e.target.value); setError(""); }}
          placeholder="https://tiki.vn/... hoặc https://shopee.vn/..."
          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm mb-4 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 shadow-sm transition-all"
        />
        <div className="flex items-center gap-4 mb-5">
          <label className="text-xs font-medium text-gray-500 shrink-0">Số reviews cần cào:</label>
          <input
            type="number" min={10} max={200} value={count}
            onChange={e => setCount(Math.min(200, Math.max(10, parseInt(e.target.value) || 10)))}
            className="w-24 bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>
        <button
          onClick={handleAnalyze}
          disabled={phase === "crawling"}
          className="bg-blue-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 shadow-sm transition-colors"
        >
          {phase === "crawling" ? "⏳ Đang phân tích..." : "Phân tích"}
        </button>
        {error && <p className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg mt-3">{error}</p>}
      </div>

      {phase === "crawling" && (
        <div>
          <p className="text-xs text-gray-400 mb-3 text-center">Đang cào và phân tích... (1-2 phút)</p>
          <DeviceCardSkeleton />
        </div>
      )}

      {phase === "done" && device && (
        <div>
          <p className="text-sm text-emerald-600 bg-emerald-50 px-4 py-2.5 rounded-xl mb-4 border border-emerald-100">✓ Phân tích xong! Kết quả đã lưu vào lịch sử.</p>
          <DeviceCard device={device} />
        </div>
      )}
    </div>
  );
}
