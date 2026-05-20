from scoring import compute_overall_score, compute_aspect_scores

def test_score_low_confidence():
    # 1 review, 100% positive → should NOT give 10
    score = compute_overall_score({"Battery": 100.0}, total_reviews=1)
    assert score < 8.0

def test_score_full_confidence():
    # 30 reviews, 85% → 8.5
    score = compute_overall_score({"Battery": 85.0}, total_reviews=30)
    assert abs(score - 8.5) < 0.01

def test_score_empty():
    assert compute_overall_score({}, total_reviews=0) == 0.0

def test_aspect_scores():
    reviews = [
        [{"aspect": "Battery", "sentiment": "Positive"}],
        [{"aspect": "Battery", "sentiment": "Negative"}],
        [{"aspect": "Camera", "sentiment": "Positive"}],
    ]
    result = compute_aspect_scores(reviews)
    assert result["Battery"] == 50.0
    assert result["Camera"] == 100.0
    assert "Screen" not in result
