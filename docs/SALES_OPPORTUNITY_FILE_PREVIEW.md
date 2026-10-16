# Opportunity File Preview Panel

Implemented locally on 1 October 2026 for the user's file double-click request.

## Excel, Word and Outlook extension

The subsequent user request adds `.xlsx`, `.docx` and `.msg` inside the same
panel. XLSX displays named sheets, formatted saved values, source row/column
addresses and 100-row navigation. Cached zero is retained; formulas without a
saved result say so. DOCX displays semantic headings, tables, paragraphs and
verified embedded raster images. MSG displays sender/recipients/sent time/body
and attachment names/sizes. Rich output is sanitized and sandboxed; no external
viewer or source URLs receive file contents. Message attachments remain inside
the original file, and RTF-only bodies have an explicit download fallback.

The worker terminates on close/scope/retry and after 30 seconds. Preview-only
budgets: 128 MiB source/expanded ZIP, 4096 ZIP/CFB entries, 50 sheets, 100000 source cells,
100000 rows/shared strings and 500000 XML elements. Table output is bounded to
2000 rows/100 columns per sheet, 100000 total displayed cells and 4 MiB text, with
visible truncation. Word HTML/images are bounded to 8 MiB; MSG projection to 4 MiB
and 500 recipients/attachments. ZIP CRC/actual expansion and MSG allocation/chain
validation precede downstream parsing. These bounds do not change upload or
original-download policy. The protected route still transfers full files.

Dependencies: official SheetJS 0.20.3 replaces vulnerable 0.18.5; Mammoth 1.13.0 and
MsgReader 1.28.0 cover the requested formats. DOMPurify 3.4.15 / fflate 0.8.3 are now
direct dependencies; Buffer 6.0.3 / string_decoder 1.3.0 provide narrow MSG browser
compatibility. There is no general Node runtime/polyfill or remote conversion.
See [SheetJS installation](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/),
[Mammoth security](https://github.com/mwilliamson/mammoth.js#security) and
[MSG browser configuration](https://github.com/HiraokaHyperTools/msgreader_demo/blob/master/webpack.config.js).

Word pagination/styles, spreadsheet charts/macros/calculation and RTF-only MSG
bodies are not represented as fully native Office features. Source bytes stay
unchanged; exact editing/layout is available through the original download.
The MSG reader cannot safely handle a miniFAT beginning at sector zero; that
otherwise valid uncommon layout receives an explicit download fallback before
parsing. Rich content uses a scriptless frame with strict CSP. Its only sandbox
allowance is same-origin access for the parent's Escape listener, which is
removed on reload/close.
Verification passed: 38 focused parser checks on Docker Node 24, 456 existing
Node checks, all 17 distinct Office browser cases across corrected runs, all 14
retained preview cases, scoped lint and the final production/PWA build (4m43s).
Desktop/mobile screenshots and accessibility checks passed for all three formats.
For scriptless Word/Outlook frames, the actual dialog was audited without frame
recursion and its actual sanitized document DOM was audited separately at the
rendered dimensions. Product script restrictions remain intact. Screenshots are
in `artifacts/opportunity-office-preview/`.

Existing Excel export browser cases and XLS/XLSX legend import round trips passed.
The older Estimate import browser test is blocked before import by its obsolete
heading selector; the host Node 22.20 Windows-1252 decoder also fails one encoding
fixture that passes in canonical Node 24. These verification limits are recorded
in the workspace brief. No backend changes, migration or deployment were performed.
The checks below record the previous PDF/image/text implementation.

Single click retains Document details. Double-click a file row/filename, press
Enter on its filename, or select Preview in Document details to open the modal.
Escape/Close restores focus and retains the selected folder/file and filters.
Folders keep their existing navigation. The modal unmounts on opportunity,
folder, provider or selected-file changes; closed requests cannot restore content.

The component obtains fresh scoped metadata and protected download bytes using
the existing Sales service. It checks file/folder/provider identity, download
capability and known size/filename before previewing. Optional AbortSignal support
is backward compatible with existing service callers. Explicit Download makes a
new guarded request; 401/403/404 clears the preview. Blob URLs are revoked on
retry, close and access denial. No server/schema change or public URL is involved.

PDF uses the existing local PDF.js viewer with actual pages, outline/thumbnails,
page controls and 50–300% fit-relative zoom. Images allow signature-verified
PNG/JPEG/GIF/WebP/BMP/AVIF. UTF-8 text is escaped and truncated at 256 KiB without
splitting a character; unsupported encodings and binary text show an error.
HTML/SVG, other unsupported Office formats, CAD and archives show an authorized
download fallback; XLSX/DOCX/MSG use the extension described above.
The original file bytes remain unchanged. This is file viewing, with no proposal
binding, feedback, approval or lifecycle mutation.

The protected download still transfers the entire file before preview. Text
truncation limits rendered text, not transfer size. Browser memory, deployment
timeouts and storage capacity remain practical limits for very large files.
No upload/download size policy or misleading unlimited-browser guarantee is added.

Verification: 13 Node helper checks passed; all 14 distinct focused preview
browser cases passed across the initial and corrected runs, plus 6 retained
RADAI-file and 3 shared proposal PDF regressions. Desktop/mobile Axe and scoped
ESLint passed. The ARIA correction gives the existing PDF annotation container
the group role required for its accessible label. The final production/PWA build
passed in 2m12s; its artifact includes that correction. Existing large-chunk and
outdated Browserslist warnings remain.

Exact commands and evidence are recorded in the cross-repository
[workspace feature brief](../../docs/features/sales-opportunity-workspace.md).
Browser fixtures use synthetic protected responses; they do not upload real
client documents or activate SharePoint. Screenshots are under
`artifacts/opportunity-preview/` in this repository.
