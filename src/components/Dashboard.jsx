import { useState, useEffect, useRef } from "react"
import { C, K, btn, fmtC, fmtD, card, recColor, scoreColor, scoreLabel, scoreDisplay } from "../appConstants.js"
import { calcularConfidence } from "../lib/agenteConfidenceBadge.js"
import { ArrowUpRight, Bell, TrendingUp, AlertTriangle, Package, Clock } from "lucide-react"
import { supabase } from '../lib/supabase.js'
import { isMercadoDireto } from '../lib/detectarFonte.js'
import ExportCarteira from './ExportCarteira.jsx'
import PainelPosLeilao from './PainelPosLeilao.jsx'

// Inline ScoreRing (used by PropCard)
function ScoreRing({score,size=80}) {
  // Score armazenado 0-10; exibido como 0-100 (Sprint 25)
  const maxVal = 10
  const c = scoreColor(score||0)
  const r = (size-10)/2
  const circ = 2*Math.PI*r
  const dash = ((score||0)/maxVal)*circ
  const scoreNum = scoreDisplay(score)  // 0-100 para display
  return <div style={{position:"relative",width:size,height:size,flexShrink:0}}>
    <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={`${c}20`} strokeWidth={size>60?8:4}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={c} strokeWidth={size>60?8:4}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"/>
    </svg>
    <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",textAlign:"center"}}>
      <div style={{fontSize:size>70?"22px":"15px",fontWeight:"800",color:c,lineHeight:1}}>{scoreNum}</div>
      <div style={{fontSize:"7px",color:C.hint,textTransform:"uppercase",letterSpacing:".5px"}}>{scoreLabel(score||0)}</div>
    </div>
  </div>
}

const Bdg = ({c,ch}) => <span style={{display:"inline-block",fontSize:"10px",fontWeight:"700",padding:"2px 8px",borderRadius:"5px",textTransform:"uppercase",letterSpacing:".5px",background:`${c}12`,color:c}}>{ch}</span>

