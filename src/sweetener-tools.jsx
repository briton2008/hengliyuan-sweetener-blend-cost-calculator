import CompanyToolDocument from "./company-tool-document.jsx";
import "./oem-configurator.css";
import React, { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, Calculator, Check, Plus, RotateCcw, Trash2 } from "lucide-react";
import { calculatorPath, ingredients, defaultRows, calculateBlend, processes, defaultLossPercent, cnyToUsd, referenceFxUrl, readReferenceFx, sweetnessReferences, defaultSweetnessFactors, calculateSweetness, formatBlendSummary, priceConfirmedOn, priceConfirmedLabel, resultDisclaimer, ingredientForRow, newIngredientRow, ingredientGroups, rowLimit } from "./sweetener-blend-cost.mjs";
import { toolsPath, toolsContentLanguage, toolsLanguages, translateToolsText } from "./sweetener-tools-locale.mjs";
import { explanation, faqs, relatedGuides, toolTitle } from "./sweetener-tools-content.mjs";

const number = (value, digits = 2) => new Intl.NumberFormat("en", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
const money = value => number(value, 2);
const quantity = value => value > 0 && value < 0.000001 ? value.toExponential(3) : number(value, 6).replace(/\.?0+$/, "");
const ingredientLabel = item => item.custom ? item.name || "Custom ingredient" : item.name + (item.grade === "Bulk sweetener" ? "" : ` · ${item.grade}`);

function initialRows() {
  const existing = [...document.querySelectorAll(".blend-row")];
  return existing.length ? existing.map(row => {
    const select = row.querySelector("select");
    const price = row.querySelector('[data-field="price"]');
    const originalId = [...select.options].find(option => option.defaultSelected)?.value;
    // A selection made before enhancement must not inherit another grade's reference price.
    const changedBeforeEnhancement = originalId && originalId !== select.value && price.value === price.defaultValue;
    return {
    ingredientId: select.value,
    percent: row.querySelector('[data-field="percent"]').value,
    price: changedBeforeEnhancement ? String(ingredients.find(item => item.id === select.value)?.price ?? "") : price.value,
    name: row.querySelector('[data-custom-name]')?.value || "",
    factor: row.querySelector('[data-custom-factor]')?.value || "",
    noSweetness: row.querySelector('[data-no-sweetness]')?.checked || false,
  }; }) : defaultRows();
}

function BlendCalculator({ onInquiry, languageCode = "EN" }) {
  const t = text => translateToolsText(text, languageCode);
  const pagePath = toolsPath(languageCode, true);
  const [rows, setRows] = useState(initialRows);
  const [batch, setBatch] = useState(() => document.getElementById("blend-batch")?.value || "");
  const [loss, setLoss] = useState(() => document.getElementById("blend-loss")?.value ?? defaultLossPercent);
  const [processId, setProcessId] = useState(() => document.getElementById("blend-process")?.value || "");
  const [referenceFx, setReferenceFx] = useState(null);
  const [customFx, setCustomFx] = useState(() => { const input = document.getElementById("blend-fx"); return input && input.value !== input.defaultValue ? input.value : null; });
  const [fxStatus, setFxStatus] = useState("loading");
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let active = true;
    // Fixed currency pair only: no query, body, custom headers or calculator inputs. No cached fallback.
    fetch(referenceFxUrl, { cache: "no-store", signal: controller.signal, credentials: "omit", referrerPolicy: "no-referrer" })
      .then(response => { if (!response.ok) throw new Error("Rate request failed"); return response.json(); })
      .then(readReferenceFx)
      .then(data => { if (active) { setReferenceFx(data); setFxStatus("ready"); } })
      .catch(() => { if (active) setFxStatus("unavailable"); })
      .finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, []);
  const exchangeRate = customFx ?? referenceFx?.rate ?? "";
  const fxValid = cnyToUsd(1, exchangeRate) !== null;
  const dollars = amount => { const value = cnyToUsd(amount, exchangeRate); return value === null ? "—" : money(value); };
  const [sweetnessFactors, setSweetnessFactors] = useState(() => {
    const factors = defaultSweetnessFactors();
    for (const row of document.querySelectorAll("[data-sweetness-id]")) factors[row.dataset.sweetnessId] = row.querySelector("[data-sweetness-factor]").value;
    return factors;
  });
  const sweetness = calculateSweetness(rows, sweetnessFactors, batch);
  const activeIngredients = ingredients.filter(item => !item.custom && rows.some(row => row.ingredientId === item.id));
  const nameToFocus = useRef(null);
  useEffect(() => {
    if (nameToFocus.current === null) return;
    document.getElementById(`blend-name-${nameToFocus.current}`)?.focus();
    nameToFocus.current = null;
  }, [rows.length]);
  const [touched, setTouched] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [copyFallback, setCopyFallback] = useState("");
  const result = calculateBlend(rows, batch, loss, processId);
  useEffect(() => {
    setCopyStatus("");
    setCopyFallback("");
  }, [rows, batch, loss, processId, exchangeRate, sweetnessFactors, languageCode]);
  async function copyEstimate() {
    const text = formatBlendSummary(result, { exchangeRate, sweetness, factors: sweetnessFactors, rateDate: customFx === null ? referenceFx?.date : null, customRate: customFx !== null, translate: t, path: pagePath });
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus("Estimate copied. You can paste it into your own records or a message.");
    } catch {
      setCopyFallback(text);
      setCopyStatus("Select the summary below and copy it manually.");
    }
  }
  const errorFor = field => touched && result.errors.find(error => error.field === field);
  const errorProps = field => ({ "aria-invalid": Boolean(errorFor(field)), "aria-describedby": errorFor(field) ? `${field}-error` : undefined });
  const fieldError = field => errorFor(field) ? <small className="blend-field-error" id={`${field}-error`}>{errorFor(field).text}</small> : null;
  const validPercentages = rows.every(row => row.percent !== "" && Number.isFinite(Number(row.percent)) && Number(row.percent) >= 0 && Number(row.percent) <= 100);
  const total = validPercentages ? result.totalPercent : null;
  const complete = total !== null && Math.abs(total - 100) <= 1e-8;
  const editedPrices = rows.some(row => Number(row.price) !== ingredients.find(item => item.id === row.ingredientId)?.price);
  const update = (index, change) => {
    setTouched(true);
    setRows(current => current.map((row, i) => i === index ? { ...row, ...change } : row));
  };
  const available = ingredients.find(item => !item.custom && !rows.some(row => row.ingredientId === item.id)) || ingredients[0];
  const addRow = id => {
    if (rows.length >= rowLimit) return;
    setTouched(true);
    if (id === "custom") nameToFocus.current = rows.length;
    setRows(current => [...current, newIngredientRow(id)]);
  };
  const switchIngredient = (index, id) => {
    const row = rows[index], current = ingredientForRow(row);
    const edited = row.price !== "" && row.price !== String(current?.price ?? "") || current?.custom && (row.name || row.factor || row.noSweetness);
    if (edited && !window.confirm(t("Change ingredient? This replaces the entered name, price and custom sweetness settings. Choose Cancel to keep this row."))) return;
    update(index, { ...newIngredientRow(id), percent: row.percent });
  };
  const duplicateNames = rows.map(row => {
    const item = ingredientForRow(row);
    return (item.custom ? [row.name || ""] : [ingredientLabel(item), t(ingredientLabel(item))]).map(name => name.trim().toLowerCase()).filter(Boolean);
  });
  return (<div className="blend-workspace" id="calculator" tabIndex={-1}>
    <section className="blend-editor" aria-labelledby="blend-editor-title">
      <div className="blend-panel-heading">
        <div><p className="blend-step">01 / YOUR FORMULA</p><h2 id="blend-editor-title">Build your blend</h2></div>

      </div>
      <p className="blend-help">Enter percentages by weight. Remove ingredients you do not need. Inputs are cleared when this page is refreshed.</p><a className={`blend-mobile-result-link ${result.ready ? "is-ready" : ""}`} href="#blend-results">{result.ready ? `View result · CNY ${money(result.packedCostPerKg)}/kg` : "View results"}<ArrowDown size={16} aria-hidden="true" /></a>
      <div className="blend-column-head" aria-hidden="true"><span>Ingredient & grade</span><span>Share (%)</span><span>Price (CNY/kg)</span><span /></div>
      <div className="blend-rows">
        {rows.map((row, index) => {
          const item = ingredientForRow(row);
          const customerPrice = item.price === undefined;
          const duplicate = duplicateNames[index].some(name => duplicateNames.slice(0, index).some(previous => previous.includes(name)));
          return <div className={`blend-row ${item.custom ? "blend-custom-row" : ""}`} key={index}>
            <div className="blend-ingredient"><label><span className="blend-mobile-label">Ingredient &amp; grade</span><select id={`blend-ingredient-${index}`} aria-label={`Ingredient ${index + 1}`} value={row.ingredientId} onChange={event => switchIngredient(index, event.target.value)}>{ingredientGroups.map(group => <optgroup label={group.label} key={group.label}>{group.ids.map(id => { const option = ingredients.find(x => x.id === id); return <option value={id} key={id}>{option.custom ? "Other carrier / excipient" : ingredientLabel(option)}</option>; })}</optgroup>)}<optgroup label="Customer-entered"><option value="custom">Custom ingredient</option></optgroup></select></label>
              {item.custom ? <label className="blend-custom-name">Name<input id={`blend-name-${index}`} data-custom-name="" type="text" maxLength={40} required aria-label={`Row ${index + 1} ingredient name`} {...errorProps(`blend-name-${index}`)} value={row.name || ""} onChange={event => update(index, { name: event.target.value })} />{fieldError(`blend-name-${index}`)}</label> : <small>{item.grade}</small>}
              {customerPrice && <small>Customer-entered price</small>}
              {duplicate && <small className="blend-duplicate" role="status">This ingredient already appears in another row. Combine the shares or rename the custom row.</small>}
            </div>
            <label className="blend-input-field"><span className="blend-mobile-label">Share (%)</span><input id={`blend-percent-${index}`} data-field="percent" aria-label={`Row ${index + 1} share percent`} {...errorProps(`blend-percent-${index}`)} type="number" inputMode="decimal" min="0" max="100" step="any" placeholder="0" value={row.percent} onChange={event => update(index, { percent: event.target.value })} /><span className="blend-input-unit" aria-hidden="true">%</span>{fieldError(`blend-percent-${index}`)}</label>
            <label className="blend-input-field"><span className="blend-mobile-label">{customerPrice ? "Customer-entered price" : "Price (CNY/kg)"}</span><input id={`blend-price-${index}`} data-field="price" aria-label={`Row ${index + 1} ${customerPrice ? "customer-entered price" : "price"} CNY per kg`} {...errorProps(`blend-price-${index}`)} type="number" inputMode="decimal" min="0" step="any" placeholder={customerPrice ? "Enter price" : undefined} value={row.price} onChange={event => update(index, { price: event.target.value })} /><small className="blend-usd-price">≈ USD {dollars(row.price)}/kg</small>{fieldError(`blend-price-${index}`)}</label>
            {item.custom && <div className="blend-custom-controls"><label>Sweetness factor<input data-custom-factor="" aria-label={`Row ${index + 1} custom sweetness factor`} aria-describedby="blend-sweetness-status" type="number" min="0" step="any" disabled={item.carrier || row.noSweetness} placeholder="Enter factor" value={item.carrier || row.noSweetness ? "0" : row.factor || ""} onChange={event => update(index, { factor: event.target.value })} /></label>{!item.carrier && <label className="blend-zero-check"><input data-no-sweetness="" type="checkbox" checked={Boolean(row.noSweetness)} onChange={event => update(index, { noSweetness: event.target.checked })} />No sweetness contribution</label>}<small>{item.carrier ? "No sweetness contribution · factor 0. " : ""}Customer-entered ingredients use your price and factor. They are not Hengliyuan reference prices.</small></div>}
            {item.carrier && !item.custom && <p className="blend-row-note">No sweetness contribution · factor 0. Carriers and excipients add cost and mass and dilute sweetness. Low-DE maltodextrin is treated as 0; for a sweeter grade, use a custom row and your own factor.</p>}
            {item.id === "sucralose" && <p className="blend-row-note">Sucralose is synthetic. A blend containing sucralose is not an all-natural blend. Check approval, use levels and labelling for your market and food category. This calculator does not approve a recipe or confirm market access.</p>}
            <button className="blend-remove" type="button" aria-label={`Remove row ${index + 1}`} onClick={() => { setTouched(true); setRows(current => current.filter((_, i) => i !== index)); }}><Trash2 size={17} aria-hidden="true" /></button>
          </div>;
        })}
      </div>
      <div className="blend-row-actions">
        <button id="blend-add" className="blend-add" type="button" disabled={rows.length >= rowLimit} onClick={() => addRow(available.id)}><Plus size={17} aria-hidden="true" />{rows.length >= rowLimit ? "Maximum 15 ingredients" : "Add preset ingredient"}</button>
        <button id="blend-add-custom" className="blend-add" type="button" disabled={rows.length >= rowLimit} onClick={() => addRow("custom")}>{rows.length >= rowLimit ? "Maximum 15 ingredients" : "Write your own ingredient"}</button>
        <span className={`blend-total ${complete ? "is-complete" : ""}`}><span>Total</span><strong data-testid="blend-percent-total">{total === null ? "—" : number(total, 6).replace(/\.?0+$/, "")}%</strong>{complete && <Check size={16} aria-label="Complete" />}</span>
      </div>
      <div className="blend-total-track" aria-hidden="true"><span style={{ width: `${total === null ? 0 : Math.max(0, Math.min(100, total))}%` }} /></div>
      <div className="blend-batch"><div><label htmlFor="blend-batch">Batch size</label><p>Target finished output, after processing loss.</p></div><div className="blend-input-field"><input id="blend-batch" type="number" inputMode="decimal" min="0" step="any" placeholder="e.g. 100" value={batch} onChange={event => { setBatch(event.target.value); setTouched(true); }} {...errorProps("blend-batch")} /><span className="blend-input-unit" aria-hidden="true">kg</span>{fieldError("blend-batch")}</div></div>
      <div className="blend-batch"><div><label htmlFor="blend-loss">Loss rate</label><p>Hengliyuan reference: 1%. Adjust for your own process if needed.</p></div><div className="blend-input-field"><input id="blend-loss" type="number" inputMode="decimal" min="0" max="100" step="any" placeholder="Enter rate" value={loss} onChange={event => { setLoss(event.target.value); setTouched(true); }} {...errorProps("blend-loss")} /><span className="blend-input-unit" aria-hidden="true">%</span>{fieldError("blend-loss")}</div></div>
      <div className="blend-fx">
        <label htmlFor="blend-fx">Exchange rate · 1 USD = CNY</label>
        <input id="blend-fx" type="number" inputMode="decimal" min="0" step="any" value={exchangeRate} placeholder={fxStatus === "loading" ? "Loading reference rate…" : "Enter your rate"} onChange={event => setCustomFx(event.target.value)} aria-invalid={customFx !== null && !fxValid} aria-describedby="blend-fx-note" />
        <div id="blend-fx-note" aria-live="polite">
          {customFx !== null && <p>{fxValid ? "Your exchange rate is in use." : "Enter a number greater than 0 to show USD amounts. USD amounts are hidden until then; CNY results are unaffected."}</p>}
          {referenceFx ? <p>Latest available Frankfurter reference: 1 USD = CNY {referenceFx.rate} · data date {referenceFx.date} · <a href="https://frankfurter.dev/" target="_blank" rel="noreferrer">Frankfurter</a></p> : <p>{fxStatus === "loading" ? "Loading the public reference rate." : "Public rate unavailable — enter your own rate or continue in CNY"}</p>}
          <p>USD equivalents are indicative, not a confirmed USD quotation. No formula or price inputs are sent to the rate provider.</p>
        </div>
        {customFx !== null && referenceFx && <button className="blend-reset" type="button" onClick={() => setCustomFx(null)}>Use public reference rate</button>}
      </div>
      <div className="blend-process"><label htmlFor="blend-process">Processing method</label><select id="blend-process" value={processId} onChange={event => { setProcessId(event.target.value); setTouched(true); }} {...errorProps("blend-process")}><option value="">Choose a method</option>{processes.map(item => <option value={item.id} key={item.id}>{item.name} · CNY {item.fee}/kg{fxValid ? ` ≈ USD ${dollars(item.fee)}/kg` : ""}</option>)}</select>{fieldError("blend-process")}<p>Both methods: CNY 5 per finished kg. Extract prices already include extraction; no extra extraction charge is added.</p></div>
      <p className="blend-price-note">{editedPrices ? "Your edited prices are in use." : `EXW reference prices · last confirmed ${priceConfirmedLabel} · editable, subject to confirmation.`}<br />Ingredient prices in CNY/kg, subject to confirmation.</p>
      <button className="blend-reset" type="button" onClick={() => { setRows(defaultRows()); setBatch(""); setLoss(defaultLossPercent); setProcessId(""); setCustomFx(null); setSweetnessFactors(defaultSweetnessFactors()); setTouched(false); }}><RotateCcw size={15} aria-hidden="true" />Reset</button>
      {Date.now() - Date.parse(priceConfirmedOn) > 90 * 86400000 && <p className="blend-field-error">{t(`Prices were last confirmed on ${priceConfirmedLabel} — please confirm current prices before quoting.`)}</p>}
      <div className={`blend-feedback ${result.ready ? "is-ready" : ""}`} id="blend-feedback" role="status" aria-live="polite">
        {result.ready ? <><Check size={16} aria-hidden="true" />Your formula totals 100%. Costs update as you edit.</> : <span>{touched ? result.errors[0]?.text : "Enter your percentages, batch size, loss rate and processing method."}</span>}
      </div>
    </section>
    <aside className="blend-summary" id="blend-results" aria-labelledby="blend-result-title"><a className="blend-back-link" href="#calculator">Back to inputs ↑</a>
      <div className="blend-result-panel">
        <p className="blend-step">02 / COST ESTIMATE</p>
        <h2 id="blend-result-title">Your blend, costed.</h2>
        <p className="blend-result-label">Cost per kg, including bulk cartons</p>
        <div className="blend-main-result"><span>CNY</span><output data-testid="blend-cost-per-kg">{result.ready ? money(result.packedCostPerKg) : "—"}</output><small>/ kg</small></div>
        <p className="blend-usd-result" data-testid="blend-usd-per-kg">≈ USD {result.ready ? dollars(result.packedCostPerKg) : "—"} / kg</p>
        <div className="blend-batch-result"><span>Total including bulk cartons{result.ready ? ` · ${number(result.batch, 3).replace(/\.?0+$/, "")} kg` : ""}</span><strong data-testid="blend-batch-total" role="status" aria-live="polite" aria-atomic="true" aria-label="Total including bulk cartons in CNY">{result.ready ? "CNY " + money(result.packedBatchTotal) : "—"}</strong></div>
        <p className="blend-usd-batch" data-testid="blend-usd-batch">≈ USD {result.ready ? dollars(result.packedBatchTotal) : "—"} per batch</p>
        <p className="blend-result-note">{resultDisclaimer}</p>
        <p className="blend-result-note">Bulk 25 kg cartons only. Retail filling and retail packaging are charged separately.</p>
        <div className="blend-result-actions">
          <button type="button" className="inquiry-trigger" aria-haspopup="dialog" onClick={() => onInquiry(t("Sweetener blend cost estimate"))}>Discuss this estimate / Request a sample</button>
          <button type="button" disabled={!result.ready} onClick={copyEstimate}>Copy summary</button>
          <button type="button" disabled={!result.ready} onClick={() => window.print()}>Print / save company PDF</button>
          <p role="status">{copyStatus}</p>
          {copyFallback && <label>Estimate summary<textarea readOnly rows={9} value={copyFallback} onFocus={event => event.target.select()} /></label>}
          <small>Copying stays on your device. Contacting us does not automatically send your formula. This estimate is not a confirmed quotation.</small>
        </div>
        <div className="blend-breakdown">
          <h3>Where the cost goes</h3>
          {result.ready && <p>Bulk blend: CNY {money(result.costPerKg)}/kg · CNY {money(result.batchTotal)} per batch (≈ USD {dollars(result.batchTotal)}).<br />25 kg cartons: {result.cartonCount} × CNY 5.50 = CNY {money(result.packagingCost)} (≈ USD {dollars(result.packagingCost)}).</p>}
          {result.ready ? <ul>{result.lineItems.filter(item => item.percent > 0).map((item, index) => <li key={index}><div><span>{item.custom ? <span translate="no">{item.name}</span> : ingredientLabel(item)}<small>{t(`${quantity(item.mass)} kg input for this batch`)}</small></span><strong>{money(item.costPerKg)}<small>CNY/kg of blend<br />≈ USD {dollars(item.costPerKg)}/kg</small></strong></div><div className="blend-cost-track" aria-hidden="true"><span style={{ width: `${result.costPerKg > 0 ? item.costPerKg / result.packedCostPerKg * 100 : 0}%` }} /></div></li>)}<li><div><span>{result.process.name}<small>CNY 5 per finished kg</small></span><strong>{money(result.process.fee)}<small>CNY/kg of blend<br />≈ USD {dollars(result.process.fee)}/kg</small></strong></div><div className="blend-cost-track" aria-hidden="true"><span style={{ width: `${result.process.fee / result.packedCostPerKg * 100}%` }} /></div></li><li><div><span>Bulk cartons<small>{result.cartonCount} cartons · 25 kg capacity · CNY 5.50 each (≈ USD {dollars(5.5)})</small></span><strong>{money(result.packagingCostPerKg)}<small>CNY/kg of blend<br />≈ USD {dollars(result.packagingCostPerKg)}/kg</small></strong></div></li></ul> : <div className="blend-empty"><Calculator size={25} strokeWidth={1.4} aria-hidden="true" /><p>Your cost breakdown will appear here.</p><small>Complete a 100% formula to begin.</small></div>}
        </div>
        <p className="blend-result-note">Reference estimate, subject to confirmation.<br />Includes entered loss and CNY 5/kg blending.<br />Includes 25 kg cartons at CNY 5.50 each, rounded up.<br />Retail filling and retail packaging are charged separately.<br />USD equivalents use the displayed exchange rate and are subject to confirmation.<br />Delivery and taxes are not included.<br />Totals are calculated from unrounded values and shown to 2 decimal places, so rounded line items may differ from the rounded total by 0.01.</p>
      </div>
      <section className="blend-sweetness blend-sweetness-calculator" aria-labelledby="blend-sweetness-title">
        <h3 id="blend-sweetness-title">Estimated sweetness</h3>
        <div id="blend-sweetness-status" aria-live="polite">
          {sweetness.ready ? <><output className="blend-sweetness-value" data-testid="blend-sweetness-factor">{t(`≈ ${number(sweetness.factor, 2)}× sucrose`)}</output><p>{t(`1 kg of this blend has an estimated sweetness equivalent to ${number(sweetness.factor, 2)} kg of sucrose.`)}</p>{sweetness.batchEquivalent !== null && <p data-testid="blend-sweetness-batch">{t(`For this batch: ≈ ${number(sweetness.batchEquivalent, 2)} kg sucrose equivalent.`)}</p>}</> : <p data-testid="blend-sweetness-message">{sweetness.reason}</p>}
        </div>
        <p>Linear estimate from the mass percentages and factors below. No synergy adjustment is applied. Concentration, pH and the food or drink can change perceived sweetness. This estimates sweetness, not sugar's bulk or texture.</p>
        <details className="blend-factor-editor"><summary>Edit sweetness factors · sucrose = 1</summary>
          <p>Published references, not measurements of Hengliyuan batches or statements about our suppliers. Monk fruit factors use a conservative supplier grade scale; measured values vary by method. For RA98 and RM95, enter one factor within the displayed range; no midpoint is assumed. Other reference factors are prefilled and editable. Validate sweetness by sensory testing in your application.</p>
          {activeIngredients.map(item => <div className="blend-factor-row" data-sweetness-id={item.id} key={item.id}>
            <strong>{ingredientLabel(item)}</strong>
            <label className="blend-factor-value"><span>Relative sweetness · sucrose = 1{sweetnessReferences[item.id].min !== sweetnessReferences[item.id].max ? ` · allowed ${sweetnessReferences[item.id].min}–${sweetnessReferences[item.id].max}` : ` · reference ≈ ${sweetnessReferences[item.id].min}`}</span><input type="number" min={sweetnessReferences[item.id].min !== sweetnessReferences[item.id].max ? sweetnessReferences[item.id].min : 0} max={sweetnessReferences[item.id].min !== sweetnessReferences[item.id].max ? sweetnessReferences[item.id].max : undefined} step="any" data-sweetness-factor="" aria-invalid={!calculateSweetness([{ ingredientId: item.id, percent: "100" }], sweetnessFactors, batch).ready} aria-describedby="blend-sweetness-status" aria-label={`${ingredientLabel(item)} sweetness factor`} placeholder={sweetnessReferences[item.id].min !== sweetnessReferences[item.id].max ? `Enter ${sweetnessReferences[item.id].min}–${sweetnessReferences[item.id].max}` : "Enter factor"} disabled={item.carrier} value={item.carrier ? "0" : sweetnessFactors[item.id]} onChange={event => setSweetnessFactors(current => ({ ...current, [item.id]: event.target.value }))} /></label>
            {item.carrier && <p>No sweetness contribution</p>}{sweetnessReferences[item.id].url ? <a href={sweetnessReferences[item.id].url} target="_blank" rel="noreferrer">Reference: {sweetnessReferences[item.id].source}</a> : <small>{sweetnessReferences[item.id].source}</small>}
          </div>)}
          {rows.filter(row => ingredientForRow(row)?.custom).map((row, index) => <p key={`custom-${index}`}>{row.name ? <span translate="no">{row.name}</span> : "Custom ingredient"} · Customer-entered · {row.noSweetness || ingredientForRow(row).carrier ? "0 · No sweetness contribution" : row.factor === "" ? "Enter factor in its ingredient row" : `factor ${row.factor}`}</p>)}
        </details>
      </section>
    </aside>
    {result.ready && <CompanyToolDocument title="SWEETENER BLEND COST WORKSHEET" category="INDICATIVE COST ESTIMATE" text={formatBlendSummary(result, {exchangeRate, sweetness, factors:sweetnessFactors, rateDate:customFx===null?referenceFx?.date:null, customRate:customFx!==null, translate:t, path:pagePath})} />}
  </div>);
}

