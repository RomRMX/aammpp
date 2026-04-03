import { useState } from 'react'
import { CATALOG_AMPS, CATALOG_SPEAKERS, CATALOG_SUBS, CATALOG_SOURCE } from '../hooks/useStore'
import type { SpeakerModel } from '../data/catalog'
import { cleanSpeakerName } from '../utils/display'

interface SidebarProps {
  onDragStart: (e: React.DragEvent, modelId: string, kind: 'amp' | 'speaker' | 'sub' | 'source') => void
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
    return <span style={{ fontSize: 10, color: 'var(--text-secondary)', marginLeft: 4 }}>Lo-Z / Hi-Z</span>
  }
  if (model.speakerType === 'hi-z') {
    return <span style={{ fontSize: 10, color: 'var(--text-secondary)', marginLeft: 4 }}>Hi-Z</span>
  }
  return <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 4 }}>Lo-Z</span>
}

/** Collapsible collection group */
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
  const [open, setOpen] = useState(false)

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
          background: 'var(--surface-2)',
          border: 'none',
          color: 'var(--blue)',
          cursor: 'pointer',
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        <span>{title}</span>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{open ? '▼' : '▶'}</span>
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
                padding: '5px 8px 5px 14px',
                cursor: 'grab',
                borderTop: '1px solid var(--border)',
                background: 'var(--surface)',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface)' }}
            >
              <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, flex: 1 }}>
                {cleanSpeakerName(item.name, item.collection)}
              </span>
              <TypeBadge model={item} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Top-level collapsible section header */
function SectionToggle({
  label,
  open,
  onToggle,
  sticky,
}: {
  label: string
  open: boolean
  onToggle: () => void
  sticky?: boolean
}) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 8px',
        background: 'var(--bg)',
        border: 'none',
        borderBottom: '1px solid var(--border)',
        cursor: 'pointer',
        fontSize: 10,
        fontWeight: 700,
        color: 'var(--blue)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        ...(sticky ? { position: 'sticky', top: 0, zIndex: 2 } : {}),
      }}
    >
      <span>{label}</span>
      <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{open ? '▼' : '▶'}</span>
    </button>
  )
}

export function Sidebar({ onDragStart }: SidebarProps) {
  const speakerGroups = groupByCollection(CATALOG_SPEAKERS)
  const subGroups     = groupByCollection(CATALOG_SUBS)

  const [speakersOpen, setSpeakersOpen] = useState(true)
  const [subsOpen,     setSubsOpen]     = useState(true)
  const [sourceOpen,   setSourceOpen]   = useState(true)
  const [ampsOpen,     setAmpsOpen]     = useState(true)

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
      {/* Single scrollable area: Speakers → Subwoofers → Source → Amplifiers */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>

        {/* Speakers */}
        <SectionToggle label="Speakers" open={speakersOpen} onToggle={() => setSpeakersOpen(o => !o)} sticky />
        {speakersOpen && Object.entries(speakerGroups).map(([col, items]) => (
          <CollectionGroup key={col} title={col} items={items} kind="speaker" onDragStart={onDragStart} />
        ))}

        {/* Subwoofers */}
        <SectionToggle label="Subwoofers" open={subsOpen} onToggle={() => setSubsOpen(o => !o)} sticky />
        {subsOpen && Object.entries(subGroups).map(([col, items]) => (
          <CollectionGroup key={col} title={col} items={items} kind="sub" onDragStart={onDragStart} />
        ))}

        {/* Source */}
        <SectionToggle label="Source" open={sourceOpen} onToggle={() => setSourceOpen(o => !o)} sticky />
        {sourceOpen && (
          <div
            draggable
            onDragStart={e => onDragStart(e, CATALOG_SOURCE.modelId, 'source')}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '6px 8px',
              cursor: 'grab',
              borderBottom: '1px solid var(--border)',
              background: 'var(--surface)',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface)' }}
          >
            <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>
              {CATALOG_SOURCE.name}
            </span>
          </div>
        )}

        {/* Amplifiers */}
        <SectionToggle label="Amplifiers" open={ampsOpen} onToggle={() => setAmpsOpen(o => !o)} sticky />
        {ampsOpen && (
          <div>
            {CATALOG_AMPS.map((amp, i) => (
              <div
                key={amp.modelId}
                draggable
                onDragStart={e => onDragStart(e, amp.modelId, 'amp')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '5px 8px',
                  cursor: 'grab',
                  borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                  borderBottom: '1px solid var(--border)',
                  background: 'var(--surface)',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface)' }}
              >
                <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>{amp.name}</span>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
