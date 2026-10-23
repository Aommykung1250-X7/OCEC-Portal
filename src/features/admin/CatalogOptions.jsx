import { Button, Icon } from "../../components/ui/index.jsx";
import { isOnlineCenter } from "../../centers.js";
import { AdminFormOptionAccordion, CenterCatalogContent } from "./CatalogResources.jsx";

export function CompetitionCatalogManager({
  selectedCompetition,
  newCompetitionName,
  onNewCompetitionNameChange,
  onAddCompetition,
  onUpdateCompetition,
}) {
  return <section className="admin-competition-manager mt-2.5 grid min-w-0 gap-3 rounded-xl border border-[#e0def1] bg-[#f8f7ff] p-3" aria-label="จัดการตัวเลือกรายการสอบ">
    <div className="admin-competition-manager-add grid min-w-0 grid-cols-1 items-end gap-2 min-[701px]:grid-cols-[minmax(0,1fr)_auto]"><label className="grid min-w-0 gap-1.5 text-[10px] font-semibold text-[#68758b]"><span>เพิ่มชื่อรายการสอบ</span><input className="min-h-11 w-full min-w-0 rounded-lg border border-[#dfe3ed] bg-white px-2.5 text-sm text-[#394966] outline-none focus:border-[#8d89d1] focus:ring-2 focus:ring-[#8d89d1]/15 sm:min-h-[38px] sm:text-[11px]" value={newCompetitionName} maxLength={255} onChange={(event) => onNewCompetitionNameChange(event.target.value)} placeholder="เช่น HKIMO" /></label><Button type="button" className="min-h-11 whitespace-nowrap sm:min-h-[38px]" icon="plus" onClick={onAddCompetition}>เพิ่มชื่อ</Button></div>
    {selectedCompetition ? <div className="admin-competition-manager-edit grid min-w-0 grid-cols-1 gap-2 border-t border-[#e8e6f3] pt-2.5 min-[701px]:grid-cols-2"><span className="admin-exam-field-label col-span-full text-xs font-semibold text-[#5f6e88]">แก้ไขตัวเลือกที่เลือก · {selectedCompetition.short}</span><label className="grid min-w-0 gap-1.5 text-[10px] font-semibold text-[#68758b]"><span>ชื่อใน dropdown</span><input className="min-h-11 w-full min-w-0 rounded-lg border border-[#dfe3ed] bg-white px-2.5 text-sm text-[#394966] outline-none focus:border-[#8d89d1] focus:ring-2 focus:ring-[#8d89d1]/15 sm:min-h-[38px] sm:text-[11px]" value={selectedCompetition.short || ""} maxLength={30} onChange={(event) => onUpdateCompetition(selectedCompetition.id, "short", event.target.value)} /></label><label className="grid min-w-0 gap-1.5 text-[10px] font-semibold text-[#68758b]"><span>ชื่อเต็มที่แสดงในรายการสอบ</span><input className="min-h-11 w-full min-w-0 rounded-lg border border-[#dfe3ed] bg-white px-2.5 text-sm text-[#394966] outline-none focus:border-[#8d89d1] focus:ring-2 focus:ring-[#8d89d1]/15 sm:min-h-[38px] sm:text-[11px]" value={selectedCompetition.name || ""} maxLength={255} onChange={(event) => onUpdateCompetition(selectedCompetition.id, "name", event.target.value)} /></label></div> : <small className="text-[10px] text-[#7c879b]">เลือกรายการสอบด้านบนเพื่อแก้ไขชื่อ</small>}
    <div className="admin-competition-manager-save flex flex-wrap items-center justify-between gap-2 border-t border-[#e8e6f3] pt-2.5"><small className="text-[10px] text-[#7c879b]">เพิ่มหรือแก้ชื่อแล้วระบบจะบันทึกอัตโนมัติ</small></div>
  </section>;
}

