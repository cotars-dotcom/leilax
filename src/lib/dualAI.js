// ═══════════════════════════════════════════════════════════════
// AXIS — Motor Duplo de IA
// Fase 1: ChatGPT pesquisa dados de mercado na internet
// Fase 2: Claude recebe tudo + parâmetros do banco e gera análise
// Fase 3: Score calculado com os pesos definidos pelo admin
// ═══════════════════════════════════════════════════════════════

import { detectarRegiao, getMercado } from '../data/mercado_regional.js'
import {
  BAIRROS_BH,
  getBairroDados,
  calcGapPrecoPct,
  getClasseIPEAD,
  REFERENCIAS_BH,
  YIELD_POR_ZONA,
} from '../data/metricas_bairros_bh.js'
import { calcularCustoReforma, verificarSobrecapitalizacao } from '../data/custos_reforma.js'
import { calcularCustoJuridico } from '../data/riscos_juridicos.js'

const CLAUDE_MODEL = 'claude-sonnet-4-20250514'
const GPT_MODEL_MARKET  = 'gpt-4o-mini'   // comparáveis e pesquisa de mercado (~16x mais barato)
const GPT_MODEL_COMPLEX = 'gpt-4o'        // fallback se mini falhar ou retornar sem dados

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

const REGRAS_COLETA_DADOS = `
REGRAS OBRIGATÓRIAS DE COLETA E ANÁLISE

--- DICIONÁRIO TÉCNICO DE ÁREA (NBR 12721 + Lei 4.591/64) ---
CAMPOS QUE O EDITAL PODE INFORMAR:
  area_privativa      → uso exclusivo da unidade (padrão de mercado para preço/m²)
  area_util           → interna varrível, sem paredes/pilares (~10-12% menor que privativa)
  area_comum          → espaços compartilhados do condomínio (não usar para preço/m²)
  area_total          → privativa + quota de área comum (não usar como base principal)
  area_real_total     → denominação registral: privativa real + fração de comum
  area_equivalente    → usada em incorporação para equivalência de custo

PRIORIDADE de leitura de área (use nesta ordem):
1. área_privativa (área exclusiva do proprietário — padrão ZAP/VivaReal)
2. área_construída (se não houver privativa)
3. área_total (NUNCA use para preço/m² — inclui área comum)

TIPOLOGIAS ESPECIAIS:
COBERTURA DUPLEX (2 andares, terraço):
  A área privativa TOTAL já inclui os dois andares + terraço
  → usar area_privativa_total como base de comparação (é tudo do proprietário)
  → separar: area_coberta (interno) + area_descoberta (terraço)
  → terraço vale menos por m² que área coberta, mas ambos são privativos
  Exemplo: edital "135,49m² priv / 156,19m² priv total / 247,60m² real total"
  → area_coberta_privativa = 135,49m² (fechado dos 2 andares)
  → area_privativa = 156,19m² (fechado + varandas)
  → area_real_total = 247,60m² (com fração comum — NÃO usar)
  → area_usada_calculo = 156,19m² (privativa total)

APARTAMENTO GARDEN:
  area_interna = área coberta exclusiva → usar para preço/m²
  area_externa = jardim privativo → valor menor por m²

CASA EM CONDOMÍNIO:
  area_construida = área da casa → usar para preço/m²
  area_terreno = lote privativo → guardar separado

REGRA DE DECISÃO AUTOMÁTICA:
Se apenas UMA área informada: é provavelmente a privativa. Usar como base.
Se DUAS áreas: menor = fechada, maior = privativa total → usar a MAIOR
Se TRÊS áreas: menor = fechada, média = privativa total, maior = real total
  → usar a MÉDIA (privativa total) como base de preço/m²

CAMPOS OBRIGATÓRIOS NO JSON:
  area_privativa_m2: número (exclusiva total)
  area_coberta_privativa_m2: número (apenas fechada/coberta)
  area_descoberta_privativa_m2: número (terraço/varanda descoberta)
  area_total_m2: número (com fração comum — registral)
  area_usada_calculo_m2: número (qual foi usada para preço/m²)
  area_usada_label: "string explicando a escolha"

--- AVALIAÇÃO E LANCE ---
AVALIAÇÃO JUDICIAL ≠ VALOR DE MERCADO:
  - avaliação_judicial: valor definido pelo perito do processo
  - valor_mercado_real: o que imóvel similar vende no mercado livre
  - lance_minimo: geralmente 60-70% da avaliação no 2º leilão
  - lance_atual: o último lance registrado no portal (se houver)
Para calcular desconto, use SEMPRE:
  desconto_sobre_avaliacao = (avaliacao - lance_minimo) / avaliacao
  desconto_sobre_mercado = (valor_mercado_real - lance_minimo) / valor_mercado_real
NUNCA invente a avaliação. Se não encontrar no edital, marque como null.

--- CUSTO TOTAL DE AQUISIÇÃO ---
Sempre calcular o custo real total:
  custo_total = lance + comissao_leiloeiro + itbi + registro + honorarios
Comissão leiloeiro:
  - Padrão: 5% sobre o valor arrematado
  - Sempre pago pelo ARREMATANTE (não pelo vendedor)
  - Incluir no custo total obrigatoriamente
ITBI:
  - Belo Horizonte: 3%
  - Contagem, Betim, Nova Lima: 2%
  - Juiz de Fora: 2%
  - Outros MG: estimativa 2%
  - Base de cálculo: valor arrematado ou avaliação (o maior)

--- COMPARAÇÃO COM MERCADO ---
Para definir preco_m2_mercado, use esta hierarquia:
1. Anúncios COMPARÁVEIS da mesma rua ou condomínio (mais preciso)
2. Anúncios comparáveis do mesmo bairro/tipologia
3. Dados ZAP/VivaReal do bairro para a tipologia específica
4. Dados gerais do bairro como fallback
TIPOLOGIA importa muito para comparação:
  Cobertura duplex ≠ apartamento padrão
  Studio ≠ 1 quarto
  Casa em condomínio ≠ apartamento
Se o imóvel for cobertura, penthouse, duplex ou diferenciado:
  → buscar comparáveis específicos dessa tipologia
  → não usar média geral do bairro como referência

--- PASSIVOS (IPTU, CONDOMÍNIO) ---
Regra por modalidade (CRÍTICO):
LEILÃO JUDICIAL (CPC/2015):
  - Se edital NÃO menciona nada → débitos se sub-rogam no preço (não é do arrematante)
  - Se edital EXPRESSAMENTE exonera o arrematante → marcar como ponto positivo (+15 pts jurídico)
  - Risco financeiro: BAIXO a NULO para o arrematante
LEILÃO CAIXA / EXTRAJUDICIAL:
  - IPTU e condomínio ficam com o COMPRADOR (FAQ CAIXA oficial)
  - Risco financeiro: ALTO — calcular e incluir no custo total
EXTINÇÃO DE CONDOMÍNIO (caso especial):
  - Modalidade onde coproprietários encerram condomínio voluntário
  - Débitos costumam ser resolvidos entre as partes, não pelo arrematante
  - Geralmente positivo juridicamente

--- ALERTAS E CONSISTÊNCIA ---
NUNCA gerar alerta que contradiga o score:
  Se score_liquidez >= 70 → NÃO incluir alerta "baixa_liquidez"
  Se score_juridico >= 75 → NÃO incluir alerta de risco jurídico alto
  Se imóvel desocupado confirmado → NÃO incluir alerta de ocupação
Alertas devem ser ACIONÁVEIS:
  Errado: "muito_baixa_liquidez" (código interno, não útil)
  Correto: "Confirmar ocupação presencialmente antes do lance"
  Correto: "Solicitar certidão de matrícula atualizada (30 dias)"
  Correto: "Verificar se condomínio aceitará novo proprietário"

IMPORTANTE: NAO use emojis nos campos de texto (alertas, positivos, negativos).
Use APENAS tags de texto: [CRITICO] [ATENCAO] [OK] [INFO]
Emojis corrompem o encoding UTF-8 no pipeline de processamento.

--- REGIÃO GEOGRÁFICA ---
Identificar corretamente a cidade/bairro:
  Contagem ≠ Belo Horizonte (são municípios diferentes)
  Nova Lima ≠ BH (município diferente, preço/m² muito maior)
  Betim ≠ BH
  Juiz de Fora = cidade própria, não RMBH
Para Contagem, usar dados de Contagem (ZAP: ~R$4.200-5.800/m²)
Para BH Centro-Sul, usar dados de BH (ZAP: ~R$12.000-15.000/m²)
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

// ── FASE 1: ChatGPT pesquisa mercado e contexto do imóvel ────────

export async function pesquisarMercadoGPT(url, cidade, tipo, openaiKey) {
  if (!openaiKey) return null

  // Cache de mercado 72h — evitar chamar ChatGPT para mesma URL
  const cacheKey = `mkt_${(url||'').replace(/[^a-zA-Z0-9]/g,'_').slice(0,120)}`
  try {
    const { supabase } = await import('./supabase')
    const { data: cached } = await supabase
      .from('cache_mercado')
      .select('dados, atualizado_em')
      .eq('chave', cacheKey)
      .single()
    if (cached?.atualizado_em) {
      const horas = (Date.now() - new Date(cached.atualizado_em)) / 3_600_000
      if (horas < 72) {
        console.log('[AXIS Cache] Mercado em cache para:', cacheKey)
        return cached.dados
      }
    }
  } catch(e) { console.warn('[AXIS dualAI] Cache mercado read:', e.message) }

  const prompt = `Você é um especialista em mercado imobiliário brasileiro.
