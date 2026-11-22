import { useId } from 'react';
import { getFinalPackageOptions } from '../../../shared/finalPackages.js';
import { FINAL_SHIRT_SIZES } from '../../../shared/finalShirts.js';
import { Button } from '../../components/ui/index.jsx';

export function FinalPackageFields({competitionId,roundType,competitionLabel,packagePrices,guestPrice=4500,value,onChange,disabled=false,required=true}) {
  const id=useId();
  const options=getFinalPackageOptions(competitionId,roundType);
  const guests=value.guests || [];
  const sizeOptions=<><option value="">เลือกไซซ์เสื้อ</option>{FINAL_SHIRT_SIZES.map(size=><option key={size} value={size}>{size}</option>)}</>;
  function updateGuest(index,key,next){onChange({...value,guests:guests.map((guest,i)=>i===index?{...guest,[key]:next}:guest)});}
  const inputClass='min-h-11 w-full min-w-0 rounded-lg border border-ocec-border bg-white px-3 text-base text-ocec-ink focus:border-ocec-brand focus:outline-2 focus:outline-offset-2 focus:outline-ocec-brand';
  return <fieldset disabled={disabled} className="final-package-fields col-span-full m-0 grid min-w-0 gap-3 border-0 p-0">
    <legend className="mb-2 text-sm font-semibold text-ocec-brand">แพ็กเกจ {competitionLabel} <span className="required-mark">*</span></legend>
    <div className="grid min-w-0 gap-2 sm:grid-cols-2">{options.map(option=><label key={option.code} className="flex min-h-12 min-w-0 cursor-pointer items-start gap-2 rounded-lg border border-ocec-border bg-white p-3 text-sm has-[:checked]:border-ocec-brand has-[:checked]:bg-ocec-brand-soft">
      <input type="radio" className="mt-1 shrink-0 accent-ocec-brand" name={`${id}-package`} required={required} value={option.code} checked={value.packageCode===option.code} onChange={()=>onChange({...value,packageCode:option.code,guests:option.code==='onsite_ceremony'?guests:[]})}/>
      <span className="grid min-w-0 gap-1"><strong className="text-ocec-brand">{option.label}</strong><span className="font-semibold text-ocec-ink">฿{Number(packagePrices?.[option.code] ?? option.defaultPrice).toLocaleString()}</span></span>
    </label>)}</div>
    <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-ocec-brand"><span>ไซซ์เสื้อผู้สมัคร {competitionLabel}</span><select aria-label={`ไซซ์เสื้อผู้สมัคร ${competitionLabel}`} className={inputClass} required={required} value={value.shirtSize || ''} onChange={event=>onChange({...value,shirtSize:event.target.value})}>{sizeOptions}</select></label>
    {value.packageCode==='onsite_ceremony'?<div className="grid min-w-0 gap-3 rounded-lg border border-ocec-border bg-ocec-background p-3">
      <div className="grid gap-1"><strong className="text-sm text-ocec-brand">Guest / ผู้ติดตามเข้าร่วมพิธี (ไม่บังคับ)</strong><p className="m-0 text-xs leading-relaxed text-ocec-muted">เพิ่มได้สูงสุด 4 คนสำหรับรายการนี้ · คนละ ฿{Number(guestPrice).toLocaleString()} · รวม {guests.length} คน ฿{(Math.round(Number(guestPrice)*100)*guests.length/100).toLocaleString()}</p></div>
      {guests.map((guest,index)=><div className="final-guest-row grid min-w-0 gap-2 rounded-lg border border-ocec-border bg-white p-3" key={index}>
        <div className="flex items-center justify-between gap-2"><strong className="text-sm text-ocec-brand">Guest {index+1}</strong><Button variant="text" icon="close" ariaLabel={`ลบ Guest ${index+1}`} onClick={()=>onChange({...value,guests:guests.filter((_,i)=>i!==index)})}>ลบ</Button></div>
        <div className="grid min-w-0 gap-2 sm:grid-cols-2">
          <label className="grid min-w-0 gap-1 text-xs text-ocec-muted"><span>ชื่อภาษาอังกฤษ Guest {index+1}</span><input className={inputClass} value={guest.firstNameEn || ''} required maxLength={120} onChange={event=>updateGuest(index,'firstNameEn',event.target.value)}/></label>
          <label className="grid min-w-0 gap-1 text-xs text-ocec-muted"><span>นามสกุลภาษาอังกฤษ Guest {index+1}</span><input className={inputClass} value={guest.lastNameEn || ''} required maxLength={120} onChange={event=>updateGuest(index,'lastNameEn',event.target.value)}/></label>
        </div>
        <label className="grid min-w-0 gap-1 text-xs text-ocec-muted"><span>ไซซ์เสื้อ Guest {index+1}</span><select aria-label={`ไซซ์เสื้อ Guest ${index+1}`} className={inputClass} required value={guest.shirtSize || ''} onChange={event=>updateGuest(index,'shirtSize',event.target.value)}>{sizeOptions}</select></label>
      </div>)}
      <div><Button variant="outline" icon="plus" disabled={disabled||guests.length>=4} onClick={()=>onChange({...value,guests:[...guests,{firstNameEn:'',lastNameEn:'',shirtSize:''}]})}>เพิ่ม Guest</Button></div>
    </div>:null}
  </fieldset>;
}
