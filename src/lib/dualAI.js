// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
// AXIS Ã¢ÂÂ Motor Duplo de IA
// Fase 1: ChatGPT pesquisa dados de mercado na internet
// Fase 2: Claude recebe tudo + parÃÂ¢metros do banco e gera anÃÂ¡lise
// Fase 3: Score calculado com os pesos definidos pelo admin
// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

import { detectarRegiao, getMercado } from '../data/mercado_regional.js'
import metricasBH, { BAIRROS_BH, calcGapPrecoPct, getClasseIPEAD, calcScoreAxis } from '../data/metricas_bairros_bh.js'

const CLAUDE_MODEL = 'claude-sonnet-4-20250514'
const GPT_MODEL = 'gpt-4o'

const REGRAS_MODALIDADE_TEXTO = `
REGRAS CRÃTICAS POR MODALIDADE (APLIQUE SEMPRE):
LEILÃO JUDICIAL:
- IPTU anterior: STJ protege arrematante (sub-roga no preÃ§o) â risco baixo
- CondomÃ­nio anterior: CPC/2015 sub-roga no preÃ§o â risco mÃ©dio
- ImÃ³vel ocupado: aÃ§Ã£o de imissÃ£o na posse (prazo 4â24 meses, custo R$514â5.818)

LEILÃO EXTRAJUDICIAL / ALIENAÃÃO FIDUCIÃRIA:
- IPTU e condomÃ­nio: verificar edital â pode ser do comprador
- ImÃ³vel ocupado: reintegraÃ§Ã£o de posse (Lei 9.514 + STJ 2024, 60 dias legal, 4â24 meses real)

IMÃVEL CAIXA (leilÃ£o ou venda direta):
- IPTU: FICA COM O COMPRADOR (FAQ CAIXA oficial)
- CondomÃ­nio: FICA COM O COMPRADOR (FAQ CAIXA oficial)
- ComissÃ£o leiloeiro: 5% sobre o valor arrematado
- SEMPRE calcular esses custos no custo total da operaÃ§Ã£o

BLOQUEIOS AUTOMÃTICOS:
- DivergÃªncia edital vs matrÃ­cula: score mÃ¡ximo 35, recomendaÃ§Ã£o EVITAR
- ImÃ³vel ocupado: score Ã 0.85
- Risco nota â¥ 9: penalizar -35 pontos no score

Para qualquer campo jurÃ­dico identificado, informe:
- modalidade_leilao detectada
- riscos presentes (lista de risco_id)
- custo_juridico_estimado total
- prazo_liberacao_estimado_meses
`

