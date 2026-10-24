import { useRef, useState } from "react";
import { Button, Icon } from "../../components/ui/index.jsx";

const MAX_POSTER_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const POSTER_ALT = "แผนที่ศูนย์สอบ Paper-Based ทั่วประเทศไทย";

function imageDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" && reader.result.includes(",")
      ? resolve(reader.result)
      : reject(new Error("ไม่สามารถอ่านไฟล์ภาพได้"));
    reader.onerror = () => reject(new Error("ไม่สามารถอ่านไฟล์ภาพได้"));
    reader.readAsDataURL(file);
  });
}

export function CenterPosterSettings({ version = null, onVersionChange = () => {} }) {
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const dialogRef = useRef(null);
  const previewSrc = version ? `/api/center-poster?v=${encodeURIComponent(version)}` : "/paper-based-centers-poster.png";

  async function replacePoster(file) {
    setStatus("");
    setError("");
    if (!file) return;
    if (!ALLOWED_TYPES.has(file.type)) {
      setError("รองรับไฟล์ PNG, JPG และ WebP เท่านั้น");
      return;
    }
    if (file.size > MAX_POSTER_SIZE) {
      setError("ขนาดไฟล์ต้องไม่เกิน 5 MB");
      return;
    }

    setSaving(true);
    try {
      const dataUrl = await imageDataUrl(file);
      const response = await fetch("/api/admin/center-poster", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mimeType: file.type, dataBase64: dataUrl.slice(dataUrl.indexOf(",") + 1) }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "ไม่สามารถบันทึกแผนที่ศูนย์สอบได้");
      onVersionChange(result.version || null);
      setStatus("บันทึกแผนที่ศูนย์สอบแล้ว");
    } catch (uploadError) {
      setError(uploadError?.message || "ไม่สามารถบันทึกแผนที่ศูนย์สอบได้");
    } finally {
      setSaving(false);
    }
  }

  async function restoreDefault() {
    setSaving(true);
    setStatus("");
    setError("");
    try {
      const response = await fetch("/api/admin/center-poster", { method: "DELETE", credentials: "same-origin" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "ไม่สามารถคืนค่าเป็นแผนที่เริ่มต้นได้");
      onVersionChange(result.version ?? null);
      setStatus("คืนค่าเป็นแผนที่เริ่มต้นแล้ว");
    } catch (resetError) {
      setError(resetError?.message || "ไม่สามารถคืนค่าเป็นแผนที่เริ่มต้นได้");
    } finally {
      setSaving(false);
    }
  }

  return <section className="center-poster-settings grid min-w-0 gap-3 rounded-xl border border-[#e1e4ed] bg-white p-3 sm:p-4" aria-label="แผนที่ศูนย์สอบ Paper-Based">
    <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)] sm:items-center">
      <img className="mx-auto max-h-64 w-auto max-w-full rounded-lg border border-[#e5e8ef] bg-white object-contain sm:mx-0 sm:max-h-52" src={previewSrc} alt={POSTER_ALT} />
      <div className="grid min-w-0 gap-2">
        <div className="grid gap-1">
          <strong className="text-sm font-bold text-[#344260]">แผนที่ศูนย์สอบ</strong>
          <p className="m-0 text-xs leading-relaxed text-[#7f8ba1]">แผนที่นี้จะแสดงในหน้าสมัครเมื่อเลือกรูปแบบ Paper-Based · {version ? "กำลังใช้ภาพที่อัปโหลด" : "กำลังใช้ภาพเริ่มต้น"}</p>
        </div>
        <div className="flex min-w-0 flex-wrap gap-2">
          <label className="relative inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-[9px] border border-[#c7cdd2] bg-white px-[15px] text-xs font-semibold text-[#393584] hover:border-[#393584] hover:bg-[#f1f0fb] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#6762b8]">
            <Icon name="upload" size={16} />
            <span>{saving ? "กำลังบันทึก…" : "เปลี่ยนแผนที่ศูนย์สอบ"}</span>
            <input className="absolute inset-0 h-full w-full cursor-pointer opacity-0" type="file" accept="image/png,image/jpeg,image/webp" aria-label="เปลี่ยนแผนที่ศูนย์สอบ" disabled={saving} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; void replacePoster(file); }} />
          </label>
          <Button variant="outline" icon="image" disabled={saving} onClick={() => dialogRef.current?.showModal()}>ดูแผนที่ขนาดใหญ่</Button>
          <Button variant="text" icon="sync" disabled={saving || !version} onClick={restoreDefault}>คืนค่าแผนที่เริ่มต้น</Button>
        </div>
      </div>
    </div>
    {status ? <p className="m-0 text-xs font-semibold text-[#116545]" role="status" aria-live="polite">{status}</p> : null}
    {error ? <p className="m-0 text-xs font-semibold text-[#a83f55]" role="alert">{error}</p> : null}
    <dialog ref={dialogRef} className="fixed inset-0 m-auto h-fit max-h-[92dvh] w-[calc(100vw-24px)] max-w-[900px] overflow-auto rounded-2xl border border-[#e1e4ed] bg-white p-3 shadow-2xl backdrop:bg-slate-950/70 sm:p-5" aria-label="แผนที่ศูนย์สอบ Paper-Based" onClick={(event) => { if (event.target === dialogRef.current) dialogRef.current.close(); }}>
      <div className="mb-3 flex items-center justify-between gap-3"><strong className="text-sm font-bold text-[#344260]">แผนที่ศูนย์สอบ Paper-Based</strong><Button variant="outline" icon="close" ariaLabel="ปิดแผนที่ศูนย์สอบ" onClick={() => dialogRef.current?.close()}>ปิด</Button></div>
      <img className="mx-auto max-h-[78dvh] w-auto max-w-full object-contain" src={previewSrc} alt={POSTER_ALT} />
    </dialog>
  </section>;
}
