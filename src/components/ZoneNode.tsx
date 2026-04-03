import { memo, useState, useCallback } from 'react'
import { NodeResizer, useReactFlow } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { ZoneNodeData } from '../hooks/useStore'

// Pre-computed bg for each zone border color
const ZONE_BG: Record<string, string> = {
  '#4a8fd4': 'rgba(74,143,212,0.07)',
  '#4caf50': 'rgba(76,175,80,0.07)',
  '#f59e0b': 'rgba(245,158,11,0.07)',
  '#a87ee0': 'rgba(168,126,224,0.07)',
  '#d47878': 'rgba(212,120,120,0.07)',
}

function ZoneNodeInner({ id, data, selected }: NodeProps) {
  const { label, color } = data as ZoneNodeData
  const { deleteElements, setNodes } = useReactFlow()
  const [editing, setEditing]     = useState(false)
  const [editValue, setEditValue] = useState(label)

  const commitLabel = useCallback(() => {
    setNodes(nodes =>
      nodes.map(n =>
        n.id === id ? { ...n, data: { ...n.data, label: editValue } } : n
      )
    )
    setEditing(false)
  }, [id, editValue, setNodes])

  const bg = ZONE_BG[color] ?? 'rgba(74,143,212,0.07)'

  return (
    <>
      <NodeResizer
        color={color}
        isVisible={!!selected}
        minWidth={120}
        minHeight={80}
        lineStyle={{ stroke: color, strokeWidth: 1.5, strokeDasharray: '4 2' }}
        handleStyle={{
          fill: color,
          stroke: 'var(--surface)',
          strokeWidth: 1.5,
          width: 9,
          height: 9,
          borderRadius: 2,
        }}
      />

      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 8,
          border: `1.5px dashed ${color}`,
          background: bg,
          position: 'relative',
          boxSizing: 'border-box',
          pointerEvents: 'none',   // let clicks pass through to nodes beneath
        }}
      >
        {/* Zone label */}
        <div
          style={{
            position: 'absolute',
            top: 7,
            left: 10,
            right: selected ? 28 : 10,
            pointerEvents: 'all',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {editing ? (
            <input
              autoFocus
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={e => {
                if (e.key === 'Enter') commitLabel()
                if (e.key === 'Escape') setEditing(false)
              }}
              className="nodrag"
              style={{
                background: 'var(--surface)',
                border: `1px solid ${color}`,
                borderRadius: 3,
                color,
                fontSize: 10,
                fontWeight: 700,
                padding: '1px 6px',
                outline: 'none',
                width: '100%',
              }}
            />
          ) : (
            <span
              onDoubleClick={e => { e.stopPropagation(); setEditing(true) }}
              style={{
                color,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                cursor: 'text',
                userSelect: 'none',
              }}
            >
              {label}
            </span>
          )}
        </div>

        {/* Delete × — only when selected */}
        {selected && (
          <button
            className="nodrag"
            onClick={() => deleteElements({ nodes: [{ id }] })}
            style={{
              position: 'absolute',
              top: 4,
              right: 6,
              background: 'none',
              border: 'none',
              color: 'var(--text-dim)',
              cursor: 'pointer',
              fontSize: 14,
              lineHeight: 1,
              padding: '0 2px',
              pointerEvents: 'all',
            }}
            title="Remove zone"
          >
            ×
          </button>
        )}
      </div>
    </>
  )
}

export const ZoneNode = memo(ZoneNodeInner)
