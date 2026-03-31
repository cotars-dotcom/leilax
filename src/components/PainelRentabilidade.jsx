import { useState, useMemo } from 'react'
import { C, card } from '../appConstants.js'
import { isMercadoDireto } from '../lib/detectarFonte.js'
import { useReforma } from '../hooks/useReforma.jsx'

// ─── helpers ─────────────────────────────────────────────────────────────────
const fmt = v => v ? `R$ ${Math.round(v).toLocaleString('pt-BR')}` : '—'
const pct = v => v != null ? `${Number(v).toFixed(1)}%` : '—'
const GREEN = '#065F46', RED = '#991B1B', GOLD = '#92400E'

// Fatores de homogeneização NBR 14653 (fonte: pesquisa mercado BH 2025-2026)
const FATORES_ATRIBUTOS = {
  sem_elevador: 0.85,   // -15% (NBR 14653, validação AXIS: central 0.85, térreo 0.90, andar alto 0.80)
  sem_piscina:  0.97,   // -3%
  sem_lazer:    0.95,   // -5%
  sem_salao:    0.97,   // -3%
  vaga_0:       0.90,   // sem vaga = -10%
  vaga_2:       1.05,   // 2ª vaga = +5%
}

// Probabilidades TRT-3 BH por faixa de desconto (baseado em histórico)
function probArrematacao(desconto, leilao) {
  if (leilao === 1) {
    if (desconto >= 40) return { prob: 0.15, label: '15%', cor: GOLD }
    if (desconto >= 30) return { prob: 0.08, label: '8%',  cor: RED }
    return { prob: 0.03, label: '3%', cor: RED }
  }
  // 2º leilão
  if (desconto >= 60) return { prob: 0.40, label: '40%', cor: GREEN }
  if (desconto >= 50) return { prob: 0.28, label: '28%', cor: GOLD }
  if (desconto >= 40) return { prob: 0.18, label: '18%', cor: GOLD }
  return { prob: 0.10, label: '10%', cor: RED }
}

// Calcular custos fixos de arrematação
function custoArrematacao(lance) {
  const comissao    = lance * 0.05   // leiloeiro 5%
  const itbi        = lance * 0.03   // ITBI BH ~3%
  const doc         = lance * 0.005  // doc/escritura 0.5%
  const adv         = lance * 0.02   // honorário advogado 2%
  const registro    = 1500           // cartório
  return { comissao, itbi, doc, adv, registro, total: comissao + itbi + doc + adv + registro }
}

// Calcular cenário FLIP
function calcFlip(lance, vmercado, reforma, juridico = 0) {
  const c = custoArrematacao(lance)
  const custoTotal = lance + c.total + reforma + juridico
  const corretagem = vmercado * 0.06
  const precoVendaLiq = vmercado - corretagem  // valor líquido de venda
  // IRPF: 15% sobre ganho de capital = precoVendaLiq - custoAquisição
  const ganhoCapital = Math.max(0, precoVendaLiq - custoTotal)
  const irpf = vmercado <= 440000 ? 0 : ganhoCapital * 0.15
  const lucro = precoVendaLiq - custoTotal - irpf
  const roi   = custoTotal > 0 ? (lucro / custoTotal * 100) : 0
  // MAO: preço máximo para ROI ≥ 20% | vm*0.80 = MAO * (1+tx) + fixos + reforma
  const mao = (vmercado * 0.80 - 1500 - reforma - juridico) / (1 + 0.095)
  return { custoTotal, corretagem, irpf, lucro, roi, mao, viavel: roi >= 20 }
}

