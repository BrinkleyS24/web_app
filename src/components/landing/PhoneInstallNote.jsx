import React, { useState } from "react";
import { Copy, Mail, Share2 } from "lucide-react";

// Added 2026-10-14: most visitors arrive from TikTok on a phone, and the only call to action was
// "Add to Chrome", which cannot work there (Chrome extensions install on a computer only). This
// gives them an honest next step: send the link to themselves. No backend: mailto, share, copy.
function siteUrl() {
  if (typeof window === "undefined") return "https://applendium.com/";
  return `${window.location.origin}/`;
}

export function installEmailHref(url = siteUrl()) {
  const subject = "Install Applendium on my computer";
  const body = `Open this on your computer in Chrome to add Applendium: ${url}`;
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function PhoneInstallNote({ className = "" }) {
  const [copied, setCopied] = useState("");
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const url = siteUrl();

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied("Link copied. Open it on your computer.");
    } catch {
      setCopied(`Copy this link: ${url}`);
    }
  }

  async function share() {
    try {
      await navigator.share({ title: "Applendium", text: "Install Applendium on my computer", url });
    } catch {
      // The person closed the share sheet; nothing to do.
    }
  }

  const buttonClass =
    "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[10px] border border-white/15 bg-white/[0.04] px-4 text-sm font-semibold text-white";

  return (
    <div
      className={`rounded-[14px] border border-white/10 bg-white/[0.04] p-4 ${className}`}
      data-testid="phone-install-note"
    >
      <p className="text-[15px] font-semibold text-white">On your phone?</p>
      <p className="mt-1 text-[14px] leading-[1.55] text-[#B7C0CF]">
        Applendium™ runs in Chrome on a computer. Send yourself the link and install it there.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a href={installEmailHref(url)} className={buttonClass} data-testid="phone-install-email">
          <Mail className="h-4 w-4" aria-hidden="true" />
          Email me the link
        </a>
        {canShare ? (
          <button type="button" onClick={share} className={buttonClass}>
            <Share2 className="h-4 w-4" aria-hidden="true" />
            Share
          </button>
        ) : null}
        <button type="button" onClick={copyLink} className={buttonClass} data-testid="phone-install-copy">
          <Copy className="h-4 w-4" aria-hidden="true" />
          Copy link
        </button>
      </div>
      <p className="mt-2 text-[13px] text-[#7CF0C6]" aria-live="polite">{copied}</p>
    </div>
  );
}
