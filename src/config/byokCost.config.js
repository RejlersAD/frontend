/**
 * byokCost.config.js — soft-coded BYOK cost transparency.
 *
 * Shows the user an up-front ESTIMATED cost of running an AI-Vision
 * extraction on their own key (Bring Your Own Key), for accountability,
 * before they spend anything. Purely presentational — no extraction,
 * upload or billing logic is touched.
 *
 * Pricing is BLENDED $ per 1M tokens (input+output weighted ~70/30) —
 * update the numbers here when provider pricing changes; no JSX edits
 * needed. Set `enabled:false` to hide the estimate everywhere.
 */

export const BYOK_COST_CONFIG = {
  enabled:         true,
  currencySymbol:  '$',
  // Blended price per 1M tokens, per provider (soft-coded).
  pricing: {
    claude: { label: 'Claude (Anthropic)', per1MTokens: 6.90 },  // ~$3 in / $15 out blend
    openai: { label: 'OpenAI (GPT-4o)',    per1MTokens: 5.00 },  // ~$2.50 in / $10 out blend
  },
  // Token assumptions per PDF page (soft-coded):
  //   instrumentIndex — 7-pass scan (standard + 90°/270° + 4 quadrants)
  //   ioQuick / ioThorough — mirror VISION_ESTIMATE in ioListWorkflow.config.js
  tokensPerPage: {
    instrumentIndex: 20000,
    ioQuick:         4000,
    ioThorough:      16000,
  },
  disclaimer:
    'Estimated cost only — actual usage depends on drawing density and is billed by the AI provider directly to your own key. The platform never bills you.',
};

/**
 * estimateByokCost — pure helper.
 * @param {number|null} pages        PDF page count (null → no estimate)
 * @param {number}      tokensPerPage  one of BYOK_COST_CONFIG.tokensPerPage
 * @param {string}      provider       'claude' | 'openai'
 * @returns {{ tokens:number, cost:number, text:string } | null}
 */
export function estimateByokCost(pages, tokensPerPage, provider) {
  const price = BYOK_COST_CONFIG.pricing[provider]
  if (!BYOK_COST_CONFIG.enabled || !price || !pages || pages <= 0) return null
  const tokens = pages * tokensPerPage
  const cost = (tokens / 1_000_000) * price.per1MTokens
  const rounded = cost < 0.01 ? 0.01 : Math.round(cost * 100) / 100
  return {
    tokens,
    cost: rounded,
    text: `~${BYOK_COST_CONFIG.currencySymbol}${rounded.toFixed(2)} · ~${tokens.toLocaleString()} tokens (${pages} page${pages === 1 ? '' : 's'})`,
  }
}
