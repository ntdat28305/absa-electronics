// ============================================================
// POPUP JS — ABSA Reviewer (Shopee + Tiki)
// ============================================================

let targetCount = 50;
let lastData = null;
let currentPlatform = "shopee";
let selectedModel = "phobert";
const STEP = 10;

// --- DOM Refs ---
const countVal = document.getElementById("countVal");
const btnMinus = document.getElementById("btnMinus");
const btnPlus = document.getElementById("btnPlus");
const btnScrape = document.getElementById("btnScrape");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const progressSection = document.getElementById("progressSection");
const progressFill = document.getElementById("progressFill");
const progressCount = document.getElementById("progressCount");
const divider = document.getElementById("divider");
const resultsSection = document.getElementById("resultsSection");
const reviewList = document.getElementById("reviewList");
const statTotal = document.getElementById("statTotal");
const btnCopy = document.getElementById("btnCopy");
const btnClear = document.getElementById("btnClear");
const platformBadge = document.getElementById("platformBadge");
const modelBtns = document.querySelectorAll(".model-btn");
const modelBadge = document.getElementById("modelBadge");

// --- Detect platform ---
async function detectAndSetPlatform() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) return;
  const url = tab.url;
  if (url.includes("tiki.vn")) {
    currentPlatform = "tiki";
    platformBadge.textContent = "Tiki";
    platformBadge.style.background = "rgba(0,82,204,0.15)";
    platformBadge.style.color = "#4da6ff";
    platformBadge.style.borderColor = "rgba(0,82,204,0.35)";
  } else if (url.includes("shopee.vn")) {
    currentPlatform = "shopee";
    platformBadge.textContent = "Shopee";
    platformBadge.style.background = "";
    platformBadge.style.color = "";
    platformBadge.style.borderColor = "";
  } else {
    currentPlatform = "unknown";
    platformBadge.textContent = "N/A";
    platformBadge.style.background = "rgba(122,128,153,0.15)";
    platformBadge.style.color = "#7a8099";
    platformBadge.style.borderColor = "rgba(122,128,153,0.2)";
  }
}

detectAndSetPlatform();

// --- Model selector ---
modelBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    selectedModel = btn.dataset.model;
    modelBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    if (modelBadge) {
      modelBadge.textContent = selectedModel === "llama" ? "LLaMA 3.2" : "PhoBERT";
      modelBadge.style.background = selectedModel === "llama" ? "rgba(16,185,129,0.15)" : "rgba(79,70,229,0.15)";
      modelBadge.style.color = selectedModel === "llama" ? "#10b981" : "#818cf8";
      modelBadge.style.borderColor = selectedModel === "llama" ? "rgba(16,185,129,0.4)" : "rgba(79,70,229,0.4)";
    }
  });
});

// --- Count controls ---
btnMinus.addEventListener("click", () => {
  targetCount = Math.max(10, targetCount - STEP);
  countVal.textContent = targetCount;
});
btnPlus.addEventListener("click", () => {
  targetCount = Math.min(500, targetCount + STEP);
  countVal.textContent = targetCount;
});

