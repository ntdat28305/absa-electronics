import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getHistory } from "../api/history";
import { useAuth } from "../context/AuthContext";

const TYPE_ICON = { search: "🔍", link: "🔗", preset: "🗄" };

export default function History() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setError("");
    getHistory(page)
      .then(r => { setItems(r.data.items); setTotal(r.data.total); })
      .catch(() => setError("Không thể tải lịch sử. Vui lòng thử lại."))
      .finally(() => setLoading(false));
  }, [user, page]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold mb-6">Lịch sử phân tích ({total})</h1>
      {loading ? (
        <p className="text-gray-500 text-center py-12">Đang tải...</p>
      ) : error ? (
        <p className="text-red-400 text-center py-12">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-gray-500 text-center py-12">Chưa có lịch sử</p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map(h => (
            <Link
              key={h.id}
              to={h.device_id ? `/devices/${h.device_id}` : "#"}
              className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-4 hover:border-orange-500/50 transition-colors"
            >
              <span className="text-2xl">{TYPE_ICON[h.query_type] || "📋"}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{h.input_query}</p>
                <p className="text-xs text-gray-500 mt-0.5">{new Date(h.created_at).toLocaleString("vi-VN")}</p>
              </div>
              <span className="text-xs text-gray-500 capitalize shrink-0">{h.query_type}</span>
            </Link>
          ))}
        </div>
      )}
      {total > 20 && (
        <div className="flex gap-2 justify-center mt-6">
          {page > 1 && <button onClick={() => setPage(p => p - 1)} className="px-3 py-1 bg-gray-800 rounded text-sm">← Trước</button>}
          <span className="px-3 py-1 text-sm text-gray-400">Trang {page}</span>
          {page * 20 < total && <button onClick={() => setPage(p => p + 1)} className="px-3 py-1 bg-gray-800 rounded text-sm">Tiếp →</button>}
        </div>
      )}
    </div>
  );
}
