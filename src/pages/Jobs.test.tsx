import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import type { ReactNode } from 'react';
import Jobs from './Jobs';
const mocks = vi.hoisted(() => ({useAuth:vi.fn(),fetchResumeVariants:vi.fn(),fetchJobPreferences:vi.fn(),saveJobPreferences:vi.fn(),fetchJobFeed:vi.fn(),fetchJobApplicationStatuses:vi.fn(),retryJobFeed:vi.fn()}));
vi.mock('@/lib/AuthContext.jsx', () => ({useAuth:mocks.useAuth}));
vi.mock('@/components/DashboardLayout', () => ({DashboardLayout:({children}:{children:ReactNode}) => <div>{children}</div>}));
vi.mock('@/lib/emails', () => ({fetchResumeVariants:mocks.fetchResumeVariants}));
vi.mock('@/lib/jobFeed', () => ({fetchJobPreferences:mocks.fetchJobPreferences,saveJobPreferences:mocks.saveJobPreferences,fetchJobFeed:mocks.fetchJobFeed,fetchJobApplicationStatuses:mocks.fetchJobApplicationStatuses,retryJobFeed:mocks.retryJobFeed}));
const id = '00000000-0000-4000-8000-000000000001';
const preferences = {resumeMode:'default' as const,roleMode:'resume' as const,resumeId:id,roles:['QA Engineer'],workStyles:['remote'],locations:[],remoteCountry:'US',remoteRegion:'NY'};
const row = {key:'j1',title:'QA Engineer',company:'Example',location:'US - Remote',url:'https://jobs.example.com/123',publishedAt:'2026-10-15',lastCheckedAt:'2026-10-21',dateBasis:'first_published',decision:'review',window:'recent',reasons:['Confirm scoped experience.'],requirements:[]};
const feed = {resume:{id,name:'QA resume',fingerprint:'fp'},catalog:{revision:'r',capturedAt:'2026-10-21',stale:false,scope:'Limited public board inventory.',sourcesSuccessful:10,sourcesAttempted:12,sourcesFailed:2,sourcesLimited:3},counts:{recent:0,review:1,older:0,excluded:0},recent:[],review:[row],older:[],excluded:[]};
function renderPage() {
  const client = new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
  return render(<MemoryRouter><QueryClientProvider client={client}><Jobs /></QueryClientProvider></MemoryRouter>);
}
beforeEach(() => {
  mocks.retryJobFeed.mockReset().mockResolvedValue({generationPending:true});
  mocks.useAuth.mockReturnValue({user:{uid:'owner'},plan:'premium'});
  mocks.fetchResumeVariants.mockResolvedValue({variants:[{id,name:'QA resume',isDefault:true}]});
  mocks.fetchJobPreferences.mockResolvedValue({preferences,version:2,setupRequired:null,resume:{id,name:'QA resume',fingerprint:'fp'}});
  mocks.saveJobPreferences.mockImplementation(async p => ({preferences:p,version:1}));
  mocks.fetchJobFeed.mockResolvedValue(feed);
  mocks.fetchJobApplicationStatuses.mockImplementation(async jobs=>({status:'available',checkedAt:'2026-10-24',matches:jobs.map(job=>({key:job.key,state:'none_known'}))}));
});
afterEach(() => { vi.clearAllMocks(); });

test('a present graduation date can be an explicit blocker rather than missing evidence',async()=>{
 mocks.fetchJobFeed.mockResolvedValue({...feed,counts:{recent:0,review:0,older:0,excluded:1},review:[],excluded:[{...row,decision:'excluded',exclusionKind:'requirement_blocker',requirements:[{label:'Graduation within twelve months',quote:'Graduation within twelve months required.',status:'unclear',blocking:true,evidence:'B.S. expected 2028.'}]}]});
 renderPage();await userEvent.click(await screen.findByRole('button',{name:'Excluded (1)'}));
 await userEvent.click(screen.getByText('Posting requirements and resume evidence'));
 expect(screen.getByText(/Graduation within twelve months · Conflicts with the stated requirement/)).toBeVisible();
 expect(screen.getByText('Resume: B.S. expected 2028.')).toBeVisible();
});

