/**
 * AXIS — Aba de Documentos Jurídicos
 * Download automático + Armazenamento + Quadro de análise estruturada
 */
import { useState, useEffect } from 'react'
import { C } from '../appConstants.js'

// ─── CORES ────────────────────────────────────────────────────────────────
const P = {
  navy:'#002B80', navyL:'#E8EEF8',
  emerald:'#05A86D', emeraldL:'#E6F7F0',
  red:'#E5484D', redL:'#FCEBEB',
  mustard:'#D4A017', mustardL:'#FFF8E1',
  blue:'#4A9EFF', blueL:'#EBF4FF',
  purple:'#7C3AED', purpleL:'#F0EBFF',
  gray:'#8E8EA0', border:'#E8E6DF',
  surface:'#F4F3EF', white:'#FFFFFF', text:'#1A1A2E',
}

// ─── HELPERS ─────────────────────────────────────────────────────────────
const fmtC = v => v ? `R$ ${Math.round(v).toLocaleString('pt-BR')}` : null
const Box = ({ children, style }) => (
  <div style={{ background:P.white, border:`1px solid ${P.border}`, borderRadius:10, padding:'12px 14px', ...style }}>
    {children}
  </div>
)
const Tag = ({ text, cor, bg }) => (
  <span style={{ fontSize:9.5, fontWeight:700, padding:'2px 8px', borderRadius:10,
    background: bg || `${cor}18`, color:cor, border:`1px solid ${cor}30`, whiteSpace:'nowrap' }}>
    {text}
  </span>
)

