/**
 * AXIS — Gestão de PDFs de Documentos Jurídicos
 * Download via Jina → Storage Supabase → Análise IA estruturada
 */

import { supabase } from './supabase.js'

// ─── DOWNLOAD DO PDF VIA FETCH ─────────────────────────────────────────────
export async function baixarPDFParaBlob(url, onProgress) {
  onProgress?.(`📥 Baixando PDF: ${url.split('/').pop().substring(0, 40)}...`)
  
  // Tentar fetch direto primeiro (PDF como binário)
  try {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(30000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AXIS/1.0)' }
    })
    if (r.ok) {
      const contentType = r.headers.get('content-type') || ''
      const blob = await r.blob()
      if (blob.size > 1000) {
        onProgress?.(`✅ PDF baixado: ${(blob.size / 1024).toFixed(0)}KB`)
        return { blob, contentType: contentType || 'application/pdf', tamanho: blob.size }
      }
    }
  } catch(e) {
    console.warn('[AXIS PDF] Fetch direto:', e.message)
  }
  
  // Fallback: Jina como proxy para CORS
  try {
    onProgress?.('🔄 Tentando via proxy Jina...')
    const r2 = await fetch(`https://r.jina.ai/${url}`, {
      headers: { 'Accept': 'text/plain', 'X-Return-Format': 'text' },
      signal: AbortSignal.timeout(30000)
    })
    if (r2.ok) {
      const texto = await r2.text()
      if (texto.length > 200) {
        const blob = new Blob([texto], { type: 'text/plain' })
        onProgress?.(`✅ Texto extraído: ${(texto.length / 1024).toFixed(0)}KB`)
        return { blob, contentType: 'text/plain', tamanho: blob.size, textoExtraido: texto }
      }
    }
  } catch(e) {
    console.warn('[AXIS PDF] Jina fallback:', e.message)
  }
  
  return null
}

// ─── SALVAR PDF NO SUPABASE STORAGE ───────────────────────────────────────
export async function salvarPDFNoStorage(blob, imovelId, nomeArquivo, contentType) {
  const nomeSeguro = nomeArquivo
    .replace(/[^a-zA-Z0-9.\-_]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 100)
  
  const caminho = `${imovelId}/${Date.now()}_${nomeSeguro}`
  
  const { data, error } = await supabase.storage
    .from('documentos-juridicos')
    .upload(caminho, blob, {
      contentType,
      upsert: false,
      cacheControl: '3600'
    })
  
  if (error) throw new Error(`Storage: ${error.message}`)
  
  // URL pública assinada (24h)
  const { data: urlData } = await supabase.storage
    .from('documentos-juridicos')
    .createSignedUrl(caminho, 86400)
  
  return {
    caminho,
    url_storage: urlData?.signedUrl || null,
    tamanho: blob.size
  }
}

