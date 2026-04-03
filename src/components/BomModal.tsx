import { useCallback } from 'react'
import { useStore, type AmpNodeData, type SpeakerNodeData } from '../hooks/useStore'

interface BomModalProps {
  onClose: () => void
}

interface BomRow {
  qty: number
  model: string
  collection: string
  type: string
  dealer?: number
  msrp?: number
}

export function BomModal({ onClose }: BomModalProps) {
  const nodes = useStore(s => s.nodes)
  const overallStatus = useStore(s => s.getOverallStatus)()

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  // Aggregate BOM rows
  const rowMap: Record<string, BomRow> = {}

  nodes.forEach(node => {
    const d = node.data
    if (d.kind === 'amp') {
      const model = (d as AmpNodeData).model
      const key = model.modelId
      if (rowMap[key]) {
        rowMap[key].qty++
      } else {
        rowMap[key] = {
          qty: 1,
          model: model.name,
          collection: model.series,
          type: 'Amplifier',
          dealer: model.dealer,
          msrp: model.msrp,
        }
      }
    } else if (d.kind === 'speaker') {
      const model = (d as SpeakerNodeData).model
      const key = model.modelId
      if (rowMap[key]) {
        rowMap[key].qty++
      } else {
        rowMap[key] = {
          qty: 1,
          model: model.name,
          collection: model.collection,
          type: 'Speaker',
        }
      }
    } else if (d.kind === 'source') {
      const key = 'music-source'
      if (rowMap[key]) {
        rowMap[key].qty++
      } else {
        rowMap[key] = { qty: 1, model: 'Music Source', collection: '—', type: 'Source' }
      }
    }
  })

  const rows = Object.values(rowMap).sort((a, b) => {
    const order = ['Amplifier', 'Speaker', 'Source']
    return order.indexOf(a.type) - order.indexOf(b.type)
  })

  const totalDealer = rows.reduce((acc, r) => acc + (r.dealer ?? 0) * r.qty, 0)
  const totalMsrp   = rows.reduce((acc, r) => acc + (r.msrp ?? 0)   * r.qty, 0)

  const blocked = overallStatus === 'red'

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          width: 700,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'system-ui, sans-serif',
          fontSize: 13,
          color: 'var(--text-primary)',
        }}
      >
        {/* Modal header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface-2)',
            borderRadius: '4px 4px 0 0',
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 14 }}>Bill of Materials</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {!blocked && (
              <button
                onClick={handlePrint}
                style={{
                  padding: '4px 12px',
                  background: 'var(--blue-dim)',
                  border: '1px solid var(--blue)',
                  color: 'var(--blue)',
                  borderRadius: 3,
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                Print
              </button>
            )}
            <button
              onClick={onClose}
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
              Close
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '12px 16px' }}>
          {blocked ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                padding: '32px 0',
                color: 'var(--red)',
              }}
            >
              <span style={{ fontSize: 24 }}>⛔</span>
              <span style={{ fontWeight: 600 }}>Export blocked</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                One or more amp channels are in RED status. Fix all overloads before exporting.
              </span>
            </div>
          ) : (
            <>
              {rows.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '32px 0' }}>
                  No devices on canvas.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ color: 'var(--text-secondary)', fontSize: 11, borderBottom: '1px solid var(--border)' }}>
                      <th style={{ textAlign: 'left', padding: '4px 8px' }}>Qty</th>
                      <th style={{ textAlign: 'left', padding: '4px 8px' }}>Model</th>
                      <th style={{ textAlign: 'left', padding: '4px 8px' }}>Collection</th>
                      <th style={{ textAlign: 'left', padding: '4px 8px' }}>Type</th>
                      <th style={{ textAlign: 'right', padding: '4px 8px' }}>Dealer</th>
                      <th style={{ textAlign: 'right', padding: '4px 8px' }}>MSRP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr
                        key={row.model + i}
                        style={{ borderBottom: '1px solid var(--border)' }}
                      >
                        <td style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>{row.qty}</td>
                        <td style={{ padding: '6px 8px', fontWeight: 500 }}>{row.model}</td>
                        <td style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>{row.collection}</td>
                        <td style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>{row.type}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                          {row.dealer ? `$${(row.dealer * row.qty).toLocaleString()}` : '—'}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                          {row.msrp ? `$${(row.msrp * row.qty).toLocaleString()}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {(totalDealer > 0 || totalMsrp > 0) && (
                    <tfoot>
                      <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 600 }}>
                        <td colSpan={4} style={{ padding: '6px 8px' }}>Total</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                          {totalDealer > 0 ? `$${totalDealer.toLocaleString()}` : '—'}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                          {totalMsrp > 0 ? `$${totalMsrp.toLocaleString()}` : '—'}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