Sempre responda em português com acentos corretos (ã, ç, é, ê, ó, ô, í, ú, à).
Pesquise na internet dados ATUAIS sobre este imóvel de leilão: ${url}

REGRAS DE PESQUISA:
1. IDENTIFICAR O IMÓVEL CORRETAMENTE:
   - Leia o endereço completo: rua, número, bairro, cidade, UF
   - Não confundir município: Contagem ≠ BH, Nova Lima ≠ BH
   - Identificar tipologia: apartamento, cobertura, duplex, casa, studio

2. PESQUISAR COMPARÁVEIS:
   Busque no ZAP, VivaReal e OLX:
   - Imóveis da mesma RUA (mais preciso)
   - Imóveis do mesmo BAIRRO com tipologia similar
   - Imóveis do mesmo BAIRRO com área similar (±30m²)
   Para COBERTURA ou DUPLEX:
   - Buscar especificamente "cobertura [bairro] [cidade]"
   - Não comparar com apartamento padrão
   Para cada comparável, preencher OBRIGATORIAMENTE todos os campos:
   - descricao: endereço ou nome do condomínio
   - valor: preço total em R$, area_m2, preco_m2: valor/area
   - quartos, vagas: números, tipo: apartamento|cobertura|casa
   - andar, condominio_mes: se disponível
   - link: URL COMPLETA do anúncio (obrigatório — não deixar null se encontrou)
   - fonte: "ZAP"|"VivaReal"|"OLX"|"QuintoAndar"
   - similaridade: 0-10 (mesmo tipo +3, área ±20% +3, quartos iguais +2, vagas +1, bairro +1)
   Retornar apenas comparáveis com similaridade >= 6.0, ordenados do mais similar.
   Se não encontrar nenhum comparável com link real, retornar array vazio — não inventar.

3. COLETAR PREÇO/m² CORRETO:
   - Usar ZAP Imóveis → seção "Quanto vale o m² em [bairro]?"
   - Anotar: preço médio geral E preço por tipologia/tamanho
   - Anotar a fonte exatamente (URL)

4. INFORMAÇÕES DO LEILÃO:
   - Confirmar valor de avaliação judicial no edital
   - Confirmar lance mínimo atual
   - Verificar se há lances já registrados
   - Verificar data e hora do leilão

5. SITUAÇÃO JURÍDICA (preencher campos com dados REAIS, não genéricos):
   - processos_ativos: listar processos reais (ex: "Execução nº 0001234-56.2024.5.03.0001")
     Se não houver: "Nenhum processo identificado no edital"
   - matricula_status: estado real da matrícula
     (ex: "Matrícula nº 45.123 — penhora R$120.000") Se limpa: "Matrícula sem ônus aparentes"
   - obs_juridicas: observações específicas do caso
     (ex: "IPTU 2019-2022 R$8.400 sub-rogado no preço") Se nada: "Sem observações adicionais"
   - riscos_presentes: mapear para IDs do sistema:
     ocupado→"ocupacao_judicial", inquilino→"inquilino_regular", penhora→"penhora_simples",
     embargo→"embargo_arrematacao", iptu+caixa→"iptu_previo_caixa", iptu+judicial→"iptu_previo_judicial"
   - Verificar modalidade (judicial/extrajudicial/extinção condomínio)
   - Verificar matrícula se disponível

6. Preço médio de ${tipo} em ${cidade} (R$/m²)
7. Tendência do mercado imobiliário em ${cidade} (últimos 6 meses)
8. Demanda por ${tipo} em ${cidade} para compra e locação
9. Infraestrutura próxima: transporte, comércio, escolas, hospitais

