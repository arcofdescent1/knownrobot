import { ImageResponse } from "next/og";

export const alt = "Known Robot — Know what works before the robot moves";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(<div style={{ width:"100%", height:"100%", display:"flex", flexDirection:"column", justifyContent:"space-between", padding:"64px 72px", color:"#f7f9f6", background:"#123e32", fontFamily:"Arial, sans-serif" }}>
    <div style={{ display:"flex", alignItems:"center", gap:18, fontSize:25, fontWeight:700 }}><div style={{ width:56, height:56, display:"flex", alignItems:"center", justifyContent:"center", borderRadius:"14px 14px 14px 4px", color:"#123e32", background:"#c9f36a", fontSize:17 }}>KR</div>Known Robot</div>
    <div style={{ display:"flex", flexDirection:"column", gap:24 }}><div style={{ maxWidth:970, fontSize:75, lineHeight:1.02, letterSpacing:"-4px", fontWeight:700 }}>Know what works before the robot moves.</div><div style={{ color:"#c7d7d0", fontSize:26 }}>Open evidence for reproducible robot skills.</div></div>
    <div style={{ display:"flex", alignItems:"center", gap:14, color:"#c9f36a", fontSize:18, letterSpacing:"2px" }}><span>POLICY</span><span style={{color:"#6c8d82"}}>→</span><span>HARDWARE</span><span style={{color:"#6c8d82"}}>→</span><span>EVIDENCE</span></div>
  </div>, size);
}
