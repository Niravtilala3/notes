import type { Note } from './notes'

export function filterNotesByQuery(notes: Note[], query: string): Note[] {
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) {
    return notes
  }

  return notes.filter((note) => {
    const haystack = `${note.title}\n${note.content}`.toLowerCase()
    return haystack.includes(normalizedQuery)
  })
}
