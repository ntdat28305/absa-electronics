import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../api/auth";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { loginUser } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const r = await login(form);
      loginUser(r.data.access_token, r.data.user);
      navigate("/");
    } catch (e) {
      setError(e.response?.data?.detail || "Đăng nhập thất bại");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-3xl font-extrabold text-blue-500">⚡ DevSense</span>
          <p className="text-gray-500 text-sm mt-1">Đăng nhập để lưu ưu thích & lịch sử</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          <h1 className="text-xl font-bold text-gray-900 mb-6">Đăng nhập</h1>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="email" placeholder="Email" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
              required
            />
            <input
              type="password" placeholder="Mật khẩu" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
              required
            />
            {error && <p className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <button type="submit" disabled={loading}
              className="bg-blue-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 shadow-sm transition-colors mt-1">
              {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>
          </form>
          <p className="text-center text-sm text-gray-400 mt-5">
            Chưa có tài khoản?{" "}
            <Link to="/register" className="text-blue-500 hover:underline font-medium">Đăng ký</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
