export function FinalBookingSummary({competition}) {
  if(!competition.packageCode)return null;
  const guests=competition.guests || [];
  return <div className="final-booking-summary mt-3 grid min-w-0 gap-2 rounded-lg border border-ocec-border bg-ocec-background p-3 text-sm text-ocec-muted-strong">
    <strong className="text-ocec-brand">{competition.short || competition.name} · {competition.packageName}</strong>
    <p className="m-0 leading-relaxed">แพ็กเกจ ฿{Number(competition.packageFee || 0).toLocaleString()} · ไซซ์เสื้อ {competition.shirtSize || 'ยังไม่ได้ระบุ'}</p>
    <p className="m-0 leading-relaxed">Guest {guests.length} คน · คนละ ฿{Number(competition.guestUnitPrice || 0).toLocaleString()} · รวม ฿{Number(competition.guestsTotal || 0).toLocaleString()}</p>
    {guests.length?<ol className="m-0 grid gap-1 pl-5">{guests.map((guest,index)=><li key={index} className="break-words">{guest.firstNameEn} {guest.lastNameEn} · ไซซ์ {guest.shirtSize}</li>)}</ol>:null}
    <strong className="border-t border-ocec-border pt-2 text-ocec-brand">รวมรายการนี้ ฿{Number(competition.fee || 0).toLocaleString()}</strong>
  </div>;
}
