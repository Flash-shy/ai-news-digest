import { Resend } from "resend";
import { marked } from "marked";
import type { Article } from "./types";

const resend = new Resend(process.env.RESEND_API_KEY);

function buildHtml(markdown: string, date: string): string {
  const body = marked(markdown) as string;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 720px; margin: 0 auto; padding: 24px; color: #1a1a1a; background: #f9f9f9; }
  h1 { font-size: 1.6rem; color: #111; border-bottom: 2px solid #4f46e5; padding-bottom: 8px; }
  h2 { font-size: 1.1rem; color: #4f46e5; margin-top: 28px; }
  h3 { font-size: 1rem; margin-bottom: 4px; }
  h3 a { color: #1d4ed8; text-decoration: none; }
  h3 a:hover { text-decoration: underline; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
  td { padding: 8px 14px; font-size: 0.9rem; border-bottom: 1px solid #eee; }
  td:first-child { color: #666; width: 140px; }
  ul { list-style: none; padding: 0; margin: 4px 0 16px; }
  li { font-size: 0.9rem; color: #444; padding: 2px 0; }
  li strong { color: #111; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 20px 0; }
  .footer { font-size: 0.78rem; color: #aaa; margin-top: 32px; text-align: center; }
</style>
</head>
<body>
${body}
<div class="footer">AI News Digest · Generated ${date}</div>
</body>
</html>`;
}

export async function sendDigestEmail(markdown: string, articles: Article[], date: string): Promise<void> {
  const to = process.env.EMAIL_TO ?? "shy971008@gmail.com";
  const html = buildHtml(markdown, date);

  const { error } = await resend.emails.send({
    from: "AI News Digest <onboarding@resend.dev>",
    to,
    subject: `AI News Digest — ${date} (${articles.length} articles)`,
    html,
  });

  if (error) throw new Error(`Email send failed: ${error.message}`);
  console.log(`Email sent to ${to}`);
}
