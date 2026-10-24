import { Icon } from "../../components/ui/index.jsx";

const applicationFormatClasses = {
  fieldset: "application-format-picker col-span-full m-0 grid min-w-0 gap-2 border-0 p-0",
  legend: "mb-1 text-xs font-semibold text-ocec-muted",
  options: "grid grid-cols-2 gap-2",
  option: "grid min-w-0 min-h-12 grid-cols-[14px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-ocec-border bg-white px-2 py-2 text-ocec-muted-strong transition-colors hover:border-ocec-accent focus-within:ring-4 focus-within:ring-ocec-accent/20 has-[:checked]:border-ocec-accent has-[:checked]:bg-ocec-brand-soft has-[:checked]:shadow-[inset_0_0_0_1px_var(--color-ocec-accent)] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60",
  input: "m-0 size-4 accent-ocec-brand",
  label: "min-w-0 grid gap-0.5",
  name: "truncate text-xs font-semibold",
  price: "whitespace-nowrap text-xs font-bold text-ocec-muted-strong",
};

export function CompetitionFormatPicker({ competitionId, format, paperPrice, onlinePrice, onChange, prefix = "form", disabled = false, variant = "default" }) {
  const application = variant === "application";
  const optionClass = (selected) => ["competition-format-option", selected ? "selected" : "", application ? applicationFormatClasses.option : ""].filter(Boolean).join(" ");
  return <fieldset className={`competition-format-picker ${application ? applicationFormatClasses.fieldset : ""}`}><legend className={application ? applicationFormatClasses.legend : ""}>รูปแบบสอบ <span className="required-mark">*</span></legend><div className={`competition-format-options ${application ? applicationFormatClasses.options : ""}`}>
    <label className={optionClass(format === "Paper-Based")}>
      <input className={application ? applicationFormatClasses.input : ""} type="radio" name={`format-${prefix}-${competitionId}`} checked={format === "Paper-Based"} disabled={disabled} onChange={() => onChange("Paper-Based")} />
      <span className={application ? applicationFormatClasses.label : ""}><strong className={application ? applicationFormatClasses.name : ""}>Paper-Based</strong></span><b className={application ? applicationFormatClasses.price : ""}>฿{Number(paperPrice || 0).toLocaleString()}</b>
    </label>
    <label className={optionClass(format === "Online")}>
      <input className={application ? applicationFormatClasses.input : ""} type="radio" name={`format-${prefix}-${competitionId}`} checked={format === "Online"} disabled={disabled} onChange={() => onChange("Online")} />
      <span className={application ? applicationFormatClasses.label : ""}><strong className={application ? applicationFormatClasses.name : ""}>Online Exam</strong></span><b className={application ? applicationFormatClasses.price : ""}>฿{Number(onlinePrice || 0).toLocaleString()}</b>
    </label>
  </div></fieldset>;
}

export function CompetitionPriceSummary({ selected, format, paperPrice, onlinePrice }) {
  const isOnline = format === "Online" || format === "Online Exam";
  const onsiteAmount = Number(paperPrice || 0).toLocaleString();
  const onlineAmount = Number(onlinePrice || 0).toLocaleString();
  if (selected) {
    const selectedMode = isOnline ? "Online" : "Onsite";
    const selectedAmount = isOnline ? onlineAmount : onsiteAmount;
    return <span className="competition-fee competition-fee-selected" aria-label={`ค่าสมัคร ${selectedMode} ฿${selectedAmount}`}>
      <small>{selectedMode}</small><strong>฿{selectedAmount}</strong>
    </span>;
  }
  return <span className="competition-fee competition-fee-options" aria-label={`Onsite ฿${onsiteAmount}, Online ฿${onlineAmount}`}>
    <span><small>Onsite</small><strong>฿{onsiteAmount}</strong></span>
    <span><small>Online</small><strong>฿{onlineAmount}</strong></span>
  </span>;
}

export function PaymentAccountCards({ accounts }) {
  const visibleAccounts = (accounts || []).filter((account) => account.active !== false && account.showInForm !== false);
  return visibleAccounts.length ? <div className="payment-account-list mt-3 grid gap-2.5">{visibleAccounts.map((account) => (
    <div className="bank-payment-card mt-0 grid min-w-0 gap-3 rounded-xl border border-ocec-border bg-white p-4" key={account.id}>
      <div className="bank-payment-heading flex min-w-0 items-center gap-2.5"><span className="bank-payment-icon grid size-10 shrink-0 place-items-center rounded-xl bg-ocec-brand-soft text-ocec-brand"><Icon name="building" /></span><div className="flex min-w-0 flex-col gap-0.5"><strong className="text-base font-semibold text-ocec-ink md:text-lg">โอนเงินผ่านธนาคาร : {account.bankName || "ธนาคาร"}</strong><small className="text-xs text-ocec-muted">โปรดตรวจสอบยอดรวมก่อนชำระเงิน</small></div></div>
      <div className="bank-payment-details grid min-w-0 grid-cols-1 gap-3 border-t border-ocec-border pt-3 md:grid-cols-2"><span className="flex min-w-0 flex-col gap-1"><small className="text-[10px] tracking-wide text-slate-500">ACCOUNT NAME</small><strong className="min-w-0 text-base font-semibold leading-snug text-ocec-muted-strong [overflow-wrap:anywhere]">{account.accountName || "—"}</strong></span><span className="flex min-w-0 flex-col gap-1"><small className="text-[10px] tracking-wide text-slate-500">ACCOUNT NO.</small><strong className="min-w-0 text-lg font-bold leading-snug text-ocec-brand [overflow-wrap:anywhere]">{account.accountNumber || "—"}</strong></span></div>
    </div>
  ))}</div> : <div className="payment-account-empty mt-3 flex items-start gap-2 rounded-xl border border-dashed border-ocec-border bg-ocec-background p-3 text-sm text-ocec-muted"><Icon name="info" size={15} />ขณะนี้ไม่มีบัญชีรับโอนเงินที่แสดงในแบบฟอร์ม</div>;
}
