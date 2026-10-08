import React, { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import usePageMetadata from "../lib/usePageMetadata.js";
import { CHROME_WEB_STORE_URL } from "../lib/publicSiteConfig.js";
import { UNINSTALL_REASONS, submitUninstallAnswer } from "../lib/activity";

const NOTE_MAX = 280;

/**
 * The page Chrome opens when the extension is removed (chrome.runtime.setUninstallURL, ext 2.1.7).
 * One optional question. The answer goes to POST /api/feedback/uninstall with the extension
 * version, whether they were signed in, and the same one-way account key as the usage events
 * (never a name). Most people who remove it never signed in, so nothing here needs an account.
 */
export default function Goodbye() {
  const { search } = useLocation();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [state, setState] = useState("asking"); // asking | sending | thanks | error

  usePageMetadata({
    title: "Applendium™ | Sorry to see you go",
    description: "Tell us why you removed Applendium™. One click helps us make it better.",
  });

  const send = async (event) => {
    event.preventDefault();
    if (!reason || state === "sending") return;
    setState("sending");
    try {
      await submitUninstallAnswer({
        reason,
        note: note.trim() || undefined,
        uk: params.get("uk"),
        v: params.get("v"),
        si: params.get("si"),
      });
      setState("thanks");
    } catch {
      setState("error");
    }
  };

  return (
    <div className="landingPage min-h-screen bg-[#fdfdfc] text-[#111111]">
      <main className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-16">
        <Link to="/" className="flex items-center gap-2" data-testid="logo-link">
          <img src="/favicon.png" alt="Applendium™" className="h-8 w-8 rounded-md bg-[#0B1220] p-0.5" />
          <span className="landingDisplay text-xl font-extrabold tracking-tight">applendium™</span>
        </Link>

        {state === "thanks" ? (
          <section className="flex flex-col gap-3" data-testid="goodbye-thanks">
            <h1 className="landingDisplay text-3xl font-extrabold tracking-tight">
              {reason === "found_job" ? "Congratulations on the new job." : "Thank you. That helps."}
            </h1>
            <p className="text-base leading-relaxed text-[#444444]">
              Your search history stays in your account, so if you search again, Applendium™ picks up where you left off.
              Want it deleted instead? <Link to="/support" className="underline underline-offset-2">Ask us</Link> and we'll remove it.
            </p>
            {CHROME_WEB_STORE_URL ? (
              <a href={CHROME_WEB_STORE_URL} className="font-semibold text-[#0A7A55] underline underline-offset-4">
                Changed your mind? Add Applendium™ back to Chrome
              </a>
            ) : null}
          </section>
        ) : (
          <form className="flex flex-col gap-5" onSubmit={send} data-testid="goodbye-form">
            <div className="flex flex-col gap-2">
              <h1 className="landingDisplay text-3xl font-extrabold tracking-tight">Sorry to see you go</h1>
              <p className="text-base leading-relaxed text-[#444444]">
                Why did you remove Applendium™ One click helps us make it better. It's optional.
              </p>
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="sr-only">Why did you remove Applendium™</legend>
              {UNINSTALL_REASONS.map((option) => (
                <label
                  key={option.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-[15px] transition ${
                    reason === option.id ? "border-[#0E8C63] bg-[#0E8C63]/5" : "border-[#e5e5e5] hover:border-[#bdbdbd]"
                  }`}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={option.id}
                    checked={reason === option.id}
                    onChange={() => setReason(option.id)}
                    className="accent-[#0E8C63]"
                  />
                  {option.label}
                </label>
              ))}
            </fieldset>

            <label className="flex flex-col gap-2 text-sm text-[#444444]">
              Anything else we should know? (optional)
              <textarea
                value={note}
                maxLength={NOTE_MAX}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="rounded-xl border border-[#e5e5e5] px-3 py-2 text-[15px] text-[#111111] focus:border-[#0E8C63] focus:outline-none"
              />
            </label>

            {state === "error" ? (
              <p className="text-sm text-[#B42318]" role="alert">That didn't send. Please try again.</p>
            ) : null}

            <button
              type="submit"
              disabled={!reason || state === "sending"}
              className="self-start rounded-xl bg-[#0A7A55] px-5 py-3 text-[15px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              {state === "sending" ? "Sending…" : "Send"}
            </button>

            <p className="text-xs leading-relaxed text-[#6b6b6b]">
              We record your answer with the extension version and a coded account ID, never your name, email
              address or email content.
              See our <Link to="/privacy" className="underline underline-offset-2">privacy policy</Link>.
            </p>
          </form>
        )}
      </main>
    </div>
  );
}
