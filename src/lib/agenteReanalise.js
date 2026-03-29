/**
 * AXIS — Agente de Reanálise (v2)
 * 
 * Não tenta fazer scraping na reanálise — usa os dados já salvos no banco
 * como contexto completo para o Gemini revalidar e enriquecer.
 * Custo: ~R$ 0,005 por reanálise
 */

import { calcularScore, validarECorrigirAnalise } from './motorIA.js'

export async function reAnalisarComGemini(imovelAtual, geminiKey, parametros, onProgress) {
  const progress = onProgress || (() => {})

  if (!geminiKey) throw new Error('Chave Gemini não configurada')
  if (!imovelAtual?.id) throw new Error('Imóvel inválido')

  progress('Preparando dados para reanálise...')

  // Construir contexto completo do imóvel para o Gemini
  const contexto = {
    titulo: imovelAtual.titulo,
    endereco: imovelAtual.endereco,
    bairro: imovelAtual.bairro,
    cidade: imovelAtual.cidade,
    tipo: imovelAtual.tipo,
    area_m2: imovelAtual.area_m2,
    quartos: imovelAtual.quartos,
    suites: imovelAtual.suites,
    vagas: imovelAtual.vagas,
    valor_minimo: imovelAtual.valor_minimo,
    valor_avaliacao: imovelAtual.valor_avaliacao,
    desconto_percentual: imovelAtual.desconto_percentual,
    valor_mercado_estimado: imovelAtual.valor_mercado_estimado,
    preco_m2_imovel: imovelAtual.preco_m2_imovel,
    preco_m2_mercado: imovelAtual.preco_m2_mercado,
    modalidade_leilao: imovelAtual.modalidade_leilao,
    num_leilao: imovelAtual.num_leilao,
    data_leilao: imovelAtual.data_leilao,
    ocupacao: imovelAtual.ocupacao,
    financiavel: imovelAtual.financiavel,
    debitos_condominio: imovelAtual.debitos_condominio,
    debitos_iptu: imovelAtual.debitos_iptu,
    processos_ativos: imovelAtual.processos_ativos,
    matricula_status: imovelAtual.matricula_status,
    obs_juridicas: imovelAtual.obs_juridicas,
    classe_ipead: imovelAtual.classe_ipead,
    aluguel_mensal_estimado: imovelAtual.aluguel_mensal_estimado,
    liquidez: imovelAtual.liquidez,
    mercado_tendencia: imovelAtual.mercado_tendencia,
    mercado_demanda: imovelAtual.mercado_demanda,
    escopo_reforma: imovelAtual.escopo_reforma,
    custo_reforma_calculado: imovelAtual.custo_reforma_calculado,
    riscos_presentes: imovelAtual.riscos_presentes,
    comparaveis: imovelAtual.comparaveis,
    fonte_url: imovelAtual.fonte_url,
  }

  const prompt = `Você é especialista em análise de imóveis em leilão judicial no Brasil (BH/MG).

Reavalie este imóvel com base nos dados já coletados. NÃO precisa acessar URL externa.
Use APENAS os dados fornecidos para validar, corrigir e enriquecer a análise.

DADOS ATUAIS DO IMÓVEL:
${JSON.stringify(contexto, null, 2)}

SCORES ATUAIS:
- Localização: ${imovelAtual.score_localizacao} (peso 20%)
- Desconto: ${imovelAtual.score_desconto} (peso 18%)
- Jurídico: ${imovelAtual.score_juridico} (peso 18%)
- Ocupação: ${imovelAtual.score_ocupacao} (peso 15%)
- Liquidez: ${imovelAtual.score_liquidez} (peso 15%)
- Mercado: ${imovelAtual.score_mercado} (peso 14%)

CALIBRAÇÃO DOS SCORES (escala 0-10):
- Localização: bairro nobre BH (Savassi/Lourdes)→9.5, bom→7-8, médio→5-6, periferia→3-4
- Desconto 32.5%→6.5, 40%→7.5, 50%→8.5, 60%+→9.5
- Jurídico: sem processos→8.5, 1 processo trabalhista→6.5, risco grave→3.0
- Ocupação: desocupado→8.5, incerto→5.5, ocupado→3.0
- Liquidez: alta demanda bairro→8.5, média→6.5, baixa→4.0
- Mercado: classe Luxo BH→8.5, Alto→7.0, Médio→5.5, Popular→4.0

Retorne APENAS JSON com os campos atualizados:
{
  "score_localizacao": 0.0,
  "score_desconto": 0.0,
  "score_juridico": 0.0,
  "score_ocupacao": 0.0,
  "score_liquidez": 0.0,
  "score_mercado": 0.0,
  "recomendacao": "COMPRAR|AGUARDAR|EVITAR",
  "justificativa": "string — 3-4 linhas",
  "sintese_executiva": "string — 2-3 frases simples",
  "positivos": ["string"],
  "negativos": ["string"],
  "alertas": ["[CRITICO|ATENCAO|OK|INFO] texto"],
  "estrategia_recomendada": "flip|locacao|temporada",
  "valor_mercado_estimado": 0,
  "aluguel_mensal_estimado": 0,
  "prazo_liberacao_estimado_meses": 0,
  "classe_ipead": "Popular|Medio|Alto|Luxo",
  "liquidez": "Alta|Média|Baixa",
  "mercado_tendencia": "alta|estavel|queda",
  "mercado_demanda": "alta|media_alta|media|media_baixa|baixa"
}`

  // Cascata de modelos: 2.0-flash → 1.5-flash → 1.5-pro
  const MODELOS_GEMINI = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']
  let data = null
  let ultimoErro = null

  for (const modelo of MODELOS_GEMINI) {
    progress(`Gemini revalidando análise (${modelo})...`)
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 2048 }
          }),
          signal: AbortSignal.timeout(45000)
        }
      )
      if (!r.ok) {
        const errTxt = await r.text().catch(() => '')
        console.error('[AXIS agenteReanalise]', modelo, 'HTTP', r.status, errTxt.substring(0, 200))
        ultimoErro = new Error(`Gemini ${r.status}: ${errTxt.substring(0, 150)}`)
        if (r.status === 400 && errTxt.includes('API_KEY_INVALID')) break
        continue
      }
      data = await r.json()
      console.log('[AXIS agenteReanalise] Sucesso com modelo:', modelo)
      break
    } catch(e) {
      console.warn('[AXIS agenteReanalise] Erro com', modelo, ':', e.message)
      ultimoErro = e
    }
  }

  if (!data) throw ultimoErro || new Error('Todos os modelos Gemini falharam')
  const txt = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const clean = txt.replace(/```json|```/g, '').trim()
  const match = clean.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Gemini não retornou JSON válido')

  const delta = JSON.parse(match[0])
  progress('✅ Reanálise Gemini concluída')

  // Mesclar delta com dados existentes — preservar campos não retornados pelo Gemini
  const analiseAtualizada = {
    ...imovelAtual,
    ...delta,
    // Sempre preservar campos de identidade
    id: imovelAtual.id,
    codigo_axis: imovelAtual.codigo_axis,
    fonte_url: imovelAtual.fonte_url,
    titulo: imovelAtual.titulo,
    valor_minimo: imovelAtual.valor_minimo,
    valor_avaliacao: imovelAtual.valor_avaliacao,
    fotos: imovelAtual.fotos || [],
    foto_principal: imovelAtual.foto_principal,
    comparaveis: delta.comparaveis || imovelAtual.comparaveis || [],
    criado_em: imovelAtual.criado_em,
    criado_por: imovelAtual.criado_por,
    _modelo_usado: 'gemini-2.0-flash',
  }

  // Recalcular score total com os pesos corretos
  const pesos = {
    localizacao: 0.20, desconto: 0.18, juridico: 0.18,
    ocupacao: 0.15, liquidez: 0.15, mercado: 0.14
  }
  const scoreCalc =
    (analiseAtualizada.score_localizacao || 0) * pesos.localizacao +
    (analiseAtualizada.score_desconto || 0)    * pesos.desconto +
    (analiseAtualizada.score_juridico || 0)    * pesos.juridico +
    (analiseAtualizada.score_ocupacao || 0)    * pesos.ocupacao +
    (analiseAtualizada.score_liquidez || 0)    * pesos.liquidez +
    (analiseAtualizada.score_mercado || 0)     * pesos.mercado
  analiseAtualizada.score_total = parseFloat(scoreCalc.toFixed(2))

  // Garantir recomendação coerente com o score
  if (analiseAtualizada.score_total >= 8.0) analiseAtualizada.recomendacao = 'COMPRAR'
  else if (analiseAtualizada.score_total >= 7.0) analiseAtualizada.recomendacao = delta.recomendacao || 'COMPRAR'
  else if (analiseAtualizada.score_total >= 6.0) analiseAtualizada.recomendacao = delta.recomendacao || 'AGUARDAR'
  else analiseAtualizada.recomendacao = 'EVITAR'

  return analiseAtualizada
}
