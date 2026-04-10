export function isMac(): boolean {
  return typeof navigator !== 'undefined' && navigator.platform.includes('Mac');
}
