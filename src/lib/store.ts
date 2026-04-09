import { createDefaultPreferences, createNote, type Note, type Preferences } from './notes'

export type BoardState = {
  notes: Note[]
  activeNoteId: string | null
  preferences: Preferences
  query: string
}

export type PersistedBoardState = {
  version: number
  notes: Note[]
  preferences: Preferences
}

export const STORAGE_KEY = 'sticky-notes:v1'

export function createInitialBoardState(): BoardState {
  return {
    notes: [],
    activeNoteId: null,
    preferences: createDefaultPreferences(),
    query: '',
  }
}

export function getNextZIndex(notes: Note[]): number {
  return notes.reduce((max, note) => Math.max(max, note.zIndex), 0) + 1
}

export function createNoteFromPreferences(
  preferences: Preferences,
  zIndex: number,
  positionOffset = 0
): Note {
  return createNote({
    zIndex,
    color: preferences.defaultColor,
    fontSize: preferences.defaultFontSize,
    x: 40 + positionOffset,
    y: 48 + positionOffset,
  })
}

export function duplicateNote(note: Note, zIndex: number): Note {
  const now = new Date().toISOString()

  return {
    ...note,
    id: globalThis.crypto?.randomUUID?.() ?? `note-${Date.now()}`,
    title: note.title.endsWith(' Copy') ? note.title : `${note.title} Copy`,
    position: {
      x: note.position.x + 24,
      y: note.position.y + 24,
    },
    zIndex,
    createdAt: now,
    updatedAt: now,
  }
}

export function upsertNote(notes: Note[], candidate: Note): Note[] {
  const index = notes.findIndex((note) => note.id === candidate.id)

  if (index === -1) {
    return [candidate, ...notes]
  }

  const next = [...notes]
  next[index] = candidate
  return next
}

export function serializeState(state: BoardState): PersistedBoardState {
  return {
    version: 1,
    notes: state.notes,
    preferences: state.preferences,
  }
}

export function tryDeserializeState(raw: string | null): PersistedBoardState | null {
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as PersistedBoardState
    if (parsed.version !== 1 || !Array.isArray(parsed.notes) || !parsed.preferences) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}
