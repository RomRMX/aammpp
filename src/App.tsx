import { useCallback, useRef, useState, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  Panel,
  useReactFlow,
  useViewport,
  ReactFlowProvider,
} from '@xyflow/react'
import type { Connection, Edge, IsValidConnection, OnSelectionChangeParams } from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useStore, type AmpNodeData, type SpeakerNodeData, type AppNode } from './hooks/useStore'
import { isValidConnection as checkConnection } from './utils/validation'
import type { PortMeta } from './utils/validation'
import { STATUS_COLOR, STATUS_LABEL, PANEL_COLORS, type MsgType } from './constants/theme'
import { AmpNode } from './components/AmpNode'
import { SpeakerNode } from './components/SpeakerNode'
import { SourceNode } from './components/SourceNode'
import { ZoneNode } from './components/ZoneNode'
import { DeletableEdge } from './components/DeletableEdge'
import { Sidebar } from './components/Sidebar'
import { BomModal } from './components/BomModal'
import { AmpPickerModal } from './components/AmpPickerModal'

// ── Node + edge type registries ───────────────────────────────────────────────

const NODE_TYPES = {
  ampNode:    AmpNode,
  speakerNode: SpeakerNode,
  sourceNode: SourceNode,
  zoneNode:   ZoneNode,
}

// Override the built-in 'default' edge so ALL edges get the deletable UX
const EDGE_TYPES = { default: DeletableEdge }

// ── Port-meta resolver (for isValidConnection) ────────────────────────────────

function buildPortMetaResolver(nodes: AppNode[]) {
  return (nodeId: string, handleId: string): PortMeta | undefined => {
    const node = nodes.find((n: AppNode) => n.id === nodeId)
    if (!node) return undefined

    const d = node.data
    if (d.kind === 'amp') {
      const ampData = d as AmpNodeData
      const model = ampData.model
      if (handleId === 'analog-in') {
        return { deviceId: nodeId, portId: handleId, signalType: 'analog', direction: 'input' }
      }
      const ch = model.channels.find(c => `${c.id}-out` === handleId)
      if (ch) {
        // hi-Z when the BTL pair is operating in 70V mode
        const isHiZBtl = !!(
          ch.btlPairId && ch.hiZWatts &&
          ampData.channelBtl?.[ch.id] &&
          ampData.channelHiZ?.[ch.id]
        )
        return {
          deviceId: nodeId,
          portId: handleId,
          signalType: isHiZBtl ? 'speaker-hiz' : 'speaker-loz',
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
      const sigType = spkData.model.speakerType === 'hi-z' ? 'speaker-hiz' : 'speaker-loz'
      return { deviceId: nodeId, portId: handleId, signalType: sigType, direction: 'input' }
    } else if (d.kind === 'source') {
      return { deviceId: nodeId, portId: handleId, signalType: 'analog', direction: 'output' }
    }
    return undefined
  }
}

// ── Zoom label ────────────────────────────────────────────────────────────────

function ZoomLabel() {
  const { zoom } = useViewport()
  return (
    <Panel position="bottom-right" style={{ margin: 0, padding: 0, pointerEvents: 'none' }}>
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          padding: '2px 8px',
          fontSize: 11,
          color: 'var(--text-secondary)',
          userSelect: 'none',
        }}
      >
        {Math.round(zoom * 100)}%
      </div>
    </Panel>
  )
}

// ── Context guidance panel ────────────────────────────────────────────────────

