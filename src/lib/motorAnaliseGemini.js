/**
 * AXIS — Motor de Análise com Gemini Flash-Lite (custo ~$0.002/análise)
 * Substitui Claude Sonnet ($0.38) + GPT-4o ($0.20) = 99% de redução
 *
 * CASCATA:
 *   1. Jina.ai (gratuito) → scrape texto da URL
 *   2. Regex extractor (zero) → campos básicos
 *   3. Gemini 2.0 Flash-Lite (~$0.002) → campos complexos + scores + síntese
 *   4. calcularScore() interno (zero) → score final
 *   5. gerarAnalise() interno (zero) → ROI + leilão
 */

import { scrapeUrlJina, extrairCamposTexto } from './scraperImovel.js'
import { calcularScore, validarECorrigirAnalise } from './dualAI.js'
import { getMercadoComFallback } from './supabase.js'
import { detectarRegiao, getMercado } from '../data/mercado_regional.js'
import { calcularCustoReforma, detectarClasseMercado } from '../data/custos_reforma.js'

// ─── PROMPT GEMINI COMPACTO ──────────────────────────────────────────────────
function buildPromptGemini(campos, textoScrapeado, contextoMercado, imovelContexto = null) {
  return `Você é especialista em leilões judiciais imobiliários no Brasil (BH/MG).
Analise o imóvel e retorne APENAS JSON válido (sem markdown, sem texto extra).

DADOS JÁ EXTRAÍDOS AUTOMATICAMENTE:
${JSON.stringify({
  titulo: campos.titulo,
  endereco: campos.endereco,
  bairro: campos.bairro,
  cidade: campos.cidade,
  tipo: campos.tipo,
  area_m2: campos.area_m2,
  quartos: campos.quartos,
  suites: campos.suites,
  vagas: campos.vagas,
  valor_minimo: campos.valor_minimo,
  valor_avaliacao: campos.valor_avaliacao,
  desconto_percentual: campos.desconto_percentual,
  modalidade_leilao: campos.modalidade_leilao,
  ocupacao: campos.ocupacao,
  financiavel: campos.financiavel,
  processos_ativos: campos.processos_ativos,
}, null, 2)}

TEXTO DA PÁGINA (primeiros 4000 chars):
${textoScrapeado?.substring(0, 4000) || 'Não disponível'}

CONTEXTO MERCADO (${campos.bairro || campos.cidade || 'BH'}):
${contextoMercado ? JSON.stringify(contextoMercado) : 'Usar conhecimento geral de BH/MG'}

Complete e corrija os dados. Retorne JSON com EXATAMENTE estes campos:
{
  "titulo": "string — título completo do imóvel",
  "endereco": "string",
  "bairro": "string",
  "cidade": "string",
  "estado": "MG",
  "tipo": "Apartamento|Casa|Cobertura|Terreno|Sala Comercial|Galpão",
  "area_m2": 0,
  "quartos": 0,
  "suites": 0,
  "vagas": 0,
  "valor_minimo": 0,
  "valor_avaliacao": 0,
  "desconto_percentual": 0.0,
  "modalidade_leilao": "judicial|extrajudicial_fiduciario|extrajudicial_caixa|judicial_trt|judicial_tjmg",
  "leiloeiro": "string",
  "data_leilao": "string",
  "num_leilao": 1,
  "ocupacao": "desocupado|ocupado|incerto",
  "ocupacao_fonte": "string — de onde veio essa informação",
  "financiavel": false,
  "fgts_aceito": false,
  "debitos_condominio": "string",
  "debitos_iptu": "string",
  "responsabilidade_debitos": "sub_rogado|arrematante|exonerado",
  "responsabilidade_fonte": "string",
  "processos_ativos": "string",
  "matricula_status": "Regular|Irregular|Sem informação",
  "obs_juridicas": "string — riscos jurídicos identificados",
  "preco_m2_imovel": 0,
  "preco_m2_mercado": 0,
  "preco_m2_fonte": "string",
  "valor_mercado_estimado": 0,
  "desconto_sobre_mercado_pct": 0.0,
  "classe_ipead": "Popular|Medio|Alto|Luxo",
  "aluguel_mensal_estimado": 0,
  "liquidez": "Alta|Média|Baixa",
  "prazo_revenda_meses": 0,
  "score_localizacao": 0.0,
  "score_desconto": 0.0,
  "score_juridico": 0.0,
  "score_ocupacao": 0.0,
  "score_liquidez": 0.0,
  "score_mercado": 0.0,
  "positivos": ["string"],
  "negativos": ["string"],
  "alertas": ["[ATENCAO] ou [CRITICO] ou [OK] ou [INFO] + texto"],
  "recomendacao": "COMPRAR|AGUARDAR|EVITAR",
  "justificativa": "string — 3-4 linhas explicando a decisão",
  "sintese_executiva": "string — 2-3 frases simples para não especialistas",
  "estrategia_recomendada": "flip|locacao|temporada",
  "estrategia_recomendada_detalhe": {"tipo":"flip_rapido|renda_passiva","motivo":"string","prazo_estimado_meses":0,"roi_estimado_pct":0},
  "estrutura_recomendada": "cpf_unico|condominio_voluntario|holding|ltda",
  "itbi_pct": 3,
  "comissao_leiloeiro_pct": 5,
  "custo_reforma_estimado": 0,
  "escopo_reforma": "refresh_giro|leve_funcional|leve_reforcada_1_molhado|media|pesada",
  "prazo_liberacao_estimado_meses": 0,
  "comparaveis": [{"descricao":"string","valor":0,"area_m2":0,"preco_m2":0,"quartos":0,"vagas":0,"tipo":"apartamento","fonte":"Gemini","similaridade":8}],
  "riscos_presentes": ["string"],
  "mercado_tendencia": "alta|estavel|queda",
  "mercado_demanda": "alta|media_alta|media|media_baixa|baixa",
  "mercado_tempo_venda_meses": 0,
  "tipologia": "apartamento_padrao|casa_padrao|cobertura|terreno|comercial",
  "padrao_acabamento": "popular|medio|alto|luxo"
}

${imovelContexto ? `
DADOS JÁ SALVOS NO SISTEMA (use como base, corrija apenas se o texto mostrar algo diferente):
- Título conhecido: ${imovelContexto.titulo || ''}
- Valor lance salvo: R$ ${imovelContexto.valor_minimo?.toLocaleString('pt-BR') || 'não salvo'}
- Score anterior: ${imovelContexto.score_total || 'não calculado'}
- Bairro confirmado: ${imovelContexto.bairro || ''}
IMPORTANTE: Se o scraper não conseguiu acessar a URL, use os dados salvos acima como referência principal.
` : ''}

CALIBRAÇÃO DE SCORES (escala 0-10):
- score_localizacao: bairro nobre BH (Savassi/Lourdes/Belvedere)→9.5, bom→7-8, médio→5-6, periferia→3-4
- score_desconto: 60%+→9.5, 50%→8.5, 40%→7.5, 30%→6.0, 20%→4.5, sem desconto→2.0
- score_juridico: sem processos+matricula ok→8.5, 1 processo leve→6.5, risco grave→3.0
- score_ocupacao: desocupado confirmado→8.5, incerto→5.5, ocupado→3.0
- score_liquidez: alta demanda→8.5, média→6.5, baixa→4.0
- score_mercado: classe Luxo BH→8.5, Alto→7.0, Médio→5.5, Popular→4.0`
}

