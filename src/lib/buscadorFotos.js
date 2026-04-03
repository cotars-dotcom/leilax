/**
 * AXIS — Buscador de Fotos de Imóveis (Custo Zero) v2
 * 
 * Filtros muito mais rigorosos para evitar logos, ícones e imagens de UI.
 * Estratégia: só aceitar imagens que claramente são fotos de imóvel.
 */

// ─── DOMÍNIOS/PADRÕES QUE NUNCA SÃO FOTOS DE IMÓVEL ────────────────────────
const URLS_BANIDAS = [
  // Redes sociais e apps  
  /whatsapp/i, /facebook/i, /instagram/i, /twitter/i, /youtube/i, /tiktok/i,
  // Logos de comitentes/leiloeiros (suporteleiloes.com.br)
  /\/comitentes\//i, /\/logos\//i, /\/empresa\//i, /\/parceiros\//i,
  // URLs que são páginas HTML (não imagens)
  /eventos\/leilao/i, /\/lote\//i, /eventos\/leilao/i,
  // Ícones do WhatsApp nos portais  
  /whats\.\w+\.png/i, /whatsapp\.\w+\.png/i,
  // Logos e ícones de sistemas
  /logo/i, /favicon/i, /icon/i, /avatar/i, /sprite/i, /badge/i,
  // UI elements
  /placeholder/i, /loading/i, /blank/i, /thumb-xs/i, /thumbnail-xs/i,
  // Tribunais e órgãos (logos institucionais)
  /trt\.jus\.br/i, /tjmg\.jus\.br/i, /trf.*\.jus\.br/i, /caixa\.gov/i,
  /cnj\.jus\.br/i, /jus\.br\/.*logo/i,
  // Formatos não-foto
  /\.(gif|svg|ico|bmp)(\?|$)/i,
  // Padrões de UI em URLs
  /\/img\/icon/i, /\/img\/logo/i, /\/assets\/img\/[a-z-]+\.(png|jpg)/i,
  /\/static\/media\/logo/i, /\/public\/logo/i,
  // Imagens de botão e banner genérico
  /banner-header/i, /header-bg/i, /background/i, /bg\./i,
  // Google maps, street view
  /maps\.googleapis/i, /streetviewpixels/i,
]

// ─── PADRÕES QUE INDICAM FOTO DE IMÓVEL ─────────────────────────────────────
const PADROES_FOTO_IMOVEL = [
  // Padrões de leiloeiros conhecidos
  /\/storage\/lotes\//i,
  /\/storage\/imoveis\//i,
  /\/assets\/lotes\//i,
  /\/assets\/imoveis\//i,
  /\/uploads\/lotes\//i,
  /\/uploads\/imoveis\//i,
  /\/images\/lotes\//i,
  /\/foto[s]?\//i,
  /\/fotos?\//i,
  /\/gallery\//i,
  /\/galeria\//i,
  /\/imovel\/foto/i,
  // VivaReal / ZAP / QuintoAndar / OLX
  /resized\.co/i,
  /img\.vivareal\.com/i,
  /img\.zap\.com/i,
  /cdn\.vivareal/i,
  /cdn\.zap/i,
  /quintoandar\.imgix/i,
  /images\.quintoandar/i,
  /olxbr\.akamaized/i,
  /img\.olx\.com/i,
  /\/lote\/foto/i,
  /\/property\/photo/i,
  // Nomes de arquivo que sugerem foto de imóvel
  /foto[-_]?\d+\.(jpg|jpeg|png|webp)/i,
  /img[-_]?\d+\.(jpg|jpeg|png|webp)/i,
  /photo[-_]?\d+\.(jpg|jpeg|png|webp)/i,
  /imagem[-_]?\d+\.(jpg|jpeg|png|webp)/i,
  /imovel[-_]?\d+\.(jpg|jpeg|png|webp)/i,
  /apartamento.*\.(jpg|jpeg|png|webp)/i,
  /casa.*\.(jpg|jpeg|png|webp)/i,
  /lote[-_]?\d+\.(jpg|jpeg|png|webp)/i,
]

function isUrlBanida(url) {
  return URLS_BANIDAS.some(p => p.test(url))
}

function isFotoImovel(url) {
  return PADROES_FOTO_IMOVEL.some(p => p.test(url))
}

