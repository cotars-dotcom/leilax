/**
 * AXIS — Constantes centralizadas
 * 
 * FONTE ÚNICA DE VERDADE para pesos, custos e modelos.
 * Qualquer alteração aqui propaga para todo o sistema.
 */

// ─── PESOS DO SCORE 6D (soma = 1.00) ────────────────────────────
export const SCORE_PESOS = {
  localizacao: 0.20,
  desconto:    0.18,
  juridico:    0.18,
  ocupacao:    0.15,
  liquidez:    0.15,
  mercado:     0.14,
}

// ─── CUSTOS PERCENTUAIS — LEILÃO ─────────────────────────────────
export const CUSTOS_LEILAO = {
  comissao_leiloeiro_pct: 5.0,     // % sobre lance
  itbi_pct:               3.0,     // % BH desde 2024
  advogado_pct:           2.0,     // % honorários
  documentacao_pct:       0.5,     // % cartório/registro
  registro_fixo:          1500,    // R$ fixo
  corretagem_venda_pct:   6.0,     // % sobre preço de venda
  irpf_ganho_capital_pct: 15.0,    // % sobre ganho
}

// ─── CUSTOS PERCENTUAIS — MERCADO DIRETO ─────────────────────────
export const CUSTOS_MERCADO = {
  comissao_leiloeiro_pct: 0.0,     // sem leiloeiro
  itbi_pct:               3.0,     // % BH
  advogado_pct:           0.0,     // sem necessidade
  documentacao_pct:       0.5,     // % cartório/registro
  registro_fixo:          1500,    // R$ fixo
  corretagem_venda_pct:   6.0,     // % sobre preço de venda
  irpf_ganho_capital_pct: 15.0,    // % sobre ganho
}

// ─── MULTIPLICADOR RÁPIDO PARA ESTIMATIVA CUSTO TOTAL ────────────
// Mercado: ITBI 3% + doc 0.5% = ~3.5%
// Leilão:  comissão 5% + ITBI 3% + adv 2% + doc 0.5% = ~10.5%
export const MULT_CUSTO_RAPIDO = {
  mercado: 0.035,
  leilao:  0.105,
}

// ─── MODELOS IA — CASCATA ────────────────────────────────────────
export const MODELOS_GEMINI = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-exp',
  'gemini-1.5-flash',
]

export const MODELOS_GEMINI_PRO = [
  'gemini-1.5-pro',
  'gemini-1.5-flash',
]

export const CLAUDE_MODEL = 'claude-sonnet-4-20250514'
export const CLAUDE_HAIKU = 'claude-haiku-4-5-20251001'
export const ANTHROPIC_VERSION = '2023-06-01'

// ─── CUSTO POR TOKEN (USD/1M tokens) ────────────────────────────
export const CUSTO_POR_TOKEN = {
  'claude-sonnet-4-20250514':  { input: 3.00,  output: 15.00 },
  'claude-haiku-4-5-20251001': { input: 1.00,  output: 5.00 },
  'deepseek-chat':             { input: 0.14,  output: 0.28 },
  'gpt-4o-mini':               { input: 0.15,  output: 0.60 },
  'gemini-2.0-flash':          { input: 0.075, output: 0.30 },
  'gemini-1.5-flash':          { input: 0.075, output: 0.30 },
  'gemini-2.0-flash-lite':     { input: 0.038, output: 0.15 },
  'gemini-1.5-pro':            { input: 1.25,  output: 5.00 },
}

// ─── HELPER: calcular score total ────────────────────────────────
export function calcularScoreTotal(scores) {
  return parseFloat((
    (scores.score_localizacao || 0) * SCORE_PESOS.localizacao +
    (scores.score_desconto    || 0) * SCORE_PESOS.desconto +
    (scores.score_juridico    || 0) * SCORE_PESOS.juridico +
    (scores.score_ocupacao    || 0) * SCORE_PESOS.ocupacao +
    (scores.score_liquidez    || 0) * SCORE_PESOS.liquidez +
    (scores.score_mercado     || 0) * SCORE_PESOS.mercado
  ).toFixed(2))
}

// ─── HELPER: calcular custos de aquisição ────────────────────────
export function calcularCustosAquisicao(precoBase, isMercado, overrides = {}) {
  const tabela = isMercado ? CUSTOS_MERCADO : CUSTOS_LEILAO
  const custos = { ...tabela, ...overrides }
  
  const comissao = precoBase * (custos.comissao_leiloeiro_pct / 100)
  const itbi     = precoBase * (custos.itbi_pct / 100)
  const adv      = precoBase * (custos.advogado_pct / 100)
  const doc      = precoBase * (custos.documentacao_pct / 100)
  const reg      = custos.registro_fixo
  
  const total = precoBase + comissao + itbi + adv + doc + reg
  
  return {
    precoBase: Math.round(precoBase),
    comissao: Math.round(comissao),
    itbi: Math.round(itbi),
    advogado: Math.round(adv),
    documentacao: Math.round(doc),
    registro: Math.round(reg),
    total: Math.round(total),
    percentual_total: ((total - precoBase) / precoBase * 100).toFixed(1),
  }
}

// ─── HELPER: chamar Gemini com cascata ───────────────────────────
export async function chamarGeminiCascata(prompt, geminiKey, opts = {}) {
  const {
    modelos = MODELOS_GEMINI,
    maxTokens = 2048,
    temperature = 0.1,
    timeout = 45000,
    onProgress = () => {},
  } = opts

  let ultimoErro = null
  let modeloUsado = null

  for (const modelo of modelos) {
    onProgress(`Gemini (${modelo})...`)
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature, maxOutputTokens: maxTokens }
          }),
          signal: AbortSignal.timeout(timeout)
        }
      )
      if (!r.ok) {
        const errTxt = await r.text().catch(() => '')
        console.warn(`[AXIS] ${modelo} HTTP ${r.status}:`, errTxt.substring(0, 120))
        if (r.status === 400 && errTxt.includes('API_KEY_INVALID')) break
        ultimoErro = new Error(`${modelo}: HTTP ${r.status}`)
        continue
      }
      const data = await r.json()
      const txt = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      if (!txt) { ultimoErro = new Error(`${modelo}: resposta vazia`); continue }
      modeloUsado = modelo
      return { texto: txt, modelo: modeloUsado }
    } catch (e) {
      console.warn(`[AXIS] ${modelo}:`, e.message)
      ultimoErro = e
    }
  }
  throw ultimoErro || new Error('Todos os modelos Gemini falharam')
}

// ─── HELPER: parse JSON de resposta IA ───────────────────────────
export function parseJSONResposta(texto) {
  const clean = texto.replace(/```json|```/g, '').trim()
  const match = clean.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('JSON não encontrado na resposta')
  return JSON.parse(match[0])
}