// ─── ANÁLISE JURÍDICA ESTRUTURADA COMPLETA ────────────────────────────────
export async function analisarDocumentoCompleto(texto, nomeArq, imovel, geminiKey, claudeKey) {
  if (!texto || texto.length < 50) return null

  // Fallback: tentar env var se chave não foi passada diretamente
  const gKey = geminiKey
    || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY)
    || (typeof localStorage !== 'undefined' && localStorage.getItem('axis-gemini-key'))
    || ''
  const cKey = claudeKey
    || (typeof localStorage !== 'undefined' && localStorage.getItem('axis-api-key'))
    || ''
  
  const prompt = `Você é especialista em direito imobiliário e leilões judiciais no Brasil (Minas Gerais).
Faça uma análise jurídica COMPLETA e ESTRUTURADA deste documento.

DOCUMENTO: ${nomeArq}
IMÓVEL: ${imovel.titulo || imovel.endereco || 'Não informado'} — ${imovel.bairro || ''}, ${imovel.cidade || 'BH'}/MG
MODALIDADE: ${imovel.modalidade_leilao || 'judicial'}
PROCESSO: ${imovel.processos_ativos || 'Não informado'}
VALOR MÍNIMO: R$ ${imovel.valor_minimo?.toLocaleString('pt-BR') || 'Não informado'}

TEXTO DO DOCUMENTO (primeiros 7000 chars):
${texto.substring(0, 7000)}

Retorne APENAS JSON válido com esta estrutura EXATA:
{
  "tipo_documento": "edital|matricula|processo|certidao|outro",
  "titulo_documento": "nome descritivo do documento",
  
  "resumo_executivo": "Resumo em 3-5 linhas do que este documento revela sobre o imóvel, processo e riscos para o arrematante",
  
  "informacoes_principais": {
    "processo_numero": "número CNJ se encontrado",
    "vara": "nome da vara",
    "exequente": "nome",
    "executado": "nome",
    "data_leilao": "data se edital",
    "lance_minimo_pct": 35,
    "matricula_numero": "número da matrícula se encontrado",
    "cartorio": "nome do cartório se encontrado",
    "area_m2": null,
    "proprietario_atual": "nome se encontrado",
    "debitos_declarados": "descrição dos débitos se houver",
    "gravames": "penhoras, hipotecas, alienações encontradas"
  },
  
  "metricas_viabilidade": {
    "score_geral": 7.0,
    "score_titulo": 8.0,
    "score_debitos": 6.0,
    "score_processos": 7.0,
    "score_ocupacao": 5.0,
    "score_documentacao": 8.0,
    "justificativa": "por que esses scores"
  },
  
  "riscos_identificados": [
    {
      "categoria": "titulo|debito|ocupacao|processo|documentacao",
      "descricao": "descrição clara do risco",
      "gravidade": "critico|alto|medio|baixo",
      "impacto_financeiro_estimado": 5000,
      "trecho_relevante": "trecho exato do documento",
      "acao_recomendada": "o que fazer antes do lance"
    }
  ],
  
  "pontos_positivos": ["ponto positivo 1", "ponto positivo 2"],
  "alertas_criticos": ["alerta 1 — ação necessária", "alerta 2"],
  
  "responsabilidade_debitos": "sub_rogado|arrematante|misto|exonerado",
  "explicacao_responsabilidade": "explicação sobre sub-rogação ou não",
  
  "ocupacao_confirmada": "desocupado|ocupado|incerto",
  "prazo_liberacao_estimado_meses": 0,
  
  "recomendacao_juridica": "favoravel|neutro|desfavoravel",
  "parecer_final": "Parecer jurídico completo em 4-6 linhas com conclusão clara sobre viabilidade do lance",
  
  "score_juridico_sugerido": 7.0,
  "score_juridico_delta": 0.0
}`

  // Tentar Gemini primeiro
  if (gKey) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${gKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 3000 }
          }),
          signal: AbortSignal.timeout(60000)
        }
      )
      if (r.ok) {
        const data = await r.json()
        const txt = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        const match = txt.replace(/```json|```/g, '').trim().match(/\{[\s\S]*\}/)
        if (match) {
          const res = JSON.parse(match[0])
          res._modelo = 'gemini-1.5-flash'
          return res
        }
      }
    } catch(e) { console.warn('[AXIS análise doc] Gemini:', e.message) }
  }

  // Fallback DeepSeek (barato e eficaz para análise de texto)
  const deepseekKey = typeof localStorage !== 'undefined' ? localStorage.getItem('axis-deepseek-key') : null
  if (deepseekKey) {
    try {
      const r = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${deepseekKey}` },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 3000, temperature: 0.1
        }),
        signal: AbortSignal.timeout(60000)
      })
      if (r.ok) {
        const data = await r.json()
        const txt = data.choices?.[0]?.message?.content || ''
        const match = txt.replace(/```json|```/g, '').trim().match(/\{[\s\S]*\}/)
        if (match) {
          const res = JSON.parse(match[0])
          res._modelo = 'deepseek-chat'
          return res
        }
      }
    } catch(e) { console.warn('[AXIS análise doc] DeepSeek:', e.message) }
  }

  // Fallback Claude Haiku
  if (cKey) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'x-api-key':cKey, 'anthropic-version':'2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 3000,
          messages: [{ role: 'user', content: prompt }]
        }),
        signal: AbortSignal.timeout(60000)
      })
      if (r.ok) {
        const data = await r.json()
        const txt = data.content?.[0]?.text || ''
        const match = txt.replace(/```json|```/g, '').trim().match(/\{[\s\S]*\}/)
        if (match) {
          const res = JSON.parse(match[0])
          res._modelo = 'claude-haiku'
          return res
        }
      }
    } catch(e) { console.warn('[AXIS análise doc] Claude:', e.message) }
  }

  return null
}

// ─── ANÁLISE HEURÍSTICA POR REGEX (fallback sem API) ───────────────────────
function analisarDocumentoPorRegex(texto, nomeArq) {
  if (!texto || texto.length < 100) return null

  const t = texto.replace(/\s+/g, ' ')
  const lower = t.toLowerCase()

  // Detectar tipo de documento
  let tipo = 'outro'
  if (/edital|leil[aã]o|arrematação|hasta p[uú]blica/i.test(t)) tipo = 'edital'
  else if (/matr[ií]cula|registro de im[oó]veis|r\.?\s*g\.?\s*i/i.test(t)) tipo = 'matricula'
  else if (/certid[aã]o|d[eé]bito|iptu|condom[ií]nio/i.test(t)) tipo = 'certidao'
  else if (/processo|autos|execu[çc][aã]o|penhora/i.test(t)) tipo = 'processo'

  // Extrair padrões
  const extrair = (regex, grupo = 1) => { const m = t.match(regex); return m ? m[grupo]?.trim() : null }

  const processo = extrair(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/) // CNJ
  const matricula = extrair(/matr[ií]cula\s*(?:n[.ºo°]*\s*)?(\d{3,8})/i)
  const cartorio = extrair(/(\d+[ºo°]?\s*(?:of[ií]cio|cart[oó]rio|registro)\s*de\s*im[oó]veis[^,.]*)/i)
  const vara = extrair(/((?:\d+[ªa]?\s*)?vara\s*(?:c[ií]vel|do trabalho|federal|de execu[çc][õo]es)[^,.]{0,60})/i)
  const exequente = extrair(/(?:exequente|autor|credor)[:\s]*([A-ZÀ-Ú][A-Za-zÀ-ÿ\s.]{3,60})/i)
  const executado = extrair(/(?:executado|r[eé]u|devedor)[:\s]*([A-ZÀ-Ú][A-Za-zÀ-ÿ\s.]{3,60})/i)

  // Valores monetários
  const extrairValor = (regex) => {
    const m = t.match(regex)
    if (!m) return null
    const v = m[1].replace(/\./g, '').replace(',', '.')
    return parseFloat(v) || null
  }
  const valorAvaliacao = extrairValor(/avalia[çc][aã]o[^R]*R\$\s*([\d.,]+)/i)
    || extrairValor(/valor\s*(?:de\s*)?avalia[çc][aã]o[^R]*R\$\s*([\d.,]+)/i)

  // Data do leilão
  const dataLeilao = extrair(/(?:data|realiza[çc][aã]o)[^:]*:\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/i)

  // Área
  const areaMatch = extrair(/(\d{2,5}[.,]\d{1,2})\s*m[²2]/i)
  const area = areaMatch ? parseFloat(areaMatch.replace(',', '.')) : null

  // Débitos
  const debitos = []
  if (/d[eé]bito|inadimpl[eê]ncia|atraso/i.test(t)) {
    const iptu = extrairValor(/iptu[^R]*R\$\s*([\d.,]+)/i)
    if (iptu) debitos.push(`IPTU: R$ ${iptu.toLocaleString('pt-BR')}`)
    const cond = extrairValor(/condom[ií]nio[^R]*R\$\s*([\d.,]+)/i)
    if (cond) debitos.push(`Condomínio: R$ ${cond.toLocaleString('pt-BR')}`)
  }

  // Gravames
  const gravames = []
  if (/penhora/i.test(t)) gravames.push('Penhora identificada')
  if (/hipoteca/i.test(t)) gravames.push('Hipoteca identificada')
  if (/aliena[çc][aã]o\s*fiduci[aá]ria/i.test(t)) gravames.push('Alienação fiduciária identificada')
  if (/indisponibilidade/i.test(t)) gravames.push('Indisponibilidade de bens')

  // Ocupação
  let ocupacao = 'incerto'
  if (/desocupado|vago|livre/i.test(t)) ocupacao = 'desocupado'
  else if (/ocupado|morador|inquilino|posse/i.test(t)) ocupacao = 'ocupado'

  // Responsabilidade débitos
  let respDebitos = 'incerto'
  if (/sub[- ]?roga[çc][aã]o|exonera|quitados?\s*(?:com|pelo)\s*(?:produto|preço)/i.test(t)) respDebitos = 'sub_rogado'
  else if (/arrematante\s*responsável|por conta do\s*arrematante/i.test(t)) respDebitos = 'arrematante'

  // Riscos
  const riscos = []
  if (gravames.length) riscos.push({ categoria: 'titulo', descricao: gravames.join('; '), gravidade: gravames.length > 1 ? 'alto' : 'medio', acao_recomendada: 'Verificar situação registrária atualizada' })
  if (debitos.length) riscos.push({ categoria: 'debito', descricao: debitos.join('; '), gravidade: 'medio', acao_recomendada: 'Verificar responsabilidade pelos débitos no edital' })
  if (ocupacao === 'ocupado') riscos.push({ categoria: 'ocupacao', descricao: 'Imóvel ocupado — pode exigir ação de imissão na posse', gravidade: 'alto', acao_recomendada: 'Avaliar custo e prazo de desocupação' })

  // Score heurístico
  let score = 6.0
  if (gravames.length > 1) score -= 1.5
  else if (gravames.length === 1) score -= 0.5
  if (ocupacao === 'ocupado') score -= 1.0
  if (debitos.length > 1) score -= 0.5
  if (processo) score += 0.3  // pelo menos tem informação

  return {
    tipo_documento: tipo,
    titulo_documento: `Análise heurística: ${nomeArq}`,
    resumo_executivo: `Análise parcial por heurística (sem IA). ${riscos.length} risco(s) identificado(s). ${gravames.length ? 'Gravames: ' + gravames.join(', ') + '.' : 'Sem gravames detectados.'} Ocupação: ${ocupacao}.`,
    informacoes_principais: {
      processo_numero: processo,
      vara: vara,
      exequente: exequente,
      executado: executado,
      matricula_numero: matricula,
      cartorio: cartorio,
      area_m2: area,
      debitos_declarados: debitos.join('; ') || null,
      gravames: gravames.join('; ') || null,
    },
    metricas_viabilidade: {
      score_geral: Math.max(1, Math.min(10, score)),
      justificativa: 'Score estimado por heurística — reanalisar com IA para precisão',
    },
    riscos_identificados: riscos,
    pontos_positivos: processo ? ['Número do processo identificado — rastreável'] : [],
    alertas_criticos: gravames.length > 1 ? ['Múltiplos gravames detectados — análise jurídica detalhada recomendada'] : [],
    responsabilidade_debitos: respDebitos,
    ocupacao_confirmada: ocupacao,
    prazo_liberacao_estimado_meses: ocupacao === 'ocupado' ? 12 : ocupacao === 'desocupado' ? 0 : 6,
    recomendacao_juridica: score >= 6 ? 'neutro' : 'desfavoravel',
    parecer_final: `Análise heurística (regex) — ${riscos.length} risco(s) detectado(s). Score estimado: ${Math.max(1, Math.min(10, score)).toFixed(1)}/10. Recomenda-se reanálise com IA (configure Gemini ou Claude) para parecer completo.`,
    score_juridico_sugerido: Math.max(1, Math.min(10, score)),
    score_juridico_delta: 0.0,
    _parcial: true,
  }
}

// ─── PIPELINE COMPLETO: URL → Storage → Análise → Banco ───────────────────
export async function processarDocumentoCompleto({ url, nome, tipo, imovel, geminiKey, claudeKey, openaiKey, onProgress }) {
  // Fallback: env vars e localStorage se chaves não passadas
  geminiKey = geminiKey
    || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY)
    || (typeof localStorage !== 'undefined' && localStorage.getItem('axis-gemini-key'))
    || ''
  claudeKey = claudeKey
    || (typeof localStorage !== 'undefined' && localStorage.getItem('axis-api-key'))
    || ''
  openaiKey = openaiKey
    || (typeof localStorage !== 'undefined' && localStorage.getItem('axis-openai-key'))
    || ''

  onProgress?.(`🔍 Iniciando processamento de ${nome}...`)
  
  // 1. Baixar PDF
  const download = await baixarPDFParaBlob(url, onProgress)
  if (!download) {
    onProgress?.(`⚠️ Não foi possível baixar ${nome}`)
    return { sucesso: false, erro: 'download_falhou', nome, url }
  }

  // 2. Extrair texto para análise
  let textoParaAnalise = download.textoExtraido || ''
  if (!textoParaAnalise && download.blob) {
    try {
      textoParaAnalise = await download.blob.text()
      if (textoParaAnalise.includes('%PDF')) {
        // PDF binário — extrair strings legíveis
        const bytes = textoParaAnalise
        textoParaAnalise = bytes
          .match(/\(([^)]{4,200})\)/g)
          ?.map(m => m.slice(1,-1))
          .filter(s => s.length > 5 && /[a-zA-ZÀ-ÿ]/.test(s))
          .join(' ')
          .substring(0, 8000) || ''
      }
    } catch(e) {}
  }
  
  if (!textoParaAnalise || textoParaAnalise.length < 100) {
    // Tentar via Jina como texto
    try {
      const r = await fetch(`https://r.jina.ai/${url}`, {
        headers: { 'Accept': 'text/plain', 'X-Return-Format': 'text' },
        signal: AbortSignal.timeout(30000)
      })
      if (r.ok) textoParaAnalise = await r.text()
    } catch(e) {}
  }
  
  // 3. Salvar no Storage Supabase
  let urlStorage = null, caminhoStorage = null
  try {
    onProgress?.('💾 Salvando PDF no banco de dados...')
    const storage = await salvarPDFNoStorage(download.blob, imovel.id, nome, download.contentType)
    urlStorage = storage.url_storage
    caminhoStorage = storage.caminho
    onProgress?.('✅ PDF armazenado')
  } catch(e) {
    console.warn('[AXIS storage]', e.message)
    onProgress?.('⚠️ Armazenamento falhou — análise continua')
  }
  
  // 4a. Pré-registrar no banco ANTES da análise (garante persistência mesmo se análise falhar)
  let preRegistroId = null
  try {
    const { salvarDocumentoJuridico } = await import('./supabase.js')
    const preReg = await salvarDocumentoJuridico({
      imovel_id: imovel.id,
      tipo,
      nome,
      url: url,
      url_origem: url,
      url_storage: urlStorage,
      tamanho_bytes: download.tamanho,
      status: 'baixado',
      processado: false,
      analisado_em: new Date().toISOString(),
    })
    preRegistroId = preReg?.id
    onProgress?.(`📋 Documento registrado (id: ${preRegistroId?.substring(0,8)})`)
  } catch(eReg) {
    onProgress?.(`⚠️ Pré-registro falhou: ${eReg.message?.substring(0,60)} — análise continua`)
  }

  // 4. Análise IA estruturada
  let analise = null
  if (textoParaAnalise?.length > 100) {
    onProgress?.(`🤖 IA analisando ${nome} (texto extraído)...`)
    analise = await analisarDocumentoCompleto(textoParaAnalise, nome, imovel, geminiKey, claudeKey)
  }

  // Se texto insuficiente ou análise falhou → Gemini Vision com base64 (PDFs escaneados)
  if (!analise && geminiKey && download.blob) {
    try {
      onProgress?.(`🔍 PDF escaneado — Gemini Vision processando ${nome}...`)
      // Converter para base64 eficientemente (evitar stack overflow com PDFs grandes)
      const arrayBuf = await download.blob.arrayBuffer()
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(new Blob([arrayBuf], { type: download.contentType || 'application/pdf' }))
      })
      // Verificar tamanho — Gemini limite: 20MB para inline_data
      if (base64.length > 15_000_000) {
        onProgress?.(`⚠️ ${nome} muito grande para Vision (${Math.round(base64.length/1024)}KB) — usando análise parcial`)
        // Para PDFs muito grandes, analisar apenas as primeiras páginas via texto
        throw new Error('PDF muito grande para Vision — usar análise de texto')
      }
      const prompt = `Você é especialista em direito imobiliário e leilões judiciais no Brasil (MG).
Analise este documento (${nome}) do imóvel: ${imovel.titulo || ''} | Processo: ${imovel.processos_ativos || '?'}
Retorne APENAS JSON:
{"tipo_documento":"edital|matricula|processo|certidao|outro","titulo_documento":"","resumo_executivo":"3-5 linhas","informacoes_principais":{"processo_numero":"","vara":"","exequente":"","executado":"","matricula_numero":"","cartorio":"","proprietario_atual":"","debitos_declarados":"","gravames":""},"metricas_viabilidade":{"score_geral":7.0,"score_titulo":7.0,"score_debitos":6.0,"score_processos":7.0,"score_ocupacao":5.0,"score_documentacao":8.0,"justificativa":""},"riscos_identificados":[{"categoria":"","descricao":"","gravidade":"alto","impacto_financeiro_estimado":0,"acao_recomendada":""}],"pontos_positivos":[],"alertas_criticos":[],"responsabilidade_debitos":"sub_rogado|arrematante","explicacao_responsabilidade":"","ocupacao_confirmada":"incerto","prazo_liberacao_estimado_meses":0,"recomendacao_juridica":"favoravel|neutro|desfavoravel","parecer_final":"4-6 linhas","score_juridico_sugerido":7.0,"score_juridico_delta":0.0}`
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${geminiKey}`,
        {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({
            contents:[{parts:[
              {inline_data:{mime_type: download.contentType || 'application/pdf', data: base64}},
              {text: prompt}
            ]}],
            generationConfig:{temperature:0.1, maxOutputTokens:3000}
          }),
          signal: AbortSignal.timeout(120000)
        }
      )
      if (r.ok) {
        const data = await r.json()
        const txt = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        const match = txt.replace(/```json|```/g,'').trim().match(/\{[\s\S]*\}/)
        if (match) {
          analise = JSON.parse(match[0])
          analise._modelo = 'gemini-1.5-pro-vision'
          onProgress?.(`✅ ${nome} — Vision OK, score: ${analise.metricas_viabilidade?.score_geral || '?'}/10`)
        }
      } else {
        const err = await r.text().catch(()=>'')
        onProgress?.(`⚠️ Gemini Vision falhou (${r.status}) — ${err.substring(0,60)}`)
      }
    } catch(e) { onProgress?.(`⚠️ Gemini Vision erro: ${e.message.substring(0,60)}`) }
  }

  // Fallback: GPT-4o Vision (para PDFs escaneados quando Gemini falha)
  if (!analise && openaiKey && download.blob) {
    try {
      onProgress?.(`🔍 GPT-4o Vision processando ${nome}...`)
      // Pré-carregar arrayBuffer antes do FileReader (não pode usar await dentro do callback)
      const arrayBufGpt = await download.blob.arrayBuffer()
      const base64Gpt = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(new Blob([arrayBufGpt], { type: download.contentType || 'application/pdf' }))
      })
      const promptGpt = `Você é especialista em direito imobiliário e leilões judiciais no Brasil (MG).