const REGRAS_COLETA_DADOS = `
REGRAS OBRIGATÃRIAS DE COLETA E ANÃLISE

--- DICIONÃRIO TÃCNICO DE ÃREA (NBR 12721 + Lei 4.591/64) ---
CAMPOS QUE O EDITAL PODE INFORMAR:
  area_privativa      â uso exclusivo da unidade (padrÃ£o de mercado para preÃ§o/mÂ²)
  area_util           â interna varrÃ­vel, sem paredes/pilares (~10-12% menor que privativa)
  area_comum          â espaÃ§os compartilhados do condomÃ­nio (nÃ£o usar para preÃ§o/mÂ²)
  area_total          â privativa + quota de Ã¡rea comum (nÃ£o usar como base principal)
  area_real_total     â denominaÃ§Ã£o registral: privativa real + fraÃ§Ã£o de comum
  area_equivalente    â usada em incorporaÃ§Ã£o para equivalÃªncia de custo

PRIORIDADE de leitura de Ã¡rea (use nesta ordem):
1. Ã¡rea_privativa (Ã¡rea exclusiva do proprietÃ¡rio â padrÃ£o ZAP/VivaReal)
2. Ã¡rea_construÃ­da (se nÃ£o houver privativa)
3. Ã¡rea_total (NUNCA use para preÃ§o/mÂ² â inclui Ã¡rea comum)

TIPOLOGIAS ESPECIAIS:
COBERTURA DUPLEX (2 andares, terraÃ§o):
  A Ã¡rea privativa TOTAL jÃ¡ inclui os dois andares + terraÃ§o
  â usar area_privativa_total como base de comparaÃ§Ã£o (Ã© tudo do proprietÃ¡rio)
  â separar: area_coberta (interno) + area_descoberta (terraÃ§o)
  â terraÃ§o vale menos por mÂ² que Ã¡rea coberta, mas ambos sÃ£o privativos
  Exemplo: edital "135,49mÂ² priv / 156,19mÂ² priv total / 247,60mÂ² real total"
  â area_coberta_privativa = 135,49mÂ² (fechado dos 2 andares)
  â area_privativa = 156,19mÂ² (fechado + varandas)
  â area_real_total = 247,60mÂ² (com fraÃ§Ã£o comum â NÃO usar)
  â area_usada_calculo = 156,19mÂ² (privativa total)

APARTAMENTO GARDEN:
  area_interna = Ã¡rea coberta exclusiva â usar para preÃ§o/mÂ²
  area_externa = jardim privativo â valor menor por mÂ²

CASA EM CONDOMÃNIO:
  area_construida = Ã¡rea da casa â usar para preÃ§o/mÂ²
  area_terreno = lote privativo â guardar separado

REGRA DE DECISÃO AUTOMÃTICA:
Se apenas UMA Ã¡rea informada: Ã© provavelmente a privativa. Usar como base.
Se DUAS Ã¡reas: menor = fechada, maior = privativa total â usar a MAIOR
Se TRÃS Ã¡reas: menor = fechada, mÃ©dia = privativa total, maior = real total
  â usar a MÃDIA (privativa total) como base de preÃ§o/mÂ²

CAMPOS OBRIGATÃRIOS NO JSON:
  area_privativa_m2: nÃºmero (exclusiva total)
  area_coberta_privativa_m2: nÃºmero (apenas fechada/coberta)
  area_descoberta_privativa_m2: nÃºmero (terraÃ§o/varanda descoberta)
  area_total_m2: nÃºmero (com fraÃ§Ã£o comum â registral)
  area_usada_calculo_m2: nÃºmero (qual foi usada para preÃ§o/mÂ²)
  area_usada_label: "string explicando a escolha"

--- AVALIAÃÃO E LANCE ---
AVALIAÃÃO JUDICIAL â  VALOR DE MERCADO:
  - avaliaÃ§Ã£o_judicial: valor definido pelo perito do processo
  - valor_mercado_real: o que imÃ³vel similar vende no mercado livre
  - lance_minimo: geralmente 60-70% da avaliaÃ§Ã£o no 2Âº leilÃ£o
  - lance_atual: o Ãºltimo lance registrado no portal (se houver)
Para calcular desconto, use SEMPRE:
  desconto_sobre_avaliacao = (avaliacao - lance_minimo) / avaliacao
  desconto_sobre_mercado = (valor_mercado_real - lance_minimo) / valor_mercado_real
NUNCA invente a avaliaÃ§Ã£o. Se nÃ£o encontrar no edital, marque como null.

--- CUSTO TOTAL DE AQUISIÃÃO ---
Sempre calcular o custo real total:
  custo_total = lance + comissao_leiloeiro + itbi + registro + honorarios
ComissÃ£o leiloeiro:
  - PadrÃ£o: 5% sobre o valor arrematado
  - Sempre pago pelo ARREMATANTE (nÃ£o pelo vendedor)
  - Incluir no custo total obrigatoriamente
ITBI:
  - Belo Horizonte: 3%
  - Contagem, Betim, Nova Lima: 2%
  - Juiz de Fora: 2%
  - Outros MG: estimativa 2%
  - Base de cÃ¡lculo: valor arrematado ou avaliaÃ§Ã£o (o maior)

--- COMPARAÃÃO COM MERCADO ---
Para definir preco_m2_mercado, use esta hierarquia:
1. AnÃºncios COMPARÃVEIS da mesma rua ou condomÃ­nio (mais preciso)
2. AnÃºncios comparÃ¡veis do mesmo bairro/tipologia
3. Dados ZAP/VivaReal do bairro para a tipologia especÃ­fica
4. Dados gerais do bairro como fallback
TIPOLOGIA importa muito para comparaÃ§Ã£o:
  Cobertura duplex â  apartamento padrÃ£o
  Studio â  1 quarto
  Casa em condomÃ­nio â  apartamento
Se o imÃ³vel for cobertura, penthouse, duplex ou diferenciado:
  â buscar comparÃ¡veis especÃ­ficos dessa tipologia
  â nÃ£o usar mÃ©dia geral do bairro como referÃªncia

--- PASSIVOS (IPTU, CONDOMÃNIO) ---
Regra por modalidade (CRÃTICO):
LEILÃO JUDICIAL (CPC/2015):
  - Se edital NÃO menciona nada â dÃ©bitos se sub-rogam no preÃ§o (nÃ£o Ã© do arrematante)
  - Se edital EXPRESSAMENTE exonera o arrematante â marcar como ponto positivo (+15 pts jurÃ­dico)
  - Risco financeiro: BAIXO a NULO para o arrematante
LEILÃO CAIXA / EXTRAJUDICIAL:
  - IPTU e condomÃ­nio ficam com o COMPRADOR (FAQ CAIXA oficial)
  - Risco financeiro: ALTO â calcular e incluir no custo total
EXTINÃÃO DE CONDOMÃNIO (caso especial):
  - Modalidade onde coproprietÃ¡rios encerram condomÃ­nio voluntÃ¡rio
  - DÃ©bitos costumam ser resolvidos entre as partes, nÃ£o pelo arrematante
  - Geralmente positivo juridicamente

--- ALERTAS E CONSISTÃNCIA ---
NUNCA gerar alerta que contradiga o score:
  Se score_liquidez >= 70 â NÃO incluir alerta "baixa_liquidez"
  Se score_juridico >= 75 â NÃO incluir alerta de risco jurÃ­dico alto
  Se imÃ³vel desocupado confirmado â NÃO incluir alerta de ocupaÃ§Ã£o
Alertas devem ser ACIONÃVEIS:
  Errado: "muito_baixa_liquidez" (cÃ³digo interno, nÃ£o Ãºtil)
  Correto: "Confirmar ocupaÃ§Ã£o presencialmente antes do lance"
  Correto: "Solicitar certidÃ£o de matrÃ­cula atualizada (30 dias)"
  Correto: "Verificar se condomÃ­nio aceitarÃ¡ novo proprietÃ¡rio"

--- REGIÃO GEOGRÃFICA ---
Identificar corretamente a cidade/bairro:
  Contagem â  Belo Horizonte (sÃ£o municÃ­pios diferentes)
  Nova Lima â  BH (municÃ­pio diferente, preÃ§o/mÂ² muito maior)
  Betim â  BH
  Juiz de Fora = cidade prÃ³pria, nÃ£o RMBH
Para Contagem, usar dados de Contagem (ZAP: ~R$4.200-5.800/mÂ²)
Para BH Centro-Sul, usar dados de BH (ZAP: ~R$12.000-15.000/mÂ²)
`

