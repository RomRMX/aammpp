import { memo, useCallback } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
} from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'

function DeletableEdgeInner({
  id,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  selected,
  markerEnd,
  style,
}: EdgeProps) {
  const { deleteElements } = useReactFlow()

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      deleteElements({ edges: [{ id }] })
    },
    [id, deleteElements]
  )

  return (
    <>
      {/* Wide transparent hit area — 16px wide makes the edge easy to click */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        style={{ cursor: 'pointer' }}
      />

      {/* Visible edge line */}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={style}
      />

      {/* Delete button rendered at midpoint when edge is selected */}
      <EdgeLabelRenderer>
        {selected && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <button
              onClick={handleDelete}
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1,
                boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
              }}
              title="Disconnect"
            >
              ×
            </button>
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  )
}

export const DeletableEdge = memo(DeletableEdgeInner)
