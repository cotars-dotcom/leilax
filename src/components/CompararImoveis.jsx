/**
 * AXIS — Comparador de Imóveis
 * 
 * Permite comparar dois imóveis da carteira lado a lado:
 * score, MAO, rendimento, reforma, timeline.
 */

import { C, K, fmtC, scoreColor } from '../appConstants.js'

const ROW_GROUPS = [
  {
    titulo: '📍 Localização',
    rows: [
      { label: 'Bairro / Cidade', fn: p => `${p.bairro || '—'}, ${p.cidade || '—'}` },
      { label: 'Tipologia', fn: p => (p.tipologia || p.tipo || '—').replace('_padrao','').replace(/_/g,' ') },
      { label: 'Área (m²)', fn: p => p.area_privativa_m2 || p.area_m2 || '—' },
      { label: 'Quartos/Suítes', fn: p => p.quartos ? `${p.quartos}q${p.suites ? ` / ${p.suites}s` : ''}` : '—' },
      { label: 'Vagas', fn: p => p.vagas ?? '—' },
    ]
  },
  {
    titulo: '💰 Financeiro',
    rows: [
      { label: 'Lance Mínimo', fn: p => fmtC(p.valor_minimo || p.preco_pedido), destaque: true },
      { label: 'Valor de Mercado', fn: p => fmtC(p.valor_mercado_estimado) },
      { label: 'MAO Flip (ROI 20%)', fn: p => fmtC(p.mao_flip), cor: p => p.mao_flip > 0 ? '#059669' : '#94A3B8' },
      { label: 'MAO Locação (yield 6%)', fn: p => fmtC(p.mao_locacao), cor: p => p.mao_locacao > 0 ? '#7C3AED' : '#94A3B8' },
      { label: 'Aluguel Est./mês', fn: p => fmtC(p.aluguel_mensal_estimado) },
      { label: 'Yield Bruto', fn: p => p.yield_bruto_pct ? `${p.yield_bruto_pct}% a.a.` : '—' },
      { label: 'Condo + IPTU/mês', fn: p => {
        const c = parseFloat(p.condominio_mensal || 0)
        const ip = parseFloat(p.iptu_mensal || 0) || Math.round(c * 0.35)
        return c + ip > 0 ? fmtC(c + ip) : '—'
      }},
    ]
  },
  {
    titulo: '⚖️ Jurídico',
    rows: [
      { label: 'Score Jurídico', fn: p => p.score_juridico != null ? `${p.score_juridico}/10` : '—', cor: p => scoreColor(p.score_juridico || 0) },
      { label: 'Débitos', fn: p => parseFloat(p.debitos_total_estimado || 0) > 0 ? fmtC(p.debitos_total_estimado) : '—' },
      { label: 'Resp. Débitos', fn: p => p.responsabilidade_debitos === 'sub_rogado' ? '✅ Sub-rogado' : p.responsabilidade_debitos === 'arrematante' ? '⚠️ Arrematante' : '—' },
      { label: 'Prazo Liberação', fn: p => p.prazo_liberacao_estimado_meses ? `${p.prazo_liberacao_estimado_meses} meses` : '—' },
      { label: 'Processo CNJ', fn: p => p.processo_numero || '—' },
    ]
  },
  {
    titulo: '📊 Score AXIS',
    rows: [
      { label: 'Score Total', fn: p => p.score_total ? `${Number(p.score_total).toFixed(1)}/10` : '—', destaque: true, cor: p => scoreColor(p.score_total || 0) },
      { label: 'Confiança', fn: p => p.confidence_score != null ? `${p.confidence_score}%` : '—', cor: p => (p.confidence_score || 0) >= 75 ? '#059669' : '#D97706' },
      { label: 'Recomendação', fn: p => p.recomendacao || '—', cor: p => p.recomendacao === 'COMPRAR' ? '#059669' : p.recomendacao === 'INVIAVEL' ? '#DC2626' : '#D97706' },
      { label: 'Desconto/Mercado', fn: p => {
        const l = parseFloat(p.valor_minimo || p.preco_pedido || 0)
        const m = parseFloat(p.valor_mercado_estimado || 0)
        return l > 0 && m > 0 ? `${((1 - l/m)*100).toFixed(1)}%` : '—'
      }, cor: p => {
        const l = parseFloat(p.valor_minimo || p.preco_pedido || 0)
        const m = parseFloat(p.valor_mercado_estimado || 0)
        const d = l > 0 && m > 0 ? (1 - l/m)*100 : 0
        return d >= 20 ? '#059669' : d >= 10 ? '#D97706' : '#DC2626'
      }},
    ]
  },
  {
    titulo: '🏗️ Reforma',
    rows: [
      { label: 'Custo Básica', fn: p => fmtC(p.custo_reforma_basica) },
      { label: 'Custo Média', fn: p => fmtC(p.custo_reforma_media) },
      { label: 'Custo Completa', fn: p => fmtC(p.custo_reforma_completa) },
    ]
  },
]

