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

// ── SPL estimation ────────────────────────────────────────────────────────────

/**
 * Estimate SPL at 1m given speaker sensitivity (dB/W/m) and drive power.
 * Returns dB SPL (unweighted, free-field).
 */
export function estimateSPL(sensitivityDb: number, powerW: number): number {
  if (powerW <= 0) return sensitivityDb
  return sensitivityDb + 10 * Math.log10(powerW)
}

/**
 * Estimate per-speaker power delivery for a lo-Z channel.
 * Uses voltage-source model: V_rms² = maxWatts × ratedImpedance.
 * - Parallel: each speaker sees full V_rms, P = V²/Z_spk
 * - Series:   I = V_rms/Z_total, P_spk = I² × Z_spk = V²×Z_spk/Z_total²
 */
export function loZPowerPerSpeaker(
  channel: AmpChannel,
  speakerImpedance: number,
  zTotal: number,
  wiring: 'parallel' | 'series',
): number {
  const V2 = (channel.maxWatts ?? 0) * (channel.ratedImpedance ?? channel.minImpedance ?? 4)
  if (V2 <= 0) return 0
  if (wiring === 'series') {
    return V2 * speakerImpedance / (zTotal * zTotal)
  }
  return V2 / speakerImpedance
}

// ── Zone (lo-Z) validation ────────────────────────────────────────────────────

export type ZoneStatus = 'green' | 'amber' | 'red'

/** Parallel impedance of N speakers wired to one lo-Z channel */
export function parallelImpedance(impedances: number[]): number {
  if (impedances.length === 0) return Infinity
  const sum = impedances.reduce((acc, z) => acc + 1 / z, 0)
  return 1 / sum
}

/** Series impedance of N speakers daisy-chained on one lo-Z channel */
export function seriesImpedance(impedances: number[]): number {
  return impedances.reduce((acc, z) => acc + z, 0)
}

export interface LoZZoneResult {
  status: ZoneStatus
  zLoad: number       // Ω
  speakerCount: number
  reason?: string
}

export function validateLoZZone(
  channel: AmpChannel,
  speakerImpedances: number[],
  wiring: 'parallel' | 'series' = 'parallel',
): LoZZoneResult {
  if (speakerImpedances.length === 0) {
    return { status: 'green', zLoad: Infinity, speakerCount: 0 }
  }

  const zLoad = wiring === 'series'
    ? seriesImpedance(speakerImpedances)
    : parallelImpedance(speakerImpedances)
  const minImp    = channel.minImpedance ?? 4
  const ratedImp  = channel.ratedImpedance ?? minImp

  // Overload: below minimum impedance → RED
  if (zLoad < minImp) {
    return {
      status: 'red',
      zLoad,
      speakerCount: speakerImpedances.length,
      reason: `${zLoad.toFixed(2)}Ω < ${minImp}Ω min`,
    }
  }

  // Near-minimum impedance (within 15%) → AMBER
  if (zLoad / minImp <= 1.15) {
    return {
      status: 'amber',
      zLoad,
      speakerCount: speakerImpedances.length,
      reason: `${zLoad.toFixed(2)}Ω near ${minImp}Ω min`,
    }
  }

  // Series wiring: underpowering warning when load > 2× rated impedance
  // (power delivery drops below 50% of rated — voltage-source model)
  if (wiring === 'series' && zLoad > ratedImp * 2) {
    const pct = Math.round((ratedImp / zLoad) * 100)
    return {
      status: 'amber',
      zLoad,
      speakerCount: speakerImpedances.length,
      reason: `Series: ~${pct}% power delivery at ${zLoad}Ω`,
    }
  }

  return { status: 'green', zLoad, speakerCount: speakerImpedances.length }
}

// ── Zone (hi-Z) validation ────────────────────────────────────────────────────

/** NEC/industry recommendation: max daisy-chained devices per 70V channel */
const HIZ_MAX_SPEAKER_COUNT = 25

/** Industry headroom rule: keep load below 80% of amp capacity */
const HIZ_HEADROOM_THRESHOLD = 0.80

export interface HiZZoneResult {
  status: ZoneStatus
  wLoad: number       // W (sum of taps)
  capacity: number    // W (channel hiZWatts)
  speakerCount: number
  hasPendingTap: boolean
  reason?: string
}

export function validateHiZZone(channel: AmpChannel, tapWatts: (number | null)[]): HiZZoneResult {
  const capacity      = channel.hiZWatts ?? 0
  const hasPendingTap = tapWatts.some(w => w === null)
  const speakerCount  = tapWatts.length
  const wLoad         = tapWatts.reduce<number>((acc, w) => acc + (w ?? 0), 0)

  if (hasPendingTap) {
    return { status: 'amber', wLoad, capacity, speakerCount, hasPendingTap: true, reason: 'Tap selection required' }
  }

  // Overload → RED
  if (wLoad > capacity) {
    return {
      status: 'red', wLoad, capacity, speakerCount, hasPendingTap: false,
      reason: `${wLoad}W > ${capacity}W capacity`,
    }
  }

  // Exceeds 80% headroom threshold → AMBER
  if (capacity > 0 && wLoad > capacity * HIZ_HEADROOM_THRESHOLD) {
    return {
      status: 'amber', wLoad, capacity, speakerCount, hasPendingTap: false,
      reason: `${wLoad}W > 80% of ${capacity}W (industry headroom rule)`,
    }
  }

  // Exceeds NEC daisy-chain device limit → AMBER
  if (speakerCount > HIZ_MAX_SPEAKER_COUNT) {
    return {
      status: 'amber', wLoad, capacity, speakerCount, hasPendingTap: false,
      reason: `${speakerCount} devices exceeds NEC 25-unit daisy-chain limit`,
    }
  }

  return { status: 'green', wLoad, capacity, speakerCount, hasPendingTap: false }
}
