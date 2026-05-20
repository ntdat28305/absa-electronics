import os
import time
import threading
import requests
from dotenv import load_dotenv

load_dotenv()

MAIN_API_URL = os.getenv("MAIN_API_URL", "")
WORKER_API_KEY = os.getenv("WORKER_API_KEY", "worker-secret")
NGROK_TOKEN = os.getenv("NGROK_TOKEN", "")
PORT = int(os.getenv("PORT", "8001"))


def register_worker(public_url: str):
    if not MAIN_API_URL:
        print("[register] MAIN_API_URL not set, skipping")
        return
    time.sleep(4)
    try:
        r = requests.post(
            f"{MAIN_API_URL}/worker/register",
            json={"url": public_url},
            headers={"X-Worker-Key": WORKER_API_KEY},
            timeout=10,
        )
        print(f"[register] {r.status_code} — registered at {public_url}")
    except Exception as e:
        print(f"[register] failed: {e}")


def main():
    from pyngrok import ngrok, conf

    if NGROK_TOKEN:
        conf.get_default().auth_token = NGROK_TOKEN

    tunnel = ngrok.connect(PORT, "http")
    public_url = tunnel.public_url
    print(f"\n{'='*55}")
    print(f"  Worker URL: {public_url}")
    print(f"  Health:     {public_url}/health")
    print(f"{'='*55}\n")

    threading.Thread(target=register_worker, args=(public_url,), daemon=True).start()

    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=PORT, reload=False)


if __name__ == "__main__":
    main()