// Calcular cenário LOCAÇÃO
function calcLocacao(lance, aluguelMensal, reforma, vmercado, prazoMeses = 120) {
  const c = custoArrematacao(lance)
  const investimento = lance + c.total + reforma
  const vacancia     = aluguelMensal * 0.06 * 12  // 6% vacância ao ano
  const receita12m   = aluguelMensal * 12 - vacancia - (investimento * 0.005) // 0.5% manutenção
  const yieldBruto   = investimento > 0 ? (aluguelMensal * 12 / investimento * 100) : 0
  const yieldLiq     = investimento > 0 ? (receita12m / investimento * 100) : 0
  const payback      = receita12m > 0 ? Math.ceil(investimento / receita12m * 12) : 999
  // Valorização estimada (3% a.a. BH)
  const vf           = vmercado * Math.pow(1.03, prazoMeses / 12)
  const patrimonioFinal = vf * 0.94 // -6% corretagem na venda futura
  return { investimento, receita12m, yieldBruto, yieldLiq, payback, patrimonioFinal, viavel: yieldLiq >= 5 }
}

// ─── Sub-componente: Card de cenário de lance ─────────────────────────────────
function CardLance({ titulo, lance, avaliacao, vmercado, flip, loc, prob, destaque }) {
  const desc = avaliacao > 0 ? (avaliacao - lance) / avaliacao * 100 : 0
  const borda = destaque ? `2px solid ${C.emerald}` : `1px solid ${C.borderW}`
  const bg    = destaque ? '#F0FDF4' : '#fff'
  return (
    <div style={{ ...card(), padding:0, border:borda, background:bg, overflow:'hidden', marginBottom:6 }}>
      {/* Header */}
      <div style={{ padding:'10px 12px', borderBottom:`1px solid ${C.borderW}`,
        background: destaque ? '#ECFDF5' : C.surface }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:C.navy }}>{titulo}</div>
            <div style={{ fontSize:10, color:C.muted }}>
              {fmt(lance)} · {pct(desc)} desc. · prob. arremate: <strong style={{ color:prob.cor }}>{prob.label}</strong>
            </div>
          </div>
          {destaque && <span style={{ fontSize:9, fontWeight:700, padding:'2px 6px',
            background:C.emerald, color:'#fff', borderRadius:4 }}>★ MELHOR</span>}
        </div>
      </div>

      {/* Grid flip vs locação */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr' }}>
        {/* Flip */}
        <div style={{ padding:'10px 12px', borderRight:`1px solid ${C.borderW}` }}>
          <div style={{ fontSize:9, fontWeight:700, color:'#7C3AED', textTransform:'uppercase',
            letterSpacing:.4, marginBottom:6 }}>🔨 Flip (venda)</div>
          {[
            ['Custo total', fmt(flip.custoTotal)],
            ['Venda estimada', fmt(vmercado * 0.94)],
            ['Lucro líquido', fmt(flip.lucro)],
            ['ROI', pct(flip.roi)],
          ].map(([k,v]) => (
            <div key={k} style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
              <span style={{ fontSize:10, color:C.muted }}>{k}</span>
              <span style={{ fontSize:10, fontWeight:600,
                color: k==='Lucro líquido' ? (flip.lucro>0 ? GREEN : RED) :
                       k==='ROI' ? (flip.roi>=20 ? GREEN : flip.roi>=10 ? GOLD : RED) : C.navy }}>
                {v}
              </span>
            </div>
          ))}
          <div style={{ marginTop:6, padding:'4px 6px', borderRadius:5, textAlign:'center',
            background: flip.viavel ? '#ECFDF5' : '#FEF2F2',
            color: flip.viavel ? GREEN : RED, fontSize:10, fontWeight:700 }}>
            {flip.viavel ? '✅ Viável' : '❌ Margem baixa'}
          </div>
        </div>

        {/* Locação */}
        <div style={{ padding:'10px 12px' }}>
          <div style={{ fontSize:9, fontWeight:700, color:'#0369A1', textTransform:'uppercase',
            letterSpacing:.4, marginBottom:6 }}>🏠 Locação</div>
          {[
            ['Aluguel/mês', fmt(loc.receita12m / 12)],
            ['Yield bruto', pct(loc.yieldBruto)],
            ['Yield líquido', pct(loc.yieldLiq)],
            ['Payback', loc.payback < 900 ? `${loc.payback}m` : '>25a'],
          ].map(([k,v]) => (
            <div key={k} style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
              <span style={{ fontSize:10, color:C.muted }}>{k}</span>
              <span style={{ fontSize:10, fontWeight:600,
                color: k==='Yield líquido' ? (loc.yieldLiq>=6 ? GREEN : loc.yieldLiq>=4 ? GOLD : RED) :
                       k==='Payback' ? (loc.payback<180 ? GREEN : loc.payback<300 ? GOLD : RED) : C.navy }}>
                {v}
              </span>
            </div>
          ))}
          <div style={{ marginTop:6, padding:'4px 6px', borderRadius:5, textAlign:'center',
            background: loc.viavel ? '#EFF6FF' : '#FEF2F2',
            color: loc.viavel ? '#1D4ED8' : RED, fontSize:10, fontWeight:700 }}>
            {loc.viavel ? '✅ Atrativo' : '❌ Yield baixo'}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function PainelRentabilidade({ imovel }) {
  const { cenarioSimplificado: cenarioReforma, selecionarCenario: setCenarioReforma, reformas } = useReforma()
  const [mostrarAtributos, setMostrarAtributos] = useState(false)

  const {
    valor_minimo, valor_avaliacao, num_leilao,
    valor_mercado_estimado, aluguel_mensal_estimado, aluguel_sem_reforma,
    aluguel_com_reforma, fator_homogenizacao, valor_mercado_homogenizado,
    elevador, piscina, area_lazer, salao_festas, vagas,
    area_m2, area_privativa_m2, preco_m2_mercado, preco_pedido,
  } = imovel

  const eMercado = isMercadoDireto(imovel.fonte_url, imovel.tipo_transacao)
  const area     = parseFloat(area_privativa_m2 || area_m2) || 97
  const avaliacao = parseFloat(valor_avaliacao) || parseFloat(valor_mercado_estimado) || parseFloat(valor_minimo) || 550000
  const precoBase = parseFloat(preco_pedido || valor_minimo) || avaliacao * 0.675
  const lance1   = precoBase

  // Lances dos cenários
  const lance2piso  = Math.round(avaliacao * 0.35)
  const lance2exp   = Math.round(avaliacao * 0.50)
  const lance2comp  = Math.round(avaliacao * 0.65)

  // Custo de reforma por cenário — via context useReforma (unificado)
  const reformaValor = reformas[cenarioReforma]

  // Valor de mercado: usar homogeneizado se disponível
  const vmBase = parseFloat(valor_mercado_homogenizado || valor_mercado_estimado) || avaliacao * 1.05
  const vmercado = vmBase

  // Fator de homogeneização para ALUGUEL (impacto diferente da venda)
  const FATORES_ALUGUEL = {
    sem_elevador: 0.85,   // -15% no aluguel (maior impacto que na venda)
    sem_piscina:  0.98,   // -2%
    sem_lazer:    0.96,   // -4%
    sem_salao:    0.98,   // -2%
    vaga_0:       0.88,   // sem vaga = -12% no aluguel
    vaga_2:       1.04,   // 2ª vaga = +4%
    mobiliado:    1.15,   // mobiliado = +15%
    semi_mobiliado: 1.08, // semi-mobiliado = +8%
  }

  // Calcular fator de impacto no aluguel por atributos
  const fatorAluguel = useMemo(() => {
    let f = 1.0
    if (elevador === false) f *= FATORES_ALUGUEL.sem_elevador
    if (piscina === false)  f *= FATORES_ALUGUEL.sem_piscina
    if (area_lazer === false) f *= FATORES_ALUGUEL.sem_lazer
    if (salao_festas === false) f *= FATORES_ALUGUEL.sem_salao
    if ((vagas || 0) === 0) f *= FATORES_ALUGUEL.vaga_0
    if ((vagas || 0) >= 2) f *= FATORES_ALUGUEL.vaga_2
    // Mobiliado: verificar campo do imóvel
    if (imovel.mobiliado === true || imovel.mobiliado === 'sim') f *= FATORES_ALUGUEL.mobiliado
    else if (imovel.mobiliado === 'semi' || imovel.semi_mobiliado === true) f *= FATORES_ALUGUEL.semi_mobiliado
    return f
  }, [elevador, piscina, area_lazer, salao_festas, vagas, imovel.mobiliado, imovel.semi_mobiliado])

  // Aluguel base com homogeneização aplicada
  const aluguelBase = parseFloat(aluguel_mensal_estimado) || 3200
  const aluguelHomogeneizado = Math.round(aluguelBase * fatorAluguel)

  const aluguelMap = {
    basica:   parseFloat(aluguel_sem_reforma) || Math.round(aluguelHomogeneizado * 0.90),
    media:    parseFloat(aluguel_com_reforma) || aluguelHomogeneizado,
    completa: (parseFloat(aluguel_com_reforma) || aluguelHomogeneizado) * 1.10,
  }
  const aluguelAtual = Math.round(aluguelMap[cenarioReforma]) || 3200

  // Calcular fator de homogeneização real
  const fatorCalc = useMemo(() => {
    let f = 1.0
    if (elevador === false) f *= FATORES_ATRIBUTOS.sem_elevador
    if (piscina === false)  f *= FATORES_ATRIBUTOS.sem_piscina
    if (area_lazer === false) f *= FATORES_ATRIBUTOS.sem_lazer
    if (salao_festas === false) f *= FATORES_ATRIBUTOS.sem_salao
    if ((vagas || 0) === 0) f *= FATORES_ATRIBUTOS.vaga_0
    return parseFloat(fator_homogenizacao) || f
  }, [elevador, piscina, area_lazer, salao_festas, vagas, fator_homogenizacao])

  // Cenários de lance — adaptado para leilão ou mercado direto
  const cenarios = eMercado ? [
    { titulo: `Preço pedido (${((lance1/avaliacao)*100).toFixed(0)}% do mercado)`, lance: lance1, leilao: null, isMercado: true },
    { titulo: `Negociação conservadora (-5%)`, lance: Math.round(lance1 * 0.95), leilao: null, isMercado: true },
    { titulo: `Negociação agressiva (-10%)`,   lance: Math.round(lance1 * 0.90), leilao: null, isMercado: true },
    { titulo: `Oferta mínima (-15%)`,          lance: Math.round(lance1 * 0.85), leilao: null, isMercado: true },
  ] : [
    { titulo: `Lance mínimo 1º leilão (${((lance1/avaliacao)*100).toFixed(0)}%)`, lance: lance1, leilao: num_leilao || 1 },
    { titulo: `Piso legal 2º leilão (35%)`, lance: lance2piso, leilao: 2 },
    { titulo: `Esperado 2º leilão (50%)`,   lance: lance2exp,  leilao: 2 },
    { titulo: `Competitivo 2º leilão (65%)`,lance: lance2comp, leilao: 2 },
  ]

  const melhoresCenarios = cenarios.map(c => {
    const desc = ((avaliacao - c.lance) / avaliacao * 100)
    const f = calcFlip(c.lance, vmercado, reformaValor)
    const l = calcLocacao(c.lance, aluguelAtual, reformaValor, vmercado)
    const p = c.isMercado ? { prob: 1.0, label: '—', cor: GREEN } : probArrematacao(desc, c.leilao)
    return { ...c, desc, flip: f, loc: l, prob: p }
  })

  const melhorFlip = [...melhoresCenarios].sort((a,b) => b.flip.roi - a.flip.roi)[0]
  const melhorLoc  = [...melhoresCenarios].sort((a,b) => b.loc.yieldLiq - a.loc.yieldLiq)[0]

  const TabBtn = ({ id, label }) => (
    <button onClick={() => setCenarioReforma(id)} style={{
      padding:'5px 10px', borderRadius:5, border:`1px solid ${C.borderW}`,
      background: cenarioReforma===id ? C.navy : '#fff',
      color: cenarioReforma===id ? '#fff' : C.navy,
      fontSize:10, fontWeight:700, cursor:'pointer'
    }}>{label}</button>
  )

  return (
    <div style={{ ...card(), padding:12 }}>
      {/* Header */}
      <div style={{ marginBottom:10 }}>
        <div style={{ fontSize:13, fontWeight:700, color:C.navy, marginBottom:4 }}>
          {eMercado ? '🏠 Oportunidade de Compra' : '📊 Rentabilidade'} — Flip vs Locação
        </div>
        <div style={{ fontSize:10, color:C.muted }}>
          Mercado ref.: {fmt(vmercado)}
          {fatorCalc < 1 && <span style={{ color:GOLD }}> · fator homog. {(fatorCalc*100).toFixed(0)}% (atributos)</span>}
        </div>
      </div>

      {/* Atributos do imóvel */}
      <div style={{ marginBottom:10 }}>
        <div onClick={() => setMostrarAtributos(!mostrarAtributos)}
          style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', marginBottom: mostrarAtributos ? 8 : 0 }}>
          <span style={{ fontSize:10, fontWeight:700, color:C.navy, textTransform:'uppercase', letterSpacing:.4 }}>
            🏗️ Atributos do imóvel
          </span>
          <span style={{ fontSize:10, color:C.muted }}>{mostrarAtributos ? '▲' : '▼'}</span>
        </div>
        {mostrarAtributos && (
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', padding:'8px 10px',
            background:C.surface, borderRadius:7, border:`1px solid ${C.borderW}` }}>
            {[
              ['Elevador', elevador, -15],
              ['Piscina', piscina, -3],
              ['Área lazer', area_lazer, -5],
              ['Salão festas', salao_festas, -3],
            ].map(([nome, val, impacto]) => (
              <div key={nome} style={{ padding:'4px 8px', borderRadius:5,
                background: val ? '#ECFDF5' : '#FEF9C3',
                border:`1px solid ${val ? '#A7F3D0' : '#FDE047'}` }}>
                <span style={{ fontSize:10, fontWeight:600, color: val ? GREEN : GOLD }}>
                  {val ? '✓' : '✗'} {nome}
                </span>
                {!val && <span style={{ fontSize:9, color:GOLD }}> ({impacto}%)</span>}
              </div>
            ))}
            <div style={{ padding:'4px 8px', borderRadius:5, background:'#EFF6FF', border:'1px solid #BFDBFE' }}>
              <span style={{ fontSize:10, fontWeight:600, color:'#1D4ED8' }}>
                🅿 {vagas || 0} vaga(s)
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Seletor de cenário de reforma */}
      <div style={{ marginBottom:10 }}>
        <div style={{ fontSize:10, color:C.muted, marginBottom:5 }}>Cenário de reforma:</div>
        <div style={{ display:'flex', gap:5 }}>
          <TabBtn id="basica"   label={`🪣 Básica ${fmt(reformas.basica)}`}/>
          <TabBtn id="media"    label={`🔧 Média ${fmt(reformas.media)}`}/>
          <TabBtn id="completa" label={`✨ Completa ${fmt(reformas.completa)}`}/>
        </div>
      </div>

      {/* Cards por cenário de lance */}
      {melhoresCenarios.map((c, i) => (
        <CardLance key={i}
          titulo={c.titulo} lance={c.lance} avaliacao={avaliacao}
          vmercado={vmercado} flip={c.flip} loc={c.loc} prob={c.prob}
          destaque={c.lance === melhorFlip.lance || c.lance === melhorLoc.lance}
        />
      ))}

      {/* Resumo final */}
      <div style={{ padding:'10px 12px', borderRadius:8, marginTop:4,
        background:'#F0F4FF', border:'1px solid #C7D4F8' }}>
        <div style={{ fontSize:10, fontWeight:700, color:'#2D4A9A', marginBottom:6, textTransform:'uppercase', letterSpacing:.4 }}>
          💡 Recomendação
        </div>
        <div style={{ fontSize:11, color:'#1E3A8A', lineHeight:1.6 }}>
          <strong>Melhor para flip:</strong> {melhorFlip.titulo} → ROI {pct(melhorFlip.flip.roi)}<br/>
          <strong>Melhor para locação:</strong> {melhorLoc.titulo} → Yield {pct(melhorLoc.loc.yieldLiq)}<br/>
          {melhorFlip.flip.roi > melhorLoc.loc.yieldLiq * 3
            ? <span style={{ color:GREEN }}>→ Flip é mais atrativo neste cenário.</span>
            : <span style={{ color:'#1D4ED8' }}>→ Locação oferece melhor equilíbrio de risco.</span>
          }
        </div>
      </div>

      {/* Impacto dos atributos no aluguel */}
      {fatorAluguel < 0.99 && (
        <div style={{ marginTop:8, padding:'8px 12px', borderRadius:7,
          background:'#FFF8E1', border:'1px solid #FFE082' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#92400E', marginBottom:4 }}>
            📉 Impacto no aluguel: {((1 - fatorAluguel) * 100).toFixed(0)}% abaixo do padrão
          </div>
          <div style={{ fontSize:10, color:'#78350F', lineHeight:1.5 }}>
            {elevador === false && <span>Sem elevador (-15%) · </span>}
            {piscina === false && <span>Sem piscina (-2%) · </span>}
            {area_lazer === false && <span>Sem lazer (-4%) · </span>}
            {(vagas || 0) === 0 && <span>Sem vaga (-12%) · </span>}
            Aluguel ajustado: <strong>{fmt(aluguelHomogeneizado)}/mês</strong> (base: {fmt(aluguelBase)})
          </div>
        </div>
      )}

      {/* Comparação com Leilão — só para mercado direto */}
      {eMercado && (
        <div style={{ marginTop:8, padding:'10px 12px', borderRadius:8,
          background:'#FFF1F2', border:'1px solid #FECDD3' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#9F1239', marginBottom:6, textTransform:'uppercase', letterSpacing:.4 }}>
            🔍 Comparação: Mercado vs Leilão
          </div>
          <div style={{ fontSize:11, color:'#881337', lineHeight:1.7 }}>
            <strong>Preço pedido:</strong> {fmt(precoBase)} ({area ? `R$ ${Math.round(precoBase/area).toLocaleString('pt-BR')}/m²` : '—'})<br/>
            <strong>Em leilão judicial (2º leilão, ~50% av.):</strong> imóvel similar custaria ~{fmt(Math.round(vmercado * 0.50))}<br/>
            <strong>Economia potencial:</strong>{' '}
            <span style={{ fontWeight:700, color:'#065F46' }}>
              {fmt(Math.round(precoBase - vmercado * 0.50))} ({Math.round((1 - vmercado * 0.50 / precoBase) * 100)}% menos)
            </span>
          </div>
          <div style={{ marginTop:6, fontSize:10, color:'#6B7280', lineHeight:1.5, borderTop:'1px solid #FECDD3', paddingTop:6 }}>
            ⚠️ Leilão envolve riscos jurídicos, prazo de desocupação e custos extras (comissão 5%, ITBI, advogado).
            Para este preço ({fmt(precoBase)}), busque leilões no mesmo bairro ou região com tipologia similar ({imovel.tipo || 'Apartamento'}, {area ? `~${area}m²` : ''}).
          </div>
        </div>
      )}

      {/* Nota */}
      <div style={{ marginTop:8, fontSize:9, color:C.hint, lineHeight:1.5 }}>
        Homogeneização venda: sem elevador -15% · sem piscina -3% · sem lazer -5% · sem vaga -10% (NBR 14653/IBAPE).
        Homogeneização aluguel: sem elevador -15% · sem vaga -12% · mobiliado +15%.
        Yield líquido considera vacância 6%, manutenção 0,5% a.a. Flip: IRPF 15%, corretagem 6%, ITBI 3%.
        Fator aplicado sobre preço de anúncio — NÃO sobre preço de contrato (evita dupla penalização).
      </div>
    </div>
  )
}
