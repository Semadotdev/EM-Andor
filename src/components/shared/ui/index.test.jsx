import { describe, expect, it } from 'vitest'
import * as ui from './index.js'

describe('shared ui barrel', () => {
  it('exports every component and helper', () => {
    const expected = [
      'Modal',
      'ConfirmModal',
      'Input',
      'Select',
      'Textarea',
      'Checkbox',
      'FieldError',
      'Button',
      'PageHeader',
      'DataTable',
      'Badge',
      'StatCard',
      'EmptyState',
      'LoadingState',
      'ErrorState',
      'ToastProvider',
      'useToast',
    ]

    for (const name of expected) {
      expect(typeof ui[name]).toBe('function')
    }

    expect(typeof ui.inputClass).toBe('string')
    expect(typeof ui.statusTone).toBe('function')
  })
})
