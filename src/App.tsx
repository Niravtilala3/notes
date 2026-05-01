import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

import './App.css'
import { applyBold, applyBulletList, applyItalic, type FormatResult } from './lib/formatting'
import { clampWithinBoard, type Note, type NoteColor } from './lib/notes'
import { filterNotesByQuery } from './lib/search'
import {
  STORAGE_KEY,
  createInitialBoardState,
  createNoteFromPreferences,
  duplicateNote,
  getNextZIndex,
  serializeState,
  tryDeserializeState,
  type BoardState,
} from './lib/store'
import { createExportBundle, mergeImportedNotes, parseImportBundle } from './lib/transfer'

type DragMode = 'move' | 'resize'

type DragState = {
  noteId: string
  pointerId: number
  mode: DragMode
  captureTarget: HTMLElement | null
  startX: number
  startY: number
  originX: number
  originY: number
  originWidth: number
  originHeight: number
}

const NOTE_COLORS: NoteColor[] = ['yellow', 'blue', 'green', 'pink', 'purple']

type StorageLike = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

function getStorage(): StorageLike | null {
  const candidate = globalThis.localStorage as Partial<StorageLike> | undefined
  if (!candidate) {
    return null
  }

  if (typeof candidate.getItem !== 'function' || typeof candidate.setItem !== 'function') {
    return null
  }

  return {
    getItem: candidate.getItem.bind(candidate),
    setItem: candidate.setItem.bind(candidate),
  }
}

function createStarterState(): BoardState {
  const base = createInitialBoardState()
  const storage = getStorage()
  const persisted = tryDeserializeState(storage?.getItem(STORAGE_KEY) ?? null)

  if (persisted) {
    const notes = persisted.notes
    return {
      ...base,
      notes,
      preferences: persisted.preferences,
      activeNoteId: notes.length > 0 ? notes[notes.length - 1].id : null,
    }
  }

  const welcomeNote = createNoteFromPreferences(base.preferences, 1)
  welcomeNote.title = 'Welcome'
  welcomeNote.content =
    'This is your board. Drag notes around, resize them, and use Cmd/Ctrl+N for a new note.'

  return {
    ...base,
    notes: [welcomeNote],
    activeNoteId: welcomeNote.id,
  }
}

function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  )
}

function detectCompactViewport(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }

  return window.matchMedia('(max-width: 860px)').matches
}

