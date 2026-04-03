import { create } from 'zustand'
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react'
import type { Node, Edge, NodeChange, EdgeChange, Connection } from '@xyflow/react'
import { AMPS, AMPS_SORTED, SPEAKERS, SUBS, MUSIC_SOURCE, type AmpModel, type SpeakerModel } from '../data/catalog'
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

export interface ZoneNodeData {
  kind: 'zone'
  label: string
  color: string
  [key: string]: unknown
}

export type AppNodeData = AmpNodeData | SpeakerNodeData | SourceNodeData | ZoneNodeData
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
): { status: ZoneStatus; detail: string; loadPercent: number } {
  // Find all edges from this amp channel handle
  const handleId = `${channelId}-out`
  const outEdges = edges.filter(e => e.source === ampNodeId && e.sourceHandle === handleId)

  if (outEdges.length === 0) return { status: 'green', detail: 'No load', loadPercent: 0 }

  // Get connected speaker nodes
  const connectedNodes = outEdges
    .map(e => nodes.find(n => n.id === e.target))
    .filter((n): n is AppNode => !!n && n.data.kind === 'speaker')

  if (channelOutputMode === 'lo-z') {
    const impedances = connectedNodes
      .map(n => {
        const d = n.data as SpeakerNodeData
        // Validation already ensures only lo-z speakers connect to lo-z channels
        return d.model.impedance ?? null
      })
      .filter((z): z is number => z !== null)

    const ampNode = nodes.find(n => n.id === ampNodeId)
    const ampData = ampNode?.data as AmpNodeData | undefined
    const channel = ampData?.model.channels.find(c => c.id === channelId)
    if (!channel) return { status: 'green', detail: 'No channel', loadPercent: 0 }

    const result = validateLoZZone(channel, impedances)
    const speakerCount = impedances.length
    const minImp = channel.minImpedance ?? 4
    const loadPercent = speakerCount === 0 ? 0 : Math.min((minImp / result.zLoad) * 100, 200)
    return { status: result.status, detail: result.reason ?? `${impedances.length} speaker(s)`, loadPercent }
  } else {
    // hi-z
    const tapWatts = connectedNodes.map(n => {
      const d = n.data as SpeakerNodeData
      if (d.model.speakerType === 'tappable') {
        // Validation ensures this speaker is connected via hi-z handle;
        // use selected tap (null = pending → AMBER)
        return d.selectedTap ?? null
      }
      if (d.model.speakerType === 'hi-z') {
        // fixed 70V speaker — use first tapOption as rated watt value
        return d.model.tapOptions?.[0] ?? null
      }
      return null
    })

    const ampNode = nodes.find(n => n.id === ampNodeId)
    const ampData = ampNode?.data as AmpNodeData | undefined
    const channel = ampData?.model.channels.find(c => c.id === channelId)
    if (!channel) return { status: 'green', detail: 'No channel', loadPercent: 0 }

    const result = validateHiZZone(channel, tapWatts)
    const loadPercent = result.capacity > 0 ? Math.min((result.wLoad / result.capacity) * 100, 200) : 0
    return { status: result.status, detail: result.reason ?? `${tapWatts.length} speaker(s)`, loadPercent }
  }
}

// ── Amp model picker ─────────────────────────────────────────────────────────

/**
 * Given a channel type and the number of speakers that still need wiring,
 * return the smallest amp (preferring ProA125 series) whose channel count
 * for that type is ≥ speakersNeeded AND that provides load headroom
 * (channels should land GREEN, i.e. ≤85% load, not right at the rated limit).
 *
 * For lo-z: each speaker at the amp's minImpedance is the worst case — we want
 * (minImpedance / minImpedance) * 100 = 100%, so we need minImpedance to be
 * at most 85% of the speaker's impedance to stay GREEN. Concretely we check
 * that the channel's minImpedance ≤ 0.85 × speakerImpedance.
 * Since we don't know the specific speaker here, we use a conservative threshold:
 * prefer amps whose lo-z minImpedance ≤ 3Ω (leaves headroom for common 4Ω/8Ω loads).
 *
 * Falls back to the largest available if nothing fits perfectly.
 */
