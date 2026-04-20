/**
 * AXIS — Próximos Leilões
 * 
 * View dedicada com countdown em tempo real para imóveis com leilão agendado.
 * Exibe 1ª e 2ª praças com semáforo de urgência.
 */

import { useState, useEffect } from 'react'
import { C, K, fmtC, btn, card, scoreColor } from '../appConstants.js'
import { isMercadoDireto } from '../lib/detectarFonte.js'

function useNow() {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000) // atualiza a cada minuto
    return () => clearInterval(t)
  }, [])
  return now
}

function calcDias(dateStr, now) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr + 'T12:00') - now) / 86400000)
}

function CountdownBadge({ dias, label, valor }) {
  if (dias === null || dias < 0) return null
  const cor = dias === 0 ? '#DC2626' : dias <= 7 ? '#DC2626' : dias <= 15 ? '#EA580C' : '#D97706'
  const bg = dias === 0 ? '#FEF2F2' : dias <= 7 ? '#FEF2F2' : dias <= 15 ? '#FFF7ED' : '#FFFBEB'
  return (
    <div style={{ background: bg, border: `2px solid ${cor}`, borderRadius: 10, padding: '10px 14px',
      textAlign: 'center', minWidth: 110 }}>
      <div style={{ fontSize: 9, color: cor, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '.5px', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: dias === 0 ? 18 : 28, fontWeight: 900, color: cor, lineHeight: 1 }}>
        {dias === 0 ? 'HOJE!' : dias === 1 ? 'AMANHÃ' : `${dias}d`}
      </div>
      {valor > 0 && (
        <div style={{ fontSize: 11, color: cor, marginTop: 4, fontWeight: 600 }}>
          {fmtC(valor)}
        </div>
      )}
    </div>
  )
}

