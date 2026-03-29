/**
 * AXIS — Agente Jurídico Autônomo v2
 * 
 * Download automático de documentos (edital, matrícula, processos)
 * via Jina.ai (evita CORS + lê PDFs nativamente).
 * Análise jurídica completa com Gemini Flash.
 * Custo: ~R$ 0,02 por análise completa.
 */

async function _getRiscos() {
  try {
    const { getRiscosJuridicos } = await import('./supabase.js')
    const d = await getRiscosJuridicos()
    if (d && d.length > 0) return d
  } catch(e) {}
  const { RISCOS_JURIDICOS } = await import('../data/riscos_juridicos.js')
  return RISCOS_JURIDICOS
}

// ─── PADRÕES ESPECÍFICOS POR LEILOEIRO ──────────────────────────────────────

const PADROES_LEILOEIRO = {
  'marcoantonioleiloeiro.com.br': {
    // Marco Antônio: edital fica em /storage/eventos/{eventoId}/edital.pdf
    // Matrícula: link com texto "matrícula" ou "RGI"
    extrairLinks: (html, url) => {
      const links = []
      // Padrão 1: /storage/eventos/*/edital*
      const editais = html.match(/\/storage\/eventos\/[^"'\s]+(?:edital|edital_leilao)[^"'\s]*\.pdf/gi) || []
      editais.forEach(l => links.push({ url: `https://www.marcoantonioleiloeiro.com.br${l}`, tipo: 'edital', nome: 'Edital de Leilão' }))
      // Padrão 2: PDFs em href (HTML padrão)
      const pdfs = html.match(/href=["']([^"']+\.pdf[^"']*)['"]/gi) || []
      pdfs.forEach(m => {
        const href = m.replace(/href=["']/i, '').replace(/["']$/, '')
        const fullUrl = href.startsWith('http') ? href : `https://www.marcoantonioleiloeiro.com.br${href}`
        if (!links.find(l => l.url === fullUrl)) {
          const nome = href.toLowerCase()
          const tipo = nome.includes('edital') ? 'edital'
            : nome.includes('matri') || nome.includes('rgi') ? 'matricula'
            : nome.includes('process') ? 'processo' : 'documento'
          links.push({ url: fullUrl, tipo, nome: tipo.charAt(0).toUpperCase() + tipo.slice(1) })
        }
      })
      // Padrão 3: PDFs em formato Markdown [texto](url.pdf) — formato retornado pelo Jina com X-Return-Format:markdown
      // Captura [Edital](https://...pdf) e [Matricula 53.105.pdf](https://...pdf)
      // IMPORTANTE: URL pode não ter .pdf no final se for redirect — também capturar por nome
      const mdRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+(?:\.pdf|storage[^)]+))\)/gi
      let mdMatch
      while ((mdMatch = mdRegex.exec(html)) !== null) {
        const nomeReal = mdMatch[1].replace(/\.pdf$/i, '').trim()
        const fullUrl = mdMatch[2]
        if (!links.find(l => l.url === fullUrl)) {
          const nomeLower = (nomeReal + fullUrl).toLowerCase()
          const tipo = nomeLower.includes('edital') ? 'edital'
            : nomeLower.includes('matri') || nomeLower.includes('rgi') ? 'matricula'
            : nomeLower.includes('process') ? 'processo'
            : nomeLower.includes('certid') ? 'certidao' : 'documento'
          links.push({ url: fullUrl, tipo, nome: nomeReal || tipo })
        }
      }
      // Padrão 4: URLs diretas do storage suporteleiloes.com.br (sem markdown)
      const storageLinks = html.match(/https?:\/\/static\.suporteleiloes\.com\.br\/[^\s"'\)\]]+\.pdf/gi) || []
      storageLinks.forEach(u => {
        if (!links.find(l => l.url === u)) {
          const nomeLower = u.toLowerCase()
          const tipo = nomeLower.includes('edital') ? 'edital'
            : nomeLower.includes('matri') ? 'matricula'
            : 'documento'
          links.push({ url: u, tipo, nome: tipo.charAt(0).toUpperCase() + tipo.slice(1) })
        }
      })
      return links
    }
  },
  'superbid.net': {
    extrairLinks: (html, url) => {
      const links = []
      const pdfs = html.match(/https?:\/\/[^"'\s]+\.pdf[^"'\s]*/gi) || []
      pdfs.forEach(u => links.push({ url: u, tipo: 'documento', nome: 'Documento Superbid' }))
      return links
    }
  },
  'sold.com.br': {
    extrairLinks: (html, url) => {
      const links = []
      const pdfs = html.match(/href=["']([^"']+\.pdf)['"]/gi) || []
      pdfs.forEach(m => {
        const href = m.replace(/href=["']/i, '').replace(/["']$/, '')
        const fullUrl = href.startsWith('http') ? href : `https://www.sold.com.br${href}`
        links.push({ url: fullUrl, tipo: 'documento', nome: 'Documento SOLD' })
      })
      return links
    }
  }
}

// ─── EXTRAÇÃO GENÉRICA DE LINKS ──────────────────────────────────────────────

function extrairTodosOsLinks(html, urlBase) {
  const links = []
  if (!html) return links

  // Capturar TODOS os hrefs de PDF — sem filtrar por nome
  const hrefPdfs = html.match(/href=["']([^"']+\.pdf[^"']*)['"]/gi) || []
  for (const m of hrefPdfs) {
    const href = m.match(/href=["']([^"']+)['"]/i)?.[1]
    if (!href) continue
    const fullUrl = href.startsWith('http') ? href
      : href.startsWith('/') ? `${urlBase}${href}`
      : `${urlBase}/${href}`
    const nomeLower = fullUrl.toLowerCase()
    const tipo = nomeLower.includes('edital') ? 'edital'
      : nomeLower.includes('matri') || nomeLower.includes('rgi') || nomeLower.includes('registro') ? 'matricula'
      : nomeLower.includes('process') || nomeLower.includes('certid') ? 'processo'
      : 'documento'
    if (!links.find(l => l.url === fullUrl)) {
      links.push({ url: fullUrl, tipo, nome: tipo.charAt(0).toUpperCase() + tipo.slice(1) })
    }
  }

  // Capturar URLs de PDF em texto puro (data-*, onclick, etc.)
  const urlPdfs = html.match(/https?:\/\/[^\s"'<>]+\.pdf[^\s"'<>]*/gi) || []
  for (const u of urlPdfs) {
    if (!links.find(l => l.url === u)) {
      const nomeLower = u.toLowerCase()
      const tipo = nomeLower.includes('edital') ? 'edital'
        : nomeLower.includes('matri') || nomeLower.includes('rgi') ? 'matricula'
        : 'documento'
      links.push({ url: u, tipo, nome: tipo.charAt(0).toUpperCase() + tipo.slice(1) })
    }
  }

  return links
}

// ─── DOWNLOAD VIA JINA.AI (evita CORS, lê PDFs) ─────────────────────────────

export async function baixarViaJina(url, onProgress) {
  try {
    onProgress?.(`Jina lendo: ${url.split('/').pop().substring(0, 40)}`)
    const jinaUrl = `https://r.jina.ai/${url}`
    // Usar markdown para capturar links completos [texto](url) — essencial para Marco Antônio
    const r = await fetch(jinaUrl, {
      headers: {
        'Accept': 'text/plain',
        'X-Return-Format': 'markdown',
        'X-Timeout': '25'
      },
      signal: AbortSignal.timeout(30000)
    })
    if (!r.ok) return null
    const texto = await r.text()
    return texto.length > 50 ? texto : null
  } catch(e) {
    console.warn('[AXIS Jina]', e.message)
    return null
  }
}

// ─── BUSCA AUTOMÁTICA COMPLETA ───────────────────────────────────────────────

export async function buscarDocumentosAuto(imovel, geminiKey, onProgress) {
  const progress = onProgress || (() => {})
  const url = imovel.fonte_url || imovel.url
  if (!url) return { documentos: [], links: [] }

  let dominio = ''
  try { dominio = new URL(url).hostname.replace('www.', '') } catch {}

  // PASSO 1: Ler a página via Jina (evita CORS, funciona em todos os leiloeiros)
  progress('Lendo página do edital via Jina...')
  const htmlTexto = await baixarViaJina(url, progress)

  // PASSO 2: Extrair links — usar padrão específico do leiloeiro ou genérico
  progress('Identificando documentos disponíveis...')
  let linksEncontrados = []

  const padrao = PADROES_LEILOEIRO[dominio]
  if (padrao?.extrairLinks && htmlTexto) {
    linksEncontrados = padrao.extrairLinks(htmlTexto, `https://${dominio}`)
  }

  if (linksEncontrados.length === 0 && htmlTexto) {
    const urlBase = `https://${dominio}`
    linksEncontrados = extrairTodosOsLinks(htmlTexto, urlBase)
  }

  // PASSO 3: Se ainda nada, usar Gemini para identificar links na página
  if (linksEncontrados.length === 0 && geminiKey && htmlTexto) {
    progress('Usando Gemini para identificar documentos...')
    try {
      const prompt = `Analise este HTML de uma página de leilão judicial e extraia APENAS URLs de PDF de documentos jurídicos (edital, matrícula, certidões, processos).

URL da página: ${url}

HTML (primeiros 8000 chars):
${htmlTexto.substring(0, 8000)}

Retorne APENAS JSON:
{
  "documentos": [
    {"url": "URL completa do PDF", "tipo": "edital|matricula|processo|certidao|outro", "nome": "nome descritivo"}
  ]
}`
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        { method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ contents:[{parts:[{text:prompt}]}], generationConfig:{temperature:0.1, maxOutputTokens:1024} }),
          signal: AbortSignal.timeout(30000) }
      )
      if (r.ok) {
        const data = await r.json()
        const txt = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        const match = txt.replace(/```json|```/g,'').trim().match(/\{[\s\S]*\}/)
        if (match) {
          const result = JSON.parse(match[0])
          linksEncontrados = result.documentos || []
        }
      }
    } catch(e) { console.warn('[AXIS Gemini links]', e.message) }
  }

  progress(`${linksEncontrados.length} documento(s) identificado(s)`)

  // PASSO 4: Priorizar edital e matrícula, limitar a 4 docs
  const prioridade = ['edital', 'matricula', 'processo', 'certidao', 'documento', 'outro']
  linksEncontrados.sort((a, b) => prioridade.indexOf(a.tipo) - prioridade.indexOf(b.tipo))
  const docsParaBaixar = linksEncontrados.slice(0, 4)

  if (docsParaBaixar.length === 0) {
    progress('⚠️ Nenhum documento encontrado. Tente upload manual.')
    return { documentos: [], links: linksEncontrados }
  }

  // PASSO 5: Baixar e analisar cada documento
  const resultados = []
  for (const doc of docsParaBaixar) {
    progress(`Baixando ${doc.nome || doc.tipo}...`)
    const texto = await baixarViaJina(doc.url, progress)
    if (!texto) {
      progress(`⚠️ Não foi possível ler ${doc.nome}`)
      continue
    }
    progress(`Analisando ${doc.nome} com Gemini...`)
    const analise = await analisarTextoJuridicoGemini(texto, doc.nome || doc.tipo, imovel, geminiKey)
    resultados.push({ ...doc, texto: texto.substring(0, 5000), analise })
  }

  return { documentos: resultados, links: linksEncontrados }
}

// ─── ANÁLISE JURÍDICA COM GEMINI ──────────────────────────────────────────────

// RISCOS_REFERENCIA gerado async dentro de analisarTextoJuridicoGemini

export async function analisarTextoJuridicoGemini(texto, nomeArq, imovel, geminiKey) {
  if (!texto || !geminiKey) return null

  const RISCOS_ATUAL = await _getRiscos()
  const RISCOS_REFERENCIA = RISCOS_ATUAL.map(r =>
    `- ${r.risco_id||r.id||'risco'} (${r.categoria||'juridico'}): -${Math.abs(r.score_penalizacao||10)}pts, prazo ${r.prazo_min_meses||r.prazo_pratico_meses_min||0}-${r.prazo_max_meses||r.prazo_pratico_meses_max||24}m`
  ).join('\n')

  const prompt = `Você é especialista em direito imobiliário e leilões judiciais no Brasil (Minas Gerais).

DOCUMENTO: ${nomeArq}
IMÓVEL: ${imovel.titulo || imovel.endereco || 'Não informado'}
MODALIDADE: ${imovel.modalidade_leilao || 'judicial'}
PROCESSOS CONHECIDOS: ${imovel.processos_ativos || 'Nenhum'}

TEXTO DO DOCUMENTO (primeiros 6000 chars):
${texto.substring(0, 6000)}

JURIMETRIA DAS VARAS BH (estimativa de prazo):
- TRT-3 geral: 90d | TRT-3 Penhora: 240d | Extrajudicial Caixa: 90d
- TJMG Cível Imissão: 180d | TJMG Geral: 270d | TJMG Fiscal: 360d

BASE DE RISCOS DO SISTEMA AXIS:
${RISCOS_REFERENCIA}

Analise juridicamente este documento e retorne APENAS JSON válido (sem markdown):
{
  "tipo_documento": "edital|matricula|processo|certidao|outro",
  "resumo": "2-3 linhas do que o documento diz",
  "riscos_identificados": [
    {
      "risco_id": "ID da base de riscos ou descritivo",
      "descricao": "o que foi encontrado",
      "gravidade": "critico|alto|medio|baixo",
      "trecho_relevante": "trecho do documento",
      "impacto_score": -10
    }
  ],
  "pontos_positivos": ["string"],
  "alertas_criticos": ["ação necessária antes do lance"],
  "score_juridico_sugerido": 7.0,
  "score_juridico_delta": -1.0,
  "responsabilidade_debitos": "sub_rogado|arrematante|exonerado",
  "ocupacao_confirmada": "desocupado|ocupado|incerto",
  "prazo_liberacao_meses": 0,
  "recomendacao_juridica": "favoravel|neutro|desfavoravel",
  "parecer": "parecer jurídico completo em 3-5 linhas"
}`

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 2048 }
        }),
        signal: AbortSignal.timeout(45000)
      }
    )
    if (!r.ok) throw new Error(`Gemini ${r.status}`)
    const data = await r.json()
    const txt = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const match = txt.replace(/```json|```/g, '').trim().match(/\{[\s\S]*\}/)
    if (!match) throw new Error('JSON inválido')
    return JSON.parse(match[0])
  } catch(e) {
    console.warn('[AXIS jurídico] Gemini análise:', e.message)
    return null
  }
}

// ─── ANÁLISE DE PDF VIA BASE64 COM GEMINI ────────────────────────────────────

export async function analisarPDFBase64Gemini(base64, nomeArq, imovel, geminiKey) {
  if (!base64 || !geminiKey) return null

  const prompt = `Você é especialista em direito imobiliário no Brasil.
Analise este documento jurídico (${nomeArq}) do imóvel: ${imovel.titulo || imovel.endereco || ''}

Identifique riscos, processos, dívidas e situação jurídica.
Retorne APENAS JSON com: tipo_documento, resumo, riscos_identificados (array com risco_id/descricao/gravidade/impacto_score), pontos_positivos, alertas_criticos, score_juridico_sugerido, score_juridico_delta, recomendacao_juridica, parecer.`

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [
            { inline_data: { mime_type: 'application/pdf', data: base64 } },
            { text: prompt }
          ]}],
          generationConfig: { temperature: 0.1, maxOutputTokens: 2048 }
        }),
        signal: AbortSignal.timeout(60000)
      }
    )
    if (!r.ok) throw new Error(`Gemini PDF ${r.status}`)
    const data = await r.json()
    const txt = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const match = txt.replace(/```json|```/g, '').trim().match(/\{[\s\S]*\}/)
    if (!match) throw new Error('JSON inválido')
    return JSON.parse(match[0])
  } catch(e) {
    console.warn('[AXIS jurídico] Gemini PDF:', e.message)
    return null
  }
}

// ─── CALCULAR NOVO SCORE JURÍDICO ────────────────────────────────────────────

export function calcularNovoScoreJuridico(scoreAtual, analises) {
  let delta = 0
  const riscos = []

  for (const analise of analises) {
    if (!analise?.riscos_identificados) continue
    for (const risco of analise.riscos_identificados) {
      delta += risco.impacto_score || 0
      riscos.push(risco)
    }
  }

  const novoScore = Math.max(0, Math.min(10, (scoreAtual || 7) + delta / 10))
  return { novoScore: parseFloat(novoScore.toFixed(1)), delta, riscos }
}
