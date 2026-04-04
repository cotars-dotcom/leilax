// ═══════════════════════════════════════════════════════════════════════════
// AXIS — Módulo Central de Constantes (src/lib/constants.js)
// Fonte única de verdade para custos, modelos IA, pesos de score e helpers.
// Todos os componentes e libs devem importar DAQUI — nunca hardcodar valores.
// ═══════════════════════════════════════════════════════════════════════════

// ─── PESOS DE SCORE ──────────────────────────────────────────────────────────
// Soma = 100%. Configurável via tabela parametros_score no banco.
export const SCORE_PESOS = {
  localizacao: 0.20,
  desconto:    0.18,
  juridico:    0.18,
  ocupacao:    0.15,
  liquidez:    0.15,
  mercado:     0.14,
}

// ─── CUSTOS DE TRANSAÇÃO — LEILÃO JUDICIAL ──────────────────────────────────
export const CUSTOS_LEILAO = {
  comissao_leiloeiro: 0.05,  // 5% — comissão do leiloeiro
  itbi:               0.03,  // 3% — ITBI BH (municipal); outros MG = 2%
  itbi_outros_mg:     0.02,  // 2% — ITBI demais municípios MG
  doc:                0.005, // 0.5% — escritura/documentação
  adv:                0.02,  // 2% — honorário advocatício
  registro:           1500,  // R$1.500 — cartório de registro (fixo)
  // Multiplicador total = comissao + itbi + doc + adv
  mult_total:         0.105, // 10.5% (excl. registro fixo)
}

// ─── CUSTOS DE TRANSAÇÃO — MERCADO DIRETO ────────────────────────────────────
export const CUSTOS_MERCADO = {
  comissao_leiloeiro: 0,     // sem comissão de leiloeiro
  itbi:               0.03,  // 3% — ITBI mercado direto
  doc:                0.005, // 0.5% — escritura/documentação
  adv:                0,     // sem honorário advocatício
  registro:           1500,  // R$1.500 — cartório de registro (fixo)
  mult_total:         0.035, // 3.5% (itbi + doc)
}

// Aliases mantidos para compatibilidade com appConstants.js
export const AXIS_CUSTOS = {
  comissao_leiloeiro: CUSTOS_LEILAO.comissao_leiloeiro,
  itbi_leilao:        CUSTOS_LEILAO.itbi,
  itbi_mercado:       CUSTOS_MERCADO.itbi,
  itbi_outros_mg:     CUSTOS_LEILAO.itbi_outros_mg,
  doc:                CUSTOS_LEILAO.doc,
  adv:                CUSTOS_LEILAO.adv,
  registro:           CUSTOS_LEILAO.registro,
  corretagem_venda:   0.06,  // 6%
  vacancia_anual:     0.06,  // 6% ao ano
  manutencao_anual:   0.005, // 0.5% a.a.
  irpf_pct:           0.15,  // 15% ganho de capital
  isencao_irpf:       440000,// R$440k teto isenção (único imóvel PF)
}

export const CUSTO_MULT_LEILAO  = CUSTOS_LEILAO.mult_total   // 0.105
export const CUSTO_MULT_MERCADO = CUSTOS_MERCADO.mult_total  // 0.035

// ─── MODELOS IA ──────────────────────────────────────────────────────────────
// Claude
export const CLAUDE_MODEL        = 'claude-sonnet-4-20250514'
export const CLAUDE_HAIKU        = 'claude-haiku-4-5-20251001'
export const ANTHROPIC_VERSION   = '2023-06-01'

// Gemini — cascata em ordem de preferência (mais novo → mais estável)
export const MODELOS_GEMINI = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-exp',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro',
]
export const GEMINI_DEFAULT      = MODELOS_GEMINI[0]       // gemini-2.0-flash
export const GEMINI_FALLBACK     = MODELOS_GEMINI[2]       // gemini-1.5-flash (para fotos/docs)

// GPT
export const GPT_MODEL_MARKET    = 'gpt-4o-mini'           // pesquisa de mercado
export const GPT_MODEL_COMPLEX   = 'gpt-4o'               // fallback

// ─── HELPER: calcularScoreTotal ─────────────────────────────────────────────
/**
 * Calcula score_total a partir das 6 dimensões + pesos do banco (ou fallback).
 * @param {object} analise — objeto com score_localizacao..score_mercado (0-10)
 * @param {Array}  parametros — tabela parametros_score do Supabase (opcional)
 * @returns {number} score_total (0-10, 2 casas decimais)
 */
