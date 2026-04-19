import React, { useState, useEffect, useRef, lazy, Suspense } from "react"
import { stLoad, stSave } from "./storage.js"
const Charts = lazy(() => import('./components/Charts.jsx'))
import MobileNav from "./components/MobileNav.jsx"
import { useIsMobile } from "./hooks/useIsMobile.js"
const LazyBuscaGPT = lazy(() => import('./components/BuscaGPT.jsx'))
import { useAuth } from "./lib/AuthContext.jsx"
import Login from "./pages/Login.jsx"
import { supabase, getImoveis, deleteImovel } from "./lib/supabase.js"
import { detectarTipoTransacao, isMercadoDireto } from "./lib/detectarFonte.js"
const LazyTarefas = lazy(() => import('./pages/Tarefas.jsx'))
const LazySharedViewer = lazy(() => import('./components/SharedViewer.jsx'))
// motorIA carregado dinamicamente no momento do uso para reduzir bundle inicial
// trelloService carregado dinamicamente para reduzir bundle inicial
import { LayoutDashboard, TrendingUp, Package, ShieldCheck, FileText, BarChart3, Settings, Search, Bell, AlertTriangle, ArrowUpRight, Plus, MessageSquare, Scale, CheckSquare, LogOut } from "lucide-react"
import { C, K, RED, btn, inp, card, fmtC, fmtD, scoreColor, scoreLabel, recColor, mapDisplay, normalizarTextoAlerta, ESTRATEGIA_CONFIG, ESTRUTURA_MAP, LIQUIDEZ_MAP, TENDENCIA_MAP, DEMANDA_MAP } from "./appConstants.js"
import { MULT_CUSTO_RAPIDO } from "./lib/constants.js"

const LazyDashboard = lazy(() => import("./components/Dashboard.jsx"))
const LazyDetail = lazy(() => import("./components/Detail.jsx"))
const LazyPainelAdmin = lazy(() => import("./components/PainelAdmin.jsx"))
const LazyManualAxis = lazy(() => import("./components/ManualAxis.jsx"))

// Badge pill component
function Bdg({c, ch}) {
  return <span style={{background:c,color:'#fff',padding:'2px 8px',borderRadius:12,fontSize:11,fontWeight:600,whiteSpace:'nowrap'}}>{ch}</span>
}

const uid = () => Math.random().toString(36).slice(2,9) + Date.now().toString(36)

// Design tokens, utilities, shared components imported from appConstants.js

function AxisLogo({ collapsed = false, light = false, size }) {
  const textColor = light ? "#FFFFFF" : C.navy
  const arrowColor = C.emerald
  // backward compat: size="sm" or "lg" maps to collapsed
  const isCollapsed = collapsed || size === "sm"
  if (isCollapsed) {
    return (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <rect width="36" height="36" rx="9" fill={light ? "rgba(255,255,255,0.12)" : C.emeraldL}/>
        <text x="5" y="25" fontFamily="'Inter',sans-serif" fontWeight="900" fontSize="18" fill={light ? "#fff" : C.navy}>A</text>
        <line x1="19" y1="14" x2="28" y2="7" stroke={arrowColor} strokeWidth="2.5" strokeLinecap="round"/>
        <polyline points="24,7 28,7 28,11" fill="none" stroke={arrowColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 3, position: "relative" }}>
        <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 900, fontSize: 26, color: textColor, letterSpacing: "-1px", lineHeight: 1 }}>A</span>
        <span style={{ color: arrowColor, fontWeight: 900, fontSize: 18, lineHeight: 1, marginBottom: -2 }}>·</span>
        <span style={{ position: "relative", fontFamily: "'Inter',sans-serif", fontWeight: 900, fontSize: 26, color: textColor, letterSpacing: "-1px", lineHeight: 1 }}>
          X
          <svg style={{ position: "absolute", top: -2, left: 0, width: "100%", height: "110%", pointerEvents: "none" }} viewBox="0 0 20 28">
            <line x1="5" y1="16" x2="16" y2="4" stroke={arrowColor} strokeWidth="2.5" strokeLinecap="round"/>
            <polyline points="11,4 16,4 16,9" fill="none" stroke={arrowColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
        <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 900, fontSize: 26, color: textColor, letterSpacing: "-1px", lineHeight: 1 }}>IS.</span>
      </div>
      {!light && (
        <span style={{ fontSize: 8.5, color: C.muted, letterSpacing: "1.5px", textTransform: "uppercase", paddingLeft: 1 }}>
          Inteligência Patrimonial
        </span>
      )}
    </div>
  )
}

function Hdr({title,sub,actions}) {
  return <div style={{padding:"22px 28px 16px",borderBottom:`1px solid ${C.borderW}`,flexShrink:0,background:C.white}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"10px",flexWrap:"wrap"}}>
      <div>
        <div style={{fontWeight:"700",fontSize:"19px",color:C.text,letterSpacing:"-0.3px"}}>{title}</div>
        {sub&&<div style={{fontSize:"11px",color:C.hint,marginTop:"3px"}}>{sub}</div>}
      </div>
      {actions&&<div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>{actions}</div>}
    </div>
  </div>
}

function ScoreRing({score,size=80}) {
  const [displayed, setDisplayed] = useState(0)
  const animRef = useRef(null)
  const maxVal = size > 60 ? 10 : 100
  useEffect(() => {
    const target = score || 0
    const start = performance.now()
    const duration = 800
    if (animRef.current) cancelAnimationFrame(animRef.current)
    const animate = (now) => {
      const t = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      setDisplayed(target * ease)
      if (t < 1) animRef.current = requestAnimationFrame(animate)
    }
    animRef.current = requestAnimationFrame(animate)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [score])
  const c = maxVal === 10 ? scoreColor(displayed) : (displayed>=70?C.emerald:displayed>=50?C.mustard:"#E5484D")
  const r = (size-10)/2
  const circ = 2*Math.PI*r
  const dash = (displayed/maxVal)*circ
  return <div style={{position:"relative",width:size,height:size,flexShrink:0}}>
    <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={`${c}20`} strokeWidth={size>60?8:4}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={c} strokeWidth={size>60?8:4}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"/>
    </svg>
    <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",textAlign:"center"}}>
      <div style={{fontSize:size>70?"18px":"13px",fontWeight:"800",color:c,lineHeight:1}}>{displayed.toFixed(2)}</div>
      <div style={{fontSize:"8px",color:C.hint,textTransform:"uppercase",letterSpacing:".5px"}}>{scoreLabel(displayed)}</div>
    </div>
  </div>
}


// ── TRELLO ────────────────────────────────────────────────────────────────────
const BASE = "https://api.trello.com/1"
const tGet  = async (path,key,token) => { const sep=path.includes('?')?'&':'?'; const r=await fetch(`${BASE}${path}${sep}key=${key}&token=${token}`); if(!r.ok) throw new Error(await r.text()); return r.json() }
const tPost = async (path,key,token,body) => { const p=new URLSearchParams({key,token,...body}); const r=await fetch(`${BASE}${path}`,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:p}); if(!r.ok) throw new Error(await r.text()); return r.json() }

function buildTrelloCard(p) {
  const rc = p.recomendacao||"—"
  const score = (p.score_total||0).toFixed(1)
  const emoji = rc==="COMPRAR"?"🟢":rc==="AGUARDAR"?"🟡":"🔴"
  const desc = `## ${emoji} ${rc} — Score ${score}/10

**Endereço:** ${p.endereco||"—"}
**Tipo:** ${p.tipo||"—"} · ${p.area_m2||"—"}m² · ${p.quartos||"—"} quartos · ${p.vagas||"—"} vagas

---

### 💰 Valores
- **Avaliação:** ${fmtC(p.valor_avaliacao)}
- **${isMercadoDireto(p.fonte_url,p.tipo_transacao)?'Preço pedido':'Lance mínimo'}:** ${fmtC(isMercadoDireto(p.fonte_url,p.tipo_transacao)?(p.preco_pedido||p.valor_minimo):p.valor_minimo)}
- **Desconto:** ${p.desconto_percentual||"—"}%
- **Preço/m² imóvel:** R$ ${p.preco_m2_imovel||"—"}/m²
- **Preço/m² mercado:** R$ ${p.preco_m2_mercado||"—"}/m²

---

### ⚖️ Jurídico
- **Processos:** ${p.processos_ativos||"—"}
- **Matrícula:** ${p.matricula_status||"—"}
- **Déb. condomínio:** ${p.debitos_condominio||"—"}
- **Déb. IPTU:** ${p.debitos_iptu||"—"}
${p.obs_juridicas?`\n${p.obs_juridicas}`:""}

---

### 📊 Scores
| Dimensão | Score | Peso |
|---|---|---|
| Localização | ${p.score_localizacao||0}/10 | 20% |
| Desconto | ${p.score_desconto||0}/10 | 18% |
| Jurídico | ${p.score_juridico||0}/10 | 18% |
| Ocupação | ${p.score_ocupacao||0}/10 | 15% |
| Liquidez | ${p.score_liquidez||0}/10 | 15% |
| Mercado | ${p.score_mercado||0}/10 | 14% |
| **TOTAL** | **${score}/10** | |

---

### 📈 Retorno
- **Revenda:** +${p.retorno_venda_pct||"—"}%
- **Locação a.a.:** ${p.retorno_locacao_anual_pct||"—"}%
- **Custo regularização:** ${fmtC(p.custo_regularizacao)}
- **Custo reforma:** ${fmtC(p.custo_reforma)}
- **Estrutura recomendada:** ${p.estrutura_recomendada||"—"}

---

### ✅ Pontos Positivos
${(p.positivos||[]).map(x=>`- ${x}`).join("\n")||"—"}

### ⚠️ Pontos de Atenção
${(p.negativos||[]).map(x=>`- ${x}`).join("\n")||"—"}

### 🚨 Alertas
${(p.alertas||[]).map(x=>`- ${x}`).join("\n")||"Nenhum"}

---

### 💬 Justificativa
${p.justificativa||"—"}

---
*Analisado pelo AXIS · ${new Date().toLocaleDateString("pt-BR")}*
${p.fonte_url?`\n🔗 ${p.fonte_url}`:""}`

  return { name:`${emoji} [${score}] ${p.titulo||p.tipo||"Imóvel"} — ${p.cidade||""}`, desc }
}

