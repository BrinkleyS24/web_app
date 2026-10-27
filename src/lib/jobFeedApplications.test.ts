import {expect,test} from 'vitest';
import {applicationCheckCandidates,projectApplicationAwareFeed,applicationStatusReference,retainApplicationStatuses} from './jobFeedApplications';
import type {FeedJob,JobFeed,JobApplicationStatuses} from './jobFeed';
const job=(key:string,extra:Partial<FeedJob>={}):FeedJob=>({key,title:'QA Engineer',company:'Example',url:`https://jobs.example.test/${key}`,publishedAt:'2026-10-23',decision:'supported',window:'recent',requirements:[],reasons:[],...extra} as FeedJob);
const feed=(jobs:FeedJob[]):JobFeed=>({recent:jobs.slice(0,50),review:[],older:[],excluded:[],eligibleCandidates:jobs,counts:{recent:jobs.length,review:0,older:0,excluded:0}} as JobFeed);
const statuses=(matches:JobApplicationStatuses['matches']):JobApplicationStatuses=>({status:'available',checkedAt:'2026-10-24',matches});
test('confirmed same-posting applications move out of fresh recommendations while possible history stays visible',()=>{
 const input=feed([job('already'),job('possible'),job('new')]);
 const output=projectApplicationAwareFeed(input,statuses([{key:'already',state:'confirmed',applicationId:'123'},{key:'possible',state:'possible'},{key:'new',state:'none_known'}]));
 expect(output.applied.map(row=>row.key)).toEqual(['already']);expect(output.recent.map(row=>row.key)).toEqual(['new','possible']);
 expect(output.counts).toMatchObject({recent:2,applied:1});expect(input.recent).toHaveLength(3);
});
test('applied filtering precedes the visible 50-row cap so later fresh roles are not lost',()=>{
 const jobs=Array.from({length:70},(_,i)=>job(String(i)));
 const output=projectApplicationAwareFeed(feed(jobs),statuses(jobs.map((row,i)=>({key:row.key,state:i<60?'confirmed':'none_known'}))));
 expect(output.counts).toMatchObject({recent:10,applied:60});expect(output.recent).toHaveLength(10);expect(output.applied).toHaveLength(50);
 expect(applicationCheckCandidates(feed(jobs))).toHaveLength(70);
});
test('history failure remains unknown, never turns into not applied, and fresh lookup can reclassify without another scan',()=>{
 const input=feed([job('one')]);
 expect(projectApplicationAwareFeed(input).recent[0].application?.state).toBe('unavailable');
 expect(projectApplicationAwareFeed(input,statuses([{key:'one',state:'confirmed'}])).counts.applied).toBe(1);
 expect(projectApplicationAwareFeed(input,statuses([{key:'one',state:'none_known'}])).counts.applied).toBe(0);
 expect(applicationCheckCandidates({catalogPending:true} as JobFeed)).toEqual([]);
});
test('older and review qualification decisions survive application overlays',()=>{
 const input={...feed([]),review:[job('review',{decision:'review'})],older:[job('older',{decision:'review',window:'older'})],eligibleCandidates:[job('review',{decision:'review'}),job('older',{decision:'review',window:'older'})],counts:{recent:0,review:1,older:1,excluded:0}};
 const output=projectApplicationAwareFeed(input,statuses([{key:'review',state:'possible'},{key:'older',state:'confirmed'}]));
 expect(output.review[0].decision).toBe('review');expect(output.applied[0].window).toBe('older');expect(output.counts.older).toBe(0);
});

test('changed posting references cannot reuse an old applied state during a refresh',()=>{
 const rows=[job('stable'),job('new-url'),job('new-cycle')];
 const history=statuses(rows.map(row=>({key:row.key,state:'confirmed'})));
 const changed=[rows[0],{...rows[1],url:'https://example.test/new-requisition'},{...rows[2],publishedAt:'2026-10-24'}];
 const retained=retainApplicationStatuses(history,rows.map(applicationStatusReference),changed);
 expect(retained?.matches.map(match=>match.key)).toEqual(['stable']);
 const result=projectApplicationAwareFeed(feed(changed),retained);
 expect(result.applied.map(row=>row.key)).toEqual(['stable']);
 expect(result.counts.recent).toBe(2);
 expect(result.recent.every(row=>row.application?.state==='unavailable')).toBe(true);
});
