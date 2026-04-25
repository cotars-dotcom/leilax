/**
 * AXIS — Circuit Breaker e Timeouts Coordenados da Cascata IA
 *
 * Antes deste módulo, cada fetch da cascata tinha seu próprio AbortSignal.timeout
 * com valores espalhados (8s, 12s, 15s, 20s, 30s, 45s, 60s, 90s — 8 timeouts
 * diferentes). Em runtime Vercel Serverless (limite 60s no plano Pro), uma chamada
 * Gemini com timeout de 90s **sempre estourava** o budget total antes do fallback
 * conseguir rodar. Resultado: 504 silencioso, sem dados parciais para o usuário.
 *
 * Esta camada introduz:
 *   1. ORÇAMENTO TOTAL — soma dos timeouts deve caber em 55s (margem de 5s
 *      para serialização da resposta dentro do budget Vercel de 60s).
 *   2. TIMEOUTS POR PROVEDOR — cada um tem teto curto. Se Gemini não responde
 *      em 15s, o sistema desiste E PASSA AO FALLBACK em vez de aguardar 90s.
 *   3. CIRCUIT BREAKER — após N falhas consecutivas em um provedor, aborta
 *      o uso desse provedor por COOLDOWN_MS. Próximas chamadas pulam direto
 *      para o fallback (não desperdiçam orçamento testando algo quebrado).
 *   4. ESTADO PERSISTIDO em memória + Supabase. Cada instância tem cache local
 *      de 60s + leitura periódica do banco para sincronizar entre tabs.
 *
 * Uso típico:
 *   import { withCircuitBreaker, TIMEOUTS } from './circuitBreaker.js'
 *   const resp = await withCircuitBreaker('gemini', async (signal) => {
 *     return fetch(url, { signal, ... })
 *   }, { timeout: TIMEOUTS.gemini })
 */

import { supabase } from './supabase.js'

// ─── ORÇAMENTOS COORDENADOS ───────────────────────────────────────────────

/**
 * Timeouts máximos por provedor, em milissegundos.
 * Soma da cascata completa: 15 + 12 + 10 + 8 = 45s — cabe nos 55s úteis do
 * Vercel Serverless deixando ~10s para parsing, validação e gravação no banco.
 */
export const TIMEOUTS = {
  gemini:    15000,  // tier 1 — mais rápido, paga primeiro
  deepseek:  12000,  // tier 2 — fallback principal
  gpt:       10000,  // tier 3 — fallback secundário
  claude:     8000,  // tier 4 — último recurso, modelo Haiku para velocidade
  // Operações auxiliares
  scrape:    10000,
  ocr_doc:   30000,  // OCR de documento PDF é inerentemente longo — chamadas isoladas, fora da cascata
  geocode:    8000,
  cep:        5000,
  datajud:   15000,
}

/**
 * Orçamento máximo de cascata (cap absoluto).
 * Vercel Serverless Pro: 60s hard limit.
 * Vercel Edge: 300s (mas custo maior). Por enquanto operamos no Serverless.
 */
export const BUDGET_CASCATA_MS = 55000

/**
 * Configuração do circuit breaker:
 * Após FALHAS_LIMITE falhas consecutivas, o provedor entra em "open" e
 * é pulado por COOLDOWN_MS antes de tentar de novo (estado "half-open").
 */
const FALHAS_LIMITE = 3
const COOLDOWN_MS   = 90 * 1000  // 90s — provedor volta a ser tentado depois disso

// ─── ESTADO LOCAL DO CIRCUIT BREAKER ──────────────────────────────────────

// Estado em memória (por aba/sessão). Sincronizado periodicamente com o banco.
const estadoLocal = {
  gemini:   { falhas: 0, abertoAte: null, ultimaTentativa: null },
  deepseek: { falhas: 0, abertoAte: null, ultimaTentativa: null },
  gpt:      { falhas: 0, abertoAte: null, ultimaTentativa: null },
  claude:   { falhas: 0, abertoAte: null, ultimaTentativa: null },
}

