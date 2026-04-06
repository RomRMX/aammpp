import { useState, useMemo } from 'react'
import { CATALOG_AMPS, CATALOG_SUB_AMPS, CATALOG_SPEAKERS, CATALOG_SUBS, CATALOG_SOURCE } from '../hooks/useStore'
import type { SpeakerModel, AmpModel } from '../data/catalog'
import { cleanSpeakerName } from '../utils/display'

interface SidebarProps {
  onDragStart: (e: React.DragEvent, modelId: string, kind: 'amp' | 'speaker' | 'sub' | 'source') => void
}

// Amp brand lookup by series
const AMP_SERIES_TO_BRAND: Record<string, string> = {
  Pro: 'Origin Pro',
  Foundation: 'Origin Acoustics',
}

function getAmpBrand(amp: AmpModel): string {
  return AMP_SERIES_TO_BRAND[amp.series] ?? 'Origin Acoustics'
}

function getSpeakerBrand(item: SpeakerModel): string {
  return item.brand ?? 'Origin Acoustics'
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
          padding: '4px 8px 4px 16px',
          background: 'var(--surface-2)',
          border: 'none',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          fontSize: 10,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        <span>{title}</span>
        <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>{open ? '▼' : '▶'}</span>
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
                padding: '5px 8px 5px 24px',
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

function BrandGroup({
  brand,
  collections,
  kind,
  onDragStart,
}: {
  brand: string
  collections: Record<string, SpeakerModel[]>
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
        <span>{brand}</span>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{open ? '▼' : '▶'}</span>
      </button>

      {open && (
        <div>
          {Object.keys(collections).sort().map(col => (
            <CollectionGroup
              key={col}
              title={col}
              items={collections[col]}
              kind={kind}
              onDragStart={onDragStart}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function AmpBrandGroup({
  brand,
  collections,
  onDragStart,
}: {
  brand: string
  collections: Record<string, AmpModel[]>
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
        <span>{brand}</span>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{open ? '▼' : '▶'}</span>
      </button>

      {open && (
        <div>
          {Object.keys(collections).sort().map(col => (
            <AmpCollectionGroup
              key={col}
              title={col}
              items={collections[col]}
              onDragStart={onDragStart}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function AmpCollectionGroup({
  title,
  items,
  onDragStart,
}: {
  title: string
  items: AmpModel[]
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
          padding: '4px 8px 4px 16px',
          background: 'var(--surface-2)',
          border: 'none',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          fontSize: 10,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        <span>{title}</span>
        <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>{open ? '▼' : '▶'}</span>
      </button>

      {open && (
        <div>
          {items.map(amp => (
            <div
              key={amp.modelId}
              draggable
              onDragStart={e => onDragStart(e, amp.modelId, 'amp')}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '5px 8px 5px 24px',
                cursor: 'grab',
                borderTop: '1px solid var(--border)',
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
  )
}

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

/** Group speakers/subs by brand → collection, filtering out specsUnavailable */
function groupByBrandAndCollection(
  items: SpeakerModel[],
  query: string,
): Record<string, Record<string, SpeakerModel[]>> {
  const q = query.toLowerCase()
  const result: Record<string, Record<string, SpeakerModel[]>> = {}
  items
    .filter(item => !item.specsUnavailable)
    .filter(item => !q || item.modelId.toLowerCase().includes(q) || item.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(item => {
      const brand = getSpeakerBrand(item)
      const col = item.collection || 'Other'
      if (!result[brand]) result[brand] = {}
      if (!result[brand][col]) result[brand][col] = []
      result[brand][col].push(item)
    })
  return result
}

/** Group amps by brand → collection (series) */
function groupAmpsByBrandAndCollection(
  items: AmpModel[],
  query: string,
): Record<string, Record<string, AmpModel[]>> {
  const q = query.toLowerCase()
  const result: Record<string, Record<string, AmpModel[]>> = {}
  items
    .filter(amp => !q || amp.name.toLowerCase().includes(q) || amp.modelId.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(amp => {
      const brand = getAmpBrand(amp)
      const col = amp.series || 'Other'
      if (!result[brand]) result[brand] = {}
      if (!result[brand][col]) result[brand][col] = []
      result[brand][col].push(amp)
    })
  return result
}

export function Sidebar({ onDragStart }: SidebarProps) {
  const [query, setQuery] = useState('')

  const speakerBrands = useMemo(
    () => groupByBrandAndCollection(CATALOG_SPEAKERS, query),
    [query],
  )
  const subBrands = useMemo(
    () => groupByBrandAndCollection(CATALOG_SUBS, query),
    [query],
  )
  const ampBrands = useMemo(
    () => groupAmpsByBrandAndCollection(CATALOG_AMPS, query),
    [query],
  )
  const subAmpBrands = useMemo(
    () => groupAmpsByBrandAndCollection(CATALOG_SUB_AMPS, query),
    [query],
  )

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
      {/* Search bar */}
      <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
        <input
          type="text"
          placeholder="Search…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '4px 8px',
            fontSize: 12,
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            color: 'var(--text-primary)',
            outline: 'none',
          }}
        />
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>

        {/* Amplifiers */}
        <SectionToggle label="Amplifiers" open={ampsOpen} onToggle={() => setAmpsOpen(o => !o)} sticky />
        {ampsOpen && Object.keys(ampBrands).sort().map(brand => (
          <AmpBrandGroup
            key={brand}
            brand={brand}
            collections={ampBrands[brand]}
            onDragStart={onDragStart}
          />
        ))}

        {/* Speakers */}
        <SectionToggle label="Speakers" open={speakersOpen} onToggle={() => setSpeakersOpen(o => !o)} sticky />
        {speakersOpen && Object.keys(speakerBrands).sort().map(brand => (
          <BrandGroup
            key={brand}
            brand={brand}
            collections={speakerBrands[brand]}
            kind="speaker"
            onDragStart={onDragStart}
          />
        ))}

        {/* Subwoofers */}
        <SectionToggle label="Subwoofers" open={subsOpen} onToggle={() => setSubsOpen(o => !o)} sticky />
        {subsOpen && (
          <>
            {Object.keys(subBrands).sort().map(brand => (
              <BrandGroup
                key={brand}
                brand={brand}
                collections={subBrands[brand]}
                kind="sub"
                onDragStart={onDragStart}
              />
            ))}
            {Object.keys(subAmpBrands).sort().map(brand => (
              <AmpBrandGroup
                key={`subamp-${brand}`}
                brand={brand}
                collections={subAmpBrands[brand]}
                onDragStart={onDragStart}
              />
            ))}
          </>
        )}

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
              borderLeft: '3px solid var(--blue)',
              background: 'rgba(74,143,212,0.10)',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(74,143,212,0.18)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(74,143,212,0.10)' }}
          >
            <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>
              {CATALOG_SOURCE.name}
            </span>
          </div>
        )}

      </div>
    </div>
  )
}