export default function SweetenerToolsPage({ pageKey, onInquiry, languageCode = "EN" }) {
  const contentLanguage = toolsContentLanguage(languageCode);
  const homePath = languageCode === "EN" ? "/" : `/${toolsLanguages[languageCode]}/`;
  const calcPath = toolsPath(languageCode, true);
  const hubPath = toolsPath(languageCode);
  return (<div className="sweetener-tools-page" lang={contentLanguage} dir="ltr">
    <div className="blend-container">
      <nav className="blend-breadcrumb" aria-label="Breadcrumb"><a href={homePath}>Home</a><span>/</span><a href={hubPath}>Tools</a><span>/</span><span aria-current="page">Blend cost calculator</span></nav>
      <header className="blend-hero"><div><p className="blend-eyebrow">HENGLIYUAN / FORMULATION TOOLS</p><h1>Sweetener blend<br /><span>cost and sweetness calculator.</span></h1><p>See what goes into your blend.<br className="blend-desktop-break" /> Know what it costs after loss and blending.</p></div><a className="blend-hero-note" href="#how-it-works"><span>Free to use. No login.</span><span>How the calculation works <ArrowDown size={15} aria-hidden="true" /></span></a></header>
      <noscript><p className="blend-noscript">Enable JavaScript to calculate costs. The formulas and reference information remain available below.</p></noscript>
      <BlendCalculator onInquiry={onInquiry} languageCode={languageCode} />
      <section className="blend-reading" id="how-it-works" aria-labelledby="blend-explainer-title"><div className="blend-reading-heading"><p className="blend-eyebrow">BEHIND THE NUMBERS</p><h2 id="blend-explainer-title">A clearer view of<br />your blend cost.</h2><a href={languageCode === "CN" ? "/zh/products/custom-sweetener-blends/" : languageCode === "TC" ? "/zh-hant/products/custom-sweetener-blends/" : "/en/products/custom-sweetener-blends/"}>Explore custom blends <ArrowRight size={16} aria-hidden="true" /></a></div><div className="blend-prose">{explanation.map(([heading, body]) => <section key={heading}><h3>{heading}</h3><p>{body}</p></section>)}</div></section>
      <section className="blend-worked-example" aria-labelledby="blend-example-title"><p className="blend-eyebrow">WORKED EXAMPLE</p><h2 id="blend-example-title">How the numbers add up</h2><p>Arithmetic example only, not a recommended formulation or a confirmed quotation. Assume 99% erythritol at CNY 11/kg, 1% Mogroside V 25% at CNY 1,030/kg, 1% proportional loss and CNY 5/kg blending.</p><table><caption>Same hypothetical blend, two finished batch sizes</caption><thead><tr><th scope="col">Finished batch</th><th scope="col">Blend subtotal</th><th scope="col">25 kg cartons</th><th scope="col">Total with cartons</th></tr></thead><tbody><tr><th scope="row">100 kg</th><td>CNY 2,640.40</td><td>4 × 5.50 = CNY 22.00</td><td>CNY 2,662.40</td></tr><tr><th scope="row">101 kg</th><td>CNY 2,666.81</td><td>5 × 5.50 = CNY 27.50</td><td>CNY 2,694.31</td></tr></tbody></table><p>Blend cost before cartons: [(0.99 × 11 + 0.01 × 1,030) ÷ 0.99] + 5 = approximately CNY 26.40404 per finished kg. The final carton is charged as a whole carton. Values are calculated before rounding; totals are then shown to two decimal places. Retail filling, retail packaging, delivery and taxes are excluded. No taste or application performance is implied.</p></section>
      <section className="blend-formulas" aria-labelledby="blend-formula-title"><div><p className="blend-eyebrow">THE FORMULAS</p><h2 id="blend-formula-title">Nothing hidden in the math.</h2><p>Percentages are by mass and must total 100%.</p></div><dl><div><dt>Bulk blend cost per kg</dt><dd>[Σ (ingredient % ÷ 100 × ingredient price in CNY/kg) ÷ (1 − loss % ÷ 100)] + CNY 5/kg</dd></div><div><dt>Bulk blend batch cost</dt><dd>Bulk blend cost per kg × finished batch size in kg</dd></div><div><dt>Ingredient input mass</dt><dd>Ingredient % ÷ 100 × finished batch size in kg ÷ (1 − loss % ÷ 100)</dd></div><div><dt>Bulk cartons</dt><dd>Round up (finished batch kg ÷ 25) × CNY 5.50</dd></div><div><dt>Total including bulk cartons</dt><dd>Bulk blend batch cost + bulk carton cost; divide by finished batch kg for cost per kg</dd></div><div><dt>USD comparison</dt><dd>CNY amount ÷ exchange rate in CNY per USD</dd></div><div><dt>Estimated relative sweetness</dt><dd>Σ (ingredient % ÷ 100 × selected relative sweetness factor)</dd></div><div><dt>Sucrose-equivalent batch mass</dt><dd>Finished batch kg × estimated relative sweetness; no loss multiplier</dd></div></dl></section>
      <section className="blend-faq" aria-labelledby="blend-faq-title"><div><p className="blend-eyebrow">A FEW USEFUL ANSWERS</p><h2 id="blend-faq-title">Frequently asked questions.</h2></div><div>{faqs.map(([question, answer], index) => <details key={question}><summary><span className="blend-faq-number">{String(index + 1).padStart(2, "0")}</span><span>{question}</span><Plus size={18} aria-hidden="true" /></summary><p>{answer}</p></details>)}</div></section>
      <section className="blend-related" aria-labelledby="blend-related-title"><h2 id="blend-related-title">Take the next step.</h2><div>{relatedGuides.map(([label, href]) => <a href={["CN", "TC"].includes(languageCode) ? href.replace(/^\/en\//, `/${toolsLanguages[languageCode]}/`) : href} key={href}>{label}<ArrowRight size={18} aria-hidden="true" /></a>)}</div></section>
      <p className="blend-attribution">Calculation adapted from <a href="https://github.com/SillieOrg/recipe-price-calculator" target="_blank" rel="noreferrer">Recipe Price Calculator</a> · <a href="/licenses/recipe-price-calculator-MIT.txt">MIT license</a>.</p>
    </div>
  </div>);
}