Retorne APENAS JSON válido (sem markdown):
{
  "cidade": "string",
  "bairro": "string",
  "tipologia": "string",
  "preco_m2_mercado": number,
  "preco_m2_fonte": "string (URL ou descrição da fonte)",
  "comparaveis": [
    {"descricao": "string", "valor": number, "area_m2": number, "preco_m2": number,
     "quartos": number, "vagas": number, "tipo": "apartamento|cobertura|casa|comercial",
     "andar": null, "condominio_mes": null, "link": "URL ou null", "fonte": "ZAP|VivaReal|OLX",
     "similaridade": 8.5}
  ],
  "valor_avaliacao_encontrado": null,
  "lance_minimo_encontrado": null,
  "tendencia_mercado": "Alta|Estável|Queda",
  "demanda": "Alta|Média|Baixa",
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

  // Função interna de fetch com model paramétrico
  const fetchMercado = async (model) => {
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`
      },
      body: JSON.stringify({
        model,
        max_output_tokens: 3000,
        tools: [{ type: 'web_search_preview' }],
        input: prompt
      }),
      signal: AbortSignal.timeout(45000)
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
    const resultado = JSON.parse(txt.replace(/```json|```/g, '').trim())
    return { resultado, data, model }
  }

  try {
    let modeloUsado = GPT_MODEL_MARKET
    let resultado, data

    // Cascade: tenta mini primeiro, fallback para full se falhar ou sem dados de mercado
    try {
      ;({ resultado, data } = await fetchMercado(GPT_MODEL_MARKET))
      if (!resultado?.valor_mercado_m2) {
        console.warn('[AXIS] GPT-mini sem valor_mercado_m2, escalando para GPT-4o')
        ;({ resultado, data, model: modeloUsado } = await fetchMercado(GPT_MODEL_COMPLEX))
      }
    } catch(e) {
      console.warn('[AXIS] GPT-mini falhou, escalando para GPT-4o:', e.message)
      ;({ resultado, data, model: modeloUsado } = await fetchMercado(GPT_MODEL_COMPLEX))
    }
    // Log de uso ChatGPT
    try {
      const { logUsoChamadaAPI } = await import('./supabase')
      logUsoChamadaAPI({
        tipo: 'mercado_chatgpt', modelo: modeloUsado,
        tokensInput: data.usage?.input_tokens || data.usage?.prompt_tokens || 0,
        tokensOutput: data.usage?.output_tokens || data.usage?.completion_tokens || 0,
        modoTeste: localStorage.getItem('axis-modo-teste') === 'true',
      })
    } catch(e) { console.warn('[AXIS dualAI] Log uso GPT:', e.message) }
    // Salvar no cache com TTL variável por bairro
    try {
      const { supabase } = await import('./supabase')
      const bairroCache = resultado?.bairro || ''
      const bairrosNobres = ['Savassi','Lourdes','Belvedere','Serra','Funcionários',
        'Buritis','Gutierrez','Mangabeiras','Santo Antônio','Jardim América']
      const ttlHoras = bairrosNobres.includes(bairroCache) ? 168 : 72
      const expiraEm = new Date(Date.now() + ttlHoras * 3600 * 1000).toISOString()
      await supabase.from('cache_mercado').upsert({
        chave: cacheKey,
        dados: resultado,
        atualizado_em: new Date().toISOString(),
        expira_em: expiraEm
      }, { onConflict: 'chave' })
    } catch(e) { console.warn('[AXIS Cache] Falha ao salvar cache:', e.message) }
    return resultado
  } catch (e) {
    console.warn('[AXIS] ChatGPT indisponível:', e.message)
    return null
  }
}

// ── FASE 2: Claude analisa o link com todos os dados ─────────────

export async function analisarComClaude(url, claudeKey, parametros, criterios, dadosGPT, anexos, contextoMercadoRegional) {
  const pesosInfo = (parametros || [])
    .map(p => `  - ${p.nome}: peso ${p.peso}% (dimensao: ${p.dimensao})`)
    .join('\n')

  const criteriosInfo = (criterios || [])
    .map(c => `  - ${c.nome} [${c.categoria}] tipo: ${c.tipo_valor}${c.obrigatorio ? ' ⚠️OBRIGATÓRIO' : ''}`)
    .join('\n')

  const comparaveisTexto = (dadosGPT?.comparaveis || [])
    .map(c => `    - ${c.descricao}: R$ ${c.valor?.toLocaleString('pt-BR')} (${c.area_m2}m² = R$ ${c.preco_m2}/m²)${c.quartos?` ${c.quartos}Q`:''}${c.vagas?` ${c.vagas}V`:''}${c.tipo?` [${c.tipo}]`:''}${c.similaridade?` sim=${c.similaridade}`:''}`)
    .join('\n')

  const contextoGPT = dadosGPT ? `
DADOS DE MERCADO PESQUISADOS PELO CHATGPT (use para enriquecer a análise):
- Cidade/Bairro identificado: ${dadosGPT.cidade || '?'} / ${dadosGPT.bairro || '?'}
- Tipologia: ${dadosGPT.tipologia || '?'}
- Preço médio m² na região: R$ ${dadosGPT.preco_m2_mercado || 'não encontrado'}
- Fonte do preço/m²: ${dadosGPT.preco_m2_fonte || 'não informado'}
- Tendência: ${dadosGPT.tendencia_mercado || 'não encontrado'}
- Demanda: ${dadosGPT.demanda || 'não encontrado'}
- Tempo médio de venda: ${dadosGPT.tempo_venda_meses || '?'} meses
- Aluguel estimado: R$ ${dadosGPT.aluguel_estimado || 'não encontrado'}/mês
- Infraestrutura: ${(dadosGPT.infraestrutura || []).join(', ')}
- Observações de mercado: ${dadosGPT.observacoes_mercado || ''}
${comparaveisTexto ? `- Comparáveis encontrados:\n${comparaveisTexto}` : ''}
- Avaliação judicial encontrada: ${dadosGPT.valor_avaliacao_encontrado || 'não verificado'}
- Lance mínimo encontrado: ${dadosGPT.lance_minimo_encontrado || 'não verificado'}
- Score localização sugerido pelo ChatGPT: ${dadosGPT.score_localizacao_sugerido || 'não calculado'}
- Score mercado sugerido pelo ChatGPT: ${dadosGPT.score_mercado_sugerido || 'não calculado'}
` : `
NOTA: ChatGPT não disponível no momento. Use seu conhecimento para estimar dados de mercado.
`

  const prompt = `Você é um especialista em análise de imóveis em leilão no Brasil.
Sempre responda em português com acentos corretos (ã, ç, é, ê, ó, ô, í, ú, à).

Acesse e analise este imóvel: ${url}

${REGRAS_COLETA_DADOS}
${contextoGPT}
${contextoMercadoRegional || ''}
${REGRAS_MODALIDADE_TEXTO}
${REGRAS_REFORMA_TEXTO}

PESOS DE SCORE DEFINIDOS PELO GRUPO PARA ESTE APP (USE ESTES PESOS EXATOS):
${pesosInfo || '  - Localização: 20%, Desconto: 18%, Jurídico: 18%, Ocupação: 15%, Liquidez: 15%, Mercado: 14%'}

CRITÉRIOS ADICIONAIS DE AVALIAÇÃO DO GRUPO:
${criteriosInfo || '  (nenhum critério personalizado cadastrado)'}

INSTRUÇÕES:
1. Acesse a URL e extraia todos os dados disponíveis do imóvel
2. Use os dados do ChatGPT para calibrar scores de localização e mercado
3. Calcule o score_total como média ponderada usando os pesos acima
4. Aplique penalizações: juridico<4 → ×0.75; ocupado → ×0.85
5. Seja conservador nas estimativas de retorno
6. Indique estrutura de aquisição ideal (CPF, Condomínio, PJ, Procuração)

RETORNE APENAS JSON VÁLIDO (sem markdown, sem texto fora do JSON).
NUNCA omitir campos obrigatórios. Use null se não souber.
NUNCA usar area_total_m2 para calcular preco_m2_imovel.
NAO use emojis diretamente nos campos alertas, positivos e negativos.
Use apenas tags de texto: [CRITICO] [ATENCAO] [OK] [INFO]
{
  "titulo": "string",
  "endereco": "string",
  "cidade": "string",
  "estado": "UF 2 letras",
  "bairro": "string",
  "tipo": "Apartamento|Casa|Terreno|Comercial|Galpão|Rural|Cobertura",
  "tipologia": "apartamento_padrao|cobertura_linear|cobertura_duplex|apartamento_garden|apartamento_duplex|casa|studio|loft",
  "area_privativa_m2": null,
  "area_coberta_privativa_m2": null,
  "area_descoberta_privativa_m2": null,
  "area_total_m2": null,
  "area_real_total_m2": null,
  "area_usada_calculo_m2": 0,
  "area_usada_label": "string explicando a área escolhida",
  "area_m2": 0,
  "quartos": 0,
  "suites": null,
  "vagas": 0,
  "andar": null,
  "andares_unidade": null,
  "elevador": null,
  "condominio_mensal": null,
  "padrao_acabamento": "simples|medio|alto|luxo",
  "vaga_tipo": "privativa_vinculada|privativa_autonoma|comum_rotativa|null",
  "modalidade": "string",
  "modalidade_leilao": "judicial|extrajudicial_fiduciario|caixa_leilao|caixa_venda_direta|extincao_condominio",
  "processo_numero": null,
  "leiloeiro": "string",
  "data_leilao": "DD/MM/AAAA ou null",
  "num_leilao": null,
  "valor_avaliacao": null,
  "valor_minimo": 0,
  "valor_lance_atual": null,
  "desconto_percentual": 0,
  "comissao_leiloeiro_pct": 5,
  "itbi_pct": 2,
  "custo_total_aquisicao": 0,
  "ocupacao": "desocupado|ocupado|incerto",
  "ocupacao_fonte": "string",
  "financiavel": true,
  "fgts_aceito": false,
  "debitos_condominio": "string",
  "debitos_iptu": "string",
  "responsabilidade_debitos": "arrematante|sub_rogado|exonerado",
  "responsabilidade_fonte": "string (trecho do edital)",
  "processos_ativos": "string",
  "matricula_status": "string",
  "obs_juridicas": "string",
  "preco_m2_imovel": 0,
  "preco_m2_mercado": 0,
  "preco_m2_fonte": "string (ex: ZAP bairro Europa/Contagem)",
  "comparaveis": [{"descricao":"string","valor":0,"area_m2":0,"preco_m2":0,"quartos":0,"vagas":0,"tipo":"string","andar":null,"condominio_mes":null,"link":null,"fonte":"string","similaridade":0}],
  "valor_mercado_estimado": null,
  "desconto_sobre_mercado_pct": null,
  "gap_preco_asking_closing_pct": null,
  "preco_m2_asking_bairro": null,
  "preco_m2_closing_bairro": null,
  "classe_ipead": "string (Popular|Medio|Alto|Luxo)",
  "aluguel_mensal_estimado": 0,
  "liquidez": "Alta|Média|Baixa",
  "prazo_revenda_meses": 0,
  "score_localizacao": 0.0,  // ESCALA 0.0 a 10.0 (ex: 7.5, 8.2, 6.0) — NUNCA use 0-100
  "score_desconto": 0.0,     // Calibração: desconto 40%→7.0, 60%+→9.5, 20%→4.0
  "score_juridico": 0.0,     // Calibração: sem processos→8.0, risco alto→3.0
  "score_ocupacao": 0.0,     // Calibração: desocupado confirmado→8.5, ocupado→3.0
  "score_liquidez": 0.0,     // Calibração: alta demanda bairro nobre→8.5, periferia→4.0
  "score_mercado": 0.0,      // Calibração: BH classe 4 Luxo→8.5, classe 2 Médio→5.5
  "positivos": ["string1","string2","string3"],
  "negativos": ["string1","string2"],
  "alertas": ["string acionavel em linguagem clara — use APENAS prefixos de texto: [CRITICO] [ATENCAO] [OK] [INFO]. NAO use emojis diretamente nos alertas pois corrompem o encoding"],
  "recomendacao": "COMPRAR|AGUARDAR|EVITAR",
  "justificativa": "string detalhada 3-5 linhas explicando a decisão",
  "estrategia_recomendada": "flip|locacao|temporada",
  "sintese_executiva": "string — 3 frases em linguagem simples para membros não-especialistas. Ex: 'Este apartamento está sendo vendido por menos da metade do preço de mercado em um bairro de alta demanda. O maior risco é a ocupação incerta, que pode exigir ação judicial de 6 a 18 meses. Para o grupo AXIS, o cenário mais conservador ainda entrega retorno acima de 40%.'",
  "estrategia_recomendada_detalhe": {
    "tipo": "flip_rapido|renda_passiva|airbnb|reforma_revenda|locacao_longa",
    "motivo": "string — por que este imóvel se encaixa nessa estratégia",
    "prazo_estimado_meses": 0,
    "roi_estimado_pct": 0
  },
  "estrutura_recomendada": "cpf_unico|condominio_voluntario|holding|ltda",
  "custo_regularizacao": 0,
  "custo_reforma": 0,
  "custo_reforma_estimado": 0,
  "escopo_reforma": "refresh_giro|leve_funcional|leve_reforcada_1_molhado|media|pesada",
  "plano_reforma": {
    "escopo_recomendado": "refresh_giro|leve_funcional|leve_reforcada_1_molhado|media|pesada",
    "itens_principais": ["string — ex: Pintura geral", "Troca piso"],
    "itens_facultativos": ["string — ex: Modernização cozinha"],
    "custo_estimado_min": 0,
    "custo_estimado_max": 0,
    "prazo_obra_semanas": 0,
    "observacao_mercado": "string — ex: Reforma leve valoriza 18-25% neste bairro"
  },
  "prazo_reforma_meses": null,
  "valor_pos_reforma_estimado": null,
  "retorno_venda_pct": 0,
  "retorno_locacao_anual_pct": 0,
  "mercado_tendencia": "alta|estavel|queda",
  "mercado_tendencia_pct_12m": null,
  "mercado_demanda": "muito_alta|alta|media|baixa",
  "mercado_tempo_venda_meses": 0,
  "mercado_obs": "string",
  "riscos_presentes": ["risco_id1","risco_id2"],
  "custo_juridico_estimado": 0,
  "prazo_liberacao_estimado_meses": 0,
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
      max_tokens: 3500,
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
    }),
    signal: AbortSignal.timeout(60000)
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

  // Log de uso Claude análise principal
  try {
    const { logUsoChamadaAPI } = await import('./supabase')
    logUsoChamadaAPI({
      tipo: 'analise_principal', modelo: CLAUDE_MODEL,
      tokensInput: data.usage?.input_tokens || 0,
      tokensOutput: data.usage?.output_tokens || 0,
      modoTeste: localStorage.getItem('axis-modo-teste') === 'true',
    })
  } catch(e) { console.warn('[AXIS dualAI] Log uso Sonnet:', e.message) }

  const jsonMatch = txt.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Claude não retornou JSON válido')
  return JSON.parse(jsonMatch[0])
}

