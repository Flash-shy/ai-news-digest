import { XMLParser } from "fast-xml-parser";
import type { FeedConfig, Article } from "./types";

const parser = new XMLParser({ ignoreAttributes: false });

function parseDate(raw: unknown): Date | null {
  if (!raw || typeof raw !== "string") return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

/** Coerce a feed title field to a plain string (RSS and Atom differ). */
function extractText(field: unknown): string {
  if (!field) return "";
  if (typeof field === "string") return field;
  if (typeof field === "object") {
    const obj = field as Record<string, unknown>;
    return String(obj["#text"] ?? obj["@_type"] ?? "");
  }
  return String(field);
}

/** Strip HTML tags and decode common entities. */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract and clean up to 100 words from a feed description field. */
function extractRawDescription(raw: unknown): string | undefined {
  const text = stripHtml(extractText(raw));
  if (!text) return undefined;
  return text.split(" ").slice(0, 100).join(" ");
}

export async function fetchFeed(
  config: FeedConfig,
  cutoff: Date
): Promise<Article[]> {
  const res = await fetch(config.url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const xml = await res.text();
  const data = parser.parse(xml);

  // RSS 2.0 → channel.item  |  Atom → feed.entry
  const rawItems: unknown[] = [
    data?.rss?.channel?.item ?? data?.feed?.entry ?? [],
  ].flat();

  const articles: Article[] = [];

  for (const item of rawItems) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;

    const pubRaw =
      entry["pubDate"] ??
      entry["published"] ??
      entry["updated"] ??
      entry["dc:date"];
    const time = parseDate(pubRaw as string);
    if (!time || time < cutoff) continue;

    const rawLink = entry["link"];
    const link =
      typeof rawLink === "string"
        ? rawLink
        : extractText((rawLink as Record<string, unknown>)?.["@_href"] ?? rawLink);

    const descRaw =
      entry["description"] ??
      entry["summary"] ??
      entry["content"] ??
      entry["content:encoded"];

    articles.push({
      title: extractText(entry["title"]) || "(no title)",
      link,
      time,
      source: config.source,
      rawDescription: extractRawDescription(descRaw),
    });
  }

  return articles;
}
