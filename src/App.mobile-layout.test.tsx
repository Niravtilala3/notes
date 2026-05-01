import { render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'

type MatchMediaMock = ReturnType<typeof vi.fn>

let matchMediaMock: MatchMediaMock

function setMatchMedia(matches: boolean): void {
  matchMediaMock = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: matchMediaMock,
  })
}

describe('App mobile layout', () => {
  beforeEach(() => {
    setMatchMedia(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('applies mobile layout class when viewport is compact', () => {
    render(<App />)

    const heading = screen.getByRole('heading', { name: 'Stickies Board' })
    const appRoot = heading.closest('.app')

    expect(appRoot).toHaveClass('mobile-layout')
  })

  it('renders thumb quick-action dock for compact viewport', () => {
    render(<App />)

    const dock = screen.getByRole('navigation', { name: 'Mobile quick actions' })
    expect(dock).toBeInTheDocument()
    expect(within(dock).getByRole('button', { name: 'Quick New Note' })).toBeInTheDocument()
    expect(within(dock).getByRole('button', { name: 'Quick Search' })).toBeInTheDocument()
    expect(within(dock).getByRole('button', { name: 'Quick Preferences' })).toBeInTheDocument()
  })

  it('keeps global delete out of top toolbar on compact viewport', () => {
    render(<App />)

    const topToolbar = screen.getAllByRole('banner')[0]
    expect(within(topToolbar).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  })
})
