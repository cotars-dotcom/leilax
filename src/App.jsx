import { useState, useEffect, useRef } from "react"
import { stLoad, stSave } from "./storage.js"
import Charts from "./components/Charts.jsx"
import Timeline from "./components/Timeline.jsx"
import MobileNav from "./components/MobileNav.jsx"
import { useIsMobile } from "./hooks/useIsMobile.js"
import BuscaGPT from "./components/BuscaGPT.jsx"
import { useAuth } from "./lib/AuthContext.jsx"
import Login from "./pages/Login.jsx"
import { supabase, getImoveis, saveImovel, deleteImovel } from "./lib/supabase.js"
import Tarefas from "./pages/Tarefas.jsx"
import { analisarImovelCompleto } from "./lib/dualAI.js"
import { setupBoardAxis, criarCardImovel, AXIS_BOARDS } from "./lib/trelloService.js"
import { LayoutDashboard, TrendingUp, Package, ShieldCheck, FileText, BarChart3, Settings, Search, Bell, AlertTriangle, ArrowUpRight, Plus, MessageSquare, Scale, CheckSquare, LogOut } from "lucide-react"

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

const RED = "#E5484D"

// Normalizar texto de alertas — corrige double-encoding UTF-8 e converte tags para emojis
function normalizarTextoAlerta(texto) {
  if (!texto) return ''

  // Tentar decodificar double-encoding UTF-8
  let s = texto
  try {
    const decoded = decodeURIComponent(escape(texto))
    if (decoded !== texto) s = decoded
  } catch {
    s = texto
  }

  // Limpar padrões garbled específicos
  s = s
    .replace(/ÃÂÂ°ÃÂÃÂÃÂÃÂÃÂÃÂÃÂ°/g, '⚠️')
    .replace(/Ã°ÂÃÂÃ°/g, '⚠️')
    .replace(/Ã°Â\S*/g, '')
    .replace(/ÃÂÂ[^\s]*/g, '')
    .replace(/Ã¢ÂÂ[^\s]*/g, '')
    .replace(/Ã[ÂĈ][^\s]{2,8}/g, '')
    .replace(/[\uFFFD\uFFFE\uFFFF]/g, '')
    // Tags de texto para emojis
    .replace(/\[CRITICO\]/gi, '🔴')
    .replace(/\[ATENCAO\]/gi, '⚠️')
    .replace(/\[OK\]/gi, '✅')
    .replace(/\[INFO\]/gi, '💡')
    .trim()

  return s
}
const scoreColor = s => s >= 7.5 ? C.emerald : s >= 6 ? C.emerald : s >= 4.5 ? C.mustard : RED
const scoreLabel = s => s >= 7.5 ? "FORTE" : s >= 6 ? "BOM" : s >= 4.5 ? "MÉDIO" : "FRACO"
const recColor = r => ({ COMPRAR: C.emerald, AGUARDAR: C.mustard, EVITAR: "#E5484D" })[r] || C.hint