test('confirmed applications have their own section and possible duplicates remain reviewable',async()=>{
 mocks.fetchJobFeed.mockResolvedValue({...feed,counts:{recent:1,review:1,older:0,excluded:0},recent:[{...row,key:'already',decision:'supported',title:'Already submitted QA role'}],eligibleCandidates:[{...row,key:'already',decision:'supported',title:'Already submitted QA role'},row]});
 mocks.fetchJobApplicationStatuses.mockResolvedValue({status:'available',checkedAt:'2026-10-24',matches:[{key:'already',state:'confirmed',applicationId:'7',appliedAt:'2026-10-20',status:'applied'},{key:row.key,state:'possible'}]});
 renderPage();
 await screen.findByRole('button',{name:'Already applied (1)'});
 await userEvent.click(screen.getByRole('button',{name:'Needs review (1)'}));
 expect(screen.getByText(/A similar application is in your tracker/)).toBeVisible();
 expect(screen.queryByRole('heading',{name:'Already submitted QA role'})).not.toBeInTheDocument();
 await userEvent.click(screen.getByRole('button',{name:'Already applied (1)'}));
 expect(screen.getByRole('heading',{name:'Already submitted QA role'})).toBeVisible();
 expect(screen.getByRole('link',{name:'Open tracker'})).toHaveAttribute('href','/dashboard');
 expect(mocks.saveJobPreferences).not.toHaveBeenCalled();
});

test('application history lookup failures are disclosed without hiding qualification results',async()=>{
 mocks.fetchJobApplicationStatuses.mockRejectedValue(Error('Unavailable'));
 renderPage();
 expect(await screen.findByText(/Application history could not be checked/)).toBeVisible();
 expect(screen.getByRole('heading',{name:'QA Engineer'})).toBeVisible();
});

test('changing accounts never carries previous application history into the next account',async()=>{
 mocks.fetchJobApplicationStatuses.mockResolvedValueOnce({status:'available',checkedAt:'2026-10-24',matches:[{key:row.key,state:'confirmed',applicationId:'private-owner-application'}]}).mockImplementation(()=>new Promise(()=>{}));
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 const view=()=> <MemoryRouter><QueryClientProvider client={client}><Jobs /></QueryClientProvider></MemoryRouter>;
 const rendered=render(view());
 await screen.findByRole('button',{name:'Already applied (1)'});
 mocks.useAuth.mockReturnValue({user:{uid:'different-owner'},plan:'premium'});
 rendered.rerender(view());
 await screen.findByRole('button',{name:'Needs review (1)'});
 expect(screen.getByRole('button',{name:'Already applied (0)'})).toBeVisible();
 expect(screen.queryByText(/^Already applied · Recorded/)).not.toBeInTheDocument();
 client.clear();
});

test('a reused posting key with a changed URL remains visible while updated history is pending',async()=>{
 mocks.fetchJobApplicationStatuses.mockResolvedValueOnce({status:'available',checkedAt:'2026-10-24',matches:[{key:row.key,state:'confirmed',applicationId:'old-opening'}]}).mockImplementation(()=>new Promise(()=>{}));
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 render(<MemoryRouter><QueryClientProvider client={client}><Jobs /></QueryClientProvider></MemoryRouter>);
 await screen.findByRole('button',{name:'Already applied (1)'});
 act(()=>client.setQueryData(['job-feed','owner',2,id,'fp'],{...feed,review:[{...row,url:'https://jobs.example.test/new-opening'}]}));
 await screen.findByRole('button',{name:'Needs review (1)'});
 expect(screen.getByRole('button',{name:'Already applied (0)'})).toBeVisible();
 client.clear();
});
test.each(['', '   '])('clearing a saved target override to %j saves resume-based roles', async value => {
  mocks.fetchJobPreferences.mockResolvedValue({preferences:{...preferences,roleMode:'custom',roles:['Backend Engineer']},version:2});
  mocks.saveJobPreferences.mockResolvedValue({preferences,version:3,setupRequired:null});
  renderPage();
  await userEvent.click(await screen.findByRole('button',{name:'Adjust feed'}));
  const titles = screen.getByRole('textbox',{name:/Target job titles/});
  await userEvent.clear(titles);
  if (value) await userEvent.type(titles,value);
  await userEvent.click(screen.getByRole('button',{name:'Save preferences'}));
  await waitFor(() => expect(mocks.saveJobPreferences).toHaveBeenCalledWith({...preferences,roles:[]},2));
  expect(await screen.findByText('Resume-driven discovery · No title filter')).toBeVisible();
  expect(screen.queryByRole('textbox',{name:/Target job titles/})).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button',{name:'Adjust feed'}));
  expect(screen.getByRole('checkbox',{name:'Limit discovery to target titles'})).not.toBeChecked();
  await userEvent.click(screen.getByRole('checkbox',{name:'Limit discovery to target titles'}));
  expect(screen.getByRole('textbox',{name:/Target job titles/})).toHaveValue('');
});

