/**
 * Custom event system for account updates
 * This allows components to notify the sidebar when accounts need to be refreshed
 */

export const ACCOUNT_UPDATED_EVENT = 'account:updated'

export const emitAccountUpdate = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ACCOUNT_UPDATED_EVENT))
  }
}

export const onAccountUpdate = (callback: () => void) => {
  if (typeof window !== 'undefined') {
    window.addEventListener(ACCOUNT_UPDATED_EVENT, callback)
    return () => window.removeEventListener(ACCOUNT_UPDATED_EVENT, callback)
  }
  return () => {}
}
