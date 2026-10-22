# RADAI UI Design Instructions

All RADAI feature screens must use the design tokens and component classes
defined in [`src/styles/radai-tokens.css`](../src/styles/radai-tokens.css).
Do **not** introduce ad-hoc hex colours, inline font stacks, or one-off
component styles — extend the token file instead.

## Tokens (`--rd-*`)

| Group | Tokens |
|---|---|
| Brand | `--rd-primary`, `--rd-primary-hover`, `--rd-primary-soft`, `--rd-accent` |
| Semantic | `--rd-success/-warning/-orange/-danger/-info` (+ `-soft` background variants) |
| Surfaces | `--rd-bg`, `--rd-surface`, `--rd-surface-subtle`, `--rd-border`, `--rd-border-soft` |
| Text | `--rd-text`, `--rd-text-muted`, `--rd-text-faint` |
| Type | `--rd-font-sans`, `--rd-font-mono` (line numbers & codes), size steps `--rd-text-*` |
| Shape | `--rd-radius-control`, `--rd-radius-panel`, `--rd-shadow-card`, `--rd-shadow-overlay` |
| Metrics | `--rd-touch` (44 px minimum target), `--rd-drawer-width`, `--rd-focus` |

Dark mode: every token has a `.dark` override (Tailwind `darkMode: 'class'`).
Never hard-code a light-only colour.

## Component classes (`.rd-*`)

- Buttons: `.rd-btn` + `.rd-btn-primary | -secondary | -ghost`, `.rd-btn-sm`
- Cards: `.rd-card`, `.rd-card-header`, `.rd-card-body`
- KPI: `.rd-kpi`, `.rd-kpi-value`, `.rd-kpi-label`
- Pills: `.rd-pill` + `-success | -warning | -orange | -danger | -info | -neutral`
- Banners: `.rd-banner` + `-warning | -danger | -info`
- Tabs: `.rd-tab`, `.rd-tab-active` (underline style, live counts via pills)
- Forms: `.rd-input`, `.rd-select`, `.rd-input-error`
- Tables: `.rd-table` (dense, sticky header)
- Overlays: `.rd-drawer(-backdrop/-header/-body/-footer)`, `.rd-modal(-backdrop)`
- Upload: `.rd-dropzone`, `.rd-dropzone-active`
- Loading: `.rd-skeleton`
- Utilities: `.rd-mono`, `.rd-text-muted`, `.rd-page`

## Rules

1. One primary action per region; everything else is secondary/ghost.
2. Status is never conveyed by colour alone — pills always include a text label.
3. Details open in drawers (right, 520 px); resolutions/edits in modals.
   No permanent side detail columns.
4. Layouts must work from 1280 px to 1920 px; tables scroll internally.
5. Every screen ships empty, loading (skeleton), error and no-results states.
6. Minimum touch target 44 px; keyboard-focus visible via `--rd-focus`.