const btn = (v="p") => ({
  background: v==="p"?C.navy:v==="d"?`#E5484D12`:v==="trello"?K.trello:C.white,
  color: v==="p"?C.white:v==="d"?"#E5484D":v==="trello"?"#fff":C.muted,
  border: v==="p"?`1px solid ${C.navy}`:v==="d"?`1px solid #E5484D40`:`1px solid ${C.borderW}`,
  borderRadius:"8px", padding: v==="s"?"5px 12px":"9px 20px",
  fontSize: v==="s"?"11.5px":"13px", fontWeight:"600", cursor:"pointer", flexShrink:0
})
const inp = { background:C.offwhite, border:`1px solid ${C.border}`, borderRadius:"8px", padding:"10px 14px", color:C.text, fontSize:"13px", width:"100%", outline:"none" }
const card = (ac) => ({ background:C.white, border:`1px solid ${ac||C.borderW}`, borderRadius:"12px", padding:"18px" })
const Bdg = ({c,ch}) => <span style={{display:"inline-block",fontSize:"10px",fontWeight:"700",padding:"2px 8px",borderRadius:"5px",textTransform:"uppercase",letterSpacing:".5px",background:`${c}12`,color:c}}>{ch}</span>

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
        <span style={{ position: "relative", fontFamily: "'Inter',sans-serif", fontWeight: 900, fontSize: 26, color: textColor, letterSpacing: "-1px", lineHeight: 1 }}>
          X
          <svg style={{ position: "absolute", top: -2, left: 0, width: "100%", height: "110%", pointerEvents: "none" }} viewBox="0 0 20 28">
            <line x1="5" y1="16" x2="16" y2="4" stroke={arrowColor} strokeWidth="2.5" strokeLinecap="round"/>
            <polyline points="11,4 16,4 16,9" fill="none" stroke={arrowColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
        <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 900, fontSize: 26, color: textColor, letterSpacing: "-1px", lineHeight: 1 }}>IS</span>
      </div>
      {!light && (
        <span style={{ fontSize: 8.5, color: C.muted, letterSpacing: "1.5px", textTransform: "uppercase", paddingLeft: 1 }}>
          Intelig&ecirc;ncia Patrimonial
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
function ApiKeyModal({onClose}) {
 const [key,setKey]=useState(localStorage.getItem("axis-api-key")||"")
 const [oaiKey,setOaiKey]=useState(localStorage.getItem("axis-openai-key")||"")
 const [modoTeste,setModoTeste]=useState(localStorage.getItem('axis-modo-teste')==='true')
 const save=()=>{localStorage.setItem("axis-api-key",key.trim());if(oaiKey.trim())localStorage.setItem("axis-openai-key",oaiKey.trim());onClose()}
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
 ⚠️ As chaves ficam salvas apenas no seu navegador (localStorage). Nunca são enviadas para servidores externos além da Anthropic/OpenAI.
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
// ── GALERIA DE FOTOS ──────────────────────────────────────────────────────────
function GaleriaFotos({ fotos = [], foto_principal = null, url = null }) {
  const [fotoAtiva, setFotoAtiva] = useState(foto_principal || fotos[0] || null)
  if (!fotos.length && !foto_principal) return (
    <div style={{ textAlign:'center', padding:'40px 24px', color:C.hint }}>
      <div style={{ fontSize:40, marginBottom:12 }}>📷</div>
      <p style={{ margin:'0 0 6px', fontSize:14, fontWeight:600, color:C.muted }}>Nenhuma foto disponível</p>
      <p style={{ margin:0, fontSize:12, color:C.hint }}>As fotos são extraídas automaticamente do anúncio original. Sites com carregamento dinâmico (SPA) podem não ter fotos.</p>
      {url && <a href={url} target="_blank" rel="noopener noreferrer" style={{ display:'inline-block', marginTop:12, padding:'8px 16px', borderRadius:8, background:C.navy, color:'#fff', fontSize:12, fontWeight:600, textDecoration:'none' }}>Ver anúncio original →</a>}
    </div>
  )
  const todasFotos = foto_principal
    ? [foto_principal, ...fotos.filter(f => f !== foto_principal)]
    : fotos
  return (
    <div style={{ marginBottom: 20 }}>
      {fotoAtiva && (
        <div style={{
          width: '100%', height: 240,
          borderRadius: 12, overflow: 'hidden',
          marginBottom: 8, background: C.offwhite,
        }}>
          <img
            src={fotoAtiva}
            alt="Foto principal"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={e => { e.target.style.display = 'none' }}
          />
        </div>
      )}
      {todasFotos.length > 1 && (
        <div style={{
          display: 'flex', gap: 6,
          overflowX: 'auto', paddingBottom: 4,
        }}>
          {todasFotos.map((foto, i) => (
            <img
              key={i}
              src={foto}
              alt={`Foto ${i + 1}`}
              onClick={() => setFotoAtiva(foto)}
              style={{
                width: 72, height: 52, flexShrink: 0,
                borderRadius: 7, objectFit: 'cover',
                cursor: 'pointer',
                border: fotoAtiva === foto
                  ? `2px solid ${C.emerald}`
                  : '2px solid transparent',
                opacity: fotoAtiva === foto ? 1 : 0.7,
                transition: 'all 0.15s',
              }}
              onError={e => { e.target.style.display = 'none' }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

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

// ── AXIS HEADER ──────────────────────────────────────────────────────────────
function AxisHeader({profile:prof, imoveis=[], onNav}) {
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef(null)

  // Gerar notificações dinâmicas a partir dos imóveis
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

  // Fechar dropdown ao clicar fora
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
        {/* Sininho com dropdown */}
        <div ref={notifRef} style={{position:"relative"}}>
          <div
            onClick={() => setNotifOpen(o => !o)}
            style={{position:"relative",cursor:"pointer",padding:4}}
          >
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
          {/* Dropdown */}
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
        {/* Avatar */}
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

// ── METRIC CARD ──────────────────────────────────────────────────────────────
function MetricCard({ titulo, valor, aux, badge, badgeColor, badgeBg, icon: Icon, iconColor, trend }) {
  return (
    <div style={{
      background:C.white,border:`1px solid ${C.borderW}`,borderRadius:14,padding:"24px 26px",
      display:"flex",flexDirection:"column",gap:6,
      boxShadow:"0 2px 12px rgba(0,33,128,0.06)",transition:"box-shadow 0.2s, transform 0.2s",cursor:"default",
    }}
    onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 6px 24px rgba(0,33,128,0.10)";e.currentTarget.style.transform="translateY(-1px)"}}
    onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 2px 12px rgba(0,33,128,0.06)";e.currentTarget.style.transform="none"}}
    >
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <span style={{fontSize:11,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:"0.8px"}}>{titulo}</span>
        <div style={{width:34,height:34,borderRadius:9,background:`${iconColor}12`,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <Icon size={16} color={iconColor} strokeWidth={1.8} />
        </div>
      </div>
      <div style={{display:"flex",alignItems:"baseline",gap:8,marginTop:4}}>
        <span style={{fontSize:34,fontWeight:700,color:C.text,letterSpacing:"-1.5px",lineHeight:1}}>{valor}</span>
        {trend&&<div style={{display:"flex",alignItems:"center",gap:3}}>
          <ArrowUpRight size={14} color={C.emerald} strokeWidth={2.5} />
          <span style={{fontSize:13,color:C.emerald,fontWeight:600}}>{trend}</span>
        </div>}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginTop:2}}>
        <span style={{fontSize:12.5,color:C.muted}}>{aux}</span>
        {badge&&<span style={{fontSize:10.5,fontWeight:600,padding:"2px 9px",borderRadius:5,background:badgeBg||`${badgeColor}12`,color:badgeColor}}>{badge}</span>}
      </div>
    </div>
  )
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function Dashboard({props,onNav,profile:prof,isMobile,isPhone}) {
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

// ── ABA JURÍDICA ──────────────────────────────────────────────────────────────
function AbaJuridica({ imovel, onReclassificado }) {
  const [docs, setDocs] = useState([])
  const [analisando, setAnalisando] = useState(false)
  const [progresso, setProgresso] = useState('')
  const [resultado, setResultado] = useState(null)
  const [erro, setErro] = useState('')
  const fileRef = useRef()

  useEffect(() => {
    if (imovel?.id) carregarDocs()
  }, [imovel?.id])

  async function carregarDocs() {
    try {
      const { getDocumentosJuridicos } = await import('./lib/supabase.js')
      const data = await getDocumentosJuridicos(imovel.id)
      setDocs(data)
    } catch {}
  }

  async function handleUpload(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setErro('')
    setResultado(null)

    const claudeKey = localStorage.getItem('axis-api-key') || ''
    const openaiKey = localStorage.getItem('axis-openai-key') || ''
    if (!claudeKey) {
      setErro('Configure a API Key do Claude no painel Admin → API Keys')
      return
    }

    for (const file of files) {
      setAnalisando(true)
      setProgresso(`📂 Processando ${file.name}...`)

      try {
        const tipo = file.type.includes('image') ? 'imagem'
          : file.type.includes('pdf') ? 'pdf' : 'txt'

        let conteudo = null
        let base64 = null
        const mediaType = file.type

        if (tipo === 'txt') {
          conteudo = await file.text()
        } else if (tipo === 'imagem') {
          base64 = await new Promise((res, rej) => {
            const r = new FileReader()
            r.onload = () => res(r.result.split(',')[1])
            r.onerror = rej
            r.readAsDataURL(file)
          })
        } else if (tipo === 'pdf') {
          try {
            conteudo = await file.text()
            if (conteudo.includes('%PDF')) conteudo = null
          } catch {}
          if (!conteudo) {
            base64 = await new Promise((res, rej) => {
              const r = new FileReader()
              r.onload = () => res(r.result.split(',')[1])
              r.onerror = rej
              r.readAsDataURL(file)
            })
          }
        }

        const { processarDocumentoJuridico } = await import('./lib/analisadorJuridico.js')
        const analise = await processarDocumentoJuridico(
          { nome: file.name, tipo, conteudo, base64, mediaType },
          imovel, claudeKey, openaiKey, setProgresso
        )

        if (!analise) {
          setErro(`Não foi possível analisar ${file.name}`)
          continue
        }

        const { salvarDocumentoJuridico, reclassificarImovel } = await import('./lib/supabase.js')
        const doc = await salvarDocumentoJuridico({
          imovel_id: imovel.id,
          nome: file.name,
          tipo,
          tamanho_bytes: file.size,
          conteudo_texto: conteudo?.slice(0, 5000) || null,
          analise_ia: analise.parecer_final || analise.parecer_resumido,
          riscos_encontrados: analise.riscos_consolidados || analise.riscos_identificados || [],
          impacto_score: analise.impacto_score_total || analise.impacto_score_juridico || 0,
          processado: true,
        })

        if (analise.deve_reclassificar) {
          setProgresso('🔄 Reclassificando imóvel com novos dados...')
          await reclassificarImovel(imovel.id, analise, doc.id)
          setResultado(analise)
          if (onReclassificado) onReclassificado(analise)
        } else {
          setResultado(analise)
        }
        await carregarDocs()
      } catch (e) {
        setErro(`Erro ao processar ${file.name}: ${e.message}`)
      }
    }
    setAnalisando(false)
    setProgresso('')
  }

  const corGravidade = g => g === 'critica' ? K.red : g === 'alta' ? K.amb : g === 'media' ? K.grn : K.t3

  return (
    <div style={{ padding: '0 0 24px' }}>
      {/* Upload */}
      <div
        onClick={() => !analisando && fileRef.current?.click()}
        style={{
          border: `2px dashed ${K.bd}`,
          borderRadius: 12, padding: '28px 20px',
          textAlign: 'center', cursor: analisando ? 'wait' : 'pointer',
          background: analisando ? K.s2 : K.s1,
          marginBottom: 20,
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => { if (!analisando) e.currentTarget.style.borderColor = K.teal }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = K.bd }}
      >
        <input
          ref={fileRef} type="file" multiple
          accept=".pdf,.txt,.jpg,.jpeg,.png,.webp"
          style={{ display: 'none' }}
          onChange={handleUpload}
        />
        <div style={{ fontSize: 28, marginBottom: 8 }}>📎</div>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: K.wh }}>
          Anexar documentos jurídicos
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 12.5, color: K.t3 }}>
          PDF, imagem (JPG/PNG) ou TXT — Matrícula, certidões, processos, alvarás
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 12 }}>
          {[
            { label: 'PDF/TXT', sub: 'Claude lê', color: K.blue },
            { label: 'Imagem', sub: 'ChatGPT Vision', color: K.grn },
          ].map(b => (
            <span key={b.label} style={{
              fontSize: 10.5, fontWeight: 600, padding: '3px 10px', borderRadius: 5,
              background: `${b.color}15`, color: b.color, border: `1px solid ${b.color}30`
            }}>
              {b.label} · {b.sub}
            </span>
          ))}
        </div>
      </div>

      {/* Progresso */}
      {analisando && progresso && (
        <div style={{
          background: `${K.teal}10`, border: `1px solid ${K.teal}30`,
          borderRadius: 10, padding: '12px 16px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: K.teal, flexShrink: 0,
            animation: 'pulse 1s infinite',
          }} />
          <p style={{ margin: 0, fontSize: 13, color: K.teal, fontWeight: 500 }}>
            {progresso}
          </p>
        </div>
      )}

      {/* Erro */}
      {erro && (
        <div style={{
          background: `${K.red}10`, border: `1px solid ${K.red}30`,
          borderRadius: 10, padding: '12px 16px', marginBottom: 16,
          fontSize: 13, color: K.red,
        }}>
          ⚠️ {erro}
        </div>
      )}

      {/* Resultado da análise */}
      {resultado && (
        <div style={{
          background: resultado.deve_reclassificar ? `${K.amb}10` : `${K.grn}10`,
          border: `1px solid ${resultado.deve_reclassificar ? K.amb : K.grn}30`,
          borderRadius: 12, padding: '18px 20px', marginBottom: 20,
        }}>
          <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 14, color: K.wh }}>
            {resultado.deve_reclassificar ? '🔄 Imóvel reclassificado' : '✅ Análise concluída'}
          </p>
          <p style={{ margin: '0 0 10px', fontSize: 13, color: K.tx, lineHeight: 1.6 }}>
            {resultado.parecer_final || resultado.parecer_resumido}
          </p>
          {resultado.alertas_criticos?.length > 0 && (
            <div>
              {resultado.alertas_criticos.map((a, i) => (
                <p key={i} style={{ margin: '4px 0', fontSize: 12.5, color: K.red }}>
                  🚨 {normalizarTextoAlerta(a)}
                </p>
              ))}
            </div>
          )}
          {resultado.deve_reclassificar && (
            <div style={{ marginTop: 8, display: 'flex', gap: 12 }}>
              <span style={{ fontSize: 12, color: K.t3 }}>
                Score jurídico: <b style={{ color: K.wh }}>{resultado.novo_score_juridico}/10</b>
              </span>
              <span style={{ fontSize: 12, color: K.t3 }}>
                Nova recomendação: <b style={{ color: recColor(resultado.nova_recomendacao) }}>
                  {resultado.nova_recomendacao}
                </b>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Lista de documentos */}
      {docs.length > 0 && (
        <div>
          <p style={{ fontSize: 11.5, fontWeight: 600, color: K.t3, textTransform: 'uppercase', letterSpacing: '0.6px', margin: '0 0 10px' }}>
            {docs.length} documento(s) anexado(s)
          </p>
          {docs.map(doc => (
            <div key={doc.id} style={{
              ...card(), marginBottom: 10,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>
                    {doc.tipo === 'pdf' ? '📄' : doc.tipo === 'imagem' ? '🖼️' : '📝'}
                  </span>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: K.wh }}>{doc.nome}</p>
                    <p style={{ margin: 0, fontSize: 11, color: K.t3 }}>
                      {doc.tipo.toUpperCase()} · {new Date(doc.criado_em).toLocaleDateString('pt-BR')}
                      {doc.tipo === 'imagem' ? ' · ChatGPT Vision' : ' · Claude'}
                    </p>
                  </div>
                </div>
                {doc.impacto_score !== 0 && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 5,
                    background: doc.impacto_score < -10 ? `${K.red}15` : `${K.amb}15`,
                    color: doc.impacto_score < -10 ? K.red : K.amb,
                  }}>
                    {doc.impacto_score > 0 ? '+' : ''}{doc.impacto_score} pts
                  </span>
                )}
              </div>
              {doc.analise_ia && (
                <p style={{ margin: '6px 0 0', fontSize: 12.5, color: K.tx, lineHeight: 1.5 }}>
                  {doc.analise_ia}
                </p>
              )}
              {doc.riscos_encontrados?.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {doc.riscos_encontrados.slice(0, 3).map((r, i) => (
                    <span key={i} style={{
                      fontSize: 10.5, padding: '2px 8px', borderRadius: 4,
                      background: `${corGravidade(r.gravidade)}15`,
                      color: corGravidade(r.gravidade), fontWeight: 600,
                    }}>
                      {r.risco_id || r.descricao?.slice(0, 30)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {docs.length === 0 && !analisando && (
        <p style={{ fontSize: 12.5, color: K.t3, textAlign: 'center', padding: '20px 0' }}>
          Nenhum documento jurídico anexado ainda.
          <br />Anexe matrícula, certidões ou processos para análise automática.
        </p>
      )}
    </div>
  )
}

// ── PAINEL ADMIN (convites + usuários) ────────────────────────────────────────
function PainelConvitesAdmin({ session, imoveis: propImoveis, isPhone }) {
  const [aba, setAba] = useState('convites')
  const [convites, setConvites] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(false)
  const [novoConvite, setNovoConvite] = useState({ nome:'', email:'', role:'member', obs:'' })
  const [linkGerado, setLinkGerado] = useState('')
  const [msg, setMsg] = useState('')
  const APP_URL = window.location.origin

  useEffect(() => { carregarDados() }, [])

  async function carregarDados() {
    setLoading(true)
    try {
      const { getConvites, getUsuarios } = await import('./lib/supabase.js')
      const [c, u] = await Promise.all([getConvites(), getUsuarios()])
      setConvites(c); setUsuarios(u)
    } catch(e) { setMsg('Erro ao carregar: ' + e.message) }
    setLoading(false)
  }

  async function gerarConvite(e) {
    e?.preventDefault()
    if (!novoConvite.nome) { setMsg('Informe o nome do convidado'); return }
    setLoading(true)
    try {
      const { criarConvite } = await import('./lib/supabase.js')
      const token = await criarConvite(
        novoConvite.email || '',
        novoConvite.nome,
        novoConvite.role,
        session?.user?.id
      )
      setLinkGerado(`${APP_URL}?convite=${token}`)
      await carregarDados()
      setNovoConvite({ nome:'', email:'', role:'member', obs:'' })
      setMsg('')
    } catch(e) { setMsg('Erro: ' + e.message) }
    setLoading(false)
  }

  async function revogar(id) {
    if (!confirm('Revogar este convite?')) return
    try {
      const { revogarConvite } = await import('./lib/supabase.js')
      await revogarConvite(id)
      await carregarDados()
    } catch(e) { setMsg('Erro: ' + e.message) }
  }

  async function alterarRole(userId, role) {
    try {
      const { atualizarRoleUsuario } = await import('./lib/supabase.js')
      await atualizarRoleUsuario(userId, role)
      await carregarDados()
    } catch(e) { setMsg('Erro: ' + e.message) }
  }

  async function toggleAtivo(userId, ativo) {
    try {
      const { toggleAtivoUsuario } = await import('./lib/supabase.js')
      await toggleAtivoUsuario(userId, !ativo)
      await carregarDados()
    } catch(e) { setMsg('Erro: ' + e.message) }
  }

  const vencido = (expira) => new Date(expira) < new Date()
  const fmtDt = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '—'
  const roleClr = (r) => r === 'admin' ? C.navy : r === 'member' ? C.emerald : C.mustard

  return (
    <div style={{ padding: isPhone ? '16px' : '24px 32px', maxWidth:900 }}>
      <h2 style={{ margin:'0 0 6px', fontSize:20, fontWeight:700, color:C.navy }}>
        🛡️ Painel Admin
      </h2>
      <p style={{ margin:'0 0 20px', fontSize:13, color:C.muted }}>
        Gerencie contas, permissões e convites
      </p>
      <div style={{ display:'flex', gap:4, marginBottom:24,
        borderBottom:`1px solid ${C.borderW}`, paddingBottom:0 }}>
        {[['convites','🔗 Convites'],['usuarios','👥 Usuários'],['custos','💰 Custos API']].map(([k,l]) => (
          <button key={k} onClick={() => setAba(k)} style={{
            padding:'8px 20px', border:'none', background:'none',
            fontSize:13.5, fontWeight: aba===k ? 700 : 400,
            color: aba===k ? C.navy : C.muted, cursor:'pointer',
            borderBottom: aba===k ? `2px solid ${C.emerald}` : '2px solid transparent',
            marginBottom:-1,
          }}>{l}</button>
        ))}
      </div>
      {msg && (
        <div style={{ padding:'10px 14px', borderRadius:8, marginBottom:16,
          background: msg.includes('Erro') ? '#FEE8E8' : C.emeraldL,
          color: msg.includes('Erro') ? '#C0392B' : C.emerald, fontSize:13 }}>
          {msg}
        </div>
      )}
      {aba === 'convites' && (
        <div>
          <div style={{ background:C.surface, borderRadius:12,
            padding:'20px 24px', marginBottom:24, border:`1px solid ${C.borderW}` }}>
            <h4 style={{ margin:'0 0 16px', fontSize:14, fontWeight:700, color:C.navy }}>
              Gerar novo convite
            </h4>
            <div style={{ display:'grid', gridTemplateColumns: isPhone ? '1fr' : '1fr 1fr', gap:12 }}>
              {[
                { label:'Nome do convidado*', key:'nome', type:'text', ph:'Ex: Pedro Advogado' },
                { label:'Email (opcional)', key:'email', type:'email', ph:'pedro@email.com' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize:11, fontWeight:600, color:C.muted,
                    textTransform:'uppercase', letterSpacing:'0.5px',
                    display:'block', marginBottom:5 }}>{f.label}</label>
                  <input type={f.type} value={novoConvite[f.key]}
                    onChange={e => setNovoConvite(p => ({...p, [f.key]: e.target.value}))}
                    placeholder={f.ph}
                    style={{ width:'100%', padding:'9px 12px', borderRadius:8,
                      border:`1.5px solid ${C.border}`, fontSize:13,
                      color:C.text, background:C.white, outline:'none',
                      boxSizing:'border-box' }} />
                </div>
              ))}
              <div>
                <label style={{ fontSize:11, fontWeight:600, color:C.muted,
                  textTransform:'uppercase', letterSpacing:'0.5px',
                  display:'block', marginBottom:5 }}>Permissão</label>
                <select value={novoConvite.role}
                  onChange={e => setNovoConvite(p => ({...p, role: e.target.value}))}
                  style={{ width:'100%', padding:'9px 12px', borderRadius:8,
                    border:`1.5px solid ${C.border}`, fontSize:13,
                    color:C.text, background:C.white }}>
                  <option value="member">Membro — vê análises, sem IA</option>
                  <option value="viewer">Visualizador — apenas leitura</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:600, color:C.muted,
                  textTransform:'uppercase', letterSpacing:'0.5px',
                  display:'block', marginBottom:5 }}>Observação</label>
                <input type="text" value={novoConvite.obs}
                  onChange={e => setNovoConvite(p => ({...p, obs: e.target.value}))}
                  placeholder="Ex: Sócio comercial"
                  style={{ width:'100%', padding:'9px 12px', borderRadius:8,
                    border:`1.5px solid ${C.border}`, fontSize:13,
                    color:C.text, background:C.white, outline:'none',
                    boxSizing:'border-box' }} />
              </div>
            </div>
            <button onClick={gerarConvite} disabled={loading}
              style={{ marginTop:14, padding:'10px 24px', borderRadius:8,
                border:'none', background: loading ? C.emeraldL : C.emerald,
                color: loading ? C.emerald : '#fff',
                fontSize:13.5, fontWeight:700, cursor: loading ? 'wait' : 'pointer' }}>
              {loading ? 'Gerando...' : '🔗 Gerar link de convite'}
            </button>
          </div>
          {linkGerado && (
            <div style={{ background:C.emeraldL, border:`1px solid ${C.emerald}30`,
              borderRadius:10, padding:'14px 16px', marginBottom:20 }}>
              <p style={{ margin:'0 0 8px', fontSize:12, fontWeight:700, color:C.emerald }}>
                ✅ Link gerado — válido por 7 dias
              </p>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <input readOnly value={linkGerado}
                  style={{ flex:1, padding:'8px 12px', borderRadius:7,
                    border:`1px solid ${C.emerald}30`, fontSize:12,
                    color:C.navy, background:C.white }} />
                <button onClick={() => {
                  navigator.clipboard.writeText(linkGerado)
                  setMsg('✅ Link copiado!')
                  setTimeout(() => setMsg(''), 2000)
                }} style={{ padding:'8px 14px', borderRadius:7,
                  background:C.emerald, color:'#fff', border:'none',
                  fontSize:12, fontWeight:600, cursor:'pointer', flexShrink:0 }}>
                  Copiar
                </button>
              </div>
            </div>
          )}
          <h4 style={{ margin:'0 0 10px', fontSize:13, fontWeight:700, color:C.navy }}>
            Convites gerados ({convites.length})
          </h4>
          {convites.length === 0 ? (
            <p style={{ color:C.hint, fontSize:13 }}>Nenhum convite ainda.</p>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {convites.map(c => {
                const expirou = vencido(c.expira_em)
                const status = c.usado ? 'usado' : expirou ? 'expirado' : 'ativo'
                const statusColor = status === 'ativo' ? C.emerald
                  : status === 'usado' ? C.muted : '#E5484D'
                return (
                  <div key={c.id} style={{ background:C.white,
                    border:`1px solid ${C.borderW}`, borderRadius:10,
                    padding:'12px 14px', display:'flex',
                    justifyContent:'space-between', alignItems:'center', gap:12 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4 }}>
                        <span style={{ fontSize:13, fontWeight:600, color:C.navy }}>
                          {c.nome || 'Sem nome'}
                        </span>
                        <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px',
                          borderRadius:10, background:`${statusColor}15`,
                          color:statusColor, textTransform:'uppercase' }}>
                          {status}
                        </span>
                        <span style={{ fontSize:10, color:C.hint,
                          padding:'2px 7px', borderRadius:10, background:C.surface }}>
                          {c.role === 'member' ? 'Membro' : c.role === 'admin' ? 'Admin' : 'Visualizador'}
                        </span>
                      </div>
                      <p style={{ margin:0, fontSize:11, color:C.muted }}>
                        {c.email && `${c.email} · `}
                        Criado {fmtDt(c.criado_em)} · Expira {fmtDt(c.expira_em)}
                      </p>
                    </div>
                    <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                      {status === 'ativo' && (
                        <>
                          <button onClick={() => {
                            navigator.clipboard.writeText(`${APP_URL}?convite=${c.token}`)
                            setMsg('✅ Link copiado!')
                            setTimeout(() => setMsg(''), 2000)
                          }} style={{ padding:'6px 12px', borderRadius:6,
                            background:C.emeraldL, color:C.emerald,
                            border:`1px solid ${C.emerald}30`,
                            fontSize:11, fontWeight:600, cursor:'pointer' }}>
                            Copiar link
                          </button>
                          <button onClick={() => revogar(c.id)}
                            style={{ padding:'6px 10px', borderRadius:6,
                              background:'#FEE8E8', color:'#C0392B',
                              border:'1px solid #E5484D20',
                              fontSize:11, cursor:'pointer' }}>
                            Revogar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
      {aba === 'usuarios' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between',
            alignItems:'center', marginBottom:14 }}>
            <h4 style={{ margin:0, fontSize:13, fontWeight:700, color:C.navy }}>
              {usuarios.length} usuário(s) cadastrado(s)
            </h4>
            <button onClick={carregarDados} style={{ padding:'6px 14px',
              borderRadius:7, border:`1px solid ${C.borderW}`,
              background:C.white, color:C.navy, fontSize:12,
              cursor:'pointer' }}>🔄 Atualizar</button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {usuarios.map(u => (
              <div key={u.id} style={{ background:C.white,
                border:`1px solid ${C.borderW}`, borderRadius:10,
                padding:'12px 16px', display:'flex',
                justifyContent:'space-between', alignItems:'center', gap:12 }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, flex:1 }}>
                  <div style={{ width:36, height:36, borderRadius:'50%',
                    background:`${C.navy}15`, display:'flex',
                    alignItems:'center', justifyContent:'center',
                    fontSize:14, fontWeight:700, color:C.navy, flexShrink:0 }}>
                    {(u.nome || u.email || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <p style={{ margin:0, fontSize:13, fontWeight:600, color:C.navy }}>
                      {u.nome || '—'}
                    </p>
                    <p style={{ margin:'1px 0 0', fontSize:11, color:C.muted }}>
                      {u.email} · Desde {fmtDt(u.criado_em)}
                    </p>
                  </div>
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
                  <select value={u.role} onChange={e => alterarRole(u.id, e.target.value)}
                    disabled={u.email === session?.user?.email}
                    style={{ padding:'5px 10px', borderRadius:6, fontSize:11,
                      border:`1px solid ${roleClr(u.role)}40`,
                      background:`${roleClr(u.role)}10`,
                      color:roleClr(u.role), fontWeight:600, cursor:'pointer' }}>
                    <option value="admin">Admin</option>
                    <option value="member">Membro</option>
                    <option value="viewer">Visualizador</option>
                  </select>
                  {u.email !== session?.user?.email && (<>
                    <button onClick={() => toggleAtivo(u.id, u.ativo)}
                      style={{ padding:'5px 12px', borderRadius:6,
                        fontSize:11, fontWeight:600, cursor:'pointer',
                        border:'none',
                        background: u.ativo ? '#FEE8E8' : C.emeraldL,
                        color: u.ativo ? '#C0392B' : C.emerald }}>
                      {u.ativo ? 'Desativar' : 'Reativar'}
                    </button>
                    <button onClick={async()=>{
                      await supabase.from('profiles').update({ pode_usar_api: !u.pode_usar_api }).eq('id', u.id)
                      carregarDados()
                    }}
                      style={{ padding:'5px 12px', borderRadius:6,
                        fontSize:11, fontWeight:600, cursor:'pointer',
                        border:'none',
                        background: u.pode_usar_api ? '#d1fae5' : '#f3f4f6',
                        color: u.pode_usar_api ? '#065f46' : '#6b7280' }}>
                      {u.pode_usar_api ? '🤖 API ativa' : '🔒 Sem API'}
                    </button>
                  </>)}
                  {u.email === session?.user?.email && (
                    <span style={{ fontSize:10, color:C.hint, fontStyle:'italic' }}>você</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {aba === 'custos' && (() => {
        const USD = 5.80
        const lista = propImoveis || []
        const totalUSD = lista.reduce((s,p) => s + (p.custo_api_usd || 0.10), 0)
        const media = lista.length ? totalUSD / lista.length : 0
        return (
          <div style={{ paddingTop: 16 }}>
            <div style={{ display:'grid', gridTemplateColumns: isPhone ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap:10, marginBottom:20 }}>
              {[
                ['Total gasto', `R$ ${(totalUSD*USD).toFixed(2)}`],
                ['Por análise', `R$ ${(media*USD).toFixed(2)}`],
                ['Análises', lista.length],
                ['Projeção 50/mês', `R$ ${(media*USD*50).toFixed(0)}`],
              ].map(([l,v]) => (
                <div key={l} style={{ background:C.surface, borderRadius:10,
                  padding:'12px 14px', border:`1px solid ${C.borderW}` }}>
                  <p style={{ margin:'0 0 3px', fontSize:10, color:C.muted }}>{l}</p>
                  <p style={{ margin:0, fontSize:16, fontWeight:800, color:C.navy }}>{v}</p>
                </div>
              ))}
            </div>
            <p style={{ margin:'0 0 8px', fontSize:12, fontWeight:700, color:C.navy }}>Por imóvel</p>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {[...lista]
                .sort((a,b) => (b.custo_api_usd||0.10)-(a.custo_api_usd||0.10))
                .map(p => (
                <div key={p.id} style={{ display:'flex', justifyContent:'space-between',
                  alignItems:'center', background:C.white,
                  border:`1px solid ${C.borderW}`, borderRadius:8, padding:'10px 14px' }}>
                  <div>
                    <p style={{ margin:0, fontSize:12, fontWeight:600, color:C.navy }}>
                      {p.codigo_axis && <span style={{ color:C.emerald }}>#{p.codigo_axis} · </span>}
                      {(p.titulo||p.endereco||'Imóvel').slice(0,40)}
                      {p.modo_teste && <span style={{ color:C.hint }}> · TESTE</span>}
                    </p>
                    <p style={{ margin:0, fontSize:10, color:C.muted }}>
                      {new Date(p.criado_em||Date.now()).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <span style={{ fontSize:13, fontWeight:700,
                    color: (p.custo_api_usd||0.10)*USD > 0.80 ? C.mustard : C.emerald }}>
                    R$ {((p.custo_api_usd||0.10)*USD).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            <p style={{ margin:'12px 0 0', fontSize:10, color:C.hint }}>
              * Estimativas. Sonnet: $3/1M input · $15/1M output. ChatGPT: ~$0,04/análise.
            </p>
          </div>
        )
      })()}
    </div>
  )
}

// ── ESTRATEGIA CONFIG ─────────────────────────────────────────────────────────
const ESTRATEGIA_CONFIG = {
  flip_rapido:    { emoji:'🔄', label:'Flip Rápido',    color:C.emerald },
  renda_passiva:  { emoji:'🏠', label:'Renda Passiva',  color:C.navy   },
  airbnb:         { emoji:'🌟', label:'Airbnb/Temporada',color:C.mustard},
  reforma_revenda:{ emoji:'🏗️', label:'Reforma + Venda',color:C.emerald},
  locacao_longa:  { emoji:'📋', label:'Locação Longa',  color:C.navy   },
}

// ── CALCULADORA ROI ──────────────────────────────────────────────────────────
function CalculadoraROI({ imovel }) {
  const [entrada, setEntrada] = useState(30)
  const [prazoVenda, setPrazoVenda] = useState(12)
  const [taxaJuros, setTaxaJuros] = useState(10.5)
  const [tabela, setTabela] = useState('price')
  const [estrategia, setEstrategia] = useState('flip')
  const lance       = imovel.valor_minimo || 0
  const comissao    = lance * 0.05
  const itbi        = lance * ((imovel.itbi_pct || 2) / 100)
  const doc         = lance * 0.005
  const reforma     = imovel.custo_reforma_calculado || imovel.custo_reforma_previsto || 0
  const custoTotal  = lance + comissao + itbi + doc + reforma
  const vmercado = imovel.valor_mercado_estimado || imovel.valor_pos_reforma_estimado
    || (imovel.preco_m2_mercado * (imovel.area_privativa_m2 || imovel.area_m2 || 0))
    || lance * 1.4
  const lucroFlip    = vmercado - custoTotal
  const roiFlip      = custoTotal > 0 ? (lucroFlip / custoTotal) * 100 : 0
  const aluguelMensal = imovel.aluguel_mensal_estimado
    || (vmercado * (imovel.yield_bruto_pct || 6) / 100 / 12)
  const rendaAnual   = aluguelMensal * 12
  const yieldLiquido = custoTotal > 0 ? (rendaAnual / custoTotal) * 100 : 0
  const valorFinanciado = custoTotal * (1 - entrada / 100)
  const entradaValor    = custoTotal * (entrada / 100)
  const taxaMensal      = taxaJuros / 100 / 12
  const prazoMeses      = 360
  const parcela         = tabela === 'price' && taxaMensal > 0
    ? valorFinanciado * (taxaMensal * Math.pow(1 + taxaMensal, prazoMeses))
        / (Math.pow(1 + taxaMensal, prazoMeses) - 1)
    : valorFinanciado / prazoMeses + valorFinanciado * taxaMensal
  const saldoDevedor = taxaMensal > 0
    ? valorFinanciado * Math.pow(1 + taxaMensal, prazoVenda)
      - parcela * (Math.pow(1 + taxaMensal, prazoVenda) - 1) / taxaMensal
    : valorFinanciado - parcela * prazoVenda
  const lucroFinanciado = vmercado - saldoDevedor - entradaValor - reforma - comissao - itbi - doc
  const fmt = n => n ? `R$ ${Math.round(n).toLocaleString('pt-BR')}` : '—'
  const pct = n => n ? `${n.toFixed(1)}%` : '—'
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
        <span style={{ fontSize:16 }}>💰</span>
        <h4 style={{ margin:0, fontSize:14, fontWeight:700, color:C.navy }}>
          Calculadora de Retorno
        </h4>
      </div>
      <div style={{ background:C.surface, borderRadius:10, padding:'12px 14px', marginBottom:12 }}>
        <p style={{ margin:'0 0 8px', fontSize:11, fontWeight:600, color:C.muted,
          textTransform:'uppercase', letterSpacing:'0.5px' }}>Custo Total de Aquisição</p>
        {[
          ['Lance mínimo',    fmt(lance)],
          ['Comissão leiloeiro (5%)', fmt(comissao)],
          [`ITBI (${imovel.itbi_pct || 2}%)`, fmt(itbi)],
          ['Documentação (0,5%)', fmt(doc)],
          reforma > 0 ? ['Reforma estimada', fmt(reforma)] : null,
        ].filter(Boolean).map(([k,v]) => (
          <div key={k} style={{ display:'flex', justifyContent:'space-between',
            padding:'4px 0', borderBottom:`1px solid ${C.borderW}`, fontSize:12 }}>
            <span style={{ color:C.muted }}>{k}</span>
            <span style={{ color:C.navy, fontWeight:500 }}>{v}</span>
          </div>
        ))}
        <div style={{ display:'flex', justifyContent:'space-between',
          padding:'6px 0 0', fontSize:13 }}>
          <span style={{ fontWeight:700, color:C.navy }}>Total</span>
          <span style={{ fontWeight:800, color:C.navy }}>{fmt(custoTotal)}</span>
        </div>
      </div>
      <div style={{ display:'flex', gap:4, marginBottom:12 }}>
        {[['flip','🔄 Flip'],['locacao','🏠 Locação'],['financiado','🏦 Financiado']].map(([k,l]) => (
          <button key={k} onClick={() => setEstrategia(k)} style={{
            flex:1, padding:'7px 4px', borderRadius:7, fontSize:11.5, fontWeight:500,
            border:`1px solid ${estrategia===k ? C.emerald : C.borderW}`,
            background: estrategia===k ? C.emeraldL : C.white,
            color: estrategia===k ? C.emerald : C.muted, cursor:'pointer',
          }}>{l}</button>
        ))}
      </div>
      {estrategia === 'flip' && (
        <div style={{ background:roiFlip > 20 ? C.emeraldL : C.surface,
          borderRadius:10, padding:'14px 16px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
            <div>
              <p style={{ margin:0, fontSize:11, color:C.muted }}>Valor de mercado est.</p>
              <p style={{ margin:0, fontSize:16, fontWeight:800, color:C.navy }}>{fmt(vmercado)}</p>
            </div>
            <div style={{ textAlign:'right' }}>
              <p style={{ margin:0, fontSize:11, color:C.muted }}>Lucro estimado</p>
              <p style={{ margin:0, fontSize:16, fontWeight:800,
                color: lucroFlip > 0 ? C.emerald : RED }}>{fmt(lucroFlip)}</p>
            </div>
          </div>
          <div style={{ background:C.white, borderRadius:8, padding:'8px 12px',
            display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:12, color:C.muted }}>ROI estimado</span>
            <span style={{ fontSize:18, fontWeight:800,
              color: roiFlip > 30 ? C.emerald : roiFlip > 15 ? C.mustard : RED }}>
              {pct(roiFlip)}
            </span>
          </div>
        </div>
      )}
      {estrategia === 'locacao' && (
        <div style={{ background:C.surface, borderRadius:10, padding:'14px 16px' }}>
          {[
            ['Aluguel mensal estimado', fmt(aluguelMensal)],
            ['Renda bruta anual', fmt(rendaAnual)],
            ['Yield bruto a.a.', pct(yieldLiquido)],
          ].map(([k,v]) => (
            <div key={k} style={{ display:'flex', justifyContent:'space-between',
              padding:'5px 0', borderBottom:`1px solid ${C.borderW}`, fontSize:12 }}>
              <span style={{ color:C.muted }}>{k}</span>
              <span style={{ color:C.navy, fontWeight:600 }}>{v}</span>
            </div>
          ))}
        </div>
      )}
      {estrategia === 'financiado' && (
        <div style={{ background:C.surface, borderRadius:10, padding:'14px 16px' }}>
          <div style={{ display:'flex', gap:8, marginBottom:10 }}>
            <div style={{ flex:1 }}>
              <p style={{ margin:'0 0 4px', fontSize:10, color:C.muted }}>Entrada (%)</p>
              <input type="range" min="10" max="90" value={entrada}
                onChange={e => setEntrada(+e.target.value)}
                style={{ width:'100%', accentColor: C.emerald, touchAction:'none' }} />
              <p style={{ margin:0, fontSize:11, fontWeight:600, color:C.navy,
                textAlign:'center' }}>{entrada}% = {fmt(entradaValor)}</p>
            </div>
            <div style={{ flex:1 }}>
              <p style={{ margin:'0 0 4px', fontSize:10, color:C.muted }}>Vender em (meses)</p>
              <input type="range" min="6" max="60" step="6" value={prazoVenda}
                onChange={e => setPrazoVenda(+e.target.value)}
                style={{ width:'100%', accentColor: C.emerald, touchAction:'none' }} />
              <p style={{ margin:0, fontSize:11, fontWeight:600, color:C.navy,
                textAlign:'center' }}>{prazoVenda} meses</p>
            </div>
          </div>
          {[
            ['1ª parcela estimada', fmt(parcela)],
            ['Saldo devedor na venda', fmt(Math.max(0, saldoDevedor))],
            ['Lucro líquido estimado', fmt(lucroFinanciado)],
          ].map(([k,v]) => (
            <div key={k} style={{ display:'flex', justifyContent:'space-between',
              padding:'5px 0', borderBottom:`1px solid ${C.borderW}`, fontSize:12 }}>
              <span style={{ color:C.muted }}>{k}</span>
              <span style={{ color: k.includes('Lucro') && lucroFinanciado > 0
                ? C.emerald : C.navy, fontWeight:600 }}>{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── MODO AO VIVO ─────────────────────────────────────────────────────────────
function ModoAoVivo({ imovel, onClose }) {
  const s = imovel
  const rec = s.recomendacao
  const recClr = rec === 'COMPRAR' ? C.emerald : rec === 'AGUARDAR' ? C.mustard : RED
  return (
    <div style={{
      position:'fixed', inset:0, zIndex:2000,
      background:'#0A1628', color:'#fff',
      display:'flex', flexDirection:'column',
      padding:'24px',
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <p style={{ margin:0, fontSize:10, color:'rgba(255,255,255,0.5)',
            textTransform:'uppercase', letterSpacing:'1px' }}>Modo Ao Vivo — AXIS</p>
          <p style={{ margin:'2px 0 0', fontSize:14, fontWeight:600, color:'#fff' }}>
            {s.titulo || s.endereco}
          </p>
        </div>
        <button onClick={onClose} style={{ background:'none', border:'none',
          color:'rgba(255,255,255,0.6)', fontSize:24, cursor:'pointer' }}>×</button>
      </div>
      <div style={{ textAlign:'center', padding:'20px 0' }}>
        <p style={{ margin:0, fontSize:72, fontWeight:900, color:recClr,
          lineHeight:1 }}>
          {s.score_total?.toFixed(1) || '—'}
        </p>
        <p style={{ margin:'4px 0 0', fontSize:18, fontWeight:700, color:recClr }}>
          {rec || 'AGUARDAR'}
        </p>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, flex:1 }}>
        {[
          ['💰 Lance mínimo', s.valor_minimo
            ? `R$ ${Number(s.valor_minimo).toLocaleString('pt-BR')}` : '—'],
          ['💸 Desconto', s.desconto_percentual ? `${s.desconto_percentual}%` : '—'],
          ['⚖️ Jurídico', `${s.score_juridico?.toFixed(1) || '—'}/10`],
          ['🏠 Ocupação', s.ocupacao || 'Verificar'],
          ['📍 Localização', `${s.score_localizacao?.toFixed(1) || '—'}/10`],
          ['💡 Custo total', s.valor_minimo
            ? `R$ ${Math.round(s.valor_minimo * 1.075 / 1000)}k est.` : '—'],
        ].map(([label, val]) => (
          <div key={label} style={{ background:'rgba(255,255,255,0.08)',
            borderRadius:10, padding:'12px 14px' }}>
            <p style={{ margin:'0 0 2px', fontSize:11,
              color:'rgba(255,255,255,0.5)' }}>{label}</p>
            <p style={{ margin:0, fontSize:16, fontWeight:700, color:'#fff' }}>{val}</p>
          </div>
        ))}
      </div>
      {s.alertas?.length > 0 && (
        <div style={{ marginTop:12, padding:'10px 14px',
          background:'rgba(229,72,77,0.15)', borderRadius:8,
          borderLeft:'3px solid #E5484D' }}>
          <p style={{ margin:'0 0 4px', fontSize:10, color:'#E5484D',
            fontWeight:700, textTransform:'uppercase' }}>⚠️ Alertas</p>
          {s.alertas.slice(0,2).map((a,i) => (
            <p key={i} style={{ margin:'2px 0', fontSize:11,
              color:'rgba(255,255,255,0.8)' }}>• {normalizarTextoAlerta(a)}</p>
          ))}
        </div>
      )}
    </div>
  )
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

// ── CARD COMPARÁVEL (Accordion) ──────────────────────────────────────────────
function CardComparavel({item:c, K, isPhone}) {
  const [aberto, setAberto] = useState(false)
  const fmtV = v => v ? `R$ ${Number(v).toLocaleString('pt-BR')}` : '—'
  return <div style={{marginBottom:6,borderRadius:8,overflow:"hidden",border:`1px solid ${K.bd}`}}>
    <div onClick={()=>setAberto(!aberto)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",cursor:"pointer",background:K.s2}}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:13,fontWeight:600,color:K.wh,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.descricao||'Comparável'}</div>
        <div style={{fontSize:11,color:K.t3}}>
          {c.preco_m2?`R$ ${c.preco_m2.toLocaleString('pt-BR')}/m²`:''}
          {c.similaridade?` · ${c.similaridade.toFixed(1)} compatib.`:''}
          {c.fonte?` · ${c.fonte}`:''}
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0,marginLeft:8}}>
        <span style={{fontWeight:700,fontSize:13,color:K.teal}}>{c.valor?`${(c.valor/1000).toFixed(0)}K`:''}</span>
        <span style={{fontSize:14,color:K.t3}}>{aberto?'▲':'▼'}</span>
      </div>
    </div>
    {aberto&&<div style={{padding:"10px 12px",background:K.bg,borderTop:`1px solid ${K.bd}`,display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
      {[['Área',c.area_m2?`${c.area_m2}m²`:'—'],['Quartos',c.quartos??'—'],['Vagas',c.vagas??'—'],
        ['Tipo',c.tipo??'—'],['Andar',c.andar??'—'],['Cond./mês',c.condominio_mes?fmtV(c.condominio_mes):'—']
      ].map(([label,val],i)=><div key={i}><div style={{fontSize:10,color:K.t3,textTransform:"uppercase",letterSpacing:.5}}>{label}</div><div style={{fontSize:12.5,fontWeight:600,color:K.wh}}>{val}</div></div>)}
      {c.link&&<a href={c.link} target="_blank" rel="noreferrer" style={{gridColumn:"1/-1",fontSize:11,color:K.teal,textDecoration:"none"}}>Ver anúncio →</a>}
    </div>}
  </div>
}

// ── DETAIL ────────────────────────────────────────────────────────────────────
function Detail({p,onDelete,onNav,trello,onUpdateProp,onReanalyze,isAdmin,onArchive,isMobile,isPhone}) {
  const [sending,setSending]=useState(false)
  const [modoAoVivo, setModoAoVivo]=useState(false)
  const [msg,setMsg]=useState("")
  const [abaDetalhe,setAbaDetalhe]=useState('resumo')
  const [reanalyzing,setReanalyzing]=useState(false)
  const [reStep,setReStep]=useState("")

  const handleReanalyze=async()=>{
    if(!p?.fonte_url){setMsg("⚠️ Imóvel sem URL de origem para reanalisar");return}
    const claudeKey=localStorage.getItem("axis-api-key")||""
    if(!claudeKey){setMsg("⚠️ Configure a API Key do Claude em Admin → API Keys");return}
    // Verificar permissão de uso da API
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: perfil } = await supabase.from('profiles').select('pode_usar_api, role').eq('id', user.id).single()
        const podeUsar = perfil?.role === 'admin' || perfil?.pode_usar_api === true
        if (!podeUsar) { setMsg('⚠️ Acesso à análise por IA não liberado. Solicite ao administrador.'); return }
      }
    } catch (e) { console.warn('[AXIS] Verificação pode_usar_api:', e.message) }
    if(!confirm("Reanalisar este imóvel com a IA? Os dados serão atualizados.")) return
    setReanalyzing(true);setMsg("")
    try {
      const openaiKey=localStorage.getItem("axis-openai-key")||""
      const {data:par}=await supabase.from("parametros_score").select("*")
      const {data:cri}=await supabase.from("criterios_avaliacao").select("*")
      const novaAnalise=await analisarImovelCompleto(p.fonte_url,claudeKey,openaiKey,par||[],cri||[],setReStep,[])
      const merged={...p,...novaAnalise,id:p.id,createdAt:p.createdAt,criado_por:p.criado_por}
      if(onUpdateProp) onUpdateProp(p.id,merged)
      // Salvar no Supabase
      import('./lib/supabase.js').then(({saveImovel})=>{
        const session=JSON.parse(localStorage.getItem('sb-session')||'null')
        saveImovel(merged,session?.user?.id).catch(()=>{})
      }).catch(()=>{})
      setMsg("✅ Imóvel reanalisado com sucesso!")
    } catch(e) { setMsg(`⚠️ Erro ao reanalisar: ${e.message}`) }
    setReanalyzing(false);setReStep("")
  }
  if(!p) return <div style={{padding:"40px",textAlign:"center",color:K.t3}}>Não encontrado</div>
  const sc=p.score_total||0, rc=recColor(p.recomendacao)
  const scores=[
    {l:"Localização",v:p.score_localizacao,w:"20%"},{l:"Desconto",v:p.score_desconto,w:"18%"},
    {l:"Jurídico",v:p.score_juridico,w:"18%"},{l:"Ocupação",v:p.score_ocupacao,w:"15%"},
    {l:"Liquidez",v:p.score_liquidez,w:"15%"},{l:"Mercado",v:p.score_mercado,w:"14%"},
  ]
  const sendTrello=async()=>{
    if(!trello?.listId){setMsg("Trello não configurado");return}
    setSending(true);setMsg("")
    try {
      if(trello.boardId) { const res=await criarCardImovel(p,trello.listId,trello.boardId,trello.key,trello.token); setMsg(res?.atualizado?"✓ Card atualizado no Trello!":"✓ Card enviado ao Trello com etiquetas!") }
      else { const cd=buildTrelloCard(p); await tPost("/cards",trello.key,trello.token,{idList:trello.listId,name:cd.name,desc:cd.desc}); setMsg("✓ Card enviado ao Trello!") }
    } catch(e){setMsg(`Erro: ${e.message}`)}
    setSending(false)
  }
  return <div>
    <Hdr title={<>{p.titulo||"Imóvel"}{p.codigo_axis&&<span style={{fontSize:"10.5px",fontWeight:700,padding:"2px 8px",borderRadius:4,background:"#002B8010",color:"#002B80",border:"1px solid #002B8020",fontFamily:"monospace",letterSpacing:"0.5px",marginLeft:10,verticalAlign:"middle"}}>{p.codigo_axis}</span>}{p.trello_card_url&&<a href={p.trello_card_url} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#0052CC",marginLeft:8,verticalAlign:"middle",textDecoration:"none"}}>Trello</a>}</>} sub={`${p.cidade}/${p.estado} · ${fmtD(p.createdAt)}`}
      actions={<>
        {p.fonte_url&&<a href={p.fonte_url} target="_blank" rel="noopener noreferrer" style={{...btn("s"),textDecoration:"none",display:"inline-block"}}>🔗 Anúncio</a>}
        {isAdmin&&<button style={{...btn("s"),background:`${K.amb}15`,color:K.amb,border:`1px solid ${K.amb}30`}} onClick={handleReanalyze} disabled={reanalyzing}>{reanalyzing?"⏳ Reanalisando...":"🔄 Reanalisar"}</button>}
        {isAdmin&&<button style={btn("trello")} onClick={sendTrello} disabled={sending}>{sending?"Enviando...":"🔷 Trello"}</button>}
        <button onClick={() => setModoAoVivo(true)} style={{
          padding:'5px 12px', borderRadius:8,
          background:'#E5484D', color:'#fff',
          border:'none', fontSize:11.5, fontWeight:700,
          cursor:'pointer', display:'flex', alignItems:'center', gap:5,
        }}>
          <span style={{ width:7, height:7, borderRadius:'50%',
            background:'#fff', display:'inline-block',
            animation:'pulse 1s infinite' }} />
          Ao Vivo
        </button>
        {isAdmin&&onArchive&&<button style={{...btn("s"),background:`${C.mustardL}`,color:C.mustard,border:`1px solid ${C.mustard}40`}} onClick={()=>onArchive(p.id)}>📦 Arquivar</button>}
        {isAdmin&&<button style={{...btn("d"),padding:"5px 12px",fontSize:"12px"}} onClick={()=>{if(confirm("Excluir?"))onDelete(p.id)}}>🗑</button>}
      </>}/>
    {/* Tabs */}
    <div style={{display:"flex",gap:isPhone?4:0,borderBottom:`1px solid ${K.bd}`,padding:isPhone?"0 16px":"0 28px",background:K.s1,overflowX:isPhone?'auto':'visible',scrollbarWidth:'none',WebkitOverflowScrolling:'touch',msOverflowStyle:'none'}}>
      {[{id:'resumo',label:'📊 Resumo'},{id:'juridico',label:'⚖️ Jurídico'},{id:'fotos',label:'📸 Fotos'},{id:'mercado',label:'🏙️ Mercado'}].map(tab=>(
        <button key={tab.id} onClick={()=>setAbaDetalhe(tab.id)} style={{
          background:"none",border:"none",padding:isPhone?"10px 12px":"10px 18px",fontSize:"12.5px",fontWeight:abaDetalhe===tab.id?700:500,whiteSpace:'nowrap',flexShrink:0,
          color:abaDetalhe===tab.id?K.teal:K.t3,cursor:"pointer",
          borderBottom:abaDetalhe===tab.id?`2px solid ${K.teal}`:"2px solid transparent",
          transition:"all 0.15s",
        }}>{tab.label}</button>
      ))}
    </div>
    <div style={{padding:isPhone?"16px":"20px 28px"}}>
      {msg&&<div style={{background:`${K.teal}10`,border:`1px solid ${K.teal}30`,borderRadius:"6px",padding:"10px",marginBottom:"14px",fontSize:"12px",color:K.teal}}>{msg}</div>}
      {reanalyzing&&reStep&&<div style={{background:`${K.amb}10`,border:`1px solid ${K.amb}30`,borderRadius:"7px",padding:"12px 16px",marginBottom:"14px",display:"flex",alignItems:"center",gap:"10px"}}>
        <div style={{width:8,height:8,borderRadius:"50%",background:K.amb,animation:"pulse 1s infinite",flexShrink:0}}/>
        <span style={{fontSize:"13px",color:K.amb,fontWeight:600}}>{reStep}</span>
      </div>}

      {abaDetalhe==='juridico'&&<AbaJuridica imovel={p} onReclassificado={(novaAnalise)=>{
        if(onUpdateProp) onUpdateProp(p.id, {
          score_juridico: novaAnalise.novo_score_juridico ?? p.score_juridico,
          recomendacao: novaAnalise.nova_recomendacao || p.recomendacao,
          processos_ativos: novaAnalise.processos_totais?.join(', ') || p.processos_ativos,
          reclassificado_por_doc: true
        })
      }}/>}

      {abaDetalhe==='fotos'&&<GaleriaFotos fotos={p.fotos||[]} foto_principal={p.foto_principal} url={p.url}/>}

      {abaDetalhe==='mercado'&&<div>
        <div style={card()}>
          <div style={{fontWeight:"600",color:K.wh,marginBottom:"12px",fontSize:"13px"}}>🏙️ Mercado Regional</div>
          {[["Tendência",p.mercado_tendencia,p.mercado_tendencia==="Alta"?K.grn:K.amb],["Demanda",p.mercado_demanda,p.mercado_demanda==="Alta"?K.grn:K.amb],["Tempo médio venda",p.mercado_tempo_venda_meses?`${p.mercado_tempo_venda_meses} meses`:"—",K.t2],["Preço/m² mercado",p.preco_m2_mercado?`R$ ${p.preco_m2_mercado}/m²`:"—",K.teal],["Aluguel estimado",fmtC(p.aluguel_mensal_estimado)+"/mês",K.pur],["Obs. mercado",p.mercado_obs||"—",K.t2]].map(([l,v,c])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${K.bd}`}}>
              <span style={{fontSize:"12px",color:K.t3}}>{l}</span><span style={{fontSize:"12.5px",fontWeight:"600",color:c}}>{v}</span>
            </div>
          ))}
        </div>
      </div>}

      {abaDetalhe==='resumo'&&<>
      <div style={{background:`${rc}10`,border:`1px solid ${rc}30`,borderRadius:"10px",padding:"20px",marginBottom:"16px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"16px"}}>
        <div style={{display:"flex",alignItems:"center",gap:"20px"}}>
          <ScoreRing score={sc} size={90}/>
          <div>
            <div style={{fontSize:"11px",color:K.t3,textTransform:"uppercase",letterSpacing:"1px",marginBottom:"4px"}}>Recomendação</div>
            <div style={{fontSize:"28px",fontWeight:"800",color:rc}}>{p.recomendacao||"—"}</div>
            <div style={{fontSize:"12px",color:K.t2,marginTop:"4px",maxWidth:"400px"}}>{p.justificativa}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
          <Bdg c={p.ocupacao==="Desocupado"?K.grn:K.red} ch={p.ocupacao||"—"}/>
          <Bdg c={p.financiavel?K.blue:K.t3} ch={p.financiavel?"Financiável":"Sem financ."}/>
          {p.fgts_aceito&&<Bdg c={K.pur} ch="FGTS"/>}
          <Bdg c={K.t3} ch={p.modalidade||"—"}/>
        </div>
      </div>
      {p.alertas?.length>0&&<div style={{background:`${K.red}10`,border:`1px solid ${K.red}30`,borderRadius:"8px",padding:"14px",marginBottom:"14px"}}>
        <div style={{fontSize:"11px",color:K.red,fontWeight:"700",textTransform:"uppercase",letterSpacing:"1px",marginBottom:"8px"}}>🚨 Alertas Críticos</div>
        {p.alertas.map((a,i)=><div key={i} style={{fontSize:"12.5px",color:K.tx,marginBottom:"4px"}}>• {normalizarTextoAlerta(a)}</div>)}
      </div>}
      {/* Estratégia recomendada badge */}
      {p.estrategia_recomendada_detalhe?.tipo && (() => {
        const cfg = ESTRATEGIA_CONFIG[p.estrategia_recomendada_detalhe.tipo]
        return cfg ? (
          <div style={{ display:'inline-flex', alignItems:'center', gap:6,
            padding:'5px 12px', borderRadius:20, marginBottom:14,
            background:`${cfg.color}15`, border:`1px solid ${cfg.color}30`,
            fontSize:12, fontWeight:600, color:cfg.color }}>
            {cfg.emoji} {cfg.label}
            {p.estrategia_recomendada_detalhe.prazo_estimado_meses && (
              <span style={{ fontWeight:400, opacity:0.8 }}>
                · {p.estrategia_recomendada_detalhe.prazo_estimado_meses} meses
              </span>
            )}
          </div>
        ) : null
      })()}
      {/* Síntese executiva */}
      {p.sintese_executiva && (
        <div style={{
          background: C.navyAlfa || '#F0F4FF',
          border: `1px solid ${C.navy}20`,
          borderLeft: `3px solid ${C.navy}`,
          borderRadius: '0 10px 10px 0',
          padding: '12px 16px', marginBottom: 16,
        }}>
          <p style={{ margin:'0 0 4px', fontSize:10, fontWeight:700, color:C.navy,
            textTransform:'uppercase', letterSpacing:'0.5px' }}>
            Síntese da análise
          </p>
          <p style={{ margin:0, fontSize:13, color:C.text, lineHeight:1.6 }}>
            {normalizarTextoAlerta(p.sintese_executiva)}
          </p>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:isPhone?"1fr":"1fr 1fr",gap:"14px",marginBottom:"14px"}}>
        <div style={card()}>
          <div style={{fontWeight:"600",color:K.wh,marginBottom:"12px",fontSize:"13px"}}>💰 Valores</div>
          {[["Avaliação",fmtC(p.valor_avaliacao),K.t2],["Lance mínimo",fmtC(p.valor_minimo),K.amb],["Desconto",p.desconto_percentual?`${p.desconto_percentual}%`:"—",K.grn],["Preço/m² imóvel",p.preco_m2_imovel?`R$ ${p.preco_m2_imovel}/m²`:"—",K.teal],["Preço/m² mercado",p.preco_m2_mercado?`R$ ${p.preco_m2_mercado}/m²`:"—",K.t2],["Aluguel estimado",fmtC(p.aluguel_mensal_estimado)+"/mês",K.pur]].map(([l,v,c])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${K.bd}`}}>
              <span style={{fontSize:"12px",color:K.t3}}>{l}</span><span style={{fontSize:"12.5px",fontWeight:"600",color:c}}>{v}</span>
            </div>
          ))}
        </div>
        <div style={card()}>
          <div style={{fontWeight:"600",color:K.wh,marginBottom:"12px",fontSize:"13px"}}>🏠 Ficha Técnica</div>
          {[["Tipo",p.tipologia||p.tipo],["Área privativa",(p.area_privativa_m2||p.area_m2)?`${p.area_privativa_m2||p.area_m2}m²`:"—"],
            ...(p.area_total_m2&&p.area_total_m2!==(p.area_privativa_m2||p.area_m2)?[["Área total (registral)",`${p.area_total_m2}m² · inclui área comum`]]:[]
            ),["Base de cálculo",(p.area_usada_calculo_m2||p.area_privativa_m2)?`${p.area_usada_calculo_m2||p.area_privativa_m2}m² (privativa)`:"—"],
            ["Quartos",p.quartos],["Suítes",p.suites],["Vagas",p.vagas],["Andar",p.andar],["Condomínio",p.condominio_mensal?`R$ ${p.condominio_mensal.toLocaleString('pt-BR')}/mês`:null],["Padrão",p.padrao_acabamento],["Leiloeiro",p.leiloeiro],["Data leilão",p.data_leilao],["Nº leilão",p.num_leilao?`${p.num_leilao}º leilão`:null],["Liquidez",p.liquidez],["Revenda est.",p.prazo_revenda_meses?`${p.prazo_revenda_meses} meses`:"—"]].filter(([,v])=>v&&v!==null&&v!=="—"&&v!=="0"&&v!==0).map(([l,v])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${K.bd}`}}>
              <span style={{fontSize:"12px",color:K.t3}}>{l}</span><span style={{fontSize:"12.5px",color:K.tx}}>{v}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{...card(),marginBottom:"14px"}}>
        <div style={{fontWeight:"600",color:K.wh,marginBottom:"14px",fontSize:"13px"}}>📊 Score por Dimensão</div>
        <div style={{display:"grid",gridTemplateColumns:isPhone?"1fr":isMobile?"repeat(2,1fr)":"repeat(3,1fr)",gap:"10px"}}>
          {scores.map(({l,v,w})=>(
            <div key={l} style={{background:K.s2,borderRadius:"6px",padding:"10px"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:"6px"}}>
                <span style={{fontSize:"11px",color:K.t3}}>{l}</span>
                <span style={{fontSize:"10px",color:K.t3}}>peso {w}</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                <div style={{flex:1,height:"6px",background:K.bd,borderRadius:"3px",overflow:"hidden"}}>
                  <div style={{width:`${(v||0)*10}%`,height:"100%",background:scoreColor(v||0),borderRadius:"3px"}}/>
                </div>
                <span style={{fontSize:"13px",fontWeight:"700",color:scoreColor(v||0),minWidth:"28px",textAlign:"right"}}>{(v||0).toFixed(1)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Calculadora ROI */}
      <div style={{...card(),marginBottom:"14px"}}>
        <CalculadoraROI imovel={p} />
      </div>
      <div style={{display:"grid",gridTemplateColumns:isPhone?"1fr":"1fr 1fr",gap:"14px",marginBottom:"14px"}}>
        <div style={card()}>
          <div style={{fontWeight:"600",color:K.wh,marginBottom:"12px",fontSize:"13px"}}>⚖️ Jurídico</div>
          {[["Processos",p.processos_ativos,{Nenhum:K.grn,Possível:K.amb,Confirmado:K.red,Desconhecido:K.t3}],
            ["Matrícula",p.matricula_status,{Limpa:K.grn,"Com ônus":K.red,Desconhecido:K.t3}],
            ["Déb. condomínio",p.debitos_condominio,{"Sem débitos":K.grn,"Com débitos":K.red,Desconhecido:K.t3}],
            ["Déb. IPTU",p.debitos_iptu,{"Sem débitos":K.grn,"Com débitos":K.red,Desconhecido:K.t3}]].map(([l,v,cs])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${K.bd}`,alignItems:"center"}}>
              <span style={{fontSize:"12px",color:K.t3}}>{l}</span>
              <span style={{fontSize:"12px",fontWeight:"600",color:cs?.[v]||K.t2}}>{v||"—"}</span>
            </div>
          ))}
          {p.obs_juridicas&&<div style={{marginTop:"10px",fontSize:"11.5px",color:K.t2,lineHeight:"1.6",background:K.s2,borderRadius:"5px",padding:"8px"}}>{normalizarTextoAlerta(p.obs_juridicas)}</div>}
          <button onClick={()=>setAbaDetalhe('juridico')} style={{marginTop:10,background:`${K.teal}12`,border:`1px solid ${K.teal}30`,borderRadius:6,padding:"6px 14px",fontSize:12,color:K.teal,fontWeight:600,cursor:"pointer",width:"100%"}}>📎 Anexar documentos jurídicos</button>
          {p.reclassificado_por_doc&&<div style={{marginTop:6,fontSize:10.5,color:K.amb,fontWeight:600}}>🔄 Reclassificado por documento</div>}
        </div>
        <div style={card()}>
          <div style={{fontWeight:"600",color:K.wh,marginBottom:"12px",fontSize:"13px"}}>📈 Retorno e Custos</div>
          {[["Custo regularização",fmtC(p.custo_regularizacao),K.amb],["Custo reforma",fmtC(p.custo_reforma),K.amb],["Retorno revenda",p.retorno_venda_pct?`+${p.retorno_venda_pct}%`:"—",K.grn],["Locação a.a.",p.retorno_locacao_anual_pct?`${p.retorno_locacao_anual_pct}%`:"—",K.teal],["Estrutura rec.",p.estrutura_recomendada,K.pur],["Tendência",p.mercado_tendencia,p.mercado_tendencia==="Alta"?K.grn:K.amb],["Demanda",p.mercado_demanda,p.mercado_demanda==="Alta"?K.grn:K.amb]].filter(([,v])=>v&&v!=="—").map(([l,v,c])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${K.bd}`}}>
              <span style={{fontSize:"12px",color:K.t3}}>{l}</span><span style={{fontSize:"12.5px",fontWeight:"600",color:c}}>{v}</span>
            </div>
          ))}
        </div>
      </div>
      {/* Preço/m² e Comparáveis */}
      <div style={{display:"grid",gridTemplateColumns:isPhone?"1fr":"1fr 1fr",gap:"14px",marginBottom:"14px"}}>
        <div style={card()}>
          <div style={{fontWeight:"600",color:K.wh,marginBottom:"12px",fontSize:"13px"}}>💰 Preço/m²</div>
          <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${K.bd}`}}>
            <span style={{fontSize:"12px",color:K.t3}}>Lance ÷ área privativa</span>
            <span style={{fontSize:"12.5px",fontWeight:"600",color:K.tx}}>R$ {Math.round((p.valor_minimo||0)/(p.area_usada_calculo_m2||p.area_privativa_m2||p.area_m2||1)).toLocaleString('pt-BR')}/m²</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${K.bd}`}}>
            <span style={{fontSize:"12px",color:K.t3}}>Mercado</span>
            <span style={{fontSize:"12.5px",fontWeight:"600",color:K.grn}}>R$ {(p.preco_m2_mercado||0).toLocaleString('pt-BR')}/m²</span>
          </div>
          {p.preco_m2_fonte&&<div style={{fontSize:"10px",color:K.t3,marginTop:"4px"}}>{p.preco_m2_fonte}</div>}
          {p.desconto_sobre_mercado_pct!=null&&<div style={{display:"flex",justifyContent:"space-between",padding:"6px 0"}}>
            <span style={{fontSize:"12px",color:K.t3}}>Desconto s/ mercado</span>
            <span style={{fontSize:"12.5px",fontWeight:"700",color:K.grn}}>{p.desconto_sobre_mercado_pct}%</span>
          </div>}
        </div>
        <div style={card()}>
          {p.custo_total_aquisicao?<>
            <div style={{fontWeight:"600",color:K.amb,marginBottom:"10px",fontSize:"13px"}}>🧾 Custo total real</div>
            {[["Lance mínimo",fmtC(p.valor_minimo)],["Comissão leiloeiro",fmtC(p.valor_minimo*(p.comissao_leiloeiro_pct||5)/100)],["ITBI",fmtC(p.valor_minimo*(p.itbi_pct||2)/100)],["Regularização",fmtC(p.custo_regularizacao)]].filter(([,v])=>v&&v!=="R$ 0").map(([l,v])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",fontSize:"12px"}}>
                <span style={{color:K.t3}}>{l}</span><span style={{color:K.tx}}>{v}</span>
              </div>
            ))}
            <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderTop:`1px solid ${K.bd}`,marginTop:"6px"}}>
              <span style={{fontSize:"13px",fontWeight:"700",color:K.wh}}>Total</span>
              <span style={{fontSize:"13px",fontWeight:"700",color:K.amb}}>R$ {p.custo_total_aquisicao.toLocaleString('pt-BR')}</span>
            </div>
          </>:<div style={{fontSize:"12px",color:K.t3}}>Custo total não calculado</div>}
        </div>
      </div>
      {/* Comparáveis */}
      {p.comparaveis?.length>0&&<div style={{...card(),marginBottom:"14px"}}>
        <div style={{fontWeight:"600",color:K.wh,marginBottom:"10px",fontSize:"13px"}}>🏘️ Comparáveis encontrados ({p.comparaveis.length})</div>
        {p.comparaveis.map((c,i)=><CardComparavel key={i} item={c} K={K} isPhone={isPhone}/>)}
      </div>}
      {/* Responsabilidade passivos */}
      {p.responsabilidade_debitos&&<div style={{...card(),marginBottom:"14px",background:p.responsabilidade_debitos==='exonerado'?`${K.grn}15`:p.responsabilidade_debitos==='sub_rogado'?`${K.teal}15`:`${K.red}15`,border:`1px solid ${p.responsabilidade_debitos==='exonerado'?K.grn:p.responsabilidade_debitos==='sub_rogado'?K.teal:K.red}30`}}>
        <div style={{fontSize:"12.5px",fontWeight:"600",color:p.responsabilidade_debitos==='exonerado'?K.grn:p.responsabilidade_debitos==='sub_rogado'?K.teal:K.red}}>
          {p.responsabilidade_debitos==='exonerado'?'✅ Passivos NÃO são do arrematante (edital exonera)':p.responsabilidade_debitos==='sub_rogado'?'📋 Débitos sub-rogados no preço (leilão judicial)':'⚠️ Verificar responsabilidade pelos passivos'}
        </div>
        {p.responsabilidade_fonte&&<div style={{fontSize:"10.5px",color:K.t3,marginTop:"4px"}}>Fonte: {p.responsabilidade_fonte}</div>}
      </div>}
      {(p.positivos?.length>0||p.negativos?.length>0)&&<div style={{display:"grid",gridTemplateColumns:isPhone?"1fr":"1fr 1fr",gap:"14px",marginBottom:"14px"}}>
        <div style={{...card(),borderTop:`2px solid ${K.grn}`}}>
          <div style={{fontWeight:"600",color:K.grn,marginBottom:"10px",fontSize:"13px"}}>✅ Pontos Positivos</div>
          {(p.positivos||[]).map((pt,i)=><div key={i} style={{fontSize:"12.5px",color:K.tx,marginBottom:"6px",display:"flex",gap:"8px"}}><span style={{color:K.grn}}>+</span>{normalizarTextoAlerta(pt)}</div>)}
        </div>
        <div style={{...card(),borderTop:`2px solid ${K.red}`}}>
          <div style={{fontWeight:"600",color:K.red,marginBottom:"10px",fontSize:"13px"}}>⚠️ Pontos de Atenção</div>
          {(p.negativos||[]).map((pt,i)=><div key={i} style={{fontSize:"12.5px",color:K.tx,marginBottom:"6px",display:"flex",gap:"8px"}}><span style={{color:K.red}}>−</span>{normalizarTextoAlerta(pt)}</div>)}
        </div>
      </div>}
      {p.endereco&&<div style={{...card(),marginBottom:"14px"}}><div style={{fontWeight:"600",color:K.wh,marginBottom:"6px",fontSize:"13px"}}>📍 Localização</div><div style={{fontSize:"13px",color:K.t2}}>{p.endereco}</div></div>}
      </>}
    </div>
    {modoAoVivo && <ModoAoVivo imovel={p} onClose={() => setModoAoVivo(false)} />}
  </div>
}

// ── LISTA ─────────────────────────────────────────────────────────────────────
function Lista({props,onNav,onDelete,trello,onUpdateProp}) {
  const isPhoneL = useIsMobile(480)
  const [q,setQ]=useState(""), [filter,setFilter]=useState("todos"), [sort,setSort]=useState("score")
  const [syncingTrello,setSyncingTrello]=useState(false)
  const [syncMsg,setSyncMsg]=useState("")
  let list=[...props]
  if(q) list=list.filter(p=>`${p.titulo} ${p.cidade} ${p.tipo}`.toLowerCase().includes(q.toLowerCase()))
  if(filter!=="todos") list=list.filter(p=>p.recomendacao===filter.toUpperCase())
  list.sort((a,b)=>sort==="score"?(b.score_total||0)-(a.score_total||0):sort==="desconto"?(b.desconto_percentual||0)-(a.desconto_percentual||0):sort==="valor"?(a.valor_minimo||0)-(b.valor_minimo||0):new Date(b.createdAt)-new Date(a.createdAt))

  const syncTrello=async()=>{
    if(!trello?.listId||!trello?.boardId){setSyncMsg("⚠️ Configure o Trello primeiro (ícone ⚙️)");setTimeout(()=>setSyncMsg(""),4000);return}
    if(!confirm(`Enviar/atualizar ${list.length} imóvel(is) no Trello?`)) return
    setSyncingTrello(true);setSyncMsg(`🔄 Enviando ${list.length} imóveis para o Trello...`)
    let ok=0,fail=0
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
      <div style={{display:"flex",gap:"10px",marginBottom:"16px",flexWrap:"wrap"}}>
        <input style={{...inp,maxWidth:isPhoneL?"100%":"260px",fontSize:isPhoneL?16:13}} placeholder="🔍 Buscar..." value={q} onChange={e=>setQ(e.target.value)}/>
        <select style={{...inp,width:"auto",cursor:"pointer"}} value={filter} onChange={e=>setFilter(e.target.value)}>
          <option value="todos">Todos</option><option value="comprar">Comprar</option><option value="aguardar">Aguardar</option><option value="evitar">Evitar</option>
        </select>
        <select style={{...inp,width:"auto",cursor:"pointer"}} value={sort} onChange={e=>setSort(e.target.value)}>
          <option value="score">Maior Score</option><option value="desconto">Maior Desconto</option><option value="valor">Menor Valor</option><option value="data">Mais Recente</option>
        </select>
      </div>
      {list.length===0?<div style={{textAlign:"center",padding:"40px",color:K.t3}}><div style={{fontSize:"32px",marginBottom:"10px"}}>🔍</div><div>Nenhum imóvel encontrado</div></div>
      :<div style={{display:"grid",gridTemplateColumns:isPhoneL?"1fr":"repeat(auto-fill,minmax(300px,1fr))",gap:"12px"}}>
        {list.map(p=><PropCard key={p.id} p={p} onNav={onNav}/>)}
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
  const dims=[["Score Total",p=>(p.score_total||0).toFixed(1),p=>scoreColor(p.score_total)],["Recomendação",p=>p.recomendacao,p=>recColor(p.recomendacao)],["Valor Mínimo",p=>fmtC(p.valor_minimo),()=>K.t2],["Desconto",p=>p.desconto_percentual?`${p.desconto_percentual}%`:"—",()=>K.grn],["Área",p=>p.area_m2?`${p.area_m2}m²`:"—",()=>K.t2],["Preço/m²",p=>p.preco_m2_imovel?`R$ ${p.preco_m2_imovel}`:"—",()=>K.t2],["Ocupação",p=>p.ocupacao,p=>p.ocupacao==="Desocupado"?K.grn:K.red],["Processos",p=>p.processos_ativos,p=>p.processos_ativos==="Nenhum"?K.grn:K.red],["Financiável",p=>p.financiavel?"Sim":"Não",p=>p.financiavel?K.grn:K.t3],["Retorno revenda",p=>p.retorno_venda_pct?`+${p.retorno_venda_pct}%`:"—",()=>K.grn]]
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
                <img src={imovel.foto_principal} alt=""
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
                    <p style={{ margin: 0, fontSize: 10.5, color: C.hint }}>Lance mínimo</p>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.navy }}>
                      {imovel.valor_minimo ? `R$ ${Number(imovel.valor_minimo).toLocaleString('pt-BR')}` : '—'}
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
export default function App() {
  const { session, profile, loading: authLoading, isAdmin } = useAuth()
  const isViewer = !isAdmin && profile?.role === 'viewer'
  const podeEditar = isAdmin
  const podeSoVer = !isAdmin
  if (authLoading) return <div style={{display:'flex',flexDirection:'column',height:'100dvh',background:C.offwhite,justifyContent:'center',alignItems:'center',color:C.navy,fontFamily:"'Inter',system-ui,sans-serif",fontSize:'16px',fontWeight:'700'}}>Carregando...</div>
  if (!session) return <Login />
  if (profile && !profile.ativo) return <div style={{display:'flex',height:'100dvh',background:C.offwhite,justifyContent:'center',alignItems:'center',color:'#E5484D',fontFamily:"'Inter',system-ui,sans-serif",flexDirection:'column',gap:'12px'}}><div style={{fontSize:'16px',fontWeight:'700'}}>Acesso desativado</div><div style={{fontSize:'13px',color:C.muted}}>Contate o administrador</div></div>
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
useEffect(()=>{async function lp(){try{const{data:pr}=await supabase.from("parametros_score").select("*");if(pr)setParametrosBanco(pr);const{data:cr}=await supabase.from("criterios_avaliacao").select("*");if(cr)setCriteriosBanco(cr)}catch(e){console.warn("parametros:",e)}}lp()},[])

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

  // FIX 1: Sync API keys from Supabase (cross-device)
  useEffect(()=>{
    if(!session) return
    import('./lib/supabase.js').then(({getAppSetting})=>{
      getAppSetting('anthropic_api_key').then(k=>{
        if(k&&k.length>10){localStorage.setItem('axis-api-key',k);setApiKey(k)}
      }).catch(()=>{})
      getAppSetting('openai_api_key').then(k=>{
        if(k&&k.length>10){localStorage.setItem('axis-openai-key',k)}
      }).catch(()=>{})
    }).catch(()=>{})
  },[session])

  const showToast=(msg,c)=>{setToast({msg,c:c||K.teal});setTimeout(()=>setToast(null),4500)}
  const nav=(v,p={})=>{setView(v);setVp(p)}

  useEffect(()=>{(async()=>{
    // Migração: leilax-* → axis-* (preservar dados do rebrand)
    const MIGRATE = [['leilax-props','axis-props'],['leilax-trello','axis-trello'],['leilax-api-key','axis-api-key'],['leilax-openai-key','axis-openai-key']]
    for(const [old,nw] of MIGRATE){
      const v=localStorage.getItem(old)
      if(v&&!localStorage.getItem(nw)){localStorage.setItem(nw,v);localStorage.removeItem(old)}
    }
    const t=await stLoad("axis-trello")
    if(t)setTrello(t); setL(true)
    // Mostrar modal de API key se não tiver
    if(!localStorage.getItem("axis-api-key")) setTimeout(()=>setShowApiKey(true),1000)
    // Carregar imóveis: Supabase como fonte primária, localStorage como fallback
    if(session) {
      try {
        // Migração única: localStorage → Supabase (usa saveImovelCompleto com payload seguro)
        if(!localStorage.getItem('axis-migracao-concluida')){
          const local=JSON.parse(localStorage.getItem('axis-props')||'[]')
          if(local.length>0){
            console.log(`[AXIS] Migrando ${local.length} imóveis locais para Supabase...`)
            const{saveImovelCompleto}=await import('./lib/supabase.js')
            let ok=0
            for(const im of local){try{await saveImovelCompleto(im,session.user.id);ok++}catch(e){console.warn('[AXIS] Migração falhou:',im.id,e.message,e)}}
            console.log(`[AXIS] Migração: ${ok}/${local.length} imóveis salvos no Supabase`)
            // Só marcar concluída se pelo menos 1 migrou com sucesso
            if(ok>0) localStorage.setItem('axis-migracao-concluida','true')
          } else {
            localStorage.setItem('axis-migracao-concluida','true')
          }
        }
        // Carregar do Supabase
        const{getImoveisAtivos:gi}=await import('./lib/supabase.js')
        const data=await gi()
        if(data&&data.length>0){
          setProps(data)
          stSave("axis-props",data) // cache local
        } else {
          // Fallback: tentar cache local
          const cache=JSON.parse(localStorage.getItem('axis-props')||'[]')
          if(cache.length>0) setProps(cache)
        }
      } catch(e) {
        console.error('[AXIS] Supabase indisponível, usando cache local:',e)
        const cache=JSON.parse(localStorage.getItem('axis-props')||'[]')
        if(cache.length>0) setProps(cache)
      }
    } else {
      const cache=await stLoad("axis-props")
      if(cache) setProps(cache)
    }
  })()},[])

  useEffect(()=>{if(loaded&&props.length>0)stSave("axis-props",props)},[props,loaded])
  useEffect(()=>{if(loaded&&trello)stSave("axis-trello",trello)},[trello,loaded])

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
    // 1. Atualizar state imediatamente (UI responsiva)
    setProps(ps=>{
      const existe=ps.find(x=>x.id===p.id)
      if(existe) return ps.map(x=>x.id===p.id?p:x)
      return [p,...ps]
    })
    showToast(`✓ ${p.codigo_axis} · ${p.titulo||"Imóvel"} — Score ${(p.score_total||0).toFixed(1)} · ${p.recomendacao}`)
    nav("detail",{id:p.id})
    // 2. Salvar no Supabase (fonte primária)
    if(session) {
      try {
        const{saveImovelCompleto}=await import('./lib/supabase.js')
        const salvo=await saveImovelCompleto(p,session.user.id)
        // Atualizar state com dados confirmados pelo Supabase
        setProps(ps=>ps.map(x=>x.id===salvo.id?salvo:x))
        console.log('[AXIS] Imóvel salvo no Supabase:',salvo.codigo_axis)
      } catch(e) {
        console.error('[AXIS] FALHA ao salvar no Supabase:',e.message,e)
        showToast(`⚠️ Salvo localmente — sync nuvem falhou: ${e.message}`)
      }
    }
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
      setupBoardAxis(AXIS_BOARDS.PIPELINE,cfg.key,cfg.token)
        .then(()=>console.log('[AXIS] Board Trello configurado'))
        .catch(e=>console.warn('[AXIS] Setup Trello:',e.message))
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
    ...(isAdmin?[{i:'📊',l:'Portfólio',v:'portfolio'}]:[]),
    ...(isAdmin?[{i:'🛡️',l:'Admin',v:'admin'}]:[]),
  ]
  const isAct=v=>view===v||(v==="imoveis"&&view==="detail")
  const selP=vp.id?props.find(p=>p.id===vp.id):null

  if(!loaded) return <div style={{display:"flex",height:"100dvh",background:C.offwhite,justifyContent:"center",alignItems:"center",flexDirection:"column",gap:"12px",fontFamily:"'Inter',system-ui,sans-serif"}}>
    <AxisLogo size="lg" />
    <div style={{color:C.muted,fontWeight:"500",fontSize:"14px",marginTop:8}}>Carregando...</div>
  </div>

  return <div style={{display:"flex",minHeight:"100dvh",background:C.offwhite,color:C.text,fontFamily:"'Inter',system-ui,sans-serif",fontSize:"14px",overflow:"hidden"}}>
    <style>{`*{box-sizing:border-box;}::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:${C.offwhite};}::-webkit-scrollbar-thumb{background:${C.border};border-radius:2px;}select option{background:${C.white};}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}a:hover{opacity:.8;}`}</style>

    {showTrello&&<TrelloModal config={trello} onSave={saveTrello} onClose={()=>setShowTrello(false)}/>}
    {showApiKey&&<ApiKeyModal onClose={()=>setShowApiKey(false)}/>}
    {showTrelloModal&&<ModalAuditoriaTrello config={trello||JSON.parse(localStorage.getItem('axis-trello')||'{}')} imoveis={props} onClose={()=>setShowTrelloModal(false)}/>}

{/* SIDEBAR — AXIS expandida 200px */}
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
    }}>
      🔷 Trello
    </button>
    {isAdmin&&<button onClick={()=>setShowApiKey(true)} style={{
      width:'100%',display:'flex',alignItems:'center',gap:10,
      padding:'8px 12px',borderRadius:8,border:'none',cursor:'pointer',
      background:'transparent',color:'rgba(255,255,255,0.45)',fontSize:13,fontWeight:400,textAlign:'left',
    }}>
      <Settings size={15} /> Config
    </button>}
    <div onClick={async()=>{if(confirm('Sair?')){const{signOut}=await import('./lib/supabase.js');await signOut()}}}
      style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',cursor:'pointer',borderRadius:8,marginTop:4}}>
      <div style={{width:30,height:30,borderRadius:'50%',background:`${C.emerald}25`,border:`1px solid ${C.emerald}50`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:C.emerald}}>
        {(profile?.nome||'U')[0].toUpperCase()}
      </div>
      <div style={{minWidth:0,overflow:"hidden"}}>
        <p style={{margin:0,fontSize:12,fontWeight:600,color:'rgba(255,255,255,0.8)',whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{profile?.nome||'Usuário'}</p>
        <p style={{margin:0,fontSize:10,color:'rgba(255,255,255,0.35)',whiteSpace:"nowrap"}}>{profile?.role||'membro'}</p>
      </div>
    </div>
  </div>
  <div style={{padding:'10px 16px',borderTop:'1px solid rgba(255,255,255,0.07)'}}>
    <p style={{margin:0,fontSize:10.5,color:'rgba(255,255,255,0.35)',lineHeight:1.5}}>AXIS Inteligência v2.1</p>
    <p style={{margin:0,fontSize:10,color:'rgba(255,255,255,0.2)'}}>Forma Patrimonial, MG</p>
  </div>
</aside>
{/* FIM SIDEBAR */}

    {/* CONTENT */}
    <div className="axis-main" style={{flex:1,overflowY:"auto",background:C.offwhite,display:"flex",flexDirection:"column",minWidth:0}}>
      {view==="dashboard"&&<Dashboard props={props} onNav={nav} profile={profile} isMobile={isMobile} isPhone={isPhone}/>}
  {view==="novo"&&(isAdmin?<NovoImovel onSave={addProp} onCancel={()=>nav("imoveis")} onNav={nav} trello={trello} parametrosBanco={parametrosBanco} criteriosBanco={criteriosBanco} isPhone={isPhone} existingProps={props}/>:<AcessoNegado mensagem="Análise de imóveis é restrita ao administrador."/>)}
      {view==="imoveis"&&<Lista props={props} onNav={nav} onDelete={delProp} trello={trello} onUpdateProp={(id,updates)=>setProps(ps=>ps.map(p=>p.id===id?{...p,...updates}:p))}/>}
      {view==="detail"&&<Detail p={selP} onDelete={delProp} onNav={nav} trello={trello} onUpdateProp={(id,updates)=>setProps(ps=>ps.map(p=>p.id===id?{...p,...updates}:p))} isAdmin={isAdmin} onArchive={handleArquivar} isMobile={isMobile} isPhone={isPhone}/>}
      {view==="comparar"&&<Comparativo props={props}/>}
    {view==="busca"&&(isAdmin?<BuscaGPT onAnalisar={(link)=>{nav("novo");setTimeout(()=>{},100)}}/>:<AcessoNegado mensagem="Busca com IA é restrita ao administrador."/>)}
    {view==="graficos"&&<div><div style={{padding:isPhone?"16px":"22px 28px 16px",borderBottom:`1px solid ${C.borderW}`,background:C.white}}><div style={{fontWeight:700,fontSize:19,color:C.text}}>Gráficos</div></div><div style={{padding:isPhone?"16px":"20px 28px"}}><Charts properties={props}/></div></div>}
    {view==="tarefas"&&<Tarefas/>}
    {view==="arquivados"&&<BancoArquivados session={session} isAdmin={isAdmin} isPhone={isPhone}/>}
    {view==="portfolio"&&isAdmin&&<PainelPortfolio props={props} isMobile={isMobile} isPhone={isPhone}/>}
    {view==="admin"&&isAdmin&&<PainelConvitesAdmin session={session} imoveis={props} isPhone={isPhone}/>}
    </div>

    {toast&&<div style={{position:"fixed",bottom:"16px",right:"16px",background:C.white,color:C.text,padding:"12px 20px",borderRadius:"10px",fontSize:"13px",fontWeight:"600",zIndex:9999,boxShadow:"0 8px 32px rgba(0,33,128,0.15)",maxWidth:"340px",border:`1px solid ${C.borderW}`}}>{toast.msg}</div>}
    <MobileNav items={navItems} activeKey={view} onNavigate={(v)=>nav(v)}/>
  </div>
}
