import test from "node:test";
import assert from "node:assert/strict";
import { calculateBlend, ingredients, defaultRows, defaultLossPercent, cnyToUsd, readReferenceFx, defaultSweetnessFactors, calculateSweetness, newIngredientRow, rowLimit, formatBlendSummary } from "../src/sweetener-blend-cost.mjs";
import { explanation, faqs, toolsSchema } from "../src/sweetener-tools-content.mjs";
const row = (ingredientId, percent, price = ingredients.find(i => i.id === ingredientId).price) => ({ ingredientId, percent: String(percent), price: String(price) });
const cost = (rows, batch) => calculateBlend(rows, batch, 0, "fluid-bed");
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test("confirmed catalog prices and empty state have no invented values or default formulation", () => {
  assert.deepEqual(ingredients.filter(i => i.price !== undefined).map(i => [i.id, i.price]), [["erythritol",11],["monk-v25",1030],["allulose",18],["stevia-ra98",340],["stevia-rm95",510],["monk-v50",2000]]);
  assert.ok(defaultRows().every(i => i.percent === ""));
  assert.equal(cost(defaultRows(), "").ready, false);
  assert.equal(cost([], 100).ready, false);
});

test("new presets have no invented prices and their confirmed reference factors remain editable", () => {
  const factors = defaultSweetnessFactors();
  for (const [id, factor] of [["xylitol",1],["maltitol",.9],["sorbitol",.6],["sucralose",600]]) {
    assert.equal(newIngredientRow(id).price, "");
    assert.equal(ingredients.find(x=>x.id===id).price, undefined);
    assert.equal(factors[id], String(factor));
    assert.equal(calculateBlend([{...newIngredientRow(id),percent:"100"}],100,1,"fluid-bed").ready,false);
    close(calculateSweetness([row(id,100,20)],{...factors,[id]:"2"},100).factor,2);
  }
  assert.equal(ingredients.some(x=>["monk-v40","isomalt","mannitol","lactitol"].includes(x.id)),false);
});

test("carriers add loss-adjusted cost and mass but dilute sweetness with a locked zero factor", () => {
  const rows=[row("erythritol",90),row("maltodextrin",9,8),row("monk-v25",1)];
  const blend=calculateBlend(rows,100,1,"fluid-bed"),sweet=calculateSweetness(rows,{...defaultSweetnessFactors(),maltodextrin:"100"},100);
  assert.equal(blend.ready,true);close(blend.lineItems[1].mass,9/.99);close(blend.lineItems[1].batchCost,9/.99*8);
  close(blend.packedBatchTotal,2635.131313131313);close(sweet.factor,1.63);close(sweet.batchEquivalent,163);
  for(const id of ["silicon-dioxide","other-carrier"]) {
    const only=[{...newIngredientRow(id),name:"Test carrier",percent:"100",price:"1"}];
    assert.equal(calculateBlend(only,100,1,"fluid-bed").ready,true);close(calculateSweetness(only,{},100).factor,0);
  }
});

test("customer-written names, precise prices and independent sweetness states survive calculations and copying", () => {
  const custom={...newIngredientRow("custom"),name:"Test ingredient α",percent:"10",price:"2.345",factor:"2.5000"};
  const rows=[row("erythritol",90),custom],factors=defaultSweetnessFactors();
  const blend=calculateBlend(rows,100,1,"fluid-bed");assert.equal(blend.ready,true);
  close(calculateSweetness(rows,factors,100).factor,.88);
  const copied=formatBlendSummary(blend,{factors,sweetness:calculateSweetness(rows,factors,100)});
  assert.ok(copied.includes("Test ingredient α"));assert.ok(copied.includes("2.345/kg"));assert.ok(copied.includes("factor 2.5000"));assert.ok(copied.includes("Customer-entered"));
  close(calculateSweetness([rows[0],{...custom,noSweetness:true}],factors,100).factor,.63);
  for(const factor of ["",-1,Infinity,"bad"]) {
    const changed=[rows[0],{...custom,factor}];assert.equal(calculateSweetness(changed,factors,100).ready,false);
    assert.equal(calculateBlend(changed,100,1,"fluid-bed").ready,true);
  }
  const duplicate=[row("erythritol",50),{...custom,name:"Erythritol",percent:"50"}];
  assert.equal(calculateBlend(duplicate,100,1,"fluid-bed").ready,true);
});

