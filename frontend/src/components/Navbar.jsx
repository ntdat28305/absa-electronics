import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center gap-6">
      <Link to="/" className="font-bold text-orange-500 text-lg">⚡ DevSense</Link>
      <div className="flex gap-4 flex-1">
        <Link to="/" className="text-sm text-gray-400 hover:text-white">🗄 Kho DB</Link>
        <Link to="/search" className="text-sm text-gray-400 hover:text-white">🔍 Tìm kiếm</Link>
        <Link to="/analyze" className="text-sm text-gray-400 hover:text-white">🔗 Phân tích link</Link>
        {user && <Link to="/history" className="text-sm text-gray-400 hover:text-white">🕐 Lịch sử</Link>}
        {user && <Link to="/favorites" className="text-sm text-gray-400 hover:text-white">♡ Ưu thích</Link>}
      </div>
      {user ? (
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-300">{user.display_name}</span>
          <button onClick={() => { logout(); navigate("/"); }} className="text-sm text-gray-500 hover:text-red-400">Đăng xuất</button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Link to="/login" className="text-sm text-gray-400 hover:text-white">Đăng nhập</Link>
          <Link to="/register" className="text-sm bg-orange-500 text-white px-3 py-1 rounded hover:bg-orange-600">Đăng ký</Link>
        </div>
      )}
    </nav>
  );
}
