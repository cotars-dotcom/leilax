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

import { scrapeUrlJina, extrairCamposTexto, verificarQualidadeScrape } from './scraperImovel.js'
import { calcularScore, validarECorrigirAnalise } from './motorIA.js'
import { getMercadoComFallback, getJurimetriaVara, getMetricasBairro } from './supabase.js'
import { MODELOS_GEMINI } from './constants.js'
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
ATENÇÃO MÁXIMA: Este é um imóvel de MERCADO DIRETO — NÃO É LEILÃO.
- tipo_transacao = "mercado_direto"
- valor_minimo = preço pedido pelo vendedor (não é lance mínimo)
- num_leilao = null, data_leilao = null, modalidade_leilao = null, leiloeiro = null
- desconto_percentual = quanto o preço pedido está abaixo do valor real de mercado
- NUNCA mencione "leilão judicial", "arrematação", "edital" ou "praça" na síntese ou justificativa
- Na síntese, diga "compra de mercado" ou "oportunidade de mercado" em vez de "leilão"
- score_juridico para mercado direto: avaliar documentação do imóvel (matrícula, IPTU)
- Analise necessidade de reforma pelo padrão e idade estimada do imóvel
- Score de desconto: positivo se preço pedido < mercado real homogeneizado
` : ''
  const perfilIA = eMercadoDireto
    ? 'Você é especialista em avaliação imobiliária e investimentos no Brasil (BH/MG).'
    : 'Você é especialista em leilões judiciais imobiliários no Brasil (BH/MG) e avaliação imobiliária.'
  return `${ALERTAS_CRITICOS}${instrucaoTipo}${perfilIA}
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
  "comparaveis": [/* OBRIGATÓRIO: 3 a 5 imóveis do MESMO TIPO que o analisado (mesmo tipo, bairro/cidade, área similar ±40m²). NUNCA compare apartamento com terreno/casa. Preencher TODOS os campos. O campo 'bairro' é OBRIGATÓRIO para gerar links de busca. */
    {"descricao":"string","valor":0,"area_m2":0,"preco_m2":0,"quartos":0,"vagas":0,"tipo":"apartamento","fonte":"Gemini/conhecimento","similaridade":8,"link":null,"bairro":"nome_do_bairro","cidade":"nome_da_cidade"}],
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

ATRIBUTOS DO PRÉDIO — REGRAS CONSERVADORAS (só marcar true quando EXPLICITAMENTE mencionado no texto):
- elevador: true SOMENTE se texto menciona explicitamente "elevador", "andar alto" ou "cobertura". false se "sem elevador", "walk-up", "térreo", "sobrado" ou casas isoladas. null se não há menção.
- piscina: true SOMENTE se texto menciona explicitamente "piscina". "área de lazer completa" sozinho NÃO é suficiente. null se não há menção.
- area_lazer: true SOMENTE se menciona explicitamente playground, academia, churrasqueira, salão de jogos, quadra ou área gourmet. null se não há menção.
- salao_festas: true SOMENTE se menciona explicitamente salão de festas, espaço gourmet ou churrasqueira do condomínio. null se não há menção.
- portaria_24h: true SOMENTE se menciona porteiro, portaria 24h, segurança 24h. null se não há menção.
- condominio_mensal: extrair valor se mencionado (em R$/mês). Se não encontrar, estimar: Popular 200-400, Médio 400-700, Alto 700-1200, Luxo 1200+
- mobiliado: true/false/"semi" — verificar se imóvel vem com móveis planejados, armários embutidos etc.
- ATENÇÃO: Quando não há informação explícita, use null — NUNCA infira por associação (portaria ≠ piscina, alto padrão ≠ piscina, área de lazer ≠ piscina).
- ATENÇÃO: Bairros populares/médios (Dona Clara, Pampulha, norte BH) raramente têm piscina — não assuma sem menção explícita.
- score_liquidez: alta demanda→8.5, média→6.5, baixa→4.0
- score_mercado: classe Luxo BH→8.5, Alto→7.0, Médio→5.5, Popular→4.0

