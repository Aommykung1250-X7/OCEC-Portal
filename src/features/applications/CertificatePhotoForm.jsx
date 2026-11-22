import { useState } from 'react';
import { readFileAsDataUrl } from './formUtils.js';
import { FinalShirtImages } from '../../components/FinalShirtImages.jsx';

export function CertificatePhotoForm({value,onChange,images}) {
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  async function choose(file){
    setError('');
    if(!file)return;
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)){setError('รองรับรูป JPG, PNG และ WebP เท่านั้น');return;}
    if(file.size>10*1024*1024){setError('รูปต้องมีขนาดไม่เกิน 10 MB');return;}
    setBusy(true);
    try{const data=await readFileAsDataUrl(file);onChange({fileName:file.name,mimeType:file.type,dataBase64:data.split(',')[1]});}
    catch{setError('อ่านรูปภาพไม่สำเร็จ กรุณาเลือกไฟล์ใหม่');}
    finally{setBusy(false);}
  }
  return <section className="final-certificate-photo-form grid min-w-0 gap-3 rounded-xl border border-ocec-border bg-white p-3 sm:p-4" aria-label="รูปเกียรติบัตรและภาพประกอบเสื้อ">
    <div className="grid gap-1"><h2 className="m-0 text-base font-semibold text-ocec-brand">รูปสำหรับเกียรติบัตร <span className="required-mark">*</span></h2><p className="m-0 text-sm leading-relaxed text-ocec-muted">ต้องแนบรูปก่อนส่งใบสมัคร Final / Final X · ใช้รูปเดียวกันสำหรับรายการสอบที่สมัคร · JPG, PNG หรือ WebP ไม่เกิน 10 MB</p></div>
    {value?<img src={`data:${value.mimeType};base64,${value.dataBase64}`} alt="รูปเกียรติบัตรที่เลือก" className="mx-auto h-40 w-full max-w-full rounded-lg object-contain"/>:null}
    <label className="grid min-w-0 gap-2 text-sm font-semibold text-ocec-brand"><span>{busy?'กำลังอ่านรูป…':value?'เปลี่ยนรูปเกียรติบัตร':'เลือกรูปสำหรับเกียรติบัตร'}</span><input className="min-h-11 w-full min-w-0 rounded-lg border border-ocec-border bg-ocec-background p-2 text-base" aria-label="รูปสำหรับเกียรติบัตร" type="file" accept="image/png,image/jpeg,image/webp" required={!value} disabled={busy} onChange={event=>{void choose(event.target.files?.[0]);}}/></label>
    {error?<p className="m-0 text-sm text-red-700" role="alert">{error}</p>:null}
    <FinalShirtImages images={images}/>
  </section>;
}
