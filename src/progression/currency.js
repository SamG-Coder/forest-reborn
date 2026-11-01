export function denominations(copper){
  const total=Math.max(0,Math.floor(Number(copper)||0));
  return {gold:Math.floor(total/10000),silver:Math.floor(total/100)%100,copper:total%100};
}
export function formatMoney(value){
  const coins=denominations(value);
  return [coins.gold?`${coins.gold}g`:null,coins.silver?`${coins.silver}s`:null,`${coins.copper}c`].filter(Boolean).join(' ');
}
