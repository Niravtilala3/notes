import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import App from './App'

describe('App interaction safety', () => {
  it('asks for confirmation before replace import mode can proceed', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Preferences' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Import mode' }), 'replace')
    await user.click(screen.getByRole('button', { name: 'Import' }))

    expect(confirmSpy).toHaveBeenCalled()

    confirmSpy.mockRestore()
  })

  it('moves active note with arrow keys', async () => {
    const user = userEvent.setup()
    render(<App />)

    const note = screen.getByRole('article', { name: 'Welcome' })
    const baselineLeft = note.style.left

    await user.keyboard('{ArrowRight}')

    expect(note.style.left).not.toBe(baselineLeft)
  })
})
