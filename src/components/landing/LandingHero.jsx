import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Chrome, Search } from "lucide-react";
import { motion, AnimatePresence, useMotionValue, useSpring, useReducedMotion, useInView, animate } from "framer-motion";

const EASE_OUT = [0.16, 1, 0.3, 1];

// Mirrors the real extension popup (see LandingExtensionDemo): metric tiles,
// search, filter chips, and email rows with a lifecycle stepper. Interactive:
// chips filter, search filters, a row opens an inline preview.
const TILES = [
  { key: "applied", label: "Applied", value: 24, text: "text-white", bg: "bg-white/[0.05]", ring: "ring-white/10" },
  { key: "interviews", label: "Interviews", value: 6, text: "text-[#F4C770]", bg: "bg-[#F4B740]/[0.10]", ring: "ring-[#F4B740]/20" },
  { key: "offers", label: "Offers", value: 2, text: "text-[#34E3A8]", bg: "bg-[#34E3A8]/[0.10]", ring: "ring-[#34E3A8]/20" },
  { key: "rejected", label: "Rejected", value: 15, text: "text-[#F2718C]", bg: "bg-[#F2718C]/[0.08]", ring: "ring-[#F2718C]/20" },
];

const STATUS = {
  applied: { label: "Applied", pill: "bg-white/[0.06] text-[#9AA7BD] ring-white/10", reached: 1 },
  interview: { label: "Interview", pill: "bg-[#F4B740]/15 text-[#F4C770] ring-[#F4B740]/25", reached: 2 },
  offer: { label: "Offer", pill: "bg-[#34E3A8]/15 text-[#7CF0C6] ring-[#34E3A8]/25", reached: 3 },
  rejected: { label: "Rejected", pill: "bg-[#F2718C]/15 text-[#F2718C] ring-[#F2718C]/25", reached: 0, terminal: true },
};

const ROWS = [
  {
    id: "stripe",
    company: "Stripe",
    role: "Senior Frontend Engineer",
    subject: "We received your application",
    from: "Stripe Careers",
    status: "applied",
    date: "Today",
    unread: true,
    body: "Thanks for applying to the Senior Frontend Engineer role. Our team is reviewing your application and will be in touch about next steps.",
    detected: ["Application confirmed", "Role + company parsed"],
  },
  {
    id: "linear",
    company: "Linear",
    role: "Product Engineer",
    subject: "Tech screen confirmed",
    from: "Linear Recruiting",
    status: "interview",
    date: "Today",
    unread: true,
    body: "Your technical screen is confirmed for Thursday at 2:00pm. You'll meet with two engineers for a 60-minute pairing session.",
    detected: ["Moved to Interview", "Interview scheduled"],
  },
  {
    id: "supabase",
    company: "Supabase",
    role: "Senior Engineer",
    subject: "Verbal offer and next steps",
    from: "Supabase Recruiting",
    status: "offer",
    date: "Yesterday",
    unread: true,
    body: "We're thrilled to extend a verbal offer for the Senior Engineer position. The written offer with full compensation details is on its way.",
    detected: ["Moved to Offer", "Outcome detected"],
  },
  {
    id: "airbnb",
    company: "Airbnb",
    role: "Frontend Engineer",
    subject: "Update on your application",
    from: "Airbnb Recruiting",
    status: "rejected",
    date: "5d ago",
    unread: false,
    body: "After careful consideration we've decided to move forward with other candidates for this role. We'd encourage you to apply again in the future.",
    detected: ["Marked Rejected", "Pipeline updated"],
  },
];

const CHIPS = [
  { label: "All", match: null },
  { label: "Applied", match: "applied" },
  { label: "Interviews", match: "interview" },
  { label: "Offers", match: "offer" },
  { label: "Rejected", match: "rejected" },
];
const STAGE_COLORS = ["#9AA7BD", "#F4C770", "#34E3A8"];

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
    const controls = animate(0, to, { duration: 1.2, ease: EASE_OUT, onUpdate: (v) => setVal(Math.round(v)) });
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

function Stepper({ status, large = false }) {
  const s = STATUS[status];
  const dot = large ? "h-2 w-2" : "h-1.5 w-1.5";
  const seg = large ? "w-5" : "w-3";
  return (
    <div className={`flex items-center gap-1 ${large ? "" : "mt-2"}`}>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-1">
          {i > 0 ? <span className={`h-px ${seg} ${s.reached > i ? "bg-white/30" : "bg-white/10"}`} /> : null}
          <span
            className={`${dot} rounded-full`}
            style={{ background: s.reached > i ? STAGE_COLORS[i] : "rgba(255,255,255,0.18)" }}
          />
        </div>
      ))}
      {s.terminal ? (
        <div className="flex items-center gap-1">
          <span className={`h-px ${seg} bg-[#F2718C]/40`} />
          <span className={`${dot} rounded-full bg-[#F2718C]`} />
        </div>
      ) : null}
    </div>
  );
}

