import React, { useMemo, useState } from "react";

const overlayCard = {
  background: "var(--rd-surface, #fff)",
  borderRadius: 8,
  boxShadow: "var(--rd-shadow-overlay, 0 20px 50px -12px rgba(15,23,42,0.35))",
  border: "1px solid var(--rd-border-soft, #e2e8f0)",
  color: "var(--rd-text, #0f172a)",
};

/**
 * Floating model tree (top-left). Groups by Type, or by System when the
 * Colour-by mode is "system". Clicking a tag selects + frames the item.
 */
export function ModelTreeOverlay({
  items,
  groupBy = "type",
  selectedTag,
  onSelect,
}) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [closedGroups, setClosedGroups] = useState(() => new Set());

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matching = q
      ? items.filter(
          (item) =>
            item.tag.toLowerCase().includes(q) ||
            (item.description || "").toLowerCase().includes(q),
        )
      : items;
    const map = new Map();
    for (const item of matching) {
      let keys;
      if (groupBy === "system") {
        keys = item.systems?.length ? item.systems : ["No system"];
      } else {
        keys = [item.unparsed ? "Unparsed" : item.typeLabel || "Unknown"];
      }
      for (const key of keys) {
        if (!map.has(key)) map.set(key, []);
        if (!map.get(key).includes(item)) map.get(key).push(item);
      }
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [items, groupBy, query]);

  const toggleGroup = (key) =>
    setClosedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div
      style={{
        ...overlayCard,
        position: "absolute",
        top: 12,
        left: 12,
        width: 270,
        maxHeight: "calc(100% - 24px)",
        display: "flex",
        flexDirection: "column",
        zIndex: 10,
        fontSize: 13,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 10px",
          borderBottom: "1px solid var(--rd-border-soft, #e2e8f0)",
        }}
      >
        <strong style={{ fontSize: 13 }}>Model tree</strong>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand model tree" : "Collapse model tree"}
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            color: "var(--rd-text-muted, #475569)",
            fontSize: 14,
          }}
        >
          {collapsed ? "▸" : "▾"}
        </button>
      </div>
      {!collapsed && (
        <>
          <div style={{ padding: 8 }}>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tag or description…"
              aria-label="Search tag or description"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "6px 8px",
                fontSize: 13,
                borderRadius: 6,
                border: "1px solid var(--rd-border, #cbd5e1)",
                background: "var(--rd-surface, #fff)",
                color: "var(--rd-text, #0f172a)",
              }}
            />
          </div>
          <div style={{ overflowY: "auto", padding: "0 6px 8px" }}>
            {groups.map(([name, groupItems]) => (
              <div key={name} style={{ marginBottom: 4 }}>
                <button
                  type="button"
                  onClick={() => toggleGroup(name)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    width: "100%",
                    border: "none",
                    background: "var(--rd-surface-subtle, #f1f5f9)",
                    borderRadius: 6,
                    padding: "5px 8px",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 12,
                    color: "var(--rd-text, #0f172a)",
                  }}
                >
                  <span>
                    {closedGroups.has(name) ? "▸ " : "▾ "}
                    {name}
                  </span>
                  <span style={{ color: "var(--rd-text-faint, #94a3b8)" }}>
                    {groupItems.length}
                  </span>
                </button>
                {!closedGroups.has(name) &&
                  groupItems.map((item) => (
                    <button
                      type="button"
                      key={item.tag}
                      onClick={() => onSelect?.(item)}
                      title={item.description || item.tag}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        border: "none",
                        background:
                          item.tag === selectedTag
                            ? "var(--rd-primary-soft, #eef2ff)"
                            : "transparent",
                        color: "var(--rd-text, #0f172a)",
                        borderRadius: 4,
                        padding: "4px 8px 4px 20px",
                        cursor: "pointer",
                        fontSize: 12,
                        fontFamily: "var(--rd-font-mono, monospace)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.tag}
                    </button>
                  ))}
              </div>
            ))}
            {groups.length === 0 && (
              <div
                style={{
                  padding: 12,
                  color: "var(--rd-text-faint, #94a3b8)",
                  textAlign: "center",
                }}
              >
                No matches.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
