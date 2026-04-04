# AI News Digest

A CLI tool that fetches the latest AI news from multiple RSS/Atom feeds, summarizes each article with **Claude 3 Haiku** via OpenRouter, and writes a daily Markdown report.

---

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                        index.ts                             │
│                      (Entry Point)                          │
│                                                             │
│   CLI args parsed → --hours, --output-dir, --cron           │
└───────────────────────────┬─────────────────────────────────┘
                            │
              ┌─────────────▼──────────────┐
              │  Run once  │  --cron mode  │
              │  (exit)    │  (stay alive, │
              │            │   fire 8 AM)  │
              └─────────────┬──────────────┘
                            │ runDigest()
                            │
          ┌─────────────────▼──────────────────────┐
          │              fetcher.ts                 │
          │                                         │
          │  Fetch 3 feeds in parallel              │
          │  ┌────────────┐ ┌──────────┐ ┌───────┐ │
          │  │TechCrunch  │ │The Verge │ │Hacker │ │
          │  │    AI      │ │   AI     │ │ News  │ │
          │  └────────────┘ └──────────┘ └───────┘ │
          │                                         │
          │  Parse RSS 2.0 / Atom XML               │
          │  Filter by cutoff time                  │
          │  Strip HTML, extract description        │
          └─────────────────┬───────────────────────┘
                            │ Article[]
                            │
          ┌─────────────────▼───────────────────────┐
          │           Deduplication                  │
          │   (URL-based Set, first source wins)     │
          └─────────────────┬───────────────────────┘
                            │ unique Article[]
                            │
          ┌─────────────────▼───────────────────────┐
          │            summarizer.ts                 │
          │                                         │
          │  All articles summarized concurrently   │
          │  via Claude 3 Haiku (OpenRouter API)    │
          │                                         │
          │  Prompt → 1 sentence, max 30 words      │
          │  Fallback → raw feed description        │
          └─────────────────┬───────────────────────┘
                            │ Article[] (with summary)
                            │
          ┌─────────────────▼───────────────────────┐
          │            formatter.ts                  │
          │                                         │
          │  Sort newest-first                      │
          │  Build Markdown report                  │
          │  Write to output/YYYY-MM-DD.md          │
          └─────────────────────────────────────────┘
```

---

## Project Structure

```
src/
├── index.ts       Entry point — CLI parsing, orchestration, cron scheduling
├── fetcher.ts     HTTP fetch + XML parsing for RSS 2.0 and Atom feeds
├── summarizer.ts  Claude 3 Haiku summarization via OpenRouter API
├── formatter.ts   Markdown report builder
└── types.ts       Shared TypeScript interfaces
output/            Generated daily reports (gitignored)
logs/              Cron run logs (gitignored)
```

---

## Source Files Explained

### `types.ts`
Defines the three core data structures used across all modules:
- **`FeedConfig`** — a feed's name and URL
- **`Article`** — a parsed news item with title, link, time, source, and summaries
- **`FetchResult`** — the outcome of fetching one feed (articles or error)

### `fetcher.ts`
Handles all feed ingestion:
- Fetches raw XML over HTTP
- Parses both **RSS 2.0** (`rss.channel.item`) and **Atom** (`feed.entry`) formats
- Strips HTML tags and decodes entities from descriptions
- Filters out articles older than the cutoff window
- Truncates descriptions to 100 words to save AI tokens

### `summarizer.ts`
Calls the Claude 3 Haiku model for each article:
- Uses the Anthropic SDK pointed at OpenRouter's base URL
- Runs all articles concurrently with `Promise.allSettled`
- Falls back to the raw feed description if the API call fails — a single failure never blocks the whole digest

### `formatter.ts`
Builds the final Markdown report:
- Sorts articles newest-first
- Generates a stats summary table (total articles, sources, period)
- Renders each article as a Markdown section with title, source, timestamp, and AI summary

### `index.ts`
The main entry point and orchestrator:
- Parses CLI flags (`--hours`, `--output-dir`, `--cron`)
- Fetches all feeds **in parallel** and isolates per-feed failures
- Deduplicates articles across feeds by URL (first source wins)
- In `--cron` mode: stays alive and fires `runDigest()` every day at 08:00 AM using `node-cron`

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure API key
Create a `.env` file in the project root:
```
OPENROUTER_API_KEY=your_key_here
```
Get a key at [openrouter.ai](https://openrouter.ai).

---

## Usage

### Run once (immediate)
```bash
npx tsx src/index.ts
```

### Custom time window and output directory
```bash
npx tsx src/index.ts --hours 48 --output-dir my-reports
```

### Scheduled mode (every day at 8:00 AM)
```bash
npx tsx src/index.ts --cron
```

### Run in background via macOS launchd
```bash
launchctl load ~/Library/LaunchAgents/com.ai-news-digest.plist
launchctl start com.ai-news-digest        # trigger manually
launchctl unload ~/Library/LaunchAgents/com.ai-news-digest.plist  # disable
```
Logs are written to `logs/cron.log` and `logs/cron.error.log`.

---

## Output

Reports are saved to `output/YYYY-MM-DD.md`:

```markdown
# AI News Digest — 2026-04-04

## Summary

| | |
|---|---|
| Total articles | 41 |
| Sources (3) | TechCrunch AI, The Verge AI, Hacker News |
| Period | Last 24 hours |
| Generated | 2026-04-04 06:07 UTC |

---

### [Article Title](https://...)
- **Source:** TechCrunch AI
- **Published:** 2026-04-04 01:31 UTC
- **Summary:** One sentence AI-generated summary here.
```