CLASSIFICAÇÃO DE DÉBITOS (responsabilidade_debitos):
- Se o edital ou documentos MENCIONAM débitos de condomínio/IPTU → use "arrematante" (STJ: obrigação propter rem, arrematante ciente = responsável)
- Se o edital diz expressamente "livre de ônus" ou "sub-rogado no preço" → use "sub_rogado"
- Se o edital exonera o arrematante → use "exonerado"
- Na DÚVIDA, use "arrematante" (mais conservador = mais seguro pro investidor)
- NUNCA use "sub_rogado" como default — só quando há evidência explícita de sub-rogação

FÓRMULA OBRIGATÓRIA DO SCORE TOTAL (NÃO INVENTE UM VALOR — CALCULE):
score_total = ROUND(score_localizacao×0.20 + score_desconto×0.18 + score_juridico×0.18 + score_ocupacao×0.15 + score_liquidez×0.15 + score_mercado×0.14, 2)
O score_total retornado DEVE ser matematicamente consistente com os sub-scores acima.`
}

// ─── CHAMADA GEMINI FLASH-LITE ───────────────────────────────────────────────
// ─── PROXY-FIRST: tenta Edge Function, fallback para chamada direta ──────
async function chamarGeminiComProxy(prompt, geminiKey, modelo) {
  // Tentar proxy server-side primeiro (Sprint 18 — keys protegidas)
  try {
    const { geminiViaProxy } = await import('./aiProxy.js')
    const { texto } = await geminiViaProxy(prompt, modelo, { maxOutputTokens: 8192, timeout: 60000 })
    if (!texto || texto.length < 10) throw new Error('Proxy: resposta vazia')
    const clean = texto.replace(/```json|```/g, '').trim()
    const jsonMatch = clean.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Proxy: JSON não encontrado')
    return JSON.parse(jsonMatch[0])
  } catch (proxyErr) {
    console.warn('[AXIS] Proxy falhou, fallback direto:', proxyErr.message?.substring(0, 80))
    // Fallback: chamada direta com key do localStorage
    if (!geminiKey) throw proxyErr
    return chamarGeminiModelo(prompt, geminiKey, modelo)
  }
}

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
    const errMsg = body.substring(0, 200)
    if (res.status === 404) throw new Error(`Modelo ${modelo} não encontrado (404)`)
    if (res.status === 401 || res.status === 403) throw new Error(`Chave Gemini inválida (${res.status})`)
    if (res.status === 429) throw new Error(`Quota Gemini excedida (429) — aguarde 1 min`)
    throw new Error(`Gemini ${res.status}: ${errMsg}`)
  }
  const data = await res.json()
  const txt = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  if (!txt || txt.length < 10) throw new Error('Gemini retornou resposta vazia')
  const clean = txt.replace(/```json|```/g, '').trim()
  const jsonMatch = clean.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Gemini não retornou JSON válido')
  return JSON.parse(jsonMatch[0])
}

// Cascata de modelos Gemini com retry limitado + backoff exponencial
async function chamarGemini(prompt, geminiKey) {
  const MODELOS = [...MODELOS_GEMINI]
  const MAX_RETRIES_429 = 3
  let ultimoErro = null
  let retries429 = 0
  
  for (let i = 0; i < MODELOS.length; i++) {
    const modelo = MODELOS[i]
    try {
      const resultado = await chamarGeminiComProxy(prompt, geminiKey, modelo)
      return { resultado, modeloUsado: modelo }
    } catch(e) {
      console.warn('[AXIS Gemini] Falhou com', modelo, ':', e.message.substring(0, 100))
      ultimoErro = e
      const msg = e.message || ''
      // Chave inválida → abortar
      if (msg.includes('API_KEY_INVALID') || msg.includes('401') || msg.includes('403')) {
        ultimoErro = new Error('Chave Gemini inválida — verifique em Admin > API Keys')
        break
      }
      // 429 rate limit → backoff exponencial com limite
      if (msg.includes('429') && retries429 < MAX_RETRIES_429) {
        retries429++
        const delay = Math.min(2000 * Math.pow(2, retries429 - 1), 16000) // 2s, 4s, 8s (max 16s)
        console.warn(`[AXIS Gemini] 429 rate limit, retry ${retries429}/${MAX_RETRIES_429} em ${delay}ms`)
        await new Promise(r => setTimeout(r, delay))
        i-- // Re-tentar o mesmo modelo
        continue
      }
      // 404 (modelo não existe) → próximo modelo
      if (msg.includes('404')) continue
    }
  }
  throw ultimoErro || new Error('Todos os modelos Gemini falharam')
}

// ─── GEMINI COM GOOGLE SEARCH GROUNDING (para sites SPA) ─────────────────────
// Quando o Jina falha em extrair dados (SPAs como QuintoAndar), usa o Gemini
// com Google Search Retrieval para buscar os dados reais do anúncio na web.
async function chamarGeminiComGrounding(url, geminiKey, camposBasicos, contextoMercado) {
  const modelo = MODELOS_GEMINI[0] // grounding só funciona com 2.0+
  const prompt = `Você é um analista imobiliário expert em BH/MG.

