import os
import re
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from typing import Optional

from crawler import search_shopee, search_tiki, crawl_product, get_tiki_product
from inferencer import analyze_reviews
from scoring import compute_aspect_scores, compute_overall_score

WORKER_API_KEY = os.getenv("WORKER_API_KEY", "worker-secret")

LAPTOP_KEYWORDS = {"laptop", "macbook", "thinkpad", "zenbook", "vivobook", "ideapad", "dell", "hp pavilion"}

app = FastAPI(title="DevSense Worker")


def check_key(x_worker_key: str = Header(...)):
    if x_worker_key != WORKER_API_KEY:
        raise HTTPException(status_code=403, detail="Invalid key")


def infer_category(name: str) -> str:
    name_lower = name.lower()
    if any(kw in name_lower for kw in LAPTOP_KEYWORDS):
        return "laptop"
    return "phone"


def infer_brand(name: str) -> str:
    known_brands = ["Apple", "Samsung", "ASUS", "Dell", "Xiaomi", "Oppo", "Vivo", "Huawei",
                    "Sony", "LG", "Nokia", "Realme", "OnePlus", "Lenovo", "Acer", "HP", "MSI"]
    name_lower = name.lower()
    for brand in known_brands:
        if brand.lower() in name_lower:
            return brand
    return name.split()[0] if name else "Unknown"


class SearchRequest(BaseModel):
    query: str
    num_links: int = 3
    reviews_per_link: int = 50
    platform: str = "shopee"


class LinkRequest(BaseModel):
    url: str
    count: int = 50


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/crawl/search")
def crawl_search(data: SearchRequest, x_worker_key: str = Header(...)):
    check_key(x_worker_key)
    products = []
    if data.platform in ("shopee", "both"):
        products += search_shopee(data.query, data.num_links, data.reviews_per_link)
    if data.platform in ("tiki", "both"):
        products += search_tiki(data.query, data.num_links, data.reviews_per_link)

    devices = []
    for p in products[: data.num_links]:
        texts = crawl_product(p, data.reviews_per_link)
        if not texts:
            print(f"[skip] no reviews for {p.get('name', '')}")
            continue
        aspects_list = analyze_reviews(texts)
        aspect_scores = compute_aspect_scores(aspects_list)
        overall_score = compute_overall_score(aspect_scores, len(texts))
        devices.append(
            {
                "name": p["name"],
                "category": infer_category(p["name"]),
                "brand": infer_brand(p["name"]),
                "image_url": p.get("image_url"),
                "platform": p["platform"],
                "product_url": p["product_url"],
                "price": p.get("price"),
                "aspect_scores": aspect_scores,
                "overall_score": overall_score,
                "reviews": [{"text": t, "aspects": a} for t, a in zip(texts, aspects_list)],
            }
        )
    return {"devices": devices}


@app.post("/crawl/link")
def crawl_link(data: LinkRequest, x_worker_key: str = Header(...)):
    check_key(x_worker_key)
    platform = "shopee" if "shopee.vn" in data.url else "tiki"
    # strip query params before parsing
    clean_url = data.url.split("?")[0].rstrip("/")
    parts = clean_url.split("/")

    if platform == "shopee":
        # Shopee URL formats:
        # /product/{shop_id}/{item_id}  (old)
        # /product-name-i.{shop_id}.{item_id}  (new slug format)
        shop_id, item_id = 0, 0
        last = parts[-1]
        if "." in last:
            seg = last.split(".")
            try:
                item_id = int(seg[-1])
                shop_id = int(seg[-2])
            except (ValueError, IndexError):
                pass
        elif last.isdigit() and len(parts) > 1 and parts[-2].isdigit():
            item_id = int(last)
            shop_id = int(parts[-2])
        p = {"platform": "shopee", "shop_id": shop_id, "item_id": item_id}
        name = f"Sản phẩm Shopee #{item_id}"
    else:
        # Tiki formats:
        # /slug-name-p{id}.html  (common)
        # /p{id}.html            (short)
        product_id = 0
        for part in reversed(parts):
            m = re.search(r"-p(\d+)\.html$", part) or re.match(r"^p(\d+)\.html$", part)
            if m:
                product_id = int(m.group(1))
                break
        meta = get_tiki_product(product_id)
        p = {"platform": "tiki", "product_id": product_id, "seller_id": meta["seller_id"]}
        name = meta["name"]

    texts = crawl_product(p, data.count)
    aspects_list = analyze_reviews(texts)
    aspect_scores = compute_aspect_scores(aspects_list)
    overall_score = compute_overall_score(aspect_scores, len(texts))
    image_url = meta.get("image_url", "") if platform == "tiki" else ""
    price = meta.get("price", "") if platform == "tiki" else ""
    return {
        "devices": [
            {
                "name": name,
                "category": infer_category(name),
                "brand": infer_brand(name),
                "image_url": image_url,
                "price": price,
                "platform": platform,
                "product_url": data.url.split("?")[0],
                "aspect_scores": aspect_scores,
                "overall_score": overall_score,
                "reviews": [{"text": t, "aspects": a} for t, a in zip(texts, aspects_list)],
            }
        ]
    }
