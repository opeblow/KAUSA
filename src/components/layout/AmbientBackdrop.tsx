import { Spotlight } from "@/components/ui/spotlight";

/**
 * Ambient backdrop shared by every in-app page so the workspace keeps the
 * same atmosphere as the landing page: aurora streaks, a soft spotlight,
 * a fading grid and a faint noise layer.
 */
export function AmbientBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div
        className="absolute -inset-[10px] opacity-[0.18] will-change-transform [--aurora:repeating-linear-gradient(100deg,#7c6cff_10%,#3ad6f0_20%,#9d92ff_30%,#3ddc97_40%,#7c6cff_50%)] [--dark-gradient:repeating-linear-gradient(100deg,#05060a_0%,#05060a_7%,transparent_10%,transparent_12%,#05060a_16%)] [background-image:var(--dark-gradient),var(--aurora)] [background-position:50%_50%,50%_50%] [background-size:300%,_200%] [mask-image:radial-gradient(ellipse_at_50%_-10%,black_5%,transparent_60%)] after:absolute after:inset-0 after:content-[''] after:[background-image:var(--dark-gradient),var(--aurora)] after:[background-position:50%_50%,50%_50%] after:[background-size:200%,_100%] after:mix-blend-difference after:animate-aurora"
      />
      <Spotlight className="-top-72 opacity-40" />
      <div className="grid-bg radial-fade absolute inset-0 opacity-50" />
      <div className="noise absolute inset-0 opacity-[0.03]" />
    </div>
  );
}
