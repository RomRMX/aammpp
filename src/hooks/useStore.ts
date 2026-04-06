import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react'
import type { Node, Edge, NodeChange, EdgeChange, Connection } from '@xyflow/react'
import { AMPS, AMPS_SORTED, SPEAKERS, SUBS, MUSIC_SOURCE, type AmpModel, type SpeakerModel } from '../data/catalog'
import { validateLoZZone, validateHiZZone, estimateSPL, loZPowerPerSpeaker, suggestWiring, type ZoneStatus } from '../utils/validation'
import { ZONE_COLORS } from '../constants/theme'

// ── Node data types ──────────────────────────────────────────────────────────

export interface AmpNodeData {
  kind: 'amp'
  model: AmpModel
  /** Per-channel lo-Z wiring mode (default: 'parallel') */
  channelWiring?: Record<string, 'parallel' | 'series'>
  /** Per-channel BTL mode — true means this master channel is bridged with its btlPairId slave */
  channelBtl?: Record<string, boolean>
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

export interface ChannelStatus {
  status: ZoneStatus
  detail: string
  loadPercent: number
  speakerCount: number
  /** Estimated SPL range at 1m in dB, when speaker sensitivity data is available */
  splRange?: { min: number; max: number }
  /** Suggested alternative wiring when current mode is overloaded or severely underpowered */
  wiringHint?: string
}

export function computeChannelStatus(
  ampNodeId: string,
  channelId: string,
  channelOutputMode: 'lo-z' | 'hi-z',
  edges: AppEdge[],
  nodes: AppNode[]
): ChannelStatus {
  const handleId = `${channelId}-out`
  const outEdges = edges.filter(e => e.source === ampNodeId && e.sourceHandle === handleId)

  if (outEdges.length === 0) return { status: 'green', detail: 'No load', loadPercent: 0, speakerCount: 0 }

  const connectedNodes = outEdges
    .map(e => nodes.find(n => n.id === e.target))
    .filter((n): n is AppNode => !!n && n.data.kind === 'speaker')

  if (channelOutputMode === 'lo-z') {
    const impedances = connectedNodes
      .map(n => {
        const d = n.data as SpeakerNodeData
        return d.model.impedance ?? null
      })
      .filter((z): z is number => z !== null)

    const ampNode = nodes.find(n => n.id === ampNodeId)
    const ampData = ampNode?.data as AmpNodeData | undefined
    const channel = ampData?.model.channels.find(c => c.id === channelId)
    if (!channel) return { status: 'green', detail: 'No channel', loadPercent: 0, speakerCount: 0 }

    // BTL slave: another channel on this amp has btlPairId pointing here and is BTL-enabled
    const btlMaster = ampData?.model.channels.find(
      c => c.btlPairId === channelId && (ampData?.channelBtl?.[c.id] ?? false)
    )
    if (btlMaster) {
      return { status: 'green', detail: 'BTL bridge', loadPercent: 0, speakerCount: 0 }
    }

    // BTL master: this channel has BTL enabled — use BTL specs instead of SE specs
    const isBtlActive = !!(channel.btlPairId && (ampData?.channelBtl?.[channelId] ?? false))
    const effectiveChannel = isBtlActive
      ? {
          ...channel,
          maxWatts: channel.btlWatts ?? channel.maxWatts,
          ratedImpedance: channel.btlRatedImpedance ?? channel.ratedImpedance,
          minImpedance: channel.btlMinImpedance ?? channel.minImpedance,
        }
      : channel

    const wiring = ampData?.channelWiring?.[channelId] ?? 'parallel'
    const result = validateLoZZone(effectiveChannel, impedances, wiring)
    const speakerCount = impedances.length
    const minImp = effectiveChannel.minImpedance ?? 4
    const loadPercent = speakerCount === 0 ? 0 : Math.min((minImp / result.zLoad) * 100, 200)
    const btlLabel = isBtlActive ? ' (BTL)' : ''
    const wiringLabel = speakerCount >= 2 ? ` (${wiring})` : ''

    // SPL estimate per speaker (when sensitivity data is available)
    const splValues = connectedNodes
      .map(n => {
        const d = n.data as SpeakerNodeData
        if (d.model.sensitivity == null || d.model.impedance == null) return null
        const pw = loZPowerPerSpeaker(effectiveChannel, d.model.impedance, result.zLoad, wiring)
        return estimateSPL(d.model.sensitivity, pw)
      })
      .filter((s): s is number => s !== null)
    const splRange = splValues.length > 0
      ? { min: Math.round(Math.min(...splValues)), max: Math.round(Math.max(...splValues)) }
      : undefined

    const wiringHint = suggestWiring(effectiveChannel, impedances, wiring) ?? undefined
    return { status: result.status, detail: (result.reason ?? `${speakerCount} speaker(s)`) + btlLabel + wiringLabel, loadPercent, speakerCount, splRange, wiringHint }
  } else {
    const tapWatts = connectedNodes.map(n => {
      const d = n.data as SpeakerNodeData
      if (d.model.speakerType === 'tappable') {
        return d.selectedTap ?? null
      }
      if (d.model.speakerType === 'hi-z') {
        return d.model.tapOptions?.[0] ?? null
      }
      return null
    })

    const ampNode = nodes.find(n => n.id === ampNodeId)
    const ampData = ampNode?.data as AmpNodeData | undefined
    const channel = ampData?.model.channels.find(c => c.id === channelId)
    if (!channel) return { status: 'green', detail: 'No channel', loadPercent: 0, speakerCount: 0 }

    const result = validateHiZZone(channel, tapWatts)
    const loadPercent = result.capacity > 0 ? Math.min((result.wLoad / result.capacity) * 100, 200) : 0

    // SPL estimate: 70V is constant-voltage — each speaker's SPL = sensitivity + 10log10(tapW)
    const hiZSplValues = connectedNodes
      .map((n, i) => {
        const d = n.data as SpeakerNodeData
        const pw = tapWatts[i]
        if (d.model.sensitivity == null || pw == null) return null
        return estimateSPL(d.model.sensitivity, pw)
      })
      .filter((s): s is number => s !== null)
    const splRange = hiZSplValues.length > 0
      ? { min: Math.round(Math.min(...hiZSplValues)), max: Math.round(Math.max(...hiZSplValues)) }
      : undefined

    return { status: result.status, detail: result.reason ?? `${tapWatts.length} speaker(s)`, loadPercent, speakerCount: tapWatts.length, splRange }
  }
}

// ── Amp model picker ─────────────────────────────────────────────────────────

/**
 * Given a channel type and the number of speakers that still need wiring,
 * return the smallest amp (preferring ProA125 series) whose channel count
 * for that type is ≥ speakersNeeded AND that provides load headroom
 * (channels should land GREEN, i.e. ≤85% load, not right at the rated limit).
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
        hasHeadroom: channelType === 'hi-z' ? true : (minImpedance ?? 4) <= 3,
      }
    })

  if (candidates.length === 0) return null

  const sorter = (a: typeof candidates[0], b: typeof candidates[0]) => {
    if (a.hasHeadroom !== b.hasHeadroom) return a.hasHeadroom ? -1 : 1
    if (a.isProA125 !== b.isProA125) return a.isProA125 ? -1 : 1
    return a.matchCount - b.matchCount
  }

  const sufficient = candidates.filter(c => c.matchCount >= speakersNeeded).sort(sorter)
  if (sufficient.length > 0) return sufficient[0].model

  return candidates.sort(sorter)[0].model
}

// ── Shared wiring helpers ────────────────────────────────────────────────────

function mkEdgeId(): string {
  return `e-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/**
 * Finds the first existing amp with a free channel of the given type, or creates
 * a new amp (+ source if none exists) at `ampPos`. Mutates `newNodes`/`newEdges`.
 */
function findOrCreateChannel(
  channelType: 'lo-z' | 'hi-z',
  speakersNeeded: number,
  ampPos: { x: number; y: number },
  newNodes: AppNode[],
  newEdges: AppEdge[]
): { ampId: string; channelHandle: string } | null {
  // Search existing amps for a free matching channel
  for (const ampNode of newNodes.filter(n => n.data.kind === 'amp')) {
    const ampData = ampNode.data as AmpNodeData
    const channelBtl = ampData.channelBtl ?? {}
    for (const ch of ampData.model.channels) {
      if (ch.outputMode !== channelType) continue
      // Skip BTL slave channels (bridged, not independently connectable)
      const isBtlSlave = ampData.model.channels.some(
        c => c.btlPairId === ch.id && channelBtl[c.id]
      )
      if (isBtlSlave) continue
      // Skip BTL master channels that are actively bridged (dedicated to single BTL load)
      const isBtlMasterActive = !!(ch.btlPairId && channelBtl[ch.id])
      if (isBtlMasterActive) continue
      const handle = `${ch.id}-out`
      if (!newEdges.some(e => e.source === ampNode.id && e.sourceHandle === handle)) {
        return { ampId: ampNode.id, channelHandle: handle }
      }
    }
  }

  // No free channel — spin up a new amp
  const ampModel = pickBestAmpModel(channelType, speakersNeeded)
  if (!ampModel) return null

  const ampId = `amp-${++_nodeCounter}`
  newNodes.push({
    id: ampId,
    type: 'ampNode',
    position: ampPos,
    data: { kind: 'amp', model: ampModel } satisfies AmpNodeData,
  })

  // Create source node if none exists on canvas
  if (!newNodes.some(n => n.data.kind === 'source')) {
    const srcId = `src-${++_nodeCounter}`
    newNodes.push({
      id: srcId,
      type: 'sourceNode',
      position: { x: ampPos.x - 220, y: ampPos.y },
      data: { kind: 'source' } satisfies SourceNodeData,
    })
    newEdges.push({
      id: mkEdgeId(),
      source: srcId,
      target: ampId,
      sourceHandle: 'analog-l',
      targetHandle: 'analog-in',
    })
  }

  const matchingCh = ampModel.channels.find(c => c.outputMode === channelType)
  if (!matchingCh) return null
  return { ampId, channelHandle: `${matchingCh.id}-out` }
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
  setChannelWiring: (ampNodeId: string, channelId: string, mode: 'parallel' | 'series') => void
  setChannelBtl: (ampNodeId: string, channelId: string, enabled: boolean) => void
  setZoneLabel: (zoneId: string, label: string) => void

  clearCanvas: () => void

  getChannelZoneStatus: (ampNodeId: string, channelId: string, outputMode: 'lo-z' | 'hi-z') => ChannelStatus
  getOverallStatus: () => ZoneStatus

  // Derived catalog lookups
  getAmpModel: (modelId: string) => AmpModel | undefined
  getSpeakerModel: (modelId: string) => SpeakerModel | undefined

  autoDropSpeaker: (modelId: string, isSub: boolean, pos: { x: number; y: number }) => void
  autoDropSource: (pos: { x: number; y: number }) => void
  addZone: (label: string, position: { x: number; y: number }, width: number, height: number) => void
  groupIntoZone: (selectedNodeIds: string[]) => void
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
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
              id: mkEdgeId(),
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
            return { ...n, data: { ...n.data, selectedMode: mode, selectedTap: mode === 'lo-z' ? undefined : watts } }
          }),
        }))
      },

      setChannelWiring: (ampNodeId, channelId, mode) => {
        set(state => ({
          nodes: state.nodes.map(n => {
            if (n.id !== ampNodeId) return n
            const d = n.data as AmpNodeData
            return {
              ...n,
              data: {
                ...d,
                channelWiring: { ...d.channelWiring, [channelId]: mode },
              },
            }
          }),
        }))
      },

      setChannelBtl: (ampNodeId, channelId, enabled) => {
        set(state => ({
          nodes: state.nodes.map(n => {
            if (n.id !== ampNodeId) return n
            const d = n.data as AmpNodeData
            return {
              ...n,
              data: {
                ...d,
                channelBtl: { ...d.channelBtl, [channelId]: enabled },
              },
            }
          }),
        }))
      },

      setZoneLabel: (zoneId, label) => {
        set(state => ({
          nodes: state.nodes.map(n =>
            n.id === zoneId ? { ...n, data: { ...n.data, label } } : n
          ),
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
        const channelType: 'lo-z' | 'hi-z' = model.speakerType === 'hi-z' ? 'hi-z' : 'lo-z'
        const targetHandleId = channelType === 'hi-z' ? 'spk-in-hiz' : 'spk-in-loz'

        const spkId = `spk-${++_nodeCounter}`
        const newNodes: AppNode[] = [...nodes, {
          id: spkId,
          type: 'speakerNode',
          position: pos,
          data: { kind: 'speaker', model } satisfies SpeakerNodeData,
        }]
        const newEdges: AppEdge[] = [...edges]

        const found = findOrCreateChannel(
          channelType,
          1,
          { x: pos.x - 380, y: pos.y - 20 },
          newNodes,
          newEdges
        )
        if (!found) return

        newEdges.push({
          id: mkEdgeId(),
          source: found.ampId,
          target: spkId,
          sourceHandle: found.channelHandle,
          targetHandle: targetHandleId,
        })

        set({ nodes: newNodes, edges: newEdges })
      },

      autoDropSource: (pos) => {
        const { nodes, edges } = get()

        const srcId = `src-${++_nodeCounter}`
        const newNodes: AppNode[] = [...nodes, {
          id: srcId,
          type: 'sourceNode',
          position: pos,
          data: { kind: 'source' } satisfies SourceNodeData,
        }]
        const newEdges: AppEdge[] = [...edges]

        const targetAmp = nodes
          .filter(n => n.data.kind === 'amp')
          .find(ampNode => !edges.some(e => e.target === ampNode.id && e.targetHandle === 'analog-in'))

        if (targetAmp) {
          newEdges.push({
            id: mkEdgeId(),
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
        const color = ZONE_COLORS[zoneCount % ZONE_COLORS.length]
        const zoneId = `zone-${++_nodeCounter}`
        const zoneNode: AppNode = {
          id: zoneId,
          type: 'zoneNode',
          position: { x: minX, y: minY },
          style: { width: maxX - minX, height: maxY - minY },
          data: { kind: 'zone', label: `Zone ${zoneCount + 1}`, color } satisfies ZoneNodeData,
        } as AppNode

        const unconnectedSpeakers = selectedSpeakers.filter(
          spkNode => !edges.some(e => e.target === spkNode.id)
        )

        const newNodes: AppNode[] = [zoneNode, ...nodes]
        const newEdges: AppEdge[] = [...edges]

        const wireGroup = (speakers: AppNode[], channelType: 'lo-z' | 'hi-z') => {
          if (speakers.length === 0) return
          const targetHandleId = channelType === 'hi-z' ? 'spk-in-hiz' : 'spk-in-loz'
          const avgY = speakers.reduce((s, n) => s + n.position.y, 0) / speakers.length

          for (const spkNode of speakers) {
            const remaining = speakers.filter(s => !newEdges.some(e => e.target === s.id)).length
            const found = findOrCreateChannel(
              channelType,
              remaining,
              { x: minX - 380, y: avgY - 20 },
              newNodes,
              newEdges
            )
            if (!found) continue
            newEdges.push({
              id: mkEdgeId(),
              source: found.ampId,
              target: spkNode.id,
              sourceHandle: found.channelHandle,
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
    }),
    {
      name: 'amp-connect-canvas',
      partialize: (state) => ({ nodes: state.nodes, edges: state.edges }),
      onRehydrateStorage: () => (state) => {
        if (!state?.nodes.length) return
        const max = Math.max(...state.nodes.map(n => {
          const m = n.id.match(/-(\d+)$/)
          return m ? parseInt(m[1], 10) : 0
        }))
        _nodeCounter = max
      },
    }
  )
)

// Catalog exports for sidebar use
export const CATALOG_AMPS     = AMPS_SORTED.filter(a => !a.subOnly)
export const CATALOG_SUB_AMPS = AMPS_SORTED.filter(a => a.subOnly)
export const CATALOG_SPEAKERS = SPEAKERS
export const CATALOG_SUBS     = SUBS
export const CATALOG_SOURCE   = MUSIC_SOURCE
