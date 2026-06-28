import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { ReferralNudge } from "./ReferralNudge";

describe("ReferralNudge", () => {
  test("renders headline text and a correct LinkedIn link for a known company", () => {
    const { container } = render(<ReferralNudge company="Acme" />);

    expect(container.textContent).toContain(
      "Referred candidates clear screening far more often than cold applies.",
    );

    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    expect(link?.getAttribute("href")).toContain("keywords=Acme");

    // Must never contain a percentage — no fabricated odds.
    expect(container.textContent).not.toMatch(/%/);
  });

  test("renders nothing when company is null", () => {
    const { container } = render(<ReferralNudge company={null} />);
    expect(container.firstChild).toBeNull();
  });

  test("renders nothing when company is an empty string", () => {
    const { container } = render(<ReferralNudge company="" />);
    expect(container.firstChild).toBeNull();
  });

  test("encodes company names with spaces in the LinkedIn href", () => {
    const { container } = render(<ReferralNudge company="Big Co" />);

    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    expect(link?.getAttribute("href")).toContain("keywords=Big%20Co");
  });
});
