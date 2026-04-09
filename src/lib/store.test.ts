import { describe, expect, it } from 'vitest'

import {
  createInitialBoardState,
  createNoteFromPreferences,
  duplicateNote,
  getNextZIndex,
  upsertNote,
} from './store'

describe('store helpers', () => {
  it('creates note from preferences with matching defaults', () => {
    const state = createInitialBoardState()
    const note = createNoteFromPreferences(state.preferences, getNextZIndex(state.notes))

    expect(note.color).toBe(state.preferences.defaultColor)
    expect(note.fontSize).toBe(state.preferences.defaultFontSize)
    expect(note.title).toBe('New Note')
  })

  it('duplicates note with offset and elevated z-index', () => {
    const state = createInitialBoardState()
    const note = createNoteFromPreferences(state.preferences, 1)
    const copy = duplicateNote(note, 2)

    expect(copy.id).not.toBe(note.id)
    expect(copy.title).toContain('Copy')
    expect(copy.position.x).toBe(note.position.x + 24)
    expect(copy.position.y).toBe(note.position.y + 24)
    expect(copy.zIndex).toBe(2)
  })

  it('upserts note by replacing matching id', () => {
    const state = createInitialBoardState()
    const first = createNoteFromPreferences(state.preferences, 1)
    const changed = {
      ...first,
      title: 'Renamed',
    }

    const inserted = upsertNote([], first)
    const updated = upsertNote(inserted, changed)

    expect(updated).toHaveLength(1)
    expect(updated[0].title).toBe('Renamed')
  })
})