test('resume suggestions never populate the optional override, and entered titles stay explicit',async()=>{
  renderPage();
  await userEvent.click(await screen.findByRole('button',{name:'Adjust feed'}));
  expect(screen.getByText(/Without an override, job titles do not limit discovery/)).toBeVisible();
  await userEvent.click(screen.getByRole('checkbox',{name:'Limit discovery to target titles'}));
  const titles=screen.getByRole('textbox',{name:/Target job titles/});
  expect(titles).toHaveValue('');
  await userEvent.type(titles,'Backend Engineer');
  await userEvent.click(screen.getByRole('button',{name:'Save preferences'}));
  await waitFor(()=>expect(mocks.saveJobPreferences).toHaveBeenCalledWith({...preferences,roleMode:'custom',roles:['Backend Engineer']},2));
  expect(await screen.findByText('Your target titles: Backend Engineer')).toBeVisible();
});

test('choosing another resume clears the previous resume target override',async()=>{
  const other='00000000-0000-4000-8000-000000000002';
  mocks.fetchResumeVariants.mockResolvedValue({variants:[{id,name:'QA resume',isDefault:true},{id:other,name:'Other resume',isDefault:false}]});
  mocks.fetchJobPreferences.mockResolvedValue({preferences:{...preferences,roleMode:'custom',roles:['Backend Engineer']},version:2});
  renderPage();
  await userEvent.click(await screen.findByRole('button',{name:'Adjust feed'}));
  await userEvent.selectOptions(screen.getByRole('combobox',{name:'Matching resume'}),other);
  expect(screen.getByRole('checkbox',{name:'Limit discovery to target titles'})).not.toBeChecked();
  await userEvent.click(screen.getByRole('checkbox',{name:'Limit discovery to target titles'}));
  expect(screen.getByRole('textbox',{name:/Target job titles/})).toHaveValue('');
});