function App() {
  const [boardState, setBoardState] = useState<BoardState>(createStarterState)
  const [showPreferences, setShowPreferences] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge')
  const [isCompactViewport, setIsCompactViewport] = useState<boolean>(detectCompactViewport)
  const boardRef = useRef<HTMLDivElement | null>(null)
  const searchRef = useRef<HTMLInputElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const noteTextRefs = useRef<Record<string, HTMLTextAreaElement | null>>({})
  const dragRef = useRef<DragState | null>(null)
  const saveTimerRef = useRef<number | null>(null)

  const activeNote = boardState.notes.find((note) => note.id === boardState.activeNoteId) ?? null

  const visibleNotes = useMemo(
    () =>
      filterNotesByQuery(boardState.notes, boardState.query).sort((first, second) => first.zIndex - second.zIndex),
    [boardState.notes, boardState.query]
  )

  useEffect(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current)
    }

    saveTimerRef.current = window.setTimeout(() => {
      const payload = serializeState(boardState)
      getStorage()?.setItem(STORAGE_KEY, JSON.stringify(payload))
    }, 220)

    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current)
      }
    }
  }, [boardState])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }

    const mediaQuery = window.matchMedia('(max-width: 860px)')
    const update = (event?: MediaQueryListEvent): void => {
      setIsCompactViewport(event ? event.matches : mediaQuery.matches)
    }

    update()

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', update)
      return () => {
        mediaQuery.removeEventListener('change', update)
      }
    }

    if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(update)
      return () => {
        mediaQuery.removeListener(update)
      }
    }
  }, [])

  const updateNote = useCallback((noteId: string, updater: (note: Note) => Note): void => {
    setBoardState((current) => ({
      ...current,
      notes: current.notes.map((note) => {
        if (note.id !== noteId) {
          return note
        }

        return {
          ...updater(note),
          updatedAt: new Date().toISOString(),
        }
      }),
    }))
  }, [])

  const focusNote = useCallback((noteId: string): void => {
    setBoardState((current) => {
      const nextZIndex = getNextZIndex(current.notes)

      return {
        ...current,
        activeNoteId: noteId,
        notes: current.notes.map((note) =>
          note.id === noteId
            ? {
                ...note,
                zIndex: nextZIndex,
                updatedAt: new Date().toISOString(),
              }
            : note
        ),
      }
    })
  }, [])

  const addNote = useCallback((): void => {
    setBoardState((current) => {
      const offset = (current.notes.length % 8) * 16
      const note = createNoteFromPreferences(current.preferences, getNextZIndex(current.notes), offset)

      return {
        ...current,
        notes: [...current.notes, note],
        activeNoteId: note.id,
      }
    })
    setStatusMessage('New note created')
  }, [])

  const removeNote = useCallback((noteId: string, skipPrompt = false): void => {
    const shouldRemove = skipPrompt || window.confirm('Delete this note?')
    if (!shouldRemove) {
      return
    }

    setBoardState((current) => {
      const notes = current.notes.filter((note) => note.id !== noteId)
      const activeNoteId =
        current.activeNoteId === noteId ? (notes.length > 0 ? notes[notes.length - 1].id : null) : current.activeNoteId

      return {
        ...current,
        notes,
        activeNoteId,
      }
    })

    setStatusMessage('Note deleted')
  }, [])

  const duplicateActiveNote = useCallback((): void => {
    if (!activeNote) {
      return
    }

    setBoardState((current) => {
      const source = current.notes.find((note) => note.id === activeNote.id)
      if (!source) {
        return current
      }

      const duplicated = duplicateNote(source, getNextZIndex(current.notes))
      return {
        ...current,
        notes: [...current.notes, duplicated],
        activeNoteId: duplicated.id,
      }
    })

    setStatusMessage('Note duplicated')
  }, [activeNote])

  const startPointerAction = (event: ReactPointerEvent<HTMLElement>, note: Note, mode: DragMode): void => {
    const target = event.target as HTMLElement
    if (mode === 'move' && target.closest('button, input, select, textarea')) {
      return
    }

    const captureTarget = event.currentTarget
    if (typeof captureTarget.setPointerCapture === 'function') {
      try {
        captureTarget.setPointerCapture(event.pointerId)
      } catch {
        // Ignore pointer capture failures on unsupported elements.
      }
    }

    focusNote(note.id)
    dragRef.current = {
      noteId: note.id,
      pointerId: event.pointerId,
      mode,
      captureTarget,
      startX: event.clientX,
      startY: event.clientY,
      originX: note.position.x,
      originY: note.position.y,
      originWidth: note.size.width,
      originHeight: note.size.height,
    }
  }

  useEffect(() => {
    const clearDrag = (): void => {
      const activeDrag = dragRef.current
      if (!activeDrag) {
        return
      }

      if (activeDrag.captureTarget && typeof activeDrag.captureTarget.releasePointerCapture === 'function') {
        try {
          activeDrag.captureTarget.releasePointerCapture(activeDrag.pointerId)
        } catch {
          // Ignore release failures when pointer is already released.
        }
      }

      dragRef.current = null
    }

    const handlePointerMove = (event: globalThis.PointerEvent): void => {
      const dragState = dragRef.current
      const boardRect = boardRef.current?.getBoundingClientRect()

      if (!dragState || dragState.pointerId !== event.pointerId || !boardRect) {
        return
      }

      const deltaX = event.clientX - dragState.startX
      const deltaY = event.clientY - dragState.startY

      setBoardState((current) => ({
        ...current,
        notes: current.notes.map((note) => {
          if (note.id !== dragState.noteId) {
            return note
          }

          if (dragState.mode === 'move') {
            const clamped = clampWithinBoard(
              {
                x: dragState.originX + deltaX,
                y: dragState.originY + deltaY,
                width: note.size.width,
                height: note.size.height,
              },
              {
                width: boardRect.width,
                height: boardRect.height,
              }
            )

            return {
              ...note,
              position: {
                x: clamped.x,
                y: clamped.y,
              },
              updatedAt: new Date().toISOString(),
            }
          }

          const width = Math.min(560, Math.max(220, dragState.originWidth + deltaX))
          const height = Math.min(520, Math.max(140, dragState.originHeight + deltaY))
          const clamped = clampWithinBoard(
            {
              x: note.position.x,
              y: note.position.y,
              width,
              height,
            },
            {
              width: boardRect.width,
              height: boardRect.height,
            }
          )

          return {
            ...note,
            size: {
              width: clamped.width,
              height: clamped.height,
            },
            position: {
              x: clamped.x,
              y: clamped.y,
            },
            updatedAt: new Date().toISOString(),
          }
        }),
      }))
    }

    const handlePointerUp = (event: globalThis.PointerEvent): void => {
      if (dragRef.current?.pointerId === event.pointerId) {
        clearDrag()
      }
    }

    const handlePointerCancel = (): void => {
      clearDrag()
    }

    const handleWindowBlur = (): void => {
      clearDrag()
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerCancel)
    window.addEventListener('blur', handleWindowBlur)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const modifier = event.metaKey || event.ctrlKey

      if (modifier && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        addNote()
        return
      }

      if (modifier && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        searchRef.current?.focus()
        return
      }

      if (modifier && event.key.toLowerCase() === 'd') {
        event.preventDefault()
        duplicateActiveNote()
        return
      }

      if (event.key === 'Escape') {
        setBoardState((current) => ({
          ...current,
          activeNoteId: null,
        }))
        return
      }

      if (!boardState.activeNoteId) {
        return
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && !isTextInputTarget(event.target)) {
        event.preventDefault()
        removeNote(boardState.activeNoteId)
        return
      }

      const active = boardState.notes.find((note) => note.id === boardState.activeNoteId)
      if (!active || isTextInputTarget(event.target)) {
        return
      }

      const moveStep = event.shiftKey ? 24 : 8
      const resizeStep = event.shiftKey ? 24 : 12

      if (event.altKey) {
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault()
          updateNote(active.id, (currentNote) => {
            const width =
              event.key === 'ArrowRight'
                ? currentNote.size.width + resizeStep
                : event.key === 'ArrowLeft'
                  ? currentNote.size.width - resizeStep
                  : currentNote.size.width
            const height =
              event.key === 'ArrowDown'
                ? currentNote.size.height + resizeStep
                : event.key === 'ArrowUp'
                  ? currentNote.size.height - resizeStep
                  : currentNote.size.height

            const clampedSize = {
              width: Math.min(560, Math.max(220, width)),
              height: Math.min(520, Math.max(140, height)),
            }

            return {
              ...currentNote,
              size: clampedSize,
            }
          })
        }
        return
      }

      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault()
        updateNote(active.id, (currentNote) => {
          const x =
            event.key === 'ArrowRight'
              ? currentNote.position.x + moveStep
              : event.key === 'ArrowLeft'
                ? currentNote.position.x - moveStep
                : currentNote.position.x
          const y =
            event.key === 'ArrowDown'
              ? currentNote.position.y + moveStep
              : event.key === 'ArrowUp'
                ? currentNote.position.y - moveStep
                : currentNote.position.y

          const boardRect = boardRef.current?.getBoundingClientRect()
          if (!boardRect) {
            return {
              ...currentNote,
              position: {
                x: Math.max(0, x),
                y: Math.max(0, y),
              },
            }
          }

          const clamped = clampWithinBoard(
            {
              x,
              y,
              width: currentNote.size.width,
              height: currentNote.size.height,
            },
            {
              width: boardRect.width,
              height: boardRect.height,
            }
          )

          return {
            ...currentNote,
            position: {
              x: clamped.x,
              y: clamped.y,
            },
          }
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [addNote, boardState.activeNoteId, boardState.notes, duplicateActiveNote, removeNote, updateNote])

  const exportNotes = (): void => {
    const bundle = createExportBundle({
      notes: boardState.notes,
      preferences: boardState.preferences,
    })
    const serialized = JSON.stringify(bundle, null, 2)
    const blob = new Blob([serialized], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `stickies-backup-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    setStatusMessage('Backup exported')
  }

  const applyFormatToNote = useCallback(
    (noteId: string, formatter: (text: string, selection: { start: number; end: number }) => FormatResult): void => {
      const textarea = noteTextRefs.current[noteId]
      if (!textarea) {
        return
      }

      const selection = {
        start: textarea.selectionStart ?? 0,
        end: textarea.selectionEnd ?? textarea.selectionStart ?? 0,
      }

      updateNote(noteId, (currentNote) => {
        const result = formatter(currentNote.content, selection)

        queueMicrotask(() => {
          const target = noteTextRefs.current[noteId]
          if (!target) {
            return
          }

          target.focus()
          target.setSelectionRange(result.nextSelection.start, result.nextSelection.end)
        })

        return {
          ...currentNote,
          content: result.nextText,
        }
      })
    },
    [updateNote]
  )

  const onImportSelected = async (file: File): Promise<void> => {
    try {
      const raw = await file.text()
      const bundle = parseImportBundle(raw)

      setBoardState((current) => {
        if (importMode === 'replace') {
          const notes = mergeImportedNotes([], bundle.notes, 1)
          return {
            ...current,
            notes,
            preferences: bundle.preferences,
            activeNoteId: notes.length > 0 ? notes[notes.length - 1].id : null,
          }
        }

        const notes = mergeImportedNotes(current.notes, bundle.notes, getNextZIndex(current.notes))
        return {
          ...current,
          notes,
          activeNoteId: notes.length > 0 ? notes[notes.length - 1].id : null,
        }
      })

      setStatusMessage(importMode === 'replace' ? 'Backup imported and replaced board' : 'Backup merged')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import failed'
      setStatusMessage(message)
    }
  }

  return (
    <div className={`app theme-${boardState.preferences.boardTheme} ${isCompactViewport ? 'mobile-layout' : ''}`}>
      <header className="topbar">
        <div>
          <h1>Stickies Board</h1>
          <p className="subtitle">Mac Stickies-inspired notes for your browser</p>
        </div>

        <div className="toolbar">
          <button type="button" onClick={addNote}>
            New Note
          </button>
          <button type="button" onClick={duplicateActiveNote} disabled={!activeNote}>
            Duplicate
          </button>
          {!isCompactViewport ? (
            <button
              type="button"
              onClick={() => {
                if (activeNote) {
                  removeNote(activeNote.id)
                }
              }}
              disabled={!activeNote}
            >
              Delete
            </button>
          ) : null}
          <button type="button" onClick={exportNotes}>
            Export
          </button>
          <button
            type="button"
            onClick={() => {
              if (importMode === 'replace') {
                const approved = window.confirm(
                  `Replace board with imported notes? This removes ${boardState.notes.length} existing notes.`
                )

                if (!approved) {
                  return
                }
              }

              fileInputRef.current?.click()
            }}
          >
            Import
          </button>
          <button type="button" onClick={() => setShowPreferences((open) => !open)}>
            {showPreferences ? 'Hide Preferences' : 'Preferences'}
          </button>
          <input
            ref={searchRef}
            type="search"
            placeholder="Search notes"
            value={boardState.query}
            onChange={(event) =>
              setBoardState((current) => ({
                ...current,
                query: event.target.value,
              }))
            }
            aria-label="Search notes"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden-import"
            onChange={async (event) => {
              const file = event.target.files?.[0]
              if (file) {
                await onImportSelected(file)
              }
              event.target.value = ''
            }}
          />
        </div>
      </header>

      {showPreferences ? (
        <section className="preferences" aria-label="Preferences">
          <label>
            Default note color
            <select
              value={boardState.preferences.defaultColor}
              onChange={(event) => {
                const defaultColor = event.target.value as NoteColor
                setBoardState((current) => ({
                  ...current,
                  preferences: {
                    ...current.preferences,
                    defaultColor,
                  },
                }))
              }}
            >
              {NOTE_COLORS.map((color) => (
                <option key={color} value={color}>
                  {color}
                </option>
              ))}
            </select>
          </label>

          <label>
            Default font size ({boardState.preferences.defaultFontSize}px)
            <input
              type="range"
              min={12}
              max={28}
              value={boardState.preferences.defaultFontSize}
              onChange={(event) => {
                const defaultFontSize = Number(event.target.value)
                setBoardState((current) => ({
                  ...current,
                  preferences: {
                    ...current.preferences,
                    defaultFontSize,
                  },
                }))
              }}
            />
          </label>

          <label>
            Board look
            <select
              value={boardState.preferences.boardTheme}
              onChange={(event) => {
                const boardTheme = event.target.value as 'desk' | 'paper'
                setBoardState((current) => ({
                  ...current,
                  preferences: {
                    ...current.preferences,
                    boardTheme,
                  },
                }))
              }}
            >
              <option value="desk">Desk</option>
              <option value="paper">Paper</option>
            </select>
          </label>

          <label>
            Import mode
            <select value={importMode} onChange={(event) => setImportMode(event.target.value as 'merge' | 'replace')}>
              <option value="merge">Merge notes</option>
              <option value="replace">Replace board</option>
            </select>
          </label>
        </section>
      ) : null}

      <div className="workspace">
        <aside className="note-list" aria-label="All notes">
          <h2>All Notes</h2>
          {visibleNotes.length === 0 ? (
            <p className="empty">No notes match your search.</p>
          ) : (
            <ul>
              {visibleNotes
                .slice()
                .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                .map((note) => (
                  <li key={note.id}>
                    <button
                      type="button"
                      className={boardState.activeNoteId === note.id ? 'list-item active' : 'list-item'}
                      onClick={() => focusNote(note.id)}
                    >
                      <span>{note.title || 'Untitled note'}</span>
                      <small>{new Date(note.updatedAt).toLocaleTimeString()}</small>
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </aside>

        <section
          ref={boardRef}
          className="board"
          aria-label="Sticky notes board"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) {
              setBoardState((current) => ({
                ...current,
                activeNoteId: null,
              }))
            }
          }}
        >
          {visibleNotes.map((note) => (
            <article
              key={note.id}
              className={`note note-${note.color} ${boardState.activeNoteId === note.id ? 'active' : ''}`}
              style={{
                left: note.position.x,
                top: note.position.y,
                width: note.size.width,
                height: note.isCollapsed ? 56 : note.size.height,
                opacity: note.opacity,
                zIndex: note.isPinned ? note.zIndex + 1000 : note.zIndex,
                fontSize: `${note.fontSize}px`,
              }}
              role="article"
              aria-label={note.title || 'note'}
              onPointerDown={() => focusNote(note.id)}
            >
              <header className="note-header" onPointerDown={(event) => startPointerAction(event, note, 'move')}>
                <input
                  value={note.title}
                  onChange={(event) =>
                    updateNote(note.id, (currentNote) => ({
                      ...currentNote,
                      title: event.target.value,
                    }))
                  }
                  aria-label="Note title"
                />

                <div className="note-actions">
                  <button
                    type="button"
                    onClick={() =>
                      updateNote(note.id, (currentNote) => ({
                        ...currentNote,
                        isCollapsed: !currentNote.isCollapsed,
                      }))
                    }
                  >
                    {note.isCollapsed ? 'Expand' : 'Collapse'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateNote(note.id, (currentNote) => ({
                        ...currentNote,
                        isPinned: !currentNote.isPinned,
                      }))
                    }
                  >
                    {note.isPinned ? 'Unpin' : 'Pin'}
                  </button>
                  <button type="button" onClick={() => removeNote(note.id)}>
                    Delete
                  </button>
                </div>
              </header>

              {!note.isCollapsed ? (
                <>
                  <div className="format-toolbar" role="toolbar" aria-label="Text formatting">
                    <button
                      type="button"
                      onClick={() => applyFormatToNote(note.id, applyBold)}
                      aria-label="Bold"
                    >
                      Bold
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormatToNote(note.id, applyItalic)}
                      aria-label="Italic"
                    >
                      Italic
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormatToNote(note.id, applyBulletList)}
                      aria-label="Bullets"
                    >
                      Bullets
                    </button>
                  </div>

                  <textarea
                    ref={(node) => {
                      noteTextRefs.current[note.id] = node
                    }}
                    value={note.content}
                    onChange={(event) =>
                      updateNote(note.id, (currentNote) => ({
                        ...currentNote,
                        content: event.target.value,
                      }))
                    }
                    aria-label="Note content"
                  />

                  <footer className="note-footer">
                    <div className="swatches" aria-label="Note color">
                      {NOTE_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={note.color === color ? `swatch ${color} selected` : `swatch ${color}`}
                          onClick={() =>
                            updateNote(note.id, (currentNote) => ({
                              ...currentNote,
                              color,
                            }))
                          }
                          aria-label={`Set color ${color}`}
                        />
                      ))}
                    </div>

                    <label>
                      Opacity
                      <input
                        type="range"
                        min={55}
                        max={100}
                        value={Math.round(note.opacity * 100)}
                        onChange={(event) => {
                          const opacity = Number(event.target.value) / 100
                          updateNote(note.id, (currentNote) => ({
                            ...currentNote,
                            opacity,
                          }))
                        }}
                      />
                    </label>

                    <label>
                      Font
                      <input
                        type="range"
                        min={12}
                        max={28}
                        value={note.fontSize}
                        onChange={(event) => {
                          const fontSize = Number(event.target.value)
                          updateNote(note.id, (currentNote) => ({
                            ...currentNote,
                            fontSize,
                          }))
                        }}
                      />
                    </label>
                  </footer>

                  <button
                    type="button"
                    className="resize-handle"
                    onPointerDown={(event) => startPointerAction(event, note, 'resize')}
                    aria-label="Resize note"
                  >
                    \u25e2
                  </button>
                </>
              ) : null}
            </article>
          ))}
        </section>
      </div>

      <footer className="status-bar">
        <span role="status">{statusMessage || 'Ready'}</span>
        <span>
          Shortcuts: Cmd/Ctrl+N new, Cmd/Ctrl+D duplicate, Cmd/Ctrl+F search, Delete remove, Arrows move,
          Alt+Arrows resize
        </span>
      </footer>

      {isCompactViewport ? (
        <nav className="mobile-dock" aria-label="Mobile quick actions">
          <button type="button" aria-label="Quick New Note" onClick={addNote}>
            + Note
          </button>
          <button type="button" aria-label="Quick Search" onClick={() => searchRef.current?.focus()}>
            Search
          </button>
          <button
            type="button"
            aria-label="Quick Preferences"
            onClick={() => setShowPreferences((open) => !open)}
          >
            Prefs
          </button>
        </nav>
      ) : null}
    </div>
  )
}

export default App
