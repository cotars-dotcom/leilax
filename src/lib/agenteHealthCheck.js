/**
 * AXIS — Agente de Health Check
 *
 * Testa cada provedor da cascata de IA antes do usuário disparar uma análise
 * pesada. Resultado é gravado em `agent_health` no Supabase para alimentar
 * o painel de status e bloquear análises se TODOS os provedores estiverem fora.
 *
 * Custos: cada ping consome ~5 tokens de output → R$0,001 por health check completo.
 * Cooldown: 5 minutos por provedor (evita testar a cada navegação).
 *
 * Uso:
 *   import { rodarHealthCheck, statusCascataAtual } from './agenteHealthCheck.js'
 *   const status = await statusCascataAtual()  // lê do banco (cache 5min)
 *   if (!status.algum_disponivel) alert('Cascata IA fora do ar — análises bloqueadas')
 */

import { supabase } from './supabase.js'
import { MODELOS_GEMINI } from './constants.js'

const COOLDOWN_MS = 5 * 60 * 1000  // 5 minutos

// ─── PINGS POR PROVEDOR ────────────────────────────────────────────────────

async function pingGemini(geminiKey) {
  if (!geminiKey) return { ok: false, latencia_ms: 0, erro: 'sem_chave' }
  const t0 = Date.now()
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODELOS_GEMINI[0]}:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'ping' }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 5 }
        }),
        signal: AbortSignal.timeout(8000)
      }
    )
    const latencia = Date.now() - t0
    if (!r.ok) {
      const body = await r.text().catch(() => '')
      return { ok: false, latencia_ms: latencia, erro: `HTTP_${r.status}`, detalhe: body.substring(0, 100) }
    }
    return { ok: true, latencia_ms: latencia, modelo: MODELOS_GEMINI[0] }
  } catch (e) {
    return { ok: false, latencia_ms: Date.now() - t0, erro: e.name === 'TimeoutError' ? 'timeout_8s' : e.message.substring(0, 80) }
  }
}

async function pingDeepSeek(deepseekKey) {
  if (!deepseekKey) return { ok: false, latencia_ms: 0, erro: 'sem_chave' }
  const t0 = Date.now()
  try {
    const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${deepseekKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5
      }),
      signal: AbortSignal.timeout(10000)
    })
    const latencia = Date.now() - t0
    if (!r.ok) {
      return { ok: false, latencia_ms: latencia, erro: `HTTP_${r.status}` }
    }
    return { ok: true, latencia_ms: latencia, modelo: 'deepseek-chat' }
  } catch (e) {
    return { ok: false, latencia_ms: Date.now() - t0, erro: e.name === 'TimeoutError' ? 'timeout_10s' : e.message.substring(0, 80) }
  }
}

async function pingGPT4oMini(openaiKey) {
  if (!openaiKey) return { ok: false, latencia_ms: 0, erro: 'sem_chave' }
  const t0 = Date.now()
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5
      }),
      signal: AbortSignal.timeout(10000)
    })
    const latencia = Date.now() - t0
    if (!r.ok) {
      return { ok: false, latencia_ms: latencia, erro: `HTTP_${r.status}` }
    }
    return { ok: true, latencia_ms: latencia, modelo: 'gpt-4o-mini' }
  } catch (e) {
    return { ok: false, latencia_ms: Date.now() - t0, erro: e.name === 'TimeoutError' ? 'timeout_10s' : e.message.substring(0, 80) }
  }
}

async function pingClaude(claudeKey) {
  if (!claudeKey) return { ok: false, latencia_ms: 0, erro: 'sem_chave' }
  const t0 = Date.now()
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': claudeKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 5,
        messages: [{ role: 'user', content: 'ping' }]
      }),
      signal: AbortSignal.timeout(10000)
    })
    const latencia = Date.now() - t0
    if (!r.ok) {
      return { ok: false, latencia_ms: latencia, erro: `HTTP_${r.status}` }
    }
    return { ok: true, latencia_ms: latencia, modelo: 'claude-haiku-4-5' }
  } catch (e) {
    return { ok: false, latencia_ms: Date.now() - t0, erro: e.name === 'TimeoutError' ? 'timeout_10s' : e.message.substring(0, 80) }
  }
}

// ─── FUNÇÃO PRINCIPAL: rodar health check completo ─────────────────────────

/**
 * Roda ping em cada provedor da cascata e grava resultado em `agent_health`.
 * @param {Object} keys — { geminiKey, deepseekKey, openaiKey, claudeKey }
 * @returns {Promise<Object>} resultado consolidado
 */
