// ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
// AXIS ÃÂ¢ÃÂÃÂ Motor Duplo de IA
// Fase 1: ChatGPT pesquisa dados de mercado na internet
// Fase 2: Claude recebe tudo + parÃÂÃÂ¢metros do banco e gera anÃÂÃÂ¡lise
// Fase 3: Score calculado com os pesos definidos pelo admin
// ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ

import { detectarRegiao, getMercado } from '../data/mercado_regional.js'
import {
  BAIRROS_BH,
  getBairroDados,
  calcGapPrecoPct,
  getClasseIPEAD,
  REFERENCIAS_BH,
  YIELD_POR_ZONA,
} from '../data/metricas_bairros_bh.js'

const CLAUDE_MODEL = 'claude-sonnet-4-20250514'
const GPT_MODEL = 'gpt-4o'

const REGRAS_MODALIDADE_TEXTO = `
REGRAS CRÃÂTICAS POR MODALIDADE (APLIQUE SEMPRE):
LEILÃÂO JUDICIAL:
- IPTU anterior: STJ protege arrematante (sub-roga no preÃÂ§o) Ã¢ÂÂ risco baixo
- CondomÃÂ­nio anterior: CPC/2015 sub-roga no preÃÂ§o Ã¢ÂÂ risco mÃÂ©dio
- ImÃÂ³vel ocupado: aÃÂ§ÃÂ£o de imissÃÂ£o na posse (prazo 4Ã¢ÂÂ24 meses, custo R$514Ã¢ÂÂ5.818)

LEILÃÂO EXTRAJUDICIAL / ALIENAÃÂÃÂO FIDUCIÃÂRIA:
- IPTU e condomÃÂ­nio: verificar edital Ã¢ÂÂ pode ser do comprador
- ImÃÂ³vel ocupado: reintegraÃÂ§ÃÂ£o de posse (Lei 9.514 + STJ 2024, 60 dias legal, 4Ã¢ÂÂ24 meses real)

IMÃÂVEL CAIXA (leilÃÂ£o ou venda direta):
- IPTU: FICA COM O COMPRADOR (FAQ CAIXA oficial)
- CondomÃÂ­nio: FICA COM O COMPRADOR (FAQ CAIXA oficial)
- ComissÃÂ£o leiloeiro: 5% sobre o valor arrematado
- SEMPRE calcular esses custos no custo total da operaÃÂ§ÃÂ£o

BLOQUEIOS AUTOMÃÂTICOS:
- DivergÃÂªncia edital vs matrÃÂ­cula: score mÃÂ¡ximo 35, recomendaÃÂ§ÃÂ£o EVITAR
- ImÃÂ³vel ocupado: score ÃÂ 0.85
- Risco nota Ã¢ÂÂ¥ 9: penalizar -35 pontos no score

Para qualquer campo jurÃÂ­dico identificado, informe:
- modalidade_leilao detectada
- riscos presentes (lista de risco_id)
- custo_juridico_estimado total
- prazo_liberacao_estimado_meses
`

