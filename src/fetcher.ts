import { XMLParser } from "fast-xml-parser";
import type { FeedConfig, Article } from "./types";

// fast-xml-parser instance — ignoreAttributes:false preserves XML attributes
// like href on Atom <link> elements.
const parser = new XMLParser({ ignoreAttributes: false });

/**
 * Parse a date string from a feed field.
 * Returns null if the value is missing or not a valid date.
 */
function parseDate(raw: unknown): Date | null {
  if (!raw || typeof raw !== "string") return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Coerce a feed title/description field to a plain string.
 * RSS feeds return plain strings; Atom feeds may return objects like
 * { "#text": "...", "@_type": "html" }, so we unwrap those too.
 */
function extractText(field: unknown): string {
  if (!field) return "";
  if (typeof field === "string") return field;
  if (typeof field === "object") {
    const obj = field as Record<string, unknown>;
    return String(obj["#text"] ?? obj["@_type"] ?? "");
  }
  return String(field);
}

/**
 * Strip HTML tags and decode common HTML entities from a string.
 * Feed descriptions often contain inline HTML that would clutter the summary.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")   // remove all tags
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")       // collapse whitespace
    .trim();
}

/**
 * Extract a clean, truncated description (up to 100 words) from a raw feed field.
 * Truncating keeps AI summarizer token usage low while preserving enough context.
 */
function extractRawDescription(raw: unknown): string | undefined {
  const text = stripHtml(extractText(raw));
  if (!text) return undefined;
  return text.split(" ").slice(0, 100).join(" ");
}

/**
 * Fetch a single RSS or Atom feed and return articles published after `cutoff`.
 *
 * Supports:
 *   - RSS 2.0  (items live at rss.channel.item)
 *   - Atom 1.0 (entries live at feed.entry)
 *
 * Throws if the HTTP request fails so the caller can handle it gracefully.
 */
export async function fetchFeed(
  config: FeedConfig,
  cutoff: Date
): Promise<Article[]> {
  const res = await fetch(config.url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; ai-news-digest/1.0)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const xml = await res.text();
  const data = parser.parse(xml);

  // Normalise both RSS and Atom structures into a flat array of raw items.
  const rawItems: unknown[] = [
    data?.rss?.channel?.item ?? data?.feed?.entry ?? [],
  ].flat();

  const articles: Article[] = [];

  for (const item of rawItems) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;

    // Try all common date field names across RSS and Atom formats.
    const pubRaw =
      entry["pubDate"] ??      // RSS 2.0
      entry["published"] ??    // Atom
      entry["updated"] ??      // Atom fallback
      entry["dc:date"];        // Dublin Core extension
    const time = parseDate(pubRaw as string);

    // Skip articles older than the cutoff window.
    if (!time || time < cutoff) continue;

    // Atom <link> is an object with an href attribute; RSS is a plain string.
    const rawLink = entry["link"];
    const link =
      typeof rawLink === "string"
        ? rawLink
        : extractText((rawLink as Record<string, unknown>)?.["@_href"] ?? rawLink);

    // Try all common description field names.
    const descRaw =
      entry["description"] ??      // RSS 2.0
      entry["summary"] ??          // Atom
      entry["content"] ??          // Atom full content
      entry["content:encoded"];    // RSS extension for full HTML content

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