// ── FASE 3: Calcular score total com pesos do banco ──────────────

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

  // Penalidades removidas — score_juridico e score_ocupacao já refletem esses riscos nas dimensões
  // if ((analise.score_juridico || 0) < 4) score *= 0.75
  // if ((analise.ocupacao || '').toLowerCase() === 'ocupado') score *= 0.85

  return Math.min(10, Math.max(0, parseFloat(score.toFixed(2))))
}

// ── FUNÇÃO PRINCIPAL: orquestrar tudo ───────────────────────────

// -- Validação pós-análise (guardrails) --

export function validarECorrigirAnalise(analise) {
  const erros = []
  const avisos = []

  // 0. Normalizar scores que vieram em escala 0-100 para 0-10
  const camposScore = ['score_localizacao','score_desconto','score_juridico',
                       'score_ocupacao','score_liquidez','score_mercado']
  for (const campo of camposScore) {
    if (typeof analise[campo] === 'number' && analise[campo] > 10) {
      avisos.push(`NORMALIZADO: ${campo} era ${analise[campo]} (escala 0-100), convertido para ${(analise[campo] / 10).toFixed(1)}`)
      analise[campo] = parseFloat((analise[campo] / 10).toFixed(1))
    }
  }

  // 1. Área usada para cálculo — corrigir se usou total/real em vez de privativa
  const areaReal = analise.area_real_total_m2 || analise.area_total_m2
  const areaPriv = analise.area_privativa_m2
  if (areaReal && areaPriv && analise.area_usada_calculo_m2 === areaReal) {
    analise.area_usada_calculo_m2 = areaPriv
    erros.push('CORRIGIDO: área de cálculo era total/registral, substituída pela privativa')
  }
  // Se não definiu area_usada_calculo, inferir
  if (!analise.area_usada_calculo_m2) {
    analise.area_usada_calculo_m2 = areaPriv || analise.area_coberta_privativa_m2 || analise.area_m2 || areaReal
  }
  // Garantir area_m2 = área usada no cálculo (backward compat)
  if (analise.area_usada_calculo_m2) {
    analise.area_m2 = analise.area_usada_calculo_m2
  }

  // 2. Preço/m² coerente com área usada
  if (analise.valor_minimo && analise.area_usada_calculo_m2) {
    const preco_correto = analise.valor_minimo / analise.area_usada_calculo_m2
    if (analise.preco_m2_imovel > preco_correto * 1.2 ||
        analise.preco_m2_imovel < preco_correto * 0.8) {
      avisos.push(`preco_m2 inconsistente: informado=${analise.preco_m2_imovel}, calculado=${preco_correto.toFixed(0)}`)
      analise.preco_m2_imovel = Math.round(preco_correto)
    }
  }

  // 3. Avaliação não pode ser absurda (> 5x lance = provavelmente errada)
  if (analise.valor_avaliacao && analise.valor_minimo) {
    if (analise.valor_avaliacao > analise.valor_minimo * 5) {
      erros.push(`AVISO: avaliação R$${analise.valor_avaliacao} desproporcional ao lance R$${analise.valor_minimo}`)
    }
  }

  // 4. Alertas contraditórios com scores
  if (analise.alertas) {
    analise.alertas = analise.alertas.filter(alerta => {
      const a = (typeof alerta === 'string') ? alerta.toLowerCase() : ''
      if ((a.includes('baixa_liquidez') || a.includes('muito_baixa')) &&
          (analise.score_liquidez || 0) >= 6.5) return false
      if (a.includes('alta_vacancia') && (analise.score_liquidez || 0) >= 6.5) return false
      if (a.includes('risco jur') && (analise.score_juridico || 0) >= 7.0) return false
      return true
    })
    // Substituir alertas internos por linguagem amigável
    analise.alertas = analise.alertas.map(a => {
      if (a === 'muito_baixa_liquidez') return 'Liquidez regional moderada — estimar prazo de 90-150 dias para revenda'
      if (a === 'alta_vacancia') return 'Região com vacância acima da média — preferir locação a flip rápido'
      if (a === 'baixa_liquidez') return 'Liquidez moderada no bairro — precificar competitivamente para venda rápida'
      return a
    })
  }

  // 5. Custo total deve incluir comissão
  if (analise.valor_minimo && !analise.custo_total_aquisicao) {
    const comissao = analise.valor_minimo * ((analise.comissao_leiloeiro_pct || 5) / 100)
    const itbi = analise.valor_minimo * ((analise.itbi_pct || 2) / 100)
    analise.custo_total_aquisicao = Math.round(
      analise.valor_minimo + comissao + itbi + (analise.custo_regularizacao || 15000)
    )
  }

  // 6. Score de ocupação — "nunca habitado" ou desocupado deve ter score alto
  const tituloLower = (analise.titulo || '').toLowerCase()
  const justLower = (analise.justificativa || '').toLowerCase()
  const ocupLower = (analise.ocupacao || '').toLowerCase()
  if ((ocupLower === 'desocupado' || tituloLower.includes('nunca habitado') ||
       justLower.includes('nunca habitado')) &&
      (analise.score_ocupacao || 0) < 7.0) {
    avisos.push('AJUSTE: imóvel nunca habitado/desocupado — score_ocupacao ajustado')
    analise.score_ocupacao = Math.max(analise.score_ocupacao || 5.0, 7.5)
  }

  // 7. Recalcular score total se houve correções
  if (erros.length > 0 || avisos.length > 0) {
    const pesos = { localizacao: 0.20, desconto: 0.18, juridico: 0.18, ocupacao: 0.15, liquidez: 0.15, mercado: 0.14 }
    const scoreBase =
      (analise.score_localizacao || 0) * pesos.localizacao +
      (analise.score_desconto    || 0) * pesos.desconto +
      (analise.score_juridico    || 0) * pesos.juridico +
      (analise.score_ocupacao    || 0) * pesos.ocupacao +
      (analise.score_liquidez    || 0) * pesos.liquidez +
      (analise.score_mercado     || 0) * pesos.mercado
    // Penalidades removidas — score_juridico e score_ocupacao já refletem esses riscos nas dimensões
    // let fator = 1
    // if ((analise.score_juridico || 0) < 4) fator *= 0.75
    // if (ocupLower === 'ocupado') fator *= 0.85
    analise.score_total = Math.min(10, Math.round(scoreBase * 10) / 10)
    if (analise.score_total >= 7.5) analise.recomendacao = 'COMPRAR'
    else if (analise.score_total >= 6.0) analise.recomendacao = 'AGUARDAR'
    else analise.recomendacao = 'EVITAR'
  }

  analise._erros_validacao = erros
  analise._avisos_validacao = avisos
  return analise
}

