import { useRef, useState } from "react";
import { FINAL_SHIRT_IMAGE_LABELS } from "../../shared/finalShirts.js";
import { Button } from "./ui/index.jsx";

export function FinalShirtImages({ images = {} }) {
  const dialog = useRef(null);
  const [activeKind, setActiveKind] = useState("chart");
  const kinds = Object.keys(FINAL_SHIRT_IMAGE_LABELS).filter(kind => images[kind]);
  const source = kind => `/api/final-shirt-images/${kind}?v=${encodeURIComponent(images[kind])}`;
  if (!kinds.length) return null;

  return <div className="grid min-w-0 gap-3 sm:grid-cols-2">
    {kinds.map(kind => <figure key={kind} className="m-0 grid min-w-0 gap-2 rounded-lg border border-ocec-border bg-ocec-background p-3">
      <img className="mx-auto h-40 w-full max-w-full object-contain" src={source(kind)} alt={FINAL_SHIRT_IMAGE_LABELS[kind]} loading="lazy" />
      <figcaption><Button variant="outline" className="w-full" icon="image" onClick={event => {
        event.currentTarget.focus({ preventScroll: true });
        setActiveKind(kind);
        dialog.current?.showModal();
      }}>ขยาย{FINAL_SHIRT_IMAGE_LABELS[kind]}</Button></figcaption>
    </figure>)}
    <dialog ref={dialog} className="fixed inset-0 m-auto h-fit max-h-[92dvh] w-[calc(100vw-24px)] max-w-[900px] overflow-auto rounded-xl border border-ocec-border bg-white p-3 shadow-2xl backdrop:bg-slate-950/70 sm:p-5" aria-label="ภาพเสื้อรอบ Final" onClick={event => { if (event.target === dialog.current) dialog.current.close(); }}>
      <div className="mb-3 flex items-center justify-between gap-3"><strong className="text-sm text-ocec-brand">{FINAL_SHIRT_IMAGE_LABELS[activeKind]}</strong><Button variant="outline" icon="close" onClick={() => dialog.current?.close()}>ปิดภาพ</Button></div>
      {images[activeKind] ? <img className="mx-auto max-h-[78dvh] w-auto max-w-full object-contain" src={source(activeKind)} alt={`ภาพขยาย${FINAL_SHIRT_IMAGE_LABELS[activeKind]}`} /> : null}
    </dialog>
  </div>;
}
