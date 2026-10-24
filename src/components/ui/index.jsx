import React, { useId, useState } from "react";
import { iconGlyphs } from "./icons.js";

const DEMO_AVATAR_SRC = "/demo-google-avatar.svg";

export function ProfileAvatar({ src, alt = "", className }) {
  const [failedSrc, setFailedSrc] = useState("");
  const imageSrc = src && failedSrc !== src ? src : DEMO_AVATAR_SRC;
  return <img className={className} src={imageSrc} alt={alt} onError={() => setFailedSrc(src || DEMO_AVATAR_SRC)} />;
}

export function Icon({ name, size = 18, className = "" }) {
  const glyph = iconGlyphs[name] || iconGlyphs.file;
  return <i className={`ocec-icon fi fi-rr-${glyph} ${className}`} style={{ fontSize: `${size}px` }} aria-hidden="true" />;
}

export function GoogleMark({ className = "" }) {
  return <span className={`google-mark ${className}`} aria-hidden="true">G</span>;
}

export function BrandMark() {
  return (
    <span className="brand-logo-window" role="img" aria-label="OCEC TH">
      <img src="/ocec-logo.png" alt="" />
    </span>
  );
}

export function ExamLogo({ exam, className = "exam-type-mark", iconSize = 20 }) {
  return <span className={`${className}${exam.logoDataUrl ? " exam-logo-has-image" : ""}`}>{exam.logoDataUrl ? <img src={exam.logoDataUrl} alt={`โลโก้ ${exam.title}`} /> : <Icon name="award" size={iconSize} />}</span>;
}

const buttonBaseClasses = "inline-flex min-h-11 items-center justify-center gap-2 rounded-[9px] border px-[15px] text-[12px] font-[650] leading-[1.2] whitespace-nowrap transition-[background-color,border-color,color,box-shadow] duration-[180ms] ease-[ease] focus-visible:outline-ocec-accent focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:border-[#e3e7ec] disabled:bg-[#edf0f4] disabled:text-[#8b97a8] disabled:shadow-none [.public-landing_&]:min-h-12 [.public-landing_&]:rounded-full";

const buttonVariantClasses = {
  primary: "border-ocec-brand bg-ocec-brand text-white shadow-[0_7px_17px_rgba(58,15,52,0.16)] hover:bg-ocec-brand-dark [.public-landing_&]:shadow-none",
  outline: "border-[#C7CDD2] bg-white text-ocec-brand hover:border-ocec-brand hover:bg-ocec-brand-soft [.public-landing_&]:border-ocec-border [.public-landing_&]:hover:border-ocec-accent [.public-landing_&]:hover:bg-ocec-accent-hover",
  light: "border-white/55 bg-white/95 text-[#514f8d] hover:bg-white",
  text: "min-h-10 border-transparent bg-transparent px-2 text-ocec-brand hover:bg-ocec-brand-soft hover:text-ocec-brand-dark",
  success: "border-[#166534] bg-[#166534] text-white hover:bg-[#14532d]",
};

export function Button({ children, variant = "primary", icon, type = "button", onClick, disabled = false, className = "", ariaLabel, title }) {
  return (
    <button
      className={`button button-${variant} ${buttonBaseClasses} ${buttonVariantClasses[variant] || buttonVariantClasses.primary} ${className}`}
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={title}
    >
      {icon ? <Icon name={icon} size={17} /> : null}
      <span>{children}</span>
    </button>
  );
}

export function StatusBadge({ status }) {
  const rejected = status === "rejected";
  const pending = status !== "confirmed" && !rejected;
  const toneClasses = rejected ? "bg-[#fff0f3] text-[#9f1239]" : pending ? "bg-[#fff4d9] text-[#8a5610]" : "bg-[#e8f8ee] text-[#166534]";
  return (
    <span className={`status-badge inline-flex min-h-6 items-center gap-1.5 rounded-full px-2 text-xs font-[650] whitespace-nowrap ${toneClasses}`}>
      <span className="status-dot size-1.5 rounded-full bg-current" aria-hidden="true" />
      {rejected ? "ไม่อนุมัติ" : pending ? "อยู่ระหว่างตรวจสอบ" : "ยืนยันใบสมัคร"}
    </span>
  );
}

export function PageHeading({ eyebrow, title, description, action, className = "" }) {
  return (
    <div className={`page-heading ${className}`}>
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p className="page-description">{description}</p> : null}
      </div>
      {action ? <div className="heading-action">{action}</div> : null}
    </div>
  );
}

export function Field({ label, hint, error, required = false, children, className = "", controlClassName = "" }) {
  const id = useId();
  const hintId = id + "-hint";
  const helpText = error || hint;
  let assigned = false;
  function labelControl(element) {
    if (!React.isValidElement(element)) return element;
    if (!assigned && typeof element.type === "string" && ["input", "select", "textarea"].includes(element.type)) {
      assigned = true;
      return React.cloneElement(element, {
        id: element.props.id || id,
        className: [element.props.className, controlClassName].filter(Boolean).join(" ") || undefined,
        "aria-labelledby": [element.props["aria-labelledby"], id + "-label"].filter(Boolean).join(" "),
        "aria-describedby": [element.props["aria-describedby"], helpText ? hintId : ""].filter(Boolean).join(" ") || undefined,
        "aria-invalid": error ? true : element.props["aria-invalid"],
      });
    }
    if (element.props.children) {
      return React.cloneElement(element, undefined, React.Children.map(element.props.children, labelControl));
    }
    return element;
  }
  const controls = React.Children.map(children, labelControl);
  return (
    <div className={`field flex min-w-0 flex-col gap-[6px] ${className}`}>
      <label className="text-[12px] font-[650] text-[#3c4e68] [.public-landing_&]:text-ocec-brand" id={id + "-label"} htmlFor={id}>
        {label}{required ? <span className="required-mark"> *</span> : null}
      </label>
      {controls}
      {helpText ? <p className={`field-hint m-0 text-[12px] leading-[1.5] text-[#8794a6] [.public-landing_&]:text-[#615663] ${error ? "text-red-700" : ""}`} id={hintId} role={error ? "alert" : undefined}>{helpText}</p> : null}
    </div>
  );
}
