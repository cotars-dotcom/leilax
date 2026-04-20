/**
 * AXIS — Painel de Atividades do Imóvel
 * 
 * Histórico de análises, reanálises, enriquecimentos e ações do usuário.
 */

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { C, K } from '../appConstants.js'

const ICONE_ACAO = {
  analise:     { icon: '🔍', cor: '#3B82F6', label: 'Análise IA' },
  reanalise:   { icon: '🔄', cor: '#D97706', label: 'Reanálise' },
  enriquecimento: { icon: '🚀', cor: '#059669', label: 'Enriquecimento F5' },
  reanalise_docs: { icon: '📄', cor: '#7C3AED', label: 'Análise Docs' },
  update:      { icon: '✏️', cor: '#64748B', label: 'Atualização' },
  arquivado:   { icon: '📦', cor: '#94A3B8', label: 'Arquivado' },
  default:     { icon: '📌', cor: '#94A3B8', label: 'Ação' },
}

function fmtRelativo(dateStr) {
  if (!dateStr) return '—'
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'agora'
  if (diff < 3600) return `${Math.floor(diff/60)}min atrás`
  if (diff < 86400) return `${Math.floor(diff/3600)}h atrás`
  if (diff < 604800) return `${Math.floor(diff/86400)}d atrás`
  return new Date(dateStr).toLocaleDateString('pt-BR', { day:'2-digit', month:'short' })
}

export default function PainelAtividades({ imovelId }) {
  const [atividades, setAtividades] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandido, setExpandido] = useState(false)

  useEffect(() => {
    if (!imovelId) return
    supabase
      .from('atividades')
      .select('id, tipo, descricao, metadata, criado_em, user_id')
      .eq('imovel_id', imovelId)
      .order('criado_em', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setAtividades(data || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [imovelId])

  if (loading) return null
  if (!atividades.length) return (
    <div style={{ padding: '8px 12px', fontSize: 10, color: K.t3, fontStyle: 'italic' }}>
      Nenhuma atividade registrada ainda
    </div>
  )

  const visiveis = expandido ? atividades : atividades.slice(0, 4)

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {visiveis.map(a => {
          const cfg = ICONE_ACAO[a.tipo] || ICONE_ACAO.default
          const meta = a.metadata || {}
          const detalhe = meta.modelo ? `via ${meta.modelo}` :
            meta.campos_atualizados ? `${meta.campos_atualizados} campos` :
            a.descricao || ''
          return (
            <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '6px 8px', borderRadius: 7, background: K.s2 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                background: `${cfg.cor}15`, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 12 }}>
                {cfg.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: cfg.cor }}>
                  {cfg.label}
                </div>
                {detalhe && (
                  <div style={{ fontSize: 10, color: K.t3, marginTop: 1,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {detalhe}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 9, color: K.t3, flexShrink: 0, marginTop: 1 }}>
                {fmtRelativo(a.criado_em)}
              </div>
            </div>
          )
        })}
      </div>
      {atividades.length > 4 && (
        <button onClick={() => setExpandido(!expandido)}
          style={{ marginTop: 6, fontSize: 10, color: K.t3, background: 'none',
            border: 'none', cursor: 'pointer', padding: '2px 8px', borderRadius: 4,
            background: K.s2, width: '100%' }}>
          {expandido ? '▲ Menos' : `▼ Ver todas (${atividades.length})`}
        </button>
      )}
    </div>
  )
}