const REGRAS_REFORMA_TEXTO = `
PARÃMETROS DE CUSTO DE REFORMA â MG/BH/JF 2026
(apenas custo direto: mÃ£o de obra + materiais + terceirizados)
NÃO inclui: projeto, ART, administraÃ§Ã£o, mÃ³veis, eletrodomÃ©sticos

ESCOPOS DISPONÃVEIS:
- refresh_giro: pintura + reparos + revisÃ£o pontual = R$200â520/mÂ² (classe D a A)
- leve_funcional: refresh + piso + troca funcional = R$360â900/mÂ²
- leve_reforcada_1_molhado: leve + 1 banheiro ou cozinha = R$620â1.450/mÂ²

PACOTES DE SERVIÃO FIXOS:
- Pintura geral: R$3.500â9.000
- RevisÃ£o elÃ©trica pontual: R$1.500â5.000
- RevisÃ£o hidrÃ¡ulica pontual: R$1.500â6.000
- Banheiro refresh: R$7.000â14.000
- Banheiro leve reforÃ§ado: R$14.000â22.000
- Cozinha refresh: R$10.000â20.000
- Cozinha leve reforÃ§ada: R$20.000â32.000

TETO ECONÃMICO (% do valor de mercado):
- Classe A (>R$12k/mÂ²): 3% a 7%
- Classe B (R$8â12k/mÂ²): 3% a 6%
- Classe C (R$5â8k/mÂ²): 2,5% a 5%
- Classe D (<R$5k/mÂ²): 2% a 4%

Se a reforma proposta superar o teto, penalizar score_financeiro.
Retornar no JSON: escopo_reforma, custo_reforma_estimado, alerta_sobrecap
`

// Ã¢ÂÂÃ¢ÂÂ FASE 1: ChatGPT pesquisa mercado e contexto do imÃÂ³vel Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

