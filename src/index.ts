#!/usr/bin/env tsx
// Load environment variables from .env before anything else.
import "dotenv/config";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import cron from "node-cron";
import type { FeedConfig, FetchResult } from "./types";
import { fetchFeed } from "./fetcher";
import { summarizeArticles } from "./summarizer";
import { buildReport } from "./formatter";

/** RSS/Atom feed sources to include in every digest run. */
const FEEDS: FeedConfig[] = [
  {
    source: "TechCrunch AI",
    url: "https://techcrunch.com/category/artificial-intelligence/feed/",
  },
  {
    source: "The Verge AI",
    url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
  },
  {
    source: "Hacker News",
    url: "https://hnrss.org/newest?q=AI&count=30",
  },
];

/**
 * Parse CLI arguments.
 *
 * Supported flags:
 *   --hours <n>        How many hours back to look for articles (default: 24)
 *   --output-dir <dir> Directory to write the markdown report (default: output)
 *   --cron             Stay alive and run automatically every day at 08:00 AM
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string, fallback: string) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : fallback;
  };
  return {
    hours: parseInt(get("--hours", "24"), 10),
    outputDir: get("--output-dir", "output"),
    cron: args.includes("--cron"),
  };
}

/**
 * Core digest pipeline:
 * 1. Fetch all feeds in parallel (failures are isolated per feed).
 * 2. Deduplicate articles across feeds by URL.
 * 3. Generate AI summaries for all unique articles.
 * 4. Write the markdown report to disk.
 */
async function runDigest(hours: number, outputDir: string) {
  const now = new Date();
  // Only include articles published within the last `hours` hours.
  const cutoff = new Date(now.getTime() - hours * 60 * 60 * 1000);

  console.log(`Fetching articles published after ${cutoff.toISOString()} ...\n`);

  // Fetch all feeds concurrently; Promise.allSettled ensures one failed feed
  // doesn't prevent the others from being processed.
  const settled = await Promise.allSettled(
    FEEDS.map((feed) => fetchFeed(feed, cutoff))
  );

  // Map settled results back to FetchResult, capturing any errors.
  const results: FetchResult[] = settled.map((r, i) => {
    if (r.status === "fulfilled") {
      return { source: FEEDS[i].source, articles: r.value };
    }
    return { source: FEEDS[i].source, articles: [], error: String(r.reason) };
  });

  for (const r of results) {
    if (r.error) {
      console.error(`  [ERROR] ${r.source}: ${r.error}`);
    } else {
      console.log(`  ${r.source}: ${r.articles.length} article(s)`);
    }
  }

  // Deduplicate across feeds using article URL as the key.
  // The first occurrence wins (feed order in FEEDS determines priority).
  const seen = new Set<string>();
  const allArticles = results.flatMap((r) => r.articles).filter((a) => {
    if (seen.has(a.link)) return false;
    seen.add(a.link);
    return true;
  });

  console.log(`\nGenerating AI summaries for ${allArticles.length} articles ...`);
  const summarized = await summarizeArticles(allArticles);
  console.log("Done.");

  // Write the report; mkdir is idempotent thanks to { recursive: true }.
  await mkdir(outputDir, { recursive: true });
  const filename = join(outputDir, `${now.toISOString().slice(0, 10)}.md`);
  await writeFile(filename, buildReport(summarized, now), "utf-8");

  console.log(`\nReport → ${filename}  (${summarized.length} total articles)`);
}

/**
 * Entry point.
 * In normal mode: run the digest once and exit.
 * In cron mode (--cron): schedule the digest at 08:00 AM daily and keep running.
 */
async function main() {
  const { hours, outputDir, cron: cronMode } = parseArgs();

  if (cronMode) {
    console.log("Cron mode enabled — digest will run every day at 08:00 AM.");
    // "0 8 * * *" = minute 0, hour 8, every day.
    cron.schedule("0 8 * * *", () => {
      console.log(`\n[${new Date().toISOString()}] Running scheduled digest ...`);
      runDigest(hours, outputDir).catch((err) => console.error(err));
    });
  } else {
    await runDigest(hours, outputDir);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
