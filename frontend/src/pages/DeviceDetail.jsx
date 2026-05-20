import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getDevice } from "../api/devices";
import { addFavorite, removeFavorite, getFavorites } from "../api/favorites";
import { useAuth } from "../context/AuthContext";
import RadarChart from "../components/RadarChart";
import AspectProgressBars from "../components/AspectProgressBars";
import ReviewList from "../components/ReviewList";

export default function DeviceDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [device, setDevice] = useState(null);
  const [fav, setFav] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getDevice(id),
      user ? getFavorites() : Promise.resolve({ data: [] })
    ])
      .then(([dr, fr]) => {
        if (cancelled) return;
        setDevice(dr.data);
        setFav(fr.data.some(d => d.id === parseInt(id)));
      })
      .catch(() => { if (!cancelled) setError("Không tìm thấy thiết bị hoặc lỗi kết nối"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, user]);

  const toggleFav = async () => {
    if (!user) return alert("Vui lòng đăng nhập");
    const prev = fav; setFav(!fav);
    try {
      if (prev) await removeFavorite(id); else await addFavorite(id);
    } catch { setFav(prev); }
  };

  if (loading) return <div className="text-center py-20 text-gray-400">Đang tải...</div>;
  if (error) return <div className="text-center py-20 text-red-500">{error}</div>;
  if (!device) return null;

  const scoreColor = device.overall_score >= 8 ? "text-emerald-600" : device.overall_score >= 6 ? "text-blue-500" : "text-red-500";

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6 flex gap-6">
        {device.image_url ? (
          <img src={device.image_url} alt={device.name}
            className="w-36 h-36 object-contain bg-gray-50 rounded-xl p-2 shrink-0" />
        ) : (
          <div className="w-36 h-36 bg-gray-50 rounded-xl flex items-center justify-center text-5xl shrink-0">
            {device.category === "laptop" ? "💻" : "📱"}
          </div>
        )}
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-snug">{device.name}</h1>
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1.5">
                {device.total_reviews_analyzed} reviews phân tích ·
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                  device.platform === "tiki"
                    ? "bg-orange-50 text-orange-500 border border-orange-200"
                    : "bg-red-50 text-red-500 border border-red-200"
                }`}>{device.platform}</span>
              </p>
            </div>
            <div className="text-right">
              <span className={`text-5xl font-extrabold ${scoreColor}`}>{(device.overall_score ?? 0).toFixed(1)}</span>
              <span className="text-gray-400 text-sm block">/ 10</span>
            </div>
          </div>
          {device.price && <p className="text-blue-500 font-semibold mt-2">{device.price}</p>}
          <div className="flex gap-2 mt-4">
            {device.product_url && (
              <a href={device.product_url} target="_blank" rel="noreferrer"
                className="text-sm bg-blue-500 text-white px-5 py-2 rounded-xl hover:bg-blue-700 font-medium shadow-sm transition-colors">
                🛒 Mua ngay
              </a>
            )}
            <button onClick={toggleFav}
              className={`text-sm px-5 py-2 rounded-xl border font-medium transition-colors ${
                fav ? "border-red-300 text-red-500 bg-red-50" : "border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-500"
              }`}>
              {fav ? "♥ Đã lưu" : "♡ Lưu"}
            </button>
          </div>
        </div>
      </div>

      {/* Analysis */}
      <div className="grid md:grid-cols-2 gap-5 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Radar</h2>
          <RadarChart aspectScores={device.aspect_scores} />
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Chi tiết khía cạnh</h2>
          <AspectProgressBars aspectScores={device.aspect_scores} />
        </div>
      </div>

      {/* Reviews */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
          Bình luận ({device.reviews?.length || 0})
        </h2>
        <ReviewList reviews={device.reviews || []} />
      </div>
    </div>
  );
}
