import {render,screen,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe,test,expect} from 'vitest';
import {QualificationEvidence} from './QualificationEvidence';
import type {ApplyGateQualificationAssessment} from '@/lib/emails';

const assessment:ApplyGateQualificationAssessment={version:1,decision:'excluded',exclusionKind:'insufficient_evidence',reasons:['Rust experience is not established.'],requirements:[
 {label:'Python and Rust required.',quote:'Python and Rust required.',status:'unclear',evidence:'Built Python APIs.',evidenceSources:[{quote:'Built Python APIs.',start:0,end:18}]},
]};
describe('qualification source evidence',()=>{
 test('a partial conjunction identifies supported skills without treating the whole clause as missing',async()=>{
  render(<QualificationEvidence assessment={{...assessment,requirements:[{...assessment.requirements[0],components:[{id:'python',status:'supported',evidenceSourceIndexes:[0]},{id:'rust',status:'unknown',evidenceSourceIndexes:[]}]}]}}/>);
  await userEvent.click(screen.getByText('Review requirement evidence'));
  expect(screen.getByText('Python: Supported by this resume')).toBeVisible();
  expect(screen.getByText('Rust: Not established by this resume')).toBeVisible();
  expect(screen.getByText('The full requirement is not established')).toBeVisible();
 });
 test('unknown alternatives do not turn a supported whole requirement into a gap',async()=>{
  render(<QualificationEvidence assessment={{...assessment,decision:'supported',reasons:[],requirements:[{...assessment.requirements[0],status:'satisfied',quote:'Python or Kotlin required.',components:[{id:'python',status:'supported',evidenceSourceIndexes:[]},{id:'kotlin',status:'unknown',evidenceSourceIndexes:[]}]}]}}/>);
  await userEvent.click(screen.getByText('Review requirement evidence'));
  expect(screen.getByText('Your resume supports the core requirements')).toBeVisible();
  expect(screen.getByText(/whether all parts or alternatives are needed/)).toBeVisible();
  expect(screen.queryByText('The full requirement is not established')).not.toBeInTheDocument();
 });
 test('missing evidence stays distinct from disqualification and quotes partial support',async()=>{
  render(<QualificationEvidence assessment={assessment}/>);
  const region=screen.getByRole('region',{name:'Qualification evidence'});
  expect(within(region).getByText('Core qualification evidence is incomplete')).toBeInTheDocument();
  await userEvent.click(within(region).getByText('Review requirement evidence'));
  expect(within(region).getByText('Posting says')).toBeVisible();
  expect(within(region).getByText('Built Python APIs.')).toBeVisible();
  expect(within(region).getByText(/this does not establish the full requirement/)).toBeVisible();
  expect(within(region).queryByText('Supported by this resume')).not.toBeInTheDocument();
 });
 test('explicit absence is labeled as a conflict and missing quotes are disclosed',async()=>{
  render(<QualificationEvidence assessment={{...assessment,exclusionKind:'requirement_blocker',requirements:[{label:'RN license',quote:null,status:'missing',evidence:null,evidenceState:'explicitly_absent'}]}}/>);
  await userEvent.click(screen.getByText('Review requirement evidence'));
  expect(screen.getByText('Conflicts with the stated requirement')).toBeVisible();
  expect(screen.getByText(/requirement quotation is unavailable/)).toBeVisible();
 });
 test('legacy responses and bounded requirement lists remain readable',async()=>{
  render(<QualificationEvidence assessment={{...assessment,requirementCount:31,requirementsTruncated:true,requirements:[{label:'Python',quote:'Python required.',status:'satisfied',evidence:'Python\nBuilt Python APIs.'}]}}/>);
  await userEvent.click(screen.getByText('Review requirement evidence'));
  expect(screen.getByText('Built Python APIs.')).toBeVisible();
  expect(screen.getByText(/Showing 1 of 31 assessed requirements/)).toBeVisible();
 });
 test('unavailable assessment does not imply a supported or blocked finding',()=>{
  render(<QualificationEvidence assessment={{version:1,decision:'unavailable',reasons:['Try again.'],requirements:[]}}/>);
  expect(screen.getByText('Core qualification evidence could not be checked')).toBeVisible();
  expect(screen.queryByText('Review requirement evidence')).not.toBeInTheDocument();
 });
});