test('the default resume automatically brings matches without a search form or save', async () => {
  renderPage();
  expect(await screen.findByRole('button',{name:'Needs review (1)'})).toBeInTheDocument();
  expect(screen.queryByRole('textbox',{name:/Target job titles/})).not.toBeInTheDocument();
  expect(mocks.fetchJobFeed).toHaveBeenCalledWith(2,expect.anything(),'fp',expect.any(Function));
  expect(mocks.saveJobPreferences).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button',{name:'Adjust feed'}));
  expect(screen.getByRole('combobox',{name:'Matching resume'})).toHaveValue('default');
});
test('first use confirms work preferences without selecting a target title override', async () => {
  mocks.fetchJobPreferences.mockResolvedValue({preferences:{...preferences,workStyles:[],remoteCountry:'',remoteRegion:''},version:0,setupRequired:'location'});
  renderPage();
  expect(await screen.findByRole('combobox',{name:'Matching resume'})).toHaveValue('default');
  for (const style of ['Remote','Hybrid','Onsite']) expect(screen.getByRole('checkbox',{name:style})).not.toBeChecked();
  expect(screen.queryByRole('textbox',{name:/Target job titles/})).not.toBeInTheDocument();
  expect(mocks.fetchJobFeed).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('checkbox',{name:'Remote'}));
  await userEvent.selectOptions(screen.getByRole('combobox',{name:/Country you would work remotely from/}),'US');
  await userEvent.click(screen.getByRole('button',{name:'Start my feed'}));
  await waitFor(() => expect(mocks.saveJobPreferences).toHaveBeenCalledWith({...preferences,remoteRegion:''},0));
  expect(await screen.findByRole('button',{name:'Needs review (1)'})).toBeInTheDocument();
});
test('review-only opportunities appear automatically and opening never records an application', async () => {
  mocks.fetchJobPreferences.mockResolvedValue({preferences,version:2}); renderPage();
  expect(await screen.findByRole('button',{name:'Needs review (1)'})).toBeInTheDocument();
  expect(screen.getByRole('heading',{name:'QA Engineer'})).toBeVisible();
  expect(screen.getByRole('button',{name:'Needs review (1)'})).toHaveAttribute('aria-pressed','true');
  expect(screen.getByText('Confirm scoped experience.')).toBeInTheDocument();
  expect(screen.getByRole('link',{name:/Read employer posting/})).toHaveAttribute('rel','noopener noreferrer');
});
test('archived resume prompts replacement and never silently chooses the default', async () => {
  mocks.fetchJobPreferences.mockResolvedValue({preferences:{...preferences,resumeId:'00000000-0000-4000-8000-000000000002'},version:2}); renderPage();
  expect(await screen.findByText(/Your saved resume is unavailable/)).toBeInTheDocument();
  expect(mocks.fetchJobFeed).not.toHaveBeenCalled();
});
test('unsaved changes hide old results, and discard restores saved choices', async () => {
  mocks.fetchJobPreferences.mockResolvedValue({preferences,version:2}); renderPage();
  await screen.findByRole('button',{name:/Needs review \(\d+\)/});
  await userEvent.click(screen.getByRole('button',{name:'Adjust feed'}));
  await userEvent.click(screen.getByRole('checkbox',{name:'Limit discovery to target titles'}));
  await userEvent.type(screen.getByRole('textbox',{name:/Target job titles/}),' Backend');
  expect(screen.queryByText('No resume-supported matches in this collection')).not.toBeInTheDocument();
  expect(screen.getByText(/Unsaved changes/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button',{name:'Discard changes'}));
  expect(screen.queryByRole('textbox',{name:/Target job titles/})).not.toBeInTheDocument();
});
test('service failures are shown as errors rather than an empty job market', async () => {
  mocks.fetchJobPreferences.mockResolvedValue({preferences,version:2}); mocks.fetchJobFeed.mockRejectedValue(new Error('Catalog unavailable')); renderPage();
  expect(await screen.findByText('Jobs could not be loaded')).toBeInTheDocument();
  expect(screen.queryByText('No resume-supported matches in this collection')).not.toBeInTheDocument();
});
test('a settings failure never shows setup instructions for a form that could not load', async () => {
  mocks.fetchJobPreferences.mockRejectedValue(new Error('The job search service is temporarily unavailable. Please try again.'));
  renderPage();
  expect(await screen.findByText('Your feed preferences did not load')).toBeInTheDocument();
  expect(screen.queryByText('Make this search yours')).not.toBeInTheDocument();
  expect(screen.queryByRole('combobox',{name:'Matching resume'})).not.toBeInTheDocument();
  expect(mocks.fetchJobFeed).not.toHaveBeenCalled();
});
test('free plans make no preference, resume or matching requests', async () => {
  mocks.useAuth.mockReturnValue({user:{uid:'free'},plan:'free'}); renderPage();
  expect(screen.getByText('Jobs is included with Premium')).toBeInTheDocument();
  expect(mocks.fetchJobPreferences).not.toHaveBeenCalled(); expect(mocks.fetchResumeVariants).not.toHaveBeenCalled(); expect(mocks.fetchJobFeed).not.toHaveBeenCalled();
});
test('a background settings refresh cannot silently replace the draft version used for saving', async () => {
  mocks.fetchJobPreferences.mockResolvedValue({preferences,version:2});
  const client = new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
  render(<MemoryRouter><QueryClientProvider client={client}><Jobs /></QueryClientProvider></MemoryRouter>);
  await screen.findByRole('button',{name:/Needs review \(\d+\)/});
  await userEvent.click(screen.getByRole('button',{name:'Adjust feed'}));
  await userEvent.click(screen.getByRole('checkbox',{name:'Limit discovery to target titles'}));
  await userEvent.type(screen.getByRole('textbox',{name:/Target job titles/}),'QA Engineer testing');
  act(() => client.setQueryData(['job-preferences','owner'],{preferences:{...preferences,roles:['Analyst']},version:3}));
  mocks.saveJobPreferences.mockRejectedValue(new Error('Your search changed in another tab.'));
  await userEvent.click(screen.getByRole('button',{name:'Save preferences'}));
  await waitFor(() => expect(mocks.saveJobPreferences).toHaveBeenCalledWith({...preferences,roleMode:'custom',roles:['QA Engineer testing']},2));
  expect(await screen.findByText('Your preferences were not saved')).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Reload saved preferences'})).toBeInTheDocument();
});

test('a pending first collection is displayed as preparation rather than an error or zero matches',async()=>{
  mocks.fetchJobFeed.mockResolvedValue({catalogPending:true,message:'Your feed is being prepared.'});
  renderPage();
  expect(await screen.findByText('Preparing your job feed')).toBeInTheDocument();
  expect(screen.queryByText('Jobs could not be loaded')).not.toBeInTheDocument();
  expect(screen.queryByText('No resume-supported matches in this collection')).not.toBeInTheDocument();
});

test('a background refresh preserves the card and expanded evidence',async()=>{
  mocks.fetchJobFeed.mockResolvedValue({...feed,counts:{...feed.counts,recent:1,review:0},recent:[{...row,decision:'supported',requirements:[{label:'Python',quote:'Python required.',status:'satisfied',evidence:'Developed Python automation.'}]}],review:[]});
  renderPage();
  await screen.findByRole('heading',{name:'QA Engineer'});
  const summary=screen.getByText('Posting requirements and resume evidence');
  await userEvent.click(summary);
  expect(summary.closest('details')).toHaveAttribute('open');
  let finish: (value:unknown)=>void;
  mocks.fetchJobFeed.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
  await userEvent.click(screen.getByRole('button',{name:'Check for updates'}));
  expect(await screen.findByText('Checking for updates…')).toBeInTheDocument();
  expect(screen.getByRole('heading',{name:'QA Engineer'})).toBeInTheDocument();
  expect(summary.closest('details')).toHaveAttribute('open');
  await act(async()=>finish({...feed,counts:{...feed.counts,recent:1,review:0},recent:[{...row,decision:'supported',requirements:[{label:'Python',quote:'Python required.',status:'satisfied',evidence:'Developed Python automation.'}]}],review:[]}));
  expect(summary.closest('details')).toHaveAttribute('open');
  expect(screen.getByText('Developed Python automation.',{exact:false})).toBeVisible();
});

test('switching to a different resume hides the previous resume results during matching',async()=>{
  mocks.fetchJobFeed.mockResolvedValue({...feed,counts:{...feed.counts,recent:1},recent:[row]});
  const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
  render(<MemoryRouter><QueryClientProvider client={client}><Jobs /></QueryClientProvider></MemoryRouter>);
  await screen.findByRole('heading',{name:'QA Engineer'});
  mocks.fetchJobFeed.mockImplementationOnce(()=>new Promise(()=>{}));
  act(()=>client.setQueryData(['job-preferences','owner'],{preferences,version:3,resume:{id,name:'Updated resume',fingerprint:'changed'}}));
  await waitFor(()=>expect(screen.queryByRole('heading',{name:'QA Engineer'})).not.toBeInTheDocument());
});

test('a failed update keeps loaded jobs, but a rejected access check hides them',async()=>{
  mocks.fetchJobFeed.mockResolvedValue({...feed,counts:{...feed.counts,recent:1},recent:[row]});
  renderPage();
  await screen.findByRole('heading',{name:'QA Engineer'});
  mocks.fetchJobFeed.mockRejectedValueOnce(Object.assign(new Error('Temporarily unavailable'),{status:503}));
  await userEvent.click(screen.getByRole('button',{name:'Check for updates'}));
  expect(await screen.findByText('Updates could not be loaded')).toBeInTheDocument();
  expect(screen.getByRole('heading',{name:'QA Engineer'})).toBeInTheDocument();
  mocks.fetchJobFeed.mockRejectedValueOnce(Object.assign(new Error('Access denied'),{status:403}));
  await userEvent.click(screen.getByRole('button',{name:'Check for updates'}));
  expect(await screen.findByText('Jobs could not be loaded')).toBeInTheDocument();
  expect(screen.queryByRole('heading',{name:'QA Engineer'})).not.toBeInTheDocument();
});

test('a stale collection is unavailable rather than a zero-match verdict',async()=>{
  mocks.fetchJobFeed.mockResolvedValue({...feed,catalog:{...feed.catalog,stale:true},counts:{recent:0,review:0,older:0,excluded:0},review:[]});
  renderPage();
  expect(await screen.findByText('The job collection needs an update')).toBeVisible();
  expect(screen.queryByRole('button',{name:'Matches (0)'})).not.toBeInTheDocument();
  expect(screen.queryByText('No resume-supported matches in this collection')).not.toBeInTheDocument();
  expect(mocks.fetchJobApplicationStatuses).not.toHaveBeenCalled();
});

test('a known expired catalog hides cached jobs and recovers on a fresh update',async()=>{
  renderPage();
  await screen.findByRole('heading',{name:'QA Engineer'});
  mocks.fetchJobFeed.mockRejectedValueOnce(Object.assign(new Error('Collection expired'),{status:503,payload:{code:'catalog_stale'}}));
  await userEvent.click(screen.getByRole('button',{name:'Check for updates'}));
  expect(await screen.findByText('The job collection needs an update')).toBeVisible();
  expect(screen.queryByRole('heading',{name:'QA Engineer'})).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Job result sections')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button',{name:'Check for updates'}));
  expect(await screen.findByRole('heading',{name:'QA Engineer'})).toBeVisible();
  expect(screen.queryByText('The job collection needs an update')).not.toBeInTheDocument();
});

