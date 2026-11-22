import { useEffect, useState } from "react";
import { PublicPortalHeader } from "../../components/public/PublicPortalHeader.jsx";
import { HomeApplications } from "./HomeApplications.jsx";
import { ExamRounds, HomeFooter, HomeHelpCard, HomeHero, HomeQuickActions, Journey } from "./HomeSections.jsx";

export function LandingPage({
  navigate,
  setPersona,
  authProfile,
  onSignIn,
  onSignOut,
  onStartApplication,
  resultPublished,
  examCatalog = [],
  competitionCatalog = [],
  applications = [],
  today,
  demoProfile,
  backendEnabled,
}) {
  const [ownApplications, setOwnApplications] = useState({ userId: "", items: [], error: "" });

  useEffect(() => {
    if (!authProfile?.isAdmin || !backendEnabled) return undefined;
    const controller = new AbortController();
    fetch("/api/applications/mine", { credentials: "same-origin", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("โหลดใบสมัครไม่สำเร็จ กรุณาลองรีเฟรชหน้า");
        return response.json();
      })
      .then((data) => setOwnApplications({ userId: authProfile.id, items: data.applications || [], error: "" }))
      .catch((error) => {
        if (!controller.signal.aborted) setOwnApplications({ userId: authProfile.id, items: [], error: error.message });
      });
    return () => controller.abort();
  }, [authProfile?.id, authProfile?.isAdmin, backendEnabled]);

  const loadOwnApplications = authProfile?.isAdmin && backendEnabled;
  const summaryApplications = loadOwnApplications ? ownApplications.items : applications;
  const summaryNotice = loadOwnApplications ? (ownApplications.userId !== authProfile.id ? "กำลังโหลดใบสมัคร…" : ownApplications.error) : "";

  const openExams = examCatalog.filter((exam) => exam.isOpen);
  const featuredExam = openExams[0]
    || examCatalog.find((exam) => exam.competitionId === "timo")
    || examCatalog[0]
    || null;
  const featuredCompetition = featuredExam
    ? competitionCatalog.find((item) => item.id === featuredExam.competitionId)
    : competitionCatalog[0] || null;

  return (
    <div className="public-landing public-landing-home">
      <a className="skip-link" href="#landing-main">ข้ามไปยังเนื้อหาหลัก</a>
      <PublicPortalHeader
        page="home"
        navigate={navigate}
        setPersona={setPersona}
        authProfile={authProfile}
        onSignIn={onSignIn}
        onSignOut={onSignOut}
        onStartApplication={onStartApplication}
        demoProfile={demoProfile}
        backendEnabled={backendEnabled}
      />
      <main className="m-0 w-full max-w-none" id="landing-main" tabIndex="-1">
        <HomeHero
          featuredExam={featuredExam}
          featuredCompetition={featuredCompetition}
          onStartApplication={onStartApplication}
          onLookup={() => navigate("lookup-choice")}
          navigate={navigate}
        />
        <HomeQuickActions
          navigate={navigate}
          applicationsSummary={authProfile ? (
            <HomeApplications
              examCatalog={examCatalog}
              applications={summaryApplications}
              notice={summaryNotice}
              navigate={navigate}
            />
          ) : null}
        />
        <ExamRounds
          today={today}
          examCatalog={examCatalog}
          competitionCatalog={competitionCatalog}
          resultPublished={resultPublished}
          navigate={navigate}
          onStartApplication={onStartApplication}
        />
        <Journey navigate={navigate} />
        <HomeHelpCard />
      </main>
      <HomeFooter navigate={navigate} />
    </div>
  );
}
