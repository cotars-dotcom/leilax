// âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
// LEILAX â Motor Duplo de IA
// Fase 1: ChatGPT pesquisa dados de mercado na internet
// Fase 2: Claude recebe tudo + parÃ¢metros do banco e gera anÃ¡lise
// Fase 3: Score calculado com os pesos definidos pelo admin
// âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

import { detectarRegiao, getMercado } from '../data/mercado_regional.js'

const CLAUDE_MODEL = 'claude-sonnet-4-20250514'
const GPT_MODEL = 'gpt-4o'

const REGRAS_MODALIDADE_TEXTO = `
REGRAS CRÍTICAS POR MODALIDADE (APLIQUE SEMPRE):
LEILÃO JUDICIAL:
- IPTU anterior: STJ protege arrematante (sub-roga no preço) — risco baixo
- Condomínio anterior: CPC/2015 sub-roga no preço — risco médio
- Imóvel ocupado: ação de imissão na posse (prazo 4–24 meses, custo R$514–5.818)

LEILÃO EXTRAJUDICIAL / ALIENAÇÃO FIDUCIÁRIA:
- IPTU e condomínio: verificar edital — pode ser do comprador
- Imóvel ocupado: reintegração de posse (Lei 9.514 + STJ 2024, 60 dias legal, 4–24 meses real)

IMÓVEL CAIXA (leilão ou venda direta):
- IPTU: FICA COM O COMPRADOR (FAQ CAIXA oficial)
- Condomínio: FICA COM O COMPRADOR (FAQ CAIXA oficial)
- Comissão leiloeiro: 5% sobre o valor arrematado
- SEMPRE calcular esses custos no custo total da operação

BLOQUEIOS AUTOMÁTICOS:
- Divergência edital vs matrícula: score máximo 35, recomendação EVITAR
- Imóvel ocupado: score × 0.85
- Risco nota ≥ 9: penalizar -35 pontos no score

Para qualquer campo jurídico identificado, informe:
- modalidade_leilao detectada
- riscos presentes (lista de risco_id)
- custo_juridico_estimado total
- prazo_liberacao_estimado_meses
`

const REGRAS_REFORMA_TEXTO = `
PARÂMETROS DE CUSTO DE REFORMA — MG/BH/JF 2026
(apenas custo direto: mão de obra + materiais + terceirizados)
NÃO inclui: projeto, ART, administração, móveis, eletrodomésticos

ESCOPOS DISPONÍVEIS:
- refresh_giro: pintura + reparos + revisão pontual = R$200–520/m² (classe D a A)
- leve_funcional: refresh + piso + troca funcional = R$360–900/m²
- leve_reforcada_1_molhado: leve + 1 banheiro ou cozinha = R$620–1.450/m²

PACOTES DE SERVIÇO FIXOS:
- Pintura geral: R$3.500–9.000
- Revisão elétrica pontual: R$1.500–5.000
- Revisão hidráulica pontual: R$1.500–6.000
- Banheiro refresh: R$7.000–14.000
- Banheiro leve reforçado: R$14.000–22.000
- Cozinha refresh: R$10.000–20.000
- Cozinha leve reforçada: R$20.000–32.000

TETO ECONÔMICO (% do valor de mercado):
- Classe A (>R$12k/m²): 3% a 7%
- Classe B (R$8–12k/m²): 3% a 6%
- Classe C (R$5–8k/m²): 2,5% a 5%
- Classe D (<R$5k/m²): 2% a 4%

Se a reforma proposta superar o teto, penalizar score_financeiro.
Retornar no JSON: escopo_reforma, custo_reforma_estimado, alerta_sobrecap
`

// ââ FASE 1: ChatGPT pesquisa mercado e contexto do imÃ³vel ââââââââ

