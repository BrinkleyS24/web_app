import {act,cleanup,render,screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,beforeEach,describe,expect,test,vi} from 'vitest';
import PaymentSuccess from './PaymentSuccess';
import PaymentCancel from './PaymentCancel';
const {apiFetch,auth}=vi.hoisted(()=>({apiFetch:vi.fn(),auth:{value:{user:{uid:'buyer-a'} as {uid:string}|null,loading:false,plan:'free',planLoading:false}}}));
vi.mock('../lib/api.js',()=>({apiFetch}));
vi.mock('../lib/AuthContext.jsx',()=>({useAuth:()=>auth.value}));
vi.mock('../lib/funnel.js',()=>({trackFunnel:vi.fn()}));
vi.mock('../lib/usePageMetadata.js',()=>({default:vi.fn()}));
vi.mock('../components/landing/PublicShell.jsx',()=>({PublicHeader:()=>null,PublicFooter:()=>null}));
const page=()=> <MemoryRouter initialEntries={['/payment/success?session_id=unverified-return']}><PaymentSuccess/></MemoryRouter>;
const free={success:true,subscription:{plan:'free',status:'inactive'}};
const premium={success:true,subscription:{plan:'premium',status:'active'}};
beforeEach(()=>{vi.useFakeTimers();apiFetch.mockReset();auth.value={user:{uid:'buyer-a'},loading:false,plan:'free',planLoading:false};});
afterEach(()=>{cleanup();vi.clearAllTimers();vi.useRealTimers();});
const flush=async()=>{await act(async()=>{await Promise.resolve();});};
describe('payment return evidence and owner lifecycle',()=>{
 test('an inactive account after all polls is not proof a payment was received',async()=>{
  apiFetch.mockResolvedValue(free);render(page());await act(async()=>{await vi.advanceTimersByTimeAsync(12000);});
  expect(apiFetch).toHaveBeenCalledTimes(8);
  expect(screen.queryByText(/payment complete/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/payment was received/i)).not.toBeInTheDocument();
  expect(screen.getByText(/couldn't confirm Premium access yet/i)).toBeVisible();
 });
 test('a failed status read cannot become a payment receipt',async()=>{
  apiFetch.mockRejectedValue(new Error('Status temporarily unavailable'));render(page());await act(async()=>{await vi.advanceTimersByTimeAsync(12000);});
  expect(screen.queryByText(/payment was received|payment complete/i)).not.toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('Status temporarily unavailable');
 });
 test('leaving after active confirmation cancels the delayed dashboard redirect',async()=>{
  apiFetch.mockResolvedValue(premium);const view=render(page());await flush();expect(vi.getTimerCount()).toBe(1);
  view.unmount();expect(vi.getTimerCount()).toBe(0);
 });
 test('leaving cancels the outstanding status request and further polling',async()=>{
  apiFetch.mockImplementationOnce(()=>new Promise(()=>{}));const view=render(page());await flush();const signal=apiFetch.mock.calls[0][1].signal as AbortSignal;expect(signal.aborted).toBe(false);view.unmount();expect(signal.aborted).toBe(true);await act(async()=>{await vi.advanceTimersByTimeAsync(30000);});expect(apiFetch).toHaveBeenCalledTimes(1);
 });
 test('a failed response envelope cannot confirm Premium even with an active-looking payload',async()=>{
  apiFetch.mockResolvedValue({...premium,success:false});render(page());await flush();expect(screen.queryByText(/Premium is active/i)).not.toBeInTheDocument();await act(async()=>{await vi.advanceTimersByTimeAsync(12000);});expect(screen.getByText(/couldn't confirm Premium access yet/i)).toBeVisible();
 });
 test('changing owners cancels the previous active-result redirect',async()=>{
  apiFetch.mockResolvedValueOnce(premium).mockImplementationOnce(()=>new Promise(()=>{}));const view=render(page());await flush();expect(vi.getTimerCount()).toBe(1);
  auth.value={...auth.value,user:{uid:'buyer-b'}};view.rerender(page());await flush();expect(vi.getTimerCount()).toBe(0);
  expect(screen.queryByText(/Premium is active/i)).not.toBeInTheDocument();
 });
 test('a late old-owner response cannot schedule a redirect',async()=>{
  let resolve!:(v:typeof premium)=>void;apiFetch.mockImplementationOnce(()=>new Promise(r=>{resolve=r;})).mockImplementationOnce(()=>new Promise(()=>{}));const view=render(page());await flush();
  auth.value={...auth.value,user:{uid:'buyer-b'}};view.rerender(page());await flush();await act(async()=>resolve(premium));expect(vi.getTimerCount()).toBe(0);
 });
 test('a signed-out return requests sign-in without asserting a completed payment',async()=>{
  auth.value={...auth.value,user:null};render(page());await flush();expect(apiFetch).not.toHaveBeenCalled();expect(screen.getByText(/Sign in again/i)).toBeVisible();expect(screen.queryByText(/payment complete/i)).not.toBeInTheDocument();
 });
 test('the cancel URL alone does not establish that no payment occurred',()=>{
  render(<MemoryRouter><PaymentCancel/></MemoryRouter>);expect(screen.queryByText('No payment was completed.')).not.toBeInTheDocument();expect(screen.getByRole('link',{name:'Open settings'})).toBeVisible();
 });
});
