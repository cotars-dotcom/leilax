import { useState, useEffect, useCallback } from 'react'
import { rodarHealthCheck, statusCascataAtual, descreverStatus } from '../lib/agenteHealthCheck.js'

/**
 * Badge compacto que mostra o status da cascata de IA.
 *
 * Comportamento:
 * - Ao montar, lê estado em cache (5min) do banco
 * - Se não há cache fresco, dispara ping em todos os provedores
 * - Atualiza a cada 5min se o componente continuar montado
 * - Click expande detalhes por provedor com latências
 *
 * Uso:
 *   <AgentHealthBadge compacto />          // só dot colorido
 *   <AgentHealthBadge />                    // dot + texto curto
 *   <AgentHealthBadge expansivel />         // dot + texto, click expande
 */
export default function AgentHealthBadge({ compacto = false, expansivel = true }) {
  const [status, setStatus] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [expandido, setExpandido] = useState(false)

  const atualizar = useCallback(async (forcar = false) => {
    setCarregando(true)
    try {
      let s = await statusCascataAtual()
      if (!s || forcar) {
        s = await rodarHealthCheck()
      }
      setStatus(s)
    } catch (e) {
      console.warn('[AXIS HealthBadge]', e.message)
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    // Primeiro carregamento: dispara ping completo se não há cache fresco
    atualizar()
    // Atualizações posteriores: só LÊ o cache do banco (não dispara pings).
    // Pings só acontecem novamente quando o usuário clicar "Testar agora" no popup.
    // Isso evita queimar quota da API Claude/OpenAI desnecessariamente.
    const intervalo = setInterval(async () => {
      try {
        const s = await statusCascataAtual()
        if (s) setStatus(s)
      } catch {}
    }, 60 * 1000)  // refresh visual a cada 1min — só leitura
    return () => clearInterval(intervalo)
  }, [atualizar])

  const desc = descreverStatus(status)

  if (compacto) {
    return (
      <div title={desc.texto + ' — ' + desc.detalhe}
        style={{
          width: 8, height: 8, borderRadius: '50%',
          background: desc.cor,
          animation: carregando ? 'pulse 1.5s infinite' : 'none',
          flexShrink: 0,
        }}
      />
    )
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => expansivel && setExpandido(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 14,
          background: `${desc.cor}10`, border: `1px solid ${desc.cor}30`,
          fontSize: 11, fontWeight: 600, color: desc.cor,
          cursor: expansivel ? 'pointer' : 'default',
        }}
      >
        <span style={{
          width: 7, height: 7, borderRadius: '50%', background: desc.cor,
          animation: carregando ? 'pulse 1.5s infinite' : 'none',
        }} />
        {desc.texto}
        {status?.cache && (
          <span style={{ fontSize: 9, opacity: 0.6 }}>
            · {status.cache_idade_s}s
          </span>
        )}
      </button>

      {expandido && status && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0,
          minWidth: 280, padding: 12, borderRadius: 8,
          background: '#fff', border: '1px solid #E2E8F0',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          zIndex: 100,
        }}>
          <div style={{ fontSize: 11, color: '#64748B', marginBottom: 8 }}>{desc.detalhe}</div>
          {['gemini', 'deepseek', 'gpt', 'claude'].map(prov => {
            const p = status.provedores[prov]
            if (!p) return null
            const cor = p.ok ? '#059669' : '#DC2626'
            return (
              <div key={prov} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '4px 0', borderBottom: '1px solid #F1F5F9', fontSize: 11,
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: cor }} />
                  <span style={{ fontWeight: 600, color: '#334155', textTransform: 'capitalize' }}>{prov}</span>
                </span>
                <span style={{ fontSize: 10, color: p.ok ? '#65a30d' : '#DC2626' }}>
                  {p.ok ? `${p.latencia_ms}ms` : (p.erro || 'fora')}
                </span>
              </div>
            )
          })}
          <button
            onClick={(e) => { e.stopPropagation(); atualizar(true) }}
            style={{
              marginTop: 8, width: '100%', padding: '6px 10px', borderRadius: 6,
              background: '#F8FAFC', border: '1px solid #E2E8F0',
              fontSize: 11, fontWeight: 600, color: '#334155', cursor: 'pointer',
            }}
          >
            ↻ Testar agora
          </button>
        </div>
      )}
    </div>
  )
}