export async function pesquisarMercadoGPT(url, cidade, tipo, openaiKey) {
  if (!openaiKey) return null

  const prompt = `VocÃª Ã© um especialista em mercado imobiliÃ¡rio brasileiro com acesso Ã  internet.

Pesquise informaÃ§Ãµes sobre este imÃ³vel em leilÃ£o: ${url}

Pesquise tambÃ©m:
1. PreÃ§o mÃ©dio de ${tipo} em ${cidade} (R$/mÂ²)
2. TendÃªncia do mercado imobiliÃ¡rio em ${cidade} (Ãºltimos 6 meses)
3. Demanda por ${tipo} em ${cidade} para compra e locaÃ§Ã£o
4. Portais: venda-imoveis.caixa.gov.br, zapimoveis.com.br, vivareal.com.br
5. NotÃ­cias recentes sobre valorizaÃ§Ã£o ou desvalorizaÃ§Ã£o nessa regiÃ£o
6. Infraestrutura prÃ³xima: transporte, comÃ©rcio, escolas, hospitais

Retorne APENAS JSON vÃ¡lido (sem markdown):
{
  "preco_m2_mercado": number,
  "tendencia_mercado": "Alta|EstÃ¡vel|Queda",
  "demanda": "Alta|MÃ©dia|Baixa",
  "tempo_venda_meses": number,
  "aluguel_estimado": number,
  "infraestrutura": ["item1", "item2"],
  "noticias": ["noticia1", "noticia2"],
  "pontos_positivos": ["string1", "string2"],
  "pontos_negativos": ["string1", "string2"],
  "score_localizacao_sugerido": number,
  "score_mercado_sugerido": number,
  "observacoes_mercado": "string detalhada"
}`

  try {
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`
      },
      body: JSON.stringify({
        model: GPT_MODEL,
        max_output_tokens: 2000,
        tools: [{ type: 'web_search_preview' }],
        input: prompt
      })
    })

    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error?.message || `OpenAI erro ${res.status}`)
    }

    const data = await res.json()
    const txt = (data.output || [])
      .filter(o => o.type === 'message')
      .flatMap(o => o.content || [])
      .filter(c => c.type === 'output_text')
      .map(c => c.text)
      .join('') || ''
    return JSON.parse(txt.replace(/```json|```/g, '').trim())
  } catch (e) {
    console.warn('[LEILAX] ChatGPT indisponÃ­vel:', e.message)
    return null
  }
}

// ââ FASE 2: Claude analisa o link com todos os dados âââââââââââââ

export async function analisarComClaude(url, claudeKey, parametros, criterios, dadosGPT, anexos, contextoMercadoRegional) {
  const pesosInfo = (parametros || [])
    .map(p => `  - ${p.nome}: peso ${p.peso}% (dimensao: ${p.dimensao})`)
    .join('\n')

  const criteriosInfo = (criterios || [])
    .map(c => `  - ${c.nome} [${c.categoria}] tipo: ${c.tipo_valor}${c.obrigatorio ? ' â ï¸OBRIGATÃRIO' : ''}`)
    .join('\n')

  const contextoGPT = dadosGPT ? `
DADOS DE MERCADO PESQUISADOS PELO CHATGPT (use para enriquecer a anÃ¡lise):
- PreÃ§o mÃ©dio mÂ² na regiÃ£o: R$ ${dadosGPT.preco_m2_mercado || 'nÃ£o encontrado'}
- TendÃªncia: ${dadosGPT.tendencia_mercado || 'nÃ£o encontrado'}
- Demanda: ${dadosGPT.demanda || 'nÃ£o encontrado'}
- Tempo mÃ©dio de venda: ${dadosGPT.tempo_venda_meses || '?'} meses
- Aluguel estimado: R$ ${dadosGPT.aluguel_estimado || 'nÃ£o encontrado'}/mÃªs
- Infraestrutura: ${(dadosGPT.infraestrutura || []).join(', ')}
- ObservaÃ§Ãµes de mercado: ${dadosGPT.observacoes_mercado || ''}
- Score localizaÃ§Ã£o sugerido pelo ChatGPT: ${dadosGPT.score_localizacao_sugerido || 'nÃ£o calculado'}
- Score mercado sugerido pelo ChatGPT: ${dadosGPT.score_mercado_sugerido || 'nÃ£o calculado'}
` : `
NOTA: ChatGPT nÃ£o disponÃ­vel no momento. Use seu conhecimento para estimar dados de mercado.
`

  const prompt = `VocÃª Ã© um especialista em anÃ¡lise de imÃ³veis em leilÃ£o no Brasil.

Acesse e analise este imÃ³vel: ${url}

${contextoGPT}
${contextoMercadoRegional || ''}
${REGRAS_MODALIDADE_TEXTO}
${REGRAS_REFORMA_TEXTO}

PESOS DE SCORE DEFINIDOS PELO GRUPO PARA ESTE APP (USE ESTES PESOS EXATOS):
${pesosInfo || '  - LocalizaÃ§Ã£o: 20%, Desconto: 18%, JurÃ­dico: 18%, OcupaÃ§Ã£o: 15%, Liquidez: 15%, Mercado: 14%'}

CRITÃRIOS ADICIONAIS DE AVALIAÃÃO DO GRUPO:
${criteriosInfo || '  (nenhum critÃ©rio personalizado cadastrado)'}

INSTRUÃÃES:
1. Acesse a URL e extraia todos os dados disponÃ­veis do imÃ³vel
2. Use os dados do ChatGPT para calibrar scores de localizaÃ§Ã£o e mercado
3. Calcule o score_total como mÃ©dia ponderada usando os pesos acima
4. Aplique penalizaÃ§Ãµes: juridico<4 â Ã0.75; ocupado â Ã0.85
5. Seja conservador nas estimativas de retorno
6. Indique estrutura de aquisiÃ§Ã£o ideal (CPF, CondomÃ­nio, PJ, ProcuraÃ§Ã£o)

RETORNE APENAS JSON VÃLIDO (sem markdown, sem texto fora do JSON):
{
  "titulo": "string",
  "endereco": "string",
  "cidade": "string",
  "estado": "UF 2 letras",
  "tipo": "Apartamento|Casa|Terreno|Comercial|GalpÃ£o|Rural",
  "area_m2": 0,
  "quartos": 0,
  "vagas": 0,
  "modalidade": "string",
  "leiloeiro": "string",
  "data_leilao": "DD/MM/AAAA ou null",
  "valor_avaliacao": 0,
  "valor_minimo": 0,
  "desconto_percentual": 0,
  "ocupacao": "Desocupado|Ocupado|Desconhecido",
  "financiavel": true,
  "fgts_aceito": false,
  "debitos_condominio": "string",
  "debitos_iptu": "string",
  "processos_ativos": "string",
  "matricula_status": "string",
  "obs_juridicas": "string",
  "preco_m2_imovel": 0,
  "preco_m2_mercado": 0,
  "aluguel_mensal_estimado": 0,
  "liquidez": "Alta|MÃ©dia|Baixa",
  "prazo_revenda_meses": 0,
  "score_localizacao": 0,
  "score_desconto": 0,
  "score_juridico": 0,
  "score_ocupacao": 0,
  "score_liquidez": 0,
  "score_mercado": 0,
  "positivos": ["string1","string2","string3"],
  "negativos": ["string1","string2"],
  "alertas": ["string1"],
  "recomendacao": "COMPRAR|AGUARDAR|EVITAR",
  "justificativa": "string detalhada explicando a recomendaÃ§Ã£o",
  "estrutura_recomendada": "CPF Ãºnico|CondomÃ­nio VoluntÃ¡rio|PJ|ProcuraÃ§Ã£o",
  "custo_regularizacao": 0,
  "custo_reforma": 0,
  "retorno_venda_pct": 0,
  "retorno_locacao_anual_pct": 0,
  "mercado_tendencia": "Alta|EstÃ¡vel|Queda",
  "mercado_demanda": "Alta|MÃ©dia|Baixa",
  "mercado_tempo_venda_meses": 0,
  "mercado_obs": "string",
  "modalidade_leilao": "judicial|extrajudicial_fiduciario|caixa_leilao|caixa_venda_direta",
  "riscos_presentes": ["risco_id1","risco_id2"],
  "custo_juridico_estimado": 0,
  "prazo_liberacao_estimado_meses": 0,
  "escopo_reforma": "refresh_giro|leve_funcional|leve_reforcada_1_molhado",
  "custo_reforma_estimado": 0,
  "alerta_sobrecap": "verde|amarelo|vermelho"
}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': claudeKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: (() => {
        const parts = [{type:'text',text:prompt}]
        if(anexos && anexos.length > 0) {
          anexos.forEach(a => {
            if(a.type === 'image' && a.data) {
              const match = a.data.match(/^data:(image\/[^;]+);base64,(.+)$/)
              if(match) parts.push({type:'image',source:{type:'base64',media_type:match[1],data:match[2]}})
            } else if(a.type === 'text' && a.data) {
              parts.push({type:'text',text:'\n\n--- Arquivo anexado: '+a.name+' ---\n'+a.data})
            }
          })
        }
        return parts
      })() }]
    })
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || `Claude erro ${res.status}`)
  }

  const data = await res.json()
  let txt = ''
  for (const block of (data.content || [])) {
    if (block.type === 'text') txt += block.text
    if (block.type === 'tool_result') {
      for (const inner of (block.content || [])) {
        if (inner.type === 'text') txt += inner.text
      }
    }
  }

  const jsonMatch = txt.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Claude nÃ£o retornou JSON vÃ¡lido')
  return JSON.parse(jsonMatch[0])
}