test("customer name and row-count boundaries are checked independently of browser input attributes", () => {
  for(const name of ["","   ","x".repeat(41),"one\ntwo"]) {
    assert.equal(calculateBlend([{...newIngredientRow("custom"),name,percent:"100",price:"1"}],100,1,"fluid-bed").ready,false);
  }
  const rows=Array.from({length:rowLimit},(_,i)=>({...newIngredientRow("custom"),name:`Item ${i}`,percent:i===0?"100":"0",price:"0",noSweetness:true}));
  assert.equal(calculateBlend(rows,100,1,"fluid-bed").ready,true);
  assert.equal(calculateBlend([...rows,{...rows[1]}],100,1,"fluid-bed").ready,false);
});
test("blend cost and batch scaling use unrounded values", () => {
  // Arithmetic fixture only; this is not a recommended formulation or sweetness estimate.
  const rows = [row("erythritol", 99), row("monk-v25", 1)];
  const result = cost(rows, 100);
  assert.equal(result.ready, true);
  close(result.costPerKg, 26.19);
  close(result.batchTotal, 2619);
  assert.deepEqual(result.lineItems.map(i => i.mass), [99, 1]);
  const scaled = cost(rows, 250);
  close(scaled.costPerKg, result.costPerKg);
  close(scaled.batchTotal, 6547.5);
  assert.equal(scaled.lineItems[1].mass, 2.5);
});
test("all six grades and zero shares work without interpreting grade as sweetness", () => {
  const rows = ingredients.filter(i => i.price !== undefined).map((i, index) => row(i.id, index === 5 ? 100 : 0));
  const result = cost(rows, 1);
  assert.equal(result.ready, true);
  close(result.costPerKg, 2005);
  assert.ok(!("sweetness" in result));
  assert.equal(cost([row("stevia-rm95",100,0)], 10).batchTotal, 50);
});
test("percentages are never normalized and blank/invalid inputs never produce a partial total", () => {
  for (const shares of [[99,0],[100,1],[-1,101],[99,""],[100,"NaN"],[99.999999,0]]) {
    const result = cost([row("erythritol",shares[0]),row("monk-v25",shares[1])],100);
    assert.equal(result.ready, false);
    assert.equal(result.costPerKg, undefined);
  }
  for (const batch of ["",0,-1,Infinity,"bad",null,undefined]) assert.equal(cost([row("allulose",100)],batch).ready,false);
  for (const price of ["",-1,Infinity,"NaN"]) assert.equal(cost([row("allulose",100,price)],100).ready,false);
  assert.equal(cost([row("allulose",100)],1e308).ready,false);
});
test("decimal proportions remain precise and edited prices are used", () => {
  const result = cost([row("erythritol",99.987654),row("monk-v25",0.012346)],0.125);
  assert.equal(result.ready,true);
  close(result.costPerKg,16.12580574);
  close(result.batchTotal,result.costPerKg*.125);
  close(cost([row("allulose",100,19)],2).batchTotal,48);
});
test("content length, useful FAQ and application schema stay inside the brief", () => {
  const words=explanation.map(([,text])=>text).join(" ").split(/\s+/).length;
  assert.ok(words>=300&&words<=500, `Explanation has ${words} words`);
  assert.ok(faqs.length>=5&&faqs.length<=8);
  const schema=toolsSchema(true);
  assert.equal(schema["@type"],"WebApplication");
  assert.equal(schema.url,"https://heng-li-yuan.com/tools/sweetener-blend-cost-calculator/");
  assert.ok(!("aggregateRating" in schema));
  assert.ok(!("review" in schema));
  assert.ok(explanation.some(([,text])=>text.includes("Retail filling and retail packaging are charged separately.")));
  assert.ok(faqs.some(([,text])=>text.includes("Retail filling and retail packaging are charged separately")));
});

