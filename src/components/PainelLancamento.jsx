/**
 * AXIS — Painel de Estratégia de Lance
 * Calcula lances máximos viáveis, projeções do 2º leilão
 * e faixas de lance competitivo — custo zero (sem API)
 */
import { useState, useMemo } from 'react'
import { C, K, fmtC, card } from '../appConstants.js'
import { useReforma } from '../hooks/useReforma.jsx'

import { CUSTOS_LEILAO } from '../lib/constants.js'

const fmt  = v => v != null && v > 0 ? `R$ ${Math.round(v).toLocaleString('pt-BR')}` : '—'
const pct  = v => v != null ? `${parseFloat(v).toFixed(1)}%` : '—'
const cor  = (roi) => roi >= 30 ? C.emerald : roi >= 20 ? C.mustard : roi >= 10 ? '#E06A00' : '#E5484D'

// Custos de transação — fonte: constants.js (leilão only — este painel só aparece para leilões)
const TX = {
  comissao: CUSTOS_LEILAO.comissao_leiloeiro_pct / 100,
  itbi:     CUSTOS_LEILAO.itbi_pct / 100,
  doc:      CUSTOS_LEILAO.documentacao_pct / 100,
  adv:      CUSTOS_LEILAO.advogado_pct / 100,
  reg:      CUSTOS_LEILAO.registro_fixo,
  corretagem_venda: 0.06,
  irpf_pct: CUSTOS_LEILAO.irpf_ganho_capital_pct / 100,
  isencao_irpf: 440000,
}

function calcularCenario(lance, vmercado, reforma, juridico = 0, debitosArr = 0) {
  const taxas = lance * (TX.comissao + TX.itbi + TX.doc + TX.adv) + TX.reg
  const custoTotal = lance + taxas + (reforma || 0) + (juridico || 0) + debitosArr
  const corretagem = vmercado * TX.corretagem_venda
  const precoVendaLiq = vmercado - corretagem
  const ganho = Math.max(0, precoVendaLiq - custoTotal)
  const irpf = vmercado <= TX.isencao_irpf ? 0 : ganho * TX.irpf_pct
  const lucro = precoVendaLiq - custoTotal - irpf
  const roi = custoTotal > 0 ? (lucro / custoTotal) * 100 : 0
  const txProporcional = TX.comissao + TX.itbi + TX.doc + TX.adv
  const maoFlip = (vmercado * 0.80 - TX.reg - (reforma || 0) - (juridico || 0) - debitosArr) / (1 + txProporcional)
  return {
    lance, custo_total: Math.round(custoTotal),
    irpf: Math.round(irpf), corretagem: Math.round(corretagem),
    lucro: Math.round(lucro), roi: parseFloat(roi.toFixed(1)),
    mao_flip: Math.round(maoFlip), viavel: lance <= maoFlip,
  }
}

function BarROI({ roi }) {
  const c = cor(roi)
  const w = Math.min(100, Math.max(0, roi * 1.5))
  return (
    <div style={{ height: 5, borderRadius: 3, background: `${C.borderW}`, overflow: 'hidden', marginTop: 3 }}>
      <div style={{ height: '100%', width: `${w}%`, background: c, borderRadius: 3, transition: 'width .4s' }} />
    </div>
  )
}