function ContextPanel() {
  const nodes                = useStore(s => s.nodes)
  const getChannelZoneStatus = useStore(s => s.getChannelZoneStatus)

  const ampNodes     = nodes.filter(n => n.data.kind === 'amp')
  const speakerNodes = nodes.filter(n => n.data.kind === 'speaker')
  const sourceNodes  = nodes.filter(n => n.data.kind === 'source')

  let icon    = ''
  let message = ''
  let msgType: MsgType = 'info'

  if (nodes.filter(n => n.data.kind !== 'zone').length === 0) {
    icon = '⬡'; message = 'Drag speakers onto the canvas, then use ◻ Select → ⬚ Zone to group and auto-wire'; msgType = 'info'
  } else if (ampNodes.length > 0 && sourceNodes.length === 0) {
    icon = '▶'; message = 'Drop a Source from the sidebar to feed signal into your amp'; msgType = 'warn'
  } else if (speakerNodes.length > 0 && ampNodes.length === 0) {
    icon = '◆'; message = 'Speakers placed — use ◻ Select to lasso them, then ⬚ Zone to auto-wire an amp'; msgType = 'info'
  } else {
    let redMsg = '', amberMsg = ''
    for (const ampNode of ampNodes) {
      const model = (ampNode.data as AmpNodeData).model
      for (const ch of model.channels) {
        const { status, detail, loadPercent } = getChannelZoneStatus(ampNode.id, ch.id, ch.outputMode)
        if (status === 'red'   && !redMsg)   redMsg   = `${model.name} · ${ch.label} FAULT — ${detail}. Disconnect a speaker or swap to a higher-power amp.`
        if (status === 'amber' && !amberMsg) amberMsg = `${model.name} · ${ch.label} — ${detail} (${Math.round(loadPercent)}% load). Near capacity.`
      }
    }
    if (redMsg)        { icon = '✕'; message = redMsg;   msgType = 'error' }
    else if (amberMsg) { icon = '△'; message = amberMsg; msgType = 'warn'  }
    else {
      const sc = speakerNodes.length
      icon = '✓'
      const ampDesc = ampNodes.map(n => {
        const m = (n.data as AmpNodeData).model
        const loZ  = m.channels.filter(c => c.outputMode === 'lo-z' && !c.btlPairId)
        const hiZPairs = m.channels.filter(c => c.outputMode === 'lo-z' && c.btlPairId && c.hiZWatts)
        const parts: string[] = []
        if (loZ.length) parts.push(`${loZ.length}× lo-z ${loZ[0].maxWatts ?? '?'}W`)
        if (hiZPairs.length) parts.push(`${hiZPairs.length}× hi-z ${hiZPairs[0].hiZWatts ?? '?'}W`)
        const why = m.modelId.startsWith('ProA125') ? 'compact fit'
          : m.modelId.startsWith('ProA250') ? 'mid-power fit'
          : m.modelId.startsWith('ProA1000') ? 'high-power fit'
          : m.modelId.startsWith('ProA1200') ? 'max-power fit'
          : m.series ?? 'selected'
        return `${m.name} (${parts.join(', ')} — ${why})`
      }).join(' + ')
      message = `All zones nominal — ${ampDesc} · ${sc} speaker${sc !== 1 ? 's' : ''}. Ready to export BOM.`
      msgType = 'ok'
    }
  }

  const c = PANEL_COLORS[msgType]
  return (
    <Panel position="top-center" style={{ margin: 0, padding: 0, pointerEvents: 'none' }}>
      <div
        style={{
          marginTop: 8,
          background: c.bg,
          border: `1px solid ${c.border}`,
          borderRadius: 5,
          padding: '5px 14px 5px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          maxWidth: 560,
        }}
      >
        <span style={{ color: c.text, fontSize: 12, flexShrink: 0 }}>{icon}</span>
        <span style={{ fontSize: 11, color: c.text, lineHeight: 1.5 }}>{message}</span>
      </div>
    </Panel>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────

function AppInner() {
  const { screenToFlowPosition } = useReactFlow()
  const nodes              = useStore(s => s.nodes)
  const edges              = useStore(s => s.edges)
  const onNodesChange      = useStore(s => s.onNodesChange)
  const onEdgesChange      = useStore(s => s.onEdgesChange)
  const onConnect          = useStore(s => s.onConnect)
  const addAmp             = useStore(s => s.addAmp)
  const addSpeaker         = useStore(s => s.addSpeaker)
  const autoDropSource     = useStore(s => s.autoDropSource)
  const addZone            = useStore(s => s.addZone)
  const groupIntoZone      = useStore(s => s.groupIntoZone)
  const clearCanvas        = useStore(s => s.clearCanvas)
  const overallStatus      = useStore(s => s.getOverallStatus())

  const [showBom, setShowBom]                       = useState(false)
  const [zoneModeActive, setZoneModeActive]           = useState(false)
  const [selectModeActive, setSelectModeActive]       = useState(false)
  const [zonePreview, setZonePreview]                 = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const [selectedSpeakerIds, setSelectedSpeakerIds]  = useState<string[]>([])
  const [pendingZone, setPendingZone]                 = useState<{ selectedIds: string[] } | null>(null)

  const dragKindRef    = useRef<'amp' | 'speaker' | 'sub' | 'source'>('amp')
  const dragModelRef   = useRef<string>('')
  const canvasRef      = useRef<HTMLDivElement>(null)
  const zoneCounterRef = useRef(0)

  const portMetaResolver = useMemo(() => buildPortMetaResolver(nodes), [nodes])

  const isValidConn: IsValidConnection = useCallback(
    (connection: Connection | Edge) => checkConnection(connection as Connection, portMetaResolver),
    [portMetaResolver]
  )

  // ── Drag-drop from sidebar ──────────────────────────────────────────────────

  const onDragStart = useCallback(
    (e: React.DragEvent, modelId: string, kind: 'amp' | 'speaker' | 'sub' | 'source') => {
      dragModelRef.current = modelId
      dragKindRef.current  = kind
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
      const pos     = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      const kind    = dragKindRef.current
      const modelId = dragModelRef.current
      if (!modelId) return

      if (kind === 'amp')         addAmp(modelId, pos)
      else if (kind === 'source') autoDropSource(pos)
      else                        addSpeaker(modelId, kind === 'sub', pos)
    },
    [screenToFlowPosition, addAmp, addSpeaker, autoDropSource]
  )

  // ── Selection tracking ──────────────────────────────────────────────────────

  const onSelectionChange = useCallback(({ nodes: sel }: OnSelectionChangeParams) => {
    const spkIds = sel
      .filter(n => (n.data as AppNode['data']).kind === 'speaker')
      .map(n => n.id)
    setSelectedSpeakerIds(spkIds)
  }, [])

  // ── Zone drawing ────────────────────────────────────────────────────────────

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!zoneModeActive) return
      // Don't start on a node or control
      if ((e.target as Element).closest('.react-flow__node, .react-flow__controls, .react-flow__edge')) return
      e.preventDefault()
      setZonePreview({ x1: e.clientX, y1: e.clientY, x2: e.clientX, y2: e.clientY })
    },
    [zoneModeActive]
  )

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!zonePreview) return
      setZonePreview(p => p ? { ...p, x2: e.clientX, y2: e.clientY } : null)
    },
    [zonePreview]
  )

  const handleCanvasMouseUp = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!zonePreview) return
      const start = screenToFlowPosition({ x: zonePreview.x1, y: zonePreview.y1 })
      const end   = screenToFlowPosition({ x: e.clientX,      y: e.clientY      })

      const x = Math.min(start.x, end.x)
      const y = Math.min(start.y, end.y)
      const w = Math.abs(end.x - start.x)
      const h = Math.abs(end.y - start.y)

      if (w > 50 && h > 50) {
        zoneCounterRef.current++
        addZone(`Zone ${zoneCounterRef.current}`, { x, y }, w, h)
      }

      setZonePreview(null)
      setZoneModeActive(false)
    },
    [zonePreview, screenToFlowPosition, addZone]
  )

  // Preview rect in screen space (relative to the canvas container).
  // We read canvasRef.current during render intentionally: zonePreview is
  // only set while the user is actively dragging, so every mouse-move event
  // triggers a re-render and the rect value is always fresh.
  /* eslint-disable react-hooks/refs */
  const previewRect = zonePreview && canvasRef.current
    ? (() => {
        const rect = canvasRef.current!.getBoundingClientRect()
        return {
          left:   Math.min(zonePreview.x1, zonePreview.x2) - rect.left,
          top:    Math.min(zonePreview.y1, zonePreview.y2) - rect.top,
          width:  Math.abs(zonePreview.x2 - zonePreview.x1),
          height: Math.abs(zonePreview.y2 - zonePreview.y1),
        }
      })()
    : null
  /* eslint-enable react-hooks/refs */

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
        {/* Logo + version */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img
            src="/aammpp_logo.png"
            alt="AAMMPP"
            style={{ height: 36, width: 'auto', display: 'block' }}
          />
          <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 500, letterSpacing: '0.04em' }}>
            v{__APP_VERSION__}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Global status badge */}
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '3px 10px', borderRadius: 3,
              background: 'rgba(0,0,0,0.3)',
              border: `1px solid ${STATUS_COLOR[overallStatus]}`,
            }}
          >
            <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: STATUS_COLOR[overallStatus] }} />
            <span style={{ fontSize: 11, color: STATUS_COLOR[overallStatus], fontWeight: 600 }}>{STATUS_LABEL[overallStatus]}</span>
          </div>

          {/* Zone selection button — visible when speakers are selected in select mode */}
          {selectedSpeakerIds.length > 0 && (
            <button
              onClick={() => {
                setPendingZone({ selectedIds: selectedSpeakerIds })
                setSelectedSpeakerIds([])
                setSelectModeActive(false)
              }}
              style={{
                padding: '4px 12px',
                background: 'rgba(76,175,80,0.15)',
                border: '1px solid var(--green)',
                color: 'var(--green)',
                borderRadius: 3,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
              }}
              title="Create zone around selected speakers and auto-wire"
            >
              ⬚ Establish Zone
            </button>
          )}

          {/* Select mode toggle — lasso-select speakers, then zone them */}
          <button
            onClick={() => {
              setSelectModeActive(s => !s)
              setZoneModeActive(false)
              if (selectModeActive) setSelectedSpeakerIds([])
            }}
            style={{
              padding: '4px 12px',
              background: selectModeActive ? 'rgba(76,175,80,0.15)' : 'none',
              border: `1px solid ${selectModeActive ? 'var(--green)' : 'var(--border)'}`,
              color: selectModeActive ? 'var(--green)' : 'var(--text-secondary)',
              borderRadius: 3,
              cursor: 'pointer',
              fontSize: 12,
            }}
            title={selectModeActive ? 'Cancel selection mode' : 'Drag-select speakers to group into a zone'}
          >
            {selectModeActive ? '✕ Selecting' : '◻ Select'}
          </button>

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

        {/* Canvas column */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Canvas */}
          <div
            ref={canvasRef}
            style={{ flex: 1, position: 'relative', cursor: (zoneModeActive || selectModeActive) ? 'crosshair' : undefined }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={NODE_TYPES}
              edgeTypes={EDGE_TYPES}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              isValidConnection={isValidConn}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onSelectionChange={onSelectionChange}
              fitView
              deleteKeyCode="Delete"
              panOnDrag={!zoneModeActive && !selectModeActive}
              selectionOnDrag={selectModeActive}
              style={{ background: 'var(--bg)' }}
              defaultEdgeOptions={{ style: { stroke: 'var(--blue)', strokeWidth: 2 } }}
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="var(--border)" />
              <Controls showInteractive={false} />
              <ZoomLabel />
              <ContextPanel />
            </ReactFlow>

            {/* Zone draw preview overlay */}
            {previewRect && (
              <div
                style={{
                  position: 'absolute',
                  left: previewRect.left,
                  top: previewRect.top,
                  width: previewRect.width,
                  height: previewRect.height,
                  border: '1.5px dashed var(--blue)',
                  background: 'rgba(74,143,212,0.07)',
                  borderRadius: 6,
                  pointerEvents: 'none',
                  zIndex: 1000,
                }}
              />
            )}
          </div>

        </div>
      </div>

      {showBom && <BomModal onClose={() => setShowBom(false)} />}
      {pendingZone && (
        <AmpPickerModal
          selectedSpeakerIds={pendingZone.selectedIds}
          onConfirm={(loZModelId, hiZModelId) => {
            groupIntoZone(pendingZone.selectedIds, { loZ: loZModelId, hiZ: hiZModelId })
            setPendingZone(null)
            // Clear ReactFlow selection highlight on all nodes
            onNodesChange(
              nodes
                .filter(n => n.selected)
                .map(n => ({ type: 'select' as const, id: n.id, selected: false }))
            )
          }}
          onCancel={() => setPendingZone(null)}
        />
      )}
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
