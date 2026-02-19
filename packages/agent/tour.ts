/**
 * Ranger Dashboard Tour
 *
 * Takes screenshots and records video of the dashboard to give a visual tour.
 * Run: npx tsx tour.ts
 * Output: ./tour/ directory with screenshots + video
 */

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:4800";
const OUT = "../../tour";

mkdirSync(OUT, { recursive: true });

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: OUT, size: { width: 1280, height: 800 } },
  });
  const page = await context.newPage();

  // Helper: screenshot with a label
  let step = 0;
  async function snap(name: string, description: string) {
    step++;
    const filename = `${String(step).padStart(2, "0")}-${name}.png`;
    await page.waitForTimeout(500); // let rendering settle
    await page.screenshot({ path: `${OUT}/${filename}` });
    console.log(`  📸 ${filename} — ${description}`);
  }

  console.log("\n🎬 Starting Ranger Dashboard Tour\n");

  // ── 1. Reviews List ────────────────────────────────────────────────────────
  console.log("── Reviews List ──");
  await page.goto(`${BASE}/reviews`, { waitUntil: "networkidle" });
  await snap("reviews-list", "Main reviews page showing all 3 reviews with status badges");

  // Hover over the first review to show the hover state
  const firstReview = page.locator("a[href^='/reviews/']").first();
  await firstReview.hover();
  await snap("reviews-list-hover", "Hover state on the 'Login page redesign' review card");

  // ── 2. Review Detail — Login page redesign (passed) ────────────────────────
  console.log("── Review Detail: Login page redesign ──");
  await firstReview.click();
  await page.waitForLoadState("networkidle");
  await snap("review-detail-passed", "Review detail for 'Login page redesign' — passed status, 2 scenarios with verdicts");

  // Scroll down to see the second scenario
  await page.evaluate(() => window.scrollBy(0, 300));
  await snap("review-detail-scrolled", "Scrolled down to see scenario #2 'Form validation works'");

  // ── 3. Run Detail — Verification run with artifacts ────────────────────────
  console.log("── Run Detail ──");
  const viewRunLink = page.locator("a:has-text('View run')").first();
  await viewRunLink.click();
  await page.waitForLoadState("networkidle");
  await snap("run-detail", "Verification run detail — passed verdict, timing, and screenshot artifacts");

  // Scroll to see artifact grid
  await page.evaluate(() => window.scrollBy(0, 400));
  await snap("run-detail-artifacts", "Artifact screenshot grid (placeholder images — real screenshots from Playwright captures)");

  // ── 4. Navigate back and check the in_progress review ──────────────────────
  console.log("── Review Detail: Dashboard charts (in_progress) ──");
  await page.goto(`${BASE}/reviews`, { waitUntil: "networkidle" });
  const chartsReview = page.locator("a:has-text('Dashboard charts')");
  await chartsReview.click();
  await page.waitForLoadState("networkidle");
  await snap("review-inprogress", "Review 'Dashboard charts' — in_progress status with running scenario");

  // ── 5. Check the draft review ──────────────────────────────────────────────
  console.log("── Review Detail: Settings page (draft) ──");
  await page.goto(`${BASE}/reviews`, { waitUntil: "networkidle" });
  const settingsReview = page.locator("a:has-text('Settings page')");
  await settingsReview.click();
  await page.waitForLoadState("networkidle");
  await snap("review-draft", "Review 'Settings page' — draft status, pending scenario, no runs yet");

  // ── 6. API endpoints tour ──────────────────────────────────────────────────
  console.log("── API Endpoints ──");

  // Status endpoint
  await page.goto(`${BASE}/api/status`, { waitUntil: "networkidle" });
  await snap("api-status", "GET /api/status — health check endpoint");

  // Reviews API
  await page.goto(`${BASE}/api/reviews`, { waitUntil: "networkidle" });
  await snap("api-reviews", "GET /api/reviews — JSON list of all reviews");

  // Reviews with branch filter
  await page.goto(`${BASE}/api/reviews?branch=feature/login-redesign`, { waitUntil: "networkidle" });
  await snap("api-reviews-branch", "GET /api/reviews?branch=feature/login-redesign — branch filter");

  // Hooks suggest endpoint
  await page.goto(`${BASE}/api/hooks/suggest`, { waitUntil: "networkidle" });
  // This will be a 400 since it needs POST, but shows the endpoint exists
  await snap("api-hooks-suggest", "POST /api/hooks/suggest — hook suggestion endpoint (400 for GET, expects POST)");

  // ── 7. Back to reviews for the final shot ──────────────────────────────────
  console.log("── Final Shot ──");
  await page.goto(`${BASE}/reviews`, { waitUntil: "networkidle" });
  await snap("final-overview", "Final overview — Ranger dashboard with all review statuses");

  // Close and save video
  await page.close(); // triggers video save
  await context.close();
  await browser.close();

  console.log(`\n✅ Tour complete! ${step} screenshots + video saved to ${OUT}/\n`);
}

main().catch((err) => {
  console.error("Tour failed:", err);
  process.exit(1);
});
