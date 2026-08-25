import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// These fixtures are transcribed from live client sheets, and the rows they come from carry the
// client's address, phone and e-mail. Blanking those cells is a manual step, so this spec is the
// thing that catches the next transcription that forgets it — before it reaches a commit.
const FIXTURE_DIR = join(import.meta.dirname, '.')

const FORBIDDEN: ReadonlyArray<{ what: string; pattern: RegExp }> = [
  { what: 'an e-mail address', pattern: /[\w.+-]+@[\w-]+\.[a-z]{2,}/i },
  // Polish phone numbers, written with or without the +48 and with any of the usual separators.
  { what: 'a phone number', pattern: /(\+?48[\s-]?)?\d{3}[\s-]?\d{3}[\s-]?\d{3}\b/ },
  { what: 'a street address', pattern: /\b(ul\.|ulica|al\.|aleja|os\.|osiedle)\s/i },
  { what: 'a postal code', pattern: /\b\d{2}-\d{3}\b/ },
  // The crew names the owner types over the etap headers are the one PII shape with no punctuation
  // to key off, so they are matched by form: a run of ALL-CAPS words, which nothing else in these
  // fixtures is.
  { what: 'a person or crew name', pattern: /\b[A-ZĄĆĘŁŃÓŚŹŻ]{3,}(\s+[A-ZĄĆĘŁŃÓŚŹŻ]{2,})+\b/ },
]

// The stand-ins keep the real thing's shape — all-caps, two words, over an etap header — so the
// fixture still exercises the „stage header renamed to a crew name" case. They are cleared before
// the caps check so the check can stay blind to which words are real.
const FABRICATED = /\b(BRYGADA JEDEN|EKIPA DWA)\b/g

describe('kosztorys sheet fixtures', () => {
  const files = readdirSync(FIXTURE_DIR).filter(
    (name) => name.endsWith('.ts') && !name.endsWith('.test.ts'),
  )

  it('has fixtures to check', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it.each(files)('%s carries no client PII', (name) => {
    const source = readFileSync(join(FIXTURE_DIR, name), 'utf8').replace(FABRICATED, '')

    for (const { what, pattern } of FORBIDDEN) {
      const hit = source.match(pattern)
      expect(hit, `${name} looks like it contains ${what}: ${hit?.[0]}`).toBeNull()
    }
  })
})
