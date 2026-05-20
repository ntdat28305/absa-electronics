import os
import random
import requests
import time


def _extract_csrftoken(cookie: str) -> str:
    for part in cookie.split(";"):
        k, _, v = part.strip().partition("=")
        if k.strip() == "csrftoken":
            return v.strip()
    return ""

def get_headers(referer: str) -> dict:
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Referer": referer,
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "X-API-SOURCE": "pc",
        "X-Shopee-Language": "vi",
        "X-Requested-With": "XMLHttpRequest",
    }
    shopee_cookie = os.getenv("SHOPEE_COOKIE", "")
    if shopee_cookie:
        headers["Cookie"] = shopee_cookie
        csrf = _extract_csrftoken(shopee_cookie)
        if csrf:
            headers["X-CSRFToken"] = csrf
    return headers


def _get_shopee_proxy() -> dict | None:
    raw = os.getenv("SHOPEE_PROXY_LIST", "")
    if not raw:
        return None
    proxies = [p.strip() for p in raw.split(",") if p.strip()]
    if not proxies:
        return None
    chosen = random.choice(proxies)
    return {"http": chosen, "https": chosen}


# ─── Shopee Search API ─────────────────────────────────────────────────────────

def search_shopee(query: str, num_links: int, min_reviews: int = 10) -> list[dict]:
    url = "https://shopee.vn/api/v4/search/search_items"
    params = {
        "by": "relevancy",
        "keyword": query,
        "limit": num_links * 3,
        "order": "desc",
        "page_type": "search",
    }
    try:
        r = requests.get(
            url, params=params, headers=get_headers("https://shopee.vn/"),
            proxies=_get_shopee_proxy(), timeout=15,
        )
        r.raise_for_status()
        items = r.json().get("items", [])
    except Exception as e:
        print(f"[Shopee search error] {e}")
        return []

    results = []
    for item in items:
        d = item.get("item_basic", {})
        shop_id = d.get("shopid")
        item_id = d.get("itemid")
        if not shop_id or not item_id:
            continue
        if min_reviews > 0 and d.get("cmt_count", 0) < min_reviews:
            continue
        price_raw = d.get("price", 0)
        price = f"{int(price_raw / 100000) / 10:.1f}M đ" if price_raw else ""
        results.append({
            "name": d.get("name", ""),
            "image_url": f"https://cf.shopee.vn/file/{d.get('image', '')}",
            "price": price,
            "product_url": f"https://shopee.vn/product/{shop_id}/{item_id}",
            "platform": "shopee",
            "shop_id": shop_id,
            "item_id": item_id,
        })
        if len(results) >= num_links:
            break
    return results


# ─── Shopee Product Detail ────────────────────────────────────────────────────

def get_shopee_product(shop_id: int, item_id: int) -> dict:
    try:
        r = requests.get(
            f"https://shopee.vn/api/v4/item/get?itemid={item_id}&shopid={shop_id}",
            headers=get_headers(f"https://shopee.vn/product/{shop_id}/{item_id}"),
            timeout=10,
        )
        r.raise_for_status()
        d = r.json().get("data", {}) or {}
        name = d.get("name", f"Sản phẩm Shopee #{item_id}")
        image = d.get("image", "")
        image_url = f"https://cf.shopee.vn/file/{image}" if image else ""
        price_raw = d.get("price", 0) or d.get("price_min", 0)
        price = f"{int(price_raw / 100000) / 10:.1f}M đ" if price_raw else ""
        return {"name": name, "image_url": image_url, "price": price}
    except Exception as e:
        print(f"[Shopee product detail error] {e}")
        return {"name": f"Sản phẩm Shopee #{item_id}", "image_url": "", "price": ""}


# ─── Tiki Product Detail ──────────────────────────────────────────────────────

def get_tiki_product(product_id: int) -> dict:
    try:
        r = requests.get(
            f"https://tiki.vn/api/v2/products/{product_id}",
            headers=get_headers("https://tiki.vn/"),
            timeout=10,
        )
        r.raise_for_status()
        d = r.json()
        seller_id = d.get("current_seller", {}).get("id") or d.get("seller_id", 1)
        return {
            "name": d.get("name", f"Sản phẩm Tiki #{product_id}"),
            "image_url": d.get("thumbnail_url", ""),
            "price": f"{d.get('price', 0):,}đ",
            "product_id": product_id,
            "seller_id": seller_id,
        }
    except Exception as e:
        print(f"[Tiki product detail error] {e}")
        return {"name": f"Sản phẩm Tiki #{product_id}", "image_url": "", "price": "", "product_id": product_id, "seller_id": 1}


# ─── Tiki Search API ───────────────────────────────────────────────────────────

