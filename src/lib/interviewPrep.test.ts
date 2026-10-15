import {expect,test} from "vitest";
import {invitationScheduleLabel,splitFocusAreas} from "./interviewPrep";
test("calendar date-only and floating times do not shift into viewer timezone",()=>{
  const schedule={startAt:"2026-10-08T00:00:00Z",timeZone:null,hasTime:false,source:"ics"};
  expect(invitationScheduleLabel(schedule)).toBe("Oct 8, 2026. Time is unconfirmed; check the invitation.");
  // A zoned invitation is a true instant: 14:30Z is 10:30 AM in New York (2026-10-15 fix; this line
  // used to expect the UTC clock "14:30 (America/New_York)").
  expect(invitationScheduleLabel({...schedule,startAt:"2026-10-08T14:30:00",hasTime:true,timeZone:"America/New_York"})).toBe("Oct 8, 2026, 10:30 AM EDT.");
  expect(invitationScheduleLabel({...schedule,startAt:"2026-09-30T14:00:00+00:00",hasTime:true,timeZone:"America/New_York"})).toBe("Sep 30, 2026, 10:00 AM EDT.");
  expect(invitationScheduleLabel({...schedule,hasTime:true})).toContain("timezone unconfirmed");
});
test("missing schedule remains unconfirmed, focus quotes split only by line",()=>{expect(invitationScheduleLabel(null)).toMatch(/unconfirmed/);expect(splitFocusAreas("  Handle scheduling.\r\n\n Keep patient records. ")).toEqual(["Handle scheduling.","Keep patient records."]);});
