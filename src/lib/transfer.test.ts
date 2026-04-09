import { describe, expect, it } from 'vitest'

import type { Note } from './notes'
import { createExportBundle, mergeImportedNotes, parseImportBundle } from './transfer'

const sampleNote: Note = {
  id: 'note-1',
  title: 'Reminder',
  content: 'Buy milk',
  color: 'yellow',
  position: { x: 40, y: 40 },
  size: { width: 280, height: 240 },
  zIndex: 1,
  isCollapsed: false,
  isPinned: false,
  opacity: 0.98,
  fontSize: 16,
  createdAt: '2026-04-09T10:00:00.000Z',
  updatedAt: '2026-04-09T10:00:00.000Z',
}

describe('createExportBundle', () => {
  it('creates a valid export payload with metadata', () => {
    const bundle = createExportBundle({
      notes: [sampleNote],
      preferences: {
        defaultColor: 'yellow',
        defaultFontSize: 16,
        boardTheme: 'desk',
      },
    })

    expect(bundle.version).toBe(1)
    expect(bundle.notes).toHaveLength(1)
    expect(typeof bundle.exportedAt).toBe('string')
  })
})

describe('parseImportBundle', () => {
  it('throws when payload is invalid json', () => {
    expect(() => parseImportBundle('{bad json')).toThrow('Invalid import file')
  })
})

describe('mergeImportedNotes', () => {
  it('remaps duplicate ids while preserving both notes', () => {
    const merged = mergeImportedNotes([sampleNote], [sampleNote], 2)

    expect(merged).toHaveLength(2)
    expect(merged[0].id).not.toBe(merged[1].id)
  })
})
