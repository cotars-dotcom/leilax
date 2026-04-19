/**
 * AXIS — Simulador de Lance v3 (Sprint 18)
 * Sincronizado com ConfigEstudo via useReforma context.
 * Inputs formatados como moeda.
 */
import { useState, useMemo, useEffect } from 'react'
import { C, card, fmtC } from '../appConstants.js'
import { calcularBreakdownFinanceiro, calcularROI, calcularLanceMaximoParaROI, calcularPreditorConcorrencia, HOLDING_MESES_PADRAO, IPTU_SOBRE_CONDO_RATIO } from '../lib/constants.js'
import { isMercadoDireto } from '../lib/detectarFonte.js'
import { useReforma } from '../hooks/useReforma.jsx'
import { InputMoeda } from './ConfigEstudo.jsx'

export default function SimuladorLance({ p, isPhone = false }) {
  if (!p) return null
  const { lanceEstudo, setLanceEstudo, custoReformaAtual } = useReforma()
  const eMercado = isMercadoDireto(p.fonte_url, p.tipo_transacao)
  const avaliacao = parseFloat(p.valor_avaliacao) || parseFloat(p.valor_minimo) || 0
  const mercado = parseFloat(p.valor_mercado_estimado) || 0
  const aluguel = parseFloat(p.aluguel_mensal_estimado) || 0
  const lance1p = parseFloat(p.valor_minimo || p.preco_pedido) || 0
  const lance2p = Math.round(avaliacao * 0.50)

  const minLance = Math.round(Math.min(lance2p, lance1p) * 0.8)
  const maxLance = Math.round(Math.max(avaliacao, mercado) * 1.1)

  const condoMensal = parseFloat(p.condominio_mensal || 0)
  const iptuMensal = parseFloat(p.iptu_mensal || 0) || (condoMensal > 0 ? Math.round(condoMensal * IPTU_SOBRE_CONDO_RATIO) : 0)
  const holdingEstudo = HOLDING_MESES_PADRAO * (condoMensal + iptuMensal)

  // Lance e reforma sincronizados com contexto global
  const lanceCustom = lanceEstudo || lance1p
  const setLanceCustom = (v) => setLanceEstudo(v)
  const custoReformaManual = custoReformaAtual
  const [custoExtra, setCustoExtra] = useState(0)
  const [roiAlvo, setRoiAlvo] = useState(20)
  const [showComparativo, setShowComparativo] = useState(!eMercado)

  const sim = useMemo(() => {
    const bd = calcularBreakdownFinanceiro(lanceCustom, { ...p, custo_reforma_estimado: custoReformaManual }, eMercado)
    const investTotal = bd.investimentoTotal + custoExtra
    const roi = calcularROI(investTotal, mercado, aluguel)
    return { bd, investTotal, roi }
  }, [lanceCustom, custoReformaManual, custoExtra])

  // Lance máximo para ROI alvo
  const lanceMaxROI = useMemo(() => {
    const mercadoBruto = parseFloat(p.valor_mercado_estimado) || 0
    return calcularLanceMaximoParaROI(roiAlvo, p, { eMercado, custoReforma: custoReformaManual, mercadoBruto })
  }, [roiAlvo, custoReformaManual])

  // Comparativo 1ª vs 2ª praça
  const comp = useMemo(() => {
    if (eMercado || lance2p <= 0) return null
    const bd1 = calcularBreakdownFinanceiro(lance1p, p, false)
    const bd2 = calcularBreakdownFinanceiro(lance2p, p, false)
    const roi1 = calcularROI(bd1.investimentoTotal, mercado, aluguel)
    const roi2 = calcularROI(bd2.investimentoTotal, mercado, aluguel)
    return { bd1, bd2, inv1: bd1.investimentoTotal, inv2: bd2.investimentoTotal, roi1, roi2 }
  }, [])

  // Preditor de concorrência — quantos lances até perder o ROI alvo
  const preditor = useMemo(() => {
    if (eMercado || !mercado || !lanceMaxROI) return []
    const custosFixos = sim.bd.totalCustos + (custoReformaManual || 0) + holdingEstudo +
      (p.responsabilidade_debitos === 'arrematante' ? parseFloat(p.debitos_total_estimado || 0) : 0)
    return calcularPreditorConcorrencia(lanceCustom, mercado, custosFixos, 5000)
  }, [lanceCustom, mercado, lanceMaxROI, custoReformaManual])

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

  return (
    <div style={{...card(), padding: 16}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10}}>
        <div style={{fontSize: 13, fontWeight: 700, color: C.navy}}>Simulador de Lance</div>
        <div style={{fontSize: 9, color: C.muted}}>
          Lance definido no <strong>Configuração do Estudo</strong>
          {holdingEstudo > 0 && ` · Holding ${HOLDING_MESES_PADRAO}m`}
        </div>
      </div>

      {/* Quick-setters + Custos extras + ROI alvo */}
      <div style={{display: 'grid', gridTemplateColumns: isPhone ? '1fr 1fr' : '1fr 1fr 1fr', gap: 10, marginBottom: 14}}>
        <div>
          <div style={{fontSize: 9, color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 3}}>Atalhos de Lance</div>
          <div style={{display: 'flex', gap: 3, flexWrap: 'wrap'}}>
            {[
              { lb: '1ª', val: lance1p },
              !eMercado && lance2p > 0 && { lb: '2ª', val: lance2p },
              { lb: 'MAO', val: lanceMaxROI, destaque: true },
            ].filter(Boolean).map((b, i) => (
              <button key={i} onClick={() => setLanceCustom(b.val)} style={{
                padding: '6px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                border: b.destaque ? '1px solid #059669' : lanceCustom === b.val ? '1px solid #D97706' : '1px solid #E2E8F0',
                background: b.destaque ? '#ECFDF5' : lanceCustom === b.val ? '#FEF3C7' : '#fff',
                color: b.destaque ? '#065F46' : lanceCustom === b.val ? '#D97706' : '#64748B',
                cursor: 'pointer', flex: 1, minWidth: 60,
              }}>{b.lb} {fmtC(b.val)}</button>
            ))}
          </div>
        </div>
        <InputMoeda label="Custos Extras" value={custoExtra} onChange={setCustoExtra} cor="#64748B" />
        <div>
          <div style={{fontSize: 9, color: '#DC2626', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 3}}>ROI Alvo (%)</div>
          <input type="number" value={roiAlvo} onChange={e => setRoiAlvo(Number(e.target.value))}
            style={{width: '100%', padding: '8px 12px', borderRadius: 8, border: '2px solid #DC262630', fontSize: 15, fontWeight: 800, color: '#DC2626', background: '#DC262608', outline: 'none', textAlign: 'right', boxSizing: 'border-box'}} />
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

      {/* Preditor de Concorrência */}
      {preditor.length > 0 && !eMercado && (
        <div style={{marginTop:10, padding:'10px 12px', borderRadius:8,
          background:'#0F172A', border:'1px solid #1E293B'}}>
          <div style={{fontSize:10, fontWeight:700, color:'#94A3B8', textTransform:'uppercase',
            letterSpacing:'.5px', marginBottom:8}}>
            🎯 Lances disponíveis (incrementos R$ 5k)
          </div>
          <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
            {preditor.slice(0, 4).map((nivel, i) => (
              <button key={i} onClick={() => setLanceCustom(nivel.lanceAtual)}
                style={{flex:1, minWidth:90, padding:'7px 6px', borderRadius:7, cursor:'pointer',
                  border: lanceCustom === nivel.lanceAtual ? '2px solid #22D3EE' : '1px solid #334155',
                  background: lanceCustom === nivel.lanceAtual ? '#164E63' : '#1E293B'}}>
                <div style={{fontSize:10, color:'#94A3B8', fontWeight:600}}>{nivel.label}</div>
                <div style={{fontSize:12, fontWeight:800, color:'#F1F5F9', marginTop:1}}>{fmtC(nivel.lanceAtual)}</div>
                <div style={{fontSize:11, fontWeight:700,
                  color: nivel.roiReal >= 20 ? '#4ADE80' : nivel.roiReal >= 10 ? '#FBBF24' : '#F87171',
                  marginTop:1}}>
                  ROI {nivel.roiReal > 0 ? '+' : ''}{nivel.roiReal}%
                </div>
                <div style={{fontSize:9, color:'#64748B', marginTop:1}}>+{nivel.numLances} lances</div>
              </button>
            ))}
          </div>
          <div style={{fontSize:9, color:'#475569', marginTop:6}}>
            Clique para simular o lance naquele nível de concorrência
          </div>
        </div>
      )}

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