function CardCenario({ label, sublabel, lance, cenario, isDestaque, avaliacao }) {
  const [aberto, setAberto] = useState(false)
  const pctAval = avaliacao > 0 ? ((lance / avaliacao) * 100).toFixed(0) : '—'

  return (
    <div style={{
      border: `1.5px solid ${cenario.viavel ? (isDestaque ? C.emerald : C.borderW) : '#E5484D'}`,
      borderRadius: 10, overflow: 'hidden', marginBottom: 8,
      background: isDestaque ? `${C.emerald}05` : C.white,
    }}>
      {/* Header */}
      <div onClick={() => setAberto(!aberto)} style={{
        padding: '10px 12px', cursor: 'pointer',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: C.navy }}>{label}</span>
            {sublabel && <span style={{ fontSize: 10, color: C.muted }}>{sublabel}</span>}
            {isDestaque && (
              <span style={{ fontSize: 9, fontWeight: 700, background: C.emerald, color: '#fff',
                padding: '1px 6px', borderRadius: 4 }}>RECOMENDADO</span>
            )}
          </div>
          <div style={{ fontSize: 11, color: C.muted }}>
            Lance: <strong style={{ color: C.amber }}>{fmt(lance)}</strong>
            {avaliacao > 0 && <span style={{ marginLeft: 6, color: C.hint }}>({pctAval}% da avaliação)</span>}
          </div>
          <BarROI roi={cenario.roi} />
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: cor(cenario.roi) }}>
            {pct(cenario.roi)}
          </div>
          <div style={{ fontSize: 9, color: C.hint }}>ROI</div>
          <div style={{ fontSize: 11, marginTop: 3 }}>
            {cenario.viavel
              ? <span style={{ color: C.emerald, fontWeight: 600 }}>✓ Viável</span>
              : <span style={{ color: '#E5484D', fontWeight: 600 }}>✗ Acima MAO</span>}
          </div>
        </div>
      </div>

      {/* Detalhe expandido */}
      {aberto && (
        <div style={{
          padding: '10px 12px', borderTop: `1px solid ${C.borderW}`,
          background: C.surface, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8
        }}>
          {[
            ['Custo total', fmt(cenario.custo_total), C.navy],
            ['Lucro líquido', fmt(cenario.lucro), cenario.lucro > 0 ? C.emerald : '#E5484D'],
            ['IRPF (15%)', fmt(cenario.irpf), C.muted],
            ['Corretagem', fmt(cenario.corretagem), C.muted],
            ['MAO flip', fmt(cenario.mao_flip), C.teal],
            ['Margem segurança', fmt(cenario.mao_flip - lance), cenario.mao_flip > lance ? C.emerald : '#E5484D'],
          ].map(([lbl, val, c]) => (
            <div key={lbl}>
              <div style={{ fontSize: 9, color: C.hint, marginBottom: 1 }}>{lbl}</div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: c }}>{val}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function PainelLancamento({ imovel }) {
  const [roiAlvo, setRoiAlvo] = useState(25)
  const [margemSeg, setMargemSeg] = useState(10)

  const {
    valor_minimo, valor_avaliacao, valor_mercado_estimado,
    preco_m2_mercado, preco_m2_imovel,
    area_privativa_m2, area_m2,
    custo_juridico_estimado,
    num_leilao, aluguel_mensal_estimado,
  } = imovel

  const area = parseFloat(area_privativa_m2 || area_m2) || 0
  const avaliacao = parseFloat(valor_avaliacao) || 0
  // Lance e reforma unificados via context useReforma (sincronizado com ConfigEstudo e todos os painéis)
  const { cenarioSimplificado: cenarioReforma, selecionarCenario: setCenarioReformaLocal, reformas: reformasCtx, lanceEstudo } = useReforma()
  const lancePrin = lanceEstudo > 0 ? lanceEstudo : parseFloat(valor_minimo) || 0
  const custo_reforma_basica = reformasCtx.basica
  const custo_reforma_media = reformasCtx.media
  const custo_reforma_completa = reformasCtx.completa
  const reformaMap = { basica: custo_reforma_basica, media: custo_reforma_media, completa: custo_reforma_completa, sem_reforma: 0 }
  const reforma = reformaMap[cenarioReforma] ?? 0
  const juridico = parseFloat(custo_juridico_estimado) || 0
  const debitosArr = imovel.responsabilidade_debitos === 'arrematante'
    ? parseFloat(imovel.debitos_total_estimado || 0) : 0
  const aluguel = parseFloat(aluguel_mensal_estimado) || 0

  // Valor de mercado — preferir o do banco, senão calcular por m²
  const vmercado = useMemo(() => {
    const vBanco = parseFloat(valor_mercado_estimado) || 0
    const vM2 = parseFloat(preco_m2_mercado) > 0 && area > 0
      ? parseFloat(preco_m2_mercado) * area : 0
    return vBanco > 0 ? vBanco : vM2 > 0 ? vM2 : lancePrin * 1.35
  }, [valor_mercado_estimado, preco_m2_mercado, area, lancePrin])

  // Lance máximo viável para dado ROI alvo
  const txProporcional = TX.comissao + TX.itbi + TX.doc + TX.adv
  const lanceMaxViavel = useMemo(() => {
    return (vmercado * 0.80 - TX.reg - reforma - juridico - debitosArr) / (1 + txProporcional)
  }, [vmercado, reforma, juridico, debitosArr])

  const lanceMaxROIAlvo = useMemo(() => {
    const roiFator = 1 + roiAlvo / 100
    const custoMax = vmercado / roiFator
    return (custoMax - TX.reg - reforma - juridico - debitosArr - vmercado * TX.corretagem_venda) / (1 + txProporcional)
  }, [vmercado, roiAlvo, reforma, juridico, debitosArr])

  const lanceMaxMargem = useMemo(() => {
    return lanceMaxViavel * (1 - margemSeg / 100)
  }, [lanceMaxViavel, margemSeg])

  // Cenário 1º leilão
  const c1 = useMemo(() => calcularCenario(lancePrin, vmercado, reforma, juridico, debitosArr), [lancePrin, vmercado, reforma, juridico, debitosArr])
  const cMax = useMemo(() => calcularCenario(Math.round(lanceMaxViavel), vmercado, reforma, juridico, debitosArr), [lanceMaxViavel, vmercado, reforma, juridico, debitosArr])
  const cAlvo = useMemo(() => calcularCenario(Math.round(lanceMaxROIAlvo), vmercado, reforma, juridico, debitosArr), [lanceMaxROIAlvo, vmercado, reforma, juridico, debitosArr])

  // Projeções de lance
  const isSegundoLeilao = (num_leilao || 1) >= 2
  const lance2p = avaliacao ? Math.round(avaliacao * 0.35) : 0
  const lance2e = avaliacao ? Math.round(avaliacao * 0.50) : 0
  const lance2c = avaliacao ? Math.round(avaliacao * 0.65) : 0
  const c2p = useMemo(() => calcularCenario(lance2p, vmercado, reforma, juridico, debitosArr), [lance2p, vmercado, reforma, juridico, debitosArr])
  const c2e = useMemo(() => calcularCenario(lance2e, vmercado, reforma, juridico, debitosArr), [lance2e, vmercado, reforma, juridico, debitosArr])
  const c2c = useMemo(() => calcularCenario(lance2c, vmercado, reforma, juridico, debitosArr), [lance2c, vmercado, reforma, juridico, debitosArr])

  // Recomendação estratégica
  const estrategia = useMemo(() => {
    if (isSegundoLeilao) {
      if (c1.roi >= 50 && c1.viavel) return 'lance_1'
      if (c1.roi >= 25 && c1.viavel) return 'lance_1_cauteloso'
      return 'aguardar_2'
    }
    if (!c1.viavel && c1.roi < 15) return 'aguardar_2'
    if (c1.roi >= 25 && c1.viavel) return 'lance_1'
    if (c2e.roi > c1.roi * 1.25) return 'aguardar_2'
    return 'lance_1_cauteloso'
  }, [c1, c2e, isSegundoLeilao])

  const rendaYield = vmercado > 0 && aluguel > 0
    ? ((aluguel * 12 / vmercado) * 100).toFixed(1) : null

  const leilaoPassou = imovel.data_leilao && (() => {
    const [y, m, d] = imovel.data_leilao.split('-').map(Number)
    const dl = new Date(y, m - 1, d); dl.setHours(23, 59, 59, 0)
    return dl < new Date()
  })()

  return (
    <div style={{ ...card(), marginBottom: 14 }}>
      {/* Header */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontWeight: 700, color: C.navy, fontSize: 13, marginBottom: 4 }}>
          🎯 Estratégia de Lance
        </div>
        <div style={{ fontSize: 10.5, color: C.muted }}>
          Mercado ref.: <strong style={{ color: C.navy }}>{fmt(vmercado)}</strong>
          {preco_m2_mercado > 0 && ` · R$ ${parseFloat(preco_m2_mercado).toLocaleString('pt-BR')}/m²`}
        </div>
      </div>

      {/* Seletor de reforma */}
      <div style={{ marginBottom:12 }}>
        <div style={{ fontSize:9.5, color:C.muted, marginBottom:5, textTransform:'uppercase', letterSpacing:.3 }}>
          Cenário de reforma
        </div>
        <div style={{ display:'flex', gap:5 }}>
          {[
            ['basica',   `🪣 Básica ${(custo_reforma_basica/1000).toFixed(0)}k`],
            ['media',    `🔧 Média ${(custo_reforma_media/1000).toFixed(0)}k`],
            ['completa', `✨ Completa ${(custo_reforma_completa/1000).toFixed(0)}k`],
          ].map(([id,lbl]) => (
            <button key={id} onClick={() => setCenarioReformaLocal(id)} style={{
              fontSize:10, padding:'4px 8px', borderRadius:5,
              border:`1px solid ${C.borderW}`,
              background: cenarioReforma===id ? C.navy : '#fff',
              color: cenarioReforma===id ? '#fff' : C.navy,
              cursor:'pointer', flex:1
            }}>{lbl}</button>
          ))}
        </div>
      </div>

      {/* Recomendação estratégica */}
      <div style={{
        padding: '10px 12px', borderRadius: 8, marginBottom: 14,
        background: estrategia === 'aguardar_2' ? `${C.mustard}10` : `${C.emerald}08`,
        border: `1px solid ${estrategia === 'aguardar_2' ? C.mustard : C.emerald}30`,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700,
          color: estrategia === 'aguardar_2' ? C.mustard : C.emerald, marginBottom: 3 }}>
          {estrategia === 'aguardar_2'
            ? `⏳ Aguardar ${isSegundoLeilao ? '2º' : '2º'} leilão`
            : estrategia === 'lance_1_cauteloso'
            ? `⚠️ ${isSegundoLeilao ? '2º' : '1º'} leilão: lance com cautela`
            : `✅ ${isSegundoLeilao ? '2º' : '1º'} leilão: lance viável`}
        </div>
        <div style={{ fontSize: 10.5, color: C.muted }}>
          {estrategia === 'aguardar_2'
            ? `ROI atual de ${pct(c1.roi)} no 1º leilão vs ${pct(c2e.roi)} no 2º leilão esperado — diferença de ${pct(c2e.roi - c1.roi)}`
            : estrategia === 'lance_1_cauteloso'
            ? `ROI de ${pct(c1.roi)} — margem ok mas aguardar pode melhorar retorno`
            : isSegundoLeilao && c2p.roi >= 50
            ? `ROI de ${pct(c2p.roi)} no piso legal — lance mínimo recomendado (melhor custo-benefício)`
            : `ROI de ${pct(c1.roi)} com lance atual — lançar até R$ ${Math.round(lanceMaxViavel).toLocaleString('pt-BR')}`}
        </div>
      </div>

      {/* Controles de ROI alvo */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
        <div style={{ background: C.surface, padding: '8px 10px', borderRadius: 7 }}>
          <div style={{ fontSize: 9.5, color: C.hint, marginBottom: 4 }}>ROI alvo mínimo</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="range" min="10" max="60" value={roiAlvo}
              onChange={e => setRoiAlvo(Number(e.target.value))}
              style={{ flex: 1, accentColor: C.teal }} />
            <strong style={{ fontSize: 13, color: C.teal, minWidth: 32 }}>{roiAlvo}%</strong>
          </div>
        </div>
        <div style={{ background: C.surface, padding: '8px 10px', borderRadius: 7 }}>
          <div style={{ fontSize: 9.5, color: C.hint, marginBottom: 4 }}>Margem de segurança</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="range" min="0" max="25" value={margemSeg}
              onChange={e => setMargemSeg(Number(e.target.value))}
              style={{ flex: 1, accentColor: C.emerald }} />
            <strong style={{ fontSize: 13, color: C.emerald, minWidth: 32 }}>{margemSeg}%</strong>
          </div>
        </div>
      </div>

      {/* Resumo dos lances máximos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 14 }}>
        {[
          { label: 'MAO flip', sublabel: 'Lance máximo (quebrar-even)', val: lanceMaxViavel, c: C.teal },
          { label: `ROI ≥ ${roiAlvo}%`, sublabel: 'Lance para atingir meta', val: lanceMaxROIAlvo, c: C.navy },
          { label: `Margem ${margemSeg}%`, sublabel: 'Com colchão de segurança', val: lanceMaxMargem, c: C.emerald },
        ].map(({ label, sublabel, val, c }) => (
          <div key={label} style={{ background: C.surface, borderRadius: 7, padding: '8px 10px',
            border: lancePrin <= val ? `1px solid ${c}30` : '1px solid #E5484D30' }}>
            <div style={{ fontSize: 9, color: C.hint, marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 11, fontWeight: 800,
              color: lancePrin <= val ? c : '#E5484D' }}>{fmt(Math.round(val))}</div>
            <div style={{ fontSize: 8.5, color: C.hint, marginTop: 1 }}>{sublabel}</div>
            <div style={{ fontSize: 9, marginTop: 3, fontWeight: 600,
              color: lancePrin <= val ? C.emerald : '#E5484D' }}>
              {lancePrin <= val
                ? `Mín. ${fmt(lancePrin)} — margem ${fmt(Math.round(val - lancePrin))}`
                : `Lance R$${Math.round(lancePrin - val).toLocaleString('pt-BR')} acima do limite`}
            </div>
          </div>
        ))}
      </div>

      {leilaoPassou && (
        <div style={{ padding: '10px 12px', borderRadius: 8, marginBottom: 10,
          background: '#FEF2F2', border: '1px solid #FECACA', fontSize: 11, color: '#991B1B', fontWeight: 600 }}>
          ⏰ Leilão já realizado — cenários de lance para referência histórica apenas.
        </div>
      )}

      {/* Cenários 1º leilão */}
      <div style={{ fontSize: 10.5, fontWeight: 700, color: C.navy,
        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
        {isSegundoLeilao ? 'Lance mínimo atual (2º Leilão)' : `${num_leilao || 1}º Leilão`}
      </div>

      <CardCenario
        label={isSegundoLeilao ? `Lance mínimo — ${num_leilao}º Leilão (35% av.)` : `Lance mínimo — ${num_leilao || 1}º Leilão`}
        sublabel={avaliacao > 0 ? (isSegundoLeilao ? `${((lancePrin/avaliacao)*100).toFixed(0)}% da avaliação` : '100% da avaliação') : ''}
        lance={lancePrin} cenario={c1} avaliacao={isSegundoLeilao ? avaliacao : undefined}
        isDestaque={c1.viavel && c1.roi >= 20}
      />
      <CardCenario
        label="Lance máximo viável"
        sublabel={`ROI ≥ ${roiAlvo}% com margem ${margemSeg}%`}
        lance={Math.round(lanceMaxMargem)} cenario={calcularCenario(Math.round(lanceMaxMargem), vmercado, reforma, juridico, debitosArr)}
        avaliacao={avaliacao} isDestaque={false}
      />

      {/* Cenários 2º leilão */}
      {avaliacao > 0 && (
        <>
          {/* Header da seção */}
          <div style={{ fontSize: 10.5, fontWeight: 700, color: C.navy,
            textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{isSegundoLeilao ? '2º Leilão — Cenários de lance' : '📐 Projeção Hipotética: 2º Leilão'}</span>
            <span style={{ fontSize: 9, fontWeight: 400, color: C.hint }}>
              {isSegundoLeilao
                ? `Mín. legal: R$ ${Math.round(avaliacao*0.35).toLocaleString('pt-BR')}`
                : `Mín. art.891 CPC: R$ ${Math.round(avaliacao*0.50).toLocaleString('pt-BR')}`}
            </span>
          </div>

          {/* Box informativo quando no 1º leilão */}
          {!isSegundoLeilao && (
            <div style={{ padding:'10px 12px', borderRadius:8, marginBottom:10,
              background:'#F0F4FF', border:'1px solid #C7D4F8', fontSize:10.5, color:'#2D4A9A' }}>
              <strong>Cenário hipotético:</strong> se o 1º leilão não fechar, o imóvel volta como
              2º leilão com lance mínimo de 50% da avaliação (art. 891 CPC). Histórico TRT-3 BH:
              ~65% dos imóveis arremata no 1º leilão. Probabilidade de 2º leilão: ~35%.
            </div>
          )}

          <CardCenario
            label="Piso legal (35% av.)"
            sublabel={`R$ ${lance2p.toLocaleString('pt-BR')} — mínimo art. 891 CPC`}
            lance={lance2p} cenario={c2p} avaliacao={avaliacao}
            isDestaque={c2p.roi >= 50} />
          <CardCenario
            label="Esperado (50% av.)"
            sublabel={`R$ ${lance2e.toLocaleString('pt-BR')} — faixa histórica TRT-3 BH`}
            lance={lance2e} cenario={c2e} avaliacao={avaliacao}
            isDestaque={c2e.roi >= 30 && !c1.viavel} />
          <CardCenario
            label="Competitivo (65% av.)"
            sublabel={`R$ ${lance2c.toLocaleString('pt-BR')} — cenário com concorrência`}
            lance={lance2c} cenario={c2c} avaliacao={avaliacao} />

          {/* Comparativo 1º vs 2º */}
          {!isSegundoLeilao && (
            <div style={{ padding:'10px 12px', borderRadius:7, marginTop:6,
              background: c1.viavel ? `${C.emerald}08` : `${C.mustard}10`,
              border:`1px solid ${c1.viavel ? C.emerald : C.mustard}30`, fontSize:10.5 }}>
              {c1.viavel && c1.roi >= 25
                ? <span style={{color:C.emerald}}>✅ <strong>Recomendação:</strong> Lance no 1º leilão — ROI {pct(c1.roi)} já é atrativo. Aguardar 2º melhora +{pct(c2e.roi - c1.roi)} mas há risco de concorrência.</span>
                : <span style={{color:C.mustard}}>⏳ <strong>Recomendação:</strong> Aguardar 2º leilão. Lance atual (R$ {lancePrin.toLocaleString('pt-BR')}) dá ROI {pct(c1.roi)} — muito abaixo dos {pct(c2e.roi)} no cenário esperado do 2º (R$ {lance2e.toLocaleString('pt-BR')}). Economiza R$ {(lancePrin - lance2e).toLocaleString('pt-BR')} no lance.</span>
              }
            </div>
          )}
          {isSegundoLeilao && c1.viavel && c2e.roi > c1.roi && (
            <div style={{ padding: '8px 12px', borderRadius: 7, background: `${C.mustard}10`,
              border: `1px solid ${C.mustard}30`, marginTop: 4, fontSize: 10.5, color: C.muted }}>
              💡 Aguardar maior valorização pode melhorar ROI em <strong style={{ color: C.mustard }}>
                +{pct(c2e.roi - c1.roi)}</strong>, mas há risco de concorrência no leilão.
            </div>
          )}
        </>
      )}

      {/* Renda de locação */}
      {aluguel > 0 && (
        <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 7,
          background: '#F5F3FF', border: '1px solid #DDD6FE' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#7C3AED', marginBottom: 6 }}>
            📊 Estratégia de Locação
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              ['Aluguel est.', `R$ ${Math.round(aluguel).toLocaleString('pt-BR')}/mês`],
              ['Yield bruto', rendaYield ? `${rendaYield}% a.a.` : '—'],
              ['MAO locação', fmt(aluguel * 120 * 0.90)],
            ].map(([lbl, val]) => (
              <div key={lbl}>
                <div style={{ fontSize: 9, color: '#7C3AED', marginBottom: 1 }}>{lbl}</div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#5B21B6' }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Nota de custos */}
      <div style={{ marginTop: 10, fontSize: 9.5, color: C.hint, lineHeight: 1.5 }}>
        Premissas: comissão 5% · ITBI 3% · doc 2,5% · honorário adv 5% · registro R$0 · IRPF 15% (isenção ≤ R$440k) · corretagem venda 6%
      </div>
    </div>
  )
}
