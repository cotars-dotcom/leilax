import { useState, useEffect, useRef } from "react"
import { C, K, RED, btn, inp, card, fmtC, fmtD, scoreColor, scoreLabel, recColor, mapDisplay, normalizarTextoAlerta, ESTRATEGIA_CONFIG, LIQUIDEZ_MAP } from "../appConstants.js"
import { supabase } from "../lib/supabase.js"
import { analisarImovelCompleto } from "../lib/dualAI.js"
import { criarCardImovel } from "../lib/trelloService.js"
import CalculadoraROI from "./CalculadoraROI.jsx"

const Bdg = ({c,ch}) => <span style={{display:"inline-block",fontSize:"10px",fontWeight:"700",padding:"2px 8px",borderRadius:"5px",textTransform:"uppercase",letterSpacing:".5px",background:`${c}12`,color:c}}>{ch}</span>

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

// Trello helpers (used by Detail for legacy fallback)
const BASE = "https://api.trello.com/1"
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
      const { getDocumentosJuridicos } = await import('../lib/supabase.js')
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

        const { processarDocumentoJuridico } = await import('../lib/analisadorJuridico.js')
        const analise = await processarDocumentoJuridico(
          { nome: file.name, tipo, conteudo, base64, mediaType },
          imovel, claudeKey, openaiKey, setProgresso
        )

        if (!analise) {
          setErro(`Não foi possível analisar ${file.name}`)
          continue
        }

        const { salvarDocumentoJuridico, reclassificarImovel } = await import('../lib/supabase.js')
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

export default function Detail({p,onDelete,onNav,trello,onUpdateProp,onReanalyze,isAdmin,onArchive,isMobile,isPhone}) {
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
      // parametros_score e criterios_avaliacao podem não existir no banco — usar arrays vazios
      const novaAnalise=await analisarImovelCompleto(p.fonte_url,claudeKey,openaiKey,[],[],setReStep,[])
      const merged={...p,...novaAnalise,id:p.id,createdAt:p.createdAt,criado_por:p.criado_por}
      if(onUpdateProp) onUpdateProp(p.id,merged)
      // Salvar no Supabase — buscar session corretamente
      try {
        const { data:{ session:sess } } = await supabase.auth.getSession()
        const { saveImovelCompleto } = await import('../lib/supabase.js')
        await saveImovelCompleto(merged, sess?.user?.id)
        setMsg("✅ Imóvel reanalisado e salvo com sucesso!")
      } catch(saveErr) {
        console.warn('[AXIS] Salvar reanálise:', saveErr.message)
        setMsg("✅ Reanalisado! (sync nuvem falhou — tente novamente)")
      }
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
    <Hdr title={<>{p.titulo||"Imóvel"}{p.codigo_axis&&<span style={{fontSize:"10.5px",fontWeight:700,padding:"2px 8px",borderRadius:4,background:"#002B8010",color:"#002B80",border:"1px solid #002B8020",fontFamily:"monospace",letterSpacing:"0.5px",marginLeft:10,verticalAlign:"middle"}}>{p.codigo_axis}</span>}{p.num_leilao&&<span style={{display:"inline-block",background:p.num_leilao>=2?"#FEF3C7":"#ECFDF5",color:p.num_leilao>=2?"#D97706":"#065F46",fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:4,marginLeft:6,verticalAlign:"middle"}}>{p.num_leilao}º LEILÃO{p.num_leilao>=2?" · mín. 50%":""}</span>}{p.trello_card_url&&<a href={p.trello_card_url} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#0052CC",marginLeft:8,verticalAlign:"middle",textDecoration:"none"}}>Trello</a>}</>} sub={`${p.cidade}/${p.estado} · ${fmtD(p.createdAt)}`}
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
          {[["Tendência",mapDisplay(p.mercado_tendencia),p.mercado_tendencia==="Alta"?K.grn:K.amb],["Demanda",mapDisplay(p.mercado_demanda),p.mercado_demanda==="Alta"?K.grn:K.amb],["Tempo médio venda",p.mercado_tempo_venda_meses?`${p.mercado_tempo_venda_meses} meses`:"—",K.t2],["Preço/m² mercado",p.preco_m2_mercado?`R$ ${p.preco_m2_mercado}/m²`:"—",K.teal],["Aluguel estimado",fmtC(p.aluguel_mensal_estimado)+"/mês",K.pur],["Obs. mercado",p.mercado_obs||"—",K.t2]].map(([l,v,c])=>(
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
            ["Quartos",p.quartos],["Suítes",p.suites],["Vagas",p.vagas],["Andar",p.andar],["Condomínio",p.condominio_mensal?`R$ ${p.condominio_mensal.toLocaleString('pt-BR')}/mês`:null],["Padrão",p.padrao_acabamento],["Leiloeiro",p.leiloeiro],["Data leilão",p.data_leilao],["Nº leilão",p.num_leilao?`${p.num_leilao}º leilão`:null],["Liquidez",LIQUIDEZ_MAP[p.liquidez?.toLowerCase()]||p.liquidez],["Revenda est.",p.prazo_revenda_meses?`${p.prazo_revenda_meses} meses`:"—"]].filter(([,v])=>v&&v!==null&&v!=="—"&&v!=="0"&&v!==0).map(([l,v])=>(
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
      {/* Plano de Reforma */}
      <div style={{...card(),marginBottom:"14px"}}>
        <div style={{padding:16,color:'#888',fontSize:13,textAlign:'center'}}>Plano de reforma — em breve</div>
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
          {[["Custo regularização",fmtC(p.custo_regularizacao),K.amb],["Custo reforma",fmtC(p.custo_reforma),K.amb],["Retorno revenda",p.retorno_venda_pct?`+${p.retorno_venda_pct}%`:"—",K.grn],["Locação a.a.",p.retorno_locacao_anual_pct?`${p.retorno_locacao_anual_pct}%`:"—",K.teal],["Estrutura rec.",mapDisplay(p.estrutura_recomendada),K.pur],["Tendência",mapDisplay(p.mercado_tendencia),p.mercado_tendencia==="Alta"?K.grn:K.amb],["Demanda",mapDisplay(p.mercado_demanda),p.mercado_demanda==="Alta"?K.grn:K.amb]].filter(([,v])=>v&&v!=="—").map(([l,v,c])=>(
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