Analise este documento (${nome}) do imóvel: ${imovel.titulo || ''} | Processo: ${imovel.processos_ativos || '?'}
Retorne APENAS JSON:
{"tipo_documento":"edital|matricula|processo|certidao|outro","titulo_documento":"","resumo_executivo":"3-5 linhas sobre riscos e informações principais","informacoes_principais":{"processo_numero":"","vara":"","exequente":"","executado":"","matricula_numero":"","cartorio":"","proprietario_atual":"","debitos_declarados":"","gravames":""},"metricas_viabilidade":{"score_geral":7.0,"score_titulo":7.0,"score_debitos":6.0,"score_processos":7.0,"score_ocupacao":5.0,"justificativa":""},"riscos_identificados":[{"categoria":"","descricao":"","gravidade":"alto","acao_recomendada":""}],"pontos_positivos":[],"alertas_criticos":[],"responsabilidade_debitos":"sub_rogado","ocupacao_confirmada":"incerto","recomendacao_juridica":"neutro","parecer_final":"4-6 linhas","score_juridico_sugerido":7.0}`
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o',
          max_tokens: 3000,
          messages: [{ role: 'user', content: [
            { type: 'text', text: promptGpt },
            { type: 'image_url', image_url: { url: `data:${download.contentType || 'application/pdf'};base64,${base64Gpt}`, detail: 'high' } }
          ]}]
        }),
        signal: AbortSignal.timeout(120000)
      })
      if (r.ok) {
        const data = await r.json()
        const txt = data.choices?.[0]?.message?.content || ''
        const match = txt.replace(/```json|```/g,'').trim().match(/\{[\s\S]*\}/)
        if (match) {
          analise = JSON.parse(match[0])
          analise._modelo = 'gpt-4o-vision'
          onProgress?.(`✅ ${nome} — GPT-4o Vision OK, score: ${analise.metricas_viabilidade?.score_geral || '?'}/10`)
        }
      } else {
        const err = await r.json().catch(()=>({}))
        onProgress?.(`⚠️ GPT-4o Vision falhou (${r.status}) — ${err.error?.message?.substring(0,60) || ''}`)
      }
    } catch(e) { onProgress?.(`⚠️ GPT-4o Vision erro: ${e.message?.substring(0,60)}`) }
  }

  // ── FALLBACK: Análise heurística por regex (sem API) ────────────────────
  if (!analise && textoParaAnalise?.length > 100) {
    try {
      onProgress?.(`🔍 Fallback: análise heurística de ${nome} (sem API)...`)
      analise = analisarDocumentoPorRegex(textoParaAnalise, nome)
      if (analise) {
        analise._modelo = 'regex_fallback'
        onProgress?.(`⚠️ ${nome} — análise parcial (heurística, sem IA)`)
      }
    } catch(e) { console.warn('[AXIS] Regex fallback:', e.message) }
  }

  if (analise) {
    onProgress?.(`✅ ${nome}: ${analise.recomendacao_juridica||'?'} · viabilidade ${analise.metricas_viabilidade?.score_geral||'?'}/10`)
  } else {
    onProgress?.(`⚠️ ${nome}: salvo sem análise IA (texto insuficiente + sem Gemini Vision)`)
  }

  // 5. Atualizar pré-registro com análise completa (se foi pré-registrado)
  if (preRegistroId && analise) {
    try {
      const { salvarDocumentoJuridico } = await import('./supabase.js')
      await salvarDocumentoJuridico({
        id: preRegistroId,
        imovel_id: imovel.id,
        tipo,
        nome,
        url: url,
        url_origem: url,
        url_storage: urlStorage,
        tamanho_bytes: download.tamanho,
        status: 'analisado',
        processado: true,
        analisado_em: new Date().toISOString(),
        analise_ia: analise?.parecer_final || analise?.resumo_executivo || '',
        resumo_executivo: analise?.resumo_executivo || '',
        pontos_positivos: analise?.pontos_positivos || [],
        alertas_criticos: analise?.alertas_criticos || [],
        riscos_encontrados: analise?.riscos_identificados || [],
        score_juridico_sugerido: analise?.score_juridico_sugerido || null,
        score_viabilidade: analise?.metricas_viabilidade?.score_geral || null,
        responsabilidade_debitos: analise?.responsabilidade_debitos || null,
        ocupacao_confirmada: analise?.ocupacao_confirmada || null,
        prazo_liberacao_meses: analise?.prazo_liberacao_estimado_meses || null,
        recomendacao_juridica: analise?.recomendacao_juridica || null,
        metricas_viabilidade: analise?.metricas_viabilidade || null,
        analise_estruturada: analise || null,
        conteudo_texto: textoParaAnalise?.substring(0, 8000) || '',
      })
      onProgress?.(`💾 Análise salva no banco (${analise._modelo || 'IA'})`)
    } catch(eUpd) {
      onProgress?.(`⚠️ Erro ao salvar análise: ${eUpd.message?.substring(0,60)}`)
    }
  }

  return {
    sucesso: true,
    nome,
    tipo,
    pre_registro_id: preRegistroId,
    url_origem: url,
    url_storage: urlStorage,
    caminho_storage: caminhoStorage,
    tamanho_bytes: download.tamanho,
    conteudo_texto: textoParaAnalise?.substring(0, 8000) || '',
    analise,
    analise_ia: analise?.parecer_final || analise?.resumo_executivo || '',
    riscos_encontrados: analise?.riscos_identificados || [],
    score_juridico_sugerido: analise?.score_juridico_sugerido || null,
    score_viabilidade: analise?.metricas_viabilidade?.score_geral || null,
    resumo_executivo: analise?.resumo_executivo || '',
    pontos_positivos: analise?.pontos_positivos || [],
    alertas_criticos: analise?.alertas_criticos || [],
    responsabilidade_debitos: analise?.responsabilidade_debitos || null,
    ocupacao_confirmada: analise?.ocupacao_confirmada || null,
    prazo_liberacao_meses: analise?.prazo_liberacao_estimado_meses || null,
    recomendacao_juridica: analise?.recomendacao_juridica || null,
    metricas_viabilidade: analise?.metricas_viabilidade || null,
    analise_estruturada: analise || null,
    processado: !!analise
  }
}
