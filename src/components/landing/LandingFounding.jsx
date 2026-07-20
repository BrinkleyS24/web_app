import React from "react";
import { ArrowRight, Check } from "lucide-react";
import Reveal from "./Reveal.jsx";
import Magnetic from "./Magnetic.jsx";
import { FOUNDING_CHECKOUT_URL } from "../../lib/publicSiteConfig.js";

const FOUNDING_INCLUDES = [
  "Lifetime Premium: Apply Gate, Daily Action Queue, Outcome Memory, Strategy Alerts, Weekly Summary",
  "Every premium feature we ship in the future, no upgrade fees, ever",
  "A direct line to the founder: founding members' feedback shapes the roadmap first",
];

export default function LandingFounding({ priceLabel }) {
  if (!FOUNDING_CHECKOUT_URL) return null;

  const compareSentence = priceLabel
    ? `Premium is ${priceLabel.amount}${priceLabel.suffix}. Lifetime pays for itself in under six months.`
    : "Lifetime pays for itself in under six months of the monthly plan.";

  return (
    <section id="founding" className="border-t border-[#E9EAE5] bg-[#F4F5F1]">
      <div className="mx-auto max-w-[1180px] px-6 py-[88px] md:px-8">
        <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <Reveal>
            <p className="landingMono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#0E8C63]">
              Founding members
            </p>
            <h2 className="landingDisplay mt-4 max-w-[18ch] text-[32px] font-bold leading-[1.08] tracking-[-0.03em] md:text-[40px]">
              20 seats. $79 once. Premium for life.
            </h2>
            <div className="mt-5 max-w-[52ch] space-y-4 text-base leading-[1.65] text-[#5C6470]">
              <p>
                Applendium is built by one person, self-funded, no investors. The next
                step is an independent security certification (Google&apos;s CASA
                assessment): a third-party lab audits the codebase, and the
                &quot;unverified app&quot; notice you currently see when connecting
                Gmail goes away for everyone.
              </p>
              <p>
                That audit costs real money. Instead of raising it elsewhere, the
                first 20 people get a deal that will not come back:{" "}
                <span className="font-semibold text-[#0B1220]">
                  $79 one time, premium forever.
                </span>
              </p>
              <p className="rounded-[12px] border border-[#D9EDE4] bg-[#EAF5F0] p-4 text-[15px] text-[#0B1220]">
                <span className="landingMono block text-[10px] font-bold uppercase tracking-[0.16em] text-[#0E8C63]">
                  Where the money goes
                </span>
                <span className="mt-1.5 block">
                  Founding seats pay for the CASA security certification. It&apos;s
                  that direct. Until it completes, Google shows the unverified notice
                  on connect and limits how many people can join at all, which is why
                  there are exactly 20 seats. That&apos;s the real constraint, not a
                  marketing countdown.
                </span>
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="overflow-hidden rounded-[16px] border border-[#E5E7E3] bg-white">
              <div className="border-b border-[#EEF0EC] bg-[#FCFCFB] px-7 py-5">
                <div className="flex items-baseline justify-between gap-4">
                  <div>
                    <p className="landingMono text-[10px] font-bold uppercase tracking-[0.16em] text-[#9AA0A6]">
                      Founding member
                    </p>
                    <p className="landingDisplay mt-2 text-[38px] font-bold leading-none tracking-[-0.02em] text-[#0B1220]">
                      $79
                      <span className="ml-1.5 text-[15px] font-semibold text-[#9AA0A6]">
                        one time
                      </span>
                    </p>
                  </div>
                  <span className="landingMono rounded-full bg-[#EAF5F0] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#0E8C63]">
                    20 seats total
                  </span>
                </div>
                <p className="landingMono mt-3 text-[11px] leading-[1.7] text-[#9AA0A6]">
                  {compareSentence}
                </p>
              </div>

              <div className="px-7 py-6">
                <ul className="space-y-3.5">
                  {FOUNDING_INCLUDES.map((item) => (
                    <li key={item} className="flex gap-3 text-[14.5px] leading-[1.55] text-[#5C6470]">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#0E8C63]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <Magnetic className="mt-7 block">
                  <a
                    href={FOUNDING_CHECKOUT_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex w-full items-center justify-center gap-2.5 rounded-[12px] bg-gradient-to-b from-[#16A874] to-[#0E8C63] px-6 py-[15px] text-base font-semibold text-white shadow-[0_10px_40px_-10px_rgba(14,140,99,0.8)] ring-1 ring-inset ring-white/15"
                    data-testid="founding-checkout-link"
                  >
                    Claim a founding seat
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </Magnetic>

                <p className="mt-4 text-[12.5px] leading-[1.6] text-[#9AA0A6]">
                  One-time payment via Stripe. Your seat is activated on the account
                  matching your checkout email within 24 hours; it&apos;s one founder,
                  not a billing robot, and that&apos;s kind of the point. Questions
                  first?{" "}
                  <a
                    href="mailto:support@applendium.com?subject=Founding%20seat"
                    className="font-semibold text-[#0B1220] underline decoration-[#D8DAD3] underline-offset-2 hover:text-[#0E8C63]"
                  >
                    support@applendium.com
                  </a>
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
