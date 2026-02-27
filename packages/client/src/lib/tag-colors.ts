export const TAG_COLORS: { bg: string; text: string }[] = [
  { bg: '#d4edda', text: '#155724' },
  { bg: '#cce5ff', text: '#004085' },
  { bg: '#f8d7da', text: '#721c24' },
  { bg: '#fff3cd', text: '#856404' },
  { bg: '#e2d5f1', text: '#4a1d96' },
  { bg: '#d1ecf1', text: '#0c5460' },
  { bg: '#ffeeba', text: '#7c5e10' },
  { bg: '#fce4ec', text: '#880e4f' },
  { bg: '#c3dafe', text: '#1e3a5f' },
  { bg: '#e8f5e9', text: '#1b5e20' },
];

export function getTagColor(value: string): { bg: string; text: string } {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash * 31) + value.charCodeAt(i)) % TAG_COLORS.length;
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}