export async function pesquisarMercadoGPT(url, cidade, tipo, openaiKey) {
  if (!openaiKey) return null

  const prompt = `VocÃÂª ÃÂ© um especialista em mercado imobiliÃÂ¡rio brasileiro.
Pesquise na internet dados ATUAIS sobre este imÃÂ³vel de leilÃÂ£o: ${url}

REGRAS DE PESQUISA:
1. IDENTIFICAR O IMÃÂVEL CORRETAMENTE:
   - Leia o endereÃÂ§o completo: rua, nÃÂºmero, bairro, cidade, UF
   - NÃÂ£o confundir municÃÂ­pio: Contagem Ã¢ÂÂ  BH, Nova Lima Ã¢ÂÂ  BH
   - Identificar tipologia: apartamento, cobertura, duplex, casa, studio

2. PESQUISAR COMPARÃÂVEIS:
   Busque no ZAP, VivaReal e OLX:
   - ImÃÂ³veis da mesma RUA (mais preciso)
   - ImÃÂ³veis do mesmo BAIRRO com tipologia similar
   - ImÃÂ³veis do mesmo BAIRRO com ÃÂ¡rea similar (ÃÂ±30mÃÂ²)
   Para COBERTURA ou DUPLEX:
   - Buscar especificamente "cobertura [bairro] [cidade]"
   - NÃÂ£o comparar com apartamento padrÃÂ£o

3. COLETAR PREÃÂO/mÃÂ² CORRETO:
   - Usar ZAP ImÃÂ³veis Ã¢ÂÂ seÃÂ§ÃÂ£o "Quanto vale o mÃÂ² em [bairro]?"
   - Anotar: preÃÂ§o mÃÂ©dio geral E preÃÂ§o por tipologia/tamanho
   - Anotar a fonte exatamente (URL)

4. INFORMAÃÂÃÂES DO LEILÃÂO:
   - Confirmar valor de avaliaÃÂ§ÃÂ£o judicial no edital
   - Confirmar lance mÃÂ­nimo atual
   - Verificar se hÃÂ¡ lances jÃÂ¡ registrados
   - Verificar data e hora do leilÃÂ£o

5. SITUAÃÂÃÂO JURÃÂDICA:
   - Verificar se hÃÂ¡ processos no TJMG alÃÂ©m do leilÃÂ£o
   - Confirmar modalidade (judicial/extrajudicial/extinÃÂ§ÃÂ£o condomÃÂ­nio)
   - Verificar matrÃÂ­cula se disponÃÂ­vel

6. PreÃÂ§o mÃÂ©dio de ${tipo} em ${cidade} (R$/mÃÂ²)
7. TendÃÂªncia do mercado imobiliÃÂ¡rio em ${cidade} (ÃÂºltimos 6 meses)
8. Demanda por ${tipo} em ${cidade} para compra e locaÃÂ§ÃÂ£o
9. Infraestrutura prÃÂ³xima: transporte, comÃÂ©rcio, escolas, hospitais

Retorne APENAS JSON vÃÂ¡lido (sem markdown):
{
  "cidade": "string",
  "bairro": "string",
  "tipologia": "string",
  "preco_m2_mercado": number,
  "preco_m2_fonte": "string (URL ou descriÃÂ§ÃÂ£o da fonte)",
  "comparaveis": [
    {"descricao": "string", "valor": number, "area_m2": number, "preco_m2": number}
  ],
  "valor_avaliacao_encontrado": null,
  "lance_minimo_encontrado": null,
  "tendencia_mercado": "Alta|EstÃÂ¡vel|Queda",
  "demanda": "Alta|MÃÂ©dia|Baixa",
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
        max_output_tokens: 3000,
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
    console.warn('[AXIS] ChatGPT indisponÃÂ­vel:', e.message)
    return null
  }
}

// Ã¢ÂÂÃ¢ÂÂ FASE 2: Claude analisa o link com todos os dados Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

export async function analisarComClaude(url, claudeKey, parametros, criterios, dadosGPT, anexos, contextoMercadoRegional) {
  const pesosInfo = (parametros || [])
    .map(p => `  - ${p.nome}: peso ${p.peso}% (dimensao: ${p.dimensao})`)
    .join('\n')

  const criteriosInfo = (criterios || [])
    .map(c => `  - ${c.nome} [${c.categoria}] tipo: ${c.tipo_valor}${c.obrigatorio ? ' Ã¢ÂÂ Ã¯Â¸ÂOBRIGATÃÂRIO' : ''}`)
    .join('\n')

  const comparaveisTexto = (dadosGPT?.comparaveis || [])
    .map(c => `    - ${c.descricao}: R$ ${c.valor?.toLocaleString('pt-BR')} (${c.area_m2}m\u00b2 = R$ ${c.preco_m2}/m\u00b2)`)
    .join('\n')

  const contextoGPT = dadosGPT ? `
DADOS DE MERCADO PESQUISADOS PELO CHATGPT (use para enriquecer a an\u00e1lise):
- Cidade/Bairro identificado: ${dadosGPT.cidade || '?'} / ${dadosGPT.bairro || '?'}
- Tipologia: ${dadosGPT.tipologia || '?'}
- Pre\u00e7o m\u00e9dio m\u00b2 na regi\u00e3o: R$ ${dadosGPT.preco_m2_mercado || 'n\u00e3o encontrado'}
- Fonte do pre\u00e7o/m\u00b2: ${dadosGPT.preco_m2_fonte || 'n\u00e3o informado'}
- Tend\u00eancia: ${dadosGPT.tendencia_mercado || 'n\u00e3o encontrado'}
- Demanda: ${dadosGPT.demanda || 'n\u00e3o encontrado'}
- Tempo m\u00e9dio de venda: ${dadosGPT.tempo_venda_meses || '?'} meses
- Aluguel estimado: R$ ${dadosGPT.aluguel_estimado || 'n\u00e3o encontrado'}/m\u00eas
- Infraestrutura: ${(dadosGPT.infraestrutura || []).join(', ')}
- Observa\u00e7\u00f5es de mercado: ${dadosGPT.observacoes_mercado || ''}
${comparaveisTexto ? `- Compar\u00e1veis encontrados:\n${comparaveisTexto}` : ''}
- Avalia\u00e7\u00e3o judicial encontrada: ${dadosGPT.valor_avaliacao_encontrado || 'n\u00e3o verificado'}
- Lance m\u00ednimo encontrado: ${dadosGPT.lance_minimo_encontrado || 'n\u00e3o verificado'}
- Score localiza\u00e7\u00e3o sugerido pelo ChatGPT: ${dadosGPT.score_localizacao_sugerido || 'n\u00e3o calculado'}
- Score mercado sugerido pelo ChatGPT: ${dadosGPT.score_mercado_sugerido || 'n\u00e3o calculado'}
` : `
NOTA: ChatGPT n\u00e3o dispon\u00edvel no momento. Use seu conhecimento para estimar dados de mercado.
`

  const prompt = `VocÃÂª ÃÂ© um especialista em anÃÂ¡lise de imÃÂ³veis em leilÃÂ£o no Brasil.

Acesse e analise este imÃÂ³vel: ${url}

${REGRAS_COLETA_DADOS}
${contextoGPT}
${contextoMercadoRegional || ''}
${REGRAS_MODALIDADE_TEXTO}
${REGRAS_REFORMA_TEXTO}

PESOS DE SCORE DEFINIDOS PELO GRUPO PARA ESTE APP (USE ESTES PESOS EXATOS):
${pesosInfo || '  - LocalizaÃÂ§ÃÂ£o: 20%, Desconto: 18%, JurÃÂ­dico: 18%, OcupaÃÂ§ÃÂ£o: 15%, Liquidez: 15%, Mercado: 14%'}

CRITÃÂRIOS ADICIONAIS DE AVALIAÃÂÃÂO DO GRUPO:
${criteriosInfo || '  (nenhum critÃÂ©rio personalizado cadastrado)'}

INSTRUÃÂÃÂES:
1. Acesse a URL e extraia todos os dados disponÃÂ­veis do imÃÂ³vel
2. Use os dados do ChatGPT para calibrar scores de localizaÃÂ§ÃÂ£o e mercado
3. Calcule o score_total como mÃÂ©dia ponderada usando os pesos acima
4. Aplique penalizaÃÂ§ÃÂµes: juridico<4 Ã¢ÂÂ ÃÂ0.75; ocupado Ã¢ÂÂ ÃÂ0.85
5. Seja conservador nas estimativas de retorno
6. Indique estrutura de aquisiÃÂ§ÃÂ£o ideal (CPF, CondomÃÂ­nio, PJ, ProcuraÃÂ§ÃÂ£o)

RETORNE APENAS JSON VÃLIDO (sem markdown, sem texto fora do JSON).
NUNCA omitir campos obrigatÃ³rios. Use null se nÃ£o souber.
NUNCA usar area_total_m2 para calcular preco_m2_imovel.
{
  "titulo": "string",
  "endereco": "string",
  "cidade": "string",
  "estado": "UF 2 letras",
  "bairro": "string",
  "tipo": "Apartamento|Casa|Terreno|Comercial|GalpÃ£o|Rural|Cobertura",
  "tipologia": "apartamento_padrao|cobertura_linear|cobertura_duplex|apartamento_garden|apartamento_duplex|casa|studio|loft",
  "area_privativa_m2": null,
  "area_coberta_privativa_m2": null,
  "area_descoberta_privativa_m2": null,
  "area_total_m2": null,
  "area_real_total_m2": null,
  "area_usada_calculo_m2": 0,
  "area_usada_label": "string explicando a Ã¡rea escolhida",
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
  "comparaveis": [{"descricao":"string","valor":0,"area_m2":0,"preco_m2":0}],
  "valor_mercado_estimado": null,
  "desconto_sobre_mercado_pct": null,
  "gap_preco_asking_closing_pct": null,
  "preco_m2_asking_bairro": null,
  "preco_m2_closing_bairro": null,
  "classe_ipead": "string (Popular|Medio|Alto|Luxo)",
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
  "alertas": ["string acionÃ¡vel em linguagem clara"],
  "recomendacao": "COMPRAR|AGUARDAR|EVITAR",
  "justificativa": "string detalhada 3-5 linhas explicando a decisÃ£o",
  "estrategia_recomendada": "flip|locacao|temporada",
  "estrutura_recomendada": "cpf_unico|condominio_voluntario|holding|ltda",
  "custo_regularizacao": 0,
  "custo_reforma": 0,
  "custo_reforma_estimado": 0,
  "escopo_reforma": "refresh_giro|leve_funcional|leve_reforcada_1_molhado|media|pesada",
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
      max_tokens: 6000,
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
  if (!jsonMatch) throw new Error('Claude nÃÂ£o retornou JSON vÃÂ¡lido')
  return JSON.parse(jsonMatch[0])
}

// Ã¢ÂÂÃ¢ÂÂ FASE 3: Calcular score total com pesos do banco Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

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

// Ã¢ÂÂÃ¢ÂÂ FUNÃÂÃÂO PRINCIPAL: orquestrar tudo Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

// -- ValidaÃ§Ã£o pÃ³s-anÃ¡lise (guardrails) --

export function validarECorrigirAnalise(analise) {
  const erros = []
  const avisos = []

  // 1. Ãrea usada para cÃ¡lculo â corrigir se usou total/real em vez de privativa
  const areaReal = analise.area_real_total_m2 || analise.area_total_m2
  const areaPriv = analise.area_privativa_m2
  if (areaReal && areaPriv && analise.area_usada_calculo_m2 === areaReal) {
    analise.area_usada_calculo_m2 = areaPriv
    erros.push('CORRIGIDO: Ã¡rea de cÃ¡lculo era total/registral, substituÃ­da pela privativa')
  }
  // Se nÃ£o definiu area_usada_calculo, inferir
  if (!analise.area_usada_calculo_m2) {
    analise.area_usada_calculo_m2 = areaPriv || analise.area_coberta_privativa_m2 || analise.area_m2 || areaReal
  }
  // Garantir area_m2 = Ã¡rea usada no cÃ¡lculo (backward compat)
  if (analise.area_usada_calculo_m2) {
    analise.area_m2 = analise.area_usada_calculo_m2
  }

  // 2. PreÃ§o/mÂ² coerente com Ã¡rea usada
  if (analise.valor_minimo && analise.area_usada_calculo_m2) {
    const preco_correto = analise.valor_minimo / analise.area_usada_calculo_m2
    if (analise.preco_m2_imovel > preco_correto * 1.2 ||
        analise.preco_m2_imovel < preco_correto * 0.8) {
      avisos.push(`preco_m2 inconsistente: informado=${analise.preco_m2_imovel}, calculado=${preco_correto.toFixed(0)}`)
      analise.preco_m2_imovel = Math.round(preco_correto)
    }
  }

  // 3. AvaliaÃ§Ã£o nÃ£o pode ser absurda (> 5x lance = provavelmente errada)
  if (analise.valor_avaliacao && analise.valor_minimo) {
    if (analise.valor_avaliacao > analise.valor_minimo * 5) {
      erros.push(`AVISO: avaliaÃ§Ã£o R$${analise.valor_avaliacao} desproporcional ao lance R$${analise.valor_minimo}`)
    }
  }

  // 4. Alertas contraditÃ³rios com scores
  if (analise.alertas) {
    analise.alertas = analise.alertas.filter(alerta => {
      const a = (typeof alerta === 'string') ? alerta.toLowerCase() : ''
      if ((a.includes('baixa_liquidez') || a.includes('muito_baixa')) &&
          (analise.score_liquidez || 0) >= 65) return false
      if (a.includes('alta_vacancia') && (analise.score_liquidez || 0) >= 65) return false
      if (a.includes('risco jurÃ­dico alto') && (analise.score_juridico || 0) >= 70) return false
      return true
    })
    // Substituir alertas internos por linguagem amigÃ¡vel
    analise.alertas = analise.alertas.map(a => {
      if (a === 'muito_baixa_liquidez') return 'Liquidez regional moderada â estimar prazo de 90-150 dias para revenda'
      if (a === 'alta_vacancia') return 'RegiÃ£o com vacÃ¢ncia acima da mÃ©dia â preferir locaÃ§Ã£o a flip rÃ¡pido'
      if (a === 'baixa_liquidez') return 'Liquidez moderada no bairro â precificar competitivamente para venda rÃ¡pida'
      return a
    })
  }

  // 5. Custo total deve incluir comissÃ£o
  if (analise.valor_minimo && !analise.custo_total_aquisicao) {
    const comissao = analise.valor_minimo * ((analise.comissao_leiloeiro_pct || 5) / 100)
    const itbi = analise.valor_minimo * ((analise.itbi_pct || 2) / 100)
    analise.custo_total_aquisicao = Math.round(
      analise.valor_minimo + comissao + itbi + (analise.custo_regularizacao || 15000)
    )
  }

  // 6. Score de ocupaÃ§Ã£o â "nunca habitado" ou desocupado deve ter score alto
  const tituloLower = (analise.titulo || '').toLowerCase()
  const justLower = (analise.justificativa || '').toLowerCase()
  const ocupLower = (analise.ocupacao || '').toLowerCase()
  if ((ocupLower === 'desocupado' || tituloLower.includes('nunca habitado') ||
       justLower.includes('nunca habitado')) &&
      (analise.score_ocupacao || 0) < 70) {
    avisos.push('AJUSTE: imÃ³vel nunca habitado/desocupado â score_ocupacao ajustado')
    analise.score_ocupacao = Math.max(analise.score_ocupacao || 50, 75)
  }

  // 7. Recalcular score total se houve correÃ§Ãµes
  if (erros.length > 0 || avisos.length > 0) {
    const pesos = { localizacao: 0.20, desconto: 0.18, juridico: 0.18, ocupacao: 0.15, liquidez: 0.15, mercado: 0.14 }
    const scoreBase =
      (analise.score_localizacao || 0) * pesos.localizacao +
      (analise.score_desconto    || 0) * pesos.desconto +
      (analise.score_juridico    || 0) * pesos.juridico +
      (analise.score_ocupacao    || 0) * pesos.ocupacao +
      (analise.score_liquidez    || 0) * pesos.liquidez +
      (analise.score_mercado     || 0) * pesos.mercado
    let fator = 1
    if ((analise.score_juridico || 0) < 40) fator *= 0.75
    if (ocupLower === 'ocupado') fator *= 0.85
    analise.score_total = Math.min(10, Math.round(scoreBase * fator * 10) / 10)
    if (analise.score_total >= 7.5) analise.recomendacao = 'COMPRAR'
    else if (analise.score_total >= 6.0) analise.recomendacao = 'AGUARDAR'
    else analise.recomendacao = 'EVITAR'
  }

  analise._erros_validacao = erros
  analise._avisos_validacao = avisos
  return analise
}

// -- FASE 4: Extrair fotos do site do imovel via Claude --

export async function extrairFotosImovel(url, claudeKey) {
  if (!url || !claudeKey) return { fotos: [], foto_principal: null }
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': claudeKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role: 'user',
          content: `Acesse esta URL de imovel: ${url}

O site pode usar JavaScript/React/SPA para carregar imagens dinamicamente.
Tente as seguintes estrategias para encontrar fotos do imovel:

1. Verificar se a URL contem parametros de ID do lote
2. Buscar imagens no padrao: /storage/, /images/, /fotos/, /uploads/, /lote/
3. Para marcoantonioleiloeiro.com.br, imagens costumam seguir o padrao:
   https://marcoantonioleiloeiro.com.br/storage/lotes/[ID]/[arquivo].jpg
4. Verificar meta tags og:image
5. Verificar atributos data-src, data-lazy, data-original, srcset
6. Procure por tags <img> com src contendo extensoes .jpg, .jpeg, .png, .webp
7. Priorize fotos grandes (nao icones, nao logos, nao thumbnails)

Retorne APENAS um JSON valido no formato:
{
  "fotos": ["url1", "url2"],
  "foto_principal": "url_principal",
  "estrategia_usada": "qual metodo funcionou"
}
Maximo de 12 fotos. A foto_principal deve ser a fachada ou melhor angulo externo.`
        }]
      })
    })
    if (!res.ok) return { fotos: [], foto_principal: null }
    const data = await res.json()
    let txt = ''
    for (const block of (data.content || [])) {
      if (block.type === 'text') txt += block.text
    }
    const jsonMatch = txt.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return { fotos: [], foto_principal: null }
    const parsed = JSON.parse(jsonMatch[0])
    return {
      fotos: (parsed.fotos || []).filter(f => f && f.startsWith('http')).slice(0, 12),
      foto_principal: parsed.foto_principal || parsed.fotos?.[0] || null
    }
  } catch {
    return { fotos: [], foto_principal: null }
  }
}

