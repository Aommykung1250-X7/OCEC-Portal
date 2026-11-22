import assert from 'node:assert/strict';
import test from 'node:test';
import { getFinalPackageOptions, normalizeFinalPackagePrices, resolveFinalPackageSelection } from '../shared/finalPackages.js';

test('Final package matrices distinguish TIMO, other competitions and BBB Final X', () => {
  assert.deepEqual(getFinalPackageOptions('timo','FINAL').map(p => p.code),['onsite','onsite_ceremony']);
  for (const id of ['hkimo','hkiso','hkico','bbb']) assert.deepEqual(getFinalPackageOptions(id,'FINAL').map(p => p.code),['onsite_ceremony','online']);
  assert.deepEqual(getFinalPackageOptions('bbb','FINAL_X').map(p => p.code),['onsite_ceremony','online']);
  assert.deepEqual(getFinalPackageOptions('bbb','HEAT'),[]);
});
test('package and Guest prices are round-configurable and legacy format prices are not used', () => {
  const round = { competitionId:'timo',roundType:'FINAL',packagePrices:{onsite:4500,onsite_ceremony:7900},guestPrice:4500,prices:{paperBased:1,onlineExam:2} };
  const guest = {firstNameEn:'Parent',lastNameEn:'Smith',shirtSize:'5XL'};
  const selected = resolveFinalPackageSelection(round,{packageCode:'onsite_ceremony',shirtSize:'SS',guests:[guest,guest]});
  assert.equal(selected.total,16900);
  assert.equal(selected.basePrice,7900);
  assert.equal(selected.guestTotal,9000);
  assert.equal(selected.format,'paper');
  assert.equal(resolveFinalPackageSelection({...round,packagePrices:{onsite:5000,onsite_ceremony:8200},guestPrice:4600},{packageCode:'onsite_ceremony',shirtSize:'M',guests:[guest]}).total,12800);
  assert.throws(() => resolveFinalPackageSelection({...round,packagePrices:null},{packageCode:'onsite',shirtSize:'M',guests:[]}));
});
test('validates required package, size and at most four complete ceremony Guests', () => {
  const round = {competitionId:'bbb',roundType:'FINAL_X',packagePrices:{onsite_ceremony:7900,online:4500},guestPrice:4500};
  const guest={firstNameEn:'Anne-Marie',lastNameEn:"O'Neil",shirtSize:'2XL'};
  for (const count of [0,1,4]) assert.equal(resolveFinalPackageSelection(round,{packageCode:'onsite_ceremony',shirtSize:'L',guests:Array(count).fill(guest)}).total,7900+4500*count);
  for (const item of [{shirtSize:'L'}, {packageCode:'onsite_ceremony'}, {packageCode:'onsite_ceremony',shirtSize:'XXL'}, {packageCode:'online',shirtSize:'L',guests:[guest]}, {packageCode:'onsite',shirtSize:'L'}, {packageCode:'onsite_ceremony',shirtSize:'L',guests:Array(5).fill(guest)}, ...[{...guest,firstNameEn:' '},{...guest,lastNameEn:''},{...guest,shirtSize:'bad'},null].map(g=>({packageCode:'onsite_ceremony',shirtSize:'L',guests:[g]}))]) assert.throws(()=>resolveFinalPackageSelection(round,item));
});
test('catalog package prices accept only allowed codes and finite non-negative money', () => {
  assert.deepEqual(normalizeFinalPackagePrices('timo','FINAL',{onsite:4500,onsite_ceremony:7900}),{onsite:4500,onsite_ceremony:7900});
  for (const prices of [{onsite:-1,onsite_ceremony:7900},{onsite:4500,onsite_ceremony:NaN},{onsite:4500,onsite_ceremony:7900,online:4500},{onsite:4500},{onsite:'',onsite_ceremony:7900}]) assert.throws(()=>normalizeFinalPackagePrices('timo','FINAL',prices));
});
