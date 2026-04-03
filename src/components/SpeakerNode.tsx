import { memo, useCallback } from 'react'
import { Handle, Position, useReactFlow } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { useStore, type SpeakerNodeData } from '../hooks/useStore'

function SpeakerNodeInner({ id, data }: NodeProps) {
  const { model, selectedMode, selectedTap } = data as SpeakerNodeData
  const { deleteElements } = useReactFlow()
  const setTap = useStore(s => s.setTap)

  const handleDelete = useCallback(() => {
    deleteElements({ nodes: [{ id }] })
  }, [id, deleteElements])

  const isTappable = model.speakerType === 'tappable'
  const needsTapSelection = isTappable && !selectedMode

  // Handle ID for the amp-side input
  const inputHandleId = model.speakerType === 'hi-z' || (isTappable && selectedMode === '70v')
    ? 'spk-in-hiz'
    : 'spk-in-loz'

  // Badge text
  const badge = model.specsUnavailable
    ? 'N/A'
    : model.speakerType === 'tappable'
      ? '8Ω/70V'
      : model.speakerType === 'hi-z'
        ? '70V'
        : model.impedance !== undefined
          ? `${model.impedance}Ω`
          : '?Ω'

  const badgeColor = model.specsUnavailable
    ? 'var(--text-dim)'
    : model.speakerType === 'hi-z' || (isTappable && selectedMode === '70v')
      ? '#f59e0b'
      : 'var(--blue)'

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: needsTapSelection ? '1px solid var(--amber)' : '1px solid var(--border)',
        borderRadius: 4,
        minWidth: 180,
        fontFamily: 'system-ui, sans-serif',
        fontSize: 12,
        color: 'var(--text-primary)',
        userSelect: 'none',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 8px',
          background: 'var(--surface-2)',
          borderBottom: '1px solid var(--border)',
          borderRadius: '4px 4px 0 0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Speaker diamond icon */}
          <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>◆</span>
          <span style={{ fontWeight: 600, fontSize: 12 }}>{model.name}</span>
          <span
            style={{
              fontSize: 10,
              color: badgeColor,
              background: 'rgba(0,0,0,0.3)',
              padding: '1px 5px',
              borderRadius: 3,
              border: `1px solid ${badgeColor}`,
            }}
          >
            {badge}
          </span>
        </div>
        <button
          className="nodrag"
          onClick={handleDelete}
          style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '0 2px', fontSize: 14, lineHeight: 1 }}
          title="Remove"
        >
          ×
        </button>
      </div>

      {/* Collection label */}
      <div style={{ padding: '3px 8px', color: 'var(--text-secondary)', fontSize: 11 }}>
        {model.collection}
      </div>

      {/* Specs unavailable warning */}
      {model.specsUnavailable && (
        <div style={{ padding: '4px 8px', color: 'var(--amber)', fontSize: 11, borderTop: '1px solid var(--border)' }}>
          ⚠ Specs unavailable — validation disabled
        </div>
      )}

      {/* Tappable mode/tap selector */}
      {isTappable && (
        <div
          className="nodrag"
          style={{ padding: '6px 8px', borderTop: '1px solid var(--border)' }}
        >
          {needsTapSelection && (
            <div style={{ color: 'var(--amber)', fontSize: 11, marginBottom: 4 }}>
              ⚠ Tap selection required
            </div>
          )}

          {/* Mode selector */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
            {(['lo-z', '70v'] as const).map(m => (
              <button
                key={m}
                className="nodrag"
                onClick={() => setTap(id, m, undefined)}
                style={{
                  padding: '2px 8px',
                  fontSize: 11,
                  borderRadius: 3,
                  border: '1px solid var(--border)',
                  background: selectedMode === m ? 'var(--blue-dim)' : 'var(--surface-2)',
                  color: selectedMode === m ? 'var(--blue)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                {m === 'lo-z' ? `${model.impedance ?? '?'}Ω` : '70V'}
              </button>
            ))}
          </div>

          {/* Watt tap selector — only in 70V mode */}
          {selectedMode === '70v' && model.tapOptions && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {model.tapOptions.map(w => (
                <button
                  key={w}
                  className="nodrag"
                  onClick={() => setTap(id, '70v', w)}
                  style={{
                    padding: '2px 6px',
                    fontSize: 11,
                    borderRadius: 3,
                    border: '1px solid var(--border)',
                    background: selectedTap === w ? '#1a3a1a' : 'var(--surface-2)',
                    color: selectedTap === w ? 'var(--green)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  {w}W
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Input handle — left side */}
      <Handle
        type="target"
        position={Position.Left}
        id={inputHandleId}
        style={{
          left: -5,
          top: '50%',
          transform: 'translateY(-50%)',
          background: model.speakerType === 'hi-z' || (isTappable && selectedMode === '70v')
            ? 'var(--amber)'
            : 'var(--blue)',
          border: '2px solid var(--surface)',
          width: 10,
          height: 10,
          borderRadius: '50%',
        }}
      />
    </div>
  )
}

export const SpeakerNode = memo(SpeakerNodeInner)
