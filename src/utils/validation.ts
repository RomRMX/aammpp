import type { AmpChannel } from '../data/catalog'
import type { Connection } from '@xyflow/react'

// ── Port types used on device nodes ──────────────────────────────────────────

export type SignalType = 'analog' | 'digital' | 'network' | 'speaker-loz' | 'speaker-hiz' | 'power'
export type PortDirection = 'input' | 'output'

export interface PortMeta {
  deviceId: string
  portId: string
  signalType: SignalType
  direction: PortDirection
}

// ── Port connection validation ────────────────────────────────────────────────
// Called by @xyflow/react's isValidConnection prop on every attempted wire.

export function isValidConnection(
  connection: Connection,
  getPortMeta: (nodeId: string, handleId: string) => PortMeta | undefined
): boolean {
  const { source, target, sourceHandle, targetHandle } = connection
  if (!source || !target || !sourceHandle || !targetHandle) return false

  // Self-loop
  if (source === target) return false

  const src = getPortMeta(source, sourceHandle)
  const tgt = getPortMeta(target, targetHandle)
  if (!src || !tgt) return false

  // Power ports are never connectable
  if (src.signalType === 'power' || tgt.signalType === 'power') return false

  // Direction: must be output → input
  if (src.direction !== 'output' || tgt.direction !== 'input') return false

  // Signal type must match
  if (src.signalType !== tgt.signalType) return false

  return true
}

// ── Zone (lo-Z) validation ────────────────────────────────────────────────────

export type ZoneStatus = 'green' | 'amber' | 'red'

/** Parallel impedance of N speakers wired to one lo-Z channel */
export function parallelImpedance(impedances: number[]): number {
  if (impedances.length === 0) return Infinity
  const sum = impedances.reduce((acc, z) => acc + 1 / z, 0)
  return 1 / sum
}

export interface LoZZoneResult {
  status: ZoneStatus
  zLoad: number       // Ω (parallel)
  speakerCount: number
  reason?: string
}

export function validateLoZZone(channel: AmpChannel, speakerImpedances: number[]): LoZZoneResult {
  if (speakerImpedances.length === 0) {
    return { status: 'green', zLoad: Infinity, speakerCount: 0 }
  }

  const zLoad = parallelImpedance(speakerImpedances)
  const minImp = channel.minImpedance ?? 4

  if (zLoad < minImp) {
    return {
      status: 'red',
      zLoad,
      speakerCount: speakerImpedances.length,
      reason: `${zLoad.toFixed(2)}Ω < ${minImp}Ω min`,
    }
  }

  // Amber if within 15% of minimum
  if (zLoad / minImp <= 1.15) {
    return {
      status: 'amber',
      zLoad,
      speakerCount: speakerImpedances.length,
      reason: `${zLoad.toFixed(2)}Ω near ${minImp}Ω min`,
    }
  }

  return { status: 'green', zLoad, speakerCount: speakerImpedances.length }
}

// ── Zone (hi-Z) validation ────────────────────────────────────────────────────

export interface HiZZoneResult {
  status: ZoneStatus
  wLoad: number       // W (sum of taps)
  capacity: number    // W (channel hiZWatts)
  speakerCount: number
  hasPendingTap: boolean
  reason?: string
}

export function validateHiZZone(channel: AmpChannel, tapWatts: (number | null)[]): HiZZoneResult {
  const capacity = channel.hiZWatts ?? 0
  const hasPendingTap = tapWatts.some(w => w === null)

  const wLoad = tapWatts.reduce<number>((acc, w) => acc + (w ?? 0), 0)

  if (hasPendingTap) {
    return {
      status: 'amber',
      wLoad,
      capacity,
      speakerCount: tapWatts.length,
      hasPendingTap: true,
      reason: 'Tap selection required',
    }
  }

  if (wLoad > capacity) {
    return {
      status: 'red',
      wLoad,
      capacity,
      speakerCount: tapWatts.length,
      hasPendingTap: false,
      reason: `${wLoad}W > ${capacity}W capacity`,
    }
  }

  if (capacity > 0 && wLoad > capacity * 0.85) {
    return {
      status: 'amber',
      wLoad,
      capacity,
      speakerCount: tapWatts.length,
      hasPendingTap: false,
      reason: `${wLoad}W > 85% of ${capacity}W`,
    }
  }

  return { status: 'green', wLoad, capacity, speakerCount: tapWatts.length, hasPendingTap: false }
}
