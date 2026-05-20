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
      if (fav) {
        await removeFavorite(device.id);
        setFav(false);
      } else {
        await addFavorite(device.id);
        setFav(true);
      }
      onFavoriteChange?.();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Link to={`/devices/${device.id}`} className="block bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-orange-500/50 transition-colors">
      <div className="relative">
        {device.image_url ? (
          <img src={device.image_url} alt={device.name} className="w-full h-40 object-contain bg-gray-800 p-2" />
        ) : (
          <div className="w-full h-40 bg-gray-800 flex items-center justify-center text-4xl">📱</div>
        )}
        <button onClick={toggleFav} disabled={loading}
          className={`absolute top-2 right-2 text-lg ${fav ? "text-red-500" : "text-gray-500 hover:text-red-400"}`}>
          {fav ? "♥" : "♡"}
        </button>
      </div>
      <div className="p-3">
        <div className="font-semibold text-sm text-white truncate">{device.name}</div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-2xl font-bold text-blue-400">{device.overall_score.toFixed(1)}</span>
          <span className="text-xs text-gray-500">{device.total_reviews_analyzed} reviews</span>
        </div>
        {device.price && <div className="text-xs text-orange-400 mt-1">{device.price}</div>}
        <div className="mt-2">
          <AspectBadges aspectScores={topAspects} />
        </div>
      </div>
    </Link>
  );
}