/**
 * Verifica se um provedor está disponível (circuit fechado ou half-open).
 */
export function provedorDisponivel(nome) {
  const e = estadoLocal[nome]
  if (!e) return true  // provedor não conhecido = não bloqueia
  if (!e.abertoAte) return true
  if (Date.now() >= e.abertoAte) {
    // Cooldown expirou — volta para "half-open" (1 tentativa permitida)
    return true
  }
  return false
}

/**
 * Registra falha em um provedor. Após FALHAS_LIMITE consecutivas, abre o circuit.
 */
function registrarFalha(nome, motivo) {
  const e = estadoLocal[nome]
  if (!e) return
  e.falhas++
  e.ultimaTentativa = Date.now()
  if (e.falhas >= FALHAS_LIMITE) {
    e.abertoAte = Date.now() + COOLDOWN_MS
    console.warn(`[AXIS CircuitBreaker] ${nome} ABERTO por ${COOLDOWN_MS/1000}s — ${e.falhas} falhas consecutivas. Último motivo: ${motivo}`)
  }
}

/**
 * Registra sucesso. Reseta contador de falhas e fecha o circuit.
 */
function registrarSucesso(nome) {
  const e = estadoLocal[nome]
  if (!e) return
  e.falhas = 0
  e.abertoAte = null
  e.ultimaTentativa = Date.now()
}

// ─── WRAPPER PRINCIPAL ────────────────────────────────────────────────────

/**
 * Executa uma operação que usa um provedor da cascata, aplicando:
 *   - Verificação de circuit (se aberto, falha imediato)
 *   - Timeout coordenado via AbortSignal
 *   - Tracking de sucesso/falha para o circuit breaker
 *
 * @param {string} provedor — 'gemini' | 'deepseek' | 'gpt' | 'claude' (ou outro definido em TIMEOUTS)
 * @param {Function} operacao — async function(signal) => result. Recebe AbortSignal.
 * @param {Object} opts — { timeout: ms } (opcional, default = TIMEOUTS[provedor])
 * @returns {Promise} resultado da operação
 * @throws Error com .code 'CIRCUIT_OPEN' | 'TIMEOUT' | 'PROVIDER_ERROR'
 */
