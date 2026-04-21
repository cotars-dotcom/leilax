/**
 * AXIS — DatajudCard
 * Card de processo com consulta ao CNJ em 1 clique.
 * Mostra classe, vara, movimentos relevantes e link para o processo.
 */

import { useState, useCallback } from 'react'
import { C, K } from '../appConstants.js'
import { consultarProcesso, normalizarNumeroCNJ } from '../lib/agenteDatajud.js'
import { salvarCamposImovel } from '../lib/supabase.js'

const fmtNum = num => num?.replace(/(\d{7})(\d{2})(\d{4})(\d{1})(\d{2})(\d{4})/, '$1-$2.$3.$4.$5.$6') || num

export default function DatajudCard({ imovel, onUpdate }) {
  const [estado, setEstado] = useState('idle') // idle | loading | ok | erro
  const [resultado, setResultado] = useState(null)
  const [msgCopia, setMsgCopia] = useState(false)

  const num = imovel?.processo_numero
  if (!num) return null

  const numFormatado = normalizarNumeroCNJ(num) || num

  const consultar = useCallback(async () => {
    setEstado('loading')
    try {
      const r = await consultarProcesso(numFormatado)
      setResultado(r)
      setEstado(r?.encontrado ? 'ok' : r?.erro ? 'erro' : 'nao_encontrado')

      // Persistir vara e classe se vieram do Datajud e imóvel não tiver
      if (r?.encontrado && onUpdate) {
        const updates = {}
        if (r.orgaoJulgador && !imovel.vara_judicial) updates.vara_judicial = r.orgaoJulgador
        if (r.classe && !imovel.tipo_justica) updates.tipo_justica = r.classe
        if (Object.keys(updates).length > 0) {
          await salvarCamposImovel(imovel.id, updates).catch(() => {})
          onUpdate()
        }
      }
    } catch (e) {
      setResultado({ erro: e.message })
      setEstado('erro')
    }
  }, [numFormatado, imovel, onUpdate])

  const copiar = () => {
    navigator.clipboard?.writeText(numFormatado)
    setMsgCopia(true)
    setTimeout(() => setMsgCopia(false), 1500)
  }

  // Cores por estado
  const borderCor = estado === 'ok' ? '#059669'
    : estado === 'erro' || estado === 'nao_encontrado' ? '#DC2626'
    : '#3B82F6'
  const bgCor = estado === 'ok' ? '#F0FDF4'
    : estado === 'erro' || estado === 'nao_encontrado' ? '#FEF2F2'
    : '#EFF6FF'

  return (
    <div style={{
      background: bgCor, border: `1.5px solid ${borderCor}30`,
      borderRadius: 8, padding: '10px 12px',
    }}>
      {/* Header: número + ações */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', marginBottom: 2 }}>
            ⚖️ Processo CNJ
          </div>
          <div style={{
            fontSize: 11, fontWeight: 700, color: '#0F172A',
            fontFamily: 'monospace', wordBreak: 'break-all', lineHeight: 1.4
          }}>
            {numFormatado}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginTop: 1 }}>
          <button onClick={copiar}
            style={{ fontSize: 9, padding: '3px 7px', borderRadius: 4, cursor: 'pointer',
              background: msgCopia ? '#05966920' : '#fff',
              border: `1px solid ${msgCopia ? '#059669' : '#CBD5E1'}`,
              color: msgCopia ? '#059669' : '#64748B', fontWeight: 600 }}>
            {msgCopia ? '✓ copiado' : '📋 copiar'}
          </button>
          <button onClick={consultar} disabled={estado === 'loading'}
            style={{ fontSize: 9, padding: '3px 7px', borderRadius: 4, cursor: estado === 'loading' ? 'wait' : 'pointer',
              background: estado === 'loading' ? '#E0E7FF' : '#3B82F6',
              border: '1px solid #3B82F6', color: '#fff', fontWeight: 700,
              opacity: estado === 'loading' ? 0.7 : 1 }}>
            {estado === 'loading' ? '⏳ consultando...' : '🔍 Datajud'}
          </button>
        </div>
      </div>

      {/* Resultado da consulta */}
      {estado === 'ok' && resultado?.encontrado && (
        <div style={{ marginTop: 8, borderTop: '1px solid #DCFCE7', paddingTop: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
            <div>
              <div style={{ fontSize: 8, color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Classe</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#065F46' }}>{resultado.classe}</div>
            </div>
            <div>
              <div style={{ fontSize: 8, color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Grau / Tribunal</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#065F46' }}>{resultado.grau} · {resultado.tribunal}</div>
            </div>
            <div>
              <div style={{ fontSize: 8, color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Vara / Órgão</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#0F172A', lineHeight: 1.3 }}>{resultado.orgaoJulgador}</div>
            </div>
            <div>
              <div style={{ fontSize: 8, color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Ajuizamento</div>
              <div style={{ fontSize: 10, color: '#475569' }}>{resultado.dataAjuizamento}</div>
            </div>
          </div>

          {resultado.assuntos && resultado.assuntos !== '—' && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 8, color: '#64748B', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Assunto</div>
              <div style={{ fontSize: 10, color: '#475569', lineHeight: 1.4 }}>{resultado.assuntos}</div>
            </div>
          )}

          {resultado.movimentosRelevantes?.length > 0 && (
            <div>
              <div style={{ fontSize: 8, color: '#64748B', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>
                📋 Movimentos relevantes
              </div>
              {resultado.movimentosRelevantes.map((m, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 6, alignItems: 'baseline',
                  padding: '3px 0', borderBottom: i < resultado.movimentosRelevantes.length - 1 ? '1px solid #DCFCE7' : 'none'
                }}>
                  <span style={{ fontSize: 9, color: '#94A3B8', flexShrink: 0, fontFamily: 'monospace' }}>{m.data}</span>
                  <span style={{ fontSize: 10, color: '#1E293B' }}>{m.nome}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 8, color: '#94A3B8' }}>
              Últ. atualização: {resultado.ultimaAtualizacao}
            </span>
            <a href={`https://www.cnj.jus.br/consulta-processo-e-informacoes-processuais/`}
              target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 9, color: '#3B82F6', textDecoration: 'none', fontWeight: 600 }}>
              Abrir no CNJ ↗
            </a>
          </div>
        </div>
      )}

      {estado === 'nao_encontrado' && (
        <div style={{ marginTop: 6, fontSize: 10, color: '#DC2626', display: 'flex', alignItems: 'center', gap: 4 }}>
          ⚠️ Processo não encontrado no Datajud. Verifique o número ou aguarde indexação.
        </div>
      )}

      {estado === 'erro' && (
        <div style={{ marginTop: 6, fontSize: 10, color: '#DC2626' }}>
          ❌ {resultado?.erro?.includes('expirada') ? '🔑 Chave Datajud expirada — renovar em wiki.cnj.jus.br' : `Erro: ${resultado?.erro}`}
        </div>
      )}

      {/* Dados já no banco (vara/classe) quando não foi consultado ainda */}
      {estado === 'idle' && (imovel.vara_judicial || imovel.tipo_justica) && (
        <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {imovel.vara_judicial && (
            <span style={{ fontSize: 9, color: '#475569', background: '#F1F5F9', padding: '2px 6px', borderRadius: 4 }}>
              🏛️ {imovel.vara_judicial}
            </span>
          )}
          {imovel.tipo_justica && (
            <span style={{ fontSize: 9, color: '#475569', background: '#F1F5F9', padding: '2px 6px', borderRadius: 4 }}>
              📂 {imovel.tipo_justica}
            </span>
          )}
          <span style={{ fontSize: 9, color: '#94A3B8', padding: '2px 0' }}>
            Clique em Datajud para atualizar
          </span>
        </div>
      )}
    </div>
  )
}
