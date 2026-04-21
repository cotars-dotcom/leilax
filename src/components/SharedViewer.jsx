/**
 * AXIS — Viewer Público Completo (Sprint 15B)
 * Exibe análise completa de um imóvel via link de compartilhamento sem login.
 * Rota: /#/share/:token
 */
import { useState, useEffect } from 'react'
import { getImovelPorToken } from '../lib/supabase.js'
import { isMercadoDireto } from '../lib/detectarFonte.js'
import { calcularBreakdownFinanceiro, calcularROI, HOLDING_MESES_PADRAO, IPTU_SOBRE_CONDO_RATIO, calcularFatorHomogeneizacao } from '../lib/constants.js'
import { CUSTO_M2_SINAPI, FATOR_VALORIZACAO, detectarClasse, avaliarViabilidadeReforma } from '../lib/reformaUnificada.js'

const fmt = v => v ? `R$ ${Math.round(v).toLocaleString('pt-BR')}` : '—'

const C = {
  navy: '#002B80', emerald: '#05A86D', red: '#E5484D', amber: '#D4A017',
  bg: '#F4F3EF', white: '#FFFFFF', border: '#E8E6DF', text: '#1A1A2E',
  muted: '#8E8EA0', purple: '#7C3AED', orange: '#EA580C',
}
const card = (extra = {}) => ({ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px', marginBottom: 14, ...extra })
const secTitle = (text, icon) => <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 10 }}>{icon} {text}</div>

