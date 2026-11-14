import React from 'react';
import {
  ArrowRight, Activity, TrendingUp, Compass, FileSearch, ShieldCheck, DollarSign, Users,
  CheckCircle2, Menu, X, BarChart3, Sparkles, Target, Clock3
} from 'lucide-react';

interface LandingPageProps {
  onStart: () => void;
  onSignIn: () => void;
}

const features = [
  { icon: Activity, title: 'Understand business health', text: 'See strengths, pressure points and sustainability risks across the areas that matter.' },
  { icon: TrendingUp, title: 'Find revenue and profit opportunities', text: 'Explore ways to improve revenue flow, margins, cash discipline and customer value.' },
  { icon: Compass, title: 'Turn insight into action', text: 'Move beyond observations with prioritised recommendations and a practical action roadmap.' },
  { icon: FileSearch, title: 'Make more of your business information', text: 'Bring relevant documents into the conversation for a more informed business review.' },
];

export const LandingPage: React.FC<LandingPageProps> = ({ onStart, onSignIn }) => {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const start = () => { setMenuOpen(false); onStart(); };
  return (
    <div className="min-h-screen bg-[#F4F7FC] text-[#14283F] font-sans">
      <header className="sticky top-0 z-40 border-b border-[#E2E8F0] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 sm:px-8">
          <a href="#top" className="flex items-center gap-3" aria-label="Relaunch BizPulse home">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1D4ED8] text-sm font-black tracking-tight text-white shadow-lg shadow-blue-900/15">BP</span>
            <span className="leading-tight"><span className="block text-[17px] font-extrabold tracking-tight">RELAUNCH <span className="text-[#E87518]">BizPulse</span></span><span className="block text-[10px] font-semibold uppercase tracking-[.19em] text-[#7A8792]">Business clarity. Hidden opportunities. Better decisions.</span></span>
          </a>
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#problem-first" className="text-sm font-semibold text-[#526273] transition hover:text-[#1D4ED8]">Start with a problem</a><a href="#how-it-works" className="text-sm font-semibold text-[#526273] transition hover:text-[#1D4ED8]">How it works</a>
            <a href="#what-you-get" className="text-sm font-semibold text-[#526273] transition hover:text-[#E87518]">What you get</a>
            <a href="#who-its-for" className="text-sm font-semibold text-[#526273] transition hover:text-[#E87518]">Who it's for</a>
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            <button onClick={onSignIn} className="rounded-xl px-4 py-2.5 text-sm font-bold text-[#405265] transition hover:bg-[#F1F5F4]">Sign in</button>
            <button onClick={start} className="inline-flex items-center gap-2 rounded-xl bg-[#1D4ED8] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/15 transition hover:-translate-y-0.5 hover:bg-[#173EA8]">Start your review <ArrowRight size={16}/></button>
          </div>
          <button className="rounded-lg p-2 text-[#14283F] md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">{menuOpen ? <X/> : <Menu/>}</button>
        </div>
        {menuOpen && <div className="border-t border-[#E2E8F0] bg-white px-5 py-4 md:hidden"><div className="flex flex-col gap-4 text-sm font-semibold"><a onClick={() => setMenuOpen(false)} href="#problem-first">Start with a problem</a><a onClick={() => setMenuOpen(false)} href="#how-it-works">How it works</a><a onClick={() => setMenuOpen(false)} href="#what-you-get">What you get</a><a onClick={() => setMenuOpen(false)} href="#who-its-for">Who it's for</a><button onClick={onSignIn} className="text-left text-[#1D4ED8]">Sign in</button><button onClick={start} className="rounded-xl bg-[#1D4ED8] px-4 py-3 text-left text-white">Start your review <ArrowRight className="inline" size={16}/></button></div></div>}
      </header>

      <main id="top">
        <section className="relative isolate overflow-hidden">
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-[#080F20] via-[#102B63] to-[#1D4ED8]"/>
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-16 sm:px-8 sm:pt-24 lg:grid-cols-[1.04fr_.96fr] lg:gap-16 lg:pb-28">
            <div>
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border-2 border-[#F5C99F] bg-white px-4 py-2.5 text-sm font-extrabold tracking-wide text-[#1D4ED8] shadow-sm"><Sparkles size={14}/> THE HIDDEN OPPORTUNITY FINDER</div>
              <h1 className="max-w-2xl text-[42px] font-extrabold leading-[1.08] tracking-[-.045em] text-white sm:text-6xl lg:text-[64px]">What if your business is <span className="text-[#E87518]">earning less than it could?</span></h1>
              <p className="mt-7 max-w-xl text-base leading-8 text-blue-100/85 sm:text-lg">You work hard to keep the business moving. But hidden costs, missed sales, delayed payments and overlooked customers can quietly hold it back. BizPulse helps you investigate where the next improvement — and the next dollar — may come from.</p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button onClick={start} className="group inline-flex items-center justify-center gap-3 rounded-xl bg-[#1D4ED8] px-7 py-4 text-base font-bold text-white shadow-xl shadow-teal-900/20 transition hover:-translate-y-1 hover:bg-[#173EA8]">Find my hidden opportunities <ArrowRight className="transition group-hover:translate-x-1" size={18}/></button>
                <a href="#how-it-works" className="inline-flex items-center justify-center rounded-xl border border-[#D8E1E1] bg-white/80 px-6 py-4 text-sm font-bold text-[#405265] transition hover:border-[#E87518] hover:text-[#1D4ED8]">See how it works</a>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold text-[#657584]"><span className="inline-flex items-center gap-2"><CheckCircle2 size={15} className="text-[#E87518]"/> Guided business review</span><span className="inline-flex items-center gap-2"><CheckCircle2 size={15} className="text-[#E87518]"/> Practical next steps</span><span className="inline-flex items-center gap-2"><CheckCircle2 size={15} className="text-[#E87518]"/> Built for SMEs</span></div>
            </div>

            <div className="relative mx-auto w-full max-w-[570px]">
              <div className="absolute -inset-6 rounded-[40px] bg-[#60A5FA]/20 blur-3xl"/>
              <div className="relative overflow-hidden rounded-[30px] border border-white/20 bg-white p-5 shadow-2xl sm:p-7">
                <div className="rounded-[24px] bg-gradient-to-br from-[#0B1730] via-[#123A79] to-[#2563EB] p-6 text-white sm:p-8">
                  <p className="text-xs font-extrabold uppercase tracking-[.2em] text-orange-200">A clearer view starts here</p>
                  <h2 className="mt-3 max-w-sm text-2xl font-extrabold leading-tight sm:text-3xl">You know your business. Let's uncover what you may be missing.</h2>
                  <div className="mt-7 flex items-end justify-between gap-3">
                    <div className="space-y-3 text-sm font-semibold">
                      <p className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-orange-400"/> More from existing customers</p>
                      <p className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-sky-300"/> Less money tied up in delays</p>
                      <p className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-300"/> Time and cost-saving improvements</p>
                    </div>
                    <svg viewBox="0 0 150 150" className="h-28 w-28 shrink-0 sm:h-36 sm:w-36" role="img" aria-label="Illustration of a small business owner looking at growth opportunities">
                      <circle cx="75" cy="75" r="68" fill="#FFFFFF" fillOpacity=".12"/>
                      <path d="M28 112h94" stroke="#BFDBFE" strokeWidth="4" strokeLinecap="round"/>
                      <path d="M39 110V67l36-24 36 24v43" fill="#F8FAFC" stroke="#BFDBFE" strokeWidth="3" strokeLinejoin="round"/>
                      <path d="M33 68h84L75 37 33 68Z" fill="#F28C28"/>
                      <rect x="50" y="77" width="19" height="33" rx="3" fill="#93C5FD"/>
                      <rect x="80" y="77" width="20" height="17" rx="3" fill="#DBEAFE"/>
                      <circle cx="108" cy="37" r="13" fill="#FDBA74"/>
                      <path d="M108 24v-9m0 44v-9m13-13h9m-44 0h9m22-9 6-6m-31 31-6 6" stroke="#FDBA74" strokeWidth="3" strokeLinecap="round"/>
                    </svg>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  {['Revenue','Cash flow','Customers'].map((x,i)=><div key={x} className="rounded-xl bg-[#F1F5FB] p-3"><p className="text-xs font-bold text-[#14283F]">{x}</p><p className="mt-1 text-[10px] text-[#64748B]">Explore</p></div>)}
                </div>
                <p className="mt-4 text-center text-xs font-semibold text-[#53657A]">A practical business conversation — not another technical dashboard.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-[#E2E8F0] bg-white py-7">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-12 gap-y-4 px-5 text-center sm:px-8">
            <p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#89959E]">A practical review across the business</p>
            {['Health','Revenue','Profit','Cash flow','Sustainability'].map(x=><span key={x} className="text-sm font-bold text-[#405265]">{x}</span>)}
          </div>
        </section>

        <section id="problem-first" className="border-y border-[#DCE6F5] bg-[#EEF4FF] py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#1D4ED8]">THE FREE LEAD MAGNET</p>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-[#14283F] sm:text-4xl">What is your business overlooking?</h2>
              <p className="mt-5 text-base leading-7 text-[#596A79]">Take the free Hidden Opportunity Scan. Explore revenue, profit, cash flow, customers and operations — then see which areas deserve a closer look.</p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[{i:DollarSign,t:'Cash flow',d:'Late payments, cash pressure or working capital.'},{i:TrendingUp,t:'Revenue & profit',d:'Stalled sales, margins or hidden opportunities.'},{i:Users,t:'Customers',d:'Retention, concentration or winning better work.'},{i:Compass,t:'Operations & growth',d:'Capacity, people, processes or next-stage growth.'}].map(({i:Icon,t,d})=><div key={t} className="rounded-2xl border border-[#D9E4F5] bg-white p-5 shadow-sm"><div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF1FF] text-[#1D4ED8]"><Icon size={21}/></div><h3 className="text-base font-extrabold text-[#14283F]">{t}</h3><p className="mt-2 text-sm leading-6 text-[#68798A]">{d}</p></div>)}
            </div>
            <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-[#F3C08F] bg-white px-6 py-5 text-center">
              <p className="text-base font-extrabold text-[#14283F]">Start free. Get useful insight. Decide what comes next.</p>
              <p className="mt-2 text-sm leading-6 text-[#64748B]">Your free scan gives you a business snapshot, priority areas and potential opportunities to investigate. Need more? Choose a clearly scoped Business Clarity Review with its deliverables, boundaries and fixed price confirmed before you commit.</p>
              <button onClick={start} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#1D4ED8] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#173EA8]">Start my free opportunity scan <ArrowRight size={16}/></button>
            </div>
          </div>
        </section>


        <section className="bg-white py-12 sm:py-16">
          <div className="mx-auto grid max-w-7xl gap-8 px-5 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
            <div><p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#E87518]">A smarter first step</p><h2 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight text-[#14283F] sm:text-4xl">Why pay for open-ended consulting just to understand the problem?</h2><p className="mt-4 leading-7 text-[#596A79]">Get a clearer view when you need it — without waiting for an appointment or committing to a lengthy engagement.</p><p className="mt-5 text-xl font-black text-[#1D4ED8]">24/7. No appointments. No waiting.</p></div>
            <div className="grid gap-3 sm:grid-cols-2">{[{t:'Evidence before opinions',d:'Findings are labelled as reported, verified, inferred or unknown.'},{t:'Profit and cash are different',d:'Examine margins, cash timing, working capital and revenue quality.'},{t:'Challenge the diagnosis',d:'Correct the facts, question recommendations and compare scenarios.'},{t:'A defined paid next step',d:'Know the scope, deliverables, exclusions and fixed price before committing.'}].map(x=><div key={x.t} className="rounded-2xl border border-[#E2E8F0] bg-[#F7F9FD] p-5"><h3 className="font-extrabold text-[#14283F]">{x.t}</h3><p className="mt-2 text-sm leading-6 text-[#68798A]">{x.d}</p></div>)}</div>
          </div>
        </section>
        <section id="what-you-get" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
          <div className="mx-auto max-w-2xl text-center"><p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#E87518]">More than a quick answer</p><h2 className="mt-4 text-3xl font-extrabold tracking-tight text-[#14283F] sm:text-4xl">Not another chatbot. A more disciplined way to examine your business.</h2><p className="mt-5 text-base leading-7 text-[#697987]">BizPulse separates what you know from what needs checking, tests possible causes and turns findings into practical decisions.</p></div>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{features.map(({icon:Icon,title,text})=><article key={title} className="group rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_8px_30px_-24px_rgba(20,40,63,.28)] transition hover:-translate-y-1 hover:border-[#F3C08F] hover:shadow-lg"><div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF1E5] text-[#E87518] transition group-hover:bg-[#E87518] group-hover:text-white"><Icon size={22}/></div><h3 className="text-base font-extrabold text-[#14283F]">{title}</h3><p className="mt-3 text-sm leading-6 text-[#71808C]">{text}</p></article>)}</div>
        </section>

        <section id="how-it-works" className="bg-[#14283F] py-20 text-white lg:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-8"><div className="max-w-2xl"><p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#FDBA74]">A guided process</p><h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">From first signal to informed action.</h2><p className="mt-5 leading-7 text-white/65">Your experience stays central. BizPulse organises the evidence, asks follow-up questions, challenges assumptions and helps you decide what to do next.</p></div>
            <div className="mt-12 grid gap-4 md:grid-cols-4">{[{n:'01',t:'Build the business picture',d:'Set the context: business model, customers, services and goals.'},{n:'02',t:'Separate facts from assumptions',d:'Review business health, evidence, risks and missing information.'},{n:'03',t:'Investigate the real issue',d:'Trace causes, compare options and examine revenue or cost opportunities.'},{n:'04',t:'Turn findings into action',d:'Create priorities, owners, measures and a practical action roadmap.'}].map(s=><div key={s.n} className="rounded-2xl border border-white/10 bg-white/[.06] p-6"><p className="text-sm font-black tracking-widest text-[#FDBA74]">{s.n}</p><h3 className="mt-7 text-base font-extrabold">{s.t}</h3><p className="mt-3 text-sm leading-6 text-white/60">{s.d}</p></div>)}</div>
            <div className="mt-10"><button onClick={start} className="inline-flex items-center gap-3 rounded-xl bg-[#FDBA74] px-6 py-4 text-sm font-extrabold text-[#102B38] transition hover:-translate-y-0.5 hover:bg-white">Begin your business review <ArrowRight size={17}/></button></div>
          </div>
        </section>

        <section id="who-its-for" className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:items-center lg:py-24">
          <div><p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#E87518]">Designed with SMEs in mind</p><h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">For owners who want to work on the business, not just in it.</h2><p className="mt-5 leading-7 text-[#697987]">Whether you run a trade or service business, a family enterprise or a growing small company, it can be difficult to step back and see the full picture.</p><p className="mt-4 leading-7 text-[#697987]">BizPulse gives you a structured way to examine the business, ask better questions and identify where attention may be most valuable.</p></div>
          <div className="grid grid-cols-2 gap-4">{[{icon:Clock3,t:'Always busy',d:'Not enough time to step back'},{icon:TrendingUp,t:'Ready to grow',d:'Looking for the next opportunity'},{icon:Activity,t:'Under pressure',d:'Wanting to understand the warning signs'},{icon:Compass,t:'At a crossroads',d:'Considering what to change next'}].map(({icon:Icon,t,d})=><div key={t} className="rounded-2xl border border-[#E2E8F0] bg-white p-5"><Icon className="text-[#E87518]" size={22}/><h3 className="mt-5 text-sm font-extrabold">{t}</h3><p className="mt-2 text-xs leading-5 text-[#7B8994]">{d}</p></div>)}</div>
        </section>

        <section className="px-5 pb-20 sm:px-8 lg:pb-24"><div className="mx-auto max-w-7xl overflow-hidden rounded-[28px] bg-gradient-to-br from-[#1D4ED8] to-[#14283F] px-7 py-12 text-center text-white sm:px-12 sm:py-16"><p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#FDBA74]">Your next step starts with clarity</p><h2 className="mx-auto mt-4 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">Find the opportunity. Make the next move.</h2><p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-white/70">24/7 access. No appointments. No waiting. Start with a free scan, then choose deeper support only when you need it.</p><button onClick={start} className="mt-8 inline-flex items-center gap-3 rounded-xl bg-white px-7 py-4 text-sm font-extrabold text-[#1D4ED8] shadow-xl transition hover:-translate-y-1">Start the free scan <ArrowRight size={17}/></button></div></section>
      </main>
      <footer className="border-t border-[#E2E8F0] bg-white py-8"><div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 text-center sm:flex-row sm:px-8 sm:text-left"><div><p className="text-sm font-extrabold">RELAUNCH <span className="text-[#E87518]">BizPulse</span></p><p className="mt-1 text-xs text-[#84919C]">Business clarity. Forward momentum.</p></div><p className="text-xs text-[#84919C]">© 2026 Relaunch BizPulse. All rights reserved.</p><button onClick={onSignIn} className="text-xs font-bold text-[#E87518] hover:underline">Existing user? Sign in</button></div></footer>
    </div>
  );
};