const REGRAS_COLETA_DADOS = `
REGRAS OBRIGATÃÂRIAS DE COLETA E ANÃÂLISE

--- DICIONÃÂRIO TÃÂCNICO DE ÃÂREA (NBR 12721 + Lei 4.591/64) ---
CAMPOS QUE O EDITAL PODE INFORMAR:
  area_privativa      Ã¢ÂÂ uso exclusivo da unidade (padrÃÂ£o de mercado para preÃÂ§o/mÃÂ²)
  area_util           Ã¢ÂÂ interna varrÃÂ­vel, sem paredes/pilares (~10-12% menor que privativa)
  area_comum          Ã¢ÂÂ espaÃÂ§os compartilhados do condomÃÂ­nio (nÃÂ£o usar para preÃÂ§o/mÃÂ²)
  area_total          Ã¢ÂÂ privativa + quota de ÃÂ¡rea comum (nÃÂ£o usar como base principal)
  area_real_total     Ã¢ÂÂ denominaÃÂ§ÃÂ£o registral: privativa real + fraÃÂ§ÃÂ£o de comum
  area_equivalente    Ã¢ÂÂ usada em incorporaÃÂ§ÃÂ£o para equivalÃÂªncia de custo

PRIORIDADE de leitura de ÃÂ¡rea (use nesta ordem):
1. ÃÂ¡rea_privativa (ÃÂ¡rea exclusiva do proprietÃÂ¡rio Ã¢ÂÂ padrÃÂ£o ZAP/VivaReal)
2. ÃÂ¡rea_construÃÂ­da (se nÃÂ£o houver privativa)
3. ÃÂ¡rea_total (NUNCA use para preÃÂ§o/mÃÂ² Ã¢ÂÂ inclui ÃÂ¡rea comum)

TIPOLOGIAS ESPECIAIS:
COBERTURA DUPLEX (2 andares, terraÃÂ§o):
  A ÃÂ¡rea privativa TOTAL jÃÂ¡ inclui os dois andares + terraÃÂ§o
  Ã¢ÂÂ usar area_privativa_total como base de comparaÃÂ§ÃÂ£o (ÃÂ© tudo do proprietÃÂ¡rio)
  Ã¢ÂÂ separar: area_coberta (interno) + area_descoberta (terraÃÂ§o)
  Ã¢ÂÂ terraÃÂ§o vale menos por mÃÂ² que ÃÂ¡rea coberta, mas ambos sÃÂ£o privativos
  Exemplo: edital "135,49mÃÂ² priv / 156,19mÃÂ² priv total / 247,60mÃÂ² real total"
  Ã¢ÂÂ area_coberta_privativa = 135,49mÃÂ² (fechado dos 2 andares)
  Ã¢ÂÂ area_privativa = 156,19mÃÂ² (fechado + varandas)
  Ã¢ÂÂ area_real_total = 247,60mÃÂ² (com fraÃÂ§ÃÂ£o comum Ã¢ÂÂ NÃÂO usar)
  Ã¢ÂÂ area_usada_calculo = 156,19mÃÂ² (privativa total)

APARTAMENTO GARDEN:
  area_interna = ÃÂ¡rea coberta exclusiva Ã¢ÂÂ usar para preÃÂ§o/mÃÂ²
  area_externa = jardim privativo Ã¢ÂÂ valor menor por mÃÂ²

CASA EM CONDOMÃÂNIO:
  area_construida = ÃÂ¡rea da casa Ã¢ÂÂ usar para preÃÂ§o/mÃÂ²
  area_terreno = lote privativo Ã¢ÂÂ guardar separado

REGRA DE DECISÃÂO AUTOMÃÂTICA:
Se apenas UMA ÃÂ¡rea informada: ÃÂ© provavelmente a privativa. Usar como base.
Se DUAS ÃÂ¡reas: menor = fechada, maior = privativa total Ã¢ÂÂ usar a MAIOR
Se TRÃÂS ÃÂ¡reas: menor = fechada, mÃÂ©dia = privativa total, maior = real total
  Ã¢ÂÂ usar a MÃÂDIA (privativa total) como base de preÃÂ§o/mÃÂ²

CAMPOS OBRIGATÃÂRIOS NO JSON:
  area_privativa_m2: nÃÂºmero (exclusiva total)
  area_coberta_privativa_m2: nÃÂºmero (apenas fechada/coberta)
  area_descoberta_privativa_m2: nÃÂºmero (terraÃÂ§o/varanda descoberta)
  area_total_m2: nÃÂºmero (com fraÃÂ§ÃÂ£o comum Ã¢ÂÂ registral)
  area_usada_calculo_m2: nÃÂºmero (qual foi usada para preÃÂ§o/mÃÂ²)
  area_usada_label: "string explicando a escolha"

--- AVALIAÃÂÃÂO E LANCE ---
AVALIAÃÂÃÂO JUDICIAL Ã¢ÂÂ  VALOR DE MERCADO:
  - avaliaÃÂ§ÃÂ£o_judicial: valor definido pelo perito do processo
  - valor_mercado_real: o que imÃÂ³vel similar vende no mercado livre
  - lance_minimo: geralmente 60-70% da avaliaÃÂ§ÃÂ£o no 2ÃÂº leilÃÂ£o
  - lance_atual: o ÃÂºltimo lance registrado no portal (se houver)
Para calcular desconto, use SEMPRE:
  desconto_sobre_avaliacao = (avaliacao - lance_minimo) / avaliacao
  desconto_sobre_mercado = (valor_mercado_real - lance_minimo) / valor_mercado_real
NUNCA invente a avaliaÃÂ§ÃÂ£o. Se nÃÂ£o encontrar no edital, marque como null.

--- CUSTO TOTAL DE AQUISIÃÂÃÂO ---
Sempre calcular o custo real total:
  custo_total = lance + comissao_leiloeiro + itbi + registro + honorarios
ComissÃÂ£o leiloeiro:
  - PadrÃÂ£o: 5% sobre o valor arrematado
  - Sempre pago pelo ARREMATANTE (nÃÂ£o pelo vendedor)
  - Incluir no custo total obrigatoriamente
ITBI:
  - Belo Horizonte: 3%
  - Contagem, Betim, Nova Lima: 2%
  - Juiz de Fora: 2%
  - Outros MG: estimativa 2%
  - Base de cÃÂ¡lculo: valor arrematado ou avaliaÃÂ§ÃÂ£o (o maior)

--- COMPARAÃÂÃÂO COM MERCADO ---
Para definir preco_m2_mercado, use esta hierarquia:
1. AnÃÂºncios COMPARÃÂVEIS da mesma rua ou condomÃÂ­nio (mais preciso)
2. AnÃÂºncios comparÃÂ¡veis do mesmo bairro/tipologia
3. Dados ZAP/VivaReal do bairro para a tipologia especÃÂ­fica
4. Dados gerais do bairro como fallback
TIPOLOGIA importa muito para comparaÃÂ§ÃÂ£o:
  Cobertura duplex Ã¢ÂÂ  apartamento padrÃÂ£o
  Studio Ã¢ÂÂ  1 quarto
  Casa em condomÃÂ­nio Ã¢ÂÂ  apartamento
Se o imÃÂ³vel for cobertura, penthouse, duplex ou diferenciado:
  Ã¢ÂÂ buscar comparÃÂ¡veis especÃÂ­ficos dessa tipologia
  Ã¢ÂÂ nÃÂ£o usar mÃÂ©dia geral do bairro como referÃÂªncia

--- PASSIVOS (IPTU, CONDOMÃÂNIO) ---
Regra por modalidade (CRÃÂTICO):
LEILÃÂO JUDICIAL (CPC/2015):
  - Se edital NÃÂO menciona nada Ã¢ÂÂ dÃÂ©bitos se sub-rogam no preÃÂ§o (nÃÂ£o ÃÂ© do arrematante)
  - Se edital EXPRESSAMENTE exonera o arrematante Ã¢ÂÂ marcar como ponto positivo (+15 pts jurÃÂ­dico)
  - Risco financeiro: BAIXO a NULO para o arrematante
LEILÃÂO CAIXA / EXTRAJUDICIAL:
  - IPTU e condomÃÂ­nio ficam com o COMPRADOR (FAQ CAIXA oficial)
  - Risco financeiro: ALTO Ã¢ÂÂ calcular e incluir no custo total
EXTINÃÂÃÂO DE CONDOMÃÂNIO (caso especial):
  - Modalidade onde coproprietÃÂ¡rios encerram condomÃÂ­nio voluntÃÂ¡rio
  - DÃÂ©bitos costumam ser resolvidos entre as partes, nÃÂ£o pelo arrematante
  - Geralmente positivo juridicamente

--- ALERTAS E CONSISTÃÂNCIA ---
NUNCA gerar alerta que contradiga o score:
  Se score_liquidez >= 70 â NÃO incluir alerta "baixa_liquidez"
  Se score_juridico >= 75 â NÃO incluir alerta de risco jurÃ­dico alto
  Se imÃ³vel desocupado confirmado â NÃO incluir alerta de ocupaÃ§Ã£o
Alertas devem ser ACIONÃVEIS:
  Errado: "muito_baixa_liquidez" (cÃ³digo interno, nÃ£o Ãºtil)
  Correto: "Confirmar ocupaÃ§Ã£o presencialmente antes do lance"
  Correto: "Solicitar certidÃ£o de matrÃ­cula atualizada (30 dias)"
  Correto: "Verificar se condomÃ­nio aceitarÃ¡ novo proprietÃ¡rio"

IMPORTANTE: NAO use emojis nos campos de texto (alertas, positivos, negativos).
Use APENAS tags de texto: [CRITICO] [ATENCAO] [OK] [INFO]
Emojis corrompem o encoding UTF-8 no pipeline de processamento.

--- REGIÃO GEOGRÃFICA ---
Identificar corretamente a cidade/bairro:
  Contagem Ã¢ÂÂ  Belo Horizonte (sÃÂ£o municÃÂ­pios diferentes)
  Nova Lima Ã¢ÂÂ  BH (municÃÂ­pio diferente, preÃÂ§o/mÃÂ² muito maior)
  Betim Ã¢ÂÂ  BH
  Juiz de Fora = cidade prÃÂ³pria, nÃÂ£o RMBH
Para Contagem, usar dados de Contagem (ZAP: ~R$4.200-5.800/mÃÂ²)
Para BH Centro-Sul, usar dados de BH (ZAP: ~R$12.000-15.000/mÃÂ²)
`

