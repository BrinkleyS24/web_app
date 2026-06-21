import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Chrome } from "lucide-react";
import {
  motion,
  useMotionValue,
  useSpring,
  useReducedMotion,
  useInView,
  animate,
} from "framer-motion";

const EASE_OUT = [0.16, 1, 0.3, 1];

const COLUMNS = [
  {
    key: "applied",
    label: "Applied",
    count: 47,
    dot: "#9AA7BD",
    cards: [
      { company: "Stripe", role: "Senior Frontend", tone: "neutral" },
      { company: "Notion", role: "Product Engineer", tone: "neutral" },
      { company: "Linear", role: "Product Engineer", tone: "neutral" },
    ],
  },
  {
    key: "interview",
    label: "Interview",
    count: 6,
    dot: "#2FBE8F",
    cards: [
      { company: "Figma", role: "System Design round", tone: "green" },
      { company: "Vercel", role: "Developer Advocate", tone: "green" },
    ],
  },
  {
    key: "offer",
    label: "Offer",
    count: 2,
    dot: "#34E3A8",
    cards: [{ company: "Supabase", role: "Senior Engineer", tone: "bright" }],
  },
];

// Deterministic pseudo-random so the "scatter" is stable across renders.
function scatter(seed) {
  const s = Math.sin(seed * 99.13) * 43758.5453;
  const r = s - Math.floor(s);
  return r;
}

function CountUp({ to }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-15% 0px" });
  const reduce = useReducedMotion();
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!inView) return undefined;
    if (reduce) {
      setVal(to);
      return undefined;
    }
    const controls = animate(0, to, {
      duration: 1.3,
      ease: EASE_OUT,
      onUpdate: (v) => setVal(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, to, reduce]);

  return <span ref={ref}>{val}</span>;
}

function Magnetic({ children, className, strength = 0.35 }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 18, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 220, damping: 18, mass: 0.4 });

  function onMove(e) {
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * strength);
    y.set((e.clientY - (r.top + r.height / 2)) * strength);
  }
  function reset() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      style={{ x: reduce ? 0 : sx, y: reduce ? 0 : sy }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function PipelineCard({ company, role, tone, index, seed }) {
  const reduce = useReducedMotion();
  const dx = (scatter(seed) - 0.5) * 220;
  const dy = (scatter(seed + 7) - 0.5) * 160;
  const dr = (scatter(seed + 3) - 0.5) * 26;

  const pill =
    tone === "bright"
      ? "bg-[#34E3A8]/15 text-[#7CF0C6] ring-[#34E3A8]/25"
      : tone === "green"
        ? "bg-[#2FBE8F]/15 text-[#5FD9AE] ring-[#2FBE8F]/25"
        : "bg-white/[0.06] text-[#9AA7BD] ring-white/10";

  return (
    <motion.div
      initial={reduce ? { opacity: 1 } : { opacity: 0, x: dx, y: dy, rotate: dr, scale: 0.92 }}
      whileInView={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{ duration: 0.9, ease: EASE_OUT, delay: reduce ? 0 : 0.15 + index * 0.12 }}
      whileHover={reduce ? undefined : { y: -4, transition: { duration: 0.2 } }}
      className="group rounded-xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-sm
        shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] transition-colors hover:border-white/20"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-white">{company}</span>
        <span
          className={`landingMono rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] ring-1 ${pill}`}
        >
          {tone === "neutral" ? "applied" : tone === "green" ? "interview" : "offer"}
        </span>
      </div>
      <p className="mt-1 text-[12px] leading-snug text-[#98A1B3]">{role}</p>
    </motion.div>
  );
}

