/** Pure presentation of background ZIP extraction and document scan progress. */
export const ACTIVE = ["queued", "running"];

const percent = (done, total) =>
  total > 0 ? Math.min(100, Math.round((100 * done) / total)) : 0;

/** Live progress of ZIP extraction and document scanning for one opportunity. */
export function importProgress(row) {
  const done = (row.processed || 0) + (row.skipped || 0) + (row.failed || 0);
  const total = row.entries_total || 0;
  if (row.status === "queued")
    return { label: "Waiting to start…", value: 0, indeterminate: true };
  if (row.status === "running")
    return total
      ? {
          label: `Extracting ${done} of ${total} files`,
          value: percent(done, total),
        }
      : { label: "Opening the archive…", value: 0, indeterminate: true };
  const skipped = row.skipped ? `, ${row.skipped} skipped` : "";
  const failed = row.failed ? `, ${row.failed} failed` : "";
  return {
    label:
      row.status === "failed" && !row.processed
        ? "Extraction failed. Upload the ZIP again or contact your administrator."
        : `Extracted ${row.processed} files${skipped}${failed}`,
    value: 100,
    finished: true,
    failed: row.status === "failed",
  };
}

export function scanProgress(analysis) {
  if (!analysis || analysis.stale || !ACTIVE.includes(analysis.status))
    return null;
  const counts = analysis.counts || {};
  const total = counts.total || 0;
  const done = Math.max(0, total - (counts.queued || 0));
  if (done >= total && total) return null;
  return {
    label: total
      ? `Scanning documents ${done} of ${total}`
      : "Preparing the document scan…",
    value: percent(done, total),
    indeterminate: !total,
  };
}
