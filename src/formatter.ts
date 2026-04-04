import type { Article } from "./types";

function formatUtc(date: Date): string {
  return date.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

export function buildReport(articles: Article[], generatedAt: Date): string {
  const sorted = [...articles].sort((a, b) => b.time.getTime() - a.time.getTime());

  // --- Statistical summary ---
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

  // --- Article list ---
  const body = sorted.flatMap((a) => {
    const lines = [
      `### [${a.title}](${a.link})`,
      `- **Source:** ${a.source}`,
      `- **Published:** ${formatUtc(a.time)}`,
    ];
    if (a.summary) lines.push(`- **Summary:** ${a.summary}`);
    lines.push("");
    return lines;
  });

  return [...header, ...body].join("\n");
}
