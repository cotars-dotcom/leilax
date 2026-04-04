/**
 * AXIS — Painel de Custos Reais (editável)
 * Permite o usuário substituir estimativas da IA por valores confirmados.
 * Quando valores reais são preenchidos, os painéis de rentabilidade recalculam.
 */
import { useState, useEffect } from 'react'
import { C, K, card, btn, inp } from '../appConstants.js'
import { CUSTOS_LEILAO } from '../lib/constants.js'

const fmt = v => v ? `R$ ${Math.round(v).toLocaleString('pt-BR')}` : '—'

const CAMPOS = [
  { key: 'debitos_condominio_real',  label: 'Déb. condomínio',   estimadoKey: 'debitos_condominio',   icon: '🏢' },
  { key: 'debitos_iptu_real',        label: 'Déb. IPTU',         estimadoKey: 'debitos_iptu',         icon: '🏛️' },
  { key: 'custo_reforma_real',       label: 'Custo reforma',     estimadoKey: 'custo_reforma',        icon: '🔧' },
  { key: 'custo_juridico_real',      label: 'Custo jurídico',    estimadoKey: 'custo_juridico_estimado', icon: '⚖️' },
  { key: 'custo_ocupacao_real',      label: 'Custo desocupação', estimadoKey: null,                   icon: '🏠' },
  { key: 'custo_regularizacao_real', label: 'Regularização',     estimadoKey: 'custo_regularizacao',  icon: '📋' },
]

function parseValor(str) {
  if (!str) return null
  // Aceita "30000", "30.000", "30000,00", "R$ 30.000,00"
  const clean = String(str).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')
  const v = parseFloat(clean)
  return isNaN(v) ? null : v
}