const REGRAS_REFORMA_TEXTO = `
PARÃÂMETROS DE CUSTO DE REFORMA Ã¢ÂÂ MG/BH/JF 2026
(apenas custo direto: mÃÂ£o de obra + materiais + terceirizados)
NÃÂO inclui: projeto, ART, administraÃÂ§ÃÂ£o, mÃÂ³veis, eletrodomÃÂ©sticos

ESCOPOS DISPONÃÂVEIS:
- refresh_giro: pintura + reparos + revisÃÂ£o pontual = R$200Ã¢ÂÂ520/mÃÂ² (classe D a A)
- leve_funcional: refresh + piso + troca funcional = R$360Ã¢ÂÂ900/mÃÂ²
- leve_reforcada_1_molhado: leve + 1 banheiro ou cozinha = R$620Ã¢ÂÂ1.450/mÃÂ²

PACOTES DE SERVIÃÂO FIXOS:
- Pintura geral: R$3.500Ã¢ÂÂ9.000
- RevisÃÂ£o elÃÂ©trica pontual: R$1.500Ã¢ÂÂ5.000
- RevisÃÂ£o hidrÃÂ¡ulica pontual: R$1.500Ã¢ÂÂ6.000
- Banheiro refresh: R$7.000Ã¢ÂÂ14.000
- Banheiro leve reforÃÂ§ado: R$14.000Ã¢ÂÂ22.000
- Cozinha refresh: R$10.000Ã¢ÂÂ20.000
- Cozinha leve reforÃÂ§ada: R$20.000Ã¢ÂÂ32.000

TETO ECONÃÂMICO (% do valor de mercado):
- Classe A (>R$12k/mÃÂ²): 3% a 7%
- Classe B (R$8Ã¢ÂÂ12k/mÃÂ²): 3% a 6%
- Classe C (R$5Ã¢ÂÂ8k/mÃÂ²): 2,5% a 5%
- Classe D (<R$5k/mÃÂ²): 2% a 4%

Se a reforma proposta superar o teto, penalizar score_financeiro.
Retornar no JSON: escopo_reforma, custo_reforma_estimado, alerta_sobrecap
`

// ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ FASE 1: ChatGPT pesquisa mercado e contexto do imÃÂÃÂ³vel ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ

export async function pesquisarMercadoGPT(url, cidade, tipo, openaiKey) {
  if (!openaiKey) return null

  const prompt = `VocÃÂÃÂª ÃÂÃÂ© um especialista em mercado imobiliÃÂÃÂ¡rio brasileiro.
Pesquise na internet dados ATUAIS sobre este imÃÂÃÂ³vel de leilÃÂÃÂ£o: ${url}

REGRAS DE PESQUISA:
1. IDENTIFICAR O IMÃÂÃÂVEL CORRETAMENTE:
   - Leia o endereÃÂÃÂ§o completo: rua, nÃÂÃÂºmero, bairro, cidade, UF
   - NÃÂÃÂ£o confundir municÃÂÃÂ­pio: Contagem ÃÂ¢ÃÂÃÂ  BH, Nova Lima ÃÂ¢ÃÂÃÂ  BH
   - Identificar tipologia: apartamento, cobertura, duplex, casa, studio

2. PESQUISAR COMPARÃÂÃÂVEIS:
   Busque no ZAP, VivaReal e OLX:
   - ImÃÂÃÂ³veis da mesma RUA (mais preciso)
   - ImÃÂÃÂ³veis do mesmo BAIRRO com tipologia similar
   - ImÃÂÃÂ³veis do mesmo BAIRRO com ÃÂÃÂ¡rea similar (ÃÂÃÂ±30mÃÂÃÂ²)
   Para COBERTURA ou DUPLEX:
   - Buscar especificamente "cobertura [bairro] [cidade]"
   - NÃÂÃÂ£o comparar com apartamento padrÃÂÃÂ£o

3. COLETAR PREÃÂÃÂO/mÃÂÃÂ² CORRETO:
   - Usar ZAP ImÃÂÃÂ³veis ÃÂ¢ÃÂÃÂ seÃÂÃÂ§ÃÂÃÂ£o "Quanto vale o mÃÂÃÂ² em [bairro]?"
   - Anotar: preÃÂÃÂ§o mÃÂÃÂ©dio geral E preÃÂÃÂ§o por tipologia/tamanho
   - Anotar a fonte exatamente (URL)

4. INFORMAÃÂÃÂÃÂÃÂES DO LEILÃÂÃÂO:
   - Confirmar valor de avaliaÃÂÃÂ§ÃÂÃÂ£o judicial no edital
   - Confirmar lance mÃÂÃÂ­nimo atual
   - Verificar se hÃÂÃÂ¡ lances jÃÂÃÂ¡ registrados
   - Verificar data e hora do leilÃÂÃÂ£o

5. SITUAÃÂÃÂÃÂÃÂO JURÃÂÃÂDICA:
   - Verificar se hÃÂÃÂ¡ processos no TJMG alÃÂÃÂ©m do leilÃÂÃÂ£o
   - Confirmar modalidade (judicial/extrajudicial/extinÃÂÃÂ§ÃÂÃÂ£o condomÃÂÃÂ­nio)
   - Verificar matrÃÂÃÂ­cula se disponÃÂÃÂ­vel

6. PreÃÂÃÂ§o mÃÂÃÂ©dio de ${tipo} em ${cidade} (R$/mÃÂÃÂ²)
7. TendÃÂÃÂªncia do mercado imobiliÃÂÃÂ¡rio em ${cidade} (ÃÂÃÂºltimos 6 meses)
8. Demanda por ${tipo} em ${cidade} para compra e locaÃÂÃÂ§ÃÂÃÂ£o
9. Infraestrutura prÃÂÃÂ³xima: transporte, comÃÂÃÂ©rcio, escolas, hospitais

Retorne APENAS JSON vÃÂÃÂ¡lido (sem markdown):
{
  "cidade": "string",
  "bairro": "string",
  "tipologia": "string",
  "preco_m2_mercado": number,
  "preco_m2_fonte": "string (URL ou descriÃÂÃÂ§ÃÂÃÂ£o da fonte)",
  "comparaveis": [
    {"descricao": "string", "valor": number, "area_m2": number, "preco_m2": number}
  ],
  "valor_avaliacao_encontrado": null,
  "lance_minimo_encontrado": null,
  "tendencia_mercado": "Alta|EstÃÂÃÂ¡vel|Queda",
  "demanda": "Alta|MÃÂÃÂ©dia|Baixa",
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
    console.warn('[AXIS] ChatGPT indisponÃÂÃÂ­vel:', e.message)
    return null
  }
}

// ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ FASE 2: Claude analisa o link com todos os dados ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ

export async function analisarComClaude(url, claudeKey, parametros, criterios, dadosGPT, anexos, contextoMercadoRegional) {
  const pesosInfo = (parametros || [])
    .map(p => `  - ${p.nome}: peso ${p.peso}% (dimensao: ${p.dimensao})`)
    .join('\n')

  const criteriosInfo = (criterios || [])
    .map(c => `  - ${c.nome} [${c.categoria}] tipo: ${c.tipo_valor}${c.obrigatorio ? ' ÃÂ¢ÃÂÃÂ ÃÂ¯ÃÂ¸ÃÂOBRIGATÃÂÃÂRIO' : ''}`)
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

  const prompt = `VocÃÂÃÂª ÃÂÃÂ© um especialista em anÃÂÃÂ¡lise de imÃÂÃÂ³veis em leilÃÂÃÂ£o no Brasil.

Acesse e analise este imÃÂÃÂ³vel: ${url}

${REGRAS_COLETA_DADOS}
${contextoGPT}
${contextoMercadoRegional || ''}
${REGRAS_MODALIDADE_TEXTO}
${REGRAS_REFORMA_TEXTO}

PESOS DE SCORE DEFINIDOS PELO GRUPO PARA ESTE APP (USE ESTES PESOS EXATOS):
${pesosInfo || '  - LocalizaÃÂÃÂ§ÃÂÃÂ£o: 20%, Desconto: 18%, JurÃÂÃÂ­dico: 18%, OcupaÃÂÃÂ§ÃÂÃÂ£o: 15%, Liquidez: 15%, Mercado: 14%'}

CRITÃÂÃÂRIOS ADICIONAIS DE AVALIAÃÂÃÂÃÂÃÂO DO GRUPO:
${criteriosInfo || '  (nenhum critÃÂÃÂ©rio personalizado cadastrado)'}

INSTRUÃÂÃÂÃÂÃÂES:
1. Acesse a URL e extraia todos os dados disponÃÂÃÂ­veis do imÃÂÃÂ³vel
2. Use os dados do ChatGPT para calibrar scores de localizaÃÂÃÂ§ÃÂÃÂ£o e mercado
3. Calcule o score_total como mÃÂÃÂ©dia ponderada usando os pesos acima
4. Aplique penalizaÃÂÃÂ§ÃÂÃÂµes: juridico<4 ÃÂ¢ÃÂÃÂ ÃÂÃÂ0.75; ocupado ÃÂ¢ÃÂÃÂ ÃÂÃÂ0.85
5. Seja conservador nas estimativas de retorno
6. Indique estrutura de aquisiÃÂÃÂ§ÃÂÃÂ£o ideal (CPF, CondomÃÂÃÂ­nio, PJ, ProcuraÃÂÃÂ§ÃÂÃÂ£o)

RETORNE APENAS JSON VÃÂLIDO (sem markdown, sem texto fora do JSON).
NUNCA omitir campos obrigatÃÂ³rios. Use null se nÃÂ£o souber.
NUNCA usar area_total_m2 para calcular preco_m2_imovel.
NAO use emojis diretamente nos campos alertas, positivos e negativos.
Use apenas tags de texto: [CRITICO] [ATENCAO] [OK] [INFO]
{
  "titulo": "string",
  "endereco": "string",
  "cidade": "string",
  "estado": "UF 2 letras",
  "bairro": "string",
  "tipo": "Apartamento|Casa|Terreno|Comercial|GalpÃÂ£o|Rural|Cobertura",
  "tipologia": "apartamento_padrao|cobertura_linear|cobertura_duplex|apartamento_garden|apartamento_duplex|casa|studio|loft",
  "area_privativa_m2": null,
  "area_coberta_privativa_m2": null,
  "area_descoberta_privativa_m2": null,
  "area_total_m2": null,
  "area_real_total_m2": null,
  "area_usada_calculo_m2": 0,
  "area_usada_label": "string explicando a ÃÂ¡rea escolhida",
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
  "liquidez": "Alta|MÃÂ©dia|Baixa",
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
  "justificativa": "string detalhada 3-5 linhas explicando a decisÃÂ£o",
  "estrategia_recomendada": "flip|locacao|temporada",
  "sintese_executiva": "string â 3 frases em linguagem simples para membros nÃ£o-especialistas. Ex: 'Este apartamento estÃ¡ sendo vendido por menos da metade do preÃ§o de mercado em um bairro de alta demanda. O maior risco Ã© a ocupaÃ§Ã£o incerta, que pode exigir aÃ§Ã£o judicial de 6 a 18 meses. Para o grupo AXIS, o cenÃ¡rio mais conservador ainda entrega retorno acima de 40%.'",
  "estrategia_recomendada_detalhe": {
    "tipo": "flip_rapido|renda_passiva|airbnb|reforma_revenda|locacao_longa",
    "motivo": "string â por que este imÃ³vel se encaixa nessa estratÃ©gia",
    "prazo_estimado_meses": 0,
    "roi_estimado_pct": 0
  },
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
  if (!jsonMatch) throw new Error('Claude nÃÂÃÂ£o retornou JSON vÃÂÃÂ¡lido')
  return JSON.parse(jsonMatch[0])
}

// ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ FASE 3: Calcular score total com pesos do banco ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ

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
  if ((analise.ocupacao || '').toLowerCase() === 'ocupado') score *= 0.85

  return Math.min(10, Math.max(0, parseFloat(score.toFixed(2))))
}

// ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ FUNÃÂÃÂÃÂÃÂO PRINCIPAL: orquestrar tudo ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ

// -- ValidaÃÂ§ÃÂ£o pÃÂ³s-anÃÂ¡lise (guardrails) --

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

  // 1. Ãrea usada para cÃ¡lculo â corrigir se usou total/real em vez de privativa
  const areaReal = analise.area_real_total_m2 || analise.area_total_m2
  const areaPriv = analise.area_privativa_m2
  if (areaReal && areaPriv && analise.area_usada_calculo_m2 === areaReal) {
    analise.area_usada_calculo_m2 = areaPriv
    erros.push('CORRIGIDO: ÃÂ¡rea de cÃÂ¡lculo era total/registral, substituÃÂ­da pela privativa')
  }
  // Se nÃÂ£o definiu area_usada_calculo, inferir
  if (!analise.area_usada_calculo_m2) {
    analise.area_usada_calculo_m2 = areaPriv || analise.area_coberta_privativa_m2 || analise.area_m2 || areaReal
  }
  // Garantir area_m2 = ÃÂ¡rea usada no cÃÂ¡lculo (backward compat)
  if (analise.area_usada_calculo_m2) {
    analise.area_m2 = analise.area_usada_calculo_m2
  }

  // 2. PreÃÂ§o/mÃÂ² coerente com ÃÂ¡rea usada
  if (analise.valor_minimo && analise.area_usada_calculo_m2) {
    const preco_correto = analise.valor_minimo / analise.area_usada_calculo_m2
    if (analise.preco_m2_imovel > preco_correto * 1.2 ||
        analise.preco_m2_imovel < preco_correto * 0.8) {
      avisos.push(`preco_m2 inconsistente: informado=${analise.preco_m2_imovel}, calculado=${preco_correto.toFixed(0)}`)
      analise.preco_m2_imovel = Math.round(preco_correto)
    }
  }

  // 3. AvaliaÃÂ§ÃÂ£o nÃÂ£o pode ser absurda (> 5x lance = provavelmente errada)
  if (analise.valor_avaliacao && analise.valor_minimo) {
    if (analise.valor_avaliacao > analise.valor_minimo * 5) {
      erros.push(`AVISO: avaliaÃÂ§ÃÂ£o R$${analise.valor_avaliacao} desproporcional ao lance R$${analise.valor_minimo}`)
    }
  }

  // 4. Alertas contraditÃÂ³rios com scores
  if (analise.alertas) {
    analise.alertas = analise.alertas.filter(alerta => {
      const a = (typeof alerta === 'string') ? alerta.toLowerCase() : ''
      if ((a.includes('baixa_liquidez') || a.includes('muito_baixa')) &&
          (analise.score_liquidez || 0) >= 6.5) return false
      if (a.includes('alta_vacancia') && (analise.score_liquidez || 0) >= 6.5) return false
      if (a.includes('risco jur') && (analise.score_juridico || 0) >= 7.0) return false
      return true
    })
    // Substituir alertas internos por linguagem amigÃÂ¡vel
    analise.alertas = analise.alertas.map(a => {
      if (a === 'muito_baixa_liquidez') return 'Liquidez regional moderada Ã¢ÂÂ estimar prazo de 90-150 dias para revenda'
      if (a === 'alta_vacancia') return 'RegiÃÂ£o com vacÃÂ¢ncia acima da mÃÂ©dia Ã¢ÂÂ preferir locaÃÂ§ÃÂ£o a flip rÃÂ¡pido'
      if (a === 'baixa_liquidez') return 'Liquidez moderada no bairro Ã¢ÂÂ precificar competitivamente para venda rÃÂ¡pida'
      return a
    })
  }

  // 5. Custo total deve incluir comissÃÂ£o
  if (analise.valor_minimo && !analise.custo_total_aquisicao) {
    const comissao = analise.valor_minimo * ((analise.comissao_leiloeiro_pct || 5) / 100)
    const itbi = analise.valor_minimo * ((analise.itbi_pct || 2) / 100)
    analise.custo_total_aquisicao = Math.round(
      analise.valor_minimo + comissao + itbi + (analise.custo_regularizacao || 15000)
    )
  }

  // 6. Score de ocupaÃÂ§ÃÂ£o Ã¢ÂÂ "nunca habitado" ou desocupado deve ter score alto
  const tituloLower = (analise.titulo || '').toLowerCase()
  const justLower = (analise.justificativa || '').toLowerCase()
  const ocupLower = (analise.ocupacao || '').toLowerCase()
  if ((ocupLower === 'desocupado' || tituloLower.includes('nunca habitado') ||
       justLower.includes('nunca habitado')) &&
      (analise.score_ocupacao || 0) < 7.0) {
    avisos.push('AJUSTE: imÃ³vel nunca habitado/desocupado â score_ocupacao ajustado')
    analise.score_ocupacao = Math.max(analise.score_ocupacao || 5.0, 7.5)
  }

  // 7. Recalcular score total se houve correÃÂ§ÃÂµes
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
    if ((analise.score_juridico || 0) < 4) fator *= 0.75
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

  // Tentar og:image como fallback rapido antes da IA
  let ogFallback = null
  try {
    const htmlRes = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) })
    if (htmlRes.ok) {
      const html = await htmlRes.text()
      const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
      if (ogMatch) ogFallback = ogMatch[1]
    }
  } catch { /* ignorar - sites SPA podem nao retornar */ }

  // Extrair dominio e ID do lote da URL para ajudar a IA
  let dominio = '', loteId = ''
  try {
    dominio = new URL(url).hostname
    const loteMatch = url.match(/\/lote\/(\d+)/)
    if (loteMatch) loteId = loteMatch[1]
  } catch {}

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
        max_tokens: 1000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: promptFotos }]
      })
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
    const parsed = JSON.parse(jsonMatch[0])
    const fotos = (parsed.fotos || []).filter(f => f && f.startsWith('http')).slice(0, 12)
    let fotoPrincipal = parsed.foto_principal || fotos[0] || null

    // Se IA nao encontrou fotos, usar og:image como fallback
    if (!fotoPrincipal && ogFallback) {
      fotoPrincipal = ogFallback
      if (!fotos.length) fotos.push(ogFallback)
    }

    return { fotos, foto_principal: fotoPrincipal }
  } catch {
    // Fallback final: og:image
    if (ogFallback) return { fotos: [ogFallback], foto_principal: ogFallback }
    return { fotos: [], foto_principal: null }
  }
}

