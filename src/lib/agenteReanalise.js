/**
 * AXIS — Agente de Reanálise Inteligente (custo zero / Gemini Flash-Lite)
 * 
 * Diferença do fluxo normal:
 * - Tem acesso à análise anterior (comparação delta)
 * - Foca só no que mudou (documentos novos, preço alterado, etc.)
 * - Não refaz tudo do zero = mais barato e mais rápido
 */

import { analisarComGemini } from './motorAnaliseGemini.js'
import { scrapeUrlJina, extrairCamposTexto } from './scraperImovel.js'

// ─── REANÁLISE INTELIGENTE ───────────────────────────────────────────────────
export async function reAnalisarComGemini(
  imovelAtual, geminiKey, parametros, onProgress, motivoReanalise = null
) {
  const progress = onProgress || (() => {})

  // Se tiver motivo específico (novo documento, mudança de preço, etc.)
  // usar prompt focado em vez de reanálise completa
  if (motivoReanalise === 'novo_documento' || imovelAtual.historico_juridico?.length > 0) {
    return await reAnalisarJuridicoCom(imovelAtual, geminiKey, parametros, progress)
  }

  // Reanálise padrão: rodar scraper + Gemini novamente
  progress('Reanalisando imóvel com Gemini...')
  const analise = await analisarComGemini(
    imovelAtual.fonte_url,
    geminiKey,
    parametros,
    progress
  )

  // Preservar dados manuais importantes
  if (imovelAtual.score_juridico_manual != null) {
    analise.score_juridico = imovelAtual.score_juridico_manual
    analise._score_juridico_origem = 'manual'
  }
  if (imovelAtual.historico_juridico?.length > 0) {
    analise.historico_juridico = imovelAtual.historico_juridico
  }

  return analise
}

// ─── REANÁLISE FOCADA EM JURÍDICO (com docs) ─────────────────────────────────
async function reAnalisarJuridicoCom(imovelAtual, geminiKey, parametros, progress) {
  progress('Analisando impacto jurídico nos scores...')

  const historico = imovelAtual.historico_juridico || []
  const docsTexto = historico.map((d, i) =>
    `DOCUMENTO ${i+1}: ${d.nome || 'Sem nome'}\n${d.sintese || d.analise_claude || ''}`
  ).join('\n\n')

  const prompt = `Você é especialista em leilões judiciais no Brasil.
Reavalie o imóvel considerando os documentos jurídicos anexados.

IMÓVEL ATUAL:
${JSON.stringify({
  titulo: imovelAtual.titulo,
  bairro: imovelAtual.bairro,
  cidade: imovelAtual.cidade,
  valor_minimo: imovelAtual.valor_minimo,
  valor_avaliacao: imovelAtual.valor_avaliacao,
  ocupacao: imovelAtual.ocupacao,
  score_juridico: imovelAtual.score_juridico,
  processos_ativos: imovelAtual.processos_ativos,
  obs_juridicas: imovelAtual.obs_juridicas,
}, null, 2)}

DOCUMENTOS JURÍDICOS ANALISADOS:
${docsTexto || 'Nenhum documento adicional'}

Retorne APENAS JSON com os campos que devem ser ATUALIZADOS (delta):
{
  "score_juridico": 0.0,
  "score_juridico_manual": 0.0,
  "ocupacao": "desocupado|ocupado|incerto",
  "processos_ativos": "string atualizada",
  "obs_juridicas": "string atualizada com achados dos documentos",
  "riscos_presentes": ["string"],
  "alertas": ["[ATENCAO|CRITICO|OK|INFO] texto"],
  "prazo_liberacao_estimado_meses": 0,
  "reclassificado_por_doc": true,
  "justificativa_reanalise": "string — o que mudou e por quê"
}`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1500 }
      }),
      signal: AbortSignal.timeout(30000)
    }
  )
  if (!res.ok) throw new Error(`Gemini reanálise: ${res.status}`)
  const data = await res.json()
  const txt = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const clean = txt.replace(/```json|```/g, '').trim()
  const jsonMatch = clean.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Gemini não retornou JSON')
  const delta = JSON.parse(jsonMatch[0])

  // Aplicar delta sobre o imóvel atual
  return { ...imovelAtual, ...delta }
}

// ─── AGENTE DE CUSTO ZERO TOTAL (sem nenhuma API) ────────────────────────────
// Usa apenas dados existentes no banco para reclassificar
export function reAnalisarInterno(imovelAtual, parametros) {
  // Usar os dados do imovelAtual diretamente — sem chamada de API

  // Recalcular score com dados atuais (pode ter score_juridico_manual)
  const analise = { ...imovelAtual }
  if (analise.score_juridico_manual != null) {
    analise.score_juridico = analise.score_juridico_manual
  }
  const analiseValidada = validarECorrigirAnalise(analise)
  analiseValidada.score_total = calcularScore(analiseValidada, parametros)
  return analiseValidada
}
