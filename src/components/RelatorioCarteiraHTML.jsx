/**
 * AXIS — Relatório Executivo de Carteira
 * Gera HTML autônomo com snapshot de todos os imóveis ativos.
 * Exportável como PDF via Print.
 */

const fmt = v => v ? `R$ ${Math.round(v).toLocaleString('pt-BR')}` : '—'
const pct = v => v != null ? `${Number(v).toFixed(1)}%` : '—'

function recCor(rec) {
  if (rec === 'COMPRAR')  return { bg: '#ECFDF5', text: '#065F46' }
  if (rec === 'INVIAVEL') return { bg: '#FEF2F2', text: '#991B1B' }
  if (rec === 'AGUARDAR') return { bg: '#FEF9C3', text: '#92400E' }
  return { bg: '#F8FAFC', text: '#334155' }
}

function gerarHTMLCarteira(imoveis, usuario = '') {
  const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  const ativos = imoveis.filter(p => p.status === 'analisado' && p.status_operacional !== 'arquivado')

  const scoreTotal = (p) => Math.round((p.score_total || 0) * 10)
  const diasLeilao = (d) => {
    if (!d) return null
    const diff = Math.ceil((new Date(d + 'T12:00') - Date.now()) / 86400000)
    return diff >= 0 ? diff : null
  }

  const tabelaLinhas = ativos.map(p => {
    const rc = recCor(p.recomendacao)
    const dias1 = diasLeilao(p.data_leilao)
    const dias2 = diasLeilao(p.data_leilao_2)
    const urgente = (dias1 !== null && dias1 <= 15) || (dias2 !== null && dias2 <= 15)
    return `
      <tr style="background:${urgente ? '#FFFBEB' : 'transparent'}">
        <td style="padding:8px 10px;font-weight:700;font-family:monospace;color:#002B80">${p.codigo_axis || '—'}</td>
        <td style="padding:8px 10px">${p.bairro || '—'}<br><span style="font-size:10px;color:#94A3B8">${p.tipologia || p.tipo || ''} · ${p.area_privativa_m2 || p.area_m2 || '—'}m²</span></td>
        <td style="padding:8px 10px;text-align:center"><span style="background:${rc.bg};color:${rc.text};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700">${p.recomendacao || '—'}</span></td>
        <td style="padding:8px 10px;text-align:center;font-size:18px;font-weight:800;color:${scoreTotal(p) >= 70 ? '#059669' : scoreTotal(p) >= 55 ? '#D97706' : '#DC2626'}">${scoreTotal(p)}</td>
        <td style="padding:8px 10px;color:#92400E;font-weight:600">${fmt(p.valor_minimo)}</td>
        <td style="padding:8px 10px;color:#059669">${fmt(p.mao_flip)}</td>
        <td style="padding:8px 10px;color:#7C3AED">${fmt(p.mao_locacao)}</td>
        <td style="padding:8px 10px;color:${p.confidence_score >= 75 ? '#059669' : p.confidence_score >= 50 ? '#D97706' : '#DC2626'};font-weight:700">${p.confidence_score != null ? p.confidence_score + '%' : '—'}</td>
        <td style="padding:8px 10px;text-align:center">
          ${dias1 !== null ? `<span style="color:${dias1 <= 7 ? '#DC2626' : '#D97706'};font-weight:700">${dias1}d</span>` : '—'}
          ${dias2 !== null ? `<br><span style="font-size:10px;color:${dias2 <= 7 ? '#DC2626' : '#D97706'}">2ª ${dias2}d</span>` : ''}
        </td>
      </tr>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width"/>
<title>AXIS IP — Relatório de Carteira · ${hoje}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0 }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #F8FAFC; color: #1E293B; padding: 32px }
  .header { margin-bottom: 24px }
  .logo { font-size: 22px; font-weight: 900; color: #002B80; letter-spacing: -0.5px }
  .sub { font-size: 13px; color: #64748B; margin-top: 2px }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px }
  .kpi { background: #fff; border: 1px solid #E2E8F0; border-radius: 10px; padding: 14px 16px }
  .kpi-n { font-size: 24px; font-weight: 800; color: #002B80 }
  .kpi-l { font-size: 10px; color: #94A3B8; font-weight: 600; text-transform: uppercase; margin-top: 2px }
  table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.08) }
  thead { background: #F1F5F9 }
  th { padding: 10px; text-align: left; font-size: 10px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: .3px }
  tr { border-bottom: 1px solid #F1F5F9 }
  .section-title { font-size: 14px; font-weight: 700; color: #334155; margin: 20px 0 10px }
  .urgente-box { background: #FEF2F2; border: 1px solid #FCA5A5; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px }
  .footer { margin-top: 24px; font-size: 10px; color: #94A3B8; border-top: 1px solid #E2E8F0; padding-top: 12px }
  @media print { body { padding: 20px } }
</style>
</head>
<body>
<div class="header">
  <div class="logo">⚡ AXIS IP — Relatório de Carteira</div>
  <div class="sub">${hoje}${usuario ? ' · ' + usuario : ''} · ${ativos.length} imóvel(is) analisado(s)</div>
</div>

<div class="kpi-grid">
  <div class="kpi">
    <div class="kpi-n">${ativos.length}</div>
    <div class="kpi-l">Imóveis ativos</div>
  </div>
  <div class="kpi">
    <div class="kpi-n" style="color:#059669">${ativos.filter(p => p.recomendacao === 'COMPRAR').length}</div>
    <div class="kpi-l">Recomendados</div>
  </div>
  <div class="kpi">
    <div class="kpi-n" style="color:#D97706">${ativos.filter(p => p.recomendacao === 'AGUARDAR').length}</div>
    <div class="kpi-l">Aguardando</div>
  </div>
  <div class="kpi">
    <div class="kpi-n" style="color:#DC2626">${ativos.filter(p => {
      const d = diasLeilao(p.data_leilao)
      const d2 = diasLeilao(p.data_leilao_2)
      return (d !== null && d <= 15) || (d2 !== null && d2 <= 15)
    }).length}</div>
    <div class="kpi-l">Leilão ≤ 15 dias</div>
  </div>
</div>

<div class="section-title">📊 Carteira de Imóveis</div>
<table>
  <thead>
    <tr>
      <th>Código</th><th>Localização</th><th>Recomendação</th>
      <th>Score</th><th>Lance Mín.</th><th>MAO Flip</th>
      <th>MAO Loc.</th><th>Conf.</th><th>Leilão</th>
    </tr>
  </thead>
  <tbody>${tabelaLinhas}</tbody>
</table>

<div class="footer">
  Relatório gerado automaticamente pelo AXIS IP · axisip.vercel.app<br>
  Dados sujeitos a alteração — verifique o sistema para informações atualizadas.<br>
  MAO = Máximo Aceitável Oferta para ROI 20% (flip) ou yield 6% (locação), incluindo todos os custos.
</div>
</body>
</html>`
}

export function exportarRelatorioCarteira(imoveis, nomeUsuario = '') {
  const html = gerarHTMLCarteira(imoveis, nomeUsuario)
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `AXIS_Carteira_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.html`
  a.click()
  URL.revokeObjectURL(url)
}
