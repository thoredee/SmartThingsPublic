"""Tracks which products Immy has already reviewed so we never repeat."""

import json
import os
from datetime import datetime

HISTORY_FILE = os.path.join(os.path.dirname(__file__), "review_history.json")


def load_history() -> dict:
    if not os.path.exists(HISTORY_FILE):
        return {"reviewed": []}
    with open(HISTORY_FILE) as f:
        return json.load(f)


def save_history(history: dict) -> None:
    with open(HISTORY_FILE, "w") as f:
        json.dump(history, f, indent=2)


def get_reviewed_product_ids() -> set[str]:
    history = load_history()
    return {entry["product_id"] for entry in history["reviewed"]}


def record_reviews(reviews: list[dict]) -> None:
    """Mark a batch of reviews as submitted."""
    history = load_history()
    month = datetime.now().strftime("%Y-%m")
    for review in reviews:
        history["reviewed"].append({
            "product_id": review["product_id"],
            "product_name": review["product_name"],
            "date": datetime.now().isoformat(),
            "month": month,
        })
    save_history(history)


def get_monthly_count() -> int:
    """How many reviews have been submitted this calendar month."""
    history = load_history()
    month = datetime.now().strftime("%Y-%m")
    return sum(1 for e in history["reviewed"] if e.get("month") == month)


def reviews_needed_this_month() -> int:
    return max(0, 10 - get_monthly_count())