function EmailRow({ row, onOpen }) {
  const s = STATUS[row.status];
  return (
    <motion.button
      type="button"
      onClick={() => onOpen(row.id)}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6, transition: { duration: 0.18 } }}
      transition={{ duration: 0.4, ease: EASE_OUT }}
      className="w-full rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5 text-left transition-colors hover:border-white/20 hover:bg-white/[0.05] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#34E3A8]/50"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-white">{row.subject}</p>
          <p className="truncate text-[11px] text-[#7C8AA3]">{row.from}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {row.unread ? <span className="h-1.5 w-1.5 rounded-full bg-[#34E3A8]" /> : null}
          <span className="text-[10px] text-[#7C8AA3]">{row.date}</span>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 overflow-hidden">
        <span className={`landingMono shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ring-1 ${s.pill}`}>
          {s.label}
        </span>
        <span className="truncate text-[10px] text-[#98A1B3]">
          {row.company} · {row.role}
        </span>
      </div>
      <Stepper status={row.status} />
    </motion.button>
  );
}

function PreviewPane({ row, onBack }) {
  const s = STATUS[row.status];
  return (
    <motion.div
      key="preview"
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16, transition: { duration: 0.18 } }}
      transition={{ duration: 0.4, ease: EASE_OUT }}
      className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"
    >
      <button
        type="button"
        onClick={onBack}
        className="landingMono inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7C8AA3] transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#34E3A8]/50"
      >
        <ArrowLeft className="h-3 w-3" />
        All applications
      </button>

      <div className="mt-3 flex items-center gap-2">
        <span className={`landingMono rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ring-1 ${s.pill}`}>
          {s.label}
        </span>
        <span className="text-[11px] font-medium text-[#98A1B3]">
          {row.company} · {row.role}
        </span>
      </div>

      <p className="mt-3 text-[14px] font-semibold leading-snug text-white">{row.subject}</p>
      <div className="mt-1 flex items-center justify-between">
        <p className="text-[11px] text-[#7C8AA3]">{row.from}</p>
        <p className="text-[10px] text-[#5C6B85]">{row.date}</p>
      </div>

      <div className="mt-3 rounded-lg border border-white/[0.06] bg-[#0B1220]/60 px-3 py-2.5">
        <p className="text-[12px] leading-[1.55] text-[#B7C0CF]">{row.body}</p>
      </div>

      <div className="mt-3">
        <p className="landingMono text-[9px] font-bold uppercase tracking-[0.14em] text-[#5C6B85]">Applendium detected</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {row.detected.map((d) => (
            <span
              key={d}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#2FBE8F]/25 bg-[#2FBE8F]/10 px-2 py-0.5 text-[10px] font-medium text-[#7CF0C6]"
            >
              <span className="h-1 w-1 rounded-full bg-[#34E3A8]" />
              {d}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-white/[0.07] pt-3">
        <span className="landingMono text-[9px] font-bold uppercase tracking-[0.14em] text-[#5C6B85]">Lifecycle</span>
        <Stepper status={row.status} large />
      </div>
    </motion.div>
  );
}

export default function LandingHero({ chromeHref }) {
  const reduce = useReducedMotion();
  const [activeChip, setActiveChip] = useState("All");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState(null);

  const filtered = useMemo(() => {
    const chip = CHIPS.find((c) => c.label === activeChip);
    const q = query.trim().toLowerCase();
    return ROWS.filter((row) => {
      if (chip?.match && row.status !== chip.match) return false;
      if (!q) return true;
      return (
        row.company.toLowerCase().includes(q) ||
        row.role.toLowerCase().includes(q) ||
        row.subject.toLowerCase().includes(q)
      );
    });
  }, [activeChip, query]);

  const openRow = openId ? ROWS.find((r) => r.id === openId) : null;

  function selectChip(label) {
    setActiveChip(label);
    setOpenId(null);
  }

  return (
    <section
      id="top"
      data-testid="hero-section"
      className="relative isolate overflow-hidden bg-[#0B1220] text-white"
    >
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

      <div className="mx-auto grid max-w-[1180px] grid-cols-1 items-center gap-14 px-6 pb-20 pt-20 md:px-8 lg:grid-cols-[1.04fr_0.96fr] lg:gap-12 lg:pb-28 lg:pt-28">
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

        {/* RIGHT — the actual extension popup (interactive) */}
        <div className="[perspective:1500px]">
          <motion.div
            initial={reduce ? false : { opacity: 0, rotateX: 8, y: 26 }}
            animate={reduce ? {} : { opacity: 1, rotateX: 0, y: 0 }}
            transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.1 }}
            className="relative mx-auto max-w-[420px] overflow-hidden rounded-2xl border border-white/10
              bg-[#0C1424]/80 backdrop-blur-md shadow-[0_40px_120px_-30px_rgba(0,0,0,0.85)] [transform-style:preserve-3d]"
          >
            {/* header */}
            <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.02] px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="grid h-5 w-5 place-items-center rounded-[6px] bg-[#0B1220]">
                  <img src="/logo-transparent.png" alt="" className="h-3.5 w-3.5" />
                </span>
                <span className="text-[13px] font-semibold lowercase text-white">applendium</span>
                <span className="landingMono rounded bg-white/[0.06] px-1.5 py-0.5 text-[9px] text-[#9AA7BD]">Free</span>
                <span className="landingMono rounded bg-white/[0.06] px-1.5 py-0.5 text-[9px] text-[#9AA7BD]">47/100</span>
              </div>
              <span className="landingMono inline-flex items-center gap-1.5 text-[10px] text-[#5FD9AE]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#34E3A8] shadow-[0_0_8px_2px_rgba(52,227,168,0.6)]" />
                synced
              </span>
            </div>

            {/* body */}
            <div className="space-y-3 p-3">
              <div className="grid grid-cols-4 gap-2">
                {TILES.map((t) => {
                  const chip = CHIPS.find((c) => c.match === t.key);
                  const active = chip && activeChip === chip.label;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => chip && selectChip(active ? "All" : chip.label)}
                      className={`rounded-xl px-2 py-2 text-center ring-1 transition-all ${t.bg} ${t.ring} ${
                        active ? "ring-2 ring-offset-2 ring-offset-[#0C1424]" : "hover:brightness-125"
                      } focus:outline-none focus-visible:ring-2 focus-visible:ring-[#34E3A8]/50`}
                    >
                      <div className={`landingDisplay text-[18px] font-bold leading-none ${t.text}`}>
                        <CountUp to={t.value} />
                      </div>
                      <div className="landingMono mt-1 text-[8px] font-bold uppercase tracking-[0.12em] text-[#7C8AA3]">
                        {t.label}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 focus-within:border-[#2FBE8F]/40">
                <Search className="h-3.5 w-3.5 text-[#7C8AA3]" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setOpenId(null);
                  }}
                  placeholder="Search companies, roles…"
                  aria-label="Search applications"
                  className="w-full bg-transparent text-[11px] text-white placeholder:text-[#5C6B85] focus:outline-none"
                />
              </div>

              <div className="flex gap-1.5 overflow-hidden">
                {CHIPS.map((c) => {
                  const active = activeChip === c.label;
                  return (
                    <button
                      key={c.label}
                      type="button"
                      onClick={() => selectChip(c.label)}
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#34E3A8]/50 ${
                        active
                          ? "bg-[#0E8C63] text-white"
                          : "border border-white/10 text-[#9AA7BD] hover:border-white/25 hover:text-white"
                      }`}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>

              <div className="min-h-[228px]">
                <AnimatePresence mode="wait" initial={false}>
                  {openRow ? (
                    <PreviewPane key={`preview-${openRow.id}`} row={openRow} onBack={() => setOpenId(null)} />
                  ) : (
                    <motion.div
                      key="list"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, transition: { duration: 0.15 } }}
                      className="space-y-2"
                    >
                      <AnimatePresence mode="popLayout" initial={false}>
                        {filtered.length > 0 ? (
                          filtered.map((row) => <EmailRow key={row.id} row={row} onOpen={setOpenId} />)
                        ) : (
                          <motion.p
                            key="empty"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="rounded-xl border border-dashed border-white/10 px-3 py-8 text-center text-[11px] text-[#7C8AA3]"
                          >
                            No applications match “{query || activeChip}”.
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>

          <p className="landingMono mt-4 text-center text-[10.5px] text-[#5C6B85]">
            ↑ the real popup — tap a tile, search, or open a thread
          </p>
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
