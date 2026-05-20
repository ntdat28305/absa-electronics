import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getFavorites } from "../api/favorites";
import DeviceCard from "../components/DeviceCard";
import { useAuth } from "../context/AuthContext";

export default function Favorites() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  const fetchFavs = () => {
    if (!user) return;
    setLoading(true);
    getFavorites()
      .then(r => setDevices(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchFavs(); }, [user]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold mb-6">Thiết bị yêu thích ({devices.length})</h1>
      {loading ? (
        <p className="text-gray-500 text-center py-12">Đang tải...</p>
      ) : devices.length === 0 ? (
        <p className="text-gray-500 text-center py-12">Chưa có thiết bị nào</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {devices.map(d => <DeviceCard key={d.id} device={d} isFavorited onFavoriteChange={fetchFavs} />)}
        </div>
      )}
    </div>
  );
}
