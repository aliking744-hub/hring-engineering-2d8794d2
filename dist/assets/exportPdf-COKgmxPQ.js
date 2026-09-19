import{h as w,E as y}from"./vendor-pdf-D6cvRTtr.js";const v=o=>Promise.all(Array.from(o.querySelectorAll("img")).map(t=>t.complete?Promise.resolve():new Promise(n=>{t.addEventListener("load",()=>n(),{once:!0}),t.addEventListener("error",()=>n(),{once:!0})}))),E=async(o=document)=>{document.fonts&&await document.fonts.ready,await v(o),await new Promise(t=>requestAnimationFrame(()=>t()))},C=`
  .pdf-export-root, .pdf-export-root * {
    box-sizing: border-box !important;
    color: #111827 !important;
    border-color: #d1d5db !important;
    text-shadow: none !important;
  }
  .pdf-export-root {
    direction: rtl !important;
    font-family: Vazirmatn, IRANSans, Tahoma, sans-serif !important;
    line-height: 1.8 !important;
    width: 900px !important;
    max-width: 900px !important;
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
    padding: 28px !important;
    background: #ffffff !important;
  }
  .pdf-export-root .no-print,
  .pdf-export-root button,
  .pdf-export-root textarea {
    display: none !important;
  }
  .pdf-export-root [class*="bg-"],
  .pdf-export-root [class*="glass"] {
    background: #ffffff !important;
    box-shadow: none !important;
  }
  .pdf-export-root [class*="text-muted"] {
    color: #4b5563 !important;
  }
  .pdf-export-root h1,
  .pdf-export-root h2,
  .pdf-export-root h3,
  .pdf-export-root h4 {
    color: #0f3d75 !important;
    break-after: avoid-page;
    page-break-after: avoid;
  }
  .pdf-export-root p,
  .pdf-export-root li,
  .pdf-export-root tr,
  .pdf-export-root table,
  .pdf-export-root section,
  .pdf-export-root [data-pdf-block],
  .pdf-export-root [class*="rounded"] {
    break-inside: avoid-page;
    page-break-inside: avoid;
  }
  .pdf-text-document h1 {
    margin: 0 0 8px;
    font-size: 28px;
  }
  .pdf-text-document .pdf-date {
    margin: 0 0 20px;
    color: #4b5563 !important;
  }
  .pdf-text-document h2,
  .pdf-text-document h3 {
    margin: 18px 0 8px;
  }
  .pdf-text-document p {
    margin: 0 0 10px;
    white-space: pre-wrap;
  }
`;function P(o,t,n){if(o<=0||t<=0)return[];const d=Array.from(new Set(n.map(e=>Math.round(e)).filter(e=>e>0&&e<o))).sort((e,i)=>e-i),a=[];let r=0;for(;r<o;){const e=Math.min(r+t,o);if(e===o){a.push({sourceY:r,height:o-r});break}const i=r+t*.55,s=d.filter(m=>m>=i&&m<=e),c=s.length?s[s.length-1]:e,p=c>r?c:e;a.push({sourceY:r,height:p-r}),r=p}return a}function k(o,t){const n=o.getBoundingClientRect(),d=Math.max(o.scrollHeight,n.height,1),a=t/d,r=[];return o.querySelectorAll("h1,h2,h3,h4,p,li,tr,table,section,[data-pdf-block],[class*='rounded']").forEach(e=>{const i=e.getBoundingClientRect(),s=(i.top-n.top)*a,c=(i.bottom-n.top)*a;s>0&&r.push(s),c>0&&r.push(c)}),r}function A(o){const t=document.createElement("div");t.setAttribute("aria-hidden","true"),t.style.position="absolute",t.style.left="-10000px",t.style.top="0",t.style.width="900px",t.style.background="#ffffff",t.style.pointerEvents="none";const n=o.cloneNode(!0);n.classList.add("pdf-export-root"),n.setAttribute("dir","rtl"),t.appendChild(n);const d=document.createElement("style");return d.dataset.pdfExportStyle="true",d.textContent=C,document.head.appendChild(d),document.body.appendChild(t),{host:t,clone:n,style:d}}async function R(o,{filename:t,marginMm:n=12}){const{host:d,clone:a,style:r}=A(o);try{await E(a);const e=await w(a,{scale:Math.max(2,window.devicePixelRatio||1),useCORS:!0,allowTaint:!1,logging:!1,backgroundColor:"#ffffff",scrollX:0,scrollY:0}),i=new y({orientation:"portrait",unit:"mm",format:"a4"}),s=210,c=297,p=s-n*2,m=c-n*2,u=e.width/p,b=Math.floor(m*u),x=P(e.height,b,k(a,e.height));x.forEach((l,g)=>{g>0&&i.addPage();const f=document.createElement("canvas");f.width=e.width,f.height=l.height;const h=f.getContext("2d");if(!h)throw new Error("PDF canvas is not available");h.fillStyle="#ffffff",h.fillRect(0,0,f.width,f.height),h.drawImage(e,0,l.sourceY,e.width,l.height,0,0,e.width,l.height),i.addImage(f.toDataURL("image/jpeg",.94),"JPEG",n,n,p,l.height/u,void 0,"FAST"),i.setFontSize(8),i.setTextColor(107,114,128),i.text(`${g+1} / ${x.length}`,s/2,c-5,{align:"center"})}),i.save(t)}finally{d.remove(),r.remove()}}async function M({title:o,content:t,filename:n,marginMm:d}){const a=document.createElement("article");a.className="pdf-text-document",a.setAttribute("dir","rtl");const r=document.createElement("h1");r.textContent=o,a.appendChild(r);const e=document.createElement("p");e.className="pdf-date",e.textContent=`تاریخ: ${new Date().toLocaleDateString("fa-IR")}`,a.appendChild(e);for(const i of t.split(/\r?\n/)){const s=i.trim();if(!s)continue;const c=/^(#{1,3})\s+(.+)$/.exec(s),p=document.createElement(c?"h2":"p");p.textContent=c?c[2]:s,p.dataset.pdfBlock="true",a.appendChild(p)}await R(a,{filename:n,marginMm:d})}export{M as a,R as e};
