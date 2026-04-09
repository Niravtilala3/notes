import { describe, expect, it } from 'vitest'

import {
  applyBold,
  applyItalic,
  applyBulletList,
  type TextSelection,
} from './formatting'

describe('applyBold', () => {
  it('wraps selected text with markdown bold markers', () => {
    const selection: TextSelection = {
      start: 0,
      end: 5,
    }

    const result = applyBold('hello world', selection)
    expect(result.nextText).toBe('**hello** world')
  })
})

describe('applyItalic', () => {
  it('wraps selected text with markdown italic markers', () => {
    const selection: TextSelection = {
      start: 6,
      end: 11,
    }

    const result = applyItalic('hello world', selection)
    expect(result.nextText).toBe('hello *world*')
  })
})

describe('applyBulletList', () => {
  it('prepends bullet markers to every selected line', () => {
    const selection: TextSelection = {
      start: 0,
      end: 11,
    }

    const result = applyBulletList('first\nsecond', selection)
    expect(result.nextText).toBe('- first\n- second')
  })
})
