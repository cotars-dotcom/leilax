import { useState } from "react"
import { C, RED } from "../appConstants.js"

const ESTRATEGIA_CONFIG = {
  flip_rapido:    { emoji:'🔄', label:'Flip Rápido',    color:C.emerald },
  renda_passiva:  { emoji:'🏠', label:'Renda Passiva',  color:C.navy   },
  airbnb:         { emoji:'🌟', label:'Airbnb/Temporada',color:C.mustard},
  reforma_revenda:{ emoji:'🏗️', label:'Reforma + Venda',color:C.emerald},
  locacao_longa:  { emoji:'📋', label:'Locação Longa',  color:C.navy   },
}

export default function CalculadoraROI({ imovel }) {
  const [entrada, setEntrada] = useState(30)
  const [prazoVenda, setPrazoVenda] = useState(12)
  const [taxaJuros, setTaxaJuros] = useState(10.5)
  const [tabela, setTabela] = useState('price')
  const [estrategia, setEstrategia] = useState('flip')
  const lance       = imovel.valor_minimo || 0
  const comissao    = lance * 0.05
  const itbi        = lance * ((imovel.itbi_pct || 2) / 100)
  const doc         = lance * 0.005
  const reforma     = imovel.custo_reforma_calculado || imovel.custo_reforma_previsto || 0
  const advogado      = lance * 0.02
  const registro      = 1500
  const custoJuridico = imovel.custo_juridico_estimado || 0
  const custoTotal    = lance + comissao + itbi + doc + advogado + registro + reforma + custoJuridico
  const vmercado = imovel.valor_mercado_estimado || imovel.valor_pos_reforma_estimado
    || (imovel.preco_m2_mercado * (imovel.area_privativa_m2 || imovel.area_m2 || 0))
    || lance * 1.4
  const irpfGanho     = Math.max(0, (vmercado - custoTotal) * 0.15)
  const corretagemVenda = vmercado * 0.06
  const lucroFlip    = vmercado - custoTotal - irpfGanho - corretagemVenda
  const roiFlip      = custoTotal > 0 ? (lucroFlip / custoTotal) * 100 : 0
  const aluguelMensal = imovel.aluguel_mensal_estimado
    || (vmercado * (imovel.yield_bruto_pct || 6) / 100 / 12)
  const rendaAnual   = aluguelMensal * 12
  const yieldLiquido = custoTotal > 0 ? (rendaAnual / custoTotal) * 100 : 0
  const valorFinanciado = custoTotal * (1 - entrada / 100)
  const entradaValor    = custoTotal * (entrada / 100)
  const taxaMensal      = taxaJuros / 100 / 12
  const prazoMeses      = 360
  const parcela         = tabela === 'price' && taxaMensal > 0
    ? valorFinanciado * (taxaMensal * Math.pow(1 + taxaMensal, prazoMeses))
        / (Math.pow(1 + taxaMensal, prazoMeses) - 1)
    : valorFinanciado / prazoMeses + valorFinanciado * taxaMensal
  const saldoDevedor = taxaMensal > 0
    ? valorFinanciado * Math.pow(1 + taxaMensal, prazoVenda)
      - parcela * (Math.pow(1 + taxaMensal, prazoVenda) - 1) / taxaMensal
    : valorFinanciado - parcela * prazoVenda
  const lucroFinanciado = vmercado - saldoDevedor - entradaValor - reforma - comissao - itbi - doc
  const fmt = n => n ? `R$ ${Math.round(n).toLocaleString('pt-BR')}` : '—'
  const pct = n => n ? `${n.toFixed(1)}%` : '—'
  // MAO — Lance Máximo para margem mínima de 20%
  const custosFixos = comissao + itbi + doc + reforma
  const capRatePct  = imovel.classe_ipead === 'Classe 4 - Luxo' ? 4.0
                    : imovel.classe_ipead === 'Classe 3 - Alto' ? 5.0 : 6.0
  const maoFlip     = vmercado > 0 ? vmercado * 0.80 - custosFixos : 0
  const maoLocacao  = aluguelMensal > 0
                    ? (aluguelMensal * 12) / (capRatePct / 100) - custosFixos
                    : 0
  const lanceViavel = lance <= maoFlip
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
        <span style={{ fontSize:16 }}>💰</span>
        <h4 style={{ margin:0, fontSize:14, fontWeight:700, color:C.navy }}>
          Calculadora de Retorno
        </h4>
      </div>
      <div style={{ background:C.surface, borderRadius:10, padding:'12px 14px', marginBottom:12 }}>
        <p style={{ margin:'0 0 8px', fontSize:11, fontWeight:600, color:C.muted,
          textTransform:'uppercase', letterSpacing:'0.5px' }}>Custo Total de Aquisição</p>
        {[
          ['Lance mínimo',    fmt(lance)],
          ['Comissão leiloeiro (5%)', fmt(comissao)],
          [`ITBI (${imovel.itbi_pct || 2}%)`, fmt(itbi)],
          ['Documentação (0,5%)', fmt(doc)],
          ['Honorários advocacia (2%)', fmt(advogado)],
          ['Registro cartório', fmt(registro)],
          custoJuridico > 0 ? ['Custo jurídico estimado', fmt(custoJuridico)] : null,
          reforma > 0 ? ['Reforma estimada', fmt(reforma)] : null,
        ].filter(Boolean).map(([k,v]) => (
          <div key={k} style={{ display:'flex', justifyContent:'space-between',
            padding:'4px 0', borderBottom:`1px solid ${C.borderW}`, fontSize:12 }}>
            <span style={{ color:C.muted }}>{k}</span>
            <span style={{ color:C.navy, fontWeight:500 }}>{v}</span>
          </div>
        ))}
        <div style={{ display:'flex', justifyContent:'space-between',
          padding:'6px 0 0', fontSize:13 }}>
          <span style={{ fontWeight:700, color:C.navy }}>Total</span>
          <span style={{ fontWeight:800, color:C.navy }}>{fmt(custoTotal)}</span>
        </div>
      </div>
      <div style={{ display:'flex', gap:4, marginBottom:12 }}>
        {[['flip','🔄 Flip'],['locacao','🏠 Locação'],['financiado','🏦 Financiado']].map(([k,l]) => (
          <button key={k} onClick={() => setEstrategia(k)} style={{
            flex:1, padding:'7px 4px', borderRadius:7, fontSize:11.5, fontWeight:500,
            border:`1px solid ${estrategia===k ? C.emerald : C.borderW}`,
            background: estrategia===k ? C.emeraldL : C.white,
            color: estrategia===k ? C.emerald : C.muted, cursor:'pointer',
          }}>{l}</button>
        ))}
      </div>
      {estrategia === 'flip' && (
        <div style={{ background:roiFlip > 20 ? C.emeraldL : C.surface,
          borderRadius:10, padding:'14px 16px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
            <div>
              <p style={{ margin:0, fontSize:11, color:C.muted }}>Valor de mercado est.</p>
              <p style={{ margin:0, fontSize:16, fontWeight:800, color:C.navy }}>{fmt(vmercado)}</p>
            </div>
            <div style={{ textAlign:'right' }}>
              <p style={{ margin:0, fontSize:11, color:C.muted }}>Lucro estimado</p>
              <p style={{ margin:0, fontSize:16, fontWeight:800,
                color: lucroFlip > 0 ? C.emerald : RED }}>{fmt(lucroFlip)}</p>
            </div>
          </div>
          <div style={{ background:C.white, borderRadius:8, padding:'8px 12px',
            display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:12, color:C.muted }}>ROI estimado</span>
            <span style={{ fontSize:18, fontWeight:800,
              color: roiFlip > 30 ? C.emerald : roiFlip > 15 ? C.mustard : RED }}>
              {pct(roiFlip)}
            </span>
          </div>
          {maoFlip > 0 && (
            <div style={{background:C.surface, borderRadius:8, padding:'8px 12px',
              marginTop:8, border:`1px solid ${lanceViavel ? C.emerald+'40' : RED+'40'}`}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <span style={{fontSize:11, color:C.muted}}>Lance máximo (margem 20%)</span>
                <span style={{fontSize:14, fontWeight:800,
                  color: lanceViavel ? C.emerald : RED}}>{fmt(maoFlip)}</span>
              </div>
              <p style={{margin:'4px 0 0', fontSize:11,
                color: lanceViavel ? C.emerald : RED}}>
                {lanceViavel ? '✓ Lance atual está dentro do MAO' : '✗ Lance atual supera o MAO'}
              </p>
            </div>
          )}
        </div>
      )}
      {estrategia === 'locacao' && (
        <div style={{ background:C.surface, borderRadius:10, padding:'14px 16px' }}>
          {[
            ['Aluguel mensal estimado', fmt(aluguelMensal)],
            ['Renda bruta anual', fmt(rendaAnual)],
            ['Yield bruto a.a.', pct(yieldLiquido)],
          ].map(([k,v]) => (
            <div key={k} style={{ display:'flex', justifyContent:'space-between',
              padding:'5px 0', borderBottom:`1px solid ${C.borderW}`, fontSize:12 }}>
              <span style={{ color:C.muted }}>{k}</span>
              <span style={{ color:C.navy, fontWeight:600 }}>{v}</span>
            </div>
          ))}
          {maoLocacao > 0 && (
            <div style={{background:C.surface, borderRadius:8, padding:'8px 12px', marginTop:8}}>
              <span style={{fontSize:11, color:C.muted}}>Lance máximo (yield {capRatePct}% a.a.)</span>
              <span style={{fontSize:14, fontWeight:800, color:C.navy, marginLeft:8}}>
                {fmt(maoLocacao)}
              </span>
            </div>
          )}
        </div>
      )}
      {estrategia === 'financiado' && (
        <div style={{ background:C.surface, borderRadius:10, padding:'14px 16px' }}>
          <div style={{ display:'flex', gap:8, marginBottom:10 }}>
            <div style={{ flex:1 }}>
              <p style={{ margin:'0 0 4px', fontSize:10, color:C.muted }}>Entrada (%)</p>
              <input type="range" min="10" max="90" value={entrada}
                onChange={e => setEntrada(+e.target.value)}
                style={{ width:'100%', accentColor: C.emerald, touchAction:'none' }} />
              <p style={{ margin:0, fontSize:11, fontWeight:600, color:C.navy,
                textAlign:'center' }}>{entrada}% = {fmt(entradaValor)}</p>
            </div>
            <div style={{ flex:1 }}>
              <p style={{ margin:'0 0 4px', fontSize:10, color:C.muted }}>Vender em (meses)</p>
              <input type="range" min="6" max="60" step="6" value={prazoVenda}
                onChange={e => setPrazoVenda(+e.target.value)}
                style={{ width:'100%', accentColor: C.emerald, touchAction:'none' }} />
              <p style={{ margin:0, fontSize:11, fontWeight:600, color:C.navy,
                textAlign:'center' }}>{prazoVenda} meses</p>
            </div>
          </div>
          {[
            ['1ª parcela estimada', fmt(parcela)],
            ['Saldo devedor na venda', fmt(Math.max(0, saldoDevedor))],
            ['Lucro líquido estimado', fmt(lucroFinanciado)],
          ].map(([k,v]) => (
            <div key={k} style={{ display:'flex', justifyContent:'space-between',
              padding:'5px 0', borderBottom:`1px solid ${C.borderW}`, fontSize:12 }}>
              <span style={{ color:C.muted }}>{k}</span>
              <span style={{ color: k.includes('Lucro') && lucroFinanciado > 0
                ? C.emerald : C.navy, fontWeight:600 }}>{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
