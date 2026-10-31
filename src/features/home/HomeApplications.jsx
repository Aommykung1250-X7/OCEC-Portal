import { isApplicationEditable } from '../applications/applicationUtils.js';
import { Icon, StatusBadge } from '../../components/ui/index.jsx';

export function HomeApplications({ applications = [], examCatalog = [], notice = "", navigate }) {
  const recent = [...applications].sort((a, b) => (Date.parse(b.submitted) || 0) - (Date.parse(a.submitted) || 0)).slice(0, 3);
  return (
    <section className="home-applications" aria-labelledby="home-applications-title">
      <div className="home-applications-heading"><h2 id="home-applications-title">ใบสมัครของฉัน</h2><button type="button" className="home-app-all" onClick={() => navigate('applications')}>ดูทั้งหมด <Icon name="arrow" size={14} /></button></div>
      {notice ? <p className="home-app-empty" role="status">{notice}</p> : recent.length ? <div className="home-app-list">{recent.map((application) => {
        const exams = [...new Set((application.competitions || []).map((item) => item.short || item.name).filter(Boolean))].join(' · ') || application.exam;
        const editable = isApplicationEditable(application, examCatalog);
        return <article className="home-app-row" key={application.id}><button type="button" className="home-app-details" onClick={() => navigate('application-detail', application.id)} aria-label={`ดูรายละเอียดใบสมัคร ${application.candidate} ${exams}`}>
          <StatusBadge status={application.status} />
          <strong title={application.candidate}>{application.candidate}</strong>
          <span className="home-app-exams" title={exams}>{exams}</span>
        </button><button type="button" className="home-app-edit" disabled={!editable} title={editable ? 'แก้ไขใบสมัคร' : application.status !== 'confirmed' ? 'แก้ไขได้หลังใบสมัครได้รับอนุมัติ' : 'ไม่อยู่ในช่วงที่อนุญาตให้แก้ไข'} aria-label={`แก้ไขใบสมัคร ${application.candidate}`} onClick={() => navigate('edit-application', application.id)}><Icon name="edit" size={14} /><span>แก้ไข</span></button></article>;
      })}</div> : <p className="home-app-empty">ยังไม่มีใบสมัครในบัญชีนี้</p>}
    </section>
  );
}
