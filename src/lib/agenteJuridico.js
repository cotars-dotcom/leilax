/**
 * AXIS — Agente Jurídico Autônomo
 * 
 * Faz download automático de edital e matrícula (RGI) via Jina.ai,
 * analisa com Gemini Flash-Lite, identifica riscos, e re-pontua score_juridico.
 * Custo: ~R$ 0,01 por análise completa (zero se só regex)
 */

import { RISCOS_JURIDICOS } from '../data/riscos_juridicos.js'

// ─── DOWNLOAD DE DOCUMENTOS VIA JINA ────────────────────────────────────────

export async function baixarDocumentoJina(url) {
  if (!url) return null
  try {
    // Para PDFs: Jina extrai texto diretamente
    const jinaUrl = `https://r.jina.ai/${url}`
    const r = await fetch(jinaUrl, {
      headers: { 'Accept': 'text/plain', 'X-Return-Format': 'text' },
      signal: AbortSignal.timeout(30000)
    })
    if (!r.ok) return null
    const texto = await r.text()
    return texto.length > 100 ? texto : null
  } catch(e) {
    console.warn('[AXIS jurídico] Jina download:', e.message)
    return null
  }
}

// ─── EXTRAÇÃO DE LINKS DO EDITAL ────────────────────────────────────────────

export function extrairLinksDocumentos(textoHtml, urlBase) {
  const links = { edital: null, matricula: null, outros: [] }
  if (!textoHtml) return links

  const padroes = [
    { campo: 'edital', regex: /href=["']([^"']+(?:edital|edital-de-leilao|licitacao)[^"']*\.pdf[^"']*)['"]/gi },
    { campo: 'matricula', regex: /href=["']([^"']+(?:matricula|registro|rgi|certidao)[^"']*\.pdf[^"']*)['"]/gi },
    { campo: 'outros', regex: /href=["']([^"']+(?:documento|certidao|processo)[^"']*\.pdf[^"']*)['"]/gi },
  ]

  for (const { campo, regex } of padroes) {
    let match
    while ((match = regex.exec(textoHtml)) !== null) {
      const url = match[1].startsWith('http') ? match[1] : `${urlBase}${match[1]}`
      if (campo === 'outros') links.outros.push(url)
      else if (!links[campo]) links[campo] = url
    }
  }
  return links
}

// ─── ANÁLISE COM GEMINI ──────────────────────────────────────────────────────

const RISCOS_REFERENCIA = RISCOS_JURIDICOS.map(r =>
  `- ${r.risco_id} (${r.categoria}): penalização ${r.score_penalizacao}pts, prazo ${r.prazo_pratico_meses_min}-${r.prazo_pratico_meses_max}m`
).join('\n')

export async function analisarTextoJuridicoGemini(texto, nomeArq, imovel, geminiKey) {
  if (!texto || !geminiKey) return null

  const prompt = `Você é especialista em direito imobiliário e leilões judiciais no Brasil (Minas Gerais).

DOCUMENTO: ${nomeArq}
IMÓVEL: ${imovel.titulo || imovel.endereco || 'Não informado'}
MODALIDADE: ${imovel.modalidade_leilao || 'judicial'}
PROCESSOS CONHECIDOS: ${imovel.processos_ativos || 'Nenhum'}

TEXTO DO DOCUMENTO (primeiros 6000 chars):
${texto.substring(0, 6000)}

BASE DE RISCOS DO SISTEMA AXIS:
${RISCOS_REFERENCIA}

Analise juridicamente este documento e retorne APENAS JSON válido:
{
  "tipo_documento": "edital|matricula|processo|certidao|outro",
  "resumo": "string — 2-3 linhas do que o documento diz",
  "riscos_identificados": [
    {
      "risco_id": "string — usar IDs da base acima quando aplicável",
      "descricao": "string — o que foi encontrado",
      "gravidade": "critico|alto|medio|baixo",
      "trecho_relevante": "string — trecho do documento que evidencia o risco",
      "impacto_score": -15
    }
  ],
  "pontos_positivos": ["string"],
  "alertas_criticos": ["string — ações necessárias antes do lance"],
  "score_juridico_sugerido": 7.0,
  "score_juridico_delta": -1.5,
  "responsabilidade_debitos": "sub_rogado|arrematante|exonerado",
  "ocupacao_confirmada": "desocupado|ocupado|incerto|null",
  "prazo_liberacao_meses": 0,
  "recomendacao_juridica": "favoravel|neutro|desfavoravel",
  "parecer": "string — parecer jurídico completo em 3-5 linhas"
}`

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${geminiKey}`,
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
Retorne APENAS JSON com os campos: tipo_documento, resumo, riscos_identificados (array com risco_id/descricao/gravidade/impacto_score), pontos_positivos, alertas_criticos, score_juridico_sugerido, score_juridico_delta, recomendacao_juridica, parecer.`

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: 'application/pdf', data: base64 } },
              { text: prompt }
            ]
          }],
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

// ─── BUSCA AUTOMÁTICA DE DOCUMENTOS DA URL DO IMÓVEL ────────────────────────

export async function buscarDocumentosAuto(imovel, geminiKey, onProgress) {
  const progress = onProgress || (() => {})
  const url = imovel.fonte_url || imovel.url
  if (!url) return { documentos: [], links: {} }

  progress('Buscando documentos na página do edital...')

  // Buscar HTML da página
  let htmlTexto = ''
  let links = {}
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(12000)
    })
    if (r.ok) {
      htmlTexto = await r.text()
      const urlBase = new URL(url).origin
      links = extrairLinksDocumentos(htmlTexto, urlBase)
    }
  } catch(e) { console.warn('[AXIS jurídico] HTML:', e.message) }

  // Se não achou links por HTML, tentar Jina para extrair links
  if (!links.edital && !links.matricula) {
    try {
      const jinaTexto = await baixarDocumentoJina(url)
      if (jinaTexto) {
        // Procurar padrões de PDF no texto
        const pdfMatches = jinaTexto.match(/https?:[^\s"']+\.pdf[^\s"')>]*/gi) || []
        for (const pdfUrl of pdfMatches) {
          const lower = pdfUrl.toLowerCase()
          if (lower.includes('edital') && !links.edital) links.edital = pdfUrl
          else if ((lower.includes('matricula') || lower.includes('rgi')) && !links.matricula) links.matricula = pdfUrl
          else links.outros = [...(links.outros || []), pdfUrl]
        }
      }
    } catch(e) {}
  }

  progress(`Links encontrados: edital=${!!links.edital} matrícula=${!!links.matricula}`)

  // Baixar e analisar cada documento
  const resultados = []

  const docsParaBaixar = [
    links.edital && { url: links.edital, nome: 'Edital', tipo: 'edital' },
    links.matricula && { url: links.matricula, nome: 'Matrícula RGI', tipo: 'matricula' },
    ...(links.outros || []).slice(0, 2).map((u, i) => ({ url: u, nome: `Documento ${i+1}`, tipo: 'outro' }))
  ].filter(Boolean)

  for (const doc of docsParaBaixar) {
    progress(`Baixando ${doc.nome}...`)
    const texto = await baixarDocumentoJina(doc.url)
    if (texto) {
      progress(`Analisando ${doc.nome} com IA...`)
      const analise = await analisarTextoJuridicoGemini(texto, doc.nome, imovel, geminiKey)
      resultados.push({ ...doc, texto: texto.substring(0, 5000), analise })
    }
  }

  return { documentos: resultados, links }
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
