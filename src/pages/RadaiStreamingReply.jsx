import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy, Cpu, FileSearch, Shuffle } from "lucide-react";

// The Rejlers triangle mark, drawn in the current text colour so it follows light and dark themes.
export function RejlersMark({ size = 18, className = "" }) {
  return (
    <svg className={className} width={size} height={size} viewBox="40 55 420 400" fill="none" aria-hidden="true" focusable="false">
      <path d="M285 172 L77 410 H410 V90" stroke="currentColor" strokeWidth="48" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

RejlersMark.propTypes = { size: PropTypes.number, className: PropTypes.string };

const codeText = (node) => {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(codeText).join("");
  return node?.props ? codeText(node.props.children) : "";
};

// Code in a dark console card with its language and a copy button.
function CodeBlock({ children }) {
  const [copied, setCopied] = useState(false);
  const code = Array.isArray(children) ? children[0] : children;
  const language = /language-([\w+#-]+)/.exec(code?.props?.className || "")?.[1] || "code";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(codeText(code).replace(/\n$/, ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="radai-ai-code">
      <div className="radai-ai-code-bar">
        <span>{language}</span>
        <button type="button" onClick={copy} aria-label={copied ? "Code copied" : "Copy code"}>
          {copied ? <Check size={13} /> : <Copy size={13} />}{copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre>{children}</pre>
    </div>
  );
}

CodeBlock.propTypes = { children: PropTypes.node };

// Small labels under the answer heading: which model answered and what evidence it used.
export function AnswerMeta({ message }) {
  const sources = message.sources || [];
  const web = sources.filter((source) => source.kind === "web").length;
  const documents = sources.length - web;
  const evidence = [documents && `${documents} document source${documents === 1 ? "" : "s"}`, web && `${web} web source${web === 1 ? "" : "s"}`].filter(Boolean).join(" · ");
  const skipped = message.token_usage?.fallback_from || [];
  const switched = skipped.length
    ? skipped.map((row) => `${PROVIDER_NAMES[row.provider] || row.provider} (${row.model}): ${FALLBACK_REASONS[row.reason] || FALLBACK_REASONS.unavailable}`).join("\n")
    : "";
  return (
    <div className="radai-ai-meta">
      {message.model && <span title="Model that wrote this answer"><Cpu size={12} aria-hidden="true" />{message.model}</span>}
      {skipped.length > 0 && (
        <span className="radai-ai-meta-fallback" title={`RADAI switched model automatically.\n${switched}`}>
          <Shuffle size={12} aria-hidden="true" />
          Switched from {PROVIDER_NAMES[skipped[0].provider] || skipped[0].provider}
          <span className="sr-only">. {switched}</span>
        </span>
      )}
      <span title="Evidence supplied with the question"><FileSearch size={12} aria-hidden="true" />{evidence || "General knowledge"}</span>
    </div>
  );
}

const PROVIDER_NAMES = { anthropic: "Claude", openai: "OpenAI", gemini: "Gemini", ollama: "Local model" };
const FALLBACK_REASONS = {
  limit: "usage limit or credit reached",
  credentials: "key was rejected",
  not_configured: "not configured",
  unavailable: "unavailable",
};

AnswerMeta.propTypes = {
  message: PropTypes.shape({
    model: PropTypes.string,
    sources: PropTypes.array,
    token_usage: PropTypes.shape({ fallback_from: PropTypes.array }),
  }).isRequired,
};

// Markdown styling shared by saved answers and the answer being written.
export const answerMarkdownComponents = {
  h1: ({ children }) => <h1 className="mt-4 mb-2 text-base font-semibold">{children}</h1>,
  h2: ({ children }) => <h2 className="mt-4 mb-2 text-sm font-semibold">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-3 mb-1 font-semibold">{children}</h3>,
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 list-disc pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal pl-5">{children}</ol>,
  pre: CodeBlock,
  table: ({ children }) => <div className="radai-ai-table my-2 overflow-x-auto"><table className="w-full border-collapse text-xs">{children}</table></div>,
  th: ({ children }) => <th className="p-2 text-left">{children}</th>,
  td: ({ children }) => <td className="p-2">{children}</td>,
};

const reducedMotion = () => typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

// Reveal streamed text a few words at a time on animation frames. The pace rises with the backlog,
// so the screen is never more than about half a second behind what has arrived. Only whole words
// are shown while more text is coming. With reduced motion, text appears as it arrives.
const BASE_CHARS_PER_MS = 0.07; // about 14 words a second
const MAX_LAG_MS = 450;

export function useSmoothReveal(target) {
  const [shown, setShown] = useState(() => (reducedMotion() ? target : ""));
  const state = useRef({ length: 0, carry: 0, last: 0, frame: 0, target });

  useEffect(() => {
    const s = state.current;
    s.target = target;
    if (target.length < s.length) s.length = 0;
    if (reducedMotion()) {
      s.length = target.length;
      setShown(target);
      return;
    }
    if (s.frame) return;
    const tick = (now) => {
      const elapsed = s.last ? Math.min(now - s.last, 100) : 16;
      s.last = now;
      const text = s.target;
      const boundary = Math.max(text.search(/\s\S*$/) + 1, 0) || text.length; // end of the last whole word
      const limit = /\s$/.test(text) ? text.length : boundary;
      const backlog = limit - s.length;
      if (backlog <= 0) {
        s.frame = 0;
        s.last = 0;
        return;
      }
      s.carry += elapsed * Math.max(BASE_CHARS_PER_MS, backlog / MAX_LAG_MS);
      if (s.carry >= 1) {
        let next = Math.min(limit, s.length + Math.floor(s.carry));
        s.carry -= Math.floor(s.carry);
        const wordEnd = text.slice(next).search(/\s/); // finish the word being revealed
        if (wordEnd > 0) next = Math.min(limit, next + wordEnd);
        if (next > s.length) {
          s.length = next;
          setShown(text.slice(0, next));
        }
      }
      s.frame = requestAnimationFrame(tick);
    };
    s.frame = requestAnimationFrame(tick);
  }, [target]);

  useEffect(() => () => {
    cancelAnimationFrame(state.current.frame);
    state.current.frame = 0;
  }, []);

  return shown;
}

// An unclosed ``` fence would turn the rest of the answer into code until the closing fence arrives;
// close it in the rendered copy so code blocks keep their layout while they are written.
const closeOpenFence = (text) => ((text.match(/^\s*(```|~~~)/gm) || []).length % 2 ? `${text}\n\`\`\`` : text);

export default function RadaiStreamingReply({ text }) {
  const shown = useSmoothReveal(text);
  const root = useRef(null);
  const following = useRef(true);

  // Keep the newest words in view unless the reader has scrolled up.
  useEffect(() => {
    const scroller = root.current?.closest(".radai-ai-main");
    if (!scroller) return undefined;
    const onScroll = () => {
      following.current = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 120;
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    const scroller = root.current?.closest(".radai-ai-main");
    if (scroller && following.current) scroller.scrollTop = scroller.scrollHeight;
  }, [shown]);

  return (
    <div ref={root} className="radai-ai-assistant-message max-w-[90%]" aria-busy="true">
      <div className="radai-ai-assistant-heading"><span><RejlersMark size={18} /></span><strong>RADAI Intelligence</strong></div>
      <div className="radai-ai-answer-card">
        {shown ? (
          <div className="radai-ai-streaming text-sm leading-7 break-words">
            <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={answerMarkdownComponents}>
              {closeOpenFence(shown)}
            </ReactMarkdown>
          </div>
        ) : (
          <p className="radai-ai-thinking text-sm leading-7 text-[var(--rd-text-muted)]">
            <span className="sr-only">RADAI Intelligence is writing an answer</span>
            <span aria-hidden="true" className="radai-ai-thinking-dots"><i /><i /><i /></span>
          </p>
        )}
      </div>
    </div>
  );
}

RadaiStreamingReply.propTypes = {
  text: PropTypes.string.isRequired,
};
