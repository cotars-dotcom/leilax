import { useState, useEffect, useRef, lazy, Suspense } from "react"
import { stLoad, stSave } from "./storage.js"
import Charts from "./components/Charts.jsx"
import Timeline from "./components/Timeline.jsx"
import MobileNav from "./components/MobileNav.jsx"
import { useIsMobile } from "./hooks/useIsMobile.js"
import BuscaGPT from "./components/BuscaGPT.jsx"
import { useAuth } from "./lib/AuthContext.jsx"
import Login from "./pages/Login.jsx"
import { supabase, getImoveis, deleteImovel } from "./lib/supabase.js"
import Tarefas from "./pages/Tarefas.jsx"
import { analisarImovelCompleto } from "./lib/dualAI.js"
import { setupBoardAxis, criarCardImovel, AXIS_BOARDS } from "./lib/trelloService.js"
import { LayoutDashboard, TrendingUp, Package, ShieldCheck, FileText, BarChart3, Settings, Search, Bell, AlertTriangle, ArrowUpRight, Plus, MessageSquare, Scale, CheckSquare, LogOut } from "lucide-react"
import { C, K, RED, btn, inp, card, fmtC, fmtD, scoreColor, scoreLabel, recColor, mapDisplay, normalizarTextoAlerta, ESTRATEGIA_CONFIG, ESTRUTURA_MAP, LIQUIDEZ_MAP, TENDENCIA_MAP, DEMANDA_MAP } from "./appConstants.js"

const LazyDashboard = lazy(() => import("./components/Dashboard.jsx"))
const LazyDetail = lazy(() => import("./components/Detail.jsx"))
const LazyPainelAdmin = lazy(() => import("./components/PainelAdmin.jsx"))
const LazyCalculadoraROI = lazy(() => import("./components/CalculadoraROI.jsx"))

const uid = () => Math.random().toString(36).slice(2,9) + Date.now().toString(36)
const fmtD = d => d ? new Date(d).toLocaleDateString("pt-BR") : "—"
const fmtC = v => v ? `R$ ${Number(v).toLocaleString("pt-BR", {minimumFractionDigits:0})}` : "—"

// AXIS Design Tokens
const C = {
  // Estrutura (Azul)
  navy:      "#002B80",
  navy2:     "#001F66",
  navyAlfa:  "#002B8014",
  // Dados / Oportunidade (Verde)
  emerald:   "#05A86D",
  emeraldL:  "#E6F6F0",
  emeraldD:  "#037A50",
  // Alerta
  mustard:   "#E1B31A",
  mustardL:  "#FEF7DA",
  // Fundo / superfícies
  bg:        "#EDECEA",
  surface:   "#F4F3F0",
  white:     "#FFFFFF",
  offwhite:  "#EDECEA",
  // Texto
  text:      "#0A1628",
  muted:     "#6B7C90",
  hint:      "#9EAAB8",
  border:    "#DDD9CF",
  borderW:   "#E8E4DC",
  // Prata
  silver:    "#C0C0C0",
}