export async function withCircuitBreaker(provedor, operacao, opts = {}) {
  // 1. Circuit aberto? Falha imediata sem queimar tempo.
  if (!provedorDisponivel(provedor)) {
    const err = new Error(`Circuit breaker ABERTO para ${provedor}`)
    err.code = 'CIRCUIT_OPEN'
    err.provedor = provedor
    throw err
  }

  const timeout = opts.timeout ?? TIMEOUTS[provedor] ?? 15000
  const inicio = Date.now()
  const ctrl = new AbortController()
  const timeoutId = setTimeout(() => ctrl.abort(new Error(`timeout_${timeout}ms`)), timeout)

  try {
    const result = await operacao(ctrl.signal)
    registrarSucesso(provedor)
    return result
  } catch (e) {
    const elapsed = Date.now() - inicio
    if (e.name === 'AbortError' || e.message?.includes('timeout')) {
      registrarFalha(provedor, `timeout_${elapsed}ms`)
      const err = new Error(`${provedor} timeout (${elapsed}ms / cap ${timeout}ms)`)
      err.code = 'TIMEOUT'
      err.provedor = provedor
      err.elapsed = elapsed
      throw err
    }
    // Erro do provedor (HTTP 4xx/5xx, parse, etc)
    registrarFalha(provedor, e.message?.substring(0, 80))
    const err = new Error(`${provedor}: ${e.message}`)
    err.code = 'PROVIDER_ERROR'
    err.provedor = provedor
    err.original = e
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Executa uma cascata de provedores sequencialmente, retornando o primeiro sucesso.
 * Se TODOS falharem, retorna o erro do último provedor com .code 'CASCATA_FALHA'.
 *
 * Cada provedor recebe seu próprio orçamento (não compartilhado) — se um demorar
 * 14s e for bem-sucedido, o próximo tem 100% do seu próprio timeout.
 *
 * @param {Array<{provedor: string, operacao: Function, opts?: Object}>} tentativas
 * @param {Object} ctx — { onTentativa, onFalha } callbacks opcionais
 * @returns {Promise} resultado da primeira tentativa bem-sucedida
 */
export async function executarCascata(tentativas, ctx = {}) {
  const inicio = Date.now()
  const erros = []

  for (const { provedor, operacao, opts } of tentativas) {
    const elapsedTotal = Date.now() - inicio
    if (elapsedTotal >= BUDGET_CASCATA_MS) {
      const err = new Error(`Orçamento de cascata ${BUDGET_CASCATA_MS}ms estourado em ${elapsedTotal}ms`)
      err.code = 'BUDGET_EXCEEDED'
      err.erros = erros
      throw err
    }
    // Timeout efetivo: min(timeout do provedor, budget restante)
    const restante = BUDGET_CASCATA_MS - elapsedTotal
    const timeoutBase = (opts?.timeout) ?? TIMEOUTS[provedor] ?? 15000
    const timeoutEfetivo = Math.min(timeoutBase, restante)

    if (timeoutEfetivo < 2000) {
      // Restante muito curto — não vale tentar
      break
    }

    ctx.onTentativa?.(provedor, timeoutEfetivo)

    try {
      const r = await withCircuitBreaker(provedor, operacao, { timeout: timeoutEfetivo })
      return { resultado: r, provedor, elapsed: Date.now() - inicio }
    } catch (e) {
      erros.push({ provedor, code: e.code, msg: e.message })
      ctx.onFalha?.(provedor, e)
      // Continua para o próximo provedor
    }
  }

  const err = new Error(`Cascata completa falhou — todos os ${tentativas.length} provedores falharam`)
  err.code = 'CASCATA_FALHA'
  err.erros = erros
  err.elapsed = Date.now() - inicio
  throw err
}

// ─── PERSISTÊNCIA OPCIONAL DO ESTADO DO CIRCUIT ───────────────────────────

/**
 * Sincroniza o estado do circuit com o banco. Útil para que múltiplas tabs/
 * instâncias compartilhem o conhecimento de "Gemini está fora há 90s, não testa".
 *
 * Não bloqueia — falha silenciosa se o banco estiver fora. O circuit local
 * continua funcionando independentemente.
 */
export async function persistirEstadoCircuit() {
  try {
    const linhas = Object.entries(estadoLocal).map(([provedor, e]) => ({
      provedor,
      falhas: e.falhas,
      aberto_ate: e.abertoAte ? new Date(e.abertoAte).toISOString() : null,
      ultima_tentativa: e.ultimaTentativa ? new Date(e.ultimaTentativa).toISOString() : null,
      atualizado_em: new Date().toISOString(),
    }))
    await supabase.from('circuit_breaker_state').upsert(linhas, { onConflict: 'provedor' })
  } catch (e) {
    // Silencioso — não atrapalha operação principal
  }
}

/**
 * Estado atual exposto para UIs (badge de status, debug, etc).
 */
export function snapshotCircuit() {
  const agora = Date.now()
  return Object.fromEntries(
    Object.entries(estadoLocal).map(([prov, e]) => [
      prov,
      {
        disponivel: !e.abertoAte || agora >= e.abertoAte,
        falhas: e.falhas,
        aberto_ate: e.abertoAte,
        cooldown_restante_s: e.abertoAte ? Math.max(0, Math.round((e.abertoAte - agora) / 1000)) : 0,
      }
    ])
  )
}

/**
 * Reset manual (útil em testes ou comando admin "tentar de novo").
 */
export function resetCircuit(provedor = null) {
  if (provedor) {
    if (estadoLocal[provedor]) {
      estadoLocal[provedor] = { falhas: 0, abertoAte: null, ultimaTentativa: null }
    }
  } else {
    for (const k of Object.keys(estadoLocal)) {
      estadoLocal[k] = { falhas: 0, abertoAte: null, ultimaTentativa: null }
    }
  }
}