// ── TRELLO CONFIG MODAL ───────────────────────────────────────────────────────
function TrelloModal({config,onSave,onClose}) {
  const [key,setKey]=useState(config?.key||"")
  const [token,setToken]=useState(config?.token||"")
  const [boards,setBoards]=useState([])
  const [boardId,setBoardId]=useState(config?.boardId||"")
  const [lists,setLists]=useState([])
  const [listId,setListId]=useState(config?.listId||"")
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState("")
  const [step,setStep]=useState(config?.token?2:1)

  const connect = async () => {
    if(!key.trim()||!token.trim()){setError("Informe a chave e o token");return}
    if(key.trim().length<10){setError("API Key inválida (muito curta)");return}
    if(token.trim().length<20){setError("Token inválido (muito curto)");return}
    setLoading(true);setError("")
    try { const b=await tGet("/members/me/boards?fields=id,name",key.trim(),token.trim()); setBoards(b);setStep(2) }
    catch(e){
      // Qualquer erro (CORS, invalid key, 401, etc) → avança para step 2 com boards vazio
      console.warn('[AXIS] Trello API error (prosseguindo):', e.message)
      setStep(2);setBoards([])
    }
    setLoading(false)
  }

  const fetchLists = async (bid) => {
    setBoardId(bid);setLists([]);setListId("")
    if(!bid)return
    setLoading(true)
    try { const l=await tGet(`/boards/${bid}/lists?fields=id,name`,key,token); setLists(l); if(l.length)setListId(l[0].id) }
    catch(e){
      console.warn('[AXIS] Trello lists error (prosseguindo):', e.message)
      setLists([])
    }
    setLoading(false)
  }

  const save = () => {
    if(!key||!token||!boardId||!listId){setError("Preencha todos os campos");return}
    onSave({key,token,boardId,listId,boardName:boards.find(b=>b.id===boardId)?.name||boardId,listName:lists.find(l=>l.id===listId)?.name||listId})
  }

  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"20px"}}>
    <div style={{background:K.s1,border:`1px solid ${K.bd}`,borderRadius:"10px",padding:"28px",maxWidth:"480px",width:"100%",maxHeight:"90vh",overflowY:"auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"20px"}}>
        <div>
          <div style={{fontWeight:"700",fontSize:"16px",color:K.wh}}>🔷 Configurar Trello</div>
          <div style={{fontSize:"11px",color:K.t3,marginTop:"2px"}}>Conecte ao seu board para envio automático</div>
        </div>
        <button style={btn("s")} onClick={onClose}>✕</button>
      </div>

      <div style={{marginBottom:"14px"}}>
        <div style={{fontSize:"10px",color:K.t3,textTransform:"uppercase",letterSpacing:"1px",marginBottom:"5px"}}>API Key</div>
        <input style={inp()} placeholder="Sua API Key do Trello" value={key} onChange={e=>setKey(e.target.value)}/>
        <div style={{fontSize:"10.5px",color:K.t3,marginTop:"4px"}}>Obtenha em: <a href="https://trello.com/app-key" target="_blank" rel="noopener noreferrer" style={{color:K.blue}}>trello.com/app-key</a></div>
      </div>
      <div style={{marginBottom:"16px"}}>
        <div style={{fontSize:"10px",color:K.t3,textTransform:"uppercase",letterSpacing:"1px",marginBottom:"5px"}}>Token</div>
        <input style={inp()} placeholder="Token de acesso" value={token} onChange={e=>setToken(e.target.value)}/>
        <div style={{fontSize:"10.5px",color:K.t3,marginTop:"4px"}}>Na mesma página, clique em "Token" e autorize</div>
      </div>

      {step===1&&<button style={btn("trello")} onClick={connect} disabled={loading}>{loading?"Conectando...":"Conectar ao Trello →"}</button>}

      {step===2&&<>
        {boards.length===0&&<div style={{background:`${K.amb}15`,border:`1px solid ${K.amb}40`,borderRadius:"6px",padding:"10px",marginBottom:"12px",fontSize:"12px",color:K.amb}}>⚠️ Não foi possível listar boards (possível bloqueio CORS). Insira os IDs manualmente.</div>}
        <div style={{marginBottom:"12px"}}>
          <div style={{fontSize:"10px",color:K.t3,textTransform:"uppercase",letterSpacing:"1px",marginBottom:"5px"}}>Board</div>
          {boards.length>0
            ?<select style={{...inp(),cursor:"pointer"}} value={boardId} onChange={e=>fetchLists(e.target.value)}>
              <option value="">— Selecione o board —</option>
              {boards.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            :<input style={inp()} placeholder="ID do board (ex: 5f4e3d2c1b0a)" value={boardId} onChange={e=>{setBoardId(e.target.value);setLists([]);setListId("")}}/>
          }
        </div>
        <div style={{marginBottom:"18px"}}>
          <div style={{fontSize:"10px",color:K.t3,textTransform:"uppercase",letterSpacing:"1px",marginBottom:"5px"}}>Lista de Destino</div>
          {lists.length>0
            ?<select style={{...inp(),cursor:"pointer"}} value={listId} onChange={e=>setListId(e.target.value)}>
              {lists.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            :<input style={inp()} placeholder="ID da lista (ex: 5f4e3d2c1b0b)" value={listId} onChange={e=>setListId(e.target.value)}/>
          }
        </div>
        <div style={{display:"flex",gap:"10px"}}>
          <button style={btn("trello")} onClick={save} disabled={!listId}>💾 Salvar</button>
          <button style={btn("s")} onClick={()=>setStep(1)}>← Voltar</button>
        </div>
      </>}

      {error&&<div style={{background:`${K.red}15`,border:`1px solid ${K.red}40`,borderRadius:"6px",padding:"10px",marginTop:"12px",fontSize:"12px",color:K.red}}>⚠️ {error}</div>}
 {error&&(error.includes('credit balance')||error.includes('balance is too low')||error.includes('insufficient_quota')||error.includes('billing'))&&<div style={{background:'rgba(245,166,35,0.1)',border:'1px solid rgba(245,166,35,0.3)',borderRadius:8,padding:'12px 14px',marginBottom:14}}><div style={{color:'#F5A623',fontWeight:700,marginBottom:4,fontSize:13}}>💳 Saldo da API insuficiente</div><div style={{color:'rgba(221,228,240,0.7)',fontSize:12,lineHeight:1.6}}>Adicione créditos em <b style={{color:'#fff'}}>platform.claude.com → Plans & Billing</b><br/>O app volta a funcionar automaticamente após adicionar saldo.</div></div>}
    </div>
  </div>
}

// ── MODAL AUDITORIA TRELLO ────────────────────────────────────────────────────
function ModalAuditoriaTrello({ config, imoveis, onClose }) {
  const [loading, setLoading] = useState(false)
  const [auditoria, setAuditoria] = useState(null)
  const [boards, setBoards] = useState([])
  const [msg, setMsg] = useState('')
  const { key, token, boardId } = config || {}

  useEffect(() => {
    if (key && token) carregarBoards()
  }, [])

  async function carregarBoards() {
    try {
      const { getBoardsAxis, AXIS_BOARDS } = await import('./lib/trelloService.js')
      const data = await getBoardsAxis(key, token)
      const idsOficiais = [AXIS_BOARDS.PIPELINE, AXIS_BOARDS.MANUAL]
      setBoards(data.filter(b => idsOficiais.includes(b.id)))
    } catch {}
  }

  async function criarWorkspace() {
    setLoading(true); setMsg('Criando workspace AXIS no Trello...')
    try {
      const { setupWorkspaceAxis } = await import('./lib/trelloService.js')
      const res = await setupWorkspaceAxis(key, token)
      const novoConfig = {
        ...config,
        boardId: res.boards.pipeline,
        boardManualId: res.boards.manual,
        listIds: res.lists,
      }
      localStorage.setItem('axis-trello', JSON.stringify(novoConfig))
      setMsg(`Workspace criado! ${Object.keys(res.lists).length} listas, ${Object.keys(res.labels).length} etiquetas.`)
      await carregarBoards()
    } catch(e) {
      setMsg(`Erro: ${e.message}`)
    }
    setLoading(false)
  }

  async function rodarAuditoria() {
    setLoading(true); setMsg('Auditando board...')
    try {
      const { auditarBoard, AXIS_BOARDS } = await import('./lib/trelloService.js')
      const bid = boardId || AXIS_BOARDS.PIPELINE
      const res = await auditarBoard(bid, key, token)
      setAuditoria(res)
      setMsg('')
    } catch(e) {
      setMsg(`Erro: ${e.message}`)
    }
    setLoading(false)
  }

  async function syncTodosImoveis() {
    const trelloConf = JSON.parse(localStorage.getItem('axis-trello') || '{}')
    if (!trelloConf?.key || !trelloConf?.token) {
      setMsg('Configure as credenciais do Trello primeiro.'); return
    }
    setLoading(true); setMsg('Preparando sincronização...')
    try {
      const { criarOuAtualizarCardImovel, getListasBoard } = await import('./lib/trelloService.js')
      const { AXIS_BOARDS } = await import('./lib/trelloService.js')
      let bid = boardId || trelloConf.boardId || AXIS_BOARDS.PIPELINE
      let listIds = trelloConf.listIds || {}
      if (bid !== AXIS_BOARDS.PIPELINE) {
        bid = AXIS_BOARDS.PIPELINE
        localStorage.setItem('axis-trello', JSON.stringify({ ...trelloConf, boardId: bid }))
      }
      // Buscar listas do board se não tiver salvas
      if (!Object.keys(listIds).length) {
        const listas = await getListasBoard(bid, key, token)
        for (const l of (listas || [])) listIds[l.name] = l.id
        localStorage.setItem('axis-trello', JSON.stringify({ ...trelloConf, boardId: bid, listIds }))
      }
      const getListId = (rec) => {
        if (rec === 'COMPRAR') return listIds['✅ Aprovados']
        if (rec === 'EVITAR')  return listIds['🚫 Descartados']
        return listIds['🔍 Em Análise'] || Object.values(listIds)[0]
      }
      if (!(imoveis || []).length) {
        setMsg('Nenhum imóvel encontrado para sincronizar.')
        setLoading(false); return
      }
      setMsg('Sincronizando imóveis (com deduplicação)...')
      let ok = 0, atualizado = 0, err = 0
      for (const imovel of (imoveis || [])) {
        try {
          const lid = getListId(imovel.recomendacao)
          if (!lid) { err++; continue }
          const res = await criarOuAtualizarCardImovel(imovel, lid, bid, key, token)
          if (res?.atualizado) atualizado++; else ok++
          setMsg(`Sincronizando... ${ok + atualizado}/${(imoveis||[]).length}`)
          await new Promise(r => setTimeout(r, 300))
        } catch { err++ }
      }
      setMsg(`${ok} criado(s), ${atualizado} atualizado(s)${err ? ` · ${err} erro(s)` : ''}`)
    } catch(e) {
      setMsg(`Erro ao sincronizar: ${e.message}`)
    }
    setLoading(false)
  }

  async function verificarDuplicatas() {
    if (!boardId) { setMsg('Configure o Board ID primeiro.'); return }
    setLoading(true); setMsg('Verificando duplicatas...')
    try {
      const { default: _unused, ...ts } = await import('./lib/trelloService.js').catch(() => ({}))
      const cardsBoard = await fetch(`https://api.trello.com/1/boards/${boardId}/cards?fields=id,name,closed&limit=1000&key=${key}&token=${token}`).then(r => r.json())
      const por_codigo = {}
      for (const card of cardsBoard.filter(c => !c.closed)) {
        const match = card.name.match(/\[AXIS-\d{4}\]/)
        if (match) {
          const codigo = match[0].replace(/[\[\]]/g, '')
          if (!por_codigo[codigo]) por_codigo[codigo] = []
          por_codigo[codigo].push(card)
        }
      }
      const duplicatas = Object.entries(por_codigo).filter(([, cards]) => cards.length > 1)
      if (duplicatas.length === 0) {
        setMsg('Nenhuma duplicata encontrada!')
      } else {
        setMsg(`${duplicatas.length} código(s) com duplicata: ${duplicatas.map(([c]) => c).join(', ')}`)
      }
    } catch(e) {
      setMsg(`Erro: ${e.message}`)
    }
    setLoading(false)
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
      <div style={{background:'#fff',borderRadius:16,padding:'28px 32px',width:'90vw',maxWidth:560,maxHeight:'90vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20}}>
          <div>
            <h2 style={{margin:0,fontSize:18,fontWeight:700,color:C.navy}}>Trello AXIS — Central de Controle</h2>
            <p style={{margin:'4px 0 0',fontSize:12.5,color:C.muted}}>Gerencie boards, sincronize imóveis e audite cards</p>
          </div>
          <button onClick={onClose} style={{border:'none',background:'none',fontSize:20,cursor:'pointer',color:C.muted}}>x</button>
        </div>
        {boards.length > 0 && (
          <div style={{marginBottom:16,padding:'12px 14px',background:C.emeraldL,borderRadius:10}}>
            <p style={{margin:'0 0 6px',fontSize:12,fontWeight:600,color:C.emerald}}>{boards.length} board(s) AXIS encontrado(s):</p>
            {boards.map(b => (
              <p key={b.id} style={{margin:'2px 0',fontSize:12,color:C.navy}}>
                {b.name} · <a href={b.url} target="_blank" rel="noreferrer" style={{color:C.emerald}}>abrir</a>
              </p>
            ))}
          </div>
        )}
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <button onClick={criarWorkspace} disabled={loading}
            style={{padding:'11px 0',borderRadius:9,border:'none',background:C.navy,color:'#fff',fontSize:13.5,fontWeight:600,cursor:loading?'wait':'pointer'}}>
            Configurar Workspace AXIS
          </button>
          <button onClick={rodarAuditoria} disabled={loading}
            style={{padding:'11px 0',borderRadius:9,border:`1px solid ${C.navy}`,background:'#fff',color:C.navy,fontSize:13.5,fontWeight:600,cursor:loading?'not-allowed':'pointer'}}>
            Auditar Board Pipeline
          </button>
          <button onClick={syncTodosImoveis} disabled={loading}
            style={{padding:'11px 0',borderRadius:9,border:'none',background:C.emerald,color:'#fff',fontSize:13.5,fontWeight:600,cursor:loading?'not-allowed':'pointer'}}>
            Sincronizar {imoveis?.length||0} imóvel(is)
          </button>
          <button onClick={verificarDuplicatas} disabled={loading||!boardId}
            style={{padding:'11px 0',borderRadius:9,border:`1px solid ${C.mustard}`,background:C.mustardL,color:C.mustard,fontSize:13.5,fontWeight:600,cursor:(loading||!boardId)?'not-allowed':'pointer'}}>
            Verificar Duplicatas
          </button>
        </div>
        {msg && (
          <div style={{marginTop:14,padding:'10px 14px',borderRadius:8,background:msg.includes('Erro')?'#FEE8E8':C.emeraldL,fontSize:13,color:msg.includes('Erro')?'#C0392B':C.emerald}}>
            {msg}
          </div>
        )}
        {auditoria && (
          <div style={{marginTop:16,padding:'14px 16px',background:C.surface,borderRadius:10}}>
            <p style={{margin:'0 0 10px',fontWeight:600,fontSize:14,color:C.navy}}>Resultado da Auditoria</p>
            <p style={{margin:'3px 0',fontSize:13,color:C.text}}>Board: {auditoria.board?.name}</p>
            <p style={{margin:'3px 0',fontSize:13,color:C.text}}>Total de cards: {auditoria.cards_total}</p>
            <p style={{margin:'3px 0',fontSize:13,color:C.text}}>Listas: {auditoria.listas?.map(l=>l.nome).join(', ')}</p>
            {auditoria.cards_sem_foto?.length>0 && (
              <p style={{margin:'6px 0 0',fontSize:12.5,color:C.mustard}}>Sem foto: {auditoria.cards_sem_foto.join(', ')}</p>
            )}
            {auditoria.cards_sem_checklist?.length>0 && (
              <p style={{margin:'4px 0',fontSize:12.5,color:C.mustard}}>Sem checklist: {auditoria.cards_sem_checklist.join(', ')}</p>
            )}
            {auditoria.erros?.length>0 && (
              <p style={{margin:'4px 0',fontSize:12.5,color:'#C0392B'}}>Erros: {auditoria.erros.join(', ')}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── API KEY MODAL ─────────────────────────────────────────────────────────────
function ApiKeyModal({onClose, session}) {
 const [key,setKey]=useState(localStorage.getItem("axis-api-key")||"")
 const [oaiKey,setOaiKey]=useState(localStorage.getItem("axis-openai-key")||"")
 const [geminiKey,setGeminiKey]=useState(localStorage.getItem("axis-gemini-key")||"")
 const [deepseekKey,setDeepseekKey]=useState(localStorage.getItem("axis-deepseek-key")||"")
 const [modoTeste,setModoTeste]=useState(localStorage.getItem('axis-modo-teste')==='true')
 const [saving,setSaving]=useState(false)
 // Carregar do Supabase ao abrir (se logado)
 useEffect(()=>{
   if(!session?.user?.id) return
   import('./lib/supabase.js').then(({loadApiKeys})=>{
     loadApiKeys(session.user.id).then(({claudeKey,openaiKey,geminiKey,deepseekKey})=>{
       if(claudeKey){setKey(claudeKey);localStorage.setItem('axis-api-key',claudeKey)}
       if(openaiKey){setOaiKey(openaiKey);localStorage.setItem('axis-openai-key',openaiKey)}
       if(geminiKey){setGeminiKey(geminiKey);localStorage.setItem('axis-gemini-key',geminiKey)}
       if(deepseekKey){setDeepseekKey(deepseekKey);localStorage.setItem('axis-deepseek-key',deepseekKey)}
     })
   })
 },[session])
 const save=async()=>{
   const k=key.trim(),ok=oaiKey.trim()
   if(k)localStorage.setItem("axis-api-key",k)
   if(ok)localStorage.setItem("axis-openai-key",ok)
   if(session?.user?.id&&(k||geminiKey||deepseekKey)){
     setSaving(true)
     try{const{persistApiKeys}=await import('./lib/supabase.js');await persistApiKeys(session.user.id,{claudeKey:k,openaiKey:ok,geminiKey:geminiKey||'',deepseekKey:deepseekKey||''})}catch(e){console.warn('[AXIS] save keys:',e)}finally{setSaving(false)}
   }
   onClose()
 }
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"20px"}}>
    <div style={{background:K.s1,border:`1px solid ${K.bd}`,borderRadius:"10px",padding:"28px",maxWidth:"480px",width:"100%"}}>
      {/* Status dos providers */}
      <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
        {[
          ['Claude', key, 'claude'],
          ['OpenAI', oaiKey, 'openai'],
          ['Gemini', localStorage.getItem('axis-gemini-key')||'', 'gemini'],
          ['DeepSeek', localStorage.getItem('axis-deepseek-key')||'', 'deepseek'],
          ['Trello', localStorage.getItem('axis-trello-key')||'', 'trello'],
        ].map(([label, val]) => (
          <div key={label} style={{
            display:'flex',alignItems:'center',gap:4,
            padding:'3px 10px',borderRadius:12,fontSize:11,fontWeight:600,
            background: val ? '#E6F7F0' : '#FFF0F0',
            color: val ? '#085041' : '#791F1F'
          }}>
            <div style={{width:6,height:6,borderRadius:'50%',background:val?'#1D9E75':'#E24B4A'}}/>
            {label}: {val ? 'OK' : 'ausente'}
          </div>
        ))}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:"20px"}}>
        <div>
 <div style={{fontWeight:"700",fontSize:"16px",color:K.wh}}>🔑 Chaves de API</div>
 <div style={{fontSize:"11px",color:K.t3,marginTop:"2px"}}>Necessárias para análise com IA</div>
        </div>
        <button style={btn("s")} onClick={onClose}>✕</button>
      </div>
      <div style={{marginBottom:"8px"}}>
        <div style={{fontSize:"10px",color:K.t3,textTransform:"uppercase",letterSpacing:"1px",marginBottom:"5px"}}>Chave da API</div>
        <input style={inp()} type="password" placeholder="sk-ant-..." value={key} onChange={e=>setKey(e.target.value)}/>
      </div>
      <div style={{fontSize:"11px",color:K.t3,marginBottom:"18px"}}>
        Obtenha em: <a href="https://platform.claude.com/settings/keys" target="_blank" rel="noopener noreferrer" style={{color:K.blue}}>platform.claude.com</a>
      </div>
 <div style={{marginTop:"16px",marginBottom:"8px"}}>
  <div style={{fontSize:"10px",color:K.t3,textTransform:"uppercase",letterSpacing:"1px",marginBottom:"5px"}}>Chave OpenAI (ChatGPT) — opcional</div>
  <input style={inp()} type="password" placeholder="sk-..." value={oaiKey} onChange={e=>setOaiKey(e.target.value)}/>
 </div>
 <div style={{fontSize:"11px",color:K.t3,marginBottom:"18px"}}>
  Obtenha em: <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" style={{color:K.blue}}>platform.openai.com</a> · Usada na Busca GPT
 </div>
 <div style={{marginTop:"16px",marginBottom:"8px"}}>
  <div style={{fontSize:"10px",color:K.t3,textTransform:"uppercase",letterSpacing:"1px",marginBottom:"5px"}}>Gemini API Key — motor principal (~R$0,03)</div>
  <input style={inp()} type="password" placeholder="AIza..." value={geminiKey} onChange={e=>{setGeminiKey(e.target.value);localStorage.setItem('axis-gemini-key',e.target.value||'')}}/>
 </div>
 <div style={{fontSize:"11px",color:K.t3,marginBottom:"18px"}}>
  Obtenha grátis em: <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" style={{color:K.blue}}>aistudio.google.com</a> · Motor principal — analisa + fotos
 </div>
 <div style={{marginTop:"16px",marginBottom:"8px"}}>
  <div style={{fontSize:"10px",color:K.t3,textTransform:"uppercase",letterSpacing:"1px",marginBottom:"5px"}}>DeepSeek API Key — fallback (~R$0,08)</div>
  <input style={inp()} type="password" placeholder="sk-..." value={deepseekKey} onChange={e=>{setDeepseekKey(e.target.value);localStorage.setItem('axis-deepseek-key',e.target.value||'')}}/>
 </div>
 <div style={{fontSize:"11px",color:K.t3,marginBottom:"18px"}}>
  Opcional: <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener noreferrer" style={{color:K.blue}}>platform.deepseek.com</a> · Usado se Gemini falhar
 </div>
      <div style={{background:`${K.amb}10`,border:`1px solid ${K.amb}30`,borderRadius:"6px",padding:"12px",marginBottom:"16px",fontSize:"11.5px",color:K.amb}}>
 ⚠️ As chaves são salvas no Supabase (por usuário) e sincronizadas entre dispositivos. Nunca enviadas para servidores externos além da Anthropic/OpenAI.
      </div>
      <div style={{marginTop:16,display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px',background:K.s2,borderRadius:8,border:`1px solid ${K.bd}`}}>
        <div>
          <p style={{margin:0,fontSize:13,fontWeight:600,color:K.wh}}>Modo Teste</p>
          <p style={{margin:0,fontSize:11,color:K.t3}}>Análises sem custo de API — para desenvolvimento</p>
        </div>
        <button onClick={()=>{const atual=modoTeste;localStorage.setItem('axis-modo-teste',String(!atual));setModoTeste(!atual)}} style={{padding:'6px 16px',borderRadius:20,border:'none',fontWeight:700,fontSize:12,cursor:'pointer',background:modoTeste?K.teal:K.s2,color:modoTeste?'#fff':K.t3}}>
          {modoTeste?'✅ Ativo':'Desativado'}
        </button>
      </div>
      <button style={{...btn(),marginTop:12}} onClick={save}>💾 Salvar</button>
    </div>
  </div>
}

// ── NOVO IMÓVEL ───────────────────────────────────────────────────────────────
function NovoImovel({onSave,onCancel,onNav,trello,parametrosBanco,criteriosBanco,isPhone,existingProps=[]}) {
  const [url,setUrl]=useState("")
  const [loading,setLoading]=useState(false)
  const [step,setStep]=useState("")
  const [error,setError]=useState("")
  const [trelloMsg,setTrelloMsg]=useState("")
  const [anexos,setAnexos]=useState([])
  const [urlsDocumentos,setUrlsDocumentos]=useState("")
  const [duplicado,setDuplicado]=useState(null)
  const fileRef=useRef(null)

  const analyze = async () => {
    if(!url.trim()){setError("Cole o link do leilão");return}
    // Validação de URL
    const urlTrimmed = url.trim()
    if (!urlTrimmed.startsWith('http')) {
      setError('URL inválida — deve começar com http:// ou https://')
      return
    }
    const dominiosConhecidos = ['megaleiloes','zuk','caixa.gov','tjmg','trt','leilaoimovel','superbid','sold','99lotes','marcoantonioleiloeiro','lancemax','rerum','hgleiloes','leilaovip','remateweb','sandreleiloes','jlmleiloes','figueiredo','remateweb','dynamicleiloes']
    const dominiosMercado = ['vivareal','zapimoveis','zap.com','olx.com','quintoandar','123i.com','chavesnamao','imovelweb','lugarescerto','mgf.com','loft.com','navent.com','mercadolivre']
    const urlLower = urlTrimmed.toLowerCase()
    const dominioReconhecido = dominiosConhecidos.some(d => urlLower.includes(d))
    const dominioMercado = dominiosMercado.some(d => urlLower.includes(d))
    if (!dominioReconhecido && !dominioMercado) {
      const continuar = window.confirm(
        'URL não reconhecida como portal de leilão ou imobiliário conhecido.\n\nDomínios suportados: Mega Leilões, Zuk, Caixa, TJMG, TRT, Superbid, QuintoAndar, ZAP, VivaReal, OLX, Loft.\n\nDeseja analisar mesmo assim?'
      )
      if (!continuar) return
    }
    if (dominioMercado) {
      setStep('🏠 Portal de mercado detectado — analisando como oportunidade')
    }
    // DETECÇÃO DE PÁGINA DE CONDOMÍNIO — múltiplos imóveis
    try {
      const { isCondominioPage, extrairLinksCondominio } = await import('./lib/scraperImovel.js')
      if (isCondominioPage(urlTrimmed)) {
        setLoading(true); setStep('🏢 Página de condomínio detectada — buscando imóveis individuais...')
        const geminiKey = localStorage.getItem("axis-gemini-key") || ""
        const info = await extrairLinksCondominio(urlTrimmed, geminiKey)
        setLoading(false)

        // Se Gemini Grounding retornou dados completos dos imóveis (sem precisar de links)
        const imoveisGrounding = info._imoveis || []

        if (info.links.length > 0 || imoveisGrounding.length > 0) {
          const totalImoveis = info.links.length || imoveisGrounding.length
          const precoInfo = imoveisGrounding.length > 0
            ? imoveisGrounding.map((im,i) => `${i+1}. R$ ${(im.preco||0).toLocaleString('pt-BR')} · ${im.area_m2||'?'}m² · ${im.quartos||'?'}q · ${im.vagas||'?'}v`).join('\n')
            : (info.precoMinimo > 0 ? `A partir de R$ ${info.precoMinimo.toLocaleString('pt-BR')}` : '')
          const alugInfo = info.aluguelReferencia ? `\n📊 Ref. aluguel no prédio: R$ ${info.aluguelReferencia.toLocaleString('pt-BR')}/mês` : ''
          const confirmar = window.confirm(
            `🏢 ${info.condominio || 'Condomínio'}\n` +
            `📍 ${info.endereco || info.bairro || ''} ${info.cidade ? '— ' + info.cidade : ''}\n` +
            `${precoInfo ? '\n🏠 Imóveis para COMPRA:\n' + precoInfo + '\n' : ''}` +
            `${alugInfo}\n` +
            `\n✅ ${totalImoveis} apartamento(s) para compra encontrado(s).\n` +
            `${info.aluguelReferencia ? '(Aluguel do prédio será usado como referência de yield)\n' : ''}` +
            `\nAnalisar ${totalImoveis === 1 ? 'este imóvel' : 'todos os ' + totalImoveis} individualmente?`
          )
          if (confirmar) {
            setLoading(true)
            // Se temos links individuais → analisar cada um
            if (info.links.length > 0) {
              for (let i = 0; i < info.links.length; i++) {
                setStep(`🏠 Analisando imóvel ${i + 1}/${info.links.length}...`)
                try {
                  const openaiKey = localStorage.getItem("axis-openai-key") || ""
                  const claudeKeyReal = localStorage.getItem("axis-api-key") || ""
                  const { analisarImovelCompleto: _analisarImovelCompleto } = await import('./lib/motorIA.js')
                  const data = await _analisarImovelCompleto(info.links[i], claudeKeyReal, openaiKey, parametrosBanco, criteriosBanco, (msg) => setStep(`[${i+1}/${info.links.length}] ${msg}`), [], null, null)
                  data.fonte_url = info.links[i]
                  if (!data.tipo_transacao) data.tipo_transacao = 'mercado_direto'
                  // Usar aluguel de referência do condomínio se disponível
                  if (info.aluguelReferencia && (!data.aluguel_mensal_estimado || data.aluguel_mensal_estimado === 0)) {
                    data.aluguel_mensal_estimado = info.aluguelReferencia
                  }
                  if (info.condominioMensal && !data.condominio_mensal) {
                    data.condominio_mensal = info.condominioMensal
                  }
                  const precoOk = parseFloat(data.valor_minimo || data.preco_pedido) > 0
                  const tituloOk = data.titulo && data.titulo.length > 5
                  if (precoOk || tituloOk) {
                    const property = {...data, id:uid(), createdAt:new Date().toISOString()}
                    await onSave(property)
                    showToast(`✓ [${i+1}/${info.links.length}] ${data.titulo?.substring(0,40)||'Imóvel'} — Score ${(data.score_total||0).toFixed(1)}`)
                  } else {
                    showToast(`⚠️ [${i+1}/${info.links.length}] Dados insuficientes — pulando`, '#E5484D')
                  }
                } catch(e) {
                  showToast(`⚠️ [${i+1}/${info.links.length}] Erro: ${e.message?.substring(0,60)}`, '#E5484D')
                }
              }
            }
            // Se temos dados diretos do Grounding (sem links) → analisar cada imóvel via Grounding individual
            else if (imoveisGrounding.length > 0) {
              for (let i = 0; i < imoveisGrounding.length; i++) {
                const im = imoveisGrounding[i]
                setStep(`🏠 Analisando imóvel ${i + 1}/${imoveisGrounding.length}: ${im.descricao || ''}...`)
                try {
                  // Se tem link individual → usar pipeline normal
                  if (im.link && im.link.includes('/imovel/')) {
                    const openaiKey = localStorage.getItem("axis-openai-key") || ""
                    const claudeKeyReal = localStorage.getItem("axis-api-key") || ""
                    const { analisarImovelCompleto: _analisarImovelCompleto } = await import('./lib/motorIA.js')
                    const data = await _analisarImovelCompleto(im.link, claudeKeyReal, openaiKey, parametrosBanco, criteriosBanco, (msg) => setStep(`[${i+1}/${imoveisGrounding.length}] ${msg}`), [], null, null)
                    data.fonte_url = im.link
                    if (!data.tipo_transacao) data.tipo_transacao = 'mercado_direto'
                    if (!data.preco_pedido && im.preco) { data.preco_pedido = im.preco; data.valor_minimo = im.preco }
                    const property = {...data, id:uid(), createdAt:new Date().toISOString()}
                    await onSave(property)
                    showToast(`✓ [${i+1}/${imoveisGrounding.length}] ${data.titulo?.substring(0,40)||im.descricao||'Imóvel'}`)
                  } else {
                    // Sem link → criar card com dados do Grounding diretamente
                    const alugRef = info.aluguelReferencia || (im.preco ? Math.round(im.preco * 0.005) : 0)
                    const property = {
                      id: uid(), createdAt: new Date().toISOString(),
                      titulo: `Apt ${im.quartos||''}q ${im.area_m2||''}m² — ${info.bairro||info.condominio}, ${info.cidade||'Contagem'}`,
                      tipo_transacao: 'mercado_direto',
                      fonte_url: urlTrimmed,
                      preco_pedido: im.preco || 0, valor_minimo: im.preco || 0,
                      area_m2: im.area_m2 || 0, area_privativa_m2: im.area_m2 || 0,
                      quartos: im.quartos || 0, vagas: im.vagas || 0,
                      bairro: info.bairro || '', cidade: info.cidade || 'Contagem', estado: 'MG',
                      endereco: info.endereco || '',
                      tipo: 'Apartamento', tipologia: 'apartamento_padrao',
                      aluguel_mensal_estimado: alugRef,
                      condominio_mensal: info.condominioMensal || null,
                      valor_mercado_estimado: im.preco || 0,
                      preco_m2_imovel: (im.area_usada_calculo_m2||im.area_privativa_m2||im.area_m2) > 0 ? Math.round((im.preco||0) / (im.area_usada_calculo_m2||im.area_privativa_m2||im.area_m2)) : 0,
                      preco_m2_mercado: (im.area_usada_calculo_m2||im.area_privativa_m2||im.area_m2) > 0 ? Math.round((im.preco||0) / (im.area_usada_calculo_m2||im.area_privativa_m2||im.area_m2)) : 0,
                      score_total: 0, recomendacao: 'AGUARDAR',
                      _modelo_usado: 'gemini-grounding-condominio',
                      alertas: ['[INFO] Dados via Gemini Grounding — reanalisar para score completo'],
                    }
                    await onSave(property)
                    showToast(`✓ [${i+1}/${imoveisGrounding.length}] ${im.descricao||'Imóvel'} · R$ ${(im.preco||0).toLocaleString('pt-BR')}`)
                  }
                } catch(e) {
                  showToast(`⚠️ [${i+1}/${imoveisGrounding.length}] Erro: ${e.message?.substring(0,60)}`, '#E5484D')
                }
              }
            }
            setLoading(false); setStep('')
            showToast(`✅ ${totalImoveis} apartamento(s) do condomínio processado(s)`)
            return
          } else { setLoading(false); return }
        } else {
          setLoading(false)
          setError(
            `🏢 Esta é uma página de condomínio (${info.condominio || 'sem nome'}) — não um anúncio individual.\n\n` +
            `Não foi possível encontrar links de imóveis individuais.\n\n` +
            `💡 No QuintoAndar, clique em um apartamento específico e copie o link no formato:\nquintoandar.com.br/imovel/XXXXX`
          )
          return
        }
      }
    } catch(e) { console.warn('[AXIS] Detecção condomínio:', e.message) }
    const hasKey = localStorage.getItem("axis-api-key")
    const hasGemini = localStorage.getItem("axis-gemini-key")
    const hasDeepseek = localStorage.getItem("axis-deepseek-key")
    if(!hasKey && !hasGemini && !hasDeepseek){setError("Configure ao menos uma chave de IA nas Configurações (⚙️): Gemini (grátis), DeepSeek ou Claude.");return}
    // Verificar permissão de uso da API
    try {
      const { supabase } = await import('./lib/supabase.js')
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: perfil } = await supabase.from('profiles').select('pode_usar_api, role').eq('id', user.id).single()
        const podeUsar = perfil?.role === 'admin' || perfil?.pode_usar_api === true
        if (!podeUsar) { setError('⚠️ Acesso à análise por IA não liberado. Solicite ao administrador.'); return }
      }
    } catch (e) { console.warn('[AXIS] Verificação pode_usar_api:', e.message) }
    // Verificar duplicata: local primeiro, depois Supabase
    if(!duplicado) {
      const urlNorm=url.trim()
      // 1. Verificar no state local (sempre funciona)
      const localDup=existingProps.find(p=>(p.fonte_url||p.url||'')===urlNorm)
      if(localDup){setDuplicado(localDup);return}
      // 2. Verificar no Supabase
      try {
        const{verificarImovelDuplicado}=await import('./lib/supabase.js')
        const dups=await verificarImovelDuplicado(urlNorm)
        if(dups?.length>0){setDuplicado(dups[0]);return}
      } catch(e){console.warn('[AXIS] Verificação Supabase falhou, usando local:',e.message)}
    }
    setDuplicado(null)
    setLoading(true);setError("");setTrelloMsg("")
    setStep("🔍 Buscando informações do imóvel...")
    try {
      setStep("🧠 IA analisando: score, risco jurídico, mercado...")
      const openaiKey = localStorage.getItem("axis-openai-key") || ""
      const claudeKeyReal = localStorage.getItem("axis-api-key") || ""
        const { analisarImovelCompleto: _analisarImovelCompleto } = await import('./lib/motorIA.js')
        const data = await _analisarImovelCompleto(url.trim(), claudeKeyReal, openaiKey, parametrosBanco, criteriosBanco, (msg) => setStep(msg), anexos, null, null)
      data.fonte_url = url.trim()
      // Detectar tipo de transação (leilão vs mercado direto) pela URL
      if (!data.tipo_transacao) {
        data.tipo_transacao = detectarTipoTransacao(url.trim())
      }
      // Analisar documentos (edital, RGI, débitos) se fornecidos
      const docUrls = urlsDocumentos.split('\n').map(u=>u.trim()).filter(Boolean)
      if (docUrls.length > 0) {
        try {
          setStep("📄 Analisando documentos do leilão...")
          const { analisarDocumentos } = await import('./lib/analisadorDocumentos.js')
          const docs = await analisarDocumentos(docUrls, hasKey, (msg) => setStep(msg))
          if (docs.edital) {
            data.edital_dados = docs.edital
            if (docs.edital.valor_avaliacao && !data.valor_avaliacao) data.valor_avaliacao = docs.edital.valor_avaliacao
            if (docs.edital.data_leilao && !data.data_leilao) data.data_leilao = docs.edital.data_leilao
            if (docs.edital.leiloeiro && !data.leiloeiro) data.leiloeiro = docs.edital.leiloeiro
            if (docs.edital.comissao_pct && !data.comissao_leiloeiro_pct) data.comissao_leiloeiro_pct = docs.edital.comissao_pct
            if (docs.edital.ocupacao && !data.ocupacao) data.ocupacao = docs.edital.ocupacao
            if (docs.edital.processo_numero && !data.processo_numero) data.processo_numero = docs.edital.processo_numero
          }
          if (docs.rgi) {
            data.rgi_dados = docs.rgi
            if (!data.area_usada_calculo_m2) data.area_usada_calculo_m2 = docs.rgi.area_privativa_m2 || docs.rgi.area_m2
            if (docs.rgi.onus?.length > 0) data.riscos_presentes = [...(data.riscos_presentes||[]), ...docs.rgi.onus]
          }
          if (docs.debitos) {
            data.debitos_dados = docs.debitos
            if (docs.debitos.iptu_atraso) data.debitos_iptu = `R$ ${docs.debitos.iptu_atraso.toLocaleString('pt-BR')}`
            if (docs.debitos.condominio_atraso) data.debitos_condominio = `R$ ${docs.debitos.condominio_atraso.toLocaleString('pt-BR')}`
            if (docs.debitos.responsabilidade_arrematante === false) data.responsabilidade_debitos = 'sub_rogado'
            else if (docs.debitos.responsabilidade_arrematante === true) data.responsabilidade_debitos = 'arrematante'
          }
          if (docs.erros.length > 0) setTrelloMsg(prev => (prev ? prev + ' | ' : '') + `⚠️ Docs: ${docs.erros.join('; ')}`)
        } catch (e) { console.warn('[AXIS] Erro documentos:', e.message) }
      }
      // NUNCA salvar dados do modo_teste no banco
      if (data.modo_teste === true) {
        setError('⚠️ Modo Teste ativo — desative em Admin → Config antes de analisar.')
        setLoading(false); setStep(''); return
      }
      const property = {...data, id:uid(), createdAt:new Date().toISOString()}
      if(trello?.listId&&trello?.boardId) {
        setStep("🔷 Enviando para o Trello...")
        try {
          const { criarCardImovel } = await import('./lib/trelloService.js')
          await criarCardImovel(property,trello.listId,trello.boardId,trello.key,trello.token)
          setTrelloMsg("✓ Card criado no Trello com etiquetas")
        } catch(e){ setTrelloMsg(`⚠️ Salvo no app, erro Trello: ${e.message}`) }
      }
      // Mostrar modelo usado e avisar se análise foi parcial
      const modeloUsado = data._modelo_usado || 'desconhecido'
      if (modeloUsado === 'regex_fallback') {
        setTrelloMsg(prev => (prev ? prev + ' | ' : '') + '⚠️ Análise parcial sem IA — configure Gemini ou Claude')
      } else {
        setTrelloMsg(prev => (prev ? prev + ' | ' : '') + `✅ Motor: ${modeloUsado}`)
      }
      // VALIDAÇÃO: verificar se a análise retornou dados mínimos viáveis
      const precoValido = parseFloat(data.valor_minimo || data.preco_pedido) > 0
      const tituloValido = data.titulo && data.titulo.length > 5 && !data.titulo.includes('undefined')
      const scoreValido = parseFloat(data.score_total) > 0
      if (!precoValido && !tituloValido) {
        setError(`⚠️ Análise falhou — não foi possível extrair dados do imóvel.\n\n` +
          `Motivo provável: o site (${new URL(url.trim()).hostname}) é um SPA que bloqueia scraping.\n\n` +
          `💡 Tente buscar o mesmo imóvel no VivaReal ou ZAP Imóveis e colar essa URL.`)
        setLoading(false); setStep(''); return
      }
      if (!scoreValido) {
        data.alertas = [...(data.alertas || []), '[AVISO] Score zerado — análise incompleta, verifique os dados']
      }
      onSave(property)
    } catch(e){
      // Mostrar erro detalhado para o usuário saber o que falhou
      const errMsg = e.message || 'Erro na análise.'
      setError(errMsg)
      console.error('[AXIS NovoImovel] Erro análise:', e)
    }
    setLoading(false);setStep("")
  }

  return <div>
    <Hdr title="Analisar Imóvel" sub="Cole o link do leilão ou portal imobiliário — IA busca e analisa tudo automaticamente"/>
    <div style={{padding:isPhone?"20px 16px":"24px 28px",maxWidth:"640px"}}>
      {trello?.listId
        &&<div style={{background:`${K.trello}15`,border:`1px solid ${K.trello}40`,borderRadius:"7px",padding:"12px 16px",marginBottom:"18px",display:"flex",alignItems:"center",gap:"10px"}}>
          <span style={{fontSize:"18px"}}>🔷</span>
          <div><div style={{fontSize:"12.5px",color:K.wh,fontWeight:"600"}}>Trello conectado</div>
          <div style={{fontSize:"11px",color:K.t3}}>{trello.boardName} → {trello.listName}</div></div>
          <span style={{marginLeft:"auto",fontSize:"9px",background:`${K.grn}20`,color:K.grn,padding:"2px 8px",borderRadius:"3px",fontWeight:"700"}}>ATIVO</span>
        </div>}

      <div style={{marginBottom:"16px"}}>
        <div style={{fontSize:"10px",color:K.t3,textTransform:"uppercase",letterSpacing:"1px",marginBottom:"6px"}}>Link do Imóvel *</div>
        <input type="url" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} style={{...inp(),fontSize:isPhone?16:14,padding:isPhone?'14px 16px':'10px 14px'}} placeholder="https://www.quintoandar.com.br/... ou https://venda-imoveis.caixa.gov.br/..." value={url} onChange={e=>setUrl(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")analyze()}}/>
        <div style={{fontSize:"11px",color:K.t3,marginTop:"5px"}}>Leilão (CAIXA, Zuk, Mega) ou mercado (QuintoAndar, ZAP, VivaReal, OLX)</div>

      <div style={{marginTop:"12px"}}>
        <label style={{fontSize:"13px",color:K.t2,fontWeight:600,display:"block",marginBottom:"6px"}}>📎 Anexar arquivos (opcional)</label>
        <input ref={fileRef} type="file" multiple accept=".txt,.pdf,image/*" style={{display:"none"}} onChange={e=>{
          const newFiles=[...anexos]
          Array.from(e.target.files).forEach(f=>{
            const reader=new FileReader()
            if(f.type.startsWith("image/")){
              reader.onload=()=>newFiles.push({name:f.name,type:"image",data:reader.result})&&setAnexos([...newFiles])
              reader.readAsDataURL(f)
            } else {
              reader.onload=()=>newFiles.push({name:f.name,type:"text",data:reader.result})&&setAnexos([...newFiles])
              reader.readAsText(f)
            }
          })
        }}/>
        <button type="button" style={{...btn("s"),fontSize:"13px",padding:"6px 14px"}} onClick={()=>fileRef.current?.click()}>Escolher arquivos</button>
        {anexos.length>0 && <div style={{marginTop:"8px",display:"flex",flexWrap:"wrap",gap:"6px"}}>
          {anexos.map((a,i)=><span key={i} style={{background:K.bg2,border:`1px solid ${K.border}`,borderRadius:"5px",padding:"3px 8px",fontSize:"12px",display:"flex",alignItems:"center",gap:"4px"}}>
            {a.type==="image"?"🖼":"📄"} {a.name}
            <span style={{cursor:"pointer",color:K.red,fontWeight:700}} onClick={()=>setAnexos(anexos.filter((_,j)=>j!==i))}>×</span>
          </span>)}
        </div>}
      </div>
      <div style={{marginTop:"12px"}}>
        <label style={{fontSize:"13px",color:K.t2,fontWeight:600,display:"block",marginBottom:"6px"}}>📄 URLs de documentos — Edital, RGI, Débitos (opcional)</label>
        <textarea
          placeholder={"URLs dos documentos (uma por linha)\nEx: https://site.com/edital.pdf\nhttps://site.com/rgi.pdf"}
          value={urlsDocumentos}
          onChange={e=>setUrlsDocumentos(e.target.value)}
          style={{...inp(),minHeight:"72px",resize:"vertical",fontSize:isPhone?14:13,lineHeight:"1.5"}}
        />
        <div style={{fontSize:"11px",color:K.t3,marginTop:"4px"}}>PDFs de edital, matrícula/RGI e planilha de débitos — serão analisados automaticamente pela IA</div>
      </div>
      </div>

      {duplicado&&<div style={{background:C.mustardL,border:`1px solid ${C.mustard}40`,borderLeft:`3px solid ${C.mustard}`,borderRadius:10,padding:"12px 16px",marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,color:C.mustard,marginBottom:6}}>⚠️ Imóvel já analisado</div>
        <div style={{fontSize:12.5,color:C.text,marginBottom:10}}><b>{duplicado.codigo_axis}</b> — {duplicado.titulo} · Score {(duplicado.score_total||0).toFixed(2)} · {duplicado.recomendacao}</div>
        <div style={{display:"flex",gap:8}}>
          <button style={{padding:"7px 14px",borderRadius:7,fontSize:12,fontWeight:600,cursor:"pointer",background:C.navy,color:"#fff",border:"none"}} onClick={()=>{if(duplicado.id&&onNav)onNav("detail",{id:duplicado.id});setDuplicado(null)}}>Ver análise existente {duplicado.codigo_axis?`#${duplicado.codigo_axis}`:""}</button>
          <button style={{padding:"7px 14px",borderRadius:7,fontSize:12,cursor:"pointer",background:"transparent",border:`1px solid ${C.borderW}`,color:C.muted}} onClick={()=>{setDuplicado(null);analyze()}}>Reanalisar mesmo assim</button>
        </div>
      </div>}
      {error&&<div style={{background:`${K.red}15`,border:`1px solid ${K.red}40`,borderRadius:"6px",padding:"12px",marginBottom:"14px",fontSize:"12.5px",color:K.red,whiteSpace:"pre-line",lineHeight:1.6}}>⚠️ {error}</div>}
      {error&&(error.includes('credit balance')||error.includes('balance is too low')||error.includes('insufficient')||error.includes('billing'))&&<div style={{background:'rgba(245,166,35,0.1)',border:'1px solid rgba(245,166,35,0.3)',borderRadius:8,padding:'12px 14px',marginBottom:14}}><div style={{color:'#F5A623',fontWeight:700,marginBottom:4,fontSize:13}}>💳 Saldo insuficiente</div><div style={{color:'rgba(221,228,240,0.7)',fontSize:12,lineHeight:1.6}}>Acesse <b style={{color:'#fff'}}>platform.claude.com → Plans & Billing</b> para adicionar créditos.<br/>O app volta a funcionar automaticamente após adicionar saldo.</div></div>}
      {trelloMsg&&<div style={{background:`${K.teal}10`,border:`1px solid ${K.teal}30`,borderRadius:"6px",padding:"10px",marginBottom:"14px",fontSize:"12px",color:K.teal}}>{trelloMsg}</div>}

      {loading&&<div style={{background:`${K.teal}10`,border:`1px solid ${K.teal}30`,borderRadius:"7px",padding:"16px",marginBottom:"16px"}}>
        <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
          <div style={{width:"8px",height:"8px",borderRadius:"50%",background:K.teal,animation:"pulse 1s infinite",flexShrink:0}}/>
          <div style={{fontSize:"13px",color:K.teal,fontWeight:"600"}}>{step}</div>
        </div>
        <div style={{fontSize:"11px",color:K.t3,marginTop:"6px"}}>Pode levar 20-40 segundos...</div>
      </div>}

      <div style={{display:"flex",flexDirection:isPhone?'column':'row',gap:"10px"}}>
        <button style={{...btn(),width:isPhone?'100%':'auto',padding:isPhone?'14px':'9px 20px'}} onClick={analyze} disabled={loading}>{loading?"⏳ Analisando...":"🔍 Analisar Imóvel"}</button>
        <button style={{...btn("s"),width:isPhone?'100%':'auto'}} onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  </div>
}

// ── PROPERTY CARD ─────────────────────────────────────────────────────────────
// ── CITY COLORS ──────────────────────────────────────────────────────────────
const CIDADE_CORES = {
  'Belo Horizonte': { accent: '#002B80', bg: '#F0F4FF', label: 'BH' },
  'Contagem':       { accent: '#7C3AED', bg: '#F5F3FF', label: 'CT' },
  'Betim':          { accent: '#0891B2', bg: '#ECFEFF', label: 'BT' },
  'Nova Lima':      { accent: '#059669', bg: '#ECFDF5', label: 'NL' },
  'Juiz de Fora':   { accent: '#D97706', bg: '#FFFBEB', label: 'JF' },
  'Ribeirão das Neves': { accent: '#DC2626', bg: '#FEF2F2', label: 'RN' },
  'Santa Luzia':    { accent: '#9333EA', bg: '#FAF5FF', label: 'SL' },
  'Sabará':         { accent: '#CA8A04', bg: '#FEFCE8', label: 'SB' },
}
function getCidadeCor(cidade) {
  if (!cidade) return { accent: '#6B7280', bg: '#F9FAFB', label: 'MG' }
  const norm = cidade.trim()
  return CIDADE_CORES[norm] || Object.values(CIDADE_CORES).find((v,i) => norm.toLowerCase().includes(Object.keys(CIDADE_CORES)[i].toLowerCase())) || { accent: '#6B7280', bg: '#F9FAFB', label: norm.substring(0,2).toUpperCase() }
}

function PropCard({p,onNav}) {
  const isPhone = useIsMobile(480)
  const sc=p.score_total||0, rc=recColor(p.recomendacao)
  const tipFmt = (p.tipologia||p.tipo||'—').replace('_padrao','').replace(/_/g,' ').replace(/\w/g,c=>c.toUpperCase())
  const fmtM = v => v ? `R$ ${Math.round(v).toLocaleString('pt-BR')}` : '—'
  const fmtPct = v => v ? `${parseFloat(v).toFixed(1)}%` : '—'
  const fmtM2 = v => v ? `R$ ${Math.round(v).toLocaleString('pt-BR')}/m²` : '—'
  const dataLeilao = p.data_leilao ? (() => { const d = new Date(p.data_leilao.slice(0,10)+'T12:00:00'); return isNaN(d.getTime()) ? null : d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'}) })() : null
  const eMercado = isMercadoDireto(p.fonte_url, p.tipo_transacao)
  const diasParaLeilao = p.data_leilao && !eMercado ? (() => { const d = new Date(p.data_leilao.slice(0,10)+'T12:00:00'); if(isNaN(d.getTime())) return null; return Math.ceil((d - Date.now()) / 86400000) })() : null
  const numLeilao = p.praca ? `${p.praca}ª PRAÇA` : p.num_leilao ? `${p.num_leilao}º LEILÃO` : null
  const scoreDelta = p.preco_m2_imovel && p.preco_m2_mercado
    ? ((1 - p.preco_m2_imovel/p.preco_m2_mercado)*100).toFixed(0)
    : null
  const cidCor = getCidadeCor(p.cidade)

  return <div onClick={()=>onNav("detail",{id:p.id})}
    style={{...card(),cursor:"pointer",transition:"all .15s",padding:isPhone?"12px":"14px",borderLeft:`3px solid ${cidCor.accent}`}}
    onMouseEnter={e=>{e.currentTarget.style.borderColor=K.teal;e.currentTarget.style.transform="translateY(-2px)"}}
    onMouseLeave={e=>{e.currentTarget.style.borderColor=K.bd;e.currentTarget.style.borderLeftColor=cidCor.accent;e.currentTarget.style.transform="none"}}>

    {/* Top bar: código AXIS (esquerda) + cidade (direita) */}
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
      {p.codigo_axis
        ? <span style={{fontSize:13,fontWeight:800,padding:'2px 10px',borderRadius:5,background:'#002B8015',color:'#002B80',fontFamily:'monospace',letterSpacing:1}}>{p.codigo_axis}</span>
        : <span/>}
      {p.cidade && (
        <span style={{padding:'1px 8px',borderRadius:4,background:cidCor.bg,border:`1px solid ${cidCor.accent}25`,fontSize:9,fontWeight:700,color:cidCor.accent,letterSpacing:.5,textTransform:'uppercase'}}>
          {p.cidade}
        </span>
      )}
    </div>

    {/* Foto */}
    {p.foto_principal && (
      <div style={{marginBottom:10,borderRadius:8,overflow:"hidden",height:isPhone?100:120,background:C.offwhite,position:"relative"}}>
        <img src={p.foto_principal} alt="" referrerPolicy="no-referrer" style={{width:"100%",height:"100%",objectFit:"cover"}} onError={e=>{e.target.parentElement.style.display="none"}} />
        {sc >= 7.5 && <div style={{position:'absolute',top:6,left:6,background:'#10B981',color:'#fff',fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:4}}>⭐ OPORTUNIDADE</div>}
        {numLeilao && !eMercado && <div style={{position:'absolute',top:6,right:6,background:p.num_leilao>=2?'#D97706':'#065F46',color:'#fff',fontSize:8,fontWeight:700,padding:'2px 6px',borderRadius:4}}>{numLeilao}</div>}
        {eMercado && <div style={{position:'absolute',top:6,right:6,background:'#1D4ED8',color:'#fff',fontSize:8,fontWeight:700,padding:'2px 6px',borderRadius:4}}>🏠 MERCADO</div>}
      </div>
    )}

    {/* Header: título padronizado */}
    <div style={{marginBottom:3}}>
      <div style={{fontWeight:"700",fontSize:isPhone?"13px":"13.5px",color:K.wh,lineHeight:1.3}}>{(()=>{
        // Título curto padronizado: "Apt 2q 43m² — Bairro, Cidade" ou título original se curto
        const t = p.titulo || 'Imóvel sem título'
        if (t.length <= 45) return t
        const tipo = (p.tipo||'').toLowerCase().includes('casa') ? 'Casa' : (p.tipo||'').toLowerCase().includes('cobertura') ? 'Cobertura' : (p.tipo||'').toLowerCase().includes('sala') ? 'Sala' : 'Apt'
        const area = p.area_privativa_m2 || p.area_m2
        const parts = [tipo]
        if (p.quartos) parts.push(`${p.quartos}q`)
        if (area) parts.push(`${area}m²`)
        const local = [p.bairro, p.cidade].filter(Boolean).join(', ')
        return local ? `${parts.join(' ')} — ${local}` : parts.join(' ')
      })()}</div>
    </div>

    {/* Resumo: bairro · tipo · área · quartos · vagas */}
    <div style={{fontSize:"10.5px",color:K.t3,marginBottom:6}}>
      📍 {[p.bairro,p.cidade].filter(Boolean).join(', ')}/{p.estado} · {tipFmt} · {(p.area_privativa_m2||p.area_m2)||'—'}m²{p.quartos ? ` · ${p.quartos}q` : ''}{p.suites ? ` · ${p.suites}s` : ''}{p.vagas ? ` · ${p.vagas}v` : ''}
    </div>

    {/* Data do leilão — oculto para mercado */}
    {dataLeilao && !eMercado && (
      <div style={{fontSize:10,color:K.t3,marginBottom:6,display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
        <span>🗓️ Leilão: <strong style={{color:K.wh}}>{dataLeilao}</strong></span>
        {diasParaLeilao !== null && (
          <span style={{
            padding:'1px 7px',borderRadius:4,fontSize:9,fontWeight:800,
            background: diasParaLeilao < 0 ? '#6B728020' : diasParaLeilao <= 3 ? '#E5484D' : diasParaLeilao <= 7 ? '#D97706' : '#05A86D',
            color: diasParaLeilao < 0 ? '#6B7280' : '#fff',
          }}>
            {diasParaLeilao < 0 ? `D+${Math.abs(diasParaLeilao)}` : diasParaLeilao === 0 ? 'HOJE' : `D-${diasParaLeilao}`}
          </span>
        )}
        {p.leiloeiro && <span>· {p.leiloeiro.split(' ').slice(0,2).join(' ')}</span>}
      </div>
    )}

    {/* Badges */}
    <div style={{display:"flex",gap:"4px",flexWrap:"wrap",marginBottom:9}}>
      <Bdg c={rc} ch={p.recomendacao||"—"}/>
      {eMercado && <Bdg c="#1D4ED8" ch="MERCADO"/>}
      <Bdg c={p.ocupacao==="Desocupado"?K.grn:p.ocupacao==="Ocupado"?K.red:K.t3} ch={p.ocupacao||"—"}/>
      {p.financiavel&&<Bdg c={K.blue} ch="Financiável"/>}
      {p.analise_dupla_ia&&<span style={{fontSize:"9px",fontWeight:"700",background:"linear-gradient(135deg,rgba(0,229,187,0.2),rgba(16,163,127,0.2))",border:"1px solid rgba(0,229,187,0.35)",color:"#00E5BB",padding:"2px 7px",borderRadius:"4px",letterSpacing:".5px"}}>🤖 IA</span>}
      {(p.num_documentos>0)&&<Bdg c="#7C3AED" ch={`📄 ${p.num_documentos}doc`}/>}
    </div>

    {/* Grid de valores: 4 células */}
    <div style={{display:"flex",flexDirection:isPhone?"column":"row",gap:8,alignItems:isPhone?"stretch":"flex-start"}}>
      <div style={{flex:1,display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
        <div style={{background:K.s2,borderRadius:6,padding:"7px 9px"}}>
          <div style={{fontSize:"8.5px",color:K.t3,marginBottom:1,textTransform:"uppercase",letterSpacing:.3}}>{eMercado ? 'Preço pedido' : 'Lance mín.'}</div>
          <div style={{fontSize:"12px",fontWeight:"800",color:K.amb}}>{fmtM(eMercado ? (p.preco_pedido || p.valor_minimo) : p.valor_minimo)}</div>
        </div>
        <div style={{background:K.s2,borderRadius:6,padding:"7px 9px"}}>
          <div style={{fontSize:"8.5px",color:K.t3,marginBottom:1,textTransform:"uppercase",letterSpacing:.3}}>{p.desconto_percentual > 0 && p.desconto_sobre_mercado_pct_calculado > 0 ? 'Desc. s/mercado' : 'Desconto'}</div>
          <div style={{fontSize:"12px",fontWeight:"800",color:K.grn}}>{(()=>{
            // Priorizar desconto sobre mercado (mais relevante para investidor)
            const dMerc = parseFloat(p.desconto_sobre_mercado_pct_calculado) || 0
            if(dMerc > 0) return `${dMerc.toFixed(1)}%`
            if(p.desconto_percentual&&p.desconto_percentual>0) return `${p.desconto_percentual}%`
            // Calcular on-the-fly para mercado direto
            const pp=parseFloat(eMercado?(p.preco_pedido||p.valor_minimo):p.valor_minimo)||0
            const vm=parseFloat(p.valor_mercado_estimado)||0
            if(pp>0&&vm>0){const d=((vm-pp)/vm*100).toFixed(1);const dN=parseFloat(d);return dN>0?`${d}%`:dN<-2?`+${Math.abs(dN).toFixed(1)}% acima`:'—'}
            return scoreDelta&&scoreDelta>0?`~${scoreDelta}%`:"—"
          })()}</div>
        </div>
        <div style={{background:K.s2,borderRadius:6,padding:"7px 9px"}}>
          <div style={{fontSize:"8.5px",color:K.t3,marginBottom:1,textTransform:"uppercase",letterSpacing:.3}}>Aluguel est.</div>
          <div style={{fontSize:"12px",fontWeight:"700",color:"#7C3AED"}}>{p.aluguel_mensal_estimado&&p.aluguel_mensal_estimado>0?`R$ ${Math.round(p.aluguel_mensal_estimado).toLocaleString('pt-BR')}/mês`:"—"}</div>
        </div>
        <div style={{background:K.s2,borderRadius:6,padding:"7px 9px"}}>
          <div style={{fontSize:"8.5px",color:K.t3,marginBottom:1,textTransform:"uppercase",letterSpacing:.3}}>MAO flip</div>
          <div style={{fontSize:"12px",fontWeight:"700",color:K.teal}}>{(()=>{
            if(p.mao_flip&&p.mao_flip>0) return `R$ ${Math.round(p.mao_flip).toLocaleString('pt-BR')}`
            // Calcular on-the-fly: mercado × 0.80 - custos fixos
            const vm=parseFloat(p.valor_mercado_estimado)||0
            const pp=parseFloat(eMercado?(p.preco_pedido||p.valor_minimo):p.valor_minimo)||0
            if(vm>0){const taxas=eMercado?MULT_CUSTO_RAPIDO.mercado:MULT_CUSTO_RAPIDO.leilao;const mao=Math.round(vm*0.80-(pp*taxas+1500));return mao>0?`R$ ${mao.toLocaleString('pt-BR')}`:"—"}
            return "—"
          })()}</div>
        </div>
      </div>
      {/* ScoreRing */}
      <div style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",marginTop:isPhone?4:0,alignSelf:isPhone?"flex-end":"flex-start"}}>
        {sc > 0 ? <ScoreRing score={sc} size={isPhone?58:64}/>
          : <div style={{width:isPhone?58:64,height:isPhone?58:64,borderRadius:'50%',border:'2px dashed #D4D4D8',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,color:C.muted,textAlign:'center',lineHeight:1.2}}>N/A</div>
        }
      </div>
    </div>

    {/* Linha de preço/m² e avaliação */}
    {(p.preco_m2_imovel||p.preco_m2_mercado||p.valor_avaliacao) && (
      <div style={{marginTop:7,paddingTop:7,borderTop:`1px solid ${K.bd}`,display:'flex',gap:12,flexWrap:'wrap',fontSize:10,color:K.t3}}>
        {p.valor_avaliacao&&<span>Aval. <strong style={{color:K.wh}}>{fmtM(p.valor_avaliacao)}</strong></span>}
        {p.preco_m2_imovel&&<span>Imóvel <strong style={{color:K.teal}}>{fmtM2(p.preco_m2_imovel)}</strong></span>}
        {p.preco_m2_mercado&&<span>Mercado <strong style={{color:K.t2}}>{fmtM2(p.preco_m2_mercado)}</strong></span>}
      </div>
    )}

    {/* Homogeneização e atributos do prédio */}
    {(p.fator_homogenizacao || p.elevador === false || p.piscina === false) && (
      <div style={{marginTop:4,display:'flex',gap:6,flexWrap:'wrap',fontSize:9,color:K.t3}}>
        {p.fator_homogenizacao && p.fator_homogenizacao < 1 && (
          <span style={{padding:'1px 5px',borderRadius:3,background:'#FEF9C3',border:'1px solid #FDE047',color:'#92400E',fontWeight:600}}>
            Homog. {(p.fator_homogenizacao * 100).toFixed(0)}%
          </span>
        )}
        {p.elevador === false && <span style={{padding:'1px 5px',borderRadius:3,background:'#FEF2F2',color:'#991B1B'}}>s/ elevador</span>}
        {p.piscina === false && <span style={{padding:'1px 5px',borderRadius:3,background:'#FEF2F2',color:'#991B1B'}}>s/ piscina</span>}
        {(p.vagas || 0) >= 2 && <span style={{padding:'1px 5px',borderRadius:3,background:'#EFF6FF',color:'#1D4ED8'}}>🅿 {p.vagas}v</span>}
      </div>
    )}

    {/* Footer */}
    <div style={{fontSize:"9.5px",color:K.t3,marginTop:6,display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:4}}>
      <span>{fmtD(p.createdAt)}</span>
      <span>{p.modalidade_leilao||p.modalidade||'—'}</span>
    </div>
  </div>
}

// ── PAINEL PORTFÓLIO ─────────────────────────────────────────────────────────
function PainelPortfolio({ props: imoveis, isMobile, isPhone, onNav }) {
  const STATUS = {
    analisado:   { label:'Em análise',  color:C.mustard, emoji:'🔍' },
    aprovado:    { label:'Aprovado',    color:C.emerald, emoji:'✅' },
    arrematado:  { label:'Arrematado',  color:C.navy,    emoji:'🏆' },
    em_reforma:  { label:'Em reforma',  color:C.mustard, emoji:'🏗️' },
    a_venda:     { label:'À venda',     color:C.emerald, emoji:'🏷️' },
    vendido:     { label:'Vendido',     color:'#6B7C90', emoji:'💰' },
    arquivado:   { label:'Arquivado',   color:'#9EAAB8', emoji:'📦' },
  }
  const grupos = Object.entries(STATUS).map(([key, cfg]) => ({
    ...cfg, key,
    items: imoveis.filter(i =>
      (i.status || 'analisado') === key ||
      (key === 'aprovado' && i.recomendacao === 'COMPRAR' && !i.status) ||
      (key === 'analisado' && i.recomendacao === 'AGUARDAR' && !i.status)
    )
  })).filter(g => g.items.length > 0)
  const totalInvestido  = imoveis.reduce((s,i) => s + (i.valor_minimo || 0), 0)
  const scoresMedio     = imoveis.filter(i=>i.score_total)
  const scoreMedio      = scoresMedio.length
    ? scoresMedio.reduce((s,i) => s + i.score_total, 0) / scoresMedio.length : 0
  const aprovados       = imoveis.filter(i => i.recomendacao === 'COMPRAR').length
  const arrematados     = imoveis.filter(i => i.status === 'arrematado').length
  return (
    <div style={{ padding: isPhone ? '16px' : '24px 32px' }}>
      <h2 style={{ margin:'0 0 6px', fontSize:20, fontWeight:700, color:C.navy }}>
        📊 Portfólio AXIS
      </h2>
      <p style={{ margin:'0 0 24px', fontSize:13, color:C.muted }}>
        Visão consolidada do grupo — {imoveis.length} ativos rastreados
      </p>
      <div style={{ display:'grid', gridTemplateColumns:isPhone?'1fr':isMobile?'repeat(2,1fr)':'repeat(4,1fr)', gap:12, marginBottom:24 }}>
        {[
          ['Total rastreado', imoveis.length, 'imóveis', C.navy],
          ['Aprovados (COMPRAR)', aprovados, 'imóveis', C.emerald],
          ['Score médio', scoreMedio.toFixed(2), '/10', C.emerald],
          ['Arrematados', arrematados, 'imóveis', C.navy],
        ].map(([label, val, unit, color]) => (
          <div key={label} style={{ background:C.white, borderRadius:12,
            padding:'14px 16px', border:`1px solid ${C.borderW}` }}>
            <p style={{ margin:'0 0 4px', fontSize:11, color:C.muted }}>{label}</p>
            <p style={{ margin:0, fontSize:22, fontWeight:800, color }}>
              {val}<span style={{ fontSize:12, fontWeight:400, color:C.muted }}> {unit}</span>
            </p>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', gap:12, overflowX:'auto', paddingBottom:8 }}>
        {grupos.map(grupo => (
          <div key={grupo.key} style={{ minWidth:240, flex:'0 0 auto' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6,
              padding:'6px 10px', borderRadius:'8px 8px 0 0',
              background:`${grupo.color}15`, borderBottom:`2px solid ${grupo.color}` }}>
              <span>{grupo.emoji}</span>
              <span style={{ fontSize:12, fontWeight:700, color:grupo.color }}>
                {grupo.label}
              </span>
              <span style={{ fontSize:11, color:grupo.color, marginLeft:'auto',
                background:`${grupo.color}20`, borderRadius:10, padding:'1px 7px' }}>
                {grupo.items.length}
              </span>
            </div>
            {grupo.items.map(item => (
              <div key={item.id} onClick={() => onNav?.('detail', {id: item.id})}
                style={{ background:C.white, border:`1px solid ${C.borderW}`,
                borderTop:'none', padding:'10px 12px', fontSize:12,
                cursor: onNav ? 'pointer' : 'default' }}>
                <p style={{ margin:'0 0 2px', fontWeight:600, color:C.navy,
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {item.titulo || item.endereco || 'Imóvel'}
                </p>
                <p style={{ margin:'0 0 4px', fontSize:10.5, color:C.muted }}>
                  {item.cidade}/{item.estado}
                </p>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontSize:11, color:C.navy, fontWeight:600 }}>
                    {item.valor_minimo
                      ? `R$ ${Math.round(item.valor_minimo/1000)}k`
                      : '—'}
                  </span>
                  <span style={{ fontSize:11, fontWeight:700,
                    color: !item.score_total ? C.hint
                      : item.score_total >= 7.5 ? C.emerald
                      : item.score_total >= 6 ? C.mustard : RED }}>
                    {item.score_total?.toFixed(2) || '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── LISTA ─────────────────────────────────────────────────────────────────────
function Lista({props,onNav,onDelete,trello,onUpdateProp}) {
  const isPhoneL = useIsMobile(480)
  const [q,setQ]=useState(""), [filter,setFilter]=useState("todos"), [sort,setSort]=useState("score")
  const [syncingTrello,setSyncingTrello]=useState(false)
  const [syncMsg,setSyncMsg]=useState("")
  // Sprint 10: Multi-select para análise em lote
  const [selIds, setSelIds] = useState(new Set())
  const [loteProcessando, setLoteProcessando] = useState(false)
  const [loteProgresso, setLoteProgresso] = useState('')
  let list=[...props]
  if(q) list=list.filter(p=>`${p.titulo} ${p.cidade} ${p.tipo}`.toLowerCase().includes(q.toLowerCase()))
  if(filter!=="todos") list=list.filter(p=>p.recomendacao===filter.toUpperCase())
  list.sort((a,b)=>sort==="score"?(b.score_total||0)-(a.score_total||0):sort==="desconto"?(b.desconto_percentual||0)-(a.desconto_percentual||0):sort==="valor"?(a.valor_minimo||0)-(b.valor_minimo||0):new Date(b.createdAt)-new Date(a.createdAt))

  const toggleSel = (id) => setSelIds(prev => {
    const n = new Set(prev)
    n.has(id) ? n.delete(id) : n.add(id)
    return n
  })
  const toggleAll = () => setSelIds(prev => prev.size === list.length ? new Set() : new Set(list.map(p => p.id)))

  // Análise em lote: re-analisar docs de todos os imóveis selecionados
  const analisarLote = async () => {
    const selecionados = props.filter(p => selIds.has(p.id))
    if (!selecionados.length) return
    if (!confirm(`Analisar documentos de ${selecionados.length} imóvel(is)? Isso pode levar alguns minutos.`)) return
    setLoteProcessando(true)
    const gKey = localStorage.getItem('axis-gemini-key') || ''
    const cKey = localStorage.getItem('axis-api-key') || ''
    if (!gKey && !cKey) { setLoteProgresso('⚠️ Configure Gemini ou Claude em Admin → API Keys'); setLoteProcessando(false); return }

    let ok = 0, errs = 0, docsTotal = 0
    const { getDocumentosJuridicos, salvarDocumentoJuridico } = await import('./lib/supabase.js')
    const { analisarTextoJuridicoGemini, baixarViaJina } = await import('./lib/agenteJuridico.js')

    for (const imovel of selecionados) {
      setLoteProgresso(`📋 ${ok + errs + 1}/${selecionados.length} — ${imovel.codigo_axis || imovel.titulo || 'Imóvel'}...`)
      try {
        const docs = await getDocumentosJuridicos(imovel.id)
        const pendentes = docs.filter(d => !d.analise_ia && (d.conteudo_texto || d.url_origem || d.url))
        for (const doc of pendentes) {
          let texto = doc.conteudo_texto
          if (!texto || texto.length < 100) {
            const urlDoc = doc.url_origem || doc.url
            if (urlDoc) texto = await baixarViaJina(urlDoc, () => {}).catch(() => null)
          }
          if (!texto || texto.length < 100) continue
          const analise = await analisarTextoJuridicoGemini(texto, doc.nome || doc.tipo, imovel, gKey || cKey)
          if (analise) {
            await salvarDocumentoJuridico({
              id: doc.id, imovel_id: imovel.id, tipo: doc.tipo,
              conteudo_texto: texto.substring(0, 5000),
              analise_ia: analise.parecer || analise.resumo || '',
              analise_estruturada: analise,
              riscos_encontrados: analise.riscos_identificados || [],
              score_juridico_sugerido: analise.score_juridico_sugerido,
              recomendacao_juridica: analise.recomendacao_juridica,
              pontos_positivos: analise.pontos_positivos || [],
              alertas_criticos: analise.alertas_criticos || [],
              processado: true, status: 'analisado',
              analisado_em: new Date().toISOString(),
            }).catch(() => {})
            docsTotal++
          }
        }
        ok++
      } catch (e) { errs++; console.warn('[AXIS lote]', imovel.id, e.message) }
    }
    setLoteProgresso(`✅ ${ok} imóvel(is) processado(s), ${docsTotal} doc(s) analisado(s)${errs ? ` · ${errs} erro(s)` : ''}`)
    setLoteProcessando(false)
    setSelIds(new Set())
    setTimeout(() => setLoteProgresso(''), 8000)
  }

  const syncTrello=async()=>{
    if(!trello?.listId||!trello?.boardId){setSyncMsg("⚠️ Configure o Trello primeiro (ícone ⚙️)");setTimeout(()=>setSyncMsg(""),4000);return}
    if(!confirm(`Enviar/atualizar ${list.length} imóvel(is) no Trello?`)) return
    setSyncingTrello(true);setSyncMsg(`🔄 Enviando ${list.length} imóveis para o Trello...`)
    let ok=0,fail=0
    const { criarCardImovel } = await import('./lib/trelloService.js')
    for(const p of list){
      try{
        await criarCardImovel(p,trello.listId,trello.boardId,trello.key,trello.token)
        ok++
        setSyncMsg(`🔄 Enviando... ${ok}/${list.length}`)
      }catch{fail++}
    }
    setSyncMsg(`✅ ${ok} enviado(s) ao Trello${fail?` · ${fail} erro(s)`:""}`)
    setSyncingTrello(false)
    setTimeout(()=>setSyncMsg(""),5000)
  }

  return <div>
    <Hdr title="Imóveis" sub={`${props.length} total · ${list.length} filtrado(s)`} actions={<>
      <button style={{...btn("s"),background:`${K.trello||"#0079BF"}15`,color:K.trello||"#0079BF",border:`1px solid ${K.trello||"#0079BF"}30`}} onClick={syncTrello} disabled={syncingTrello}>{syncingTrello?"⏳ Sincronizando...":"🔷 Atualizar Trello"}</button>
      <button style={btn()} onClick={()=>onNav("novo")}>+ Novo</button>
    </>}/>
    <div style={{padding:isPhoneL?"16px":"20px 28px"}}>
      {syncMsg&&<div style={{background:`${K.teal}10`,border:`1px solid ${K.teal}30`,borderRadius:"6px",padding:"10px",marginBottom:"14px",fontSize:"12px",color:K.teal}}>{syncMsg}</div>}
      {loteProgresso&&<div style={{background:loteProcessando?'#FEF3C7':'#ECFDF5',border:`1px solid ${loteProcessando?'#FCD34D':'#A7F3D0'}`,borderRadius:8,padding:'10px 14px',marginBottom:14,fontSize:12,fontWeight:600,color:loteProcessando?'#92400E':'#065F46',display:'flex',alignItems:'center',gap:8}}>
        {loteProcessando&&<span style={{display:'inline-block',width:14,height:14,border:'2px solid #D4A017',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 1s linear infinite'}}/>}
        {loteProgresso}
      </div>}
      <div style={{display:"flex",gap:"10px",marginBottom:"16px",flexWrap:"wrap",alignItems:"center"}}>
        <input style={{...inp(),maxWidth:isPhoneL?"100%":"260px",fontSize:isPhoneL?16:13}} placeholder="🔍 Buscar..." value={q} onChange={e=>setQ(e.target.value)}/>
        <select style={{...inp(),width:"auto",cursor:"pointer"}} value={filter} onChange={e=>setFilter(e.target.value)}>
          <option value="todos">Todos</option><option value="comprar">Comprar</option><option value="aguardar">Aguardar</option><option value="evitar">Evitar</option>
        </select>
        <select style={{...inp(),width:"auto",cursor:"pointer"}} value={sort} onChange={e=>setSort(e.target.value)}>
          <option value="score">Maior Score</option><option value="desconto">Maior Desconto</option><option value="valor">Menor Valor</option><option value="data">Mais Recente</option>
        </select>
        {/* Sprint 10: Toggle seleção e ações em lote */}
        <button style={{...btn("s"),fontSize:11,padding:'5px 10px',background:selIds.size?'#002B8015':'transparent',color:'#002B80',border:'1px solid #002B8030'}}
          onClick={toggleAll}>
          {selIds.size === list.length ? '☑ Deselecionar' : '☐ Selecionar'}
        </button>
        {selIds.size > 0 && (
          <button style={{...btn("s"),fontSize:11,padding:'5px 12px',background:'#002B80',color:'#fff',border:'none',fontWeight:700}}
            onClick={analisarLote} disabled={loteProcessando}>
            {loteProcessando ? '⏳ Processando...' : `🤖 Analisar Docs (${selIds.size})`}
          </button>
        )}
      </div>
      {list.length===0?<div style={{textAlign:"center",padding:"40px",color:K.t3}}><div style={{fontSize:"32px",marginBottom:"10px"}}>🔍</div><div>Nenhum imóvel encontrado</div></div>
      :<div style={{display:"grid",gridTemplateColumns:isPhoneL?"1fr":"repeat(auto-fill,minmax(300px,1fr))",gap:"12px"}}>
        {list.map(p=><div key={p.id} style={{position:'relative'}}>
          {/* Checkbox de seleção */}
          <div onClick={(e)=>{e.stopPropagation();toggleSel(p.id)}} style={{
            position:'absolute',top:8,left:8,zIndex:2,width:22,height:22,borderRadius:5,
            background:selIds.has(p.id)?'#002B80':'rgba(255,255,255,0.9)',
            border:selIds.has(p.id)?'none':'1.5px solid #ccc',
            display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',
            boxShadow:'0 1px 3px rgba(0,0,0,0.1)',transition:'all .15s',
          }}>
            {selIds.has(p.id) && <span style={{color:'#fff',fontSize:13,fontWeight:700}}>✓</span>}
          </div>
          <PropCard p={p} onNav={onNav}/>
        </div>)}
      </div>}
    </div>
  </div>
}

// ── COMPARATIVO ───────────────────────────────────────────────────────────────
function Comparativo({props}) {
  const [sel,setSel]=useState([])
  const top=[...props].sort((a,b)=>(b.score_total||0)-(a.score_total||0)).slice(0,8)
  const cmp=props.filter(p=>sel.includes(p.id))
  const toggle=id=>setSel(s=>s.includes(id)?s.filter(x=>x!==id):s.length<3?[...s,id]:s)
  const dims=[
    ["Score Total",p=>(p.score_total||0).toFixed(1),p=>scoreColor(p.score_total)],
    ["Recomendação",p=>p.recomendacao,p=>recColor(p.recomendacao)],
    ["Score Jurídico",p=>p.score_juridico!=null?`${p.score_juridico}/10`:"—",p=>scoreColor(p.score_juridico)],
    ["Score Localização",p=>p.score_localizacao!=null?`${p.score_localizacao}/10`:"—",p=>scoreColor(p.score_localizacao)],
    ["Score Desconto",p=>p.score_desconto!=null?`${p.score_desconto}/10`:"—",p=>scoreColor(p.score_desconto)],
    ["Valor Mínimo",p=>fmtC(p.valor_minimo),()=>K.t2],
    ["Desconto",p=>p.desconto_percentual?`${p.desconto_percentual}%`:"—",()=>K.grn],
    ["Área",p=>p.area_m2?`${p.area_m2}m²`:"—",()=>K.t2],
    ["Quartos",p=>p.quartos||"—",()=>K.t2],
    ["Preço/m²",p=>p.preco_m2_imovel?`R$ ${p.preco_m2_imovel}`:"—",()=>K.t2],
    ["MAO Flip",p=>fmtC(p.mao_flip),()=>K.teal],
    ["MAO Locação",p=>fmtC(p.mao_locacao),()=>K.pur],
    ["Aluguel est.",p=>p.aluguel_mensal_estimado?`${fmtC(p.aluguel_mensal_estimado)}/mês`:"—",()=>K.pur],
    ["Custo Reforma",p=>fmtC(p.custo_reforma_calculado),()=>K.amb],
    ["Prazo Lib.",p=>p.prazo_liberacao_estimado_meses?`${p.prazo_liberacao_estimado_meses} meses`:"—",p=>(p.prazo_liberacao_estimado_meses||0)>6?K.red:K.grn],
    ["Ocupação",p=>p.ocupacao,p=>p.ocupacao==="Desocupado"?K.grn:K.red],
    ["Processos",p=>p.processos_ativos,p=>p.processos_ativos==="Nenhum"?K.grn:K.red],
    ["Financiável",p=>p.financiavel?"Sim":"Não",p=>p.financiavel?K.grn:K.t3],
    ["Retorno revenda",p=>p.retorno_venda_pct?`+${p.retorno_venda_pct}%`:"—",()=>K.grn],
    ["Retorno locação",p=>p.retorno_locacao_anual_pct?`${p.retorno_locacao_anual_pct}%a.a.`:"—",()=>K.pur],
    ["Data Leilão",p=>p.data_leilao?new Date(p.data_leilao+'T12:00').toLocaleDateString('pt-BR'):"—",()=>K.t2],
  ]
  return <div>
    <Hdr title="Comparativo" sub="Selecione até 3 imóveis"/>
    <div style={{padding:"20px 28px"}}>
      <div style={{display:"flex",flexWrap:"wrap",gap:"8px",marginBottom:"20px"}}>
        {top.map(p=><div key={p.id} onClick={()=>toggle(p.id)} style={{background:sel.includes(p.id)?`${K.teal}15`:K.s2,border:`1px solid ${sel.includes(p.id)?K.teal:K.bd}`,borderRadius:"6px",padding:"7px 12px",cursor:"pointer",fontSize:"12px",color:K.tx}}>
          {sel.includes(p.id)?"✓ ":""}{(p.titulo||"Imóvel").slice(0,26)} <span style={{color:scoreColor(p.score_total)}}>({(p.score_total||0).toFixed(1)})</span>
        </div>)}
      </div>
      {cmp.length>=2?<div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12.5px"}}>
          <thead><tr>
            <th style={{padding:"10px 14px",background:K.s2,color:K.t3,textAlign:"left",fontSize:"11px",textTransform:"uppercase",letterSpacing:"1px",borderBottom:`1px solid ${K.bd}`,minWidth:"130px"}}>Dimensão</th>
            {cmp.map(p=><th key={p.id} style={{padding:"10px 14px",background:K.s2,color:K.wh,textAlign:"center",borderBottom:`1px solid ${K.bd}`,minWidth:"180px"}}>
              <div style={{fontSize:"11.5px",marginBottom:"6px"}}>{(p.titulo||"Imóvel").slice(0,22)}</div>
              <ScoreRing score={p.score_total} size={44}/>
            </th>)}
          </tr></thead>
          <tbody>{dims.map(([label,getValue,getColor],i)=>(
            <tr key={label} style={{background:i%2===0?K.s1:K.bg2}}>
              <td style={{padding:"8px 14px",color:K.t3,borderBottom:`1px solid ${K.bd}`}}>{label}</td>
              {cmp.map(p=><td key={p.id} style={{padding:"8px 14px",textAlign:"center",borderBottom:`1px solid ${K.bd}`,color:getColor(p),fontWeight:"600"}}>{getValue(p)||"—"}</td>)}
            </tr>
          ))}</tbody>
        </table>
      </div>:<div style={{textAlign:"center",padding:"40px",color:K.t3}}><div style={{fontSize:"28px",marginBottom:"10px"}}>⚖️</div><div>Selecione pelo menos 2 imóveis acima</div></div>}
    </div>
  </div>
}

// ── ACESSO NEGADO ────────────────────────────────────────────────────────────
function AcessoNegado({ mensagem }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      height: 320, gap: 16, textAlign: 'center', padding: 32,
    }}>
      <div style={{ fontSize: 48 }}>🔒</div>
      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.navy }}>
        Acesso Restrito
      </h3>
      <p style={{ margin: 0, fontSize: 14, color: C.muted, maxWidth: 360, lineHeight: 1.6 }}>
        {mensagem || 'Esta funcionalidade é restrita ao administrador.'}
      </p>
      <p style={{ margin: 0, fontSize: 12, color: C.hint }}>
        Contate Gabriel (cotars@hotmail.com) para mais informações.
      </p>
    </div>
  )
}

// ── BANCO DE ARQUIVADOS ──────────────────────────────────────────────────────
function BancoArquivados({ session, isAdmin, isPhone }) {
  const [arquivados, setArquivados] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('')
  const [recomFiltro, setRecomFiltro] = useState('todos')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    try {
      const { getBancoArquivados } = await import('./lib/supabase.js')
      const data = await getBancoArquivados()
      setArquivados(data)
    } catch {}
    setLoading(false)
  }

  async function desarquivar(id) {
    if (!isAdmin) return
    try {
      const { desarquivarImovel } = await import('./lib/supabase.js')
      await desarquivarImovel(id)
      setArquivados(prev => prev.filter(p => p.id !== id))
    } catch(e) { alert('Erro ao desarquivar: ' + e.message) }
  }

  const filtrados = arquivados.filter(a => {
    const matchTexto = !filtro ||
      (a.titulo||'').toLowerCase().includes(filtro.toLowerCase()) ||
      (a.endereco||'').toLowerCase().includes(filtro.toLowerCase()) ||
      (a.cidade||'').toLowerCase().includes(filtro.toLowerCase())
    const matchRecom = recomFiltro === 'todos' || a.recomendacao === recomFiltro
    return matchTexto && matchRecom
  })

  const sColor = s => !s ? C.hint : s >= 7.5 ? C.emerald : s >= 6 ? C.mustard : '#E5484D'

  return (
    <div style={{ padding: isPhone ? '16px' : '24px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.navy }}>
            Banco de Arquivados
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: C.muted }}>
            {arquivados.length} imóvel(is) arquivado(s) — disponíveis para análise futura
          </p>
        </div>
        <button onClick={carregar} style={{
          padding: '8px 16px', borderRadius: 8,
          border: `1px solid ${C.borderW}`, background: C.white,
          color: C.navy, fontSize: 13, cursor: 'pointer', fontWeight: 500,
        }}>
          Atualizar
        </button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          placeholder="Buscar por endereço ou cidade..."
          value={filtro}
          onChange={e => setFiltro(e.target.value)}
          style={{
            flex: 1, minWidth: 200, padding: '9px 14px', borderRadius: 8,
            border: `1px solid ${C.borderW}`, fontSize: 13,
            background: C.white, color: C.navy, outline: 'none',
          }}
        />
        {['todos','COMPRAR','AGUARDAR','EVITAR'].map(r => (
          <button key={r} onClick={() => setRecomFiltro(r)} style={{
            padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
            cursor: 'pointer',
            border: `1px solid ${recomFiltro===r ? C.emerald : C.borderW}`,
            background: recomFiltro===r ? C.emeraldL : C.white,
            color: recomFiltro===r ? C.emerald : C.muted,
          }}>
            {r === 'todos' ? 'Todos' : r}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <p style={{ color: C.muted, textAlign: 'center', padding: 40 }}>Carregando...</p>
      ) : filtrados.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: C.hint }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
          <p style={{ fontSize: 14, fontWeight: 500 }}>Nenhum imóvel arquivado</p>
          <p style={{ fontSize: 12 }}>
            Imóveis arquivados aparecem aqui para referência futura.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isPhone ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {filtrados.map(imovel => (
            <div key={imovel.id} style={{
              background: C.white, border: `1px solid ${C.borderW}`,
              borderRadius: 12, overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(0,43,128,0.06)',
              opacity: 0.92,
            }}>
              {imovel.foto_principal && (
                <img src={imovel.foto_principal} alt="" referrerPolicy="no-referrer"
                  style={{ width: '100%', height: 140, objectFit: 'cover' }}
                  onError={e => { e.target.style.display = 'none' }}
                />
              )}
              <div style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: C.navy }}>
                      {imovel.titulo || imovel.endereco || 'Imóvel'}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 11.5, color: C.muted }}>
                      {imovel.cidade}/{imovel.estado} — {imovel.tipo}
                    </p>
                  </div>
                  <div style={{ textAlign: 'center', flexShrink: 0 }}>
                    <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: sColor(imovel.score_total) }}>
                      {imovel.score_total?.toFixed(1) || '—'}
                    </p>
                    <p style={{ margin: 0, fontSize: 9, color: C.hint }}>score</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 10.5, color: C.hint }}>{isMercadoDireto(imovel.fonte_url,imovel.tipo_transacao)?'Preço pedido':'Lance mínimo'}</p>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.navy }}>
                      {(()=>{const v=isMercadoDireto(imovel.fonte_url,imovel.tipo_transacao)?(imovel.preco_pedido||imovel.valor_minimo):imovel.valor_minimo;return v?`R$ ${Number(v).toLocaleString('pt-BR')}`:'—'})()}
                    </p>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 10.5, color: C.hint }}>Desconto</p>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.emerald }}>
                      {imovel.desconto_percentual ? `${imovel.desconto_percentual}%` : '—'}
                    </p>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 10.5, color: C.hint }}>Recomendação</p>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700,
                      color: imovel.recomendacao === 'COMPRAR' ? C.emerald
                        : imovel.recomendacao === 'EVITAR' ? '#E5484D' : C.mustard }}>
                      {imovel.recomendacao || '—'}
                    </p>
                  </div>
                </div>
                {imovel.motivo_arquivamento && (
                  <div style={{
                    padding: '6px 10px', borderRadius: 6, marginBottom: 10,
                    background: '#F5F4F0', fontSize: 11.5, color: C.muted,
                  }}>
                    📦 {imovel.motivo_arquivamento}
                  </div>
                )}
                {imovel.arquivado_em && (
                  <p style={{ margin: '0 0 10px', fontSize: 10.5, color: C.hint }}>
                    Arquivado em {new Date(imovel.arquivado_em).toLocaleDateString('pt-BR')}
                  </p>
                )}
                {isAdmin && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => desarquivar(imovel.id)} style={{
                      flex: 1, padding: '7px 0', borderRadius: 7,
                      border: `1px solid ${C.emerald}`,
                      background: C.emeraldL, color: C.emerald,
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}>
                      Reativar
                    </button>
                    {imovel.fonte_url && (
                      <a href={imovel.fonte_url} target="_blank" rel="noreferrer" style={{
                        padding: '7px 12px', borderRadius: 7,
                        border: `1px solid ${C.borderW}`,
                        background: C.white, color: C.muted,
                        fontSize: 12, textDecoration: 'none',
                        display: 'flex', alignItems: 'center',
                      }}>
                        🔗
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── APP ROOT ──────────────────────────────────────────────────────────────────
// ErrorBoundary para capturar crashes em componentes lazy
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null } }
  static getDerivedStateFromError(error) { return { hasError: true, error } }
  componentDidCatch(error, info) { console.error('[AXIS] ErrorBoundary:', error, info) }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center', color: '#E5484D' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Erro ao carregar</div>
          <div style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>{this.state.error?.message || 'Componente falhou'}</div>
          <button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload() }}
            style={{ padding: '10px 24px', borderRadius: 8, background: '#002B80', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
            Recarregar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  // Sprint 10: Rota pública /#/share/:token — SEM autenticação
  const [shareToken, setShareToken] = useState(null)
  useEffect(() => {
    function checkHash() {
      const hash = window.location.hash
      const match = hash.match(/^#\/share\/([a-zA-Z0-9]+)$/)
      setShareToken(match ? match[1] : null)
    }
    checkHash()
    window.addEventListener('hashchange', checkHash)
    return () => window.removeEventListener('hashchange', checkHash)
  }, [])

  const { session, profile, loading: authLoading, isAdmin } = useAuth()
  const isViewer = !isAdmin && profile?.role === 'viewer'
  const podeEditar = isAdmin
  const podeSoVer = !isAdmin
  // ALL hooks MUST be before any conditional return (React Rules of Hooks)
  const [view,setView]=useState("dashboard")
  const [vp,setVp]=useState({})
  const [props,setProps]=useState([])
  const [loaded,setL]=useState(false)
  const [toast,setToast]=useState(null)
  const [trello,setTrello]=useState(null)
  const [showTrello,setShowTrello]=useState(false)
  const [showApiKey,setShowApiKey]=useState(false)
  const [showTrelloModal,setShowTrelloModal]=useState(false)
  const [parametrosBanco,setParametrosBanco]=useState([])
  const [criteriosBanco,setCriteriosBanco]=useState([])
  const [apiOk,setApiKey]=useState(localStorage.getItem("axis-api-key"))
  const isMobile = useIsMobile(900)
  const isPhone  = useIsMobile(480)
  useEffect(()=>{async function lp(){try{const{data:pr}=await supabase.from("parametros_score").select("*");if(pr)setParametrosBanco(pr);const{data:cr}=await supabase.from("criterios_avaliacao").select("*");if(cr)setCriteriosBanco(cr)}catch(e){console.warn("parametros:",e)}}lp()
  // Seed automático de dados de referência (só se tabelas estiverem vazias)
  import('./lib/supabase.js').then(({ seedMercadoRegional, seedRiscosJuridicos }) => {
    seedMercadoRegional().catch(() => {})
    seedRiscosJuridicos().catch(() => {})
  })
  },[])
  // Garante IDs fixos dos boards AXIS no localStorage
  useEffect(() => {
    try {
      const conf = JSON.parse(localStorage.getItem('axis-trello') || '{}')
      if (conf.key && conf.token) {
        localStorage.setItem('axis-trello', JSON.stringify({
          ...conf,
          boardId: '69c0ac769abcec1a62851eb4',
          boardManualId: '69c0ac820802ca9e0ce94ce1',
        }))
      }
    } catch {}
  }, [])

  // Sync API keys from Supabase por usuário (cross-device)
  useEffect(()=>{
    if(!session?.user?.id) return
    import('./lib/supabase.js').then(({loadApiKeys})=>{
      loadApiKeys(session.user.id).then(({claudeKey,openaiKey,geminiKey,deepseekKey})=>{
        if(claudeKey&&!localStorage.getItem('axis-api-key')){localStorage.setItem('axis-api-key',claudeKey);setApiKey(claudeKey)}
        if(openaiKey&&!localStorage.getItem('axis-openai-key')){localStorage.setItem('axis-openai-key',openaiKey)}
        // Sempre sincronizar do banco (sobrescreve localStorage para garantir consistência)
      if(geminiKey){localStorage.setItem('axis-gemini-key',geminiKey)}
      }).catch(()=>{})
    }).catch(()=>{})
  },[session])

  useEffect(()=>{(async()=>{
    // Migração: leilax-* → axis-* (preservar dados do rebrand)
    const MIGRATE = [['leilax-props','axis-props'],['leilax-trello','axis-trello'],['leilax-api-key','axis-api-key'],['leilax-openai-key','axis-openai-key']]
    for(const [old,nw] of MIGRATE){
      const v=localStorage.getItem(old)
      if(v&&!localStorage.getItem(nw)){localStorage.setItem(nw,v);localStorage.removeItem(old)}
    }
    const t=await stLoad("axis-trello")
    if(t)setTrello(t); React.startTransition(()=>setL(true))
    if(!localStorage.getItem("axis-api-key")) setTimeout(()=>setShowApiKey(true),1000)
    if(session) {
      try {
        if(!localStorage.getItem('axis-migracao-concluida')){
          const local=JSON.parse(localStorage.getItem('axis-props')||'[]')
          if(local.length>0){
            const{saveImovelCompleto}=await import('./lib/supabase.js')
            let ok=0
            for(const im of local){try{await saveImovelCompleto(im,session.user.id);ok++}catch(e){ console.warn("[AXIS] Sync falhou:", im.codigo_axis, e.message?.substring(0,60)) }}
            if(ok>0) localStorage.setItem('axis-migracao-concluida','true')
          } else { localStorage.setItem('axis-migracao-concluida','true') }
        }
        const data=await getImoveis()
        console.debug('[AXIS] Loaded', data?.length, 'imóveis')
        if(data&&data.length>0){ setProps(data); stSave("axis-props",data) }
        else { const cache=JSON.parse(localStorage.getItem('axis-props')||'[]'); if(cache.length>0) setProps(cache) }
      } catch(e) { console.error('[AXIS] Load error:', e.message); const cache=JSON.parse(localStorage.getItem('axis-props')||'[]'); if(cache.length>0) setProps(cache) }
    } else { const cache=await stLoad("axis-props"); if(cache) setProps(cache) }
  })()},[session])
  useEffect(()=>{if(loaded&&props.length>0)stSave("axis-props",props)},[props,loaded])
  useEffect(()=>{if(loaded&&trello)stSave("axis-trello",trello)},[trello,loaded])

  // Sprint 10: Rota pública — renderizar SharedViewer SEM autenticação
  if (shareToken) {
    return <Suspense fallback={<div style={{display:'flex',height:'100dvh',justifyContent:'center',alignItems:'center',color:'#002B80',fontSize:14}}>Carregando...</div>}>
      <LazySharedViewer token={shareToken} />
    </Suspense>
  }
  if (authLoading) return <div style={{display:'flex',flexDirection:'column',height:'100dvh',background:C.offwhite,justifyContent:'center',alignItems:'center',color:C.navy,fontFamily:"'Inter',system-ui,sans-serif",fontSize:'16px',fontWeight:'700'}}>Carregando...</div>
  if (!session) return <Login />
  if (profile && !profile.ativo) return <div style={{display:'flex',height:'100dvh',background:C.offwhite,justifyContent:'center',alignItems:'center',color:'#E5484D',fontFamily:"'Inter',system-ui,sans-serif",flexDirection:'column',gap:'12px'}}><div style={{fontSize:'16px',fontWeight:'700'}}>Acesso desativado</div><div style={{fontSize:'13px',color:C.muted}}>Contate o administrador</div></div>

  const showToast=(msg,c)=>{setToast({msg,c:c||K.teal});setTimeout(()=>setToast(null),4500)}
  const nav=(v,p={})=>{React.startTransition(()=>{setView(v);setVp(p)})}

  const addProp=async(p)=>{
    // Garantir ID
    if(!p.id) p.id=crypto.randomUUID()
    // Gerar código AXIS único
    if(!p.codigo_axis) {
      try {
        const{gerarAxisId}=await import('./lib/supabase.js')
        p.codigo_axis=await gerarAxisId(p.cidade)
      } catch(e) {
        console.warn('[AXIS] Fallback codigo_axis:',e.message)
        p.codigo_axis=`MG-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`
      }
    }
    // 1. Salvar no Supabase PRIMEIRO (fonte primária) — antes de navegar
    let salvoNoBanco = false
    if(session) {
      try {
        const{saveImovelCompleto}=await import('./lib/supabase.js')
        const salvo=await saveImovelCompleto(p,session.user.id)
        // Usar dados confirmados pelo Supabase
        p = salvo
        salvoNoBanco = true
        console.debug('[AXIS] Imóvel salvo no Supabase:',salvo.codigo_axis)
      } catch(e) {
        console.error('[AXIS] FALHA ao salvar no Supabase:',e.message,e)
        showToast(`⚠️ Erro ao salvar: ${e.message}. Dados ficam no cache local.`,'#E5484D')
      }
    }
    // 2. Atualizar state
    setProps(ps=>{
      const existe=ps.find(x=>x.id===p.id)
      if(existe) return ps.map(x=>x.id===p.id?p:x)
      return [p,...ps]
    })
    showToast(`✓ ${p.codigo_axis} · ${p.titulo||"Imóvel"} — Score ${(p.score_total||0).toFixed(1)} · ${p.recomendacao}${salvoNoBanco?'':' (local)'}`)
    if ((p.score_total||0) >= 7.5) {
      setTimeout(() => showToast(`OPORTUNIDADE: Score ${p.score_total.toFixed(1)} — ${p.titulo||p.bairro||'Ver imóvel'}`, K.grn), 1500)
    }
    // 3. Navegar DEPOIS de salvar
    nav("detail",{id:p.id})
  }
  const delProp=async(id)=>{deleteImovel(id).catch(()=>{});setProps(ps=>ps.filter(p=>p.id!==id));showToast("Excluído",K.red);nav("imoveis")}

  const handleArquivar=async(imovelId)=>{
    const motivo=prompt('Motivo do arquivamento (opcional):')
    if(motivo===null) return
    try {
      const{arquivarImovel}=await import('./lib/supabase.js')
      await arquivarImovel(imovelId,motivo||'Arquivado pelo administrador',session?.user?.id)
      setProps(prev=>prev.filter(p=>p.id!==imovelId))
      const sel=vp.id===imovelId
      if(sel){nav('imoveis')}
      showToast("Imóvel arquivado",C.mustard)
    } catch(e){alert('Erro ao arquivar: '+e.message)}
  }
  const saveTrello=cfg=>{
    setTrello(cfg);setShowTrello(false);showToast("✓ Trello configurado — "+cfg.boardName,K.trello)
    if(cfg.boardId&&cfg.key&&cfg.token){
      import('./lib/trelloService.js').then(({setupBoardAxis,AXIS_BOARDS:AB})=>{
        setupBoardAxis(AB.PIPELINE,cfg.key,cfg.token)
          .then(()=>console.debug('[AXIS] Board Trello configurado'))
          .catch(e=>console.warn('[AXIS] Setup Trello:',e.message))
      })
    }
  }

  const NAV_ITEMS_DEF=[
    {icon:LayoutDashboard,l:'Dashboard',v:'dashboard'},
    ...(isAdmin?[{icon:Plus,l:'Analisar',v:'novo'}]:[]),
    ...(isAdmin?[{icon:MessageSquare,l:'Busca GPT',v:'busca'}]:[]),
    {icon:Package,l:'Imóveis',v:'imoveis'},
    {icon:BarChart3,l:'Gráficos',v:'graficos'},
    {icon:Scale,l:'Comparar',v:'comparar'},
    {icon:CheckSquare,l:'Tarefas',v:'tarefas'},
    {icon:FileText,l:'Arquivados',v:'arquivados'},
    {icon:FileText,l:'Manual',v:'manual'},
    ...(isAdmin?[{icon:TrendingUp,l:'Portfólio',v:'portfolio'}]:[]),
    ...(isAdmin?[{icon:ShieldCheck,l:'Admin',v:'admin'}]:[]),
  ]
  // Keep emoji-based navItems for MobileNav compatibility
  const navItems=[
    {i:'🏠',l:'Dashboard',v:'dashboard'},
    ...(isAdmin?[{i:'🔍',l:'Analisar',v:'novo'}]:[]),
    ...(isAdmin?[{i:'🤖',l:'Busca GPT',v:'busca'}]:[]),
    {i:'📋',l:'Imóveis',v:'imoveis'},
    {i:'📊',l:'Gráficos',v:'graficos'},
    {i:'⚖️',l:'Comparar',v:'comparar'},
    {i:'✅',l:'Tarefas',v:'tarefas'},
    {i:'🏦',l:'Arquivados',v:'arquivados'},
    {i:'📖',l:'Manual',v:'manual'},
    ...(isAdmin?[{i:'📊',l:'Portfólio',v:'portfolio'}]:[]),
    ...(isAdmin?[{i:'🛡️',l:'Admin',v:'admin'}]:[]),
  ]
  const isAct=v=>view===v||(v==="imoveis"&&view==="detail")
  const selP=vp.id?props.find(p=>p.id===vp.id):null

  if(!loaded) return <div style={{display:"flex",height:"100dvh",background:C.offwhite,justifyContent:"center",alignItems:"center",flexDirection:"column",gap:"12px",fontFamily:"'Inter',system-ui,sans-serif"}}>
    <AxisLogo size="lg" />
    <div style={{color:C.muted,fontWeight:"500",fontSize:"14px",marginTop:8}}>Carregando...</div>
  </div>

  return <ErrorBoundary><div style={{display:"flex",minHeight:"100dvh",background:C.offwhite,color:C.text,fontFamily:"'Inter',system-ui,sans-serif",fontSize:"14px",overflow:"hidden"}}>
    <style>{`*{box-sizing:border-box;}::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:${C.offwhite};}::-webkit-scrollbar-thumb{background:${C.border};border-radius:2px;}select option{background:${C.white};}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}a:hover{opacity:.8;}`}</style>

    {showTrello&&<TrelloModal config={trello} onSave={saveTrello} onClose={()=>setShowTrello(false)}/>}
    {showApiKey&&<ApiKeyModal onClose={()=>setShowApiKey(false)} session={session}/>}
    {showTrelloModal&&<ModalAuditoriaTrello config={trello||JSON.parse(localStorage.getItem('axis-trello')||'{}')} imoveis={props} onClose={()=>setShowTrelloModal(false)}/>}

{/* SIDEBAR — fixa 200px */}
<aside className="axis-sidebar" style={{
  width:200,minWidth:200,height:'100dvh',position:'sticky',top:0,
  background:C.navy,display:'flex',flexDirection:'column',
  borderRight:`1px solid ${C.navy2}`,flexShrink:0,
}}>
  {/* Logo */}
  <div style={{padding:"24px 20px 20px",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
    <AxisLogo light />
  </div>
  {/* Nav */}
  <nav style={{flex:1,padding:'12px 10px',display:'flex',flexDirection:'column',gap:2}}>
    {NAV_ITEMS_DEF.map(item=>{
      const active=isAct(item.v)
      return <button key={item.v} onClick={()=>nav(item.v)}
        style={{
          width:'100%',display:'flex',alignItems:'center',gap:10,
          padding:'10px 12px',borderRadius:8,border:'none',cursor:'pointer',
          background:active?'rgba(5,168,109,0.15)':'transparent',
          color:active?C.emerald:'rgba(255,255,255,0.55)',
          fontSize:13.5,fontWeight:active?600:400,
          transition:'all 0.15s',position:'relative',textAlign:'left',
        }}
        onMouseEnter={e=>{if(!active)e.currentTarget.style.background='rgba(255,255,255,0.06)'}}
        onMouseLeave={e=>{if(!active)e.currentTarget.style.background='transparent'}}
      >
        {active&&<span style={{position:'absolute',left:0,top:'18%',bottom:'18%',width:3,borderRadius:'0 3px 3px 0',background:C.emerald}} />}
        <item.icon size={17} strokeWidth={active?2.2:1.6} />
        {item.l}
      </button>
    })}
  </nav>
  {/* Sidebar footer */}
  <div style={{padding:'10px 10px',borderTop:'1px solid rgba(255,255,255,0.07)',display:'flex',flexDirection:'column',gap:4}}>
    <button onClick={()=>trello?setShowTrelloModal(true):setShowTrello(true)} style={{
      width:'100%',display:'flex',alignItems:'center',gap:10,
      padding:'8px 12px',borderRadius:8,border:'none',cursor:'pointer',
      background:trello?'rgba(5,168,109,0.12)':'transparent',
      color:trello?C.emerald:'rgba(255,255,255,0.45)',fontSize:13,fontWeight:400,textAlign:'left',
    }}>🔷 Trello</button>
    {isAdmin&&<button onClick={()=>setShowApiKey(true)} style={{
      width:'100%',display:'flex',alignItems:'center',gap:10,
      padding:'8px 12px',borderRadius:8,border:'none',cursor:'pointer',
      background:'transparent',color:'rgba(255,255,255,0.45)',fontSize:13,fontWeight:400,textAlign:'left',
    }}><Settings size={15} /> Config</button>}
    <div onClick={async()=>{if(confirm('Sair?')){const{signOut}=await import('./lib/supabase.js');await signOut()}}}
      style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',cursor:'pointer',borderRadius:8,marginTop:4}}>
      <div style={{width:30,height:30,borderRadius:'50%',background:`${C.emerald}25`,border:`1px solid ${C.emerald}50`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:C.emerald}}>
        {(profile?.nome||'U')[0].toUpperCase()}
      </div>
      <span style={{fontSize:12,color:'rgba(255,255,255,0.5)'}}>{profile?.nome||'Sair'}</span>
    </div>
  </div>
</aside>
{/* FIM SIDEBAR */}

    {/* CONTENT */}
    <div className="axis-main" style={{flex:1,overflowY:"auto",background:C.offwhite,display:"flex",flexDirection:"column",minWidth:0,willChange:"transform"}}>
      {view==="dashboard"&&<Suspense fallback={<div style={{padding:40,textAlign:"center",color:C.muted}}>Carregando...</div>}><LazyDashboard props={props} onNav={nav} profile={profile} isMobile={isMobile} isPhone={isPhone}/></Suspense>}
  {view==="novo"&&(isAdmin?<NovoImovel onSave={addProp} onCancel={()=>nav("imoveis")} onNav={nav} trello={trello} parametrosBanco={parametrosBanco} criteriosBanco={criteriosBanco} isPhone={isPhone} existingProps={props}/>:<AcessoNegado mensagem="Análise de imóveis é restrita ao administrador."/>)}
      {view==="imoveis"&&<Lista props={props} onNav={nav} onDelete={delProp} trello={trello} onUpdateProp={(id,updates)=>setProps(ps=>ps.map(p=>p.id===id?{...p,...updates}:p))}/>}
      {view==="detail"&&<Suspense fallback={<div style={{padding:40,textAlign:"center",color:C.muted}}>Carregando...</div>}><LazyDetail p={selP} onDelete={delProp} onNav={nav} trello={trello} onUpdateProp={(id,updates)=>setProps(ps=>ps.map(p=>p.id===id?{...p,...updates}:p))} isAdmin={isAdmin} onArchive={handleArquivar} isMobile={isMobile} isPhone={isPhone} onReanalyze={(id,updates)=>setProps(ps=>ps.map(p=>p.id===id?{...p,...updates}:p))}/></Suspense>}
      {view==="comparar"&&<Comparativo props={props}/>}
    {view==="busca"&&(isAdmin?<LazyBuscaGPT onAnalisar={(link)=>{nav("novo");setTimeout(()=>{},100)}}/>:<AcessoNegado mensagem="Busca com IA é restrita ao administrador."/>)}
    {view==="graficos"&&<div><div style={{padding:isPhone?"16px":"22px 28px 16px",borderBottom:`1px solid ${C.borderW}`,background:C.white}}><div style={{fontWeight:700,fontSize:19,color:C.text}}>Gráficos</div></div><div style={{padding:isPhone?"16px":"20px 28px"}}><Suspense fallback={<div style={{padding:40,textAlign:'center',color:C.muted}}>Carregando gráficos...</div>}><Charts properties={props}/></Suspense></div></div>}
    {view==="tarefas"&&<LazyTarefas/>}
    {view==="arquivados"&&<BancoArquivados session={session} isAdmin={isAdmin} isPhone={isPhone}/>}
    {view==="portfolio"&&isAdmin&&<PainelPortfolio props={props} isMobile={isMobile} isPhone={isPhone} onNav={nav}/>}
    {view==="manual"&&<Suspense fallback={<div style={{padding:40,textAlign:"center",color:C.muted}}>Carregando...</div>}><LazyManualAxis isMobile={isMobile}/></Suspense>}
    {view==="admin"&&isAdmin&&<Suspense fallback={<div style={{padding:40,textAlign:"center",color:C.muted}}>Carregando...</div>}><LazyPainelAdmin session={session} imoveis={props} isPhone={isPhone}/></Suspense>}
    </div>

    {toast&&<div style={{position:"fixed",bottom:"16px",right:"16px",background:C.white,color:C.text,padding:"12px 20px",borderRadius:"10px",fontSize:"13px",fontWeight:"600",zIndex:9999,boxShadow:"0 8px 32px rgba(0,33,128,0.15)",maxWidth:"340px",border:`1px solid ${C.borderW}`}}>{toast.msg}</div>}
    <MobileNav items={navItems} activeKey={view} onNavigate={(v)=>nav(v)}/>
  </div></ErrorBoundary>
}
