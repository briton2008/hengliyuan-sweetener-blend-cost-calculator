// Cost calculation and editable recipe rows adapted from SillieOrg/recipe-price-calculator.
// Copyright (c) 2026 Andy Ellis. MIT: /licenses/recipe-price-calculator-MIT.txt
export const calculatorPath = "/tools/sweetener-blend-cost-calculator/";
// Update this confirmation date only with confirmed prices, never from the visitor's clock.
export const priceConfirmedOn = "2026-10-24";
export const priceConfirmedLabel = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(priceConfirmedOn));
export const resultDisclaimer = "Indicative EXW reference only — not a confirmed quotation. Bulk cartons included; retail filling, retail packaging, freight, insurance, duties, and taxes excluded. Confirm scope and current prices before ordering.";
export const ingredients = [
  { id: "erythritol", name: "Erythritol", grade: "Bulk sweetener", price: 11 },
  { id: "monk-v25", name: "Monk fruit extract", grade: "Mogroside V 25%", price: 1030 },
  { id: "allulose", name: "Allulose", grade: "99%", price: 18 },
  { id: "stevia-ra98", name: "Stevia", grade: "RA98", price: 340 },
  { id: "stevia-rm95", name: "Stevia", grade: "RM95", price: 510 },
  { id: "monk-v50", name: "Monk fruit extract", grade: "Mogroside V 50%", price: 2000 },
  { id: "xylitol", name: "Xylitol", grade: "Bulk sweetener" },
  { id: "maltitol", name: "Maltitol", grade: "Bulk sweetener" },
  { id: "sorbitol", name: "Sorbitol", grade: "Bulk sweetener" },
  { id: "sucralose", name: "Sucralose", grade: "High-intensity sweetener" },
  { id: "maltodextrin", name: "Maltodextrin", grade: "Low DE", carrier: true },
  { id: "silicon-dioxide", name: "Silicon dioxide", grade: "Anti-caking", carrier: true },
  { id: "other-carrier", name: "Other carrier / excipient", grade: "Customer-entered", carrier: true, custom: true },
];
export const rowLimit = 15;
export const ingredientGroups = [
  { label: "Bulk sweeteners", ids: ["erythritol", "allulose", "xylitol", "maltitol", "sorbitol"] },
  { label: "High-intensity sweeteners", ids: ["monk-v25", "monk-v50", "stevia-ra98", "stevia-rm95", "sucralose"] },
  { label: "Carriers and excipients", ids: ["maltodextrin", "silicon-dioxide", "other-carrier"] },
];
export const ingredientForRow = row => row.ingredientId === "custom"
  ? { id: "custom", name: row.name ?? "", grade: "Customer-entered", custom: true }
  : ingredients.find(item => item.id === row.ingredientId)?.custom
    ? { ...ingredients.find(item => item.id === row.ingredientId), name: row.name ?? "" }
    : ingredients.find(item => item.id === row.ingredientId);
export const newIngredientRow = ingredientId => ({ ingredientId, percent: "", price: String(ingredients.find(item => item.id === ingredientId)?.price ?? ""), name: "", factor: "", noSweetness: false });
export const bulkCarton = { capacityKg: 25, price: 5.5 };
export const defaultLossPercent = "1";
export const defaultRows = () => ingredients.slice(0, 2).map(item => ({ ingredientId: item.id, percent: "", price: String(item.price) }));
export const processes = [
  { id: "fluid-bed", name: "Fluid-bed granulation", fee: 5 },
  { id: "high-speed", name: "High-speed mixing", fee: 5 },
];

const numeric = value => (typeof value === "number" || typeof value === "string" && value.trim() !== "") ? Number(value) : NaN;

export const referenceFxUrl = "https://api.frankfurter.dev/v2/rate/USD/CNY";
export function readReferenceFx(data) {
  if (data?.base !== "USD" || data?.quote !== "CNY" || typeof data.rate !== "number" || !Number.isFinite(data.rate) || data.rate <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(data.date) || !Number.isFinite(Date.parse(data.date)) || data.date > new Date().toISOString().slice(0, 10)) throw new Error("Invalid reference exchange rate");
  return { rate: data.rate, date: data.date };
}

