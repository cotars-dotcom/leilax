import { useState, useEffect, useRef } from "react"
import { C, K, RED, btn, inp, card, fmtC, fmtD, scoreColor, scoreLabel, recColor, mapDisplay, normalizarTextoAlerta, ESTRATEGIA_CONFIG, LIQUIDEZ_MAP } from "../appConstants.js"
import { supabase } from "../lib/supabase.js"
import { analisarImovelCompleto } from "../lib/motorIA.js"
import { criarCardImovel } from "../lib/trelloService.js"
import CalculadoraROI from "./CalculadoraROI.jsx"
import { CLASSES_MERCADO_REFORMA, calcularCustoReforma, detectarClasseMercado } from "../data/custos_reforma.js"
import PainelLeilao from './PainelLeilao.jsx'
import AbaJuridicaAgente from './AbaJuridicaAgente.jsx'
import { buscarArrematesSimilares } from '../lib/buscaArrematesGPT.js'
import PainelLancamento from './PainelLancamento.jsx'
import CenariosReforma from './CenariosReforma.jsx'

const ESCOPOS_INFO = {
  refresh_giro: {
    nome: 'Refresh Rápido',
    descricao: 'Pintura + reparos + revisão pontual — ideal para flip rápido',
    itens: ['Pintura geral interna', 'Correção de trincas e infiltrações', 'Limpeza e higienização profunda', 'Revisão elétrica pontual', 'Revisão hidráulica pontual'],
    prazo: '3–5 semanas'
  },
  leve_funcional: {
    nome: 'Leve Funcional',
    descricao: 'Refresh + piso + troca funcional — valorização 10–18%',
    itens: ['Tudo do Refresh', 'Troca de piso sala e quartos', 'Reforma banheiro social', 'Modernização de torneiras e metais', 'Iluminação LED'],
    prazo: '6–10 semanas'
  },
  leve_reforcada_1_molhado: {
    nome: 'Leve Reforçada (1 molhado)',
    descricao: 'Leve + 1 banheiro ou cozinha completa — valorização 18–28%',
    itens: ['Tudo do Leve Funcional', 'Reforma completa 1 banheiro OU cozinha', 'Revestimento novo no molhado', 'Louças e metais novos'],
    prazo: '10–16 semanas'
  },
  media: {
    nome: 'Reforma Média',
    descricao: 'Todos os molhados + elétrica/hidráulica — valorização 25–40%',
    itens: ['Reforma todos os banheiros', 'Reforma cozinha completa', 'Troca de toda a parte elétrica', 'Troca de toda a parte hidráulica', 'Pisos e revestimentos novos'],
    prazo: '16–24 semanas'
  },
  pesada: {
    nome: 'Reforma Pesada',
    descricao: 'Estrutural + layout — alto investimento, alto retorno potencial',
    itens: ['Tudo da Média', 'Alteração de layout (demolição/construção)', 'Forro de gesso novo', 'Esquadrias novas', 'Fachada (se aplicável)'],
    prazo: '24–36 semanas'
  }
}

function PainelReforma({ imovel }) {
  const escopo = imovel.escopo_reforma || 'refresh_giro'
  const area = imovel.area_usada_calculo_m2 || imovel.area_privativa_m2 || imovel.area_m2 || 0
  const precoM2 = imovel.preco_m2_mercado || 0

  const resultado = area > 0 ? calcularCustoReforma({
    area_m2: area,
    escopo,
    preco_m2_atual: precoM2
  }) : null

  const info = ESCOPOS_INFO[escopo] || ESCOPOS_INFO['refresh_giro']
  const fmtV = v => v ? `R$ ${Math.round(v).toLocaleString('pt-BR')}` : '—'

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
        <span style={{ fontSize:16 }}>🔧</span>
        <h4 style={{ margin:0, fontSize:14, fontWeight:700, color:C.navy }}>
          Plano de Reforma — {info.nome}
        </h4>
      </div>
      <div style={{ background:C.surface, borderRadius:8, padding:'10px 14px', marginBottom:10 }}>
        <p style={{ margin:0, fontSize:12, color:C.muted, lineHeight:1.5 }}>{info.descricao}</p>
        {resultado?.classe_label && (
          <p style={{ margin:'4px 0 0', fontSize:11, color:C.navy, fontWeight:500 }}>
            Classe: {resultado.classe_label}
          </p>
        )}
      </div>
      <div style={{ background:C.surface, borderRadius:8, padding:'10px 14px', marginBottom:10 }}>
        <p style={{ margin:'0 0 6px', fontSize:11, fontWeight:600, color:C.muted, textTransform:'uppercase', letterSpacing:'0.5px' }}>
          Itens incluídos
        </p>
        {info.itens.map((item, i) => (
          <div key={i} style={{ display:'flex', gap:8, padding:'3px 0', fontSize:12, color:C.text }}>
            <span style={{ color:C.emerald, flexShrink:0 }}>✓</span>
            {item}
          </div>
        ))}
      </div>
      {resultado && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
          <div style={{ background:C.surface, borderRadius:8, padding:'10px 14px' }}>
            <p style={{ margin:0, fontSize:11, color:C.muted }}>Custo estimado</p>
            <p style={{ margin:'4px 0 0', fontSize:16, fontWeight:800, color:C.navy }}>
              {fmtV(resultado.custo_total_final)}
            </p>
            <p style={{ margin:'2px 0 0', fontSize:10, color:C.muted }}>
              {fmtV(resultado.custo_m2_usado)}/m² · {area}m²
              {resultado.reserva_contingencia > 0 && ` · incl. 12% reserva`}
            </p>
          </div>
          <div style={{ background:C.surface, borderRadius:8, padding:'10px 14px' }}>
            <p style={{ margin:0, fontSize:11, color:C.muted }}>Prazo estimado</p>
            <p style={{ margin:'4px 0 0', fontSize:16, fontWeight:800, color:C.navy }}>
              {info.prazo}
            </p>
            <p style={{ margin:'2px 0 0', fontSize:10, color:C.muted }}>obra + contratações</p>
          </div>
        </div>
      )}
      {imovel.alerta_sobrecap && imovel.alerta_sobrecap !== 'verde' && (
        <div style={{
          background: imovel.alerta_sobrecap === 'vermelho' ? '#FEE2E2' : '#FEF3C7',
          border: `1px solid ${imovel.alerta_sobrecap === 'vermelho' ? '#FCA5A5' : '#FCD34D'}`,
          borderRadius:8, padding:'10px 14px', fontSize:12,
          color: imovel.alerta_sobrecap === 'vermelho' ? '#991B1B' : '#92400E'
        }}>
          {imovel.alerta_sobrecap === 'vermelho' ? '⚠️ ATENÇÃO CRÍTICA' : '⚡ ATENÇÃO'}: Custo de reforma pode exceder o teto para este bairro. Revisar escopo antes de executar.
        </div>
      )}
      <p style={{ fontSize:10, color:C.muted, marginTop:8, fontStyle:'italic' }}>
        Base: SINAPI MG jun/2025 + Preço da Obra BH 2026 · Custo direto (MO + materiais).
        Não inclui: projeto, ART, mobiliário, eletrodomésticos.
      </p>
    </div>
  )
}

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
  const score = (p.score_total||0).toFixed(2)
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

