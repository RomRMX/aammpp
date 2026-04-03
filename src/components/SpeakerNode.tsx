import { memo, useCallback, useState } from 'react'
import { Handle, Position, useReactFlow } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { useStore, type SpeakerNodeData } from '../hooks/useStore'
import { cleanSpeakerName } from '../utils/display'

const HANDLE_STYLE = {
  border: '2px solid var(--surface)',
  width: 10,
  height: 10,
  borderRadius: '50%',
}

function SpeakerNodeInner({ id, data }: NodeProps) {
  const { model, selectedTap } = data as SpeakerNodeData
  const { deleteElements } = useReactFlow()
  const setTap = useStore(s => s.setTap)
  const [showInfo, setShowInfo] = useState(false)

  const handleDelete = useCallback(() => {
    deleteElements({ nodes: [{ id }] })
  }, [id, deleteElements])

  const isTappable = model.speakerType === 'tappable'
  const isHiZ = model.speakerType === 'hi-z'

  const displayName = cleanSpeakerName(model.name, model.collection)

  // Amber border if tappable and no tap selected
  const needsTap = isTappable && !selectedTap
  const borderColor = needsTap ? 'var(--amber)' : 'var(--border)'

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: `1px solid ${borderColor}`,
        borderRadius: 4,
        minWidth: 180,
        fontFamily: 'system-ui, sans-serif',
        fontSize: 12,
        color: 'var(--text-primary)',
        userSelect: 'none',
        position: 'relative',
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
          <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>◆</span>
          <span style={{ fontWeight: 600, fontSize: 12 }}>{displayName}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* Info button */}
          <button
            className="nodrag"
            onClick={() => setShowInfo(v => !v)}
            style={{
              background: showInfo ? 'var(--blue-dim)' : 'none',
              border: `1px solid ${showInfo ? 'var(--blue)' : 'transparent'}`,
              color: showInfo ? 'var(--blue)' : 'var(--text-dim)',
              cursor: 'pointer',
              padding: '0 4px',
              fontSize: 12,
              lineHeight: '16px',
              borderRadius: 3,
            }}
            title="Show specs"
          >
            ⓘ
          </button>
          <button
            className="nodrag"
            onClick={handleDelete}
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '0 2px', fontSize: 14, lineHeight: 1 }}
            title="Remove"
          >
            ×
          </button>
        </div>
      </div>

      {/* Collection label */}
      <div style={{ padding: '3px 8px', color: 'var(--text-secondary)', fontSize: 11, borderBottom: '1px solid var(--border)' }}>
        {model.collection}
      </div>

      {/* Specs unavailable */}
      {model.specsUnavailable && (
        <div style={{ padding: '4px 8px', color: 'var(--amber)', fontSize: 11, borderBottom: '1px solid var(--border)' }}>
          ⚠ Specs unavailable — validation disabled
        </div>
      )}

      {/* Wattage / impedance info row */}
      {!model.specsUnavailable && (
        <div style={{ padding: '3px 8px 3px 8px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {model.speakerType === 'lo-z' && model.impedance !== undefined && (
            <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{model.impedance}Ω load</span>
          )}
          {model.speakerType === 'hi-z' && model.tapOptions && model.tapOptions.length > 0 && (
            <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
              Tap: {model.tapOptions.join('W / ')}W
            </span>
          )}
          {model.speakerType === 'tappable' && model.impedance !== undefined && model.tapOptions && (
            <>
              <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{model.impedance}Ω</span>
              <span style={{ fontSize: 10, color: 'var(--text-dim)', opacity: 0.5 }}>·</span>
              <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                70V: {model.tapOptions.join('W / ')}W
              </span>
            </>
          )}
        </div>
      )}

      {/* Input port rows — left side */}
      <div>
        {/* Lo-Z In — shown for lo-z and tappable */}
        {!isHiZ && (
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              padding: '5px 8px 5px 20px',
              gap: 6,
            }}
          >
            <Handle
              type="target"
              position={Position.Left}
              id="spk-in-loz"
              style={{ ...HANDLE_STYLE, left: -5, top: '50%', transform: 'translateY(-50%)', background: 'var(--blue)' }}
            />
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Lo-Z In</span>
          </div>
        )}

        {/* Hi-Z In — shown for hi-z and tappable */}
        {(isHiZ || isTappable) && (
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              padding: '5px 8px 5px 20px',
              borderTop: isTappable ? '1px solid var(--border)' : 'none',
              gap: 6,
            }}
          >
            <Handle
              type="target"
              position={Position.Left}
              id="spk-in-hiz"
              style={{ ...HANDLE_STYLE, left: -5, top: '50%', transform: 'translateY(-50%)', background: 'var(--amber)' }}
            />
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Hi-Z In</span>
          </div>
        )}
      </div>

      {/* Watt tap selector — tappable speakers only */}
      {isTappable && model.tapOptions && (
        <div
          className="nodrag"
          style={{ padding: '6px 8px', borderTop: '1px solid var(--border)' }}
        >
          {needsTap && (
            <div style={{ color: 'var(--amber)', fontSize: 11, marginBottom: 4 }}>
              ⚠ Select 70V tap wattage
            </div>
          )}
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
        </div>
      )}

      {/* Info popover */}
      {showInfo && (
        <div
          className="nodrag nopan"
          style={{
            position: 'absolute',
            top: 0,
            left: 'calc(100% + 8px)',
            zIndex: 100,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: '10px 12px',
            minWidth: 180,
            maxWidth: 240,
            fontSize: 11,
            color: 'var(--text-primary)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8, color: 'var(--blue)' }}>
            {displayName}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <InfoRow label="Collection" value={model.collection} />
              <InfoRow label="Type" value={
                model.speakerType === 'tappable' ? 'Lo-Z / Hi-Z'
                : model.speakerType === 'hi-z' ? 'Hi-Z (70V)'
                : 'Lo-Z'
              } />
              {model.specsUnavailable && <InfoRow label="Specs" value="Unavailable" />}
              {!model.specsUnavailable && model.impedance !== undefined && (
                <InfoRow label="Impedance" value={`${model.impedance}Ω`} />
              )}
              {!model.specsUnavailable && model.tapOptions && model.tapOptions.length > 0 && (
                <InfoRow label="70V Taps" value={model.tapOptions.map(w => `${w}W`).join(', ')} />
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td style={{ color: 'var(--text-dim)', paddingRight: 8, paddingBottom: 3, whiteSpace: 'nowrap' }}>{label}</td>
      <td style={{ color: 'var(--text-primary)', paddingBottom: 3 }}>{value}</td>
    </tr>
  )
}

export const SpeakerNode = memo(SpeakerNodeInner)
