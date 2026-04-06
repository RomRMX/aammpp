import { useState, useMemo } from 'react'
import { CATALOG_AMPS, CATALOG_SUB_AMPS, CATALOG_SPEAKERS, CATALOG_SUBS, CATALOG_SOURCE } from '../hooks/useStore'
import type { SpeakerModel, AmpModel } from '../data/catalog'
import { cleanSpeakerName } from '../utils/display'

interface SidebarProps {
  onDragStart: (e: React.DragEvent, modelId: string, kind: 'amp' | 'speaker' | 'sub' | 'source') => void
}

type Tab = 'speakers' | 'subs' | 'amps'

// ── Helpers ──────────────────────────────────────────────────────────────────

// Maps sub collection → brand for two-level grouping in Subs tab
const SUB_COLLECTION_BRAND: Record<string, string> = {
  AMBI: 'AMBI',
  MOS:  'AMBI',
  Pro:  'Origin Pro',
}
function getSubBrand(collection: string): string {
  return SUB_COLLECTION_BRAND[collection] ?? 'Origin Acoustics'
}

// Brand display order for Subs tab
const SUB_BRAND_ORDER = ['AMBI', 'Origin Acoustics', 'Origin Pro']

function groupByCollection(items: SpeakerModel[], query: string): Record<string, SpeakerModel[]> {
  const q = query.toLowerCase()
  const result: Record<string, SpeakerModel[]> = {}
  items
    .filter(item => !item.specsUnavailable)
    .filter(item => !q || item.modelId.toLowerCase().includes(q) || item.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(item => {
      const col = item.collection || 'Other'
      if (!result[col]) result[col] = []
      result[col].push(item)
    })
  return result
}

// Groups subs as brand → collection → items
function groupSubsByBrand(items: SpeakerModel[], query: string): Record<string, Record<string, SpeakerModel[]>> {
  const byCollection = groupByCollection(items, query)
  const result: Record<string, Record<string, SpeakerModel[]>> = {}
  for (const [col, colItems] of Object.entries(byCollection)) {
    const brand = getSubBrand(col)
    if (!result[brand]) result[brand] = {}
    result[brand][col] = colItems
  }
  return result
}

function ampOutputLabel(amp: AmpModel): string {
  const modes = new Set(amp.channels.map(c => c.outputMode))
  if (modes.has('lo-z') && modes.has('hi-z')) return 'Lo-Z · Hi-Z'
  if (modes.has('hi-z')) return 'Hi-Z'
  return 'Lo-Z'
}

function groupBySeriesAmps(items: AmpModel[], query: string): Record<string, AmpModel[]> {
  const q = query.toLowerCase()
  const result: Record<string, AmpModel[]> = {}
  items
    .filter(item => !q || item.name.toLowerCase().includes(q) || item.modelId.toLowerCase().includes(q))
    .forEach(item => {
      const s = item.series || 'Other'
      if (!result[s]) result[s] = []
      result[s].push(item)
    })
  return result
}

// ── Sub-components ────────────────────────────────────────────────────────────

function GroupDivider({ label }: { label: string }) {
  return (
    <div style={{
      padding: '6px 10px 3px',
      fontSize: 9,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
      color: 'var(--text-dim)',
      background: 'var(--bg)',
      borderBottom: '1px solid var(--border)',
      userSelect: 'none',
    }}>
      {label}
    </div>
  )
}

function TypeBadge({ model }: { model: SpeakerModel }) {
  const style: React.CSSProperties = { fontSize: 9, marginLeft: 4, flexShrink: 0, color: 'var(--text-secondary)' }
  if (model.speakerType === 'tappable') return <span style={style}>Lo-Z · Hi-Z</span>
  if (model.speakerType === 'hi-z')    return <span style={style}>Hi-Z</span>
  return <span style={{ ...style, color: 'var(--text-dim)' }}>Lo-Z</span>
}

function BrandDivider({ label }: { label: string }) {
  return (
    <div style={{
      padding: '6px 10px 3px',
      fontSize: 9,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
      color: 'var(--text-dim)',
      background: 'var(--bg)',
      borderBottom: '1px solid var(--border)',
      userSelect: 'none',
    }}>
      {label}
    </div>
  )
}

function CatBadge({ label }: { label: string }) {
  return (
    <span style={{
      fontSize: 9,
      color: 'var(--text-dim)',
      border: '1px solid var(--border)',
      borderRadius: 3,
      padding: '0 4px',
      marginLeft: 6,
      flexShrink: 0,
    }}>
      {label}
    </span>
  )
}

const GRIP = '⠿'

function DraggableRow({
  label,
  onDragStart,
  right,
  accent,
  bgOverride,
}: {
  label: string
  onDragStart: (e: React.DragEvent) => void
  right?: React.ReactNode
  accent?: string
  bgOverride?: string
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '5px 8px 5px 0',
        cursor: 'grab',
        background: hovered
          ? (bgOverride ? 'rgba(74,143,212,0.18)' : 'var(--surface-2)')
          : (bgOverride ?? 'var(--surface)'),
        borderBottom: '1px solid var(--border)',
        borderLeft: `3px solid ${accent ?? 'transparent'}`,
        gap: 6,
      }}
    >
      <span style={{ color: 'var(--text-dim)', fontSize: 11, paddingLeft: 6, flexShrink: 0 }}>{GRIP}</span>
      <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      {right}
    </div>
  )
}

