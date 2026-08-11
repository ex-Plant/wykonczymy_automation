import { describe, it, expect } from 'vitest'
import { splitExtension } from '@/lib/utils/append-short-id'

describe('splitExtension', () => {
  it('splits a filename into base and extension', () => {
    expect(splitExtension('faktura.pdf')).toEqual({ base: 'faktura', ext: '.pdf' })
  })

  it('splits on the last dot, not the first', () => {
    expect(splitExtension('archive.tar.gz')).toEqual({ base: 'archive.tar', ext: '.gz' })
  })

  it('reports no extension for a bare name', () => {
    expect(splitExtension('Makefile')).toEqual({ base: 'Makefile', ext: '' })
  })

  it('reports no extension for an empty name', () => {
    expect(splitExtension('')).toEqual({ base: '', ext: '' })
  })

  // A leading dot is the whole name, not an extension — otherwise `.gitignore` would round-trip
  // as an empty base plus `.gitignore`, and a page suffix would produce `-2.gitignore`.
  it('treats a leading dot as part of the name', () => {
    expect(splitExtension('.gitignore')).toEqual({ base: '.gitignore', ext: '' })
  })
})