test('city, state, and country fields save multiple locations without special syntax',async()=>{
  mocks.fetchJobPreferences.mockResolvedValue({preferences:{...preferences,workStyles:[],remoteCountry:'',remoteRegion:''},version:0,setupRequired:'location'});
  renderPage();
  await screen.findByRole('checkbox',{name:'Hybrid'});
  await userEvent.click(screen.getByRole('checkbox',{name:'Hybrid'}));
  await userEvent.type(screen.getByRole('textbox',{name:'City'}),'New York');
  await userEvent.selectOptions(screen.getByRole('combobox',{name:'Country'}),'US');
  await userEvent.selectOptions(screen.getByRole('combobox',{name:'State or region (optional)'}),'NY');
  await userEvent.click(screen.getByRole('button',{name:'Add another location'}));
  await userEvent.type(screen.getAllByRole('textbox',{name:'City'})[1],'Jersey City');
  await userEvent.selectOptions(screen.getAllByRole('combobox',{name:'State or region (optional)'})[1],'NJ');
  await userEvent.click(screen.getByRole('button',{name:'Start my feed'}));
  await waitFor(()=>expect(mocks.saveJobPreferences).toHaveBeenCalledWith({...preferences,workStyles:['hybrid'],remoteCountry:'',remoteRegion:'',locations:[{city:'New York',country:'US',region:'NY'},{city:'Jersey City',country:'US',region:'NJ'}]},0));
});

