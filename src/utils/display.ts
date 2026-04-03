/**
 * Strip vendor color/variant suffixes from speaker display names per collection.
 * Keeps the catalog data clean while presenting tidy names in the UI.
 */
export function cleanSpeakerName(name: string, collection: string): string {
  switch (collection) {
    case 'HD':      return name.replace(/-BK$/, '')
    case 'Marquee': return name.replace(/IW$/, '')
    case 'AMBI':    return name.replace(/-?BL$/, '')
    default:        return name
  }
}

export function fmtPrice(n?: number): string {
  return n !== undefined ? `$${n.toLocaleString()}` : '—'
}