def search_tiki(query: str, num_links: int, min_reviews: int = 10) -> list[dict]:
    url = "https://tiki.vn/api/v2/products"
    params = {"q": query, "limit": num_links * 3, "sort": "top_seller"}
    try:
        r = requests.get(url, params=params, headers=get_headers("https://tiki.vn/"), timeout=15)
        r.raise_for_status()
        items = r.json().get("data", [])
    except Exception as e:
        print(f"[Tiki search error] {e}")
        return []

    results = []
    for item in items:
        product_id = item.get("id")
        seller_id = item.get("seller_id", 1)
        if not product_id:
            continue
        if min_reviews > 0 and item.get("review_count", 0) < min_reviews:
            continue
        results.append({
            "name": item.get("name", ""),
            "image_url": item.get("thumbnail_url", ""),
            "price": f"{item.get('price', 0):,}đ",
            "product_url": f"https://tiki.vn/{item.get('url_path', '')}",
            "platform": "tiki",
            "product_id": product_id,
            "seller_id": seller_id,
        })
        if len(results) >= num_links:
            break
    return results


# ─── Shopee Reviews (undetected_chromedriver) ─────────────────────────────────

def scrape_shopee_reviews(shop_id: int, item_id: int, count: int) -> list[str]:
    try:
        import undetected_chromedriver as uc
    except ImportError:
        print("[Shopee] undetected_chromedriver not installed. Run: pip install undetected-chromedriver")
        return []

    shopee_cookie = os.getenv("SHOPEE_COOKIE", "")
    reviews = []
    driver = None

    try:
        opts = uc.ChromeOptions()
        opts.add_argument("--no-sandbox")
        opts.add_argument("--window-size=1920,1080")
        opts.add_argument("--lang=vi-VN")
        opts.add_argument("--disable-blink-features=AutomationControlled")

        driver = uc.Chrome(options=opts, headless=True)
        driver.set_page_load_timeout(45)

        # Load shopee.vn first to set domain for cookies
        driver.get("https://shopee.vn")
        time.sleep(3)

        # Inject cookies
        if shopee_cookie:
            for part in shopee_cookie.split(";"):
                name, _, value = part.strip().partition("=")
                name = name.strip()
                if not name:
                    continue
                try:
                    driver.add_cookie({"name": name, "value": value.strip(),
                                       "domain": ".shopee.vn", "path": "/"})
                except Exception:
                    pass

        # Navigate to product page with cookies active
        driver.get(f"https://shopee.vn/product/{shop_id}/{item_id}")
        time.sleep(5)

        pg = 0
        while len(reviews) < count:
            offset = pg * 20
            try:
                result = driver.execute_async_script(f"""
                    const done = arguments[0];
                    fetch('/api/v2/item/get_ratings?itemid={item_id}&shopid={shop_id}&limit=20&offset={offset}&type=0', {{
                        credentials: 'include',
                        headers: {{'x-requested-with': 'XMLHttpRequest'}}
                    }})
                    .then(r => r.json())
                    .then(data => done(data))
                    .catch(() => done(null));
                """)
            except Exception as e:
                print(f"[Shopee uc eval page={pg}] {e}")
                break

            ratings = (result or {}).get("data", {}).get("ratings", [])
            if not ratings:
                print(f"[Shopee] no ratings at offset={offset}, stopping")
                break
            for rating in ratings:
                comment = (rating.get("comment") or "").strip()
                if comment:
                    reviews.append(comment)
            print(f"[Shopee] collected {len(reviews)} reviews so far (page {pg})")
            pg += 1
            time.sleep(random.uniform(1.0, 2.0))

    except Exception as e:
        print(f"[Shopee uc error] {e}")
    finally:
        if driver:
            try:
                driver.quit()
            except Exception:
                pass

    seen = set()
    unique = []
    for r in reviews:
        if r not in seen:
            seen.add(r)
            unique.append(r)
    return unique[:count]


# ─── Tiki Reviews ─────────────────────────────────────────────────────────────

def scrape_tiki_reviews(product_id: int, seller_id: int, count: int) -> list[str]:
    reviews = []
    page = 1
    while len(reviews) < count:
        url = f"https://tiki.vn/api/v2/reviews?product_id={product_id}&seller_id={seller_id}&page={page}&limit=20"
        try:
            r = requests.get(url, headers=get_headers("https://tiki.vn/"), timeout=10)
            r.raise_for_status()
            data = r.json().get("data", [])
            if not data:
                break
            for item in data:
                content = (item.get("content") or "").strip()
                if content:
                    reviews.append(content)
            page += 1
            time.sleep(0.5)
        except Exception as e:
            print(f"[Tiki reviews error page={page}] {e}")
            break
    seen = set()
    unique = []
    for r in reviews:
        if r not in seen:
            seen.add(r)
            unique.append(r)
    return unique[:count]


# ─── Unified crawl ────────────────────────────────────────────────────────────

def crawl_product(product_info: dict, count: int) -> list[str]:
    platform = product_info.get("platform")
    if platform == "shopee":
        return scrape_shopee_reviews(product_info["shop_id"], product_info["item_id"], count)
    if platform == "tiki":
        return scrape_tiki_reviews(product_info["product_id"], product_info["seller_id"], count)
    return []
