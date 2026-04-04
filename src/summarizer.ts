import Anthropic from "@anthropic-ai/sdk";
import type { Article } from "./types";

const client = new Anthropic({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": "https://github.com/ai-news-digest",
    "X-Title": "AI News Digest",
  },
});

const PROMPT = (title: string, description: string) =>
  `Given this article:
Title: ${title}
Description: ${description}

Write a single sentence (max 30 words) summarizing what this article is about.
Reply with only the sentence, no preamble.`;

async function summarizeOne(article: Article): Promise<Article> {
  const input = article.rawDescription ?? article.title;
  try {
    const message = await client.messages.create({
      model: "anthropic/claude-3-haiku",
      max_tokens: 80,
      messages: [
        { role: "user", content: PROMPT(article.title, input) },
      ],
    });
    const text =
      message.content[0].type === "text" ? message.content[0].text.trim() : "";
    return { ...article, summary: text || article.rawDescription };
  } catch (err) {
    console.error(`  [summarizer] ${article.title.slice(0, 50)}: ${err}`);
    return { ...article, summary: article.rawDescription };
  }
}

export async function summarizeArticles(articles: Article[]): Promise<Article[]> {
  const results = await Promise.allSettled(articles.map(summarizeOne));
  return results.map((r, i) =>
    r.status === "fulfilled" ? r.value : articles[i]
  );
}