export function cnyToUsd(amount, cnyPerUsd) {
  const value = numeric(amount), rate = numeric(cnyPerUsd);
  const converted = value / rate;
  return Number.isFinite(value) && value >= 0 && Number.isFinite(rate) && rate > 0 && Number.isFinite(converted) ? converted : null;
}

// Weight-only adaptation of upstream calculateIngredientCost: package price is CNY per 1 kg.
export function calculateIngredientCost(quantity, price) {
  return (quantity / 1) * price;
}

export function calculateBlend(rows, batchInput, lossInput, processId) {
  const errors = [];
  const batch = numeric(batchInput);
  const lossPercent = numeric(lossInput);
  const process = processes.find(item => item.id === processId);
  if (!Number.isFinite(batch) || batch <= 0) errors.push({ field: "blend-batch", text: "Enter a batch size greater than 0 kg." });
  if (!Number.isFinite(lossPercent) || lossPercent < 0 || lossPercent >= 100) errors.push({ field: "blend-loss", text: "Enter a loss rate from 0% to less than 100%." });
  if (!process) errors.push({ field: "blend-process", text: "Choose a processing method. Both methods cost CNY 5 per finished kg." });
  if (!rows.length) errors.push({ field: "blend-add", text: "Add at least one ingredient." });
  if (rows.length > rowLimit) errors.push({ field: "blend-add", text: "Maximum 15 ingredients." });
  const parsed = rows.map((row, index) => {
    const ingredient = ingredientForRow(row);
    const percent = numeric(row.percent);
    const price = numeric(row.price);
    if (!ingredient) errors.push({ field: `blend-ingredient-${index}`, text: "Choose a listed ingredient." });
    if (ingredient?.custom && (typeof row.name !== "string" || !row.name.trim() || row.name.length > 40 || /[\r\n]/.test(row.name))) errors.push({ field: `blend-name-${index}`, text: "Enter a name for the custom ingredient (up to 40 characters), or remove the row." });
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) errors.push({ field: `blend-percent-${index}`, text: `Row ${index + 1}: enter a percentage from 0 to 100, or remove the row.` });
    if (!Number.isFinite(price) || price < 0) errors.push({ field: `blend-price-${index}`, text: `Row ${index + 1}: enter a price of 0 CNY/kg or more.` });
    return { ...ingredient, percent, price, enteredPrice: row.price, factor: row.factor, noSweetness: row.noSweetness };
  });
  const totalPercent = parsed.reduce((sum, row) => sum + row.percent, 0);
  if (Number.isFinite(totalPercent) && Math.abs(totalPercent - 100) > 1e-8) errors.push({ field: "blend-percent-0", text: "Ingredient percentages must total 100%. Your entries are not adjusted automatically." });
  if (errors.length) return { ready: false, errors, totalPercent };
  const yieldFraction = 1 - lossPercent / 100;
  const lineItems = parsed.map(row => ({
    ...row, mass: batch * (row.percent / 100) / yieldFraction,
    costPerKg: calculateIngredientCost(row.percent / 100, row.price) / yieldFraction,
    batchCost: calculateIngredientCost(batch * (row.percent / 100) / yieldFraction, row.price),
  }));
  const rawMaterialCostPerKg = lineItems.reduce((sum, row) => sum + row.costPerKg, 0);
  const costPerKg = rawMaterialCostPerKg + process.fee;
  const batchTotal = calculateIngredientCost(batch, costPerKg);
  const cartonCount = Math.ceil(batch / bulkCarton.capacityKg);
  const packagingCost = cartonCount * bulkCarton.price;
  const packedBatchTotal = batchTotal + packagingCost;
  const packagingCostPerKg = packagingCost / batch;
  const packedCostPerKg = packedBatchTotal / batch;
  if (![packedCostPerKg, packedBatchTotal, costPerKg, batchTotal, ...lineItems.flatMap(row => [row.mass, row.batchCost])].every(Number.isFinite)) {
    return { ready: false, totalPercent, errors: [{ field: "blend-batch", text: "These values are too large to calculate. Reduce the batch size or prices." }] };
  }
  return { ready: true, errors: [], totalPercent, batch, lossPercent, process, lineItems, rawMaterialCostPerKg, costPerKg, batchTotal, cartonCount, packagingCost, packagingCostPerKg, packedBatchTotal, packedCostPerKg };
}


