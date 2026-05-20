// ============================================================
// CONTENT JS — ABSA Reviewer (Shopee + Tiki)
// ============================================================

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Platform detection ───────────────────────────────────────
function detectPlatform() {
  const host = window.location.hostname;
  if (host.includes("tiki.vn")) return "tiki";
  if (host.includes("shopee.vn")) return "shopee";
  return "unknown";
}

// ============================================================
// SHOPEE SCRAPER
// ============================================================
async function waitForShopeeReviews(timeout = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (document.querySelectorAll(".A7MThp").length > 0) return true;
    await sleep(200);
  }
  return false;
}

async function scrapeShopeeReviews(targetCount) {
  let allReviews = [];
  let pageCount = 1;
  let previousCount = 0; // Biến để theo dõi số lượng ở vòng lặp trước
  let stuckCounter = 0; // Biến đếm số lần kẹt (không cào thêm được câu nào)

  while (allReviews.length < targetCount) {
    await waitForShopeeReviews(3000);

    document.querySelectorAll(".A7MThp").forEach((container) => {
      const textEl = container.querySelector(".YNedDV");
      if (textEl) {
        const text = textEl.innerText.trim();
        // Cố tình bỏ qua các comment trống (chỉ vote sao)
        if (text && text !== "") allReviews.push(text);
      }
    });

    allReviews = [...new Set(allReviews)];
    sendProgress(allReviews.length, targetCount, pageCount);

    if (allReviews.length >= targetCount) break;

    // === CƠ CHẾ CHỐNG KẸT VÒNG LẶP VÔ HẠN ===
    if (allReviews.length === previousCount) {
      stuckCounter++;
      // Nếu 2 trang liên tiếp không cào thêm được câu nào -> Hết comment thực sự!
      if (stuckCounter >= 2) {
        console.log("Phát hiện kẹt trang/Hết bình luận. Tự động thoát!");
        break;
      }
    } else {
      stuckCounter = 0; // Reset nếu cào thêm được
      previousCount = allReviews.length;
    }

    // === TÌM NÚT NEXT CHUẨN XÁC ===
    const nextBtn = document.querySelector(
      ".shopee-icon-button.shopee-icon-button--right",
    );

    // Check cả thuộc tính disabled lẫn class CSS disabled
    if (
      !nextBtn ||
      nextBtn.disabled === true ||
      nextBtn.classList.contains("shopee-icon-button--disabled")
    ) {
      console.log("Đã tới trang cuối cùng. Không thể click Next.");
      break;
    }

    nextBtn.scrollIntoView({ behavior: "smooth", block: "center" });
    await sleep(400);
    nextBtn.click();
    pageCount++;
    await sleep(1500); // Đợi Shopee load dữ liệu mới
  }

  return allReviews.slice(0, targetCount);
}

// ============================================================
// TIKI SCRAPER
// ============================================================
async function scrapeTikiReviews(targetCount) {
  let allReviews = [];
  let pageCount = 1;
  let previousCount = 0;
  let stuckCounter = 0;

  while (allReviews.length < targetCount) {
    console.log(`[Tiki] Đang quét trang ${pageCount}...`);

    // 1. Tìm tất cả các khung comment
    let reviewContainers = document.querySelectorAll(".review-comment");

    // 2. XỬ PHẦN "XEM THÊM" CỦA COMMENT
    // Duyệt qua từng khung, nếu thấy nút Xem thêm thì click cho bung chữ ra
    reviewContainers.forEach((container) => {
      let showMoreBtn = container.querySelector(".show-more-content");
      if (showMoreBtn) {
        showMoreBtn.click();
      }
    });

    // Ngủ 0.5s để đợi ReactJS của Tiki render nốt phần chữ bị giấu
    await sleep(500);

    // 3. Tiến hành bóc tách chữ
    reviewContainers.forEach((container) => {
      let textEl = container.querySelector(".review-comment__content");
      if (textEl) {
        let text = textEl.innerText.trim();

        // Dọn rác: Cắt bỏ chữ "Xem thêm" hoặc "Thu gọn" nếu lỡ bị dính vào string
        text = text.replace("Xem thêm", "").replace("Thu gọn", "").trim();

        if (text !== "") allReviews.push(text);
      }
    });

    // Lọc trùng và gửi tiến độ
    allReviews = [...new Set(allReviews)];
    sendProgress(allReviews.length, targetCount, pageCount);

    if (allReviews.length >= targetCount) break;

    // Cơ chế chống kẹt
    if (allReviews.length === previousCount) {
      stuckCounter++;
      if (stuckCounter >= 2) {
        console.log("Phát hiện kẹt trang/Hết bình luận. Tự động thoát!");
        break;
      }
    } else {
      stuckCounter = 0;
      previousCount = allReviews.length;
    }

    // 4. Tìm nút Next
    // Phải viết dính liền thành .btn.next để chỉ định phần tử có cả 2 class
    const nextBtn = document.querySelector(".btn.next");

    if (!nextBtn || nextBtn.classList.contains("disable") || nextBtn.disabled) {
      console.log("Đã tới trang cuối cùng của Tiki.");
      break;
    }

    nextBtn.scrollIntoView({ behavior: "smooth", block: "center" });
    await sleep(400);
    nextBtn.click();
    pageCount++;
    await sleep(2000); // Tiki load data mới khá chậm, để 2s cho an toàn
  }

  return allReviews.slice(0, targetCount);
}

// ============================================================
// SHARED HELPERS
// ============================================================
function sendProgress(current, total, page) {
  chrome.runtime.sendMessage({
    action: "SCRAPE_PROGRESS",
    payload: { current, total, page },
  });
}

// ============================================================
// MESSAGE LISTENER
// ============================================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "START_SCRAPE") {
    const platform = detectPlatform();
    const scraper =
      platform === "tiki"
        ? scrapeTikiReviews(request.targetCount)
        : scrapeShopeeReviews(request.targetCount);

    scraper.then((data) => {
      sendResponse({ status: "DONE", data, platform });
    });
    return true; // Keep message channel open for async response
  }

  if (request.action === "GET_PLATFORM") {
    sendResponse({ platform: detectPlatform() });
  }
});