test('changing remote country clears a previous state choice and supports non-US regions',async()=>{
  renderPage();
  await screen.findByRole('button',{name:/Needs review \(\d+\)/});
  await userEvent.click(screen.getByRole('button',{name:'Adjust feed'}));
  await userEvent.selectOptions(screen.getByRole('combobox',{name:/Country you would work remotely from/}),'CA');
  const region=screen.getByRole('textbox',{name:/Remote working state or region/});
  expect(region).toHaveValue('');
  await userEvent.type(region,'Ontario');
  await userEvent.click(screen.getByRole('button',{name:'Save preferences'}));
  await waitFor(()=>expect(mocks.saveJobPreferences).toHaveBeenCalledWith({...preferences,remoteCountry:'CA',remoteRegion:'Ontario'},2));
});

test('long notes stay available in full and coverage starts collapsed',async()=>{
  const reasons=['Confirm the full requirement: '+ 'Long requirement '.repeat(20),'Second uncertainty.','Third uncertainty.'];
  mocks.fetchJobFeed.mockResolvedValue({...feed,review:[{...row,reasons}]});
  renderPage();
  await screen.findByRole('button',{name:/Needs review \(\d+\)/});
  expect(screen.getByText(/Limited public board inventory/)).not.toBeVisible();
  await userEvent.click(screen.getByRole('button',{name:'Needs review (1)'}));
  expect(screen.getByText('Third uncertainty.')).not.toBeVisible();
  await userEvent.click(screen.getByText('All fit notes (3)'));
  expect(screen.getByText(reasons[0].trim())).toBeVisible();
  expect(screen.getByText('Third uncertainty.')).toBeVisible();
});

