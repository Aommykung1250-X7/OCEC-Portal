import React, { Component } from "react";

function SystemErrorPanel({
  code,
  kicker,
  title,
  description,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  standalone = false,
  showBrand = false,
}) {
  return (
    <section className={`system-error-page${standalone ? " system-error-page-standalone" : ""}`} aria-labelledby="system-error-title">
      <div className="system-error-card" role={code === "404" ? "status" : "alert"}>
        {showBrand ? (
          <a className="system-error-brand" href="/" aria-label="OCEC Portal — กลับหน้าหลัก">
            <span className="brand-logo-window"><img src="/ocec-logo.png" alt="" /></span>
            <span><strong>OCEC Portal</strong><small>ศูนย์ประสานงานการสอบ</small></span>
          </a>
        ) : null}
        <div className="system-error-art" aria-hidden="true"><span>{code}</span><i /><b /></div>
        <div className="system-error-copy">
          <p className="eyebrow">{kicker}</p>
          <h1 id="system-error-title">{title}</h1>
          <p className="system-error-description">{description}</p>
          <div className="system-error-actions">
            <button className="button button-primary" type="button" onClick={onPrimary}>{primaryLabel}</button>
            {secondaryLabel && onSecondary ? (
              <button className="button button-outline" type="button" onClick={onSecondary}>{secondaryLabel}</button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

export function NotFoundPage({ navigate }) {
  function goBack() {
    if (window.history.length > 1) window.history.back();
    else navigate("home");
  }

  return (
    <SystemErrorPanel
      code="404"
      kicker="ไม่พบหน้าที่ต้องการ"
      title="หน้านี้อาจไม่มีอยู่แล้ว"
      description="ลองตรวจสอบลิงก์อีกครั้ง หรือกลับไปเริ่มต้นจากหน้าหลักของ OCEC Portal"
      primaryLabel="กลับหน้าหลัก"
      onPrimary={() => navigate("home")}
      secondaryLabel="ย้อนกลับ"
      onSecondary={goBack}
    />
  );
}

export class AppErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("OCEC Portal render error:", error, errorInfo);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <SystemErrorPanel
        code="500"
        kicker="เกิดข้อผิดพลาด"
        title="ขออภัย ระบบแสดงหน้านี้ไม่ได้"
        description="ลองโหลดหน้าอีกครั้ง หากยังพบปัญหา โปรดกลับไปเริ่มต้นใหม่จากหน้าหลัก"
        primaryLabel="ลองโหลดอีกครั้ง"
        onPrimary={() => window.location.reload()}
        secondaryLabel="กลับหน้าหลัก"
        onSecondary={() => window.location.assign("/")}
        standalone
        showBrand
      />
    );
  }
}
