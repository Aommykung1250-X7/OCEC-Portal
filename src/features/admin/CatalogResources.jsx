import { useState } from "react";
import { Button, Icon } from "../../components/ui/index.jsx";
import { DEFAULT_CENTER_CATALOG, isOnlineCenter, ONLINE_CENTER_CODE } from "../../centers.js";
import { CenterPosterSettings } from "./CenterPosterSettings.jsx";

export function AdminFormOptionAccordion({ title, description, count, panelClassName, children }) {
  return <details className="surface admin-form-option-accordion group min-w-0 overflow-hidden rounded-[14px] border border-[#e2e5ef] bg-white p-0 transition-colors duration-150 hover:border-[#cfd2e7] open:border-[#c8c6e7] open:bg-[#fdfdff] motion-reduce:transition-none">
    <summary className="admin-form-option-summary grid min-h-16 min-w-0 cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto_16px] items-center gap-[9px] px-3 py-2.5 sm:min-h-[70px] sm:grid-cols-[minmax(0,1fr)_auto_18px] sm:gap-3.5 sm:px-[17px] sm:py-3">
      <span className="admin-form-option-copy grid min-w-0 gap-[3px]"><strong className="text-[14px] leading-[1.4] text-[#344260] sm:text-[15px]">{title}</strong><small className="text-[10px] leading-[1.5] text-[#7f8ba1] sm:text-[11px]">{description}</small></span>
      <span className="admin-form-option-count justify-self-end whitespace-nowrap rounded-[9px] bg-[#f0effb] px-[7px] py-[5px] text-[10px] font-bold text-[#5e59a6] sm:px-2.5 sm:py-1.5 sm:text-[11px]">{count}</span>
      <Icon name="chevron" size={17} className="admin-form-option-chevron" />
    </summary>
    <div className={`admin-form-option-panel min-w-0 border-t border-[#ececf3] bg-[#fcfcff] p-3.5 sm:p-5 ${panelClassName || ""}`}>{children}</div>
  </details>;
}

export function CenterSelectionList({ centers, selectedIds, onChange, label }) {
  const selectableCenters = (centers || []).filter((center) => center.active !== false && center.code !== ONLINE_CENTER_CODE);
  return (
    <fieldset className="admin-center-selection my-2.5 grid min-w-0 self-start content-start gap-2 rounded-[9px] border border-[#e8eaf2] p-3">
      <legend className="px-1 text-xs font-bold text-[#5b6590]">{label}</legend>
      <div className="admin-center-selection-list grid max-h-[190px] content-start grid-cols-1 gap-1 overflow-auto sm:grid-cols-2 sm:gap-x-[9px]">
        {selectableCenters.map((center) => (
          <label className="grid min-h-9 min-w-0 self-start cursor-pointer grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-1 rounded-md p-1 text-xs text-[#52637d] transition-colors hover:bg-[#f6f6fc]" key={center.id}>
            <input
              className="accent-[#393584]"
              type="checkbox"
              checked={(selectedIds || []).includes(center.id)}
              onChange={() => onChange((selectedIds || []).includes(center.id)
                ? selectedIds.filter((id) => id !== center.id)
                : [...(selectedIds || []), center.id])}
            />
            <span className="overflow-hidden text-ellipsis whitespace-nowrap">{center.name}</span>
            <small className="font-portal text-[11px] text-[#858fa3]">{center.code}</small>
          </label>
        ))}
        {!selectableCenters.length ? <span className="admin-center-selection-empty col-span-full text-xs text-[#8994a8]">ยังไม่มีศูนย์สอบที่เปิดใช้งาน</span> : null}
      </div>
      <small className="admin-center-online-hint text-[11px] leading-[1.4] text-[#8390a3]">Online Exam ใช้ Online : Home Base · รหัส 500 อัตโนมัติ</small>
    </fieldset>
  );
}

export function GradeSelectionList({ grades, selectedGrades, onChange, label }) {
  const selected = selectedGrades || [];
  return (
    <fieldset className="admin-center-selection admin-grade-selection my-2.5 grid min-w-0 gap-2 rounded-[9px] border border-[#e8eaf2] p-3">
      <legend className="px-1 text-xs font-bold text-[#5b6590]">{label}</legend>
      <div className="admin-center-selection-list grid max-h-[190px] grid-cols-1 gap-1 overflow-auto sm:grid-cols-2 sm:gap-x-[9px]">
        {(grades || []).map((grade) => (
          <label className="grid min-h-11 min-w-0 cursor-pointer grid-cols-[18px_minmax(0,1fr)] items-center gap-[7px] rounded-md p-1.5 text-xs text-[#52637d] transition-colors hover:bg-[#f6f6fc]" key={grade}>
            <input
              className="accent-[#393584]"
              type="checkbox"
              checked={selected.includes(grade)}
              onChange={() => onChange(selected.includes(grade) ? selected.filter((item) => item !== grade) : [...selected, grade])}
            />
            <span className="overflow-hidden text-ellipsis whitespace-nowrap">{grade}</span>
          </label>
        ))}
        {!grades?.length ? <span className="admin-center-selection-empty col-span-full text-xs text-[#8994a8]">ยังไม่มีระดับชั้น · เพิ่มรายการได้ในข้อมูลตัวเลือกของแบบฟอร์ม</span> : null}
      </div>
      <small className="admin-center-online-hint text-[11px] leading-[1.4] text-[#8390a3]">เลือกเฉพาะระดับชั้นที่เปิดรับในรายการสอบนี้</small>
    </fieldset>
  );
}

