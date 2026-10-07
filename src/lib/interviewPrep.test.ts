import {expect,test} from "vitest";
import {invitationScheduleLabel,splitFocusAreas} from "./interviewPrep";
test("calendar date-only and floating times do not shift into viewer timezone",()=>{
  const schedule={startAt:"2026-10-08T00:00:00Z",timeZone:null,hasTime:false,source:"ics"};
  expect(invitationScheduleLabel(schedule)).toBe("Oct 8, 2026. Time is unconfirmed; check the invitation.");
  expect(invitationScheduleLabel({...schedule,startAt:"2026-10-08T14:30:00",hasTime:true,timeZone:"America/New_York"})).toContain("14:30 (America/New_York)");
  expect(invitationScheduleLabel({...schedule,hasTime:true})).toContain("timezone unconfirmed");
});
test("missing schedule remains unconfirmed, focus quotes split only by line",()=>{expect(invitationScheduleLabel(null)).toMatch(/unconfirmed/);expect(splitFocusAreas("  Handle scheduling.\r\n\n Keep patient records. ")).toEqual(["Handle scheduling.","Keep patient records."]);});