export default function LandingHero({ chromeHref }) {
  const reduce = useReducedMotion();
  let seed = 0;

  return (
    <section
      id="top"
      data-testid="hero-section"
      className="relative isolate overflow-hidden bg-[#0B1220] text-white"
    >
      {/* Aurora keyframes (scoped) */}
      <style>{`
        @keyframes heroAuroraA { 0%{transform:translate(0,0) scale(1)} 50%{transform:translate(14%,-12%) scale(1.25)} 100%{transform:translate(0,0) scale(1)} }
        @keyframes heroAuroraB { 0%{transform:translate(0,0) scale(1)} 50%{transform:translate(-16%,14%) scale(1.15)} 100%{transform:translate(0,0) scale(1)} }
        @media (prefers-reduced-motion: reduce){ .heroAuroraA,.heroAuroraB{animation:none!important} }
      `}</style>

      {/* Aurora field */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="heroAuroraA absolute -left-[10%] top-[-20%] h-[560px] w-[560px] rounded-full bg-[#0E8C63] opacity-[0.28] blur-[120px] [animation:heroAuroraA_22s_ease-in-out_infinite]" />
        <div className="heroAuroraB absolute right-[-12%] top-[12%] h-[620px] w-[620px] rounded-full bg-[#2FBE8F] opacity-[0.18] blur-[130px] [animation:heroAuroraB_26s_ease-in-out_infinite]" />
        <div className="absolute left-1/3 bottom-[-30%] h-[480px] w-[480px] rounded-full bg-[#0B7CFF] opacity-[0.07] blur-[120px]" />
      </div>

      {/* Faint grid, masked toward center */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.5]
          [background-image:linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)]
          [background-size:54px_54px]
          [mask-image:radial-gradient(ellipse_75%_60%_at_50%_30%,#000_55%,transparent_100%)]"
        aria-hidden="true"
      />

      {/* Film grain */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.10] mix-blend-soft-light"
        aria-hidden="true"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="mx-auto grid max-w-[1180px] grid-cols-1 items-center gap-14 px-6 pb-20 pt-20 md:px-8 lg:grid-cols-[1.02fr_0.98fr] lg:gap-12 lg:pb-28 lg:pt-28">
        {/* LEFT — copy */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 22 }}
          animate={reduce ? {} : { opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE_OUT }}
        >
          <p className="landingMono inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.2em] text-[#5FD9AE]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#34E3A8] shadow-[0_0_10px_2px_rgba(52,227,168,0.6)]" />
            Chrome extension · Read-only Gmail
          </p>

          <h1 className="landingDisplay mt-7 text-[clamp(2.6rem,6vw,4.4rem)] font-bold leading-[0.98] tracking-[-0.035em]">
            Your job search
            <br />
            already lives in
            <br />
            <span className="relative">
              your{" "}
              <span className="bg-gradient-to-r from-[#2FBE8F] to-[#34E3A8] bg-clip-text text-transparent">
                inbox.
              </span>
            </span>
          </h1>

          <p className="mt-7 max-w-[44ch] text-[17px] leading-[1.6] text-[#98A1B3] md:text-[18px]">
            Applendium reads the Gmail threads you already have and turns them into a live application
            pipeline. No spreadsheet. No manual logging. No write access — ever.
          </p>

          <div className="mt-9 flex flex-col gap-3.5 sm:flex-row sm:items-center">
            <Magnetic className="inline-block">
              <a
                href={chromeHref}
                target="_blank"
                rel="noreferrer"
                data-testid="hero-install-button"
                className="group inline-flex items-center justify-center gap-2.5 rounded-[12px]
                  bg-gradient-to-b from-[#16A874] to-[#0E8C63] px-6 py-[15px] text-base font-semibold text-white
                  shadow-[0_10px_40px_-10px_rgba(14,140,99,0.8)] ring-1 ring-inset ring-white/15
                  transition-shadow hover:shadow-[0_14px_50px_-8px_rgba(47,190,143,0.9)]"
              >
                <Chrome className="h-4 w-4" />
                Add to Chrome — free
              </a>
            </Magnetic>
            <Link
              to="/upgrade"
              className="inline-flex items-center justify-center gap-2 rounded-[12px] border border-white/15
                bg-white/[0.03] px-5 py-[14px] text-base font-semibold text-white/90
                transition-colors hover:border-white/30 hover:bg-white/[0.06]"
            >
              See Premium
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 border-t border-white/10 pt-6">
            {["Read-only OAuth scope", "No data sold", "Revoke anytime"].map((point) => (
              <span key={point} className="flex items-center gap-2">
                <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-[#2FBE8F]" />
                <span className="text-[13px] font-medium text-[#98A1B3]">{point}</span>
              </span>
            ))}
          </div>
        </motion.div>

        {/* RIGHT — the inbox → pipeline */}
        <div className="[perspective:1400px]">
          <motion.div
            initial={reduce ? false : { opacity: 0, rotateX: 8, y: 26 }}
            animate={reduce ? {} : { opacity: 1, rotateX: 0, y: 0 }}
            transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.1 }}
            className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-md
              shadow-[0_40px_120px_-30px_rgba(0,0,0,0.8)] [transform-style:preserve-3d]"
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <span className="landingMono text-[10px] font-bold uppercase tracking-[0.18em] text-[#7C8AA3]">
                Live pipeline
              </span>
              <span className="landingMono inline-flex items-center gap-1.5 text-[10px] text-[#5FD9AE]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#34E3A8] shadow-[0_0_8px_2px_rgba(52,227,168,0.6)]" />
                synced from Gmail
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {COLUMNS.map((col) => (
                <div key={col.key} className="rounded-xl bg-white/[0.02] p-2">
                  <div className="mb-2 flex items-baseline justify-between px-1">
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-white/80">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: col.dot }} />
                      {col.label}
                    </span>
                    <span className="landingDisplay text-[18px] font-bold leading-none text-white">
                      <CountUp to={col.count} />
                    </span>
                  </div>
                  <div className="space-y-2">
                    {col.cards.map((card, i) => {
                      seed += 1;
                      return (
                        <PipelineCard
                          key={`${card.company}-${i}`}
                          {...card}
                          index={i}
                          seed={seed}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <p className="landingMono mt-3 px-1 text-center text-[10px] text-[#5C6B85]">
              every status, pulled from the thread that created it
            </p>
          </motion.div>
        </div>
      </div>

      {/* Seam: fade the dark hero into the light section below */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24 bg-gradient-to-b from-transparent to-[#FAFAF8]"
        aria-hidden="true"
      />
    </section>
  );
}