Preciso que você busque informações REAIS sobre este imóvel na web:
URL: ${url}

${camposBasicos.titulo ? `Título detectado: ${camposBasicos.titulo}` : ''}
${camposBasicos.cidade ? `Cidade: ${camposBasicos.cidade}` : ''}
${camposBasicos.bairro ? `Bairro: ${camposBasicos.bairro}` : ''}

IMPORTANTE: O scraper não conseguiu extrair os dados da página (provavelmente um SPA/React).
Use o Google Search para encontrar os dados REAIS do anúncio: preço, área, quartos, vagas, endereço, condomínio, fotos.

Retorne APENAS JSON válido com estes campos:
{
  "titulo": "string — título do anúncio",
  "valor_minimo": number — preço pedido em reais (sem centavos),
  "preco_pedido": number — mesmo que valor_minimo para mercado direto,
  "valor_avaliacao": number — estimativa de valor real de mercado,
  "valor_mercado_estimado": number — preço/m² × área,
  "area_m2": number,
  "area_privativa_m2": number,
  "quartos": number,
  "suites": number,
  "vagas": number,
  "bairro": "string",
  "cidade": "string",
  "estado": "MG",
  "tipo": "Apartamento|Casa|Cobertura|Sala Comercial",
  "endereco": "string",
  "condominio_mensal": number ou null,
  "andar": number ou null,
  "preco_m2_imovel": number,
  "preco_m2_mercado": number,
  "aluguel_mensal_estimado": number,
  "elevador": boolean ou null,
  "piscina": boolean ou null,
  "area_lazer": boolean ou null,
  "ocupacao": "desocupado|ocupado|incerto",
  "fotos": ["url1", "url2"],
  "foto_principal": "url",
  "score_localizacao": number 0-10,
  "score_desconto": number 0-10,
  "score_juridico": number 0-10,
  "score_ocupacao": number 0-10,
  "score_liquidez": number 0-10,
  "score_mercado": number 0-10,
  "justificativa": "string breve",
  "sintese_executiva": "string 2-3 frases",
  "recomendacao": "COMPRAR|AGUARDAR|EVITAR",
  "positivos": ["string"],
  "negativos": ["string"],
  "comparaveis": [{"descricao":"string","valor":number,"preco_m2":number,"area_m2":number,"quartos":number,"link":"url"}]
}

