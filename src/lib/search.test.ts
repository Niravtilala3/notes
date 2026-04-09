import { describe, expect, it } from 'vitest'

import { filterNotesByQuery } from './search'
import type { Note } from './notes'

const notes: Note[] = [
  {
    id: 'a',
    title: 'Groceries',
    content: 'Milk and bread',
    color: 'yellow',
    position: { x: 10, y: 10 },
    size: { width: 280, height: 240 },
    zIndex: 1,
    isCollapsed: false,
    isPinned: false,
    opacity: 0.98,
    fontSize: 16,
    createdAt: '2026-04-09T10:00:00.000Z',
    updatedAt: '2026-04-09T10:00:00.000Z',
  },
  {
    id: 'b',
    title: 'Trip Ideas',
    content: 'Tokyo and Kyoto plan',
    color: 'blue',
    position: { x: 40, y: 40 },
    size: { width: 280, height: 240 },
    zIndex: 2,
    isCollapsed: false,
    isPinned: false,
    opacity: 0.98,
    fontSize: 16,
    createdAt: '2026-04-09T10:00:00.000Z',
    updatedAt: '2026-04-09T10:00:00.000Z',
  },
]

describe('filterNotesByQuery', () => {
  it('matches titles and content case-insensitively', () => {
    const result = filterNotesByQuery(notes, 'TOKYO')
    expect(result.map((note) => note.id)).toEqual(['b'])
  })

  it('returns all notes when query is empty', () => {
    const result = filterNotesByQuery(notes, '  ')
    expect(result).toHaveLength(2)
  })
})
