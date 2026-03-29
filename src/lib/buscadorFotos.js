/**
 * AXIS — Buscador de Fotos de Imóveis (Custo Zero)
 * 
 * Estratégia em cascata:
 * 1. Extração direta do HTML via fetch (zero custo)
 * 2. Padrões conhecidos por leiloeiro (zero custo)  
 * 3. Jina.ai reader para parsear página (zero custo)
 * 4. Gemini Flash-Lite como último recurso (~$0.001)
 */

// Padrões de URL de imagens por leiloeiro
const PADROES_LEILOEIRO = {
  'marcoantonioleiloeiro.com.br': (loteId) => [
    `https://marcoantonioleiloeiro.com.br/storage/lotes/${loteId}/foto1.jpg`,
    `https://marcoantonioleiloeiro.com.br/storage/lotes/${loteId}/foto2.jpg`,
    `https://marcoantonioleiloeiro.com.br/storage/lotes/${loteId}/foto3.jpg`,
    `https://marcoantonioleiloeiro.com.br/storage/lotes/${loteId}/foto4.jpg`,
  ],
  'zuk.com.br': (loteId) => [
    `https://zuk.com.br/storage/imoveis/${loteId}/foto_1.jpg`,
    `https://zuk.com.br/storage/imoveis/${loteId}/foto_2.jpg`,
  ],
  'sold.com.br': (loteId) => [
    `https://sold.com.br/assets/lotes/${loteId}/1.jpg`,
    `https://sold.com.br/assets/lotes/${loteId}/2.jpg`,
  ],
  'superbid.net': (loteId) => [
    `https://superbid.net/image/lot/${loteId}/0`,
    `https://superbid.net/image/lot/${loteId}/1`,
    `https://superbid.net/image/lot/${loteId}/2`,
  ],
}

// Extrair IDs e domínio da URL
function parsearURL(url) {
  try {
    const u = new URL(url)
    const dominio = u.hostname.replace('www.', '')
    const loteMatch = url.match(/\/lote\/(\d+)/) || url.match(/\/lot\/(\d+)/) || url.match(/\/imovel\/(\d+)/)
    const loteId = loteMatch?.[1] || null
    return { dominio, loteId, pathname: u.pathname }
  } catch { return { dominio: '', loteId: null, pathname: '' } }
}

// Verificar se URL de imagem é válida (HEAD request)
async function verificarImagem(url) {
  try {
    const r = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(3000) })
    return r.ok && (r.headers.get('content-type') || '').startsWith('image/')
  } catch { return false }
}

// Extrair imagens do HTML
function extrairImgsHTML(html, baseUrl) {
  if (!html) return []
  const imgs = []
  
  // og:image (melhor qualidade)
  const ogMatches = html.match(/<meta[^>]+(?:og:image|twitter:image)[^>]+content=['"](https?[^'"]+)['"]/gi) || []
  for (const m of ogMatches) {
    const src = m.match(/content=['"](https?[^'"]+)['"]/i)?.[1]
    if (src && !imgs.includes(src)) imgs.push(src)
  }

  // img src — filtrar miniaturas e ícones
  const imgMatches = html.match(/<img[^>]+src=['"](https?[^'"]+)['"]/gi) || []
  for (const m of imgMatches) {
    const src = m.match(/src=['"](https?[^'"]+)['"]/i)?.[1]
    if (!src) continue
    // Ignorar ícones, logos e miniaturas pequenas
    if (src.match(/icon|logo|thumb-xs|avatar|sprite|placeholder|loading|blank/i)) continue
    if (src.match(/\.(gif|svg|ico)(\?|$)/i)) continue
    // Priorizar imagens que parecem de imóveis
    const ehFotoImovel = src.match(/foto|lote|imovel|property|image|photo|img\d/i)
    if (ehFotoImovel && !imgs.includes(src)) imgs.push(src)
  }

  // data-src (lazy load)
  const lazySrcs = html.match(/data-(?:src|lazy|original)=['"](https?[^'"\.][^'"]*\.(?:jpg|jpeg|png|webp)[^'"]*)['"]/gi) || []
  for (const m of lazySrcs) {
    const src = m.match(/['"](https?[^'"]+)['"]/)?.[1]
    if (src && !imgs.includes(src)) imgs.push(src)
  }

  return imgs.filter(img => img.startsWith('http')).slice(0, 20)
}

// Extração via Jina.ai (free) — retorna markdown com URLs de imagens
async function extrairViaJina(url) {
  try {
    const jinaUrl = `https://r.jina.ai/${url}`
    const r = await fetch(jinaUrl, {
      headers: { 'Accept': 'text/plain', 'X-Return-Format': 'markdown' },
      signal: AbortSignal.timeout(20000)
    })
    if (!r.ok) return []
    const texto = await r.text()
    // Extrair URLs de imagem do markdown
    const matches = texto.match(/!\[.*?\]\((https?[^\)]+)\)/g) || []
    return matches
      .map(m => m.match(/\((https?[^\)]+)\)/)?.[1])
      .filter(Boolean)
      .filter(u => !u.match(/icon|logo|avatar|sprite/i))
      .slice(0, 20)
  } catch { return [] }
}

