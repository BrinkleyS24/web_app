import React, { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import usePageMetadata from "../lib/usePageMetadata.js";
import { CHROME_WEB_STORE_URL } from "../lib/publicSiteConfig.js";
import { UNINSTALL_REASONS, submitUninstallAnswer } from "../lib/activity";
import PublicShell from "../components/landing/PublicShell.jsx";

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
    <PublicShell>
      <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-12 text-[#111111] sm:px-6 sm:py-16">

        {state === "thanks" ? (
          <section className="flex flex-col gap-3" data-testid="goodbye-thanks">
            <h1 className="landingDisplay text-3xl font-extrabold tracking-tight">
              {reason === "found_job" ? "Congratulations on the new job." : "Thank you. That helps."}
            </h1>
            <p className="text-base leading-relaxed text-[#444444]">
              Your search history stays in your account, so if you search again, Applendium™ picks up where you left off.
              Want it deleted instead? See <a href="#your-data" className="underline underline-offset-2">Your data</a> below.
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
                Why did you remove Applendium™? One click helps us make it better. It's optional.
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

        {/* Added 2026-10-14: removing the extension does not revoke Gmail access or delete stored
            data, and this page is the moment someone leaving most wants to know how. */}
        <section
          id="your-data"
          aria-labelledby="your-data-heading"
          className="rounded-xl border border-[#e5e5e5] bg-white px-5 py-4"
          data-testid="goodbye-your-data"
        >
          <h2 id="your-data-heading" className="landingDisplay text-lg font-bold tracking-tight">Your data</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#444444]">
            Removing the extension stops new syncs. It does not remove Gmail access or delete what is already stored.
          </p>
          <ul className="mt-3 flex flex-col gap-3 text-sm leading-relaxed text-[#444444]">
            <li>
              <span className="font-semibold text-[#111111]">Remove Gmail access:</span> in your Google Account, open
              Security, then Your connections to third-party apps &amp; services, choose Applendium™ and remove access.{" "}
              <a
                href="https://myaccount.google.com/connections"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-[#0A7A55] underline underline-offset-2"
              >
                Open Google Account connections
              </a>
            </li>
            <li>
              <span className="font-semibold text-[#111111]">Delete your Applendium™ data:</span> email{" "}
              <a
                href="mailto:privacy@applendium.com?subject=Delete%20my%20Applendium%20data"
                className="font-semibold text-[#0A7A55] underline underline-offset-2"
              >
                privacy@applendium.com
              </a>{" "}
              from the Gmail address you used and we will delete your account and everything stored. If you still use
              Applendium™ on another computer, you can do it yourself in Settings &gt; Your data.
            </li>
          </ul>
        </section>
      </main>
    </PublicShell>
  );
}