function GaleriaFotos({ fotos = [], foto_principal = null, url = null, imovelId = null, onFotosAtualizadas = null, isAdmin = false }) {
  const [fotoAtiva, setFotoAtiva] = useState(foto_principal || fotos[0] || null)
  const [buscando, setBuscando] = useState(false)
  const [msgFoto, setMsgFoto] = useState('')
  const [fotosLocais, setFotosLocais] = useState(fotos)
  const [principalLocal, setPrincipalLocal] = useState(foto_principal)

  const buscarFotos = async () => {
    if (!url) return
    setBuscando(true); setMsgFoto('')
    try {
      const { buscarFotosImovel } = await import('../lib/buscadorFotos.js')
      const geminiKey = localStorage.getItem('axis-gemini-key') || ''
      const resultado = await buscarFotosImovel({ fonte_url: url, id: imovelId }, geminiKey, setMsgFoto)
      if (resultado.fotos.length > 0 || resultado.foto_principal) {
        setFotosLocais(resultado.fotos)
        setPrincipalLocal(resultado.foto_principal)
        setFotoAtiva(resultado.foto_principal || resultado.fotos[0])
        setMsgFoto(`✅ ${resultado.fotos.length} fotos encontradas (${resultado.fonte})`)
        // Salvar no banco
        if (imovelId && onFotosAtualizadas) {
          onFotosAtualizadas(resultado.fotos, resultado.foto_principal)
        }
      } else {
        setMsgFoto('⚠️ Nenhuma foto encontrada automaticamente. Tente ver o anúncio original.')
      }
    } catch(e) {
      setMsgFoto('⚠️ Erro ao buscar fotos: ' + e.message)
    }
    setBuscando(false)
  }

  const todasFotosExib = principalLocal
    ? [principalLocal, ...fotosLocais.filter(f => f !== principalLocal)]
    : fotosLocais

  if (!fotosLocais.length && !principalLocal) return (
    <div style={{ textAlign:'center', padding:'32px 24px', color:C.hint }}>
      <div style={{ fontSize:40, marginBottom:12 }}>📷</div>
      <p style={{ margin:'0 0 6px', fontSize:14, fontWeight:600, color:C.muted }}>Nenhuma foto disponível</p>
      <p style={{ margin:'0 0 16px', fontSize:12, color:C.hint }}>
        Fotos são extraídas automaticamente do edital. Clique em buscar ou veja o anúncio original.
      </p>
      {msgFoto && <p style={{ fontSize:11, color:msgFoto.includes('✅') ? C.emerald : C.mustard, marginBottom:10 }}>{msgFoto}</p>}
      <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap' }}>
        {isAdmin && url && (
          <button onClick={buscarFotos} disabled={buscando} style={{
            padding:'8px 16px', borderRadius:8, background:C.navy, color:'#fff',
            fontSize:12, fontWeight:600, border:'none', cursor:'pointer', opacity:buscando?0.6:1
          }}>
            {buscando ? (msgFoto || 'Buscando...') : '🔍 Buscar fotos automaticamente'}
          </button>
        )}
        {url && <a href={url} target="_blank" rel="noopener noreferrer" style={{
          display:'inline-flex', alignItems:'center', padding:'8px 16px',
          borderRadius:8, background:C.surface, border:`1px solid ${C.borderW}`,
          color:C.navy, fontSize:12, fontWeight:600, textDecoration:'none'
        }}>Ver anúncio original →</a>}
      </div>
    </div>
  )
  return (
    <div style={{ marginBottom: 20 }}>
      {msgFoto && <p style={{ fontSize:11, color:msgFoto.includes('✅') ? C.emerald : C.mustard, marginBottom:8, textAlign:'center' }}>{msgFoto}</p>}
      {fotoAtiva && (
        <div style={{
          width: '100%',
          borderRadius: 12, overflow: 'hidden',
          marginBottom: 8, background: '#1A1A2E',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: 200, maxHeight: 420,
          position: 'relative',
        }}>
          <img
            src={fotoAtiva}
            alt="Foto principal"
            style={{
              maxWidth: '100%',
              maxHeight: 420,
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
              display: 'block',
            }}
            onError={e => { e.target.style.display = 'none' }}
          />
        </div>
      )}
      {todasFotosExib.length > 1 && (
        <div style={{
          display: 'flex', gap: 6,
          overflowX: 'auto', paddingBottom: 4,
        }}>
          {todasFotosExib.map((foto, i) => (
            <img
              key={i}
              src={foto}
              alt={`Foto ${i + 1}`}
              onClick={() => setFotoAtiva(foto)}
              style={{
                width: 80, height: 58, flexShrink: 0,
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
      {isAdmin && url && (
        <div style={{ marginTop:10, textAlign:'center' }}>
          <button onClick={buscarFotos} disabled={buscando} style={{
            padding:'5px 12px', borderRadius:6, background:C.surface,
            border:`1px solid ${C.borderW}`, color:C.muted, fontSize:11,
            cursor:'pointer', opacity:buscando?0.6:1
          }}>
            {buscando ? (msgFoto || 'Buscando...') : '🔄 Buscar mais fotos'}
          </button>
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
        {c.link
          ? <a href={c.link} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}
              style={{fontSize:12.5,fontWeight:600,color:K.wh,textDecoration:'none',display:'flex',alignItems:'center',gap:4}}>
              <span style={{whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{c.descricao||'Comparável'}</span>
              <span style={{fontSize:9,color:K.teal,flexShrink:0}}>↗</span>
            </a>
          : <div style={{fontSize:12.5,fontWeight:600,color:K.wh,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{c.descricao||'Comparável'}</div>
        }
        <div style={{fontSize:11,color:K.t3,marginTop:1}}>
          {c.preco_m2?`R$ ${Number(c.preco_m2).toLocaleString('pt-BR')}/m²`:''}
          {c.similaridade?` · ${Number(c.similaridade).toFixed(1)} compatib.`:''}
          {c.fonte?` · ${c.fonte}`:''}
        </div>
        <div style={{fontSize:10,color:K.t3,marginTop:1,display:'flex',gap:6,flexWrap:'wrap'}}>
          {c.quartos>0&&<span>🛏 {c.quartos}q</span>}
          {c.vagas>0&&<span>🚗 {c.vagas}v</span>}
          {c.area_m2>0&&<span>📐 {c.area_m2}m²</span>}
          {c.condominio_mes>0&&<span>🏢 cond. R${Number(c.condominio_mes).toLocaleString('pt-BR')}/mês</span>}
        </div>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0,marginLeft:8}}>
        <div style={{textAlign:'right'}}>
          <div style={{fontWeight:700,fontSize:13,color:K.teal}}>{c.valor?`${(c.valor/1000).toFixed(0)}K`:''}</div>
          {c.area_m2>0&&c.valor>0&&<div style={{fontSize:9,color:K.t3}}>R${Math.round(c.valor/c.area_m2).toLocaleString('pt-BR')}/m²</div>}
        </div>
        <span style={{fontSize:14,color:K.t3}}>{aberto?'▲':'▼'}</span>
      </div>
    </div>
    {aberto&&<div style={{padding:"10px 12px",background:K.bg,borderTop:`1px solid ${K.bd}`,display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
      {[['Área',c.area_m2?`${c.area_m2}m²`:'—'],['Quartos',c.quartos??'—'],['Vagas',c.vagas??'—'],
        ['Tipo',c.tipo??'—'],['Andar',c.andar??'—'],['Cond./mês',c.condominio_mes?fmtV(c.condominio_mes):'—']
      ].map(([label,val],i)=><div key={i}><div style={{fontSize:10,color:K.t3,textTransform:"uppercase",letterSpacing:.5}}>{label}</div><div style={{fontSize:12.5,fontWeight:600,color:K.wh}}>{val}</div></div>)}
      {c.link
        ? <a href={c.link} target="_blank" rel="noreferrer" style={{gridColumn:"1/-1",fontSize:11,color:K.teal,textDecoration:"none"}}>🔗 Ver anúncio →</a>
        : (() => {
            const bairro = c.descricao?.match(/\w+$/)?.[0] || ''
            const area = c.area_m2 || ''
            const q = c.quartos || ''
            const cidSlug = (c.cidade||'belo-horizonte').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'-')
            const aMin = area>0?`&areaMin=${Math.round(area*0.85)}&areaMax=${Math.round(area*1.15)}`:''
            const zapUrl = `https://www.zapimoveis.com.br/venda/apartamentos/mg+${cidSlug}/?quartos=${q}${aMin}`
            const vivaUrl = `https://www.vivareal.com.br/venda/minas-gerais/${cidSlug}/apartamento_residencial/?quartos=${q}${aMin}`
            const olxUrl = `https://mg.olx.com.br/belo-horizonte-e-regiao/imoveis?q=apartamento+${q}+quartos`
            return <div style={{gridColumn:'1/-1',display:'flex',gap:6,flexWrap:'wrap',marginTop:4}}>
              <a href={zapUrl} target="_blank" rel="noreferrer" style={{fontSize:10,color:'#F97316',textDecoration:'none',padding:'3px 8px',background:'#FFF7ED',borderRadius:4,border:'1px solid #FED7AA'}}>🔍 ZAP</a>
              <a href={vivaUrl} target="_blank" rel="noreferrer" style={{fontSize:10,color:'#7C3AED',textDecoration:'none',padding:'3px 8px',background:'#F5F3FF',borderRadius:4,border:'1px solid #DDD6FE'}}>🔍 Viva Real</a>
              <a href={olxUrl} target="_blank" rel="noreferrer" style={{fontSize:10,color:'#059669',textDecoration:'none',padding:'3px 8px',background:'#ECFDF5',borderRadius:4,border:'1px solid #A7F3D0'}}>🔍 OLX</a>
            </div>
          })()
      }
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
          {s.score_total?.toFixed(2) || '—'}
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

function AbaArremates({ imovel }) {
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  const buscar = async () => {
    const openaiKey = localStorage.getItem('axis-openai-key') || ''
    const geminiKey = localStorage.getItem('axis-gemini-key') || ''
    if (!openaiKey && !geminiKey) { setMsg('Configure OpenAI ou Gemini em Admin → API Keys'); return }
    setLoading(true); setMsg('Pesquisando arremates similares...')
    try {
      const res = await buscarArrematesSimilares(imovel, openaiKey, geminiKey)
      if (res) { setDados(res); setMsg(`✅ ${res.n_amostras || res.arremates?.length || 0} arremates encontrados via ${res._modelo}`) }
      else setMsg('Nenhum arrematado similar encontrado.')
    } catch(e) { setMsg('Erro: ' + e.message) }
    setLoading(false)
  }

  const fmt = v => v ? `R$ ${Math.round(v).toLocaleString('pt-BR')}` : '—'

  return (
    <div style={{padding:'12px 0'}}>
      <div style={{...card(), padding:14, marginBottom:12}}>
        <div style={{fontSize:13, fontWeight:600, color:C.navy, marginBottom:6}}>Arremates Similares</div>
        <div style={{fontSize:11, color:C.muted, marginBottom:10}}>
          Pesquisa histórico de arremates de imóveis similares para calibrar o lance.
        </div>
        <button onClick={buscar} disabled={loading} style={{
          ...btn('s'), background:C.navy, color:'#fff', border:'none', opacity:loading?0.6:1
        }}>
          {loading ? '🔍 Pesquisando...' : '🔨 Buscar arremates similares'}
        </button>
        {msg && <div style={{fontSize:11, marginTop:8, color: msg.includes('✅') ? C.emerald : C.muted}}>{msg}</div>}
      </div>

      {dados && (
        <>
          <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:12}}>
            {[
              ['Média', `${dados.media_pct_avaliacao?.toFixed(1)}% da avaliação`],
              ['Faixa', dados.faixa_pct || '—'],
              ['Amostras', dados.n_amostras || dados.arremates?.length || 0],
            ].map(([l,v]) => (
              <div key={l} style={{...card(), padding:'10px 12px', textAlign:'center'}}>
                <div style={{fontSize:10, color:C.hint}}>{l}</div>
                <div style={{fontSize:13, fontWeight:700, color:C.navy}}>{v}</div>
              </div>
            ))}
          </div>

          {dados.mao_sugerido > 0 && (
            <div style={{...card(), padding:12, marginBottom:12, background:`${C.emerald}08`, border:`1px solid ${C.emerald}20`}}>
              <div style={{fontSize:11, fontWeight:600, color:C.emerald}}>MAO sugerido baseado em arremates reais</div>
              <div style={{fontSize:18, fontWeight:800, color:C.emerald}}>{fmt(dados.mao_sugerido)}</div>
              <div style={{fontSize:10, color:C.muted}}>{dados.mao_base}</div>
            </div>
          )}

          {dados.arremates?.map((a, i) => (
            <div key={i} style={{...card(), padding:12, marginBottom:8}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:4}}>
                <div style={{flex:1, minWidth:0}}>
                  {a.url ? (
                    <a href={a.url} target="_blank" rel="noreferrer"
                      style={{fontSize:12, fontWeight:600, color:C.navy, textDecoration:'none', display:'flex', alignItems:'center', gap:4}}>
                      <span style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{a.descricao}</span>
                      <span style={{fontSize:9, color:C.teal, flexShrink:0}}>↗</span>
                    </a>
                  ) : (
                    <span style={{fontSize:12, fontWeight:600, color:C.navy}}>{a.descricao}</span>
                  )}
                </div>
                <span style={{fontSize:11, fontWeight:700, color:C.emerald, flexShrink:0, marginLeft:8}}>{fmt(a.valor_arrematado)}</span>
              </div>
              <div style={{fontSize:10, color:C.muted}}>
                {a.pct_avaliacao?.toFixed(1)}% da avaliação ({fmt(a.valor_avaliacao)}) · {a.data} · {a.fonte}
              </div>
            </div>
          ))}

          {dados.observacoes && (
            <div style={{...card(), padding:12, fontSize:11, color:C.muted}}>{dados.observacoes}</div>
          )}
        </>
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
  const [obs, setObs] = useState([])
  const [novaObs, setNovaObs] = useState('')
  const [salvandoObs, setSalvandoObs] = useState(false)
  const [avaliacoes, setAvaliacoes] = useState([])
  const [minhaAvaliacao, setMinhaAvaliacao] = useState(null)

  useEffect(() => {
    if (!p?.id) return
    import('../lib/supabase.js').then(({ getObservacoes, getAvaliacoes }) => {
      getObservacoes(p.id).then(setObs).catch(() => {})
      getAvaliacoes(p.id).then(setAvaliacoes).catch(() => {})
    })
  }, [p?.id])

  // Enriquecer aba Mercado com dados reais do banco quando disponível
  useEffect(() => {
    if (!p?.bairro && !p?.cidade) return
    import('../lib/supabase.js').then(({ supabase: sb }) => {
      sb.from('metricas_bairros')
        .select('preco_anuncio_m2, preco_contrato_m2, yield_bruto, tendencia_12m, classe_ipead')
        .ilike('bairro', `%${(p.bairro||'').trim()}%`)
        .single()
        .then(({ data }) => {
          if (data && onUpdateProp) {
            const enriched = {
              ...p,
              preco_m2_mercado: p.preco_m2_mercado || data.preco_anuncio_m2 || data.preco_contrato_m2,
              yield_bruto_pct: p.yield_bruto_pct || data.yield_bruto,
            }
            if (enriched.preco_m2_mercado !== p.preco_m2_mercado) {
              // só atualiza UI, não persiste
            }
          }
        }).catch(() => {})
    })
  }, [p?.bairro])

  // Auto-buscar fotos — roda só 1x por imóvel (ref previne loop quando onUpdateProp re-renderiza)
  const autoFotosBuscado = useRef(new Set())
  useEffect(() => {
    if (!p?.fonte_url || (p?.fotos?.length > 0)) return
    if (autoFotosBuscado.current.has(p.id)) return
    autoFotosBuscado.current.add(p.id)
    const timer = setTimeout(async () => {
      try {
        const { buscarFotosImovel } = await import('../lib/buscadorFotos.js')
        const geminiKey = localStorage.getItem('axis-gemini-key') || ''
        const resultado = await buscarFotosImovel({ fonte_url: p.fonte_url, id: p.id }, geminiKey)
        if (resultado.fotos?.length > 0 || resultado.foto_principal) {
          if (onUpdateProp) onUpdateProp(p.id, { ...p, fotos: resultado.fotos, foto_principal: resultado.foto_principal })
          const { saveImovelCompleto } = await import('../lib/supabase.js')
          const { data: { session } } = await supabase.auth.getSession()
          saveImovelCompleto({ ...p, fotos: resultado.fotos, foto_principal: resultado.foto_principal }, session?.user?.id).catch(() => {})
        }
      } catch(e) { /* silencioso */ }
    }, 2000)
    return () => clearTimeout(timer)
  }, [p?.id])

  const salvarObs = async () => {
    if (!novaObs.trim()) return
    setSalvandoObs(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { saveObservacao } = await import('../lib/supabase.js')
      const nova = await saveObservacao({ imovel_id: p.id, texto: novaObs.trim(), user_id: user?.id })
      setObs(prev => [nova, ...prev])
      setNovaObs('')
    } catch(e) { console.error('[AXIS obs]', e.message) }
    setSalvandoObs(false)
  }

  const handleReanalyze=async()=>{
    if(!p?.fonte_url){setMsg("⚠️ Imóvel sem URL de origem para reanalisar");return}
    // Buscar chaves — localStorage primeiro, banco como fallback
    let geminiKey = localStorage.getItem("axis-gemini-key") || ""
    let claudeKey = localStorage.getItem("axis-api-key") || ""
    // Sempre sincronizar chaves do banco — garante funcionamento em qualquer dispositivo
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { loadApiKeys } = await import('../lib/supabase.js')
        const keys = await loadApiKeys(user.id)
        // Sobrescrever localStorage com banco (banco é fonte da verdade)
        if (keys.geminiKey) { geminiKey = keys.geminiKey; localStorage.setItem('axis-gemini-key', geminiKey) }
        if (keys.claudeKey) { claudeKey = keys.claudeKey; localStorage.setItem('axis-api-key', claudeKey) }
        if (keys.openaiKey) localStorage.setItem('axis-openai-key', keys.openaiKey)
        if (keys.deepseekKey) localStorage.setItem('axis-deepseek-key', keys.deepseekKey)
      }
    } catch(e) { console.warn('[AXIS] Sync chaves do banco:', e.message) }
    if(!geminiKey && !claudeKey){setMsg("⚠️ Configure ao menos a Gemini API Key em Admin → API Keys");return}
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
      let novaAnalise
      // Cascata: Gemini (~$0.002) → Claude Sonnet (fallback)
      if (geminiKey) {
        try {
          setReStep("Reanalisando com Gemini Flash-Lite (custo ~R$ 0,01)...")
          const { reAnalisarComGemini } = await import("../lib/agenteReanalise.js")
          novaAnalise = await reAnalisarComGemini(p, geminiKey, [], setReStep)
          setReStep("✅ Reanálise Gemini concluída")
        } catch(geminiErr) {
          console.warn("[AXIS] Gemini reanálise falhou, usando Claude:", geminiErr.message)
          setReStep("Gemini falhou, usando Claude Sonnet...")
          if (!claudeKey) throw new Error("Gemini e Claude indisponíveis. Configure as chaves em API Keys.")
          novaAnalise = await analisarImovelCompleto(p.fonte_url, claudeKey, openaiKey, [], [], setReStep, [], p.id, p.titulo)
        }
      } else {
        // Sem Gemini — usar Claude
        novaAnalise = await analisarImovelCompleto(p.fonte_url, claudeKey, openaiKey, [], [], setReStep, [], p.id, p.titulo)
      }
      // Proteger campos críticos: nunca sobrescrever com null/0 se já tinhamos valor
      const protegerCampos = (original, novo) => {
        const camposCriticos = ['valor_minimo','valor_avaliacao','titulo','fotos','comparaveis',
          'score_total','score_localizacao','score_desconto','score_juridico','score_ocupacao',
          'score_liquidez','score_mercado','recomendacao','codigo_axis','endereco','bairro']
        // Campos que nunca devem ser sobrescritos com zero (zero = dado inválido)
        const camposNuncaZero = ['valor_minimo','valor_avaliacao','desconto_percentual',
          'preco_m2_mercado','preco_m2_imovel','aluguel_mensal_estimado',
          'valor_mercado_estimado','num_leilao']
        const merged = {...original, ...novo}
        for (const campo of camposCriticos) {
          if ((novo[campo] === null || novo[campo] === undefined || novo[campo] === 0 || novo[campo] === '') && original[campo]) {
            merged[campo] = original[campo]
          }
        }
        for (const campo of camposNuncaZero) {
          if ((novo[campo] === 0 || novo[campo] === null || novo[campo] === undefined || novo[campo] === '') && original[campo] && original[campo] !== 0) {
            merged[campo] = original[campo]
          }
        }
        // Fotos e comparáveis: só sobrescrever se o novo tiver mais dados
        if ((!novo.fotos || novo.fotos.length === 0) && original.fotos?.length > 0) merged.fotos = original.fotos
        // Manter comparáveis existentes se novo tem menos ou tipo errado (terreno em vez de apt)
if (original.comparaveis?.length > 2) {
  const novosOk = (novo.comparaveis || []).filter(c => c.link && c.tipo !== 'terreno' && c.tipo !== 'lote')
  const atuaisOk = original.comparaveis.filter(c => c.link)
  if (!novo.comparaveis?.length || novosOk.length < atuaisOk.length) {
    merged.comparaveis = original.comparaveis
  }
}
        return merged
      }
      // NUNCA salvar dados de modo_teste no banco
      if (novaAnalise.modo_teste === true) {
        setReanalyzing(false)
        setMsg('⚠️ Modo Teste ativo — desative em Admin → Config antes de reanalisar.')
        return
      }
      // Verificar qualidade da análise retornada
      const modeloUsado = novaAnalise._modelo_usado || ''
      if (modeloUsado === 'regex_fallback') {
        // Na reanálise, regex_fallback significa que Gemini falhou mas preservou dados do banco
        // Ainda assim avisar o usuário mas NÃO bloquear (dados preservados são válidos)
        setMsg('⚠️ Gemini não respondeu — dados anteriores preservados. Configure a chave Gemini para reanálise completa.')
        // Continuar salvamento com dados preservados (não bloqueio total)
      }
      const merged={...protegerCampos(p, novaAnalise),id:p.id,createdAt:p.createdAt,criado_por:p.criado_por}
      if(onUpdateProp) onUpdateProp(p.id,merged)
      // Salvar no Supabase — buscar session corretamente
      try {
        const { data:{ session:sess } } = await supabase.auth.getSession()
        const { saveImovelCompleto } = await import('../lib/supabase.js')
        await saveImovelCompleto(merged, sess?.user?.id)
        const modeloUsado = novaAnalise._modelo_usado || 'desconhecido'
        const avisoModelo = modeloUsado.includes('fallback') ? ' (análise parcial — Gemini indisponível, configure a chave)' : ''
        setMsg(`✅ Imóvel reanalisado e salvo!${avisoModelo}`)
        // Após reanálise, ir para a aba jurídico para facilitar busca de documentos
        if (!merged.num_documentos || merged.num_documentos === 0) {
          setTimeout(() => setMsg('💡 Vá em Jurídico → Documentos para baixar e analisar o edital e matrícula.'), 2500)
        }
        try {
          const { logAtividade } = await import('../lib/supabase.js')
          const { data:{ session: sess2 } } = await supabase.auth.getSession()
          if (sess2?.user?.id) logAtividade(sess2.user.id, 'reanalise', 'imovel', p.id, { titulo: p.titulo })
        } catch(e) {}
      } catch(saveErr) {
        console.warn('[AXIS] Salvar reanálise:', saveErr.message)
        setMsg("✅ Reanalisado! (sync nuvem falhou — tente novamente)")
      }
    } catch(e) {
      const msg = e.message || ''
      if (msg.includes('Créditos esgotados') || msg.includes('402')) {
        setMsg('⚠️ Créditos Claude esgotados — recarregue em console.anthropic.com')
      } else if (msg.includes('Chave inválida') || msg.includes('401')) {
        setMsg('⚠️ Créditos Claude esgotados. Clique em "Reanalisar (Gemini)" para usar Gemini grátis.')
      } else if (msg.includes('Timeout') || msg.includes('AbortError')) {
        setMsg('⚠️ Timeout — o imóvel pode ser complexo. Tente novamente.')
      } else if (msg.includes('URL') || msg.includes('fetch')) {
        setMsg('⚠️ URL inacessível — o site do edital pode estar fora do ar')
      } else {
        setMsg(`⚠️ Erro: ${msg}`)
      }
    }
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
    <Hdr title={<>{p.titulo||"Imóvel"}{p.codigo_axis&&<span style={{fontSize:"10.5px",fontWeight:700,padding:"2px 8px",borderRadius:4,background:"#002B8010",color:"#002B80",border:"1px solid #002B8020",fontFamily:"monospace",letterSpacing:"0.5px",marginLeft:10,verticalAlign:"middle"}}>{p.codigo_axis}</span>}{p.num_leilao&&<span style={{display:"inline-block",background:p.num_leilao>=2?"#FEF3C7":"#ECFDF5",color:p.num_leilao>=2?"#D97706":"#065F46",fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:4,marginLeft:6,verticalAlign:"middle"}}>{p.num_leilao}º LEILÃO{p.valor_minimo&&p.valor_avaliacao?` · mín. ${Math.round(p.valor_minimo/p.valor_avaliacao*100)}%`:p.num_leilao>=2?" · mín. 35%":""}</span>}{p.trello_card_url&&<a href={p.trello_card_url} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#0052CC",marginLeft:8,verticalAlign:"middle",textDecoration:"none"}}>Trello</a>}</>} sub={`${p.cidade}/${p.estado} · ${fmtD(p.createdAt)}`}
      actions={<>
        {p.fonte_url&&<a href={p.fonte_url} target="_blank" rel="noopener noreferrer" title="Abrir edital original no portal do leiloeiro" style={{...btn("s"),textDecoration:"none",display:"inline-block",background:`${C.blue}08`,color:C.blue,border:`1px solid ${C.blue}30`}}>🔗 Edital</a>}
        {isAdmin&&<>
              <button style={{...btn("s"),background:`${K.amb}15`,color:K.amb,border:`1px solid ${K.amb}30`}} onClick={handleReanalyze} disabled={reanalyzing}>
                {reanalyzing?`⏳ ${reStep||'Reanalisando...'}`:
                  localStorage.getItem("axis-gemini-key")?"🤖 Reanalisar (Gemini)":
                  localStorage.getItem("axis-api-key")?"🔄 Reanalisar (Claude)":"🔄 Reanalisar"}
              </button>
            </>}
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
        <button onClick={() => { import('../lib/supabase.js').then(({ exportarRelatorioHTML }) => { exportarRelatorioHTML(p) }) }}
          title="Baixar relatório HTML"
          style={{ padding:'6px 12px', borderRadius:7, border:`1px solid ${K.bd}`, background:K.s2, color:K.t2, fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}>
          ↓ HTML
        </button>
        <button onClick={() => { import('../lib/supabase.js').then(({ exportarAnaliseJSON }) => { exportarAnaliseJSON(p) }) }}
          title="Baixar dados JSON completos"
          style={{ padding:'6px 12px', borderRadius:7, border:`1px solid ${K.bd}`, background:K.s2, color:K.t2, fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}>
          ↓ JSON
        </button>
        {isAdmin&&onArchive&&<button style={{...btn("s"),background:`${C.mustardL}`,color:C.mustard,border:`1px solid ${C.mustard}40`}} onClick={()=>onArchive(p.id)}>📦 Arquivar</button>}
        {isAdmin&&<button style={{...btn("d"),padding:"5px 12px",fontSize:"12px"}} onClick={()=>{if(confirm("Excluir?"))onDelete(p.id)}}>🗑</button>}
      </>}/>
    {/* Tabs */}
    <div style={{display:"flex",gap:isPhone?4:0,borderBottom:`1px solid ${K.bd}`,padding:isPhone?"0 16px":"0 28px",background:K.s1,overflowX:isPhone?'auto':'visible',scrollbarWidth:'none',WebkitOverflowScrolling:'touch',msOverflowStyle:'none'}}>
      {[{id:'resumo',label:'📊 Resumo',labelMobile:'📊'},{id:'juridico',label:'⚖️ Jurídico',labelMobile:'⚖️'},{id:'fotos',label:'📸 Fotos',labelMobile:'📸'},{id:'mercado',label:'🏙️ Mercado',labelMobile:'🏙️'},...(isAdmin?[{id:'arremates',label:'🔨 Arremates',labelMobile:'🔨 Arr.'}]:[])].map(tab=>(
        <button key={tab.id} onClick={()=>setAbaDetalhe(tab.id)} style={{
          background:"none",border:"none",padding:isPhone?"10px 12px":"10px 18px",fontSize:"12.5px",fontWeight:abaDetalhe===tab.id?700:500,whiteSpace:'nowrap',flexShrink:0,
          color:abaDetalhe===tab.id?K.teal:K.t3,cursor:"pointer",
          borderBottom:abaDetalhe===tab.id?`2px solid ${K.teal}`:"2px solid transparent",
          transition:"all 0.15s",
        }}>{isPhone&&tab.labelMobile?tab.labelMobile:tab.label}</button>
      ))}
    </div>
    <div style={{padding:isPhone?"16px":"20px 28px"}}>
      {msg&&<div style={{background:`${K.teal}10`,border:`1px solid ${K.teal}30`,borderRadius:"6px",padding:"10px",marginBottom:"14px",fontSize:"12px",color:K.teal}}>{msg}</div>}
      {reanalyzing&&reStep&&<div style={{background:`${K.amb}10`,border:`1px solid ${K.amb}30`,borderRadius:"7px",padding:"12px 16px",marginBottom:"14px",display:"flex",alignItems:"center",gap:"10px"}}>
        <div style={{width:8,height:8,borderRadius:"50%",background:K.amb,animation:"pulse 1s infinite",flexShrink:0}}/>
        <span style={{fontSize:"13px",color:K.amb,fontWeight:600}}>{reStep}</span>
      </div>}

      {abaDetalhe==='juridico'&&<AbaJuridicaAgente imovel={p} isAdmin={isAdmin} onReclassificado={(novaAnalise)=>{
          if(onUpdateProp) onUpdateProp(p.id, novaAnalise)
        }}/>}

      {abaDetalhe==='fotos'&&<GaleriaFotos 
          fotos={p.fotos||[]} 
          foto_principal={p.foto_principal} 
          url={p.fonte_url||p.url} 
          imovelId={p.id}
          isAdmin={isAdmin}
          onFotosAtualizadas={async (fotos, foto_principal) => {
            // Salvar fotos no banco
            try {
              const { saveImovelCompleto } = await import('../lib/supabase.js')
              const { data:{ session } } = await supabase.auth.getSession()
              await saveImovelCompleto({ ...p, fotos, foto_principal }, session?.user?.id)
              if (onUpdateProp) onUpdateProp(p.id, { ...p, fotos, foto_principal })
              setMsg('✅ Fotos salvas!')
            } catch(e) { console.warn('[AXIS] Salvar fotos:', e.message) }
          }}
        />}

      {abaDetalhe==='arremates'&&isAdmin&&<AbaArremates imovel={p}/>}
      {abaDetalhe==='mercado'&&<div>
        <div style={card()}>
          <div style={{fontWeight:"600",color:K.wh,marginBottom:"12px",fontSize:"13px"}}>🏙️ Mercado Regional</div>
          {[["Tendência",mapDisplay(p.mercado_tendencia),p.mercado_tendencia==="alta"||p.mercado_tendencia==="Alta"||p.mercado_tendencia==="crescimento"?K.grn:p.mercado_tendencia==="queda"||p.mercado_tendencia==="Queda"?"#E5484D":K.t2],["Demanda",mapDisplay(p.mercado_demanda),p.mercado_demanda==="alta"||p.mercado_demanda==="Alta"?K.grn:p.mercado_demanda==="baixa"||p.mercado_demanda==="Baixa"?"#E5484D":K.t2],["Tempo médio venda",p.mercado_tempo_venda_meses?`${p.mercado_tempo_venda_meses} meses`:"—",K.t2],["Preço/m² mercado",p.preco_m2_mercado?`R$ ${p.preco_m2_mercado}/m²`:"—",K.teal],["Aluguel estimado",fmtC(p.aluguel_mensal_estimado)+"/mês",K.pur],["Obs. mercado",p.mercado_obs||"—",K.t2]].map(([l,v,c])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${K.bd}`}}>
              <span style={{fontSize:"12px",color:K.t3}}>{l}</span><span style={{fontSize:"12.5px",fontWeight:"600",color:c}}>{v}</span>
            </div>
          ))}
        </div>
      </div>}

      {abaDetalhe==='resumo'&&<>
      {p.foto_principal&&(
        <div style={{width:'100%',height:220,borderRadius:12,overflow:'hidden',marginBottom:16,background:'#f0f0f0'}}>
          <img src={p.foto_principal} alt={p.titulo||'Foto'} 
            style={{width:'100%',height:'100%',objectFit:'cover'}}
            onError={e=>{e.target.parentElement.style.display='none'}}/>
        </div>
      )}
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
      {/* Análise de Leilão */}
      <PainelLeilao imovel={p} isAdmin={isAdmin} />
        <PainelLancamento imovel={p}/>
      {/* Cenários de Reforma */}
      <CenariosReforma imovel={p} isAdmin={isAdmin} />
      {/* Calculadora ROI */}
      <div style={{...card(),marginBottom:"14px"}}>
        <CalculadoraROI imovel={p} />
      </div>
      {/* Plano de Reforma — SINAPI Real */}
      {(() => {
        const area = p.area_m2 || p.area_privativa || 60
        const preco_m2 = p.preco_m2_mercado || (p.valor_mercado && area ? p.valor_mercado / area : 0)
        const classe = detectarClasseMercado(p.regiao_mercado, preco_m2)
        const escopos = ['refresh_giro','leve_funcional','leve_reforcada_1_molhado']
        return (
          <div style={{...card(),marginBottom:"14px"}}>
            <div style={{fontWeight:"600",color:K.wh,marginBottom:"12px",fontSize:"13px"}}>🏗️ Plano de Reforma — Custos SINAPI</div>
            <div style={{fontSize:11,color:K.t2,marginBottom:10}}>Classe: <strong style={{color:K.tx}}>{classe.label}</strong> · Área: {area} m²</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              {escopos.map(esc => {
                const r = calcularCustoReforma({area_m2:area, escopo:esc, regiao_mercado:p.regiao_mercado, preco_m2_atual:preco_m2})
                if(!r) return null
                const isRefresh = esc === 'refresh_giro'
                return (
                  <div key={esc} style={{background:isRefresh?K.s2:C.white,borderRadius:10,padding:12,border:`1px solid ${isRefresh?K.teal+'30':C.borderW}`}}>
                    <div style={{fontSize:11,fontWeight:600,color:isRefresh?K.teal:K.tx,marginBottom:6}}>{r.classe_label?.split(' — ')[1] || esc.replace(/_/g,' ')}</div>
                    <div style={{fontSize:10,color:K.t2,marginBottom:4}}>R$ {r.custo_m2_min}–{r.custo_m2_max}/m²</div>
                    <div style={{fontSize:16,fontWeight:700,color:K.tx}}>{fmtC(r.custo_total_final)}</div>
                    <div style={{fontSize:9,color:K.t3,marginTop:4}}>+contingência 12% · +logística 15%</div>
                    <div style={{fontSize:9,color:K.teal,marginTop:2}}>Valorização: +{((r.fator_valorizacao-1)*100).toFixed(0)}%</div>
                  </div>
                )
              })}
            </div>
            {classe.observacao && <div style={{fontSize:10,color:K.t3,marginTop:8,fontStyle:"italic"}}>💡 {classe.observacao}</div>}
            <div style={{fontSize:9,color:K.t3,marginTop:6,borderTop:`1px solid ${C.borderW}`,paddingTop:6}}>Fonte: SINAPI MG jun/2025 · Lar Pontual SP 2026 ajustado MG · Preço da Obra</div>
          </div>
        )
      })()}
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
          {p.num_documentos>0&&(
            <div style={{marginTop:10,padding:'10px 12px',borderRadius:8,background:'#F5F3FF',border:'1px solid #DDD6FE'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                <span style={{fontSize:11,fontWeight:700,color:'#7C3AED'}}>📄 {p.num_documentos} documento(s) analisado(s)</span>
                {p.score_viabilidade_docs!=null&&<span style={{fontSize:12,fontWeight:800,color:p.score_viabilidade_docs>=7?C.emerald:p.score_viabilidade_docs>=5?C.mustard:'#E5484D'}}>{Number(p.score_viabilidade_docs).toFixed(1)}/10 viabilidade</span>}
              </div>
              {p.recomendacao_juridica_docs&&<div style={{fontSize:10,padding:'3px 8px',borderRadius:5,display:'inline-block',marginBottom:6,background:p.recomendacao_juridica_docs==='favoravel'?C.emeraldL:p.recomendacao_juridica_docs==='desfavoravel'?'#FCEBEB':'#FFF8E1',color:p.recomendacao_juridica_docs==='favoravel'?C.emerald:p.recomendacao_juridica_docs==='desfavoravel'?'#E5484D':'#D4A017',fontWeight:700}}>{p.recomendacao_juridica_docs==='favoravel'?'✅ Juridicamente Favorável':p.recomendacao_juridica_docs==='desfavoravel'?'❌ Riscos Identificados':'⚠️ Due Diligence Necessária'}</div>}
              <button onClick={()=>setAbaDetalhe('documentos')} style={{display:'block',width:'100%',padding:'4px',borderRadius:5,border:'1px solid #DDD6FE',background:'#fff',color:'#7C3AED',fontSize:11,cursor:'pointer',fontWeight:600}}>Ver análise completa dos documentos →</button>
            </div>
          )}
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

      {/* Avaliação do grupo */}
      <div style={{...card(),marginBottom:'14px'}}>
        <div style={{fontWeight:600,color:K.wh,marginBottom:10,fontSize:13}}>Avaliação do grupo</div>
        <div style={{display:'flex',gap:6,marginBottom:10}}>
          {['COMPRAR','AGUARDAR','EVITAR'].map(op => (
            <button key={op} onClick={async () => {
              const { data:{ user } } = await supabase.auth.getUser()
              const { saveAvaliacao, getAvaliacoes } = await import('../lib/supabase.js')
              await saveAvaliacao({ imovel_id: p.id, user_id: user?.id, nota: op === 'COMPRAR' ? 5 : op === 'AGUARDAR' ? 3 : 1, comentario: op })
              getAvaliacoes(p.id).then(setAvaliacoes).catch(()=>{})
              setMinhaAvaliacao(op)
            }} style={{
              ...btn('s'),
              background: minhaAvaliacao === op ? (op==='COMPRAR'?C.emerald:op==='AGUARDAR'?C.mustard:'#E5484D') : K.s2,
              color: minhaAvaliacao === op ? '#fff' : K.tx,
              border: 'none'
            }}>{op}</button>
          ))}
        </div>
        {avaliacoes.length > 0 && (
          <div style={{fontSize:11,color:K.t3}}>
            {avaliacoes.length} avaliação(ões) · maioria: {
              (() => {
                const counts = avaliacoes.reduce((a,v) => {
                  const op = v.comentario || (v.nota >= 4 ? 'COMPRAR' : v.nota >= 3 ? 'AGUARDAR' : 'EVITAR')
                  a[op] = (a[op]||0)+1; return a
                }, {})
                return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0]
              })()
            }
          </div>
        )}
      </div>

      {/* Observações do grupo */}
      <div style={{...card(),marginBottom:'14px'}}>
        <div style={{fontWeight:600,color:K.wh,marginBottom:10,fontSize:13}}>Observações do grupo</div>
        <div style={{display:'flex',gap:8,marginBottom:10}}>
          <input
            value={novaObs}
            onChange={e => setNovaObs(e.target.value)}
            placeholder="Adicionar observação..."
            style={{...inp(),flex:1,fontSize:12}}
            onKeyDown={e => e.key === 'Enter' && salvarObs()}
          />
          <button onClick={salvarObs} disabled={salvandoObs} style={{...btn('s'),background:C.emerald,color:'#fff',border:'none'}}>
            {salvandoObs ? '...' : 'Salvar'}
          </button>
        </div>
        {obs.map(o => (
          <div key={o.id} style={{padding:'6px 0',borderBottom:`1px solid ${K.bd}`,fontSize:12}}>
            <span style={{color:K.t3,fontSize:10}}>{o.autor?.nome || 'Membro'} · {new Date(o.criado_em).toLocaleDateString('pt-BR')}</span>
            <div style={{color:K.tx,marginTop:2}}>{o.texto}</div>
          </div>
        ))}
        {obs.length === 0 && <div style={{fontSize:11,color:K.t3}}>Nenhuma observação ainda</div>}
      </div>
      </>}
    </div>
    {modoAoVivo && <ModoAoVivo imovel={p} onClose={() => setModoAoVivo(false)} />}
  </div>
}
