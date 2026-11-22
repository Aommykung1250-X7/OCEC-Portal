import { getFinalPackageOptions,normalizeFinalPackagePrices,resolveFinalPackageSelection,finalPackageMoney } from '../shared/finalPackages.js';

export function finalPackageCatalogFields(round) {
  const options=getFinalPackageOptions(round.competition_id,round.round_type);
  if(!options.length)return {};
  const prices=round.final_package_prices;
  return {
    packagePrices: prices ? Object.fromEntries(Object.entries(prices).map(([code,value])=>[code,Number(value)/100])) : Object.fromEntries(options.map(option=>[option.code,option.defaultPrice])),
    guestPrice: round.final_guest_price_satang == null ? 4500 : Number(round.final_guest_price_satang)/100,
  };
}

export function finalPackagePriceColumns(competitionId,roundType,input) {
  const result={};
  if(input.packagePrices!==undefined)result.packagePrices=Object.fromEntries(Object.entries(normalizeFinalPackagePrices(competitionId,roundType,input.packagePrices)).map(([code,value])=>[code,Math.round(value*100)]));
  if(input.guestPrice!==undefined)result.guestPrice=Math.round(finalPackageMoney(input.guestPrice)*100);
  return result;
}

export function resolveStoredFinalSelection(round,item) {
  return resolveFinalPackageSelection({competitionId:round.competition_id,roundType:round.round_type,...finalPackageCatalogFields(round)},item);
}
