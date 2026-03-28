"""
Flask web UI for the Space NK monthly review agent.

Run:  python app.py
Then open http://localhost:5000 in your browser.
"""

import json
import os
import threading
from flask import Flask, jsonify, render_template_string, request
from playwright.sync_api import sync_playwright

import history
import scraper
import generator

app = Flask(__name__)

# In-memory state for the current session
_state = {
    "status": "idle",           # idle | scraping | generating | ready | submitting | done
    "message": "",
    "reviews": [],              # list of generated review dicts
    "submit_results": [],
}

HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Space NK Monthly Reviews – Immy</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, serif; background: #faf9f7; color: #2c2c2c; }
  header { background: #1a1a1a; color: #fff; padding: 18px 30px; display:flex; align-items:center; gap:16px; }
  header h1 { font-size: 1.3rem; letter-spacing: 1px; text-transform: uppercase; }
  .badge { background: #c9a96e; color: #fff; border-radius: 20px; padding: 3px 12px; font-size:.8rem; }
  main { max-width: 900px; margin: 30px auto; padding: 0 20px; }
  .card { background: #fff; border: 1px solid #e0ddd8; border-radius: 8px; padding: 24px; margin-bottom: 20px; }
  .card h2 { font-size: 1rem; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 14px; color: #888; }
  label { display:block; font-size:.85rem; margin-bottom:4px; color:#555; }
  input { width:100%; padding:8px 12px; border:1px solid #ccc; border-radius:4px; font-size:.9rem; margin-bottom:12px; }
  input[type=password] { letter-spacing: 2px; }
  .btn { display:inline-block; padding:10px 28px; border:none; border-radius:4px; cursor:pointer; font-size:.9rem; font-family:Georgia,serif; }
  .btn-primary { background:#1a1a1a; color:#fff; }
  .btn-primary:hover { background:#333; }
  .btn-gold { background:#c9a96e; color:#fff; }
  .btn-gold:hover { background:#b8945a; }
  .btn:disabled { opacity:.5; cursor:not-allowed; }
  #status-bar { background:#f0ede6; border:1px solid #ddd; border-radius:6px; padding:12px 16px; margin-bottom:20px; font-size:.9rem; color:#555; display:none; }
  #status-bar.active { display:block; }
  .spinner { display:inline-block; width:14px; height:14px; border:2px solid #ccc; border-top-color:#1a1a1a; border-radius:50%; animation:spin .8s linear infinite; margin-right:8px; vertical-align:middle; }
  @keyframes spin { to { transform:rotate(360deg); } }
  .review-card { border:1px solid #e0ddd8; border-radius:6px; padding:18px; margin-bottom:14px; position:relative; }
  .review-card .product { font-weight:bold; font-size:.95rem; margin-bottom:6px; }
  .review-card .review-title { font-style:italic; color:#888; font-size:.85rem; margin-bottom:8px; }
  .review-card .review-body { font-size:.9rem; line-height:1.6; }
  .review-card .stars { color:#c9a96e; margin-bottom:6px; }
  .review-card a.product-link { font-size:.75rem; color:#888; text-decoration:none; }
  .review-card a.product-link:hover { text-decoration:underline; }
  .result-ok  { color: #2a7a2a; }
  .result-err { color: #a32020; }
  .monthly-info { display:flex; gap:20px; }
  .info-box { flex:1; text-align:center; padding:16px; background:#f8f6f2; border-radius:6px; border:1px solid #e8e4db; }
  .info-box .num { font-size:2rem; font-weight:bold; color:#c9a96e; }
  .info-box .lbl { font-size:.8rem; color:#888; text-transform:uppercase; letter-spacing:.5px; }
  .warn { background:#fff8e6; border:1px solid #e8c96e; border-radius:6px; padding:12px 16px; font-size:.85rem; color:#7a5f00; margin-bottom:16px; }
</style>
</head>
<body>
<header>
  <h1>Space NK Review Agent</h1>
  <span class="badge">Immy's Monthly Reviews</span>
</header>
<main>

  <!-- Monthly summary -->
  <div class="card" id="summary-card">
    <h2>This Month</h2>
    <div class="monthly-info">
      <div class="info-box"><div class="num" id="done-count">–</div><div class="lbl">Submitted this month</div></div>
      <div class="info-box"><div class="num" id="needed-count">–</div><div class="lbl">Still needed</div></div>
      <div class="info-box"><div class="num" id="total-count">–</div><div class="lbl">All-time reviews</div></div>
    </div>
  </div>

  <!-- Credentials -->
  <div class="card" id="creds-card">
    <h2>Space NK Account</h2>
    <label>Email address</label>
    <input type="email" id="email" value="immydonner@gmail.com">
    <label>Password</label>
    <input type="password" id="password" value="Kelmarsh11">
    <button class="btn btn-primary" id="generate-btn" onclick="startGenerate()">
      Find &amp; Generate This Month's Reviews
    </button>
  </div>

  <!-- Status bar -->
  <div id="status-bar"><span class="spinner" id="spinner"></span><span id="status-msg">Loading…</span></div>

  <!-- Reviews list -->
  <div id="reviews-section" style="display:none">
    <div class="warn">
      ⚠️ Review the generated text below. Edit any card before submitting if you'd like to tweak it.
    </div>
    <div id="reviews-list"></div>
    <button class="btn btn-gold" id="submit-btn" onclick="submitAll()">
      Submit All Reviews to Space NK
    </button>
  </div>

  <!-- Submit results -->
  <div id="results-section" style="display:none">
    <div class="card">
      <h2>Submission Results</h2>
      <div id="results-list"></div>
    </div>
  </div>

</main>
<script>
let generatedReviews = [];

async function loadSummary() {
  const r = await fetch('/api/summary');
  const d = await r.json();
  document.getElementById('done-count').textContent = d.done_this_month;
  document.getElementById('needed-count').textContent = d.needed;
  document.getElementById('total-count').textContent = d.total;
  if (d.needed === 0) {
    document.getElementById('generate-btn').disabled = true;
    document.getElementById('generate-btn').textContent = 'All 10 reviews done this month ✓';
  }
}

function setStatus(msg, spinning=true) {
  const bar = document.getElementById('status-bar');
  bar.classList.add('active');
  document.getElementById('status-msg').textContent = msg;
  document.getElementById('spinner').style.display = spinning ? 'inline-block' : 'none';
}

function starsHtml(n) {
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

function renderReviews(reviews) {
  const container = document.getElementById('reviews-list');
  container.innerHTML = '';
  reviews.forEach((r, i) => {
    container.innerHTML += `
      <div class="review-card" id="card-${i}">
        <div class="product">${r.product_name}</div>
        <a class="product-link" href="${r.url}" target="_blank">${r.url}</a>
        <div class="stars">${starsHtml(r.star_rating || 4)}</div>
        <div class="review-title" contenteditable="true" id="title-${i}">${r.review_title}</div>
        <div class="review-body" contenteditable="true" id="body-${i}">${r.review_text}</div>
      </div>`;
  });
  document.getElementById('reviews-section').style.display = 'block';
}

async function startGenerate() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  if (!email || !password) { alert('Please enter your Space NK email and password.'); return; }

  document.getElementById('generate-btn').disabled = true;
  document.getElementById('reviews-section').style.display = 'none';
  document.getElementById('results-section').style.display = 'none';
  setStatus('Scanning Space NK for products (this can take a minute)…');

  const r = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const d = await r.json();

  if (!d.ok) {
    setStatus('Error: ' + d.error, false);
    if (d.log && d.log.length) {
      const logDiv = document.createElement('pre');
      logDiv.style = 'background:#f5f5f5;border:1px solid #ddd;padding:12px;font-size:.75rem;margin-top:12px;overflow-x:auto;white-space:pre-wrap;';
      logDiv.textContent = d.log.join('\n');
      document.getElementById('status-bar').appendChild(logDiv);
    }
    document.getElementById('generate-btn').disabled = false;
    return;
  }

  generatedReviews = d.reviews;
  setStatus(`Generated ${d.reviews.length} reviews. Review and submit below.`, false);
  renderReviews(d.reviews);
  loadSummary();
}

async function submitAll() {
  // Pull in any edits the user made
  generatedReviews.forEach((r, i) => {
    r.review_title = document.getElementById(`title-${i}`).innerText.trim();
    r.review_text  = document.getElementById(`body-${i}`).innerText.trim();
  });

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  document.getElementById('submit-btn').disabled = true;
  setStatus('Logging into Space NK and submitting reviews…');

  const r = await fetch('/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, reviews: generatedReviews }),
  });
  const d = await r.json();

  setStatus(`Done. ${d.submitted} submitted, ${d.failed} failed.`, false);
  loadSummary();

  const rl = document.getElementById('results-list');
  rl.innerHTML = d.results.map(res =>
    `<p class="${res.ok ? 'result-ok' : 'result-err'}">${res.ok ? '✓' : '✗'} ${res.product_name}</p>`
  ).join('');
  document.getElementById('results-section').style.display = 'block';
}

loadSummary();
</script>
</body>
</html>
"""


@app.route("/")
def index():
    return render_template_string(HTML)


@app.route("/api/summary")
def api_summary():
    h = history.load_history()
    from datetime import datetime
    month = datetime.now().strftime("%Y-%m")
    done = sum(1 for e in h["reviewed"] if e.get("month") == month)
    return jsonify({
        "done_this_month": done,
        "needed": max(0, 10 - done),
        "total": len(h["reviewed"]),
    })


@app.route("/api/generate", methods=["POST"])
def api_generate():
    data = request.json
    needed = history.reviews_needed_this_month()
    if needed == 0:
        return jsonify({"ok": False, "error": "All 10 reviews already submitted this month."})

    try:
        excluded = history.get_reviewed_product_ids()
        print(f"[agent] Fetching {needed} candidate products…")
        products, log = scraper.fetch_candidate_products(excluded, needed)
        for line in log:
            print(f"  {line}")
        if not products:
            return jsonify({
                "ok": False,
                "error": "Could not find any products on Space NK. See details below.",
                "log": log,
            })

        print(f"[agent] Generating reviews for {len(products)} products…")
        reviewed = generator.generate_all_reviews(products)
        return jsonify({"ok": True, "reviews": reviewed, "log": log})
    except Exception as e:
        import traceback
        return jsonify({"ok": False, "error": str(e), "log": [traceback.format_exc()]})


@app.route("/api/submit", methods=["POST"])
def api_submit():
    data = request.json
    email = data.get("email", "")
    password = data.get("password", "")
    reviews = data.get("reviews", [])

    results = []
    submitted_reviews = []

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

        logged_in = scraper.login_to_spacenk(page, email, password)
        if not logged_in:
            return jsonify({"ok": False, "error": "Login failed. Check your email and password.", "submitted": 0, "failed": len(reviews), "results": []})

        for review in reviews:
            ok = scraper.submit_review(page, review)
            results.append({"product_name": review["product_name"], "ok": ok})
            if ok:
                submitted_reviews.append(review)

        browser.close()

    if submitted_reviews:
        history.record_reviews(submitted_reviews)

    submitted = sum(1 for r in results if r["ok"])
    failed = len(results) - submitted
    return jsonify({"ok": True, "submitted": submitted, "failed": failed, "results": results})


if __name__ == "__main__":
    print("Space NK Review Agent")
    print("Open http://localhost:5000 in your browser")
    app.run(debug=False, port=5000)