// Published references approved by briton on 2026-10-25; not Hengliyuan batch measurements.
export const sweetnessReferences = {
  erythritol: { min: 0.7, max: 0.7, source: "Cargill Zerose Erythritol", url: "https://www.univarsolutions.com/erythritol-zerose-fcchal-k-836186?v=16158315" },
  "monk-v25": { min: 100, max: 100, source: "Supplier grade scale — Mogroside V 25%", url: "https://ahelite.en.made-in-china.com/product/PvoJNmnKaCRx/China-Good-Water-Solubility-and-Zero-Calories-Monk-Fruit-Extract-Mv-25-Powder.html" },
  allulose: { min: 0.7, max: 0.7, source: "Tate & Lyle DOLCIA PRIMA Allulose", url: "https://www.tateandlyle.com/ingredient/dolcia-prima-allulose" },
  "monk-v50": { min: 200, max: 200, source: "Supplier grade scale — Mogroside V 50%", url: "https://ahelite.en.made-in-china.com/product/PvoJNmnKaCRx/China-Good-Water-Solubility-and-Zero-Calories-Monk-Fruit-Extract-Mv-25-Powder.html" },
  "stevia-ra98": { min: 250, max: 300, source: "Icon Foods SteviaSweet RA98", url: "https://store.iconfoods.com/images/blog/NewFolder/1005%20SteviaSweet%20RA98_SpecSheet_Icon%20Foods.pdf?_t=1698092390" },
  "stevia-rm95": { min: 250, max: 300, source: "Icon Foods SteviaSweet RM95", url: "https://www.iconfoods.com/wp-content/uploads/2026/05/Spec-Sheet-SteviaSweet-RM95.pdf" },
  xylitol: { min: 1, max: 1, source: "Icon Foods Xylitol", url: "https://www.iconfoods.com/ingredient/xylitol/" },
  maltitol: { min: 0.9, max: 0.9, source: "Icon Foods Maltitol", url: "https://www.iconfoods.com/ingredient/maltitol/" },
  sorbitol: { min: 0.6, max: 0.6, source: "Cargill Sorbidex Sorbitol", url: "https://www.cargill.com/food-bev/ap/sorbidex-sorbitol" },
  sucralose: { min: 600, max: 600, source: "FDA sweetener comparison", url: "https://www.fda.gov/food/food-additives-petitions/aspartame-and-other-sweeteners-food" },
  maltodextrin: { min: 0, max: 0, source: "USP maltodextrin; zero-factor estimate", url: "https://doi.usp.org/USPNF/USPNF_M47125_04_01.html" },
  "silicon-dioxide": { min: 0, max: 0, source: "Zero-factor estimate — no sweetness contribution" },
};
export const defaultSweetnessFactors = () => Object.fromEntries(Object.entries(sweetnessReferences).map(([id, data]) => [id, data.min === data.max ? String(data.min) : ""]));
export function sweetnessFactor(row, factors) {
  const item = ingredientForRow({ ...row, ingredientId: row.ingredientId ?? row.id });
  return item?.carrier || item?.custom && row.noSweetness ? 0 : numeric(item?.custom ? row.factor : factors?.[item?.id]);
}

