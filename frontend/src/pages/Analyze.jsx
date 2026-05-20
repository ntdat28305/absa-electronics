import { useState } from "react";
import { crawlLink } from "../api/crawl";
import { getDevice } from "../api/devices";
import DeviceCard from "../components/DeviceCard";
import WorkerStatus from "../components/WorkerStatus";

export default function Analyze() {
  const [url, setUrl] = useState("");
  const [count, setCount] = useState(50);
  const [phase, setPhase] = useState("idle"); // idle | crawling | done | error
  const [device, setDevice] = useState(null);
  const [error, setError] = useState("");

  const isValidUrl = (s) => s.includes("shopee.vn") || s.includes("tiki.vn");

  const handleAnalyze = async () => {
    if (!isValidUrl(url)) { setError("Chỉ hỗ trợ link Shopee hoặc Tiki"); return; }
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
        <h1 className="text-xl font-bold">Phân tích link sản phẩm</h1>
        <WorkerStatus />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <label className="text-xs text-gray-400 block mb-1">Link sản phẩm (Shopee hoặc Tiki)</label>
        <input
          value={url}
          onChange={e => { setUrl(e.target.value); setError(""); }}
          placeholder="https://shopee.vn/..."
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm mb-3 outline-none focus:border-orange-500"
        />
        <div className="flex items-center gap-4 mb-4">
          <label className="text-xs text-gray-400 shrink-0">Số reviews cần cào:</label>
          <input
            type="number" min={10} max={200} value={count}
            onChange={e => setCount(Math.min(200, Math.max(10, parseInt(e.target.value) || 10)))}
            className="w-24 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm"
          />
        </div>
        <button
          onClick={handleAnalyze}
          disabled={phase === "crawling"}
          className="bg-orange-500 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600 disabled:opacity-50"
        >
          {phase === "crawling" ? "⏳ Đang phân tích..." : "▶ Phân tích"}
        </button>
        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
      </div>

      {phase === "done" && device && (
        <div>
          <p className="text-sm text-green-400 mb-4">✓ Phân tích xong! Kết quả đã lưu vào lịch sử.</p>
          <DeviceCard device={device} />
        </div>
      )}
    </div>
  );
}
