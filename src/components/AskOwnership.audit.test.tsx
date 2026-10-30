import {act,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import {beforeEach,expect,test,vi} from 'vitest';
const state=vi.hoisted(()=>({owner:'owner-a',ask:vi.fn()}));
vi.mock('@/lib/AuthContext.jsx',()=>({useAuth:()=>({user:state.owner?{uid:state.owner}:null})}));
vi.mock('@/lib/ask',async()=>({...await vi.importActual('@/lib/ask'),askApplendium:state.ask}));
import {AskApplendium} from './AskApplendium';
import {AskDraft} from './AskDraft';
const answer={success:true,answer:'PRIVATE_ANSWER_FOR_A',applications:[],draft:{subject:'Private subject',body:'PRIVATE_DRAFT_FOR_A'}};
function mount(){const client=new QueryClient({defaultOptions:{mutations:{retry:false}}});const ui=()=> <QueryClientProvider client={client}><MemoryRouter><AskApplendium/></MemoryRouter></QueryClientProvider>;const view=render(ui());return {...view,refresh:()=>view.rerender(ui())};}
beforeEach(()=>{state.owner='owner-a';state.ask.mockReset();});
test('switching accounts immediately hides a prior owner answer and draft',async()=>{
 state.ask.mockResolvedValue(answer);const view=mount();await userEvent.type(screen.getByLabelText('Your question'),'What should I do?{Enter}');await screen.findByText(answer.answer);
 state.owner='owner-b';view.refresh();expect(screen.queryByText(answer.answer)).not.toBeInTheDocument();expect(screen.queryByDisplayValue('PRIVATE_DRAFT_FOR_A')).not.toBeInTheDocument();
});
test('a prior owner response arriving after a switch is discarded',async()=>{
 let resolve!:(value:unknown)=>void;state.ask.mockImplementation(()=>new Promise(r=>{resolve=r;}));const view=mount();await userEvent.type(screen.getByLabelText('Your question'),'Anything new?{Enter}');
 state.owner='owner-b';view.refresh();await act(async()=>{resolve(answer);await new Promise(r=>setTimeout(r,30));});expect(screen.queryByText(answer.answer)).not.toBeInTheDocument();expect(screen.queryByDisplayValue('PRIVATE_DRAFT_FOR_A')).not.toBeInTheDocument();
});
test('clipboard denial is visible and preserves edited content',async()=>{
 render(<AskDraft draft={{subject:'Follow-up',body:'Original'}}/>);await userEvent.clear(screen.getByLabelText('Message'));await userEvent.type(screen.getByLabelText('Message'),'Edited text');
 Object.assign(navigator,{clipboard:{writeText:vi.fn().mockRejectedValue(new Error('denied'))}});await userEvent.click(screen.getByRole('button',{name:'Copy email'}));
 expect(await screen.findByRole('alert')).toHaveTextContent(/copy|clipboard/i);expect(screen.getByLabelText('Message')).toHaveValue('Edited text');
});
test('editing after copying clears the success state and an empty body cannot be copied',async()=>{
 render(<AskDraft draft={{subject:'Follow-up',body:'Original'}}/>);Object.assign(navigator,{clipboard:{writeText:vi.fn().mockResolvedValue(undefined)}});await userEvent.click(screen.getByRole('button',{name:'Copy email'}));await screen.findByRole('button',{name:'Copied'});
 await userEvent.type(screen.getByLabelText('Message'),' edited');await waitFor(()=>expect(screen.queryByRole('button',{name:'Copied'})).not.toBeInTheDocument());
 await userEvent.clear(screen.getByLabelText('Message'));expect(screen.getByRole('button',{name:'Copy email'})).toBeDisabled();
});

test('confirmed outcome answers disclose their actual shared source and link to Resumes',async()=>{
 state.ask.mockResolvedValue({success:true,answer:'The submitted version is unknown.',applications:[],handoff:{kind:'resumes',label:'Review confirmed resume outcomes',source:'confirmed_resume_outcomes'}});
 mount();await userEvent.type(screen.getByLabelText('Your question'),'Which resumes get interviews?{Enter}');
 expect(await screen.findByText(/uses confirmed resume submissions and tracked outcomes/)).toBeVisible();expect(screen.getByRole('link',{name:'Review confirmed resume outcomes'})).toHaveAttribute('href','/resumes');
});
