import { FINAL_SHIRT_SIZES } from './finalShirts.js';

export const FINAL_ONSITE_CENTER = { id: 'center-final-overseas', code: '999', name: 'Onsite', active: false };

const packages = {
  onsite: { code:'onsite',label:'Onsite',format:'paper',defaultPrice:4500 },
  onsite_ceremony: { code:'onsite_ceremony',label:'Onsite + เข้าร่วมรับรางวัล',format:'paper',defaultPrice:7900 },
  online: { code:'online',label:'Online',format:'online',defaultPrice:4500 },
};
const invalid = message => Object.assign(new Error(message), {statusCode:400});

export function getFinalPackageOptions(competitionId,roundType) {
  if (roundType !== 'FINAL' && !(roundType === 'FINAL_X' && competitionId === 'bbb')) return [];
  const codes = competitionId === 'timo' && roundType === 'FINAL' ? ['onsite','onsite_ceremony'] : ['onsite_ceremony','online'];
  return codes.map(code => ({...packages[code]}));
}

export function finalPackageMoney(value) {
  if (!['number','string'].includes(typeof value) || String(value).trim() === '') throw invalid('กรุณาระบุราคาแพ็กเกจให้ถูกต้อง');
  const number = Number(value);
  const satang = Math.round(number * 100);
  if (!Number.isFinite(number) || number < 0 || !Number.isSafeInteger(satang) || satang > 2147483647 || Math.abs(number*100-satang)>0.00001) throw invalid('ราคาแพ็กเกจต้องเป็นจำนวนไม่ติดลบและมีทศนิยมไม่เกิน 2 ตำแหน่ง');
  return satang / 100;
}

export function normalizeFinalPackagePrices(competitionId,roundType,prices) {
  const options = getFinalPackageOptions(competitionId,roundType);
  if (!options.length || !prices || typeof prices !== 'object' || Array.isArray(prices)
    || Object.keys(prices).length !== options.length || options.some(option => !Object.hasOwn(prices,option.code))) throw invalid('กรุณาตั้งราคาให้ครบตามแพ็กเกจของรอบสอบ');
  return Object.fromEntries(options.map(option => [option.code,finalPackageMoney(prices[option.code])]));
}

export function resolveFinalPackageSelection(round,item) {
  const option = getFinalPackageOptions(round.competitionId,round.roundType).find(option => option.code === item.packageCode);
  if (!option) throw invalid('กรุณาเลือกแพ็กเกจที่เปิดรับสำหรับรายการสอบนี้');
  const prices = normalizeFinalPackagePrices(round.competitionId,round.roundType,round.packagePrices);
  if (item.format !== undefined && item.format !== option.format) throw invalid('รูปแบบการสอบไม่ตรงกับแพ็กเกจที่เลือก');
  if (!FINAL_SHIRT_SIZES.includes(item.shirtSize)) throw invalid('กรุณาเลือกไซซ์เสื้อผู้สมัครจากรายการที่กำหนด');
  const guests = item.guests === undefined ? [] : item.guests;
  if (!Array.isArray(guests) || guests.length > 4 || (guests.length && option.code !== 'onsite_ceremony')) throw invalid('เพิ่ม Guest ได้สูงสุด 4 คน เฉพาะแพ็กเกจ Onsite + เข้าร่วมรับรางวัล');
  const cleanGuests = guests.map(guest => {
    if (!guest || typeof guest !== 'object' || !['firstNameEn','lastNameEn'].every(key => typeof guest[key] === 'string' && guest[key].trim() && guest[key].trim().length <= 120) || !FINAL_SHIRT_SIZES.includes(guest.shirtSize)) throw invalid('กรุณากรอกชื่อ นามสกุลภาษาอังกฤษ และไซซ์เสื้อของ Guest ให้ครบ');
    return {firstNameEn:guest.firstNameEn.trim(),lastNameEn:guest.lastNameEn.trim(),shirtSize:guest.shirtSize};
  });
  const basePrice = prices[option.code];
  const guestPrice = finalPackageMoney(round.guestPrice);
  const guestTotal = Math.round(guestPrice*100)*cleanGuests.length/100;
  const total = finalPackageMoney((Math.round(basePrice*100)+Math.round(guestTotal*100))/100);
  return {code:option.code,label:option.label,format:option.format,basePrice,guestPrice,guestTotal,total,shirtSize:item.shirtSize,guests:cleanGuests};
}