// ─── CHAMADA GEMINI FLASH-LITE ───────────────────────────────────────────────
async function chamarGeminiModelo(prompt, geminiKey, modelo) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4096 }
      }),
      signal: AbortSignal.timeout(45000)
    }
  )
  if (!res.ok) {
    const body = await res.text()
    console.error('[AXIS Gemini]', modelo, 'HTTP', res.status, body.substring(0, 300))
    throw new Error(`Gemini ${res.status}: ${body.substring(0, 200)}`)
  }
  const data = await res.json()
  const txt = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const clean = txt.replace(/```json|```/g, '').trim()
  const jsonMatch = clean.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Gemini não retornou JSON válido')
  return JSON.parse(jsonMatch[0])
}

// Cascata de modelos Gemini: 2.0-flash → 1.5-flash → 1.5-pro
async function chamarGemini(prompt, geminiKey) {
  const MODELOS = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']
  let ultimoErro = null
  for (const modelo of MODELOS) {
    try {
      console.log('[AXIS Gemini] Tentando modelo:', modelo)
      const resultado = await chamarGeminiModelo(prompt, geminiKey, modelo)
      console.log('[AXIS Gemini] Sucesso com:', modelo)
      return resultado
    } catch(e) {
      console.warn('[AXIS Gemini] Falhou com', modelo, ':', e.message.substring(0, 100))
      ultimoErro = e
      // Se for erro de chave inválida (401/403 sem ser quota), não tentar outros modelos
      if (e.message.includes('400') && e.message.includes('API_KEY_INVALID')) break
    }
  }
  throw ultimoErro || new Error('Todos os modelos Gemini falharam')
}