function pickBestAmpModel(channelType: 'lo-z' | 'hi-z', speakersNeeded: number): AmpModel | null {
  const candidates = AMPS
    .filter(a => a.channels.some(c => c.outputMode === channelType))
    .map(a => {
      const matchingChannels = a.channels.filter(c => c.outputMode === channelType)
      const minImpedance = channelType === 'lo-z'
        ? Math.min(...matchingChannels.map(c => c.minImpedance ?? 4))
        : null
      return {
        model: a,
        matchCount: matchingChannels.length,
        isProA125: a.modelId.startsWith('ProA125'),
        // For lo-z: amps with minImpedance ≤ 3Ω give headroom for 4Ω speakers (75% load = GREEN)
        hasHeadroom: channelType === 'hi-z' ? true : (minImpedance ?? 4) <= 3,
      }
    })

  if (candidates.length === 0) return null

  const sorter = (a: typeof candidates[0], b: typeof candidates[0]) => {
    // 1. Prefer amps with load headroom
    if (a.hasHeadroom !== b.hasHeadroom) return a.hasHeadroom ? -1 : 1
    // 2. Prefer ProA125 series
    if (a.isProA125 !== b.isProA125) return a.isProA125 ? -1 : 1
    // 3. Smallest that still covers all speakers
    return a.matchCount - b.matchCount
  }

  const sufficient = candidates.filter(c => c.matchCount >= speakersNeeded).sort(sorter)
  if (sufficient.length > 0) return sufficient[0].model

  // No single amp covers all — use the largest with headroom, else just the largest
  return candidates.sort(sorter)[0].model
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

  getChannelZoneStatus: (ampNodeId: string, channelId: string, outputMode: 'lo-z' | 'hi-z') => { status: ZoneStatus; detail: string; loadPercent: number }
  getOverallStatus: () => ZoneStatus

  // Derived catalog lookups
  getAmpModel: (modelId: string) => AmpModel | undefined
  getSpeakerModel: (modelId: string) => SpeakerModel | undefined

  autoDropSpeaker: (modelId: string, isSub: boolean, pos: { x: number; y: number }) => void
  autoDropSource: (pos: { x: number; y: number }) => void
  addZone: (label: string, position: { x: number; y: number }, width: number, height: number) => void
  groupIntoZone: (selectedNodeIds: string[]) => void
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

  setTap: (nodeId, _mode, watts) => {
    set(state => ({
      nodes: state.nodes.map(n => {
        if (n.id !== nodeId) return n
        return { ...n, data: { ...n.data, selectedTap: watts } }
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

  autoDropSpeaker: (modelId, isSub, pos) => {
    const catalog = isSub ? SUBS : SPEAKERS
    const model = catalog.find(s => s.modelId === modelId)
    if (!model) return

    const { nodes, edges } = get()

    // Determine channel type and target handle
    const channelType: 'lo-z' | 'hi-z' = model.speakerType === 'hi-z' ? 'hi-z' : 'lo-z'
    const targetHandleId = channelType === 'hi-z' ? 'spk-in-hiz' : 'spk-in-loz'

    // Create the new speaker node
    const spkId = `spk-${++_nodeCounter}`
    const spkNode: AppNode = {
      id: spkId,
      type: 'speakerNode',
      position: pos,
      data: { kind: 'speaker', model } satisfies SpeakerNodeData,
    }

    // Scan existing amp nodes for a channel of matching outputMode with 0 existing edge connections
    const ampNodes = nodes.filter(n => n.data.kind === 'amp')
    let targetAmpId: string | null = null
    let targetChannelHandle: string | null = null

    for (const ampNode of ampNodes) {
      const ampData = ampNode.data as AmpNodeData
      for (const ch of ampData.model.channels) {
        if (ch.outputMode !== channelType) continue
        const chHandle = `${ch.id}-out`
        const existingEdges = edges.filter(e => e.source === ampNode.id && e.sourceHandle === chHandle)
        if (existingEdges.length === 0) {
          targetAmpId = ampNode.id
          targetChannelHandle = chHandle
          break
        }
      }
      if (targetAmpId) break
    }

    const newNodes: AppNode[] = [...nodes, spkNode]
    const newEdges: AppEdge[] = [...edges]

    if (!targetAmpId || !targetChannelHandle) {
      // For a single drop we need at least 1 channel; pickBestAmpModel returns
      // the smallest ProA125 that has ≥1 matching channel (i.e. ProA125.1 for lo-z).
      const ampModel = pickBestAmpModel(channelType, 1)
      if (!ampModel) return
      const ampId = `amp-${++_nodeCounter}`
      const ampNode: AppNode = {
        id: ampId,
        type: 'ampNode',
        position: { x: pos.x - 380, y: pos.y - 20 },
        data: { kind: 'amp', model: ampModel } satisfies AmpNodeData,
      }
      newNodes.push(ampNode)

      // If no source node exists on canvas, create one and wire to amp
      const hasSource = nodes.some(n => n.data.kind === 'source')
      if (!hasSource) {
        const srcId = `src-${++_nodeCounter}`
        const srcNode: AppNode = {
          id: srcId,
          type: 'sourceNode',
          position: { x: pos.x - 600, y: pos.y - 20 },
          data: { kind: 'source' } satisfies SourceNodeData,
        }
        newNodes.push(srcNode)

        // Edge: source 'analog-l' → amp 'analog-in'
        newEdges.push({
          id: `e-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          source: srcId,
          target: ampId,
          sourceHandle: 'analog-l',
          targetHandle: 'analog-in',
        })
      }

      // Find the first matching channel on the new amp
      const matchingChannel = ampModel.channels.find(c => c.outputMode === channelType)
      if (!matchingChannel) return

      targetAmpId = ampId
      targetChannelHandle = `${matchingChannel.id}-out`
    }

    // Edge from amp channel → speaker
    newEdges.push({
      id: `e-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      source: targetAmpId,
      target: spkId,
      sourceHandle: targetChannelHandle,
      targetHandle: targetHandleId,
    })

    set({ nodes: newNodes, edges: newEdges })
  },

  autoDropSource: (pos) => {
    const { nodes, edges } = get()

    const srcId = `src-${++_nodeCounter}`
    const srcNode: AppNode = {
      id: srcId,
      type: 'sourceNode',
      position: pos,
      data: { kind: 'source' } satisfies SourceNodeData,
    }

    const newNodes: AppNode[] = [...nodes, srcNode]
    const newEdges: AppEdge[] = [...edges]

    // Find first amp node that has no edge targeting its 'analog-in'
    const ampNodes = nodes.filter(n => n.data.kind === 'amp')
    const targetAmp = ampNodes.find(ampNode =>
      !edges.some(e => e.target === ampNode.id && e.targetHandle === 'analog-in')
    )

    if (targetAmp) {
      newEdges.push({
        id: `e-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        source: srcId,
        target: targetAmp.id,
        sourceHandle: 'analog-l',
        targetHandle: 'analog-in',
      })
    }

    set({ nodes: newNodes, edges: newEdges })
  },

  addZone: (label, position, width, height) => {
    const state = get()
    const zoneCount = state.nodes.filter(n => n.data.kind === 'zone').length
    const ZONE_COLORS = ['#4a8fd4', '#4caf50', '#f59e0b', '#a87ee0', '#d47878']
    const color = ZONE_COLORS[zoneCount % ZONE_COLORS.length]
    const id = `zone-${++_nodeCounter}`
    const zoneNode: AppNode = {
      id,
      type: 'zoneNode',
      position,
      style: { width, height },
      data: { kind: 'zone', label, color } satisfies ZoneNodeData,
    } as AppNode
    set(s => ({ nodes: [zoneNode, ...s.nodes] }))
  },

  groupIntoZone: (selectedNodeIds) => {
    const { nodes, edges } = get()

    const selectedSpeakers = nodes.filter(
      n => selectedNodeIds.includes(n.id) && n.data.kind === 'speaker'
    )
    if (selectedSpeakers.length === 0) return

    const PADDING = 48
    const NODE_W  = 200
    const NODE_H  = 160
    const xs = selectedSpeakers.map(n => n.position.x)
    const ys = selectedSpeakers.map(n => n.position.y)
    const minX = Math.min(...xs) - PADDING
    const minY = Math.min(...ys) - PADDING
    const maxX = Math.max(...xs) + NODE_W + PADDING
    const maxY = Math.max(...ys) + NODE_H + PADDING

    const zoneCount = nodes.filter(n => n.data.kind === 'zone').length
    const ZONE_COLORS = ['#4a8fd4', '#4caf50', '#f59e0b', '#a87ee0', '#d47878']
    const color = ZONE_COLORS[zoneCount % ZONE_COLORS.length]
    const zoneId = `zone-${++_nodeCounter}`
    const zoneNode: AppNode = {
      id: zoneId,
      type: 'zoneNode',
      position: { x: minX, y: minY },
      style: { width: maxX - minX, height: maxY - minY },
      data: { kind: 'zone', label: `Zone ${zoneCount + 1}`, color } satisfies ZoneNodeData,
    } as AppNode

    // Speakers not yet connected to any amp
    const unconnectedSpeakers = selectedSpeakers.filter(
      spkNode => !edges.some(e => e.target === spkNode.id)
    )

    const newNodes: AppNode[] = [zoneNode, ...nodes]
    const newEdges: AppEdge[] = [...edges]

    const wireGroup = (speakers: AppNode[], channelType: 'lo-z' | 'hi-z') => {
      if (speakers.length === 0) return
      const targetHandleId = channelType === 'hi-z' ? 'spk-in-hiz' : 'spk-in-loz'

      for (const spkNode of speakers) {
        let targetAmpId: string | null = null
        let targetChannelHandle: string | null = null

        // Find existing amp with a free matching channel
        const currentAmps = newNodes.filter(n => n.data.kind === 'amp')
        for (const ampNode of currentAmps) {
          const ampData = ampNode.data as AmpNodeData
          for (const ch of ampData.model.channels) {
            if (ch.outputMode !== channelType) continue
            const chHandle = `${ch.id}-out`
            if (!newEdges.some(e => e.source === ampNode.id && e.sourceHandle === chHandle)) {
              targetAmpId = ampNode.id
              targetChannelHandle = chHandle
              break
            }
          }
          if (targetAmpId) break
        }

        if (!targetAmpId) {
          // Count speakers in this batch that still need wiring (no edge yet in newEdges)
          const remaining = speakers.filter(s => !newEdges.some(e => e.target === s.id)).length
          // Pick the smallest ProA125 amp whose channel count covers all remaining speakers
          const preferred = pickBestAmpModel(channelType, remaining)
          if (!preferred) continue

          const ampId = `amp-${++_nodeCounter}`
          const avgY = speakers.reduce((s, n) => s + n.position.y, 0) / speakers.length
          const newAmpNode: AppNode = {
            id: ampId,
            type: 'ampNode',
            position: { x: minX - 380, y: avgY - 20 },
            data: { kind: 'amp', model: preferred } satisfies AmpNodeData,
          }
          newNodes.push(newAmpNode)

          // Create source if none exists
          if (!newNodes.some(n => n.data.kind === 'source')) {
            const srcId = `src-${++_nodeCounter}`
            const srcNode: AppNode = {
              id: srcId,
              type: 'sourceNode',
              position: { x: minX - 600, y: avgY - 20 },
              data: { kind: 'source' } satisfies SourceNodeData,
            }
            newNodes.push(srcNode)
            newEdges.push({
              id: `e-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              source: srcId,
              target: ampId,
              sourceHandle: 'analog-l',
              targetHandle: 'analog-in',
            })
          }

          const matchingCh = preferred.channels.find(c => c.outputMode === channelType)
          if (!matchingCh) continue
          targetAmpId = ampId
          targetChannelHandle = `${matchingCh.id}-out`
        }

        newEdges.push({
          id: `e-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          source: targetAmpId,
          target: spkNode.id,
          sourceHandle: targetChannelHandle,
          targetHandle: targetHandleId,
        })
      }
    }

    const loZ = unconnectedSpeakers.filter(n => (n.data as SpeakerNodeData).model.speakerType !== 'hi-z')
    const hiZ = unconnectedSpeakers.filter(n => (n.data as SpeakerNodeData).model.speakerType === 'hi-z')
    wireGroup(loZ, 'lo-z')
    wireGroup(hiZ, 'hi-z')

    set({ nodes: newNodes, edges: newEdges })
  },
}))

// Catalog exports for sidebar use
export const CATALOG_AMPS = AMPS_SORTED
export const CATALOG_SPEAKERS = SPEAKERS
export const CATALOG_SUBS = SUBS
export const CATALOG_SOURCE = MUSIC_SOURCE
