import { render } from '@testing-library/react'
import { ToastProvider } from '../components/shared/ui/index.js'

export function renderWithToast(ui, options) {
  return render(ui, { wrapper: ToastProvider, ...options })
}