// Backward-compat aliases (used by existing components)
const K = {
  bg:C.offwhite, bg2:C.white, s1:C.white, s2:"#F2F0E6",
  bd:C.border, bd2:C.borderW, teal:C.emerald, amb:C.mustard,
  red:"#E5484D", blue:"#4A9EFF", pur:"#A78BFA", grn:C.emerald,
  gold:"#C68A00", tx:C.text, t2:C.muted, t3:C.hint, wh:C.navy,
  trello:"#0052CC"
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
- **Lance mínimo:** ${fmtC(p.valor_minimo)}
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
        <input style={inp} placeholder="Sua API Key do Trello" value={key} onChange={e=>setKey(e.target.value)}/>
        <div style={{fontSize:"10.5px",color:K.t3,marginTop:"4px"}}>Obtenha em: <a href="https://trello.com/app-key" target="_blank" rel="noopener noreferrer" style={{color:K.blue}}>trello.com/app-key</a></div>
      </div>
      <div style={{marginBottom:"16px"}}>
        <div style={{fontSize:"10px",color:K.t3,textTransform:"uppercase",letterSpacing:"1px",marginBottom:"5px"}}>Token</div>
        <input style={inp} placeholder="Token de acesso" value={token} onChange={e=>setToken(e.target.value)}/>
        <div style={{fontSize:"10.5px",color:K.t3,marginTop:"4px"}}>Na mesma página, clique em "Token" e autorize</div>
      </div>

      {step===1&&<button style={btn("trello")} onClick={connect} disabled={loading}>{loading?"Conectando...":"Conectar ao Trello →"}</button>}

      {step===2&&<>
        {boards.length===0&&<div style={{background:`${K.amb}15`,border:`1px solid ${K.amb}40`,borderRadius:"6px",padding:"10px",marginBottom:"12px",fontSize:"12px",color:K.amb}}>⚠️ Não foi possível listar boards (possível bloqueio CORS). Insira os IDs manualmente.</div>}
        <div style={{marginBottom:"12px"}}>
          <div style={{fontSize:"10px",color:K.t3,textTransform:"uppercase",letterSpacing:"1px",marginBottom:"5px"}}>Board</div>
          {boards.length>0
            ?<select style={{...inp,cursor:"pointer"}} value={boardId} onChange={e=>fetchLists(e.target.value)}>
              <option value="">— Selecione o board —</option>
              {boards.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            :<input style={inp} placeholder="ID do board (ex: 5f4e3d2c1b0a)" value={boardId} onChange={e=>{setBoardId(e.target.value);setLists([]);setListId("")}}/>
          }
        </div>
        <div style={{marginBottom:"18px"}}>
          <div style={{fontSize:"10px",color:K.t3,textTransform:"uppercase",letterSpacing:"1px",marginBottom:"5px"}}>Lista de Destino</div>
          {lists.length>0
            ?<select style={{...inp,cursor:"pointer"}} value={listId} onChange={e=>setListId(e.target.value)}>
              {lists.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            :<input style={inp} placeholder="ID da lista (ex: 5f4e3d2c1b0b)" value={listId} onChange={e=>setListId(e.target.value)}/>
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
 const [modoTeste,setModoTeste]=useState(localStorage.getItem('axis-modo-teste')==='true')
 const [saving,setSaving]=useState(false)
 // Carregar do Supabase ao abrir (se logado)
 useEffect(()=>{
   if(!session?.user?.id) return
   import('./lib/supabase.js').then(({loadApiKeys})=>{
     loadApiKeys(session.user.id).then(({claudeKey,openaiKey})=>{
       if(claudeKey&&!localStorage.getItem("axis-api-key")){setKey(claudeKey);localStorage.setItem("axis-api-key",claudeKey)}
       if(openaiKey&&!localStorage.getItem("axis-openai-key")){setOaiKey(openaiKey);localStorage.setItem("axis-openai-key",openaiKey)}
     })
   })
 },[session])
 const save=async()=>{
   const k=key.trim(),ok=oaiKey.trim()
   if(k)localStorage.setItem("axis-api-key",k)
   if(ok)localStorage.setItem("axis-openai-key",ok)
   if(session?.user?.id&&k){
     setSaving(true)
     try{const{persistApiKeys}=await import('./lib/supabase.js');await persistApiKeys(session.user.id,{claudeKey:k,openaiKey:ok})}catch(e){console.warn('[AXIS] save keys:',e)}finally{setSaving(false)}
   }
   onClose()
 }
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"20px"}}>
    <div style={{background:K.s1,border:`1px solid ${K.bd}`,borderRadius:"10px",padding:"28px",maxWidth:"480px",width:"100%"}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:"20px"}}>
        <div>
 <div style={{fontWeight:"700",fontSize:"16px",color:K.wh}}>🔑 Chaves de API</div>
 <div style={{fontSize:"11px",color:K.t3,marginTop:"2px"}}>Necessárias para análise com IA</div>
        </div>
        <button style={btn("s")} onClick={onClose}>✕</button>
      </div>
      <div style={{marginBottom:"8px"}}>
        <div style={{fontSize:"10px",color:K.t3,textTransform:"uppercase",letterSpacing:"1px",marginBottom:"5px"}}>Chave da API</div>
        <input style={inp} type="password" placeholder="sk-ant-..." value={key} onChange={e=>setKey(e.target.value)}/>
      </div>
      <div style={{fontSize:"11px",color:K.t3,marginBottom:"18px"}}>
        Obtenha em: <a href="https://platform.claude.com/settings/keys" target="_blank" rel="noopener noreferrer" style={{color:K.blue}}>platform.claude.com</a>
      </div>
 <div style={{marginTop:"16px",marginBottom:"8px"}}>
  <div style={{fontSize:"10px",color:K.t3,textTransform:"uppercase",letterSpacing:"1px",marginBottom:"5px"}}>Chave OpenAI (ChatGPT) — opcional</div>
  <input style={inp} type="password" placeholder="sk-..." value={oaiKey} onChange={e=>setOaiKey(e.target.value)}/>
 </div>
 <div style={{fontSize:"11px",color:K.t3,marginBottom:"18px"}}>
  Obtenha em: <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" style={{color:K.blue}}>platform.openai.com</a> · Usada na Busca GPT
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
    const hasKey = localStorage.getItem("axis-api-key")
    if(!hasKey){setError("Configure a chave da API Anthropic nas Configurações (⚙️)");return}
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
        const data = await analisarImovelCompleto(url.trim(), hasKey, openaiKey, parametrosBanco, criteriosBanco, (msg) => setStep(msg), anexos)
      data.fonte_url = url.trim()
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
            if (docs.rgi.area_m2 && !data.area_usada_calculo_m2) data.area_usada_calculo_m2 = docs.rgi.area_m2
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
      const property = {...data, id:uid(), createdAt:new Date().toISOString()}
      if(trello?.listId&&trello?.boardId) {
        setStep("🔷 Enviando para o Trello...")
        try {
          await criarCardImovel(property,trello.listId,trello.boardId,trello.key,trello.token)
          setTrelloMsg("✓ Card criado no Trello com etiquetas")
        } catch(e){ setTrelloMsg(`⚠️ Salvo no app, erro Trello: ${e.message}`) }
      }
      onSave(property)
    } catch(e){ setError(e.message||"Erro na análise.") }
    setLoading(false);setStep("")
  }

  return <div>
    <Hdr title="Analisar Imóvel" sub="Cole o link do leilão — IA busca e analisa tudo automaticamente"/>
    <div style={{padding:isPhone?"20px 16px":"24px 28px",maxWidth:"640px"}}>
      {trello?.listId
        ?<div style={{background:`${K.trello}15`,border:`1px solid ${K.trello}40`,borderRadius:"7px",padding:"12px 16px",marginBottom:"18px",display:"flex",alignItems:"center",gap:"10px"}}>
          <span style={{fontSize:"18px"}}>🔷</span>
          <div><div style={{fontSize:"12.5px",color:K.wh,fontWeight:"600"}}>Trello conectado</div>
          <div style={{fontSize:"11px",color:K.t3}}>{trello.boardName} → {trello.listName}</div></div>
          <span style={{marginLeft:"auto",fontSize:"9px",background:`${K.grn}20`,color:K.grn,padding:"2px 8px",borderRadius:"3px",fontWeight:"700"}}>ATIVO</span>
        </div>
        :<div style={{background:`${K.amb}10`,border:`1px solid ${K.amb}30`,borderRadius:"7px",padding:"12px 16px",marginBottom:"18px",fontSize:"12px",color:K.amb}}>
          ⚠️ Trello não configurado. Configure em <b>⚙️ Config</b> na barra lateral.
        </div>}

      <div style={{marginBottom:"16px"}}>
        <div style={{fontSize:"10px",color:K.t3,textTransform:"uppercase",letterSpacing:"1px",marginBottom:"6px"}}>Link do Leilão *</div>
        <input type="url" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} style={{...inp,fontSize:isPhone?16:14,padding:isPhone?'14px 16px':'10px 14px'}} placeholder="https://venda-imoveis.caixa.gov.br/..." value={url} onChange={e=>setUrl(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")analyze()}}/>
        <div style={{fontSize:"11px",color:K.t3,marginTop:"5px"}}>Portal CAIXA, sites de leiloeiros, qualquer anúncio público</div>

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
          style={{...inp,minHeight:"72px",resize:"vertical",fontSize:isPhone?14:13,lineHeight:"1.5"}}
        />
        <div style={{fontSize:"11px",color:K.t3,marginTop:"4px"}}>PDFs de edital, matrícula/RGI e planilha de débitos — serão analisados automaticamente pela IA</div>
      </div>
      </div>

      {duplicado&&<div style={{background:C.mustardL,border:`1px solid ${C.mustard}40`,borderLeft:`3px solid ${C.mustard}`,borderRadius:10,padding:"12px 16px",marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,color:C.mustard,marginBottom:6}}>⚠️ Imóvel já analisado</div>
        <div style={{fontSize:12.5,color:C.text,marginBottom:10}}><b>{duplicado.codigo_axis}</b> — {duplicado.titulo} · Score {(duplicado.score_total||0).toFixed(1)} · {duplicado.recomendacao}</div>
        <div style={{display:"flex",gap:8}}>
          <button style={{padding:"7px 14px",borderRadius:7,fontSize:12,fontWeight:600,cursor:"pointer",background:C.navy,color:"#fff",border:"none"}} onClick={()=>{if(duplicado.id&&onNav)onNav("detail",{id:duplicado.id});setDuplicado(null)}}>Ver análise existente {duplicado.codigo_axis?`#${duplicado.codigo_axis}`:""}</button>
          <button style={{padding:"7px 14px",borderRadius:7,fontSize:12,cursor:"pointer",background:"transparent",border:`1px solid ${C.borderW}`,color:C.muted}} onClick={()=>{setDuplicado(null);analyze()}}>Reanalisar mesmo assim</button>
        </div>
      </div>}
      {error&&<div style={{background:`${K.red}15`,border:`1px solid ${K.red}40`,borderRadius:"6px",padding:"12px",marginBottom:"14px",fontSize:"12.5px",color:K.red}}>⚠️ {error}</div>}
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
    {(p.score_total||0) >= 7.5 && (
      <div style={{display:"inline-block",background:"#10B981",color:"#fff",fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:4,letterSpacing:0.3,marginBottom:6}}>OPORTUNIDADE</div>
    )}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"10px"}}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:"4px"}}>
          <div style={{fontWeight:"600",fontSize:"13px",color:K.wh,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{p.titulo||"Imóvel sem título"}</div>
          {p.codigo_axis?<span style={{fontSize:"9.5px",fontWeight:700,padding:"1px 6px",borderRadius:3,background:"#002B8010",color:"#002B80",fontFamily:"monospace",flexShrink:0}}>{p.codigo_axis}</span>:<span style={{fontSize:10,color:C.hint}}>
            # pendente
          </span>}
          {p.criador_nome&&<span style={{fontSize:9.5,color:K.t3,flexShrink:0}}>por {p.criador_nome}</span>}
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

// ── PAINEL PORTFÓLIO ─────────────────────────────────────────────────────────
function PainelPortfolio({ props: imoveis, isMobile, isPhone }) {
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
          ['Score médio', scoreMedio.toFixed(1), '/10', C.emerald],
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
              <div key={item.id} style={{ background:C.white, border:`1px solid ${C.borderW}`,
                borderTop:'none', padding:'10px 12px', fontSize:12 }}>
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
                    {item.score_total?.toFixed(1) || '—'}
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

            {view==="dashboard"&&<Suspense fallback={<div style={{padding:40,textAlign:"center"}}>Carregando...</div>}><LazyDashboard props={props} onNav={nav} profile={profile} isMobile={isMobile} isPhone={isPhone}/></Suspense>}
  {view==="novo"&&(isAdmin?<NovoImovel onSave={addProp} onCancel={()=>nav("imoveis")} onNav={nav} trello={trello} parametrosBanco={parametrosBanco} criteriosBanco={criteriosBanco} isPhone={isPhone} existingProps={props}/>:<AcessoNegado mensagem="Análise de imóveis é restrita ao administrador."/>)}
      {view==="imoveis"&&<Lista props={props} onNav={nav} onDelete={delProp} trello={trello} onUpdateProp={(id,updates)=>setProps(ps=>ps.map(p=>p.id===id?{...p,...updates}:p))}/>}
            {view==="detail"&&<Suspense fallback={<div style={{padding:40,textAlign:"center"}}>Carregando...</div>}><LazyDetail p={selP} onDelete={delProp} onNav={nav} trello={trello} onUpdateProp={(id,updates)=>setProps(ps=>ps.map(p=>p.id===id?{...p,...updates}:p))} isAdmin={isAdmin} onArchive={handleArquivar} isMobile={isMobile} isPhone={isPhone}/></Suspense>}
      {view==="comparar"&&<Comparativo props={props}/>}
    {view==="busca"&&(isAdmin?<BuscaGPT onAnalisar={(link)=>{nav("novo");setTimeout(()=>{},100)}}/>:<AcessoNegado mensagem="Busca com IA é restrita ao administrador."/>)}
    {view==="graficos"&&<div><div style={{padding:isPhone?"16px":"22px 28px 16px",borderBottom:`1px solid ${C.borderW}`,background:C.white}}><div style={{fontWeight:700,fontSize:19,color:C.text}}>Gráficos</div></div><div style={{padding:isPhone?"16px":"20px 28px"}}><Charts properties={props}/></div></div>}
    {view==="tarefas"&&<Tarefas/>}
    {view==="arquivados"&&<BancoArquivados session={session} isAdmin={isAdmin} isPhone={isPhone}/>}
    {view==="portfolio"&&isAdmin&&<PainelPortfolio props={props} isMobile={isMobile} isPhone={isPhone}/>}
            {view==="admin"&&isAdmin&&<Suspense fallback={<div style={{padding:40,textAlign:"center"}}>Carregando...</div>}><LazyPainelAdmin session={session} imoveis={props} isPhone={isPhone}/></Suspense>}
    </div>

    {toast&&<div style={{position:"fixed",bottom:"16px",right:"16px",background:C.white,color:C.text,padding:"12px 20px",borderRadius:"10px",fontSize:"13px",fontWeight:"600",zIndex:9999,boxShadow:"0 8px 32px rgba(0,33,128,0.15)",maxWidth:"340px",border:`1px solid ${C.borderW}`}}>{toast.msg}</div>}
    <MobileNav items={navItems} activeKey={view} onNavigate={(v)=>nav(v)}/>
  </div>
}