// ── Tab content ───────────────────────────────────────────────────────────────

function SpeakersTab({ query, onDragStart }: { query: string; onDragStart: SidebarProps['onDragStart'] }) {
  const grouped = useMemo(() => groupByCollection(CATALOG_SPEAKERS, query), [query])
  const collections = Object.keys(grouped).sort()
  if (collections.length === 0)
    return <EmptyState />
  return (
    <>
      {collections.map(col => (
        <div key={col}>
          <GroupDivider label={col} />
          {grouped[col].map(item => (
            <DraggableRow
              key={item.modelId}
              label={cleanSpeakerName(item.name, item.collection)}
              onDragStart={e => onDragStart(e, item.modelId, 'speaker')}
              right={<TypeBadge model={item} />}
            />
          ))}
        </div>
      ))}
    </>
  )
}

function SubsTab({ query, onDragStart }: { query: string; onDragStart: SidebarProps['onDragStart'] }) {
  const byBrand = useMemo(() => groupSubsByBrand(CATALOG_SUBS, query), [query])
  const filteredSubAmps = useMemo(() => {
    const q = query.toLowerCase()
    return q
      ? CATALOG_SUB_AMPS.filter(a => a.name.toLowerCase().includes(q) || a.modelId.toLowerCase().includes(q))
      : CATALOG_SUB_AMPS
  }, [query])

  const hasPassive = Object.keys(byBrand).length > 0
  const hasSubs = filteredSubAmps.length > 0
  if (!hasPassive && !hasSubs) return <EmptyState />

  return (
    <>
      {SUB_BRAND_ORDER.filter(b => byBrand[b]).map(brand => {
        const collections = Object.keys(byBrand[brand]).sort()
        return (
          <div key={brand}>
            <BrandDivider label={brand} />
            {collections.map(col =>
              byBrand[brand][col].map(item => (
                <DraggableRow
                  key={item.modelId}
                  label={cleanSpeakerName(item.name, item.collection)}
                  onDragStart={e => onDragStart(e, item.modelId, 'sub')}
                  right={<TypeBadge model={item} />}
                />
              ))
            )}
          </div>
        )
      })}
      {hasSubs && (
        <>
          <GroupDivider label="Sub Amplifiers" />
          {filteredSubAmps.map(amp => (
            <DraggableRow
              key={amp.modelId}
              label={amp.name}
              onDragStart={e => onDragStart(e, amp.modelId, 'amp')}
              right={<span style={{ fontSize: 9, color: 'var(--text-secondary)', marginLeft: 4, flexShrink: 0 }}>{ampOutputLabel(amp)}</span>}
            />
          ))}
        </>
      )}
    </>
  )
}

