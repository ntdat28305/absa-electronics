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
    setError("");
    Promise.all([
      getDevice(id),
      user ? getFavorites() : Promise.resolve({ data: [] })
    ])
      .then(([dr, fr]) => {
        if (cancelled) return;
        setDevice(dr.data);
        setFav(fr.data.some(d => d.id === parseInt(id)));
      })
      .catch(e => {
        if (!cancelled) setError("Không tìm thấy thiết bị hoặc lỗi kết nối");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id, user]);

  const toggleFav = async () => {
    if (!user) return alert("Vui lòng đăng nhập");
    if (fav) { await removeFavorite(id); setFav(false); }
    else { await addFavorite(id); setFav(true); }
  };

  if (loading) return <div className="text-center py-20 text-gray-500">Đang tải...</div>;
  if (error) return <div className="text-center py-20 text-red-400">{error}</div>;
  if (!device) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex gap-6 mb-8">
        {device.image_url ? (
          <img src={device.image_url} alt={device.name} className="w-40 h-40 object-contain bg-gray-800 rounded-xl p-2 shrink-0" />
        ) : (
          <div className="w-40 h-40 bg-gray-800 rounded-xl flex items-center justify-center text-5xl shrink-0">
            {device.category === "laptop" ? "💻" : "📱"}
          </div>
        )}
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{device.name}</h1>
          <div className="flex items-end gap-2 mt-1">
            <span className="text-4xl font-bold text-blue-400">{device.overall_score.toFixed(1)}</span>
            <span className="text-gray-500 mb-1">/ 10</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">{device.total_reviews_analyzed} reviews phân tích · {device.platform}</p>
          {device.price && <p className="text-orange-400 mt-1">{device.price}</p>}
          <div className="flex gap-3 mt-3">
            {device.product_url && (
              <a href={device.product_url} target="_blank" rel="noreferrer"
                className="text-sm bg-orange-500 text-white px-4 py-1.5 rounded hover:bg-orange-600">
                🛒 Mua ngay
              </a>
            )}
            <button onClick={toggleFav}
              className={`text-sm px-4 py-1.5 rounded border ${fav ? "border-red-500 text-red-400" : "border-gray-600 text-gray-400 hover:border-red-500"}`}>
              {fav ? "♥ Đã lưu" : "♡ Lưu"}
            </button>
          </div>
        </div>
      </div>

      {/* Analysis */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-sm font-mono text-gray-400 uppercase mb-3">Radar</h2>
          <RadarChart aspectScores={device.aspect_scores} />
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-sm font-mono text-gray-400 uppercase mb-3">Chi tiết khía cạnh</h2>
          <AspectProgressBars aspectScores={device.aspect_scores} />
        </div>
      </div>

      {/* Reviews */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h2 className="text-sm font-mono text-gray-400 uppercase mb-3">Bình luận ({device.reviews?.length || 0})</h2>
        <ReviewList reviews={device.reviews || []} />
      </div>
    </div>
  );
}
