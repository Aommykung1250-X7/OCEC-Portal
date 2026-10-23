import { BrandMark } from "../ui/index.jsx";

export function PublicPortalFooter() {
  return (
    <footer className="landing-footer mx-auto flex min-h-[82px] w-[calc(100%-64px)] max-w-[1240px] items-center gap-5 border-t border-ocec-border text-ocec-muted max-[700px]:grid max-[700px]:min-h-0 max-[700px]:w-[calc(100%-32px)] max-[700px]:grid-cols-[minmax(0,1fr)_auto] max-[700px]:gap-3 max-[700px]:py-[23px] max-[700px]:pb-[max(24px,env(safe-area-inset-bottom))] max-[380px]:w-[calc(100%-24px)]">
      <a className="landing-footer-brand flex flex-none items-center gap-[10px] no-underline max-[700px]:col-start-1 max-[700px]:row-start-1 max-[700px]:min-w-0 max-[360px]:col-span-2" href="/">
        <BrandMark />
        <span className="flex min-w-0 flex-col gap-[2px] leading-[1.25]"><strong className="text-[12px] font-[750] text-ocec-brand">OCEC Portal</strong><small className="text-[12px] text-ocec-muted">ระบบสมัครสอบ</small></span>
      </a>
      <span className="ml-auto text-xs text-ocec-muted max-[700px]:row-start-2 max-[700px]:ml-0 max-[700px]:text-[11px] max-[360px]:row-start-3">© 2569 OCEC Portal</span>
      <a className="landing-footer-help whitespace-nowrap text-[14px] text-ocec-muted underline hover:text-ocec-brand max-[700px]:col-start-2 max-[700px]:row-start-1 max-[700px]:justify-self-end max-[700px]:text-xs max-[360px]:col-span-2 max-[360px]:col-start-1 max-[360px]:row-start-2 max-[360px]:justify-self-start" href="https://lin.ee/3hzFg1z" target="_blank" rel="noopener noreferrer">ศูนย์ช่วยเหลือ</a>
      <a className="flaticon-attribution ml-0 whitespace-nowrap text-[11px] text-ocec-muted no-underline hover:text-ocec-brand hover:underline max-[700px]:col-start-2 max-[700px]:row-start-2 max-[700px]:justify-self-end max-[700px]:text-right max-[360px]:row-start-3" href="https://www.flaticon.com/uicons" target="_blank" rel="noreferrer">UIcons by Flaticon</a>
    </footer>
  );
}
