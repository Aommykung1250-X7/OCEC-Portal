import { getFinalPackageOptions } from '../../../shared/finalPackages.js';

export function FinalPackagePriceFields({competitionId,roundType,packagePrices,guestPrice=4500,onChange}) {
  const options=getFinalPackageOptions(competitionId,roundType);
  const prices=Object.fromEntries(options.map(option=>[option.code,packagePrices?.[option.code] ?? option.defaultPrice]));
  return <fieldset className="final-package-price-fields m-0 mt-3 grid min-w-0 gap-3 rounded-lg border border-ocec-border bg-ocec-background p-3 sm:grid-cols-2">
    <legend className="px-1 text-sm font-semibold text-ocec-brand">ราคาแพ็กเกจ · {roundType==='FINAL_X'?'Final X':'Final'}</legend>
    {[...options.map(option=>({code:option.code,label:`ราคาแพ็กเกจ ${option.label}`,value:prices[option.code]})),{code:'guest',label:'ราคา Guest ต่อคน',value:guestPrice}].map(field=><label key={field.code} className="grid min-w-0 gap-1 text-xs font-semibold text-ocec-muted"><span>{field.label} (บาท)</span><input aria-label={field.label} className="min-h-11 w-full min-w-0 rounded-lg border border-ocec-border bg-white px-3 text-base text-ocec-ink" type="number" min="0" step="0.01" value={field.value} onChange={event=>onChange(field.code==='guest'?{packagePrices:prices,guestPrice:event.target.value}:{packagePrices:{...prices,[field.code]:event.target.value},guestPrice})}/></label>)}
  </fieldset>;
}
