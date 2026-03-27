"""
Generates authentic-sounding, average-to-positive reviews (~100 words)
using the Claude API, informed by common themes in existing reviews.
"""

import anthropic
import re

client = anthropic.Anthropic()


def _summarise_review_themes(existing_reviews: list[str]) -> str:
    if not existing_reviews:
        return "No existing reviews available."
    combined = "\n---\n".join(existing_reviews[:8])
    # Extract key themes via Claude in a quick call
    resp = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=200,
        messages=[{
            "role": "user",
            "content": (
                "From these product reviews, list 5 common themes or observations "
                "(texture, scent, results, packaging, value, etc.) as bullet points. "
                "Be brief.\n\n" + combined
            ),
        }],
    )
    return resp.content[0].text.strip()


def generate_review(product: dict) -> dict:
    """
    Returns the product dict with added keys:
      review_title, review_text, star_rating
    """
    themes = _summarise_review_themes(product.get("existing_reviews", []))

    prompt = f"""You are writing a genuine customer review for a Space NK product.

Product: {product['product_name']}
URL: {product['url']}

Common themes from other customers:
{themes}

Write a single product review that:
- Is approximately 100 words (90–115 words)
- Sounds like an everyday British woman writing naturally
- Tone is average to positive — honest but not gushing, no superlatives like "amazing" or "life-changing"
- Mentions 2–3 specific observations (texture, scent, how it feels, packaging, etc.) drawn from the themes above
- Does NOT say it was gifted, incentivised, or that you haven't used it
- Does NOT start with "I"
- Is written in first person throughout

Also provide a short review title (5–8 words).

Respond in this exact format:
TITLE: <title here>
REVIEW: <review text here>"""

    resp = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=300,
        messages=[{"role": "user", "content": prompt}],
    )

    text = resp.content[0].text.strip()
    title_match = re.search(r"TITLE:\s*(.+)", text)
    review_match = re.search(r"REVIEW:\s*([\s\S]+)", text)

    product["review_title"] = title_match.group(1).strip() if title_match else product["product_name"][:50]
    product["review_text"] = review_match.group(1).strip() if review_match else text
    product["star_rating"] = 4  # default; submit logic randomises between 4-5

    return product


def generate_all_reviews(products: list[dict]) -> list[dict]:
    """Generate reviews for a list of products."""
    results = []
    for i, product in enumerate(products, 1):
        print(f"  Generating review {i}/{len(products)}: {product['product_name'][:50]}...")
        try:
            results.append(generate_review(product))
        except Exception as e:
            print(f"  [generator] Skipping {product['product_name']}: {e}")
    return results
