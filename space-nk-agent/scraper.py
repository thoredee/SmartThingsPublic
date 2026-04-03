"""
Scrapes Space NK for products and their existing customer reviews.
Uses multiple strategies: sitemap (most reliable), then category pages via Playwright.
"""

import re
import time
import random
import requests
from playwright.sync_api import sync_playwright, Page

SPACE_NK_BASE = "https://www.spacenk.com"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-GB,en;q=0.9",
}

CATEGORY_URLS = [
    f"{SPACE_NK_BASE}/uk/skincare/",
    f"{SPACE_NK_BASE}/uk/makeup/",
    f"{SPACE_NK_BASE}/uk/fragrance/",
    f"{SPACE_NK_BASE}/uk/haircare/",
    f"{SPACE_NK_BASE}/uk/bodycare/",
]

SEARCH_TERMS = [
    "moisturiser", "serum", "foundation", "lipstick",
    "cleanser", "toner", "eye cream", "body lotion",
    "perfume", "shampoo", "conditioner", "face oil",
]


def _random_delay(min_s=1.0, max_s=2.5):
    time.sleep(random.uniform(min_s, max_s))


def _parse_product_urls(html: str, exclude_ids: set, limit: int) -> list[dict]:
    """Extract product links from any HTML/XML string."""
    results = []
    seen = set()
    # Space NK product URLs: /uk/.../product-name-MUK200021895.html or -200021895.html
    pattern = re.compile(r'(?:href="|loc>)(https?://(?:www\.)?spacenk\.com)?(/uk/[a-z0-9][a-z0-9\-\/]+-(?:MUK)?(\d{6,})\.html)', re.IGNORECASE)
    for m in pattern.finditer(html):
        path = m.group(2)
        pid  = m.group(3)
        if pid in seen or pid in exclude_ids:
            continue
        seen.add(pid)
        slug = path.split("/")[-1]
        slug = re.sub(r'-(MUK)?\d+\.html$', '', slug, flags=re.IGNORECASE)
        name = slug.replace("-", " ").title()
        results.append({
            "product_id": pid,
            "product_name": name,
            "url": SPACE_NK_BASE + path,
        })
        if len(results) >= limit:
            break
    return results


# ── Strategy 1: XML sitemap (no JS needed, most reliable) ──────────────────

def _try_sitemap(exclude_ids: set, limit: int, log: list) -> list[dict]:
    sitemap_urls = [
        f"{SPACE_NK_BASE}/sitemap_index.xml",
        f"{SPACE_NK_BASE}/sitemap.xml",
        f"{SPACE_NK_BASE}/uk/sitemap.xml",
    ]
    for url in sitemap_urls:
        try:
            log.append(f"Trying sitemap: {url}")
            r = requests.get(url, headers=HEADERS, timeout=15)
            if r.status_code != 200:
                log.append(f"  → HTTP {r.status_code}")
                continue
            content = r.text

            # If it's a sitemap index, find product sub-sitemaps
            sub_sitemaps = re.findall(r'<loc>(https?://[^<]+sitemap[^<]*\.xml[^<]*)</loc>', content)
            if sub_sitemaps:
                log.append(f"  → Found {len(sub_sitemaps)} sub-sitemaps")
                products = []
                for sub in random.sample(sub_sitemaps, min(5, len(sub_sitemaps))):
                    try:
                        sr = requests.get(sub, headers=HEADERS, timeout=15)
                        if sr.status_code == 200:
                            found = _parse_product_urls(sr.text, exclude_ids, limit - len(products))
                            products.extend(found)
                            log.append(f"  → Sub-sitemap {sub.split('/')[-1]}: {len(found)} products")
                    except Exception as e:
                        log.append(f"  → Sub-sitemap error: {e}")
                    if len(products) >= limit:
                        break
                if products:
                    return products
            else:
                # Direct sitemap
                products = _parse_product_urls(content, exclude_ids, limit)
                log.append(f"  → Direct sitemap: {len(products)} products found")
                if products:
                    return products
        except Exception as e:
            log.append(f"  → Error: {e}")
    return []


# ── Strategy 2: Search pages via requests (lightweight) ────────────────────

def _try_search(exclude_ids: set, limit: int, log: list) -> list[dict]:
    products = []
    terms = random.sample(SEARCH_TERMS, min(5, len(SEARCH_TERMS)))
    for term in terms:
        if len(products) >= limit:
            break
        try:
            url = f"{SPACE_NK_BASE}/uk/search?q={term.replace(' ', '+')}"
            log.append(f"Trying search: {url}")
            r = requests.get(url, headers=HEADERS, timeout=15)
            if r.status_code == 200:
                found = _parse_product_urls(r.text, exclude_ids, limit - len(products))
                log.append(f"  → {len(found)} products found")
                products.extend(found)
                for p in found:
                    exclude_ids.add(p["product_id"])
            else:
                log.append(f"  → HTTP {r.status_code}")
        except Exception as e:
            log.append(f"  → Error: {e}")
    return products


# ── Strategy 3: Playwright category pages (handles JS) ─────────────────────

