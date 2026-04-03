import { create } from 'zustand'
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react'
import type { Node, Edge, NodeChange, EdgeChange, Connection } from '@xyflow/react'
import { AMPS, SPEAKERS, SUBS, MUSIC_SOURCE, type AmpModel, type SpeakerModel } from '../data/catalog'
import { validateLoZZone, validateHiZZone, type ZoneStatus } from '../utils/validation'

// ── Node data types ──────────────────────────────────────────────────────────

export interface AmpNodeData {
  kind: 'amp'
  model: AmpModel
  [key: string]: unknown
}

export interface SpeakerNodeData {
  kind: 'speaker'
  model: SpeakerModel
  /** For tappable speakers: selected mode ('lo-z' | '70v') */
  selectedMode?: 'lo-z' | '70v'
  /** For tappable speakers: selected watt tap */
  selectedTap?: number
  [key: string]: unknown
}

export interface SourceNodeData {
  kind: 'source'
  [key: string]: unknown
}

export type AppNodeData = AmpNodeData | SpeakerNodeData | SourceNodeData
export type AppNode = Node<AppNodeData>
export type AppEdge = Edge

// ── Zone computation ─────────────────────────────────────────────────────────

export interface ChannelZoneStatus {
  channelId: string
  status: ZoneStatus
  label: string
  detail: string
}

function computeChannelStatus(
  ampNodeId: string,
  channelId: string,
  channelOutputMode: 'lo-z' | 'hi-z',
  edges: AppEdge[],
  nodes: AppNode[]
): { status: ZoneStatus; detail: string } {
  // Find all edges from this amp channel handle
  const handleId = `${channelId}-out`
  const outEdges = edges.filter(e => e.source === ampNodeId && e.sourceHandle === handleId)

  if (outEdges.length === 0) return { status: 'green', detail: 'No load' }

  // Get connected speaker nodes
  const connectedNodes = outEdges
    .map(e => nodes.find(n => n.id === e.target))
    .filter((n): n is AppNode => !!n && n.data.kind === 'speaker')

  if (channelOutputMode === 'lo-z') {
    const impedances = connectedNodes
      .map(n => {
        const d = n.data as SpeakerNodeData
        // tappable in lo-z mode uses its impedance; pure lo-z uses impedance directly
        if (d.model.speakerType === 'tappable') {
          if (d.selectedMode === 'lo-z' || !d.selectedMode) return d.model.impedance ?? null
          return null // in 70v mode, not a load on lo-z channel
        }
        return d.model.impedance ?? null
      })
      .filter((z): z is number => z !== null)

    const ampNode = nodes.find(n => n.id === ampNodeId)
    const ampData = ampNode?.data as AmpNodeData | undefined
    const channel = ampData?.model.channels.find(c => c.id === channelId)
    if (!channel) return { status: 'green', detail: 'No channel' }

    const result = validateLoZZone(channel, impedances)
    return { status: result.status, detail: result.reason ?? `${impedances.length} speaker(s)` }
  } else {
    // hi-z
    const tapWatts = connectedNodes.map(n => {
      const d = n.data as SpeakerNodeData
      if (d.model.speakerType === 'tappable') {
        if (d.selectedMode === '70v' && d.selectedTap !== undefined) return d.selectedTap
        return null // pending
      }
      if (d.model.speakerType === 'hi-z') {
        // fixed 70V tap — use first tapOption as fixed watt value
        return d.model.tapOptions?.[0] ?? null
      }
      return null
    })

    const ampNode = nodes.find(n => n.id === ampNodeId)
    const ampData = ampNode?.data as AmpNodeData | undefined
    const channel = ampData?.model.channels.find(c => c.id === channelId)
    if (!channel) return { status: 'green', detail: 'No channel' }

    const result = validateHiZZone(channel, tapWatts)
    return { status: result.status, detail: result.reason ?? `${tapWatts.length} speaker(s)` }
  }
}

// ── Store ────────────────────────────────────────────────────────────────────

let _nodeCounter = 0

interface StoreState {
  nodes: AppNode[]
  edges: AppEdge[]

  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void

