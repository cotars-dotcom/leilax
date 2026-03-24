import{useState,useEffect}from'react'
import{getTarefas,saveTarefa,updateTarefaStatus,getAllProfiles}from'../lib/supabase'
import{useAuth}from'../lib/AuthContext'
import{useIsMobile}from'../hooks/useIsMobile.js'

const K={bg:'#080B10',s1:'#111620',s2:'#171E2C',bd:'#1C2438',teal:'#00E5BB',red:'#FF4757',tx:'#DDE4F0',t2:'#8896B0',t3:'#3D4E6A',wh:'#FFFFFF',warn:'#FFB627',green:'#2ECC71'}

const COLS=[
  {id:'pendente',label:'⏳ Pendente',color:'#FFB627'},
  {id:'em_andamento',label:'▶ Em Andamento',color:'#00E5BB'},
  {id:'concluido',label:'✅ Concluído',color:'#2ECC71'},
  {id:'cancelado',label:'❌ Cancelado',color:'#FF4757'},
]

const PRIOS=[
  {id:'baixa',label:'Baixa',color:'#8896B0'},
  {id:'normal',label:'Normal',color:'#00E5BB'},
  {id:'alta',label:'Alta',color:'#FFB627'},
  {id:'urgente',label:'Urgente',color:'#FF4757'},
]

