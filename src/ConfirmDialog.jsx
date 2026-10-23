import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const ConfirmContext = createContext(null);

/** Returns a Promise<boolean> after the user chooses an action in the shared dialog. */
export function useConfirm() {
  const confirmAction = useContext(ConfirmContext);
  if (!confirmAction) throw new Error('useConfirm must be used inside ConfirmDialogProvider');
  return confirmAction;
}

export function ConfirmDialogProvider({ children }) {
  const dialogRef = useRef(null);
  const activeRef = useRef(null);
  const queueRef = useRef([]);
  const [request, setRequest] = useState(null);

  const showNext = useCallback(() => {
    if (activeRef.current) return;
    const next = queueRef.current.shift();
    if (!next) return;
    activeRef.current = next;
    setRequest(next.options);
  }, []);

  const confirmAction = useCallback((options) => new Promise((resolve) => {
    queueRef.current.push({ options: typeof options === 'string' ? { message: options } : options, resolve });
    showNext();
  }), [showNext]);

  const finish = useCallback((accepted) => {
    const active = activeRef.current;
    if (!active) return;
    activeRef.current = null;
    if (dialogRef.current?.open) dialogRef.current.close();
    setRequest(null);
    active.resolve(accepted);
    queueMicrotask(showNext);
  }, [showNext]);

  useEffect(() => {
    if (request && dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
  }, [request]);

  useEffect(() => () => {
    activeRef.current?.resolve(false);
    queueRef.current.forEach((item) => item.resolve(false));
    activeRef.current = null;
    queueRef.current = [];
  }, []);

  return <ConfirmContext.Provider value={confirmAction}>
    {children}
    <dialog
      ref={dialogRef}
      className={`shared-confirm-dialog${request?.tone === 'danger' ? ' shared-confirm-danger' : ''}`}
      aria-labelledby="shared-confirm-title"
      aria-describedby="shared-confirm-message"
      onCancel={(event) => { event.preventDefault(); finish(false); }}
    >
      <p className="shared-confirm-eyebrow">โปรดยืนยัน</p>
      <h2 id="shared-confirm-title">{request?.title || 'ยืนยันการดำเนินการ?'}</h2>
      <p id="shared-confirm-message">{request?.message || ''}</p>
      <div className="shared-confirm-actions">
        <button type="button" className="shared-confirm-cancel" autoFocus onClick={() => finish(false)}>{request?.cancelLabel || 'ยกเลิก'}</button>
        <button type="button" className="shared-confirm-accept" onClick={() => finish(true)}>{request?.confirmLabel || 'ยืนยัน'}</button>
      </div>
    </dialog>
  </ConfirmContext.Provider>;
}
