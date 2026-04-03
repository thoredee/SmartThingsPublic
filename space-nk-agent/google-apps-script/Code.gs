// ============================================================
// Space NK Monthly Review Agent – Google Apps Script
// Paste this entire file into your Google Apps Script editor.
// ============================================================

const SPACE_NK_BASE = "https://www.spacenk.com";
const CATEGORY_PATHS = [
  "/uk/skincare/moisturisers/",
  "/uk/skincare/serums/",
  "/uk/skincare/eye-care/",
  "/uk/makeup/face/",
  "/uk/makeup/lips/",
  "/uk/bodycare/body-moisturisers/",
  "/uk/haircare/shampoo-conditioner/",
  "/uk/fragrance/womens-fragrance/",
];
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-haiku-4-5-20251001";
const TARGET_PER_MONTH = 10;
const SHEET_REVIEWS  = "Reviews";
const SHEET_HISTORY  = "History";
const SHEET_SETTINGS = "Settings";

// ============================================================
// 1. MENU & BOOTSTRAP
// ============================================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🛍️ Space NK Reviews")
    .addItem("Generate This Month's Reviews", "generateThisMonthsReviews")
    .addItem("Mark Selected Rows as Submitted", "markSelectedAsSubmitted")
    .addSeparator()
    .addItem("Monthly Summary", "showMonthlySummary")
    .addItem("Clear Reviews Sheet", "clearReviewsSheet")
    .addSeparator()
    .addItem("Settings (API Key)", "openSettings")
    .addToUi();
}

function ensureSheetsExist() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sheetsConfig = {
    [SHEET_SETTINGS]: ["Setting", "Value"],
    [SHEET_HISTORY]:  ["Product ID", "Product Name", "URL", "Date Submitted", "Month"],
    [SHEET_REVIEWS]:  ["Product Name", "Product URL", "Review Title", "Review Text", "Words", "Status", "Product ID"],
  };

  for (const [name, headers] of Object.entries(sheetsConfig)) {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
      sheet.setFrozenRows(1);

      // Pre-populate Settings with prompts
      if (name === SHEET_SETTINGS) {
        sheet.getRange(2, 1, 2, 2).setValues([
          ["Anthropic API Key", ""],
          ["Target Reviews Per Month", TARGET_PER_MONTH],
        ]);
        sheet.setColumnWidth(1, 200);
        sheet.setColumnWidth(2, 400);
      }
    }
  }
}

// ============================================================
// 2. SETTINGS
// ============================================================

function getSettings() {
  ensureSheetsExist();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SETTINGS);
  const data = sheet.getDataRange().getValues();
  const settings = {};
  for (let i = 1; i < data.length; i++) {
    settings[data[i][0]] = data[i][1];
  }
  const apiKey = settings["Anthropic API Key"];
  if (!apiKey || String(apiKey).trim() === "") {
    throw new Error("No API key found. Go to 🛍️ Space NK Reviews → Settings (API Key) and paste your Anthropic API key into cell B2.");
  }
  return {
    apiKey: String(apiKey).trim(),
    targetCount: Number(settings["Target Reviews Per Month"] || TARGET_PER_MONTH),
  };
}

function openSettings() {
  ensureSheetsExist();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.getSheetByName(SHEET_SETTINGS).activate();
  ss.toast("Paste your Anthropic API key (sk-ant-...) into cell B2, then press Enter.", "Settings", 8);
}

function showError(message) {
  SpreadsheetApp.getUi().alert("Error", message, SpreadsheetApp.getUi().ButtonSet.OK);
}

// ============================================================
// 3. HISTORY
// ============================================================

function getReviewedProductIds() {
  ensureSheetsExist();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_HISTORY);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const result = {};
  ids.forEach(row => { if (row[0]) result[String(row[0])] = true; });
  return result;
}

function recordSubmittedReview(productId, productName, url) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_HISTORY);
  const now = new Date();
  const month = Utilities.formatDate(now, "GMT", "yyyy-MM");
  sheet.appendRow([productId, productName, url, now.toISOString(), month]);
}

function getMonthlySubmittedCount() {
  ensureSheetsExist();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_HISTORY);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  const currentMonth = Utilities.formatDate(new Date(), "GMT", "yyyy-MM");
  const months = sheet.getRange(2, 5, lastRow - 1, 1).getValues();
  return months.filter(row => row[0] === currentMonth).length;
}

