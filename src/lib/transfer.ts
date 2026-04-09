import { normalizeImportedNotes, type Note, type Preferences } from './notes'

export type ExportBundle = {
  version: 1
  exportedAt: string
  notes: Note[]
  preferences: Preferences
}

export function createExportBundle(input: {
  notes: Note[]
  preferences: Preferences
}): ExportBundle {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    notes: input.notes,
    preferences: input.preferences,
  }
}

export function parseImportBundle(raw: string): ExportBundle {
  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Invalid import file')
  }

  const bundle = parsed as Partial<ExportBundle>

  if (bundle.version !== 1 || !Array.isArray(bundle.notes) || !bundle.preferences) {
    throw new Error('Import file has unsupported schema')
  }

  return {
    version: 1,
    exportedAt: typeof bundle.exportedAt === 'string' ? bundle.exportedAt : new Date().toISOString(),
    notes: bundle.notes,
    preferences: bundle.preferences,
  }
}

export function mergeImportedNotes(
  existingNotes: Note[],
  incomingNotes: Note[],
  startZIndex: number
): Note[] {
  const mappedIncoming = normalizeImportedNotes(
    {
      notes: incomingNotes,
    },
    new Set(existingNotes.map((note) => note.id)),
    startZIndex
  )

  return [...existingNotes, ...mappedIncoming]
}