export default function CustosReaisEditor({ imovel, onUpdateProp, isAdmin }) {
  const [editando, setEditando] = useState(false)
  const [valores, setValores] = useState({})
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState('')

  // Carregar valores reais existentes
  useEffect(() => {
    const init = {}
    CAMPOS.forEach(c => {
      const val = imovel[c.key]
      if (val != null && val !== '' && val !== 0) init[c.key] = String(val)
    })
    setValores(init)
  }, [imovel?.id])

  const temAlgumReal = CAMPOS.some(c => {
    const v = parseValor(imovel[c.key])
    return v != null && v > 0
  })

  const salvar = async () => {
    setSalvando(true)
    setMsg('')
    try {
      const updates = {}
      CAMPOS.forEach(c => {
        const v = parseValor(valores[c.key])
        if (v != null) updates[c.key] = v
        else if (valores[c.key] === '' || valores[c.key] === '0') updates[c.key] = null
      })
      // Recalcular custo total com valores reais
      const lance = parseFloat(imovel.preco_pedido || imovel.valor_minimo) || 0
      const comissao = lance * ((imovel.comissao_leiloeiro_pct || CUSTOS_LEILAO.comissao_leiloeiro * 100) / 100)
      const itbi = lance * ((imovel.itbi_pct || CUSTOS_LEILAO.itbi * 100) / 100)
      const reformaReal = updates.custo_reforma_real || parseFloat(imovel.custo_reforma) || 0
      const juridicoReal = updates.custo_juridico_real || parseFloat(imovel.custo_juridico_estimado) || 0
      const regReal = updates.custo_regularizacao_real || parseFloat(imovel.custo_regularizacao) || 0
      const ocupacaoReal = updates.custo_ocupacao_real || 0
      const debitoCond = updates.debitos_condominio_real || 0
      const debitoIPTU = updates.debitos_iptu_real || 0
      const custoTotalReal = lance + comissao + itbi + reformaReal + juridicoReal + regReal + ocupacaoReal + debitoCond + debitoIPTU + CUSTOS_LEILAO.registro
      updates.custo_total_real = Math.round(custoTotalReal)
      updates.custos_confirmados = true

      // Persistir no Supabase
      try {
        const { supabase } = await import('../lib/supabase.js')
        await supabase.from('imoveis').update(updates).eq('id', imovel.id)
      } catch(e) { console.warn('[AXIS] Save custos reais:', e.message) }

      if (onUpdateProp) onUpdateProp(imovel.id, updates)
      setMsg('✅ Custos reais salvos')
      setEditando(false)
    } catch(e) {
      setMsg(`⚠️ Erro: ${e.message}`)
    }
    setSalvando(false)
    setTimeout(() => setMsg(''), 3000)
  }

  // Cálculo do total real (ao vivo enquanto edita)
  const totalReal = CAMPOS.reduce((sum, c) => {
    const v = parseValor(valores[c.key])
    return sum + (v || 0)
  }, 0)

  return (
    <div style={{ ...card(), marginBottom: 14, border: temAlgumReal ? `1px solid ${C.emerald}40` : undefined }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 600, color: C.navy, fontSize: 13 }}>
            💰 Custos Reais
          </div>
          <div style={{ fontSize: 10, color: C.hint, marginTop: 2 }}>
            {temAlgumReal
              ? '✅ Valores confirmados — usados nos cálculos'
              : '⚠️ Usando estimativas da IA — insira valores reais'}
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => setEditando(!editando)}
            style={{
              ...btn('s'), fontSize: 11, padding: '5px 12px',
              background: editando ? `${C.emerald}15` : undefined,
              color: editando ? C.emerald : C.muted,
              border: `1px solid ${editando ? C.emerald : C.borderW}`,
            }}
          >
            {editando ? '✕ Cancelar' : '✏️ Editar'}
          </button>
        )}
      </div>

      {/* Grid de custos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
        {CAMPOS.map(campo => {
          const valorReal = parseValor(imovel[campo.key])
          const estimadoRaw = campo.estimadoKey ? imovel[campo.estimadoKey] : null
          // Tenta parsear estimado como número ou extrair de string "R$ 30.000"
          const estimado = typeof estimadoRaw === 'number' ? estimadoRaw
            : parseValor(estimadoRaw)
          const temReal = valorReal != null && valorReal > 0

          return (
            <div key={campo.key} style={{
              padding: '8px 10px', borderRadius: 8,
              background: temReal ? `${C.emerald}08` : C.surface,
              border: `1px solid ${temReal ? `${C.emerald}30` : C.borderW}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: C.hint }}>{campo.icon} {campo.label}</span>
                {temReal
                  ? <span style={{ fontSize: 8, fontWeight: 700, color: C.emerald, background: `${C.emerald}15`, padding: '1px 5px', borderRadius: 3 }}>REAL</span>
                  : estimado
                    ? <span style={{ fontSize: 8, fontWeight: 700, color: C.mustard, background: `${C.mustard}15`, padding: '1px 5px', borderRadius: 3 }}>ESTIMADO</span>
                    : <span style={{ fontSize: 8, color: C.hint }}>—</span>
                }
              </div>

              {editando ? (
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder={estimado ? `Est: ${fmt(estimado)}` : 'R$ 0'}
                  value={valores[campo.key] || ''}
                  onChange={e => setValores({ ...valores, [campo.key]: e.target.value })}
                  style={{
                    width: '100%', padding: '6px 8px', borderRadius: 6,
                    border: `1px solid ${C.borderW}`, fontSize: 13,
                    fontWeight: 600, color: C.navy, background: '#fff',
                    outline: 'none',
                  }}
                />
              ) : (
                <div style={{ fontSize: 13, fontWeight: 700, color: temReal ? C.emerald : C.muted }}>
                  {temReal ? fmt(valorReal) : (estimado ? fmt(estimado) : '—')}
                </div>
              )}

              {/* Mostrar diferença estimado vs real */}
              {temReal && estimado && estimado > 0 && (
                <div style={{ fontSize: 9, color: valorReal > estimado ? '#A32D2D' : C.emerald, marginTop: 2 }}>
                  {valorReal > estimado
                    ? `+${fmt(valorReal - estimado)} vs estimado`
                    : valorReal < estimado
                      ? `-${fmt(estimado - valorReal)} vs estimado`
                      : '= estimado'}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Total real */}
      {editando && totalReal > 0 && (
        <div style={{
          marginTop: 10, padding: '8px 12px', borderRadius: 8,
          background: C.surface, display: 'flex', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 11, color: C.muted }}>Total custos adicionais</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>{fmt(totalReal)}</span>
        </div>
      )}

      {/* Botão salvar */}
      {editando && (
        <button
          onClick={salvar}
          disabled={salvando}
          style={{
            marginTop: 10, width: '100%', padding: '10px 0',
            borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600,
            background: C.emerald, color: '#fff', cursor: salvando ? 'wait' : 'pointer',
          }}
        >
          {salvando ? '⏳ Salvando...' : '💾 Salvar custos reais'}
        </button>
      )}

      {msg && (
        <div style={{
          marginTop: 8, padding: '6px 10px', borderRadius: 6,
          fontSize: 11.5, fontWeight: 500, textAlign: 'center',
          background: msg.includes('✅') ? `${C.emerald}15` : '#FEF2F2',
          color: msg.includes('✅') ? C.emerald : '#A32D2D',
        }}>
          {msg}
        </div>
      )}
    </div>
  )
}
