// Безопасный Markdown-рендер (D-005): экранирование первично, XSS исключён.
import { describe, it, expect } from "vitest";
import { mdToHtml, promptToHtml } from "@/lib/md";

describe("mdToHtml", () => {
  it("экранирует HTML — script не выживает", () => {
    const html = mdToHtml('<script>alert("x")</script> и <img src=x onerror=alert(1)>');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
  });
  it("рендерит заголовки, списки и инлайновые стили", () => {
    const html = mdToHtml("# Тақырып\n\n- бір\n- екі\n\n**жирный** и *курсив* и `код`");
    expect(html).toContain("<h1>Тақырып</h1>");
    expect(html).toContain("<li>бір</li>");
    expect(html).toContain("<strong>жирный</strong>");
    expect(html).toContain("<em>курсив</em>");
    expect(html).toContain("<code>код</code>");
  });
  it("нумерованный список", () => {
    const html = mdToHtml("1. алғашқы\n2. екінші");
    expect(html).toContain("<ol>");
    expect(html).toContain("<li>алғашқы</li>");
  });
  it("рендерит формулы KaTeX", () => {
    const html = mdToHtml("Шешім: $x^2 + 1$");
    expect(html).toContain("katex");
    expect(html).not.toContain("$x^2");
  });
});

describe("promptToHtml", () => {
  it("экранирует и рендерит формулы в тексте вопроса", () => {
    const html = promptToHtml("Есепте: $\\frac{3}{4}$ <b>тест</b>");
    expect(html).toContain("katex");
    expect(html).toContain("&lt;b&gt;");
  });
});
