import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)
const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY') || ''

async function fetchCaixaCSV(): Promise<any[]> {
  try {
    const res = await fetch(
      'https://venda-imoveis.caixa.gov.br/listaweb/Lista_imoveis_MG.csv',
      { signal: AbortSignal.timeout(30000) }
    )
    if (!res.ok) return []
    const text = await res.text()
    const lines = text.split('\n')
    const header = lines[0].split(';').map(h => h.trim().toLowerCase())

    return lines.slice(1)
      .filter(l => l.toUpperCase().includes('BELO HORIZONTE') || l.toUpperCase().includes('BH'))
      .map(line => {
        const cols = line.split(';')
        const preco = parseFloat(cols[5]?.replace(/[^0-9,]/g,'').replace(',','.')) || 0
        const aval  = parseFloat(cols[6]?.replace(/[^0-9,]/g,'').replace(',','.')) || 0
        const desc  = parseFloat(cols[7]?.replace(/[^0-9,%]/g,'')) || 0
        if (preco <= 0) return null
        return {
          codigo_externo: cols[0]?.trim() || null,
          cidade: 'Belo Horizonte',
          bairro: cols[3]?.trim() || null,
          endereco: cols[4]?.trim() || null,
          lance_minimo: preco,
          valor_avaliacao: aval || preco / (1 - desc/100),
          tipo: cols[8]?.toLowerCase().includes('apart') ? 'apartamento' : 'imovel',
          url_edital: cols[10]?.trim() || null,
          fonte: 'caixa',
        }
      })
      .filter(p => p !== null && (p as any).lance_minimo > 0)
  } catch(e) {
    console.error('[scrape] Caixa CSV:', e.message)
    return []
  }
}

async function scrapeLeilaoImovel(): Promise<any[]> {
  if (!GEMINI_KEY) return []
  try {
    const jinaUrl = 'https://r.jina.ai/https://www.leilaoimovel.com.br/imoveis/belo-horizonte'
    const jinaRes = await fetch(jinaUrl, { signal: AbortSignal.timeout(30000) })
    if (!jinaRes.ok) return []
    const markdown = await jinaRes.text()
    if (markdown.length < 200) return []
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({
          contents: [{ parts: [{ text:
            `Extraia TODOS os imoveis deste site de leilao. Retorne JSON array.\nCada item deve ter: titulo, endereco, bairro, valor_avaliacao (numero), \nlance_minimo (numero), tipo (apartamento|casa|comercial), url_edital (string ou null), \ndata_leilao (YYYY-MM-DD ou null).\nInclua apenas imoveis com dados completos. Nao invente dados.\nMarkdown:\n\n${markdown.substring(0, 6000)}`
          }] }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      }
    )
    const gData = await geminiRes.json()
    const txt = gData.candidates?.[0]?.content?.parts?.[0]?.text || '[]'
    const imoveis = JSON.parse(txt.replace(/```json|```/g,'').trim())
    return Array.isArray(imoveis) ? imoveis.map((p: any) => ({ ...p, cidade: 'Belo Horizonte', fonte: 'leilaoimovel' })) : []
  } catch(e) {
    console.error('[scrape] LeilaoImovel:', e.message)
    return []
  }
}

function calcPontuacao(p: any): number {
  const aval = p.valor_avaliacao || 0
  const lance = p.lance_minimo || 0
  const desc = aval > 0 ? (1 - lance/aval) * 100 : 0
  const scoreDesc = Math.min(desc / 60, 1) * 40
  const scoreData = p.data_leilao ? Math.min(
    Math.max(0, 30 - Math.floor((new Date(p.data_leilao).getTime() - Date.now()) / 86400000)), 30
  ) : 15
  return Math.round(scoreDesc + 30 + scoreData)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: {'Access-Control-Allow-Origin':'*'} })
  try {
    console.log('[scrape] Iniciando coleta...')
    const [caixa, leilao] = await Promise.all([fetchCaixaCSV(), scrapeLeilaoImovel()])

    const todos = [...caixa, ...leilao]
      .filter((p: any) => {
        const aval = p.valor_avaliacao || 0
        const lance = p.lance_minimo || 0
        const desc = aval > 0 ? (1 - lance/aval)*100 : 0
        return lance > 0 && desc >= 25
      })
      .map((p: any) => ({ ...p, pontuacao: calcPontuacao(p), scraped_at: new Date().toISOString() }))
      .sort((a: any, b: any) => b.pontuacao - a.pontuacao)
      .slice(0, 50)

    if (todos.length > 0) {
      const { error } = await supabase.from('auction_leads').upsert(
        todos, { onConflict: 'url_edital', ignoreDuplicates: false }
      )
      if (error) console.error('[scrape] Upsert:', error.message)
    }

    return new Response(JSON.stringify({
      ok: true, total: todos.length,
      caixa: caixa.length, leilao: (leilao as any[]).length
    }), { headers: {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'} })
  } catch(e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500 })
  }
})
