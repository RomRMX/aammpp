export const ZONE_COLORS = ['#4a8fd4', '#4caf50', '#f59e0b', '#a87ee0', '#d47878'] as const

export const STATUS_COLOR: Record<string, string> = {
  green: '#4caf50',
  amber: '#f59e0b',
  red:   '#ef4444',
}

export const STATUS_LABEL: Record<string, string> = {
  green: 'OK',
  amber: 'MARGINAL',
  red:   'FAULT',
}

export type MsgType = 'info' | 'warn' | 'error' | 'ok'
export const PANEL_COLORS: Record<MsgType, { bg: string; border: string; text: string }> = {
  info:  { bg: 'rgba(74,143,212,0.10)',  border: 'var(--blue)',  text: 'var(--blue)'  },
  warn:  { bg: 'rgba(245,158,11,0.10)',  border: 'var(--amber)', text: 'var(--amber)' },
  error: { bg: 'rgba(239,68,68,0.10)',   border: 'var(--red)',   text: 'var(--red)'   },
  ok:    { bg: 'rgba(76,175,80,0.10)',   border: 'var(--green)', text: 'var(--green)' },
}