// ─── MOTOR PRINCIPAL ─────────────────────────────────────────────────────────
export async function analisarComGemini(url, geminiKey, parametros, onProgress, imovelContexto = null) {
  const erros = []

  // PASSO 1: Scrape com Jina (grátis)
  onProgress?.('Coletando dados do imóvel (Jina AI)...')
  let textoScrapeado = ''
  try {
    textoScrapeado = await scrapeUrlJina(url)
  } catch(e) {
    erros.push(`Jina scrape falhou: ${e.message}`)
    // Tentar fetch direto como fallback
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(15000) })
      textoScrapeado = await r.text()
      textoScrapeado = textoScrapeado.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
    } catch(e2) { erros.push(`Fetch direto também falhou: ${e2.message}`) }
  }

  // PASSO 2: Extração por regex (zero custo)
  onProgress?.('Extraindo dados estruturados...')
  const camposBasicos = extrairCamposTexto(textoScrapeado, url)

  // PASSO 3: Buscar contexto de mercado do banco (zero custo)
  let contextoMercado = null
  try {
    const cidadeDetectada = camposBasicos.cidade || 'Belo Horizonte'
    const bairroDetectado = camposBasicos.bairro || ''
    const regiaoId = detectarRegiao(cidadeDetectada, bairroDetectado)
    if (regiaoId) {
      contextoMercado = await getMercadoComFallback(regiaoId)
    }
  } catch(e) { /* sem contexto, Gemini usa conhecimento interno */ }

  // PASSO 4: Gemini Flash-Lite para campos complexos + scores + síntese
  onProgress?.('Gemini analisando imóvel (~$0.002)...')
  let analiseGemini = null
  try {
    const prompt = buildPromptGemini(camposBasicos, textoScrapeado, contextoMercado, imovelContexto)
    analiseGemini = await chamarGemini(prompt, geminiKey)
  } catch(e) {
    const errMsg = e.message || 'erro desconhecido'
    console.error('[AXIS Gemini] Erro detalhado:', errMsg)
    onProgress?.(`⚠️ Gemini erro: ${errMsg.substring(0, 120)}`)
    erros.push(`Gemini falhou: ${errMsg}`)
    // Fallback inteligente: se temos contexto do imóvel, preservar dados existentes
    if (imovelContexto && imovelContexto.score_total > 0) {
      // Usar dados do imóvel já analisado — não degradar scores existentes
      analiseGemini = {
        ...imovelContexto,
        ...camposBasicos,  // regex pode ter dados novos
        // Preservar scores do banco (não sobrescrever com genéricos)
        score_localizacao: imovelContexto.score_localizacao,
        score_desconto: imovelContexto.score_desconto,
        score_juridico: imovelContexto.score_juridico,
        score_ocupacao: imovelContexto.score_ocupacao,
        score_liquidez: imovelContexto.score_liquidez,
        score_mercado: imovelContexto.score_mercado,
        justificativa: imovelContexto.justificativa,
        sintese_executiva: imovelContexto.sintese_executiva,
        recomendacao: imovelContexto.recomendacao,
        positivos: imovelContexto.positivos,
        negativos: imovelContexto.negativos,
        comparaveis: imovelContexto.comparaveis || [],
        fotos: imovelContexto.fotos || [],
        alertas: [...(imovelContexto.alertas || []), '[ATENCAO] Gemini indisponível — dados da análise anterior preservados'],
      }
    } else {
      // Sem contexto: usar scores genéricos (nova análise sem Gemini)
      analiseGemini = {
        ...camposBasicos,
        score_localizacao: 6.0, score_desconto: camposBasicos.desconto_percentual >= 30 ? 6.5 : 4.0,
        score_juridico: 6.0, score_ocupacao: camposBasicos.ocupacao === 'desocupado' ? 8.0 : 5.0,
        score_liquidez: 6.0, score_mercado: 6.0,
        justificativa: 'Análise automática baseada nos dados do edital. Verifique os scores manualmente.',
        sintese_executiva: 'Imóvel analisado automaticamente. Revise os dados antes de fazer uma oferta.',
        recomendacao: 'AGUARDAR',
        positivos: ['Desconto sobre avaliação judicial'],
        negativos: ['Análise incompleta — Gemini indisponível'],
        alertas: ['[ATENCAO] Análise automática sem IA — verifique os dados manualmente'],
      }
    }
  }

  // PASSO 5: Mesclar campos básicos + Gemini (regex tem precedência para valores numéricos)
  // Garantir título nunca seja vazio ou genérico
  if (!analiseGemini.titulo || analiseGemini.titulo.length < 5 || analiseGemini.titulo.toLowerCase().includes('lote -')) {
    analiseGemini.titulo = camposBasicos.titulo || analiseGemini.titulo
  }

  const analise = {
    ...analiseGemini,
    // Campos extraídos por regex têm precedência ABSOLUTA para valores monetários
    // Se regex extraiu um valor válido, usar mesmo que Gemini discorde
    valor_minimo: camposBasicos.valor_minimo > 0 ? camposBasicos.valor_minimo : analiseGemini.valor_minimo,
    valor_avaliacao: camposBasicos.valor_avaliacao || analiseGemini.valor_avaliacao,
    area_m2: camposBasicos.area_m2 || analiseGemini.area_m2,
    quartos: camposBasicos.quartos || analiseGemini.quartos,
    vagas: camposBasicos.vagas || analiseGemini.vagas,
    processo_numero: camposBasicos.processo_numero || analiseGemini.processo_numero,
    fonte_url: url,
    analise_dupla_ia: false,
    _erros_extracao: erros,
    _modelo_usado: erros.length > 0 ? 'regex_fallback' : 'gemini-2.0-flash',
  }

  // PASSO 6: Calcular reforma com SINAPI
  try {
    if (analise.bairro && analise.preco_m2_mercado && analise.area_m2) {
      const classeDetectada = detectarClasseMercado(
        analise.bairro,
        analise.preco_m2_mercado
      )
      const custoReforma = calcularCustoReforma({
        escopo: analise.escopo_reforma || 'refresh_giro',
        area_m2: analise.area_m2,
        classe: classeDetectada?.classe,
        preco_m2_imovel: analise.preco_m2_imovel,
        valor_imovel: analise.valor_mercado_estimado || analise.valor_avaliacao
      })
      analise.custo_reforma_calculado = custoReforma?.custo_total || analise.custo_reforma_estimado
      analise.classe_mercado_reforma = classeDetectada?.classe
      analise.alerta_sobrecap = custoReforma?.alerta_sobrecap || 'verde'
    }
  } catch(e) { /* reforma sem cálculo SINAPI */ }

  // PASSO 7: Validar e corrigir (zero custo)
  const analiseValidada = validarECorrigirAnalise(analise)

  // PASSO 8: Calcular score final com pesos do banco
  const scoreTotal = calcularScore(analiseValidada, parametros)
  analiseValidada.score_total = scoreTotal

  return analiseValidada
}

