import fs from "node:fs";
import path from "node:path";

/**
 * Minimal markdown-to-HTML for our own policy docs (headings, lists,
 * paragraphs, bold, links). Not a general-purpose markdown renderer —
 * deliberately simple and dependency-free since these are our own
 * trusted files, not user input.
 */
export function renderLegalDoc(filename: string): string {
  const filePath = path.join(process.cwd(), "docs", "legal", filename);
  const raw = fs.readFileSync(filePath, "utf-8");

  const lines = raw.split("\n");
  const html: string[] = [];
  let inList = false;

  for (const line of lines) {
    const inline = (s: string) =>
      s
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\[(.+?)\]\((.+?)\)/g, '<a class="underline" href="$2">$1</a>');

    if (line.startsWith("# ")) {
      html.push(`<h1 class="text-2xl font-semibold">${inline(line.slice(2))}</h1>`);
    } else if (line.startsWith("## ")) {
      if (inList) { html.push("</ul>"); inList = false; }
      html.push(`<h2 class="mt-6 text-lg font-semibold">${inline(line.slice(3))}</h2>`);
    } else if (line.startsWith("- ")) {
      if (!inList) { html.push('<ul class="mt-2 list-inside list-disc space-y-1">'); inList = true; }
      html.push(`<li>${inline(line.slice(2))}</li>`);
    } else if (line.trim() === "") {
      if (inList) { html.push("</ul>"); inList = false; }
    } else if (line.startsWith("_") && line.endsWith("_")) {
      html.push(`<p class="mt-2 text-sm italic text-muted-foreground">${inline(line.slice(1, -1))}</p>`);
    } else {
      html.push(`<p class="mt-2 text-sm">${inline(line)}</p>`);
    }
  }
  if (inList) html.push("</ul>");

  return html.join("\n");
}
