import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register } from "../api/auth";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const navigate = useNavigate();
  const { loginUser } = useAuth();
  const [form, setForm] = useState({ email: "", password: "", display_name: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const r = await register(form);
      loginUser(r.data.access_token, r.data.user);
      navigate("/");
    } catch (e) {
      setError(e.response?.data?.detail || "Đăng ký thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl p-8">
        <h1 className="text-xl font-bold text-center mb-6">Đăng ký</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            placeholder="Tên hiển thị" value={form.display_name}
            onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2.5 text-sm outline-none focus:border-orange-500"
            required
          />
          <input
            type="email" placeholder="Email" value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2.5 text-sm outline-none focus:border-orange-500"
            required
          />
          <input
            type="password" placeholder="Mật khẩu" value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2.5 text-sm outline-none focus:border-orange-500"
            required
          />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button
            type="submit" disabled={loading}
            className="bg-orange-500 text-white py-2.5 rounded text-sm font-semibold hover:bg-orange-600 disabled:opacity-50"
          >
            {loading ? "Đang đăng ký..." : "Đăng ký"}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-4">
          Đã có tài khoản? <Link to="/login" className="text-orange-400 hover:underline">Đăng nhập</Link>
        </p>
      </div>
    </div>
  );
}
