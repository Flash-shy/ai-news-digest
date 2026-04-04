export interface FeedConfig {
  source: string;
  url: string;
}

export interface Article {
  title: string;
  link: string;
  time: Date;
  source: string;
  rawDescription?: string;  // stripped text from the feed, used as summarizer input
  summary?: string;         // AI-generated one-sentence summary
}

export interface FetchResult {
  source: string;
  articles: Article[];
  error?: string;
}
