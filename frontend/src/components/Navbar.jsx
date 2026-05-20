import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV_LINKS = [
  { to: "/", label: "Kho DB", icon: "🗄" },
  { to: "/search", label: "Tìm kiếm", icon: "🔍" },
  { to: "/analyze", label: "Phân tích link", icon: "🔗" },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-0 flex items-center sticky top-0 z-50 shadow-sm">
      <Link to="/" className="font-extrabold text-orange-500 text-lg mr-8 py-4 flex items-center gap-1.5">
        <span className="text-xl">⚡</span> DevSense
      </Link>

      <div className="flex flex-1 gap-1">
        {NAV_LINKS.map(({ to, label, icon }) => (
          <Link key={to} to={to}
            className={`flex items-center gap-1.5 text-sm px-3 py-4 border-b-2 transition-colors ${
              isActive(to)
                ? "border-orange-500 text-orange-600 font-medium"
                : "border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300"
            }`}>
            <span>{icon}</span> {label}
          </Link>
        ))}
        {user && (
          <>
            <Link to="/history"
              className={`flex items-center gap-1.5 text-sm px-3 py-4 border-b-2 transition-colors ${
                isActive("/history") ? "border-orange-500 text-orange-600 font-medium" : "border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300"
              }`}>
              🕐 Lịch sử
            </Link>
            <Link to="/favorites"
              className={`flex items-center gap-1.5 text-sm px-3 py-4 border-b-2 transition-colors ${
                isActive("/favorites") ? "border-orange-500 text-orange-600 font-medium" : "border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300"
              }`}>
              ♡ Ưu thích
            </Link>
          </>
        )}
      </div>

      {user ? (
        <div className="flex items-center gap-3 py-4">
          <div className="w-7 h-7 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold">
            {user.display_name?.[0]?.toUpperCase()}
          </div>
          <span className="text-sm text-gray-700 font-medium">{user.display_name}</span>
          <button onClick={() => { logout(); navigate("/"); }}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors">
            Đăng xuất
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 py-4">
          <Link to="/login" className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            Đăng nhập
          </Link>
          <Link to="/register" className="text-sm bg-orange-500 text-white px-4 py-1.5 rounded-lg hover:bg-orange-600 transition-colors font-medium shadow-sm">
            Đăng ký
          </Link>
        </div>
      )}
    </nav>
  );
}
