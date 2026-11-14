import React from 'react';
import {
  ArrowRight, Activity, TrendingUp, Compass, FileSearch, ShieldCheck,
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
    <div className="min-h-screen bg-[#F7F8F6] text-[#14283F] font-sans">
      <header className="sticky top-0 z-40 border-b border-[#E7ECEB] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 sm:px-8">
          <a href="#top" className="flex items-center gap-3" aria-label="Relaunch BizPulse home">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0D766F] to-[#14283F] text-sm font-black tracking-tight text-white shadow-lg shadow-teal-900/15">BP</span>
            <span className="leading-tight"><span className="block text-[17px] font-extrabold tracking-tight">RELAUNCH <span className="text-[#168C83]">BizPulse</span></span><span className="block text-[10px] font-semibold uppercase tracking-[.19em] text-[#7A8792]">Business clarity. Forward momentum.</span></span>
          </a>
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#how-it-works" className="text-sm font-semibold text-[#526273] transition hover:text-[#168C83]">How it works</a>
            <a href="#what-you-get" className="text-sm font-semibold text-[#526273] transition hover:text-[#168C83]">What you get</a>
            <a href="#who-its-for" className="text-sm font-semibold text-[#526273] transition hover:text-[#168C83]">Who it's for</a>
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            <button onClick={onSignIn} className="rounded-xl px-4 py-2.5 text-sm font-bold text-[#405265] transition hover:bg-[#F1F5F4]">Sign in</button>
            <button onClick={start} className="inline-flex items-center gap-2 rounded-xl bg-[#117D75] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-teal-900/15 transition hover:-translate-y-0.5 hover:bg-[#0D6C65]">Start your review <ArrowRight size={16}/></button>
          </div>
          <button className="rounded-lg p-2 text-[#14283F] md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">{menuOpen ? <X/> : <Menu/>}</button>
        </div>
        {menuOpen && <div className="border-t border-[#E7ECEB] bg-white px-5 py-4 md:hidden"><div className="flex flex-col gap-4 text-sm font-semibold"><a onClick={() => setMenuOpen(false)} href="#how-it-works">How it works</a><a onClick={() => setMenuOpen(false)} href="#what-you-get">What you get</a><a onClick={() => setMenuOpen(false)} href="#who-its-for">Who it's for</a><button onClick={onSignIn} className="text-left text-[#117D75]">Sign in</button><button onClick={start} className="rounded-xl bg-[#117D75] px-4 py-3 text-left text-white">Start your review <ArrowRight className="inline" size={16}/></button></div></div>}
      </header>

      <main id="top">
        <section className="relative isolate overflow-hidden">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_80%_10%,rgba(22,140,131,.13),transparent_42%),radial-gradient(ellipse_at_5%_80%,rgba(217,154,53,.10),transparent_38%)]"/>
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-16 sm:px-8 sm:pt-24 lg:grid-cols-[1.04fr_.96fr] lg:gap-16 lg:pb-28">
            <div>
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#B9DDD8] bg-white/80 px-3.5 py-2 text-xs font-bold tracking-wide text-[#14766F] shadow-sm"><Sparkles size={14}/> A clearer view of your business starts here</div>
              <h1 className="max-w-2xl text-[42px] font-extrabold leading-[1.08] tracking-[-.045em] text-[#14283F] sm:text-6xl lg:text-[64px]">Busy running your business? <span className="text-[#168C83]">Make sure it’s moving forward.</span></h1>
              <p className="mt-7 max-w-xl text-base leading-8 text-[#596A79] sm:text-lg">BizPulse helps small and growing businesses understand what’s working, spot what may be holding them back, and identify practical opportunities to improve performance.</p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button onClick={start} className="group inline-flex items-center justify-center gap-3 rounded-xl bg-[#117D75] px-7 py-4 text-base font-bold text-white shadow-xl shadow-teal-900/20 transition hover:-translate-y-1 hover:bg-[#0D6C65]">Start Your Business Review <ArrowRight className="transition group-hover:translate-x-1" size={18}/></button>
                <a href="#how-it-works" className="inline-flex items-center justify-center rounded-xl border border-[#D8E1E1] bg-white/80 px-6 py-4 text-sm font-bold text-[#405265] transition hover:border-[#168C83] hover:text-[#117D75]">See how it works</a>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold text-[#657584]"><span className="inline-flex items-center gap-2"><CheckCircle2 size={15} className="text-[#168C83]"/> Guided business review</span><span className="inline-flex items-center gap-2"><CheckCircle2 size={15} className="text-[#168C83]"/> Practical next steps</span><span className="inline-flex items-center gap-2"><CheckCircle2 size={15} className="text-[#168C83]"/> Built for SMEs</span></div>
            </div>

            <div className="relative mx-auto w-full max-w-[570px]">
              <div className="absolute -inset-5 rounded-[34px] bg-gradient-to-br from-[#168C83]/15 via-transparent to-[#D99A35]/15 blur-2xl"/>
              <div className="relative overflow-hidden rounded-[28px] border border-white bg-white p-5 shadow-[0_28px_90px_-35px_rgba(20,40,63,.35)] sm:p-7">
                <div className="flex items-start justify-between gap-4 border-b border-[#EDF1F1] pb-5">
                  <div><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#168C83]">BizPulse business snapshot</p><h2 className="mt-2 text-xl font-extrabold tracking-tight">See the whole picture.</h2><p className="mt-1 text-xs text-[#84919C]">Illustrative preview • not a real assessment</p></div>
                  <div className="rounded-xl bg-[#EAF5F3] p-3 text-[#168C83]"><BarChart3 size={23}/></div>
                </div>
                <div className="grid grid-cols-2 gap-3 py-5">
                  <div className="rounded-2xl bg-[#F5F8F7] p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-[#84919C]">Business health</p><p className="mt-2 text-2xl font-extrabold text-[#14283F]">A clearer view</p><p className="mt-1 text-[11px] text-[#6C7C88]">Understand key dimensions</p></div>
                  <div className="rounded-2xl bg-[#F5F8F7] p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-[#84919C]">Growth focus</p><p className="mt-2 text-2xl font-extrabold text-[#168C83]">Find potential</p><p className="mt-1 text-[11px] text-[#6C7C88]">Explore improvement areas</p></div>
                </div>
                <div className="rounded-2xl border border-[#E8EEEE] p-4">
                  <div className="mb-4 flex items-center justify-between"><p className="text-xs font-extrabold text-[#34495A]">A joined-up business review</p><span className="rounded-full bg-[#FFF5E5] px-2.5 py-1 text-[9px] font-bold text-[#A66C19]">Illustrative</span></div>
                  {['Revenue & customers','Cash flow & margins','Operations & capacity','Business sustainability'].map((label,i) => <div key={label} className="mb-3 last:mb-0"><div className="mb-1.5 flex justify-between text-[11px] font-semibold text-[#526273]"><span>{label}</span><span className="text-[#9AA5AE]">Review area</span></div><div className="h-2 overflow-hidden rounded-full bg-[#EEF2F1]"><div className="h-full rounded-full" style={{width: ['82%','66%','74%','58%'][i],background: ['#168C83','#D99A35','#5D8AA6','#7C91A3'][i]}}/></div></div>)}
                </div>
                <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[#14283F] p-4 text-white"><div className="rounded-xl bg-white/10 p-2.5 text-[#8ED4C9]"><Target size={19}/></div><div className="min-w-0 flex-1"><p className="text-xs font-bold">From insight to action</p><p className="mt-1 text-[10px] text-white/65">Priorities • recommendations • practical roadmap</p></div><ArrowRight size={17} className="text-[#8ED4C9]"/></div>
              </div>
              <div className="absolute -bottom-5 -left-5 hidden items-center gap-3 rounded-2xl border border-white bg-white px-4 py-3 shadow-xl sm:flex"><div className="rounded-xl bg-[#EAF5F3] p-2 text-[#168C83]"><ShieldCheck size={19}/></div><div><p className="text-[11px] font-extrabold text-[#14283F]">Your business. Your decisions.</p><p className="text-[10px] text-[#82909B]">Insights to support better choices</p></div></div>
            </div>
          </div>
        </section>

        <section className="border-y border-[#E8EEEE] bg-white py-7">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-12 gap-y-4 px-5 text-center sm:px-8">
            <p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#89959E]">A practical review across the business</p>
            {['Health','Revenue','Profit','Cash flow','Sustainability'].map(x=><span key={x} className="text-sm font-bold text-[#405265]">{x}</span>)}
          </div>
        </section>

        <section id="what-you-get" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
          <div className="mx-auto max-w-2xl text-center"><p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#168C83]">More than a quick answer</p><h2 className="mt-4 text-3xl font-extrabold tracking-tight text-[#14283F] sm:text-4xl">A structured view of your business — and what to do next.</h2><p className="mt-5 text-base leading-7 text-[#697987]">BizPulse brings key business information together to help you look beyond the day-to-day and focus on the decisions that can make a difference.</p></div>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{features.map(({icon:Icon,title,text})=><article key={title} className="group rounded-2xl border border-[#E5ECEA] bg-white p-6 shadow-[0_8px_30px_-24px_rgba(20,40,63,.28)] transition hover:-translate-y-1 hover:border-[#B7DCD6] hover:shadow-lg"><div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EAF5F3] text-[#168C83] transition group-hover:bg-[#168C83] group-hover:text-white"><Icon size={22}/></div><h3 className="text-base font-extrabold text-[#14283F]">{title}</h3><p className="mt-3 text-sm leading-6 text-[#71808C]">{text}</p></article>)}</div>
        </section>

        <section id="how-it-works" className="bg-[#14283F] py-20 text-white lg:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-8"><div className="max-w-2xl"><p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#8ED4C9]">A guided process</p><h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">From business context to a clearer next move.</h2><p className="mt-5 leading-7 text-white/65">You bring the knowledge of your business. BizPulse helps organise the picture, explore the issues and shape practical next steps.</p></div>
            <div className="mt-12 grid gap-4 md:grid-cols-4">{[{n:'01',t:'Tell us about your business',d:'Share your business profile and essential information.'},{n:'02',t:'Review business health',d:'Work through a structured assessment of key areas.'},{n:'03',t:'Explore opportunities',d:'Describe your concerns and examine potential improvements.'},{n:'04',t:'Build your action plan',d:'Review recommendations and decide what to tackle first.'}].map(s=><div key={s.n} className="rounded-2xl border border-white/10 bg-white/[.06] p-6"><p className="text-sm font-black tracking-widest text-[#8ED4C9]">{s.n}</p><h3 className="mt-7 text-base font-extrabold">{s.t}</h3><p className="mt-3 text-sm leading-6 text-white/60">{s.d}</p></div>)}</div>
            <div className="mt-10"><button onClick={start} className="inline-flex items-center gap-3 rounded-xl bg-[#8ED4C9] px-6 py-4 text-sm font-extrabold text-[#102B38] transition hover:-translate-y-0.5 hover:bg-white">Begin your business review <ArrowRight size={17}/></button></div>
          </div>
        </section>

        <section id="who-its-for" className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:items-center lg:py-24">
          <div><p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#168C83]">Designed with SMEs in mind</p><h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">For owners who want to work on the business, not just in it.</h2><p className="mt-5 leading-7 text-[#697987]">Whether you run a trade or service business, a family enterprise or a growing small company, it can be difficult to step back and see the full picture.</p><p className="mt-4 leading-7 text-[#697987]">BizPulse gives you a structured way to examine the business, ask better questions and identify where attention may be most valuable.</p></div>
          <div className="grid grid-cols-2 gap-4">{[{icon:Clock3,t:'Always busy',d:'Not enough time to step back'},{icon:TrendingUp,t:'Ready to grow',d:'Looking for the next opportunity'},{icon:Activity,t:'Under pressure',d:'Wanting to understand the warning signs'},{icon:Compass,t:'At a crossroads',d:'Considering what to change next'}].map(({icon:Icon,t,d})=><div key={t} className="rounded-2xl border border-[#E5ECEA] bg-white p-5"><Icon className="text-[#168C83]" size={22}/><h3 className="mt-5 text-sm font-extrabold">{t}</h3><p className="mt-2 text-xs leading-5 text-[#7B8994]">{d}</p></div>)}</div>
        </section>

        <section className="px-5 pb-20 sm:px-8 lg:pb-24"><div className="mx-auto max-w-7xl overflow-hidden rounded-[28px] bg-gradient-to-br from-[#0E766F] to-[#14283F] px-7 py-12 text-center text-white sm:px-12 sm:py-16"><p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#A8E0D7]">Your next step starts with clarity</p><h2 className="mx-auto mt-4 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">Take a fresh look at your business.</h2><p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-white/70">Start with what you know. Explore what you may be missing. Build a more informed path forward.</p><button onClick={start} className="mt-8 inline-flex items-center gap-3 rounded-xl bg-white px-7 py-4 text-sm font-extrabold text-[#116E68] shadow-xl transition hover:-translate-y-1">Start Your Business Review <ArrowRight size={17}/></button></div></section>
      </main>
      <footer className="border-t border-[#E5ECEA] bg-white py-8"><div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 text-center sm:flex-row sm:px-8 sm:text-left"><div><p className="text-sm font-extrabold">RELAUNCH <span className="text-[#168C83]">BizPulse</span></p><p className="mt-1 text-xs text-[#84919C]">Business clarity. Forward momentum.</p></div><p className="text-xs text-[#84919C]">© 2026 Relaunch BizPulse. All rights reserved.</p><button onClick={onSignIn} className="text-xs font-bold text-[#168C83] hover:underline">Existing user? Sign in</button></div></footer>
    </div>
  );
};
