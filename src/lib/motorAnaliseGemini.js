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
import { calcularScore, validarECorrigirAnalise } from './motorIA.js'
import { getMercadoComFallback, getJurimetriaVara, getMetricasBairro } from './supabase.js'
import { detectarRegiao, getMercado } from '../data/mercado_regional.js'
import { calcularCustoReforma, detectarClasseMercado } from '../data/custos_reforma.js'
import { isMercadoDireto } from './detectarFonte.js'

// ─── PROMPT GEMINI COMPACTO ──────────────────────────────────────────────────
function buildPromptGemini(campos, textoScrapeado, contextoMercado, imovelContexto = null, jurimetria = [], metricasBairro = null, eMercadoDireto = false) {
  const ALERTAS_CRITICOS = `
ALERTAS CRÍTICOS DE IDENTIFICAÇÃO (APLIQUE SEMPRE):
- "Comitente" = nome jurídico do credor/exequente no edital → NÃO é bairro
  Bairro = localização geográfica real (Dona Clara, Serra, Buritis, Savassi...)
- Tipo do imóvel: identificar pelo edital/fotos (Apartamento/Casa/Cobertura)
  Nunca classificar como "Terreno" se o edital descreve um apartamento
- Município: Contagem ≠ BH | Nova Lima ≠ BH | verificar endereço completo
`

  const instrucaoTipo = eMercadoDireto ? `
ATENÇÃO: Este é um imóvel de MERCADO DIRETO (não é leilão).
- tipo_transacao = "mercado_direto"
- valor_minimo = preço pedido pelo vendedor (não é lance mínimo)
- num_leilao = null, data_leilao = null, modalidade_leilao = null
- desconto_percentual = quanto o preço pedido está abaixo do valor real de mercado
- Analise necessidade de reforma pelo padrão e idade estimada do imóvel
- Score de desconto: positivo se preço pedido < mercado real homogeneizado
` : ''
  return `${ALERTAS_CRITICOS}${instrucaoTipo}Você é especialista em leilões judiciais imobiliários no Brasil (BH/MG) e avaliação imobiliária.
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
${textoScrapeado?.substring(0, 4000) || 'Não disponível — use a URL e dados extraídos acima como referência principal'}
${(!textoScrapeado || textoScrapeado.length < 200) ? '\n⚠️ TEXTO ESCASSO: o scraper não conseguiu extrair o conteúdo completo da página. Use seus dados internos sobre mercado imobiliário de BH/MG, a URL acima e os campos já extraídos para completar a análise. Retorne os melhores dados possíveis mesmo com informação limitada.\n' : ''}

CONTEXTO MERCADO (${campos.bairro || campos.cidade || 'BH'}):
${contextoMercado ? JSON.stringify(contextoMercado) : 'Usar conhecimento geral de BH/MG'}

${jurimetria.length > 0 ? `
JURIMETRIA DAS VARAS (dados reais TJMG/TRT-3 BH):
${jurimetria.map(v => `- ${v.vara_nome}: ${v.tempo_total_ciclo_dias} dias ciclo | ${v.taxa_sucesso_posse_pct}% sucesso posse`).join('\n')}
Use o tipo de processo para identificar a vara e calibrar prazo_liberacao_estimado_meses.
Taxa sucesso < 85% → score_juridico máximo 6.0.` : ''}
${metricasBairro ? `
MÉTRICAS DO BAIRRO ${metricasBairro.bairro} (FipeZAP/SECOVI-MG/QuintoAndar 2025-2026):
- Preço anúncio: R$ ${(metricasBairro.preco_anuncio_m2||0).toLocaleString('pt-BR')}/m² — USE ESTE como BASE para homogeneização
- Preço contrato real: R$ ${(metricasBairro.preco_contrato_m2||0).toLocaleString('pt-BR')}/m² — referência de transação real (NÃO aplicar homog sobre este)
- Yield bruto: ${metricasBairro.yield_bruto||'—'}% a.a. | Classe IPEAD: ${metricasBairro.classe_ipead||'—'}
- Aluguel/m² c/ elevador: R$ ${(metricasBairro.aluguel_m2_com_elevador||0).toFixed(2)}/m²
- Aluguel/m² SEM elevador: R$ ${(metricasBairro.aluguel_m2_sem_elevador||0).toFixed(2)}/m² (fator ${metricasBairro.fator_elevador||0.85})
- Aluguel típico 3 quartos: R$ ${(metricasBairro.aluguel_3q_tipico||0).toLocaleString('pt-BR')}/mês
- Vacância estimada: ${metricasBairro.vacancia_pct||6}% | Tempo p/ alugar: ${metricasBairro.tempo_locacao_dias||15} dias
HOMOGENEIZAÇÃO (NBR 14653): aplique multiplicadores ao preço de ANÚNCIO (não contrato):
  sem elevador × ${metricasBairro.fator_elevador||0.85} | sem piscina × 0.97 | sem lazer × 0.95 | sem vaga × 0.90
  ⚠️ NÃO aplique sobre preço de contrato — dupla penalização
  Preencha fator_homogenizacao = produto dos fatores aplicáveis.` : ''}
COMPARÁVEIS — REGRAS CRÍTICAS:
Retorne 3 a 5 imóveis do MESMO TIPO que o imóvel analisado (campo "tipo" acima).
Se tipo=Apartamento: só comparar com apartamentos similares (mesmo nº quartos, área ±40m², mesmo bairro ou vizinhos).
Se tipo=Casa: só com casas.
NUNCA incluir terrenos, lotes ou tipos diferentes como comparável.
Para cada comparável, use preço de venda/anúncio ativo no ZAP/VivaReal/OLX ou estimativas do mercado.
Calcule similaridade: mesmo tipo +3, área ±20% +3, mesmos quartos +2, mesmo bairro +1, vagas +1.

CALCULE obrigatoriamente (com homogeneização por atributos):
- preco_m2_mercado: usar a MÉDIA DOS COMPARÁVEIS (preço de anúncio) × fator_homogenizacao
  ⚠️ NÃO aplique fator sobre preço de contrato — isso causa dupla penalização
  O preço de contrato já embute ~15-20% de desconto sobre o anúncio
  fator_homogenizacao = 1.0 × (sem elevador: 0.85) × (sem piscina: 0.97) × (sem lazer: 0.95) × (sem vaga: 0.90)
  Fatores NBR 14653-2 (IBAPE): campo de arbítrio ±15%, faixa 0.80-1.20
  Elevador: -15% (0.85) como central, -10% (0.90) para térreo/2º andar, -20% (0.80) só andar alto+prédio antigo
  Preencha o campo fator_homogenizacao com o valor calculado
- valor_mercado_estimado = preco_m2_mercado × area_m2 (resultado COM homogeneização)
- valor_mercado_homogenizado = mesmo que valor_mercado_estimado quando há fator aplicado
- aluguel_mensal_estimado: se bairro tem dados → usar aluguel_m2 × area_m2 (conforme elevador)
  Se sem dados → preco_m2_mercado × area_m2 × yield_bruto / 100 / 12
  yields: Popular=7.5%, Médio=6.5%, Alto=5.3%, Luxo=4.5%
  ⚠️ Mercado BH subiu +13% em 2025 — usar dados atualizados, não históricos
  Não use o aluguel_3q_tipico diretamente — ajuste pela área privativa real
- mao_flip = valor_mercado_estimado × 0.88 − (custo_reforma_estimado + valor_minimo × 0.075)
  (88% = 1 - 6% corretagem - 6% ITBI+taxas)
- mao_locacao = aluguel_mensal_estimado × 120 × 0.90
- yield_bruto_pct = (aluguel_mensal_estimado × 12 / valor_mercado_estimado) × 100
- NUNCA retorne aluguel_mensal_estimado = 0 se tiver preco_m2_mercado e area_m2.

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
  "comparaveis": [/* OBRIGATÓRIO: 3 a 5 imóveis do MESMO TIPO que o analisado (mesmo tipo, bairro/cidade, área similar ±40m²). NUNCA compare apartamento com terreno/casa. Preencher campos: descricao, valor, area_m2, preco_m2, quartos, vagas, tipo, fonte, similaridade, link(opcional) */
    {"descricao":"string","valor":0,"area_m2":0,"preco_m2":0,"quartos":0,"vagas":0,"tipo":"apartamento","fonte":"Gemini/conhecimento","similaridade":8,"link":null}],
  "riscos_presentes": ["string"],
  "mercado_tendencia": "alta|estavel|queda",
  "mercado_demanda": "alta|media_alta|media|media_baixa|baixa",
  "mercado_tempo_venda_meses": 0,
  "tipologia": "apartamento_padrao|casa_padrao|cobertura|terreno|comercial",
  "padrao_acabamento": "popular|medio|alto|luxo",
  "elevador": true,
  "piscina": false,
  "area_lazer": false,
  "salao_festas": false,
  "portaria_24h": false,
  "mobiliado": false,
  "condominio_mensal": 0,
  "andar": null,
  "banheiros": 0
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

ATRIBUTOS DO PRÉDIO — REGRAS DE IDENTIFICAÇÃO:
- elevador: true se texto menciona elevador, prédio >4 andares, ou alto padrão. false se explicitamente sem elevador ou walk-up
- piscina: true se texto menciona piscina, "área de lazer completa", fotos com piscina. Se condomínio com portaria + piscina → ambos true
- area_lazer: true se menciona playground, academia, churrasqueira, salão de jogos, quadra, área gourmet
- salao_festas: true se menciona salão de festas, espaço gourmet, churrasqueira do condomínio
- portaria_24h: true se menciona porteiro, portaria 24h, segurança
- condominio_mensal: extrair valor se mencionado (em R$/mês). Se não encontrar, estimar: Popular 200-400, Médio 400-700, Alto 700-1200, Luxo 1200+
- mobiliado: true/false/"semi" — verificar se imóvel vem com móveis planejados, armários embutidos etc.
- REGRA: Se imóvel tem piscina, quase certamente tem elevador também (condomínio vertical com piscina = tem elevador)
- REGRA: Presença de porteiro/portaria implica condomínio organizado → área_lazer provável
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
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
        }
      }),
      signal: AbortSignal.timeout(60000)
    }
  )
  if (!res.ok) {
    const body = await res.text()
    console.error('[AXIS Gemini]', modelo, 'HTTP', res.status, body.substring(0, 300))
    throw new Error(`Gemini ${res.status}: ${body.substring(0, 200)}`)
  }
  const data = await res.json()
  const txt = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  if (!txt || txt.length < 10) throw new Error('Gemini retornou resposta vazia')
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
      return { resultado, modeloUsado: modelo }
    } catch(e) {
      console.warn('[AXIS Gemini] Falhou com', modelo, ':', e.message.substring(0, 100))
      ultimoErro = e
      // Se chave inválida, não tentar outros modelos
      if (e.message.includes('API_KEY_INVALID') || e.message.includes('401')) break
      // Se 404 (modelo não existe), tentar o próximo
      if (e.message.includes('404')) continue
    }
  }
  throw ultimoErro || new Error('Todos os modelos Gemini falharam')
}

// ─── MOTOR PRINCIPAL ─────────────────────────────────────────────────────────
export async function analisarComGemini(url, geminiKey, parametros, onProgress, imovelContexto = null) {
  const erros = []
  let _modeloGemini = 'gemini-1.5-flash' // default, atualizado após chamada

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
    } catch(e2) {
      erros.push(`Fetch direto também falhou: ${e2.message}`)
      // Último recurso: extrair info da própria URL
      // URLs como vivareal.com.br/imovel/apartamento-3-quartos-dona-clara contêm dados úteis
      const urlPath = url.replace(/https?:\/\/[^/]+\//, '').replace(/[?#].*/,'').replace(/[-_/]/g, ' ')
      textoScrapeado = `URL do imóvel: ${url}\nDados extraídos da URL: ${urlPath}`
      onProgress?.('⚠️ Scrape falhou — analisando com dados da URL e IA')
    }
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

  // PASSO 3b: Jurimetria + métricas de bairro do banco
  let _jurimetria = [], _metricasBairro = null
  try {
    ;[_jurimetria, _metricasBairro] = await Promise.all([
      getJurimetriaVara(),
      camposBasicos.bairro ? getMetricasBairro(camposBasicos.bairro) : Promise.resolve(null)
    ])
  } catch(e) { /* banco opcional */ }

  // PASSO 4: Gemini Flash-Lite para campos complexos + scores + síntese
  onProgress?.('Gemini analisando imóvel (~$0.002)...')
  let analiseGemini = null
  try {
    const _eMercado = isMercadoDireto(camposBasicos.fonte_url || '', null)
    const prompt = buildPromptGemini(camposBasicos, textoScrapeado, contextoMercado, imovelContexto, _jurimetria, _metricasBairro, _eMercado)
    const { resultado: geminiResult, modeloUsado: geminiModelo } = await chamarGemini(prompt, geminiKey)
    analiseGemini = geminiResult
    _modeloGemini = geminiModelo
  } catch(e) {
    const errMsg = e.message || 'erro desconhecido'
    console.error('[AXIS Gemini] Erro detalhado:', errMsg)
    onProgress?.(`⚠️ Gemini erro: ${errMsg.substring(0, 120)}`)
    erros.push(`Gemini falhou: ${errMsg}`)
    _modeloGemini = 'regex_fallback' // Gemini realmente falhou
    // LANÇAR EXCEÇÃO para que a cascata do motorIA tente DeepSeek/Claude
    // (antes retornava silenciosamente, impedindo o fallback)
    const geminiErrMsg = errMsg.includes('401') ? 'Chave Gemini inválida' :
                         errMsg.includes('429') ? 'Quota Gemini excedida' :
                         errMsg.includes('404') ? 'Modelo Gemini não disponível' :
                         errMsg.includes('JSON') ? 'Gemini retornou resposta inválida' :
                         `Gemini falhou: ${errMsg.substring(0,80)}`
    // Só usar fallback silencioso se for reanálise (tem contexto) — para nova análise, propagar
    if (!imovelContexto) {
      throw new Error(geminiErrMsg)
    }
    // Fallback inteligente apenas em reanálise: preservar dados existentes
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

  // Fallback: calcular aluguel se Gemini retornou 0
  if ((!analiseGemini.aluguel_mensal_estimado || analiseGemini.aluguel_mensal_estimado === 0) &&
      analiseGemini.preco_m2_mercado > 0 && (camposBasicos.area_m2 || analiseGemini.area_m2)) {
    const area = camposBasicos.area_m2 || analiseGemini.area_m2
    const yieldMap = { Popular: 0.075, Médio: 0.060, Medio: 0.060, Alto: 0.050, Luxo: 0.040 }
    const yieldAnual = contextoMercado?.yield_bruto_pct ? contextoMercado.yield_bruto_pct / 100
      : yieldMap[analiseGemini.classe_ipead] || 0.060
    analiseGemini.aluguel_mensal_estimado = Math.round(analiseGemini.preco_m2_mercado * area * yieldAnual / 12)
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
    // Atributos do prédio: Gemini prioritário, regex fallback
    elevador: analiseGemini.elevador ?? camposBasicos.elevador ?? null,
    piscina: analiseGemini.piscina ?? camposBasicos.piscina ?? null,
    area_lazer: analiseGemini.area_lazer ?? camposBasicos.area_lazer ?? null,
    salao_festas: analiseGemini.salao_festas ?? camposBasicos.salao_festas ?? null,
    portaria_24h: analiseGemini.portaria_24h ?? camposBasicos.portaria_24h ?? null,
    condominio_mensal: analiseGemini.condominio_mensal || camposBasicos.condominio_mensal || null,
    banheiros: analiseGemini.banheiros || camposBasicos.banheiros || null,
    andar: analiseGemini.andar || camposBasicos.andar || null,
    fonte_url: url,
    analise_dupla_ia: false,
    _erros_extracao: erros,
    _modelo_usado: _modeloGemini,
  }

  // Mercado direto: setar preco_pedido e tipo_transacao
  const _eMercadoFinal = isMercadoDireto(url, analise.tipo_transacao)
  if (_eMercadoFinal) {
    analise.tipo_transacao = 'mercado_direto'
    analise.preco_pedido = analise.preco_pedido || analise.valor_minimo || 0
    // Limpar campos de leilão que não se aplicam
    if (!analise.num_leilao) analise.num_leilao = null
    if (!analise.data_leilao) analise.data_leilao = null
    if (!analise.modalidade_leilao) analise.modalidade_leilao = null
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
export async function logUsoGemini(imovelId, titulo, modelo = 'gemini-1.5-flash', sucesso = true) {
  try {
    const { logUsoChamadaAPI } = await import('./supabase.js')
    await logUsoChamadaAPI({
      tipo: 'analise_principal', modelo: modelo,
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
  } catch(e) {
    console.warn('[AXIS DeepSeek] scrape:', e.message)
    // Fallback: extrair da URL
    const urlPath = url.replace(/https?:\/\/[^/]+\//, '').replace(/[?#].*/,'').replace(/[-_/]/g, ' ')
    textoScrapeado = `URL do imóvel: ${url}\nDados extraídos da URL: ${urlPath}`
    const extraidos = extrairCamposTexto(textoScrapeado, url)
    camposBasicos = { ...camposBasicos, ...extraidos }
  }

  progress('DeepSeek V3 analisando (~$0.04)...')

  // Buscar jurimetria + métricas de bairro (mesmo padrão do Gemini)
  let _dsJurimetria = [], _dsMetricasBairro = null
  try {
    ;[_dsJurimetria, _dsMetricasBairro] = await Promise.all([
      getJurimetriaVara(),
      camposBasicos.bairro ? getMetricasBairro(camposBasicos.bairro) : Promise.resolve(null)
    ])
  } catch(e) { /* banco opcional */ }

  const _eMercadoDS = isMercadoDireto(camposBasicos?.fonte_url || '', null)
  const prompt = buildPromptGemini(camposBasicos, textoScrapeado, null, imovelContexto, _dsJurimetria, _dsMetricasBairro, _eMercadoDS)
  
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
    analise.fonte_url = url
    // Mercado direto: setar preco_pedido e tipo_transacao
    if (isMercadoDireto(url, analise.tipo_transacao)) {
      analise.tipo_transacao = 'mercado_direto'
      analise.preco_pedido = analise.preco_pedido || analise.valor_minimo || 0
    }
    progress('✅ Análise DeepSeek concluída (~R$ 0,08)')
    return analise
  } catch(e) {
    throw new Error(`DeepSeek falhou: ${e.message}`)
  }
}
