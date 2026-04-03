import { memo, useCallback } from 'react'
import { Handle, Position, useReactFlow } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { useStore, type AmpNodeData } from '../hooks/useStore'

const STATUS_COLOR: Record<string, string> = {
  green: '#4caf50',
  amber: '#f59e0b',
  red:   '#ef4444',
}

function AmpNodeInner({ id, data }: NodeProps) {
  const { model } = data as AmpNodeData
  const { deleteElements } = useReactFlow()
  const getChannelZoneStatus = useStore(s => s.getChannelZoneStatus)

  const handleDelete = useCallback(() => {
    deleteElements({ nodes: [{ id }] })
  }, [id, deleteElements])

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        minWidth: 260,
        fontFamily: 'system-ui, sans-serif',
        fontSize: 12,
        color: 'var(--text-primary)',
        userSelect: 'none',
      }}
    >
      {/* Header */}
      <div
        className="nodrag"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 8px',
          background: 'var(--surface-2)',
          borderBottom: '1px solid var(--border)',
          borderRadius: '4px 4px 0 0',
          cursor: 'grab',
        }}
        onMouseDown={e => {
          // Allow dragging from header but not from delete button
          if ((e.target as HTMLElement).tagName !== 'BUTTON') {
            // re-enable drag by removing nodrag
          }
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              display: 'inline-block',
              width: 8, height: 8,
              borderRadius: '50%',
              background: 'var(--blue)',
            }}
          />
          <span style={{ fontWeight: 600, fontSize: 13 }}>{model.name}</span>
          <span
            style={{
              fontSize: 10,
              color: 'var(--text-secondary)',
              background: 'var(--blue-dim)',
              padding: '1px 5px',
              borderRadius: 3,
            }}
          >
            {model.series.toUpperCase()}
          </span>
        </div>
        <button
          className="nodrag"
          onClick={handleDelete}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-dim)',
            cursor: 'pointer',
            padding: '0 2px',
            fontSize: 14,
            lineHeight: 1,
          }}
          title="Remove"
        >
          ×
        </button>
      </div>

      {/* Subtitle */}
      <div style={{ padding: '3px 8px', color: 'var(--text-secondary)', fontSize: 11, borderBottom: '1px solid var(--border)' }}>
        {model.subtitle}
      </div>

      {/* Channels */}
      <div style={{ padding: '4px 0' }}>
        {model.channels.map((ch, idx) => {
          const { status, detail } = getChannelZoneStatus(id, ch.id, ch.outputMode)
          const handleId = `${ch.id}-out`
          const isFirst = idx === 0

          return (
            <div
              key={ch.id}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                padding: '5px 32px 5px 8px',
                borderTop: isFirst ? 'none' : '1px solid var(--border)',
                gap: 6,
              }}
            >
              {/* Zone status dot */}
              <span
                style={{
                  display: 'inline-block',
                  width: 7, height: 7,
                  borderRadius: '50%',
                  background: STATUS_COLOR[status],
                  flexShrink: 0,
                }}
                title={detail}
              />

              {/* Channel label */}
              <span style={{ color: 'var(--text-secondary)', flex: 1, textAlign: 'right' }}>
                {ch.label}
              </span>

              {/* Output handle — right side */}
              <Handle
                type="source"
                position={Position.Right}
                id={handleId}
                style={{
                  right: -5,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: ch.outputMode === 'hi-z' ? 'var(--amber)' : 'var(--blue)',
                  border: '2px solid var(--surface)',
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                }}
              />
            </div>
          )
        })}
      </div>

      {/* Input handles — left side (one shared analog input) */}
      <Handle
        type="target"
        position={Position.Left}
        id="analog-in"
        style={{
          left: -5,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'var(--blue)',
          border: '2px solid var(--surface)',
          width: 10,
          height: 10,
          borderRadius: '50%',
        }}
      />
    </div>
  )
}

export const AmpNode = memo(AmpNodeInner)
