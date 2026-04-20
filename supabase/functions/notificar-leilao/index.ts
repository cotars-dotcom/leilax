/**
 * AXIS — Edge Function: Notificação de Leilão Urgente
 * 
 * Chamada via cron ou manualmente.
 * Busca imóveis com leilão ≤7 dias e envia alerta.
 * Deploy: supabase functions deploy notificar-leilao
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

serve(async (req) => {
  // Auth básica via header secret
  const auth = req.headers.get('Authorization')
  if (auth !== `Bearer ${Deno.env.get('EDGE_SECRET')}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const hoje = new Date().toISOString().split('T')[0]
  const limite = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

  // Imóveis com leilão em ≤7 dias
  const { data: imoveis } = await supabase
    .from('imoveis')
    .select('codigo_axis, titulo, bairro, cidade, data_leilao, data_leilao_2, valor_minimo, valor_minimo_2, mao_flip, mao_locacao, recomendacao')
    .eq('status', 'analisado')
    .or(`data_leilao.gte.${hoje},data_leilao_2.gte.${hoje}`)
    .or(`data_leilao.lte.${limite},data_leilao_2.lte.${limite}`)

  const urgentes = (imoveis || []).filter(im => {
    const d1 = im.data_leilao ? Math.ceil((new Date(im.data_leilao + 'T12:00').getTime() - Date.now()) / 86400000) : null
    const d2 = im.data_leilao_2 ? Math.ceil((new Date(im.data_leilao_2 + 'T12:00').getTime() - Date.now()) / 86400000) : null
    return (d1 !== null && d1 >= 0 && d1 <= 7) || (d2 !== null && d2 >= 0 && d2 <= 7)
  })

  if (!urgentes.length) {
    return new Response(JSON.stringify({ ok: true, urgentes: 0, msg: 'Nenhum leilão urgente' }), { status: 200 })
  }

  // Log no changelog
  await supabase.from('sprint_24_changelog').insert({
    sprint: 'EDGE_NOTIFICACAO',
    tabela: 'imoveis',
    operacao: 'alerta_leilao_urgente',
    descricao: `${urgentes.length} leilão(ões) em ≤7 dias: ${urgentes.map(i => i.codigo_axis).join(', ')}`,
    dados_depois: { urgentes },
  })

  // Corpo do alerta (futuro: enviar via Resend/SendGrid)
  const corpo = urgentes.map(im => {
    const fmt = v => v ? `R$ ${Math.round(v).toLocaleString('pt-BR')}` : '—'
    const d1 = im.data_leilao ? Math.ceil((new Date(im.data_leilao + 'T12:00').getTime() - Date.now()) / 86400000) : null
    const d2 = im.data_leilao_2 ? Math.ceil((new Date(im.data_leilao_2 + 'T12:00').getTime() - Date.now()) / 86400000) : null
    return {
      codigo: im.codigo_axis,
      titulo: im.titulo,
      localizacao: `${im.bairro}, ${im.cidade}`,
      leilao1: d1 !== null && d1 >= 0 ? `${im.data_leilao} (em ${d1}d) — mín. ${fmt(im.valor_minimo)}` : null,
      leilao2: d2 !== null && d2 >= 0 ? `${im.data_leilao_2} (em ${d2}d) — mín. ${fmt(im.valor_minimo_2)}` : null,
      mao_flip: fmt(im.mao_flip),
      mao_locacao: fmt(im.mao_locacao),
      recomendacao: im.recomendacao,
    }
  })

  return new Response(JSON.stringify({ ok: true, urgentes: urgentes.length, alertas: corpo }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
})
