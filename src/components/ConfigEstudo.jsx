/**
 * AXIS — Configuração do Estudo (Sprint 18)
 * 
 * Card global no topo: define o lance e cenário de reforma.
 * Todos os painéis abaixo (Investimento, Simulador, Rentabilidade, etc)
 * leem esses valores via useReforma() context.
 */
import { useState, useRef } from 'react'
import { C, card, fmtC } from '../appConstants.js'
import { useReforma } from '../hooks/useReforma.jsx'
import { isMercadoDireto } from '../lib/detectarFonte.js'
import { CUSTOS_LEILAO, CUSTOS_MERCADO, HOLDING_MESES_PADRAO, IPTU_SOBRE_CONDO_RATIO } from '../lib/constants.js'

/** Input com formatação de moeda brasileira */
function InputMoeda({ value, onChange, label, cor, small }) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw] = useState('')
  const ref = useRef(null)

  const handleFocus = () => {
    setEditing(true)
    setRaw(String(value || ''))
    setTimeout(() => ref.current?.select(), 10)
  }
  const handleBlur = () => {
    setEditing(false)
    const v = parseFloat(raw.replace(/[^\d.-]/g, ''))
    if (!isNaN(v) && v >= 0) onChange(Math.round(v))
  }
  const handleKey = (e) => { if (e.key === 'Enter') ref.current?.blur() }

  return (
    <div style={{ flex: small ? '0 0 auto' : 1, minWidth: small ? 100 : 140 }}>
      {label && <div style={{ fontSize: 9, color: cor || C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 3 }}>{label}</div>}
      <input
        ref={ref}
        type={editing ? 'number' : 'text'}
        value={editing ? raw : fmtC(value)}
        onChange={e => setRaw(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKey}
        style={{
          width: '100%', padding: '8px 12px', borderRadius: 8,
          border: `2px solid ${cor || C.emerald}30`,
          fontSize: 15, fontWeight: 800, color: cor || C.navy,
          background: `${cor || C.emerald}08`, outline: 'none',
          textAlign: 'right', boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

export default function ConfigEstudo({ imovel }) {
  const p = imovel
  const [roiAlvo, setRoiAlvo] = useState(20)
  if (!p) return null

  const {
    cenarioSimplificado, selecionarCenario, reformas,
    lanceEstudo, setLanceEstudo, custoReformaAtual,
  } = useReforma()

  const eMercado = isMercadoDireto(p.fonte_url, p.tipo_transacao)
  const avaliacao = parseFloat(p.valor_avaliacao) || parseFloat(p.valor_minimo) || 0
  const lance1p = parseFloat(p.valor_minimo || p.preco_pedido) || 0
  const lance2p = Math.round(avaliacao * 0.50)
  const mercado = parseFloat(p.valor_mercado_estimado) || 0

  // MAO — Máximo Aceitável Oferta para ROI alvo
  const tab = eMercado ? CUSTOS_MERCADO : CUSTOS_LEILAO
  const txProporcional = ((tab.comissao_leiloeiro_pct || 0) + (tab.itbi_pct || 0) + (tab.advogado_pct || 0) + (tab.documentacao_pct || 0)) / 100
  const condoMensal = parseFloat(p.condominio_mensal || 0)
  const iptuMensal = parseFloat(p.iptu_mensal || 0) || (condoMensal > 0 ? Math.round(condoMensal * IPTU_SOBRE_CONDO_RATIO) : 0)
  const holding = HOLDING_MESES_PADRAO * (condoMensal + iptuMensal)
  const debitosArr = p.responsabilidade_debitos === 'arrematante' ? parseFloat(p.debitos_total_estimado || 0) : 0
  const corretagem = mercado * 0.06
  // Custo alvo = mercado / (1 + roi/100) para atingir ROI desejado
  const custoAlvo = mercado > 0 ? mercado / (1 + roiAlvo / 100) : 0
  // MAO = (custoAlvo - reforma - holding - débitos - corretagem) / (1 + txProporcional)
  const mao = custoAlvo > 0
    ? Math.max(0, Math.round((custoAlvo - custoReformaAtual - holding - debitosArr - corretagem) / (1 + txProporcional)))
    : 0

  // Sugestão do sistema
  const sugestao = eMercado
    ? { texto: 'Preço pedido', lance: lance1p }
    : lance2p > 0
    ? { texto: '⏳ Aguardar 2ª praça', lance: lance2p, destaque: true }
    : { texto: '1ª Praça', lance: lance1p }

  const pctAvaliacao = avaliacao > 0 ? Math.round((lanceEstudo / avaliacao) * 100) : 0
  const acimaMAO = lanceEstudo > 0 && mao > 0 && lanceEstudo > mao

  const cenarios = [
    { id: 'sem_reforma', label: 'Sem Reforma', custo: 0, cor: '#64748B' },
    { id: 'basica', label: 'Básica', custo: reformas.basica, cor: '#3B8BD4' },
    { id: 'media', label: 'Média', custo: reformas.media, cor: '#D4A017' },
    { id: 'completa', label: 'Completa', custo: reformas.completa, cor: '#D05538' },
  ]

  return (
    <div style={{
      ...card(), padding: '14px 18px', marginBottom: 14,
      background: 'linear-gradient(135deg, #002B8008 0%, #05A86D08 100%)',
      border: `2px solid ${C.navy}15`,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.navy, letterSpacing: '-0.3px' }}>📐 Configuração do Estudo</div>
          <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>
            Defina lance e reforma — todos os painéis calculam com base nestes valores
          </div>
        </div>
        {sugestao.destaque && lanceEstudo !== sugestao.lance && (
          <button onClick={() => setLanceEstudo(sugestao.lance)} style={{
            padding: '5px 12px', borderRadius: 6, fontSize: 10, fontWeight: 700,
            border: '1px solid #7C3AED30', background: '#F5F3FF', color: '#7C3AED', cursor: 'pointer',
          }}>
            {sugestao.texto} ({fmtC(sugestao.lance)})
          </button>
        )}
      </div>

      {/* Lance + Reforma lado a lado */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {/* Lance input */}
        <InputMoeda label="Lance do Estudo" value={lanceEstudo} onChange={setLanceEstudo} cor="#D97706" />

        {/* MAO — Máximo Aceitável Oferta */}
        <div style={{ flex: '0 0 auto', minWidth: 140 }}>
          <div style={{ fontSize: 9, color: acimaMAO ? '#DC2626' : '#059669', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
            MAO p/ ROI
            <input
              type="number" min={5} max={50} step={5} value={roiAlvo}
              onChange={e => setRoiAlvo(Number(e.target.value) || 20)}
              style={{ width: 38, padding: '1px 4px', fontSize: 10, fontWeight: 700, color: '#059669', border: '1px solid #05966930', borderRadius: 3, textAlign: 'center' }}
            />%
          </div>
          <div
            onClick={() => mao > 0 && setLanceEstudo(mao)}
            title="Clique para aplicar o MAO como lance"
            style={{
              padding: '8px 12px', borderRadius: 8, cursor: mao > 0 ? 'pointer' : 'default',
              border: `2px solid ${acimaMAO ? '#DC2626' : '#059669'}30`,
              background: acimaMAO ? '#FEF2F2' : '#ECFDF5',
              fontSize: 15, fontWeight: 800, color: acimaMAO ? '#DC2626' : '#059669',
              textAlign: 'right',
            }}>
            {mao > 0 ? fmtC(mao) : '—'}
          </div>
          {acimaMAO && (
            <div style={{ fontSize: 9, color: '#DC2626', marginTop: 2, fontWeight: 600 }}>
              ⚠️ Lance excede MAO em {fmtC(lanceEstudo - mao)}
            </div>
          )}
        </div>

        {/* Reforma tabs */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 3 }}>Cenário de Reforma</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {cenarios.map(c => (
              <button key={c.id} onClick={() => selecionarCenario(c.id)} style={{
                flex: 1, padding: '8px 6px', borderRadius: 8, cursor: 'pointer',
                border: cenarioSimplificado === c.id ? `2px solid ${c.cor}` : '2px solid #E2E8F0',
                background: cenarioSimplificado === c.id ? `${c.cor}12` : '#fff',
                transition: 'all .15s',
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: cenarioSimplificado === c.id ? c.cor : '#64748B' }}>{c.label}</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: cenarioSimplificado === c.id ? c.cor : C.navy, marginTop: 2 }}>{fmtC(c.custo)}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Indicadores rápidos */}
      <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
        {/* Botões rápidos de lance */}
        {!eMercado && (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
            {[
              { label: '1ª Praça', val: lance1p },
              lance2p > 0 && { label: '2ª Praça', val: lance2p },
              { label: '60%', val: Math.round(avaliacao * 0.60) },
              { label: '70%', val: Math.round(avaliacao * 0.70) },
            ].filter(Boolean).map((b, i) => (
              <button key={i} onClick={() => setLanceEstudo(b.val)} style={{
                padding: '3px 8px', borderRadius: 5, fontSize: 9, fontWeight: 600,
                border: lanceEstudo === b.val ? '1px solid #059669' : '1px solid #E2E8F0',
                background: lanceEstudo === b.val ? '#ECFDF5' : '#fff',
                color: lanceEstudo === b.val ? '#065F46' : '#64748B', cursor: 'pointer',
              }}>{b.label} ({fmtC(b.val)})</button>
            ))}
          </div>
        )}

        {/* Info chips */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          {pctAvaliacao > 0 && (
            <span style={{ fontSize: 10, fontWeight: 700, color: '#64748B', background: '#F8FAFC', padding: '3px 8px', borderRadius: 5 }}>
              {pctAvaliacao}% da avaliação
            </span>
          )}
          <span style={{ fontSize: 10, fontWeight: 700, color: '#64748B', background: '#F8FAFC', padding: '3px 8px', borderRadius: 5 }}>
            Reforma: {fmtC(custoReformaAtual)}
          </span>
        </div>
      </div>
    </div>
  )
}

export { InputMoeda }
