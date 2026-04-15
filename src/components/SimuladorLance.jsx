/**
 * AXIS — Simulador de Lance v2 (Sprint 17)
 * Slider com marcas, ROI alvo → lance máximo, comparativo 1ª vs 2ª praça,
 * custos pré-preenchidos do estudo.
 */
import { useState, useMemo } from 'react'
import { C, card, fmtC } from '../appConstants.js'
import { calcularBreakdownFinanceiro, calcularROI, calcularLanceMaximoParaROI, HOLDING_MESES_PADRAO, IPTU_SOBRE_CONDO_RATIO } from '../lib/constants.js'
import { isMercadoDireto } from '../lib/detectarFonte.js'

export default function SimuladorLance({ p, isPhone = false }) {
  if (!p) return null
  const eMercado = isMercadoDireto(p.fonte_url, p.tipo_transacao)
  const avaliacao = parseFloat(p.valor_avaliacao) || parseFloat(p.valor_minimo) || 0
  const mercado = parseFloat(p.valor_mercado_estimado) || 0
  const aluguel = parseFloat(p.aluguel_mensal_estimado) || 0
  const lance1p = parseFloat(p.valor_minimo || p.preco_pedido) || 0
  const lance2p = Math.round(avaliacao * 0.50)

  const minLance = Math.round(Math.min(lance2p, lance1p) * 0.8)
  const maxLance = Math.round(Math.max(avaliacao, mercado) * 1.1)

  // Custos pré-preenchidos do estudo
  const reformaEstudo = parseFloat(p.custo_reforma_estimado || p.custo_reforma_calculado || p.custo_reforma_basica) || 0
  const condoMensal = parseFloat(p.condominio_mensal || 0)
  const iptuMensal = parseFloat(p.iptu_mensal || 0) || (condoMensal > 0 ? Math.round(condoMensal * IPTU_SOBRE_CONDO_RATIO) : 0)
  const holdingEstudo = HOLDING_MESES_PADRAO * (condoMensal + iptuMensal)

  const [lanceCustom, setLanceCustom] = useState(lance1p)
  const [custoReformaManual, setCustoReformaManual] = useState(reformaEstudo)
  const [custoExtra, setCustoExtra] = useState(0)
  const [roiAlvo, setRoiAlvo] = useState(15)
  const [showComparativo, setShowComparativo] = useState(false)

  const sim = useMemo(() => {
    const bd = calcularBreakdownFinanceiro(lanceCustom, { ...p, custo_reforma_estimado: custoReformaManual }, eMercado)
    const investTotal = bd.investimentoTotal + custoExtra + holdingEstudo
    const roi = calcularROI(investTotal, mercado, aluguel)
    return { bd, investTotal, roi }
  }, [lanceCustom, custoReformaManual, custoExtra])

  // Lance máximo para ROI alvo
  const lanceMaxROI = useMemo(() => {
    return calcularLanceMaximoParaROI(roiAlvo, p, { eMercado, custoReforma: custoReformaManual })
  }, [roiAlvo, custoReformaManual])

  // Comparativo 1ª vs 2ª praça
  const comp = useMemo(() => {
    if (eMercado || lance2p <= 0) return null
    const bd1 = calcularBreakdownFinanceiro(lance1p, p, false)
    const bd2 = calcularBreakdownFinanceiro(lance2p, p, false)
    const inv1 = bd1.investimentoTotal + holdingEstudo
    const inv2 = bd2.investimentoTotal + holdingEstudo
    const roi1 = calcularROI(inv1, mercado, aluguel)
    const roi2 = calcularROI(inv2, mercado, aluguel)
    return { bd1, bd2, inv1, inv2, roi1, roi2 }
  }, [])

  const roiVal = sim.roi?.roi ?? 0
  const roiColor = roiVal >= 15 ? '#065F46' : roiVal >= 0 ? '#92400E' : '#991B1B'

  // Marcas no slider
  const pctOf = (val) => maxLance > minLance ? ((val - minLance) / (maxLance - minLance)) * 100 : 50
  const marks = [
    !eMercado && lance2p > 0 && { val: lance2p, label: '2ª Praça', color: '#7C3AED' },
    { val: lance1p, label: eMercado ? 'Pedido' : '1ª Praça', color: '#D97706' },
    avaliacao !== lance1p && { val: avaliacao, label: 'Avaliação', color: '#64748B' },
    lanceMaxROI > 0 && lanceMaxROI < maxLance && { val: lanceMaxROI, label: `Limite ${roiAlvo}%`, color: '#DC2626' },
  ].filter(Boolean)

  const inputStyle = {
    width: '100%', padding: '6px 10px', borderRadius: 6, border: `1px solid ${C.border}`,
    fontSize: 13, fontWeight: 600, color: C.navy, background: '#F8FAFC',
    outline: 'none', textAlign: 'right',
  }

  return (
    <div style={{...card(), padding: 16}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14}}>
        <div style={{fontSize: 13, fontWeight: 700, color: C.navy}}>Simulador de Lance</div>
        {holdingEstudo > 0 && (
          <div style={{fontSize: 9, color: C.muted}}>Holding: {fmtC(holdingEstudo)} ({HOLDING_MESES_PADRAO}m)</div>
        )}
      </div>

      {/* Slider */}
      <div style={{position: 'relative', marginBottom: 20, padding: '0 4px'}}>
        <input type="range" min={minLance} max={maxLance} step={1000} value={lanceCustom}
          onChange={e => setLanceCustom(Number(e.target.value))}
          style={{width: '100%', accentColor: C.emerald, height: 6, cursor: 'pointer'}}
        />
        {/* Marcas */}
        <div style={{position: 'relative', height: 28, marginTop: 4}}>
          {marks.map((m, i) => {
            const left = Math.max(2, Math.min(98, pctOf(m.val)))
            return (
              <div key={i} style={{position: 'absolute', left: `${left}%`, transform: 'translateX(-50%)', textAlign: 'center'}}>
                <div style={{width: 2, height: 8, background: m.color, margin: '0 auto 2px'}} />
                <div style={{fontSize: 8, fontWeight: 700, color: m.color, whiteSpace: 'nowrap'}}>{m.label}</div>
                <div style={{fontSize: 8, color: '#94A3B8'}}>{fmtC(m.val)}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Inputs manuais */}
      <div style={{display: 'grid', gridTemplateColumns: isPhone ? '1fr' : '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 14}}>
        <div>
          <label style={{fontSize: 10, color: C.muted, fontWeight: 600, textTransform: 'uppercase'}}>Valor do Lance</label>
          <input type="number" value={lanceCustom} onChange={e => setLanceCustom(Number(e.target.value))} style={inputStyle} />
        </div>
        <div>
          <label style={{fontSize: 10, color: C.muted, fontWeight: 600, textTransform: 'uppercase'}}>Custo Reforma</label>
          <input type="number" value={custoReformaManual} onChange={e => setCustoReformaManual(Number(e.target.value))} style={inputStyle} />
        </div>
        <div>
          <label style={{fontSize: 10, color: C.muted, fontWeight: 600, textTransform: 'uppercase'}}>Custos Extras</label>
          <input type="number" value={custoExtra} onChange={e => setCustoExtra(Number(e.target.value))} style={inputStyle} />
        </div>
        <div>
          <label style={{fontSize: 10, color: '#DC2626', fontWeight: 600, textTransform: 'uppercase'}}>ROI Alvo (%)</label>
          <input type="number" value={roiAlvo} onChange={e => setRoiAlvo(Number(e.target.value))} style={{...inputStyle, borderColor: '#DC262640', color: '#DC2626'}} />
        </div>
      </div>

      {/* KPIs resultado */}
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8, marginBottom: 10}}>
        {[
          { label: 'Lance', value: fmtC(lanceCustom), color: '#D97706' },
          { label: 'Custos Aq.', value: fmtC(sim.bd.totalCustos), color: C.navy },
          { label: 'Reforma', value: fmtC(custoReformaManual), color: '#92400E' },
          { label: 'Invest. Total', value: fmtC(sim.investTotal), color: C.navy },
          { label: 'ROI Flip', value: `${roiVal > 0 ? '+' : ''}${roiVal}%`, color: roiColor },
          sim.roi?.locacao && { label: 'Yield', value: `${sim.roi.locacao.yieldAnual}% a.a.`, color: '#065F46' },
        ].filter(Boolean).map((kpi, i) => (
          <div key={i} style={{padding: '8px 10px', borderRadius: 8, background: '#F8FAFC', border: '1px solid #E2E8F0', borderLeft: `3px solid ${kpi.color}`}}>
            <div style={{fontSize: 9, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase'}}>{kpi.label}</div>
            <div style={{fontSize: 14, fontWeight: 800, color: kpi.color, marginTop: 2}}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Lance máximo para ROI alvo */}
      {lanceMaxROI > 0 && (
        <div style={{padding: '8px 12px', borderRadius: 8, marginBottom: 10,
          background: lanceCustom <= lanceMaxROI ? '#F0FDF4' : '#FEF2F2',
          border: `1px solid ${lanceCustom <= lanceMaxROI ? '#BBF7D0' : '#FECACA'}`}}>
          <div style={{fontSize: 10, color: '#64748B', fontWeight: 600}}>LANCE MÁXIMO PARA ROI {roiAlvo}%</div>
          <div style={{fontSize: 16, fontWeight: 800, color: lanceCustom <= lanceMaxROI ? '#065F46' : '#DC2626', marginTop: 2}}>
            {fmtC(lanceMaxROI)}
          </div>
          {lanceCustom > lanceMaxROI && (
            <div style={{fontSize: 10, color: '#DC2626', marginTop: 2}}>
              ⚠️ Lance atual excede o limite em {fmtC(lanceCustom - lanceMaxROI)}
            </div>
          )}
        </div>
      )}

      {/* Cenários rápidos + toggle comparativo */}
      <div style={{display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center'}}>
        {!eMercado && (
          <>
            <button onClick={() => setLanceCustom(lance1p)} style={btnStyle(lanceCustom === lance1p)}>1ª Praça ({fmtC(lance1p)})</button>
            {lance2p > 0 && <button onClick={() => setLanceCustom(lance2p)} style={btnStyle(lanceCustom === lance2p)}>2ª Praça ({fmtC(lance2p)})</button>}
            <button onClick={() => setLanceCustom(Math.round(avaliacao * 0.60))} style={btnStyle(false)}>60% aval.</button>
            <button onClick={() => setLanceCustom(Math.round(avaliacao * 0.70))} style={btnStyle(false)}>70% aval.</button>
            {lanceMaxROI > 0 && <button onClick={() => setLanceCustom(lanceMaxROI)} style={btnStyle(lanceCustom === lanceMaxROI)}>Limite ROI</button>}
            <div style={{flex: 1}} />
            {comp && <button onClick={() => setShowComparativo(!showComparativo)} style={{...btnStyle(showComparativo), borderColor: '#7C3AED40', color: showComparativo ? '#7C3AED' : '#64748B', background: showComparativo ? '#F5F3FF' : '#fff'}}>
              📊 1ª vs 2ª Praça
            </button>}
          </>
        )}
      </div>

      {/* Comparativo 1ª vs 2ª Praça */}
      {showComparativo && comp && (
        <div style={{marginTop: 12, borderTop: '1px solid #E2E8F0', paddingTop: 12}}>
          <div style={{fontSize: 11, fontWeight: 700, color: '#7C3AED', marginBottom: 8}}>Comparativo 1ª vs 2ª Praça</div>
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8}}>
            {[
              { label: `1ª Praça`, lance: lance1p, inv: comp.inv1, roi: comp.roi1, cor: '#D97706' },
              { label: `2ª Praça (50%)`, lance: lance2p, inv: comp.inv2, roi: comp.roi2, cor: '#7C3AED' },
            ].map((side, i) => (
              <div key={i} style={{padding: 10, borderRadius: 8, background: '#F8FAFC', border: `1px solid #E2E8F0`, borderTop: `3px solid ${side.cor}`}}>
                <div style={{fontSize: 11, fontWeight: 700, color: side.cor, marginBottom: 6}}>{side.label}</div>
                {[
                  ['Lance', fmtC(side.lance)],
                  ['Investimento', fmtC(side.inv)],
                  ['ROI Flip', `${(side.roi?.roi ?? 0) > 0 ? '+' : ''}${side.roi?.roi ?? 0}%`],
                  ['Lucro', fmtC(side.roi?.lucro)],
                  side.roi?.locacao && ['Yield', `${side.roi.locacao.yieldAnual}% a.a.`],
                ].filter(Boolean).map(([l, v], j) => (
                  <div key={j} style={{display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '3px 0', borderBottom: '1px solid #f0f0f0'}}>
                    <span style={{color: '#64748B'}}>{l}</span>
                    <span style={{fontWeight: 600, color: C.navy}}>{v}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          {/* Resumo */}
          {(() => {
            const gain = (comp.roi2?.roi ?? 0) - (comp.roi1?.roi ?? 0)
            const economia = lance1p - lance2p
            return (
              <div style={{marginTop: 8, padding: '8px 12px', borderRadius: 6,
                background: gain > 10 ? '#F0FDF4' : '#FEF9C3',
                border: `1px solid ${gain > 10 ? '#BBF7D0' : '#FDE68A'}`,
                fontSize: 11, color: gain > 10 ? '#065F46' : '#92400E'}}>
                {gain > 10
                  ? `✅ Aguardar 2ª praça gera +${gain.toFixed(1)}pp de ROI. Economia de ${fmtC(economia)} no lance.`
                  : `⚠️ Diferença de ${gain.toFixed(1)}pp no ROI. Avaliar risco de perder o imóvel vs. ganho marginal.`}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}

function btnStyle(active) {
  return {
    padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
    border: active ? '1px solid #059669' : '1px solid #E2E8F0',
    background: active ? '#ECFDF5' : '#FFFFFF',
    color: active ? '#065F46' : '#64748B',
  }
}