export function CatalogOptions({
  examCatalog,
  gradeCatalog,
  newGradeName,
  setNewGradeName,
  onAddGradeOption,
  onRemoveGradeOption,
  centerCatalog,
  centerFile,
  centerPreview,
  excludeCenterIssues,
  setExcludeCenterIssues,
  onStageCenterFile,
  onApplyCenterImport,
  onSaveCenterEdit,
  onUpdateCenter,
  onDeactivateCenter,
  newCenterCode,
  setNewCenterCode,
  newCenterName,
  setNewCenterName,
  onAddCenter,
  centerPosterVersion,
  onCenterPosterVersionChange,
  paymentAccounts,
  selectedPaymentAccountId,
  onUpdatePaymentAccount,
  onRemovePaymentAccount,
  newPaymentAccount,
  setNewPaymentAccount,
  onAddPaymentAccount,
  pastPaperCatalog,
  setPastPaperCatalog,
  paperGroupOptions,
  newPaperGroup,
  setNewPaperGroup,
  newPaperName,
  setNewPaperName,
  newPaperPrice,
  setNewPaperPrice,
  onAddPastPaper,
  onRemovePastPaper,
}) {
  return <div className="admin-form-options-accordions grid min-w-0 gap-3">
    <AdminFormOptionAccordion
      title="บัญชีรับโอน"
      description="เพิ่มหรือลบบัญชี และเลือกบัญชีเดียวที่จะแสดงในแบบฟอร์มสมัคร"
      count={`${paymentAccounts.length} บัญชี`}
      panelClassName="admin-payment-accounts"
    >
      <div className="admin-payment-account-list grid gap-2">
        {paymentAccounts.map((account) => <article className="admin-payment-account-row grid gap-2 rounded-[11px] border border-[#e7e9f0] bg-[#fcfcfe] p-3" key={account.id}>
          <div className="admin-payment-account-fields grid min-w-0 grid-cols-1 gap-2 min-[701px]:grid-cols-2 min-[1001px]:grid-cols-[minmax(120px,.8fr)_minmax(170px,1.2fr)_minmax(150px,1fr)_minmax(190px,1.2fr)]">
            <label className="grid min-w-0 gap-[5px] text-[10px] font-semibold text-[#758198]"><span>ธนาคาร</span><input className="min-h-11 w-full min-w-0 rounded-lg border border-[#dfe3ed] bg-white px-2.5 text-sm text-[#394966] outline-none focus:border-[#8d89d1] focus:ring-2 focus:ring-[#8d89d1]/15 sm:h-9 sm:min-h-0 sm:text-[11px]" aria-label={`ธนาคารของบัญชี ${account.accountNumber}`} value={account.bankName || ""} onChange={(event) => onUpdatePaymentAccount(account.id, "bankName", event.target.value)} placeholder="เช่น Kasikorn Bank" /></label>
            <label className="grid min-w-0 gap-[5px] text-[10px] font-semibold text-[#758198]"><span>ชื่อบัญชี</span><input className="min-h-11 w-full min-w-0 rounded-lg border border-[#dfe3ed] bg-white px-2.5 text-sm text-[#394966] outline-none focus:border-[#8d89d1] focus:ring-2 focus:ring-[#8d89d1]/15 sm:h-9 sm:min-h-0 sm:text-[11px]" aria-label={`ชื่อบัญชี ${account.accountNumber}`} value={account.accountName || ""} onChange={(event) => onUpdatePaymentAccount(account.id, "accountName", event.target.value)} /></label>
            <label className="grid min-w-0 gap-[5px] text-[10px] font-semibold text-[#758198]"><span>เลขบัญชี</span><input className="min-h-11 w-full min-w-0 rounded-lg border border-[#dfe3ed] bg-white px-2.5 text-sm text-[#394966] outline-none focus:border-[#8d89d1] focus:ring-2 focus:ring-[#8d89d1]/15 sm:h-9 sm:min-h-0 sm:text-[11px]" aria-label={`เลขบัญชี ${account.accountName}`} value={account.accountNumber || ""} onChange={(event) => onUpdatePaymentAccount(account.id, "accountNumber", event.target.value)} /></label>
            <label className="grid min-w-0 gap-[5px] text-[10px] font-semibold text-[#758198]"><span>ประเภทบัญชี</span><select className="min-h-11 w-full min-w-0 rounded-lg border border-[#dfe3ed] bg-white px-2.5 text-sm text-[#394966] outline-none focus:border-[#8d89d1] focus:ring-2 focus:ring-[#8d89d1]/15 sm:h-9 sm:min-h-0 sm:text-[11px]" value={account.category === "president" ? "president" : "other"} onChange={(event) => onUpdatePaymentAccount(account.id, "category", event.target.value)}><option value="president">บัญชีประธาน · ไม่ต้องลงบัญชี</option><option value="other">บัญชีอื่น · ต้องลงบัญชีภายนอก</option></select></label>
          </div>
          <div className="admin-payment-account-actions flex min-h-11 items-center justify-between gap-2"><label className="admin-payment-show inline-flex min-h-11 cursor-pointer items-center gap-[7px] text-[11px] font-semibold text-[#566781]"><input className="h-4 w-4 accent-[#5753a4]" type="radio" name="form-payment-account" checked={selectedPaymentAccountId === account.id} onChange={() => onUpdatePaymentAccount(account.id, "showInForm", true)} /><span>แสดงในฟอร์มสมัคร</span></label><button type="button" className="admin-paper-delete grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-[#f0dce2] bg-[#fff8f9] text-[#a36572] transition-colors hover:border-[#e9b7c0] hover:bg-[#fff0f2] hover:text-[#a83f55] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d93972] sm:h-[30px] sm:w-[30px]" aria-label={`ลบบัญชี ${account.bankName} ${account.accountNumber}`} title="ลบบัญชีรับโอน" onClick={() => onRemovePaymentAccount(account)}><Icon name="close" size={15} /></button></div>
        </article>)}
        {!paymentAccounts.length ? <p className="admin-payment-empty m-0 rounded-lg border border-dashed border-[#d7dce6] bg-[#fbfcfe] p-3 text-[11px] text-[#818da0]">ยังไม่มีบัญชีรับโอน · เพิ่มบัญชีใหม่ด้านล่าง</p> : null}
      </div>
      <form className="admin-add-payment-account mt-3 grid min-w-0 grid-cols-1 items-end gap-2 rounded-[11px] border border-dashed border-[#d7d9e8] bg-[#fafaff] p-3 min-[701px]:grid-cols-2 min-[1001px]:grid-cols-[minmax(130px,.8fr)_minmax(170px,1.2fr)_minmax(150px,1fr)_minmax(155px,.9fr)_auto_auto]" onSubmit={onAddPaymentAccount}>
        <label className="grid min-w-0 gap-[5px] text-[10px] font-semibold text-[#758198]"><span>ธนาคาร</span><input className="min-h-11 w-full min-w-0 rounded-lg border border-[#dfe3ed] bg-white px-2.5 text-sm text-[#394966] outline-none focus:border-[#8d89d1] focus:ring-2 focus:ring-[#8d89d1]/15 sm:h-9 sm:min-h-0 sm:text-[11px]" value={newPaymentAccount.bankName} onChange={(event) => setNewPaymentAccount((current) => ({ ...current, bankName: event.target.value }))} placeholder="เช่น Kasikorn Bank" required /></label>
        <label className="grid min-w-0 gap-[5px] text-[10px] font-semibold text-[#758198]"><span>ชื่อบัญชี</span><input className="min-h-11 w-full min-w-0 rounded-lg border border-[#dfe3ed] bg-white px-2.5 text-sm text-[#394966] outline-none focus:border-[#8d89d1] focus:ring-2 focus:ring-[#8d89d1]/15 sm:h-9 sm:min-h-0 sm:text-[11px]" value={newPaymentAccount.accountName} onChange={(event) => setNewPaymentAccount((current) => ({ ...current, accountName: event.target.value }))} placeholder="ชื่อเจ้าของบัญชี" required /></label>
        <label className="grid min-w-0 gap-[5px] text-[10px] font-semibold text-[#758198]"><span>เลขบัญชี</span><input className="min-h-11 w-full min-w-0 rounded-lg border border-[#dfe3ed] bg-white px-2.5 text-sm text-[#394966] outline-none focus:border-[#8d89d1] focus:ring-2 focus:ring-[#8d89d1]/15 sm:h-9 sm:min-h-0 sm:text-[11px]" value={newPaymentAccount.accountNumber} onChange={(event) => setNewPaymentAccount((current) => ({ ...current, accountNumber: event.target.value }))} placeholder="เลขบัญชีสำหรับโอน" required /></label>
        <label className="grid min-w-0 gap-[5px] text-[10px] font-semibold text-[#758198]"><span>ประเภท</span><select className="min-h-11 w-full min-w-0 rounded-lg border border-[#dfe3ed] bg-white px-2.5 text-sm text-[#394966] outline-none focus:border-[#8d89d1] focus:ring-2 focus:ring-[#8d89d1]/15 sm:h-9 sm:min-h-0 sm:text-[11px]" value={newPaymentAccount.category} onChange={(event) => setNewPaymentAccount((current) => ({ ...current, category: event.target.value }))}><option value="president">บัญชีประธาน</option><option value="other">บัญชีอื่น</option></select></label>
        <label className="admin-payment-show inline-flex min-h-11 cursor-pointer items-center gap-[7px] text-[11px] font-semibold text-[#566781]"><input className="h-4 w-4 accent-[#5753a4]" type="checkbox" checked={newPaymentAccount.showInForm} onChange={(event) => setNewPaymentAccount((current) => ({ ...current, showInForm: event.target.checked }))} /><span>แสดงในฟอร์มสมัคร</span></label>
        <Button type="submit" className="min-h-11 whitespace-nowrap text-sm sm:min-h-9 sm:px-3 sm:text-[11px]" variant="outline" icon="plus">เพิ่มบัญชี</Button>
      </form>
      <div className="admin-fee-foot mt-3.5 flex items-start gap-2 border-t border-[#edf0f5] pt-3 text-[10px] leading-[1.55] text-[#79869c]"><span className="flex items-start gap-1.5"><Icon className="mt-px shrink-0" name="info" size={14} />เลือกบัญชีที่จะแสดงในหน้าสมัครได้ครั้งละ 1 บัญชี · ระบบบันทึกอัตโนมัติ</span></div>
    </AdminFormOptionAccordion>

    <AdminFormOptionAccordion
      title="ข้อสอบเก่าและราคา"
      description="จัดการรายการข้อสอบเก่า ราคา และสถานะการขาย"
      count={`${pastPaperCatalog.length} รายการ`}
      panelClassName="admin-papers-catalog"
    >
      <div className="admin-paper-table-wrap overflow-visible rounded-lg sm:overflow-auto"><table className="admin-paper-table block w-full min-w-0 border-collapse text-left sm:table sm:min-w-[560px]"><thead className="hidden sm:table-header-group"><tr className="bg-[#f8f9fd] text-[10px] text-[#738098]"><th className="px-3 py-2.5">กลุ่ม / รายการ</th><th className="px-3 py-2.5">ราคา</th><th className="px-3 py-2.5">สถานะ</th><th className="px-3 py-2.5">จัดการ</th></tr></thead><tbody className="block space-y-2 sm:table-row-group sm:space-y-0">{pastPaperCatalog.length ? pastPaperCatalog.map((paper) => <tr className="admin-paper-mobile-row grid min-w-0 grid-cols-2 gap-x-3 gap-y-1.5 rounded-lg border border-[#e7e9f1] bg-white p-3 text-[11px] text-[#485772] sm:table-row sm:rounded-none sm:border-0 sm:border-t sm:border-[#eef0f5] sm:bg-transparent sm:p-0" key={paper.id}><td className="col-span-full min-w-0 px-0 py-0 sm:px-3 sm:py-2"><small className="block text-[9px] text-[#8390a4]">{paper.group}</small><strong className="mt-0.5 block break-words text-[11px] text-[#374663]">{paper.name}</strong></td><td className="min-w-0 px-0 py-0 sm:px-3 sm:py-2"><span className="mb-1 block text-[10px] text-[#7a879b] sm:hidden">ราคา</span><label className="admin-paper-price flex w-full max-w-[125px] items-center gap-[5px] text-[#707d94]"><span>฿</span><input className="h-10 w-full min-w-0 rounded-md border border-[#dfe3ed] bg-white px-2 text-sm text-[#394966] outline-none focus:border-[#8d89d1] focus:ring-2 focus:ring-[#8d89d1]/15 sm:h-8 sm:text-[11px]" aria-label={`ราคาของ ${paper.name}`} type="number" min="0" value={paper.price} onChange={(event) => setPastPaperCatalog((current) => current.map((item) => item.id === paper.id ? { ...item, price: Math.max(0, Number(event.target.value) || 0) } : item))} /></label></td><td className="min-w-0 px-0 py-0 sm:px-3 sm:py-2"><span className="mb-1 block text-[10px] text-[#7a879b] sm:hidden">สถานะ</span><span className={paper.active ? "schedule-open" : "closed-badge"}>{paper.active ? "เปิดขาย" : "ปิดขาย"}</span></td><td className="col-span-full min-w-0 px-0 py-0 sm:px-3 sm:py-2"><span className="mb-1 block text-[10px] text-[#7a879b] sm:hidden">จัดการ</span><div className="admin-paper-actions flex items-center gap-[5px] whitespace-nowrap"><Button variant="outline" className={`admin-paper-toggle min-h-11 rounded-[9px] font-bold shadow-sm sm:min-h-9 sm:px-3 sm:text-[11px] ${paper.active ? "admin-paper-toggle-close border-[#dcb8cd] bg-[#fff3f9] text-[#9a416f] hover:border-[#bd78a2] hover:bg-[#ffe5f2] hover:text-[#802653]" : "admin-paper-toggle-open border-[#a2d5b8] bg-[#eaf8ef] text-[#116545] hover:border-[#65b88b] hover:bg-[#d7f1e0] hover:text-[#0b5438]"} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5b56a8]`} icon={paper.active ? "close" : "check"} ariaLabel={`${paper.active ? "ปิดขาย" : "เปิดขาย"}ข้อสอบเก่า ${paper.name}`} onClick={() => setPastPaperCatalog((current) => current.map((item) => item.id === paper.id ? { ...item, active: !item.active } : item))}>{paper.active ? "ปิดขาย" : "เปิดขาย"}</Button><button type="button" className="admin-paper-delete grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-[#f0dce2] bg-[#fff8f9] text-[#a36572] transition-colors hover:border-[#e9b7c0] hover:bg-[#fff0f2] hover:text-[#a83f55] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d93972] sm:h-[30px] sm:w-[30px]" aria-label={`ลบข้อสอบเก่า ${paper.title || paper.name}`} title={`ลบข้อสอบเก่า ${paper.title || paper.name}`} onClick={() => onRemovePastPaper(paper)}><Icon name="close" size={15} /></button></div></td></tr>) : <tr className="block"><td className="admin-paper-empty block px-3 py-[18px] text-center text-[#8491a4] sm:table-cell" colSpan="4">ยังไม่มีรายการข้อสอบเก่า · เพิ่มรายการใหม่ได้ด้านล่าง</td></tr>}</tbody></table></div>
      <div className="admin-add-paper mt-3 grid min-w-0 grid-cols-1 items-center gap-2 min-[701px]:grid-cols-[minmax(130px,.9fr)_minmax(170px,1.3fr)_110px_auto]"><select className="min-h-11 w-full min-w-0 rounded-lg border border-[#dfe3ed] bg-white px-2.5 text-sm text-[#354361] outline-none focus:border-[#8d89d1] focus:ring-2 focus:ring-[#8d89d1]/15 sm:h-9 sm:min-h-0 sm:text-[11px]" aria-label="กลุ่มข้อสอบเก่า" value={newPaperGroup} onChange={(event) => setNewPaperGroup(event.target.value)}>{paperGroupOptions.map((group) => <option key={group}>{group}</option>)}</select><input className="min-h-11 w-full min-w-0 rounded-lg border border-[#dfe3ed] bg-white px-2.5 text-sm text-[#354361] outline-none focus:border-[#8d89d1] focus:ring-2 focus:ring-[#8d89d1]/15 sm:h-9 sm:min-h-0 sm:text-[11px]" aria-label="ชื่อรายการข้อสอบเก่าใหม่" placeholder="ชื่อข้อสอบเก่าใหม่" value={newPaperName} onChange={(event) => setNewPaperName(event.target.value)} /><label className="flex min-w-0 items-center gap-1.5 text-[10px] text-[#7a879b]"><span>ราคา</span><input className="min-h-11 w-full min-w-0 rounded-lg border border-[#dfe3ed] bg-white px-2.5 text-sm text-[#354361] outline-none focus:border-[#8d89d1] focus:ring-2 focus:ring-[#8d89d1]/15 sm:h-9 sm:min-h-0 sm:text-[11px]" type="number" min="0" value={newPaperPrice} onChange={(event) => setNewPaperPrice(event.target.value)} /></label><Button className="min-h-11 whitespace-nowrap sm:min-h-9 sm:text-[11px]" variant="outline" disabled={!newPaperName.trim()} onClick={onAddPastPaper}>เพิ่มข้อสอบเก่า</Button></div>
      <div className="admin-fee-foot mt-3.5 flex items-start gap-2 border-t border-[#edf0f5] pt-3 text-[10px] leading-[1.55] text-[#79869c]"><span>รายการ ราคา และสถานะจะบันทึกอัตโนมัติ</span></div>
    </AdminFormOptionAccordion>

    <AdminFormOptionAccordion
      title="ระดับชั้น"
      description="ตัวเลือกระดับชั้นส่วนกลางสำหรับนำไปเลือกในแต่ละรายการสอบ"
      count={`${gradeCatalog.length} ระดับ`}
      panelClassName="admin-grade-catalog-card"
    >
      <div className="admin-grade-catalog-list grid max-h-[310px] min-w-0 grid-cols-1 gap-[7px] overflow-auto min-[701px]:grid-cols-[repeat(auto-fill,minmax(170px,1fr))]">{gradeCatalog.map((grade) => {
        const usedBy = examCatalog.filter((exam) => (exam.gradeOptions || []).includes(grade)).length;
        return <div className="admin-grade-catalog-row grid min-h-11 min-w-0 grid-cols-[44px_minmax(0,1fr)] grid-rows-[auto_auto] items-center gap-x-2 rounded-[9px] border border-[#e7e9f1] bg-white px-2 py-1 min-[701px]:min-h-10 min-[701px]:grid-cols-[32px_minmax(0,1fr)]" key={grade}><span className="col-start-2 row-start-1 w-full min-w-0 overflow-hidden text-ellipsis text-center text-xs font-bold text-[#394966]">{grade}</span><small className="col-start-2 row-start-2 w-full min-w-0 text-center text-[9px] leading-tight text-[#8a94a7]">{usedBy ? `ใช้ใน ${usedBy} รายการสอบ` : "ยังไม่ใช้ในรายการสอบ"}</small><button type="button" className="admin-grade-remove col-start-1 row-span-2 row-start-1 grid h-11 w-11 place-items-center rounded-[9px] bg-[#fff5f6] text-[#a35464] hover:bg-[#ffe8eb] hover:text-[#8d2337] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b4455f] min-[701px]:h-8 min-[701px]:w-8" aria-label={`ลบระดับชั้น ${grade}`} title={`ลบระดับชั้น ${grade}`} onClick={() => onRemoveGradeOption(grade)}><Icon name="close" size={15} /></button></div>;
      })}</div>
      <form className="admin-add-grade mt-3.5 grid min-w-0 grid-cols-1 items-center gap-2 min-[701px]:grid-cols-[140px_minmax(0,1fr)_auto]" onSubmit={(event) => { event.preventDefault(); onAddGradeOption(); }}><label className="text-xs font-bold text-[#5f6e88]" htmlFor="new-grade-option">เพิ่มระดับชั้น</label><input className="min-h-11 w-full min-w-0 rounded-lg border border-[#e1e4ed] bg-white px-3 text-sm text-[#394763] outline-none focus:border-[#8d89d1] focus:ring-2 focus:ring-[#8d89d1]/15 sm:min-h-10 sm:text-xs" id="new-grade-option" value={newGradeName} onChange={(event) => setNewGradeName(event.target.value)} placeholder="เช่น Primary 1" /><Button className="min-h-11 whitespace-nowrap sm:min-h-10" type="submit" variant="outline" disabled={!newGradeName.trim()} icon="plus">เพิ่มระดับชั้น</Button></form>
      <div className="admin-grade-catalog-note mt-3 flex items-start gap-[7px] text-[11px] leading-[1.5] text-[#808ca0]"><Icon className="mt-px shrink-0" name="info" size={14} /><span>เมื่อลบระดับชั้น ระบบจะปิดการใช้งานและนำออกจากตัวเลือกรอบสอบ แต่ข้อมูลใบสมัครเดิมยังอยู่ · ระบบบันทึกอัตโนมัติ</span></div>
    </AdminFormOptionAccordion>

    <AdminFormOptionAccordion
      title="ศูนย์สอบกลาง"
      description="นำเข้า แก้ไข และจัดการสถานะศูนย์สอบ"
      count={`${centerCatalog.length + (centerCatalog.some(isOnlineCenter) ? 0 : 1)} ศูนย์`}
      panelClassName="centers-card"
    >
      <CenterCatalogContent
        centerCatalog={centerCatalog}
        centerFile={centerFile}
        centerPreview={centerPreview}
        excludeCenterIssues={excludeCenterIssues}
        onSetExcludeCenterIssues={setExcludeCenterIssues}
        onStageCenterFile={onStageCenterFile}
        onApplyCenterImport={onApplyCenterImport}
        onSaveCenterEdit={onSaveCenterEdit}
        onUpdateCenter={onUpdateCenter}
        onDeactivateCenter={onDeactivateCenter}
        newCenterCode={newCenterCode}
        onNewCenterCodeChange={setNewCenterCode}
        newCenterName={newCenterName}
        onNewCenterNameChange={setNewCenterName}
        onAddCenter={onAddCenter}
        centerPosterVersion={centerPosterVersion}
        onCenterPosterVersionChange={onCenterPosterVersionChange}
      />
    </AdminFormOptionAccordion>
  </div>;
}
