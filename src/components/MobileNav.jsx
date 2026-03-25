import React, { useEffect, useState } from "react";

const THEME = { card: "#0F1420", border: "rgba(0, 229, 187, 0.18)", text: "#DDE4F0", muted: "rgba(221, 228, 240, 0.72)" };

export default function MobileNav({ items = [], activeKey = "", onNavigate = () => {}, breakpointPx = 900 }) {
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" ? window.matchMedia(`(max-width: ${breakpointPx}px)`).matches : false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(`(max-width: ${breakpointPx}px)`);
    const h = () => setIsMobile(mq.matches); h();
    mq.addEventListener?.("change", h);
    return () => mq.removeEventListener?.("change", h);
  }, [breakpointPx]);

  const css = `.axis-shell{min-height:100dvh;display:flex;background:#080B10;color:#DDE4F0}.axis-sidebar{width:200px;flex:0 0 200px;background:${THEME.card};border-right:1px solid ${THEME.border}}.axis-main{flex:1 1 auto;min-width:0;overflow-y:auto}@media(max-width:${breakpointPx}px){.axis-sidebar{display:none!important}.axis-main{padding-bottom:calc(86px + env(safe-area-inset-bottom))}}@media(max-width:480px){input,select,textarea{font-size:16px!important}.axis-main{-webkit-overflow-scrolling:touch}.axis-main *{word-break:break-word}}`;

  if (!isMobile) return <style>{css}</style>;

  return <><style>{css}</style>
    <nav style={{ position:"fixed", left:10, right:10, bottom:10, background:"rgba(15,20,32,0.92)", border:`1px solid ${THEME.border}`, borderRadius:16, padding:"10px", paddingBottom:"calc(10px + env(safe-area-inset-bottom))", display:"grid", gridTemplateColumns:`repeat(${Math.max(1,items.length)},1fr)`, gap:6, backdropFilter:"blur(10px)", boxShadow:"0 20px 44px rgba(0,0,0,0.6)", zIndex:9999 }}>
      {items.map(it => { const a = String(it.key||it.v)===String(activeKey); return <button key={it.key||it.v} onClick={()=>onNavigate(it.key||it.v)} style={{ appearance:"none", border:`1px solid ${a?"rgba(0,229,187,0.45)":"transparent"}`, background:a?"rgba(0,229,187,0.10)":"transparent", borderRadius:14, padding:"10px 8px", color:THEME.text, cursor:"pointer", display:"grid", gap:4, justifyItems:"center" }}>
        <div style={{ fontSize:18, lineHeight:"18px" }}>{it.icon||it.i||"•"}</div>
        <div style={{ fontSize:11, color:a?THEME.text:THEME.muted, fontWeight:800 }}>{it.label||it.l||it.key||it.v}</div>
      </button>; })}
    </nav></>;
}
