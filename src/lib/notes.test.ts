import { describe, expect, it } from 'vitest'

import { clampWithinBoard, normalizeImportedNotes } from './notes'

describe('clampWithinBoard', () => {
  it('keeps note position inside board bounds', () => {
    const result = clampWithinBoard(
      { x: -20, y: 860, width: 320, height: 220 },
      { width: 1200, height: 700 }
    )

    expect(result.x).toBe(0)
    expect(result.y).toBe(480)
  })
})

describe('normalizeImportedNotes', () => {
  it('remaps duplicate ids and applies sequential z-index values', () => {
    const payload = {
      version: 1,
      notes: [
        {
          id: 'note-1',
          title: 'Draft',
          content: 'hello',
          color: 'yellow',
          position: { x: 10, y: 20 },
          size: { width: 280, height: 220 },
          zIndex: 3,
          createdAt: '2026-04-09T12:00:00.000Z',
          updatedAt: '2026-04-09T12:00:00.000Z',
        },
      ],
    }

    const normalized = normalizeImportedNotes(payload, new Set(['note-1']), 9)

    expect(normalized).toHaveLength(1)
    expect(normalized[0].id).not.toBe('note-1')
    expect(normalized[0].zIndex).toBe(9)
  })
})
