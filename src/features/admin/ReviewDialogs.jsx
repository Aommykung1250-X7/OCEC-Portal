import { useEffect, useId, useRef, useState } from "react";
import { Button, Icon } from "../../components/ui/index.jsx";

export function DemoTransferSlip({ application, amount, className = "" }) {
  const displayAmount = Number(amount || 0).toLocaleString("th-TH");
  const recipient = application.paymentAccountType === "president" ? "บัญชีประธาน" : "บัญชีอื่น";
  return (
    <svg className={`review-slip-demo-image block object-contain ${className || "h-auto w-full max-w-[440px]"}`} viewBox="0 0 440 640" role="img" aria-label={`ภาพหลักฐานการชำระเงินตัวอย่าง ยอด ${displayAmount} บาท`} xmlns="http://www.w3.org/2000/svg">
      <rect width="440" height="640" rx="18" fill="#edf0f8" />
      <rect x="22" y="18" width="396" height="604" rx="18" fill="#fff" />
      <path d="M40 18h360a18 18 0 0 1 18 18v83H22V36a18 18 0 0 1 18-18Z" fill="#45499a" />
      <circle cx="68" cy="58" r="19" fill="#fff" fillOpacity=".16" />
      <path d="m59 58 6 6 12-14" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <text x="99" y="55" fill="#fff" fontFamily="Kanit, sans-serif" fontSize="16" fontWeight="700">ดำเนินการโอนเงินสำเร็จ</text>
      <text x="99" y="78" fill="#e2e5ff" fontFamily="Kanit, sans-serif" fontSize="11">หลักฐานการชำระเงินตัวอย่าง · ข้อมูลตัวอย่าง</text>
      <text x="220" y="155" fill="#7a8799" textAnchor="middle" fontFamily="Kanit, sans-serif" fontSize="12">จำนวนเงินที่โอน</text>
      <text x="220" y="198" fill="#263554" textAnchor="middle" fontFamily="Kanit, sans-serif" fontSize="34" fontWeight="700">฿{displayAmount}</text>
      <line x1="52" y1="226" x2="388" y2="226" stroke="#e9ecf2" strokeDasharray="4 5" />
      <text x="54" y="263" fill="#8692a3" fontFamily="Kanit, sans-serif" fontSize="11">จาก</text>
      <text x="54" y="286" fill="#34465f" fontFamily="Kanit, sans-serif" fontSize="14" fontWeight="600">{application.candidate || "ผู้สมัคร"}</text>
      <text x="54" y="327" fill="#8692a3" fontFamily="Kanit, sans-serif" fontSize="11">ไปยัง</text>
      <text x="54" y="350" fill="#34465f" fontFamily="Kanit, sans-serif" fontSize="14" fontWeight="600">OCEC Thailand · {recipient}</text>
      <text x="54" y="391" fill="#8692a3" fontFamily="Kanit, sans-serif" fontSize="11">วันและเวลา</text>
      <text x="54" y="414" fill="#34465f" fontFamily="Kanit, sans-serif" fontSize="13" fontWeight="600">{application.transferDateTime || "ยังไม่มีข้อมูลเวลาโอน"}</text>
      <line x1="52" y1="448" x2="388" y2="448" stroke="#e9ecf2" />
      <text x="54" y="484" fill="#8692a3" fontFamily="Kanit, sans-serif" fontSize="11">เลขอ้างอิง</text>
      <text x="54" y="507" fill="#34465f" fontFamily="Kanit, sans-serif" fontSize="13">DEMO-{String(application.id || "SLIP").slice(-8).toUpperCase()}</text>
      <rect x="54" y="542" width="332" height="42" rx="9" fill="#FFE3F0" />
      <text x="220" y="568" fill="#8a641d" textAnchor="middle" fontFamily="Kanit, sans-serif" fontSize="11" fontWeight="600">ใช้แสดงตัวอย่างหน้าตรวจสอบเท่านั้น</text>
    </svg>
  );
}

