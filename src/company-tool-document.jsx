import React from "react";
import { createPortal } from "react-dom";
import logo from "./assets/monk-fruit-sweet-mark.png";

// Match the current approved trade-document master; this wrapper grants no approval status.
export default function CompanyToolDocument({ title, category, privateKey = false, text, figure }) {
  const footer = privateKey ? "HENGLIYUAN | CODE KEY - KEEP SEPARATE" : "HENGLIYUAN | CUSTOMER-ENTERED - FOR REVIEW";
  return createPortal(<section className="company-tool-document" aria-label="Company PDF document">
    <style media="print">{`@page{size:A4;margin:6mm 18mm 14mm;@bottom-left{content:"${footer}";font:7.5pt Arial,sans-serif;color:#5e6b73;vertical-align:top;padding-top:3mm;border-top:.5pt solid #cfd9de}@bottom-center{content:"";border-top:.5pt solid #cfd9de}@bottom-right{content:"Page " counter(page);font:7.5pt Arial,sans-serif;color:#5e6b73;vertical-align:top;padding-top:3mm;border-top:.5pt solid #cfd9de}}`}</style>
    <table><thead><tr><td><header className="company-document-header"><img src={logo} alt="Hengliyuan" width="28" height="28" /><div className="company-document-name">Guilin Hengliyuan Biotech Co., Ltd.</div><div className="company-document-address">Address: Standard Factory Building No. 3, Yangtang Industrial Park, Lingui District, Guilin, Guangxi, China</div><div className="company-document-object">{privateKey ? "PREPARER ONLY" : "CUSTOMER WORKSHEET"}<span>{category}</span></div></header></td></tr></thead><tbody><tr><td><h1>{title}</h1></td></tr>{figure && <tr className="company-document-figure"><td>{figure}</td></tr>}{text.split("\n").slice(1).join("\n").trim().split("\n").map((line, index) => <tr key={index}><td><pre>{line || "\u00a0"}</pre></td></tr>)}</tbody></table>
  </section>, document.body);
}
