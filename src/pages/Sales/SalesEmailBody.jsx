import { createElement, useMemo } from "react";
import PropTypes from "prop-types";
import "./SalesEmailBody.css";

const ALLOWED_ELEMENTS = new Set([
  "p", "div", "br", "strong", "em", "u", "s", "ul", "ol", "li",
  "blockquote", "pre", "code", "h1", "h2", "h3", "h4", "h5", "h6",
  "table", "caption", "thead", "tbody", "tfoot", "tr", "th", "td", "hr", "a",
]);

const safeHref = (value) => {
  if (typeof value !== "string" || !value || value.length > 8192) return null;
  if (Array.from(value).some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) return null;
  try {
    const url = new URL(value);
    if (["http:", "https:"].includes(url.protocol) && url.hostname && !url.username && !url.password) return url.href;
    if (url.protocol === "mailto:" && url.pathname && !/%0[ad]/i.test(value)) return url.href;
  } catch {
    return null;
  }
  return null;
};

const boundedSpan = (value) =>
  Number.isInteger(value) && value >= 1 && value <= 100 ? value : undefined;

function renderStructuredContent(content) {
  if (!Array.isArray(content)) return null;
  let visited = 0;
  const renderNode = (node, key, depth) => {
    visited += 1;
    if (visited > 10000 || depth > 40) throw new Error("Email display limit reached.");
    if (!node || typeof node !== "object") throw new Error("Invalid email content.");
    if (node.type === "text") return typeof node.text === "string" ? node.text : "";
    if (!ALLOWED_ELEMENTS.has(node.type)) return null;
    if (node.children != null && !Array.isArray(node.children)) throw new Error("Invalid email content.");
    const nodes = node.children || [];
    const children = nodes.map((child, index) => renderNode(child, `${key}.${index}`, depth + 1));
    if (node.type === "a") {
      const href = safeHref(node.href);
      return href
        ? <a key={key} href={href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{children}</a>
        : <span key={key}>{children}</span>;
    }
    if (node.type === "table") {
      // Some email HTML has direct rows. Group those into tbody for valid React markup.
      const tableChildren = [];
      let rows = [];
      const flushRows = () => {
        if (rows.length) tableChildren.push(<tbody key={`${key}.rows.${tableChildren.length}`}>{rows}</tbody>);
        rows = [];
      };
      nodes.forEach((child, index) => {
        if (child.type === "tr") rows.push(children[index]);
        else {
          flushRows();
          // Whitespace between table sections is not an additional table child.
          if (!(child.type === "text" && !child.text?.trim())) tableChildren.push(children[index]);
        }
      });
      flushRows();
      return <div key={key} className="sales-email-table-scroll" role="region" aria-label="Email table" tabIndex={0}>
        <table>{tableChildren}</table>
      </div>;
    }
    const props = { key };
    if (node.type === "td" || node.type === "th") {
      props.colSpan = boundedSpan(node.col_span);
      props.rowSpan = boundedSpan(node.row_span);
    }
    // Email headings sit within the selected-message heading hierarchy.
    const element = /^h[1-6]$/.test(node.type) ? (Number(node.type[1]) <= 3 ? "h4" : "h5") : node.type;
    return createElement(element, props, ...(["br", "hr"].includes(element) ? [] : children));
  };
  try {
    return content.map((node, index) => renderNode(node, `body.${index}`, 0));
  } catch {
    return null;
  }
}

function plainTextLinks(value, key) {
  const pattern = /(?:https?:\/\/|mailto:)[^\s<>]+/gi;
  const parts = [];
  let offset = 0;
  for (const match of value.matchAll(pattern)) {
    const candidate = match[0].replace(/[.,;!?)]+$/, "");
    const href = safeHref(candidate);
    if (!href) continue;
    if (match.index > offset) parts.push(value.slice(offset, match.index));
    parts.push(<a key={`${key}.${match.index}`} href={href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{candidate}</a>);
    offset = match.index + candidate.length;
  }
  parts.push(value.slice(offset));
  return parts;
}

export default function SalesEmailBody({ bodyText, bodyContent }) {
  const structured = useMemo(() => renderStructuredContent(bodyContent), [bodyContent]);
  const plain = typeof bodyText === "string" ? bodyText.replace(/\r\n?/g, "\n") : "";
  return (
    <div className="sales-email-body">
      {structured?.some((node) => node !== null && node !== "")
        ? structured
        : plain.trim()
          ? plain.split(/\n[\t ]*\n+/).map((paragraph, index) => (
            <p key={index} className="sales-email-plain-paragraph">{plainTextLinks(paragraph, index)}</p>
          ))
          : <p className="text-slate-500">This email has no text content.</p>}
    </div>
  );
}

SalesEmailBody.propTypes = {
  bodyText: PropTypes.string,
  bodyContent: PropTypes.array,
};
SalesEmailBody.defaultProps = { bodyText: "", bodyContent: null };