// ââ FASE 3: Calcular score total com pesos do banco ââââââââââââââ

export function calcularScore(analise, parametros) {
  const pesos = {}
  for (const p of (parametros || [])) {
    pesos[p.dimensao] = (p.peso || 0) / 100
  }

  const p = {
    localizacao: pesos.localizacao ?? 0.20,
    desconto:    pesos.desconto    ?? 0.18,
    juridico:    pesos.juridico    ?? 0.18,
    ocupacao:    pesos.ocupacao    ?? 0.15,
    liquidez:    pesos.liquidez    ?? 0.15,
    mercado:     pesos.mercado     ?? 0.14
  }

  let score =
    (analise.score_localizacao || 0) * p.localizacao +
    (analise.score_desconto    || 0) * p.desconto    +
    (analise.score_juridico    || 0) * p.juridico    +
    (analise.score_ocupacao    || 0) * p.ocupacao    +
    (analise.score_liquidez    || 0) * p.liquidez    +
    (analise.score_mercado     || 0) * p.mercado

  if ((analise.score_juridico || 0) < 4) score *= 0.75
  if (analise.ocupacao === 'Ocupado') score *= 0.85

  return Math.min(10, Math.max(0, parseFloat(score.toFixed(2))))
}

// ââ FUNÃÃO PRINCIPAL: orquestrar tudo âââââââââââââââââââââââââââ