function showMonthlySummary() {
  ensureSheetsExist();
  const done = getMonthlySubmittedCount();
  const total = Object.keys(getReviewedProductIds()).length;
  const needed = Math.max(0, TARGET_PER_MONTH - done);
  SpreadsheetApp.getUi().alert(
    "Monthly Summary",
    `✅  Done this month: ${done} / ${TARGET_PER_MONTH}\n` +
    `📝  Still needed:     ${needed}\n` +
    `📚  All-time total:   ${total}`,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

// ============================================================
// 4. SCRAPING
// ============================================================

function fetchUrl(url) {
  try {
    const response = UrlFetchApp.fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.9",
      },
      followRedirects: true,
      muteHttpExceptions: true,
    });
    if (response.getResponseCode() !== 200) return null;
    return response.getContentText();
  } catch (e) {
    console.error("fetchUrl failed for " + url + ": " + e.message);
    return null;
  }
}

function extractProductLinksFromHtml(html, excludeIds, limit) {
  const results = [];
  const seen = {};

  // Strategy A: SFCC product URL pattern  /uk/category/product-name-200123.html
  const urlPattern = /href="(\/uk\/[a-z0-9][a-z0-9\-\/]*?-(\d{6,})\.html)"/g;
  let match;
  while ((match = urlPattern.exec(html)) !== null && results.length < limit) {
    const path = match[1];
    const id   = match[2];
    if (seen[id] || excludeIds[id]) continue;
    seen[id] = true;

    // Derive a human name from the URL slug
    const slug = path.split("/").pop().replace(/-\d+\.html$/, "");
    const name = slug.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

    results.push({ productId: id, productName: name, url: SPACE_NK_BASE + path });
  }

  // Strategy B: JSON-LD product data embedded for SEO
  if (results.length < limit) {
    const jsonLdPattern = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
    let ldMatch;
    while ((ldMatch = jsonLdPattern.exec(html)) !== null && results.length < limit) {
      try {
        const data = JSON.parse(ldMatch[1]);
        const items = Array.isArray(data) ? data : [data];
        items.forEach(item => {
          if (item["@type"] === "Product" && item.url) {
            const idM = item.url.match(/(\d{6,})\.html/);
            if (!idM) return;
            const id = idM[1];
            if (seen[id] || excludeIds[id]) return;
            seen[id] = true;
            results.push({
              productId: id,
              productName: item.name || "Space NK Product",
              url: item.url.startsWith("http") ? item.url : SPACE_NK_BASE + item.url,
            });
          }
        });
      } catch (_) {}
    }
  }

  return results.slice(0, limit);
}

function extractExistingReviews(html) {
  const reviews = [];

  // Strategy A: Bazaarvoice serialised JSON (Pascal case keys)
  const bvPattern = /"ReviewText"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = bvPattern.exec(html)) !== null && reviews.length < 8) {
    const text = m[1].replace(/\\n/g, " ").replace(/\\"/g, '"').trim();
    if (text.length > 30) reviews.push(text);
  }

  // Strategy B: camelCase reviewText (used by some BV configs)
  if (reviews.length === 0) {
    const bvPattern2 = /"reviewText"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
    while ((m = bvPattern2.exec(html)) !== null && reviews.length < 8) {
      const text = m[1].replace(/\\n/g, " ").replace(/\\"/g, '"').trim();
      if (text.length > 30) reviews.push(text);
    }
  }

  // Strategy C: Static HTML BV review blocks
  if (reviews.length === 0) {
    const blockPattern = /class="bv-content-summary-body-text[^"]*"[^>]*>([\s\S]{30,500}?)<\/p>/g;
    while ((m = blockPattern.exec(html)) !== null && reviews.length < 8) {
      const text = m[1].replace(/<[^>]+>/g, "").trim();
      if (text.length > 30) reviews.push(text);
    }
  }

  return reviews;
}

function getCandidateProducts(reviewedIds, needed) {
  const candidates = [];
  // Shuffle categories so we vary what we pick each month
  const paths = CATEGORY_PATHS.slice().sort(() => Math.random() - 0.5);

  for (const path of paths) {
    if (candidates.length >= needed) break;
    const html = fetchUrl(SPACE_NK_BASE + path);
    if (!html) continue;

    const products = extractProductLinksFromHtml(html, reviewedIds, 30);
    for (const product of products) {
      if (candidates.length >= needed) break;
      // Fetch existing reviews for this product
      Utilities.sleep(600 + Math.floor(Math.random() * 800));
      const productHtml = fetchUrl(product.url);
      product.existingReviews = productHtml ? extractExistingReviews(productHtml) : [];
      candidates.push(product);
      // Mark as seen locally to avoid duplicates within this run
      reviewedIds[product.productId] = true;
    }
  }

  return candidates;
}