// FUNÇÃO PRINCIPAL
export async function buscarFotosImovel(imovel, geminiKey = null, onProgress = null) {
  const url = imovel.fonte_url || imovel.url
  if (!url) return { fotos: [], foto_principal: null, fonte: 'sem-url' }

  const progress = onProgress || (() => {})
  const { dominio, loteId } = parsearURL(url)

  // PASSO 1: Fetch direto do HTML (zero custo)
  progress('Buscando fotos na página do edital...')
  let htmlFotos = []
  let ogImage = null
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AXIS/2.0)' },
      signal: AbortSignal.timeout(12000)
    })
    if (r.ok) {
      const html = await r.text()
      htmlFotos = extrairImgsHTML(html, url)
      const ogMatch = html.match(/<meta[^>]+og:image[^>]+content=['"](https?[^'"]+)['"]/i)
        || html.match(/<meta[^>]+content=['"](https?[^'"]+)['"'][^>]+og:image/i)
      ogImage = ogMatch?.[1] || null
    }
  } catch(e) { console.warn('[AXIS fotos] HTML fetch:', e.message) }

  if (htmlFotos.length >= 3) {
    progress(`✅ ${htmlFotos.length} fotos encontradas na página`)
    const todasFotos = ogImage ? [ogImage, ...htmlFotos.filter(f => f !== ogImage)] : htmlFotos
    return { fotos: todasFotos.slice(0, 15), foto_principal: ogImage || todasFotos[0], fonte: 'html-direto' }
  }

  // PASSO 2: Padrões do leiloeiro (zero custo)
  progress('Tentando padrões conhecidos do leiloeiro...')
  const padraoFn = PADROES_LEILOEIRO[dominio]
  if (padraoFn && loteId) {
    const urlsPadrao = padraoFn(loteId)
    const validas = []
    for (const u of urlsPadrao) {
      if (await verificarImagem(u)) validas.push(u)
    }
    if (validas.length > 0) {
      progress(`✅ ${validas.length} fotos por padrão do leiloeiro`)
      return { fotos: validas, foto_principal: validas[0], fonte: 'padrao-leiloeiro' }
    }
  }

  // PASSO 3: Jina.ai reader (zero custo)
  progress('Usando Jina.ai para ler a página...')
  const jinaFotos = await extrairViaJina(url)
  if (jinaFotos.length >= 2) {
    progress(`✅ ${jinaFotos.length} fotos via Jina.ai`)
    const principal = ogImage || jinaFotos[0]
    return { fotos: jinaFotos.slice(0, 15), foto_principal: principal, fonte: 'jina-ai' }
  }

  // PASSO 4: og:image como foto única (zero custo)
  if (ogImage || htmlFotos.length > 0) {
    const fotos = ogImage ? [ogImage, ...htmlFotos.filter(f => f !== ogImage)] : htmlFotos
    progress(`✅ ${fotos.length} foto(s) encontrada(s) via og:image`)
    return { fotos, foto_principal: fotos[0], fonte: 'og-image' }
  }

  // PASSO 5: Gemini Flash-Lite — último recurso (~$0.001)
  if (geminiKey) {
    progress('Usando Gemini para localizar fotos...')
    try {
      const prompt = `Você está analisando o leilão: ${url}
Domínio: ${dominio} | Lote ID: ${loteId || 'não identificado'}

Retorne APENAS JSON com URLs diretas de imagens do imóvel:
{
  "foto_principal": "URL da foto principal ou null",
  "fotos": ["url1", "url2", "url3"],
  "fonte": "como foram encontradas"
}`
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${geminiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 400 } }),
          signal: AbortSignal.timeout(20000) }
      )
      if (r.ok) {
        const data = await r.json()
        const txt = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        const match = txt.match(/\{[\s\S]*\}/)
        if (match) {
          const result = JSON.parse(match[0])
          const fotos = (result.fotos || []).filter(f => f?.startsWith('http')).slice(0, 15)
          const principal = result.foto_principal || fotos[0] || null
          if (fotos.length > 0 || principal) {
            progress(`✅ ${fotos.length} fotos via Gemini`)
            return { fotos, foto_principal: principal, fonte: 'gemini' }
          }
        }
      }
    } catch(e) { console.warn('[AXIS fotos] Gemini:', e.message) }
  }

  progress('⚠️ Nenhuma foto encontrada automaticamente')
  return { fotos: [], foto_principal: null, fonte: 'sem-fotos' }
}
