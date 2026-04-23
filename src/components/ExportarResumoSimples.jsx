/**
 * AXIS IP — Relatório Didático v2
 * Linguagem acessível para qualquer pessoa entender se deve ou não comprar.
 * Estrutura: Veredicto → Imóvel → Números → Riscos → Próximos passos
 *
 * Sprint 41d: usa calcularDadosFinanceiros (constants.js) — unificado com
 * ExportarDecisaoPDF e ExportarPDF para garantir mesmos números em todos
 * os relatórios.
 */

import { abrirHtmlNovaTela } from '../lib/abrirHtml.js'
import { isMercadoDireto } from '../lib/detectarFonte.js'
import { calcularDadosFinanceiros } from '../lib/constants.js'

const fmt   = v  => v != null && v !== '' ? `R$ ${Math.round(Number(v)).toLocaleString('pt-BR')}` : '—'
const fmtPct= v  => v != null ? `${Number(v).toFixed(1)}%` : '—'
const fmtD  = d  => d ? new Date(d + 'T12:00').toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' }) : '—'
const toArr = v  => Array.isArray(v) ? v : (v && typeof v === 'string' ? v.split('|').filter(Boolean) : [])

function calcularInvestimento(lance, p) {
  if (!lance || !p.valor_mercado_estimado) return null
  const eMercado = isMercadoDireto(p.fonte_url, p.tipo_transacao)
  const df = calcularDadosFinanceiros(lance, p, eMercado)
  const bd = df.breakdown
  return {
    lance: df.lance,
    taxas: bd.totalCustos,
    reforma: bd.reforma,
    holding: bd.holding,
    debitos: bd.debitosArrematante,
    juridico: bd.custoJuridico,
    invest: df.investimentoTotal,
    lucroVenda: df.lucroFlip,
    roiFlip: df.roiFlip,
    yieldAnual: df.yieldBruto,
    aluguelMensal: df.aluguelMensal,
  }
}

