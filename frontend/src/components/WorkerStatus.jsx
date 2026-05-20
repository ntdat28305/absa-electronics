import { useEffect, useState } from "react";
import client from "../api/client";

export default function WorkerStatus() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    client.get("/worker/health").then(r => setStatus(r.data)).catch(() => setStatus({ online: false }));
  }, []);

  if (!status) return null;
  return (
    <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${
      status.online
        ? "text-emerald-700 bg-emerald-50 border-emerald-200"
        : "text-red-600 bg-red-50 border-red-200"
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status.online ? "bg-emerald-500" : "bg-red-500"}`} />
      Colab {status.online ? "Online" : "Offline"}
    </div>
  );
}
