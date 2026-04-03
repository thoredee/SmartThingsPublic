"""
Generates authentic-sounding, average-to-positive reviews (~100 words)
using the Google Gemini API, informed by common themes in existing reviews.
"""

import re
import os
import time
import requests

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

# Progress callback — set by app.py so we can push live updates to the UI
_progress_callback = None

def set_progress_callback(fn):
    global _progress_callback
    _progress_callback = fn

def _emit(msg: str):
    print(f"  {msg}")
    if _progress_callback:
        _progress_callback(msg)


def _call_gemini(prompt: str, retries: int = 4) -> str:
    """Call Gemini with automatic retry on rate-limit (429) errors."""
    delay = 15  # seconds to wait on first 429
    for attempt in range(retries):
        resp = requests.post(
            GEMINI_URL,
            params={"key": GEMINI_API_KEY},
            json={"contents": [{"parts": [{"text": prompt}]}]},
            timeout=30,
        )
        if resp.status_code == 429:
            wait = delay * (2 ** attempt)
            _emit(f"  Rate limit hit — waiting {wait}s before retrying...")
            time.sleep(wait)
            continue
        resp.raise_for_status()
        return resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
    resp.raise_for_status()  # raise after all retries exhausted


def generate_review(product: dict) -> dict:
    """Generate a review in a single API call by combining theme extraction and writing."""
    existing = product.get("existing_reviews", [])
    reviews_block = (
        "\n---\n".join(existing[:6]) if existing
        else "No existing reviews available for this product."
    )

    prompt = f"""You are helping write a genuine customer review for a Space NK product.

Product name: {product['product_name']}

Here are some existing customer reviews for this product (to help you pick up real observations):
{reviews_block}

Based on the above, write a single customer review that:
- Is approximately 100 words (90-115 words)
- Sounds like an everyday British woman writing naturally and honestly
- Tone is average to positive - honest but not gushing, no superlatives like "amazing" or "life-changing"
- Mentions 2-3 specific observations (texture, scent, how it feels, packaging, results, etc.)
- Does NOT mention being gifted, incentivised, or that you haven't used the product
- Does NOT start with the word "I"
- Is written in first person throughout

Also provide a short review title (5-8 words).

Respond in this exact format and nothing else:
TITLE: <title here>
REVIEW: <review text here>"""

    text = _call_gemini(prompt)
    title_match = re.search(r"TITLE:\s*(.+)", text)
    review_match = re.search(r"REVIEW:\s*([\s\S]+)", text)

    product["review_title"] = title_match.group(1).strip() if title_match else product["product_name"][:50]
    product["review_text"] = review_match.group(1).strip() if review_match else text
    product["star_rating"] = 4

    return product


def generate_all_reviews(products: list[dict]) -> list[dict]:
    results = []
    for i, product in enumerate(products, 1):
        name = product['product_name'][:45]
        _emit(f"({i}/{len(products)}) Writing review: {name}...")
        try:
            results.append(generate_review(product))
            _emit(f"({i}/{len(products)}) Done!")
            # Small pause between products to stay well under rate limits
            if i < len(products):
                time.sleep(4)
        except Exception as e:
            _emit(f"({i}/{len(products)}) Skipped — {str(e)[:70]}")
    return results
