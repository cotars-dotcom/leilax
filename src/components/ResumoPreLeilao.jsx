/**
 * AXIS — Resumo Pré-Leilão
 * Sprint 35: + painel de decisão de lance (lance_maximo_definido)
 */

import { useState } from 'react'
import { C, K, fmtC } from '../appConstants.js'
import { CUSTOS_LEILAO, HOLDING_MESES_PADRAO, IPTU_SOBRE_CONDO_RATIO } from '../lib/constants.js'
import { salvarCamposImovel } from '../lib/supabase.js'

const cor = n => n >= 20 ? '#059669' : n >= 10 ? '#D97706' : '#DC2626'
const fmt = v => v ? `R$ ${Math.round(v).toLocaleString('pt-BR')}` : '—'

function calcularROISimples(lance, p) {
  if (!lance || !p.valor_mercado_estimado) return null
  const mercado = parseFloat(p.valor_mercado_estimado)
  const pctCustos = (CUSTOS_LEILAO.comissao_leiloeiro_pct + CUSTOS_LEILAO.itbi_pct +
                     CUSTOS_LEILAO.advogado_pct + CUSTOS_LEILAO.documentacao_pct) / 100
  const condo = parseFloat(p.condominio_mensal || 0)
  const iptu = parseFloat(p.iptu_mensal || 0) || Math.round(condo * IPTU_SOBRE_CONDO_RATIO)
  const holding = HOLDING_MESES_PADRAO * (condo + iptu)
  const debitos = p.responsabilidade_debitos === 'arrematante' ? parseFloat(p.debitos_total_estimado || 0) : 0
  const reforma = parseFloat(p.custo_reforma_basica || 0)
  const invest = lance * (1 + pctCustos) + reforma + holding + debitos
  const lucroFlip = mercado * 0.94 - invest
  const roiFlip = invest > 0 ? (lucroFlip / invest) * 100 : 0
  const aluguel = parseFloat(p.aluguel_mensal_estimado || 0)
  const yieldLoc = aluguel > 0 && invest > 0 ? (aluguel * 12 / invest) * 100 : 0
  return {
    invest: Math.round(invest),
    lucroFlip: Math.round(lucroFlip),
    roiFlip: Math.round(roiFlip * 10) / 10,
    yieldLoc: Math.round(yieldLoc * 10) / 10,
  }
}

const ESTRATEGIAS = [
  { id: 'flip',    label: '🔄 Flip',    cor: '#059669' },
  { id: 'locacao', label: '🏠 Locação', cor: '#7C3AED' },
  { id: 'hibrido', label: '⚡ Híbrido', cor: '#0EA5E9' },
]