// These loss rates are arithmetic fixtures, not recommended process-loss rates.
test("both processes add exactly 5 per finished kg after the loss adjustment", () => {
  const rows=[row("erythritol",99),row("monk-v25",1)];
  const fluid=calculateBlend(rows,100,2,"fluid-bed");
  const mixed=calculateBlend(rows,100,2,"high-speed");
  assert.equal(fluid.ready,true);
  assert.equal(mixed.ready,true);
  close(fluid.rawMaterialCostPerKg,21.19/0.98);
  close(fluid.costPerKg,21.19/0.98+5);
  close(fluid.batchTotal,(21.19/0.98+5)*100);
  close(fluid.lineItems.reduce((sum,item)=>sum+item.mass,0),100/0.98);
  close(fluid.lineItems.reduce((sum,item)=>sum+item.batchCost,0)+500,fluid.batchTotal);
  assert.equal(fluid.costPerKg,mixed.costPerKg);
  assert.equal(fluid.batchTotal,mixed.batchTotal);
  close(calculateBlend([row("monk-v25",100)],1,0,"fluid-bed").costPerKg,1035);
});
test("loss rate and process are explicit; invalid inputs do not produce a result", () => {
  for(const loss of ["",null,undefined,-1,100,101,Infinity,"bad"]){
    const result=calculateBlend([row("allulose",100)],100,loss,"fluid-bed");
    assert.equal(result.ready,false);
    assert.equal(result.batchTotal,undefined);
  }
  for(const process of ["",undefined,"unknown"])
    assert.equal(calculateBlend([row("allulose",100)],100,0,process).ready,false);
  assert.equal(calculateBlend([row("allulose",100)],100,99.9999,"high-speed").ready,true);
});

test("confirmed default loss is one percent for either process", () => {
  assert.equal(defaultLossPercent, "1");
  for (const process of ["fluid-bed", "high-speed"]) {
    const result = calculateBlend([row("erythritol",99), row("monk-v25",1)],100,defaultLossPercent,process);
    assert.equal(result.ready,true);
    close(result.costPerKg,21.19 / 0.99 + 5);
    close(result.batchTotal,(21.19 / 0.99 + 5) * 100);
  }
});

test("bulk cartons are charged by whole cartons, separately from blending loss", () => {
  for (const [batch,count] of [[1,1],[25,1],[25.001,2],[100,4],[101,5]]) {
    const result = calculateBlend([row("erythritol",100)],batch,1,"fluid-bed");
    assert.equal(result.cartonCount,count);
    close(result.packagingCost,count*5.5);
    close(result.packedBatchTotal,result.batchTotal+count*5.5);
    close(result.packedCostPerKg,result.packedBatchTotal/batch);
  }
  close(cost([row("allulose",100)],100).packagingCostPerKg,0.22);
  close(cost([row("allulose",100)],101).packagingCostPerKg,27.5/101);
});

test("USD comparison uses CNY per USD without changing CNY calculations", () => {
  // Exchange rates here are arithmetic fixtures, not customer quote rates.
  close(cnyToUsd(21,7),3);
  close(cnyToUsd(5.5,7),5.5/7);
  assert.equal(cnyToUsd(0,7),0);
  for (const rate of ["",null,undefined,0,-1,Infinity,"bad"]) assert.equal(cnyToUsd(21,rate),null);
  for (const amount of ["",null,undefined,-1,Infinity,"bad"]) assert.equal(cnyToUsd(amount,7),null);
  const result=calculateBlend([row("erythritol",100)],101,1,"high-speed");
  close(cnyToUsd(result.packedBatchTotal,7),result.packedBatchTotal/7);
  assert.equal(result.packagingCost,27.5);
});

test("public FX responses must identify the currency pair, date and a positive numeric rate", () => {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  assert.throws(() => readReferenceFx({base:"USD",quote:"CNY",date:tomorrow,rate:7}));
  assert.deepEqual(readReferenceFx({base:"USD",quote:"CNY",date:"2026-10-23",rate:7}),{date:"2026-10-23",rate:7});
  for (const data of [null,{}, {base:"CNY",quote:"USD",date:"2026-10-23",rate:7}, {base:"USD",quote:"CNY",date:"bad",rate:7}, {base:"USD",quote:"CNY",date:"2026-10-23",rate:0}, {base:"USD",quote:"CNY",date:"2026-10-23",rate:"7"}]) assert.throws(()=>readReferenceFx(data));
});

