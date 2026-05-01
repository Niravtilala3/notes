import { describe, expect, it } from 'vitest'

import {
  createInitialBoardState,
  createNoteFromPreferences,
  duplicateNote,
  getNextZIndex,
  tryDeserializeState,
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

  it('sanitizes persisted state to prevent malformed note crashes', () => {
    const parsed = tryDeserializeState(
      JSON.stringify({
        version: 1,
        notes: [
          {
            id: 'bad-note',
            title: 123,
            position: {},
            size: {
              width: 'wide',
            },
          },
        ],
        preferences: {
          defaultColor: 'ultra-violet',
          defaultFontSize: 200,
          boardTheme: 'storm',
        },
      })
    )

    expect(parsed).not.toBeNull()
    expect(parsed?.notes).toHaveLength(1)
    expect(parsed?.notes[0].title).toBe('Imported Note')
    expect(parsed?.notes[0].position.x).toBe(36)
    expect(parsed?.preferences.defaultColor).toBe('yellow')
    expect(parsed?.preferences.defaultFontSize).toBe(16)
    expect(parsed?.preferences.boardTheme).toBe('desk')
  })
})
