import { useState } from 'react'
import { CATALOG_AMPS, CATALOG_SPEAKERS, CATALOG_SUBS, CATALOG_SOURCE } from '../hooks/useStore'
import type { SpeakerModel } from '../data/catalog'

interface SidebarProps {
  onDragStart: (e: React.DragEvent, modelId: string, kind: 'amp' | 'speaker' | 'sub' | 'source') => void
}

// Collection color palette
const COLLECTION_COLORS: Record<string, string> = {
  'Composer':     '#7ca5d4',
  'Director':     '#74b87a',
  'ThinFit':      '#6ec4c4',
  'BLENDS':       '#a87ee0',
  'Seasons':      '#c4a55a',
  'Pro':          '#d47878',
  'AMBI':         '#7ec49e',
  'HD':           '#6ab8d8',
  'Marquee':      '#c47ca8',
  'Foundation':   '#8898b8',
  'Theater':      '#b4a468',
  'Professional': '#c4a870',
  'Slim':         '#94b8a8',
  'Other':        '#888888',
}

function collectionColor(name: string): string {
  return COLLECTION_COLORS[name] ?? '#888888'
}

// Group by collection, filtering out specsUnavailable items
function groupByCollection(items: SpeakerModel[]): Record<string, SpeakerModel[]> {
  const groups: Record<string, SpeakerModel[]> = {}
  items
    .filter(item => !item.specsUnavailable)
    .forEach(item => {
      const col = item.collection || 'Other'
      if (!groups[col]) groups[col] = []
      groups[col].push(item)
    })
  return groups
}

function TypeBadge({ model }: { model: SpeakerModel }) {
  if (model.speakerType === 'tappable') {
    return <span style={{ fontSize: 10, color: 'var(--text-secondary)', marginLeft: 4 }}>8Ω/70V</span>
  }
  if (model.speakerType === 'hi-z') {
    return <span style={{ fontSize: 10, color: 'var(--text-secondary)', marginLeft: 4 }}>70V</span>
  }
  if (model.impedance !== undefined) {
    return <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 4 }}>{model.impedance}Ω</span>
  }
  return <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 4 }}>?Ω</span>
}

function CollectionGroup({
  title,
  items,
  kind,
  onDragStart,
}: {
  title: string
  items: SpeakerModel[]
  kind: 'speaker' | 'sub'
  onDragStart: SidebarProps['onDragStart']
}) {
  // Start collapsed
  const [open, setOpen] = useState(false)
  const color = collectionColor(title)

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '5px 8px',
          background: 'none',
          border: 'none',
          color,
          cursor: 'pointer',
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        <span>{title}</span>
        <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div>
          {items.map(item => (
            <div
              key={item.modelId}
              draggable
              onDragStart={e => onDragStart(e, item.modelId, kind)}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '4px 8px 4px 16px',
                cursor: 'grab',
                borderTop: '1px solid var(--border)',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <span style={{ fontSize: 12, color: 'var(--text-primary)', flex: 1 }}>{item.name}</span>
              <TypeBadge model={item} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div
      style={{
        padding: '6px 8px',
        background: 'var(--bg)',
        borderBottom: '1px solid var(--border)',
        fontSize: 10,
        fontWeight: 700,
        color: 'var(--text-dim)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}
    >
      {label}
    </div>
  )
}

export function Sidebar({ onDragStart }: SidebarProps) {
  const speakerGroups = groupByCollection(CATALOG_SPEAKERS)
  const subGroups = groupByCollection(CATALOG_SUBS)

  return (
    <div
      style={{
        width: 220,
        height: '100%',
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* Source — pinned top */}
      <SectionHeader label="Source" />
      <div
        draggable
        onDragStart={e => onDragStart(e, CATALOG_SOURCE.modelId, 'source')}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '6px 8px',
          cursor: 'grab',
          borderBottom: '1px solid var(--border)',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      >
        <span style={{ fontSize: 10, color: 'var(--text-secondary)', marginRight: 6 }}>▶</span>
        <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{CATALOG_SOURCE.name}</span>
      </div>

      {/* Scrollable speakers + subs */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <SectionHeader label="Speakers" />
        {Object.entries(speakerGroups).map(([col, items]) => (
          <CollectionGroup key={col} title={col} items={items} kind="speaker" onDragStart={onDragStart} />
        ))}

        <SectionHeader label="Subwoofers" />
        {Object.entries(subGroups).map(([col, items]) => (
          <CollectionGroup key={col} title={col} items={items} kind="sub" onDragStart={onDragStart} />
        ))}
      </div>

      {/* Amps — fixed bottom, no scroll */}
      <div style={{ borderTop: '2px solid var(--border)', background: 'var(--surface)' }}>
        <SectionHeader label="Amplifiers" />
        <div>
          {CATALOG_AMPS.map(amp => (
            <div
              key={amp.modelId}
              draggable
              onDragStart={e => onDragStart(e, amp.modelId, 'amp')}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '5px 8px',
                cursor: 'grab',
                borderTop: '1px solid var(--border)',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <span style={{ fontSize: 12, color: 'var(--text-primary)', flex: 1 }}>{amp.name}</span>
              <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{amp.subtitle}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
