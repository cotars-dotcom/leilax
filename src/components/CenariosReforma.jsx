import { useState, useMemo, useEffect } from 'react'
import { C, K, fmtC, btn, card } from '../appConstants.js'
import { useReforma } from '../hooks/useReforma.jsx'
import { isMercadoDireto } from '../lib/detectarFonte.js'
import { CUSTOS_LEILAO, CUSTOS_MERCADO, calcularFatorHomogeneizacao } from '../lib/constants.js'
import {
  ESCOPOS,
  CUSTO_M2_SINAPI,
  LIQUIDEZ_BONUS,
  PRAZO_OBRA_MESES,
  detectarClasse,
} from '../lib/reformaUnificada.js'
import { supabase } from '../lib/supabase.js'

// Mapeamento: 4 nomes canônicos → SINAPI escopo para cálculo detalhado
const CENARIO_ESCOPO = {
  sem_reforma: 'sem_reforma',
  basica:      'refresh_giro',
  media:       'leve_reforcada_1_molhado',
  completa:    'pesada',
}

// 4 cenários padronizados com dados do ESCOPOS como referência
const CENARIOS_4 = [
  { id: 'sem_reforma', label: 'Sem Reforma', cor: '#8E8EA0' },
  { id: 'basica',     label: 'Básica',       cor: '#3B8BD4' },
  { id: 'media',      label: 'Média',         cor: '#D4A017' },
  { id: 'completa',   label: 'Completa',      cor: '#D05538' },
]

