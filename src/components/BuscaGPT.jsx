import { useState } from "react";
import { useIsMobile } from "../hooks/useIsMobile.js";
import { MODELOS_GEMINI } from "../lib/constants.js";

const K = {
  bg:"#080B10", s1:"#111620", s2:"#171E2C", bd:"#1C2438",
  teal:"#00E5BB", amb:"#F5A623", red:"#FF4757", grn:"#2ECC71",
  tx:"#DDE4F0", t2:"#8896B0", t3:"#3D4E6A", wh:"#FFFFFF",
  gpt:"#10A37F"
};

const inp = { background:K.s1, border:`1px solid ${K.bd}`, borderRadius:"6px", padding:"10px 14px", color:K.tx, fontSize:"13px", width:"100%", outline:"none" };

async function buscarComGemini(query, geminiKey) {
  const prompt = `Você é um especialista em imóveis em leilão no Brasil com conhecimento de mercado.
Busque imóveis disponíveis em leilão na região: ${query}
Para cada imóvel retorne SOMENTE JSON válido (sem markdown):
{
  "imoveis": [
    {
      "titulo": "Nome do imóvel",
      "link": "URL do leilão",
      "lance_inicial": 0,
      "avaliacao": 0,
      "desconto_pct": 0,
      "area_m2": 0,
      "quartos": 0,
      "bairro": "string",
      "cidade": "string",
      "leiloeiro": "string",
      "data_leilao": "string",
      "modalidade": "judicial|extrajudicial"
    }
  ]
}`
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODELOS_GEMINI[0]}:generateContent?key=${geminiKey}`,
    { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ contents:[{parts:[{text:prompt}]}], generationConfig:{temperature:0.2, maxOutputTokens:2000} }),
      signal: AbortSignal.timeout(40000) }
  )
  if (!r.ok) throw new Error(`Gemini ${r.status}`)
  const data = await r.json()
  const txt = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
  const match = txt.replace(/\`\`\`json|\`\`\`/g,'').trim().match(/\{[\s\S]*\}/)
  if (!match) throw new Error('JSON inválido')
  try { return JSON.parse(match[0]) } catch { return null }
}

async function buscarComGPT(query, openaiKey) {
  const system = `Você é um especialista em imóveis em leilão no Brasil com acesso à internet.
Busque imóveis disponíveis em leilão na região solicitada pelo usuário.
Para cada imóvel encontrado retorne SOMENTE JSON válido (sem markdown) com esta estrutura:
{
  "imoveis": [
    {
      "titulo": "Nome/descrição do imóvel",
      "endereco": "Endereço completo",
      "cidade": "Cidade",
      "estado": "UF",
      "tipo": "Apartamento|Casa|Terreno|Comercial",
      "area_m2": 0,
      "quartos": 0,
      "valor_avaliacao": 0,
      "valor_minimo": 0,
      "desconto_percentual": 0,
      "modalidade": "Leilão SFI|Licitação Aberta|Venda Online",
      "leiloeiro": "",
      "data_leilao": "DD/MM/AAAA",
      "ocupacao": "Desocupado|Ocupado|Desconhecido",
      "financiavel": true,
      "link": "URL do anúncio",
      "fonte": "Portal CAIXA|Sold|Lance Maior|etc"
    }
  ],
  "total_encontrados": 0,
  "regiao_pesquisada": "Cidade/UF"
}
Busque nos portais: venda-imoveis.caixa.gov.br, sold.com.br, lanceimoveisdigital.com.br, zuk.com.br, portalzuk.com.br.
Retorne no mínimo 3 e no máximo 10 imóveis relevantes.`;

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openaiKey}` },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 3000,
      tools: [{ type: "web_search_preview" }],
      tool_choice: "required",
      messages: [
        { role: "system", content: system },
        { role: "user", content: query }
      ]
    })
  });
  if (!r.ok) {
    const err = await r.json();
    throw new Error(err.error?.message || `OpenAI erro ${r.status}`);
  }
  const d = await r.json();
  const txt = d.choices?.[0]?.message?.content || "";
  try { return JSON.parse(txt.replace(/```json|```/g, "").trim()); }
  catch { throw new Error("Falha ao interpretar resposta do ChatGPT."); }
}

