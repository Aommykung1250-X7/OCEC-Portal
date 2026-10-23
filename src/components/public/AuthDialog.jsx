import { GoogleMark, Icon } from "../ui/index.jsx";

export function AuthDialog({
  requiresRegistrationLogin,
  backendEnabled,
  dialogRef,
  onKeyDown,
  onDismiss,
  onBackdropMouseDown,
  onGoogleSignIn,
}) {
  return (
    <div className="auth-dialog-backdrop fixed inset-0 z-[100] grid place-items-center bg-[rgba(35,39,59,0.42)] p-5 backdrop-blur-[3px] max-[700px]:px-4" onMouseDown={onBackdropMouseDown}>
      <section className="auth-dialog relative w-full max-w-[400px] rounded-[24px] border border-ocec-border bg-white p-7 text-left shadow-[0_24px_70px_rgba(37,39,71,0.15)] max-[700px]:p-[24px_20px_18px]" role="dialog" aria-modal="true" aria-labelledby="auth-dialog-title" ref={dialogRef} onKeyDown={onKeyDown}>
        <button className="auth-dialog-close absolute top-[13px] right-[13px] grid size-9 place-items-center rounded-[10px] border-0 bg-transparent text-[#7c8798] hover:bg-[#f4f3fb] hover:text-[#38349b] focus-visible:outline-[3px] focus-visible:outline-offset-[3px] focus-visible:outline-ocec-accent" type="button" aria-label={requiresRegistrationLogin ? "กลับหน้าหลัก" : "ปิดหน้าต่างเข้าสู่ระบบ"} onClick={onDismiss}>
          <Icon name={requiresRegistrationLogin ? "arrow" : "close"} size={18} />
        </button>
        <h2 className="m-0 pr-8 text-[22px] leading-[1.35] font-bold tracking-[0.01em] text-ocec-brand max-[700px]:text-[20px]" id="auth-dialog-title">{requiresRegistrationLogin ? "เข้าสู่ระบบก่อนสมัคร" : "เข้าสู่ระบบ OCEC Portal"}</h2>
        <p className="auth-dialog-description mt-[9px] mb-[22px] text-[14px] leading-[1.6] text-[#76849a]">
          {requiresRegistrationLogin ? "ใช้บัญชี Google เพื่อเริ่มสมัครและติดตามสถานะใบสมัคร" : "ใช้บัญชี Google เพื่อดูและติดตามใบสมัครของคุณ"}
        </p>
        <button className="demo-account-choice flex min-h-[50px] w-full items-center justify-center gap-2.5 rounded-[13px] border border-ocec-border bg-white px-[14px] py-[9px] text-[14px] font-bold whitespace-nowrap text-[#303752] hover:border-ocec-accent hover:bg-ocec-brand-soft focus-visible:outline-[3px] focus-visible:outline-offset-[3px] focus-visible:outline-ocec-accent" type="button" onClick={onGoogleSignIn}>
          <GoogleMark className="h-5 w-5 text-[21px] text-[#4285f4]" /><span>ดำเนินการด้วย Google</span>
        </button>
        {!backendEnabled ? <div className="auth-dialog-note mt-[14px] flex items-start gap-[7px] text-left text-[10px] leading-[1.5] text-[#8a93a3]"><Icon name="info" className="flex-none text-ocec-brand" size={15} /><span>ตัวอย่างการเข้าสู่ระบบ · ยังไม่ได้เชื่อมต่อ Google OAuth จริง</span></div> : null}
        <button className="auth-dialog-cancel mx-auto mt-3 block min-h-9 rounded-[10px] border-0 bg-transparent px-[14px] text-[13px] font-[650] text-[#78849a] hover:bg-[#f5f4fc] hover:text-[#403c9e] focus-visible:outline-[3px] focus-visible:outline-offset-[3px] focus-visible:outline-ocec-accent" type="button" onClick={onDismiss}>{requiresRegistrationLogin ? "กลับหน้าหลัก" : "ยกเลิก"}</button>
      </section>
    </div>
  );
}
