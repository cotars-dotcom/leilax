/**
 * AXIS — AI Proxy Client (Sprint 18)
 * 
 * Chama a Edge Function ai-proxy que mantém as API keys server-side.
 * Fluxo: Frontend (JWT) → Edge Function → carrega chave do app_settings → AI Provider
 * 
 * Benefícios:
 * - API keys NUNCA expostas no localStorage/browser
 * - Centraliza logging de uso
 * - Rate limiting server-side possível
 * 
 * Uso:
 *   import { aiProxy } from './aiProxy.js'
 *   const res = await aiProxy('gemini', { model: 'gemini-2.5-flash', contents: [...] })
 */

import { supabase } from './supabase.js'
import { MODELOS_GEMINI } from './constants.js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const AI_PROXY_URL = `${SUPABASE_URL}/functions/v1/ai-proxy`

/**
 * Chama a Edge Function ai-proxy.
 * @param {'gemini'|'deepseek'|'openai'|'claude'} provider
 * @param {object} payload — body da requisição (formato do provider)
 * @param {object} opts — { model, timeout }
 * @returns {Promise<object>} resposta JSON do provider
 */
export async function aiProxy(provider, payload, opts = {}) {
  const { timeout = 120000, model } = opts
  
  // Obter JWT do Supabase session
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('Sessão expirada — faça login novamente')
  }
  
  const res = await fetch(AI_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    },
    body: JSON.stringify({
      provider,
      model: model || undefined,
      payload,
    }),
    signal: AbortSignal.timeout(timeout),
  })
  
  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    // Parse erro da Edge Function
    try {
      const errJson = JSON.parse(errBody)
      throw new Error(`ai-proxy ${provider} ${res.status}: ${errJson.error || errBody.substring(0, 120)}`)
    } catch (parseErr) {
      if (parseErr.message.startsWith('ai-proxy')) throw parseErr
      throw new Error(`ai-proxy ${provider} ${res.status}: ${errBody.substring(0, 120)}`)
    }
  }
  
  return res.json()
}

/**
 * Chama Gemini via proxy. Drop-in replacement para fetch direto.
 * @param {string} prompt
 * @param {string} model — default gemini-2.5-flash
 * @param {object} opts — { temperature, maxOutputTokens, timeout }
 */
export async function geminiViaProxy(prompt, model = MODELOS_GEMINI[0], opts = {}) {
  const { temperature = 0.1, maxOutputTokens = 8192, timeout = 60000 } = opts
  const data = await aiProxy('gemini', {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature, maxOutputTokens }
  }, { model, timeout })
  
  const txt = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  if (!txt) throw new Error('Gemini via proxy: resposta vazia')
  return { texto: txt, modelo: model }
}

/**
 * Chama DeepSeek via proxy. Drop-in replacement.
 */
export async function deepseekViaProxy(messages, opts = {}) {
  const { model = 'deepseek-chat', maxTokens = 4096, temperature = 0.1, timeout = 90000 } = opts
  const data = await aiProxy('deepseek', {
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
  }, { timeout })
  
  return data.choices?.[0]?.message?.content || ''
}

/**
 * Chama Claude via proxy. Drop-in replacement.
 */
export async function claudeViaProxy(messages, opts = {}) {
  const { model = 'claude-sonnet-4-20250514', maxTokens = 4096, timeout = 120000 } = opts
  const data = await aiProxy('claude', {
    model,
    max_tokens: maxTokens,
    messages,
  }, { model, timeout })
  
  return data.content?.[0]?.text || ''
}

/**
 * Verifica se o proxy está configurado e funcional.
 * @returns {{ ok: boolean, provider: string, latency: number, error?: string }}
 */
export async function testarProxy(provider = 'gemini') {
  const t0 = Date.now()
  try {
    if (provider === 'gemini') {
      await geminiViaProxy('Respond with just "ok"', MODELOS_GEMINI[1], { maxOutputTokens: 5, timeout: 10000 })
    } else if (provider === 'deepseek') {
      await deepseekViaProxy([{ role: 'user', content: 'ok' }], { maxTokens: 3, timeout: 10000 })
    }
    return { ok: true, provider, latency: Date.now() - t0 }
  } catch (e) {
    return { ok: false, provider, latency: Date.now() - t0, error: e.message }
  }
}
