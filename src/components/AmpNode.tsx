import { memo, useCallback, useState } from 'react'
import { Handle, Position, useReactFlow } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { useStore, type AmpNodeData } from '../hooks/useStore'
import { fmtPrice } from '../utils/display'
import { STATUS_COLOR, STATUS_LABEL } from '../constants/theme'

function AmpNodeInner({ id, data }: NodeProps) {
  const { model, channelWiring } = data as AmpNodeData
  const { deleteElements } = useReactFlow()
  const getChannelZoneStatus = useStore(s => s.getChannelZoneStatus)
  const setChannelWiring = useStore(s => s.setChannelWiring)
  const [showInfo, setShowInfo] = useState(false)

  const handleDelete = useCallback(() => {
    deleteElements({ nodes: [{ id }] })
  }, [id, deleteElements])

  const channelStatuses = model.channels.map(ch => ({
    ch,
    ...getChannelZoneStatus(id, ch.id, ch.outputMode),
  }))

  const worstStatus = channelStatuses.reduce<string>((w, { status }) => {
    if (status === 'red') return 'red'
    if (status === 'amber' && w !== 'red') return 'amber'
    return w
  }, 'green')

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: `1px solid ${worstStatus === 'green' ? 'var(--border)' : STATUS_COLOR[worstStatus]}`,
        borderRadius: 4,
        minWidth: 260,
        fontFamily: 'system-ui, sans-serif',
        fontSize: 12,
        color: 'var(--text-primary)',
        userSelect: 'none',
        position: 'relative',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 8px',
          background: 'var(--surface-2)',
          borderBottom: '1px solid var(--border)',
          borderRadius: '4px 4px 0 0',
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
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* Per-amp status badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '1px 7px',
              borderRadius: 3,
              background: 'rgba(0,0,0,0.3)',
              border: `1px solid ${STATUS_COLOR[worstStatus]}`,
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: 5, height: 5,
                borderRadius: '50%',
                background: STATUS_COLOR[worstStatus],
              }}
            />
            <span style={{ fontSize: 10, color: STATUS_COLOR[worstStatus], fontWeight: 600 }}>
              {STATUS_LABEL[worstStatus]}
            </span>
          </div>

          {/* Info button */}
          <button
            className="nodrag"
            onClick={() => setShowInfo(v => !v)}
            style={{
              background: showInfo ? 'var(--blue-dim)' : 'none',
              border: `1px solid ${showInfo ? 'var(--blue)' : 'transparent'}`,
              color: showInfo ? 'var(--blue)' : 'var(--text-dim)',
              cursor: 'pointer',
              padding: '0 4px',
              fontSize: 12,
              lineHeight: '16px',
              borderRadius: 3,
            }}
            title="Show specs"
          >
            ⓘ
          </button>

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
      </div>

      {/* Body: two-column — inputs left, outputs right */}
      <div style={{ display: 'flex' }}>

        {/* Left column: Signal In */}
        <div
          style={{
            width: 90,
            flexShrink: 0,
            borderRight: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', padding: '6px 8px 6px 18px', gap: 6, width: '100%' }}>
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
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Signal In</span>
          </div>
        </div>

        {/* Right column: output channels with load bars */}
        <div style={{ flex: 1 }}>
          {channelStatuses.map(({ ch, status, detail, loadPercent, speakerCount }, idx) => {
            const handleId = `${ch.id}-out`
            const watts    = ch.outputMode === 'hi-z' ? ch.hiZWatts : ch.maxWatts
            const barColor = loadPercent > 100 ? STATUS_COLOR.red
                           : loadPercent > 85  ? STATUS_COLOR.amber
                           : STATUS_COLOR.green
            const wiring = channelWiring?.[ch.id] ?? 'parallel'

            return (
              <div key={ch.id}>
                <div
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    padding: '6px 22px 4px 8px',
                    borderTop: idx > 0 ? '1px solid var(--border)' : 'none',
                    gap: 5,
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      width: 6, height: 6,
                      borderRadius: '50%',
                      background: STATUS_COLOR[status],
                      flexShrink: 0,
                    }}
                    title={detail}
                  />
                  {watts !== undefined && (
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', flexShrink: 0 }}>
                      {watts}W
                    </span>
                  )}
                  <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                    {ch.label}
                  </span>
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

                {/* Load bar */}
                <div
                  style={{
                    height: 3,
                    background: 'var(--bg)',
                    marginBottom: 2,
                    marginRight: 22,
                  }}
                >
                  {loadPercent > 0 && (
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(loadPercent, 100)}%`,
                        background: barColor,
                        borderRadius: 2,
                        transition: 'width 0.2s ease, background 0.2s ease',
                      }}
                    />
                  )}
                </div>

                {/* Series / Parallel toggle — lo-z only, when ≥2 speakers connected */}
                {ch.outputMode === 'lo-z' && speakerCount >= 2 && (
                  <div
                    className="nodrag"
                    style={{ display: 'flex', gap: 3, padding: '2px 22px 4px 8px', justifyContent: 'flex-end' }}
                  >
                    {(['parallel', 'series'] as const).map(m => (
                      <button
                        key={m}
                        className="nodrag"
                        onClick={() => setChannelWiring(id, ch.id, m)}
                        style={{
                          padding: '1px 6px',
                          fontSize: 9,
                          borderRadius: 2,
                          border: `1px solid ${wiring === m ? 'var(--blue)' : 'var(--border)'}`,
                          background: wiring === m ? 'rgba(74,143,212,0.15)' : 'var(--surface-2)',
                          color: wiring === m ? 'var(--blue)' : 'var(--text-dim)',
                          cursor: 'pointer',
                          fontWeight: wiring === m ? 600 : 400,
                        }}
                      >
                        {m === 'parallel' ? '∥ Parallel' : '— Series'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

      </div>

      {/* Info popover */}
      {showInfo && (
        <div
          className="nodrag nopan"
          style={{
            position: 'absolute',
            top: 0,
            left: 'calc(100% + 8px)',
            zIndex: 100,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: '10px 12px',
            minWidth: 200,
            maxWidth: 260,
            fontSize: 11,
            color: 'var(--text-primary)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8, color: 'var(--blue)' }}>
            {model.name}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <InfoRow label="Series" value={model.series} />
              <InfoRow label="Config" value={model.subtitle} />
              {model.dealer !== undefined && <InfoRow label="Dealer" value={fmtPrice(model.dealer)} />}
              {model.msrp !== undefined && <InfoRow label="MSRP" value={fmtPrice(model.msrp)} />}
            </tbody>
          </table>

          <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
            <div style={{ color: 'var(--text-dim)', fontSize: 10, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Channels</div>
            {model.channels.map(ch => (
              <div key={ch.id} style={{ marginBottom: 4, padding: '4px 6px', background: 'var(--surface-2)', borderRadius: 3 }}>
                <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 2 }}>{ch.label}</div>
                <div style={{ color: 'var(--text-dim)', lineHeight: 1.6 }}>
                  {ch.outputMode === 'hi-z' ? 'Hi-Z (70V)' : 'Lo-Z'}
                  {ch.maxWatts !== undefined && ` · ${ch.maxWatts}W`}
                  {ch.ratedImpedance !== undefined && ` @ ${ch.ratedImpedance}Ω`}
                  {ch.minImpedance !== undefined && ` (min ${ch.minImpedance}Ω)`}
                  {ch.hiZWatts !== undefined && ` · 70V: ${ch.hiZWatts}W`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td style={{ color: 'var(--text-dim)', paddingRight: 8, paddingBottom: 3, whiteSpace: 'nowrap' }}>{label}</td>
      <td style={{ color: 'var(--text-primary)', paddingBottom: 3 }}>{value}</td>
    </tr>
  )
}

export const AmpNode = memo(AmpNodeInner)