// -- FASE 4: Extrair fotos do site do imovel via Claude --

function extrairImgsDoHTML(html, baseUrl) {
  if (!html) return []
  const matches = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)]
  return matches
    .map(m => {
      const src = m[1]
      if (src.startsWith('http')) return src
      if (src.startsWith('//')) return 'https:' + src
      if (src.startsWith('/')) {
        try { return new URL(baseUrl).origin + src } catch { return null }
      }
      return null
    })
    .filter(Boolean)
    .filter(src => {
      const lower = src.toLowerCase()
      if (lower.includes('logo') || lower.includes('favicon') ||
          lower.includes('sprite') || lower.includes('icon') ||
          lower.includes('loading') || lower.includes('placeholder')) return false
      if (lower.match(/\.(jpg|jpeg|png|webp)(\?|$)/i)) return true
      if (lower.includes('storage') || lower.includes('lote') ||
          lower.includes('imovel') || lower.includes('foto') ||
          lower.includes('imagem') || lower.includes('galeria')) return true
      return false
    })
    .slice(0, 8)
}

export async function extrairFotosImovel(url, claudeKey) {
  if (!url || !claudeKey) return { fotos: [], foto_principal: null }

  // Tentar og:image como fallback rapido antes da IA
  let ogFallback = null
  let htmlText = null
  try {
    const htmlRes = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) })
    if (htmlRes.ok) {
      htmlText = await htmlRes.text()
      const ogMatch = htmlText.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
        || htmlText.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
      if (ogMatch) ogFallback = ogMatch[1]
    }
  } catch(e) { console.warn('[AXIS dualAI] Fetch HTML fotos:', e.message) }

  // Extrair <img src> do HTML como fallback antes de chamar Haiku
  const imgsDoHTML = extrairImgsDoHTML(htmlText, url)
  if (imgsDoHTML.length >= 2) {
    return { fotos: imgsDoHTML, foto_principal: imgsDoHTML[0] }
  }

  // Extrair dominio e ID do lote da URL para ajudar a IA
  let dominio = '', loteId = ''
  try {
    dominio = new URL(url).hostname
    const loteMatch = url.match(/\/lote\/(\d+)/)
    if (loteMatch) loteId = loteMatch[1]
  } catch(e) { console.warn('[AXIS dualAI] Parse URL fotos:', e.message) }

  try {
    const promptFotos = `Preciso das fotos deste imovel de leilao: ${url}

Use web_search para encontrar as fotos. Estrategias em ordem:
1. Buscar no proprio site: "${dominio} ${loteId || url.split('/').pop()} fotos imovel"
${loteId ? `2. Para marcoantonioleiloeiro.com.br: buscar pelo lote ${loteId}
   Padrao de imagem: marcoantonioleiloeiro.com.br/storage/lotes/${loteId}/` : ''}
3. Para zuk.com.br: /storage/imoveis/[ID]/
4. Para sold.com.br: /assets/lotes/[ID]/
5. Para leilaovip.com.br: /assets/products/[ID]/
6. Para caixa.gov.br: buscar pelo endereco completo
7. Buscar imagens do imovel em Google Images: "${dominio} ${loteId || ''} apartamento foto"

Retorne SOMENTE este JSON (sem texto adicional):
{
  "foto_principal": "URL da melhor foto ou null",
  "fotos": ["url1", "url2"],
  "fonte_fotos": "como foram encontradas"
}`

    // Se chave Gemini disponível, usar Gemini Flash-Lite (mais barato que Haiku)
    const geminiKey = typeof localStorage !== 'undefined' ? localStorage.getItem('axis-gemini-key') : null
    if (geminiKey) {
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(20000),
            body: JSON.stringify({
              contents: [{ parts: [{ text: promptFotos }] }],
              generationConfig: { temperature: 0.1, maxOutputTokens: 500 }
            })
          }
        )
        if (geminiRes.ok) {
          const gData = await geminiRes.json()
          const gText = gData.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
          const gMatch = gText.match(/\{[\s\S]*\}/)
          if (gMatch) {
            const gResult = JSON.parse(gMatch[0])
            const fotos = (gResult.fotos || []).filter(f => f && f.startsWith('http')).slice(0, 12)
            const fotoPrincipal = gResult.foto_principal || fotos[0] || ogFallback || null
            if (fotos.length > 0 || fotoPrincipal) {
              try {
                const { logUsoChamadaAPI } = await import('./supabase')
                logUsoChamadaAPI({ tipo: 'fotos', modelo: 'gemini-2.0-flash-lite', tokensInput: 0, tokensOutput: 0, modoTeste: localStorage.getItem('axis-modo-teste') === 'true' })
              } catch(e) { console.warn('[AXIS dualAI] Log uso Gemini:', e.message) }
              return { fotos, foto_principal: fotoPrincipal }
            }
          }
        }
      } catch(e) {
        console.warn('[AXIS] Gemini fotos fallback Haiku:', e.message)
      }
    }

    // Fallback: Claude Haiku com web_search
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': claudeKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: promptFotos }]
      }),
      signal: AbortSignal.timeout(20000)
    })
    if (!res.ok) {
      // Se a chamada IA falhou mas temos og:image, usar como fallback
      if (ogFallback) return { fotos: [ogFallback], foto_principal: ogFallback }
      return { fotos: [], foto_principal: null }
    }
    const data = await res.json()
    let txt = ''
    for (const block of (data.content || [])) {
      if (block.type === 'text') txt += block.text
    }
    const jsonMatch = txt.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      if (ogFallback) return { fotos: [ogFallback], foto_principal: ogFallback }
      return { fotos: [], foto_principal: null }
    }
    // Log de uso Haiku fotos
    try {
      const { logUsoChamadaAPI } = await import('./supabase')
      logUsoChamadaAPI({
        tipo: 'fotos', modelo: 'claude-haiku-4-5-20251001',
        tokensInput: data.usage?.input_tokens || 0,
        tokensOutput: data.usage?.output_tokens || 0,
        modoTeste: localStorage.getItem('axis-modo-teste') === 'true',
      })
    } catch(e) { console.warn('[AXIS dualAI] Log uso Haiku:', e.message) }

    const parsed = JSON.parse(jsonMatch[0])
    const fotos = (parsed.fotos || []).filter(f => f && f.startsWith('http')).slice(0, 12)
    let fotoPrincipal = parsed.foto_principal || fotos[0] || null

    // Se IA nao encontrou fotos, usar og:image como fallback
    if (!fotoPrincipal && ogFallback) {
      fotoPrincipal = ogFallback
      if (!fotos.length) fotos.push(ogFallback)
    }

    return { fotos, foto_principal: fotoPrincipal }
  } catch(e) {
    console.warn('[AXIS dualAI] Fotos IA fallback:', e.message)
    // Fallback final: og:image
    if (ogFallback) return { fotos: [ogFallback], foto_principal: ogFallback }
    return { fotos: [], foto_principal: null }
  }
}

