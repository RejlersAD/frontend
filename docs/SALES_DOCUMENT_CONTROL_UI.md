# Opportunity document types and revision controls

The file explorer has adjacent Document Type and Custom Tag columns. Document
Type uses the API's taxonomy and an accessible color palette, with a one-click
sparkle icon to request automatic classification. Short Auto, AI suggestion,
Manual, Queued and failure states distinguish provenance and progress. Format
icons, publication Status and custom category tags keep their existing meanings.
No classification dialog, reason form or extra navigation is required.

Click the Custom Tag badge or + Add tag to edit directly in its cell. Enter or
the check button saves; Escape or the cross cancels. Tags are optional plain
single-line text up to 80 characters. A tag-only command preserves the document
type; clearing the tag removes only the custom label. Background classification
and new file revisions preserve the saved tag. Metadata is independent of approval.

The AI icon uses the existing durable classification command: rules first, with
configured AI for ambiguous readable content. It does not promise that every
click calls a provider. Repeated clicks while pending are disabled. An uncertain
failed response retains its command UUID; a later deliberate request after a
completed success gets a new UUID even when the human metadata revision is unchanged.
Source capabilities still control every edit and classification request.

Bounded background polling does not reset selection, loaded pages or inline tag
drafts. Denied, failed and stale saves retain text; an explicit refresh obtains
current metadata without resubmitting. Tag and AI controls stop row click/double
click propagation, so editing does not open preview. Source evidence remains safe
text in the type badge's tooltip. Existing files require an explicit classification
request; there is no automatic historical-file import or scan.

Document details adds Upload new version when the backend permits it. The dialog
retains File/note/request identity on errors, shows upload progress and uses the
current head token. Successful creation refreshes the current row by stable
document identity. Replaying a successful older command cannot replace a newer
head in the UI. Version history provides preview/download through each exact
immutable file ID, preserving original proposal-review evidence. Historical
previews identify the selected version and reuse the existing protected viewer.

The six folders, folder tags, sidebar, header, existing upload queue and preview
formats remain in place. SharePoint exposes its existing native history and
external management; the new private version/classification commands are not
assumed to apply to that provider. No folder migration or synchronization occurs.

Verification and current activation state are recorded in the shared
[feature brief](../../docs/features/sales-document-classification-versions.md).