function gerarHTML(p) {
  const hoje    = new Date()
  const eMercado = isMercadoDireto(p.fonte_url, p.tipo_transacao)
  const d1 = p.data_leilao   ? Math.ceil((new Date(p.data_leilao   + 'T12:00') - hoje) / 86400000) : null
  const d2 = p.data_leilao_2 ? Math.ceil((new Date(p.data_leilao_2 + 'T12:00') - hoje) / 86400000) : null
  const av = parseFloat(p.valor_avaliacao || 0)
  const mk = parseFloat(p.valor_mercado_estimado || 0)
  const lanceDecisao = parseFloat(p.lance_maximo_definido || 0)
  const area = parseFloat(p.area_usada_calculo_m2 || p.area_privativa_m2 || p.area_m2 || 0)

  // Cálculo da melhor oportunidade
  const lance2p = parseFloat(p.valor_minimo_2 || 0)
  const roiMelhor = lance2p > 0 ? calcularInvestimento(lance2p, p) : null
  const roiDecisao = lanceDecisao > 0 ? calcularInvestimento(lanceDecisao, p) : null

  // Cenários da 2ª praça
  const cenarios = !eMercado && av > 0 ? [
    { titulo: 'Piso legal',    pct: 50, lance: Math.round(av * 0.50), descricao: 'Valor mínimo que o juiz aceita' },
    { titulo: 'Mais provável', pct: 57, lance: Math.round(av * 0.57), descricao: 'Concorrência normal' },
    { titulo: 'Competitivo',   pct: 65, lance: Math.round(av * 0.65), descricao: 'Disputa acirrada' },
  ].map(c => ({ ...c, r: calcularInvestimento(c.lance, p) })) : []

  const positivos = toArr(p.positivos)
  const negativos = toArr(p.negativos)
  const alertasBrutos = toArr(p.alertas)
  const alertas = alertasBrutos
    .filter(a => typeof a === 'string')
    .map(a => a.replace(/^\[ATENCAO\]\s*/i,'').replace(/^\[INFO\]\s*/i,'').trim())
    .filter(Boolean)

  // Veredicto em linguagem simples
  const V = {
    COMPRAR:             { emoji:'✅', titulo:'Vale a pena arrematar',   cor:'#065F46', bg:'#ECFDF5', borda:'#059669' },
    AGUARDAR:            { emoji:'⏳', titulo:'Aguarde a 2ª data',       cor:'#92400E', bg:'#FFFBEB', borda:'#D97706' },
    INVIAVEL:            { emoji:'❌', titulo:'Não recomendado',         cor:'#991B1B', bg:'#FEF2F2', borda:'#DC2626' },
    DADOS_INSUFICIENTES: { emoji:'❓', titulo:'Dados incompletos',       cor:'#374151', bg:'#F3F4F6', borda:'#9CA3AF' },
  }
  const v = V[p.recomendacao] || { emoji:'—', titulo: p.recomendacao || '—', cor:'#374151', bg:'#F3F4F6', borda:'#9CA3AF' }
  const scoreN  = Math.round((parseFloat(p.score_total)||0) * 10)
  const scoreCor= scoreN >= 75 ? '#059669' : scoreN >= 55 ? '#D97706' : '#DC2626'
  const scoreTxt= scoreN >= 75 ? 'Excelente oportunidade' : scoreN >= 60 ? 'Boa oportunidade' : scoreN >= 45 ? 'Oportunidade mediana' : 'Oportunidade fraca'

  const descPct = mk > 0 && lance2p > 0 ? Math.round((1 - lance2p / mk) * 100) : null

  const css = `
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:-apple-system,'Segoe UI',Arial,sans-serif; background:#F1F5F9; color:#1E293B; font-size:15px; line-height:1.65; }
.page { max-width:740px; margin:0 auto; padding:24px 16px 48px; }
h2 { font-size:13px; font-weight:700; color:#64748B; text-transform:uppercase; letter-spacing:.6px; margin-bottom:14px; display:flex; align-items:center; gap:8px; }
h2 span.n { display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:50%; background:#0F172A; color:#fff; font-size:11px; font-weight:900; }
.card { background:#fff; border-radius:14px; padding:20px 22px; margin-bottom:14px; border:1px solid #E2E8F0; }
.logo { font-size:18px; font-weight:900; letter-spacing:-.5px; }
.logo em { font-style:normal; color:#D97706; }
.chip { display:inline-block; background:#E2E8F0; color:#475569; padding:3px 11px; border-radius:20px; font-size:12px; font-weight:600; margin:2px 3px 2px 0; }
.kpi { background:#F8FAFC; border-radius:10px; padding:13px 15px; }
.kpi-l { font-size:11px; color:#64748B; font-weight:600; text-transform:uppercase; letter-spacing:.4px; margin-bottom:3px; }
.kpi-v { font-size:21px; font-weight:900; color:#0F172A; }
.kpi-s { font-size:11px; color:#94A3B8; margin-top:2px; }
.grid2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.grid3 { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
.explain { background:#EFF6FF; border-left:3px solid #3B82F6; border-radius:0 8px 8px 0; padding:10px 14px; font-size:13px; color:#1E40AF; margin-bottom:14px; line-height:1.5; }
.tag-g { background:#ECFDF5; color:#065F46; }
.tag-r { background:#FEF2F2; color:#991B1B; }
.tag-y { background:#FFFBEB; color:#92400E; }
.banner { border-radius:10px; padding:15px 18px; border:2px solid; display:flex; gap:14px; align-items:flex-start; }
.banner-ico { font-size:32px; line-height:1; flex-shrink:0; }
.banner-t { font-size:20px; font-weight:900; margin-bottom:4px; }
.banner-s { font-size:13px; line-height:1.5; opacity:.85; }
table { width:100%; border-collapse:collapse; font-size:13px; }
th { background:#F1F5F9; padding:8px 10px; text-align:left; font-size:11px; font-weight:700; color:#64748B; text-transform:uppercase; letter-spacing:.3px; }
td { padding:9px 10px; border-bottom:1px solid #F1F5F9; vertical-align:top; }
tr:last-child td { border-bottom:none; }
.g { color:#059669; font-weight:700; } .r { color:#DC2626; font-weight:700; } .m { color:#D97706; font-weight:700; } .p { color:#7C3AED; font-weight:700; }
.row { display:flex; justify-content:space-between; align-items:baseline; padding:6px 0; border-bottom:1px solid #F8FAFC; font-size:13px; }
.row:last-child { border-bottom:none; }
.rl { color:#64748B; }
.rv { font-weight:600; }
.step { display:flex; gap:12px; padding:8px 0; border-bottom:1px solid #F8FAFC; font-size:13px; }
.step:last-child { border-bottom:none; }
.step-n { width:22px; height:22px; border-radius:50%; background:#0F172A; color:#fff; font-size:11px; font-weight:800; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:1px; }
.step-t { font-weight:700; margin-bottom:2px; font-size:13px; }
.step-s { font-size:12px; color:#64748B; }
.footer { text-align:center; font-size:11px; color:#94A3B8; padding-top:14px; border-top:1px solid #E2E8F0; margin-top:6px; }
@media print { body { background:#fff; } .page { padding:0; } .card { break-inside:avoid; } }
@media (max-width:560px) { .grid2,.grid3 { grid-template-columns:1fr; } }
`

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${p.codigo_axis} — Relatório AXIS IP</title>
<style>${css}</style>
</head>
<body>
<div class="page">

<!-- TOPO -->
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;padding-bottom:14px;border-bottom:2px solid #0F172A">
  <div>
    <div class="logo">A·<em>X</em>IS. <span style="font-size:11px;font-weight:400;color:#94A3B8">Inteligência em Leilões</span></div>
    <div style="font-size:12px;color:#64748B;margin-top:2px">Relatório de Análise de Imóvel</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:12px;font-weight:700;color:#0F172A;font-family:monospace">${p.codigo_axis}</div>
    <div style="font-size:11px;color:#94A3B8">${hoje.toLocaleDateString('pt-BR')} · ${hoje.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</div>
  </div>
</div>

<!-- NOME DO IMÓVEL -->
<div style="margin-bottom:18px">
  <div style="font-size:21px;font-weight:900;color:#0F172A;line-height:1.3;margin-bottom:8px">${p.titulo || p.codigo_axis}</div>
  <div>
    <span class="chip">📍 ${p.bairro}, ${p.cidade}</span>
    ${area > 0 ? `<span class="chip">📐 ${Math.round(area)} m²</span>` : ''}
    ${p.quartos ? `<span class="chip">🛏 ${p.quartos} quartos${p.suites ? ' · ' + p.suites + ' suíte' : ''}</span>` : ''}
    ${p.vagas ? `<span class="chip">🚗 ${p.vagas} vaga${p.vagas > 1 ? 's' : ''}</span>` : ''}
    ${p.condominio_mensal ? `<span class="chip">Cond. ${fmt(p.condominio_mensal)}/mês</span>` : ''}
    ${p.financiavel ? '<span class="chip tag-g">✓ Financiável</span>' : '<span class="chip tag-r">Somente à vista</span>'}
  </div>
</div>

<!-- ═══════════════════════════════════ -->
<!-- SEÇÃO 1: VEREDICTO                 -->
<!-- ═══════════════════════════════════ -->
<div class="card">
  <h2><span class="n">1</span> O que a análise recomenda?</h2>

  <div class="banner" style="background:${v.bg};border-color:${v.borda};color:${v.cor};margin-bottom:16px">
    <div class="banner-ico">${v.emoji}</div>
    <div style="flex:1">
      <div class="banner-t">${v.titulo}</div>
      <div class="banner-s">${p.justificativa || 'Veja os detalhes abaixo.'}</div>
      ${p.sintese_executiva ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(0,0,0,.08);font-size:13px;font-style:italic">"${p.sintese_executiva}"</div>` : ''}
    </div>
  </div>

  <!-- Score -->
  <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">
    <div style="text-align:center;flex-shrink:0">
      <div style="font-size:40px;font-weight:900;line-height:1;color:${scoreCor}">${scoreN}</div>
      <div style="font-size:10px;color:#94A3B8">/100 pontos</div>
    </div>
    <div style="flex:1">
      <div style="font-size:14px;font-weight:700;color:${scoreCor};margin-bottom:5px">${scoreTxt}</div>
      <div style="height:8px;background:#E2E8F0;border-radius:4px;overflow:hidden;margin-bottom:5px">
        <div style="width:${scoreN}%;height:100%;background:${scoreCor};border-radius:4px"></div>
      </div>
      <div style="font-size:11px;color:#94A3B8">Baseado em: localização · desconto · situação jurídica · ocupação · liquidez · mercado</div>
    </div>
    <div style="text-align:center;flex-shrink:0;background:#EFF6FF;border-radius:8px;padding:8px 12px">
      <div style="font-size:18px;font-weight:900;color:#1D4ED8">${p.confidence_score || '—'}%</div>
      <div style="font-size:10px;color:#64748B">confiança<br>da análise</div>
    </div>
  </div>

  <!-- Datas do leilão -->
  ${!eMercado && (d1 !== null || d2 !== null) ? `
  <div style="display:grid;grid-template-columns:${d1 !== null && d2 !== null ? '1fr 1fr' : '1fr'};gap:10px;margin-top:4px">
    ${d1 !== null && d1 >= 0 ? `
    <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:12px 14px">
      <div style="font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;margin-bottom:4px">1ª Data do Leilão</div>
      <div style="font-size:14px;font-weight:800;color:#0F172A">${fmtD(p.data_leilao)}</div>
      <div style="font-size:13px;color:#D97706;font-weight:700;margin-top:2px">${d1 === 0 ? 'HOJE!' : d1 === 1 ? 'AMANHÃ!' : 'em ' + d1 + ' dias'}</div>
      <div style="font-size:12px;color:#64748B;margin-top:4px">Mínimo: <strong>${fmt(p.valor_minimo)}</strong></div>
    </div>` : ''}
    ${d2 !== null && d2 >= 0 ? `
    <div style="background:${d2 <= 7 ? '#FEF2F2' : '#FFFBEB'};border:2px solid ${d2 <= 7 ? '#FCA5A5' : '#FDE68A'};border-radius:8px;padding:12px 14px">
      <div style="font-size:11px;font-weight:700;color:#92400E;text-transform:uppercase;margin-bottom:4px">⭐ 2ª Data — Melhor Oportunidade</div>
      <div style="font-size:14px;font-weight:800;color:#0F172A">${fmtD(p.data_leilao_2)}</div>
      <div style="font-size:13px;color:${d2 <= 7 ? '#DC2626' : '#D97706'};font-weight:700;margin-top:2px">${d2 === 0 ? 'HOJE!' : d2 === 1 ? 'AMANHÃ!' : 'em ' + d2 + ' dias'}</div>
      <div style="font-size:12px;color:#64748B;margin-top:4px">Mínimo: <strong>${fmt(p.valor_minimo_2)}</strong>${descPct !== null ? ` <span style="color:#059669;font-weight:700">(${descPct}% abaixo do mercado)</span>` : ''}</div>
    </div>` : ''}
  </div>` : ''}
</div>

<!-- ═══════════════════════════════════ -->
<!-- SEÇÃO 2: OS NÚMEROS                -->
<!-- ═══════════════════════════════════ -->
<div class="card">
  <h2><span class="n">2</span> O que os números dizem?</h2>

  <div class="explain">
    💡 <strong>Para entender:</strong> o "Valor de mercado" é quanto o imóvel vale hoje se fosse vendido normalmente. O "Lance máximo recomendado" é o teto que você não deve ultrapassar para garantir lucro. Se o seu lance ficar abaixo desse teto, você compra com margem de segurança.
  </div>

  <div class="grid2" style="margin-bottom:14px">
    <div class="kpi">
      <div class="kpi-l">Valor de mercado</div>
      <div class="kpi-v" style="color:#059669">${fmt(mk)}</div>
      <div class="kpi-s">O que vale hoje em venda normal · ${area > 0 && parseFloat(p.preco_m2_mercado||0) > 0 ? `R$ ${Math.round(parseFloat(p.preco_m2_mercado)).toLocaleString('pt-BR')}/m²` : ''}</div>
    </div>
    <div class="kpi">
      <div class="kpi-l">Avaliação do juiz</div>
      <div class="kpi-v">${fmt(p.valor_avaliacao)}</div>
      <div class="kpi-s">Base de cálculo do leilão${av > mk * 1.1 ? ' — <span style="color:#DC2626">acima do mercado real!</span>' : ''}</div>
    </div>
    <div class="kpi">
      <div class="kpi-l">Lance máx. para revender (ROI 20%)</div>
      <div class="kpi-v" style="color:#1D4ED8">${fmt(p.mao_flip)}</div>
      <div class="kpi-s">Não pague mais que isso se for revender</div>
    </div>
    <div class="kpi">
      <div class="kpi-l">Lance máx. para alugar (6% a.a.)</div>
      <div class="kpi-v" style="color:#7C3AED">${fmt(p.mao_locacao)}</div>
      <div class="kpi-s">Não pague mais que isso se for alugar</div>
    </div>
  </div>

  ${parseFloat(p.aluguel_mensal_estimado||0) > 0 ? `
  <div style="background:#F5F3FF;border-left:3px solid #7C3AED;border-radius:0 8px 8px 0;padding:10px 14px;font-size:13px;color:#4C1D95;margin-bottom:14px">
    🏠 <strong>Aluguel estimado: ${fmt(p.aluguel_mensal_estimado)}/mês</strong> (${fmtPct(p.yield_bruto_pct)} ao ano sobre o valor de mercado).
    <span style="color:#7C3AED">A Selic hoje rende 14,75% a.a. — compare esse retorno antes de decidir.</span>
  </div>` : ''}

  ${parseFloat(p.debitos_total_estimado||0) > 0 ? `
  <div style="background:#FEF2F2;border-left:3px solid #DC2626;border-radius:0 8px 8px 0;padding:10px 14px;font-size:13px;color:#991B1B;margin-bottom:14px">
    ⚠️ <strong>Atenção — dívidas que vêm com o imóvel: ${fmt(p.debitos_total_estimado)}</strong><br>
    Quem arrematar herda dívidas de condomínio e IPTU no valor acima. Esse custo já está incluído nos cálculos de lucro desta análise.
  </div>` : `
  <div style="background:#ECFDF5;border-left:3px solid #059669;border-radius:0 8px 8px 0;padding:10px 14px;font-size:13px;color:#065F46;margin-bottom:14px">
    ✅ <strong>Sem dívidas para o comprador</strong> — eventuais débitos de condomínio e IPTU ficam com o antigo dono.
  </div>`}
</div>

<!-- ═══════════════════════════════════ -->
<!-- SEÇÃO 3: CENÁRIOS DE LANCE         -->
<!-- ═══════════════════════════════════ -->
${cenarios.length > 0 ? `
<div class="card">
  <h2><span class="n">3</span> Quanto dar de lance e o que esperar?</h2>

  <div class="explain">
    💡 <strong>Investimento total</strong> = lance + impostos e taxas + reforma básica + dívidas herdadas + custos com advogado. <strong>Lucro na venda</strong> = o que sobra após vender pelo preço de mercado. <strong>Renda anual</strong> = retorno de aluguel sobre tudo investido.
  </div>

  <table>
    <thead><tr>
      <th>Cenário</th><th>Seu lance</th><th>Tudo investido</th><th>Lucro se vender</th><th>Renda/ano (aluguel)</th><th>Dentro do limite?</th>
    </tr></thead>
    <tbody>
    ${cenarios.map(c => {
      const r = c.r
      const maoOk = parseFloat(p.mao_flip||0) > 0 && c.lance <= parseFloat(p.mao_flip)
      const roiCls = !r ? '' : r.roiFlip >= 20 ? 'g' : r.roiFlip >= 8 ? 'm' : 'r'
      return `<tr style="${maoOk ? 'background:#F0FDF4' : ''}">
        <td><strong>${c.titulo}</strong><br><span style="font-size:11px;color:#94A3B8">${c.descricao} · ${c.pct}% da avaliação</span></td>
        <td><strong>${fmt(c.lance)}</strong></td>
        <td>${r ? fmt(r.invest) : '—'}<br><span style="font-size:10px;color:#94A3B8">${r ? `Lance+impostos+reforma+dív.` : ''}</span></td>
        <td class="${roiCls}">${r ? (r.lucroVenda >= 0 ? '+' : '') + fmt(r.lucroVenda) : '—'}<br><span style="font-size:11px">${r ? `(${r.roiFlip > 0 ? '+' : ''}${r.roiFlip}%)` : ''}</span></td>
        <td class="p">${r && r.yieldAnual > 0 ? r.yieldAnual + '% a.a.' : '—'}<br><span style="font-size:11px;color:#94A3B8">${r && r.aluguelMensal > 0 ? fmt(r.aluguelMensal) + '/mês' : ''}</span></td>
        <td class="${maoOk ? 'g' : 'r'}">${maoOk ? '✓ Sim' : '✗ Não'}<br><span style="font-size:11px">${maoOk ? 'Lucrativo' : 'Risco de prejuízo'}</span></td>
      </tr>`
    }).join('')}
    </tbody>
  </table>

  ${lanceDecisao > 0 && roiDecisao ? `
  <div style="margin-top:16px;background:#F0FDF4;border:2px solid #059669;border-radius:10px;padding:16px 18px">
    <div style="font-size:11px;font-weight:700;color:#065F46;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">🎯 Lance máximo definido</div>
    <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
      <div>
        <div style="font-size:28px;font-weight:900;color:#059669">${fmt(lanceDecisao)}</div>
        ${p.lance_maximo_estrategia ? `<div style="font-size:12px;color:#065F46">Estratégia: ${p.lance_maximo_estrategia === 'flip' ? '🔄 Revenda' : p.lance_maximo_estrategia === 'locacao' ? '🏠 Aluguel' : '⚡ Misto'}</div>` : ''}
      </div>
      <div class="grid3" style="flex:1;min-width:200px">
        <div style="background:#fff;border-radius:8px;padding:8px;text-align:center">
          <div style="font-size:17px;font-weight:900;color:${roiDecisao.roiFlip >= 15 ? '#059669' : '#D97706'}">${roiDecisao.roiFlip > 0 ? '+' : ''}${roiDecisao.roiFlip}%</div>
          <div style="font-size:10px;color:#64748B;text-transform:uppercase">Lucro na venda</div>
          <div style="font-size:8px;color:#94A3B8">líquido, c/ IR 15%</div>
        </div>
        <div style="background:#fff;border-radius:8px;padding:8px;text-align:center">
          <div style="font-size:17px;font-weight:900;color:#7C3AED">${roiDecisao.yieldAnual > 0 ? roiDecisao.yieldAnual + '%' : '—'}</div>
          <div style="font-size:10px;color:#64748B;text-transform:uppercase">Retorno/ano</div>
          <div style="font-size:8px;color:#94A3B8">bruto</div>
        </div>
        <div style="background:#fff;border-radius:8px;padding:8px;text-align:center">
          <div style="font-size:17px;font-weight:900;color:#0F172A">${fmt(roiDecisao.invest)}</div>
          <div style="font-size:10px;color:#64748B;text-transform:uppercase">Total investido</div>
        </div>
      </div>
    </div>
  </div>` : !lanceDecisao ? `
  <div style="margin-top:12px;background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:12px 14px;font-size:13px;color:#92400E">
    ⚠️ <strong>Lance não registrado ainda.</strong> Defina seu teto antes do leilão para não se empolgar na disputa e pagar mais do que deve.
  </div>` : ''}
</div>` : ''}

<!-- ═══════════════════════════════════ -->
<!-- SEÇÃO 4: RISCOS                    -->
<!-- ═══════════════════════════════════ -->
<div class="card">
  <h2><span class="n">${cenarios.length > 0 ? '4' : '3'}</span> Riscos e pontos de atenção</h2>

  ${positivos.length > 0 || negativos.length > 0 ? `
  <div class="grid2" style="margin-bottom:14px">
    ${positivos.length > 0 ? `
    <div>
      <div style="font-size:12px;font-weight:700;color:#059669;text-transform:uppercase;margin-bottom:8px">✅ Pontos positivos</div>
      ${positivos.slice(0,5).map(t => `<div style="display:flex;gap:8px;padding:5px 0;border-bottom:1px solid #F8FAFC;font-size:13px"><span style="color:#059669;flex-shrink:0">+</span>${t}</div>`).join('')}
    </div>` : '<div></div>'}
    ${negativos.length > 0 ? `
    <div>
      <div style="font-size:12px;font-weight:700;color:#DC2626;text-transform:uppercase;margin-bottom:8px">⚠️ Pontos de atenção</div>
      ${negativos.slice(0,5).map(t => `<div style="display:flex;gap:8px;padding:5px 0;border-bottom:1px solid #F8FAFC;font-size:13px"><span style="color:#DC2626;flex-shrink:0">−</span>${t}</div>`).join('')}
    </div>` : '<div></div>'}
  </div>` : ''}

  <!-- Ocupação -->
  ${p.ocupacao ? `
  <div style="background:${p.ocupacao==='Desocupado'?'#ECFDF5':'#FFFBEB'};border-left:3px solid ${p.ocupacao==='Desocupado'?'#059669':'#D97706'};border-radius:0 8px 8px 0;padding:10px 14px;font-size:13px;color:${p.ocupacao==='Desocupado'?'#065F46':'#92400E'};margin-bottom:10px">
    ${p.ocupacao==='Desocupado'
      ? '🏠 <strong>Imóvel desocupado</strong> — você pode entrar logo após arrematar.'
      : `👤 <strong>Ocupação: ${p.ocupacao}</strong> — pode ser necessário processo judicial para tomar posse. Prazo estimado: <strong>${p.prazo_liberacao_estimado_meses || '6–18'} meses</strong>. Considere esse tempo sem renda no seu planejamento.`}
  </div>` : ''}

  <!-- Custo jurídico -->
  ${parseFloat(p.custo_juridico_estimado||0) > 0 ? `
  <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:10px">
    ⚖️ <strong>Custos com advogado estimados: ${fmt(p.custo_juridico_estimado)}</strong> — para acompanhar o processo de imissão na posse e regularização. Já incluído nos cálculos acima.
  </div>` : ''}

  <!-- Alertas -->
  ${alertas.length > 0 ? `
  <div style="margin-bottom:10px">
    ${alertas.slice(0,4).map(a => `
    <div style="display:flex;gap:8px;padding:7px 10px;margin-bottom:4px;background:#FFFBEB;border-radius:6px;font-size:13px;color:#92400E">
      <span style="flex-shrink:0">⚠</span>${a}
    </div>`).join('')}
  </div>` : ''}

  <!-- Dados jurídicos -->
  <div style="background:#F8FAFC;border-radius:8px;padding:12px 14px">
    <div style="font-size:12px;font-weight:700;color:#64748B;text-transform:uppercase;margin-bottom:8px">Dados do processo judicial</div>
    ${[
      ['Número do processo', p.processo_numero],
      ['Vara judicial',      p.vara_judicial],
      ['Score jurídico',     p.score_juridico ? p.score_juridico + '/10 — ' + (parseFloat(p.score_juridico) >= 7 ? 'Situação favorável' : parseFloat(p.score_juridico) >= 5 ? 'Atenção necessária' : 'Risco alto') : null],
      ['Financiamento',      p.financiavel ? 'Pode usar financiamento bancário' : 'Pagamento 100% à vista'],
      ['Reforma básica',     parseFloat(p.custo_reforma_basica||0) > 0 ? fmt(p.custo_reforma_basica) + ' (pintura, limpeza, pequenos reparos)' : null],
    ].filter(([,v]) => v).map(([l,v]) => `
    <div class="row"><span class="rl">${l}</span><span class="rv" style="text-align:right;max-width:55%">${v}</span></div>`).join('')}
  </div>
</div>

<!-- ═══════════════════════════════════ -->
<!-- SEÇÃO 5: PRÓXIMOS PASSOS           -->
<!-- ═══════════════════════════════════ -->
<div class="card">
  <h2><span class="n">${cenarios.length > 0 ? '5' : '4'}</span> O que fazer antes de participar</h2>

  ${[
    { t:'Leia o edital completo', s:'Disponível no site do leiloeiro — contém regras, prazo de pagamento e condições específicas do leilão.' },
    { t:'Consulte um advogado especialista em leilões', s:'Peça análise do processo ' + (p.processo_numero || '') + ' — verifique se há recursos pendentes que possam anular o leilão.' },
    p.ocupacao !== 'Desocupado' && p.ocupacao ? { t:'Investigue a ocupação', s:'Tente uma vistoria externa do imóvel. Entender a situação do ocupante reduz riscos de surpresas após arrematar.' } : null,
    { t:'Reserve o valor completo', s:`Lance + impostos (~${Math.round((5+3+5+2.5))}%) + ${parseFloat(p.debitos_total_estimado||0)>0 ? 'dívidas '+fmt(p.debitos_total_estimado)+' + ' : ''}reforma${parseFloat(p.custo_juridico_estimado||0)>0 ? ' + advogado '+fmt(p.custo_juridico_estimado) : ''}. Não entre no leilão sem ter o total em conta.` },
    { t:'Defina seu lance máximo agora', s:`Não ultrapasse ${fmt(p.mao_flip)} (para revender) nem ${fmt(p.mao_locacao)} (para alugar). Na hora do leilão a emoção prega peças — tenha o número escrito.` },
    !eMercado && d2 !== null && d2 >= 0 ? { t:`Participe na 2ª data: ${fmtD(p.data_leilao_2)}`, s:`A 2ª praça tem valor mínimo menor (${fmt(p.valor_minimo_2)}). É a melhor oportunidade para arrematar com desconto.` } : null,
  ].filter(Boolean).map((s, i) => `
  <div class="step">
    <div class="step-n">${i + 1}</div>
    <div>
      <div class="step-t">${s.t}</div>
      <div class="step-s">${s.s}</div>
    </div>
  </div>`).join('')}
</div>

<!-- FOOTER -->
<div class="footer">
  <div>Relatório gerado por <strong>AXIS IP</strong> · axisip.vercel.app · ${hoje.toLocaleDateString('pt-BR')}</div>
  <div style="margin-top:3px;font-size:10px">Análise orientativa. Consulte sempre um advogado antes de participar de leilões judiciais. Valores estimados — sujeitos a variação.</div>
</div>

</div>
</body>
</html>`
}

export function abrirResumoSimples(imovel) {
  abrirHtmlNovaTela(gerarHTML(imovel), `relatorio-${imovel.codigo_axis || imovel.id}`, true)
}

export default function BotaoResumoSimples({ imovel, style }) {
  return (
    <button onClick={() => abrirResumoSimples(imovel)}
      style={{ display:'flex', alignItems:'center', gap:5, padding:'8px 14px',
        borderRadius:6, cursor:'pointer', background:'#EFF6FF',
        border:'1px solid #BFDBFE', color:'#1D4ED8', fontSize:12, fontWeight:700, ...style }}>
      📋 Relatório Simplificado
    </button>
  )
}
