import { expect, test } from "vitest";
import { actionToolHref, readActionContext } from "./actionWorkspace";
const item={logicalKey:"0123456789abcdef",dedupeKey:"fedcba9876543210"};
test("context links retain existing tool parameters/hash and carry only opaque keys",()=>{
  const href=actionToolHref("/apply-gate?tab=history#result",item);
  expect(href).toBe("/apply-gate?tab=history&action=0123456789abcdef&version=fedcba9876543210#result");
  expect(readActionContext(new URL(href,"https://applendium.com").search)).toEqual(item);
});
test("unrelated/external links and nonopaque legacy identities remain unchanged",()=>{
  for(const href of ["https://example.com/resumes","http://[","//example.com/resumes","/settings"]) expect(actionToolHref(href,item)).toBe(href);
  expect(actionToolHref("/resumes",{...item,logicalKey:"company-name"})).toBe("/resumes");
  expect(readActionContext("?action=wrong&version=fedcba9876543210")).toBeNull();
});
