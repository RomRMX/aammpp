import { memo, useCallback, useState } from 'react'
import { Handle, Position, useReactFlow } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { CATALOG_SOURCE } from '../hooks/useStore'

function SourceNodeInner({ id }: NodeProps) {
  const { deleteElements } = useReactFlow()
  const [showInfo, setShowInfo] = useState(false)

  const handleDelete = useCallback(() => {
    deleteElements({ nodes: [{ id }] })
  }, [id, deleteElements])

  const src = CATALOG_SOURCE

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
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
          <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>▶</span>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{src.name}</span>
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

      <div style={{ padding: '4px 0' }}>
        {/* Analog Out L */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '4px 30px 4px 8px' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Analog Out L</span>
          <Handle
            type="source"
            position={Position.Right}
            id="analog-l"
            style={{ right: -5, top: '50%', transform: 'translateY(-50%)', background: 'var(--blue)', border: '2px solid var(--surface)', width: 10, height: 10, borderRadius: '50%' }}
          />
        </div>

        {/* Analog Out R */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '4px 30px 4px 8px', borderTop: '1px solid var(--border)' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Analog Out R</span>
          <Handle
            type="source"
            position={Position.Right}
            id="analog-r"
            style={{ right: -5, top: '50%', transform: 'translateY(-50%)', background: 'var(--blue)', border: '2px solid var(--surface)', width: 10, height: 10, borderRadius: '50%' }}
          />
        </div>
      </div>

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
            {src.name}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <InfoRow label="Type" value={src.badge} />
              <InfoRow label="Outputs" value="Analog L / R" />
              <InfoRow label="Info" value={src.description} />
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
      <td style={{ color: 'var(--text-dim)', paddingRight: 8, paddingBottom: 3, whiteSpace: 'nowrap', verticalAlign: 'top' }}>{label}</td>
      <td style={{ color: 'var(--text-primary)', paddingBottom: 3 }}>{value}</td>
    </tr>
  )
}

export const SourceNode = memo(SourceNodeInner)