// ============================================================
// 5. CLAUDE API
// ============================================================

function callClaudeApi(prompt, maxTokens, apiKey) {
  const payload = {
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  };

  const response = UrlFetchApp.fetch(ANTHROPIC_API_URL, {
    method: "post",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const code = response.getResponseCode();
  if (code !== 200) {
    throw new Error("Claude API returned " + code + ": " + response.getContentText().substring(0, 200));
  }

  const data = JSON.parse(response.getContentText());
  return data.content[0].text.trim();
}

function countWords(text) {
  return text.trim().split(/\s+/).length;
}

function generateReview(product, apiKey) {
  const themesText = product.existingReviews && product.existingReviews.length > 0
    ? product.existingReviews.slice(0, 5).join("\n---\n")
    : "No existing reviews. Focus on typical texture, scent, results, packaging qualities.";

  const prompt =
    "You are writing a genuine customer review for a Space NK product.\n\n" +
    "Product: " + product.productName + "\n\n" +
    "Themes from other customers:\n" + themesText + "\n\n" +
    "Write a review that:\n" +
    "- Is approximately 100 words (90–115 words)\n" +
    "- Sounds like an everyday British woman writing naturally\n" +
    "- Tone is average to positive — honest but not gushing, no words like 'amazing' or 'life-changing'\n" +
    "- Mentions 2–3 specific things (texture, scent, how it feels, packaging, value) drawn from the themes\n" +
    "- Does NOT mention being incentivised, gifted, or that you haven't used it\n" +
    "- Does NOT start with 'I'\n" +
    "- First person throughout\n\n" +
    "Respond EXACTLY in this format:\n" +
    "TITLE: [5–8 word title]\n" +
    "REVIEW: [review text]";

  const response = callClaudeApi(prompt, 350, apiKey);

  const titleMatch  = response.match(/TITLE:\s*(.+)/);
  const reviewMatch = response.match(/REVIEW:\s*([\s\S]+)/);

  return {
    ...product,
    reviewTitle: titleMatch  ? titleMatch[1].trim()  : product.productName.substring(0, 50),
    reviewText:  reviewMatch ? reviewMatch[1].trim() : response,
  };
}

function generateAllReviews(products, apiKey) {
  const results = [];
  for (let i = 0; i < products.length; i++) {
    try {
      const reviewed = generateReview(products[i], apiKey);
      results.push(reviewed);
    } catch (e) {
      console.error("Review generation failed for " + products[i].productName + ": " + e.message);
    }
    Utilities.sleep(400);
  }
  return results;
}

// ============================================================
// 6. SHEET WRITE OPERATIONS & ENTRY POINTS
// ============================================================

function writeReviewsToSheet(reviews) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_REVIEWS);

  // Clear existing data rows
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, 7).clearContent();

  reviews.forEach((r, i) => {
    const rowNum = i + 2;
    sheet.getRange(rowNum, 1).setValue(r.productName);

    // Clickable hyperlink
    const richText = SpreadsheetApp.newRichTextValue()
      .setText("Open Product Page")
      .setLinkUrl(r.url)
      .build();
    sheet.getRange(rowNum, 2).setRichTextValue(richText);

    sheet.getRange(rowNum, 3).setValue(r.reviewTitle);
    sheet.getRange(rowNum, 4).setValue(r.reviewText);
    sheet.getRange(rowNum, 5).setValue(countWords(r.reviewText));
    sheet.getRange(rowNum, 6).setValue("Generated");
    sheet.getRange(rowNum, 7).setValue(r.productId);  // hidden dedup key
  });

  // Formatting
  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(2, 140);
  sheet.setColumnWidth(3, 220);
  sheet.setColumnWidth(4, 420);
  sheet.setColumnWidth(5, 60);
  sheet.setColumnWidth(6, 100);
  sheet.hideColumns(7);  // hide Product ID column — used internally
  sheet.getRange(2, 4, reviews.length, 1).setWrap(true);

  // Highlight Generated rows in pale gold
  sheet.getRange(2, 1, reviews.length, 6)
    .setBackground("#fdf6e3");

  ss.setActiveSheet(sheet);
}

