import Anthropic from "@anthropic-ai/sdk";
import type { Article } from "./types";

// Use the Anthropic SDK pointed at OpenRouter so we can access any model
// through a single API key. The defaultHeaders identify our app to OpenRouter.
const client = new Anthropic({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": "https://github.com/ai-news-digest",
    "X-Title": "AI News Digest",
  },
});

/**
 * Build the prompt sent to the AI for each article.
 * Keeping the prompt short and directive keeps output consistent and token usage low.
 */
const PROMPT = (title: string, description: string) =>
  `Given this article:
Title: ${title}
Description: ${description}

Write a single sentence (max 30 words) summarizing what this article is about.
Reply with only the sentence, no preamble.`;

/**
 * Summarize a single article using claude-3-haiku via OpenRouter.
 *
 * Falls back to the raw feed description if the API call fails,
 * so a network or quota error never blocks the whole digest run.
 */
async function summarizeOne(article: Article): Promise<Article> {
  // Prefer the stripped feed description as context; fall back to the title only.
  const input = article.rawDescription ?? article.title;
  try {
    const message = await client.messages.create({
      model: "anthropic/claude-3-haiku",
      max_tokens: 80,   // one sentence needs very few tokens
      messages: [
        { role: "user", content: PROMPT(article.title, input) },
      ],
    });
    const text =
      message.content[0].type === "text" ? message.content[0].text.trim() : "";
    return { ...article, summary: text || article.rawDescription };
  } catch (err) {
    console.error(`  [summarizer] ${article.title.slice(0, 50)}: ${err}`);
    // Graceful degradation: keep the article without an AI summary.
    return { ...article, summary: article.rawDescription };
  }
}

/**
 * Summarize all articles concurrently.
 * Uses Promise.allSettled so a single failure never rejects the entire batch.
 */
export async function summarizeArticles(articles: Article[]): Promise<Article[]> {
  const results = await Promise.allSettled(articles.map(summarizeOne));
  return results.map((r, i) =>
    r.status === "fulfilled" ? r.value : articles[i]
  );
}
