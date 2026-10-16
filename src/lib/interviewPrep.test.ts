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

// 2026-10-15: past interviews, and practice from the invitation when no posting is pasted.
import {interviewHasPassed,invitationPracticeInput,pickFocusAreas} from "./interviewPrep";
test("an interview in the past is recognised, with or without a time",()=>{
  const now=Date.parse("2026-10-15T16:00:00Z");
  expect(interviewHasPassed({startAt:"2026-09-30T14:00:00",timeZone:"America/New_York",hasTime:true,source:"body"},now)).toBe(true);
  expect(interviewHasPassed({startAt:"2026-10-20T14:00:00Z",timeZone:null,hasTime:true,source:"body"},now)).toBe(false);
  expect(interviewHasPassed({startAt:"2026-10-15",timeZone:null,hasTime:false,source:"ics"},now)).toBe(false);
  expect(interviewHasPassed({startAt:"2026-10-13",timeZone:null,hasTime:false,source:"ics"},now)).toBe(true);
  expect(interviewHasPassed(null,now)).toBeNull();
});
test("the employer's own ask becomes the first practice quote; logistics and greetings never do",()=>{
  const text="Hi Maria,\nThank you for your interest in the Curriculum Developer role at Quillstone Learning. We would like to invite you to a 45-minute interview on Tuesday, Sep 30 at 10:00 AM ET via Zoom: https://zoom.us/j/123.\nPlease have an example of a lesson or unit you designed ready to walk through.\nYou will design standards-aligned math units with our content team.\nLet us know if you need to reschedule.\nBest,\nDana";
  const picked=pickFocusAreas(text);
  expect(picked[0]).toBe("Please have an example of a lesson or unit you designed ready to walk through.");
  expect(picked).toContain("You will design standards-aligned math units with our content team.");
  expect(picked.some(line=>/zoom|reschedule|^Hi|^Best/i.test(line))).toBe(false);
  expect(pickFocusAreas("Please send a calendar invite to discuss your availability.\nCould you reschedule to discuss the role?")).toEqual([]);
  const input=invitationPracticeInput({excerpts:[{id:"1",subject:"Interview",sender:"Dana",receivedAt:null,text}]});
  expect(input?.focusAreas[0]).toBe(picked[0]);
  // Every quote is an exact substring of the posting once whitespace is collapsed (the backend's check).
  const flat=input!.posting.replace(/\s+/g," ");
  expect(input!.focusAreas.every(quote=>flat.includes(quote))).toBe(true);
  expect(invitationPracticeInput({excerpts:[{id:"1",subject:"",sender:"",receivedAt:null,text:"Interview at the clinic."}]})).toBeNull();
});