export async function analisarImovelCompleto(url, claudeKey, openaiKey, parametros, criterios, onProgress, anexos) {
  const progress = onProgress || (() => {})

  const cidade = 'Brasil'
  const tipo = 'ImÃ³vel'

  progress('ð ChatGPT pesquisando dados de mercado na internet...')
  const dadosGPT = await pesquisarMercadoGPT(url, cidade, tipo, openaiKey)

  // Enriquecer com dados de mercado regional (se detectou região)
  if (dadosMercado) {
    const regiaoFinal = detectarRegiao(analise.cidade || '', analise.endereco || '')
    const mercadoFinal = regiaoFinal ? getMercado(regiaoFinal) : dadosMercado
    if (mercadoFinal) {
      if (!analise.preco_m2_mercado) analise.preco_m2_mercado = mercadoFinal.preco_m2_venda_medio
      if (!analise.aluguel_mensal_estimado && analise.area_m2)
        analise.aluguel_mensal_estimado = mercadoFinal.preco_m2_locacao * analise.area_m2
      if (!analise.mercado_tendencia) analise.mercado_tendencia = mercadoFinal.tendencia
      if (!analise.mercado_demanda) analise.mercado_demanda = mercadoFinal.demanda
      if (mercadoFinal.alertas && mercadoFinal.alertas.length)
        analise.alertas = [...(analise.alertas||[]), ...mercadoFinal.alertas]
    }
  }

  if (dadosGPT) {
    progress('â ChatGPT encontrou dados de mercado. Claude analisando o imÃ³vel...')
  } else {
    progress('â ï¸ ChatGPT indisponÃ­vel. Claude analisando com dados internos...')
  }

  // Detectar região e buscar dados de mercado local
  const regiaoDetectada = detectarRegiao(
    dadosGPT?.cidade || cidade || '',
    dadosGPT?.bairro || ''
  )
  const dadosMercado = regiaoDetectada ? getMercado(regiaoDetectada) : null
  const contextoMercadoRegional = dadosMercado ? `
DADOS DE MERCADO DA REGIÃO (use para calibrar os scores):
- Região: ${dadosMercado.label}
- Preço médio m²: R$ ${dadosMercado.preco_m2_venda_medio.toLocaleString('pt-BR')}
- Aluguel médio m²: R$ ${dadosMercado.preco_m2_locacao}/m²
- Tempo médio de venda: ${dadosMercado.tempo_venda_dias} dias
- Tendência 12 meses: ${dadosMercado.tendencia} (${dadosMercado.tendencia_pct_12m}%)
- Demanda atual: ${dadosMercado.demanda}
- Vacância regional: ${dadosMercado.vacancia_pct}%
- Yield bruto típico: ${dadosMercado.yield_bruto_pct}%
- Imóvel mais líquido: ${JSON.stringify(dadosMercado.imovel_mais_liquido)}
` : ''

  const analise = await analisarComClaude(url, claudeKey, parametros, criterios, dadosGPT, anexos, contextoMercadoRegional)

  progress('ð Calculando score com parÃ¢metros do grupo...')
  const score_total = calcularScore(analise, parametros)

  if (dadosGPT) {
    if (!analise.preco_m2_mercado && dadosGPT.preco_m2_mercado)
      analise.preco_m2_mercado = dadosGPT.preco_m2_mercado
    if (!analise.aluguel_mensal_estimado && dadosGPT.aluguel_estimado)
      analise.aluguel_mensal_estimado = dadosGPT.aluguel_estimado
    if (!analise.mercado_tendencia && dadosGPT.tendencia_mercado)
      analise.mercado_tendencia = dadosGPT.tendencia_mercado
    if (!analise.mercado_demanda && dadosGPT.demanda)
      analise.mercado_demanda = dadosGPT.demanda
    if (dadosGPT.pontos_positivos)
      analise.positivos = [...(analise.positivos||[]), ...dadosGPT.pontos_positivos]
    if (dadosGPT.noticias)
      analise.alertas = [...(analise.alertas||[]), ...dadosGPT.noticias.map(n => `ð° ${n}`)]
  }

  return {
    ...analise,
    score_total,
    regiao_mercado: regiaoDetectada || null,
    dados_mercado_regional: dadosMercado || null,
    id: `${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
    fonte_url: url,
    status: 'analisado',
    analise_dupla_ia: !!dadosGPT
  }
}