  addAmp: (modelId: string, pos: { x: number; y: number }) => void
  addSpeaker: (modelId: string, isSub: boolean, pos: { x: number; y: number }) => void
  addSource: (pos: { x: number; y: number }) => void

  setTap: (nodeId: string, mode: 'lo-z' | '70v', watts?: number) => void

  clearCanvas: () => void

  getChannelZoneStatus: (ampNodeId: string, channelId: string, outputMode: 'lo-z' | 'hi-z') => { status: ZoneStatus; detail: string }
  getOverallStatus: () => ZoneStatus

  // Derived catalog lookups
  getAmpModel: (modelId: string) => AmpModel | undefined
  getSpeakerModel: (modelId: string) => SpeakerModel | undefined
}

export const useStore = create<StoreState>((set, get) => ({
  nodes: [],
  edges: [],

  onNodesChange: (changes) => {
    set(state => ({ nodes: applyNodeChanges(changes, state.nodes) as AppNode[] }))
  },

  onEdgesChange: (changes) => {
    set(state => ({ edges: applyEdgeChanges(changes, state.edges) as AppEdge[] }))
  },

  onConnect: (connection) => {
    set(state => ({
      edges: [
        ...state.edges,
        {
          id: `e-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          source: connection.source!,
          target: connection.target!,
          sourceHandle: connection.sourceHandle,
          targetHandle: connection.targetHandle,
        },
      ],
    }))
  },

  addAmp: (modelId, pos) => {
    const model = AMPS.find(a => a.modelId === modelId)
    if (!model) return
    const id = `amp-${++_nodeCounter}`
    set(state => ({
      nodes: [...state.nodes, {
        id,
        type: 'ampNode',
        position: pos,
        data: { kind: 'amp', model } satisfies AmpNodeData,
      }],
    }))
  },

  addSpeaker: (modelId, isSub, pos) => {
    const catalog = isSub ? SUBS : SPEAKERS
    const model = catalog.find(s => s.modelId === modelId)
    if (!model) return
    const id = `spk-${++_nodeCounter}`
    set(state => ({
      nodes: [...state.nodes, {
        id,
        type: 'speakerNode',
        position: pos,
        data: { kind: 'speaker', model } satisfies SpeakerNodeData,
      }],
    }))
  },

  addSource: (pos) => {
    const id = `src-${++_nodeCounter}`
    set(state => ({
      nodes: [...state.nodes, {
        id,
        type: 'sourceNode',
        position: pos,
        data: { kind: 'source' } satisfies SourceNodeData,
      }],
    }))
  },

  setTap: (nodeId, mode, watts) => {
    set(state => ({
      nodes: state.nodes.map(n => {
        if (n.id !== nodeId) return n
        return { ...n, data: { ...n.data, selectedMode: mode, selectedTap: watts } }
      }),
    }))
  },

  clearCanvas: () => {
    _nodeCounter = 0
    set({ nodes: [], edges: [] })
  },

  getChannelZoneStatus: (ampNodeId, channelId, outputMode) => {
    const { nodes, edges } = get()
    return computeChannelStatus(ampNodeId, channelId, outputMode, edges, nodes)
  },

  getOverallStatus: () => {
    const { nodes, edges } = get()
    let worst: ZoneStatus = 'green'
    const ampNodes = nodes.filter(n => n.data.kind === 'amp')
    for (const ampNode of ampNodes) {
      const model = (ampNode.data as AmpNodeData).model
      for (const ch of model.channels) {
        const { status } = computeChannelStatus(ampNode.id, ch.id, ch.outputMode, edges, nodes)
        if (status === 'red') return 'red'
        if (status === 'amber') worst = 'amber'
      }
    }
    return worst
  },

  getAmpModel: (modelId) => AMPS.find(a => a.modelId === modelId),
  getSpeakerModel: (modelId) =>
    SPEAKERS.find(s => s.modelId === modelId) ?? SUBS.find(s => s.modelId === modelId),
}))

// Catalog exports for sidebar use
export const CATALOG_AMPS = AMPS
export const CATALOG_SPEAKERS = SPEAKERS
export const CATALOG_SUBS = SUBS
export const CATALOG_SOURCE = MUSIC_SOURCE
