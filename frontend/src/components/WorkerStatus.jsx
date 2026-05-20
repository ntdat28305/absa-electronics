import { useEffect, useState } from "react";
import client from "../api/client";

export default function WorkerStatus() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    client.get("/worker/health").then(r => setStatus(r.data)).catch(() => setStatus({ online: false }));
  }, []);

  if (!status) return null;
  return (
    <div className={`flex items-center gap-1.5 text-xs font-mono px-2 py-1 rounded ${status.online ? "text-green-400" : "text-red-400"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status.online ? "bg-green-400" : "bg-red-400"}`} />
      Worker {status.online ? "online" : "offline"}
    </div>
  );
}
