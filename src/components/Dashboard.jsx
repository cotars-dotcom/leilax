import { useState, useEffect, useRef } from "react"
import { C, K, btn, fmtC, fmtD, card, recColor, scoreColor, scoreLabel } from "../appConstants.js"
import { ArrowUpRight, Bell, TrendingUp, AlertTriangle, Package } from "lucide-react"

// Inline ScoreRing (used by PropCard)
function ScoreRing({score,size=80}) {
  const maxVal = size > 60 ? 10 : 100
  const c = maxVal === 10 ? scoreColor(score||0) : ((score||0)>=70?C.emerald:(score||0)>=50?C.mustard:"#E5484D")
  const r = (size-10)/2
  const circ = 2*Math.PI*r
  const dash = ((score||0)/maxVal)*circ
  return <div style={{position:"relative",width:size,height:size,flexShrink:0}}>
    <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={`${c}20`} strokeWidth={size>60?8:4}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={c} strokeWidth={size>60?8:4}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"/>
    </svg>
    <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",textAlign:"center"}}>
      <div style={{fontSize:size>70?"18px":"13px",fontWeight:"800",color:c,lineHeight:1}}>{(score||0).toFixed(1)}</div>
      <div style={{fontSize:"8px",color:C.hint,textTransform:"uppercase",letterSpacing:".5px"}}>{scoreLabel(score||0)}</div>
    </div>
  </div>
}

const Bdg = ({c,ch}) => <span style={{display:"inline-block",fontSize:"10px",fontWeight:"700",padding:"2px 8px",borderRadius:"5px",textTransform:"uppercase",letterSpacing:".5px",background:`${c}12`,color:c}}>{ch}</span>