export default function BuscaGPT({ onAnalisar }) {
  const isPhone = useIsMobile(480);
  const [cidade, setCidade] = useState("");
  const [tipo, setTipo] = useState("Apartamento");
  const [maxValor, setMaxValor] = useState("");
  const [minDesconto, setMinDesconto] = useState("20");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");
  const [openaiKey, setOpenaiKey] = useState(() => localStorage.getItem("axis-openai-key") || "");
  const geminiKey = localStorage.getItem("axis-gemini-key") || "";
  const [showKey, setShowKey] = useState(false);

  const saveKey = (k) => { setOpenaiKey(k); localStorage.setItem("axis-openai-key", k); };

  const buscar = async () => {
    if (!cidade.trim()) { setError("Informe a cidade"); return; }
    const geminiKey = localStorage.getItem("axis-gemini-key") || ""
    if (!openaiKey.trim() && !geminiKey) { setError("Configure a API Key do ChatGPT ou Gemini"); setShowKey(true); return; }
    // Verificar permissão de uso da API
    try {
      const { supabase } = await import('../lib/supabase.js')
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: perfil } = await supabase.from('profiles').select('pode_usar_api, role').eq('id', user.id).single()
        const podeUsar = perfil?.role === 'admin' || perfil?.pode_usar_api === true
        if (!podeUsar) { setError('⚠️ Acesso à busca por IA não liberado. Solicite ao administrador.'); return }
      }
    } catch (e) { console.warn('[AXIS] Verificação pode_usar_api:', e.message) }
    setLoading(true); setError(""); setResults(null);
    try {
      const query = `Busque imóveis em leilão em ${cidade}. Tipo: ${tipo}. ${maxValor ? `Valor máximo: R$ ${maxValor}` : ""} ${minDesconto ? `Desconto mínimo de ${minDesconto}%` : ""} Priorize imóveis desocupados e financiáveis pela CAIXA. Busque nos portais de leilão brasileiros e retorne os melhores resultados disponíveis hoje.`;
      let data
      if (openaiKey.trim()) {
        data = await buscarComGPT(query, openaiKey.trim())
      } else {
        setError("Usando Gemini para busca...")
        data = await buscarComGemini(query, geminiKey)
      }
      setResults(data);
    } catch(e) { const isQuota = /quota|429|rate.limit|insufficient/i.test(e.message); setError(isQuota ? "Créditos OpenAI esgotados. Adicione saldo em platform.openai.com ou aguarde o reset mensal." : e.message); }
    setLoading(false);
  };

  const fmtC = v => v ? `R$ ${Number(v).toLocaleString("pt-BR")}` : "—";

  return (
    <div style={{ padding: isPhone ? "16px" : "24px 32px", maxWidth: 960, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: `${K.gpt}20`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🔎</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 20, color: K.wh, letterSpacing: -.3 }}>Busca Inteligente</div>
            <div style={{ fontSize: 11, color: K.t3 }}>IA pesquisa em tempo real nos portais de leilão brasileiros</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: (openaiKey||geminiKey) ? K.grn : K.red }} />
            <span style={{ fontSize: 10, color: (openaiKey||geminiKey) ? K.grn : K.red, fontWeight: 700 }}>
              {openaiKey ? "OpenAI" : geminiKey ? "Gemini" : "Sem chave"}
            </span>
            {(openaiKey||geminiKey) && <button onClick={() => setShowKey(!showKey)}
              style={{ background: "none", border: `1px solid ${K.bd}`, color: K.t3, borderRadius: 4,
                padding: "2px 8px", fontSize: 10, cursor: "pointer" }}>⚙️</button>}
          </div>
        </div>
      </div>

      {/* Config chave (colapsável) */}
      {(!openaiKey || showKey) && (
        <div style={{ background: K.s2, border: `1px solid ${K.bd}`, borderRadius: 10,
          padding: "12px 16px", marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: K.t2, fontWeight: 600, marginBottom: 8 }}>
            🔑 Chave de API {openaiKey ? "(alterar)" : "necessária"}
          </div>
          <input style={{ ...inp, fontFamily: "monospace" }} type="password"
            placeholder="sk-... (OpenAI) ou AIza... (Gemini)" value={openaiKey}
            onChange={e => saveKey(e.target.value)} />
          <div style={{ fontSize: 10, color: K.t3, marginTop: 6 }}>
            A busca usa GPT-4o Browse ou Gemini Grounding. A chave fica salva localmente.
          </div>
        </div>
      )}

      {/* Filtros — layout moderno */}
      <div style={{ background: K.s2, border: `1px solid ${K.bd}`, borderRadius: 12,
        padding: "16px 20px", marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: K.t3, textTransform: "uppercase", letterSpacing: 1,
          fontWeight: 700, marginBottom: 12 }}>Filtros de busca</div>
        <div style={{ display: "grid", gridTemplateColumns: isPhone ? "1fr" : "2fr 1fr 1fr 1fr", gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, color: K.t3, marginBottom: 4 }}>📍 Cidade / Região *</div>
            <input style={inp} placeholder="Ex: Belo Horizonte, MG" value={cidade}
              onChange={e => setCidade(e.target.value)} onKeyDown={e => e.key === "Enter" && buscar()} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: K.t3, marginBottom: 4 }}>🏠 Tipo</div>
            <select style={{ ...inp, cursor: "pointer" }} value={tipo} onChange={e => setTipo(e.target.value)}>
              <option>Apartamento</option><option>Casa</option><option>Terreno</option>
              <option>Comercial</option><option>Qualquer</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 10, color: K.t3, marginBottom: 4 }}>💰 Valor máx</div>
            <input style={inp} placeholder="500.000" value={maxValor} onChange={e => setMaxValor(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: K.t3, marginBottom: 4 }}>% Desconto mín</div>
            <input style={inp} placeholder="20" value={minDesconto} onChange={e => setMinDesconto(e.target.value)} />
          </div>
        </div>
      </div>

      {error && (
        <div style={{ background: `${K.red}12`, border: `1px solid ${K.red}30`, borderRadius: 8,
          padding: "10px 14px", marginBottom: 14, fontSize: 12.5, color: K.red, display: "flex", gap: 8 }}>
          <span>⚠️</span><span>{error}</span>
        </div>
      )}

      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px",
          background: `${K.gpt}08`, border: `1px solid ${K.gpt}20`, borderRadius: 10, marginBottom: 16 }}>
          <div style={{ width: 28, height: 28, border: `3px solid ${K.gpt}40`,
            borderTopColor: K.gpt, borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          <div>
            <div style={{ fontSize: 13, color: K.gpt, fontWeight: 700 }}>Pesquisando em {cidade}...</div>
            <div style={{ fontSize: 11, color: K.t3, marginTop: 2 }}>Pode levar 15-30 segundos</div>
          </div>
        </div>
      )}

      <button onClick={buscar} disabled={loading}
        style={{ background: loading ? `${K.gpt}40` : `linear-gradient(135deg,${K.gpt},${K.gpt}CC)`,
          color: "#000", border: "none", borderRadius: 8, padding: "11px 28px", fontSize: 14,
          fontWeight: 800, cursor: loading ? "not-allowed" : "pointer", marginBottom: 24,
          boxShadow: loading ? "none" : `0 4px 14px ${K.gpt}30`, letterSpacing: -.2,
          display: "flex", alignItems: "center", gap: 8 }}>
        {loading ? <><span style={{ opacity: .6 }}>⏳</span> Buscando...</> : <><span>🔍</span> Buscar Imóveis</>}
      </button>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {results && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: K.wh }}>
              {results.total_encontrados || results.imoveis?.length || 0} imóveis encontrados
            </div>
            <div style={{ fontSize: 11, color: K.t3 }}>em {results.regiao_pesquisada}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isPhone ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {(results.imoveis || []).map((im, i) => (
              <div key={i} style={{ background: "#111620", border: `1px solid ${K.bd}`, borderRadius: 10,
                padding: 16, transition: "border-color .2s", cursor: "default" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = K.teal}
                onMouseLeave={e => e.currentTarget.style.borderColor = K.bd}>
                {/* Badge desconto */}
                {im.desconto_percentual && (
                  <div style={{ display: "inline-block", background: `${K.grn}20`, color: K.grn,
                    fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 4, marginBottom: 8 }}>
                    ↓{im.desconto_percentual}% desconto
                  </div>
                )}
                <div style={{ fontWeight: 700, fontSize: 13.5, color: K.wh, marginBottom: 4, lineHeight: 1.3 }}>
                  {im.titulo}
                </div>
                <div style={{ fontSize: 11, color: K.t3, marginBottom: 12 }}>
                  📍 {im.cidade}/{im.estado}{im.tipo ? ` · ${im.tipo}` : ""}{im.area_m2 ? ` · ${im.area_m2}m²` : ""}
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  <div style={{ flex: 1, background: K.s2, borderRadius: 6, padding: "8px 10px" }}>
                    <div style={{ fontSize: 9, color: K.t3, textTransform: "uppercase" }}>Lance mín.</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: K.amb }}>{fmtC(im.valor_minimo)}</div>
                  </div>
                  {im.valor_avaliacao && (
                    <div style={{ flex: 1, background: K.s2, borderRadius: 6, padding: "8px 10px" }}>
                      <div style={{ fontSize: 9, color: K.t3, textTransform: "uppercase" }}>Avaliação</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: K.t2 }}>{fmtC(im.valor_avaliacao)}</div>
                    </div>
                  )}
                </div>
                {(im.modalidade || im.data_leilao) && (
                  <div style={{ fontSize: 10.5, color: K.t3, marginBottom: 12,
                    padding: "6px 10px", background: K.s2, borderRadius: 6 }}>
                    🔨 {[im.modalidade, im.data_leilao, im.fonte].filter(Boolean).join(" · ")}
                  </div>
                )}
                <div style={{ display: "flex", gap: 6 }}>
                  {im.link && (
                    <a href={im.link} target="_blank" rel="noopener noreferrer"
                      style={{ flex: 1, background: K.s2, color: K.t2, border: `1px solid ${K.bd}`,
                        borderRadius: 6, padding: "7px 0", fontSize: 11, textDecoration: "none",
                        fontWeight: 600, textAlign: "center" }}>
                      🔗 Ver edital
                    </a>
                  )}
                  {onAnalisar && (
                    <button onClick={() => onAnalisar(im.link || "")}
                      style={{ flex: 1, background: `${K.teal}15`, color: K.teal,
                        border: `1px solid ${K.teal}40`, borderRadius: 6, padding: "7px 0",
                        fontSize: 11, cursor: "pointer", fontWeight: 700 }}>
                      ⚡ Analisar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