// --- Scrape ---
btnScrape.addEventListener("click", async () => {
  if (currentPlatform === "unknown") {
    setStatus("error", "Vui lòng mở trang Shopee hoặc Tiki.");
    return;
  }

  setStatus("active", "Đang kết nối trang...");
  btnScrape.disabled = true;
  btnScrape.innerHTML = `<span class="spinner"></span>Đang cào...`;
  btnScrape.classList.add("loading");

  showProgress(0, targetCount);
  hideResults();

  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const progressListener = (msg) => {
    if (msg.action === "SCRAPE_PROGRESS") {
      const { current, total } = msg.payload;
      updateProgress(current, total || targetCount);
      setStatus("active", `Đang cào trang ${msg.payload.page || "..."}...`);
    }
  };
  chrome.runtime.onMessage.addListener(progressListener);

  chrome.tabs.sendMessage(tab.id, { action: "START_SCRAPE", targetCount }, (response) => {
    chrome.runtime.onMessage.removeListener(progressListener);
    hideProgress();
    resetBtn();

    if (!response) {
      setStatus("error", "Không kết nối được. Thử reload trang.");
      return;
    }

    if (response.status === "DONE") {
      lastData = response.data;
      if (response.platform) currentPlatform = response.platform;

      const reviews = response.data;
      const total = reviews.length;
      const icon = selectedModel === "llama" ? "🦙" : "⚡";
      const modelLabel = selectedModel === "llama" ? "LLaMA 3.2" : "PhoBERT";

      // ── Hiện progress bar phân tích AI ──
      showProgress(0, total);
      setStatus("active", `${icon} ${modelLabel} đang phân tích 0 / ${total}...`);

      const results = [];

      // Placeholder cards — hiện "⏳ Chờ phân tích" trước
      renderResults(reviews.map((text) => ({ text, all_aspects: [] })));

      (async () => {
        for (let i = 0; i < reviews.length; i++) {
          setStatus("active", `${icon} ${modelLabel} phân tích ${i + 1} / ${total}...`);
          updateProgress(i + 1, total);

          try {
            const res = await fetch("http://127.0.0.1:8000/predict", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reviews: [reviews[i]], model_type: selectedModel }),
            });
            const json = await res.json();
            results.push(
              json.data?.[0] || {
                text: reviews[i],
                all_aspects: [],
                predicted_aspect: "Lỗi",
                predicted_sentiment: null,
              }
            );
          } catch (e) {
            results.push({
              text: reviews[i],
              all_aspects: [],
              predicted_aspect: "Lỗi",
              predicted_sentiment: null,
            });
          }

          // Cập nhật card đã xong, giữ placeholder cho các card chưa xong
          const displayData = [
            ...results,
            ...reviews.slice(results.length).map((text) => ({ text, all_aspects: [] })),
          ];
          renderResults(displayData);
        }

        hideProgress();
        setStatus("done", `✅ ${modelLabel} phân tích xong ${total} reviews`);
        lastData = results;
        chrome.storage.local.set({ lastReviews: lastData, lastPlatform: currentPlatform });
      })();

    } else {
      setStatus("error", response.error || "Có lỗi xảy ra.");
    }
  });
});

// --- Export JSON ---
btnCopy.addEventListener("click", () => {
  if (!lastData) return;
  const json = JSON.stringify(
    lastData.map((item) => {
      const text = typeof item === "string" ? item : item.text || item.content || "";
      const aspects = (item.all_aspects || []).map(({ aspect, sentiment, confidence }) => ({
        category: aspect,
        sentiment: sentiment,
        confidence: confidence != null ? Math.round(confidence * 10000) / 10000 : null,
      }));
      return { id: crypto.randomUUID(), content: text, aspects };
    }),
    null,
    2
  );
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${currentPlatform}_reviews_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  btnCopy.textContent = "✓ Đã tải";
  setTimeout(() => { btnCopy.textContent = "⬇ Export JSON"; }, 2000);
});

// --- Clear ---
btnClear.addEventListener("click", () => {
  lastData = null;
  chrome.storage.local.remove(["lastReviews", "lastPlatform"]);
  hideResults();
  setStatus("idle", "Sẵn sàng");
});

// --- Load saved data ---
chrome.storage.local.get(["lastReviews", "lastPlatform"], (res) => {
  if (res.lastReviews && res.lastReviews.length > 0) {
    lastData = res.lastReviews;
    if (res.lastPlatform) currentPlatform = res.lastPlatform;
    setStatus("done", `${lastData.length} reviews từ lần trước`);
    renderResults(lastData);
  }
});

// ============================================================
// UI HELPERS
// ============================================================

function setStatus(type, text) {
  statusDot.className = "status-dot";
  if (type === "active") statusDot.classList.add("active");
  else if (type === "done") statusDot.classList.add("done");
  else if (type === "error") statusDot.classList.add("error");
  statusText.textContent = text;
}

function showProgress(current, total) {
  progressSection.classList.add("visible");
  updateProgress(current, total);
}

