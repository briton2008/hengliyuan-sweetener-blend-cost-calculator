import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { standaloneHref } from "./standalone-routes.mjs";
import "./standalone.css";
import "./sweetener-tools.css";
const Tool = lazy(() => import("./sweetener-tools.jsx"));
function Contact({context,onClose}) {
 const dialog=useRef(null);
 useEffect(()=>{dialog.current.showModal();},[]);
 return <dialog ref={dialog} onClose={onClose} aria-labelledby="contact-title"><h2 id="contact-title">Discuss your project</h2><p>{context}</p><p>Save or copy your record first. Open the company contact page to send it yourself. No worksheet data is attached or sent by this link.</p><a href="https://heng-li-yuan.com/en/inquiry/" target="_blank" rel="noopener noreferrer">Open company contact page ↗</a><form method="dialog"><button autoFocus>Close</button></form></dialog>;
}
function App() {
 const root=useRef(null),[inquiry,setInquiry]=useState("");
 const base=new URL("./",location.href).href;
 useEffect(()=>{
  const rewrite=()=>root.current.querySelectorAll("a[href]").forEach(a=>{const raw=a.getAttribute("href"),next=standaloneHref(raw,base);if(raw!==next)a.setAttribute("href",next);});
  rewrite();const observer=new MutationObserver(rewrite);observer.observe(root.current,{childList:true,subtree:true});return()=>observer.disconnect();
 },[base]);
 const props={onInquiry:setInquiry};
 return <div className="site-shell" ref={root}><header className="topbar"><a href="/tools/">HENGLIYUAN SWEETENER BLEND COST CALCULATOR</a><a className="company-website-link" href="https://heng-li-yuan.com/" target="_blank" rel="noopener noreferrer">Company website ↗</a></header><main><Suspense fallback={<p className="standalone-loading" role="status">Loading tool…</p>}><Tool {...props}/></Suspense></main><footer><a className="company-website-link" href="https://heng-li-yuan.com/" target="_blank" rel="noopener noreferrer">Guilin Hengliyuan Biotech Co., Ltd.</a> · Reference planning only · Entries remain in this page.</footer>{inquiry&&<Contact context={inquiry} onClose={()=>setInquiry("")}/>}</div>;
}
createRoot(document.getElementById("root")).render(<App/>);
