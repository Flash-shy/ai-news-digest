import Anthropic from "@anthropic-ai/sdk";
import type { Article } from "./types";

const BASE_URL = process.env.BASE_URL ?? "https://ai.xiaoye.io/v1";
const FORMAT = process.env.API_FORMAT ?? "openai";

const anthropicClient = FORMAT === "anthropic"
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, baseURL: BASE_URL })
  : null;

const PROMPT = (title: string, description: string) =>
  `Given this article:
Title: ${title}
Description: ${description}

Write a single sentence (max 30 words) summarizing what this article is about.
Reply with only the sentence, no preamble.`;

async function summarizeWithOpenAI(title: string, input: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-5.3-codex",
      max_tokens: 80,
      messages: [{ role: "user", content: PROMPT(title, input) }],
    }),
  });
  const data = await res.json() as any;
  return data?.choices?.[0]?.message?.content?.trim() ?? "";
}

async function summarizeWithAnthropic(title: string, input: string): Promise<string> {
  const message = await anthropicClient!.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
    max_tokens: 80,
    messages: [{ role: "user", content: PROMPT(title, input) }],
  });
  return message.content[0].type === "text" ? message.content[0].text.trim() : "";
}

async function summarizeOne(article: Article): Promise<Article> {
  const input = article.rawDescription ?? article.title;
  try {
    const text = FORMAT === "anthropic"
      ? await summarizeWithAnthropic(article.title, input)
      : await summarizeWithOpenAI(article.title, input);
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
