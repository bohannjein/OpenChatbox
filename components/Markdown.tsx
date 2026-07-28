"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import CodeBlock from "./CodeBlock";

/** Extract raw text from react node tree (for the copy button). */
function nodeText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  // React element with children
  const el = node as { props?: { children?: React.ReactNode } };
  if (el.props?.children != null) return nodeText(el.props.children);
  return "";
}

function langFromChild(node: React.ReactNode): string | undefined {
  const el = node as { props?: { className?: string } };
  const cls = el?.props?.className ?? "";
  const m = /language-(\w+)/.exec(cls);
  return m?.[1];
}

const Markdown = memo(function Markdown({ content }: { content: string }) {
  return (
    <div className="prose-chat break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // Block code is wrapped in <pre><code>; render our styled block.
          pre({ children }) {
            const code = nodeText(children);
            const language = langFromChild(children);
            return (
              <CodeBlock code={code} language={language}>
                {children}
              </CodeBlock>
            );
          },
          a({ children, ...props }) {
            return (
              <a target="_blank" rel="noreferrer" {...props}>
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

export default Markdown;
