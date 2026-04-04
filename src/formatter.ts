import type { Article } from "./types";

/** Format a Date as "YYYY-MM-DD HH:MM UTC" for display in the report. */
function formatUtc(date: Date): string {
  return date.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

/**
 * Build the final Markdown digest report.
 *
 * Structure:
 *   # AI News Digest — YYYY-MM-DD
 *   ## Summary  (stats table)
 *   ---
 *   ### [Article title](url)   (repeated for each article, newest first)
 *
 * Articles are sorted newest-first so the most recent news appears at the top.
 */
export function buildReport(articles: Article[], generatedAt: Date): string {
  // Sort a copy — newest publication time first.
  const sorted = [...articles].sort((a, b) => b.time.getTime() - a.time.getTime());

  // Collect unique source names for the summary table.
  const sourceNames = [...new Set(sorted.map((a) => a.source))];

  const statsRows = [
    `| Total articles | ${sorted.length} |`,
    `| Sources (${sourceNames.length}) | ${sourceNames.join(", ")} |`,
    `| Period | Last 24 hours |`,
    `| Generated | ${formatUtc(generatedAt)} |`,
  ];

  const header = [
    `# AI News Digest — ${generatedAt.toISOString().slice(0, 10)}`,
    "",
    "## Summary",
    "",
    "| | |",
    "|---|---|",
    ...statsRows,
    "",
    "---",
    "",
  ];

  // Render each article as a Markdown section with title link, metadata, and summary.
  const body = sorted.flatMap((a) => {
    const lines = [
      `### [${a.title}](${a.link})`,
      `- **Source:** ${a.source}`,
      `- **Published:** ${formatUtc(a.time)}`,
    ];
    if (a.summary) lines.push(`- **Summary:** ${a.summary}`);
    lines.push(""); // blank line between articles
    return lines;
  });

  return [...header, ...body].join("\n");
}