function updateProgress(current, total) {
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  progressFill.style.width = pct + "%";
  progressCount.textContent = `${current} / ${total}`;
}

function hideProgress() {
  progressSection.classList.remove("visible");
}

function renderResults(data) {
  divider.classList.add("visible");
  resultsSection.classList.add("visible");
  reviewList.innerHTML = "";

  if (!data || data.length === 0) {
    reviewList.innerHTML = `<div style="padding:1rem;text-align:center;color:var(--text-dim);">Không có dữ liệu</div>`;
    return;
  }

  statTotal.innerText = `${data.length} reviews`;

  data.forEach((item, i) => {
    const text = typeof item === "string" ? item : item.text || item.content || "Lỗi đọc chữ";

    const allAspects =
      item.all_aspects && item.all_aspects.length > 0
        ? item.all_aspects
        : item.predicted_aspect
          ? [{ aspect: item.predicted_aspect, sentiment: item.predicted_sentiment || "unknown" }]
          : [];

    const isPending = allAspects.length === 0;

    const card = document.createElement("div");
    card.className = "review-card fade-in";
    card.style.animationDelay = `${Math.min(i * 0.04, 0.4)}s`;

    // Card chưa xong: viền mờ + icon chờ
    if (isPending) {
      card.style.opacity = "0.5";
      card.style.borderStyle = "dashed";
    }

    const tagsHtml = isPending
      ? `<span style="font-family:var(--mono);font-size:10px;color:var(--text-dim);">⏳ Đang phân tích...</span>`
      : buildAspectTags(allAspects);

    card.innerHTML = `
      <div class="review-meta" style="display:flex;align-items:center;justify-content:space-between;">
        <span class="review-idx">#${String(i + 1).padStart(3, "0")}</span>
        ${isPending ? `<span style="font-family:var(--mono);font-size:9px;color:var(--text-dim);">chờ...</span>` : ""}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:6px;">${tagsHtml}</div>
      <div class="review-text" style="margin-top:7px;">${escapeHtml(text)}</div>
    `;

    const textEl = card.querySelector(".review-text");
    card.addEventListener("click", () => {
      const expanded = textEl.style.webkitLineClamp === "unset";
      textEl.style.webkitLineClamp = expanded ? "2" : "unset";
      textEl.style.overflow = expanded ? "hidden" : "visible";
    });

    reviewList.appendChild(card);
  });
}

function hideResults() {
  divider.classList.remove("visible");
  resultsSection.classList.remove("visible");
  reviewList.innerHTML = "";
}

function resetBtn() {
  btnScrape.disabled = false;
  btnScrape.innerHTML = "▶ Bắt đầu cào";
  btnScrape.classList.remove("loading");
}

function buildAspectTags(aspects) {
  return aspects.map(({ aspect, sentiment, confidence }) => {
    const s = (sentiment || "").toLowerCase();
    let color, bg, border, icon;
    if (s === "positive") {
      color = "#3ddc84"; bg = "rgba(61,220,132,0.12)"; border = "rgba(61,220,132,0.3)"; icon = "↑";
    } else if (s === "negative") {
      color = "#ff6060"; bg = "rgba(255,96,48,0.12)"; border = "rgba(255,96,48,0.3)"; icon = "↓";
    } else {
      color = "#ffc107"; bg = "rgba(255,193,7,0.12)"; border = "rgba(255,193,7,0.3)"; icon = "→";
    }
    const confHtml = confidence != null
      ? `<span style="opacity:0.6;margin-left:3px;">${Math.round(confidence * 100)}%</span>`
      : "";
    return `<span style="display:inline-flex;align-items:center;gap:3px;font-family:var(--mono);font-size:10px;font-weight:600;color:${color};background:${bg};border:1px solid ${border};padding:3px 7px;border-radius:5px;white-space:nowrap;">${icon} ${escapeHtml(aspect)}${confHtml}</span>`;
  }).join("");
}

function escapeHtml(unsafe) {
  return (unsafe || "").toString()
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
