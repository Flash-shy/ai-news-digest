/**
 * Configuration for a single RSS/Atom feed source.
 */
export interface FeedConfig {
  /** Human-readable name shown in the report (e.g. "TechCrunch AI"). */
  source: string;
  /** The RSS or Atom feed URL to fetch. */
  url: string;
}

/**
 * A single news article parsed from a feed.
 */
export interface Article {
  /** Headline of the article. */
  title: string;
  /** Canonical URL of the article — used for deduplication. */
  link: string;
  /** Publication timestamp from the feed. */
  time: Date;
  /** Feed source name (copied from FeedConfig.source). */
  source: string;
  /** Up to 100 words of plain text extracted from the feed description,
   *  passed to the AI summarizer as context. */
  rawDescription?: string;
  /** One-sentence AI-generated summary (max ~30 words). */
  summary?: string;
}

/**
 * The result of fetching one feed — either a list of articles or an error.
 */
export interface FetchResult {
  source: string;
  articles: Article[];
  /** Set when the fetch or parse step fails for this feed. */
  error?: string;
}