${contextoMercado ? `MERCADO LOCAL: ${JSON.stringify(contextoMercado)}` : ''}
Retorne APENAS o JSON, sem markdown, sem explicação.`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search_retrieval: { dynamic_retrieval_config: { mode: 'MODE_DYNAMIC', dynamic_threshold: 0.3 } } }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
      }),
      signal: AbortSignal.timeout(90000) // mais tempo para grounding
    }
  )

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Gemini Grounding ${res.status}: ${body.substring(0, 200)}`)
  }

  const data = await res.json()
  const txt = data.candidates?.[0]?.content?.parts
    ?.filter(p => p.text)
    ?.map(p => p.text)
    ?.join('') || ''
  
  if (!txt || txt.length < 10) throw new Error('Gemini Grounding retornou resposta vazia')
  const clean = txt.replace(/```json|```/g, '').trim()
  const jsonMatch = clean.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Gemini Grounding não retornou JSON válido')
  
  const resultado = JSON.parse(jsonMatch[0])
  resultado._modelo_usado = `${modelo}+grounding`
  resultado._grounding = true
  return resultado
}

// ─── MOTOR PRINCIPAL ─────────────────────────────────────────────────────────
export async function analisarComGemini(url, geminiKey, parametros, onProgress, imovelContexto = null) {
  const erros = []
  let _modeloGemini = MODELOS_GEMINI[0] // default, atualizado após chamada

  // PASSO 1: Scrape com Jina (grátis)
  onProgress?.('Coletando dados do imóvel (Jina AI)...')
  let textoScrapeado = ''
  let _scrapeQualidade = { ok: true, reason: 'OK' }
  try {
    textoScrapeado = await scrapeUrlJina(url)
    _scrapeQualidade = verificarQualidadeScrape(textoScrapeado, url)
    if (!_scrapeQualidade.ok) {
      erros.push(`Scrape baixa qualidade: ${_scrapeQualidade.detail}`)
      onProgress?.(`⚠️ Conteúdo da página insuficiente (${_scrapeQualidade.reason}) — tentando busca direta...`)
    }
  } catch(e) {
    erros.push(`Jina scrape falhou: ${e.message}`)
    _scrapeQualidade = { ok: false, reason: 'FAILED', detail: e.message }
    // Tentar fetch direto como fallback
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(15000) })
      textoScrapeado = await r.text()
      textoScrapeado = textoScrapeado.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
      _scrapeQualidade = verificarQualidadeScrape(textoScrapeado, url)
    } catch(e2) {
      erros.push(`Fetch direto também falhou: ${e2.message}`)
      // Último recurso: extrair info da própria URL
      const urlPath = url.replace(/https?:\/\/[^/]+\//, '').replace(/[?#].*/,'').replace(/[-_/]/g, ' ')
      textoScrapeado = `URL do imóvel: ${url}\nDados extraídos da URL: ${urlPath}`
      _scrapeQualidade = { ok: false, reason: 'URL_ONLY', detail: 'Apenas dados da URL' }
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

  // PASSO 4: Gemini Flash para campos complexos + scores + síntese
  // Se scrape teve qualidade ruim, tentar GROUNDING primeiro (busca na web via Google)
  let analiseGemini = null
  const usarGrounding = !_scrapeQualidade.ok
  
  if (usarGrounding) {
    // PASSO 4a: Tentar Gemini com Google Search Grounding
    onProgress?.('🔍 Buscando dados via Google Search (Gemini Grounding)...')
    try {
      analiseGemini = await chamarGeminiComGrounding(url, geminiKey, camposBasicos, contextoMercado)
      _modeloGemini = analiseGemini._modelo_usado || MODELOS_GEMINI[0]
      console.debug('[AXIS] Grounding sucesso — dados encontrados via Google Search')
    } catch(e) {
      erros.push(`Gemini Grounding falhou: ${e.message}`)
      console.warn('[AXIS] Grounding falhou:', e.message, '— tentando análise normal')
      // Continuar com análise normal abaixo
    }
  }

  if (!analiseGemini) {
    // PASSO 4b: Gemini normal (com texto scrapeado, mesmo que parcial)
    onProgress?.('Gemini analisando imóvel (~$0.002)...')
    try {
      const _eMercado = isMercadoDireto(camposBasicos.fonte_url || url, null)
      const prompt = buildPromptGemini(camposBasicos, textoScrapeado, contextoMercado, imovelContexto, _jurimetria, _metricasBairro, _eMercado)
      const { resultado: geminiResult, modeloUsado: geminiModelo } = await chamarGemini(prompt, geminiKey)
      analiseGemini = geminiResult
      _modeloGemini = geminiModelo
    } catch(e) {
      const errMsg = e.message || 'erro desconhecido'
      console.error('[AXIS Gemini] Erro detalhado:', errMsg)
      onProgress?.(`⚠️ Gemini erro: ${errMsg.substring(0, 120)}`)
      erros.push(`Gemini falhou: ${errMsg}`)
      _modeloGemini = 'regex_fallback'
      const geminiErrMsg = errMsg.includes('401') ? 'Chave Gemini inválida' :
                           errMsg.includes('429') ? 'Quota Gemini excedida' :
                           errMsg.includes('404') ? 'Modelo Gemini não disponível' :
                           errMsg.includes('JSON') ? 'Gemini retornou resposta inválida' :
                           `Gemini falhou: ${errMsg.substring(0,80)}`
      if (!imovelContexto) {
        throw new Error(geminiErrMsg)
      }
      if (imovelContexto && imovelContexto.score_total > 0) {
        analiseGemini = {
          ...imovelContexto,
          ...camposBasicos,
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
  }

  // PASSO 5: Mesclar campos básicos + Gemini (regex tem precedência para valores numéricos)
  // Garantir título nunca seja vazio ou genérico
  if (!analiseGemini.titulo || analiseGemini.titulo.length < 5 || analiseGemini.titulo.toLowerCase().includes('lote -')) {
    analiseGemini.titulo = camposBasicos.titulo || analiseGemini.titulo
  }

  // Fallback: calcular aluguel se Gemini retornou 0
  if ((!analiseGemini.aluguel_mensal_estimado || analiseGemini.aluguel_mensal_estimado === 0) &&
      analiseGemini.preco_m2_mercado > 0 && (camposBasicos.area_usada_calculo_m2 || camposBasicos.area_privativa_m2 || camposBasicos.area_m2 || analiseGemini.area_usada_calculo_m2 || analiseGemini.area_privativa_m2 || analiseGemini.area_m2)) {
    const area = camposBasicos.area_usada_calculo_m2 || camposBasicos.area_privativa_m2 || camposBasicos.area_m2 || analiseGemini.area_usada_calculo_m2 || analiseGemini.area_privativa_m2 || analiseGemini.area_m2
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
    // Validação anti-falso-positivo: se não há evidência textual, usar null em vez de true
    elevador: (() => {
      const v = analiseGemini.elevador ?? camposBasicos.elevador ?? null
      if (v !== true) return v
      const txt = (camposBasicos._textoRaw || camposBasicos.titulo || '').toLowerCase()
      const pm2 = parseFloat(analiseGemini.preco_m2_mercado || analiseGemini.preco_m2_imovel || camposBasicos.preco_m2_mercado) || 0
      const area = parseFloat(analiseGemini.area_m2 || camposBasicos.area_m2) || 0
      if (!txt.includes('elevador') && !txt.includes('andar') && !txt.includes('cobertura') && pm2 < 9000 && area < 150) return null
      return true
    })(),
    piscina: (() => {
      const v = analiseGemini.piscina ?? camposBasicos.piscina ?? null
      if (v !== true) return v
      const txt = (camposBasicos._textoRaw || camposBasicos.titulo || '').toLowerCase()
      if (!txt.includes('piscina')) return null
      return true
    })(),
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
    analise.num_leilao = null
    analise.data_leilao = null
    analise.modalidade_leilao = null
    analise.leiloeiro = null
    // Limpar síntese/justificativa que mencionam leilão por engano
    const leilaoTermos = /leil[ãa]o\s*judicial|arrematação|arrematante|edital|praça|lance\s*mínimo|leiloeiro/gi
    if (analise.sintese_executiva && leilaoTermos.test(analise.sintese_executiva)) {
      analise.sintese_executiva = analise.sintese_executiva
        .replace(/leil[ãa]o\s*judicial/gi, 'compra de mercado')
        .replace(/arrematação/gi, 'aquisição')
        .replace(/arrematante/gi, 'comprador')
        .replace(/edital/gi, 'anúncio')
        .replace(/(?:1[ªº]|2[ªº])\s*praça/gi, 'negociação')
        .replace(/lance\s*mínimo/gi, 'preço pedido')
        .replace(/leiloeiro/gi, 'vendedor')
    }
    if (analise.justificativa && /leil[ãa]o|arrematação|edital|praça/i.test(analise.justificativa)) {
      analise.justificativa = analise.justificativa
        .replace(/leil[ãa]o\s*judicial/gi, 'compra de mercado')
        .replace(/leil[ãa]o/gi, 'mercado')
        .replace(/arrematação/gi, 'aquisição')
        .replace(/edital/gi, 'anúncio')
        .replace(/lance\s*mínimo/gi, 'preço pedido')
    }
  }

  // PASSO 5b: Gerar links de busca para comparáveis sem link
  if (analise.comparaveis?.length) {
    const cidadeComp = (analise.cidade || 'belo-horizonte').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-')
    analise.comparaveis = analise.comparaveis.map(c => {
      if (c.link) return c // já tem link
      const bairro = (c.bairro || analise.bairro || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-')
      const cid = (c.cidade || analise.cidade || 'belo-horizonte').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-')
      const q = c.quartos || ''
      const areaMin = c.area_m2 > 0 ? Math.round(c.area_m2 * 0.8) : ''
      const areaMax = c.area_m2 > 0 ? Math.round(c.area_m2 * 1.2) : ''
      const areaParam = areaMin ? `&areaMin=${areaMin}&areaMax=${areaMax}` : ''
      // Detectar tipo de imóvel para URL correta no VivaReal
      const tipoComp = (c.tipo || analise.tipo || 'apartamento').toLowerCase()
      const tipoSlug = tipoComp.includes('terreno') || tipoComp.includes('lote') ? 'terreno_residencial'
        : tipoComp.includes('cobertura') ? 'cobertura_residencial'
        : tipoComp.includes('casa') ? 'casa_residencial'
        : tipoComp.includes('sala') || tipoComp.includes('comercial') ? 'sala_comercial'
        : 'apartamento_residencial'
      // Gerar link VivaReal como principal (formato: /venda/minas-gerais/cidade/bairros/bairro/tipo/)
      c.link = `https://www.vivareal.com.br/venda/minas-gerais/${cid}/${bairro ? 'bairros/' + bairro + '/' : ''}${tipoSlug}/${q ? '?quartos=' + q : ''}${q && areaParam ? areaParam : (!q && areaParam ? '?' + areaParam.substring(1) : '')}`
      c._link_gerado = true // flag para UI saber que não é link direto
      // Garantir bairro e cidade
      if (!c.bairro) c.bairro = analise.bairro
      if (!c.cidade) c.cidade = analise.cidade
      return c
    })
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
        area_m2: analise.area_usada_calculo_m2 || analise.area_privativa_m2 || analise.area_m2,
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
export async function logUsoGemini(imovelId, titulo, modelo = MODELOS_GEMINI[0], sucesso = true) {
  try {
    const { logUsoChamadaAPI } = await import('./supabase.js')
    await logUsoChamadaAPI({
      tipo: 'analise_principal', modelo: modelo,
      tokensInput: 4000, tokensOutput: 1500,
      imovelId, imovelTitulo: titulo, sucesso
    })
  } catch(e) { /* grounding opcional */ }
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
    // Tentar proxy server-side primeiro (Sprint 18)
    let txt = ''
    try {
      const { deepseekViaProxy } = await import('./aiProxy.js')
      txt = await deepseekViaProxy([{ role: 'user', content: prompt }], { maxTokens: 4096, timeout: 90000 })
    } catch (proxyErr) {
      console.warn('[AXIS] DeepSeek proxy falhou, fallback direto:', proxyErr.message?.substring(0, 80))
      // Fallback: chamada direta
      if (!deepseekKey) throw proxyErr
      const r = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${deepseekKey}` },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 4096,
          temperature: 0.1
        }),
        signal: AbortSignal.timeout(90000)
      })
      if (!r.ok) {
        const body = await r.text().catch(() => '')
        throw new Error(`DeepSeek ${r.status}: ${body.substring(0, 100)}`)
      }
      const data = await r.json()
      txt = data.choices?.[0]?.message?.content || ''
    }
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
    // Gerar links para comparáveis sem link
    if (analise.comparaveis?.length) {
      analise.comparaveis = analise.comparaveis.map(c => {
        if (c.link) return c
        const bairro = (c.bairro || analise.bairro || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-')
        const cid = (c.cidade || analise.cidade || 'belo-horizonte').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-')
        const q = c.quartos || ''
        const aParam = c.area_m2 > 0 ? `&areaMin=${Math.round(c.area_m2 * 0.8)}&areaMax=${Math.round(c.area_m2 * 1.2)}` : ''
        const _tipo1 = (c.tipo || analise.tipo || '').toLowerCase()
        const _slug1 = _tipo1.includes('terreno')||_tipo1.includes('lote') ? 'terreno_residencial' : _tipo1.includes('cobertura') ? 'cobertura_residencial' : _tipo1.includes('casa') ? 'casa_residencial' : 'apartamento_residencial'
        c.link = `https://www.vivareal.com.br/venda/minas-gerais/${cid}/${bairro ? 'bairros/' + bairro + '/' : ''}${_slug1}/${q ? '?quartos=' + q : ''}${q && aParam ? aParam : (!q && aParam ? '?' + aParam.substring(1) : '')}`
        c._link_gerado = true
        if (!c.bairro) c.bairro = analise.bairro
        if (!c.cidade) c.cidade = analise.cidade
        return c
      })
    }
    return analise
  } catch(e) {
    throw new Error(`DeepSeek falhou: ${e.message}`)
  }
}

// ─── MOTOR GPT-4o-mini ───────────────────────────────────────────────────────
export async function analisarComGPT(url, openaiKey, parametros, onProgress) {
  const progress = onProgress || (() => {})
  
  // Scrape
  progress('📄 GPT: Lendo página...')
  const { scrapeUrlJina, extrairCamposTexto } = await import('./scraperImovel.js')
  let textoScrapeado = ''
  try {
    textoScrapeado = await scrapeUrlJina(url)
  } catch(e) { /* fallback below */ }
  
  const camposBasicos = extrairCamposTexto(textoScrapeado, url)
  
  // Build prompt (reuse same logic as Gemini)
  const _eMercado = isMercadoDireto(camposBasicos?.fonte_url || url, null)
  const prompt = buildPromptGemini(camposBasicos, textoScrapeado, null, null, null, null, _eMercado)
  
  progress('🧠 GPT-4o-mini processando...')
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4096,
      temperature: 0.1,
    }),
    signal: AbortSignal.timeout(90000)
  })
  if (!r.ok) {
    const body = await r.text().catch(() => '')
    throw new Error(`GPT ${r.status}: ${body.substring(0, 100)}`)
  }
  const data = await r.json()
  const txt = data.choices?.[0]?.message?.content || ''
  const clean = txt.replace(/```json|```/g, '').trim()
  const match = clean.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('GPT JSON inválido')
  
  const analise = JSON.parse(match[0])
  analise._modelo_usado = 'gpt-4o-mini'
  analise.fonte_url = url
  
  // Merge regex fields
  analise.valor_minimo = camposBasicos.valor_minimo > 0 ? camposBasicos.valor_minimo : analise.valor_minimo
  analise.valor_avaliacao = camposBasicos.valor_avaliacao || analise.valor_avaliacao
  analise.area_m2 = camposBasicos.area_m2 || analise.area_m2
  analise.quartos = camposBasicos.quartos || analise.quartos
  analise.vagas = camposBasicos.vagas || analise.vagas
  analise.elevador = analise.elevador ?? camposBasicos.elevador ?? null
  analise.piscina = analise.piscina ?? camposBasicos.piscina ?? null
  analise.area_lazer = analise.area_lazer ?? camposBasicos.area_lazer ?? null
  analise.salao_festas = analise.salao_festas ?? camposBasicos.salao_festas ?? null
  analise.portaria_24h = analise.portaria_24h ?? camposBasicos.portaria_24h ?? null
  analise.condominio_mensal = analise.condominio_mensal || camposBasicos.condominio_mensal || null
  analise.banheiros = analise.banheiros || camposBasicos.banheiros || null

  // ── VALIDAÇÃO ANTI-FALSO-POSITIVO DE ATRIBUTOS ─────────────────────────────
  // Se Gemini marcou piscina=true mas o texto fonte não contém "piscina" → anular
  const textoFonte = (camposBasicos._textoRaw || camposBasicos.titulo || '').toLowerCase()
  const menciona = (termo) => textoFonte.includes(termo)
  if (analise.piscina === true && !menciona('piscina')) {
    analise.piscina = null  // sem evidência textual → incerto, não penalizar
  }
  if (analise.elevador === true && !menciona('elevador') && !menciona('andar') && !menciona('cobertura')) {
    // Preservar true apenas se preco_m2 > 9000 (alto padrão inequívoco) OU area_m2 > 150
    const pm2 = parseFloat(analise.preco_m2_mercado || analise.preco_m2_imovel) || 0
    const area = parseFloat(analise.area_m2) || 0
    if (pm2 < 9000 && area < 150) analise.elevador = null
  }
  // ───────────────────────────────────────────────────────────────────────────
  
  // Mercado direto
  if (isMercadoDireto(url, analise.tipo_transacao)) {
    analise.tipo_transacao = 'mercado_direto'
    analise.preco_pedido = analise.preco_pedido || analise.valor_minimo || 0
  }
  
  // Gerar links para comparáveis
  if (analise.comparaveis?.length) {
    analise.comparaveis = analise.comparaveis.map(c => {
      if (c.link) return c
      const bairro = (c.bairro || analise.bairro || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-')
      const cid = (c.cidade || analise.cidade || 'belo-horizonte').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-')
      const _tipo2 = (c.tipo || analise.tipo || '').toLowerCase()
      const _slug2 = _tipo2.includes('terreno')||_tipo2.includes('lote') ? 'terreno_residencial' : _tipo2.includes('cobertura') ? 'cobertura_residencial' : _tipo2.includes('casa') ? 'casa_residencial' : 'apartamento_residencial'
      const _q2 = c.quartos || ''
      const _aParam2 = c.area_m2 > 0 ? `&areaMin=${Math.round(c.area_m2 * 0.8)}&areaMax=${Math.round(c.area_m2 * 1.2)}` : ''
      c.link = `https://www.vivareal.com.br/venda/minas-gerais/${cid}/${bairro ? 'bairros/' + bairro + '/' : ''}${_slug2}/${_q2 ? '?quartos=' + _q2 : ''}${_q2 && _aParam2 ? _aParam2 : (!_q2 && _aParam2 ? '?' + _aParam2.substring(1) : '')}`
      c._link_gerado = true
      if (!c.bairro) c.bairro = analise.bairro
      if (!c.cidade) c.cidade = analise.cidade
      return c
    })
  }
  
  progress('✅ GPT-4o-mini concluído')
  return analise
}
