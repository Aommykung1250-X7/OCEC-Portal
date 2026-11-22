import { useId, useState } from "react";
import { FINAL_SHIRT_SIZES } from "../../../shared/finalShirts.js";
import { FinalShirtImages } from "../../components/FinalShirtImages.jsx";
import { Button, Icon } from "../../components/ui/index.jsx";
import { getApplicationRoundType } from "./applicationUtils.js";

export function FinalShirtSection({ application, availability, images = {}, onSave }) {
  const items = (application.competitions || []).filter(item => ['FINAL','FINAL_X'].includes(item.roundType || getApplicationRoundType(application)));
  const [selections, setSelections] = useState(() => Object.fromEntries(items.map(item => [item.applicationItemId,item.shirtSize || ""])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const hintId = useId();
  if (!items.length) return null;
  const changed = items.some(item => selections[item.applicationItemId] !== (item.shirtSize || ""));
  const complete = items.every(item => FINAL_SHIRT_SIZES.includes(selections[item.applicationItemId]));

  async function save(event) {
    event.preventDefault();
    if (busy || !availability.canUpload || !complete || !changed) return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await onSave(items.map(item => ({ applicationItemId: item.applicationItemId,shirtSize: selections[item.applicationItemId] })));
      setStatus("บันทึกไซซ์เสื้อแล้ว");
    } catch (saveError) {
      setError(saveError?.message || "บันทึกไซซ์เสื้อไม่สำเร็จ กรุณาลองใหม่");
    } finally { setBusy(false); }
  }

  return <div className="final-shirt-section grid min-w-0 gap-3 border-t border-ocec-border pt-4">
    <div className="grid gap-1"><h3 className="m-0 text-base font-bold text-ocec-brand">ไซซ์เสื้อรอบ Final / Final X</h3><p id={hintId} className="m-0 text-xs leading-relaxed text-ocec-muted">ไซซ์เสื้อที่ระบุในฟอร์มสมัคร แยกตามรายการสอบ · สามารถเปลี่ยนไซซ์ได้หลังส่งใบสมัคร</p></div>
    <FinalShirtImages images={images} />
    <form onSubmit={save} className="grid min-w-0 gap-3" aria-label="เลือกไซซ์เสื้อรอบ Final">
      <fieldset disabled={busy || !availability.canUpload} className="m-0 grid min-w-0 gap-3 border-0 p-0 sm:grid-cols-2">
        <legend className="sr-only">ไซซ์เสื้อแต่ละรายการสอบ</legend>
        {items.map(item => <div key={item.applicationItemId} className="grid min-w-0 gap-1.5 text-sm font-semibold text-ocec-brand"><label htmlFor={`${hintId}-${item.applicationItemId}`}>ไซซ์เสื้อ {item.short || item.name}</label>
          <select id={`${hintId}-${item.applicationItemId}`} className="min-h-11 w-full min-w-0 rounded-lg border border-ocec-border bg-white px-3 text-base outline-none focus:border-ocec-brand focus:ring-2 focus:ring-ocec-brand/20 disabled:cursor-not-allowed disabled:bg-ocec-background" aria-describedby={hintId} required value={selections[item.applicationItemId] || ""} onChange={event => {
            setSelections(current => ({ ...current,[item.applicationItemId]: event.target.value }));
            setStatus("");
            setError("");
          }}><option value="">เลือกไซซ์เสื้อ</option>{FINAL_SHIRT_SIZES.map(size => <option key={size} value={size}>{size}</option>)}</select>
          <small className="text-xs font-normal text-ocec-muted">ไซซ์ที่บันทึก: {item.shirtSize || "ยังไม่ได้เลือก"}</small>
        </div>)}
      </fieldset>
      {!availability.canUpload ? <p className="m-0 flex items-start gap-2 text-xs leading-relaxed text-ocec-muted"><Icon name="lock" size={16} /><span>ขณะนี้ยังไม่สามารถเปลี่ยนไซซ์เสื้อของใบสมัครนี้ได้</span></p> : <div><Button type="submit" icon="check" disabled={busy || !complete || !changed}>{busy ? "กำลังบันทึก…" : "บันทึกไซซ์เสื้อ"}</Button></div>}
      {status ? <p className="m-0 text-xs font-semibold text-[#116545]" role="status" aria-live="polite">{status}</p> : null}
      {error ? <p className="m-0 text-xs font-semibold text-[#a83f55]" role="alert">{error}</p> : null}
    </form>
  </div>;
}
