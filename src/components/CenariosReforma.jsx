import { useState, useMemo } from 'react'
import { C, K, fmtC, btn, card } from '../appConstants.js'
import { useReforma } from '../hooks/useReforma.jsx'
import { isMercadoDireto } from '../lib/detectarFonte.js'
import { CUSTOS_LEILAO, CUSTOS_MERCADO } from '../lib/constants.js'
import {
  ESCOPOS,
  CUSTO_M2_SINAPI,
  LIQUIDEZ_BONUS,
  PRAZO_OBRA_MESES,
  detectarClasse,
} from '../lib/reformaUnificada.js'

export default function CenariosReforma({ imovel, isAdmin }) {
  const { escopoDetalhado: escopoSel, selecionarEscopo: setEscopoSel, area, preco_m2, classe } = useReforma()
  const [mostrarDetalhe, setMostrarDetalhe] = useState(false)

  const p = imovel || {}
  const eMercado = isMercadoDireto(p.fonte_url, p.tipo_transacao)

  // Base de aquisição: preco_pedido para mercado direto, valor_minimo para leilão
  const precoAquisicao = eMercado
    ? (parseFloat(p.preco_pedido) || parseFloat(p.valor_minimo) || 0)
    : (parseFloat(p.valor_minimo) || 0)
  const semDados = precoAquisicao === 0
  const avaliacao = parseFloat(p.valor_avaliacao) || precoAquisicao * 1.3
  const vmercado = parseFloat(p.valor_mercado_estimado) || avaliacao * 1.2
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

  const cenarios = useMemo(() => {
    return ESCOPOS.map(esc => {
      const custoReforma = (CUSTO_M2_SINAPI[esc.id]?.[classe] || 0) * area
      const custoTotal = precoAquisicao + comissao + itbi + doc + adv + reg + custoReforma
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
        valororiacao: Math.round((esc.fator_valorizacao - 1) * 100)
      }
    })
  }, [precoAquisicao, vmercado, area, classe, prazoLib, aluguelBase, avaliacao, comissao, itbi, doc, adv])

  const sel = cenarios.find(c => c.id === escopoSel) || cenarios[0]
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
      {/* Seletor de escopos */}
      <div style={{display:'flex', gap:6, marginBottom:14, overflowX:'auto', paddingBottom:4}}>
        {ESCOPOS.map(esc => (
          <button key={esc.id} onClick={() => setEscopoSel(esc.id)} style={{
            flexShrink:0, padding:'6px 12px', borderRadius:8, fontSize:11, cursor:'pointer',
            fontWeight: escopoSel === esc.id ? 600 : 400,
            border: `1.5px solid ${escopoSel === esc.id ? esc.cor : C.borderW}`,
            background: escopoSel === esc.id ? `${esc.cor}15` : C.white,
            color: escopoSel === esc.id ? esc.cor : C.muted
          }}>{esc.label}</button>
        ))}
      </div>

      {/* Painel do cenário selecionado — ocultar cálculos se sem dados */}
      {semDados ? null : <></>}
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12, opacity: semDados ? 0.3 : 1, pointerEvents: semDados ? 'none' : 'auto'}}>

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
                {['Escopo','Custo reforma','Total','Valor venda','Lucro','ROI','Yield loc.'].map(h => (
                  <th key={h} style={{padding:'7px 10px', textAlign: h === 'Escopo' ? 'left' : 'right',
                    fontWeight:600, color:C.muted, fontSize:10, borderBottom:`1px solid ${C.borderW}`}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cenarios.map((c, i) => (
                <tr key={c.id} onClick={() => setEscopoSel(c.id)} style={{
                  cursor:'pointer',
                  background: c.id === escopoSel ? `${c.cor}08` : i % 2 === 0 ? 'transparent' : `${C.surface}80`,
                  borderLeft: c.id === escopoSel ? `3px solid ${c.cor}` : '3px solid transparent'
                }}>
                  <td style={{padding:'7px 10px', color:c.id === escopoSel ? c.cor : C.text, fontWeight: c.id === escopoSel ? 600 : 400}}>
                    {c.label}
                  </td>
                  <td style={{padding:'7px 10px', textAlign:'right', color:C.muted}}>{fmt(c.custoReforma)}</td>
                  <td style={{padding:'7px 10px', textAlign:'right', color:C.text}}>{fmt(c.custoTotal)}</td>
                  <td style={{padding:'7px 10px', textAlign:'right', color:C.text}}>{fmt(c.valorPosReforma)}</td>
                  <td style={{padding:'7px 10px', textAlign:'right', color:c.lucro > 0 ? C.emerald : '#A32D2D', fontWeight:600}}>{fmt(c.lucro)}</td>
                  <td style={{padding:'7px 10px', textAlign:'right', color:c.roi >= 30 ? C.emerald : c.roi >= 20 ? C.mustard : '#A32D2D', fontWeight:600}}>{pct(c.roi)}</td>
                  <td style={{padding:'7px 10px', textAlign:'right', color:c.yieldBruto >= 6 ? C.emerald : C.muted}}>{pct(c.yieldBruto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{fontSize:9, color:C.hint, marginTop:4, padding:'0 10px'}}>
            Clique em um cenário para selecionar · SINAPI-MG 2026 · Fator liquidez baseado em mercado BH
          </div>
        </div>
      )}
    </div>
  )
}
