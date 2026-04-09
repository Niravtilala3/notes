import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import App from './App'

describe('App rich text formatting', () => {
  it('applies bold formatting to selected note text', async () => {
    const user = userEvent.setup()
    render(<App />)

    const textarea = screen.getByLabelText('Note content') as HTMLTextAreaElement

    await user.clear(textarea)
    await user.type(textarea, 'hello world')
    textarea.focus()
    textarea.setSelectionRange(0, 5)

    await user.click(screen.getByRole('button', { name: 'Bold' }))

    expect(textarea.value).toBe('**hello** world')
  })
})
