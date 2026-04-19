/**
 * AXIS — Agente de Reanálise (v2)
 * 
 * Não tenta fazer scraping na reanálise — usa os dados já salvos no banco
 * como contexto completo para o Gemini revalidar e enriquecer.
 * Custo: ~R$ 0,005 por reanálise
 */

import { calcularScore, validarECorrigirAnalise } from './motorIA.js'
import { MODELOS_GEMINI } from './constants.js'

async function _getJurimetria() {
  try {
    const { getJurimetriaVara } = await import('./supabase.js')
    return await getJurimetriaVara()
  } catch(e) { console.warn('[AXIS] Jurimetria indisponível:', e.message); return [] }
}

export async function reAnalisarComGemini(imovelAtualParam, geminiKey, parametros, onProgress) {
  let imovelAtual = imovelAtualParam
  const progress = onProgress || (() => {})

  if (!geminiKey) throw new Error('Chave Gemini não configurada')
  if (!imovelAtual?.id) throw new Error('Imóvel inválido')

  progress('Preparando dados para reanálise...')

  // Carregar documentos jurídicos existentes para enriquecer o contexto da IA
  try {
    const { getDocumentosJuridicos } = await import('./supabase.js')
    const docs = await getDocumentosJuridicos(imovelAtual.id)
    if (docs?.length > 0) {
      imovelAtual = {
        ...imovelAtual,
        _documentos_resumo: docs.map(d => ({
          tipo: d.tipo, nome: d.nome,
          resumo: d.resumo_executivo || d.analise_ia,
          score: d.score_viabilidade,
          recomendacao: d.recomendacao_juridica,
          riscos: (d.riscos_encontrados||[]).slice(0,3).map(r=>r.descricao||r),
        }))
      }
      progress(`📄 ${docs.length} documento(s) incluído(s) no contexto`)
    }
  } catch(e) { console.warn('[AXIS reanalise] docs:', e.message) }

  // Construir contexto completo do imóvel para o Gemini
  const contexto = {
    titulo: imovelAtual.titulo,
    endereco: imovelAtual.endereco,
    bairro: imovelAtual.bairro,
    cidade: imovelAtual.cidade,
    tipo: imovelAtual.tipo,
    area_m2: imovelAtual.area_usada_calculo_m2 || imovelAtual.area_privativa_m2 || imovelAtual.area_m2,
    area_usada_calculo_m2: imovelAtual.area_usada_calculo_m2,
    area_privativa_m2: imovelAtual.area_privativa_m2,
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
    vara_judicial: imovelAtual.vara_judicial || null,
    tipo_justica: imovelAtual.tipo_justica || null,
    mao_flip: imovelAtual.mao_flip || null,
    mao_locacao: imovelAtual.mao_locacao || null,
  }

  const jurimetriaVaras = await _getJurimetria()

  const prompt = `Você é especialista em análise de imóveis em leilão judicial no Brasil (BH/MG).

Reavalie este imóvel com base nos dados já coletados. NÃO precisa acessar URL externa.
Use APENAS os dados fornecidos para validar, corrigir e enriquecer a análise.

DADOS ATUAIS DO IMÓVEL:
${JSON.stringify(contexto, null, 2)}

${jurimetriaVaras.length > 0 ? `JURIMETRIA DAS VARAS (TJMG/TRT-3 BH — dados reais):
${jurimetriaVaras.map(v => '- ' + v.vara_nome + ': ' + v.tempo_total_ciclo_dias + 'd ciclo | ' + v.taxa_sucesso_posse_pct + '% sucesso').join('\n')}
Use vara_judicial do imóvel para calibrar prazo_liberacao_estimado_meses.` : ''}

SCORES ATUAIS:
- Localização: ${imovelAtual.score_localizacao} (peso 20%)
- Desconto: ${imovelAtual.score_desconto} (peso 18%)
- Jurídico: ${imovelAtual.score_juridico} (peso 18%)
- Ocupação: ${imovelAtual.score_ocupacao} (peso 15%)
- Liquidez: ${imovelAtual.score_liquidez} (peso 15%)
- Mercado: ${imovelAtual.score_mercado} (peso 14%)

CALIBRAÇÃO DOS SCORES (escala 0-10 — OBRIGATÓRIO seguir):
- Localização: bairro nobre BH (Savassi/Lourdes)→9.5, bom (Dona Clara/Pampulha)→7.5-8.5, médio→5-6, periferia→3-4
  ESTE IMÓVEL está em: ${imovelAtual.bairro} → aplique calibração correspondente
  Se bairro for Dona Clara: score_localizacao deve ser 8.0-9.0
- Desconto: 60%+→9.5, 50%→8.5, 40%→7.5, 30%→6.0, 20%→4.5, <10%→2.0
  ATENÇÃO: desconto de ${imovelAtual.desconto_percentual}% deve resultar em score aproximado de ${Math.round((imovelAtual.desconto_percentual >= 60 ? 9.5 : imovelAtual.desconto_percentual >= 50 ? 8.5 : imovelAtual.desconto_percentual >= 40 ? 7.5 : imovelAtual.desconto_percentual >= 30 ? 6.0 : imovelAtual.desconto_percentual >= 20 ? 4.5 : 2.0) * 10) / 10}
- Jurídico: sem processos→8.5, 1 processo trabalhista→6.5, risco grave→3.0
- Ocupação: desocupado confirmado→8.5, incerto→5.5, ocupado→3.0
- Liquidez: alta demanda bairro→8.5, média→6.5, baixa→4.0
- Mercado: classe Luxo BH→8.5, Alto→7.0, Médio→5.5, Popular→4.0
REGRA: Nenhum score individual pode ser alterado em mais de 1.5 pontos vs o valor atual sem justificativa explícita.

Se mao_flip ou mao_locacao estiverem nulos, calcule:
- mao_flip = (valor_mercado_estimado × 0.80) - (custo_reforma_estimado + valor_minimo × 0.10)
- mao_locacao = aluguel_mensal_estimado × 120 × 0.90
Lance acima do mao_flip → [CRITICO] nos alertas.

COMPARÁVEIS: NÃO retorne comparáveis neste JSON de reanálise — eles são gerenciados separadamente.
Se o prompt pedir comparáveis, ignore — essa reanálise só valida scores e síntese.

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

  // Cascata centralizada de constants.js
  let data = null
  let ultimoErro = null
  let modeloUsado = MODELOS_GEMINI[0]

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
        const errResumido = errTxt.includes('API_KEY_INVALID') ? 'chave inválida' :
          errTxt.includes('PERMISSION_DENIED') ? 'sem permissão' :
          errTxt.includes('QUOTA_EXCEEDED') ? 'quota excedida' :
          errTxt.includes('MODEL_NOT_FOUND') ? 'modelo indisponível' :
          `HTTP ${r.status}`
        progress(`⚠️ ${modelo}: ${errResumido} — tentando próximo...`)
        ultimoErro = new Error(`Gemini ${r.status}: ${errTxt.substring(0, 150)}`)
        if (r.status === 400 && errTxt.includes('API_KEY_INVALID')) break
        continue
      }
      data = await r.json()
      modeloUsado = modelo
      console.debug('[AXIS agenteReanalise] Sucesso com modelo:', modelo)
      break
    } catch(e) {
      console.warn('[AXIS agenteReanalise] Erro com', modelo, ':', e.message)
      progress(`⚠️ ${modelo}: erro de rede (${e.message.substring(0, 50)})`)
      ultimoErro = e
    }
  }

  if (!data) throw ultimoErro || new Error('Todos os modelos Gemini falharam')
  const txt = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const clean = txt.replace(/```json|```/g, '').trim()
  const match = clean.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Gemini não retornou JSON válido')

  const deltaRaw = JSON.parse(match[0])
  // Garantir que scores estão no range 0-10 (proteção contra alucinação)
  const SCORE_CAMPOS = ['score_localizacao','score_desconto','score_juridico','score_ocupacao','score_liquidez','score_mercado']
  const delta = { ...deltaRaw }
  for (const campo of SCORE_CAMPOS) {
    if (delta[campo] != null) {
      delta[campo] = Math.max(0, Math.min(10, parseFloat(delta[campo]) || 0))
    }
  }
  // Validar recomendacao
  if (!['COMPRAR','AGUARDAR','EVITAR'].includes(delta.recomendacao)) {
    delete delta.recomendacao // deixar o recalculo automático pelo score
  }
  progress('✅ Reanálise Gemini concluída')

  // Fallback: calcular aluguel se Gemini retornou 0
  if ((!delta.aluguel_mensal_estimado || delta.aluguel_mensal_estimado === 0) &&
      (delta.preco_m2_mercado || imovelAtual.preco_m2_mercado) > 0 &&
      (imovelAtual.area_m2 || imovelAtual.area_privativa_m2)) {
    const area = imovelAtual.area_privativa_m2 || imovelAtual.area_m2
    const preco = delta.preco_m2_mercado || imovelAtual.preco_m2_mercado
    const yieldMap = { Popular: 0.075, Médio: 0.060, Medio: 0.060, Alto: 0.050, Luxo: 0.040 }
    const classe = delta.classe_ipead || imovelAtual.classe_ipead || 'Medio'
    const yieldAnual = yieldMap[classe] || 0.060
    delta.aluguel_mensal_estimado = Math.round(preco * area * yieldAnual / 12)
  }

  // Preservar campos críticos contra zeros/nulls do Gemini
  const PRESERVAR_SE_ZERO = ['desconto_percentual','preco_m2_mercado','preco_m2_imovel',
    'aluguel_mensal_estimado','valor_mercado_estimado','num_leilao']
  for (const campo of PRESERVAR_SE_ZERO) {
    const novoVal = parseFloat(delta[campo]) || 0
    const valAnterior = parseFloat(imovelAtual[campo]) || 0
    const novoEhZeroOuVazio = !delta[campo] || novoVal === 0
    const anteriorEhValido = valAnterior > 0
    // Proteger também contra variações extremas (>30%) em preços de mercado
    const camposPreco = ['preco_m2_mercado','preco_m2_imovel','valor_mercado_estimado']
    const variacaoExtrema = camposPreco.includes(campo) && anteriorEhValido && novoVal > 0
      && Math.abs(novoVal - valAnterior) / valAnterior > 0.30
    if ((novoEhZeroOuVazio && anteriorEhValido) || variacaoExtrema) {
      delete delta[campo]
    }
  }

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
    // Comparáveis: só usar do delta se tiver links reais e não for tipo terreno
    comparaveis: (() => {
      const deltaComp = delta.comparaveis || []
      const atualComp = imovelAtual.comparaveis || []
      const deltaOk = deltaComp.filter(c => c.link && !['terreno','lote'].includes((c.tipo||'').toLowerCase()))
      const atualOk = atualComp.filter(c => c.link)
      // Manter os do banco se tiver mais comparáveis com links válidos
      if (atualOk.length > 0 && deltaOk.length < atualOk.length) return atualComp
      if (deltaOk.length > 0) return deltaComp
      return atualComp
    })(),
    criado_em: imovelAtual.criado_em,
    criado_por: imovelAtual.criado_por,
    mao_flip: delta.mao_flip || imovelAtual.mao_flip || null,
    mao_locacao: delta.mao_locacao || imovelAtual.mao_locacao || null,
    _modelo_usado: modeloUsado,
  }

  // Recalcular score total com os pesos corretos (fonte: constants.js)
  const { SCORE_PESOS: _pesos } = await import('./constants.js')
  const pesos = _pesos
  const scoreCalc =
    (analiseAtualizada.score_localizacao || 0) * pesos.localizacao +
    (analiseAtualizada.score_desconto || 0)    * pesos.desconto +
    (analiseAtualizada.score_juridico || 0)    * pesos.juridico +
    (analiseAtualizada.score_ocupacao || 0)    * pesos.ocupacao +
    (analiseAtualizada.score_liquidez || 0)    * pesos.liquidez +
    (analiseAtualizada.score_mercado || 0)     * pesos.mercado
  analiseAtualizada.score_total = parseFloat(scoreCalc.toFixed(2))

  // Garantir recomendação coerente com o score
  // Recomendação baseada no score — respeita delta da IA se coerente
  if (analiseAtualizada.score_total >= 8.0) analiseAtualizada.recomendacao = 'COMPRAR'
  else if (analiseAtualizada.score_total >= 7.0) analiseAtualizada.recomendacao = delta.recomendacao === 'AGUARDAR' ? 'AGUARDAR' : 'COMPRAR'
  else if (analiseAtualizada.score_total >= 6.0) analiseAtualizada.recomendacao = delta.recomendacao === 'EVITAR' ? 'EVITAR' : 'AGUARDAR'
  else analiseAtualizada.recomendacao = 'EVITAR'

  return analiseAtualizada
}
