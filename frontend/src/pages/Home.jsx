import { useEffect, useState, useCallback } from "react";
import { listDevices, searchDevices } from "../api/devices";
import { getFavorites } from "../api/favorites";
import DeviceCard from "../components/DeviceCard";
import { useAuth } from "../context/AuthContext";

const PHONE_BRANDS = ["Apple", "Samsung", "Xiaomi", "Oppo", "Vivo"];
const LAPTOP_BRANDS = ["ASUS", "Dell", "Acer", "HP", "MSI", "Lenovo"];
const PAGE_SIZE = 20;

export default function Home() {
  const { user } = useAuth();
  const [devices, setDevices] = useState([]);
  const [total, setTotal] = useState(0);
  const [category, setCategory] = useState("");
  const [expandedCat, setExpandedCat] = useState("");
  const [brand, setBrand] = useState("");
  const [sort, setSort] = useState("score");
  const [page, setPage] = useState(1);
  const [favorites, setFavorites] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState(null);

  const fetchFavs = useCallback(async () => {
    if (!user) return;
    try {
      const r = await getFavorites();
      setFavorites(new Set(r.data.map(d => d.id)));
    } catch (e) {
      console.error("Failed to load favorites:", e);
    }
  }, [user]);

  // Debounced search within DB
  useEffect(() => {
    if (!searchQ.trim()) { setSearchResults(null); return; }
    setSearching(true);
    const t = setTimeout(() => {
      searchDevices(searchQ.trim())
        .then(r => setSearchResults(r.data))
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 400);
    return () => clearTimeout(t);
  }, [searchQ]);

  useEffect(() => {
    if (searchResults !== null) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    listDevices({ category: category || undefined, brand: brand || undefined, sort, page })
      .then(r => { if (!cancelled) { setDevices(r.data.items); setTotal(r.data.total); } })
      .catch(() => { if (!cancelled) setError("Không thể tải danh sách thiết bị."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [category, brand, sort, page, searchResults]);

  useEffect(() => { fetchFavs(); }, [fetchFavs]);

  const handleCategoryClick = (v) => {
    const next = expandedCat === v && v !== "" ? "" : v;
    setExpandedCat(next);
    setCategory(next);
    setBrand("");
    setPage(1);
    clearSearch();
  };

  const clearSearch = () => {
    setSearchQ("");
    setSearchInput("");
    setSearchResults(null);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearchQ(searchInput);
  };

  const displayDevices = searchResults !== null ? searchResults : devices;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex gap-6">
        {/* Sidebar */}
        <aside className="w-48 shrink-0">
          <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Danh mục</h3>

          <button onClick={() => handleCategoryClick("")}
            className={`block w-full text-left text-sm px-3 py-1.5 rounded-lg mb-0.5 transition-colors ${
              category === "" && expandedCat === "" ? "bg-orange-50 text-orange-600 font-medium" : "text-gray-600 hover:bg-gray-100"
            }`}>
            Tất cả
          </button>

          {/* Điện thoại — collapsible */}
          <div>
            <button onClick={() => handleCategoryClick("phone")}
              className={`flex items-center justify-between w-full text-left text-sm px-3 py-1.5 rounded-lg mb-0.5 transition-colors ${
                category === "phone" ? "bg-orange-50 text-orange-600 font-medium" : "text-gray-600 hover:bg-gray-100"
              }`}>
              <span>📱 Điện thoại</span>
              <span className="text-xs text-gray-400">{expandedCat === "phone" ? "▾" : "▸"}</span>
            </button>
            {expandedCat === "phone" && (
              <div className="ml-3 mb-1 border-l-2 border-orange-100 pl-2">
                {PHONE_BRANDS.map(b => (
                  <button key={b} onClick={() => { setBrand(brand === b ? "" : b); setPage(1); }}
                    className={`block w-full text-left text-xs px-2 py-1 rounded-lg mb-0.5 transition-colors ${
                      brand === b ? "text-orange-600 bg-orange-50 font-medium" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                    }`}>
                    {b}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Laptop — collapsible */}
          <div>
            <button onClick={() => handleCategoryClick("laptop")}
              className={`flex items-center justify-between w-full text-left text-sm px-3 py-1.5 rounded-lg mb-0.5 transition-colors ${
                category === "laptop" ? "bg-orange-50 text-orange-600 font-medium" : "text-gray-600 hover:bg-gray-100"
              }`}>
              <span>💻 Laptop</span>
              <span className="text-xs text-gray-400">{expandedCat === "laptop" ? "▾" : "▸"}</span>
            </button>
            {expandedCat === "laptop" && (
              <div className="ml-3 mb-1 border-l-2 border-orange-100 pl-2">
                {LAPTOP_BRANDS.map(b => (
                  <button key={b} onClick={() => { setBrand(brand === b ? "" : b); setPage(1); }}
                    className={`block w-full text-left text-xs px-2 py-1 rounded-lg mb-0.5 transition-colors ${
                      brand === b ? "text-orange-600 bg-orange-50 font-medium" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                    }`}>
                    {b}
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1">
          {/* Search bar */}
          <form onSubmit={handleSearchSubmit} className="flex gap-2 mb-5">
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Tìm trong kho (iphone, samsung...)"
              className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 shadow-sm transition-all"
            />
            <button type="submit" className="bg-orange-500 text-white px-4 py-2 rounded-xl text-sm hover:bg-orange-600 shadow-sm transition-colors">🔍</button>
            {searchResults !== null && (
              <button type="button" onClick={clearSearch} className="px-3 py-2 bg-gray-100 rounded-xl text-sm text-gray-600 hover:bg-gray-200 transition-colors">✕</button>
            )}
          </form>

          <div className="flex items-center justify-between mb-4">
            <h1 className="text-base font-bold text-gray-900">
              {searchResults !== null
                ? <>Kết quả: <span className="text-gray-400 font-normal text-sm">"{searchQ}" ({searchResults.length} thiết bị)</span></>
                : <>Kho thiết bị{!loading && <span className="text-gray-400 font-normal text-sm"> ({total} thiết bị)</span>}</>
              }
            </h1>
            {searchResults === null && (
              <select value={sort} onChange={e => setSort(e.target.value)}
                className="bg-white border border-gray-200 text-sm rounded-lg px-3 py-1.5 text-gray-600 shadow-sm">
                <option value="score">Điểm cao nhất</option>
                <option value="newest">Mới nhất</option>
              </select>
            )}
          </div>

          {searching ? (
            <div className="text-center py-20 text-gray-400">Đang tìm kiếm...</div>
          ) : loading && searchResults === null ? (
            <div className="text-center py-20 text-gray-400">Đang tải...</div>
          ) : error ? (
            <div className="text-center py-20 text-red-500">{error}</div>
          ) : displayDevices.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              {searchResults !== null ? "Không tìm thấy thiết bị nào" : "Chưa có thiết bị nào trong kho"}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {displayDevices.map(d => (
                <DeviceCard key={d.id} device={d} isFavorited={favorites.has(d.id)} onFavoriteChange={fetchFavs} />
              ))}
            </div>
          )}

          {searchResults === null && total > PAGE_SIZE && (
            <div className="flex gap-2 justify-center mt-6">
              {page > 1 && <button onClick={() => setPage(p => p - 1)} className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 shadow-sm">← Trước</button>}
              <span className="px-4 py-2 text-sm text-gray-400">Trang {page}</span>
              {page * PAGE_SIZE < total && <button onClick={() => setPage(p => p + 1)} className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 shadow-sm">Tiếp →</button>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