export default function ResumoPreLeilao({ imovel, onUpdate, onGerarSintese }) {
  const p = imovel
  const [editando, setEditando] = useState(false)
  const [lanceDraft, setLanceDraft] = useState('')
  const [estrategiaDraft, setEstrategiaDraft] = useState('flip')
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState(null)

  if (!p?.data_leilao && !p?.data_leilao_2) return null

  const hoje = Date.now()
  const dias1 = p.data_leilao ? Math.ceil((new Date(p.data_leilao + 'T12:00') - hoje) / 86400000) : null
  const dias2 = p.data_leilao_2 ? Math.ceil((new Date(p.data_leilao_2 + 'T12:00') - hoje) / 86400000) : null

  const temProximo = (dias1 !== null && dias1 >= 0 && dias1 <= 30) || (dias2 !== null && dias2 >= 0 && dias2 <= 30)
  if (!temProximo) return null

  const avaliacao = parseFloat(p.valor_avaliacao || p.valor_minimo) || 0
  const maoFlip = parseFloat(p.mao_flip) || 0
  const maoLoc = parseFloat(p.mao_locacao) || 0
  const urgente = (dias1 !== null && dias1 >= 0 && dias1 <= 7) || (dias2 !== null && dias2 >= 0 && dias2 <= 7)

  const cenarios = [
    { label: '50% (piso legal)', lance: Math.round(avaliacao * 0.50), prob: 15, cor: '#7C3AED' },
    { label: '57% (esperado)',   lance: Math.round(avaliacao * 0.57), prob: 55, cor: '#3B82F6' },
    { label: '65% (competitivo)',lance: Math.round(avaliacao * 0.65), prob: 30, cor: '#D97706' },
  ]

  // Lance definido atual
  const lanceDefinido = parseFloat(p.lance_maximo_definido || 0)
  const estrategiaDefinida = p.lance_maximo_estrategia || null
  const definidoEm = p.lance_maximo_definido_em ? new Date(p.lance_maximo_definido_em) : null

  async function salvarDecisao() {
    const val = parseFloat(lanceDraft.replace(/[^\d.,]/g, '').replace(',', '.'))
    if (!val || val <= 0) { setMsg({ tipo: 'erro', texto: 'Valor inválido.' }); return }
    setSalvando(true)
    try {
      await salvarCamposImovel(p.id, {
        lance_maximo_definido: val,
        lance_maximo_estrategia: estrategiaDraft,
        lance_maximo_definido_em: new Date().toISOString(),
      })
      setMsg({ tipo: 'ok', texto: '✅ Decisão registrada!' })
      setEditando(false)
      onUpdate?.()
    } catch (e) {
      setMsg({ tipo: 'erro', texto: 'Erro ao salvar.' })
    } finally {
      setSalvando(false)
      setTimeout(() => setMsg(null), 3000)
    }
  }

  async function limparDecisao() {
    if (!confirm('Remover a decisão de lance registrada?')) return
    setSalvando(true)
    try {
      await salvarCamposImovel(p.id, {
        lance_maximo_definido: null,
        lance_maximo_estrategia: null,
        lance_maximo_definido_em: null,
      })
      setMsg({ tipo: 'ok', texto: '🗑️ Decisão removida.' })
      onUpdate?.()
    } catch { setMsg({ tipo: 'erro', texto: 'Erro ao remover.' }) }
    finally {
      setSalvando(false)
      setTimeout(() => setMsg(null), 3000)
    }
  }

  const roiDecisao = lanceDefinido > 0 ? calcularROISimples(lanceDefinido, p) : null
  const estrategiaObj = ESTRATEGIAS.find(e => e.id === estrategiaDefinida)

  return (
    <div style={{ ...K, marginBottom: 14, borderRadius: 12, overflow: 'hidden',
      border: `2px solid ${urgente ? '#DC2626' : '#D97706'}`,
      background: urgente ? '#FEF2F210' : '#FFFBEB10' }}>

      {/* Header */}
      <div style={{ padding: '10px 16px',
        background: urgente
          ? 'linear-gradient(135deg,#DC2626,#991B1B)'
          : 'linear-gradient(135deg,#D97706,#92400E)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', letterSpacing: 0.3 }}>
            {urgente ? '🚨' : '⏳'} DECISÃO DE LANCE
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', marginTop: 1 }}>
            {dias1 !== null && dias1 >= 0 && (
              <span>1ª praça: {dias1 === 0 ? 'HOJE' : `em ${dias1}d`} ({fmt(p.valor_minimo)}) &nbsp;&nbsp;</span>
            )}
            {dias2 !== null && dias2 >= 0 && (
              <span>2ª praça: {dias2 === 0 ? 'HOJE' : `em ${dias2}d`} ({fmt(p.valor_minimo_2)})</span>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right', color: '#fff' }}>
          <div style={{ fontSize: 10, opacity: 0.8 }}>Mercado est.</div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{fmt(p.valor_mercado_estimado)}</div>
        </div>
      </div>

      {/* Lance máximo por estratégia */}
      <div style={{ padding: '6px 14px 4px 14px', background: '#0F172A', borderTop: '1px solid #1E293B' }}>
        <div style={{ fontSize: 9, color: '#64748B', lineHeight: 1.4 }}>
          Lance máximo que preserva a rentabilidade-alvo na estratégia. Acima dele, o retorno cai abaixo da meta.
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#1E293B' }}>
        {[
          { label: 'LANCE MÁX. PARA FLIP (ROI 20%)',     valor: maoFlip, cor: '#059669', icon: '🔄' },
          { label: 'LANCE MÁX. PARA LOCAÇÃO (yield 6%)', valor: maoLoc,  cor: '#7C3AED', icon: '🏠' },
        ].map(m => (
          <div key={m.label} style={{ padding: '10px 14px', background: '#0F172A' }}>
            <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
              {m.icon} {m.label}
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: m.valor > 0 ? m.cor : '#475569', marginTop: 2 }}>
              {m.valor > 0 ? fmt(m.valor) : '—'}
            </div>
            {p.valor_minimo_2 && m.valor > 0 && (
              <div style={{ fontSize: 9, marginTop: 2,
                color: parseFloat(p.valor_minimo_2) <= m.valor ? '#4ADE80' : '#F87171' }}>
                {parseFloat(p.valor_minimo_2) <= m.valor ? '✅ 2ª praça dentro do limite' : '⚠️ 2ª praça acima do limite'}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Cenários 2ª praça */}
      {dias2 !== null && dias2 >= 0 && avaliacao > 0 && (
        <div style={{ padding: '10px 14px', background: '#0F172A' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase',
            letterSpacing: '.5px', marginBottom: 8 }}>
            Cenários 2ª Praça ({new Date(p.data_leilao_2 + 'T12:00').toLocaleDateString('pt-BR')})
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {cenarios.map(c => {
              const r = calcularROISimples(c.lance, p)
              const dentroMAO = maoFlip > 0 && c.lance <= maoFlip
              return (
                <div key={c.label} style={{ flex: 1, padding: '8px 10px', borderRadius: 8,
                  background: dentroMAO ? `${c.cor}15` : '#1E293B',
                  border: `1px solid ${dentroMAO ? c.cor : '#334155'}` }}>
                  <div style={{ fontSize: 8, color: '#94A3B8', fontWeight: 600 }}>{c.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: c.cor, marginTop: 2 }}>
                    {fmt(c.lance)}
                  </div>
                  {r && (
                    <>
                      <div style={{ fontSize: 10, fontWeight: 700, marginTop: 2, color: cor(r.roiFlip) }}>
                        ROI flip {r.roiFlip > 0 ? '+' : ''}{r.roiFlip}%
                      </div>
                      {r.yieldLoc > 0 && (
                        <div style={{ fontSize: 9, color: '#7C3AED' }}>Yield {r.yieldLoc}% a.a.</div>
                      )}
                    </>
                  )}
                  <div style={{ fontSize: 8, color: '#475569', marginTop: 3 }}>Prob. {c.prob}%</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Débitos */}
      {parseFloat(p.debitos_total_estimado || 0) > 0 && (
        <div style={{ padding: '8px 14px', background: '#1E293B',
          borderTop: '1px solid #334155', fontSize: 10, color: '#FCA5A5' }}>
          ⚠️ Débitos a cargo do arrematante: <strong>{fmt(p.debitos_total_estimado)}</strong> — já incluídos no cálculo do MAO
        </div>
      )}

      {/* ════ PAINEL DE DECISÃO ════ */}
      <div style={{ padding: '12px 14px', background: '#0B1120', borderTop: '2px solid #1E293B' }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase',
          letterSpacing: '.6px', marginBottom: 8 }}>
          🎯 Minha Decisão de Lance
        </div>

        {/* Decisão já registrada */}
        {lanceDefinido > 0 && !editando && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 8, background: '#0F172A',
            border: `1px solid ${estrategiaObj?.cor || '#334155'}` }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                Lance máximo definido
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: estrategiaObj?.cor || '#4ADE80', marginTop: 2 }}>
                {fmt(lanceDefinido)}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
                {estrategiaObj && (
                  <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4,
                    background: `${estrategiaObj.cor}20`, color: estrategiaObj.cor, fontWeight: 700 }}>
                    {estrategiaObj.label}
                  </span>
                )}
                {roiDecisao && (
                  <span style={{ fontSize: 9, color: cor(roiDecisao.roiFlip), fontWeight: 700 }}>
                    ROI flip {roiDecisao.roiFlip > 0 ? '+' : ''}{roiDecisao.roiFlip}% · Yield {roiDecisao.yieldLoc}% a.a.
                  </span>
                )}
              </div>
              {definidoEm && (
                <div style={{ fontSize: 9, color: '#475569', marginTop: 4 }}>
                  Registrado em {definidoEm.toLocaleDateString('pt-BR')} às {definidoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button onClick={() => { setLanceDraft(lanceDefinido.toString()); setEstrategiaDraft(estrategiaDefinida || 'flip'); setEditando(true) }}
                style={{ fontSize: 9, padding: '4px 8px', borderRadius: 4, border: '1px solid #334155',
                  background: '#1E293B', color: '#94A3B8', cursor: 'pointer' }}>
                ✏️ Editar
              </button>
              <button onClick={limparDecisao} disabled={salvando}
                style={{ fontSize: 9, padding: '4px 8px', borderRadius: 4, border: '1px solid #991B1B',
                  background: '#1E293B', color: '#F87171', cursor: 'pointer' }}>
                🗑️ Limpar
              </button>
            </div>
          </div>
        )}

        {/* Formulário de entrada */}
        {(lanceDefinido === 0 || editando) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Estratégia */}
            <div style={{ display: 'flex', gap: 6 }}>
              {ESTRATEGIAS.map(e => (
                <button key={e.id} onClick={() => setEstrategiaDraft(e.id)}
                  style={{ flex: 1, padding: '6px 0', borderRadius: 6, cursor: 'pointer',
                    fontSize: 10, fontWeight: 700, transition: 'all .15s',
                    background: estrategiaDraft === e.id ? `${e.cor}25` : '#1E293B',
                    border: `1.5px solid ${estrategiaDraft === e.id ? e.cor : '#334155'}`,
                    color: estrategiaDraft === e.id ? e.cor : '#64748B' }}>
                  {e.label}
                </button>
              ))}
            </div>

            {/* Sugestão rápida baseada na estratégia */}
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { label: 'MAO Flip', valor: maoFlip, ativo: estrategiaDraft === 'flip' },
                { label: 'MAO Loc.',  valor: maoLoc,  ativo: estrategiaDraft === 'locacao' },
                { label: '2ª praça',  valor: parseFloat(p.valor_minimo_2 || 0), ativo: false },
              ].filter(s => s.valor > 0).map(s => (
                <button key={s.label} onClick={() => setLanceDraft(String(Math.round(s.valor)))}
                  style={{ fontSize: 9, padding: '4px 8px', borderRadius: 4, cursor: 'pointer',
                    background: s.ativo ? '#059669' + '20' : '#1E293B',
                    border: `1px solid ${s.ativo ? '#059669' : '#334155'}`,
                    color: s.ativo ? '#4ADE80' : '#94A3B8' }}>
                  {s.label}: {fmt(s.valor)}
                </button>
              ))}
            </div>

            {/* Input */}
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 11, color: '#64748B', fontWeight: 600 }}>R$</span>
                <input
                  type="text"
                  value={lanceDraft}
                  onChange={e => setLanceDraft(e.target.value)}
                  placeholder="168.000"
                  style={{ width: '100%', padding: '8px 10px 8px 28px', borderRadius: 6,
                    background: '#1E293B', border: '1.5px solid #334155', color: '#F1F5F9',
                    fontSize: 14, fontWeight: 700, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <button onClick={salvarDecisao} disabled={salvando}
                style={{ padding: '8px 16px', borderRadius: 6, background: '#059669',
                  border: 'none', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                  opacity: salvando ? 0.6 : 1 }}>
                {salvando ? '...' : '✓ Salvar'}
              </button>
              {editando && (
                <button onClick={() => setEditando(false)}
                  style={{ padding: '8px 12px', borderRadius: 6, background: '#1E293B',
                    border: '1px solid #334155', color: '#94A3B8', fontSize: 11, cursor: 'pointer' }}>
                  ✕
                </button>
              )}
            </div>

            {/* Preview do ROI */}
            {lanceDraft && parseFloat(lanceDraft.replace(',', '.')) > 0 && (() => {
              const lv = parseFloat(lanceDraft.replace(',', '.'))
              const r = calcularROISimples(lv, p)
              if (!r) return null
              const abaixoFlip = maoFlip > 0 && lv <= maoFlip
              const abaixoLoc  = maoLoc  > 0 && lv <= maoLoc
              return (
                <div style={{ padding: '6px 10px', borderRadius: 6, background: '#1E293B',
                  border: `1px solid ${abaixoFlip ? '#059669' : '#334155'}`, fontSize: 10 }}>
                  <span style={{ color: '#94A3B8' }}>Invest total: </span>
                  <strong style={{ color: '#F1F5F9' }}>{fmt(r.invest)}</strong>
                  <span style={{ marginLeft: 12, color: cor(r.roiFlip), fontWeight: 700 }}>
                    ROI flip {r.roiFlip > 0 ? '+' : ''}{r.roiFlip}%
                  </span>
                  {r.yieldLoc > 0 && (
                    <span style={{ marginLeft: 10, color: '#7C3AED', fontWeight: 700 }}>
                      Yield {r.yieldLoc}% a.a.
                    </span>
                  )}
                  <span style={{ marginLeft: 10, fontSize: 9,
                    color: abaixoFlip ? '#4ADE80' : abaixoLoc ? '#A78BFA' : '#F87171' }}>
                    {abaixoFlip ? '✅ dentro do MAO flip' : abaixoLoc ? '🟣 dentro do MAO locação' : '🔴 acima do MAO'}
                  </span>
                </div>
              )
            })()}
          </div>
        )}

        {/* Atalho rápido: regenerar síntese se ausente ou leilão iminente */}
        {onGerarSintese && (!imovel.sintese_executiva || urgente) && (
          <div style={{ paddingTop: 8, borderTop: '1px solid #1E293B', marginTop: 8 }}>
            <button onClick={onGerarSintese}
              style={{ width: '100%', padding: '6px 0', borderRadius: 6, cursor: 'pointer',
                background: '#0EA5E920', border: '1px solid #0EA5E9',
                color: '#38BDF8', fontSize: 10, fontWeight: 700 }}>
              ✨ {imovel.sintese_executiva ? 'Atualizar síntese executiva' : 'Gerar síntese executiva'} via IA
            </button>
          </div>
        )}

        {/* Mensagem de feedback */}
        {msg && (
          <div style={{ marginTop: 6, padding: '6px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700,
            background: msg.tipo === 'ok' ? '#05966920' : '#DC262620',
            color: msg.tipo === 'ok' ? '#4ADE80' : '#F87171',
            border: `1px solid ${msg.tipo === 'ok' ? '#059669' : '#DC2626'}` }}>
            {msg.texto}
          </div>
        )}
      </div>
    </div>
  )
}