test('interview history explains eligible ordering without inventing a rate or submitted resume',async()=>{
  mocks.fetchJobFeed.mockResolvedValue({...feed,personalization:{status:'available',interviewedRoles:9},review:[{...row,interviewHistory:{similarRoles:9,roleFamily:'QA and testing'}}]});
  renderPage();
  await screen.findByRole('button',{name:/Needs review \(\d+\)/});
  await userEvent.click(screen.getByRole('button',{name:'Needs review (1)'}));
  expect(screen.getByText('Your history marks 9 similar QA and testing roles as Interviewed or Offer.')).toBeVisible();
  await userEvent.click(screen.getByText('Job sources and coverage',{exact:true}));
  expect(screen.getByText('Similar roles with tracked interview outcomes appear first.')).toBeVisible();
});

test('unsupported fit is distinguished from a known requirement blocker',async()=>{
  mocks.fetchJobFeed.mockResolvedValue({...feed,counts:{recent:0,review:0,older:0,excluded:2},review:[],excluded:[
    {...row,key:'level',title:'Staff Software Engineer',decision:'excluded',exclusionKind:'seniority',interviewHistory:{similarRoles:20,roleFamily:'software engineering'},reasons:['The selected resume does not establish staff-level work.']},
    {...row,key:'degree',title:'QA Engineer',decision:'excluded',exclusionKind:'requirement_blocker',reasons:['A completed degree is required.']},
  ]});
  renderPage();
  await screen.findByRole('button',{name:/Needs review \(\d+\)/});
  await userEvent.click(screen.getByRole('button',{name:'Excluded (2)'}));
  expect(screen.getByText('Qualification not established')).toBeVisible();
  expect(screen.getByText(/Missing evidence does not mean you lack the qualification/)).toBeVisible();
  expect(screen.getByText('Requirement blocker')).toBeVisible();
  expect(screen.queryByText(/Your history marks .* similar/)).not.toBeInTheDocument();
});

test('history outages do not masquerade as no interview history',async()=>{
  mocks.fetchJobFeed.mockResolvedValue({...feed,personalization:{status:'unavailable',interviewedRoles:0}});
  renderPage();
  expect(await screen.findByText('Interview history is temporarily unavailable. Jobs are ordered by posting date.')).toBeVisible();
});

test('an explicit empty Matches tab remains selected during a background update',async()=>{
 renderPage();await screen.findByRole('heading',{name:'QA Engineer'});
 await userEvent.click(screen.getByRole('button',{name:'Matches (0)'}));
 expect(screen.getByText('No resume-supported matches in this collection')).toBeVisible();
 await userEvent.click(screen.getByRole('button',{name:'Check for updates'}));
 await waitFor(()=>expect(mocks.fetchJobFeed).toHaveBeenCalledTimes(2));
 expect(screen.getByRole('button',{name:'Matches (0)'})).toHaveAttribute('aria-pressed','true');
 expect(screen.queryByRole('heading',{name:'QA Engineer'})).not.toBeInTheDocument();
});

test('new matches do not interrupt reading a review opportunity selected automatically',async()=>{
 const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
 render(<MemoryRouter><QueryClientProvider client={client}><Jobs /></QueryClientProvider></MemoryRouter>);
 await screen.findByRole('heading',{name:'QA Engineer'});
 const details=screen.getByText('Posting requirements and resume evidence');await userEvent.click(details);
 act(()=>client.setQueryData(['job-feed','owner',2,id,'fp'],{...feed,counts:{...feed.counts,recent:1},recent:[{...row,key:'new',title:'Backend Engineer',decision:'supported'}]}));
 expect(screen.getByRole('button',{name:'Needs review (1)'})).toHaveAttribute('aria-pressed','true');
 expect(details.closest('details')).toHaveAttribute('open');
 expect(screen.queryByRole('heading',{name:'Backend Engineer'})).not.toBeInTheDocument();
});

test('the selected resume mode and custom role focus are visible without opening preferences',async()=>{
  mocks.fetchJobPreferences.mockResolvedValue({preferences:{...preferences,resumeMode:'chosen',roleMode:'custom',roles:['Software Engineer']},version:2});
  renderPage();
  await screen.findByRole('button',{name:/Needs review \(\d+\)/});
  expect(screen.getByText(/Chosen resume/)).toBeVisible();
  expect(screen.getByText('Your target titles: Software Engineer')).toBeVisible();
});