export function CenterCatalogContent({
  centerCatalog,
  centerFile,
  centerPreview,
  excludeCenterIssues,
  onSetExcludeCenterIssues,
  onStageCenterFile,
  onApplyCenterImport,
  onSaveCenterEdit,
  onUpdateCenter,
  onDeactivateCenter,
  newCenterCode,
  onNewCenterCodeChange,
  newCenterName,
  onNewCenterNameChange,
  onAddCenter,
  centerPosterVersion,
  onCenterPosterVersionChange,
}) {
  const visibleCenters = centerCatalog.some(isOnlineCenter)
    ? centerCatalog
    : [DEFAULT_CENTER_CATALOG[0], ...centerCatalog];
  const [centerDrafts, setCenterDrafts] = useState({});

  function updateCenterDraft(center, key, value) {
    setCenterDrafts((current) => ({
      ...current,
      [center.id]: { ...(current[center.id] || { code: center.code, name: center.name }), [key]: value },
    }));
  }

  async function saveCenterDraft(center) {
    const saved = await onSaveCenterEdit(center, centerDrafts[center.id] || center);
    if (saved) setCenterDrafts((current) => {
      const next = { ...current };
      delete next[center.id];
      return next;
    });
  }

  function handleCenterEditKeyDown(event, center) {
    if (event.key === "Enter") {
      event.preventDefault();
      void saveCenterDraft(center);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setCenterDrafts((current) => {
        const next = { ...current };
        delete next[center.id];
        return next;
      });
    }
  }

  return <>
    <CenterPosterSettings version={centerPosterVersion} onVersionChange={onCenterPosterVersionChange} />
    <div className="center-upload grid min-w-0 gap-2">
      <input className="absolute h-px w-px opacity-0 focus-visible:outline-2" id="center-file" type="file" accept=".xlsx" onChange={(event) => { onStageCenterFile(event.target.files?.[0]); event.target.value = ""; }} />
      <label htmlFor="center-file" className="file-drop min-h-[92px] rounded-xl border-dashed px-3 py-3 text-center focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#6762b8]"><span className="file-drop-icon"><Icon name="upload" /></span><strong className="max-w-full break-words">{centerFile || "เลือกไฟล์ Excel ศูนย์สอบ"}</strong><small>ไฟล์ .xlsx · ต้องมีชีต Center โดยคอลัมน์ A เป็นชื่อและ B เป็นรหัส</small></label>
      {centerPreview ? <div className="center-import-preview grid min-w-0 gap-2 rounded-[10px] border border-[#dfe4f1] bg-[#fbfbfe] p-3 text-xs text-[#475a75]" role="status">
        <strong className="text-[#37366f]">ตัวอย่างนำเข้า: {centerPreview.centers.length} ศูนย์ที่ใช้ได้ · {centerPreview.issues.length} แถวต้องตรวจ</strong>
        {centerPreview.issues.length ? <ul className="m-0 grid max-h-[150px] gap-1 overflow-auto pl-[18px] text-[#9a6221]">{centerPreview.issues.map((issue) => <li key={`${issue.row}-${issue.code}`}>แถว {issue.row}: {issue.message}</li>)}</ul> : <p className="m-0 text-[#728099]">ไม่พบแถวที่มีปัญหา</p>}
        {centerPreview.issues.length ? <label className="center-import-exclude flex min-h-11 items-start gap-[7px] leading-normal text-[#6e5a35]"><input className="mt-1" type="checkbox" checked={excludeCenterIssues} onChange={(event) => onSetExcludeCenterIssues(event.target.checked)} />นำเข้าเฉพาะแถวที่ถูกต้องและข้ามแถวที่แจ้งปัญหา</label> : null}
        <Button type="button" variant="outline" className="justify-self-start" disabled={!centerPreview.centers.length || (centerPreview.issues.length > 0 && !excludeCenterIssues)} onClick={onApplyCenterImport}>นำเข้าศูนย์สอบ</Button>
      </div> : null}
    </div>
    <div className="centers-table my-3.5 max-h-[480px] overflow-auto rounded-lg border border-[#edf0f4]">
      <div className="center-row center-row-head sticky top-0 z-[1] grid min-h-[30px] grid-cols-[54px_minmax(0,1fr)] items-center gap-1.5 border-t-0 bg-[#fafbfd] px-2.5 text-xs text-[#8a97a8] sm:min-h-[42px] sm:grid-cols-[64px_minmax(0,1fr)_minmax(142px,auto)] sm:gap-2.5 sm:px-4">
        <span>รหัส</span><span>ชื่อศูนย์สอบ</span><span className="col-span-full text-right sm:col-span-1 sm:text-center">สถานะและจัดการ</span>
      </div>
      {visibleCenters.map((center) => {
        const onlineCenter = isOnlineCenter(center);
        const draft = centerDrafts[center.id] || center;
        return <div className={`center-row center-row-editable grid min-h-[42px] grid-cols-[54px_minmax(0,1fr)] items-center gap-1.5 border-t border-[#f0f2f5] px-2.5 text-xs text-[#566982] sm:grid-cols-[64px_minmax(0,1fr)_minmax(142px,auto)] sm:gap-2.5 sm:px-4${center.active === false ? " center-row-inactive bg-[#fafbfd]" : ""}`} key={center.id}>
          <input className="h-10 w-full min-w-0 rounded-md border border-transparent bg-transparent px-1 text-xs text-[#405b88] outline-none transition hover:border-[#d8d8ef] hover:bg-white focus:border-[#d8d8ef] focus:bg-white disabled:cursor-not-allowed disabled:text-[#9aa4b4] sm:h-[31px] sm:text-[11px]" aria-label={`รหัสศูนย์สอบ ${center.name}`} value={draft.code} disabled={onlineCenter} maxLength={3} inputMode="numeric" onKeyDown={(event) => handleCenterEditKeyDown(event, center)} onChange={(event) => updateCenterDraft(center, "code", event.target.value)} />
          <input className="h-10 w-full min-w-0 rounded-md border border-transparent bg-transparent px-1 text-xs text-[#566982] outline-none transition hover:border-[#d8d8ef] hover:bg-white focus:border-[#d8d8ef] focus:bg-white disabled:cursor-not-allowed disabled:text-[#9aa4b4] sm:h-[31px] sm:text-[11px]" aria-label={`ชื่อศูนย์สอบ ${center.code}`} value={draft.name} disabled={onlineCenter} onKeyDown={(event) => handleCenterEditKeyDown(event, center)} onChange={(event) => updateCenterDraft(center, "name", event.target.value)} />
          <div className="center-row-actions col-span-full flex min-h-9 min-w-0 flex-wrap items-center justify-end gap-1 whitespace-nowrap px-0.5 sm:col-span-1 sm:justify-center sm:gap-[7px] sm:px-1.5">
            <span className={`${center.active === false ? "closed-badge" : "schedule-open"} px-1 py-[3px] text-[9px]`}>{onlineCenter ? "Online · ระบบ" : center.active === false ? "ปิดใช้" : "ใช้งาน"}</span>
            {center.active === false ? <Button type="button" variant="text" className="min-h-9 px-1.5 text-[10px] sm:min-h-[27px]" disabled={onlineCenter} onClick={() => onUpdateCenter(center.id, "active", true)}>เปิดใช้</Button> : <Button type="button" variant="text" className="center-delete-button !text-[#a64e62] min-h-9 px-1.5 text-[10px] sm:min-h-[27px]" disabled={onlineCenter || center.code === ONLINE_CENTER_CODE} onClick={() => onDeactivateCenter(center)}>ลบ</Button>}
          </div>
        </div>;
      })}
    </div>
    <form className="admin-add-center mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)] items-center gap-2 sm:grid-cols-[95px_minmax(0,1fr)_auto]" onSubmit={onAddCenter}><input className="min-h-11 w-full min-w-0 rounded-lg border border-[#dfe3ed] bg-white px-2.5 text-sm text-[#354361] outline-none focus:border-[#8d89d1] focus:ring-2 focus:ring-[#8d89d1]/15 sm:h-9 sm:min-h-0 sm:text-[11px]" aria-label="รหัสศูนย์สอบใหม่" placeholder="รหัสใหม่" value={newCenterCode} maxLength={3} inputMode="numeric" onChange={(event) => onNewCenterCodeChange(event.target.value)} /><input className="min-h-11 w-full min-w-0 rounded-lg border border-[#dfe3ed] bg-white px-2.5 text-sm text-[#354361] outline-none focus:border-[#8d89d1] focus:ring-2 focus:ring-[#8d89d1]/15 sm:h-9 sm:min-h-0 sm:text-[11px]" aria-label="ชื่อศูนย์สอบใหม่" placeholder="ชื่อศูนย์สอบใหม่" value={newCenterName} onChange={(event) => onNewCenterNameChange(event.target.value)} /><Button type="submit" variant="outline" className="min-h-11 whitespace-nowrap text-sm sm:min-h-9 sm:text-[11px]" disabled={!newCenterCode.trim() || !newCenterName.trim()}>เพิ่มศูนย์</Button></form>
    <div className="admin-fee-foot mt-3.5 border-t border-[#edf0f5] pt-3"><span className="text-[10px] leading-normal text-[#79869c]">กดปุ่ม Enter ในช่องเพิ่มเพื่อสร้างรายการ · เลือกช่องรหัสหรือชื่อเพื่อแก้ไข จากนั้นกดปุ่ม Enter และยืนยันการบันทึก · กดปุ่ม Esc เพื่อยกเลิกการแก้ไข · การปิดใช้งานศูนย์สอบจะไม่ลบข้อมูลในใบสมัครเดิม</span></div>
  </>;
}