function ScoreBar({ label, value, peso }) {
  const c = value >= 7 ? '#065F46' : value >= 5 ? '#92400E' : '#991B1B'
  return (
    <div style={{ marginBottom: 7 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
        <span style={{ color: C.muted }}>{label} <span style={{ fontSize: 9, color: '#ccc' }}>({peso}%)</span></span>
        <span style={{ fontWeight: 700, color: c }}>{(value || 0).toFixed(1)}</span>
      </div>
      <div style={{ height: 5, background: `${c}15`, borderRadius: 3, marginTop: 2 }}>
        <div style={{ height: '100%', width: `${Math.min(100, ((value||0) / 10) * 100)}%`, background: c, borderRadius: 3 }} />
      </div>
    </div>
  )
}
function KPI({ label, value, cor, sub }) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ fontSize: 9.5, color: C.muted, textTransform: 'uppercase', letterSpacing: '.3px' }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: cor || C.text, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: C.muted, marginTop: 1 }}>{sub}</div>}
    </div>
  )
}
function Row({ label, value, cor, bold }) {
  if (!value || value === '—') return null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f5f5f5', fontSize: 12 }}>
      <span style={{ color: C.muted }}>{label}</span>
      <span style={{ fontWeight: bold ? 700 : 600, color: cor || C.text, textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  )
}

export default function SharedViewer({ token }) {
  const [imovel, setImovel] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [fotoAtiva, setFotoAtiva] = useState(0)

  useEffect(() => {
    (async () => {
      try {
        const data = await getImovelPorToken(token)
        if (!data) setErro('Link inválido ou expirado.')
        else if (data.expirado) setErro('Este link expirou.')
        else setImovel(data)
      } catch { setErro('Erro ao carregar.') }
      setLoading(false)
    })()
  }, [token])

  if (loading) return <div style={{ display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:C.bg }}><div style={{textAlign:'center'}}><div style={{fontSize:32,marginBottom:12}}>⏳</div><div style={{color:C.muted,fontSize:14}}>Carregando análise...</div></div></div>
  if (erro) return <div style={{ display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:C.bg }}><div style={{textAlign:'center',maxWidth:400,padding:40}}><div style={{fontSize:48,marginBottom:16}}>🔒</div><div style={{fontSize:16,fontWeight:600,color:C.text,marginBottom:8}}>{erro}</div><div style={{fontSize:12,color:C.muted}}>AXIS IP</div></div></div>

  const p = imovel
  const eMercado = isMercadoDireto(p.fonte_url, p.tipo_transacao)
  const area = parseFloat(p.area_privativa_m2 || p.area_m2) || 0
  const lance = parseFloat(p.preco_pedido || p.valor_minimo) || 0
  const mercadoRaw = parseFloat(p.valor_mercado_estimado) || 0
  const aluguel = parseFloat(p.aluguel_mensal_estimado) || 0
  const homoSV = calcularFatorHomogeneizacao(p, mercadoRaw)
  const mercado = homoSV.valorAjustado || mercadoRaw
  const bd = calcularBreakdownFinanceiro(lance, p, eMercado)
  const roi = calcularROI(bd.investimentoTotal, mercado, aluguel)
  const condoMensal = parseFloat(p.condominio_mensal || 0)
  const iptuMensal = parseFloat(p.iptu_mensal || 0) || (condoMensal > 0 ? Math.round(condoMensal * IPTU_SOBRE_CONDO_RATIO) : 0)
  const holdingMensal = condoMensal + iptuMensal
  const holdingTotal = HOLDING_MESES_PADRAO * holdingMensal
  const recBg = p.recomendacao === 'COMPRAR' ? '#ECFDF5' : p.recomendacao === 'EVITAR' ? '#FEF2F2' : '#FEF9C3'
  const recCor = p.recomendacao === 'COMPRAR' ? '#065F46' : p.recomendacao === 'EVITAR' ? '#991B1B' : '#92400E'
  const scoreCor = (p.score_total||0) >= 7 ? '#065F46' : (p.score_total||0) >= 5 ? '#92400E' : '#991B1B'

  const classe = detectarClasse(parseFloat(p.preco_m2_mercado) || 7000)
  const viab = avaliarViabilidadeReforma(mercado, lance, area, parseFloat(p.preco_m2_mercado) || 7000)
  const reformas = ['refresh_giro','leve_reforcada_1_molhado','pesada'].map((esc,i) => {
    const custoM2 = CUSTO_M2_SINAPI[esc]?.[classe] || 0
    const custo = parseFloat(p[['custo_reforma_basica','custo_reforma_media','custo_reforma_completa'][i]]) || Math.round(area * custoM2)
    const fv = FATOR_VALORIZACAO[esc] || 1
    return { label: ['Básica','Média','Completa'][i], custo, custoM2, valorizacao: Math.round((fv-1)*100) }
  })
  const homo = homoSV  // computed above with mercado ajustado

  const fotos = [...new Set([p.foto_principal,...(p.fotos||[])].filter(f => f && !f.includes('{action}')))]
  const respDebitos = p.responsabilidade_debitos === 'sub_rogado' ? '✅ Sub-rogados no preço' : p.responsabilidade_debitos === 'exonerado' ? '✅ Exonerado' : p.responsabilidade_debitos === 'arrematante' ? '⚠️ Arrematante arca' : p.responsabilidade_debitos
  const estratLabel = p.estrategia_recomendada === 'aguardar_2a_praca' ? 'Aguardar 2ª praça' : p.estrategia_recomendada === 'flip' ? 'Flip' : p.estrategia_recomendada === 'locacao' ? 'Locação' : p.estrategia_recomendada

  let countdown = null
  if (p.data_leilao && !eMercado) {
    const [y,m,d] = p.data_leilao.split('-').map(Number)
    const dl = new Date(y,m-1,d); dl.setHours(0,0,0,0)
    const hoje = new Date(); hoje.setHours(0,0,0,0)
    const diff = Math.round((dl - hoje) / 86400000)
    if (diff >= 0) countdown = diff === 0 ? 'HOJE' : diff === 1 ? 'AMANHÃ' : `D-${diff}`
  }

  return (
    <div style={{ background: C.bg, minHeight: '100vh', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" }}>
      <header style={{ background: C.navy, padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display:'flex',alignItems:'center',gap:10 }}>
          <span style={{ fontSize:18,fontWeight:800,color:'#fff',letterSpacing:-1 }}>AXIS IP</span>
          <span style={{ fontSize:10,color:'#ffffff80' }}>Análise Compartilhada</span>
        </div>
        <div style={{ textAlign:'right' }}>
          {p.codigo_axis && <span style={{ fontSize:13,fontWeight:700,color:'#fff' }}>{p.codigo_axis}</span>}
          {countdown && <span style={{ fontSize:10,color:'#FBBF24',marginLeft:8,fontWeight:600 }}>🔨 {countdown}</span>}
        </div>
      </header>

      <div style={{ maxWidth: 820, margin: '0 auto', padding: '20px 16px' }}>
        {/* FOTO */}
        {fotos.length > 0 && <div style={{ marginBottom: 14 }}>
          <div style={{ borderRadius:12,overflow:'hidden',maxHeight:320,background:'#f3f4f6' }}>
            <img src={fotos[fotoAtiva]||fotos[0]} alt="" referrerPolicy="no-referrer" style={{ width:'100%',height:320,objectFit:'cover',display:'block' }}
              onError={e => { e.target.src = `https://wsrv.nl/?url=${encodeURIComponent(fotos[fotoAtiva]||fotos[0])}&w=800&q=75` }} />
          </div>
          {fotos.length > 1 && <div style={{ display:'flex',gap:6,marginTop:8,overflowX:'auto',paddingBottom:4 }}>
            {fotos.slice(0,8).map((f,i) => <img key={i} src={f} alt="" referrerPolicy="no-referrer" onClick={() => setFotoAtiva(i)}
              style={{ width:72,height:48,objectFit:'cover',borderRadius:6,cursor:'pointer',flexShrink:0, border: i===fotoAtiva ? `2px solid ${C.navy}` : '2px solid transparent', opacity: i===fotoAtiva?1:0.7 }}
              onError={e => { e.target.style.display='none' }} />)}
          </div>}
        </div>}

        {/* TÍTULO */}
        <div style={card()}>
          <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:16,flexWrap:'wrap' }}>
            <div style={{ flex:1,minWidth:200 }}>
              <div style={{ display:'flex',gap:6,alignItems:'center',marginBottom:6,flexWrap:'wrap' }}>
                <span style={{ fontSize:11,fontWeight:700,color:recCor,background:recBg,padding:'2px 8px',borderRadius:4 }}>{p.recomendacao==='COMPRAR'?'✅':p.recomendacao==='EVITAR'?'❌':'⏳'} {p.recomendacao||'AGUARDAR'}</span>
                <span style={{ fontSize:10,padding:'2px 8px',borderRadius:4,background:eMercado?'#EFF6FF':'#ECFDF5',color:eMercado?'#1D4ED8':'#065F46',fontWeight:600 }}>{eMercado?'🏠 Mercado':`🔨 ${p.num_leilao||1}ª Praça`}</span>
                {p.ocupacao && <span style={{ fontSize:10,padding:'2px 8px',borderRadius:4,background:p.ocupacao.toLowerCase().includes('desocup')?'#ECFDF5':'#FEF2F2',color:p.ocupacao.toLowerCase().includes('desocup')?'#065F46':'#991B1B',fontWeight:600 }}>{p.ocupacao}</span>}
                {estratLabel && <span style={{ fontSize:10,padding:'2px 8px',borderRadius:4,background:'#F0F4FF',color:C.navy,fontWeight:600 }}>{estratLabel}</span>}
              </div>
              <h1 style={{ margin:0,fontSize:17,fontWeight:700,color:C.text,lineHeight:1.3 }}>{p.titulo||'Imóvel'}</h1>
              <div style={{ fontSize:12,color:C.muted,marginTop:4 }}>📍 {p.endereco ? p.endereco+' — ':''}{p.bairro}{p.cidade?`, ${p.cidade}`:''}{p.estado?`/${p.estado}`:''}</div>
              <div style={{ fontSize:11,color:C.text,marginTop:4 }}>{[area?`${area}m²`:null,p.quartos?`${p.quartos}q`:null,p.suites?`${p.suites}s`:null,p.vagas?`${p.vagas}v`:null,p.condominio_mensal?`Cond. ${fmt(p.condominio_mensal)}`:null,p.nome_condominio].filter(Boolean).join(' · ')}</div>
              {p.data_leilao && !eMercado && <div style={{ fontSize:11,color:C.navy,marginTop:4,fontWeight:600 }}>📅 Leilão: {new Date(p.data_leilao+'T12:00').toLocaleDateString('pt-BR')} {countdown ? `(${countdown})` : ''}</div>}
            </div>
            <div style={{ textAlign:'center',flexShrink:0 }}>
              <div style={{ fontSize:36,fontWeight:800,color:scoreCor,lineHeight:1 }}>{(p.score_total||0).toFixed(1)}</div>
              <div style={{ fontSize:9,color:C.muted,textTransform:'uppercase' }}>Score AXIS</div>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(145px,1fr))',gap:8,marginBottom:14 }}>
          <KPI label={eMercado?'Preço Pedido':'Lance Mínimo'} value={fmt(lance)} cor="#C2410C" />
          <KPI label="Mercado Est." value={fmt(mercado)} cor={C.navy} />
          <KPI label="Aluguel Est." value={aluguel?`${fmt(aluguel)}/mês`:'—'} cor={C.purple} />
          <KPI label="Desconto" value={p.desconto_sobre_mercado_pct_calculado ? `${p.desconto_sobre_mercado_pct_calculado}%` : '—'} cor="#065F46" />
          <KPI label="Investimento Total" value={fmt(bd.investimentoTotal)} cor={C.navy} sub={`Custos ${bd.pctCustosSobreLance}% + holding${bd.debitosArrematante > 0 ? ' + débitos' : ''}`} />
          {roi.roi!=null && !roi.invalido && <KPI label="ROI Estimado" value={`${roi.roi>0?'+':''}${roi.roi}%`} cor={roi.roi>0?'#065F46':'#991B1B'} />}
          {roi.locacao && <KPI label="Yield Bruto" value={`${roi.locacao.yieldAnual}% a.a.`} cor="#065F46" sub={`Payback ${Math.round(roi.locacao.paybackMeses/12)}a`} />}
          <KPI label="R$/m² Imóvel" value={p.preco_m2_imovel?`R$ ${Math.round(p.preco_m2_imovel).toLocaleString('pt-BR')}`:'—'} />
          <KPI label="R$/m² Mercado" value={p.preco_m2_mercado?`R$ ${Math.round(p.preco_m2_mercado).toLocaleString('pt-BR')}`:'—'} />
        </div>

        {/* SCORES 6D */}
        <div style={card()}>{secTitle('Score 6D','📊')}
          <ScoreBar label="Localização" value={p.score_localizacao} peso={20} />
          <ScoreBar label="Desconto" value={p.score_desconto} peso={18} />
          <ScoreBar label="Jurídico" value={p.score_juridico} peso={18} />
          <ScoreBar label="Ocupação" value={p.score_ocupacao} peso={15} />
          <ScoreBar label="Liquidez" value={p.score_liquidez} peso={15} />
          <ScoreBar label="Mercado" value={p.score_mercado} peso={14} />
        </div>

        {/* SÍNTESE */}
        {p.sintese_executiva && <div style={card({background:'#F0F4FF',borderColor:'#C7D4F8'})}>{secTitle('Síntese Executiva','📋')}<div style={{ fontSize:12.5,color:C.text,lineHeight:1.65,whiteSpace:'pre-wrap' }}>{p.sintese_executiva}</div></div>}

        {/* ALERTAS */}
        {p.alertas?.length > 0 && <div style={card({background:'#FFFBEB',borderColor:'#FDE68A'})}>{secTitle('Alertas','🚨')}
          {(typeof p.alertas==='string'?JSON.parse(p.alertas):p.alertas).slice(0,8).map((a,i) => {
            const txt = typeof a==='string'?a:a.texto||''
            return <div key={i} style={{ fontSize:11.5,color:'#78350F',marginBottom:4,lineHeight:1.5 }}>• {txt}</div>
          })}
        </div>}

        {/* INVESTIMENTO */}
        {lance > 0 && <div style={card()}>{secTitle('Análise de Investimento','💰')}
          <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:16 }}>
            <div>
              <div style={{ fontSize:11,fontWeight:700,color:C.navy,marginBottom:6,textTransform:'uppercase',letterSpacing:'.3px' }}>Custos de Aquisição</div>
              <Row label={eMercado?'Preço pedido':'Lance mínimo'} value={fmt(lance)} />
              {!eMercado && bd.comissao.valor>0 && <Row label={`Comissão (${(bd.comissao.pct*100).toFixed(0)}%)`} value={fmt(bd.comissao.valor)} />}
              <Row label={`ITBI (${(bd.itbi.pct*100).toFixed(0)}%)`} value={fmt(bd.itbi.valor)} />
              <Row label="Doc + Registro" value={fmt(bd.documentacao.valor)} />
              {!eMercado && bd.advogado.valor>0 && <Row label={`Advogado (${(bd.advogado.pct*100).toFixed(0)}%)`} value={fmt(bd.advogado.valor)} />}
              {bd.reforma>0 && <Row label="Reforma estimada" value={fmt(bd.reforma)} cor="#D97706" />}
              {holdingTotal>0 && <Row label={`Holding (${HOLDING_MESES_PADRAO}m)`} value={fmt(holdingTotal)} cor={C.orange} />}
              <div style={{ borderTop:`2px solid ${C.navy}`,marginTop:4,paddingTop:6 }}><Row label="INVESTIMENTO TOTAL" value={fmt(bd.investimentoTotal+holdingTotal)} cor={C.navy} bold /></div>
            </div>
            <div>
              <div style={{ fontSize:11,fontWeight:700,color:C.navy,marginBottom:6,textTransform:'uppercase',letterSpacing:'.3px' }}>Cenários de Saída</div>
              {roi.cenarios && ['otimista','realista','vendaRapida'].map(key => {
                const c = roi.cenarios[key]; if(!c) return null
                const lb = key==='otimista'?'📈 Otimista (+15%)':key==='realista'?'📊 Realista':'⚡ Venda rápida (-10%)'
                return <div key={key} style={{ display:'flex',justifyContent:'space-between',padding:'8px 10px',borderRadius:8,marginBottom:4,background:c.roi>=0?'#065F4608':'#991B1B08',border:`1px solid ${c.roi>=0?'#065F4620':'#991B1B20'}` }}>
                  <div><div style={{ fontSize:10,color:C.muted }}>{lb}</div><div style={{ fontSize:12,fontWeight:700 }}>{fmt(c.valor)}</div></div>
                  <div style={{ fontSize:14,fontWeight:800,color:c.roi>=0?'#065F46':'#991B1B',alignSelf:'center' }}>{c.roi>0?'+':''}{c.roi}%</div>
                </div>
              })}
              {roi.locacao && <div style={{ padding:'8px 10px',borderRadius:8,marginTop:6,background:'#F0FDF4',border:'1px solid #BBF7D020' }}>
                <div style={{ fontSize:10,color:'#065F46',fontWeight:600 }}>🏠 Locação</div>
                <div style={{ display:'flex',justifyContent:'space-between',marginTop:4,fontSize:11 }}>
                  <span>{fmt(roi.locacao.aluguelMensal)}/mês</span>
                  <span style={{ fontWeight:700,color:'#065F46' }}>{roi.locacao.yieldAnual}% yield</span>
                  <span>{Math.round(roi.locacao.paybackMeses/12)}a payback</span>
                </div>
              </div>}
            </div>
          </div>
        </div>}

        {/* REFORMA */}
        {reformas[0].custo > 0 && <div style={card()}>{secTitle('Cenários de Reforma (SINAPI-MG 2026)','🔧')}
          <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:8 }}>
            {reformas.map((r,i) => {
              const ct = lance+bd.totalCustos+r.custo+holdingTotal
              const rr = ct>0?Math.round((mercado*(1+r.valorizacao/100)-ct)/ct*100):0
              return <div key={i} style={{ padding:12,borderRadius:10,border:`1px solid ${C.border}`,textAlign:'center',background:i===0?'#F0F4FF':C.white }}>
                <div style={{ fontSize:11,color:C.muted,fontWeight:600 }}>{r.label}</div>
                <div style={{ fontSize:18,fontWeight:800,color:C.navy,margin:'4px 0' }}>{fmt(r.custo)}</div>
                <div style={{ fontSize:9,color:C.muted }}>R$ {r.custoM2}/m² · +{r.valorizacao}%</div>
                <div style={{ fontSize:10,fontWeight:700,marginTop:6,padding:'2px 8px',borderRadius:5,display:'inline-block',background:rr>10?'#ECFDF5':rr>0?'#FEF9C3':'#FEF2F2',color:rr>10?'#065F46':rr>0?'#92400E':'#991B1B' }}>ROI {rr>0?'+':''}{rr}%</div>
              </div>
            })}
          </div>
        </div>}

        {/* JURÍDICO */}
        {(p.processos_ativos||p.matricula_status||p.obs_juridicas) && <div style={card()}>{secTitle('Análise Jurídica','⚖️')}
          <Row label="Processo" value={p.processo_numero||(p.processos_ativos?String(p.processos_ativos).substring(0,100):null)} />
          <Row label="Vara" value={p.vara_judicial} />
          <Row label="Tribunal" value={p.tipo_justica} />
          <Row label="Matrícula" value={p.matricula_status} />
          <Row label="Responsab. débitos" value={respDebitos} />
          <Row label="Déb. condomínio" value={p.debitos_condominio} />
          <Row label="Déb. IPTU" value={p.debitos_iptu} />
          <Row label="Pagamento" value={p.parcelamento_aceito===false?'Exclusivamente à vista':p.parcelamento_aceito?'Parcelamento aceito':null} />
          {!eMercado && <Row label="Comissão leiloeiro" value={p.comissao_leiloeiro_pct?`${p.comissao_leiloeiro_pct}%`:null} />}
          {p.obs_juridicas && <div style={{ marginTop:8,padding:'10px 12px',background:'#FEF9C3',borderRadius:8,fontSize:11,lineHeight:1.6,color:'#92400E' }}><div style={{ fontWeight:700,marginBottom:4 }}>Observações Jurídicas</div>{p.obs_juridicas}</div>}
        </div>}

        {/* MERCADO */}
        <div style={card()}>{secTitle('Análise de Mercado','📈')}
          <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:16 }}>
            <div>
              <Row label="Tendência" value={p.mercado_tendencia} />
              <Row label="Demanda" value={p.mercado_demanda} />
              <Row label="Liquidez" value={p.liquidez} />
              <Row label="Tempo revenda" value={p.prazo_revenda_meses?`${p.prazo_revenda_meses} meses`:null} />
              {p.mercado_obs && <div style={{ fontSize:10,color:C.muted,marginTop:6,lineHeight:1.5 }}>{p.mercado_obs}</div>}
            </div>
            {p._dados_bairro_axis && <div>
              <div style={{ fontSize:11,fontWeight:700,color:'#0369A1',marginBottom:6 }}>Dados AXIS — {p._dados_bairro_axis.label||p.bairro}</div>
              <Row label="Classe IPEAD" value={p._dados_bairro_axis.classeIpeadLabel} />
              <Row label="Preço contrato QA" value={p._dados_bairro_axis.precoContratoM2?`R$ ${p._dados_bairro_axis.precoContratoM2.toLocaleString('pt-BR')}/m²`:null} />
              <Row label="Yield bruto" value={p._dados_bairro_axis.yieldBruto?`${p._dados_bairro_axis.yieldBruto}% a.a.`:null} />
              <Row label="Tendência 12m" value={p._dados_bairro_axis.tendencia12m!=null?`+${p._dados_bairro_axis.tendencia12m}%`:null} />
            </div>}
          </div>
        </div>

        {/* COMPARÁVEIS */}
        {p.comparaveis?.length > 0 && <div style={card()}>{secTitle(`Comparáveis (${p.comparaveis.length})`,'🏘️')}
          {(typeof p.comparaveis==='string'?JSON.parse(p.comparaveis):p.comparaveis).slice(0,6).map((c,i) => (
            <div key={i} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:i<Math.min(p.comparaveis.length,6)-1?'1px solid #f5f5f5':'none' }}>
              <div><div style={{ fontSize:11,fontWeight:600,color:C.navy }}>{c.descricao||c.endereco||'—'}</div>
              <div style={{ fontSize:10,color:C.muted }}>{[c.area_m2?`${c.area_m2}m²`:null,c.quartos?`${c.quartos}q`:null,c.preco_m2?`R$ ${Math.round(c.preco_m2).toLocaleString('pt-BR')}/m²`:null].filter(Boolean).join(' · ')}</div></div>
              <div style={{ fontSize:13,fontWeight:700,color:C.emerald,flexShrink:0 }}>{c.valor?fmt(c.valor):'—'}</div>
            </div>
          ))}
        </div>}

        {/* POSITIVOS / NEGATIVOS */}
        <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:10,marginBottom:14 }}>
          {p.positivos?.length > 0 && <div style={{ background:'#ECFDF5',border:'1px solid #A7F3D0',borderRadius:10,padding:'12px 14px' }}>
            <div style={{ fontSize:11,fontWeight:700,color:'#065F46',marginBottom:6 }}>✅ Pontos Fortes</div>
            {(typeof p.positivos==='string'?JSON.parse(p.positivos):p.positivos).slice(0,5).map((x,i) => <div key={i} style={{ fontSize:11.5,color:'#064E3B',marginBottom:3,lineHeight:1.5 }}>• {x}</div>)}
          </div>}
          {p.negativos?.length > 0 && <div style={{ background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:10,padding:'12px 14px' }}>
            <div style={{ fontSize:11,fontWeight:700,color:'#991B1B',marginBottom:6 }}>⚠️ Pontos de Atenção</div>
            {(typeof p.negativos==='string'?JSON.parse(p.negativos):p.negativos).slice(0,5).map((x,i) => <div key={i} style={{ fontSize:11.5,color:'#7F1D1D',marginBottom:3,lineHeight:1.5 }}>• {x}</div>)}
          </div>}
        </div>

        {/* JUSTIFICATIVA */}
        {p.justificativa && <div style={card()}>{secTitle('Justificativa','💬')}<div style={{ fontSize:12,color:C.text,lineHeight:1.65,whiteSpace:'pre-wrap' }}>{p.justificativa}</div></div>}

        {/* ATRIBUTOS + HOMOGENEIZAÇÃO */}
        {(p.elevador!=null||p.piscina!=null||p.area_lazer!=null||homo.ajustes.length>0) && <div style={card()}>{secTitle('Atributos do Prédio','🏗️')}
          <div style={{ display:'flex',flexWrap:'wrap',gap:6,marginBottom:homo.ajustes.length>0?12:0 }}>
            {[p.elevador!=null&&[p.elevador?'✓ Elevador':'✗ Sem elevador',p.elevador],p.piscina!=null&&[p.piscina?'✓ Piscina':'✗ Sem piscina',p.piscina],p.area_lazer!=null&&[p.area_lazer?'✓ Área lazer':'✗ Sem área lazer',p.area_lazer],p.academia!=null&&[p.academia?'✓ Academia':'✗ Sem academia',p.academia],p.churrasqueira!=null&&[p.churrasqueira?'✓ Churrasqueira':'✗ Sem churrasqueira',p.churrasqueira],p.portaria_24h&&['✓ Portaria 24h',true]].filter(Boolean).map(([t,v],i) =>
              <span key={i} style={{ fontSize:10,padding:'3px 8px',borderRadius:5,fontWeight:600,background:v?'#ECFDF5':'#FEF9C3',color:v?'#065F46':'#92400E' }}>{t}</span>)}
          </div>
          {homo.ajustes.length > 0 && <>
            <div style={{ fontSize:10,fontWeight:700,color:C.navy,marginBottom:6,textTransform:'uppercase',letterSpacing:'.3px' }}>Impacto no Valor (NBR 14653)</div>
            {homo.ajustes.map((a,i) => {
              const pos = a.fator >= 1
              return <div key={i} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'4px 8px',borderRadius:6,fontSize:11,marginBottom:2,background:pos?'#F0FDF4':'#FEF2F2' }}>
                <span style={{ color:'#475569' }}>{a.label}</span>
                <div style={{ display:'flex',gap:10 }}>
                  <span style={{ fontWeight:700,color:pos?'#065F46':'#991B1B' }}>{a.impactoPct>0?'+':''}{a.impactoPct}%</span>
                  {a['impactoR$']!==0 && <span style={{ fontWeight:600,color:pos?'#065F46':'#991B1B',fontSize:10,minWidth:70,textAlign:'right' }}>{a['impactoR$']>0?'+':''}{fmt(a['impactoR$'])}</span>}
                </div>
              </div>
            })}
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:6,padding:'6px 8px',borderRadius:6,background:homo.fator>=1?'#065F4610':'#991B1B10',border:`1px solid ${homo.fator>=1?'#065F4630':'#991B1B30'}` }}>
              <span style={{ fontSize:11,fontWeight:700,color:C.navy }}>Ajuste composto</span>
              <div style={{ display:'flex',gap:10 }}>
                <span style={{ fontWeight:800,color:homo.fator>=1?'#065F46':'#991B1B',fontSize:12 }}>{homo.fator>=1?'+':''}{((homo.fator-1)*100).toFixed(1)}%</span>
                {homo.impactoTotal!==0 && <span style={{ fontWeight:700,color:homo.fator>=1?'#065F46':'#991B1B',fontSize:11 }}>{homo.impactoTotal>0?'+':''}{fmt(homo.impactoTotal)}</span>}
              </div>
            </div>
          </>}
        </div>}

        {/* FOOTER */}
        <div style={{ textAlign:'center',padding:'24px 0',borderTop:`1px solid ${C.border}` }}>
          <div style={{ fontSize:15,fontWeight:800,color:C.navy,letterSpacing:-0.5 }}>AXIS IP</div>
          <div style={{ fontSize:10.5,color:C.muted,marginTop:4 }}>Inteligência Patrimonial · Análise gerada por IA</div>
          <div style={{ fontSize:9,color:'#ccc',marginTop:6 }}>{p.codigo_axis} · {new Date().toLocaleDateString('pt-BR')} · Somente leitura · Não constitui parecer jurídico</div>
        </div>
      </div>
    </div>
  )
}
