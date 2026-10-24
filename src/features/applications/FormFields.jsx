import { Field } from "../../components/ui/index.jsx";

const applicationControlClasses = "w-full min-w-0 min-h-11 rounded-lg border border-ocec-border bg-white px-3 text-base text-ocec-ink transition-[border-color,box-shadow,background-color] placeholder:text-slate-400 hover:border-slate-300 focus:border-ocec-accent focus:outline-none focus:ring-4 focus:ring-ocec-accent/20 aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:ring-red-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 md:text-xs";

export function ApplicationField({ label, hint, error, required = false, children, className = "" }) {
  return <Field label={label} hint={hint} error={error} required={required} className={`application-field ${className}`} controlClassName={applicationControlClasses}>{children}</Field>;
}

export function ApplicantProfileFields({ values, onChange, disabled = false, showThaiNames = false }) {
  const field = (key) => (event) => onChange(key, event.target.value);
  return (
    <div className="admin-edit-person-grid">
      <Field label="ชื่อจริงภาษาอังกฤษ" required><input value={values.firstName} disabled={disabled} autoComplete="given-name" onChange={field("firstName")} /></Field>
      <Field label="นามสกุลภาษาอังกฤษ" required><input value={values.lastName} disabled={disabled} autoComplete="family-name" onChange={field("lastName")} /></Field>
      {showThaiNames ? <><Field label="ชื่อภาษาไทย" hint={values.thaiFirstName ? undefined : "ไม่พบชื่อภาษาไทยในใบสมัครเดิม โปรดระบุชื่อภาษาไทย"}><input value={values.thaiFirstName} disabled={disabled} onChange={field("thaiFirstName")} placeholder="ชื่อจริงภาษาไทย" /></Field><Field label="นามสกุลภาษาไทย" hint={values.thaiLastName ? undefined : "ไม่พบนามสกุลภาษาไทยในใบสมัครเดิม โปรดระบุนามสกุลภาษาไทย"}><input value={values.thaiLastName} disabled={disabled} onChange={field("thaiLastName")} placeholder="นามสกุลภาษาไทย" /></Field></> : null}
      <Field label="โรงเรียน" required><input value={values.school} disabled={disabled} onChange={field("school")} /></Field>
      <Field label="อีเมลติดต่อผู้เข้าสอบ" required hint="ใช้รับอีเมลสรุปใบสมัครและผลการตรวจสอบหลักฐานการชำระเงิน"><input type="email" value={values.email} disabled={disabled} autoComplete="email" onChange={field("email")} /></Field>
      <Field label="หมายเลขโทรศัพท์" required><input type="tel" inputMode="tel" autoComplete="tel" value={values.phone} disabled={disabled} onChange={field("phone")} placeholder="(000) 000-0000" /></Field>
      <Field label="ที่อยู่ (บ้านเลขที่ / หมู่บ้าน / ถนน)"><input value={values.address1} disabled={disabled} autoComplete="street-address" onChange={field("address1")} placeholder="ระบุบ้านเลขที่ หมู่บ้าน และถนน" /></Field>
      <Field label="อาคาร / ซอย / รายละเอียดเพิ่มเติม"><input value={values.address2} disabled={disabled} onChange={field("address2")} placeholder="หากมี" /></Field>
      <Field label="เขต / อำเภอ"><input value={values.city} disabled={disabled} onChange={field("city")} /></Field>
      <Field label="จังหวัด"><input value={values.province} disabled={disabled} autoComplete="address-level1" onChange={field("province")} /></Field>
      <Field label="รหัสไปรษณีย์"><input value={values.postalCode} disabled={disabled} inputMode="numeric" autoComplete="postal-code" onChange={field("postalCode")} /></Field>
    </div>
  );
}
