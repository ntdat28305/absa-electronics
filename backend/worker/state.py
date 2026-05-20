_worker_url: str | None = None

def set_worker_url(url: str):
    global _worker_url
    _worker_url = url.rstrip("/")

def get_worker_url() -> str | None:
    return _worker_url