export async function analisarImovelCompleto(url, claudeKey, openaiKey, parametros, criterios, onProgress, anexos) {
  const progress = onProgress || (() => {})

  // Modo teste: retorna dados simulados sem chamar API
  const MODO_TESTE = localStorage.getItem('axis-modo-teste') === 'true'
  if (MODO_TESTE) {
    console.warn('[AXIS] MODO TESTE — sem chamadas de API')
    return {
      titulo: 'Imóvel de Teste',
      score_total: 7.5, recomendacao: 'AGUARDAR',
      score_localizacao: 7.5, score_desconto: 7.0,
      score_juridico: 7.5, score_ocupacao: 7.0,
      score_liquidez: 7.5, score_mercado: 7.0,
      alertas: ['[TESTE] Análise simulada — sem dados reais'],
      positivos: ['[TESTE] Ative o modo real para análise completa'],
      negativos: [],
      sintese_executiva: 'Análise simulada. Desative o Modo Teste para análise real.',
      custo_api_usd: 0,
      modo_teste: true,
    }
  }

  const cidade = 'Brasil'
  const tipo = 'Imóvel'

  progress('🔍 ChatGPT pesquisando dados de mercado na internet...')
  const dadosGPT = await pesquisarMercadoGPT(url, cidade, tipo, openaiKey)


  if (dadosGPT) {
    progress('✅ ChatGPT encontrou dados de mercado. Claude analisando o imóvel...')
  } else {
    progress('⚠️ ChatGPT indisponível. Claude analisando com dados internos...')
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



  // ââ Enriquecimento com dados por bairro (metricas_bairros_bh.js) ââ
  const bairroNome = dadosGPT?.bairro || ''
  const dadosBairro = getBairroDados(bairroNome)
  const gapPctBairro = dadosBairro ? calcGapPrecoPct(dadosBairro) : null
  const classeIPEAD = dadosBairro
    ? { classe: dadosBairro.classeIpead, label: dadosBairro.classeIpeadLabel }
    : getClasseIPEAD(bairroNome)
  let contextoBairro = ''
  if (dadosBairro) {
    contextoBairro = `
DADOS DE BAIRRO (granularidade fina — ${dadosBairro.label}):
- Zona: ${dadosBairro.zona}
- Preço anúncio (FipeZAP fev/2026): ${dadosBairro.precoAnuncioM2 ? `R$ ${dadosBairro.precoAnuncioM2.toLocaleString('pt-BR')}/m²` : 'não disponível'}
- Preço contrato (QuintoAndar 3T2025): ${dadosBairro.precoContratoM2 ? `R$ ${dadosBairro.precoContratoM2.toLocaleString('pt-BR')}/m²` : 'não disponível'}
- Tipo de dado: ${dadosBairro.tipoPreco === 'proxy_zona' ? '⚠️ estimativa por zona — usar com cautela' : 'dado real de transação'}
${gapPctBairro !== null ? `- Gap anúncio vs contrato: ${gapPctBairro.toFixed(1)}% (negociação média)` : ''}
- Yield bruto estimado: ${dadosBairro.yieldBruto}% a.a.
- Tendência 12m: ${dadosBairro.tendencia12m > 20 ? `⚠️ ${dadosBairro.tendencia12m}% (verificar amostra)` : `${dadosBairro.tendencia12m}%`}
- Classe socioeconômica IPEAD: ${dadosBairro.classeIpead} — ${dadosBairro.classeIpeadLabel}
${dadosBairro.obs ? `- Observação: ${dadosBairro.obs}` : ''}
IMPORTANTE: Use o gap asking/closing para calibrar a negociação e o score de oportunidade.`
  } else if (classeIPEAD) {
    contextoBairro = `
DADOS DE BAIRRO (parcial):
- Classe IPEAD: ${classeIPEAD.classe} — ${classeIPEAD.label}
- Dados de preço específico não disponíveis para este bairro`
  }
  // Append bairro context to market context
  const contextoCompleto = (contextoMercadoRegional || '') + contextoBairro

  const analise = await analisarComClaude(url, claudeKey, parametros, criterios, dadosGPT, anexos, contextoCompleto)

  progress('📊 Calculando score com parâmetros do grupo...')
  const score_total = calcularScore(analise, parametros)

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
      if (mercadoFinal.alertas && mercadoFinal.alertas.length) {
        const scoreLiquidez = analise.score_liquidez || 0
        const alertasRegionais = mercadoFinal.alertas.filter(alerta => {
          if (scoreLiquidez > 7.0 && alerta.includes('baixa_liquidez')) return false
          if (scoreLiquidez > 7.0 && alerta.includes('vacancia')) return false
          return true
        })
        const alertasExistentes = new Set(analise.alertas || [])
        for (const alerta of alertasRegionais) alertasExistentes.add(alerta)
        analise.alertas = [...alertasExistentes]
      }
    }
  }

  if (dadosGPT) {
    if (!analise.preco_m2_mercado && dadosGPT.preco_m2_mercado)
      analise.preco_m2_mercado = dadosGPT.preco_m2_mercado
    if (!analise.aluguel_mensal_estimado && dadosGPT.aluguel_estimado)
      analise.aluguel_mensal_estimado = dadosGPT.aluguel_estimado
    if (!analise.mercado_tendencia && dadosGPT.tendencia_mercado)
      analise.mercado_tendencia = dadosGPT.tendencia_mercado
    if (!analise.mercado_demanda && dadosGPT.demanda)
      analise.mercado_demanda = dadosGPT.demanda
    if (!analise.preco_m2_fonte && dadosGPT.preco_m2_fonte)
      analise.preco_m2_fonte = dadosGPT.preco_m2_fonte
    if ((!analise.comparaveis || !analise.comparaveis.length) && dadosGPT.comparaveis)
      analise.comparaveis = dadosGPT.comparaveis
    if (dadosGPT.pontos_positivos)
      analise.positivos = [...(analise.positivos||[]), ...dadosGPT.pontos_positivos]
    if (dadosGPT.noticias)
      analise.alertas = [...(analise.alertas||[]), ...dadosGPT.noticias.map(n => `📰 ${n}`)]
  }

  // Extrair fotos do site
  progress('[FOTOS] Extraindo fotos do imovel...')
  let fotosResult = { fotos: [], foto_principal: null }
  try {
    fotosResult = await extrairFotosImovel(url, claudeKey) || { fotos: [], foto_principal: null }
  } catch { /* ignorar erro de fotos */ }

  // Validação pós-análise: corrigir área, preço/m², alertas contraditórios
  progress('🔍 Validando dados da análise...')
  const analiseValidada = validarECorrigirAnalise(analise)

  // Calcular custo de reforma usando a base estruturada
  try {
    const precoM2 = analiseValidada.preco_m2_mercado || 0
    if (analiseValidada.area_usada_calculo_m2 && analiseValidada.escopo_reforma) {
      const custoReforma = calcularCustoReforma({
        area_m2: analiseValidada.area_usada_calculo_m2,
        escopo: analiseValidada.escopo_reforma,
        regiao_mercado: regiaoDetectada,
        preco_m2_atual: precoM2,
      })
      if (custoReforma) {
        analiseValidada.custo_reforma_calculado = custoReforma.custo_total_final
        const valorRef = analiseValidada.valor_mercado_estimado || analiseValidada.valor_avaliacao || analiseValidada.valor_minimo
        if (valorRef) {
          const sobrecap = verificarSobrecapitalizacao(
            custoReforma.custo_total_final, valorRef, regiaoDetectada, precoM2
          )
          if (sobrecap) {
            analiseValidada.alerta_sobrecap = sobrecap.status
            if (sobrecap.status !== 'verde') {
              analiseValidada.alertas = [...(analiseValidada.alertas || []),
                `${sobrecap.status === 'vermelho' ? '[CRITICO]' : '[ATENCAO]'} ${sobrecap.mensagem}`
              ]
            }
          }
        }
      }
    }
  } catch(e) { console.warn('[AXIS] Cálculo reforma:', e.message) }

  // Calcular custo jurídico usando a base estruturada
  try {
    if (analiseValidada.riscos_presentes?.length > 0) {
      const aluguelEst = analiseValidada.aluguel_mensal_estimado || 0
      const custosJur = calcularCustoJuridico(analiseValidada.riscos_presentes, aluguelEst)
      if (custosJur) {
        if (!analiseValidada.custo_juridico_estimado)
          analiseValidada.custo_juridico_estimado = custosJur.custo_total_max
        if (!analiseValidada.prazo_liberacao_estimado_meses)
          analiseValidada.prazo_liberacao_estimado_meses = custosJur.prazo_liberacao_meses_max
      }
    }
    // ITBI correto por cidade (BH = 3%, outros MG = 2%)
    const cidadeLower = (analiseValidada.cidade || '').toLowerCase()
    if (cidadeLower.includes('belo horizonte') || cidadeLower.includes('bh'))
      analiseValidada.itbi_pct = 3
  } catch(e) { console.warn('[AXIS] Cálculo jurídico:', e.message) }

    // Jurimetria: calibrar prazo com dados reais da vara
    try {
      const varaJudicial = analiseValidada.vara_judicial || ''
      const tipoJustica = analiseValidada.tipo_justica || ''
      if (varaJudicial || tipoJustica) {
        const { supabase } = await import('./supabase')
        const { data: juri } = await supabase
          .from('jurimetria_varas')
          .select('tempo_total_ciclo_dias, taxa_embargo_pct, vara_nome')
          .or(`vara_nome.ilike.%${varaJudicial.split(' ').slice(0,3).join(' ')}%,tipo_justica.eq.${tipoJustica}`)
          .order('vara_nome', { ascending: false })
          .limit(1)
          .single()
        if (juri?.tempo_total_ciclo_dias) {
          analiseValidada.prazo_liberacao_estimado_meses = Math.round(juri.tempo_total_ciclo_dias / 30)
          analiseValidada.jurimetria_vara = juri.vara_nome
          analiseValidada.jurimetria_taxa_embargo = juri.taxa_embargo_pct
        }
      }
    } catch(e) { console.warn('[AXIS] Jurimetria vara:', e.message) }

  // Recalcular score se a validação corrigiu algo
  const scoreFinal = (analiseValidada._erros_validacao?.length || analiseValidada._avisos_validacao?.length)
    ? (analiseValidada.score_total || calcularScore(analiseValidada, parametros))
    : score_total

  return {
    ...analiseValidada,
    score_total: scoreFinal,
    regiao_mercado: regiaoDetectada || null,
    dados_mercado_regional: dadosMercado || null,
    id: `${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
    fonte_url: url,
    status: 'analisado',
    analise_dupla_ia: !!dadosGPT,
    fotos: fotosResult.fotos || [],
    foto_principal: fotosResult.foto_principal || null
  }
}