export default function CompararImoveis({ imoveis = [], onClose }) {
  if (imoveis.length < 2) return null
  const [a, b] = imoveis

  const melhor = (rowFn, corFn) => {
    if (!corFn) return [null, null]
    try {
      const va = parseFloat(String(rowFn(a)).replace(/[^0-9.-]/g, ''))
      const vb = parseFloat(String(rowFn(b)).replace(/[^0-9.-]/g, ''))
      if (isNaN(va) || isNaN(vb)) return [null, null]
      if (va > vb) return ['A', 'B']
      if (vb > va) return ['B', 'A']
      return ['AB', 'AB']
    } catch { return [null, null] }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '20px', overflowY: 'auto' }}>
      <div style={{ background: '#0F172A', borderRadius: 12, width: '100%', maxWidth: 780,
        border: '1px solid #1E293B', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 20px', borderBottom: '1px solid #1E293B' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#F1F5F9' }}>
            ⚖️ Comparativo de Imóveis
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none',
            color: '#64748B', fontSize: 20, cursor: 'pointer', padding: '0 4px' }}>✕</button>
        </div>

        {/* Nomes dos imóveis */}
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 1fr',
          borderBottom: '1px solid #1E293B' }}>
          <div style={{ padding: '12px 16px', fontSize: 11, color: '#475569' }}></div>
          {[a, b].map((p, i) => (
            <div key={i} style={{ padding: '12px 16px',
              borderLeft: '1px solid #1E293B',
              background: i === 0 ? '#0EA5E910' : '#7C3AED10' }}>
              <div style={{ fontSize: 10, fontWeight: 700, fontFamily: 'monospace',
                color: i === 0 ? '#0EA5E9' : '#A78BFA' }}>{p.codigo_axis || `Imóvel ${i+1}`}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#E2E8F0', marginTop: 2 }}>
                {p.bairro} · {p.area_privativa_m2 || p.area_m2 || '?'}m²
              </div>
            </div>
          ))}
        </div>

        {/* Grupos de rows */}
        {ROW_GROUPS.map(g => (
          <div key={g.titulo}>
            <div style={{ padding: '8px 16px', background: '#1E293B',
              fontSize: 10, fontWeight: 700, color: '#64748B',
              textTransform: 'uppercase', letterSpacing: '.5px' }}>
              {g.titulo}
            </div>
            {g.rows.map((row, ri) => {
              const [melhorA, melhorB] = row.cor ? melhor(row.fn, row.cor) : [null, null]
              return (
                <div key={ri} style={{ display: 'grid',
                  gridTemplateColumns: '200px 1fr 1fr',
                  borderBottom: '1px solid #0F172A' }}>
                  <div style={{ padding: '8px 16px', fontSize: 11, color: '#64748B',
                    background: '#0F172A' }}>{row.label}</div>
                  {[a, b].map((p, i) => {
                    const val = (() => { try { return row.fn(p) } catch { return '—' } })()
                    const cor = row.cor ? (() => { try { return row.cor(p) } catch { return '#94A3B8' } })() : '#E2E8F0'
                    const isMelhor = (i === 0 && melhorA === 'A') || (i === 1 && melhorB === 'B') || (melhorA === 'AB')
                    return (
                      <div key={i} style={{ padding: '8px 16px',
                        borderLeft: '1px solid #1E293B',
                        background: isMelhor ? (i === 0 ? '#0EA5E908' : '#7C3AED08') : 'transparent' }}>
                        <span style={{ fontSize: row.destaque ? 13 : 11,
                          fontWeight: row.destaque ? 700 : 500, color: cor }}>
                          {val}
                          {isMelhor && <span style={{ marginLeft: 4, fontSize: 9, opacity: 0.7 }}>✓</span>}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        ))}

        <div style={{ padding: '10px 16px', fontSize: 10, color: '#475569',
          borderTop: '1px solid #1E293B' }}>
          ✓ = melhor valor para esse critério. Dados do banco AXIS — última análise.
        </div>
      </div>
    </div>
  )
}
