"""
Scrapes Space NK for products and their existing customer reviews.
Uses Playwright in headless mode so it handles JS-rendered pages.
"""

import re
import time
import random
from playwright.sync_api import sync_playwright, Page

SPACE_NK_BASE = "https://www.spacenk.com"

# Categories to pick products from — broad enough to give variety
CATEGORY_URLS = [
    f"{SPACE_NK_BASE}/uk/skincare/",
    f"{SPACE_NK_BASE}/uk/makeup/",
    f"{SPACE_NK_BASE}/uk/fragrance/",
    f"{SPACE_NK_BASE}/uk/haircare/",
    f"{SPACE_NK_BASE}/uk/bodycare/",
]


def _random_delay(min_s=1.0, max_s=2.5):
    time.sleep(random.uniform(min_s, max_s))


def _extract_product_links(page: Page, category_url: str, limit: int = 40) -> list[dict]:
    """Return a list of {product_id, product_name, url} from a category page."""
    page.goto(category_url, wait_until="domcontentloaded", timeout=30000)
    _random_delay()
    page.wait_for_selector("a[href*='/uk/']", timeout=10000)

    links = []
    anchors = page.query_selector_all("a[href]")
    seen = set()
    for a in anchors:
        href = a.get_attribute("href") or ""
        # Space NK product URLs contain /uk/ and a product code pattern
        if re.search(r"/uk/[a-z-]+/[a-z0-9-]+-\d{6,}\.html", href):
            full_url = href if href.startswith("http") else SPACE_NK_BASE + href
            product_id = re.search(r"(\d{6,})", href)
            if product_id and product_id.group(1) not in seen:
                pid = product_id.group(1)
                seen.add(pid)
                name = a.inner_text().strip() or href.split("/")[-1].replace("-", " ").title()
                links.append({"product_id": pid, "product_name": name, "url": full_url})
            if len(links) >= limit:
                break
    return links


def _extract_reviews(page: Page, product_url: str) -> list[str]:
    """Return up to 15 review texts from a product page."""
    page.goto(product_url, wait_until="domcontentloaded", timeout=30000)
    _random_delay()

    reviews = []

    # Try common review container selectors used by Bazaarvoice (which Space NK uses)
    selectors = [
        "[class*='review-content']",
        "[class*='BVRRReviewText']",
        "[data-testid*='review']",
        ".bv-content-summary-body-text",
        ".bv-content-body",
    ]
    for sel in selectors:
        elements = page.query_selector_all(sel)
        for el in elements:
            text = el.inner_text().strip()
            if len(text) > 30:
                reviews.append(text)
        if reviews:
            break

    return reviews[:15]


def fetch_candidate_products(exclude_ids: set[str], needed: int) -> list[dict]:
    """
    Returns `needed` products that haven't been reviewed yet.
    Each item: {product_id, product_name, url, existing_reviews: [str]}
    """
    candidates = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            )
        )
        page = context.new_page()

        random.shuffle(CATEGORY_URLS)
        for cat_url in CATEGORY_URLS:
            if len(candidates) >= needed:
                break
            try:
                products = _extract_product_links(page, cat_url, limit=60)
                for product in products:
                    if product["product_id"] in exclude_ids:
                        continue
                    # Fetch existing reviews to inform generation
                    try:
                        existing = _extract_reviews(page, product["url"])
                    except Exception:
                        existing = []
                    product["existing_reviews"] = existing
                    candidates.append(product)
                    exclude_ids.add(product["product_id"])
                    if len(candidates) >= needed:
                        break
            except Exception as e:
                print(f"[scraper] Warning: failed to scrape {cat_url}: {e}")
                continue

        browser.close()
    return candidates


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
        # Click "Write a Review" button (Bazaarvoice standard)
        write_btn_selectors = [
            "button:has-text('Write a Review')",
            "a:has-text('Write a Review')",
            "[class*='write-review']",
            "[id*='write-review']",
        ]
        for sel in write_btn_selectors:
            btn = page.query_selector(sel)
            if btn:
                btn.click()
                break
        _random_delay()

        # Star rating — pick 4 or 5 stars (positive)
        stars = random.choice([4, 5])
        star_selectors = [
            f"[aria-label='{stars} star']",
            f"[data-rating='{stars}']",
            f".bv-rating-stars-on:nth-child({stars})",
            f"label[for*='rating-{stars}']",
        ]
        for sel in star_selectors:
            el = page.query_selector(sel)
            if el:
                el.click()
                break

        _random_delay()

        # Title field
        title_selectors = [
            "input[name*='title']",
            "input[placeholder*='itle']",
            "#reviewTitle",
        ]
        for sel in title_selectors:
            el = page.query_selector(sel)
            if el:
                el.fill(product["review_title"])
                break

        # Body field
        body_selectors = [
            "textarea[name*='review']",
            "textarea[name*='text']",
            "textarea[placeholder*='review']",
            "#reviewText",
            ".bv-form-control textarea",
        ]
        for sel in body_selectors:
            el = page.query_selector(sel)
            if el:
                el.fill(product["review_text"])
                break

        _random_delay()

        # Submit
        submit_selectors = [
            "button[type='submit']:has-text('Submit')",
            "button:has-text('Submit Review')",
            "input[type='submit']",
        ]
        for sel in submit_selectors:
            el = page.query_selector(sel)
            if el:
                el.click()
                break

        _random_delay(2.0, 4.0)
        return True

    except Exception as e:
        print(f"[submit] Failed for {product['product_name']}: {e}")
        return False
