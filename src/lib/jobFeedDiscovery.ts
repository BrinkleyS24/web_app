import type { FeedJob, JobFeed } from './jobFeed';

const buckets = ['recent','review','older','excluded'] as const;
const bucketOf = (row:FeedJob) => row.decision === 'excluded' ? 'excluded' : row.window === 'older' ? 'older' : row.decision === 'review' ? 'review' : 'recent';
const order = (a:FeedJob,b:FeedJob) => (b.interviewHistory?.similarRoles || 0)-(a.interviewHistory?.similarRoles || 0)
  || Date.parse(b.publishedAt)-Date.parse(a.publishedAt) || a.key.localeCompare(b.key);

// Lives only inside one authenticated request sequence; never shared between
// accounts. Retain compact identities for exclusions and only 50 exclusion
// cards. Eligible rows are retained for global ranking across pages, bounded
// separately from the identity count. No resume evidence enters storage.
export function createDiscoveryAccumulator() {
  type Entry={publishedAt:number;bucket:ReturnType<typeof bucketOf>;blocker:boolean;row?:FeedJob;bytes:number};
  const rows = new Map<string,Entry>();
  let retainedBytes=0,exclusionCards=0;
  let context:string | undefined, scanned = -1;
  return (page:JobFeed):JobFeed => {
    const binding=JSON.stringify([page.catalog.revision,page.version,page.resume.id,page.resume.fingerprint,page.discovery?.asOf,page.discovery?.totalParts]);
    if (!page.discovery || !Number.isSafeInteger(page.discovery.scannedParts) || page.discovery.scannedParts < 0 || page.discovery.scannedParts <= scanned
      || page.discovery.scannedParts > page.discovery.totalParts || page.discovery.complete !== (page.discovery.scannedParts===page.discovery.totalParts)
      || (context !== undefined && context !== binding)) throw new Error('Discovery progress changed. Check for updates to start again.');
    context = binding; scanned = page.discovery.scannedParts;
    for (const bucket of buckets) for (const row of page[bucket]) {
      const identity = row.dedupeKey || row.url;
      const prior = rows.get(identity);
      const publishedAt=Date.parse(row.publishedAt);
      if (prior && publishedAt >= prior.publishedAt) continue;
      const target=bucketOf(row);
      if(prior){retainedBytes-=prior.bytes;if(prior.bucket==='excluded'&&prior.row)exclusionCards--;}
      const retain=target!=='excluded'||Boolean(prior?.row&&prior.bucket==='excluded')||exclusionCards<50;
      const bytes=retain?JSON.stringify(row).length*2+512:0;
      rows.set(identity,{publishedAt,bucket:target,blocker:row.exclusionKind==='requirement_blocker',...(retain?{row}:{}),bytes});
      retainedBytes+=bytes;if(target==='excluded'&&retain)exclusionCards++;
    }
    if (rows.size > 100000 || retainedBytes > 64*1024*1024) throw new Error('This discovery scan is too large for this device. Choose a smaller location area in Adjust feed.');
    const all:Record<typeof buckets[number],FeedJob[]> = {recent:[],review:[],older:[],excluded:[]};
    const counts={recent:0,review:0,older:0,excluded:0};
    let requirementBlockers=0;
    for (const entry of rows.values()) {
      counts[entry.bucket]++;
      if(entry.row)all[entry.bucket].push(entry.row);
      if(entry.bucket==='excluded'&&entry.blocker)requirementBlockers++;
    }
    const exclusionSummary={requirementBlockers,insufficientEvidence:counts.excluded-requirementBlockers};
    const eligibleCandidates=[...all.recent,...all.review,...all.older];
    for (const bucket of buckets) all[bucket] = all[bucket].sort(order).slice(0,50);
    return {...page,...all,counts,exclusionSummary,eligibleCandidates};
  };
}