export function calculateSweetness(rows, factors, batchInput) {
  if (!rows.length) return { ready: false, reason: "Add ingredients and enter percentages totaling 100%." };
  let total = 0, factor = 0;
  for (const row of rows) {
    const percent = numeric(row.percent);
    const item = ingredientForRow(row);
    if (!item || !Number.isFinite(percent) || percent < 0 || percent > 100) return { ready: false, reason: "Enter valid ingredient percentages totaling 100%." };
    if (item.custom && !row.name?.trim()) return { ready: false, reason: "Enter a name for the custom ingredient, or remove the row." };
    total += percent;
    if (percent === 0) continue;
    const value = sweetnessFactor(row, factors);
    const reference = sweetnessReferences[row.ingredientId];
    const ranged = reference && reference.min !== reference.max;
    if (!Number.isFinite(value) || value < 0 || ranged && (value < reference.min || value > reference.max)) {
      if (item.custom) return { ready: false, reason: `Enter a sweetness factor for ${item.name || "your custom ingredient"}, or tick 'No sweetness contribution'.` };
      return { ready: false, reason: ranged ? `Enter a sweetness factor from ${reference.min} to ${reference.max} for ${item.name} ${item.grade}.` : `Enter a non-negative sweetness factor for ${item.name}.` };
    }
    factor += percent / 100 * value;
  }
  if (Math.abs(total - 100) > 1e-8) return { ready: false, reason: "Ingredient percentages must total 100% for sweetness conversion." };
  if (!Number.isFinite(factor)) return { ready: false, reason: "Sweetness factors are too large to calculate." };
  const batch = numeric(batchInput);
  const batchEquivalent = Number.isFinite(batch) && batch > 0 && Number.isFinite(batch * factor) ? batch * factor : null;
  return { ready: true, factor, batchEquivalent };
}

export function formatBlendSummary(result, { exchangeRate, sweetness, factors = defaultSweetnessFactors(), rateDate, customRate = false, translate = value => value, path = calculatorPath, date = new Date().toISOString().slice(0, 10) } = {}) {
  if (!result?.ready) return null;
  const money = value => new Intl.NumberFormat('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  const usd = cnyToUsd(result.packedBatchTotal, exchangeRate);
  return [
    translate('Hengliyuan sweetener blend estimate · ' + date),
    ...result.lineItems.filter(item => item.percent > 0).map(item => {
      const factor = sweetnessFactor(item, factors);
      return (item.custom ? item.name : translate(item.name)) + translate(` (${item.grade}): ${item.percent}% at CNY ${item.enteredPrice}/kg; sweetness factor ${Number.isFinite(factor) ? item.carrier || item.noSweetness ? '0 (No sweetness contribution)' : item.custom ? item.factor : factors[item.id] : 'not entered'}${item.custom || ingredients.find(x => x.id === item.id)?.price === undefined ? '; Customer-entered' : ''}`);
    }),
    translate(`Finished batch: ${result.batch} kg; proportional loss: ${result.lossPercent}%.`),
    translate(`${result.process.name}: CNY ${money(result.process.fee)} per finished kg.`),
    translate(`Bulk blend cost: CNY ${money(result.costPerKg)}/kg. Reference prices last confirmed ${priceConfirmedLabel}; edited prices may differ.`),
    translate(`Bulk blend subtotal: CNY ${money(result.batchTotal)}.`),
    translate(`25 kg cartons: ${result.cartonCount} × CNY 5.50 = CNY ${money(result.packagingCost)}.`),
    translate(`Total with bulk cartons: CNY ${money(result.packedBatchTotal)}; CNY ${money(result.packedCostPerKg)}/kg.`),
    translate(usd === null ? 'USD comparison unavailable.' : `Indicative USD total: ${money(usd)} at 1 USD = CNY ${exchangeRate}; ${customRate ? 'customer-entered rate, data date not supplied' : rateDate ? `Frankfurter data date ${rateDate}` : 'rate data date unavailable'}.`),
    translate(sweetness?.ready ? `Theoretical sweetness: ${money(sweetness.factor)}× sucrose; ${sweetness.batchEquivalent === null ? 'batch equivalent unavailable' : `${money(sweetness.batchEquivalent)} kg sucrose equivalent for this batch`}; linear estimate, not measured performance.` : 'Sweetness has not been established by this cost estimate.'),
    translate(resultDisclaimer),
    translate('Not a recommended formulation. Validate taste and application performance separately.'),
    'https://heng-li-yuan.com' + path,
  ].join('\n');
}
