export type TextSelection = {
  start: number
  end: number
}

export type FormatResult = {
  nextText: string
  nextSelection: TextSelection
}

function clampSelection(text: string, selection: TextSelection): TextSelection {
  const start = Math.min(Math.max(0, selection.start), text.length)
  const end = Math.min(Math.max(start, selection.end), text.length)
  return {
    start,
    end,
  }
}

function wrapSelection(text: string, selection: TextSelection, token: string): FormatResult {
  const safeSelection = clampSelection(text, selection)
  const prefix = text.slice(0, safeSelection.start)
  const selected = text.slice(safeSelection.start, safeSelection.end)
  const suffix = text.slice(safeSelection.end)
  const wrapped = `${token}${selected}${token}`

  return {
    nextText: `${prefix}${wrapped}${suffix}`,
    nextSelection: {
      start: safeSelection.start + token.length,
      end: safeSelection.end + token.length,
    },
  }
}

export function applyBold(text: string, selection: TextSelection): FormatResult {
  return wrapSelection(text, selection, '**')
}

export function applyItalic(text: string, selection: TextSelection): FormatResult {
  return wrapSelection(text, selection, '*')
}

export function applyBulletList(text: string, selection: TextSelection): FormatResult {
  const safeSelection = clampSelection(text, selection)
  const prefix = text.slice(0, safeSelection.start)
  const selected = text.slice(safeSelection.start, safeSelection.end)
  const suffix = text.slice(safeSelection.end)
  const nextText = selected
    .split('\n')
    .map((line) => (line.startsWith('- ') ? line : `- ${line}`))
    .join('\n')

  return {
    nextText: `${prefix}${nextText}${suffix}`,
    nextSelection: {
      start: safeSelection.start,
      end: safeSelection.start + nextText.length,
    },
  }
}