function ScoreBar({ label, value, max=10, cor }) {
  const pct = Math.min(100, (value / max) * 100)
  const c = value >= 7 ? P.emerald : value >= 5 ? P.mustard : P.red
  return (
    <div style={{ marginBottom:6 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
        <span style={{ fontSize:10.5, color:P.gray }}>{label}</span>
        <span style={{ fontSize:10.5, fontWeight:700, color: cor || c }}>{value?.toFixed(1) || '—'}/10</span>
      </div>
      <div style={{ height:5, background:P.surface, borderRadius:3, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${pct}%`, background: cor || c, borderRadius:3, transition:'width .4s' }}/>
      </div>
    </div>
  )
}

function BadgeRisco({ gravidade }) {
  const map = {
    critico: { cor:P.red, label:'CRÍTICO' },
    alto:    { cor:'#E06A00', label:'ALTO' },
    medio:   { cor:P.mustard, label:'MÉDIO' },
    baixo:   { cor:P.emerald, label:'BAIXO' },
  }
  const b = map[gravidade] || map.medio
  return <Tag text={b.label} cor={b.cor}/>
}

function BadgeRec({ rec }) {
  const map = {
    favoravel:    { cor:P.emerald, label:'✅ Favorável' },
    neutro:       { cor:P.mustard, label:'⚠️ Neutro' },
    desfavoravel: { cor:P.red,     label:'❌ Desfavorável' },
  }
  const b = map[rec]
  if (!b) return null
  return <Tag text={b.label} cor={b.cor}/>
}

// ─── CARD DE UM DOCUMENTO ────────────────────────────────────────────────
function CardDocumento({ doc, isMobile }) {
  const [expandido, setExpandido] = useState(false)
  const analise = doc.analise_estruturada || {}
  const metricas = analise.metricas_viabilidade || doc.metricas_viabilidade || {}
  const riscos = analise.riscos_identificados || doc.riscos_encontrados || []
  const positivos = analise.pontos_positivos || doc.pontos_positivos || []
  const alertas = analise.alertas_criticos || doc.alertas_criticos || []
  const infos = analise.informacoes_principais || {}
  const scoreGeral = metricas.score_geral || doc.score_viabilidade || doc.score_juridico_sugerido

  const tipoConfig = {
    edital:    { icon:'📋', cor:P.navy,    label:'Edital' },
    matricula: { icon:'📜', cor:P.purple,  label:'Matrícula' },
    processo:  { icon:'⚖️', cor:P.red,    label:'Processo' },
    certidao:  { icon:'🏛️', cor:P.blue,  label:'Certidão' },
    outro:     { icon:'📄', cor:P.gray,   label:'Documento' },
  }
  const tc = tipoConfig[doc.tipo] || tipoConfig.outro

  return (
    <Box style={{ marginBottom:12, overflow:'hidden', padding:0 }}>
      {/* Header do card */}
      <div
        onClick={() => setExpandido(!expandido)}
        style={{ padding:'12px 14px', cursor:'pointer', display:'flex', gap:10,
          alignItems:'flex-start', borderBottom: expandido ? `1px solid ${P.border}` : 'none',
          background: expandido ? P.surface : P.white, borderRadius: expandido ? '10px 10px 0 0' : 10 }}>
        <div style={{ fontSize:22, flexShrink:0, marginTop:2 }}>{tc.icon}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap', marginBottom:4 }}>
            <Tag text={tc.label} cor={tc.cor}/>
            {analise.recomendacao_juridica && <BadgeRec rec={analise.recomendacao_juridica}/>}
            {doc.url_storage && <Tag text="💾 Armazenado" cor={P.emerald}/>}
          </div>
          <div style={{ fontSize:12.5, fontWeight:600, color:P.navy, marginBottom:3 }}>
            {analise.titulo_documento || doc.nome || tc.label}
          </div>
          {(analise.resumo_executivo || doc.resumo_executivo) && (
            <div style={{ fontSize:11, color:P.gray, lineHeight:1.5,
              display:expandido ? 'block' : '-webkit-box',
              WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
              {analise.resumo_executivo || doc.resumo_executivo}
            </div>
          )}
        </div>
        <div style={{ flexShrink:0, textAlign:'center' }}>
          {scoreGeral != null && (
            <div>
              <div style={{ fontSize:18, fontWeight:800,
                color: scoreGeral >= 7 ? P.emerald : scoreGeral >= 5 ? P.mustard : P.red }}>
                {Number(scoreGeral).toFixed(1)}
              </div>
              <div style={{ fontSize:8, color:P.gray }}>viabilidade</div>
            </div>
          )}
          <div style={{ fontSize:14, color:P.gray, marginTop:4 }}>{expandido ? '▲' : '▼'}</div>
        </div>
      </div>

      {/* Conteúdo expandido */}
      {expandido && (
        <div style={{ padding:'14px' }}>

          {/* Resumo executivo completo */}
          {(analise.resumo_executivo || doc.resumo_executivo) && (
            <Box style={{ marginBottom:12, background:P.navyL, border:`1px solid ${P.navy}20` }}>
              <div style={{ fontSize:10, fontWeight:700, color:P.navy, marginBottom:6, textTransform:'uppercase', letterSpacing:.5 }}>
                📋 Resumo Executivo
              </div>
              <div style={{ fontSize:12, color:P.text, lineHeight:1.7 }}>
                {analise.resumo_executivo || doc.resumo_executivo}
              </div>
            </Box>
          )}

          {/* Informações principais */}
          {Object.keys(infos).length > 0 && (
            <Box style={{ marginBottom:12 }}>
              <div style={{ fontSize:10, fontWeight:700, color:P.navy, marginBottom:8, textTransform:'uppercase', letterSpacing:.5 }}>
                📊 Informações Identificadas
              </div>
              <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:'6px 16px' }}>
                {[
                  ['Processo', infos.processo_numero],
                  ['Vara', infos.vara],
                  ['Exequente', infos.exequente],
                  ['Executado', infos.executado],
                  ['Matrícula', infos.matricula_numero],
                  ['Cartório', infos.cartorio],
                  ['Proprietário atual', infos.proprietario_atual],
                  ['Área', infos.area_m2 ? `${infos.area_m2}m²` : null],
                  ['Débitos declarados', infos.debitos_declarados],
                  ['Gravames', infos.gravames],
                  ['Data leilão', infos.data_leilao],
                  ['Lance mínimo', infos.lance_minimo_pct ? `${infos.lance_minimo_pct}% da avaliação` : null],
                ].filter(([,v]) => v && v !== 'Não informado' && v !== 'null').map(([k,v]) => (
                  <div key={k}>
                    <div style={{ fontSize:9.5, color:P.gray, textTransform:'uppercase', letterSpacing:.3 }}>{k}</div>
                    <div style={{ fontSize:11.5, color:P.text, fontWeight:500 }}>{v}</div>
                  </div>
                ))}
              </div>
            </Box>
          )}

          {/* Métricas de viabilidade */}
          {Object.keys(metricas).length > 0 && (
            <Box style={{ marginBottom:12 }}>
              <div style={{ fontSize:10, fontWeight:700, color:P.navy, marginBottom:10, textTransform:'uppercase', letterSpacing:.5 }}>
                📈 Métricas de Viabilidade Jurídica
              </div>
              {metricas.score_titulo != null && <ScoreBar label="Situação do Título" value={metricas.score_titulo}/>}
              {metricas.score_debitos != null && <ScoreBar label="Débitos e Ônus" value={metricas.score_debitos}/>}
              {metricas.score_processos != null && <ScoreBar label="Processos / Disputas" value={metricas.score_processos}/>}
              {metricas.score_ocupacao != null && <ScoreBar label="Ocupação / Posse" value={metricas.score_ocupacao}/>}
              {metricas.score_documentacao != null && <ScoreBar label="Completude Doc." value={metricas.score_documentacao}/>}
              {metricas.score_geral != null && (
                <div style={{ marginTop:8, paddingTop:8, borderTop:`1px solid ${P.border}` }}>
                  <ScoreBar label="Score Geral de Viabilidade" value={metricas.score_geral} cor={P.navy}/>
                </div>
              )}
              {metricas.justificativa && (
                <div style={{ marginTop:6, fontSize:11, color:P.gray, lineHeight:1.5,
                  fontStyle:'italic', padding:'6px 8px', background:P.surface, borderRadius:6 }}>
                  {metricas.justificativa}
                </div>
              )}
            </Box>
          )}

          {/* Responsabilidade débitos */}
          {(analise.responsabilidade_debitos || doc.responsabilidade_debitos) && (
            <Box style={{ marginBottom:12, background:P.emeraldL, border:`1px solid ${P.emerald}25` }}>
              <div style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                <span style={{ fontSize:16 }}>⚖️</span>
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:P.emerald, marginBottom:3 }}>
                    Responsabilidade pelos Débitos:&nbsp;
                    <span style={{ textTransform:'uppercase' }}>{analise.responsabilidade_debitos || doc.responsabilidade_debitos}</span>
                  </div>
                  {analise.explicacao_responsabilidade && (
                    <div style={{ fontSize:11, color:P.text, lineHeight:1.6 }}>{analise.explicacao_responsabilidade}</div>
                  )}
                </div>
              </div>
            </Box>
          )}

          {/* Riscos identificados */}
          {riscos.length > 0 && (
            <Box style={{ marginBottom:12 }}>
              <div style={{ fontSize:10, fontWeight:700, color:P.red, marginBottom:8, textTransform:'uppercase', letterSpacing:.5 }}>
                ⚠️ Riscos Identificados ({riscos.length})
              </div>
              {riscos.map((r, i) => (
                <div key={i} style={{ padding:'8px 10px', marginBottom:6, borderRadius:7,
                  background: r.gravidade==='critico' ? P.redL : r.gravidade==='alto' ? '#FFF3E8' : P.mustardL,
                  border:`1px solid ${r.gravidade==='critico' ? P.red : r.gravidade==='alto' ? '#E06A00' : P.mustard}30` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                    <BadgeRisco gravidade={r.gravidade}/>
                    {r.impacto_financeiro_estimado > 0 && (
                      <span style={{ fontSize:10, color:P.red, fontWeight:600 }}>
                        ~{fmtC(r.impacto_financeiro_estimado)}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize:11.5, color:P.text, fontWeight:500, marginBottom:3 }}>{r.descricao}</div>
                  {r.trecho_relevante && (
                    <div style={{ fontSize:10, color:P.gray, fontStyle:'italic', marginBottom:3 }}>
                      "{r.trecho_relevante.substring(0, 120)}{r.trecho_relevante.length > 120 ? '...' : ''}"
                    </div>
                  )}
                  {r.acao_recomendada && (
                    <div style={{ fontSize:10.5, color:P.navy, fontWeight:600 }}>
                      → {r.acao_recomendada}
                    </div>
                  )}
                </div>
              ))}
            </Box>
          )}

          {/* Positivos e alertas lado a lado */}
          <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:10, marginBottom:12 }}>
            {positivos.length > 0 && (
              <Box style={{ background:P.emeraldL, border:`1px solid ${P.emerald}25` }}>
                <div style={{ fontSize:10, fontWeight:700, color:P.emerald, marginBottom:6, textTransform:'uppercase', letterSpacing:.5 }}>
                  ✅ Pontos Positivos
                </div>
                {positivos.map((p, i) => (
                  <div key={i} style={{ fontSize:11, color:P.text, padding:'3px 0',
                    borderBottom: i < positivos.length-1 ? `1px solid ${P.emerald}20` : 'none' }}>
                    • {p}
                  </div>
                ))}
              </Box>
            )}
            {alertas.length > 0 && (
              <Box style={{ background:P.mustardL, border:`1px solid ${P.mustard}25` }}>
                <div style={{ fontSize:10, fontWeight:700, color:P.mustard, marginBottom:6, textTransform:'uppercase', letterSpacing:.5 }}>
                  🔔 Alertas Críticos
                </div>
                {alertas.map((a, i) => (
                  <div key={i} style={{ fontSize:11, color:P.text, padding:'3px 0',
                    borderBottom: i < alertas.length-1 ? `1px solid ${P.mustard}20` : 'none' }}>
                    • {a}
                  </div>
                ))}
              </Box>
            )}
          </div>

          {/* Parecer final */}
          {(analise.parecer_final || doc.analise_ia) && (
            <Box style={{ background:P.navyL, border:`1px solid ${P.navy}20` }}>
              <div style={{ fontSize:10, fontWeight:700, color:P.navy, marginBottom:6, textTransform:'uppercase', letterSpacing:.5 }}>
                📝 Parecer Jurídico
              </div>
              <div style={{ fontSize:12, color:P.text, lineHeight:1.75 }}>
                {analise.parecer_final || doc.analise_ia}
              </div>
            </Box>
          )}

          {/* Links de acesso */}
          <div style={{ marginTop:10, display:'flex', gap:8, flexWrap:'wrap' }}>
            {doc.url_storage && (
              <a href={doc.url_storage} target="_blank" rel="noreferrer"
                style={{ fontSize:11, padding:'5px 12px', borderRadius:7, textDecoration:'none',
                  background:P.navy, color:'#fff', fontWeight:600 }}>
                📄 Abrir PDF armazenado
              </a>
            )}
            {doc.url_origem && (
              <a href={doc.url_origem} target="_blank" rel="noreferrer"
                style={{ fontSize:11, padding:'5px 12px', borderRadius:7, textDecoration:'none',
                  background:P.surface, color:P.navy, border:`1px solid ${P.border}`, fontWeight:500 }}>
                🔗 Link original
              </a>
            )}
          </div>
        </div>
      )}
    </Box>
  )
}

// ─── QUADRO RESUMO GERAL ─────────────────────────────────────────────────
function QuadroResumoJuridico({ docs, imovel }) {
  if (!docs.length) return null

  const comAnalise = docs.filter(d => d.analise_estruturada || d.metricas_viabilidade)
  const scores = comAnalise.map(d => 
    d.analise_estruturada?.metricas_viabilidade?.score_geral || d.score_viabilidade || 0
  ).filter(s => s > 0)
  const scoreMedia = scores.length ? (scores.reduce((a,b) => a+b, 0) / scores.length) : null

  const riscosCriticos = docs.flatMap(d => 
    (d.analise_estruturada?.riscos_identificados || d.riscos_encontrados || [])
      .filter(r => r.gravidade === 'critico' || r.gravidade === 'alto')
  )

  const recomendacoes = docs.map(d => d.analise_estruturada?.recomendacao_juridica || d.recomendacao_juridica)
  const temDesfavoravel = recomendacoes.includes('desfavoravel')
  const todasFavoraveis = recomendacoes.filter(Boolean).every(r => r === 'favoravel')

  const recGeral = temDesfavoravel ? 'desfavoravel' : todasFavoraveis ? 'favoravel' : 'neutro'
  const recConfig = {
    favoravel:    { cor:P.emerald, bg:P.emeraldL, icon:'✅', label:'Juridicamente Favorável' },
    neutro:       { cor:P.mustard, bg:P.mustardL, icon:'⚠️', label:'Análise Neutra — Due Diligence' },
    desfavoravel: { cor:P.red,     bg:P.redL,     icon:'❌', label:'Riscos Significativos Identificados' },
  }
  const rc = recConfig[recGeral]

  return (
    <Box style={{ marginBottom:14, border:`2px solid ${rc.cor}30`, background:rc.bg }}>
      <div style={{ fontSize:10, fontWeight:700, color:rc.cor, marginBottom:8, textTransform:'uppercase', letterSpacing:.5 }}>
        📊 Quadro Resumo Jurídico — {docs.length} documento(s) analisado(s)
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:10 }}>
        <div style={{ textAlign:'center', padding:'8px', background:P.white, borderRadius:8 }}>
          <div style={{ fontSize:22, fontWeight:800, color: rc.cor }}>{rc.icon}</div>
          <div style={{ fontSize:9.5, color:P.gray, marginTop:2 }}>Recomendação Geral</div>
          <div style={{ fontSize:10, fontWeight:700, color:rc.cor }}>{rc.label}</div>
        </div>
        <div style={{ textAlign:'center', padding:'8px', background:P.white, borderRadius:8 }}>
          <div style={{ fontSize:24, fontWeight:800, color: scoreMedia >= 7 ? P.emerald : scoreMedia >= 5 ? P.mustard : P.red }}>
            {scoreMedia != null ? scoreMedia.toFixed(1) : '—'}
          </div>
          <div style={{ fontSize:9.5, color:P.gray }}>Score médio viabilidade</div>
        </div>
        <div style={{ textAlign:'center', padding:'8px', background:P.white, borderRadius:8 }}>
          <div style={{ fontSize:24, fontWeight:800, color: riscosCriticos.length === 0 ? P.emerald : P.red }}>
            {riscosCriticos.length}
          </div>
          <div style={{ fontSize:9.5, color:P.gray }}>Riscos críticos/altos</div>
        </div>
      </div>

      {riscosCriticos.length > 0 && (
        <div style={{ padding:'8px 10px', background:P.white, borderRadius:7, border:`1px solid ${P.red}20` }}>
          <div style={{ fontSize:10, fontWeight:700, color:P.red, marginBottom:4 }}>
            Principais riscos identificados:
          </div>
          {riscosCriticos.slice(0,3).map((r, i) => (
            <div key={i} style={{ fontSize:11, color:P.text, padding:'2px 0' }}>
              • <strong>{r.gravidade?.toUpperCase()}</strong>: {r.descricao}
            </div>
          ))}
          {riscosCriticos.length > 3 && (
            <div style={{ fontSize:10, color:P.gray, marginTop:2 }}>+{riscosCriticos.length - 3} outros riscos — expanda os documentos abaixo</div>
          )}
        </div>
      )}
    </Box>
  )
}

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────────
export default function AbaDocumentos({ imovel, isAdmin, isMobile }) {
  const [docs, setDocs] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [processando, setProcessando] = useState(false)
  const [progresso, setProgresso] = useState('')
  const [erro, setErro] = useState('')

  // Carregar documentos do banco
  useEffect(() => {
    if (!imovel?.id) return
    carregarDocs()
  }, [imovel?.id])

  const carregarDocs = async () => {
    setCarregando(true)
    try {
      const { supabase } = await import('../lib/supabase.js')
      const { data } = await supabase
        .from('documentos_juridicos')
        .select('*')
        .eq('imovel_id', imovel.id)
        .order('analisado_em', { ascending: false })
      setDocs(data || [])
    } catch(e) { console.warn('[AXIS docs]', e.message) }
    setCarregando(false)
  }

  const buscarEAnalisar = async () => {
    if (!imovel?.fonte_url) { setErro('Imóvel sem URL de origem'); return }
    
    // Obter chaves
    let gKey = localStorage.getItem('axis-gemini-key') || ''
    let cKey = localStorage.getItem('axis-api-key') || ''
    if (!gKey && !cKey) {
      try {
        const { supabase } = await import('../lib/supabase.js')
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { loadApiKeys } = await import('../lib/supabase.js')
          const keys = await loadApiKeys(user.id)
          if (keys.geminiKey) { gKey = keys.geminiKey; localStorage.setItem('axis-gemini-key', gKey) }
          if (keys.claudeKey) { cKey = keys.claudeKey; localStorage.setItem('axis-api-key', cKey) }
        }
      } catch(e) {}
    }

    setProcessando(true); setErro(''); setProgresso('Iniciando...')

    try {
      // 1. Encontrar links de documentos na página do leilão
      setProgresso('🔍 Lendo página do leilão...')
      const { buscarDocumentosAuto } = await import('../lib/agenteJuridico.js')
      const { links } = await buscarDocumentosAuto(imovel, gKey, setProgresso)

      if (!links?.length) {
        setProgresso('⚠️ Nenhum documento encontrado na página. Tente upload manual.')
        setProcessando(false); return
      }

      setProgresso(`📋 ${links.length} documento(s) encontrado(s) — verificando duplicatas...`)

      // 2. Filtrar links já existentes no banco para este imóvel
      const urlsExistentes = docs.map(d => d.url || d.url_origem).filter(Boolean)
      const linksNovos = links.filter(l => !urlsExistentes.includes(l.url))

      if (linksNovos.length === 0) {
        setProgresso(`✅ Todos os ${links.length} documento(s) já estão no banco. Use re-análise para atualizar.`)
        setProcessando(false); return
      }
      if (linksNovos.length < links.length)
        setProgresso(`ℹ️ ${links.length - linksNovos.length} já existe(m), baixando ${linksNovos.length} novo(s)...`)

      // 3. Processar somente documentos novos
      const { processarDocumentoCompleto } = await import('../lib/documentosPDF.js')
      const { supabase } = await import('../lib/supabase.js')
      const { data: { session } } = await supabase.auth.getSession()

      const resultados = []
      for (const link of linksNovos.slice(0, 4)) {
        const res = await processarDocumentoCompleto({
          url: link.url,
          nome: link.nome || link.tipo,
          tipo: link.tipo || 'outro',
          imovel,
          geminiKey: gKey,
          claudeKey: cKey,
          onProgress: setProgresso
        })
        resultados.push(res)
      }

      // 3. Salvar tudo no banco
      setProgresso('💾 Salvando análises no banco...')
      const { salvarDocumentoJuridico } = await import('../lib/supabase.js')
      for (const res of resultados) {
        if (!res.sucesso) continue
        await salvarDocumentoJuridico({
          imovel_id: imovel.id,
          nome: res.nome,
          tipo: res.tipo,
          url: res.url_origem,
          url_storage: res.url_storage,
          url_origem: res.url_origem,
          tamanho_bytes: res.tamanho_bytes,
          analise_ia: res.analise_ia,
          riscos_encontrados: res.riscos_encontrados,
          score_juridico_sugerido: res.score_juridico_sugerido,
          score_viabilidade: res.score_viabilidade,
          resumo_executivo: res.resumo_executivo,
          pontos_positivos: res.pontos_positivos,
          alertas_criticos: res.alertas_criticos,
          responsabilidade_debitos: res.responsabilidade_debitos,
          ocupacao_confirmada: res.ocupacao_confirmada,
          prazo_liberacao_meses: res.prazo_liberacao_meses,
          recomendacao_juridica: res.recomendacao_juridica,
          metricas_viabilidade: res.metricas_viabilidade,
          analise_estruturada: res.analise_estruturada,
          conteudo_texto: res.conteudo_texto,
          processado: res.processado,
          reclassificado: false,
          analisado_em: new Date().toISOString(),
          user_id: session?.user?.id
        }).catch(e => console.warn('[AXIS save doc]', e.message))
      }

      const comAnalise = resultados.filter(r => r.sucesso && r.analise).length
      const total = resultados.filter(r => r.sucesso).length
      setProgresso(`✅ ${total} documento(s) processado(s), ${comAnalise} com análise IA completa`)
      await carregarDocs()
    } catch(e) {
      setErro(`Erro: ${e.message}`)
      console.error('[AXIS docs]', e)
    }
    setProcessando(false)
  }

  if (carregando) return (
    <div style={{ padding:20, textAlign:'center', color:P.gray }}>Carregando documentos...</div>
  )

  return (
    <div style={{ padding: isMobile ? '12px' : '16px 20px' }}>

      {/* Quadro resumo */}
      {docs.length > 0 && <QuadroResumoJuridico docs={docs} imovel={imovel}/>}

      {/* Ações */}
      {isAdmin && (
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
          <button
            onClick={buscarEAnalisar}
            disabled={processando}
            style={{ padding:'9px 16px', borderRadius:8, border:'none', cursor:'pointer',
              background: processando ? P.gray : P.navy, color:'#fff',
              fontSize:12, fontWeight:600, display:'flex', alignItems:'center', gap:6 }}>
            {processando ? '⏳ Processando...' : '🤖 Baixar e analisar documentos'}
          </button>
          <label style={{ padding:'9px 16px', borderRadius:8, border:`1px solid ${P.border}`,
            background:P.surface, color:P.navy, fontSize:12, fontWeight:500, cursor:'pointer' }}>
            📎 Upload manual
            <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.txt"
              style={{ display:'none' }}
              onChange={async (e) => {
                const files = Array.from(e.target.files || [])
                if (!files.length) return
                let gKey = localStorage.getItem('axis-gemini-key') || ''
                let cKey = localStorage.getItem('axis-api-key') || ''
                setProcessando(true); setErro('')
                const { processarDocumentoCompleto } = await import('../lib/documentosPDF.js')
                const { salvarDocumentoJuridico } = await import('../lib/supabase.js')
                const { supabase } = await import('../lib/supabase.js')
                const { data: { session } } = await supabase.auth.getSession()
                for (const file of files) {
                  setProgresso(`Processando ${file.name}...`)
                  const texto = await file.text().catch(() => '')
                  const blob = new Blob([await file.arrayBuffer()], { type: file.type })
                  const { analisarDocumentoCompleto, salvarPDFNoStorage } = await import('../lib/documentosPDF.js')
                  let urlStorage = null
                  try {
                    const s = await salvarPDFNoStorage(blob, imovel.id, file.name, file.type)
                    urlStorage = s.url_storage
                  } catch(e) {}
                  const analise = await analisarDocumentoCompleto(texto, file.name, imovel, gKey, cKey)
                  await salvarDocumentoJuridico({
                    imovel_id: imovel.id, nome: file.name,
                    tipo: file.name.toLowerCase().includes('edital') ? 'edital' : file.name.toLowerCase().includes('matri') ? 'matricula' : 'outro',
                    url_storage: urlStorage,
                    analise_ia: analise?.parecer_final || '',
                    riscos_encontrados: analise?.riscos_identificados || [],
                    score_juridico_sugerido: analise?.score_juridico_sugerido,
                    score_viabilidade: analise?.metricas_viabilidade?.score_geral,
                    resumo_executivo: analise?.resumo_executivo || '',
                    pontos_positivos: analise?.pontos_positivos || [],
                    alertas_criticos: analise?.alertas_criticos || [],
                    responsabilidade_debitos: analise?.responsabilidade_debitos,
                    metricas_viabilidade: analise?.metricas_viabilidade,
                    analise_estruturada: analise,
                    processado: !!analise, reclassificado: false,
                    analisado_em: new Date().toISOString(), user_id: session?.user?.id
                  }).catch(() => {})
                }
                setProgresso('✅ Arquivos processados')
                setProcessando(false)
                await carregarDocs()
              }}
            />
          </label>
        </div>
      )}

      {/* Feedback */}
      {(progresso || erro) && (
        <div style={{ padding:'8px 12px', borderRadius:8, marginBottom:10, fontSize:11.5,
          background: erro ? P.redL : `${P.emerald}08`,
          border:`1px solid ${erro ? P.red+'30' : P.emerald+'30'}`,
          color: erro ? '#A32D2D' : P.text }}>
          {erro || progresso}
        </div>
      )}

      {/* Lista de documentos */}
      {docs.length > 0 ? (
        docs.map(doc => <CardDocumento key={doc.id} doc={doc} isMobile={isMobile}/>)
      ) : !processando && (
        <div style={{ textAlign:'center', padding:'32px 20px', color:P.gray }}>
          <div style={{ fontSize:32, marginBottom:10 }}>📂</div>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:6 }}>Nenhum documento analisado</div>
          <div style={{ fontSize:11, lineHeight:1.6 }}>
            Clique em "Baixar e analisar documentos" para buscar automaticamente<br/>
            o edital e a matrícula do imóvel, ou faça upload manual.
          </div>
        </div>
      )}
    </div>
  )
}
