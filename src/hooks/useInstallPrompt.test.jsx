import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import useInstallPrompt from './useInstallPrompt.js'

function makeInstallEvent(outcome = 'accepted') {
  const event = new Event('beforeinstallprompt', { cancelable: true })
  event.prompt = vi.fn()
  event.userChoice = Promise.resolve({ outcome })
  return event
}

describe('useInstallPrompt', () => {
  it('captures beforeinstallprompt and exposes canInstall', () => {
    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current.canInstall).toBe(false)

    const event = makeInstallEvent()
    act(() => {
      window.dispatchEvent(event)
    })

    expect(result.current.canInstall).toBe(true)
    expect(result.current.promptInstall).toBeInstanceOf(Function)
  })

  it('prompts once, reports the outcome, and clears the offer', async () => {
    const { result } = renderHook(() => useInstallPrompt())
    const event = makeInstallEvent()
    act(() => {
      window.dispatchEvent(event)
    })

    let accepted
    await act(async () => {
      accepted = await result.current.promptInstall()
    })
    expect(event.prompt).toHaveBeenCalledTimes(1)
    expect(accepted).toBe(true)
    expect(result.current.canInstall).toBe(false)

    let retried
    await act(async () => {
      retried = await result.current.promptInstall()
    })
    expect(retried).toBe(false)
    expect(event.prompt).toHaveBeenCalledTimes(1)
  })

  it('returns false for a dismissed install', async () => {
    const { result } = renderHook(() => useInstallPrompt())
    const event = makeInstallEvent('dismissed')
    act(() => {
      window.dispatchEvent(event)
    })

    let accepted
    await act(async () => {
      accepted = await result.current.promptInstall()
    })
    expect(accepted).toBe(false)
    expect(result.current.canInstall).toBe(false)
  })

  it('stops listening on unmount', () => {
    const spy = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() => useInstallPrompt())
    unmount()
    expect(spy).toHaveBeenCalledWith('beforeinstallprompt', expect.any(Function))
    spy.mockRestore()
  })
})