export async function analisarImovelCompleto(url, claudeKey, openaiKey, parametros, criterios, onProgress, anexos) {
  const progress = onProgress || (() => {})

  const cidade = 'Brasil'
  const tipo = 'ImÃÂ³vel'

  progress('Ã°ÂÂÂ ChatGPT pesquisando dados de mercado na internet...')
  const dadosGPT = await pesquisarMercadoGPT(url, cidade, tipo, openaiKey)


  if (dadosGPT) {
    progress('Ã¢ÂÂ ChatGPT encontrou dados de mercado. Claude analisando o imÃÂ³vel...')
  } else {
    progress('Ã¢ÂÂ Ã¯Â¸Â ChatGPT indisponÃÂ­vel. Claude analisando com dados internos...')
  }

  // Detectar regiÃ£o e buscar dados de mercado local
  const regiaoDetectada = detectarRegiao(
    dadosGPT?.cidade || cidade || '',
    dadosGPT?.bairro || ''
  )
  const dadosMercado = regiaoDetectada ? getMercado(regiaoDetectada) : null
  const contextoMercadoRegional = dadosMercado ? `
DADOS DE MERCADO DA REGIÃO (use para calibrar os scores):
- RegiÃ£o: ${dadosMercado.label}
- PreÃ§o mÃ©dio mÂ²: R$ ${dadosMercado.preco_m2_venda_medio.toLocaleString('pt-BR')}
- Aluguel mÃ©dio mÂ²: R$ ${dadosMercado.preco_m2_locacao}/mÂ²
- Tempo mÃ©dio de venda: ${dadosMercado.tempo_venda_dias} dias
- TendÃªncia 12 meses: ${dadosMercado.tendencia} (${dadosMercado.tendencia_pct_12m}%)
- Demanda atual: ${dadosMercado.demanda}
- VacÃ¢ncia regional: ${dadosMercado.vacancia_pct}%
- Yield bruto tÃ­pico: ${dadosMercado.yield_bruto_pct}%
- ImÃ³vel mais lÃ­quido: ${JSON.stringify(dadosMercado.imovel_mais_liquido)}
` : ''



  // ── Enriquecimento com dados por bairro (metricas_bairros_bh.js) ──
  const bairroNome = dadosGPT?.bairro || ''
  const bairroData = BAIRROS_BH[bairroNome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')]
  let contextoBairro = ''
  if (bairroData) {
    const gapPct = calcGapPrecoPct(bairroData.preco_m2?.asking, bairroData.preco_m2?.closing)
    const classeIPEAD = getClasseIPEAD(bairroNome)
    contextoBairro = `
DADOS DO BAIRRO (fonte: QuintoAndar 3T2025 + FipeZAP Fev/2026 + IPEAD/UFMG):
- Bairro: ${bairroData.nome} (${bairroData.zona})
- Classe IPEAD: ${classeIPEAD?.classe || 'N/A'} (${classeIPEAD?.label || 'N/A'})
- Preço anúncio (asking): R$ ${bairroData.preco_m2?.asking?.toLocaleString('pt-BR')}/m²
- Preço contrato (closing): R$ ${bairroData.preco_m2?.closing?.toLocaleString('pt-BR') || 'N/D'}/m²
- Gap asking/closing: ${gapPct ? gapPct.toFixed(1) + '%' : 'N/D'}
- Tendência 12m: ${bairroData.tendencia_12m || 'N/D'}%
- Yield bruto: ${bairroData.yield_bruto_pct || 'N/D'}%
- Demanda: ${bairroData.demanda}
IMPORTANTE: Use o gap asking/closing para calibrar a negociação e o score de oportunidade.`
  }
  // Append bairro context to market context
  const contextoCompleto = (contextoMercadoRegional || '') + contextoBairro

  const analise = await analisarComClaude(url, claudeKey, parametros, criterios, dadosGPT, anexos, contextoCompleto)

  progress('Ã°ÂÂÂ Calculando score com parÃÂ¢metros do grupo...')
  const score_total = calcularScore(analise, parametros)

  // Enriquecer com dados de mercado regional (se detectou regiÃ£o)
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
          if (scoreLiquidez > 70 && alerta.includes('baixa_liquidez')) return false
          if (scoreLiquidez > 70 && alerta.includes('vacancia')) return false
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
      analise.alertas = [...(analise.alertas||[]), ...dadosGPT.noticias.map(n => `Ã°ÂÂÂ° ${n}`)]
  }

  // Extrair fotos do site
  progress('\xf0\x9f\x93\xb8 Extraindo fotos do imovel...')
  let fotosResult = { fotos: [], foto_principal: null }
  try {
    fotosResult = await extrairFotosImovel(url, claudeKey) || { fotos: [], foto_principal: null }
  } catch { /* ignorar erro de fotos */ }

  // ValidaÃ§Ã£o pÃ³s-anÃ¡lise: corrigir Ã¡rea, preÃ§o/mÂ², alertas contraditÃ³rios
  progress('ð Validando dados da anÃ¡lise...')
  const analiseValidada = validarECorrigirAnalise(analise)
  // Recalcular score se a validaÃ§Ã£o corrigiu algo
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
