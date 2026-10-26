import { useEffect } from "react";
import { PublicGradientBackground } from "../../components/public/PublicGradientBackground.jsx";
import { PublicPortalHeader } from "../../components/public/PublicPortalHeader.jsx";
import { ExamRounds, HomeFooter, HomeHero } from "./HomeSections.jsx";

export function LandingPage({ navigate, setPersona, authProfile, onSignIn, onSignOut, onStartApplication, resultPublished, examCatalog, demoProfile, backendEnabled }) {
  useEffect(() => {
    const section = document.getElementById("open-exams");
    const heading = section?.querySelector(".home-rounds-intro");
    if (!section || !heading || !window.IntersectionObserver || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    section.classList.add("has-card-motion");
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      section.classList.add("cards-are-visible");
      observer.disconnect();
    }, { rootMargin: "0px 0px -65% 0px", threshold: 0 });
    observer.observe(heading);
    return () => {
      observer.disconnect();
      section.classList.remove("has-card-motion", "cards-are-visible");
    };
  }, []);

  const openExams = examCatalog.filter((exam) => exam.isOpen);
  const featuredExam = openExams[0];
  return (
    <div className="public-landing public-landing-home">
      <PublicGradientBackground />
      <a className="skip-link" href="#landing-main">ข้ามไปยังเนื้อหาหลัก</a>
      <PublicPortalHeader page="home" navigate={navigate} setPersona={setPersona} authProfile={authProfile} onSignIn={onSignIn} onSignOut={onSignOut} demoProfile={demoProfile} backendEnabled={backendEnabled} />
      <main className="m-0 w-full max-w-none" id="landing-main" tabIndex="-1">
        <HomeHero
          featuredExam={featuredExam}
          onStartApplication={onStartApplication}
          onLookup={() => navigate("lookup-choice")}
        />
        <ExamRounds openExams={openExams} resultPublished={resultPublished} navigate={navigate} onStartApplication={onStartApplication} />
      </main>
      <HomeFooter navigate={navigate} />
    </div>
  );
}
