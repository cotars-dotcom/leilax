/**
 * AXIS — Healthcheck Semanal
 * 
 * Vercel Cron Function — toda segunda-feira às 8h BRT
 * vercel.json: {"crons": [{"path": "/api/healthcheck", "schedule": "0 11 * * 1"}]}
 * 
 * Verifica: leilões próximos, lance > MAO, confiança baixa, banco conectado
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

const sbFetch = (path, opts = {}) => fetch(`${SUPABASE_URL}/rest/v1${path}`, {
  headers: {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    ...opts.headers,
  },
  ...opts,
})

export default async function handler(req, res) {
  // Aceitar GET e HEAD (Vercel usa GET para crons)
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const report = {
    timestamp: new Date().toISOString(),
    alertas: [],
    avisos: [],
    status: 'ok',
    banco: 'desconhecido',
  }

  try {
    // 1. Testar conexão com banco
    const ping = await sbFetch('/imoveis?status=eq.analisado&select=id&limit=1')
    report.banco = ping.ok ? 'ok' : `erro HTTP ${ping.status}`

    if (!ping.ok) {
      report.status = 'erro'
      return res.status(200).json(report)
    }

    // 2. Imóveis ativos completos
    const r = await sbFetch('/imoveis?status=eq.analisado&select=codigo_axis,bairro,cidade,data_leilao,data_leilao_2,valor_minimo,valor_minimo_2,mao_flip,mao_locacao,recomendacao,confidence_score,score_total,prazo_revenda_meses')
    const imoveis = await r.json()

    const hoje = Date.now()
    const diasP = (d) => d ? Math.ceil((new Date(d + 'T12:00') - hoje) / 86400000) : null

    for (const im of (imoveis || [])) {
      const d1 = diasP(im.data_leilao)
      const d2 = diasP(im.data_leilao_2)
      const label = `${im.codigo_axis} (${im.bairro})`

      // Urgências (≤7 dias)
      if (d1 !== null && d1 >= 0 && d1 <= 7) {
        report.alertas.push({ tipo: '🔴 URGENTE', msg: `${label}: 1ª praça em ${d1 === 0 ? 'HOJE' : d1 + 'd'} — mín. R$${Math.round(im.valor_minimo||0).toLocaleString('pt-BR')}` })
        report.status = 'alerta'
      }
      if (d2 !== null && d2 >= 0 && d2 <= 7) {
        report.alertas.push({ tipo: '🔴 URGENTE', msg: `${label}: 2ª praça em ${d2 === 0 ? 'HOJE' : d2 + 'd'} — mín. R$${Math.round(im.valor_minimo_2||0).toLocaleString('pt-BR')}` })
        report.status = 'alerta'
      }

      // Avisos
      if (im.mao_flip && im.valor_minimo && parseFloat(im.valor_minimo) > parseFloat(im.mao_flip)) {
        report.avisos.push({ tipo: '⚠️ MAO', msg: `${label}: lance R$${Math.round(im.valor_minimo).toLocaleString('pt-BR')} > MAO R$${Math.round(im.mao_flip).toLocaleString('pt-BR')}` })
      }
      if ((im.confidence_score || 0) < 40) {
        report.avisos.push({ tipo: '📊 DADOS', msg: `${label}: confiança ${im.confidence_score || 0}% — enriquecer com agentes F5` })
      }
      if (!im.prazo_revenda_meses || im.prazo_revenda_meses === 0) {
        report.avisos.push({ tipo: '⏱️ PRAZO', msg: `${label}: prazo de revenda não configurado` })
      }
    }

    // 3. Log no banco se há alertas
    if (report.alertas.length > 0 || report.avisos.length > 0) {
      if (report.alertas.length > 0) report.status = 'alerta'
      await sbFetch('/sprint_24_changelog', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          sprint: 'CRON_HEALTHCHECK',
          tabela: 'imoveis',
          operacao: 'healthcheck_semanal',
          descricao: `${report.alertas.length} alerta(s) · ${report.avisos.length} aviso(s) · ${(imoveis||[]).length} imóvel(is)`,
          dados_antes: null,
          dados_depois: report,
        }),
      })
    }

    // 4. Resumo final
    report.total_imoveis = (imoveis || []).length
    report.total_alertas = report.alertas.length
    report.total_avisos = report.avisos.length
    return res.status(200).json(report)

  } catch (e) {
    return res.status(500).json({
      error: e.message,
      timestamp: new Date().toISOString(),
      status: 'erro_critico',
    })
  }
}
