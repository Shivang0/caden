import type { ReactNode } from "react";

/**
 * Tiny dependency-free markdown renderer.
 * Supports: # / ## / ### headings, **bold**, *italic*, `inline code`,
 * [links](https://…), bullet lists (- or *), numbered lists (1.), fenced
 * code blocks (```), blockquotes (>), horizontal rules (---), and
 * paragraphs. Everything is parsed into React elements, no
 * dangerouslySetInnerHTML.
 */

const INLINE_TOKEN =
  /(\[[^\]]+\]\([^()\s]+\)|\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g;

const LINK_TOKEN = /^\[([^\]]+)\]\(([^()\s]+)\)$/;

/** Only http(s) links become anchors; anything else renders as plain text. */
function isSafeHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(INLINE_TOKEN);
  return parts
    .filter((part) => part.length > 0)
    .map((part, i) => {
      const key = `${keyPrefix}-i${i}`;
      const link = part.match(LINK_TOKEN);
      if (link && isSafeHref(link[2])) {
        return (
          <a
            key={key}
            href={link[2]}
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium text-[#f9fe2e] underline decoration-[#f9fe2e]/40 underline-offset-2 transition-colors hover:text-[#ffe042] hover:decoration-[#ffe042]/70"
          >
            {link[1]}
          </a>
        );
      }
      if (link) {
        // Unsafe scheme: show just the bracket text, never a live link.
        return <span key={key}>{link[1]}</span>;
      }
      if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
        return (
          <strong key={key} className="font-semibold text-[#f1f1f1]">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
        return (
          <code
            key={key}
            className="rounded-md bg-[#212121] px-1.5 py-0.5 font-mono text-[0.85em] text-[#f1f1f1]"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
        return (
          <em key={key} className="font-medium not-italic text-[#f1f1f1]">
            {part.slice(1, -1)}
          </em>
        );
      }
      return <span key={key}>{part}</span>;
    });
}

type Block =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "code"; lines: string[] }
  | { kind: "quote"; lines: string[] }
  | { kind: "hr" }
  | { kind: "p"; text: string };

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let codeLines: string[] | null = null;

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: "p", text: paragraph.join(" ") });
      paragraph = [];
    }
  };

  for (const raw of lines) {
    // Inside a fence, keep lines verbatim (indentation matters).
    if (codeLines !== null) {
      if (raw.trim().startsWith("```")) {
        blocks.push({ kind: "code", lines: codeLines });
        codeLines = null;
      } else {
        codeLines.push(raw);
      }
      continue;
    }

    const line = raw.trim();

    if (line.startsWith("```")) {
      flushParagraph();
      codeLines = [];
      continue;
    }

    if (line.length === 0) {
      flushParagraph();
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flushParagraph();
      blocks.push({ kind: "hr" });
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      blocks.push({
        kind: "heading",
        level: heading[1].length as 1 | 2 | 3,
        text: heading[2],
      });
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      const prev = blocks[blocks.length - 1];
      if (prev && prev.kind === "quote") {
        prev.lines.push(quote[1]);
      } else {
        blocks.push({ kind: "quote", lines: [quote[1]] });
      }
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      const prev = blocks[blocks.length - 1];
      if (prev && prev.kind === "ul") {
        prev.items.push(bullet[1]);
      } else {
        blocks.push({ kind: "ul", items: [bullet[1]] });
      }
      continue;
    }

    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    if (numbered) {
      flushParagraph();
      const prev = blocks[blocks.length - 1];
      if (prev && prev.kind === "ol") {
        prev.items.push(numbered[1]);
      } else {
        blocks.push({ kind: "ol", items: [numbered[1]] });
      }
      continue;
    }

    paragraph.push(line);
  }

  // Unterminated fence: render what we collected rather than dropping it.
  if (codeLines !== null) blocks.push({ kind: "code", lines: codeLines });
  flushParagraph();
  return blocks;
}

const HEADING_CLASSES: Record<1 | 2 | 3, string> = {
  1: "text-2xl font-medium tracking-tight text-[#f1f1f1] mt-9 mb-3.5 first:mt-0",
  2: "text-lg font-medium tracking-tight text-[#f1f1f1] mt-8 mb-2.5 border-b border-[#2a2a2a] pb-2 first:mt-0",
  3: "text-base font-medium text-[#f1f1f1] mt-6 mb-2 first:mt-0",
};

export function Markdown({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const blocks = parseBlocks(content);

  return (
    <div className={className}>
      {blocks.map((block, i) => {
        const key = `b${i}`;
        switch (block.kind) {
          case "heading": {
            const cls = HEADING_CLASSES[block.level];
            if (block.level === 1) {
              return (
                <h1 key={key} className={cls}>
                  {renderInline(block.text, key)}
                </h1>
              );
            }
            if (block.level === 2) {
              return (
                <h2 key={key} className={cls}>
                  {renderInline(block.text, key)}
                </h2>
              );
            }
            return (
              <h3 key={key} className={cls}>
                {renderInline(block.text, key)}
              </h3>
            );
          }
          case "ul":
            return (
              <ul
                key={key}
                className="my-3 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-[#b5b5b5] marker:text-[#8f8f8f]"
              >
                {block.items.map((item, j) => (
                  <li key={`${key}-li${j}`}>
                    {renderInline(item, `${key}-li${j}`)}
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol
                key={key}
                className="my-3 list-decimal space-y-1.5 pl-5 text-[15px] leading-relaxed text-[#b5b5b5] marker:text-[#8f8f8f]"
              >
                {block.items.map((item, j) => (
                  <li key={`${key}-li${j}`}>
                    {renderInline(item, `${key}-li${j}`)}
                  </li>
                ))}
              </ol>
            );
          case "code":
            return (
              <pre
                key={key}
                className="my-4 overflow-x-auto rounded-xl border border-[#2a2a2a] bg-[#161616] p-4 font-mono text-[13px] leading-relaxed text-[#cfcfcf]"
              >
                <code>{block.lines.join("\n")}</code>
              </pre>
            );
          case "quote":
            return (
              <blockquote
                key={key}
                className="my-4 border-l-2 border-[#f9fe2e]/50 pl-4 text-[15px] leading-relaxed text-[#b5b5b5]"
              >
                {block.lines.map((line, j) => (
                  <p key={`${key}-q${j}`} className="my-1">
                    {renderInline(line, `${key}-q${j}`)}
                  </p>
                ))}
              </blockquote>
            );
          case "hr":
            return (
              <hr key={key} className="my-6 border-t border-[#2a2a2a]" />
            );
          case "p":
            return (
              <p
                key={key}
                className="my-3.5 text-[15px] leading-relaxed text-[#b5b5b5] first:mt-0 last:mb-0"
              >
                {renderInline(block.text, key)}
              </p>
            );
        }
      })}
    </div>
  );
}