export default function ProximosLeiloes({ imoveis, onNav }) {
  const now = useNow()

  // Filtrar apenas com leilão futuro (1ª ou 2ª praça)
  const comLeilao = imoveis
    .filter(p => !isMercadoDireto(p.fonte_url, p.tipo_transacao))
    .filter(p => {
      const d1 = calcDias(p.data_leilao, now)
      const d2 = calcDias(p.data_leilao_2, now)
      return (d1 !== null && d1 >= 0) || (d2 !== null && d2 >= 0)
    })
    .map(p => ({
      ...p,
      dias1: calcDias(p.data_leilao, now),
      dias2: calcDias(p.data_leilao_2, now),
      diasMinimo: Math.min(
        calcDias(p.data_leilao, now) ?? 9999,
        calcDias(p.data_leilao_2, now) ?? 9999
      ),
    }))
    .sort((a, b) => a.diasMinimo - b.diasMinimo)

  const rc = s => s === 'COMPRAR' ? '#059669' : s === 'AGUARDAR' ? '#D97706' : '#DC2626'

  return (
    <div style={{ padding: '16px 20px' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.navy }}>
          🔨 Próximos Leilões
        </h2>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
          {comLeilao.length === 0
            ? 'Nenhum leilão agendado'
            : `${comLeilao.length} leilão(ões) — atualiza a cada minuto`}
        </div>
      </div>

      {comLeilao.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: C.muted }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
          <div>Nenhum imóvel com leilão agendado</div>
          <div style={{ fontSize: 12, marginTop: 8 }}>
            Adicione datas de leilão nos imóveis para acompanhar aqui
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {comLeilao.map(p => {
          const urgente = p.diasMinimo <= 7
          const muitoUrgente = p.diasMinimo === 0 || p.diasMinimo === 1
          const maoOk2 = p.mao_flip && p.valor_minimo_2 &&
            parseFloat(p.valor_minimo_2) <= parseFloat(p.mao_flip)

          return (
            <div key={p.id} onClick={() => onNav?.('detail', { id: p.id })}
              style={{ ...card(), padding: 0, overflow: 'hidden', cursor: 'pointer',
                border: `2px solid ${urgente ? '#DC2626' : '#E2E8F0'}`,
                transition: 'box-shadow .15s',
                boxShadow: muitoUrgente ? '0 0 0 3px #DC262620' : 'none',
              }}>

              {/* Faixa topo urgente */}
              {urgente && (
                <div style={{ height: 4, background: muitoUrgente
                  ? 'linear-gradient(90deg,#DC2626,#991B1B)' : '#EA580C' }} />
              )}

              <div style={{ padding: '16px 20px' }}>
                {/* Header do card */}
                <div style={{ display: 'flex', justifyContent: 'space-between',
                  alignItems: 'flex-start', marginBottom: 14 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, fontFamily: 'monospace',
                        color: C.navy, background: '#EFF6FF', padding: '2px 8px', borderRadius: 4 }}>
                        {p.codigo_axis}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: rc(p.recomendacao),
                        background: `${rc(p.recomendacao)}12`, padding: '2px 8px', borderRadius: 4 }}>
                        {p.recomendacao || '—'}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>
                        Score: <span style={{ color: scoreColor(p.score_total) }}>
                          {Math.round((p.score_total || 0) * 10)}/100
                        </span>
                      </span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                      {p.bairro}, {p.cidade} · {p.area_privativa_m2 || p.area_m2 || '—'}m²
                      {p.quartos ? ` · ${p.quartos}q` : ''}
                    </div>
                    {p.titulo && p.titulo !== `Apartamento em ${p.cidade}` && (
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                        {p.titulo}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 20, color: '#64748B' }}>→</div>
                </div>

                {/* Countdowns */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                  {p.dias1 !== null && p.dias1 >= 0 && (
                    <CountdownBadge dias={p.dias1} label="1ª Praça" valor={p.valor_minimo} />
                  )}
                  {p.dias2 !== null && p.dias2 >= 0 && (
                    <CountdownBadge dias={p.dias2} label="2ª Praça" valor={p.valor_minimo_2} />
                  )}
                  {/* Avaliação */}
                  {p.valor_avaliacao && (
                    <div style={{ padding: '10px 14px', borderRadius: 10, textAlign: 'center',
                      background: '#F8FAFC', border: '1px solid #E2E8F0', minWidth: 110 }}>
                      <div style={{ fontSize: 9, color: '#94A3B8', fontWeight: 600,
                        textTransform: 'uppercase', marginBottom: 4 }}>Avaliação</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#64748B' }}>
                        {fmtC(p.valor_avaliacao)}
                      </div>
                    </div>
                  )}
                </div>

                {/* MAO + indicadores */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                  {parseFloat(p.mao_flip) > 0 && (
                    <div style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6,
                      background: '#ECFDF5', border: '1px solid #6EE7B7', color: '#065F46', fontWeight: 600 }}>
                      🔄 MAO flip: {fmtC(p.mao_flip)}
                    </div>
                  )}
                  {parseFloat(p.mao_locacao) > 0 && (
                    <div style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6,
                      background: '#F5F3FF', border: '1px solid #C4B5FD', color: '#5B21B6', fontWeight: 600 }}>
                      🏠 MAO loc: {fmtC(p.mao_locacao)}
                    </div>
                  )}
                  {p.dias2 !== null && p.dias2 >= 0 && (
                    <div style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6,
                      background: maoOk2 ? '#ECFDF5' : '#FEF2F2',
                      border: `1px solid ${maoOk2 ? '#6EE7B7' : '#FCA5A5'}`,
                      color: maoOk2 ? '#065F46' : '#991B1B', fontWeight: 600 }}>
                      {maoOk2 ? '✅ 2ª praça dentro do MAO' : '⚠️ 2ª praça acima do MAO'}
                    </div>
                  )}
                </div>

                {/* Síntese rápida */}
                {p.sintese_executiva && (
                  <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5,
                    borderTop: '1px solid #F1F5F9', paddingTop: 8, marginTop: 4 }}>
                    {p.sintese_executiva.slice(0, 180)}{p.sintese_executiva.length > 180 ? '…' : ''}
                  </div>
                )}
                {/* Ações rápidas */}
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}
                  onClick={e => e.stopPropagation()}>
                  <button onClick={() => onNav?.('detail', {id: p.id})}
                    style={{ fontSize: 10, padding: '4px 10px', borderRadius: 5, cursor: 'pointer',
                      background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8', fontWeight: 600 }}>
                    📊 Ver Análise Completa →
                  </button>
                  <button onClick={async () => {
                    const { gerarHTMLReport } = await import('./ExportarPDF.jsx').catch(() => ({gerarHTMLReport: null}))
                    if (gerarHTMLReport) gerarHTMLReport(p)
                    else onNav?.('detail', {id: p.id})
                  }}
                    style={{ fontSize: 10, padding: '4px 10px', borderRadius: 5, cursor: 'pointer',
                      background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontWeight: 600 }}>
                    📄 PDF Decisão
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