export function calcularScoreTotal(analise, parametros = []) {
  const pesosBanco = {}
  for (const p of parametros) {
    if (p.dimensao && p.peso != null) pesosBanco[p.dimensao] = p.peso / 100
  }
  const p = {
    localizacao: pesosBanco.localizacao ?? SCORE_PESOS.localizacao,
    desconto:    pesosBanco.desconto    ?? SCORE_PESOS.desconto,
    juridico:    pesosBanco.juridico    ?? SCORE_PESOS.juridico,
    ocupacao:    pesosBanco.ocupacao    ?? SCORE_PESOS.ocupacao,
    liquidez:    pesosBanco.liquidez    ?? SCORE_PESOS.liquidez,
    mercado:     pesosBanco.mercado     ?? SCORE_PESOS.mercado,
  }
  const score =
    (analise.score_localizacao || 0) * p.localizacao +
    (analise.score_desconto    || 0) * p.desconto    +
    (analise.score_juridico    || 0) * p.juridico    +
    (analise.score_ocupacao    || 0) * p.ocupacao    +
    (analise.score_liquidez    || 0) * p.liquidez    +
    (analise.score_mercado     || 0) * p.mercado
  return parseFloat(score.toFixed(2))
}

// ─── HELPER: calcularCustosAquisicao ────────────────────────────────────────
/**
 * Calcula custos de aquisição para leilão ou mercado direto.
 * @param {number} precoBase — lance ou preço pedido
 * @param {boolean} eMercado — true para mercado direto, false para leilão
 * @param {object}  overrides — itbi_pct e comissao_leiloeiro_pct do banco
 * @returns {{ comissao, itbi, doc, adv, registro, total, custoTotalAquisicao }}
 */
export function calcularCustosAquisicao(precoBase, eMercado = false, overrides = {}) {
  const c = eMercado ? CUSTOS_MERCADO : CUSTOS_LEILAO
  const itbiPct = overrides.itbi_pct != null ? overrides.itbi_pct / 100 : c.itbi
  const comissaoPct = overrides.comissao_leiloeiro_pct != null
    ? overrides.comissao_leiloeiro_pct / 100 : c.comissao_leiloeiro
  const comissao = precoBase * comissaoPct
  const itbi     = precoBase * itbiPct
  const doc      = precoBase * c.doc
  const adv      = precoBase * c.adv
  const registro = c.registro
  const total    = comissao + itbi + doc + adv + registro
  return { comissao, itbi, doc, adv, registro, total, custoTotalAquisicao: precoBase + total }
}

// ─── HELPER: chamarGeminiCascata ────────────────────────────────────────────
/**
 * Chama a API Gemini com cascata de modelos.
 * @param {string} prompt
 * @param {string} geminiKey
 * @param {object} opts — { temperature=0.3, maxTokens=4096, signal }
 * @returns {{ texto, modeloUsado }}
 */
export async function chamarGeminiCascata(prompt, geminiKey, opts = {}) {
  const { temperature = 0.3, maxTokens = 4096, signal } = opts
  let lastErr = null
  for (const modelo of MODELOS_GEMINI) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature, maxOutputTokens: maxTokens },
          }),
          signal: signal || AbortSignal.timeout(90000),
        }
      )
      if (!r.ok) {
        const body = await r.text().catch(() => '')
        // 429 / quota: tentar próximo modelo
        if (r.status === 429 || r.status === 503) { lastErr = new Error(`${modelo} ${r.status}`); continue }
        throw new Error(`Gemini ${modelo} ${r.status}: ${body.substring(0, 100)}`)
      }
      const data = await r.json()
      const texto = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      if (!texto) { lastErr = new Error(`${modelo} retornou texto vazio`); continue }
      return { texto, modeloUsado: modelo }
    } catch (e) {
      lastErr = e
      if (e?.name === 'AbortError') throw e // não tentar outros modelos
    }
  }
  throw lastErr || new Error('Todos os modelos Gemini falharam')
}

// ─── HELPER: parseJSONResposta ───────────────────────────────────────────────
/**
 * Extrai e parseia JSON de uma resposta de texto de IA.
 * Tenta JSON.parse direto, depois extrai bloco ```json ... ```.
 */
export function parseJSONResposta(texto) {
  if (!texto) return null
  // 1. Tentar parse direto (se já é JSON limpo)
  try { return JSON.parse(texto.trim()) } catch { /* continua */ }
  // 2. Extrair bloco ```json ... ``` ou ``` ... ```
  const match = texto.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (match) { try { return JSON.parse(match[1].trim()) } catch { /* continua */ } }
  // 3. Extrair { ... } mais externo
  const obj = texto.match(/\{[\s\S]*\}/)
  if (obj) { try { return JSON.parse(obj[0]) } catch { /* continua */ } }
  return null
}
