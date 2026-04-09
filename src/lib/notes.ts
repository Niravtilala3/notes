export type NoteColor = 'yellow' | 'blue' | 'green' | 'pink' | 'purple'

export type Note = {
  id: string
  title: string
  content: string
  color: NoteColor
  position: {
    x: number
    y: number
  }
  size: {
    width: number
    height: number
  }
  zIndex: number
  isCollapsed: boolean
  isPinned: boolean
  opacity: number
  fontSize: number
  createdAt: string
  updatedAt: string
}

export type Preferences = {
  defaultColor: NoteColor
  defaultFontSize: number
  boardTheme: 'desk' | 'paper'
}

type UnknownObject = Record<string, unknown>

export function createDefaultPreferences(): Preferences {
  return {
    defaultColor: 'yellow',
    defaultFontSize: 16,
    boardTheme: 'desk',
  }
}

function asObject(value: unknown): UnknownObject {
  if (typeof value === 'object' && value !== null) {
    return value as UnknownObject
  }
  return {}
}

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  return fallback
}

function asText(value: unknown, fallback: string): string {
  if (typeof value === 'string') {
    return value
  }
  return fallback
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') {
    return value
  }
  return fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function createNote(input: {
  zIndex: number
  color: NoteColor
  fontSize: number
  title?: string
  content?: string
  x?: number
  y?: number
}): Note {
  const now = new Date().toISOString()

  return {
    id: globalThis.crypto?.randomUUID?.() ?? `note-${Date.now()}`,
    title: input.title ?? 'New Note',
    content: input.content ?? '',
    color: input.color,
    position: {
      x: input.x ?? 40,
      y: input.y ?? 48,
    },
    size: {
      width: 280,
      height: 240,
    },
    zIndex: input.zIndex,
    isCollapsed: false,
    isPinned: false,
    opacity: 0.98,
    fontSize: input.fontSize,
    createdAt: now,
    updatedAt: now,
  }
}

export function clampWithinBoard(
  rect: { x: number; y: number; width: number; height: number },
  board: { width: number; height: number }
): { x: number; y: number; width: number; height: number } {
  const maxX = Math.max(0, board.width - rect.width)
  const maxY = Math.max(0, board.height - rect.height)

  return {
    x: clamp(rect.x, 0, maxX),
    y: clamp(rect.y, 0, maxY),
    width: rect.width,
    height: rect.height,
  }
}

function toColor(value: unknown, fallback: NoteColor): NoteColor {
  if (
    value === 'yellow' ||
    value === 'blue' ||
    value === 'green' ||
    value === 'pink' ||
    value === 'purple'
  ) {
    return value
  }
  return fallback
}

function buildImportedNote(raw: unknown, zIndex: number): Note {
  const item = asObject(raw)
  const position = asObject(item.position)
  const size = asObject(item.size)
  const now = new Date().toISOString()

  return {
    id: asText(item.id, globalThis.crypto?.randomUUID?.() ?? `note-${Date.now()}`),
    title: asText(item.title, 'Imported Note'),
    content: asText(item.content, ''),
    color: toColor(item.color, 'yellow'),
    position: {
      x: asNumber(position.x, 36),
      y: asNumber(position.y, 36),
    },
    size: {
      width: clamp(asNumber(size.width, 280), 220, 520),
      height: clamp(asNumber(size.height, 240), 140, 520),
    },
    zIndex,
    isCollapsed: asBoolean(item.isCollapsed, false),
    isPinned: asBoolean(item.isPinned, false),
    opacity: clamp(asNumber(item.opacity, 0.98), 0.55, 1),
    fontSize: clamp(asNumber(item.fontSize, 16), 12, 28),
    createdAt: asText(item.createdAt, now),
    updatedAt: asText(item.updatedAt, now),
  }
}

export function normalizeImportedNotes(
  payload: unknown,
  existingIds: Set<string>,
  startZIndex: number
): Note[] {
  const objectPayload = asObject(payload)
  const inputNotes = Array.isArray(objectPayload.notes) ? objectPayload.notes : []

  return inputNotes.map((rawNote, index) => {
    const note = buildImportedNote(rawNote, startZIndex + index)

    if (existingIds.has(note.id)) {
      note.id = globalThis.crypto?.randomUUID?.() ?? `note-${Date.now()}-${index}`
    }

    existingIds.add(note.id)
    return note
  })
}