function generateThisMonthsReviews() {
  ensureSheetsExist();

  let settings;
  try {
    settings = getSettings();
  } catch (e) {
    showError(e.message);
    return;
  }

  const alreadyDone = getMonthlySubmittedCount();
  const needed = Math.max(0, settings.targetCount - alreadyDone);

  if (needed === 0) {
    SpreadsheetApp.getUi().alert(
      "All Done! ✅",
      "All " + settings.targetCount + " reviews for this month are already submitted.\n\nCheck back next month!",
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return;
  }

  const ui = SpreadsheetApp.getUi();
  const confirm = ui.alert(
    "Generate Reviews",
    needed + " review(s) needed this month.\n\nThis takes about 2–3 minutes. Ready to start?",
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Step 1 — Find products
  ss.toast("Scanning Space NK for products… (1 of 3)", "Please wait", 60);
  const reviewedIds = getReviewedProductIds();
  const candidates = getCandidateProducts(reviewedIds, needed);

  if (candidates.length === 0) {
    showError("Could not find any unreviewed products on Space NK right now. Please try again in a few minutes.");
    return;
  }

  // Step 2 — Generate reviews
  ss.toast("Generating " + candidates.length + " reviews with Claude… (2 of 3)", "Please wait", 120);
  const reviews = generateAllReviews(candidates, settings.apiKey);

  if (reviews.length === 0) {
    showError("Review generation failed for all products. Check your API key in Settings.");
    return;
  }

  // Step 3 — Write to sheet
  ss.toast("Writing reviews to sheet… (3 of 3)", "Please wait", 15);
  writeReviewsToSheet(reviews);

  ss.toast(reviews.length + " reviews ready! Read each one, then submit on Space NK.", "✅ Done", 10);

  ui.alert(
    "✅ " + reviews.length + " Reviews Generated!",
    "Your reviews are in the Reviews sheet.\n\n" +
    "HOW TO SUBMIT:\n" +
    "1. For each row, tap 'Open Product Page'\n" +
    "2. Scroll to 'Write a Review' on the Space NK page\n" +
    "3. Copy & paste the Title and Review text\n" +
    "4. Choose 4 or 5 stars and submit\n\n" +
    "When you've submitted all reviews, come back here and select all the rows,\n" +
    "then tap  🛍️ Space NK Reviews → Mark Selected Rows as Submitted\n" +
    "to record them so they're never picked again.",
    ui.ButtonSet.OK
  );
}

function markSelectedAsSubmitted() {
  ensureSheetsExist();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const activeSheet = ss.getActiveSheet();

  if (activeSheet.getName() !== SHEET_REVIEWS) {
    showError("Please open the Reviews sheet and select the rows you've submitted, then try again.");
    return;
  }

  const range = activeSheet.getActiveRange();
  if (!range) {
    showError("Please select the rows you want to mark as submitted.");
    return;
  }

  const startRow = Math.max(2, range.getRow());
  const numRows  = range.getLastRow() - startRow + 1;
  if (numRows < 1) return;

  const data = activeSheet.getRange(startRow, 1, numRows, 7).getValues();
  let count = 0;

  data.forEach((row, i) => {
    const productName = row[0];
    const productId   = row[6];
    const url         = row[1]; // note: will be "Open Product Page" text — we store raw URL in col 7 in history
    const status      = row[5];

    if (status === "Submitted" || !productName) return;

    recordSubmittedReview(String(productId), String(productName), SPACE_NK_BASE);
    activeSheet.getRange(startRow + i, 6).setValue("✅ Submitted");
    activeSheet.getRange(startRow + i, 1, 1, 6).setBackground("#e8f5e9");
    count++;
  });

  if (count === 0) {
    ss.toast("No new rows to mark — they may already be submitted.", "Note", 5);
  } else {
    ss.toast(count + " review(s) recorded as submitted. They won't be picked again.", "✅ Saved", 8);
  }
}

function clearReviewsSheet() {
  ensureSheetsExist();
  const ui = SpreadsheetApp.getUi();
  const confirm = ui.alert(
    "Clear Reviews?",
    "This will delete all rows in the Reviews sheet (your history is kept separately).\n\nContinue?",
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) return;

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_REVIEWS);
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, 7).clearContent().setBackground(null);
  SpreadsheetApp.getActiveSpreadsheet().toast("Reviews sheet cleared.", "Done", 4);
}