test("point references are prefilled; ranged references require a customer's own in-range value", () => {
  const factors=defaultSweetnessFactors();
  assert.deepEqual(Object.fromEntries(Object.entries(factors).filter(([id])=>["erythritol","monk-v25","allulose","monk-v50","stevia-ra98","stevia-rm95"].includes(id))),{erythritol:"0.7","monk-v25":"100",allulose:"0.7","monk-v50":"200","stevia-ra98":"","stevia-rm95":""});
  const base=calculateSweetness([row("erythritol",99),row("monk-v25",1)],factors,100);
  assert.equal(base.ready,true);close(base.factor,1.693);close(base.batchEquivalent,169.3);
  const rows=[row("erythritol",99),row("stevia-ra98",1)];
  assert.equal(calculateSweetness(rows,factors,100).ready,false);
  factors["stevia-ra98"]="250";
  const chosen=calculateSweetness(rows,factors,100);close(chosen.factor,3.193);close(chosen.batchEquivalent,319.3);
  assert.equal(defaultSweetnessFactors()["stevia-ra98"],"");
  for(const [id,lower,upper] of [["stevia-ra98",250,300],["stevia-rm95",250,300]]) {
    for(const value of [lower,upper]) assert.equal(calculateSweetness([row(id,100)],{[id]:String(value)},100).ready,true);
    for(const value of [lower-.001,upper+.001,"",-1,Infinity,"bad"]) assert.equal(calculateSweetness([row(id,100)],{[id]:String(value)},100).ready,false);
  }
});
test("grade-specific stevia boundaries leave cost independent and preserve the worked equivalents", () => {
  for (const id of ["stevia-ra98", "stevia-rm95"]) {
    const rows = [row("erythritol",99), row(id,1)];
    const factors = defaultSweetnessFactors();
    for (const value of [249,301,205,406]) assert.equal(calculateSweetness(rows,{...factors,[id]:String(value)},100).ready,false);
    for (const [value,factor,mass] of [[250,3.193,319.3],[300,3.693,369.3]]) {
      const result = calculateSweetness(rows,{...factors,[id]:String(value)},100);
      assert.equal(result.ready,true); close(result.factor,factor); close(result.batchEquivalent,mass);
    }
    assert.equal(calculateBlend(rows,100,1,"fluid-bed").ready,true);
  }
  close(calculateBlend([row("erythritol",99),row("stevia-ra98",1)],100,1,"fluid-bed").packedBatchTotal,1965.4343434343434);
});
test("sweetness is independent of prices or loss, and incomplete inputs never produce partial sweetness", () => {
  const factors=defaultSweetnessFactors();
  assert.equal(calculateSweetness([],factors,100).ready,false);
  assert.equal(calculateSweetness([row("erythritol",99)],factors,100).ready,false);
  for (const factor of ["",-1,Infinity,"bad"]) assert.equal(calculateSweetness([row("erythritol",100)],{erythritol:factor},100).ready,false);
  const noBatch=calculateSweetness([row("allulose",100,"")],factors,"");
  assert.equal(noBatch.ready,true);close(noBatch.factor,.7);assert.equal(noBatch.batchEquivalent,null);
  assert.equal(calculateSweetness([row("allulose",100),row("stevia-ra98",0)],{allulose:factors.allulose},100).ready,true);
  const rows=[row("erythritol",99),row("monk-v25",1)];
  const lowLoss=calculateBlend(rows,100,1,"fluid-bed"),highLoss=calculateBlend(rows,100,5,"high-speed");
  assert.notEqual(lowLoss.packedBatchTotal,highLoss.packedBatchTotal);
  close(calculateSweetness(rows,factors,lowLoss.batch).batchEquivalent,calculateSweetness(rows,factors,highLoss.batch).batchEquivalent);
});

test('copied estimate matches the carton boundary and excludes unavailable dollar values', async () => {
  const { formatBlendSummary } = await import('../src/sweetener-blend-cost.mjs');
  const result = calculateBlend([row('erythritol',99),row('monk-v25',1)],101,1,'high-speed');
  const text = formatBlendSummary(result,{exchangeRate:7,date:'2026-10-25'});
  assert.ok(text.includes('CNY 2,694.31'));
  assert.ok(text.includes('5 × CNY 5.50 = CNY 27.50'));
  assert.ok(text.includes('384.90'));
  assert.ok(text.includes('not a confirmed quotation'));
  assert.ok(text.includes('Not a recommended formulation'));
  assert.ok(text.includes('Bulk blend cost: CNY 26.40/kg'));
  const dated = formatBlendSummary(result, { exchangeRate: 7, rateDate: '2026-10-23', sweetness: {ready:true,factor:1.693,batchEquivalent:170.993} });
  assert.ok(dated.includes('Frankfurter data date 2026-10-23'));
  assert.ok(dated.includes('170.99 kg sucrose equivalent'));
  assert.ok(formatBlendSummary(result, {exchangeRate:7,customRate:true}).includes('customer-entered rate, data date not supplied'));
  assert.equal(formatBlendSummary({ready:false}),null);
  assert.ok(formatBlendSummary(result,{exchangeRate:0}).includes('USD comparison unavailable.'));
});