function PropCard({p,onNav}) {
  const sc=p.score_total||0, rc=recColor(p.recomendacao)
  return <div onClick={()=>onNav("detail",{id:p.id})}
    style={{...card(),cursor:"pointer",transition:"all .15s"}}
    onMouseEnter={e=>{e.currentTarget.style.borderColor=K.teal;e.currentTarget.style.transform="translateY(-2px)"}}
    onMouseLeave={e=>{e.currentTarget.style.borderColor=K.bd;e.currentTarget.style.transform="none"}}>
    {p.foto_principal && (
      <div style={{marginBottom:10,borderRadius:8,overflow:"hidden",height:100,background:C.offwhite}}>
        <img src={p.foto_principal} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} onError={e=>{e.target.parentElement.style.display="none"}} />
      </div>
    )}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"10px"}}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:"4px"}}>
          <div style={{fontWeight:"600",fontSize:"13px",color:K.wh,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{p.titulo||"Imóvel sem título"}</div>
          {p.codigo_axis?<span style={{fontSize:"9.5px",fontWeight:700,padding:"1px 6px",borderRadius:3,background:"#002B8010",color:"#002B80",fontFamily:"monospace",flexShrink:0}}>{p.codigo_axis}</span>:<span style={{fontSize:10,color:C.hint}}>
            # pendente
          </span>}
        </div>
        <div style={{fontSize:"10.5px",color:K.t3,marginBottom:"8px"}}>📍 {p.cidade}/{p.estado} · {p.tipo} · {p.area_m2?`${p.area_m2}m²`:"—"}</div>
        <div style={{display:"flex",gap:"5px",flexWrap:"wrap",marginBottom:"10px"}}>
          <Bdg c={rc} ch={p.recomendacao||"—"}/>
          <Bdg c={p.ocupacao==="Desocupado"?K.grn:p.ocupacao==="Ocupado"?K.red:K.t3} ch={p.ocupacao||"—"}/>
          {p.financiavel&&<Bdg c={K.blue} ch="Financiável"/>}{p.analise_dupla_ia&&<span style={{fontSize:"9px",fontWeight:"700",background:"linear-gradient(135deg,rgba(0,229,187,0.2),rgba(16,163,127,0.2))",border:"1px solid rgba(0,229,187,0.35)",color:"#00E5BB",padding:"2px 8px",borderRadius:"4px",letterSpacing:".5px"}}>🤖 CLAUDE + GPT</span>}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px"}}>
          <div style={{background:K.s2,borderRadius:"5px",padding:"7px 10px"}}>
            <div style={{fontSize:"9px",color:K.t3,marginBottom:"2px"}}>MÍNIMO</div>
            <div style={{fontSize:"13px",fontWeight:"700",color:K.amb}}>{fmtC(p.valor_minimo)}</div>
          </div>
          <div style={{background:K.s2,borderRadius:"5px",padding:"7px 10px"}}>
            <div style={{fontSize:"9px",color:K.t3,marginBottom:"2px"}}>DESCONTO</div>
            <div style={{fontSize:"13px",fontWeight:"700",color:K.grn}}>{p.desconto_percentual?`${p.desconto_percentual}%`:"—"}</div>
          </div>
        </div>
      </div>
      <ScoreRing score={sc} size={70}/>
    </div>
    <div style={{fontSize:"10px",color:K.t3,marginTop:"10px",borderTop:`1px solid ${K.bd}`,paddingTop:"8px"}}>{fmtD(p.createdAt)} · {p.modalidade||"—"}</div>
  </div>
}

function AxisHeader({profile:prof, imoveis=[], onNav}) {
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef(null)

  const notifs = []
  const comprar = imoveis.filter(p => p.recomendacao === "COMPRAR")
  const forte = imoveis.filter(p => (p.score_total||0) >= 7.5)
  const alertas = imoveis.filter(p => (p.score_juridico||10) < 4)
  const recentes = [...imoveis].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0,3)

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
      padding:"18px 36px",background:C.white,borderBottom:`1px solid ${C.borderW}`,
    }}>
      <div>
        <h1 style={{margin:0,fontSize:22,fontWeight:700,color:C.navy,letterSpacing:"-0.5px"}}>Dashboard Executivo</h1>
        <p style={{margin:"2px 0 0",fontSize:13,color:C.muted}}>
          Visão consolidada da carteira de ativos em tempo real
        </p>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:14}}>
        <button style={{
          display:"flex",alignItems:"center",gap:7,whiteSpace:"nowrap",
          padding:"8px 16px",borderRadius:8,
          border:`1px solid ${C.borderW}`,background:C.white,color:C.navy,
          fontSize:13,fontWeight:500,cursor:"pointer",
        }}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <path d="M7.5 10L3 5.5h3V1h3v4.5h3L7.5 10z" stroke={C.navy} strokeWidth="1.3" strokeLinejoin="round"/>
            <path d="M2 12h11" stroke={C.navy} strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          Exportar
        </button>
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
              width:340,background:C.white,
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
  const avg=total?(props.reduce((s,p)=>s+(p.score_total||0),0)/total).toFixed(1):"0"
  const avgPct=total?Math.round((props.reduce((s,p)=>s+(p.score_total||0),0)/total)*10):0
  const recentes=[...props].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,4)
  const topAlerta=[...props].filter(p=>p.recomendacao!=="EVITAR").sort((a,b)=>(b.score_total||0)-(a.score_total||0))[0]
  const totalValor=props.reduce((s,p)=>s+(p.valor_minimo||0),0)
  const fmtM=v=>{if(v>=1e6)return`R$ ${(v/1e6).toFixed(1)}M`;if(v>=1e3)return`R$ ${(v/1e3).toFixed(0)}K`;return`R$ ${v}`}

  return <div style={{background:C.bg,minHeight:"100%"}}>
    <AxisHeader profile={prof} imoveis={props} onNav={onNav} />
    <div style={{padding:isPhone?"20px 16px":"28px 32px",display:"flex",flexDirection:"column",gap:20}}>
      {/* Linha 1: 3 colunas — Patrimônio | Valorização | Alertas */}
      <div style={{display:"grid",gridTemplateColumns:isPhone?"1fr":isMobile?"repeat(2,1fr)":"1fr 1fr 1fr",gap:18}}>
        {/* Card 1 — Patrimônio Monitorado (verde escuro) */}
        <div style={{
          background:"#064E3B",borderRadius:14,padding:"22px 24px",
          position:"relative",overflow:"hidden",
          boxShadow:"0 4px 20px rgba(5,168,109,0.25)",
        }}>
          <p style={{margin:"0 0 8px",fontSize:11,fontWeight:600,color:"rgba(255,255,255,0.7)",textTransform:"uppercase",letterSpacing:"0.8px"}}>
            Patrimônio Monitorado
          </p>
          <p style={{margin:"0 0 4px",fontSize:36,fontWeight:800,color:"#FFFFFF",letterSpacing:"-1.5px",lineHeight:1}}>
            {fmtM(totalValor)}
          </p>
          <p style={{margin:"8px 0 0",fontSize:13,color:"rgba(255,255,255,0.65)"}}>
            {total} ativo{total!==1?"s":""} sob gestão
          </p>
          <div style={{position:"absolute",bottom:16,right:20}}>
            <ArrowUpRight size={48} color="rgba(255,255,255,0.12)" strokeWidth={1.5} />
          </div>
        </div>
        {/* Card 2 — Score Médio */}
        <div style={{
          background:C.white,border:`1px solid ${C.borderW}`,
          borderRadius:14,padding:"22px 24px",
          boxShadow:"0 2px 12px rgba(0,43,128,0.06)",
        }}>
          <p style={{margin:"0 0 8px",fontSize:11,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:"0.8px"}}>
            Score Médio AXIS
          </p>
          <p style={{margin:"0 0 4px",fontSize:38,fontWeight:800,color:C.emerald,letterSpacing:"-1.5px",lineHeight:1}}>
            {avg}/10
          </p>
          <p style={{margin:"4px 0 0",fontSize:12.5,color:C.muted}}>Média da carteira ativa</p>
          <div style={{
            marginTop:14,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,
            paddingTop:12,borderTop:`1px solid ${C.borderW}`,
          }}>
            <div>
              <p style={{margin:0,fontSize:10.5,color:C.hint}}>Para comprar</p>
              <p style={{margin:"2px 0 0",fontSize:14,fontWeight:700,color:C.emerald}}>{comprar}</p>
              <p style={{margin:0,fontSize:10,color:C.hint}}>Recomendação positiva</p>
            </div>
            <div>
              <p style={{margin:0,fontSize:10.5,color:C.hint}}>Score forte</p>
              <p style={{margin:"2px 0 0",fontSize:14,fontWeight:700,color:C.emerald}}>{forte}</p>
              <p style={{margin:0,fontSize:10,color:C.hint}}>Score &ge; 7.5</p>
            </div>
          </div>
        </div>
        {/* Card 3 — Alertas / Destaque */}
        <div style={{
          background:C.white,border:`1px solid ${C.borderW}`,
          borderRadius:14,padding:"22px 24px",
          boxShadow:"0 2px 12px rgba(0,43,128,0.06)",
        }}>
          <p style={{margin:"0 0 10px",fontSize:11,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:"0.8px"}}>
            Alertas e Destaques
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
              background:C.emerald,color:"#fff",border:"none",fontSize:12.5,fontWeight:600,cursor:"pointer",
              display:"flex",alignItems:"center",justifyContent:"center",gap:6,
            }}>
              Analisar Ativo <ArrowUpRight size={15} />
            </button>
          </>:<p style={{fontSize:13,color:C.hint}}>Nenhum ativo analisado</p>}
        </div>
      </div>

      {/* Linha 2: Oportunidades Ativas */}
      <div style={{
        background:C.white,border:`1px solid ${C.borderW}`,
        borderRadius:14,padding:"20px 24px",
        display:"flex",alignItems:"center",justifyContent:"space-between",
        boxShadow:"0 2px 12px rgba(0,43,128,0.06)",
      }}>
        <div>
          <p style={{margin:"0 0 4px",fontSize:11,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:"0.8px"}}>
            Oportunidades Ativas
          </p>
          <p style={{margin:0,fontSize:42,fontWeight:800,color:C.navy,letterSpacing:"-2px",lineHeight:1}}>
            {total}
          </p>
          <p style={{margin:"4px 0 0",fontSize:12.5,color:C.muted}}>Score Médio AXIS</p>
        </div>
        <div style={{display:"flex",gap:14,alignItems:"center"}}>
          <svg width="80" height="80">
            <circle cx="40" cy="40" r="32" fill="none" stroke={C.emeraldL} strokeWidth="6"/>
            <circle cx="40" cy="40" r="32" fill="none" stroke={C.emerald} strokeWidth="6"
              strokeDasharray={`${(avgPct/100)*201} 201`}
              strokeLinecap="round" transform="rotate(-90 40 40)"/>
            <text x="40" y="37" textAnchor="middle" fontSize="18" fontWeight="800" fill={C.navy}>{avg}</text>
            <text x="40" y="50" textAnchor="middle" fontSize="10" fill={C.hint}>/10</text>
          </svg>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            <button onClick={()=>onNav("novo")} style={{
              padding:"8px 18px",borderRadius:7,
              background:C.emerald,color:"#fff",
              border:"none",fontSize:12.5,fontWeight:600,cursor:"pointer",
            }}>
              + Nova Análise
            </button>
            <div style={{display:"flex",gap:6}}>
              <span style={{fontSize:11,padding:"3px 8px",borderRadius:5,background:C.navyAlfa,color:C.navy,fontWeight:600}}>{comprar} comprar</span>
              <span style={{fontSize:11,padding:"3px 8px",borderRadius:5,background:C.emeraldL,color:C.emerald,fontWeight:600}}>{forte} forte</span>
            </div>
          </div>
        </div>
      </div>

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
            {recentes.map(p=><PropCard key={p.id} p={p} onNav={onNav}/>)}
          </div>
        </div>}
    </div>
  </div>
}
