import Reveal from "./Reveal.jsx";

// The 60-second product commercial (YouTube). Privacy-aligned nocookie embed,
// lazy-loaded, framed to match the premium/CTA dark sections.
const VIDEO_ID = "B1RvF3w-AYk";
const EMBED_SRC = `https://www.youtube-nocookie.com/embed/${VIDEO_ID}?rel=0&modestbranding=1`;
const WATCH_URL = `https://youtu.be/${VIDEO_ID}`;

export default function LandingDemoVideo() {
  return (
    <section id="demo" className="relative overflow-hidden bg-[#0B1220]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-6%] top-[-16%] h-[440px] w-[440px] rounded-full bg-[#0E8C63] opacity-[0.16] blur-[140px]" />
        <div className="absolute right-[-8%] bottom-[-18%] h-[420px] w-[420px] rounded-full bg-[#2FBE8F] opacity-[0.10] blur-[140px]" />
      </div>

      <div className="relative mx-auto max-w-[1180px] px-6 py-[88px] md:px-8">
        <Reveal className="text-center">
          <p className="landingMono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#2FBE8F]">
            See it in action
          </p>
          <h2 className="landingDisplay mx-auto mt-4 max-w-[20ch] text-[32px] font-bold leading-[1.08] tracking-[-0.03em] text-white md:text-[40px]">
            The whole thing, in sixty seconds.
          </h2>
          <p className="mx-auto mt-5 max-w-[52ch] text-[17px] leading-[1.65] text-[#98A1B3]">
            A real walkthrough: the pipeline that builds itself, one-click filtering, the free
            activity report, and the Premium decision layer. Every screen is the real product.
          </p>
        </Reveal>

        <Reveal delay={0.08} className="mt-12">
          <div className="mx-auto max-w-[920px] overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_40px_120px_-30px_rgba(0,0,0,0.85)]">
            <div className="relative aspect-video w-full">
              <iframe
                className="absolute inset-0 h-full w-full"
                src={EMBED_SRC}
                title="Applendium — 60-second product demo"
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          </div>
          <p className="mt-5 text-center">
            <a
              href={WATCH_URL}
              target="_blank"
              rel="noreferrer"
              className="landingMono text-[12px] font-semibold uppercase tracking-[0.16em] text-[#5FD9AE] transition-colors hover:text-[#7CF0C6]"
            >
              Watch on YouTube →
            </a>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
