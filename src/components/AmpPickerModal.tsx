import { useState, useEffect } from 'react'
import { useStore, computeAmpTiers, type AmpTier, type SpeakerNodeData } from '../hooks/useStore'
import { fmtPrice } from '../utils/display'

interface Props {
  selectedSpeakerIds: string[]
  onConfirm: (loZModelId?: string, hiZModelId?: string) => void
  onCancel: () => void
}

// ── Tier config ───────────────────────────────────────────────────────────────

const TIER_CONFIG = {
  headroom: {
    label: 'Headroom',
    color: 'var(--green)',
    dimColor: 'rgba(76,175,80,0.12)',
    note: 'Max channels — room to expand later',
  },
  bestFit: {
    label: 'Best Fit',
    color: 'var(--blue)',
    dimColor: 'rgba(74,143,212,0.12)',
    note: 'Recommended — balanced load, safe headroom',
  },
  economical: {
    label: 'Economical',
    color: 'var(--amber)',
    dimColor: 'rgba(245,158,11,0.10)',
    note: 'Minimum viable — no spare channels',
  },
} as const

// ── Tier card ─────────────────────────────────────────────────────────────────

function TierCard({
  tier,
  speakersNeeded,
  selected,
  onSelect,
}: {
  tier: AmpTier
  speakersNeeded: number
  selected: boolean
  onSelect: () => void
}) {
  const cfg = TIER_CONFIG[tier.tier]
  const watts = tier.wattsPerChannel !== undefined
    ? `${tier.wattsPerChannel}W/ch`
    : tier.hiZCapacity !== undefined
    ? `${tier.hiZCapacity}W capacity`
    : null

  return (
    <div
      onClick={onSelect}
      style={{
        flex: 1,
        padding: '12px 14px',
        borderRadius: 5,
        border: `1.5px solid ${selected ? cfg.color : 'var(--border)'}`,
        background: selected ? cfg.dimColor : 'var(--surface-2)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      {/* Tier badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: cfg.color,
            background: `${cfg.dimColor}`,
            border: `1px solid ${cfg.color}`,
            borderRadius: 3,
            padding: '1px 6px',
          }}
        >
          {cfg.label}
        </span>
        {selected && (
          <span style={{ fontSize: 9, color: cfg.color, fontWeight: 700 }}>✓</span>
        )}
      </div>

      {/* Amp name */}
      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
        {tier.model.name}
      </div>

      {/* Specs */}
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        <div>{tier.matchingChannels} channel{tier.matchingChannels !== 1 ? 's' : ''} · {speakersNeeded} in use · {tier.spareChannels} spare</div>
        {watts && <div>{watts}</div>}
        <div style={{ color: 'var(--text-dim)' }}>{tier.model.series ?? ''}</div>
      </div>

      {/* Price */}
      <div style={{ marginTop: 2, fontSize: 11 }}>
        {tier.model.dealer !== undefined ? (
          <span style={{ color: 'var(--text-secondary)' }}>
            {fmtPrice(tier.model.dealer)} dealer
            {tier.model.msrp !== undefined && (
              <span style={{ color: 'var(--text-dim)' }}> · {fmtPrice(tier.model.msrp)} MSRP</span>
            )}
          </span>
        ) : (
          <span style={{ color: 'var(--text-dim)' }}>Price unavailable</span>
        )}
      </div>

      {/* Note */}
      <div style={{ fontSize: 10, color: 'var(--text-dim)', fontStyle: 'italic', marginTop: 2 }}>
        {cfg.note}
      </div>
    </div>
  )
}

// ── Tier group (lo-Z or hi-Z) ─────────────────────────────────────────────────

function TierGroup({
  label,
  channelType,
  speakersNeeded,
  selectedModelId,
  onSelect,
}: {
  label: string
  channelType: 'lo-z' | 'hi-z'
  speakersNeeded: number
  selectedModelId: string | undefined
  onSelect: (modelId: string) => void
}) {
  const tiers = computeAmpTiers(channelType, speakersNeeded)

  if (tiers.length === 0) return null

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--text-dim)',
        marginBottom: 10,
      }}>
        {label} — {speakersNeeded} speaker{speakersNeeded !== 1 ? 's' : ''}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        {tiers.map(tier => (
          <TierCard
            key={`${tier.tier}-${tier.model.modelId}`}
            tier={tier}
            speakersNeeded={speakersNeeded}
            selected={selectedModelId === tier.model.modelId}
            onSelect={() => onSelect(tier.model.modelId)}
          />
        ))}
      </div>
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────

export function AmpPickerModal({ selectedSpeakerIds, onConfirm, onCancel }: Props) {
  const nodes = useStore(s => s.nodes)

  const speakers = nodes.filter(n => selectedSpeakerIds.includes(n.id) && n.data.kind === 'speaker')
  const loZCount = speakers.filter(n => {
    const d = n.data as SpeakerNodeData
    if (d.model.speakerType === 'hi-z') return false
    if (d.model.speakerType === 'tappable') return d.selectedMode !== '70v'
    return true
  }).length
  const hiZCount = speakers.filter(n => {
    const d = n.data as SpeakerNodeData
    if (d.model.speakerType === 'hi-z') return true
    if (d.model.speakerType === 'tappable') return d.selectedMode === '70v'
    return false
  }).length

  const [loZChoice, setLoZChoice] = useState<string | undefined>()
  const [hiZChoice, setHiZChoice] = useState<string | undefined>()

  // Default to Best Fit tier on open
  useEffect(() => {
    if (loZCount > 0) {
      const tiers = computeAmpTiers('lo-z', loZCount)
      setLoZChoice(tiers.find(t => t.tier === 'bestFit')?.model.modelId)
    }
    if (hiZCount > 0) {
      const tiers = computeAmpTiers('hi-z', hiZCount)
      setHiZChoice(tiers.find(t => t.tier === 'bestFit')?.model.modelId)
    }
  }, [loZCount, hiZCount])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '20px 22px',
          minWidth: 560,
          maxWidth: 740,
          width: '90vw',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          fontFamily: 'system-ui, sans-serif',
          color: 'var(--text-primary)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Select Amplifier</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
              {speakers.length} speaker{speakers.length !== 1 ? 's' : ''} selected — choose a recommendation tier
            </div>
          </div>
          <button
            onClick={onCancel}
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 2px' }}
          >
            ×
          </button>
        </div>

        {/* Tier groups */}
        {loZCount > 0 && (
          <TierGroup
            label="Lo-Z"
            channelType="lo-z"
            speakersNeeded={loZCount}
            selectedModelId={loZChoice}
            onSelect={setLoZChoice}
          />
        )}
        {hiZCount > 0 && (
          <TierGroup
            label="Hi-Z / 70V"
            channelType="hi-z"
            speakersNeeded={hiZCount}
            selectedModelId={hiZChoice}
            onSelect={setHiZChoice}
          />
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button
            onClick={onCancel}
            style={{
              padding: '6px 16px',
              background: 'none',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(loZChoice, hiZChoice)}
            style={{
              padding: '6px 18px',
              background: 'var(--blue-dim)',
              border: '1px solid var(--blue)',
              color: 'var(--blue)',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Wire Zone
          </button>
        </div>
      </div>
    </div>
  )
}