test('background preparation is a real pending state without fake zero matches or application checks',async()=>{
 mocks.fetchJobPreferences.mockResolvedValue({preferences,version:2,backgroundGeneration:true,resume:{id,name:'QA resume',fingerprint:'fp'}});
 mocks.fetchJobFeed.mockResolvedValue({generationPending:true,generation:{state:'queued'},matchingMode:'resume_discovery',version:2,resume:feed.resume,catalog:feed.catalog});
 renderPage();
 expect(await screen.findByText('Preparing your matches')).toBeVisible();
 expect(screen.getByText(/You can leave this page/)).toBeVisible();
 expect(screen.queryByRole('button',{name:'Matches (0)'})).not.toBeInTheDocument();
 expect(screen.queryByRole('heading',{name:'QA Engineer'})).not.toBeInTheDocument();expect(mocks.fetchJobApplicationStatuses).not.toHaveBeenCalled();
});

test('background status polling brings completed results into view without a manual search',async()=>{
 mocks.fetchJobFeed.mockResolvedValueOnce({generationPending:true,generation:{state:'running'},matchingMode:'resume_discovery',version:2,resume:feed.resume,catalog:feed.catalog}).mockResolvedValue(feed);
 renderPage();await screen.findByText('Preparing your matches');
 expect(await screen.findByRole('heading',{name:'QA Engineer'},{timeout:7000})).toBeVisible();
 expect(screen.queryByText('Preparing your matches')).not.toBeInTheDocument();
 expect(mocks.saveJobPreferences).not.toHaveBeenCalled();
},10000);

test('expired completed snapshots stay hidden and refresh rather than carrying stale cards into another read',async()=>{
 mocks.fetchJobFeed.mockResolvedValueOnce({...feed,generation:{state:'ready',expiresAt:new Date(Date.now()-1000).toISOString()}})
  .mockResolvedValue({generationPending:true,generation:{state:'queued'},matchingMode:'resume_discovery',version:2,resume:feed.resume,catalog:feed.catalog});
 renderPage();await screen.findByText('Preparing your matches');
 expect(mocks.fetchJobFeed).toHaveBeenCalledTimes(2);expect(mocks.fetchJobApplicationStatuses).not.toHaveBeenCalled();
 expect(screen.queryByRole('heading',{name:'QA Engineer'})).not.toBeInTheDocument();
});

test('explicit retry uses the current preference version and document fingerprint',async()=>{
 mocks.fetchJobPreferences.mockResolvedValue({preferences,version:2,backgroundGeneration:true,resume:{id,name:'QA resume',fingerprint:'fp'}});
 mocks.fetchJobFeed.mockRejectedValueOnce(Object.assign(Error('Your matches could not be prepared.'),{status:503,payload:{code:'job_feed_refresh_failed'}}));
 renderPage();await screen.findByText('Your matches could not be prepared.');
 mocks.fetchJobFeed.mockResolvedValue({generationPending:true,generation:{state:'queued'},matchingMode:'resume_discovery',version:2,resume:feed.resume,catalog:feed.catalog});
 await userEvent.click(screen.getByRole('button',{name:'Try again'}));
 await waitFor(()=>expect(mocks.retryJobFeed).toHaveBeenCalledWith(2,'fp'));
 expect(await screen.findByText('Preparing your matches')).toBeVisible();
});


test('a busy initial request recovers automatically without asking the user to repeat their search',async()=>{
 mocks.fetchJobFeed.mockRejectedValueOnce(Object.assign(Error('Job matching is busy. Please try again shortly.'),{status:503,payload:{code:'job_feed_busy'}})).mockResolvedValue(feed);
 renderPage();expect(await screen.findByText('Job matching is busy. Please try again shortly.')).toBeVisible();
 expect(await screen.findByRole('heading',{name:'QA Engineer'},{timeout:7000})).toBeVisible();
 expect(mocks.fetchJobFeed).toHaveBeenCalledTimes(2);expect(mocks.saveJobPreferences).not.toHaveBeenCalled();expect(mocks.retryJobFeed).not.toHaveBeenCalled();
},10000);
