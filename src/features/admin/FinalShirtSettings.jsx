import { useState } from "react";
import { FINAL_SHIRT_SIZES, FINAL_SHIRT_IMAGE_LABELS } from "../../../shared/finalShirts.js";
import { FinalShirtImages } from "../../components/FinalShirtImages.jsx";
import { Button, Icon } from "../../components/ui/index.jsx";
import { readFileAsDataUrl } from "../applications/formUtils.js";

export function FinalShirtSettings({ images = {}, onImagesChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  async function save(kind, file, remove = false) {
    setError("");
    setStatus("");
    if (!remove && !file) return;
    if (!remove && !["image/png","image/jpeg","image/webp"].includes(file.type)) {
      setError("รองรับไฟล์ PNG, JPG และ WebP เท่านั้น");
      return;
    }
    if (!remove && file.size > 5 * 1024 * 1024) {
      setError("ขนาดไฟล์ต้องไม่เกิน 5 MB");
      return;
    }
    setBusy(true);
    try {
      const payload = remove ? null : { mimeType: file.type,dataBase64: (await readFileAsDataUrl(file)).split(",")[1] };
      const response = await fetch(`/api/admin/final-shirt-images/${kind}`, {
        method: remove ? "DELETE" : "PUT",credentials: "same-origin",
        ...(payload ? { headers: { "content-type": "application/json" },body: JSON.stringify(payload) } : {}),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "บันทึกภาพเสื้อไม่สำเร็จ");
      const next = { ...images };
      if (result.version) next[kind] = result.version;
      else delete next[kind];
      onImagesChange(next);
      setStatus(`${remove ? "ลบ" : "บันทึก"}${FINAL_SHIRT_IMAGE_LABELS[kind]}แล้ว`);
    } catch (saveError) { setError(saveError?.message || "บันทึกภาพเสื้อไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  return <section className="final-shirt-settings grid min-w-0 gap-3" aria-label="ตั้งค่าเสื้อรอบ Final">
    <p className="m-0 text-xs leading-relaxed text-ocec-muted">ไซซ์ที่กำหนด: {FINAL_SHIRT_SIZES.join(", ")} · ใช้สำหรับรอบ Final และ Final X</p>
    <p className="m-0 text-xs leading-relaxed text-ocec-muted">ภาพทั้งสองช่องไม่บังคับ ใช้ร่วมกันสำหรับรอบ Final และ Final X ทุกรายการสอบ ผู้สมัครเลือกไซซ์ได้แม้ไม่มีภาพประกอบ</p>
    <FinalShirtImages images={images} />
    <div className="grid min-w-0 gap-3 sm:grid-cols-2">{Object.entries(FINAL_SHIRT_IMAGE_LABELS).map(([kind,label]) => <div key={kind} className="grid min-w-0 gap-2 rounded-lg border border-ocec-border bg-white p-3">
      <strong className="text-sm text-ocec-brand">{label} (ไม่บังคับ)</strong>
      {!images[kind] ? <small className="text-xs text-ocec-muted">ยังไม่ได้ใส่ภาพ</small> : null}
      <div className="flex flex-wrap gap-2">
        <label className="relative inline-flex min-h-11 cursor-pointer items-center gap-2 overflow-hidden rounded-lg border border-ocec-border px-3 text-xs font-semibold text-ocec-brand focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ocec-brand">
          <Icon name="upload" size={16} /><span>{busy ? "กำลังบันทึก…" : images[kind] ? "เปลี่ยนภาพ" : "อัปโหลดภาพ"}</span>
          <input type="file" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" accept="image/png,image/jpeg,image/webp" aria-label={`อัปโหลด${label}`} disabled={busy} onChange={event => { const file = event.target.files?.[0];event.target.value = "";void save(kind,file); }} />
        </label>
        {images[kind] ? <Button variant="text" icon="close" disabled={busy} onClick={() => save(kind,null,true)}>ลบ{label}</Button> : null}
      </div>
    </div>)}</div>
    <small className="text-xs text-ocec-muted">รองรับ PNG, JPG และ WebP · ไม่เกิน 5 MB ต่อภาพ · บันทึกภาพทันที</small>
    {status ? <p className="m-0 text-xs font-semibold text-[#116545]" role="status" aria-live="polite">{status}</p> : null}
    {error ? <p className="m-0 text-xs font-semibold text-[#a83f55]" role="alert">{error}</p> : null}
  </section>;
}
