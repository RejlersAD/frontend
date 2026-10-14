const normalizePathname = (pathname) => pathname.replace(/\/+$/, "") || "/";

/**
 * Select one destination from the already permission-filtered sidebar menu.
 * More specific paths win; query-specific links win ties on the same path.
 * Ancestor IDs let collapsed groups retain the active destination's highlight.
 */
export const getActiveSidebarItem = (menu, location = {}) => {
  const pathname = normalizePathname(location.pathname || "/");
  const searchParams = new URLSearchParams(location.search || "");
  let bestMatch = null;

  const visit = (items, sectionId = null, subsectionId = null) => {
    for (const item of items || []) {
      if (!item || item.enabled === false || item.hidden === true) continue;

      if (item.type === "section" || item.type === "subsection") {
        visit(
          item.children,
          item.type === "section" ? item.id : sectionId,
          item.type === "subsection" ? item.id : null,
        );
        continue;
      }

      // Sidebar destinations are internal absolute paths, never external URLs.
      if (typeof item.path !== "string" || !/^\/(?!\/)/.test(item.path)) continue;
      const [pathAndSearch] = item.path.split("#");
      const queryStart = pathAndSearch.indexOf("?");
      const targetPath = normalizePathname(
        queryStart < 0 ? pathAndSearch : pathAndSearch.slice(0, queryStart),
      );
      const targetParams = new URLSearchParams(
        queryStart < 0 ? "" : pathAndSearch.slice(queryStart + 1),
      );

      // Sales overview has always matched only its own page.
      const exact = item.exact === true || targetPath === "/sales" || targetPath === "/";
      const matchesPath =
        pathname === targetPath ||
        (!exact && pathname.startsWith(`${targetPath}/`));
      if (!matchesPath) continue;

      const queryEntries = [...targetParams.entries()];
      if (!queryEntries.every(([key, value]) => searchParams.get(key) === value)) continue;

      const pathLength = targetPath.length;
      const queryCount = queryEntries.length;
      if (
        !bestMatch ||
        pathLength > bestMatch.pathLength ||
        (pathLength === bestMatch.pathLength && queryCount > bestMatch.queryCount)
      ) {
        bestMatch = { itemId: item.id, sectionId, subsectionId, pathLength, queryCount };
      }
    }
  };

  visit(menu);
  return {
    itemId: bestMatch?.itemId ?? null,
    sectionId: bestMatch?.sectionId ?? null,
    subsectionId: bestMatch?.subsectionId ?? null,
  };
};