// ─── LOG DE USO ───────────────────────────────────────────────────────────────
export async function logUsoGemini(imovelId, titulo, sucesso = true) {
  try {
    const { logUsoChamadaAPI } = await import('./supabase.js')
    await logUsoChamadaAPI({
      tipo: 'analise_principal', modelo: 'gemini-2.0-flash',
      tokensInput: 4000, tokensOutput: 1500,
      imovelId, imovelTitulo: titulo, sucesso
    })
  } catch(e) {}
}

// ─── DEEPSEEK V3 — ALTERNATIVA ULTRA-BARATA ($0.27/M tokens) ────────────────
// Usar quando: Gemini indisponível E Claude muito caro
// API compatível com OpenAI — mesma interface

export async function analisarComDeepSeek(url, deepseekKey, parametros, onProgress, imovelContexto = null) {
  const progress = onProgress || (() => {})
  
  // Reusar o mesmo motor do Gemini mas com endpoint DeepSeek
  const { scrapeUrlJina, extrairCamposTexto } = await import('./scraperImovel.js')
  
  progress('Buscando dados do imóvel (Jina)...')
  let textoScrapeado = ''
  let camposBasicos = imovelContexto ? { ...imovelContexto } : {}
  
  try {
    textoScrapeado = await scrapeUrlJina(url)
    const extraidos = extrairCamposTexto(textoScrapeado, url)
    camposBasicos = { ...camposBasicos, ...extraidos }
  } catch(e) { console.warn('[AXIS DeepSeek] scrape:', e.message) }

  progress('DeepSeek V3 analisando (~$0.04)...')
  
  const prompt = buildPromptGemini(camposBasicos, textoScrapeado, null, imovelContexto)
  
  try {
    const r = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${deepseekKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4096,
        temperature: 0.1
      }),
      signal: AbortSignal.timeout(60000)
    })
    if (!r.ok) throw new Error(`DeepSeek ${r.status}`)
    const data = await r.json()
    const txt = data.choices?.[0]?.message?.content || ''
    const clean = txt.replace(/```json|```/g, '').trim()
    const match = clean.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('DeepSeek JSON inválido')
    
    const analise = JSON.parse(match[0])
    analise._modelo_usado = 'deepseek-v3'
    progress('✅ Análise DeepSeek concluída (~R$ 0,08)')
    return analise
  } catch(e) {
    throw new Error(`DeepSeek falhou: ${e.message}`)
  }
}
