/**
 * AXIS — Relatório Interativo do Imóvel
 * Gera HTML autônomo com abas, seções expansíveis, e compartilhamento nativo.
 */
import { C } from '../appConstants.js'
import { isMercadoDireto } from '../lib/detectarFonte.js'
import { CUSTO_M2_SINAPI, FATOR_VALORIZACAO, detectarClasse, avaliarViabilidadeReforma } from '../lib/reformaUnificada.js'
import { calcularBreakdownFinanceiro, HOLDING_MESES_PADRAO, IPTU_SOBRE_CONDO_RATIO, calcularFatorHomogeneizacao } from '../lib/constants.js'

const fmt = v => v ? `R$ ${Math.round(v).toLocaleString('pt-BR')}` : '—'
const pct = v => v != null ? `${Number(v).toFixed(1)}%` : '—'

function recBadge(rec) {
  if (rec === 'COMPRAR') return { bg: '#ECFDF5', color: '#065F46', text: '✅ COMPRAR' }
  if (rec === 'EVITAR')  return { bg: '#FEF2F2', color: '#991B1B', text: '❌ EVITAR' }
  return { bg: '#FEF9C3', color: '#92400E', text: '⏳ AGUARDAR' }
}

function gerarHTML(p) {
  const eMercado = isMercadoDireto(p.fonte_url, p.tipo_transacao)
  const rec = recBadge(p.recomendacao)
  const score = (p.score_total || 0).toFixed(1)
  const area = parseFloat(p.area_privativa_m2 || p.area_m2) || 0
  const classe = detectarClasse(parseFloat(p.preco_m2_mercado) || 7000)

  // Calcular reformas com viabilidade
  const precoCompra = parseFloat(p.preco_pedido || p.valor_minimo) || 0
  const valorMercado = parseFloat(p.valor_mercado_estimado) || (area * (parseFloat(p.preco_m2_mercado) || 7000))
  const viab = avaliarViabilidadeReforma(valorMercado, precoCompra, area, parseFloat(p.preco_m2_mercado) || 7000)
  const reformas = ['refresh_giro', 'leve_reforcada_1_molhado', 'pesada'].map((esc, i) => {
    const custoM2 = CUSTO_M2_SINAPI[esc]?.[classe] || 0
    const chaveBanco = ['custo_reforma_basica', 'custo_reforma_media', 'custo_reforma_completa'][i]
    const custo = parseFloat(p[chaveBanco]) || Math.round(area * custoM2)
    const fv = FATOR_VALORIZACAO[esc] || 1
    const cenario = ['basica', 'media', 'completa'][i]
    const label = esc === 'refresh_giro' ? 'Básica' : esc === 'leve_reforcada_1_molhado' ? 'Média' : 'Completa'
    const v = viab?.[cenario]
    return { label, custo, custoM2, valorizacao: Math.round((fv - 1) * 100),
      recomendacao: v?.recomendacao || '', roiFlip: v?.roiFlip || 0, eficiencia: v?.eficiencia || 0 }
  })

  // Breakdown financeiro + Holding cost
  const bd = calcularBreakdownFinanceiro(precoCompra, p, eMercado)
  const condoMensal = parseFloat(p.condominio_mensal || 0)
  const iptuMensal = parseFloat(p.iptu_mensal || 0) || (condoMensal > 0 ? Math.round(condoMensal * IPTU_SOBRE_CONDO_RATIO) : 0)
  const holdingMeses = HOLDING_MESES_PADRAO
  const holdingMensal = condoMensal + iptuMensal
  const holdingTotal = holdingMeses * holdingMensal

  // Scores
  const scores = [
    { l: 'Localização', v: p.score_localizacao, w: 20 },
    { l: 'Desconto', v: p.score_desconto, w: 18 },
    { l: 'Jurídico', v: p.score_juridico, w: 18 },
    { l: 'Ocupação', v: p.score_ocupacao, w: 15 },
    { l: 'Liquidez', v: p.score_liquidez, w: 15 },
    { l: 'Mercado', v: p.score_mercado, w: 14 },
  ]

  // Atributos com homogeneização real (Sprint 17)
  const homo = calcularFatorHomogeneizacao(p, valorMercado)
  const attrs = homo.ajustes.length > 0
    ? homo.ajustes.map(a => [a.label, a.fator >= 1, `${a.impactoPct > 0 ? '+' : ''}${a.impactoPct}%`])
    : [
      p.elevador != null && ['Elevador', p.elevador, p.elevador ? '+8%' : '-13%'],
      p.piscina != null && ['Piscina', p.piscina, p.piscina ? '+5%' : ''],
      p.area_lazer != null && ['Área lazer', p.area_lazer, p.area_lazer ? '+3%' : ''],
      p.portaria_24h && ['Portaria 24h', true, '+4%'],
      p.condominio_mensal && ['Condomínio', true, `R$ ${Number(p.condominio_mensal).toLocaleString('pt-BR')}/mês`],
    ].filter(Boolean)

  // Título padronizado
  const tituloCurto = (() => {
    const t = p.titulo || 'Imóvel'
    if (t.length <= 50) return t
    const tipo = (p.tipo||'').toLowerCase().includes('casa') ? 'Casa' : (p.tipo||'').toLowerCase().includes('cobertura') ? 'Cobertura' : (p.tipo||'').toLowerCase().includes('sala') ? 'Sala Comercial' : 'Apartamento'
    const parts = [tipo]
    if (p.quartos) parts.push(`${p.quartos} quartos`)
    if (area) parts.push(`${area}m²`)
    const local = [p.bairro, p.cidade].filter(Boolean).join(', ')
    return local ? `${parts.join(' · ')} — ${local}` : parts.join(' · ')
  })()

  let _hostname = ''
  try { if (p.fonte_url) _hostname = new URL(p.fonte_url).hostname } catch {}

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AXIS · ${p.codigo_axis || ''} · ${tituloCurto}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI','Inter',system-ui,sans-serif;font-size:13px;color:#1a1a2e;background:#f8f7f4;line-height:1.5}
.wrap{max-width:640px;margin:0 auto;padding:16px;background:#fff;min-height:100vh}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #002B80;padding-bottom:12px;margin-bottom:16px}
.hdr h1{font-size:17px;color:#002B80;margin-bottom:3px}
.hdr .sub{font-size:10px;color:#666}
.score-big{font-size:36px;font-weight:900;line-height:1}
.score-big.green{color:#065F46} .score-big.amber{color:#92400E} .score-big.red{color:#991B1B}
.badge{display:inline-block;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700;margin:3px 4px 3px 0}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}
.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px}
.card{border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px}
.card-t{font-size:11px;font-weight:700;color:#002B80;margin-bottom:6px}
.row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f5f5f5;font-size:12px}
.row:last-child{border-bottom:none}
.row-l{color:#666} .row-v{font-weight:600}
.green{color:#065F46} .red{color:#991B1B} .amber{color:#92400E} .blue{color:#1D4ED8} .purple{color:#7C3AED}

/* Tabs — visible only with JS, otherwise all content shows */
.tabs{display:flex;gap:0;border-bottom:2px solid #e5e7eb;margin-bottom:14px;overflow-x:auto}
.tab{padding:8px 14px;font-size:12px;font-weight:600;cursor:pointer;border:none;background:none;color:#666;border-bottom:2px solid transparent;white-space:nowrap}
.tab.active{color:#002B80;border-bottom-color:#002B80}
.tab-content{display:block} /* Show ALL by default (no JS = WhatsApp) */
.js-enabled .tab-content{display:none} .js-enabled .tab-content.active{display:block}

/* Section dividers for flat mode */
.section-divider{margin:20px 0 14px;padding:8px 12px;background:#F0F4FF;border-radius:8px;font-size:13px;font-weight:700;color:#002B80;border-left:4px solid #002B80}
/* Without JS: hide tab bar, show dividers */
.tabs{display:none}
/* With JS: show tab bar, hide dividers */
.js-enabled .tabs{display:flex}
.js-enabled .section-divider{display:none}

/* Toggle sections */
.toggle{cursor:pointer;display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#f8f7f4;border-radius:8px;margin-bottom:6px;font-weight:600;font-size:12px;color:#002B80}
.toggle-body{display:none;padding:10px 12px;margin-bottom:10px}
.toggle-body.open{display:block}

/* Reforma selector */
.ref-opt{padding:10px;border-radius:8px;border:2px solid #e5e7eb;cursor:pointer;text-align:center;transition:all .2s}
.ref-opt.sel{border-color:#002B80;background:#F0F4FF}
.ref-opt .price{font-size:18px;font-weight:800;color:#002B80}
.ref-opt .label{font-size:11px;color:#666}

/* Score bar */
.sbar{height:6px;border-radius:3px;background:#e5e7eb;overflow:hidden;flex:1;margin:0 8px;max-width:120px}
.sfill{height:100%;border-radius:3px}

/* Comparavel */
.comp{border:1px solid #e5e7eb;border-radius:6px;padding:8px 10px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center}
.comp-t{font-weight:600;font-size:11px;color:#002B80}
.comp-v{font-weight:700;font-size:13px;color:#05A86D}

/* Print */
@media print{
  body{background:#fff;font-size:11px}
  .wrap{padding:8px;max-width:none}
  .tabs,.tab,.no-print{display:none!important}
  .tab-content{display:block!important}
  .toggle-body{display:block!important}
}
.ft{border-top:1px solid #e5e7eb;padding-top:8px;margin-top:16px;font-size:9px;color:#999;display:flex;justify-content:space-between}
</style>
</head>
<body>
<div class="wrap">

<!-- Header -->
${p.foto_principal ? `<div style="margin-bottom:12px;border-radius:10px;overflow:hidden;max-height:220px;background:#f3f4f6">
  <img src="${p.foto_principal}" style="width:100%;max-height:220px;object-fit:cover;display:block" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='https://wsrv.nl/?url='+encodeURIComponent('${p.foto_principal}')+'&w=600&q=75&output=jpg';this.parentElement.style.display=this.naturalWidth<10?'none':'block'" />
</div>` : ''}
${(p.fotos?.length > 1) ? `<div style="display:flex;gap:6px;overflow-x:auto;margin-bottom:12px;padding-bottom:4px">
  ${p.fotos.slice(1, 5).filter(f => f && !f.includes('{action}')).map(f =>
    `<img src="${f}" style="height:90px;width:120px;border-radius:6px;flex-shrink:0;object-fit:cover" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='https://wsrv.nl/?url='+encodeURIComponent('${f}')+'&w=300&q=70&output=jpg'" />`
  ).join('')}
</div>` : ''}
<div class="hdr">
  <div>
    <h1>${tituloCurto}</h1>
    <div class="sub">
      ${p.codigo_axis ? `<strong>${p.codigo_axis}</strong> · ` : ''}📍 ${p.endereco ? p.endereco + ' — ' : ''}${[p.bairro, p.cidade].filter(Boolean).join(', ')}/${p.estado || 'MG'}
      · ${area ? area + 'm²' : ''}${p.quartos ? ' · ' + p.quartos + 'q' : ''}${p.suites ? ' · ' + p.suites + 's' : ''}${p.vagas ? ' · ' + p.vagas + 'v' : ''}${p.condominio_mensal ? ' · Cond. R$ ' + Number(p.condominio_mensal).toLocaleString('pt-BR') : ''}
    </div>
    <div style="margin-top:6px">
      <span class="badge" style="background:${rec.bg};color:${rec.color}">${rec.text}</span>
      <span class="badge" style="background:${eMercado ? '#EFF6FF' : '#ECFDF5'};color:${eMercado ? '#1D4ED8' : '#065F46'}">
        ${eMercado ? '🏠 MERCADO' : `🔨 ${p.num_leilao || 1}º LEILÃO`}
      </span>
      ${p.ocupacao ? `<span class="badge" style="background:${p.ocupacao === 'Desocupado' || p.ocupacao === 'desocupado' ? '#ECFDF5' : '#FEF2F2'};color:${p.ocupacao === 'Desocupado' || p.ocupacao === 'desocupado' ? '#065F46' : '#991B1B'}">${p.ocupacao}</span>` : ''}
    </div>
  </div>
  <div style="text-align:right">
    <div class="score-big ${parseFloat(score) >= 7.5 ? 'green' : parseFloat(score) >= 5.5 ? 'amber' : 'red'}">${score}</div>
    <div style="font-size:9px;color:#666;text-transform:uppercase;letter-spacing:1px">Score AXIS</div>
  </div>
</div>

<!-- Tabs -->
<div class="tabs no-print">
  <button class="tab active" onclick="showTab('resumo')">📊 Resumo</button>
  <button class="tab" onclick="showTab('reforma')">🔧 Reforma</button>
  <button class="tab" onclick="showTab('detalhe')">📋 Detalhe</button>
  ${p.comparaveis?.length ? '<button class="tab" onclick="showTab(\'refs\')">🏘️ Refs</button>' : ''}
</div>

<!-- TAB: Resumo -->
<div class="tab-content active" id="tab-resumo">
  <div class="section-divider">📊 Resumo</div>
  <!-- Valores -->
  <div class="grid3">
    <div class="card" style="text-align:center">
      <div style="font-size:9px;color:#666;text-transform:uppercase">${eMercado ? 'Preço Pedido' : 'Lance Mínimo'}</div>
      <div style="font-size:18px;font-weight:800;color:#C2410C">${fmt(eMercado ? (p.preco_pedido || p.valor_minimo) : p.valor_minimo)}</div>
    </div>
    <div class="card" style="text-align:center">
      <div style="font-size:9px;color:#666;text-transform:uppercase">Mercado est.</div>
      <div style="font-size:18px;font-weight:800;color:#002B80">${fmt(p.valor_mercado_estimado)}</div>
    </div>
    <div class="card" style="text-align:center">
      <div style="font-size:9px;color:#666;text-transform:uppercase">Aluguel est.</div>
      <div style="font-size:18px;font-weight:800;color:#7C3AED">${p.aluguel_mensal_estimado ? fmt(p.aluguel_mensal_estimado) + '/mês' : '—'}</div>
    </div>
  </div>

  <!-- Scores -->
  <div class="card" style="margin-bottom:14px">
    <div class="card-t">📊 Score por Dimensão</div>
    ${scores.map(s => {
      const v = s.v || 0
      const c = v >= 7 ? '#065F46' : v >= 5 ? '#D97706' : '#991B1B'
      return `<div style="display:flex;align-items:center;padding:4px 0;border-bottom:1px solid #f5f5f5">
        <span style="min-width:85px;font-size:11px;color:#666">${s.l} (${s.w}%)</span>
        <div class="sbar"><div class="sfill" style="width:${v*10}%;background:${c}"></div></div>
        <span style="font-weight:700;color:${c};min-width:35px;text-align:right;font-size:12px">${v.toFixed ? v.toFixed(1) : v}</span>
      </div>`
    }).join('')}
  </div>

  <!-- Resumo financeiro -->
  <div class="grid" style="margin-bottom:14px">
    <div class="card">
      <div class="card-t">💰 Custos de Aquisição</div>
      ${[
        [eMercado ? 'Preço pedido' : 'Lance mínimo', fmt(precoCompra)],
        ['Avaliação', fmt(p.valor_avaliacao)],
        ['Desconto s/ mercado', p.desconto_sobre_mercado_pct_calculado ? p.desconto_sobre_mercado_pct_calculado + '%' : (p.desconto_percentual ? p.desconto_percentual + '%' : null)],
        [!eMercado ? 'Comissão leiloeiro' : null, bd.comissao.valor > 0 ? fmt(bd.comissao.valor) + ' (' + (bd.comissao.pct*100).toFixed(0) + '%)' : null],
        ['ITBI', bd.itbi.valor > 0 ? fmt(bd.itbi.valor) + ' (' + (bd.itbi.pct*100).toFixed(0) + '%)' : null],
        ['Doc + Registro', fmt(bd.documentacao.valor)],
        [!eMercado && bd.advogado.valor > 0 ? 'Advogado' : null, bd.advogado.valor > 0 ? fmt(bd.advogado.valor) : null],
        [holdingTotal > 0 ? 'Holding (' + holdingMeses + 'm)' : null, holdingTotal > 0 ? fmt(holdingTotal) + ' (' + fmt(holdingMensal) + '/mês)' : null],
        ['Condomínio', condoMensal > 0 ? fmt(condoMensal) + '/mês' : null],
        ['IPTU est.', iptuMensal > 0 ? fmt(iptuMensal) + '/mês' : null],
        ['Preço/m² imóvel', p.preco_m2_imovel ? 'R$ ' + Math.round(p.preco_m2_imovel).toLocaleString('pt-BR') + '/m²' : null],
        ['Preço/m² mercado', p.preco_m2_mercado ? 'R$ ' + Math.round(p.preco_m2_mercado).toLocaleString('pt-BR') + '/m²' : null],
      ].filter(([l,v]) => l && v && v !== '—').map(([l,v]) =>
        '<div class="row"><span class="row-l">' + l + '</span><span class="row-v">' + v + '</span></div>'
      ).join('')}
      <div class="row" style="border-top:2px solid #002B80;margin-top:4px;padding-top:6px">
        <span class="row-l" style="font-weight:700;color:#002B80">Investimento total</span>
        <span class="row-v" style="font-weight:800;color:#002B80">${fmt(bd.investimentoTotal + holdingTotal)}</span>
      </div>
    </div>
    <div class="card">
      <div class="card-t">📈 Retorno</div>
      ${[
        ['Yield bruto', p.yield_bruto_pct ? p.yield_bruto_pct + '% a.a.' : null],
        ['MAO Flip', fmt(p.mao_flip)],
        ['MAO Locação', fmt(p.mao_locacao)],
        ['Retorno revenda', p.retorno_venda_pct ? '+' + p.retorno_venda_pct + '%' : null],
        ['Estrutura', p.estrutura_recomendada],
        ['Estratégia', p.estrategia_recomendada === 'aguardar_2a_praca' ? '⏳ Aguardar 2ª praça' : p.estrategia_recomendada],
      ].filter(([,v]) => v && v !== '—').map(([l,v]) =>
        '<div class="row"><span class="row-l">' + l + '</span><span class="row-v">' + v + '</span></div>'
      ).join('')}
    </div>
  </div>

  <!-- Holding cost -->
  ${holdingTotal > 0 ? `
  <div class="card" style="margin-bottom:14px;background:#FFFBEB;border-color:#FDE68A">
    <div class="card-t" style="color:#92400E">🏗️ Custo de Holding (${holdingMeses} meses)</div>
    <div class="row">
      <span class="row-l">Condomínio mensal</span>
      <span class="row-v">${fmt(condoMensal)}/mês</span>
    </div>
    <div class="row">
      <span class="row-l">IPTU estimado</span>
      <span class="row-v">${fmt(iptuMensal)}/mês</span>
    </div>
    <div class="row">
      <span class="row-l">Custo mensal total</span>
      <span class="row-v">${fmt(holdingMensal)}/mês</span>
    </div>
    <div class="row" style="font-weight:700">
      <span class="row-l">Holding ${holdingMeses} meses</span>
      <span class="row-v amber">${fmt(holdingTotal)}</span>
    </div>
  </div>` : ''}

  <!-- Síntese -->
  ${p.sintese_executiva ? `
  <div class="card" style="margin-bottom:14px;background:#F0F4FF;border-color:#C7D4F8">
    <div class="card-t" style="color:#1D4ED8">📋 Síntese</div>
    <div style="font-size:12px;line-height:1.6;color:#333">${p.sintese_executiva}</div>
  </div>` : ''}

  <!-- Alertas -->
  ${p.alertas?.length ? `
  <div class="card" style="margin-bottom:14px;background:#FEF2F2;border-color:#FECACA">
    <div class="card-t" style="color:#991B1B">🚨 Alertas</div>
    ${p.alertas.slice(0, 5).map(a => `<div style="font-size:11px;padding:3px 0;color:#333">• ${typeof a === 'string' ? a : a.texto || ''}</div>`).join('')}
  </div>` : ''}

  <!-- Atributos do prédio -->
  ${attrs.length ? `
  <div class="card" style="margin-bottom:14px">
    <div class="card-t">🏗️ Atributos</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px">
      ${attrs.map(([nome, val, impacto]) => `
        <span style="padding:3px 8px;border-radius:5px;font-size:10px;font-weight:600;
          background:${val === true ? '#ECFDF5' : val === false ? '#FEF9C3' : '#F0F4FF'};
          color:${val === true ? '#065F46' : val === false ? '#92400E' : '#1D4ED8'}">
          ${val === true ? '✓' : val === false ? '✗' : ''} ${nome} ${typeof impacto === 'string' && impacto.startsWith('-') ? `(${impacto})` : impacto && impacto !== '+' ? impacto : ''}
        </span>
      `).join('')}
    </div>
    ${p.fator_homogenizacao && p.fator_homogenizacao < 1 ? `
    <div style="margin-top:8px;font-size:10px;color:#92400E">📐 Fator homogeneização: <strong>${(p.fator_homogenizacao * 100).toFixed(0)}%</strong> (NBR 14653)</div>` : ''}
    ${homo.ajustes.length > 0 ? `
    <div style="margin-top:8px;font-size:10px;color:${homo.fator >= 1 ? '#065F46' : '#991B1B'}">📐 Fator composto: <strong>${(homo.fator * 100).toFixed(1)}%</strong> (${homo.impactoTotal > 0 ? '+' : ''}${fmt(homo.impactoTotal)}) — NBR 14653</div>` : ''}
  </div>` : ''}
</div>

<!-- TAB: Reforma -->
<div class="tab-content" id="tab-reforma">
  <div class="section-divider">🔧 Cenários de Reforma</div>
  <div class="card-t" style="margin-bottom:10px">🔧 Cenários de Reforma — Clique para comparar</div>
  <div class="grid3" style="margin-bottom:14px">
    ${reformas.map((r, i) => `
    <div class="ref-opt ${i === 0 ? 'sel' : ''}" onclick="selReforma(${i})">
      <div class="label">${r.label}</div>
      <div class="price">${fmt(r.custo)}</div>
      <div style="font-size:9px;color:#666">R$ ${r.custoM2}/m² · +${r.valorizacao}%</div>
      <div style="margin-top:4px;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:700;background:${r.roiFlip > 10 ? '#ECFDF5' : r.roiFlip > 0 ? '#FEF9C3' : '#FEF2F2'};color:${r.roiFlip > 10 ? '#065F46' : r.roiFlip > 0 ? '#92400E' : '#991B1B'}">${r.recomendacao || (r.roiFlip > 0 ? 'Vale' : 'Não compensa')}</div>
      <div style="font-size:8px;color:#666;margin-top:2px">ROI: ${r.roiFlip > 0 ? '+' : ''}${r.roiFlip}%</div>
    </div>`).join('')}
  </div>
  <div id="ref-detail" class="card" style="margin-bottom:14px">
    <div class="card-t">Detalhamento — ${reformas[0].label}</div>
    <div class="row"><span class="row-l">Custo reforma</span><span class="row-v" id="ref-custo">${fmt(reformas[0].custo)}</span></div>
    <div class="row"><span class="row-l">Custo/m²</span><span class="row-v" id="ref-m2">R$ ${reformas[0].custoM2}/m²</span></div>
    <div class="row"><span class="row-l">Valorização</span><span class="row-v green" id="ref-val">+${reformas[0].valorizacao}%</span></div>
    <div class="row"><span class="row-l">Valor pós-reforma</span><span class="row-v" id="ref-pos">${fmt(Math.round((p.valor_mercado_estimado || 0) * (1 + reformas[0].valorizacao / 100)))}</span></div>
    ${holdingTotal > 0 ? `<div class="row"><span class="row-l">Holding (${holdingMeses}m × ${fmt(holdingMensal)}/mês)</span><span class="row-v" style="color:#EA580C">${fmt(holdingTotal)}</span></div>` : ''}
    <div class="row"><span class="row-l">Custo total (compra+reforma+taxas+holding)</span><span class="row-v" id="ref-total">${fmt(precoCompra + reformas[0].custo + bd.totalCustos + holdingTotal)}</span></div>
    <div class="row"><span class="row-l">ROI estimado (flip)</span><span class="row-v" style="color:${reformas[0].roiFlip > 0 ? '#065F46' : '#991B1B'}" id="ref-roi">${reformas[0].roiFlip > 0 ? '+' : ''}${reformas[0].roiFlip}%</span></div>
    <div class="row"><span class="row-l">Eficiência (R$1 gera)</span><span class="row-v" id="ref-ef">R$ ${reformas[0].eficiencia}</span></div>
  </div>

  <!-- Aluguel estimado por cenário -->
  <div class="card" style="margin-bottom:14px">
    <div class="card-t">🏠 Aluguel Estimado por Cenário de Reforma</div>
    ${(()=>{
      const alugBase = parseFloat(p.aluguel_mensal_estimado) || Math.round(valorMercado * 0.005)
      const cenarios = [
        { label: 'Sem reforma', fator: 0.90, cor: '#8E8EA0' },
        { label: 'Básica (Refresh)', fator: 1.00, cor: '#3B8BD4' },
        { label: 'Média', fator: 1.08, cor: '#059669' },
        { label: 'Completa', fator: 1.20, cor: '#7C3AED' },
      ]
      return cenarios.map(c => {
        const alug = Math.round(alugBase * c.fator)
        const yieldB = precoCompra > 0 ? ((alug * 12) / precoCompra * 100).toFixed(1) : '—'
        return `<div class="row">
          <span class="row-l"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c.cor};margin-right:5px"></span>${c.label}</span>
          <span class="row-v">${fmt(alug)}/mês · <span style="color:${parseFloat(yieldB)>=6?'#065F46':'#92400E'}">${yieldB}% yield</span></span>
        </div>`
      }).join('')
    })()}
  </div>

  <div style="font-size:9px;color:#999">SINAPI-MG 2026 · Classe ${classe.replace(/_/g, ' ')}</div>
</div>

<!-- TAB: Detalhe -->
<div class="tab-content" id="tab-detalhe">
  <div class="section-divider">📋 Detalhamento</div>
  <div class="grid">
    <!-- Ficha técnica -->
    <div class="card">
      <div class="card-t">🏠 Ficha Técnica</div>
      ${[
        ['Tipo', p.tipologia || p.tipo],
        ['Área', area ? `${area}m²` : null],
        ['Quartos', p.quartos], ['Suítes', p.suites], ['Vagas', p.vagas],
        ['Andar', p.andar], ['Padrão', p.padrao_acabamento],
        ['Condomínio', p.condominio_mensal ? `R$ ${Number(p.condominio_mensal).toLocaleString('pt-BR')}/mês` : null],
        ...(!eMercado ? [['Leiloeiro', p.leiloeiro], ['Data leilão', p.data_leilao], ['Nº leilão', p.num_leilao ? `${p.num_leilao}º` : null]] : []),
      ].filter(([,v]) => v != null && v !== 0).map(([l,v]) =>
        `<div class="row"><span class="row-l">${l}</span><span class="row-v">${v}</span></div>`
      ).join('')}
    </div>

    <!-- Jurídico -->
    <div class="card">
      <div class="card-t">⚖️ Jurídico</div>
      ${[
        ['Processos', p.processos_ativos],
        ['Matrícula', p.matricula_status],
        ['Déb. cond.', p.debitos_condominio],
        ['Déb. IPTU', p.debitos_iptu],
        ['Responsab.', p.responsabilidade_debitos === 'sub_rogado' ? '✅ Sub-rogados no preço' : p.responsabilidade_debitos === 'exonerado' ? '✅ Arrematante exonerado' : p.responsabilidade_debitos === 'arrematante' ? '⚠️ Arrematante arca' : p.responsabilidade_debitos],
        ['Ocupação', p.ocupacao],
      ].filter(([,v]) => v).map(([l,v]) =>
        `<div class="row"><span class="row-l">${l}</span><span class="row-v">${v}</span></div>`
      ).join('')}
      ${p.obs_juridicas ? `<div style="margin-top:8px;padding:8px 10px;background:#FEF9C3;border-radius:6px;font-size:10px;line-height:1.5;color:#92400E">${p.obs_juridicas}</div>` : ''}
    </div>
  </div>

  <!-- Mercado AXIS -->
  ${p._dados_bairro_axis ? `
  <div class="card" style="margin-bottom:14px;background:#F0F9FF;border-color:#BAE6FD">
    <div class="card-t" style="color:#0369A1">📊 Dados AXIS — ${p._dados_bairro_axis.label || p.bairro}</div>
    ${[
      ['Classe IPEAD', p._dados_bairro_axis.classeIpeadLabel],
      ['Preço contrato QA', p._dados_bairro_axis.precoContratoM2 ? `R$ ${p._dados_bairro_axis.precoContratoM2.toLocaleString('pt-BR')}/m²` : null],
      ['Yield bruto', p._dados_bairro_axis.yieldBruto ? `${p._dados_bairro_axis.yieldBruto}% a.a.` : null],
      ['Tendência 12m', p._dados_bairro_axis.tendencia12m != null ? `${p._dados_bairro_axis.tendencia12m}%` : null],
      p._score_axis_patrimonial && ['Score AXIS', p._score_axis_patrimonial],
      p._gap_asking_closing_pct && ['Gap negociação', `${p._gap_asking_closing_pct}%`],
    ].filter(Boolean).filter(([,v]) => v != null).map(([l,v]) =>
      `<div class="row"><span class="row-l">${l}</span><span class="row-v">${v}</span></div>`
    ).join('')}
  </div>` : ''}

  <!-- Positivos / Negativos -->
  <div class="grid">
    <div class="card">
      <div class="card-t green">✅ Positivos</div>
      ${(p.positivos || []).slice(0, 5).map(x => `<div style="font-size:11px;padding:2px 0">+ ${x}</div>`).join('') || '<div style="color:#999;font-size:10px">—</div>'}
    </div>
    <div class="card">
      <div class="card-t red">⚠️ Atenção</div>
      ${(p.negativos || []).slice(0, 5).map(x => `<div style="font-size:11px;padding:2px 0">− ${x}</div>`).join('') || '<div style="color:#999;font-size:10px">—</div>'}
    </div>
  </div>

  ${p.justificativa ? `
  <div class="card" style="margin-bottom:14px">
    <div class="card-t">💬 Justificativa</div>
    <div style="font-size:11px;line-height:1.6;color:#333">${p.justificativa}</div>
  </div>` : ''}
</div>

<!-- TAB: Refs (comparáveis) -->
${p.comparaveis?.length ? `
<div class="tab-content" id="tab-refs">
  <div class="section-divider">🏘️ Comparáveis (${p.comparaveis.length})</div>
  ${p.comparaveis.slice(0, 5).map(c => `
  <div class="comp">
    <div>
      <div class="comp-t">${c.descricao || c.endereco || '—'}</div>
      <div style="font-size:10px;color:#666">
        ${c.area_m2 ? c.area_m2 + 'm²' : ''} ${c.quartos ? '· ' + c.quartos + 'q' : ''} ${c.vagas ? '· ' + c.vagas + 'v' : ''}
        ${c.preco_m2 ? `· R$ ${Number(c.preco_m2).toLocaleString('pt-BR')}/m²` : ''}
      </div>
      ${c.link ? `<a href="${c.link}" style="font-size:9px;color:#0D9488" target="_blank">🔗 Ver anúncio</a>` : ''}
    </div>
    <div class="comp-v">${c.valor ? (c.valor / 1000).toFixed(0) + 'K' : '—'}</div>
  </div>`).join('')}
</div>` : ''}

<!-- Footer -->
<div class="ft">
  <span>AXIS · ${p.codigo_axis || ''} · ${new Date().toLocaleDateString('pt-BR')}</span>
  <span>${_hostname}</span>
</div>

</div>

<script>
// Enable tab switching only when JS is available
document.querySelector('.wrap').classList.add('js-enabled')
function showTab(id){
  document.querySelectorAll('.tab-content').forEach(e=>e.classList.remove('active'))
  document.querySelectorAll('.tab').forEach(e=>e.classList.remove('active'))
  document.getElementById('tab-'+id).classList.add('active')
  document.querySelectorAll('.tab').forEach(t=>{
    if(t.textContent.toLowerCase().includes(id.substring(0,3))) t.classList.add('active')
  })
}
// Set first tab active on load
document.getElementById('tab-resumo').classList.add('active')

// Reforma selector
const REF = ${JSON.stringify(reformas)};
const VM = ${p.valor_mercado_estimado || 0};
const LANCE = ${precoCompra || 0};
const CUSTOS_AQ = ${bd.totalCustos};
const HOLDING = ${holdingTotal};
function selReforma(i){
  document.querySelectorAll('.ref-opt').forEach((e,j)=>e.classList.toggle('sel',j===i))
  const r=REF[i]
  document.getElementById('ref-custo').textContent='R$ '+r.custo.toLocaleString('pt-BR')
  document.getElementById('ref-m2').textContent='R$ '+r.custoM2+'/m²'
  document.getElementById('ref-val').textContent='+'+r.valorizacao+'%'
  document.getElementById('ref-pos').textContent='R$ '+Math.round(VM*(1+r.valorizacao/100)).toLocaleString('pt-BR')
  document.getElementById('ref-total').textContent='R$ '+(LANCE+r.custo+CUSTOS_AQ+HOLDING).toLocaleString('pt-BR')
  const roiEl=document.getElementById('ref-roi'); if(roiEl) roiEl.textContent=(r.roiFlip>0?'+':'')+r.roiFlip+'%'
  const efEl=document.getElementById('ref-ef'); if(efEl) efEl.textContent='R$ '+r.eficiencia
}
</script>
</body>
</html>`
}

// ── ACTIONS ─────────────────────────────────────────────────────────────

// Converter URL de imagem para base64 data URI (para funcionar offline/WhatsApp)
async function imageUrlToBase64(url, timeout = 8000) {
  try {
    const res = await fetch(url, { 
      signal: AbortSignal.timeout(timeout),
      headers: { 'Accept': 'image/webp,image/jpeg,image/png,*/*' }
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => reject(new Error('FileReader failed'))
      reader.readAsDataURL(blob)
    })
  } catch(e) {
    // Fallback: tentar via proxy de imagem
    try {
      const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=600&q=75&output=jpg`
      const res2 = await fetch(proxyUrl, { signal: AbortSignal.timeout(timeout) })
      if (!res2.ok) throw new Error('proxy failed')
      const blob2 = await res2.blob()
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => reject(new Error('proxy reader failed'))
        reader.readAsDataURL(blob2)
      })
    } catch(e2) {
      console.warn('[AXIS Export] Imagem não convertida:', url.substring(0, 80), e2.message)
      return null
    }
  }
}

async function gerarBlob(p) {
  // Converter fotos para base64 (paralelo, com timeout)
  const fotosOriginais = [p.foto_principal, ...(p.fotos || [])].filter(Boolean)
  const fotosUnicas = [...new Set(fotosOriginais)].slice(0, 6) // max 6 fotos
  
  let fotosBase64 = {}
  if (fotosUnicas.length > 0) {
    const conversoes = await Promise.allSettled(
      fotosUnicas.map(async url => ({ url, base64: await imageUrlToBase64(url) }))
    )
    for (const r of conversoes) {
      if (r.status === 'fulfilled' && r.value.base64) {
        fotosBase64[r.value.url] = r.value.base64
      }
    }
  }

  // Gerar HTML com fotos embutidas
  let html = gerarHTML(p)
  
  // Substituir URLs de imagem por base64
  for (const [url, base64] of Object.entries(fotosBase64)) {
    // Escapar caracteres especiais da URL para regex
    const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    html = html.replace(new RegExp(escaped, 'g'), base64)
  }

  return new Blob([html], { type: 'text/html' })
}

async function gerarArquivo(p) {
  const blob = await gerarBlob(p)
  const nome = `AXIS_${p.codigo_axis || 'imovel'}_${new Date().toISOString().slice(0, 10)}`
  return new File([blob], `${nome}.html`, { type: 'text/html' })
}

// Compartilhar via Web Share API (mobile nativo)
export async function compartilharRelatorio(p) {
  try {
    const file = await gerarArquivo(p)
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        title: `AXIS · ${p.codigo_axis || ''} · ${p.titulo || 'Imóvel'}`,
        text: `${p.recomendacao || '—'} · Score ${(p.score_total || 0).toFixed(1)} · ${fmt(p.preco_pedido || p.valor_minimo)}`,
        files: [file],
      })
      return 'shared'
    }
  } catch (e) {
    if (e.name === 'AbortError') return 'cancelled'
    console.warn('[AXIS Share]', e.message)
  }
  // Fallback: download
  return downloadRelatorio(p)
}

// Download como arquivo HTML
export async function downloadRelatorio(p) {
  const blob = await gerarBlob(p)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `AXIS_${p.codigo_axis || 'imovel'}_${new Date().toISOString().slice(0, 10)}.html`
  a.click()
  URL.revokeObjectURL(url)
  return 'downloaded'
}

// Abrir para impressão (salvar como PDF via browser)
export function exportarPDFImovel(p) {
  const html = gerarHTML(p)
  const win = window.open('', '_blank', 'width=800,height=1100')
  if (win) {
    win.document.write(html)
    win.document.close()
    win.onload = () => setTimeout(() => win.print(), 500)
  } else {
    downloadRelatorio(p)
  }
}

// Menu de opções (chamado pelo botão PDF no detalhe)
export async function abrirMenuExportacao(p, onResult) {
  // Tentar share nativo primeiro (mobile)
  if (navigator.share && /Mobi|Android|iPhone/i.test(navigator.userAgent)) {
    const result = await compartilharRelatorio(p)
    onResult?.(result)
    return
  }
  // Desktop: download direto
  const result = await downloadRelatorio(p)
  onResult?.(result)
}