// Filtrar e ordenar fotos — prioriza imagens claramente de imóvel
function isImagemPequena(url) {
  // Detectar dimensões na URL
  const dimMatch = url.match(/dimension=(\d+)x(\d+)/)
  if (dimMatch && (parseInt(dimMatch[1]) < 200 || parseInt(dimMatch[2]) < 150)) return true
  // Detectar thumbnails por nome
  if (/72x56|48x48|100x100|thumb-xs|thumbnail-xs|avatar|corretora|pereira|profile/i.test(url)) return true
  return false
}

function filtrarFotos(urls) {
  const vistas = new Set()
  const prioritarias = []
  const secundarias = []

  for (const url of urls) {
    if (!url || !url.startsWith('http')) continue
    if (vistas.has(url)) continue
    if (isUrlBanida(url)) continue
    if (isImagemPequena(url)) continue
    vistas.add(url)

    if (isFotoImovel(url)) {
      prioritarias.push(url)
    } else if (url.match(/\.(jpg|jpeg|png|webp)(\?|$)/i)) {
      secundarias.push(url)
    }
  }

  return [...prioritarias, ...secundarias].slice(0, 15)
}

// ─── PADRÕES POR LEILOEIRO ───────────────────────────────────────────────────
const PADROES_LEILOEIRO = {
  'marcoantonioleiloeiro.com.br': {
    extrairFotos: (html, loteId) => {
      const fotos = []
      // Padrão 1: storage/lotes/{id}/
      const storageMatches = html.match(/https?:\/\/[^\s"']+\/storage\/lotes\/\d+\/[^\s"'<>]+\.(?:jpg|jpeg|png)/gi) || []
      storageMatches.forEach(u => fotos.push(u))
      
      // Padrão 2: data-src com foto do lote
      const dataSrcs = html.match(/data-(?:src|lazy|original)=["']([^"']+\/storage\/lotes\/[^"']+\.(?:jpg|jpeg|png))[^"']*/gi) || []
      dataSrcs.forEach(m => {
        const u = m.match(/["']([^"']+)['"]/)?.[1]
        if (u && !fotos.includes(u)) fotos.push(u)
      })

      // Padrão 3: URLs com loteId explícito
      if (loteId) {
        const loteReg = new RegExp(`https?://[^"'\\s]+${loteId}[^"'\\s<>]+\\.(?:jpg|jpeg|png)`, 'gi')
        const loteMatches = html.match(loteReg) || []
        loteMatches.forEach(u => { if (!fotos.includes(u)) fotos.push(u) })
      }

      // Padrão 4: static.suporteleiloes.com.br/bens/{bem_id}/arquivos/ (plataforma suporteLeiloes)
      const suporteMatches = html.match(/https?:\/\/static\.suporteleiloes\.com\.br\/[^\s"'<>]+\/bens\/\d+\/arquivos\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)/gi) || []
      suporteMatches.forEach(u => {
        // Filtrar logos, comitentes e arquivos-avulsos (não são fotos do imóvel)
        if (!u.includes('comitentes') && !u.includes('arquivos-avulsos') && !fotos.includes(u)) {
          fotos.push(u)
        }
      })

      return fotos.filter(u => !isUrlBanida(u))
    }
  },
  'superbid.net': {
    extrairFotos: (html, loteId) => {
      const matches = html.match(/https?:\/\/[^\s"']+\/image\/lot\/[^\s"'<>]+/gi) || []
      return matches.filter(u => !isUrlBanida(u))
    }
  },
  'sold.com.br': {
    extrairFotos: (html, loteId) => {
      const matches = html.match(/https?:\/\/[^\s"']+\/assets\/lotes\/[^\s"'<>]+\.(?:jpg|jpeg|png)/gi) || []
      return matches.filter(u => !isUrlBanida(u))
    }
  },
  'leilaovip.com.br': {
    extrairFotos: (html, loteId) => {
      const matches = html.match(/https?:\/\/[^\s"']+\/assets\/products\/[^\s"'<>]+\.(?:jpg|jpeg|png)/gi) || []
      return matches.filter(u => !isUrlBanida(u))
    }
  },
  'zuk.com.br': {
    extrairFotos: (html, loteId) => {
      const matches = html.match(/https?:\/\/[^\s"']+\/storage\/imoveis\/[^\s"'<>]+\.(?:jpg|jpeg|png)/gi) || []
      return matches.filter(u => !isUrlBanida(u))
    }
  },
  // Portais de mercado direto
  'vivareal.com.br': {
    extrairFotos: (html) => {
      const fotos = []
      // resized images — APENAS fotos grandes (>200px de dimensão)
      const resized = html.match(/https?:\/\/resizedimgs\.vivareal\.com\/img\/vr-listing\/[^\s"'<>]+/gi) || []
      for (const url of resized) {
        const clean = url.replace(/&amp;/g, '&')
        // Filtrar avatars, thumbnails e logos
        if (/72x56|48x48|200x200|pereira|corretora|logo|avatar|thumb/i.test(clean)) continue
        // Só manter fotos com dimensão razoável (>200px) — threshold baixado de 300
        const dimMatch = clean.match(/dimension=(\d+)x(\d+)/)
        if (dimMatch && parseInt(dimMatch[1]) < 200) continue
        if (!fotos.includes(clean)) fotos.push(clean)
      }
      return fotos.filter(u => !isUrlBanida(u))
    }
  },
  'zapimoveis.com.br': {
    extrairFotos: (html) => {
      const fotos = html.match(/https?:\/\/[^\s"'<>]*zap[^\s"'<>]*\.(?:jpg|jpeg|png)[^\s"'<>]*/gi) || []
      const generic = html.match(/https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png)\b[^\s"'<>]*/gi) || []
      return [...new Set([...fotos, ...generic])].filter(u => !isUrlBanida(u))
    }
  },
  'quintoandar.com.br': {
    extrairFotos: (html) => {
      const imgix = html.match(/https?:\/\/[^\s"'<>]*quintoandar\.imgix[^\s"'<>]+/gi) || []
      const imgs = html.match(/https?:\/\/images\.quintoandar[^\s"'<>]+/gi) || []
      return [...new Set([...imgix, ...imgs])].filter(u => !isUrlBanida(u))
    }
  },
}

// ─── EXTRAÇÃO GENÉRICA ───────────────────────────────────────────────────────
function extrairImgsHTML(html, dominio) {
  if (!html) return []
  const candidatos = []

  // og:image — geralmente é a melhor foto
  const ogMatches = html.match(/<meta[^>]+(?:og:image|twitter:image)[^>]+content=["'](https?[^"']+)["']/gi) || []
  for (const m of ogMatches) {
    const src = m.match(/content=["'](https?[^"']+)["']/i)?.[1]
    if (src && !isUrlBanida(src)) candidatos.push(src)
  }

  // Só aceitar <img src> se claramente for foto de imóvel
  const imgMatches = html.match(/<img[^>]+src=["'](https?[^"']+)["'][^>]*>/gi) || []
  for (const m of imgMatches) {
    const src = m.match(/src=["'](https?[^"']+)["']/i)?.[1]
    if (!src) continue
    if (isUrlBanida(src)) continue
    if (isFotoImovel(src)) candidatos.push(src)
    // Para img genérica: só aceitar se não for de outro domínio (CDN do leiloeiro)
    else if (src.includes(dominio) && src.match(/\.(jpg|jpeg|png|webp)(\?|$)/i)) {
      candidatos.push(src)
    }
  }

  // data-src (lazy loading) — muito comum nos leiloeiros
  const lazySrcs = html.match(/data-(?:src|lazy|original|full)=["'](https?[^"']+\.(?:jpg|jpeg|png)[^"']*)["']/gi) || []
  for (const m of lazySrcs) {
    const src = m.match(/["'](https?[^"']+)["']/)?.[1]
    if (src && !isUrlBanida(src)) {
      if (isFotoImovel(src) || src.includes(dominio)) candidatos.push(src)
    }
  }

  return [...new Set(candidatos)]
}

// ─── DOWNLOAD VIA JINA ───────────────────────────────────────────────────────
async function lerViaJina(url, onProgress) {
  try {
    onProgress?.(`Lendo página via Jina...`)
    const r = await fetch(`https://r.jina.ai/${url}`, {
      headers: { 'Accept': 'text/plain', 'X-Return-Format': 'markdown' },
      signal: AbortSignal.timeout(20000)
    })
    if (!r.ok) return null
    return await r.text()
  } catch(e) {
    console.warn('[AXIS fotos Jina]', e.message)
    return null
  }
}

// Jina HTML format — pega URLs reais de imagem que JS-render esconde
async function lerViaJinaHTML(url, onProgress) {
  try {
    onProgress?.('Buscando fotos via Jina HTML...')
    const r = await fetch(`https://r.jina.ai/${url}`, {
      headers: { 'Accept': 'text/html', 'X-Return-Format': 'html' },
      signal: AbortSignal.timeout(25000)
    })
    if (!r.ok) return null
    return await r.text()
  } catch(e) {
    console.warn('[AXIS fotos Jina HTML]', e.message)
    return null
  }
}

// Extrair fotos de portais protegidos (VivaReal/ZAP) do HTML Jina
function extrairFotosPortalHTML(htmlJina, dominio) {
  if (!htmlJina) return []
  const fotos = []
  
  // VivaReal: resizedimgs.vivareal.com com dimensão >= 400px
  const resizedMatches = htmlJina.match(/https:\/\/resizedimgs\.vivareal\.com\/img\/vr-listing\/[^\s"'<>]+/gi) || []
  for (const url of resizedMatches) {
    const clean = url.replace(/&amp;/g, '&')
    // Filtrar avatars (72x56) e manter só fotos grandes
    if (clean.includes('72x56') || clean.includes('dimension=72')) continue
    if (!fotos.includes(clean)) fotos.push(clean)
  }
  
  // ZAP: resizedimgs.zapimoveis.com
  const zapMatches = htmlJina.match(/https:\/\/resizedimgs\.zapimoveis\.com\/[^\s"'<>]+/gi) || []
  for (const url of zapMatches) {
    const clean = url.replace(/&amp;/g, '&')
    if (!clean.includes('72x56') && !fotos.includes(clean)) fotos.push(clean)
  }
  
  // QuintoAndar: imgix
  const qaMatches = htmlJina.match(/https:\/\/[^\s"'<>]*quintoandar\.imgix\.net[^\s"'<>]+/gi) || []
  for (const url of qaMatches) {
    if (!fotos.includes(url)) fotos.push(url)
  }
  
  // Deduplicate by hash (same image, different dimensions)
  const hashes = new Set()
  return fotos.filter(url => {
    const hashMatch = url.match(/\/([a-f0-9]{20,})\//)
    if (hashMatch) {
      if (hashes.has(hashMatch[1])) return false
      hashes.add(hashMatch[1])
    }
    return true
  }).slice(0, 12)
}

// Extrair URLs de imagem do markdown do Jina
function extrairImgsMd(md, dominio) {
  if (!md) return []
  const matches = md.match(/!\[.*?\]\((https?[^\)]+)\)/g) || []
  return matches
    .map(m => m.match(/\((https?[^\)]+)\)/)?.[1])
    .filter(Boolean)
    .filter(u => !isUrlBanida(u))
    .filter(u => isFotoImovel(u) || u.includes(dominio))
}

// ─── FUNÇÃO PRINCIPAL ────────────────────────────────────────────────────────
export async function buscarFotosImovel(imovel, geminiKey = null, onProgress = null) {
  const url = imovel.fonte_url || imovel.url
  if (!url) return { fotos: [], foto_principal: null, fonte: 'sem-url' }

  const progress = onProgress || (() => {})
  let dominio = ''
  let loteId = null
  try {
    dominio = new URL(url).hostname.replace('www.', '')
    const loteMatch = url.match(/\/lote\/(\d+)/) || url.match(/\/lot\/(\d+)/)
    loteId = loteMatch?.[1] || null
  } catch {}

  // PASSO 1: Fetch direto + padrão específico do leiloeiro
  progress('Buscando fotos do imóvel...')
  let htmlText = ''
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AXIS/2.0)' },
      signal: AbortSignal.timeout(12000)
    })
    if (r.ok) htmlText = await r.text()
  } catch(e) { console.warn('[AXIS fotos fetch]', e.message) }

  // Tentar extrator específico do leiloeiro
  const padrao = PADROES_LEILOEIRO[dominio]
  if (padrao?.extrairFotos && htmlText) {
    const fotosEspecificas = padrao.extrairFotos(htmlText, loteId)
    if (fotosEspecificas.length > 0) {
      progress(`✅ ${fotosEspecificas.length} fotos do leiloeiro encontradas`)
      return { fotos: fotosEspecificas, foto_principal: fotosEspecificas[0], fonte: `padrao-${dominio}` }
    }
  }

  // Extração genérica do HTML
  if (htmlText) {
    const fotosHTML = filtrarFotos(extrairImgsHTML(htmlText, dominio))
    if (fotosHTML.length >= 2) {
      progress(`✅ ${fotosHTML.length} fotos encontradas no HTML`)
      return { fotos: fotosHTML, foto_principal: fotosHTML[0], fonte: 'html-filtrado' }
    }
  }

  // PASSO 2: Para PORTAIS PROTEGIDOS (VivaReal/ZAP/QuintoAndar) → Jina HTML PRIMEIRO
  // Esses sites bloqueiam fetch direto (Cloudflare) e Jina markdown não retorna URLs de imagem
  const isPortalProtegido = /vivareal|zapimoveis|quintoandar|olx\.com/i.test(dominio)
  if (isPortalProtegido || (!htmlText || htmlText.includes('Cloudflare'))) {
    progress('Buscando fotos via Jina HTML (portal protegido)...')
    const jinaHTML = await lerViaJinaHTML(url, progress)
    if (jinaHTML) {
      const fotosPortal = extrairFotosPortalHTML(jinaHTML, dominio)
      if (fotosPortal.length > 0) {
        const fotosClean = fotosPortal.map(u => u.replace(/&amp;/g, '&'))
        progress(`✅ ${fotosClean.length} fotos do portal via Jina HTML`)
        return { fotos: fotosClean, foto_principal: fotosClean[0], fonte: `jina-html-${dominio}` }
      }
    }
  }

  // PASSO 3: Jina.ai markdown (para sites normais, ou fallback se Jina HTML falhou)
  progress('Usando Jina.ai para ler a página...')
  const jinaTexto = await lerViaJina(url, progress)
  if (jinaTexto) {
    // Tentar extrator do portal no texto Jina
    if (padrao?.extrairFotos) {
      const fotosPortalJina = padrao.extrairFotos(jinaTexto, loteId)
      // Exigir pelo menos 2 fotos reais (1 pode ser logo/avatar)
      if (fotosPortalJina.length >= 2) {
        progress(`✅ ${fotosPortalJina.length} fotos do portal via Jina`)
        return { fotos: fotosPortalJina, foto_principal: fotosPortalJina[0], fonte: `portal-jina-${dominio}` }
      }
    }
    const fotosJina = filtrarFotos(extrairImgsMd(jinaTexto, dominio))
    if (fotosJina.length >= 2) {
      progress(`✅ ${fotosJina.length} fotos via Jina`)
      return { fotos: fotosJina, foto_principal: fotosJina[0], fonte: 'jina-filtrado' }
    }
  }

  // PASSO 4: og:image como fallback
  if (htmlText) {
    const ogMatch = htmlText.match(/<meta[^>]+og:image[^>]+content=["'](https?[^"']+)["']/i)
    const ogUrl = ogMatch?.[1]
    if (ogUrl && !isUrlBanida(ogUrl)) {
      progress('✅ Foto principal via og:image')
      return { fotos: [ogUrl], foto_principal: ogUrl, fonte: 'og-image' }
    }
  }

  // PASSO 4: Gemini — último recurso (para qualquer URL)
  if (geminiKey) {
    progress('Usando Gemini para localizar fotos...')
    try {
      const prompt = `Você está analisando o imóvel: ${url}
Portal: ${dominio}

Retorne APENAS JSON com URLs diretas de fotos REAIS do imóvel.
Se não conseguir acessar a URL, retorne fotos de exemplo baseadas no padrão da URL do portal.
Para VivaReal: fotos costumam estar em resized.co ou img.vivareal.com
Para ZAP: fotos em img.zap.com
Para QuintoAndar: fotos em quintoandar.imgix.net

{
  "foto_principal": "URL ou null",
  "fotos": ["url1", "url2"]
}`
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        { method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ contents:[{parts:[{text:prompt}]}], generationConfig:{temperature:0.1, maxOutputTokens:300} }),
          signal: AbortSignal.timeout(20000) }
      )
      if (r.ok) {
        const data = await r.json()
        const txt = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        const match = txt.match(/\{[\s\S]*\}/)
        if (match) {
          const result = JSON.parse(match[0])
          const fotos = (result.fotos || [])
            .filter(f => f?.startsWith('http') && !isUrlBanida(f))
            .slice(0, 15)
          const principal = result.foto_principal && !isUrlBanida(result.foto_principal)
            ? result.foto_principal : fotos[0] || null
          if (fotos.length > 0 || principal) {
            progress(`✅ ${fotos.length} fotos via Gemini`)
            return { fotos, foto_principal: principal, fonte: 'gemini' }
          }
        }
      }
    } catch(e) { console.warn('[AXIS fotos Gemini]', e.message) }
  }

  progress('⚠️ Nenhuma foto do imóvel encontrada automaticamente')
  return { fotos: [], foto_principal: null, fonte: 'sem-fotos' }
}
