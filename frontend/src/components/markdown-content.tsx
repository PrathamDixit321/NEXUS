"use client";

import React, { useState } from "react";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 text-slate-200 shadow-inner">
      <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-900/60 px-4 py-1.5 text-xs">
        <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
          {language || "code"}
        </span>
        <button
          onClick={handleCopy}
          className="rounded px-2 py-0.5 text-[11px] font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-slate-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function formatInline(text: string): React.ReactNode {
  // Regex splitting by code, bold, italic, links
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let keyIdx = 0;

  while (remaining.length > 0) {
    // Inline code `code`
    const codeMatch = remaining.match(/^([\s\S]*?)`([^`]+)`([\s\S]*)$/);
    // Bold **text**
    const boldMatch = remaining.match(/^([\s\S]*?)\*\*([^*]+)\*\*([\s\S]*)$/);
    // Italic *text*
    const italicMatch = remaining.match(/^([\s\S]*?)\*([^*]+)\*([\s\S]*)$/);

    let earliestIdx = Infinity;
    let earliestType = "";
    let matchObj: RegExpMatchArray | null = null;

    if (codeMatch && codeMatch[1].length < earliestIdx) {
      earliestIdx = codeMatch[1].length;
      earliestType = "code";
      matchObj = codeMatch;
    }
    if (boldMatch && boldMatch[1].length < earliestIdx) {
      earliestIdx = boldMatch[1].length;
      earliestType = "bold";
      matchObj = boldMatch;
    }
    if (italicMatch && italicMatch[1].length < earliestIdx) {
      earliestIdx = italicMatch[1].length;
      earliestType = "italic";
      matchObj = italicMatch;
    }

    if (!matchObj || earliestIdx === Infinity) {
      parts.push(remaining);
      break;
    }

    if (matchObj[1]) {
      parts.push(matchObj[1]);
    }

    if (earliestType === "code") {
      parts.push(
        <code
          key={`code-${keyIdx++}`}
          className="rounded bg-slate-100 border border-slate-200/80 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-indigo-700"
        >
          {matchObj[2]}
        </code>
      );
    } else if (earliestType === "bold") {
      parts.push(
        <strong key={`bold-${keyIdx++}`} className="font-semibold text-slate-900">
          {matchObj[2]}
        </strong>
      );
    } else if (earliestType === "italic") {
      parts.push(
        <em key={`italic-${keyIdx++}`} className="italic">
          {matchObj[2]}
        </em>
      );
    }

    remaining = matchObj[3];
  }

  return parts;
}

export function MarkdownContent({ content, className = "" }: MarkdownContentProps) {
  if (!content) return null;

  // Split into code blocks vs regular markdown
  const blocks: React.ReactNode[] = [];
  const lines = content.split("\n");
  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let codeLanguage = "";
  let textBuffer: string[] = [];
  let tableBuffer: string[] = [];

  const flushText = (key: string) => {
    if (textBuffer.length === 0) return;
    const currentParagraphs = textBuffer.join("\n").split("\n\n");
    currentParagraphs.forEach((para, idx) => {
      const trimmed = para.trim();
      if (!trimmed) return;

      // Header 1
      if (trimmed.startsWith("# ")) {
        blocks.push(
          <h2 key={`${key}-h1-${idx}`} className="mt-4 mb-2 text-base font-bold text-slate-900">
            {formatInline(trimmed.substring(2))}
          </h2>
        );
      }
      // Header 2
      else if (trimmed.startsWith("## ")) {
        blocks.push(
          <h3 key={`${key}-h2-${idx}`} className="mt-3 mb-1.5 text-sm font-bold text-slate-900">
            {formatInline(trimmed.substring(3))}
          </h3>
        );
      }
      // Header 3
      else if (trimmed.startsWith("### ")) {
        blocks.push(
          <h4 key={`${key}-h3-${idx}`} className="mt-2.5 mb-1 text-xs font-bold uppercase tracking-wider text-slate-700">
            {formatInline(trimmed.substring(4))}
          </h4>
        );
      }
      // Bullet list item
      else if (trimmed.startsWith("- ") || trimmed.startsWith("• ") || trimmed.startsWith("* ")) {
        const items = trimmed.split("\n");
        blocks.push(
          <ul key={`${key}-ul-${idx}`} className="my-2 space-y-1 pl-4 list-disc text-xs text-slate-700">
            {items.map((it, i) => (
              <li key={i}>{formatInline(it.replace(/^[-•*]\s+/, ""))}</li>
            ))}
          </ul>
        );
      }
      // Numbered list item
      else if (/^\d+\.\s/.test(trimmed)) {
        const items = trimmed.split("\n");
        blocks.push(
          <ol key={`${key}-ol-${idx}`} className="my-2 space-y-1 pl-4 list-decimal text-xs text-slate-700">
            {items.map((it, i) => (
              <li key={i}>{formatInline(it.replace(/^\d+\.\s+/, ""))}</li>
            ))}
          </ol>
        );
      }
      // Blockquote
      else if (trimmed.startsWith("> ")) {
        blocks.push(
          <blockquote
            key={`${key}-quote-${idx}`}
            className="my-2 border-l-3 border-indigo-500 bg-indigo-50/40 py-1.5 pl-3 text-xs italic text-slate-700 rounded-r"
          >
            {formatInline(trimmed.substring(2))}
          </blockquote>
        );
      }
      // Standard paragraph
      else {
        blocks.push(
          <p key={`${key}-p-${idx}`} className="my-1.5 text-xs leading-relaxed text-slate-700">
            {formatInline(trimmed)}
          </p>
        );
      }
    });
    textBuffer = [];
  };

  const flushTable = (key: string) => {
    if (tableBuffer.length < 2) {
      textBuffer.push(...tableBuffer);
      tableBuffer = [];
      return;
    }

    const rows = tableBuffer.map((r) =>
      r
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim())
    );

    // Filter separator row (| --- | --- |)
    const headerRow = rows[0];
    const dataRows = rows.slice(1).filter((r) => !r.every((c) => /^[-:]+$/.test(c)));

    blocks.push(
      <div key={`${key}-table`} className="my-3 overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-xs">
          <thead className="bg-slate-50 font-semibold text-slate-800">
            <tr>
              {headerRow.map((h, i) => (
                <th key={i} className="px-3.5 py-2 text-left font-mono text-[11px] uppercase tracking-wider text-slate-500">
                  {formatInline(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {dataRows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-slate-50/50 transition">
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="px-3.5 py-2 text-slate-700">
                    {formatInline(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableBuffer = [];
  };

  lines.forEach((line, lineIdx) => {
    // Code block fences
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        blocks.push(
          <CodeBlock
            key={`cb-${lineIdx}`}
            code={codeBuffer.join("\n")}
            language={codeLanguage}
          />
        );
        codeBuffer = [];
        codeLanguage = "";
        inCodeBlock = false;
      } else {
        if (tableBuffer.length > 0) flushTable(`pre-code-table-${lineIdx}`);
        if (textBuffer.length > 0) flushText(`pre-code-${lineIdx}`);
        codeLanguage = line.trim().substring(3).trim();
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      return;
    }

    // Markdown table detection
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      if (textBuffer.length > 0) flushText(`pre-table-${lineIdx}`);
      tableBuffer.push(line);
      return;
    } else if (tableBuffer.length > 0) {
      flushTable(`table-${lineIdx}`);
    }

    textBuffer.push(line);
  });

  if (inCodeBlock) {
    blocks.push(
      <CodeBlock
        key="cb-tail"
        code={codeBuffer.join("\n")}
        language={codeLanguage}
      />
    );
  }

  if (tableBuffer.length > 0) {
    flushTable("table-tail");
  }

  if (textBuffer.length > 0) {
    flushText("text-tail");
  }

  return <div className={`space-y-1 ${className}`}>{blocks}</div>;
}
