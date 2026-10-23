import { useRef } from "react";
import { Button } from "../../components/ui/index.jsx";

const posterAlt = "แผนที่ศูนย์สอบ Paper Based ทั่วประเทศไทย";

export function CenterPosterPreview({ version, backendEnabled = false }) {
  const dialogRef = useRef(null);
  const source = backendEnabled && version
    ? `/api/center-poster?v=${encodeURIComponent(version)}`
    : "/paper-based-centers-poster.png";

  return (
    <aside className="center-poster-preview mb-4 grid min-w-0 gap-3 rounded-2xl border border-ocec-border bg-ocec-background p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-4" aria-label="ข้อมูลสถานที่สอบ Paper Based">
      <div className="grid min-w-0 gap-2 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-4">
        <img className="mx-auto max-h-64 w-auto max-w-full rounded-lg object-contain sm:mx-0 sm:max-h-48" src={source} alt={posterAlt} loading="lazy" />
        <div className="grid gap-1 text-center sm:text-left">
          <strong className="text-sm font-bold text-ocec-brand">แผนที่ศูนย์สอบ Paper Based</strong>
          <p className="m-0 text-xs leading-relaxed text-ocec-muted">ดูตำแหน่งศูนย์สอบทั่วประเทศก่อนเลือกศูนย์สอบในรายการของคุณ</p>
        </div>
      </div>
      <Button variant="outline" icon="image" className="w-full sm:w-auto" onClick={(event) => {
        event.currentTarget.focus({ preventScroll: true });
        dialogRef.current?.showModal();
      }}>
        ดูโปสเตอร์ขนาดใหญ่
      </Button>
      <dialog
        ref={dialogRef}
        className="fixed inset-0 m-auto h-fit max-h-[92dvh] w-fit max-w-[calc(100vw-24px)] overflow-auto rounded-2xl border border-ocec-border bg-white p-3 shadow-2xl backdrop:bg-slate-950/70 sm:p-5"
        aria-labelledby="center-poster-dialog-title"
        onClick={(event) => { if (event.target === dialogRef.current) dialogRef.current.close(); }}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="center-poster-dialog-title" className="m-0 text-base font-bold text-ocec-brand">โปสเตอร์ศูนย์สอบ Paper Based</h2>
          <Button variant="outline" icon="close" ariaLabel="ปิดโปสเตอร์" onClick={() => dialogRef.current?.close()}>ปิด</Button>
        </div>
        <img className="mx-auto max-h-[78dvh] w-auto max-w-full object-contain" src={source} alt={posterAlt} />
      </dialog>
    </aside>
  );
}