export default function CenariosReforma({ imovel, isAdmin }) {
  const {
    cenarioSimplificado: cenarioSel,
    selecionarCenario: setCenarioSel,
    escopoDetalhado: escopoSel,
    selecionarEscopo: setEscopoSel,
    area, preco_m2, classe, lanceEstudo,
  } = useReforma()
  const [mostrarDetalhe, setMostrarDetalhe] = useState(false)
  const [itensDB, setItensDB] = useState(null)
  const [abertos, setAbertos] = useState(new Set())

  useEffect(() => {
    supabase.from('itens_reforma').select('*').eq('ativo', true).order('cenario').order('ordem')
      .then(({ data }) => { if (data) setItensDB(data) })
  }, [])

  const p = imovel || {}
  const eMercado = isMercadoDireto(p.fonte_url, p.tipo_transacao)

  // Sprint 18: usar lance do ConfigEstudo se disponível
  const precoAquisicao = lanceEstudo || (eMercado
    ? (parseFloat(p.preco_pedido) || parseFloat(p.valor_minimo) || 0)
    : (parseFloat(p.valor_minimo) || 0))
  const semDados = precoAquisicao === 0
  const avaliacao = parseFloat(p.valor_avaliacao) || precoAquisicao * 1.3
  const vmercadoRaw = parseFloat(p.valor_mercado_estimado) || avaliacao * 1.2
  // Ajustar valor de mercado por atributos (Sprint 17 — homogeneização NBR 14653)
  const homo = calcularFatorHomogeneizacao(p, vmercadoRaw)
  const vmercado = homo.valorAjustado || vmercadoRaw
  const aluguelBase = parseFloat(p.aluguel_mensal_estimado) || Math.round(vmercado * 0.005)
  const prazoLib = eMercado ? 0 : (parseFloat(p.prazo_liberacao_estimado_meses) || 0)

  const classeLabel = { A_prime:'A — Prime', B_medio_alto:'B — Médio-Alto', C_intermediario:'C — Intermediário', D_popular:'D — Popular' }[classe]

  // Parâmetros de transação — fonte: constants.js
  const _tab = eMercado ? CUSTOS_MERCADO : CUSTOS_LEILAO
  const comissao = precoAquisicao * ((p.comissao_leiloeiro_pct ?? _tab.comissao_leiloeiro_pct) / 100)
  const itbi = precoAquisicao * ((p.itbi_pct ?? _tab.itbi_pct) / 100)
  const doc = precoAquisicao * (_tab.documentacao_pct / 100)
  const adv = precoAquisicao * (_tab.advogado_pct / 100)
  const reg = _tab.registro_fixo
  const debitosArrematante = p.responsabilidade_debitos === 'arrematante'
    ? parseFloat(p.debitos_total_estimado || 0) : 0

  const cenarios = useMemo(() => {
    return ESCOPOS.map(esc => {
      const custoReforma = (CUSTO_M2_SINAPI[esc.id]?.[classe] || 0) * area
      const custoTotal = precoAquisicao + comissao + itbi + doc + adv + reg + custoReforma + debitosArrematante
      const prazo = prazoLib + (PRAZO_OBRA_MESES[esc.id] || 0)

      // Valor pós-reforma = mercado × fator_valorizacao
      const valorPosReforma = Math.round(vmercado * esc.fator_valorizacao)
      // Teto realista: evitar sobrecap (limite 30% acima do mercado)
      const valorVendaReal = Math.min(valorPosReforma, vmercado * 1.30)

      // ROI Flip
      const ganhoCapital = Math.max(0, valorVendaReal - custoTotal)
      const irpf = valorVendaReal <= 440000 ? 0 : Math.max(0, ganhoCapital * 0.15)
      const corretagem = valorVendaReal * 0.06
      const lucro = valorVendaReal - custoTotal - irpf - corretagem
      const roi = custoTotal > 0 ? (lucro / custoTotal) * 100 : 0

      // Impacto na liquidez
      const liquidezBonus = LIQUIDEZ_BONUS[esc.id] || 0
      const prazoVendaBase = parseFloat(p.mercado_tempo_venda_meses) || 6
      const prazoVendaPos = Math.max(1, Math.round(prazoVendaBase * (1 - liquidezBonus)))

      // ROI Locação
      const aluguelPos = Math.round(aluguelBase * esc.fator_valorizacao)
      const yieldBruto = (aluguelPos * 12 / valorVendaReal) * 100

      // Sobrecap
      const teto = avaliacao * (classe === 'A_prime' ? 0.07 : classe === 'B_medio_alto' ? 0.06 : 0.05)
      const sobrecap = custoReforma > teto
        ? 'vermelho' : custoReforma > teto * 0.85 ? 'amarelo' : 'verde'

      // MAO — lance máximo para ROI mínimo 20% neste cenário
      // custoTotalMAO = valorVendaLiq / 1.20  → MAO = custoTotalMAO - custos_não_lance
      const custoAlvo20 = valorVendaReal > 0 ? (valorVendaReal - corretagem) / 1.20 : 0
      const custosNaoLance = custoReforma + debitosArrematante + reg
      const txProp = ((p.comissao_leiloeiro_pct ?? _tab.comissao_leiloeiro_pct) + (p.itbi_pct ?? _tab.itbi_pct) + _tab.documentacao_pct + _tab.advogado_pct) / 100
      const mao20 = Math.max(0, Math.round((custoAlvo20 - custosNaoLance) / (1 + txProp)))
      const deltaLanceVsMAO = precoAquisicao - mao20

      return {
        ...esc,
        custoReforma: Math.round(custoReforma),
        custoTotal: Math.round(custoTotal),
        valorPosReforma: valorVendaReal,
        lucro: Math.round(lucro),
        roi: parseFloat(roi.toFixed(1)),
        irpf: Math.round(irpf),
        corretagem: Math.round(corretagem),
        prazoTotal: prazo,
        prazoVenda: prazoVendaPos,
        aluguelPos,
        yieldBruto: parseFloat(yieldBruto.toFixed(1)),
        sobrecap,
        liquidezBonus: Math.round(liquidezBonus * 100),
        valororiacao: Math.round((esc.fator_valorizacao - 1) * 100),
        mao20,
        deltaLanceVsMAO,
      }
    })
  }, [precoAquisicao, vmercado, area, classe, prazoLib, aluguelBase, avaliacao, comissao, itbi, doc, adv])

  // ─── Or\u00e7amento detalhado: 3 cen\u00e1rios simplificados (acumulativos) ─────────────
  const cenarios3 = useMemo(() => {
    const quartos = parseInt(p.quartos) || 2
    const calcQtd = (item) => {
      if (item.qtd_formula === 'area') return Math.round(area * (item.fator_area || 0))
      if (item.qtd_formula === 'comodos') return quartos + 1
      return item.qtd_padrao || 1
    }
    const mkItens = (lista) => lista.map(i => {
      const qtd = calcQtd(i)
      return { item: i.item, un: i.unidade, qtd, custo: i.custo_unitario, sub: Math.round(qtd * i.custo_unitario) }
    })

    // Fonte 1: reforma_detalhada j\u00e1 no banco (por cen\u00e1rio, acumulativo)
    if (p.reforma_detalhada) {
      const rd = p.reforma_detalhada
      return ['basica', 'media', 'completa'].map(c => {
        const d = rd[c] || {}
        return {
          id: c,
          label: c === 'basica' ? 'B\u00e1sica' : c === 'media' ? 'M\u00e9dia' : 'Completa',
          prazo: d.prazo_dias || (c === 'basica' ? 15 : c === 'media' ? 45 : 90),
          total: d.total || 0,
          subtotal: d.subtotal || 0,
          bdi: d.bdi_pct || 20,
          itens: d.itens || [],
        }
      })
    }

    // Fonte 2: calcular ao vivo a partir de itens_reforma do banco
    if (!itensDB) return null
    const grupos = { basica: [], media: [], completa: [] }
    for (const i of itensDB) { if (grupos[i.cenario]) grupos[i.cenario].push(i) }

    // Acumular: m\u00e9dia = b\u00e1sica + pr\u00f3prios; completa = todos anteriores + pr\u00f3prios
    const itensBas = mkItens(grupos.basica)
    const itensMed = mkItens(grupos.media)
    const itensCom = mkItens(grupos.completa)
    const mkCenario = (id, label, prazo, itens) => {
      const subtotal = itens.reduce((s, d) => s + d.sub, 0)
      return { id, label, prazo, itens, subtotal: Math.round(subtotal), total: Math.round(subtotal * 1.2), bdi: 20 }
    }
    return [
      mkCenario('basica', 'B\u00e1sica', 15, itensBas),
      mkCenario('media', 'M\u00e9dia', 45, [...itensBas, ...itensMed]),
      mkCenario('completa', 'Completa', 90, [...itensBas, ...itensMed, ...itensCom]),
    ]
  }, [itensDB, p.reforma_detalhada, area, p.quartos])

  // Itens que a Vision recomendou (nomes dos itens que precisam de aten\u00e7\u00e3o)
  const visionItens = useMemo(() => {
    if (!p.vision_laudo?.itens_identificados) return new Set()
    return new Set(
      p.vision_laudo.itens_identificados
        .filter(i => i.acao && i.acao !== 'ok')
        .map(i => (i.item || '').toLowerCase())
    )
  }, [p.vision_laudo])

  const toggleAberto = (id) => setAbertos(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  // Mapear cenário canônico → SINAPI escopo para exibir métricas detalhadas
  const escopoIdSel = CENARIO_ESCOPO[cenarioSel] || escopoSel
  const sel = cenarios.find(c => c.id === escopoIdSel) || cenarios[0]
  const semReforma = cenarios[0]
  const gainVsSemReforma = sel.lucro - semReforma.lucro

  const fmt = v => v ? `R$ ${Math.round(v).toLocaleString('pt-BR')}` : '—'
  const pct = v => v != null ? `${v.toFixed ? v.toFixed(1) : v}%` : '—'

  return (
    <div style={{...card(), marginBottom:14}}>
      {/* Header */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12}}>
        <div>
          <div style={{fontWeight:600, color:C.navy, fontSize:13}}>Cenários de Reforma</div>
          <div style={{fontSize:10, color:C.hint, marginTop:2}}>
            Classe {classeLabel} · {area}m² · SINAPI-MG 2026
          </div>
          {!semDados && (
            <div style={{fontSize:10, color:'#D97706', marginTop:3, fontWeight:600}}>
              📐 Analisando com lance do estudo: <strong>{fmt(precoAquisicao)}</strong>
            </div>
          )}
        </div>
        <button onClick={() => setMostrarDetalhe(!mostrarDetalhe)}
          style={{...btn('s'), fontSize:11, color:C.muted}}>
          {mostrarDetalhe ? '▲ Menos' : '▼ Comparar todos'}
        </button>
      </div>

      {/* Aviso quando não há dados de preço */}
      {semDados && (
        <div style={{padding:'10px 12px', borderRadius:8, background:'#FAEEDA', border:'1px solid #BA751730', fontSize:12, color:'#633806', marginBottom:12}}>
          {eMercado
            ? '⚠️ Preço pedido não disponível — reanalize o imóvel para calcular os cenários corretamente.'
            : '⚠️ Lance mínimo não disponível — reanalize o imóvel para calcular os cenários corretamente.'}
        </div>
      )}
      {/* Seletor — 4 nomes padronizados (sincroniza com ConfigEstudo) */}
      <div style={{display:'flex', gap:6, marginBottom:14, overflowX:'auto', paddingBottom:4}}>
        {CENARIOS_4.map(c => (
          <button key={c.id} onClick={() => setCenarioSel(c.id)} style={{
            flex:1, padding:'6px 10px', borderRadius:8, fontSize:11, cursor:'pointer',
            fontWeight: cenarioSel === c.id ? 700 : 400,
            border: `1.5px solid ${cenarioSel === c.id ? c.cor : C.borderW}`,
            background: cenarioSel === c.id ? `${c.cor}15` : C.white,
            color: cenarioSel === c.id ? c.cor : C.muted
          }}>{c.label}</button>
        ))}
      </div>

      {/* Painel do cenário selecionado — ocultar se sem dados */}
      {semDados ? (
        <div style={{fontSize:12, color:C.muted, textAlign:'center', padding:'16px 0'}}>
          Informe o preço de aquisição para visualizar os cenários de reforma e ROI.
        </div>
      ) : <>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12}}>

        {/* Coluna esquerda — custos */}
        <div style={{padding:'12px 14px', background:C.surface, borderRadius:10}}>
          <div style={{fontSize:11, fontWeight:600, color:C.muted, marginBottom:8}}>Custos</div>
          {[
            [eMercado ? 'Preço aquisição' : 'Lance', precoAquisicao > 0 ? fmt(precoAquisicao) : '⚠ Sem dados'],
            ...(eMercado ? [] : [['Comissão 5%', fmt(comissao)]]),
            ['ITBI 3%', fmt(itbi)],
            [eMercado ? 'Doc + Registro' : 'Doc + Adv', fmt(doc + adv + reg)],
            ['Reforma', fmt(sel.custoReforma), sel.sobrecap],
            ['Total', fmt(sel.custoTotal), 'total'],
          ].map(([l, v, flag]) => (
            <div key={l} style={{
              display:'flex', justifyContent:'space-between', alignItems:'center',
              padding:'4px 0',
              borderBottom: flag === 'total' ? 'none' : `1px solid ${C.borderW}`,
              fontWeight: flag === 'total' ? 700 : 400,
              borderTop: flag === 'total' ? `1px solid ${C.border}` : 'none',
              marginTop: flag === 'total' ? 4 : 0,
              fontSize: 12
            }}>
              <span style={{color: flag === 'total' ? C.navy : C.muted}}>{l}</span>
              <span style={{
                color: flag === 'vermelho' ? '#A32D2D'
                  : flag === 'amarelo' ? C.mustard
                  : flag === 'total' ? C.navy : C.text
              }}>
                {v}
                {flag === 'vermelho' && ' ⚠️'}
              </span>
            </div>
          ))}
          {sel.sobrecap !== 'verde' && sel.id !== 'sem_reforma' && (
            <div style={{marginTop:6, fontSize:10, color: sel.sobrecap === 'vermelho' ? '#A32D2D' : C.mustard,
              background: sel.sobrecap === 'vermelho' ? '#FCEBEB' : '#FAEEDA',
              borderRadius:6, padding:'4px 8px'}}>
              {sel.sobrecap === 'vermelho' ? '⚠️ Sobrecapitalização — risco de não recuperar o investimento' : '⚡ Reforma perto do teto — monitore o mercado'}
            </div>
          )}
        </div>

        {/* Coluna direita — retorno */}
        <div style={{padding:'12px 14px', background:C.surface, borderRadius:10}}>
          <div style={{fontSize:11, fontWeight:600, color:C.muted, marginBottom:8}}>Retorno (Flip)</div>
          {[
            ['Valor pós-reforma', fmt(sel.valorPosReforma)],
            ['Valorização', `+${sel.valororiacao}%`],
            [sel.valorPosReforma <= 440000 ? 'IRPF (isento)' : 'IRPF 15%', fmt(sel.irpf), sel.valorPosReforma > 440000 && sel.irpf > 0 ? 'irpf' : 'ok'],
            ['Corretagem 6%', fmt(sel.corretagem)],
            ['Lucro líquido', fmt(sel.lucro), 'lucro'],
            ['ROI', pct(sel.roi), 'roi'],
          ].map(([l, v, flag]) => (
            <div key={l} style={{
              display:'flex', justifyContent:'space-between', alignItems:'center',
              padding:'4px 0',
              borderBottom: ['lucro','roi'].includes(flag) ? 'none' : `1px solid ${C.borderW}`,
              borderTop: flag === 'lucro' ? `1px solid ${C.border}` : 'none',
              fontWeight: ['lucro','roi'].includes(flag) ? 700 : 400,
              marginTop: flag === 'lucro' ? 4 : 0,
              fontSize: 12
            }}>
              <span style={{color: C.muted}}>{l}</span>
              <span style={{
                color: flag === 'roi' ? (sel.roi >= 30 ? C.emerald : sel.roi >= 20 ? C.mustard : '#A32D2D')
                  : flag === 'lucro' ? C.emerald : C.text
              }}>{v}</span>
            </div>
          ))}

          {/* Locação */}
          <div style={{marginTop:10, paddingTop:8, borderTop:`1px solid ${C.borderW}`}}>
            <div style={{fontSize:10, fontWeight:600, color:C.muted, marginBottom:4}}>Locação pós-reforma</div>
            <div style={{display:'flex', justifyContent:'space-between', fontSize:12}}>
              <span style={{color:C.muted}}>Aluguel estimado</span>
              <span style={{color:C.text, fontWeight:500}}>{fmt(sel.aluguelPos)}/mês</span>
            </div>
            <div style={{display:'flex', justifyContent:'space-between', fontSize:12}}>
              <span style={{color:C.muted}}>Yield bruto</span>
              <span style={{color:sel.yieldBruto >= 6 ? C.emerald : C.mustard, fontWeight:600}}>{pct(sel.yieldBruto)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Impacto no mercado/liquidez */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:12}}>
        {[
          ['Prazo total', `${sel.prazoTotal.toFixed(1)} meses`, '(lib+obra)'],
          ['Liquidez', `+${sel.liquidezBonus}%`, 'redução prazo venda'],
          ['Prazo venda', `~${sel.prazoVenda}m`, `vs ${parseInt(p.mercado_tempo_venda_meses)||6}m base`],
        ].map(([l, v, obs]) => (
          <div key={l} style={{padding:'8px 10px', background:C.surface, borderRadius:8, textAlign:'center'}}>
            <div style={{fontSize:10, color:C.hint}}>{l}</div>
            <div style={{fontSize:14, fontWeight:700, color:C.navy, margin:'2px 0'}}>{v}</div>
            <div style={{fontSize:9, color:C.hint}}>{obs}</div>
          </div>
        ))}
      </div>

      {/* Ganho vs sem reforma */}
      {sel.id !== 'sem_reforma' && (
        <div style={{
          padding:'8px 12px', borderRadius:8,
          background: gainVsSemReforma > 0 ? `${C.emerald}10` : '#FCEBEB',
          border: `1px solid ${gainVsSemReforma > 0 ? C.emerald : '#E24B4A'}30`,
          fontSize:12, display:'flex', justifyContent:'space-between', alignItems:'center',
          marginBottom:12
        }}>
          <span style={{color:C.muted}}>Ganho vs. sem reforma</span>
          <span style={{fontWeight:700, color: gainVsSemReforma > 0 ? C.emerald : '#A32D2D'}}>
            {gainVsSemReforma > 0 ? '+' : ''}{fmt(gainVsSemReforma)}
          </span>
        </div>
      )}

      {/* Tabela comparativa — todos os cenários */}
      {mostrarDetalhe && (
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%', borderCollapse:'collapse', fontSize:11}}>
            <thead>
              <tr style={{background:C.surface}}>
                {['Escopo','Custo reforma','Total','Valor venda','Lucro','ROI','MAO p/ ROI 20%','Yield loc.'].map(h => (
                  <th key={h} style={{padding:'7px 10px', textAlign: h === 'Escopo' ? 'left' : 'right',
                    fontWeight:600, color:C.muted, fontSize:10, borderBottom:`1px solid ${C.borderW}`}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CENARIOS_4.map((can, i) => {
                const escopoId = CENARIO_ESCOPO[can.id] || can.id
                const c = cenarios.find(x => x.id === escopoId) || cenarios[0]
                const selecionado = cenarioSel === can.id
                return (
                <tr key={can.id} onClick={() => setCenarioSel(can.id)} style={{
                  cursor:'pointer',
                  background: selecionado ? `${can.cor}08` : i % 2 === 0 ? 'transparent' : `${C.surface}80`,
                  borderLeft: selecionado ? `3px solid ${can.cor}` : '3px solid transparent'
                }}>
                  <td style={{padding:'7px 10px', color:selecionado ? can.cor : C.text, fontWeight: selecionado ? 600 : 400}}>
                    {can.label}
                  </td>
                  <td style={{padding:'7px 10px', textAlign:'right', color:C.muted}}>{fmt(c.custoReforma)}</td>
                  <td style={{padding:'7px 10px', textAlign:'right', color:C.text}}>{fmt(c.custoTotal)}</td>
                  <td style={{padding:'7px 10px', textAlign:'right', color:C.text}}>{fmt(c.valorPosReforma)}</td>
                  <td style={{padding:'7px 10px', textAlign:'right', color:c.lucro > 0 ? C.emerald : '#A32D2D', fontWeight:600}}>{fmt(c.lucro)}</td>
                  <td style={{padding:'7px 10px', textAlign:'right', color:c.roi >= 30 ? C.emerald : c.roi >= 20 ? C.mustard : '#A32D2D', fontWeight:600}}>{pct(c.roi)}</td>
                  <td style={{padding:'7px 10px', textAlign:'right', color: c.deltaLanceVsMAO <= 0 ? C.emerald : '#A32D2D', fontWeight:600}} title={c.deltaLanceVsMAO > 0 ? `Lance excede MAO em ${fmt(c.deltaLanceVsMAO)}` : `Margem de ${fmt(-c.deltaLanceVsMAO)}`}>
                    {fmt(c.mao20)}
                  </td>
                  <td style={{padding:'7px 10px', textAlign:'right', color:c.yieldBruto >= 6 ? C.emerald : C.muted}}>{pct(c.yieldBruto)}</td>
                </tr>
                )
              })}
            </tbody>
          </table>
          <div style={{fontSize:9, color:C.hint, marginTop:4, padding:'0 10px'}}>
            Clique em um cenário para selecionar · SINAPI-MG 2026 · MAO = lance máximo para ROI ≥ 20% · 🟢 lance ≤ MAO, 🔴 lance excede MAO
          </div>
        </div>
      )}
      </>}

      {/* ─── Or\u00e7amento detalhado por cen\u00e1rio (acumulativo) ──────────────────────── */}
      {cenarios3 && (
        <div style={{marginTop:16, borderTop:`1px solid ${C.borderW}`, paddingTop:14}}>
          <div style={{fontSize:11, fontWeight:600, color:C.muted, marginBottom:10}}>
            Or\u00e7amento Detalhado (SINAPI-MG 2026)
            {p.vision_laudo && <span style={{marginLeft:6, fontSize:10, color:'#7C3AED'}}>📸 Vision ativo</span>}
          </div>
          {cenarios3.map(c => {
            const CORES = { basica:'#3B8BD4', media:'#D4A017', completa:'#D05538' }
            const PRAZOS_LABEL = { basica:'15 dias', media:'45 dias', completa:'90 dias' }
            const cor = CORES[c.id] || C.navy
            const aberto = abertos.has(c.id)
            const fmt2 = v => v ? `R$ ${Math.round(v).toLocaleString('pt-BR')}` : 'R$ 0'
            const bdiValor = c.subtotal ? Math.round(c.total - c.subtotal) : 0
            return (
              <div key={c.id} style={{marginBottom:8, border:`1px solid ${cor}30`, borderRadius:10, overflow:'hidden'}}>
                {/* Cabe\u00e7alho do cen\u00e1rio */}
                <div style={{
                  display:'flex', justifyContent:'space-between', alignItems:'center',
                  padding:'10px 14px', background:`${cor}10`, cursor:'pointer'
                }} onClick={() => toggleAberto(c.id)}>
                  <div>
                    <span style={{fontWeight:700, color:cor, fontSize:13}}>{c.label}</span>
                    <span style={{color:C.muted, fontSize:11, marginLeft:8}}>
                      {fmt2(c.total)} · {PRAZOS_LABEL[c.id]}
                    </span>
                  </div>
                  <button style={{...btn('s'), fontSize:11, color:cor, background:'transparent', border:'none'}}>
                    {aberto ? '▲ Ocultar' : '▶ Ver or\u00e7amento'}
                  </button>
                </div>

                {/* Tabela de itens */}
                {aberto && (
                  <div style={{padding:'0 14px 12px'}}>
                    {c.itens.length === 0 ? (
                      <div style={{fontSize:11, color:C.hint, padding:'8px 0'}}>Nenhum item cadastrado para este cen\u00e1rio.</div>
                    ) : (
                      <table style={{width:'100%', borderCollapse:'collapse', fontSize:11, marginTop:10}}>
                        <thead>
                          <tr style={{background:C.surface}}>
                            {['Item','Un','Qtd','R$/un','Subtotal'].map(h => (
                              <th key={h} style={{
                                padding:'5px 8px', textAlign: h === 'Item' ? 'left' : 'right',
                                fontWeight:600, color:C.muted, fontSize:10,
                                borderBottom:`1px solid ${C.borderW}`
                              }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {c.itens.map((item, idx) => {
                            const nomeKey = (item.item || '').toLowerCase()
                            const temVision = visionItens.size > 0 && [...visionItens].some(v => nomeKey.includes(v) || v.includes(nomeKey.split(' ')[0]))
                            return (
                              <tr key={idx} style={{background: idx % 2 === 0 ? 'transparent' : `${C.surface}80`}}>
                                <td style={{padding:'5px 8px', color:C.text}}>
                                  {item.item}
                                  {temVision && <span title="Vision recomendou aten\u00e7\u00e3o" style={{marginLeft:4, fontSize:10}}>📸</span>}
                                </td>
                                <td style={{padding:'5px 8px', textAlign:'right', color:C.muted}}>{item.un}</td>
                                <td style={{padding:'5px 8px', textAlign:'right', color:C.muted}}>{item.qtd}</td>
                                <td style={{padding:'5px 8px', textAlign:'right', color:C.muted}}>{fmt2(item.custo)}</td>
                                <td style={{padding:'5px 8px', textAlign:'right', color:C.text, fontWeight:500}}>{fmt2(item.sub)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot>
                          <tr style={{borderTop:`1px solid ${C.borderW}`}}>
                            <td colSpan={4} style={{padding:'5px 8px', color:C.muted, fontStyle:'italic', fontSize:10}}>Subtotal materiais + m\u00e3o de obra</td>
                            <td style={{padding:'5px 8px', textAlign:'right', color:C.text}}>{fmt2(c.subtotal)}</td>
                          </tr>
                          <tr>
                            <td colSpan={4} style={{padding:'5px 8px', color:C.muted, fontStyle:'italic', fontSize:10}}>BDI {c.bdi}% (adm + lucro + impostos)</td>
                            <td style={{padding:'5px 8px', textAlign:'right', color:C.muted}}>{fmt2(bdiValor)}</td>
                          </tr>
                          <tr style={{borderTop:`1px solid ${C.border}`}}>
                            <td colSpan={4} style={{padding:'6px 8px', fontWeight:700, color:cor}}>TOTAL {c.label.toUpperCase()}</td>
                            <td style={{padding:'6px 8px', textAlign:'right', fontWeight:700, color:cor}}>{fmt2(c.total)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          {!p.reforma_detalhada && !itensDB && (
            <div style={{fontSize:11, color:C.hint, padding:'8px 0'}}>Carregando itens de or\u00e7amento...</div>
          )}
        </div>
      )}
    </div>
  )
}