export async function analisarImovelCompleto(url, claudeKey, openaiKey, parametros, criterios, onProgress, anexos) {
  const progress = onProgress || (() => {})

  const cidade = 'Brasil'
  const tipo = 'ImÃÂÃÂ³vel'

  progress('ÃÂ°ÃÂÃÂÃÂ ChatGPT pesquisando dados de mercado na internet...')
  const dadosGPT = await pesquisarMercadoGPT(url, cidade, tipo, openaiKey)


  if (dadosGPT) {
    progress('ÃÂ¢ÃÂÃÂ ChatGPT encontrou dados de mercado. Claude analisando o imÃÂÃÂ³vel...')
  } else {
    progress('ÃÂ¢ÃÂÃÂ ÃÂ¯ÃÂ¸ÃÂ ChatGPT indisponÃÂÃÂ­vel. Claude analisando com dados internos...')
  }

  // Detectar regiÃÂ£o e buscar dados de mercado local
  const regiaoDetectada = detectarRegiao(
    dadosGPT?.cidade || cidade || '',
    dadosGPT?.bairro || ''
  )
  const dadosMercado = regiaoDetectada ? getMercado(regiaoDetectada) : null
  const contextoMercadoRegional = dadosMercado ? `
DADOS DE MERCADO DA REGIÃÂO (use para calibrar os scores):
- RegiÃÂ£o: ${dadosMercado.label}
- PreÃÂ§o mÃÂ©dio mÃÂ²: R$ ${dadosMercado.preco_m2_venda_medio.toLocaleString('pt-BR')}
- Aluguel mÃÂ©dio mÃÂ²: R$ ${dadosMercado.preco_m2_locacao}/mÃÂ²
- Tempo mÃÂ©dio de venda: ${dadosMercado.tempo_venda_dias} dias
- TendÃÂªncia 12 meses: ${dadosMercado.tendencia} (${dadosMercado.tendencia_pct_12m}%)
- Demanda atual: ${dadosMercado.demanda}
- VacÃÂ¢ncia regional: ${dadosMercado.vacancia_pct}%
- Yield bruto tÃÂ­pico: ${dadosMercado.yield_bruto_pct}%
- ImÃÂ³vel mais lÃÂ­quido: ${JSON.stringify(dadosMercado.imovel_mais_liquido)}
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
DADOS DE BAIRRO (granularidade fina â ${dadosBairro.label}):
- Zona: ${dadosBairro.zona}
- PreÃ§o anÃºncio (FipeZAP fev/2026): ${dadosBairro.precoAnuncioM2 ? `R$ ${dadosBairro.precoAnuncioM2.toLocaleString('pt-BR')}/mÂ²` : 'nÃ£o disponÃ­vel'}
- PreÃ§o contrato (QuintoAndar 3T2025): ${dadosBairro.precoContratoM2 ? `R$ ${dadosBairro.precoContratoM2.toLocaleString('pt-BR')}/mÂ²` : 'nÃ£o disponÃ­vel'}
- Tipo de dado: ${dadosBairro.tipoPreco === 'proxy_zona' ? 'â ï¸ estimativa por zona â usar com cautela' : 'dado real de transaÃ§Ã£o'}
${gapPctBairro !== null ? `- Gap anÃºncio vs contrato: ${gapPctBairro.toFixed(1)}% (negociaÃ§Ã£o mÃ©dia)` : ''}
- Yield bruto estimado: ${dadosBairro.yieldBruto}% a.a.
- TendÃªncia 12m: ${dadosBairro.tendencia12m > 20 ? `â ï¸ ${dadosBairro.tendencia12m}% (verificar amostra)` : `${dadosBairro.tendencia12m}%`}
- Classe socioeconÃ´mica IPEAD: ${dadosBairro.classeIpead} â ${dadosBairro.classeIpeadLabel}
${dadosBairro.obs ? `- ObservaÃ§Ã£o: ${dadosBairro.obs}` : ''}
IMPORTANTE: Use o gap asking/closing para calibrar a negociaÃ§Ã£o e o score de oportunidade.`
  } else if (classeIPEAD) {
    contextoBairro = `
DADOS DE BAIRRO (parcial):
- Classe IPEAD: ${classeIPEAD.classe} â ${classeIPEAD.label}
- Dados de preÃ§o especÃ­fico nÃ£o disponÃ­veis para este bairro`
  }
  // Append bairro context to market context
  const contextoCompleto = (contextoMercadoRegional || '') + contextoBairro

  const analise = await analisarComClaude(url, claudeKey, parametros, criterios, dadosGPT, anexos, contextoCompleto)

  progress('ÃÂ°ÃÂÃÂÃÂ Calculando score com parÃÂÃÂ¢metros do grupo...')
  const score_total = calcularScore(analise, parametros)

  // Enriquecer com dados de mercado regional (se detectou regiÃÂ£o)
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
      analise.alertas = [...(analise.alertas||[]), ...dadosGPT.noticias.map(n => `ÃÂ°ÃÂÃÂÃÂ° ${n}`)]
  }

  // Extrair fotos do site
  progress('\xf0\x9f\x93\xb8 Extraindo fotos do imovel...')
  let fotosResult = { fotos: [], foto_principal: null }
  try {
    fotosResult = await extrairFotosImovel(url, claudeKey) || { fotos: [], foto_principal: null }
  } catch { /* ignorar erro de fotos */ }

  // ValidaÃÂ§ÃÂ£o pÃÂ³s-anÃÂ¡lise: corrigir ÃÂ¡rea, preÃÂ§o/mÃÂ², alertas contraditÃÂ³rios
  progress('Ã°ÂÂÂ Validando dados da anÃÂ¡lise...')
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
                `${sobrecap.status === 'vermelho' ? 'ð´' : 'ð¡'} ${sobrecap.mensagem}`
              ]
            }
          }
        }
      }
    }
  } catch(e) { console.warn('[AXIS] CÃ¡lculo reforma:', e.message) }

  // Calcular custo jurÃ­dico usando a base estruturada
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
  } catch(e) { console.warn('[AXIS] CÃ¡lculo jurÃ­dico:', e.message) }

  // Recalcular score se a validaÃÂ§ÃÂ£o corrigiu algo
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