def _try_playwright(exclude_ids: set, needed: int, log: list) -> list[dict]:
    products = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(user_agent=HEADERS["User-Agent"])
            page = context.new_page()

            cats = CATEGORY_URLS[:]
            random.shuffle(cats)
            for cat_url in cats:
                if len(products) >= needed:
                    break
                try:
                    log.append(f"Playwright loading: {cat_url}")
                    page.goto(cat_url, wait_until="networkidle", timeout=40000)
                    # Scroll to trigger lazy loading
                    page.evaluate("window.scrollTo(0, document.body.scrollHeight / 2)")
                    time.sleep(2)
                    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                    time.sleep(2)

                    html = page.content()
                    found = _parse_product_urls(html, exclude_ids, needed - len(products))
                    log.append(f"  → {len(found)} products found")
                    products.extend(found)
                    for pr in found:
                        exclude_ids.add(pr["product_id"])
                except Exception as e:
                    log.append(f"  → Error: {e}")

            browser.close()
    except Exception as e:
        log.append(f"Playwright failed: {e}")
    return products


# ── Review extraction ───────────────────────────────────────────────────────

def _extract_reviews(product_url: str, log: list) -> list[str]:
    try:
        r = requests.get(product_url, headers=HEADERS, timeout=15)
        if r.status_code != 200:
            return []
        html = r.text
        reviews = []
        patterns = [
            r'"ReviewText"\s*:\s*"((?:[^"\\]|\\.){30,500})"',
            r'"reviewText"\s*:\s*"((?:[^"\\]|\\.){30,500})"',
            r'"reviewBody"\s*:\s*"((?:[^"\\]|\\.){30,500})"',
        ]
        for pat in patterns:
            for m in re.finditer(pat, html):
                text = m.group(1).replace("\\n", " ").replace('\\"', '"').strip()
                if len(text) > 30:
                    reviews.append(text)
            if reviews:
                break
        return reviews[:8]
    except Exception:
        return []


# ── Public API ──────────────────────────────────────────────────────────────

def fetch_candidate_products(exclude_ids: set, needed: int) -> tuple[list[dict], list[str]]:
    """
    Returns (products, log) where log is a list of diagnostic messages.
    products: list of {product_id, product_name, url, existing_reviews}
    """
    log = []
    exclude_copy = set(exclude_ids)  # don't mutate caller's set during search

    # Strategy 1: Sitemap
    log.append("=== Strategy 1: Sitemap ===")
    products = _try_sitemap(exclude_copy, needed * 3, log)

    # Strategy 2: Search pages
    if len(products) < needed:
        log.append("=== Strategy 2: Search pages ===")
        products += _try_search(exclude_copy, needed * 3 - len(products), log)

    # Strategy 3: Playwright
    if len(products) < needed:
        log.append("=== Strategy 3: Playwright category pages ===")
        products += _try_playwright(exclude_copy, needed * 3 - len(products), log)

    if not products:
        log.append("All strategies failed — no products found.")
        return [], log

    # Shuffle and limit
    random.shuffle(products)
    products = products[:needed]

    # Fetch existing reviews for each
    log.append(f"=== Fetching reviews for {len(products)} products ===")
    for product in products:
        product["existing_reviews"] = _extract_reviews(product["url"], log)
        time.sleep(0.5)

    return products, log


def login_to_spacenk(page: Page, email: str, password: str) -> bool:
    """Log in to the Space NK account. Returns True on success."""
    page.goto(f"{SPACE_NK_BASE}/uk/account/login", wait_until="domcontentloaded", timeout=30000)
    _random_delay()
    try:
        page.fill("input[name='email'], input[type='email']", email, timeout=5000)
        page.fill("input[name='password'], input[type='password']", password, timeout=5000)
        page.click("button[type='submit']", timeout=5000)
        page.wait_for_url(re.compile(r"account|dashboard|my-account"), timeout=10000)
        return True
    except Exception as e:
        print(f"[login] Failed: {e}")
        return False


def submit_review(page: Page, product: dict) -> bool:
    """Navigate to product page and submit the review. Returns True on success."""
    page.goto(product["url"], wait_until="domcontentloaded", timeout=30000)
    _random_delay(1.5, 3.0)
    try:
        for sel in ["button:has-text('Write a Review')", "a:has-text('Write a Review')", "[class*='write-review']"]:
            btn = page.query_selector(sel)
            if btn:
                btn.click()
                break
        _random_delay()

        stars = random.choice([4, 5])
        for sel in [f"[aria-label='{stars} star']", f"[data-rating='{stars}']", f"label[for*='rating-{stars}']"]:
            el = page.query_selector(sel)
            if el:
                el.click()
                break
        _random_delay()

        for sel in ["input[name*='title']", "input[placeholder*='itle']", "#reviewTitle"]:
            el = page.query_selector(sel)
            if el:
                el.fill(product["review_title"])
                break

        for sel in ["textarea[name*='review']", "textarea[name*='text']", "textarea[placeholder*='review']", "#reviewText", ".bv-form-control textarea"]:
            el = page.query_selector(sel)
            if el:
                el.fill(product["review_text"])
                break
        _random_delay()

        for sel in ["button[type='submit']:has-text('Submit')", "button:has-text('Submit Review')", "input[type='submit']"]:
            el = page.query_selector(sel)
            if el:
                el.click()
                break

        _random_delay(2.0, 4.0)
        return True
    except Exception as e:
        print(f"[submit] Failed for {product['product_name']}: {e}")
        return False