function AmpsTab({ query, onDragStart }: { query: string; onDragStart: SidebarProps['onDragStart'] }) {
  const grouped = useMemo(() => groupBySeriesAmps(CATALOG_AMPS, query), [query])
  const SERIES_ORDER = ['Pro', 'Foundation']
  const series = SERIES_ORDER.filter(s => grouped[s]).concat(Object.keys(grouped).filter(s => !SERIES_ORDER.includes(s)).sort())
  if (series.length === 0) return <EmptyState />
  return (
    <>
      {series.map(s => (
        <div key={s}>
          <GroupDivider label={s} />
          {grouped[s].map(amp => (
            <DraggableRow
              key={amp.modelId}
              label={amp.name}
              onDragStart={e => onDragStart(e, amp.modelId, 'amp')}
              accent="var(--blue)"
            />
          ))}
        </div>
      ))}
    </>
  )
}

function SearchResults({ query, onDragStart }: { query: string; onDragStart: SidebarProps['onDragStart'] }) {
  const q = query.toLowerCase()
  const speakers = CATALOG_SPEAKERS.filter(i => !i.specsUnavailable && (i.modelId.toLowerCase().includes(q) || i.name.toLowerCase().includes(q)))
  const subs = CATALOG_SUBS.filter(i => !i.specsUnavailable && (i.modelId.toLowerCase().includes(q) || i.name.toLowerCase().includes(q)))
  const amps = [...CATALOG_AMPS, ...CATALOG_SUB_AMPS].filter(a => a.name.toLowerCase().includes(q) || a.modelId.toLowerCase().includes(q))

  if (speakers.length === 0 && subs.length === 0 && amps.length === 0)
    return <EmptyState />

  return (
    <>
      {speakers.map(item => (
        <DraggableRow
          key={item.modelId}
          label={cleanSpeakerName(item.name, item.collection)}
          onDragStart={e => onDragStart(e, item.modelId, 'speaker')}
          right={<><TypeBadge model={item} /><CatBadge label="SPKR" /></>}
        />
      ))}
      {subs.map(item => (
        <DraggableRow
          key={item.modelId}
          label={cleanSpeakerName(item.name, item.collection)}
          onDragStart={e => onDragStart(e, item.modelId, 'sub')}
          right={<><TypeBadge model={item} /><CatBadge label="SUB" /></>}
        />
      ))}
      {amps.map(amp => (
        <DraggableRow
          key={amp.modelId}
          label={amp.name}
          onDragStart={e => onDragStart(e, amp.modelId, 'amp')}
          right={<CatBadge label="AMP" />}
          accent="var(--blue)"
        />
      ))}
    </>
  )
}

function EmptyState() {
  return (
    <div style={{ padding: '20px 12px', color: 'var(--text-dim)', fontSize: 12, textAlign: 'center' }}>
      No results
    </div>
  )
}

// ── Main Sidebar ──────────────────────────────────────────────────────────────

export function Sidebar({ onDragStart }: SidebarProps) {
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('speakers')

  const tabs: { id: Tab; label: string }[] = [
    { id: 'speakers', label: 'Speakers' },
    { id: 'subs',     label: 'Subs' },
    { id: 'amps',     label: 'Amps' },
  ]

  const isSearching = query.trim().length > 0

  return (
    <div style={{
      width: 240,
      height: '100%',
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      flexShrink: 0,
    }}>

      {/* Search */}
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

      {/* Tab bar */}
      {!isSearching && (
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg)',
          flexShrink: 0,
        }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                padding: '6px 4px',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid var(--blue)' : '2px solid transparent',
                background: 'transparent',
                color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-dim)',
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Scrollable list */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {isSearching ? (
          <SearchResults query={query} onDragStart={onDragStart} />
        ) : activeTab === 'speakers' ? (
          <SpeakersTab query={query} onDragStart={onDragStart} />
        ) : activeTab === 'subs' ? (
          <SubsTab query={query} onDragStart={onDragStart} />
        ) : (
          <AmpsTab query={query} onDragStart={onDragStart} />
        )}
      </div>

      {/* Pinned source footer */}
      <div style={{ borderTop: '1px solid var(--border)', flexShrink: 0, background: 'rgba(74,143,212,0.10)' }}>
        <DraggableRow
          label={CATALOG_SOURCE.name}
          onDragStart={e => onDragStart(e, CATALOG_SOURCE.modelId, 'source')}
          accent="var(--blue)"
          bgOverride="rgba(74,143,212,0.10)"
        />
      </div>

    </div>
  )
}
