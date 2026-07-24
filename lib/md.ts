// Безопасный рендер учебного Markdown (D-005): сначала полное экранирование
// HTML (XSS исключён), затем ограниченный набор преобразований + KaTeX для $…$.
import katex from "katex";

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderMath(s: string): string {
  // $$…$$ — блочные формулы, $…$ — строчные. Ошибки KaTeX не роняют страницу.
  return s
    .replace(/\$\$([^$]+)\$\$/g, (_, tex) => {
      try {
        return katex.renderToString(tex, { displayMode: true, throwOnError: false });
      } catch {
        return escapeHtml(tex);
      }
    })
    .replace(/\$([^$\n]+)\$/g, (_, tex) => {
      try {
        return katex.renderToString(tex, { displayMode: false, throwOnError: false });
      } catch {
        return escapeHtml(tex);
      }
    });
}

/** Markdown → безопасный HTML (заголовки, списки, жирный/курсив, код, формулы). */
export function mdToHtml(md: string): string {
  const lines = escapeHtml(md).split("\n");
  const out: string[] = [];
  let inUl = false;
  let inOl = false;
  const closeLists = () => {
    if (inUl) { out.push("</ul>"); inUl = false; }
    if (inOl) { out.push("</ol>"); inOl = false; }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) { closeLists(); out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); continue; }
    const ul = line.match(/^[-*]\s+(.*)$/);
    if (ul) { if (!inUl) { closeLists(); out.push("<ul>"); inUl = true; } out.push(`<li>${inline(ul[1])}</li>`); continue; }
    const ol = line.match(/^\d+[.)]\s+(.*)$/);
    if (ol) { if (!inOl) { closeLists(); out.push("<ol>"); inOl = true; } out.push(`<li>${inline(ol[1])}</li>`); continue; }
    if (line.trim() === "") { closeLists(); continue; }
    closeLists();
    out.push(`<p>${inline(line)}</p>`);
  }
  closeLists();
  return renderMath(out.join("\n"));
}

function inline(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

/** Рендер текста вопроса: экранирование + KaTeX + плейсхолдеры пропусков. */
export function promptToHtml(prompt: string): string {
  return renderMath(escapeHtml(prompt));
}
