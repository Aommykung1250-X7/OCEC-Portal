import { lazy, Suspense } from "react";

const SoftSignalBackground = lazy(() => import("../../features/home/SoftSignalBackground.jsx"));

export function PublicGradientBackground() {
  return (
    <div className="public-gradient-background" aria-hidden="true">
      <Suspense fallback={null}>
        <SoftSignalBackground style={{ position: "absolute", inset: 0, width: "100%", height: "100%", aspectRatio: "auto" }} />
      </Suspense>
    </div>
  );
}