export function ReviewSlipDialog({ application, amount, fileName, dataUrl, fileType, backendEnabled, onClose }) {
  const dialogRef = useRef(null);
  const title = `หลักฐานการชำระเงินโอนเงินของ ${application.candidate}`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  function closeDialog() {
    if (dialogRef.current?.open) dialogRef.current.close();
  }

  return (
    <dialog ref={dialogRef} className="review-slip-dialog fixed inset-0 m-auto hidden h-fit w-[calc(100vw-32px)] max-h-[92dvh] max-w-[920px] overflow-hidden rounded-[14px] border border-[#e3e6ed] bg-white p-[14px] text-[#334761] shadow-[0_22px_80px_rgba(23,36,59,0.24)] open:grid max-[540px]:w-[calc(100vw-20px)] max-[540px]:p-[10px] backdrop:bg-[rgba(20,30,49,0.72)]" aria-label={title} onClose={onClose} onClick={(event) => { if (event.target === dialogRef.current) closeDialog(); }}>
      <div className="review-slip-dialog-head flex items-center justify-between gap-3 border-b border-[#e8ebf1] pb-[10px]">
        <div className="grid min-w-0 gap-[3px]"><strong className="text-[15px]">หลักฐานการชำระเงินโอนเงิน</strong><small className="truncate text-[12px] text-[#77869b]">{fileName}</small></div>
        <button type="button" className="review-slip-dialog-close grid h-11 w-11 flex-none place-items-center rounded-[9px] border border-[#e3e6ed] bg-white text-[#435570] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#7773c2]" aria-label="ปิดภาพหลักฐานการชำระเงิน" onClick={closeDialog}><Icon name="close" size={17} /></button>
      </div>
      <div className="review-slip-dialog-content grid max-h-[calc(92dvh-78px)] place-items-center overflow-auto pt-[10px] max-[540px]:max-h-[calc(92dvh-70px)]">
        {dataUrl && fileType.startsWith("image/") ? <img className="review-slip-dialog-image h-auto w-auto max-h-[calc(92dvh-105px)] max-w-full object-contain" src={dataUrl} alt={title} />
          : dataUrl && fileType === "application/pdf" ? <iframe className="review-slip-dialog-pdf h-[calc(92dvh-100px)] w-[min(100%,880px)] rounded-[7px] border-0 bg-white" src={dataUrl} title={title} />
            : backendEnabled ? <div className="review-slip-empty"><Icon name="info" /><strong>ไม่พบไฟล์หลักฐานการชำระเงินใน Portal</strong><small>ตรวจสอบข้อมูลไฟล์บน Google Drive หรืออัปโหลดหลักฐานการชำระเงินใหม่</small></div> : <DemoTransferSlip application={application} amount={amount} className="h-[min(78dvh,780px)] w-auto max-w-full object-contain" />}
      </div>
    </dialog>
  );
}

export function ReviewRejectDialog({ application, onReject, onClose }) {
  const dialogRef = useRef(null);
  const reasonId = useId();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  function closeDialog() {
    if (!busy && dialogRef.current?.open) dialogRef.current.close();
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (await onReject(application.id, reason.trim())) dialogRef.current?.close();
    } finally { setBusy(false); }
  }

  return <dialog ref={dialogRef} className="review-reject-dialog fixed inset-0 m-auto hidden h-fit w-[calc(100vw-32px)] max-h-[calc(100dvh-32px)] max-w-[440px] overflow-y-auto rounded-[24px] border-0 bg-white p-6 text-[#252630] shadow-[0_26px_80px_rgba(15,16,26,0.22)] open:block backdrop:bg-[rgba(20,24,37,0.54)] backdrop:backdrop-blur-[3px] max-[480px]:p-5" aria-labelledby="review-reject-title" onClose={onClose} onCancel={(event) => { if (busy) event.preventDefault(); }} onClick={(event) => { if (event.target === dialogRef.current) closeDialog(); }}>
    <form onSubmit={submit}>
      <div className="review-reject-dialog-heading flex items-start justify-between gap-3"><span className="review-reject-dialog-icon grid h-[45px] w-[45px] place-items-center rounded-[15px] bg-[#fff0f4] text-[#ae3556]"><Icon name="close" size={20} /></span><button type="button" className="review-slip-dialog-close grid h-11 w-11 flex-none place-items-center rounded-[9px] border border-[#e3e6ed] bg-white text-[#435570] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#7773c2]" aria-label="ปิดหน้าต่าง" disabled={busy} onClick={closeDialog}><Icon name="close" size={17} /></button></div>
      <h2 id="review-reject-title" className="mb-1 mt-4 text-[22px] font-semibold">ไม่อนุมัติใบสมัคร?</h2>
      <p className="mb-5 text-[13px] leading-[1.7] text-[#656773]">ใบสมัครของ <strong className="font-semibold text-[#252630]">{application.candidate}</strong> จะเปลี่ยนเป็นสถานะไม่อนุมัติ และระบบจะส่งอีเมลแจ้งผล</p>
      <label className="mb-2 block text-[13px] font-semibold" htmlFor={reasonId}>เหตุผลที่ไม่อนุมัติ <span className="font-normal text-[#858791]">(ไม่บังคับ)</span></label>
      <textarea className="min-h-[104px] w-full resize-y rounded-[14px] border border-[#dfe2e9] bg-white px-[14px] py-3 text-[13px] leading-[1.6] text-[#252630] focus:border-[#ff8a00] focus-visible:outline-3 focus-visible:outline-[#fff0d9] pointer-coarse:text-base" id={reasonId} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={240} placeholder="ระบุเหตุผลเพิ่มเติมเพื่อแจ้งให้ผู้สมัครทราบ (ไม่บังคับ)" autoFocus />
      <small className="mt-[5px] block text-[11px] text-[#858791]">{reason.length}/240 ตัวอักษร · ไม่จำเป็นต้องกรอก</small>
      <div className="review-reject-dialog-actions mt-6 flex justify-end gap-[9px]"><Button className="min-h-11 max-[480px]:flex-1 max-[480px]:px-[10px]" type="button" variant="outline" disabled={busy} onClick={closeDialog}>ยกเลิก</Button><Button className="min-h-11 max-[480px]:flex-1 max-[480px]:px-[10px]" type="submit" disabled={busy}>{busy ? "กำลังบันทึก…" : "ยืนยันการไม่อนุมัติ"}</Button></div>
    </form>
  </dialog>;
}
