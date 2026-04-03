/**
 * AXIS — Busca de Arremates Históricos via ChatGPT
 * Pesquisa preços reais de arrematação em leilões similares
 * para calibrar o score e estimar MAO com mais precisão.
 * Custo: ~R$0,05 por busca (GPT-4o-mini)
 */

const PROMPT_BUSCA_ARREMATES = (imovel) => `Você é um especialista em leilões imobiliários no Brasil.

IMÓVEL ANALISADO:
- Tipo: ${imovel.tipo || 'Apartamento'}
- Bairro/Cidade: ${imovel.bairro || ''} / ${imovel.cidade || 'Belo Horizonte'}
- Área: ${imovel.area_m2 || '?'}m²
- Quartos: ${imovel.quartos || '?'}
- Vagas: ${imovel.vagas || '?'}
- Avaliação judicial: R$ ${imovel.valor_avaliacao?.toLocaleString('pt-BR') || '?'}
- Lance mínimo: R$ ${imovel.valor_minimo?.toLocaleString('pt-BR') || '?'}
- Modalidade: ${imovel.modalidade_leilao || 'judicial'}

Pesquise arremates reais de imóveis similares em leilões judiciais em BH/MG nos últimos 12 meses.
Considere: mesmo tipo, mesma faixa de área (±20%), mesmo bairro ou região, mesma modalidade.

Retorne APENAS JSON válido:
{
  "arremates": [
    {
      "descricao": "Apto 3Q 2V Buritis 95m²",
      "valor_avaliacao": 500000,
      "valor_arrematado": 320000,
      "pct_avaliacao": 64.0,
      "bairro": "Buritis",
      "data": "2025-11",
      "modalidade": "judicial_tjmg",
      "fonte": "string — leiloeiro ou portal"
    }
  ],
  "media_pct_avaliacao": 62.5,
  "mediana_pct_avaliacao": 61.0,
  "faixa_pct": "55-70%",
  "n_amostras": 3,
  "observacoes": "string — contexto do mercado de leilões no bairro",
  "mao_sugerido": 0,
  "mao_base": "string — explicação do cálculo"
}`

export async function buscarArrematesSimilares(imovel, openaiKey, geminiKey = null) {
  if (!openaiKey && !geminiKey) return null

  // Tentar GPT-4o-mini primeiro (mais barato)
  if (openaiKey) {
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: PROMPT_BUSCA_ARREMATES(imovel) }],
          temperature: 0.2,
          max_tokens: 1500,
        }),
        signal: AbortSignal.timeout(40000)
      })
      if (!r.ok) throw new Error(`OpenAI ${r.status}`)
      const data = await r.json()
      const txt = data.choices?.[0]?.message?.content || ''
      const match = txt.replace(/```json|```/g, '').trim().match(/\{[\s\S]*\}/)
      if (!match) throw new Error('JSON inválido')
      const resultado = JSON.parse(match[0])
      resultado._modelo = 'gpt-4o-mini'
      resultado._custo_estimado_brl = 0.05
      await salvarCacheBusca(imovel, resultado)
      return resultado
    } catch(e) {
      console.warn('[AXIS arremates] GPT-4o-mini:', e.message)
    }
  }

  // Fallback para Gemini
  if (geminiKey) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: PROMPT_BUSCA_ARREMATES(imovel) }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 1500 }
          }),
          signal: AbortSignal.timeout(40000)
        }
      )
      if (!r.ok) throw new Error(`Gemini ${r.status}`)
      const data = await r.json()
      const txt = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      const match = txt.replace(/```json|```/g, '').trim().match(/\{[\s\S]*\}/)
      if (!match) throw new Error('JSON inválido')
      const resultado = JSON.parse(match[0])
      resultado._modelo = 'gemini-1.5-flash'
      resultado._custo_estimado_brl = 0.03
      await salvarCacheBusca(imovel, resultado)
      return resultado
    } catch(e) {
      console.warn('[AXIS arremates] Gemini:', e.message)
    }
  }

  return null
}

// ─── Persistência: salvar resultado da busca no banco ─────────────────────────
async function salvarCacheBusca(imovel, resultado) {
  try {
    const { supabase } = await import('./supabase.js')
    
    // 1. Salvar cache na tabela imoveis (para exibição imediata sem rebuscar)
    await supabase.from('imoveis').update({
      arremates_busca_cache: resultado,
      arremates_busca_em: new Date().toISOString(),
      arremates_busca_modelo: resultado._modelo || 'gpt',
    }).eq('id', imovel.id)

    // 2. Salvar cada arremate individual na tabela arremates_historico
    const arremates = resultado.arremates || []
    for (const a of arremates) {
      await supabase.from('arremates_historico').upsert({
        imovel_axis_id: imovel.codigo_axis,
        endereco: a.descricao || null,
        bairro: a.bairro || imovel.bairro,
        cidade: imovel.cidade || 'Belo Horizonte',
        tipo: imovel.tipo || 'apartamento',
        valor_avaliacao: a.valor_avaliacao || null,
        lance_final: a.valor_arrematado || null,
        pct_avaliacao: a.pct_avaliacao || null,
        leiloeiro: a.fonte || null,
        resultado_real: 'arrematado',
        fonte: resultado._modelo || 'busca_gpt',
        origem_busca: 'busca_gpt',
        notas: a.data ? `Data: ${a.data}` : null,
      }, { onConflict: 'imovel_axis_id,endereco,valor_avaliacao,lance_final', ignoreDuplicates: true })
    }
  } catch(e) {
    console.warn('[AXIS] salvarCacheBusca:', e.message)
  }
}

// Carregar cache de arremates do banco (evitar rebusca)
export async function carregarCacheArremates(imovelId) {
  try {
    const { supabase } = await import('./supabase.js')
    const { data } = await supabase
      .from('imoveis')
      .select('arremates_busca_cache, arremates_busca_em, arremates_busca_modelo')
      .eq('id', imovelId)
      .single()
    
    if (!data?.arremates_busca_cache || !data?.arremates_busca_em) return null
    
    // Cache válido por 7 dias
    const diasDesde = (Date.now() - new Date(data.arremates_busca_em)) / (1000 * 60 * 60 * 24)
    if (diasDesde > 7) return null
    
    const cache = data.arremates_busca_cache
    cache._do_cache = true
    cache._cache_em = data.arremates_busca_em
    cache._modelo = data.arremates_busca_modelo
    return cache
  } catch(e) {
    console.warn('[AXIS] carregarCacheArremates:', e.message)
    return null
  }
}

// Salvar arrremate no banco para calibração futura
export async function salvarArremateHistorico(imovelId, dadosArrematacao) {
  try {
    const { supabase } = await import('./supabase.js')
    const { error } = await supabase.from('arremates_historico').insert({
      imovel_id: imovelId,
      valor_avaliacao: dadosArrematacao.valor_avaliacao,
      valor_arrematado: dadosArrematacao.valor_arrematado,
      pct_avaliacao: dadosArrematacao.pct_avaliacao,
      bairro: dadosArrematacao.bairro,
      tipo: dadosArrematacao.tipo,
      modalidade: dadosArrematacao.modalidade,
      data_arrematacao: dadosArrematacao.data,
      fonte: dadosArrematacao.fonte || 'busca_gpt',
    })
    if (error) console.warn('[AXIS] salvarArrematacao:', error.message)
  } catch(e) { console.warn('[AXIS] salvarArremateHistorico:', e.message) }
}
