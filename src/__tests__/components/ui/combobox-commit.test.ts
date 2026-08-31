import { describe, expect, it } from 'vitest'
import { comboboxCommit } from '@/components/ui/combobox-commit'

const CATEGORIES = ['Elektryka', 'Hydraulika', 'Malowanie'] as const

describe('comboboxCommit', () => {
  it('commits the typed text, not the first quick-pick', () => {
    expect(comboboxCommit('Tynkowanie', CATEGORIES)).toBe('Tynkowanie')
  })

  it("adopts the list's spelling so a typed name cannot fork the category", () => {
    expect(comboboxCommit('malowanie', CATEGORIES)).toBe('Malowanie')
    expect(comboboxCommit('  MALOWANIE  ', CATEGORIES)).toBe('Malowanie')
  })

  it('trims what it commits', () => {
    expect(comboboxCommit('  Tynkowanie ', CATEGORIES)).toBe('Tynkowanie')
  })

  it('commits an empty string when nothing was typed', () => {
    expect(comboboxCommit('   ', CATEGORIES)).toBe('')
  })
})
