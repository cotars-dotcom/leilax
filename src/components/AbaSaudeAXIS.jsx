/**
 * AXIS — Aba de Saúde do Sistema
 * 
 * Consulta vw_saude_axis e exibe métricas de saúde do banco + alertas.
 * Acessível em Admin → 🩺 Saúde
 */
import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { saveImovelCompleto } from '../lib/supabase.js'
import { C, card } from '../appConstants.js'

const STATUS_COR = { ok: '#059669', aviso: '#D97706', erro: '#DC2626' }
const STATUS_ICO = { ok: '🟢', aviso: '🟡', erro: '🔴' }

export default function AbaSaudeAXIS({ isPhone = false, onNav = null }) {
  const [saude, setSaude] = useState(null)
  const [imoveis, setImoveis] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastCheck, setLastCheck] = useState(null)
  const [enrichProgress, setEnrichProgress] = useState(null)

  const [bloqueios, setBloqueios] = React.useState([])

  const verificar = async () => {
    setLoading(true)
    try {
      // 1. View de saúde (múltiplas linhas: metrica, valor, status)
      const { data: saudeData } = await supabase
        .from('vw_saude_axis')
        .select('metrica, valor, status')
        .order('metrica')
      setSaude(saudeData || [])

      // 2. Estado dos imóveis ativos
      const { data: imoveisData } = await supabase
        .from('imoveis')
        .select('codigo_axis, bairro, recomendacao, score_total, confidence_score, data_leilao, data_leilao_2, valor_minimo, valor_minimo_2, mao_flip, mao_locacao, status_operacional')
        .eq('status', 'analisado')
        .order('codigo_axis')
      setImoveis(imoveisData || [])
      // 3. Campos bloqueados por imóvel
      const { data: bloqData } = await supabase
        .from('vw_bloqueios_imovel')
        .select('codigo_axis, bairro, criado_em, descricao, campos_bloqueados')
        .order('criado_em', { ascending: false })
        .limit(20)
      setBloqueios(bloqData || [])

      setLastCheck(new Date())
    } catch (e) {
      console.warn('[AXIS Saúde]', e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { verificar() }, [])

  const handleBatchEnrich = async () => {
    if (!confirm(`Enriquecer ${imoveis.length} imóvel(is) com agentes F5? (mercado, lance máximo, aluguel, confidence)`)) return
    setEnrichProgress({ total: imoveis.length, atual: 0, log: [] })
    try {
      const { enriquecerImovel } = await import('../lib/agenteOrquestrador.js')
      const { data: { session } } = await supabase.auth.getSession()
      for (let i = 0; i < imoveis.length; i++) {
        const im = imoveis[i]
        setEnrichProgress(prev => ({ ...prev, atual: i + 1, codigo: im.codigo_axis }))
        try {
          const imFull = await supabase.from('imoveis').select('*').eq('id', im.id).single()
            .then(({ data }) => data)
          if (!imFull) continue
          const result = await enriquecerImovel(imFull, { forcarMercado: true, forcarReforma: true, forcarJuridico: false })
          if (Object.keys(result.updates).length > 0) {
            await saveImovelCompleto({ ...imFull, ...result.updates }, session?.user?.id)
          }
          setEnrichProgress(prev => ({
            ...prev,
            log: [...prev.log, `✅ ${im.codigo_axis}: ${result.log.filter(l => l.startsWith('✅')).length} campos atualizados`]
          }))
        } catch(e) {
          setEnrichProgress(prev => ({
            ...prev,
            log: [...prev.log, `⚠️ ${im.codigo_axis}: ${e.message}`]
          }))
        }
        await new Promise(r => setTimeout(r, 800)) // Nominatim rate-limit: 1 req/s
      }
      setEnrichProgress(prev => ({ ...prev, concluido: true }))
      await verificar() // Recarregar dados
    } catch(e) {
      setEnrichProgress(prev => ({ ...prev, erro: e.message }))
    }
  }

  const fmt = v => v ? `R$ ${Math.round(v).toLocaleString('pt-BR')}` : '—'
  const diasP = data => {
    if (!data) return null
    const d = new Date(data + 'T12:00')
    return Math.ceil((d - Date.now()) / 86400000)
  }

  return (
    <div style={{ padding: isPhone ? 12 : 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.navy }}>🩺 Saúde do Sistema AXIS</div>
          {lastCheck && <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
            Última verificação: {lastCheck.toLocaleTimeString('pt-BR')}
          </div>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={verificar} disabled={loading}
            style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid #E2E8F0',
              background: '#F8FAFC', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            {loading ? '⏳ Verificando...' : '🔄 Re-verificar'}
          </button>
          {imoveis.length > 0 && (
            <button onClick={handleBatchEnrich} disabled={!!enrichProgress && !enrichProgress.concluido}
              style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid #0EA5E930',
                background: '#0EA5E912', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: '#0EA5E9' }}>
              🚀 Enriquecer Carteira
            </button>
          )}
        </div>
      </div>

      {/* Métricas do banco */}
      {/* Batch enricher progress */}
      {enrichProgress && (
        <div style={{ ...card(), padding: 14, marginBottom: 14,
          background: enrichProgress.concluido ? '#ECFDF5' : '#F0F9FF',
          border: `1px solid ${enrichProgress.concluido ? '#6EE7B7' : '#BAE6FD'}` }}>
          <div style={{ fontSize: 12, fontWeight: 700,
            color: enrichProgress.concluido ? '#065F46' : '#0369A1', marginBottom: 8 }}>
            {enrichProgress.concluido
              ? `✅ Enriquecimento concluído — ${imoveis.length} imóvel(is)`
              : `🚀 Enriquecendo ${enrichProgress.atual}/${enrichProgress.total}: ${enrichProgress.codigo || '...'}`}
          </div>
          {enrichProgress.log.map((l, i) => (
            <div key={i} style={{ fontSize: 10,
              color: l.startsWith('✅') ? '#059669' : '#B45309', marginBottom: 2 }}>{l}</div>
          ))}
          {!enrichProgress.concluido && (
            <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: '#E0F2FE', overflow: 'hidden' }}>
              <div style={{ width: `${(enrichProgress.atual / enrichProgress.total) * 100}%`,
                height: '100%', background: '#0EA5E9', transition: 'width .3s' }}/>
            </div>
          )}
          {enrichProgress.concluido && (
            <button onClick={() => setEnrichProgress(null)}
              style={{ marginTop: 6, fontSize: 9, color: '#64748B',
                background: 'none', border: 'none', cursor: 'pointer' }}>
              fechar
            </button>
          )}
        </div>
      )}
      {saude && saude.length > 0 && (
        <div style={{ ...card(), padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 10 }}>📊 Banco de Dados</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8 }}>
            {(saude || []).map(row => {
              const isOk = (row.status || '').includes('🟢') || (row.status || '').includes('OK')
              const isErr = (row.status || '').includes('🔴') || (row.status || '').includes('erro')
              const cor = isOk ? '#059669' : isErr ? '#DC2626' : '#334155'
              return (
                <div key={row.metrica} style={{ padding: '7px 10px', borderRadius: 7, background: '#F8FAFC',
                  border: `1px solid ${cor}25`, borderLeft: `3px solid ${cor}` }}>
                  <div style={{ fontSize: 9, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>
                    {(row.metrica || '').replace(/_/g, ' ')}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: cor }}>{row.valor}</div>
                    {row.status && row.status !== '—' && <div style={{ fontSize: 10, color: cor }}>{row.status}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Carteira ativa */}
      {imoveis.length > 0 && (
        <div style={{ ...card(), padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 10 }}>🏠 Carteira Ativa</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: '#F1F5F9' }}>
                  {['Código', 'Bairro', 'Rec.', 'Score', 'Conf.', 'Lance', 'L.Máx Flip', 'L.Máx Loc.', 'Leilão', 'Status'].map(h => (
                    <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700,
                      color: '#64748B', fontSize: 10, borderBottom: '1px solid #E2E8F0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {imoveis.map(im => {
                  const dias1 = diasP(im.data_leilao)
                  const dias2 = diasP(im.data_leilao_2)
                  const urgente = (dias1 !== null && dias1 >= 0 && dias1 <= 15) ||
                                  (dias2 !== null && dias2 >= 0 && dias2 <= 15)
                  const recCor = im.recomendacao === 'AGUARDAR' ? '#D97706'
                    : im.recomendacao === 'INVIAVEL' ? '#DC2626'
                    : im.recomendacao === 'COMPRAR' ? '#059669' : '#64748B'
                  return (
                    <tr key={im.codigo_axis} style={{
                      borderBottom: '1px solid #F1F5F9',
                      background: urgente ? '#FFFBEB' : 'transparent'
                    }}>
                      <td style={{ padding: '5px 8px', fontWeight: 700, fontFamily: 'monospace', color: '#002B80' }}>
                        {onNav
                          ? <span onClick={() => onNav('detail', {id: im.id})}
                              style={{cursor:'pointer',textDecoration:'underline',textUnderlineOffset:2}}>
                              {im.codigo_axis}
                            </span>
                          : im.codigo_axis}
                      </td>
                      <td style={{ padding: '5px 8px', color: '#334155' }}>{im.bairro}</td>
                      <td style={{ padding: '5px 8px' }}>
                        <span style={{ fontWeight: 700, color: recCor, fontSize: 10 }}>{im.recomendacao}</span>
                      </td>
                      <td style={{ padding: '5px 8px', color: '#334155', fontWeight: 600 }}>
                        {im.score_total ? Math.round(im.score_total * 10) : '—'}
                      </td>
                      <td style={{ padding: '5px 8px' }}>
                        {im.confidence_score != null
                          ? <span style={{ color: im.confidence_score >= 75 ? '#059669' : im.confidence_score >= 50 ? '#D97706' : '#DC2626', fontWeight: 700 }}>
                              {im.confidence_score}%
                            </span>
                          : '—'}
                      </td>
                      <td style={{ padding: '5px 8px', color: '#92400E', fontWeight: 600 }}>{fmt(im.valor_minimo)}</td>
                      <td style={{ padding: '5px 8px', color: '#059669' }}>{fmt(im.mao_flip)}</td>
                      <td style={{ padding: '5px 8px', color: '#7C3AED' }}>{fmt(im.mao_locacao)}</td>
                      <td style={{ padding: '5px 8px' }}>
                        {dias1 !== null && dias1 >= 0
                          ? <span style={{ color: dias1 <= 7 ? '#DC2626' : '#D97706', fontWeight: 700 }}>
                              {dias1 === 0 ? 'Hoje!' : `${dias1}d`}{dias2 !== null && dias2 >= 0 ? ` · 2ª ${dias2}d` : ''}
                            </span>
                          : <span style={{ color: '#94A3B8' }}>—</span>}
                      </td>
                      <td style={{ padding: '5px 8px', color: '#64748B', fontSize: 10 }}>
                        {im.status_operacional || 'ativo'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Alertas críticos */}
      {(() => {
        const alertas = []
        imoveis.forEach(im => {
          const dias1 = diasP(im.data_leilao)
          const dias2 = diasP(im.data_leilao_2)
          if (dias1 !== null && dias1 >= 0 && dias1 <= 7)
            alertas.push({ tipo: 'urgente', msg: `⏰ ${im.codigo_axis}: 1ª praça em ${dias1 === 0 ? 'HOJE' : dias1 + ' dias'} — ${fmt(im.valor_minimo)}` })
          if (dias2 !== null && dias2 >= 0 && dias2 <= 7)
            alertas.push({ tipo: 'urgente', msg: `⏰ ${im.codigo_axis}: 2ª praça em ${dias2 === 0 ? 'HOJE' : dias2 + ' dias'} — ${fmt(im.valor_minimo_2)}` })
          if (im.mao_flip && im.valor_minimo && im.valor_minimo > im.mao_flip)
            alertas.push({ tipo: 'aviso', msg: `⚠️ ${im.codigo_axis}: lance (${fmt(im.valor_minimo)}) acima do limite p/ flip (${fmt(im.mao_flip)})` })
        })
        if (!alertas.length) return null
        return (
          <div style={{ ...card(), padding: 14, border: '1px solid #FED7AA', background: '#FFF7ED' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#9A3412', marginBottom: 8 }}>🚨 Alertas</div>
            {alertas.map((a, i) => (
              <div key={i} style={{ fontSize: 11, color: a.tipo === 'urgente' ? '#DC2626' : '#92400E',
                marginBottom: 4, padding: '4px 8px', background: '#FEF2F2', borderRadius: 5 }}>
                {a.msg}
              </div>
            ))}
          </div>
        )
      })()}

      {/* Seção: campos protegidos por imóvel */}
      {bloqueios.length > 0 && (
        <div style={{ ...card(), padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 10 }}>
            🔒 Histórico de campos protegidos
            <span style={{ fontSize: 10, fontWeight: 400, color: '#64748B', marginLeft: 8 }}>
              Trigger impede sobrescrita de dados validados manualmente
            </span>
          </div>
          {bloqueios.slice(0, 8).map((b, i) => (
            <div key={i} style={{ fontSize: 11, padding: '6px 10px', marginBottom: 4,
              background: '#F8FAFC', borderRadius: 6, border: '1px solid #E2E8F0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div>
                <span style={{ fontWeight: 700, color: '#0F172A', fontFamily: 'monospace', fontSize: 10 }}>
                  {b.codigo_axis}
                </span>
                <span style={{ color: '#475569', marginLeft: 8 }}>{b.descricao}</span>
              </div>
              <span style={{ fontSize: 10, color: '#94A3B8', flexShrink: 0 }}>
                {new Date(b.criado_em).toLocaleDateString('pt-BR')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
