#!/usr/bin/env tsx
import "dotenv/config";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import cron from "node-cron";
import type { FeedConfig, FetchResult } from "./types";
import { fetchFeed } from "./fetcher";
import { summarizeArticles } from "./summarizer";
import { buildReport } from "./formatter";

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

async function runDigest(hours: number, outputDir: string) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - hours * 60 * 60 * 1000);

  console.log(`Fetching articles published after ${cutoff.toISOString()} ...\n`);

  const settled = await Promise.allSettled(
    FEEDS.map((feed) => fetchFeed(feed, cutoff))
  );

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

  const allArticles = results.flatMap((r) => r.articles);

  console.log(`\nGenerating AI summaries for ${allArticles.length} articles ...`);
  const summarized = await summarizeArticles(allArticles);
  console.log("Done.");

  await mkdir(outputDir, { recursive: true });
  const filename = join(outputDir, `${now.toISOString().slice(0, 10)}.md`);
  await writeFile(filename, buildReport(summarized, now), "utf-8");

  console.log(`\nReport → ${filename}  (${summarized.length} total articles)`);
}

async function main() {
  const { hours, outputDir, cron: cronMode } = parseArgs();

  if (cronMode) {
    console.log("Cron mode enabled — digest will run every day at 08:00 AM.");
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
