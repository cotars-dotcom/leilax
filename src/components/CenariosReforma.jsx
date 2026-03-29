import { useState, useMemo } from 'react'
import { C, K, fmtC, btn, card } from '../appConstants.js'

const ESCOPOS = [
  {
    id: 'sem_reforma',
    label: 'Sem Reforma',
    descricao: 'Vende no estado atual — sem investimento em obras',
    fator_valorizacao: 1.00,
    inclui: [],
    cor: C.hint
  },
  {
    id: 'refresh_giro',
    label: 'Refresh de Giro',
    descricao: 'Pintura, reparos, metais, luminárias — mínimo para girar',
    fator_valorizacao: 1.04,
    inclui: ['Pintura geral', 'Pequenos reparos', 'Metais/louças pontuais', 'Limpeza'],
    cor: '#3B8BD4'
  },
  {
    id: 'leve_funcional',
    label: 'Leve Funcional',
    descricao: 'Refresh + piso laminado/porcelanato parcial + elétrica/hidráulica',
    fator_valorizacao: 1.08,
    inclui: ['Pintura + Reparos', 'Piso laminado', 'Elétrica parcial', 'Hidráulica parcial'],
    cor: C.emerald
  },
  {
    id: 'leve_reforcada_1_molhado',
    label: 'Leve Reforçada',
    descricao: 'Leve funcional + 1 banheiro ou cozinha completa',
    fator_valorizacao: 1.12,
    inclui: ['Tudo do Leve', '1 área molhada completa', 'Porcelanato médio', 'Ferragens'],
    cor: C.mustard
  },
  {
    id: 'media',
    label: 'Reforma Média',
    descricao: 'Todos molhados + esquadrias + elétrica/hidráulica completa',
    fator_valorizacao: 1.18,
    inclui: ['Todos molhados', 'Esquadrias', 'Elétrica+Hidráulica total', 'Acabamento médio'],
    cor: '#A378DD'
  },
  {
    id: 'pesada',
    label: 'Reforma Pesada',
    descricao: 'Reforma total + estrutura + projeto + ART',
    fator_valorizacao: 1.28,
    inclui: ['Tudo + estrutura', 'Projeto arquitetônico', 'ART', 'Acabamento alto'],
    cor: '#D05538'
  }
]

// Custo/m² por escopo e classe (SINAPI-MG 2026)
const CUSTO_M2 = {
  sem_reforma:             { A_prime: 0,    B_medio_alto: 0,   C_intermediario: 0,   D_popular: 0 },
  refresh_giro:            { A_prime: 420,  B_medio_alto: 375, C_intermediario: 335, D_popular: 280 },
  leve_funcional:          { A_prime: 710,  B_medio_alto: 645, C_intermediario: 585, D_popular: 520 },
  leve_reforcada_1_molhado:{ A_prime: 1175, B_medio_alto: 1070,C_intermediario: 975, D_popular: 870 },
  media:                   { A_prime: 1600, B_medio_alto: 1450,C_intermediario: 1300,D_popular: 1100 },
  pesada:                  { A_prime: 2500, B_medio_alto: 2200,C_intermediario: 1900,D_popular: 1600 }
}

function detectarClasse(preco_m2) {
  if (!preco_m2) return 'C_intermediario'
  if (preco_m2 >= 12000) return 'A_prime'
  if (preco_m2 >= 8000)  return 'B_medio_alto'
  if (preco_m2 >= 5000)  return 'C_intermediario'
  return 'D_popular'
}

const LIQUIDEZ_BONUS = {
  sem_reforma:              0,
  refresh_giro:             0.05,
  leve_funcional:           0.12,
  leve_reforcada_1_molhado: 0.18,
  media:                    0.25,
  pesada:                   0.20  // diminishing returns
}

const PRAZO_OBRA_MESES = {
  sem_reforma: 0, refresh_giro: 0.5, leve_funcional: 1.5,
  leve_reforcada_1_molhado: 2.5, media: 4, pesada: 7
}

export default function CenariosReforma({ imovel, isAdmin }) {
  const [escopoSel, setEscopoSel] = useState(imovel?.escopo_reforma || 'refresh_giro')
  const [mostrarDetalhe, setMostrarDetalhe] = useState(false)

  const p = imovel || {}
  const lance = parseFloat(p.valor_minimo) || 0
  const semDados = lance === 0
  const avaliacao = parseFloat(p.valor_avaliacao) || lance * 1.3
  const vmercado = parseFloat(p.valor_mercado_estimado) || avaliacao * 1.2
  const area = parseFloat(p.area_m2) || 80
  const preco_m2 = parseFloat(p.preco_m2_mercado) || parseFloat(p.preco_m2_asking_bairro) || 7000
  const aluguelBase = parseFloat(p.aluguel_mensal_estimado) || Math.round(vmercado * 0.005)
  const prazoLib = parseFloat(p.prazo_liberacao_estimado_meses) || 0

  const classe = detectarClasse(preco_m2)
  const classeLabel = { A_prime:'A — Prime', B_medio_alto:'B — Médio-Alto', C_intermediario:'C — Intermediário', D_popular:'D — Popular' }[classe]

  // Parâmetros de transação
  const comissao = lance * 0.05
  const itbi = lance * 0.03
  const doc = lance * 0.005
  const adv = lance * 0.02
  const reg = 1500

  const cenarios = useMemo(() => {
    return ESCOPOS.map(esc => {
      const custoReforma = CUSTO_M2[esc.id][classe] * area
      const custoTotal = lance + comissao + itbi + doc + adv + reg + custoReforma
      const prazo = prazoLib + PRAZO_OBRA_MESES[esc.id]

      // Valor pós-reforma = mercado × fator_valorizacao
      const valorPosReforma = Math.round(vmercado * esc.fator_valorizacao)
      // Teto realista: evitar sobrecap (limite 30% acima do mercado)
      const valorVendaReal = Math.min(valorPosReforma, vmercado * 1.30)

      // ROI Flip
      const irpf = Math.max(0, (valorVendaReal - custoTotal) * 0.15)
      const corretagem = valorVendaReal * 0.06
      const lucro = valorVendaReal - custoTotal - irpf - corretagem
      const roi = custoTotal > 0 ? (lucro / custoTotal) * 100 : 0

      // Impacto na liquidez
      const liquidezBonus = LIQUIDEZ_BONUS[esc.id]
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
  }, [lance, vmercado, area, classe, prazoLib, aluguelBase])

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

      {/* Aviso quando não há dados de lance */}
      {semDados && (
        <div style={{padding:'10px 12px', borderRadius:8, background:'#FAEEDA', border:'1px solid #BA751730', fontSize:12, color:'#633806', marginBottom:12}}>
          ⚠️ Lance mínimo não disponível — reanalize o imóvel para calcular os cenários corretamente.
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
            ['Lance', lance > 0 ? fmt(lance) : '⚠ Sem dados'],
            ['Comissão 5%', fmt(comissao)],
            ['ITBI 3%', fmt(itbi)],
            ['Doc + Adv', fmt(doc + adv + reg)],
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
            ['IRPF 15%', fmt(sel.irpf)],
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
          <span style={{color:C.muted}}>Ganho vs. sem reforma ({semReforma.id})</span>
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
