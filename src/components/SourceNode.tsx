import { memo, useCallback } from 'react'
import { Handle, Position, useReactFlow } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { CATALOG_SOURCE } from '../hooks/useStore'

function SourceNodeInner({ id }: NodeProps) {
  const { deleteElements } = useReactFlow()

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
          <span
            style={{
              fontSize: 10,
              color: 'var(--text-secondary)',
              background: 'rgba(0,0,0,0.3)',
              padding: '1px 5px',
              borderRadius: 3,
              border: '1px solid var(--border)',
            }}
          >
            {src.badge}
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

        {/* AES Out */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '4px 30px 4px 8px', borderTop: '1px solid var(--border)' }}>
          <span style={{ color: 'var(--text-secondary)' }}>AES Out</span>
          <Handle
            type="source"
            position={Position.Right}
            id="aes-out"
            style={{ right: -5, top: '50%', transform: 'translateY(-50%)', background: 'var(--blue)', border: '2px solid var(--surface)', width: 10, height: 10, borderRadius: '50%' }}
          />
        </div>
      </div>
    </div>
  )
}

export const SourceNode = memo(SourceNodeInner)
