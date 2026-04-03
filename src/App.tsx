import { useCallback, useRef, useState, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react'
import type { Connection, Edge, IsValidConnection } from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useStore, type AmpNodeData, type SpeakerNodeData, type AppNode } from './hooks/useStore'
import { isValidConnection as checkConnection } from './utils/validation'
import type { PortMeta } from './utils/validation'
import { AmpNode } from './components/AmpNode'
import { SpeakerNode } from './components/SpeakerNode'
import { SourceNode } from './components/SourceNode'
import { Sidebar } from './components/Sidebar'
import { BomModal } from './components/BomModal'

const NODE_TYPES = {
  ampNode: AmpNode,
  speakerNode: SpeakerNode,
  sourceNode: SourceNode,
}

// Build PortMeta from a node and handle ID
function buildPortMetaResolver(nodes: AppNode[]) {
  return (nodeId: string, handleId: string): PortMeta | undefined => {
    const node = nodes.find((n: AppNode) => n.id === nodeId)
    if (!node) return undefined

    const d = node.data
    if (d.kind === 'amp') {
      const model = (d as AmpNodeData).model
      if (handleId === 'analog-in') {
        return { deviceId: nodeId, portId: handleId, signalType: 'analog', direction: 'input' }
      }
      // Channel output handle: "{chId}-out"
      const ch = model.channels.find(c => `${c.id}-out` === handleId)
      if (ch) {
        return {
          deviceId: nodeId,
          portId: handleId,
          signalType: ch.outputMode === 'hi-z' ? 'speaker-hiz' : 'speaker-loz',
          direction: 'output',
        }
      }
    } else if (d.kind === 'speaker') {
      const spkData = d as SpeakerNodeData
      if (handleId === 'spk-in-loz') {
        return { deviceId: nodeId, portId: handleId, signalType: 'speaker-loz', direction: 'input' }
      }
      if (handleId === 'spk-in-hiz') {
        return { deviceId: nodeId, portId: handleId, signalType: 'speaker-hiz', direction: 'input' }
      }
      // Default based on speaker type
      const sigType = spkData.model.speakerType === 'hi-z' ? 'speaker-hiz' : 'speaker-loz'
      return { deviceId: nodeId, portId: handleId, signalType: sigType, direction: 'input' }
    } else if (d.kind === 'source') {
      if (handleId === 'aes-out') {
        return { deviceId: nodeId, portId: handleId, signalType: 'digital', direction: 'output' }
      }
      return { deviceId: nodeId, portId: handleId, signalType: 'analog', direction: 'output' }
    }
    return undefined
  }
}

const STATUS_LABEL: Record<string, string> = { green: 'OK', amber: 'MARGINAL', red: 'FAULT' }
const STATUS_COLOR: Record<string, string> = { green: '#4caf50', amber: '#f59e0b', red: '#ef4444' }

function AppInner() {
  const { screenToFlowPosition } = useReactFlow()
  const nodes = useStore(s => s.nodes)
  const edges = useStore(s => s.edges)
  const onNodesChange = useStore(s => s.onNodesChange)
  const onEdgesChange = useStore(s => s.onEdgesChange)
  const onConnect = useStore(s => s.onConnect)
  const addAmp = useStore(s => s.addAmp)
  const addSpeaker = useStore(s => s.addSpeaker)
  const addSource = useStore(s => s.addSource)
  const clearCanvas = useStore(s => s.clearCanvas)
  const getOverallStatus = useStore(s => s.getOverallStatus)

  const [showBom, setShowBom] = useState(false)
  const dragKindRef = useRef<'amp' | 'speaker' | 'sub' | 'source'>('amp')
  const dragModelRef = useRef<string>('')

  const overallStatus = getOverallStatus()

  const portMetaResolver = useMemo(() => buildPortMetaResolver(nodes), [nodes])

  const isValidConn: IsValidConnection = useCallback(
    (connection: Connection | Edge) => checkConnection(connection as Connection, portMetaResolver),
    [portMetaResolver]
  )

  const onDragStart = useCallback(
    (e: React.DragEvent, modelId: string, kind: 'amp' | 'speaker' | 'sub' | 'source') => {
      dragModelRef.current = modelId
      dragKindRef.current = kind
      e.dataTransfer.effectAllowed = 'move'
    },
    []
  )

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      const kind = dragKindRef.current
      const modelId = dragModelRef.current
      if (!modelId) return

      if (kind === 'amp') addAmp(modelId, pos)
      else if (kind === 'source') addSource(pos)
      else addSpeaker(modelId, kind === 'sub', pos)
    },
    [screenToFlowPosition, addAmp, addSpeaker, addSource]
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      {/* Header */}
      <div
        style={{
          height: 48,
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--blue)', letterSpacing: '0.05em' }}>
            ORIGIN
          </span>
          <span style={{ fontWeight: 400, fontSize: 14, color: 'var(--text-secondary)' }}>
            Amp Connect
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Overall status badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 10px',
              borderRadius: 3,
              background: 'rgba(0,0,0,0.3)',
              border: `1px solid ${STATUS_COLOR[overallStatus]}`,
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: 7, height: 7,
                borderRadius: '50%',
                background: STATUS_COLOR[overallStatus],
              }}
            />
            <span style={{ fontSize: 11, color: STATUS_COLOR[overallStatus], fontWeight: 600 }}>
              {STATUS_LABEL[overallStatus]}
            </span>
          </div>

          <button
            onClick={clearCanvas}
            style={{
              padding: '4px 12px',
              background: 'none',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              borderRadius: 3,
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Clear
          </button>

          <button
            onClick={() => setShowBom(true)}
            disabled={overallStatus === 'red'}
            style={{
              padding: '4px 12px',
              background: overallStatus === 'red' ? 'var(--surface-2)' : 'var(--blue-dim)',
              border: `1px solid ${overallStatus === 'red' ? 'var(--border)' : 'var(--blue)'}`,
              color: overallStatus === 'red' ? 'var(--text-dim)' : 'var(--blue)',
              borderRadius: 3,
              cursor: overallStatus === 'red' ? 'not-allowed' : 'pointer',
              fontSize: 12,
            }}
            title={overallStatus === 'red' ? 'Fix RED zones before exporting' : 'Export Bill of Materials'}
          >
            Export BOM
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar onDragStart={onDragStart} />

        {/* Canvas */}
        <div style={{ flex: 1, position: 'relative' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            isValidConnection={isValidConn}
            onDrop={onDrop}
            onDragOver={onDragOver}
            fitView
            deleteKeyCode="Delete"
            style={{ background: 'var(--bg)' }}
            defaultEdgeOptions={{ style: { stroke: 'var(--blue)', strokeWidth: 2 } }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={24}
              size={1}
              color="var(--border)"
            />
            <Controls
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            />
            <MiniMap
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              nodeColor="var(--surface-2)"
            />
          </ReactFlow>

          {/* Empty canvas hint */}
          {nodes.length === 0 && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
                gap: 8,
              }}
            >
              <span style={{ fontSize: 32, opacity: 0.2 }}>⬡</span>
              <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>
                Drag devices from the sidebar onto the canvas
              </span>
            </div>
          )}
        </div>
      </div>

      {showBom && <BomModal onClose={() => setShowBom(false)} />}
    </div>
  )
}

export default function App() {
  return (
    <ReactFlowProvider>
      <AppInner />
    </ReactFlowProvider>
  )
}
