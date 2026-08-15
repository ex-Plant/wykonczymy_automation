// Domain-name drift guard. One business concept must carry ONE English identifier across the whole
// app — never a Polish generic re-typed per subsystem (the recon seam is where `marza`/`balance` etc.
// used to collide).
//
// Matching splits an identifier into words on `_` and camelCase boundaries and tests each word
// case-insensitively, so `laborCosts`, `LABOR_COST` and `labor_cost` are one rule rather than three.
// The earlier version matched `^stem|Stem` against the raw name, which used **letter case as a proxy
// for "frozen DB value"** — and that proxy exempted `ROBOCIZNA_TAB` and `PRE_RABAT_CLIENT` for exactly
// the same reason it exempted `RABAT`. Frozen values are now named outright in FROZEN below.
//
// `kosztorys`, `przedmiar` and `pomiar` are absent from the stem list on purpose — Category A, the
// three sheet proper nouns with no clean English equivalent (AGENTS.md „Naming a financial figure").
//
// Two scopes are checked: identifiers, and the string literals that act as code values — a
// `SectionPieBaseT`-style union member, and an `id`/`key`/`value`/`type` property whose literal is a
// React key or a discriminant. Polish UI copy is never any of those (it is a JSX child, a `label:`/
// `name:`/`title:` value, or a template string), so it stays invisible to the rule, as do comments.
//
// Remaining blind spot: filenames. Costs nothing today — the only Polish filenames left are
// `transfer-rabat.test.ts` and `20260611_add_rabat_enum.ts`, both legitimately *about* the frozen
// enum value — so a `Program` visitor reading `context.filename` isn't worth its false positives yet.

// Keyed by Polish stem → the English form it must become. The word regex and the fix message are both
// derived, so a new stem cannot be added with a malformed boundary.
const DOMAIN_DRIFT = Object.entries({
  bilans: 'balance',
  marza: 'margin',
  rabat: 'discount (the frozen RABAT enum value stays)',
  zaliczk: 'deposit / stageDeposit',
  wplat: 'deposit',
  wyplat: 'payout',
  robocizn: 'laborCosts',
  'strat[ay]': 'loss',
  korekt: 'correction (the frozen CORRECTION enum value stays)',
  etap: 'stage',
  saldo: 'registerBalance',
  sumaPrac: 'laborCostsNet',
  materialy: 'materials',
  doZaplaty: 'amountDue',
  wydatki: 'expense',
  reszta: 'remainder',
  doRozliczenia: 'outstanding',
  lacznie: 'combined',
  prace: 'labor / item',
  wykonan: 'executed',
  netto: 'net',
  brutto: 'gross',
}).map(([stem, fix]) => [new RegExp(`^${stem}`, 'i'), `${stem}* → ${fix}*`])

// Values frozen outside our control: DB enum members (`enum_transactions_type`), which travel in URL
// filters and migrations alike. Renaming one is a migration, not a cleanup — so they are exempt by
// name rather than by casing.
const FROZEN = new Set(['RABAT', 'KOREKTA'])

// An `id`/`key`/`value`/`type` string is a code value (React key, discriminant); a `label`/`name`/
// `title` string is UI copy the owner reads, and must stay Polish.
const CODE_VALUE_KEYS = new Set(['id', 'key', 'value', 'type'])

const splitWords = (name) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[_\s]+/)
    .filter(Boolean)

function driftFor(name) {
  if (FROZEN.has(name)) return null
  for (const word of splitWords(name)) {
    if (FROZEN.has(word)) continue
    const hit = DOMAIN_DRIFT.find(([re]) => re.test(word))
    if (hit) return hit[1]
  }
  return null
}

export const noDomainDriftRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce one English identifier per domain concept; flag Polish-generic drift.',
    },
    schema: [],
    messages: {
      drift:
        'Domain-name drift: {{fix}}. One concept, one English name — see context/domain/02-glossary.md.',
    },
  },
  create(context) {
    const report = (node, fix) => context.report({ node, messageId: 'drift', data: { fix } })

    const checkStringValue = (node) => {
      if (typeof node.value !== 'string') return
      const fix = driftFor(node.value)
      if (fix) report(node, fix)
    }

    return {
      Identifier(node) {
        const fix = driftFor(node.name)
        if (fix) report(node, fix)
      },
      // A string union member — `type SectionPieBaseT = 'planned' | 'executed'`.
      'TSLiteralType > Literal': checkStringValue,
      // `{ id: 'robocizna' }` — a code value, unlike `{ label: 'Robocizna' }`.
      'Property > Literal.value'(node) {
        const key = node.parent.key
        const keyName = key?.type === 'Identifier' ? key.name : key?.value
        if (CODE_VALUE_KEYS.has(keyName)) checkStringValue(node)
      },
    }
  },
}