export default function Tarefas(){
  const isPhone=useIsMobile(480)
  const{profile,isAdmin}=useAuth()
  const[tarefas,setTarefas]=useState([])
  const[profiles,setProfiles]=useState([])
  const[loading,setLoading]=useState(true)
  const[showModal,setShowModal]=useState(false)
  const[filtroMembro,setFiltroMembro]=useState('todos')
  const[form,setForm]=useState({titulo:'',descricao:'',atribuido_para:'',prioridade:'normal',prazo:'',status:'pendente'})
  const[saving,setSaving]=useState(false)

  useEffect(()=>{load()},[])

  async function load(){
    setLoading(true)
    try{
      const[t,p]=await Promise.all([getTarefas(profile?.id,profile?.role),getAllProfiles()])
      setTarefas(t)
      setProfiles(p)
    }catch(e){console.error(e)}
    setLoading(false)
  }

  async function handleSave(e){
    e.preventDefault()
    if(!form.titulo)return
    setSaving(true)
    try{
      await saveTarefa({...form,criado_por:profile?.id})
      setShowModal(false)
      setForm({titulo:'',descricao:'',atribuido_para:'',prioridade:'normal',prazo:'',status:'pendente'})
      await load()
    }catch(er){console.error(er)}
    setSaving(false)
  }

  async function moverTarefa(id,novoStatus){
    try{
      await updateTarefaStatus(id,novoStatus)
      setTarefas(prev=>prev.map(t=>t.id===id?{...t,status:novoStatus}:t))
    }catch(e){console.error(e)}
  }

  const tarefasFiltradas=filtroMembro==='todos'?tarefas:tarefas.filter(t=>t.atribuido_para===filtroMembro||t.criado_por===filtroMembro)

  const inp={background:K.s2,border:'1px solid '+K.bd,borderRadius:'7px',padding:'9px 12px',color:K.tx,fontSize:'13px',width:'100%',outline:'none'}
  const cardStyle={background:K.s1,border:'1px solid '+K.bd,borderRadius:'10px',padding:'14px',marginBottom:'10px',cursor:'pointer'}

  if(loading)return<div style={{color:K.teal,padding:'40px',textAlign:'center',fontFamily:'system-ui'}}>⏳ Carregando tarefas...</div>

  return<div style={{fontFamily:"'DM Sans',system-ui,sans-serif",color:K.tx,minHeight:'100%',background:K.bg}}>
    <div style={{padding:isPhone?'16px 16px 12px':'22px 28px 16px',borderBottom:'1px solid '+K.bd,display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}>
      <div style={{fontWeight:700,fontSize:19,color:K.wh}}>✅ Tarefas</div>
      <div style={{display:'flex',gap:'10px',alignItems:'center'}}>
        {isAdmin&&<select value={filtroMembro} onChange={e=>setFiltroMembro(e.target.value)} style={{...inp,width:'auto',padding:'7px 10px'}}>
          <option value="todos">Todos os membros</option>
          {profiles.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>}
        <button onClick={()=>setShowModal(true)} style={{background:K.teal,color:'#000',border:'none',borderRadius:'8px',padding:'9px 18px',fontSize:'13px',fontWeight:'700',cursor:'pointer'}}>+ Nova Tarefa</button>
      </div>
    </div>

    <div style={{padding:isPhone?'16px':'20px 28px',display:'grid',gridTemplateColumns:isPhone?'repeat(4,minmax(240px,1fr))':'repeat(4,1fr)',gap:isPhone?'12px':'16px',overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
      {COLS.map(col=>{
        const items=tarefasFiltradas.filter(t=>t.status===col.id)
        return<div key={col.id} style={{background:K.s1,border:'1px solid '+K.bd,borderRadius:'12px',padding:'14px',minHeight:'400px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'14px'}}>
            <span style={{fontWeight:700,fontSize:'13px',color:col.color}}>{col.label}</span>
            <span style={{background:col.color+'20',color:col.color,borderRadius:'12px',padding:'2px 8px',fontSize:'11px',fontWeight:700}}>{items.length}</span>
          </div>
          {items.map(t=>{
            const prio=PRIOS.find(p=>p.id===t.prioridade)||PRIOS[1]
            const atrib=profiles.find(p=>p.id===t.atribuido_para)
            return<div key={t.id} style={cardStyle}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'6px'}}>
                <div style={{fontWeight:600,fontSize:'13px',color:K.wh,flex:1,paddingRight:'8px'}}>{t.titulo}</div>
                <span style={{background:prio.color+'25',color:prio.color,borderRadius:'6px',padding:'2px 7px',fontSize:'10px',fontWeight:700,whiteSpace:'nowrap'}}>{prio.label}</span>
              </div>
              {t.descricao&&<div style={{fontSize:'12px',color:K.t2,marginBottom:'8px',lineHeight:1.5}}>{t.descricao.substring(0,80)}{t.descricao.length>80?'...':''}</div>}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:'8px'}}>
                <div style={{fontSize:'11px',color:K.t3}}>
                  {atrib&&<span>👤 {atrib.nome}</span>}
                  {t.prazo&&<span style={{marginLeft:'8px'}}>🗓 {new Date(t.prazo).toLocaleDateString('pt-BR')}</span>}
                </div>
                <select onChange={e=>moverTarefa(t.id,e.target.value)} value={t.status} style={{background:K.s2,border:'1px solid '+K.bd,borderRadius:'6px',padding:'3px 6px',color:K.t2,fontSize:'11px',cursor:'pointer',outline:'none'}}>
                  {COLS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
            </div>
          })}
        </div>
      })}
    </div>

    {showModal&&<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:isPhone?'16px':0}}>
      <div style={{background:K.s1,border:'1px solid '+K.bd,borderRadius:'14px',padding:isPhone?'20px':'28px',width:'90vw',maxWidth:'480px',maxHeight:'90vh',overflowY:'auto'}}>
        <div style={{fontWeight:700,fontSize:'16px',color:K.wh,marginBottom:'20px'}}>+ Nova Tarefa</div>
        <form onSubmit={handleSave}>
          <div style={{marginBottom:'14px'}}>
            <div style={{fontSize:'11px',color:K.t3,marginBottom:'5px',textTransform:'uppercase'}}>Título *</div>
            <input style={inp} value={form.titulo} onChange={e=>setForm(f=>({...f,titulo:e.target.value}))} placeholder="Título da tarefa"/>
          </div>
          <div style={{marginBottom:'14px'}}>
            <div style={{fontSize:'11px',color:K.t3,marginBottom:'5px',textTransform:'uppercase'}}>Descrição</div>
            <textarea style={{...inp,height:'80px',resize:'vertical'}} value={form.descricao} onChange={e=>setForm(f=>({...f,descricao:e.target.value}))} placeholder="Detalhes..."/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'14px'}}>
            <div>
              <div style={{fontSize:'11px',color:K.t3,marginBottom:'5px',textTransform:'uppercase'}}>Atribuir para</div>
              <select style={inp} value={form.atribuido_para} onChange={e=>setForm(f=>({...f,atribuido_para:e.target.value}))}>
                <option value="">Selecionar...</option>
                {profiles.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <div>
              <div style={{fontSize:'11px',color:K.t3,marginBottom:'5px',textTransform:'uppercase'}}>Prioridade</div>
              <select style={inp} value={form.prioridade} onChange={e=>setForm(f=>({...f,prioridade:e.target.value}))}>
                {PRIOS.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{marginBottom:'20px'}}>
            <div style={{fontSize:'11px',color:K.t3,marginBottom:'5px',textTransform:'uppercase'}}>Prazo</div>
            <input style={inp} type="date" value={form.prazo} onChange={e=>setForm(f=>({...f,prazo:e.target.value}))}/>
          </div>
          <div style={{display:'flex',gap:'10px',justifyContent:'flex-end'}}>
            <button type="button" onClick={()=>setShowModal(false)} style={{background:K.s2,border:'1px solid '+K.bd,borderRadius:'8px',padding:'9px 18px',color:K.t2,cursor:'pointer',fontSize:'13px'}}>Cancelar</button>
            <button type="submit" disabled={saving} style={{background:K.teal,color:'#000',border:'none',borderRadius:'8px',padding:'9px 18px',fontWeight:700,cursor:'pointer',fontSize:'13px'}}>{saving?'Salvando...':'Salvar'}</button>
          </div>
        </form>
      </div>
    </div>}
  </div>
}
