import math

ASPECTS = ["Battery", "Camera", "Customer_Service", "Design", "Feature", "General", "Performance", "Price", "Screen"]

def compute_overall_score(aspect_scores: dict, total_reviews: int) -> float:
    """
    confidence = min(1.0, log(n+1) / log(11))
    score = (mean_positive * confidence + 50 * (1 - confidence)) / 10
    """
    values = [v for k, v in aspect_scores.items() if k in ASPECTS and v is not None]
    if not values:
        return 0.0
    mean_positive = sum(values) / len(values)
    confidence = min(1.0, math.log(total_reviews + 1) / math.log(11))
    return round((mean_positive * confidence + 50 * (1 - confidence)) / 10, 2)

def compute_aspect_scores(reviews_aspects: list) -> dict:
    """
    reviews_aspects: list of per-review aspect lists
    Returns {aspect: positive_pct} for aspects with >= 1 mention
    """
    counts = {a: {"pos": 0, "total": 0} for a in ASPECTS}
    for aspects in reviews_aspects:
        for item in aspects:
            aspect = item.get("aspect", "")
            if aspect in counts:
                counts[aspect]["total"] += 1
                if item.get("sentiment", "").lower() == "positive":
                    counts[aspect]["pos"] += 1
    return {
        a: round(counts[a]["pos"] / counts[a]["total"] * 100, 1)
        for a in ASPECTS if counts[a]["total"] > 0
    }
