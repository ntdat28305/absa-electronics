import { useEffect, useState } from "react";
import { listDevices } from "../api/devices";
import { getFavorites } from "../api/favorites";
import DeviceCard from "../components/DeviceCard";
import { useAuth } from "../context/AuthContext";

const BRANDS = ["Apple", "Samsung", "ASUS", "Dell", "Xiaomi", "Oppo", "Vivo"];
const PAGE_SIZE = 20;

export default function Home() {
  const { user } = useAuth();
  const [devices, setDevices] = useState([]);
  const [total, setTotal] = useState(0);
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [sort, setSort] = useState("score");
  const [page, setPage] = useState(1);
  const [favorites, setFavorites] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchFavs = async () => {
    if (!user) return;
    try {
      const r = await getFavorites();
      setFavorites(new Set(r.data.map(d => d.id)));
    } catch (e) {
      console.error("Failed to load favorites:", e);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    listDevices({ category: category || undefined, brand: brand || undefined, sort, page })
      .then(r => {
        if (!cancelled) {
          setDevices(r.data.items);
          setTotal(r.data.total);
        }
      })
      .catch(e => {
        if (!cancelled) {
          console.error("Failed to load devices:", e);
          setError("Không thể tải danh sách thiết bị. Vui lòng thử lại.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [category, brand, sort, page]);

  useEffect(() => { fetchFavs(); }, [user]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex gap-6">
        {/* Sidebar */}
        <aside className="w-48 shrink-0">
          <h3 className="text-xs font-mono text-gray-500 uppercase mb-3">Danh mục</h3>
          {[["", "Tất cả"], ["phone", "📱 Điện thoại"], ["laptop", "💻 Laptop"]].map(([v, l]) => (
            <button key={v} onClick={() => { setCategory(v); setPage(1); }}
              className={`block w-full text-left text-sm px-3 py-1.5 rounded mb-1 ${category === v ? "bg-orange-500/20 text-orange-400" : "text-gray-400 hover:text-white"}`}>
              {l}
            </button>
          ))}
          <h3 className="text-xs font-mono text-gray-500 uppercase mt-4 mb-3">Hãng</h3>
          {["", ...BRANDS].map(b => (
            <button key={b} onClick={() => { setBrand(b); setPage(1); }}
              className={`block w-full text-left text-sm px-3 py-1.5 rounded mb-1 ${brand === b ? "bg-orange-500/20 text-orange-400" : "text-gray-400 hover:text-white"}`}>
              {b || "Tất cả"}
            </button>
          ))}
        </aside>

        {/* Main */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-bold">
              Kho thiết bị{!loading && <span className="text-gray-500 text-sm font-normal"> ({total} thiết bị)</span>}
            </h1>
            <select value={sort} onChange={e => setSort(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-sm rounded px-2 py-1 text-gray-300">
              <option value="score">Điểm cao nhất</option>
              <option value="newest">Mới nhất</option>
            </select>
          </div>
          {loading ? (
            <div className="text-center py-20 text-gray-500">Đang tải...</div>
          ) : error ? (
            <div className="text-center py-20 text-red-400">{error}</div>
          ) : devices.length === 0 ? (
            <div className="text-center py-20 text-gray-500">Chưa có thiết bị nào trong kho</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {devices.map(d => (
                <DeviceCard key={d.id} device={d} isFavorited={favorites.has(d.id)} onFavoriteChange={fetchFavs} />
              ))}
            </div>
          )}
          {/* Pagination */}
          {total > PAGE_SIZE && (
            <div className="flex gap-2 justify-center mt-6">
              {page > 1 && <button onClick={() => setPage(p => p - 1)} className="px-3 py-1 bg-gray-800 rounded text-sm">← Trước</button>}
              <span className="px-3 py-1 text-sm text-gray-400">Trang {page}</span>
              {page * PAGE_SIZE < total && <button onClick={() => setPage(p => p + 1)} className="px-3 py-1 bg-gray-800 rounded text-sm">Tiếp →</button>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
