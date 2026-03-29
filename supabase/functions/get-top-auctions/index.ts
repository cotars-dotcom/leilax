import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: {'Access-Control-Allow-Origin':'*'} })
  const { data, error } = await supabase
    .from('auction_leads')
    .select('id,titulo,endereco,bairro,tipo,valor_avaliacao,lance_minimo,desconto_pct,url_edital,fonte,data_leilao,pontuacao,scraped_at')
    .eq('analisado', false)
    .not('url_edital', 'is', null)
    .order('pontuacao', { ascending: false })
    .limit(3)
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  const fmtC = (v: number) => v ? `R$ ${Math.round(v).toLocaleString('pt-BR')}` : '—'
  const top3 = (data || []).map(p => ({
    ...p,
    lance_fmt: fmtC(p.lance_minimo),
    aval_fmt: fmtC(p.valor_avaliacao),
    desc_fmt: p.desconto_pct ? `${p.desconto_pct}%` : '—'
  }))
  return new Response(
    JSON.stringify({ top3, total: top3.length, gerado_em: new Date().toISOString() }),
    { headers: {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'} }
  )
})