export async function rodarHealthCheck(keys = {}) {
  const inicio = new Date().toISOString()

  // Carregar chaves do servidor (RPC carregar_keys_seguro) se não passadas
  let serverKeys = null
  if (!keys.geminiKey || !keys.deepseekKey || !keys.openaiKey || !keys.claudeKey) {
    try {
      const { getApiKeys } = await import('./supabase.js')
      serverKeys = await getApiKeys()
    } catch(e) { console.warn('[AXIS healthCheck] getApiKeys:', e.message) }
  }
  const geminiKey   = keys.geminiKey   ?? serverKeys?.gemini   ?? null
  const deepseekKey = keys.deepseekKey ?? serverKeys?.deepseek ?? null
  const openaiKey   = keys.openaiKey   ?? serverKeys?.openai   ?? null
  const claudeKey   = keys.claudeKey   ?? serverKeys?.claude   ?? null

  // Disparar pings em paralelo (cada um para um servidor diferente — sem conflito de rate limit)
  // Pings são leves (5 tokens) e usam quotas distintas por provedor.
  const [resGemini, resDeepseek, resGPT, resClaude] = await Promise.all([
    pingGemini(geminiKey),
    pingDeepSeek(deepseekKey),
    pingGPT4oMini(openaiKey),
    pingClaude(claudeKey),
  ])

  const consolidado = {
    inicio,
    fim: new Date().toISOString(),
    provedores: {
      gemini:   resGemini,
      deepseek: resDeepseek,
      gpt:      resGPT,
      claude:   resClaude,
    },
    algum_disponivel: resGemini.ok || resDeepseek.ok || resGPT.ok || resClaude.ok,
    todos_disponivel: resGemini.ok && resDeepseek.ok && resGPT.ok && resClaude.ok,
    cascata_primaria_ok: resGemini.ok,  // Gemini é o tier 1 — se cair, custo sobe
  }

  // Gravar no banco (não bloqueia o retorno)
  try {
    const linhas = [
      { provedor: 'gemini',   ok: resGemini.ok,   latencia_ms: resGemini.latencia_ms,   erro: resGemini.erro || null,   modelo: resGemini.modelo || null,   testado_em: inicio },
      { provedor: 'deepseek', ok: resDeepseek.ok, latencia_ms: resDeepseek.latencia_ms, erro: resDeepseek.erro || null, modelo: resDeepseek.modelo || null, testado_em: inicio },
      { provedor: 'gpt',      ok: resGPT.ok,      latencia_ms: resGPT.latencia_ms,      erro: resGPT.erro || null,      modelo: resGPT.modelo || null,      testado_em: inicio },
      { provedor: 'claude',   ok: resClaude.ok,   latencia_ms: resClaude.latencia_ms,   erro: resClaude.erro || null,   modelo: resClaude.modelo || null,   testado_em: inicio },
    ]
    await supabase.from('agent_health').insert(linhas)
  } catch (e) {
    console.warn('[AXIS HealthCheck] gravar agent_health falhou:', e.message)
  }

  return consolidado
}

/**
 * Lê o status mais recente da cascata do banco. Se a leitura mais recente for
 * mais antiga que COOLDOWN_MS, retorna `null` (chamador deve rodar novo check).
 *
 * @returns {Promise<Object|null>} status consolidado ou null se cache expirado
 */
export async function statusCascataAtual() {
  try {
    const limite = new Date(Date.now() - COOLDOWN_MS).toISOString()
    const { data, error } = await supabase
      .from('agent_health')
      .select('*')
      .gte('testado_em', limite)
      .order('testado_em', { ascending: false })
      .limit(20)  // 4 provedores × até 5 batches recentes

    if (error || !data || data.length === 0) return null

    // Pegar o registro mais recente de cada provedor
    const porProvedor = {}
    for (const linha of data) {
      if (!porProvedor[linha.provedor]) porProvedor[linha.provedor] = linha
    }

    const gemini   = porProvedor.gemini
    const deepseek = porProvedor.deepseek
    const gpt      = porProvedor.gpt
    const claude   = porProvedor.claude

    if (!gemini && !deepseek && !gpt && !claude) return null

    return {
      cache: true,
      cache_idade_s: Math.round((Date.now() - new Date(data[0].testado_em).getTime()) / 1000),
      provedores: { gemini, deepseek, gpt, claude },
      algum_disponivel: !!(gemini?.ok || deepseek?.ok || gpt?.ok || claude?.ok),
      todos_disponivel: !!(gemini?.ok && deepseek?.ok && gpt?.ok && claude?.ok),
      cascata_primaria_ok: !!gemini?.ok,
    }
  } catch (e) {
    console.warn('[AXIS HealthCheck] statusCascataAtual:', e.message)
    return null
  }
}

/**
 * Garante que há um status fresco em cache. Se não houver, dispara novo check.
 * Use antes de iniciar análise pesada.
 */
export async function garantirStatusFresco() {
  const cache = await statusCascataAtual()
  if (cache) return cache
  return await rodarHealthCheck()
}

/**
 * Helper: retorna texto curto descrevendo o estado (para banners/UI).
 */
export function descreverStatus(status) {
  if (!status) return { cor: '#94A3B8', texto: 'Status desconhecido', detalhe: 'Não foi possível verificar' }
  if (status.todos_disponivel) {
    return { cor: '#059669', texto: 'Cascata IA operacional', detalhe: 'Todos os 4 provedores responderam' }
  }
  if (status.cascata_primaria_ok) {
    const fora = []
    if (!status.provedores.deepseek?.ok) fora.push('DeepSeek')
    if (!status.provedores.gpt?.ok)      fora.push('GPT-4o-mini')
    if (!status.provedores.claude?.ok)   fora.push('Claude')
    return { cor: '#D97706', texto: 'Operacional com degradação', detalhe: `Gemini OK · ${fora.join(', ')} fora — fallbacks limitados` }
  }
  if (status.algum_disponivel) {
    const ok = []
    if (status.provedores.deepseek?.ok) ok.push('DeepSeek')
    if (status.provedores.gpt?.ok)      ok.push('GPT')
    if (status.provedores.claude?.ok)   ok.push('Claude')
    return { cor: '#EA580C', texto: 'Cascata em fallback', detalhe: `Gemini fora · usando ${ok.join('/')} (custo maior)` }
  }
  return { cor: '#DC2626', texto: 'Cascata IA fora do ar', detalhe: 'Nenhum provedor respondeu — análises bloqueadas' }
}
