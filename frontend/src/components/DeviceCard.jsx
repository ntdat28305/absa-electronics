import { Link } from "react-router-dom";
import { addFavorite, removeFavorite } from "../api/favorites";
import { useAuth } from "../context/AuthContext";
import { useState } from "react";
import AspectBadges from "./AspectBadges";

export default function DeviceCard({ device, isFavorited = false, onFavoriteChange }) {
  const { user } = useAuth();
  const [fav, setFav] = useState(isFavorited);
  const [loading, setLoading] = useState(false);

  const topAspects = Object.fromEntries(
    Object.entries(device.aspect_scores || {}).sort((a, b) => b[1] - a[1]).slice(0, 3)
  );

  const toggleFav = async (e) => {
    e.preventDefault();
    if (!user) return alert("Vui lòng đăng nhập để lưu ưu thích");
    setLoading(true);
    try {
      if (fav) { await removeFavorite(device.id); setFav(false); }
      else { await addFavorite(device.id); setFav(true); }
      onFavoriteChange?.();
    } finally { setLoading(false); }
  };

  const scoreColor = device.overall_score >= 8 ? "text-emerald-600" : device.overall_score >= 6 ? "text-orange-500" : "text-red-500";

  return (
    <Link to={`/devices/${device.id}`}
      className="block bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md hover:border-orange-200 transition-all duration-200 group">
      <div className="relative bg-gray-50">
        {device.image_url ? (
          <img src={device.image_url} alt={device.name}
            className="w-full h-44 object-contain p-3 group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-44 flex items-center justify-center text-5xl text-gray-300">
            {device.category === "laptop" ? "💻" : "📱"}
          </div>
        )}
        <button onClick={toggleFav} disabled={loading}
          className={`absolute top-2.5 right-2.5 w-7 h-7 flex items-center justify-center rounded-full bg-white shadow-sm transition-colors ${
            fav ? "text-red-500" : "text-gray-300 hover:text-red-400"
          }`}>
          {fav ? "♥" : "♡"}
        </button>
        {device.platform && (
          <span className="absolute bottom-2 left-2 text-[10px] bg-white/80 text-gray-500 px-2 py-0.5 rounded-full uppercase tracking-wide font-medium">
            {device.platform}
          </span>
        )}
      </div>
      <div className="p-3.5">
        <div className="font-semibold text-sm text-gray-900 truncate leading-snug">{device.name}</div>
        <div className="flex items-center justify-between mt-1.5">
          <span className={`text-2xl font-bold ${scoreColor}`}>{device.overall_score.toFixed(1)}</span>
          <span className="text-xs text-gray-400">{device.total_reviews_analyzed} reviews</span>
        </div>
        {device.price && <div className="text-xs text-orange-500 font-medium mt-1">{device.price}</div>}
        <div className="mt-2.5">
          <AspectBadges aspectScores={topAspects} />
        </div>
      </div>
    </Link>
  );
}