function PropCard({p,onNav,isPhone=false}) {
  const sc=p.score_total||0, rc=recColor(p.recomendacao)
  const tipFmt=(p.tipologia||p.tipo||'—').replace('_padrao','').replace(/_/g,' ').replace(/\w/g,c=>c.toUpperCase())
  const fmtM = v => v ? `R$ ${Math.round(v).toLocaleString('pt-BR')}` : '—'
  const fmtM2 = v => v ? `R$ ${Math.round(v).toLocaleString('pt-BR')}/m²` : '—'
  const dataLeilao = p.data_leilao ? new Date(p.data_leilao+'T12:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'}) : null
  const numLeilao = p.praca ? `${p.praca}ª PRAÇA` : p.num_leilao ? `${p.num_leilao}º LEILÃO` : null
  const eMercado = isMercadoDireto(p.fonte_url, p.tipo_transacao)
  const diasLeilao = p.data_leilao && !eMercado && p.status_operacional !== 'arquivado'
    ? Math.ceil((new Date(p.data_leilao+'T12:00') - Date.now()) / 86400000) : null
  const diasLeilao2 = p.data_leilao_2 && !eMercado && p.status_operacional !== 'arquivado'
    ? Math.ceil((new Date(p.data_leilao_2+'T12:00') - Date.now()) / 86400000) : null
  const diasUrgente = diasLeilao !== null && diasLeilao >= 0 ? diasLeilao
    : diasLeilao2 !== null && diasLeilao2 >= 0 ? diasLeilao2 : null
  const urgColor = diasUrgente !== null && diasUrgente <= 7 ? '#DC2626'
    : diasUrgente !== null && diasUrgente <= 15 ? '#EA580C'
    : diasUrgente !== null && diasUrgente <= 30 ? '#D97706' : null
  const scoreDelta = p.preco_m2_imovel && p.preco_m2_mercado
    ? ((1 - p.preco_m2_imovel/p.preco_m2_mercado)*100).toFixed(0) : null
  const conf = calcularConfidence(p)

  return <div onClick={()=>onNav("detail",{id:p.id})}
    style={{...card(),cursor:"pointer",transition:"all .15s",padding:isPhone?"12px":"14px",
      outline: urgColor ? `2px solid ${urgColor}` : undefined}}>
    onMouseEnter={e=>{e.currentTarget.style.borderColor=K.teal;e.currentTarget.style.transform="translateY(-2px)"}}
    onMouseLeave={e=>{e.currentTarget.style.borderColor=K.bd;e.currentTarget.style.transform="none"}}>

    {urgColor && diasUrgente !== null && (
      <div style={{background:urgColor,color:'#fff',fontSize:10,fontWeight:800,
        padding:'4px 10px',borderRadius:5,marginBottom:8,display:'flex',
        alignItems:'center',gap:6,letterSpacing:0.3}}>
        <span>⏳</span>
        <span>
          {diasLeilao !== null && diasLeilao >= 0
            ? (diasLeilao === 0 ? 'LEILÃO HOJE!' : diasLeilao === 1 ? 'LEILÃO AMANHÃ!' : `LEILÃO EM ${diasLeilao} DIAS`)
            : diasLeilao2 !== null && diasLeilao2 >= 0
              ? (diasLeilao2 === 0 ? '2ª PRAÇA HOJE!' : diasLeilao2 === 1 ? '2ª PRAÇA AMANHÃ!' : `2ª PRAÇA EM ${diasLeilao2} DIAS`)
              : 'LEILÃO'}
        </span>
        {p.praca && <span style={{marginLeft:'auto',fontWeight:700,fontSize:9,opacity:0.9}}>{p.praca}ª PRAÇA · {dataLeilao}</span>}
      </div>
    )}
    {p.foto_principal && (
      <div style={{marginBottom:10,borderRadius:8,overflow:"hidden",height:isPhone?95:115,background:C.offwhite,position:"relative"}}>
        <img src={p.foto_principal} alt="" referrerPolicy="no-referrer" style={{width:"100%",height:"100%",objectFit:"cover"}} onError={e=>{e.target.parentElement.style.display="none"}} />
        {sc>=7.5&&<div style={{position:'absolute',top:6,left:6,background:'#10B981',color:'#fff',fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:4}}>⭐ OPORTUNIDADE</div>}
        {numLeilao&&!eMercado&&<div style={{position:'absolute',top:6,right:6,background:p.num_leilao>=2?'#D97706':'#065F46',color:'#fff',fontSize:8,fontWeight:700,padding:'2px 6px',borderRadius:4}}>{numLeilao}</div>}
        {eMercado&&<div style={{position:'absolute',top:6,right:6,background:'#1D4ED8',color:'#fff',fontSize:8,fontWeight:700,padding:'2px 6px',borderRadius:4}}>🏠 MERCADO</div>}
      </div>
    )}

    <div style={{display:"flex",alignItems:"flex-start",gap:5,marginBottom:3,flexWrap:"wrap"}}>
      <div style={{fontWeight:"700",fontSize:"13px",color:K.wh,flex:1,minWidth:0,wordBreak:"break-word",lineHeight:1.3}}>{p.titulo||"Imóvel sem título"}</div>
      {p.codigo_axis&&<span style={{fontSize:"9px",fontWeight:700,padding:"1px 6px",borderRadius:3,background:"#002B8010",color:"#002B80",fontFamily:"monospace",flexShrink:0}}>{p.codigo_axis}</span>}
    </div>

    <div style={{fontSize:"10.5px",color:K.t3,marginBottom:6}}>
      📍 {[p.bairro,p.cidade].filter(Boolean).join(', ')}/{p.estado} · {tipFmt} · {(p.area_privativa_m2||p.area_m2)||'—'}m²
    </div>

    {dataLeilao&&!eMercado&&(
      <div style={{fontSize:10,color:K.t3,marginBottom:6,display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
        <span>🗓️ Leilão: <strong style={{color:K.wh}}>{dataLeilao}</strong></span>
        {p.data_leilao_2 && p.valor_minimo_2 && diasLeilao2 !== null && diasLeilao2 >= 0 && (
          <span style={{fontSize:9,color:'#D97706',fontWeight:700,background:'#FEF3C720',
            border:'1px solid #D9770640',padding:'1px 5px',borderRadius:3}}>
            2ª {new Date(p.data_leilao_2+'T12:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})} · R${Math.round(p.valor_minimo_2/1000)}k
          </span>
        )}
      </div>
    )}

    <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:8}}>
      <Bdg c={rc} ch={p.recomendacao||"—"}/>
      {eMercado&&<Bdg c="#1D4ED8" ch="MERCADO"/>}
      <Bdg c={p.ocupacao==="Desocupado"?K.grn:p.ocupacao==="Ocupado"?K.red:K.t3} ch={p.ocupacao||"—"}/>
      {p.financiavel&&<Bdg c={K.blue} ch="Financiável"/>}
      {p.analise_dupla_ia&&<span style={{fontSize:"9px",fontWeight:"700",background:"linear-gradient(135deg,rgba(0,229,187,0.2),rgba(16,163,127,0.2))",border:"1px solid rgba(0,229,187,0.35)",color:"#00E5BB",padding:"2px 7px",borderRadius:"4px"}}>🤖 IA</span>}
      {(p.num_documentos>0)&&<Bdg c="#7C3AED" ch={`📄 ${p.num_documentos}doc`}/>}
    </div>

    <div style={{display:"flex",flexDirection:isPhone?"column":"row",gap:8,alignItems:isPhone?"stretch":"flex-start"}}>
      <div style={{flex:1,display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
        <div style={{background:K.s2,borderRadius:6,padding:"7px 9px"}}>
          <div style={{fontSize:"8.5px",color:K.t3,marginBottom:1}}>{eMercado ? 'PREÇO PEDIDO' : 'LANCE MÍN.'}</div>
          <div style={{fontSize:"12px",fontWeight:"800",color:K.amb}}>{fmtM(eMercado ? (p.preco_pedido || p.valor_minimo) : p.valor_minimo)}</div>
        </div>
        <div style={{background:K.s2,borderRadius:6,padding:"7px 9px"}}>
          <div style={{fontSize:"8.5px",color:K.t3,marginBottom:1}}>DESCONTO</div>
          <div style={{fontSize:"12px",fontWeight:"800",color:K.grn}}>{p.desconto_percentual?`${p.desconto_percentual}%`:(scoreDelta&&scoreDelta>0?`~${scoreDelta}%`:"—")}</div>
        </div>
        <div style={{background:K.s2,borderRadius:6,padding:"7px 9px"}}>
          <div style={{fontSize:"8.5px",color:K.t3,marginBottom:1}}>ALUGUEL EST.</div>
          <div style={{fontSize:"12px",fontWeight:"700",color:"#7C3AED"}}>{p.aluguel_mensal_estimado&&p.aluguel_mensal_estimado>0?`R$ ${Math.round(p.aluguel_mensal_estimado).toLocaleString('pt-BR')}/mês`:"—"}</div>
        </div>
        <div style={{background:K.s2,borderRadius:6,padding:"7px 9px"}}>
          <div style={{fontSize:"8.5px",color:K.t3,marginBottom:1}}>MAO FLIP</div>
          <div style={{fontSize:"12px",fontWeight:"700",color:K.teal}}>{p.mao_flip&&p.mao_flip>0?`R$ ${Math.round(p.mao_flip).toLocaleString('pt-BR')}`:"—"}</div>
        </div>
      </div>
      <div style={{flexShrink:0,display:"flex",alignItems:"center",justifyContent:isPhone?"flex-end":"center",marginTop:isPhone?4:0}}>
        <div style={{textAlign:'center'}}>
          <ScoreRing score={sc} size={isPhone?56:62}/>
          <div style={{fontSize:8,color:K.t3,marginTop:2,fontWeight:600}}>
            {Math.round(sc*10)}/100
          </div>
        </div>
      </div>
    </div>

    {(p.preco_m2_imovel||p.preco_m2_mercado||p.valor_avaliacao)&&(
      <div style={{marginTop:7,paddingTop:7,borderTop:`1px solid ${K.bd}`,display:'flex',gap:10,flexWrap:'wrap',fontSize:10,color:K.t3}}>
        {p.valor_avaliacao&&<span>Aval. <strong style={{color:K.wh}}>{fmtM(p.valor_avaliacao)}</strong></span>}
        {p.preco_m2_imovel&&<span>Imóvel <strong style={{color:K.teal}}>{fmtM2(p.preco_m2_imovel)}</strong></span>}
        {p.preco_m2_mercado&&<span>Mercado <strong style={{color:K.t2}}>{fmtM2(p.preco_m2_mercado)}</strong></span>}
      </div>
    )}

    {/* Barra de confiança + MAO locação */}
    <div style={{marginTop:6,display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
      <div style={{flex:1,height:3,borderRadius:2,background:`${K.s2}`,overflow:'hidden'}}>
        <div style={{width:`${conf.score}%`,height:'100%',borderRadius:2,
          background:conf.score>=75?'#059669':conf.score>=50?'#D97706':'#DC2626',
          transition:'width .4s'}}/>
      </div>
      <span style={{fontSize:9,color:conf.score>=75?'#059669':conf.score>=50?'#D97706':'#DC2626',fontWeight:700,flexShrink:0}}>
        {conf.score}%
      </span>
      {p.mao_locacao>0&&<span style={{fontSize:9,color:'#7C3AED',fontWeight:700,flexShrink:0,marginLeft:4}}>
        📍 {fmtM(p.mao_locacao)}
      </span>}
    </div>
    <div style={{fontSize:"9.5px",color:K.t3,marginTop:4,display:'flex',justifyContent:'space-between'}}>
      <span>{fmtD(p.createdAt)}</span>
      <span>{p.modalidade_leilao||p.modalidade||'—'}</span>
    </div>
  </div>
}

function AxisHeader({profile:prof, imoveis=[], onNav, isPhone=false, isMobile=false}) {
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef(null)

  const notifs = []
  const comprar = imoveis.filter(p => p.recomendacao === "COMPRAR")
  const forte = imoveis.filter(p => (p.score_total||0) >= 7.5)
  const alertas = imoveis.filter(p => (p.score_juridico||10) < 4)
  const recentes = [...imoveis].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0,3)

  // Alertas D-7 e D-1 de leilão (inseridos no topo)
  const hoje = new Date(); hoje.setHours(0,0,0,0)
  const em7 = new Date(hoje); em7.setDate(em7.getDate() + 7)
  const leiloesProximos = imoveis
    .filter(p => {
      if (!p.data_leilao || p.status_operacional === 'arquivado') return false
      const [y,m,d] = p.data_leilao.split('-').map(Number)
      const dl = new Date(y, m-1, d); dl.setHours(0,0,0,0)
      return dl >= hoje && dl <= em7
    })
    .sort((a,b) => new Date(a.data_leilao+'T12:00') - new Date(b.data_leilao+'T12:00'))
  for (const p of leiloesProximos) {
    const [y,m,d] = p.data_leilao.split('-').map(Number)
    const dl = new Date(y, m-1, d); dl.setHours(0,0,0,0)
    const diff = Math.round((dl - hoje) / 86400000)
    const urgente = diff <= 1
    notifs.unshift({
      tipo: 'leilao_proximo',
      cor: urgente ? C.red : C.mustard,
      icon: 'clock',
      texto: urgente
        ? `Leilão AMANHÃ: ${p.titulo || p.codigo_axis || 'Imóvel'}`
        : `Leilão em ${diff} dia${diff !== 1 ? 's' : ''}: ${p.titulo || p.codigo_axis || 'Imóvel'}`,
      sub: `${p.modalidade_leilao || 'Leilão'} · ${new Date(p.data_leilao+'T12:00').toLocaleDateString('pt-BR')}${p.recomendacao ? ` · ${p.recomendacao}` : ''}`,
      id: p.id,
    })
  }

  if (comprar.length > 0) notifs.push({ tipo: "comprar", cor: C.emerald, icon: "arrow", texto: `${comprar.length} imóvel(is) com recomendação COMPRAR`, sub: comprar[0]?.titulo || "Ver oportunidades" })
  if (forte.length > 0) notifs.push({ tipo: "forte", cor: C.emerald, icon: "star", texto: `${forte.length} imóvel(is) com score forte (≥ 7.5)`, sub: "Melhores oportunidades da carteira" })
  if (alertas.length > 0) notifs.push({ tipo: "alerta", cor: C.mustard, icon: "alert", texto: `${alertas.length} imóvel(is) com risco jurídico alto`, sub: "Score jurídico < 4 — atenção redobrada" })
  for (const r of recentes) {
    const ago = Math.round((Date.now() - new Date(r.createdAt)) / 86400000)
    notifs.push({ tipo: "recente", cor: C.navy, icon: "new", texto: r.titulo || "Imóvel analisado", sub: ago <= 0 ? "Hoje" : `Há ${ago} dia(s)`, id: r.id })
  }

  useEffect(() => {
    if (!notifOpen) return
    const handler = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false) }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [notifOpen])

  return (
    <header style={{
      display:"flex",alignItems:"center",justifyContent:"space-between",
      padding:isPhone?"12px 16px":"18px 36px",background:C.white,borderBottom:`1px solid ${C.borderW}`,
      gap:8,
    }}>
      <div style={{minWidth:0,flex:1}}>
        <h1 style={{margin:0,fontSize:isPhone?16:22,fontWeight:700,color:C.navy,letterSpacing:"-0.5px",whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>Dashboard Executivo</h1>
        {!isPhone&&<p style={{margin:"2px 0 0",fontSize:13,color:C.muted}}>
          Visão consolidada da carteira de ativos em tempo real
        </p>}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:14}}>
        {!isPhone&&<button onClick={async () => {
          const { exportarExcelCarteira } = await import('./ExportarExcel.jsx')
          const n = exportarExcelCarteira(imoveis)
          // toast simples
        }} style={{
          display:"flex",alignItems:"center",gap:6,whiteSpace:"nowrap",
          padding:"8px 16px",borderRadius:8,
          border:`1px solid #16A34A30`,background:"#ECFDF5",color:"#065F46",
          fontSize:13,fontWeight:500,cursor:"pointer", marginRight:4,
        }}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <rect x="2" y="1" width="11" height="13" rx="1" stroke="#065F46" strokeWidth="1.2" fill="none"/>
            <path d="M4 5h7M4 7.5h7M4 10h4" stroke="#065F46" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          Excel
        </button>}
        {!isPhone&&<button onClick={async () => {
          const { exportarRelatorioCarteira } = await import('./RelatorioCarteiraHTML.jsx')
          exportarRelatorioCarteira(imoveis, '')
        }} style={{
          display:"flex",alignItems:"center",gap:7,whiteSpace:"nowrap",
          padding:"8px 16px",borderRadius:8,
          border:`1px solid ${C.borderW}`,background:C.white,color:C.navy,
          fontSize:13,fontWeight:500,cursor:"pointer",
        }}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <path d="M7.5 10L3 5.5h3V1h3v4.5h3L7.5 10z" stroke={C.navy} strokeWidth="1.3" strokeLinejoin="round"/>
            <path d="M2 12h11" stroke={C.navy} strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          Relatório Carteira
        </button>}
        <div ref={notifRef} style={{position:"relative"}}>
          <div onClick={() => setNotifOpen(o => !o)} style={{position:"relative",cursor:"pointer",padding:4}}>
            <Bell size={18} color={notifOpen ? C.navy : C.muted} />
            {notifs.length > 0 && (
              <span style={{
                position:"absolute",top:1,right:1,
                minWidth:16,height:16,borderRadius:8,
                background:"#E5484D",border:`2px solid ${C.white}`,
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:9,fontWeight:700,color:"#fff",padding:"0 3px",
              }}>
                {notifs.length}
              </span>
            )}
          </div>
          {notifOpen && (
            <div style={{
              position:"absolute",top:"calc(100% + 8px)",right:0,
              width:isPhone?'calc(100vw - 32px)':340,background:C.white,
              border:`1px solid ${C.borderW}`,borderRadius:12,
              boxShadow:"0 12px 40px rgba(0,43,128,0.15)",
              zIndex:100,overflow:"hidden",
            }}>
              <div style={{padding:"14px 16px 10px",borderBottom:`1px solid ${C.borderW}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <p style={{margin:0,fontSize:14,fontWeight:700,color:C.navy}}>Notificações</p>
                <span style={{fontSize:11,color:C.muted}}>{notifs.length} alerta{notifs.length !== 1 ? "s" : ""}</span>
              </div>
              <div style={{maxHeight:320,overflowY:"auto"}}>
                {notifs.length === 0 ? (
                  <div style={{padding:"28px 16px",textAlign:"center"}}>
                    <Bell size={28} color={C.hint} strokeWidth={1.2} />
                    <p style={{margin:"10px 0 0",fontSize:13,color:C.muted}}>Nenhuma notificação</p>
                    <p style={{margin:"2px 0",fontSize:11.5,color:C.hint}}>Analise imóveis para receber alertas</p>
                  </div>
                ) : notifs.map((n, i) => (
                  <div
                    key={i}
                    onClick={() => { if (n.id && onNav) { onNav("detail", {id: n.id}); setNotifOpen(false) } }}
                    style={{
                      padding:"12px 16px",
                      borderBottom: i < notifs.length - 1 ? `1px solid ${C.borderW}` : "none",
                      cursor: n.id ? "pointer" : "default",
                      transition:"background 0.1s",
                    }}
                    onMouseEnter={e => { if(n.id) e.currentTarget.style.background = C.surface }}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                      <div style={{
                        width:32,height:32,borderRadius:8,flexShrink:0,
                        background:`${n.cor}14`,
                        display:"flex",alignItems:"center",justifyContent:"center",
                      }}>
                        {n.icon === "arrow" && <ArrowUpRight size={15} color={n.cor} />}
                        {n.icon === "star" && <TrendingUp size={15} color={n.cor} />}
                        {n.icon === "alert" && <AlertTriangle size={15} color={n.cor} />}
                        {n.icon === "new" && <Package size={15} color={n.cor} />}
                        {n.icon === "clock" && <Clock size={15} color={n.cor} />}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{margin:0,fontSize:12.5,fontWeight:600,color:C.navy}}>{n.texto}</p>
                        <p style={{margin:"2px 0 0",fontSize:11,color:C.muted}}>{n.sub}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {imoveis.length > 0 && (
                <div style={{padding:"10px 16px",borderTop:`1px solid ${C.borderW}`,textAlign:"center"}}>
                  <button
                    onClick={() => { if(onNav) onNav("imoveis"); setNotifOpen(false) }}
                    style={{
                      border:"none",background:"none",
                      fontSize:12.5,fontWeight:600,color:C.emerald,
                      cursor:"pointer",
                    }}
                  >
                    Ver todos os imóveis
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
          <div style={{
            width:36,height:36,borderRadius:"50%",background:C.emeraldL,
            border:`2px solid ${C.emerald}40`,display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:12,fontWeight:700,color:C.emerald,
          }}>
            {(prof?.nome||"U")[0].toUpperCase()}{(prof?.nome||"U").split(" ")[1]?.[0]?.toUpperCase()||""}
          </div>
          <div style={{minWidth:0,overflow:"hidden"}}>
            <p style={{margin:0,fontSize:13,fontWeight:600,color:C.navy,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:100}}>{prof?.nome||"Usuário"}</p>
            <p style={{margin:0,fontSize:11,color:C.muted,whiteSpace:"nowrap"}}>{prof?.role==="admin"?"Administrador":"Membro"}</p>
          </div>
        </div>
      </div>
    </header>
  )
}

export default function Dashboard({props,onNav,profile:prof,isMobile,isPhone}) {
  const total=props.length, comprar=props.filter(p=>p.recomendacao==="COMPRAR").length
  const forte=props.filter(p=>(p.score_total||0)>=7.5).length
  const avg=total?(props.reduce((s,p)=>s+(p.score_total||0),0)/total).toFixed(2):"0"
  const avgPct=total?Math.round((props.reduce((s,p)=>s+(p.score_total||0),0)/total)*10):0
  const recentes=[...props].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,4)
  // Card 3: priorizar imóvel com leilão mais próximo (urgente > score alto)
  const hoje = Date.now()
  const diasP = (d) => d ? Math.ceil((new Date(d+'T12:00') - hoje) / 86400000) : null
  const propComLeilao = [...props]
    .filter(p => {
      const d1 = diasP(p.data_leilao); const d2 = diasP(p.data_leilao_2)
      return (d1 !== null && d1 >= 0 && d1 <= 30) || (d2 !== null && d2 >= 0 && d2 <= 30)
    })
    .sort((a, b) => {
      const da = Math.min(...[diasP(a.data_leilao), diasP(a.data_leilao_2)].filter(x => x !== null && x >= 0))
      const db = Math.min(...[diasP(b.data_leilao), diasP(b.data_leilao_2)].filter(x => x !== null && x >= 0))
      return da - db
    })[0]
  const topAlerta = propComLeilao || [...props].filter(p=>p.recomendacao!=="EVITAR").sort((a,b)=>(b.score_total||0)-(a.score_total||0))[0]
  const alertaDias = topAlerta ? Math.min(...[diasP(topAlerta.data_leilao), diasP(topAlerta.data_leilao_2)].filter(x => x !== null && x >= 0).concat([999])) : null
  const alertaUrgente = alertaDias !== null && alertaDias <= 30
  const totalValor=props.reduce((s,p)=>s+(p.valor_minimo||0),0)
  const fmtM=v=>{if(v>=1e6)return`R$ ${(v/1e6).toFixed(1)}M`;if(v>=1e3)return`R$ ${(v/1e3).toFixed(0)}K`;return`R$ ${v}`}
  const [leads, setLeads] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [ultimaBusca, setUltimaBusca] = useState(null)
  const buscarOportunidades = async () => {
    setBuscando(true)
    try {
      const { data, err } = await supabase.functions.invoke('get-top-auctions')
      if (err) throw err
      setLeads(data.top3 || [])
      setUltimaBusca(data.gerado_em)
    } catch(e) { console.error('buscarOportunidades:', e) }
    finally { setBuscando(false) }
  }

  return <div style={{background:C.bg,minHeight:"100%"}}>
    <AxisHeader profile={prof} imoveis={props} onNav={onNav} isPhone={isPhone} isMobile={isMobile}/>
    <div style={{padding:isPhone?"16px 14px":"28px 32px",display:"flex",flexDirection:"column",gap:isPhone?14:20}}>
      {/* Linha 1: 3 colunas — Patrimônio | Valorização | Alertas */}
      <div style={{display:"grid",gridTemplateColumns:isPhone?"1fr":isMobile?"repeat(2,1fr)":"1fr 1fr 1fr",gap:isPhone?12:18}}>
        {/* Card 1 — Patrimônio Monitorado (verde escuro) */}
        <div style={{
          background:"#064E3B",borderRadius:14,padding:isPhone?"16px 18px":"22px 24px",
          position:"relative",overflow:"hidden",
          boxShadow:"0 4px 20px rgba(5,168,109,0.25)",
        }}>
          <p style={{margin:"0 0 6px",fontSize:isPhone?10:11,fontWeight:600,color:"rgba(255,255,255,0.7)",textTransform:"uppercase",letterSpacing:"0.8px"}}>
            Patrimônio Monitorado
          </p>
          <p style={{margin:"0 0 2px",fontSize:isPhone?28:36,fontWeight:800,color:"#FFFFFF",letterSpacing:"-1.5px",lineHeight:1}}>
            {fmtM(totalValor)}
          </p>
          <p style={{margin:"4px 0 0",fontSize:isPhone?11:13,color:"rgba(255,255,255,0.65)"}}>
            {total} ativo{total!==1?"s":""} sob gestão
          </p>
          <div style={{position:"absolute",bottom:16,right:20}}>
            <ArrowUpRight size={48} color="rgba(255,255,255,0.12)" strokeWidth={1.5} />
          </div>
        </div>
        {/* Card 2 — Score Médio */}
        <div style={{
          background:C.white,border:`1px solid ${C.borderW}`,
          borderRadius:14,padding:isPhone?"16px 18px":"22px 24px",
          boxShadow:"0 2px 12px rgba(0,43,128,0.06)",
        }}>
          <p style={{margin:"0 0 6px",fontSize:isPhone?10:11,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:"0.8px"}}>
            Score Médio AXIS
          </p>
          <p style={{margin:"0 0 2px",fontSize:isPhone?30:38,fontWeight:800,color:C.emerald,letterSpacing:"-1.5px",lineHeight:1}}>
            {avg}/10
          </p>
          <p style={{margin:"2px 0 0",fontSize:isPhone?11:12.5,color:C.muted}}>Média da carteira ativa</p>
          <div style={{
            marginTop:isPhone?10:14,display:"flex",gap:12,
            paddingTop:isPhone?8:12,borderTop:`1px solid ${C.borderW}`,
          }}>
            <div>
              <p style={{margin:0,fontSize:10,color:C.hint,whiteSpace:"nowrap"}}>Para comprar</p>
              <p style={{margin:"2px 0 0",fontSize:18,fontWeight:800,color:C.emerald,lineHeight:1}}>{comprar}</p>
              <p style={{margin:"2px 0 0",fontSize:9.5,color:C.hint}}>Rec. positiva</p>
            </div>
            <div>
              <p style={{margin:0,fontSize:10,color:C.hint,whiteSpace:"nowrap"}}>Score forte</p>
              <p style={{margin:"2px 0 0",fontSize:18,fontWeight:800,color:C.emerald,lineHeight:1}}>{forte}</p>
              <p style={{margin:"2px 0 0",fontSize:9.5,color:C.hint}}>Score ≥ 7.5</p>
            </div>
          </div>
        </div>
        {/* Card 3 — Alertas / Destaque */}
        <div style={{
          background:C.white,border:`1px solid ${C.borderW}`,
          borderRadius:14,padding:isPhone?"16px 18px":"22px 24px",
          boxShadow:"0 2px 12px rgba(0,43,128,0.06)",
        }}>
          <p style={{margin:"0 0 8px",fontSize:isPhone?10:11,fontWeight:600,
            color: alertaUrgente ? '#DC2626' : C.muted,
            textTransform:"uppercase",letterSpacing:"0.8px",display:'flex',alignItems:'center',gap:5}}>
            {alertaUrgente ? '🚨' : '⭐'} {alertaUrgente ? `Leilão em ${alertaDias === 0 ? 'HOJE' : alertaDias + ' dias'}` : 'Destaque da Carteira'}
          </p>
          {topAlerta?<>
            <div style={{padding:"10px 12px",borderRadius:8,background:C.surface,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{flex:1,minWidth:0}}>
                <p style={{margin:0,fontSize:12.5,fontWeight:600,color:C.navy,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{topAlerta.titulo||"Imóvel"}</p>
                <div style={{display:"flex",gap:5,marginTop:3}}>
                  <span style={{fontSize:10,padding:"1px 6px",borderRadius:3,background:C.navyAlfa,color:C.navy,fontWeight:600}}>{topAlerta.tipo||"Imóvel"}</span>
                  <span style={{fontSize:10,padding:"1px 6px",borderRadius:3,background:C.emeraldL,color:C.emerald,fontWeight:600}}>{topAlerta.recomendacao}</span>
                </div>
                <p style={{margin:"4px 0 0",fontSize:13.5,fontWeight:700,color:C.navy}}>{fmtC(topAlerta.valor_minimo)}</p>
                <p style={{margin:0,fontSize:11,color:C.emerald,fontWeight:600}}>{topAlerta.desconto_percentual?`-${topAlerta.desconto_percentual}% desconto`:""}</p>
              </div>
              <svg width="52" height="52" style={{flexShrink:0}}>
                <circle cx="26" cy="26" r="20" fill="none" stroke={C.emeraldL} strokeWidth="4"/>
                <circle cx="26" cy="26" r="20" fill="none" stroke={C.emerald} strokeWidth="4"
                  strokeDasharray={`${((topAlerta.score_total||0)/10)*125.7} 125.7`}
                  strokeLinecap="round" transform="rotate(-90 26 26)"/>
                <text x="26" y="23" textAnchor="middle" fontSize="12" fontWeight="800" fill={C.emerald}>{(topAlerta.score_total||0).toFixed(1)}</text>
                <text x="26" y="32" textAnchor="middle" fontSize="7" fill={C.hint}>/10</text>
              </svg>
            </div>
            <button onClick={()=>onNav("detail",{id:topAlerta.id})} style={{
              marginTop:10,width:"100%",padding:"8px 0",borderRadius:7,
              background: alertaUrgente ? '#DC2626' : C.emerald,
              color:"#fff",border:"none",fontSize:12.5,fontWeight:600,cursor:"pointer",
              display:"flex",alignItems:"center",justifyContent:"center",gap:6,
            }}>
              {alertaUrgente ? '⚡ Ver Decisão de Lance' : 'Analisar Ativo'} <ArrowUpRight size={15} />
            </button>
          </>:<p style={{fontSize:13,color:C.hint}}>Nenhum ativo analisado</p>}
        </div>
      </div>

      {/* Linha 2: Oportunidades Ativas */}
      <div style={{
        background:C.white,border:`1px solid ${C.borderW}`,
        borderRadius:14,padding:isPhone?"16px 18px":"20px 24px",
        boxShadow:"0 2px 12px rgba(0,43,128,0.06)",
        ...(isPhone?{textAlign:"center"}:{display:"flex",alignItems:"center",justifyContent:"space-between"}),
      }}>
        {/* Número + label */}
        <div>
          <p style={{margin:"0 0 4px",fontSize:11,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:"0.8px"}}>
            Oportunidades Ativas
          </p>
          <p style={{margin:0,fontSize:isPhone?32:42,fontWeight:800,color:C.navy,letterSpacing:"-2px",lineHeight:1}}>
            {total}
          </p>
          <p style={{margin:"4px 0 0",fontSize:12.5,color:C.muted}}>Score Médio AXIS</p>
        </div>
        {/* Ring + Botões */}
        <div style={isPhone?{display:"flex",alignItems:"center",justifyContent:"center",gap:12,marginTop:12,flexWrap:"wrap"}:{display:"flex",gap:14,alignItems:"center"}}>
          <svg width={isPhone?52:80} height={isPhone?52:80}>
            <circle cx={isPhone?26:40} cy={isPhone?26:40} r={isPhone?20:32} fill="none" stroke={C.emeraldL} strokeWidth={isPhone?5:6}/>
            <circle cx={isPhone?26:40} cy={isPhone?26:40} r={isPhone?20:32} fill="none" stroke={C.emerald} strokeWidth={isPhone?5:6}
              strokeDasharray={`${(avgPct/100)*(isPhone?125.7:201)} ${isPhone?125.7:201}`}
              strokeLinecap="round" transform={`rotate(-90 ${isPhone?26:40} ${isPhone?26:40})`}/>
            <text x={isPhone?26:40} y={isPhone?24:37} textAnchor="middle" fontSize={isPhone?13:18} fontWeight="800" fill={C.navy}>{avg}</text>
            <text x={isPhone?26:40} y={isPhone?34:50} textAnchor="middle" fontSize={isPhone?8:10} fill={C.hint}>/10</text>
          </svg>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:isPhone?"center":"flex-start"}}>
              <button onClick={()=>onNav("novo")} style={{
                padding:isPhone?"7px 14px":"8px 18px",borderRadius:7,
                background:C.emerald,color:"#fff",
                border:"none",fontSize:12,fontWeight:600,cursor:"pointer",
              }}>
                + Nova Análise
              </button>
              <ExportCarteira imoveis={props} isPhone={isPhone}/>
            </div>
            <div style={{display:"flex",gap:6,justifyContent:isPhone?"center":"flex-start"}}>
              <span style={{fontSize:10,padding:"3px 8px",borderRadius:5,background:C.navyAlfa,color:C.navy,fontWeight:600}}>{comprar} comprar</span>
              <span style={{fontSize:10,padding:"3px 8px",borderRadius:5,background:C.emeraldL,color:C.emerald,fontWeight:600}}>{forte} forte</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sprint 10: Painel Pós-Leilão — alertas e controle */}
      <PainelPosLeilao onNav={onNav} isPhone={isPhone}/>

      {/* Linha 3: Análises Recentes */}
      {total===0
        ?<div style={{background:C.white,borderRadius:14,border:`1px solid ${C.borderW}`,textAlign:"center",padding:"60px 20px"}}>
          <div style={{fontSize:"48px",marginBottom:"16px",opacity:0.5}}>📊</div>
          <div style={{fontSize:"15px",marginBottom:"8px",color:C.muted}}>Nenhum imóvel analisado ainda</div>
          <div style={{fontSize:"12px",marginBottom:"24px",color:C.hint}}>Cole o link de um leilão para começar</div>
          <button style={btn()} onClick={()=>onNav("novo")}>Analisar Primeiro Imóvel</button>
        </div>
        :<div>
          <div style={{fontWeight:"600",color:C.text,marginBottom:"14px",fontSize:"14px"}}>Análises Recentes</div>
          <div style={{display:"grid",gridTemplateColumns:isPhone?"1fr":"repeat(auto-fill,minmax(300px,1fr))",gap:"16px"}}>
            {recentes.map(p=><PropCard key={p.id} p={p} onNav={onNav} isPhone={isPhone}/>)}
          </div>
        </div>}
    </div>
      {/* Seção: Buscar Oportunidades */}
      <div style={{marginTop:24,background:C.white,borderRadius:14,border:`1px solid ${C.border}`,padding:"20px 24px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:leads.length?16:0}}>
          <div style={{fontWeight:"600",color:C.text,fontSize:15}}>Oportunidades de Leilão</div>
          <button style={{...btn('s'),background:C.emerald,color:'#fff',border:'none',display:'flex',alignItems:'center',gap:6,fontSize:13}} onClick={buscarOportunidades} disabled={buscando}>
            {buscando?"Buscando…":"🔍 Buscar Oportunidades"}
          </button>
        </div>
        {ultimaBusca&&<div style={{fontSize:11,color:C.hint,marginBottom:12}}>Atualizado: {new Date(ultimaBusca).toLocaleString("pt-BR")}</div>}
        {leads.length>0&&<div style={{display:"flex",flexDirection:"column",gap:10}}>
          {leads.map((l,i)=>(
            <div key={l.id||i} style={{display:"flex",gap:12,alignItems:"flex-start",padding:"12px 0",borderTop:i>0?`1px solid ${C.border}`:"none"}}>
              <div style={{width:28,height:28,borderRadius:"50%",background:i===0?C.emerald:i===1?C.mustard:"#94a3b8",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"700",fontSize:13,flexShrink:0}}>{i+1}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:"600",fontSize:13,color:C.text,marginBottom:2}}>{l.titulo||l.endereco}</div>
                <div style={{fontSize:12,color:C.muted,marginBottom:4}}>{l.bairro}{l.bairro&&l.cidade?", ":""}{l.cidade}</div>
                <div style={{display:"flex",gap:12,fontSize:12}}>
                  <span><span style={{color:C.hint}}>Lance: </span><strong style={{color:C.text}}>{l.lance_fmt}</strong></span>
                  <span><span style={{color:C.hint}}>Aval: </span>{l.aval_fmt}</span>
                  <span style={{color:C.emerald,fontWeight:"600"}}>{l.desc_fmt} desc.</span>
                </div>
              </div>
              {l.url_edital&&<a href={l.url_edital} target="_blank" rel="noreferrer" style={{fontSize:11,color:C.emerald,whiteSpace:"nowrap",marginTop:2}}>Ver edital ↗</a>}
            </div>
          ))}
        </div>}
      </div>
  </div>
}
