import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import AuthGate from "./AuthGate";

const uid=()=>Date.now()+Math.floor(Math.random()*100000);
const api=(path)=>path;
const yahoo=(path)=>`/market${path}`;
async function yahooJSON(path){ const r=await fetch(yahoo(path),{headers:{Accept:'application/json'}}); const j=await r.json(); if(!r.ok) throw new Error(j?.finance?.error?.description||j?.message||`Market request failed (${r.status})`); return j; }
async function fetchQuote(symbol){ const j=await yahooJSON(`/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1m&includePrePost=false`); const r=j.chart?.result?.[0]; if(!r) throw new Error('No quote data'); const meta=r.meta||{}; const price=Number(meta.regularMarketPrice ?? meta.postMarketPrice ?? meta.preMarketPrice); if(!Number.isFinite(price)) throw new Error('No current price'); const prev=Number(meta.previousClose||meta.chartPreviousClose||price); const change=price-prev; const changePercent=prev?change/prev*100:0; return {symbol,name:meta.longName||meta.shortName||symbol,exchange:meta.exchangeName||meta.fullExchangeName||'',currency:meta.currency||'USD',price,change,changePercent,fetchedAt:new Date().toISOString()}; }
async function searchStocks(query){ const j=await yahooJSON(`/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=12&newsCount=0`); return (j.quotes||[]).filter(x=>x.quoteType==='EQUITY').map(x=>({symbol:x.symbol,name:x.longname||x.shortname||x.symbol,exchange:x.exchange||x.exchDisp||'',currency:x.currency||'',price:Number.isFinite(Number(x.regularMarketPrice))?Number(x.regularMarketPrice):undefined,changePercent:Number.isFinite(Number(x.regularMarketChangePercent))?Number(x.regularMarketChangePercent):undefined})); }
async function fetchHistory(symbol,range='1mo',interval='1d'){ const j=await yahooJSON(`/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false`); const r=j.chart?.result?.[0]; if(!r) throw new Error('No history data'); const ts=r.timestamp||[]; const close=r.indicators?.quote?.[0]?.close||[]; return ts.map((t,i)=>({time:t*1000,price:Number(close[i])})).filter(x=>Number.isFinite(x.price)); }
const money=(n,_c='INR')=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(Number(n||0));
const today=()=>new Date().toISOString().slice(0,10);
const initial={
  assets:[],liabilities:[],income:[],transactions:[],investments:[],savings:[],goals:[],notes:[],calendar:[],alerts:[],netWorthHistory:[],
  settings:{theme:'system',currency:'INR',transactionLimit:10000,monthlyBudget:50000,notifyAt:80,emergencyMode:'months',emergencyMonths:6,emergencyFixed:0,emergencyCurrent:0,emergencyContribution:0,emergencyFrequency:'Monthly',emergencyAuto:false},
  notifications:{investments:true,emi:true,goals:true,budget:true,stocks:true,transactions:true,income:true,emergency:true,calendar:true,weeklySummary:true},
  notificationState:{readIds:[],dismissedIds:[],snoozed:{}},
  notificationRules:{budgetPercent:80,goalDays:3,emiDays:3,stockPercent:5,stockRisePercent:5,stockFallPercent:5},
  profile:{name:'',email:'',username:'',verified:false}
};
function safeLoad(){try{const x=JSON.parse(localStorage.getItem('wealthtrack-data')||'null');return x?{...initial,...x,settings:{...initial.settings,...x.settings},profile:{...initial.profile,...x.profile},notifications:{...initial.notifications,...x.notifications},notificationState:{...initial.notificationState,...x.notificationState},notificationRules:{...initial.notificationRules,...x.notificationRules}}:initial}catch{return initial}}

async function refreshLiveQuotes(investments,setLiveQuotes,setQuoteBusy,setQuoteUpdated){
 const symbols=[...new Set(investments.filter(i=>i.type==='Stocks'&&i.symbol).map(i=>String(i.symbol).trim().toUpperCase()).filter(Boolean))];
 if(!symbols.length){setLiveQuotes({});setQuoteUpdated('');return;}
 setQuoteBusy(true);
 try{ const pairs=await Promise.all(symbols.map(async symbol=>{try{return [symbol,await fetchQuote(symbol)]}catch{return [symbol,null]}})); const results=Object.fromEntries(pairs.filter(([,q])=>q)); setLiveQuotes(results); setQuoteUpdated(new Date().toLocaleTimeString()); }
 catch(e){ setQuoteUpdated('Internet market data unavailable'); }
 finally{setQuoteBusy(false);} }

function App(){
 const [data,setData]=useState(safeLoad); const [page,setPage]=useState('Dashboard'); const [query,setQuery]=useState(''); const [detail,setDetail]=useState(null); const [chat,setChat]=useState(false); const [toast,setToast]=useState(''); const [notifyOpen,setNotifyOpen]=useState(false); const [liveQuotes,setLiveQuotes]=useState({}); const [quoteBusy,setQuoteBusy]=useState(false); const [quoteUpdated,setQuoteUpdated]=useState('');
 useEffect(()=>localStorage.setItem('wealthtrack-data',JSON.stringify(data)),[data]);
 useEffect(()=>{
  const move=e=>{
   document.documentElement.style.setProperty('--cursor-x',`${e.clientX}px`);
   document.documentElement.style.setProperty('--cursor-y',`${e.clientY}px`);
   document.documentElement.style.setProperty('--cursor-xp',`${(e.clientX/window.innerWidth)*100}%`);
   document.documentElement.style.setProperty('--cursor-yp',`${(e.clientY/window.innerHeight)*100}%`);
   document.documentElement.classList.add('cursor-bg-active');
  };
  const leave=()=>document.documentElement.classList.remove('cursor-bg-active');
  window.addEventListener('pointermove',move,{passive:true});
  window.addEventListener('blur',leave);
  return()=>{window.removeEventListener('pointermove',move);window.removeEventListener('blur',leave)};
 },[]);
 useEffect(()=>{const t=data.settings.theme; const dark=t==='dark'||(t==='system'&&window.matchMedia?.('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=dark?'dark':'light'},[data.settings.theme]);
 useEffect(()=>{const k=localStorage.getItem('wt_theme'); if(k&&!data.settings.theme)setData(d=>({...d,settings:{...d.settings,theme:k}}))},[]);
 useEffect(()=>{ refreshLiveQuotes(data.investments,setLiveQuotes,setQuoteBusy,setQuoteUpdated); const t=setInterval(()=>refreshLiveQuotes(data.investments,setLiveQuotes,setQuoteBusy,setQuoteUpdated),60000); return()=>clearInterval(t); },[data.investments]);
 const totals=useMemo(()=>{
   const asset=data.assets.reduce((s,x)=>s+Number(x.value||0),0); const inv=data.investments.reduce((s,x)=>{const live=x.type==='Stocks'?liveQuotes[String(x.symbol||'').toUpperCase()]:null;const current=live&&Number.isFinite(Number(live.price))?Number(live.price)*Number(x.quantity||0):Number(x.current||x.invested||0);return s+current;},0); const investedTotal=data.investments.reduce((s,x)=>s+Number(x.invested||0),0); const investmentGain=inv-investedTotal; const manualSav=data.savings.reduce((s,x)=>s+Number(x.amount||0),0); const txSavings=data.transactions.reduce((s,x)=>s+(String(x.type)==='Income'?Number(x.amount||0):-Number(x.amount||0)),0); const sav=Math.max(0,manualSav+txSavings); const goal=data.goals.reduce((s,x)=>s+Number(x.fund||0),0); const liab=data.liabilities.reduce((s,x)=>s+Number(x.outstanding||0),0);
   const inc=data.income.filter(x=>x.enabled!==false).reduce((s,x)=>s+Number(x.amount||0),0); const mon=new Date().toISOString().slice(0,7); const exp=data.transactions.filter(x=>x.type==='Expense'&&String(x.date||'').startsWith(mon)).reduce((s,x)=>s+Number(x.amount||0),0);
   const active=data.income.filter(x=>x.kind==='Active'&&x.enabled!==false).reduce((s,x)=>s+Number(x.amount||0),0); const passive=data.income.filter(x=>x.kind==='Passive'&&x.enabled!==false).reduce((s,x)=>s+Number(x.amount||0),0);
   return {asset,inv,investedTotal,investmentGain,sav,goal,liab,totalAssets:asset+inv+sav+goal,net:asset+inv+sav+goal-liab,inc,exp,active,passive,cash:inc-exp,liveQuotes};
 },[data,liveQuotes]);
 useEffect(()=>{const current={date:today(),value:Number(totals.net||0)};const history=Array.isArray(data.netWorthHistory)?data.netWorthHistory:[];const last=history[history.length-1];if(!last||last.date!==current.date||Number(last.value)!==current.value){setData(d=>({...d,netWorthHistory:[...(Array.isArray(d.netWorthHistory)?d.netWorthHistory:[]),current].slice(-180)}));}},[totals.net]);
 const save=(msg='Saved')=>setToast(msg); useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),2200);return()=>clearTimeout(t)},[toast]);
 const add=(key,item)=>{setData(d=>({...d,[key]:[...d[key],{...item,id:uid()}]}));save('Saved successfully')}; const del=(key,id)=>{setData(d=>({...d,[key]:d[key].filter(x=>x.id!==id)}));save('Deleted')}; const patch=(key,id,p)=>setData(d=>({...d,[key]:d[key].map(x=>x.id===id?{...x,...p}:x)}));
 const searchResults=[...data.assets.map(x=>({...x,section:'Assets',label:x.name})),...data.liabilities.map(x=>({...x,section:'Liabilities',label:x.name})),...data.income.map(x=>({...x,section:'Income',label:x.name})),...data.transactions.map(x=>({...x,section:'Transactions',label:x.name})),...data.investments.map(x=>({...x,section:'Investments',label:x.name})),...data.goals.map(x=>({...x,section:'Goals',label:x.name})),...data.savings.map(x=>({...x,section:'Savings',label:x.name})),...data.notes.map(x=>({...x,section:'Notes',label:x.title}))].filter(x=>JSON.stringify(x).toLowerCase().includes(query.toLowerCase())).slice(0,15);
 const generated=useMemo(()=>buildNotifications(data,totals,liveQuotes),[data,totals,liveQuotes]);
 const unread=generated.filter(n=>!data.notificationState.readIds.includes(n.id)&&!data.notificationState.dismissedIds.includes(n.id)).length;
 const markRead=id=>setData(d=>({...d,notificationState:{...d.notificationState,readIds:[...new Set([...d.notificationState.readIds,id])]}}));
 const dismiss=id=>setData(d=>({...d,notificationState:{...d.notificationState,dismissedIds:[...new Set([...d.notificationState.dismissedIds,id])]}}));
 const markAll=()=>setData(d=>({...d,notificationState:{...d.notificationState,readIds:[...new Set([...d.notificationState.readIds,...generated.map(n=>n.id)])]}}));
 return <div className="app">
  <Sidebar page={page} setPage={setPage}/>
  <main className="main"><header className="topbar"><div className="global-search"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search anything..."/><kbd>Ctrl K</kbd></div><button className="run" onClick={()=>setPage('Calendar')}>📅 Calendar</button><button className="notify-bell" onClick={()=>setNotifyOpen(v=>!v)}>🔔<span className={unread?'notif-dot':''}>{unread>99?'99+':unread||''}</span></button><button className="icon-btn" onClick={()=>setChat(v=>!v)}>🤖</button><button className="profile-mini" onClick={()=>setPage('Profile')}>{(data.profile.name||'U')[0].toUpperCase()}</button></header>
   {notifyOpen&&<NotificationPopover notifications={generated} unread={unread} markRead={markRead} dismiss={dismiss} markAll={markAll} openAll={()=>{setNotifyOpen(false);setPage('Notifications')}}/>}{query && <div className="search-results">{searchResults.length?searchResults.map((r,i)=><button key={i} onClick={()=>{setPage(r.section);setQuery('')}}><b>{r.section}</b> — {r.label}</button>):<div>No results</div>}</div>}
   <div className="scroll-area">
    {page==='Dashboard'&&<Dashboard totals={totals} data={data} open={setDetail} setPage={setPage}/>} 
    {page==='Cash Flow'&&<CashFlow data={data} setData={setData} totals={totals}/>} 
    {page==='Assets'&&<Records title="Assets" items={data.assets} fields={[['name','Name'],['category','Category'],['value','Value','number'],['date','Date','date']]} add={x=>add('assets',x)} del={id=>del('assets',id)} chartField="value" currency={data.settings.currency}/>} 
    {page==='Liabilities'&&<Records title="Liabilities" items={data.liabilities} fields={[['name','Name'],['type','Type'],['outstanding','Outstanding','number'],['monthlyPayment','Monthly EMI','number'],['dueDay','Due Day','number']]} add={x=>add('liabilities',x)} del={id=>del('liabilities',id)} chartField="outstanding" currency={data.settings.currency}/>}
    {page==='Advisory'&&<Advisory/>} 
    {page==='Transactions'&&<TransactionPage data={data} add={x=>add('transactions',x)} del={id=>del('transactions',id)} currency={data.settings.currency}/>} 
    {page==='Investments'&&<Investments items={data.investments} add={x=>add('investments',x)} del={id=>del('investments',id)} patch={(id,p)=>{setData(d=>({...d,investments:d.investments.map(x=>x.id===id?{...x,...p}:x)}));save('Investment updated')}} currency={data.settings.currency} liveQuotes={liveQuotes} quoteBusy={quoteBusy} quoteUpdated={quoteUpdated} refreshQuotes={()=>refreshLiveQuotes(data.investments,setLiveQuotes,setQuoteBusy,setQuoteUpdated)} savingsTotal={totals.sav}/>} 
    {page==='Goals'&&<Goals data={data} setData={setData} currency={data.settings.currency} add={x=>add('goals',x)} del={id=>del('goals',id)}/>} 
    {page==='Savings'&&<SavingsPage data={data} setData={setData} currency={data.settings.currency} totals={totals}/>} 
    {page==='Emergency Reserve'&&<Emergency data={data} setData={setData} totals={totals} currency={data.settings.currency}/>} 
    {page==='Notifications'&&<Notifications data={data} setData={setData} generated={generated} markRead={markRead} dismiss={dismiss} markAll={markAll}/>} 
    {page==='Notes'&&<Notes items={data.notes} add={x=>add('notes',x)} del={id=>del('notes',id)}/>} 
    {page==='Calendar'&&<CalendarPage data={data} setData={setData}/>} 
    {page==='Profile'&&<Profile data={data} setData={setData} totals={totals}/>} 
    {page==='Settings'&&<Settings data={data} setData={setData}/>} 
   </div>
  </main>
  {!chat&&<button className="chat-fab" aria-label="Open WealthBot" title="Open WealthBot" onClick={()=>setChat(true)}><span>🤖</span><b>WealthBot</b></button>}
  {chat&&<Chatbot data={data} totals={totals} close={()=>setChat(false)}/>} {detail&&<Detail modal={detail} close={()=>setDetail(null)}/>} {toast&&<div className="toast">{toast}</div>}
 </div>
}

function Advisory(){
 const [q,setQ]=useState('');
 const [scope,setScope]=useState('All Schemes');
 const [category,setCategory]=useState('All Categories');
 const [state,setState]=useState('All States');
 const schemes=[
  {name:'Pradhan Mantri Awas Yojana - Urban',level:'Central',category:'Housing & Shelter',states:'All',desc:'Government housing support for eligible urban households.',url:'https://www.myscheme.gov.in/schemes/pmay-u'},
  {name:'Stand-Up India',level:'Central',category:'Business & Entrepreneurship',states:'All',desc:'Bank finance support for eligible SC/ST and women entrepreneurs for greenfield enterprises.',url:'https://www.myscheme.gov.in/search?keyword=Stand-Up%20India'},
  {name:'Pradhan Mantri Mudra Yojana',level:'Central',category:'Business & Entrepreneurship',states:'All',desc:'Credit support for eligible micro and small business activities.',url:'https://www.myscheme.gov.in/search?keyword=Pradhan%20Mantri%20Mudra%20Yojana'},
  {name:'PM SVANidhi',level:'Central',category:'Business & Entrepreneurship',states:'All',desc:'Working-capital support for eligible street vendors.',url:'https://www.myscheme.gov.in/search?keyword=PM%20SVANidhi'},
  {name:'Education & Scholarship Schemes',level:'Central',category:'Education & Learning',states:'All',desc:'Browse current government education and scholarship schemes.',url:'https://www.myscheme.gov.in/search?keyword=scholarship'},
  {name:'Agriculture & Farmer Schemes',level:'Central',category:'Agriculture, Rural & Environment',states:'All',desc:'Browse current agriculture and farmer support schemes.',url:'https://www.myscheme.gov.in/search?keyword=farmer'},
  {name:'Skills & Employment Schemes',level:'Central',category:'Skills & Employment',states:'All',desc:'Browse current skill-development and employment schemes.',url:'https://www.myscheme.gov.in/search?keyword=skill%20employment'},
  {name:'Health & Wellness Schemes',level:'Central',category:'Health & Wellness',states:'All',desc:'Browse current government health and wellness schemes.',url:'https://www.myscheme.gov.in/search?keyword=health'}
 ];
 const categories=['All Categories',...new Set(schemes.map(x=>x.category))];
 const states=['All States','Punjab','Maharashtra','Haryana','Delhi','Uttar Pradesh','Rajasthan','Gujarat','Karnataka','Tamil Nadu'];
 const filtered=schemes.filter(x=>
   (!q.trim()||`${x.name} ${x.category} ${x.desc}`.toLowerCase().includes(q.toLowerCase()))&&
   (scope==='All Schemes'||(scope==='Central Schemes'&&x.level==='Central')||(scope==='State/UT Schemes'&&x.level==='State'))&&
   (category==='All Categories'||x.category===category)&&
   (state==='All States'||x.states==='All'||x.states.includes(state))
 );
 const reset=()=>{setQ('');setScope('All Schemes');setCategory('All Categories');setState('All States')};
 return <section className="advisory-page">
   <PageHead title="Advisory" sub="Find government schemes and filter them by your needs."/>
   <div className="card advisory-card">
    <div className="advisory-title-row"><div><h2>Government Schemes</h2><p>Scheme results are linked to the official myScheme portal.</p></div><span className="live-badge">ONLINE</span></div>
    <div className="advisory-filters compact">
      <label>Search<input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search scheme..."/></label>
      <label>Type<select value={scope} onChange={e=>setScope(e.target.value)}><option>All Schemes</option><option>Central Schemes</option><option>State/UT Schemes</option></select></label>
      <label>Category<select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(x=><option key={x}>{x}</option>)}</select></label>
      <label>State / UT<select value={state} onChange={e=>setState(e.target.value)}>{states.map(x=><option key={x}>{x}</option>)}</select></label>
    </div>
    <div className="advisory-actions"><button className="primary" onClick={()=>window.open('https://www.myscheme.gov.in/search','_blank','noopener,noreferrer')}>Open Live myScheme</button><button className="secondary" onClick={reset}>Reset</button></div>
   </div>
   <div className="advisory-results-head"><h3>Results ({filtered.length})</h3><span>Click a scheme for its official live details.</span></div>
   <div className="advisory-results-grid">
    {filtered.length?filtered.map(x=><article className="card advisory-scheme-card" key={x.name}>
      <div className="scheme-meta"><span>{x.level}</span><span>{x.category}</span></div>
      <h3>{x.name}</h3><p>{x.desc}</p>
      <button className="primary small" onClick={()=>window.open(x.url,'_blank','noopener,noreferrer')}>View Official Details →</button>
    </article>):<div className="card advisory-empty"><h3>No matching schemes</h3><p>Try another keyword or reset the filters.</p></div>}
   </div>
   <div className="advisory-source"><b>Official source:</b> myScheme.gov.in. Scheme information, eligibility, benefits and application details can change; verify them on the official page before applying.</div>
 </section>
}
function Sidebar({page,setPage}){const sections=['Dashboard','Assets','Liabilities','Advisory','Cash Flow','Transactions','Investments','Goals','Savings','Emergency Reserve','Calendar'];return <aside className="sidebar"><div className="brand">▥ <span>Wealth<span>Track</span></span></div><nav>{sections.map(x=><button className={page===x?'active':''} key={x} onClick={()=>setPage(x)}>{({Dashboard:'⌂',Assets:'▦',Liabilities:'▱',Advisory:'✦','Cash Flow':'⇅',Transactions:'▤',Investments:'▧',Goals:'◎',Savings:'◉','Emergency Reserve':'🛡',Calendar:'📅'})[x]}<span>{x}</span></button>)}</nav><div className="nav-label">MORE</div><nav>{['Notifications','Notes','Profile','Settings'].map(x=><button className={page===x?'active':''} key={x} onClick={()=>setPage(x)}>◈<span>{x}</span></button>)}<button className="logout-nav" onClick={()=>{sessionStorage.removeItem('wealthtrack-session');window.location.reload()}}>↪<span>Logout</span></button></nav><div className="side-foot">Your finance data stays in this browser in the MVP.</div></aside>}
function PageHead({title,sub,children}){return <div className="page-head"><div><h1>{title}</h1><p>{sub}</p></div>{children}</div>}
function NetWorthChart({data,totals,currency,history=[]}){
 const points=buildNetWorthSeries(history,totals);
 const vals=points.map(p=>p.value), min=Math.min(...vals,0), max=Math.max(...vals,0), range=Math.max(1,max-min);
 const coords=points.map((p,i)=>{const x=4+i*(92/Math.max(1,points.length-1));const y=88-((p.value-min)/range)*68;return {x,y,p};});
 const poly=coords.map(c=>`${c.x},${c.y}`).join(' ');
 return <div className="trend-chart"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Net worth trend"><line x1="4" y1="88" x2="96" y2="88" stroke="var(--border)" strokeWidth="0.7"/><line x1="4" y1="54" x2="96" y2="54" stroke="var(--border)" strokeWidth="0.5"/><line x1="4" y1="20" x2="96" y2="20" stroke="var(--border)" strokeWidth="0.5"/><polyline points={poly} fill="none" stroke="var(--accent)" strokeWidth="2.4" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round"/>{coords.map((c,i)=><circle key={i} cx={c.x} cy={c.y} r="1.6" fill="var(--accent)" vectorEffect="non-scaling-stroke"/> )}</svg><div className="trend-labels">{points.map((p,i)=><span key={i}>{p.label}</span>)}</div><div className="chart-foot"><span>Current net worth</span><b>{money(totals.net,currency)}</b></div></div>
}
function buildNetWorthSeries(history,totals){
 const source=Array.isArray(history)&&history.length?history:([{date:today(),value:Number(totals.net||0)}]);
 const chosen=source.slice(-6);
 return chosen.map((p)=>{const d=new Date(`${p.date}T00:00:00`);return {label:Number.isNaN(d.getTime())?String(p.date||'') : d.toLocaleDateString('en',{month:'short',day:'numeric'}),value:Number(p.value||0)}});
}
function InvestmentTabChart({items,liveQuotes,currency}){
 const groups={}; items.forEach(i=>{const live=i.type==='Stocks'?liveQuotes[String(i.symbol||'').toUpperCase()]:null;const value=live&&Number.isFinite(Number(live.price))?Number(live.price)*Number(i.quantity||0):Number(i.type==='Stocks'?Number(i.currentPrice||i.current||0)*Number(i.quantity||0):Number(i.current||0));groups[i.type]=(groups[i.type]||0)+value});
 const entries=Object.entries(groups).filter(([,v])=>Number(v)>0); if(!entries.length)return <div className="empty chart-empty">Add investments with values to see this chart.</div>;
 const max=Math.max(...entries.map(([,v])=>v),1); return <div className="investment-tab-chart">{entries.map(([k,v])=><div key={k} className="investment-tab-row"><div className="investment-tab-label"><span>{k}</span><b>{money(v,currency)}</b></div><div className="investment-tab-track"><i style={{width:`${Math.max(3,v/max*100)}%`}}/></div></div>)}</div>
}
function Dashboard({totals,data,open,setPage}){const bars=[['Assets',totals.asset],['Investments',totals.inv],['Savings',totals.sav],['Goal Funds',totals.goal],['Liabilities',totals.liab]];const max=Math.max(...bars.map(x=>x[1]),1);return <>
 <PageHead title="Dashboard" sub="Your complete financial command center"/><div className="metrics">{[['Net Worth',totals.net,'green'],['Total Assets',totals.totalAssets,'blue'],['Liabilities',totals.liab,'red'],['Monthly Income',totals.inc,'purple'],['Monthly Expenses',totals.exp,'orange']].map(([t,v,c])=><button className="metric" key={t} onClick={()=>open({title:t,value:money(v)})}><span className={'metric-icon '+c}>◉</span><div><small>{t}</small><b>{money(v)}</b><em>Live from your data</em></div></button>)}</div>
 <Analytics data={data} totals={totals}/>
 <div className="dash-grid"><section className="card wide"><div className="card-head"><h2>Financial Comparison</h2><span>Click cards for details</span></div>{bars.map(([n,v])=><div className="bar-row" key={n}><span>{n}</span><div className="track"><i style={{width:`${Math.max(0,v)/max*100}%`}}/></div><b>{money(v)}</b></div>)}</section><section className="card"><div className="card-head"><h2>Income Split</h2></div><div className="income-split"><div><b>{money(totals.active)}</b><small>Active</small></div><div><b>{money(totals.passive)}</b><small>Passive</small></div></div><button className="link" onClick={()=>setPage('Cash Flow')}>Manage income →</button></section></div>
 <div className="quick-grid">{[['Transactions',data.transactions.length,'Transactions'],['Investments',data.investments.length,'Investments'],['Goals',data.goals.length,'Goals'],['Alerts',data.alerts.length,'Notifications'],['Notes',data.notes.length,'Notes'],['Calendar',data.calendar.length,'Calendar']].map(([t,n,p])=><button className="quick-card" key={t} onClick={()=>setPage(p)}><h3>{t}</h3><b>{n}</b><small>Open section →</small></button>)}</div>
</>}
function Analytics({data,totals}){
 const six=lastMonths(data.transactions);
 const currentValue=(i)=>{const live=i.type==='Stocks'?totals.liveQuotes?.[String(i.symbol||'').toUpperCase()]:null;return live&&Number.isFinite(Number(live.price))?Number(live.price)*Number(i.quantity||0):Number(i.current||i.invested||0)};
 const totalHoldings=data.investments.reduce((s,x)=>s+currentValue(x),0);
 const groups={}; data.investments.forEach(i=>{groups[i.type]=(groups[i.type]||0)+currentValue(i)});
 return <div className="analytics-grid">
  <section className="card chart-card"><div className="card-head"><h2>Cash Flow Trend</h2><span>Last 6 months</span></div><LineChart months={six}/><div className="chart-legend"><span>Monthly net cash flow</span><b>{money(totals.cash)}</b></div></section>
  <section className="card chart-card"><div className="card-head"><h2>Portfolio Mix</h2><span>{money(totalHoldings)}</span></div>{Object.keys(groups).length?<Donut labels={groups}/>:<div className="empty chart-empty">Add investments to see portfolio allocation.</div>}</section>
  <section className="card chart-card"><div className="card-head"><h2>Income vs Expenses</h2><span>Monthly trend</span></div><CompareBars months={six}/><div className="chart-key"><span>Income</span><span>Expenses</span></div></section>
  <section className="card chart-card"><div className="card-head"><h2>Investment Profit / Loss</h2><span>Current portfolio</span></div><div className="investment-summary"><div><small>Invested</small><b>{money(totals.investedTotal,data.settings?.currency||'INR')}</b></div><div><small>Live value</small><b>{money(totals.inv,data.settings?.currency||'INR')}</b></div><div><small>Gain / Loss</small><b className={totals.investmentGain>=0?'good':'bad'}>{totals.investmentGain>=0?'+':''}{money(totals.investmentGain,data.settings?.currency||'INR')}</b></div></div><InvestmentPLChart investments={data.investments} liveQuotes={totals.liveQuotes||{}} currency={data.settings?.currency||'INR'}/></section><section className="card chart-card"><div className="card-head"><h2>Financial Values</h2><span>All tracked totals</span></div><div className="value-list">{[['Net Worth',totals.net],['Assets',totals.totalAssets],['Investments',totals.inv],['Savings',totals.sav],['Goal Funds',totals.goal],['Liabilities',totals.liab],['Income',totals.inc],['Expenses',totals.exp]].map(([k,v])=><div key={k}><span>{k}</span><b>{money(v)}</b></div>)}</div></section>
 </div>
}
function lastMonths(transactions){const out=[];const now=new Date();for(let i=5;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;const income=transactions.filter(t=>t.type==='Income'&&String(t.date||'').startsWith(key)).reduce((s,x)=>s+Number(x.amount||0),0);const expenses=transactions.filter(t=>t.type==='Expense'&&String(t.date||'').startsWith(key)).reduce((s,x)=>s+Number(x.amount||0),0);out.push({label:d.toLocaleDateString('en',{month:'short'}),income,expenses,net:income-expenses})}return out}
function LineChart({months}){
 const vals=months.map(m=>Number(m.net||0)); const safe=vals.length?vals:[0];
 const min=Math.min(...safe,0), max=Math.max(...safe,0), range=Math.max(1,max-min);
 const points=safe.map((v,i)=>{const x=safe.length===1?50:i*100/(safe.length-1); const y=88-((v-min)/range)*68; return [x,y]});
 const poly=points.map(p=>p.join(',')).join(' ');
 return <div className="line-chart"><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Six month cash flow trend"><line x1="0" y1="88" x2="100" y2="88" stroke="var(--border)" strokeWidth="0.8"/><line x1="0" y1="54" x2="100" y2="54" stroke="var(--border)" strokeWidth="0.6"/><line x1="0" y1="20" x2="100" y2="20" stroke="var(--border)" strokeWidth="0.6"/><polyline points={poly} fill="none" stroke="var(--accent)" strokeWidth="2.4" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round"/>{points.map(([x,y],i)=><circle key={i} cx={x} cy={y} r="1.9" fill="var(--accent)" vectorEffect="non-scaling-stroke"/>)}</svg><div className="line-labels">{months.map((m,i)=><span key={i}>{m.label}</span>)}</div></div>
}
function CompareBars({months}){const max=Math.max(...months.flatMap(m=>[Number(m.income||0),Number(m.expenses||0)]),1);return <div className="compare-chart">{months.map((m,i)=><div className="compare-col" key={i}><div className="bar-pair" title={`${m.label}: ${money(m.income)} income / ${money(m.expenses)} expenses`}><i className="income-bar" style={{height:Math.max(2,Number(m.income||0)/max*100)+'%'}}/><i className="expense-bar" style={{height:Math.max(2,Number(m.expenses||0)/max*100)+'%'}}/></div><small>{m.label}</small></div>)}</div>}
function Donut({labels}){
 const entries=Object.entries(labels).filter(([,v])=>Number(v)>0); const total=entries.reduce((a,[,v])=>a+Number(v||0),0);
 if(!entries.length) return <div className="empty chart-empty">Add investments with values to see the portfolio pie chart.</div>;
 const stops=[]; let cursor=0; const palette=['var(--chart0)','var(--chart1)','var(--chart2)','var(--chart3)','var(--chart4)','var(--chart5)'];
 entries.forEach(([k,v],i)=>{const next=cursor+(Number(v)/total)*100; stops.push(`${palette[i%palette.length]} ${cursor}% ${next}%`); cursor=next;});
 return <div className="donut-wrap"><div className="donut-svg-wrap"><div className="donut-pie" style={{background:`conic-gradient(${stops.join(',')})`}} aria-label="Portfolio allocation pie chart"/><div className="donut-hole"><b>{money(total)}</b><small>Portfolio</small></div></div><div className="donut-legend">{entries.map(([k,v],i)=><div key={k}><span className={'dot chart'+(i%6)}/><span>{k}</span><b>{((Number(v)/total)*100).toFixed(1)}%</b></div>)}</div></div>
}
function InvestmentPLChart({investments,liveQuotes,currency}){
 const rows=investments.map(i=>{const live=i.type==='Stocks'?liveQuotes[String(i.symbol||'').toUpperCase()]:null;const invested=Number(i.invested||0);const current=live&&Number.isFinite(Number(live.price))?Number(live.price)*Number(i.quantity||0):Number(i.type==='Stocks'?Number(i.currentPrice||i.current||0)*Number(i.quantity||0):Number(i.current||0));return {name:i.name||i.symbol||'Investment',symbol:i.symbol||'',invested,current,pl:current-invested,live:Boolean(live)}}).filter(x=>Number.isFinite(x.pl));
 if(!rows.length)return <div className="empty chart-empty">Add investments to see investment performance.</div>;
 const max=Math.max(...rows.map(r=>Math.max(Math.abs(r.invested),Math.abs(r.current),Math.abs(r.pl))),1);
 return <div className="investment-chart">{rows.slice(0,10).map(r=><div className="investment-chart-row" key={r.name+r.symbol}><div className="investment-chart-head"><span><b>{r.name}</b>{r.symbol&&<small>{r.symbol}</small>}</span><span className="investment-live-tag">{r.live?'● Live':'Manual'}</span></div><div className="investment-bars"><div><span>Invested</span><i className="invested-bar" style={{width:Math.max(2,r.invested/max*100)+'%'}}/><b>{money(r.invested,currency)}</b></div><div><span>Current</span><i className={r.pl>=0?'current-bar':'loss-current-bar'} style={{width:Math.max(2,r.current/max*100)+'%'}}/><b>{money(r.current,currency)}</b></div></div><div className="investment-pl-line"><span>Profit / Loss</span><strong className={r.pl>=0?'good':'bad'}>{r.pl>=0?'+':''}{money(r.pl,currency)}</strong></div></div>)}</div>
}
function Records({title,items,fields,add,del,chartField,currency}){const [show,setShow]=useState(false);const initial=Object.fromEntries(fields.map(([k])=>[k,'']));const [f,setF]=useState(initial);const submit=e=>{e.preventDefault();add(f);setF(initial);setShow(false)};const max=Math.max(...items.map(x=>Number(x[chartField]||0)),1);return <section><PageHead title={title} sub={`Add, view and delete your ${title.toLowerCase()}.`}><button className="primary" onClick={()=>setShow(!show)}>{show?'Cancel':'+ Add'}</button></PageHead>{show&&<form className="card form" onSubmit={submit}>{fields.map(([k,l,type])=><label key={k}>{l}{type==='date'?<input type="date" value={f[k]} onChange={e=>setF({...f,[k]:e.target.value})}/>:<input type={type==='number'?'number':'text'} value={f[k]} onChange={e=>setF({...f,[k]:e.target.value})}/>}</label>)}<button className="primary">Save</button></form>}<div className="card table-card">{items.length===0?<Empty/>:<><div className="mini-chart">{items.map(x=><div className="mini-bar" key={x.id}><div style={{height:`${Number(x[chartField]||0)/max*100}%`}}/><small>{String(x.name||'Item').slice(0,10)}</small></div>)}</div><Table headers={fields.map(x=>x[1])} rows={items.map(x=>fields.map(([k,,t])=>t==='number'?money(x[k],currency):x[k]))} actions={items.map(x=><button className="danger" onClick={()=>del(x.id)}>Delete</button>)}/></>}</div></section>}
function IncomePage({items,add,del,currency}){return <Records title="Income" items={items} fields={[['name','Source'],['kind','Active / Passive'],['amount','Amount','number'],['frequency','Frequency'],['day','Day','number'],['enabled','Enabled']]} add={add} del={del} chartField="amount" currency={currency}/>}
function TransactionPage({data,add,del,currency}){const [show,setShow]=useState(false);const [f,setF]=useState({name:'',type:'Expense',category:'',amount:'',date:today(),note:''});const submit=e=>{e.preventDefault();add(f);setF({name:'',type:'Expense',category:'',amount:'',date:today(),note:''});setShow(false)};const limit=Number(data.settings.transactionLimit||0);const normal=data.transactions.filter(x=>Number(x.amount)<=limit);const high=data.transactions.filter(x=>Number(x.amount)>limit);return <section><PageHead title="Transactions" sub="Simple entries are split automatically by your transaction limit."><button className="primary" onClick={()=>setShow(!show)}>{show?'Cancel':'+ Add Transaction'}</button></PageHead>{show&&<form className="card form" onSubmit={submit}><label>Description<input value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></label><label>Type<select value={f.type} onChange={e=>setF({...f,type:e.target.value})}><option>Income</option><option>Expense</option></select></label><label>Category<input value={f.category} onChange={e=>setF({...f,category:e.target.value})}/></label><label>Amount<input type="number" value={f.amount} onChange={e=>setF({...f,amount:e.target.value})}/></label><label>Date<input type="date" value={f.date} onChange={e=>setF({...f,date:e.target.value})}/></label><label>Optional note<input value={f.note} onChange={e=>setF({...f,note:e.target.value})}/></label><button className="primary">Save</button></form>}<div className="summary-pills"><span>Limit: {money(limit,currency)}</span><span>Normal: {normal.length}</span><span className="warn">Over limit: {high.length}</span></div><div className="two"><section className="card"><h2>Normal Transactions</h2><Table headers={['Description','Type','Amount','Date']} rows={normal.map(x=>[x.name,x.type,money(x.amount,currency),x.date])} actions={normal.map(x=><button className="danger" onClick={()=>del(x.id)}>Delete</button>)}/></section><section className="card"><h2>High-Value / Over-Limit</h2><Table headers={['Description','Type','Amount','Date']} rows={high.map(x=>[x.name,x.type,money(x.amount,currency),x.date])} actions={high.map(x=><button className="danger" onClick={()=>del(x.id)}>Delete</button>)}/></section></div></section>}
function Goals({data,setData,currency,add,del}){const [show,setShow]=useState(false);const [f,setF]=useState({name:'',target:'',fund:'',regular:'',frequency:'Monthly',mode:'Manual',nextDate:today()});useEffect(()=>{const due=new Date();const td=today();let changed=false;const goals=data.goals.map(g=>{if(g.mode==='Automatic'&&!g.paused&&g.regular&&g.nextDate&&g.nextDate<=td){changed=true;const d=new Date(g.nextDate);if(g.frequency==='Weekly')d.setDate(d.getDate()+7);else if(g.frequency==='Yearly')d.setFullYear(d.getFullYear()+1);else d.setMonth(d.getMonth()+1);return {...g,fund:Number(g.fund||0)+Number(g.regular),nextDate:d.toISOString().slice(0,10)}}return g});if(changed)setData({...data,goals})},[]);const submit=e=>{e.preventDefault();add({...f,target:Number(f.target),fund:Number(f.fund||0),regular:Number(f.regular||0)});setF({name:'',target:'',fund:'',regular:'',frequency:'Monthly',mode:'Manual',nextDate:today()});setShow(false)};const remove=id=>{const g=data.goals.find(x=>x.id===id);if(!g)return;if(confirm(`Return ${money(g.fund,currency)} to savings and remove this goal?`)){setData({...data,savings:[...data.savings,{id:uid(),name:`Returned from goal: ${g.name}`,amount:Number(g.fund||0),target:0,source:'Goal removal',date:today()}],goals:data.goals.filter(x=>x.id!==id)})}};return <section><PageHead title="Goals" sub="Keep goal funds separate, with fully controllable manual or automatic contributions."><button className="primary" onClick={()=>setShow(!show)}>{show?'Cancel':'+ Add Goal'}</button></PageHead>{show&&<form className="card form" onSubmit={submit}><label>Goal Name<input value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></label><label>Target<input type="number" value={f.target} onChange={e=>setF({...f,target:e.target.value})}/></label><label>Starting Fund<input type="number" value={f.fund} onChange={e=>setF({...f,fund:e.target.value})}/></label><label>Regular Amount<input type="number" value={f.regular} onChange={e=>setF({...f,regular:e.target.value})}/></label><label>Frequency<select value={f.frequency} onChange={e=>setF({...f,frequency:e.target.value})}><option>Weekly</option><option>Monthly</option><option>Yearly</option></select></label><label>Mode<select value={f.mode} onChange={e=>setF({...f,mode:e.target.value})}><option>Manual</option><option>Automatic</option></select></label><label>Next Date<input type="date" value={f.nextDate} onChange={e=>setF({...f,nextDate:e.target.value})}/></label><button className="primary">Create</button></form>}<div className="goals-grid">{data.goals.length?data.goals.map(g=>{const p=Math.min(100,Number(g.fund)/Math.max(1,Number(g.target))*100);return <article className="card goal-card" key={g.id}><div className="card-head"><h2>{g.name}</h2><button className="danger" onClick={()=>remove(g.id)}>Remove</button></div><p>{money(g.fund,currency)} of {money(g.target,currency)}</p><div className="progress"><i style={{width:p+'%'}}/></div><div className="row"><span>{p.toFixed(1)}%</span><span>{g.mode} · {g.frequency}</span></div><div className="goal-actions"><button onClick={()=>setData({...data,goals:data.goals.map(x=>x.id===g.id?{...x,fund:Number(x.fund)+Number(x.regular||0)}:x)})}>Add Fixed</button><button onClick={()=>{const n=prompt('Custom amount');if(Number(n)>0)setData({...data,goals:data.goals.map(x=>x.id===g.id?{...x,fund:Number(x.fund)+Number(n)}:x)})}}>Custom</button><button onClick={()=>setData({...data,goals:data.goals.map(x=>x.id===g.id?{...x,mode:x.mode==='Manual'?'Automatic':'Manual'}:x)})}>Switch Mode</button>{g.mode==='Automatic'&&<button onClick={()=>setData({...data,goals:data.goals.map(x=>x.id===g.id?{...x,paused:!x.paused}:x)})}>{g.paused?'Resume':'Pause'}</button>}</div></article>}) : <Empty/>}</div></section>}
function SavingsPage({data,setData,currency,totals}){
 const [show,setShow]=useState(false);
 const [f,setF]=useState({name:'',amount:'',target:''});
 const txImpact=data.transactions.reduce((s,x)=>s+(String(x.type)==='Income'?Number(x.amount||0):-Number(x.amount||0)),0);
 const manual=data.savings.reduce((s,x)=>s+Number(x.amount||0),0);
 const linkedSavings=Math.max(0,manual+txImpact);
 const contributionSeries=lastMonths(data.transactions).map(m=>({label:m.label,net:m.income-m.expenses,income:m.income,expenses:m.expenses}));
 const submit=e=>{e.preventDefault();if(!f.name||Number(f.amount)<0)return;setData({...data,savings:[...data.savings,{...f,amount:Number(f.amount),target:Number(f.target||0),id:uid(),date:today(),source:'Manual savings'}]});setF({name:'',amount:'',target:''});setShow(false)};
 const remove=id=>{const item=data.savings.find(x=>x.id===id);if(!item)return;setData({...data,savings:data.savings.filter(x=>x.id!==id)});};
 const syncNote=Math.max(0,txImpact);
 return <section>
  <PageHead title="Savings" sub="Your savings balance combines manual savings with transaction activity." ><button className="primary" onClick={()=>setShow(v=>!v)}>{show?'Cancel':'+ Add Savings'}</button></PageHead>
  <div className="metrics">
   <div className="metric"><div><small>Manual Savings</small><b>{money(manual,currency)}</b></div></div>
   <div className="metric"><div><small>Transaction Net</small><b className={txImpact>=0?'good':'bad'}>{txImpact>=0?'+':''}{money(txImpact,currency)}</b></div></div>
   <div className="metric"><div><small>Linked Savings</small><b>{money(linkedSavings,currency)}</b></div></div>
   <div className="metric"><div><small>Current Savings in Dashboard</small><b>{money(totals.sav,currency)}</b></div></div>
  </div>
  <section className="card chart-card"><div className="card-head"><div><h2>Savings & Transactions Graph</h2><span>Monthly income, expenses and net savings impact</span></div><b>{money(syncNote,currency)} net positive transaction flow</b></div><CompareBars months={contributionSeries}/><div className="chart-key"><span>Income</span><span>Expenses</span></div></section>
  {show&&<form className="card form" onSubmit={submit}><label>Name<input value={f.name} onChange={e=>setF({...f,name:e.target.value})} placeholder="Emergency savings"/></label><label>Amount<input type="number" min="0" step="0.01" value={f.amount} onChange={e=>setF({...f,amount:e.target.value})}/></label><label>Target<input type="number" min="0" step="0.01" value={f.target} onChange={e=>setF({...f,target:e.target.value})}/></label><button className="primary">Save Savings</button></form>}
  <div className="card table-card"><div className="card-head"><h2>Manual Savings</h2><span>Transactions are linked automatically</span></div>{data.savings.length?<Table headers={['Name','Amount','Target','Source']} rows={data.savings.map(x=>[x.name,money(x.amount,currency),money(x.target,currency),x.source||'Manual savings'])} actions={data.savings.map(x=><button className="danger" onClick={()=>remove(x.id)}>Delete</button>)}/>:<Empty/>}</div>
  <section className="card linked-summary"><div className="card-head"><div><h2>How savings is managed</h2><span>Income transactions increase savings; expense transactions reduce it.</span></div></div><div className="linked-summary-grid"><div><small>Manual savings</small><b>{money(manual,currency)}</b></div><div><small>Transaction impact</small><b>{money(txImpact,currency)}</b></div><div><small>Linked total</small><b>{money(linkedSavings,currency)}</b></div></div></section>
 </section>
}
function Emergency({data,setData,totals,currency}){const s=data.settings;const monthly=Number(totals.exp||0);const target=s.emergencyMode==='fixed'?Number(s.emergencyFixed||0):monthly*Number(s.emergencyMonths||0);const current=Number(s.emergencyCurrent||0);const progress=target?Math.min(100,current/target*100):0;const patch=x=>setData({...data,settings:{...s,...x}});return <section><PageHead title="Emergency Reserve" sub="Fully editable emergency fund: target, contribution, schedule, automation and alerts."/><div className="card form"><label>Target Method<select value={s.emergencyMode} onChange={e=>patch({emergencyMode:e.target.value})}><option value="months">Months of Expenses</option><option value="fixed">Fixed Amount</option></select></label>{s.emergencyMode==='months'?<label>Months<input type="number" min="1" value={s.emergencyMonths} onChange={e=>patch({emergencyMonths:e.target.value})}/></label>:<label>Fixed Target<input type="number" min="0" value={s.emergencyFixed} onChange={e=>patch({emergencyFixed:e.target.value})}/></label>}<label>Current Reserve<input type="number" min="0" value={s.emergencyCurrent} onChange={e=>patch({emergencyCurrent:e.target.value})}/></label><label>Regular Contribution<input type="number" min="0" value={s.emergencyContribution} onChange={e=>patch({emergencyContribution:e.target.value})}/></label><label>Frequency<select value={s.emergencyFrequency} onChange={e=>patch({emergencyFrequency:e.target.value})}><option>Weekly</option><option>Monthly</option><option>Yearly</option></select></label><label>Automation<select value={s.emergencyAuto?'Automatic':'Manual'} onChange={e=>patch({emergencyAuto:e.target.value==='Automatic'})}><option>Manual</option><option>Automatic</option></select></label><label>Alert threshold %<input type="number" min="1" max="100" value={s.notifyAt||80} onChange={e=>patch({notifyAt:e.target.value})}/></label><button className="primary" onClick={()=>patch({emergencyPaused:!s.emergencyPaused})}>{s.emergencyPaused?'Resume':'Pause'} Automation</button></div><div className="metrics"><div className="metric"><div><small>Target</small><b>{money(target,currency)}</b></div></div><div className="metric"><div><small>Current</small><b>{money(current,currency)}</b></div></div><div className="metric"><div><small>Remaining</small><b>{money(Math.max(0,target-current),currency)}</b></div></div><div className="metric"><div><small>Progress</small><b>{progress.toFixed(1)}%</b></div></div></div><div className="card"><h2>Reserve Progress</h2><div className="progress"><i style={{width:progress+'%'}}/></div><p>{s.emergencyMode==='months'?`Target uses ${s.emergencyMonths} month(s) of tracked expenses (${money(monthly,currency)} per month).`:'Target is the fixed amount you choose.'}</p><div className="goal-actions"><button onClick={()=>{const n=prompt('Amount to add');if(Number(n)>0)patch({emergencyCurrent:current+Number(n)})}}>Add Manual Amount</button><button onClick={()=>{const n=prompt('New target amount');if(Number(n)>0)patch({emergencyMode:'fixed',emergencyFixed:Number(n)})}}>Quick Edit Target</button><button onClick={()=>{if(current>0&&confirm(`Move ${money(current,currency)} to savings and reset this reserve?`)){setData({...data,settings:{...s,emergencyCurrent:0},savings:[...data.savings,{id:uid(),name:'Returned from emergency reserve',amount:current,target:0,source:'Emergency reserve release',date:today()}]})}}}>Move Reserve to Savings</button></div></div></section>}
function buildNotifications(data,totals,liveQuotes={}){const out=[];const todayDate=new Date();const day=todayDate.getDate();const rules=data.notificationRules||{};const push=(id,type,title,text,priority='Normal',page='Notifications')=>{if(data.notifications[type]!==false)out.push({id,type,title,text,priority,page,date:today()})};data.transactions.filter(x=>Number(x.amount)>Number(data.settings.transactionLimit||0)).slice(-5).forEach(x=>push('txn-'+x.id,'transactions','High-value transaction',`${x.name||'Transaction'} exceeded your limit by ${money(Number(x.amount)-Number(data.settings.transactionLimit||0),data.settings.currency)}`,'High','Transactions'));const budget=Number(data.settings.monthlyBudget||0);if(budget&&totals.exp>=budget*Number(rules.budgetPercent||80)/100)push('budget-'+today(),'budget','Budget threshold reached',`Expenses are ${money(totals.exp)} against a ${money(budget)} monthly budget.`,'High','Transactions');data.liabilities.forEach(l=>{if(Number(l.dueDay)&&Number(l.dueDay)-day>=0&&Number(l.dueDay)-day<=Number(rules.emiDays||3))push('emi-'+l.id,'emi','EMI due soon',`${l.name||'Loan'} EMI of ${money(l.monthlyPayment)} is due on day ${l.dueDay}.`,'High','Liabilities')});data.goals.forEach(g=>{if(g.nextDate){const diff=Math.ceil((new Date(g.nextDate)-new Date(todayDate.toISOString().slice(0,10)))/86400000);if(diff>=0&&diff<=Number(rules.goalDays||3))push('goal-'+g.id,'goals','Goal contribution due',`${g.name}: ${money(g.regular||0)} scheduled for ${g.nextDate}.`,'Normal','Goals')}});const reserveTarget=data.settings.emergencyMode==='fixed'?Number(data.settings.emergencyFixed||0):Number(totals.exp||0)*Number(data.settings.emergencyMonths||0);const reserveCurrent=Number(data.settings.emergencyCurrent||0);if(reserveTarget&&reserveCurrent<reserveTarget*Number(data.settings.notifyAt||80)/100)push('emergency-'+today(),'emergency','Emergency reserve needs attention',`Reserve is ${money(reserveCurrent)} of ${money(reserveTarget)} target.`,'High','Emergency Reserve');data.alerts.filter(a=>a.enabled!==false).forEach(a=>{const symbol=String(a.symbol||'').toUpperCase();const inv=data.investments.find(i=>i.id===a.investmentId||String(i.symbol||'').toUpperCase()===symbol);const key=String(inv?.symbol||a.symbol||'').toUpperCase();const q=liveQuotes[key];if(inv&&inv.type==='Stocks'&&q){const price=Number(q.price),chg=Number(q.changePercent||0),high=Number(a.high||0),low=Number(a.low||0),rise=Number(a.risePercent||0),fall=Number(a.fallPercent||0);if(high&&price>=high)push('stock-high-'+a.id+'-'+Math.round(price*100),'stocks','Stock price crossed high level',`${inv.name||key} is ${money(price)} — at or above your ${money(high)} alert.`,'High','Investments');if(low&&price<=low)push('stock-low-'+a.id+'-'+Math.round(price*100),'stocks','Stock price crossed low level',`${inv.name||key} is ${money(price)} — at or below your ${money(low)} alert.`,'Critical','Investments');if(rise&&chg>=rise)push('stock-rise-'+a.id+'-'+chg.toFixed(2),'stocks','Stock rise alert',`${inv.name||key} is up ${chg.toFixed(2)}% today, above your +${rise}% alert.`,'High','Investments');if(fall&&chg<=-fall)push('stock-fall-'+a.id+'-'+chg.toFixed(2),'stocks','Stock fall alert',`${inv.name||key} is down ${Math.abs(chg).toFixed(2)}% today, beyond your -${fall}% alert.`,'Critical','Investments')}});if(data.notifications.weeklySummary!==false&&new Date().getDay()===1)push('weekly-'+today(),'weeklySummary','Weekly finance summary',`Net worth ${money(totals.net)}, income ${money(totals.inc)}, expenses ${money(totals.exp)}.`,'Normal','Dashboard');return out}
function NotificationPopover({notifications,unread,markRead,dismiss,markAll,openAll}){return <div className="notification-popover"><div className="notif-head"><div><b>Notifications</b><small>{unread} unread</small></div><button onClick={markAll}>Mark all read</button></div><div className="notif-list">{notifications.length?notifications.slice(0,8).map(n=><article className={'notif-item '+(n.priority||'Normal').toLowerCase()} key={n.id}><div><strong>{n.title}</strong><p>{n.text}</p><small>{n.date} · {n.priority}</small></div><div className="notif-actions"><button onClick={()=>markRead(n.id)}>✓</button><button onClick={()=>dismiss(n.id)}>×</button></div></article>):<div className="empty">You're all caught up.</div>}</div><button className="notif-all" onClick={openAll}>Open Notification Center →</button></div>}
function Notifications({data,setData,generated,markRead,dismiss,markAll}){const [tab,setTab]=useState('All');const [filter,setFilter]=useState('');const rows=generated.filter(n=>(tab==='All'||n.priority===tab)&&(!filter||n.type===filter));const patchRule=(k,v)=>setData({...data,notificationRules:{...data.notificationRules,[k]:Number(v)}});return <section><PageHead title="Notification Center" sub="Smart alerts, history, preferences and rules for your entire financial dashboard."><div className="notif-actions-head"><button className="primary" onClick={markAll}>Mark all read</button></div></PageHead><div className="notification-layout"><div className="card"><div className="notif-tabs">{['All','Critical','High','Normal'].map(x=><button className={tab===x?'active':''} key={x} onClick={()=>setTab(x)}>{x}</button>)}</div><div className="notif-filter"><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="">All categories</option>{['investments','emi','goals','budget','stocks','transactions','income','emergency','calendar','weeklySummary'].map(x=><option key={x} value={x}>{x}</option>)}</select></div>{rows.length?rows.map(n=><article className={'notification-row '+n.priority.toLowerCase()} key={n.id}><span className="priority-dot"/><div className="notif-main"><div className="card-head"><h3>{n.title}</h3><small>{n.priority}</small></div><p>{n.text}</p><small>{n.type} · {n.date}</small></div><div className="notif-row-actions"><button onClick={()=>markRead(n.id)}>Mark read</button><button onClick={()=>dismiss(n.id)}>Dismiss</button></div></article>):<Empty/>}</div><div><div className="card"><h2>Notification Preferences</h2>{Object.keys(data.notifications).map(k=><label className="toggle-row" key={k}><span>{k.replace(/([A-Z])/g,' $1')}</span><input type="checkbox" checked={!!data.notifications[k]} onChange={e=>setData({...data,notifications:{...data.notifications,[k]:e.target.checked}})}/></label>)}</div><div className="card rule-card"><h2>Smart Rules</h2><label>Budget alert threshold %<input type="number" min="1" max="100" value={data.notificationRules.budgetPercent} onChange={e=>patchRule('budgetPercent',e.target.value)}/></label><label>Goal reminder days<input type="number" min="0" max="30" value={data.notificationRules.goalDays} onChange={e=>patchRule('goalDays',e.target.value)}/></label><label>EMI reminder days<input type="number" min="0" max="30" value={data.notificationRules.emiDays} onChange={e=>patchRule('emiDays',e.target.value)}/></label><label>Stock % alert margin<input type="number" min="0" max="100" value={data.notificationRules.stockPercent} onChange={e=>patchRule('stockPercent',e.target.value)}/></label><label>Default rise alert %<input type="number" min="0" max="100" step="0.1" value={data.notificationRules.stockRisePercent||5} onChange={e=>patchRule('stockRisePercent',e.target.value)}/></label><label>Default fall alert %<input type="number" min="0" max="100" step="0.1" value={data.notificationRules.stockFallPercent||5} onChange={e=>patchRule('stockFallPercent',e.target.value)}/></label></div><StockAlertManager data={data} setData={setData}/></div></div></section>}
function StockAlertManager({data,setData}){const [f,setF]=useState({symbol:'',investmentId:'',high:'',low:'',risePercent:'',fallPercent:'',enabled:true});const addAlert=e=>{e.preventDefault();if(!f.symbol&&!f.investmentId)return;setData({...data,alerts:[...data.alerts,{...f,id:uid()}]});setF({symbol:'',investmentId:'',high:'',low:'',risePercent:'',fallPercent:'',enabled:true})};const patch=(id,p)=>setData({...data,alerts:data.alerts.map(a=>a.id===id?{...a,...p}:a)});return <div className="card"><div className="card-head"><h2>Live Stock Alerts</h2><span>Price + daily % triggers</span></div><form className="form" onSubmit={addAlert}><label>Symbol<input value={f.symbol} onChange={e=>setF({...f,symbol:e.target.value.toUpperCase()})} placeholder="RELIANCE.NS"/></label><label>High price<input type="number" value={f.high} onChange={e=>setF({...f,high:e.target.value})} placeholder="e.g. 3200"/></label><label>Low price<input type="number" value={f.low} onChange={e=>setF({...f,low:e.target.value})} placeholder="e.g. 2500"/></label><label>Rise %<input type="number" min="0" step="0.1" value={f.risePercent} onChange={e=>setF({...f,risePercent:e.target.value})} placeholder="e.g. 5"/></label><label>Fall %<input type="number" min="0" step="0.1" value={f.fallPercent} onChange={e=>setF({...f,fallPercent:e.target.value})} placeholder="e.g. 5"/></label><button className="primary">Add Alert</button></form>{data.alerts.length?data.alerts.map(a=><div className="alert-rule" key={a.id}><div><b>{a.symbol||a.investmentId}</b><small className="muted">High {a.high||'—'} · Low {a.low||'—'} · Rise +{a.risePercent||'—'}% · Fall -{a.fallPercent||'—'}%</small></div><label className="inline-toggle"><input type="checkbox" checked={a.enabled!==false} onChange={e=>patch(a.id,{enabled:e.target.checked})}/> Enabled</label><button className="danger" onClick={()=>setData({...data,alerts:data.alerts.filter(x=>x.id!==a.id)})}>Delete</button></div>):<small className="muted">No stock alerts configured.</small>}</div>}
function LiveStockTable({items,liveQuotes,currency,onEdit,onView}){return <div className="card table-card"><div className="card-head"><h2>Live Stock Values</h2><span>{Object.keys(liveQuotes).length?'Internet quote feed':'No quote loaded'}</span></div><div className="live-table-scroll"><Table headers={['Stock','Symbol','Live Price','Day Change','Qty','Market Value','Invested','P/L']} rows={items.map(x=>{const q=liveQuotes[String(x.symbol||'').toUpperCase()];const p=Number(q?.price||x.currentPrice||0),qty=Number(x.quantity||0),mv=p*qty,inv=Number(x.invested||0),pl=mv-inv;return [x.name||x.symbol,x.symbol||'—',q?money(p,currency):'—',q&&q.changePercent!=null?`${Number(q.changePercent)>=0?'+':''}${Number(q.changePercent).toFixed(2)}%`:'—',qty,money(mv,currency),money(inv,currency),<span className={pl>=0?'good':'bad'}>{pl>=0?'+':''}{money(pl,currency)}</span>]})} actions={items.map(x=><div className="row-actions"><button className="run" onClick={()=>onView(x)}>Graph</button></div>)}/></div></div>}
function StockHistoryChart({stock,points,currency,onClose}){if(!stock)return null; if(!points?.length)return <div className="card stock-history-card"><div className="card-head"><h2>{stock.name} · {stock.symbol}</h2><button className="run" onClick={onClose}>Close</button></div><div className="empty chart-empty">No price history available.</div></div>; const vals=points.map(p=>p.price),min=Math.min(...vals),max=Math.max(...vals),w=760,h=260,pad=22,range=Math.max(1,max-min); const path=points.map((p,i)=>{const x=pad+i*(w-pad*2)/Math.max(1,points.length-1);const y=h-pad-(p.price-min)/range*(h-pad*2);return `${i?'L':'M'} ${x.toFixed(1)} ${y.toFixed(1)}`}).join(' '); const latest=vals[vals.length-1],first=vals[0],chg=latest-first; return <div className="card stock-history-card"><div className="card-head"><div><h2>{stock.name}</h2><span>{stock.symbol} · 1 month price history</span></div><button className="run" onClick={onClose}>Close</button></div><div className="history-meta"><b>{money(latest,currency)}</b><span className={chg>=0?'good':'bad'}>{chg>=0?'+':''}{money(chg,currency)} over period</span></div><div className="history-chart-wrap"><svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${stock.name} price history`}><path d={path} fill="none" stroke="var(--chart0)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/><line x1={pad} y1={h-pad} x2={w-pad} y2={h-pad} stroke="var(--border)"/><circle cx={w-pad} cy={h-pad-(latest-min)/range*(h-pad*2)} r="5" fill="var(--chart0)"/></svg></div><div className="history-axis"><span>{new Date(points[0].time).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}</span><span>{new Date(points[Math.floor(points.length/2)].time).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}</span><span>{new Date(points[points.length-1].time).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}</span></div></div>}
function Investments({items,add,del,patch,currency,liveQuotes,quoteBusy,quoteUpdated,refreshQuotes,savingsTotal}){
 const [show,setShow]=useState(false),[editingId,setEditingId]=useState(null),[search,setSearch]=useState(''),[searchBusy,setSearchBusy]=useState(false),[searchResults,setSearchResults]=useState([]),[searchMsg,setSearchMsg]=useState(''),[apiState,setApiState]=useState('Internet market feed'),[historyStock,setHistoryStock]=useState(null),[history,setHistory]=useState([]),[historyBusy,setHistoryBusy]=useState(false),[selectedSymbol,setSelectedSymbol]=useState(''),[historyRange,setHistoryRange]=useState('1mo');
 const [f,setF]=useState({name:'',type:'Stocks',invested:'',current:'',quantity:'',buyPrice:'',currentPrice:'',symbol:''});
 const stocks=items.filter(x=>x.type==='Stocks'&&x.symbol);
 useEffect(()=>{if(!selectedSymbol&&stocks.length)setSelectedSymbol(String(stocks[0].symbol).toUpperCase())},[items.length,stocks.length,selectedSymbol]);
 const loadHistory=async(stock)=>{if(!stock?.symbol)return;setHistoryStock(stock);setHistory([]);setHistoryBusy(true);try{setHistory(await fetchHistory(stock.symbol,historyRange,'1d'))}catch(e){setHistory([])}finally{setHistoryBusy(false)}};
 useEffect(()=>{const stock=stocks.find(x=>String(x.symbol||'').toUpperCase()===selectedSymbol);if(stock)loadHistory(stock)},[selectedSymbol,historyRange]);
 const resetForm=()=>{setF({name:'',type:'Stocks',invested:'',current:'',quantity:'',buyPrice:'',currentPrice:'',symbol:''});setEditingId(null);setShow(false)};
 const openEdit=item=>{setF({name:item.name||'',type:item.type||'Stocks',invested:item.invested??'',current:item.current??'',quantity:item.quantity??'',buyPrice:item.buyPrice??'',currentPrice:item.currentPrice??'',symbol:item.symbol||''});setEditingId(item.id);setShow(true)};
 const submit=e=>{e.preventDefault();if(!f.name&&!f.symbol)return;const current=f.type==='Stocks'?Number(f.quantity)*Number(f.currentPrice||0):Number(f.current||0);const payload={...f,name:f.name||f.symbol,invested:Number(f.invested||0),current,currentPrice:f.type==='Stocks'?Number(f.currentPrice||0):undefined,quantity:f.type==='Stocks'?Number(f.quantity||0):undefined,buyPrice:f.type==='Stocks'?Number(f.buyPrice||0):undefined};if(editingId)patch(editingId,payload);else add(payload);resetForm()};
 const doSearch=async(queryValue=search)=>{const term=String(queryValue||'').trim();if(!term){setSearchMsg('Enter a company name or stock symbol.');return}setSearch(term);setSearchBusy(true);setSearchMsg('');try{const results=await searchStocks(term);setSearchResults(results);if(!results.length)setSearchMsg('No matching stocks found. Try a company name or ticker.')}catch(e){setSearchResults([]);setSearchMsg('Stock search is unavailable. Check that the market internet connection is available.')}finally{setSearchBusy(false)}};
 const track=async stock=>{const existing=stocks.find(x=>String(x.symbol||'').toUpperCase()===String(stock.symbol).toUpperCase());if(existing){setSelectedSymbol(String(existing.symbol).toUpperCase());return}let q={};try{q=await fetchQuote(stock.symbol)}catch(e){}add({name:stock.name||q.name||stock.symbol,symbol:stock.symbol,type:'Stocks',invested:0,current:0,quantity:0,buyPrice:0,currentPrice:Number(q.price||0)});setSelectedSymbol(String(stock.symbol).toUpperCase())};
 const viewHistory=async stock=>{setSelectedSymbol(String(stock.symbol).toUpperCase());setHistoryRange('1mo');await loadHistory(stock)};
 const testStocks=[['Reliance Industries','RELIANCE.NS'],['TCS','TCS.NS'],['Infosys','INFY.NS'],['HDFC Bank','HDFCBANK.NS'],['Apple','AAPL'],['NVIDIA','NVDA']];
 const selectedStock=historyStock||stocks.find(x=>String(x.symbol||'').toUpperCase()===selectedSymbol);
 return <section><PageHead title="Investments & Live Stocks" sub="Track holdings, search by company name or ticker, and monitor internet quotes."><div className="page-actions"><span className="live-status">{quoteBusy?'● Updating live prices':quoteUpdated?`● Live updated ${quoteUpdated}`:'○ Live feed idle'} · {apiState}</span><button className="run" onClick={refreshQuotes} disabled={quoteBusy}>{quoteBusy?'Updating…':'↻ Refresh prices'}</button><button className="primary" onClick={()=>{if(show)resetForm();else setShow(true)}}>{show?'Cancel':'+ Add Investment'}</button></div></PageHead>
 {stocks.length>0&&<section className="card chart-card stock-live-chart-card"><div className="card-head"><div><h2>Live Stock Price Graph</h2><span>Track real quote history for a selected holding</span></div><div className="stock-chart-controls"><select value={selectedSymbol} onChange={e=>setSelectedSymbol(e.target.value)}>{stocks.map(s=><option key={s.id} value={String(s.symbol).toUpperCase()}>{s.name||s.symbol} · {s.symbol}</option>)}</select><select value={historyRange} onChange={e=>setHistoryRange(e.target.value)}><option value="1mo">1 month</option><option value="3mo">3 months</option><option value="6mo">6 months</option></select><button className="run" onClick={()=>selectedStock&&loadHistory(selectedStock)} disabled={historyBusy}>{historyBusy?'Loading…':'↻ Reload graph'}</button></div></div>{historyBusy?<div className="card-inline-loading">Loading {selectedSymbol} price history…</div>:<StockHistoryChart stock={selectedStock} points={history} currency={currency} onClose={()=>setHistory([])}/>}</section>}
 {show&&<form className="card form" onSubmit={submit}><div className="form-title"><h2>{editingId?'Edit Investment':'Add Investment'}</h2><button type="button" className="run" onClick={resetForm}>Cancel</button></div><label>Name<input value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></label><label>Type<select value={f.type} onChange={e=>setF({...f,type:e.target.value})}>{['Stocks','Mutual Fund','ETF','Bond','Gold','Crypto','Real Estate','Other'].map(x=><option key={x}>{x}</option>)}</select></label><label>Invested<input type="number" min="0" value={f.invested} onChange={e=>setF({...f,invested:e.target.value})}/></label>{f.type==='Stocks'?<><label>Symbol<input value={f.symbol} onChange={e=>setF({...f,symbol:e.target.value.toUpperCase()})} placeholder="RELIANCE.NS"/></label><label>Quantity<input type="number" min="0" value={f.quantity} onChange={e=>setF({...f,quantity:e.target.value})}/></label><label>Buy Price<input type="number" min="0" value={f.buyPrice} onChange={e=>setF({...f,buyPrice:e.target.value})}/></label><label>Current Price<input type="number" min="0" value={f.currentPrice} onChange={e=>setF({...f,currentPrice:e.target.value})}/></label></>:<label>Current Value<input type="number" min="0" value={f.current} onChange={e=>setF({...f,current:e.target.value})}/></label>}<button className="primary">{editingId?'Update Investment':'Save Investment'}</button></form>}
 <div className="card stock-search-card"><div className="card-head"><div><h2>Find a stock</h2><span>Search by company name or symbol</span></div><span className="muted">Internet market data</span></div><div className="test-stock-row">{testStocks.map(([n,sym])=><button key={sym} className="test-stock" onClick={()=>doSearch(sym)}>{n} · {sym}</button>)}</div><div className="stock-search"><input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doSearch()} placeholder="Search company or symbol…"/><button className="primary" onClick={()=>doSearch()} disabled={searchBusy}>{searchBusy?'Searching…':'Search'}</button></div>{searchMsg&&<small className="muted">{searchMsg}</small>}{searchResults.length>0&&<div className="stock-search-results">{searchResults.map(s=><div className="stock-result" key={s.symbol}><div><b>{s.name}</b><small>{s.symbol} · {s.exchange||'Market'}{s.currency?` · ${s.currency}`:''}</small>{Number.isFinite(Number(s.price))&&<small className={Number(s.changePercent||0)>=0?'good':'bad'}>{money(s.price,s.currency||currency)} · {Number(s.changePercent||0)>=0?'+':''}{Number(s.changePercent||0).toFixed(2)}%</small>}</div><div className="row-actions"><button className="run" onClick={()=>viewHistory(s)}>Graph</button><button className="primary" onClick={()=>{track(s);setSearchResults([]);setSearch('')}}>Track</button></div></div>)}</div>}</div>
 <section className="card chart-card"><div className="card-head"><h2>Investment Graph</h2><span>Current value by investment type</span></div><InvestmentTabChart items={items} liveQuotes={liveQuotes} currency={currency}/></section>
 {(() => { const investedTotal=items.reduce((s,x)=>s+Number(x.invested||0),0); const investmentValue=items.reduce((s,x)=>{const live=x.type==='Stocks'?liveQuotes[String(x.symbol||'').toUpperCase()]:null; return s+(live&&Number.isFinite(Number(live.price))?Number(live.price)*Number(x.quantity||0):Number(x.type==='Stocks'?Number(x.currentPrice||x.current||0)*Number(x.quantity||0):Number(x.current||0)));},0); const savingsLinked=Number(savingsTotal||0); const combined=investmentValue+savingsLinked; const gain=investmentValue-investedTotal; const invShare=combined>0?investmentValue/combined*100:0; return <section className="card chart-card linked-summary"><div className="card-head"><div><h2>Investment & Savings Summary</h2><span>Linked view of invested money and savings</span></div><span>Updates automatically</span></div><div className="linked-summary-grid"><div><small>Invested amount</small><b>{money(investedTotal,currency)}</b></div><div><small>Current investment value</small><b>{money(investmentValue,currency)}</b></div><div><small>Investment gain / loss</small><b className={gain>=0?'good':'bad'}>{gain>=0?'+':''}{money(gain,currency)}</b></div><div><small>Savings</small><b>{money(savingsLinked,currency)}</b></div><div><small>Combined savings + investments</small><b>{money(combined,currency)}</b></div><div><small>Investment share</small><b>{invShare.toFixed(1)}% · Savings {(100-invShare).toFixed(1)}%</b></div></div></section>; })()}
 {stocks.length>0?<><section className="card stock-graphs-panel"><div className="card-head"><div><h2>Stock Graphs</h2><span>Every tracked stock can open its live price-history graph.</span></div></div><div className="stock-graph-buttons">{stocks.map(s=><button key={s.id} className={selectedSymbol===String(s.symbol).toUpperCase()?'primary':'run'} onClick={()=>viewHistory(s)}>📈 {s.name||s.symbol}</button>)}</div></section><LiveStockTable items={stocks} liveQuotes={liveQuotes} currency={currency} onView={viewHistory}/></>:<div className="card empty">No tracked stocks yet. Search above and click <b>Track</b>.</div>}
 <div className="card table-card"><div className="card-head"><h2>All Investments</h2><span>Manage every investment.</span></div><Table headers={['Investment','Type','Invested','Current','Gain/Loss','Return']} rows={items.map(x=>{const live=x.type==='Stocks'?liveQuotes[String(x.symbol||'').toUpperCase()]:null;const cur=live?Number(live.price)*Number(x.quantity||0):Number(x.type==='Stocks'?Number(x.currentPrice||x.current||0)*Number(x.quantity||0):Number(x.current||0)),inv=Number(x.invested||0),g=cur-inv,p=inv?g/inv*100:0;return [x.name,x.type,money(inv,currency),money(cur,currency),<span className={g>=0?'good':'bad'}>{g>=0?'+':''}{money(g,currency)}</span>,p.toFixed(2)+'%']})} actions={items.map(x=><div className="row-actions"><button className="danger" onClick={()=>del(x.id)}>Delete</button></div>)}/></div></section>}
function Notes({items,add,del}){const [f,setF]=useState({title:'',body:''});return <section><PageHead title="Notes" sub="Keep financial reminders and investment notes."/><form className="card form" onSubmit={e=>{e.preventDefault();add({...f,date:today()});setF({title:'',body:''})}}><label>Title<input value={f.title} onChange={e=>setF({...f,title:e.target.value})}/></label><label>Note<textarea value={f.body} onChange={e=>setF({...f,body:e.target.value})}/></label><button className="primary">Add Note</button></form><div className="notes">{items.map(x=><article className="card note" key={x.id}><div className="card-head"><h3>{x.title}</h3><button className="danger" onClick={()=>del(x.id)}>Delete</button></div><p>{x.body}</p><small>{x.date}</small></article>)}</div></section>}
function CalendarPage({data,setData}){const [cursor,setCursor]=useState(new Date(new Date().getFullYear(),new Date().getMonth(),1));const [f,setF]=useState({title:'',date:today(),type:'Reminder'});const days=new Date(cursor.getFullYear(),cursor.getMonth()+1,0).getDate();const first=new Date(cursor.getFullYear(),cursor.getMonth(),1).getDay();const cells=[...Array(first).fill(null),...Array.from({length:days},(_,i)=>i+1)];while(cells.length%7)cells.push(null);const add=e=>{e.preventDefault();if(!f.title)return;setData({...data,calendar:[...data.calendar,{...f,id:uid()}]});setF({title:'',date:today(),type:'Reminder'})};return <section><PageHead title="Calendar" sub="Track salary, EMI, goal contributions, investments and reminders."/><div className="calendar-layout"><div className="card"><div className="calendar-nav"><button onClick={()=>setCursor(new Date(cursor.getFullYear(),cursor.getMonth()-1,1))}>‹</button><b>{cursor.toLocaleString('en',{month:'long',year:'numeric'})}</b><button onClick={()=>setCursor(new Date(cursor.getFullYear(),cursor.getMonth()+1,1))}>›</button></div><div className="week">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(x=><b key={x}>{x}</b>)}</div><div className="days">{cells.map((d,i)=>d?<button className={f.date===`${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`?'sel':''} key={i} onClick={()=>setF({...f,date:`${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`})}>{d}</button>:<div key={i}/>)}</div></div><div className="card"><h2>Add Event</h2><form className="form one" onSubmit={add}><label>Title<input value={f.title} onChange={e=>setF({...f,title:e.target.value})}/></label><label>Date<input type="date" value={f.date} onChange={e=>setF({...f,date:e.target.value})}/></label><label>Type<select value={f.type} onChange={e=>setF({...f,type:e.target.value})}><option>Reminder</option><option>Income</option><option>Loan / EMI</option><option>Goal Contribution</option><option>Investment</option></select></label><button className="primary">Add Event</button></form><h3>Upcoming</h3>{data.calendar.sort((a,b)=>a.date.localeCompare(b.date)).slice(0,8).map(x=><div className="row" key={x.id}><span>{x.date} · {x.title}</span><button className="danger" onClick={()=>setData({...data,calendar:data.calendar.filter(e=>e.id!==x.id)})}>Delete</button></div>)}</div></div></section>}
function Profile({data,setData,totals}){const [f,setF]=useState(data.profile);return <section><PageHead title="User Profile" sub="Manage your account and see your financial overview."/><div className="card profile-card"><div className="big-avatar">{(f.name||'U')[0].toUpperCase()}</div><div><h2>{f.name||'Your Name'}</h2><p>{f.email||'Add your email address'}</p></div></div><form className="card form" onSubmit={e=>{e.preventDefault();setData({...data,profile:f});localStorage.setItem('wealthtrack-profile',JSON.stringify(f))}}><label>Name<input value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></label><label>Email<input type="email" value={f.email} onChange={e=>setF({...f,email:e.target.value})}/></label><label>Username<input value={f.username} onChange={e=>setF({...f,username:e.target.value})}/></label><button className="primary">Save Profile</button></form><div className="profile-grid">{[['Net Worth',totals.net],['Assets',totals.totalAssets],['Investments',totals.inv],['Savings',totals.sav],['Goal Funds',totals.goal],['Liabilities',totals.liab]].map(([k,v])=><div className="card" key={k}><small>{k}</small><b>{money(v)}</b></div>)}</div><section className="card chart-card net-worth-card profile-net-worth"><div className="card-head"><h2>Net Worth</h2><span>Your financial trend</span></div><NetWorthChart totals={totals} currency={data.settings?.currency||'INR'} history={data.netWorthHistory||[]}/></section></section>}
function Settings({data,setData}){return <section><PageHead title="Settings" sub="Control your WealthTrack preferences."/><div className="card settings-list"><label className="toggle-row"><span>Theme</span><select value={data.settings.theme} onChange={e=>setData({...data,settings:{...data.settings,theme:e.target.value}})}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label><label className="toggle-row"><span>Transaction Limit</span><input type="number" value={data.settings.transactionLimit} onChange={e=>setData({...data,settings:{...data.settings,transactionLimit:e.target.value}})}/></label><label className="toggle-row"><span>Monthly Budget</span><input type="number" value={data.settings.monthlyBudget} onChange={e=>setData({...data,settings:{...data.settings,monthlyBudget:e.target.value}})}/></label></div></section>}
function CashFlow({data,setData,totals}){
 const blankTx={name:'',type:'Expense',category:'',amount:'',date:today(),note:''};
 const blankIncome={name:'',kind:'Active',amount:'',frequency:'Monthly',day:'',enabled:true};
 const [showTx,setShowTx]=useState(false),[showIncome,setShowIncome]=useState(false);
 const [tx,setTx]=useState(blankTx),[income,setIncome]=useState(blankIncome);
 const addTx=e=>{e.preventDefault();if(!tx.name||Number(tx.amount)<0)return;setData({...data,transactions:[...data.transactions,{...tx,id:uid(),amount:Number(tx.amount)}]});setTx(blankTx);setShowTx(false)};
 const addIncome=e=>{e.preventDefault();if(!income.name||Number(income.amount)<0)return;setData({...data,income:[...data.income,{...income,id:uid(),amount:Number(income.amount)}]});setIncome(blankIncome);setShowIncome(false)};
 const removeTx=id=>setData({...data,transactions:data.transactions.filter(x=>x.id!==id)});
 const removeIncome=id=>setData({...data,income:data.income.filter(x=>x.id!==id)});
 const rows=[...data.transactions].sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,20);
 return <section><PageHead title="Cash Flow" sub="Manage income, expenses and scheduled payments in one place."><div className="page-actions"><button className="primary" onClick={()=>setShowTx(v=>!v)}>{showTx?'Cancel':'+ Add Transaction'}</button><button className="run" onClick={()=>setShowIncome(v=>!v)}>{showIncome?'Cancel':'+ Add Income Source'}</button></div></PageHead>
 <div className="metrics"><div className="metric"><div><small>Income</small><b>{money(totals.inc)}</b></div></div><div className="metric"><div><small>Expenses</small><b>{money(totals.exp)}</b></div></div><div className="metric"><div><small>Cash Flow</small><b>{money(totals.cash)}</b></div></div></div>
 <section className="card chart-card cashflow-section-chart"><div className="card-head"><h2>Cash Flow Graph</h2><span>Last 6 months</span></div><LineChart months={lastMonths(data.transactions)}/></section>
 <section className="card"><div className="card-head"><h2>Income</h2><span>Income is part of Cash Flow</span></div>{showIncome&&<form className="form" onSubmit={addIncome}><label>Source<input value={income.name} onChange={e=>setIncome({...income,name:e.target.value})}/></label><label>Type<select value={income.kind} onChange={e=>setIncome({...income,kind:e.target.value})}><option>Active</option><option>Passive</option></select></label><label>Amount<input type="number" min="0" value={income.amount} onChange={e=>setIncome({...income,amount:e.target.value})}/></label><label>Frequency<input value={income.frequency} onChange={e=>setIncome({...income,frequency:e.target.value})}/></label><label>Day<input type="number" min="1" max="31" value={income.day} onChange={e=>setIncome({...income,day:e.target.value})}/></label><button className="primary">Save Income Source</button></form>}{data.income.length?<Table headers={['Source','Type','Amount','Frequency','Day']} rows={data.income.map(x=>[x.name,x.kind,money(x.amount,data.settings?.currency||'INR'),x.frequency||'—',x.day||'—'])} actions={data.income.map(x=><button className="danger" onClick={()=>removeIncome(x.id)}>Delete</button>)}/>:<Empty/>}</section>
 {showTx&&<form className="card form" onSubmit={addTx}><label>Description<input value={tx.name} onChange={e=>setTx({...tx,name:e.target.value})}/></label><label>Type<select value={tx.type} onChange={e=>setTx({...tx,type:e.target.value})}><option>Income</option><option>Expense</option></select></label><label>Category<input value={tx.category} onChange={e=>setTx({...tx,category:e.target.value})}/></label><label>Amount<input type="number" min="0" step="0.01" value={tx.amount} onChange={e=>setTx({...tx,amount:e.target.value})}/></label><label>Date<input type="date" value={tx.date} onChange={e=>setTx({...tx,date:e.target.value})}/></label><label>Optional note<textarea value={tx.note} onChange={e=>setTx({...tx,note:e.target.value})}/></label><button className="primary">Save Transaction</button></form>}
 <div className="card table-card"><div className="card-head"><h2>Cash Flow Activity</h2><span>Latest 20 entries</span></div>{rows.length?<Table headers={['Description','Type','Amount','Date','Category']} rows={rows.map(x=>[x.name,x.type,money(x.amount,data.settings?.currency||'INR'),x.date,x.category||'—'])} actions={rows.map(x=><button className="danger" onClick={()=>removeTx(x.id)}>Delete</button>)}/>:<Empty/>}</div>
 </section>}
function decodeHtmlEntities(text){
 try{
   const el=document.createElement('textarea');
   el.innerHTML=text;
   return el.value;
 }catch{
   return text;
 }
}

function renderWealthBotMessage(text){
 const clean=decodeHtmlEntities(String(text||'')).replace(/\r\n/g,'\n');
 const lines=clean.split('\n');
 const blocks=[];
 let list=[];
 let listType=null;

 const flushList=()=>{
   if(!list.length)return;
   const Tag=listType==='ol'?'ol':'ul';
   blocks.push(
     <Tag key={`list-${blocks.length}`} className="bot-list">
       {list.map((item,i)=><li key={i}>{renderInline(item)}</li>)}
     </Tag>
   );
   list=[]; listType=null;
 };

 lines.forEach((raw,i)=>{
   const line=raw.trim();

   if(!line){
     flushList();
     return;
   }

   const bullet=line.match(/^[-*•]\s+(.+)/);
   const numbered=line.match(/^\d+[.)]\s+(.+)/);

   if(bullet){
     if(listType && listType!=='ul')flushList();
     listType='ul';
     list.push(bullet[1]);
     return;
   }

   if(numbered){
     if(listType && listType!=='ol')flushList();
     listType='ol';
     list.push(numbered[1]);
     return;
   }

   flushList();

   const heading=line.match(/^#{1,6}\s+(.+)/);
   if(heading){
     blocks.push(<h4 key={i}>{renderInline(heading[1])}</h4>);
     return;
   }

   // Treat markdown-style section labels as headings.
   if((line.endsWith(':') && line.length<90) || /^\*\*[^*]+\*\*$/.test(line)){
     blocks.push(<h4 key={i}>{renderInline(line.replace(/^\*\*|\*\*$/g,''))}</h4>);
     return;
   }

   // Preserve short standalone lines as normal paragraphs.
   blocks.push(<p key={i}>{renderInline(line)}</p>);
 });

 flushList();
 return <div className="bot-rich-text">{blocks}</div>;
}

function renderInline(text){
 const decoded=decodeHtmlEntities(text);
 const parts=decoded.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);
 return parts.map((part,i)=>{
   if(/^\*\*[^*]+\*\*$/.test(part))
     return <strong key={i}>{part.slice(2,-2)}</strong>;
   if(/^`[^`]+`$/.test(part))
     return <code key={i}>{part.slice(1,-1)}</code>;
   const link=part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
   if(link)
     return <a key={i} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>;
   return <React.Fragment key={i}>{part}</React.Fragment>;
 });
}

function Chatbot({data,totals,close}){
 const [msgs,setMsgs]=useState([
   {role:'bot',text:'Hi! I am WealthBot. I can analyze your WealthTrack data and search the web for current information when Web Search is enabled.'}
 ]);
 const [q,setQ]=useState('');
 const [webMode,setWebMode]=useState(false);
 const [busy,setBusy]=useState(false);
 const [filter,setFilter]=useState(()=>localStorage.getItem('wealthtrack-web-filter')||'');
 const [windowFilter,setWindowFilter]=useState(()=>localStorage.getItem('wealthtrack-web-window')||'Any time');

 const saveWebPrefs=(k,v)=>{
   if(k==='filter'){
     setFilter(v);
     localStorage.setItem('wealthtrack-web-filter',v);
   }else{
     setWindowFilter(v);
     localStorage.setItem('wealthtrack-web-window',v);
   }
 };

 const finance={
   netWorth:totals.net,
   income:totals.inc,
   expenses:totals.exp,
   assets:totals.totalAssets,
   liabilities:totals.liab,
   investments:totals.inv,
   savings:totals.sav,
   goalFunds:totals.goal,
   cashFlow:totals.cash,
   activeIncome:totals.active,
   passiveIncome:totals.passive
 };

 const askGemini=async(s)=>{
   const filters=webMode
     ? (filter.trim()
       ? `Only keep information matching these required topics or keywords: ${filter}.`
       : 'Keep only information directly relevant to the question.')
     : '';

   const recency=webMode && windowFilter!=='Any time'
     ? `Prefer sources published within ${windowFilter}.`
     : (webMode ? 'Use the freshest reliable sources available.' : '');

   const instructions=`You are WealthBot, a helpful personal-finance and small-business assistant inside the WealthTrack application.

The user is asking: ${s}

Use the user's private WealthTrack data below when it is relevant. Clearly distinguish the user's private numbers from general knowledge${webMode ? ' and current web information' : ''}.
${filters}
${recency}

Important rules:
- Do not invent facts, prices, sources, rates, or financial data.
- Do not guarantee investment returns.
- Do not give personalized buy/sell instructions for specific securities.
- Give practical, understandable explanations and clearly state important assumptions.
- If the user's WealthTrack data is incomplete or appears to be placeholder data, say so rather than assuming it is real.
- For debt, loans, investments, savings, budgeting, cash flow, and business decisions, explain the factors the user should consider rather than presenting risky decisions as certain.
${webMode ? '- When web information is available, prefer primary/official sources and reputable financial, government, or news sources. Do not treat search snippets or promotional claims as automatically reliable.' : ''}
- Keep the response readable with short paragraphs, headings, and bullet points where useful.
- Do not expose API keys, internal implementation details, or server configuration.
- End with a compact Sources section only when web search is enabled and actual sources/grounding information are available.

All monetary values below are in Indian rupees (INR). Never display these WealthTrack amounts in dollars or USD.

User's WealthTrack summary (INR):
${JSON.stringify(finance)}`;

   const response=await fetch('/api/wealthbot/chat',{
     method:'POST',
     headers:{'Content-Type':'application/json'},
     body:JSON.stringify({
       useWeb:webMode,
       message:s,
       instructions
     })
   });

   const result=await response.json().catch(()=>({}));
   if(!response.ok){
     throw new Error(result?.error||`AI request failed (${response.status})`);
   }

   return result.output_text
     || result.output?.flatMap(x=>x.content||[]).map(x=>x.text||'').filter(Boolean).join('\n')
     || 'Gemini returned no text.';
 };

 const send=async()=>{
   if(!q.trim()||busy)return;

   const text=q.trim();
   setQ('');
   setMsgs(m=>[...m,{role:'user',text}]);
   setBusy(true);

   try{
     const answer=await askGemini(text);
     setMsgs(m=>[...m,{role:'bot',text:answer}]);
   }catch(e){
     const prefix=webMode
       ? 'Web Search request could not be completed'
       : 'AI request could not be completed';

     setMsgs(m=>[...m,{
       role:'bot',
       text:`${prefix}: ${e?.message||'Unknown error'}`
     }]);
   }finally{
     setBusy(false);
   }
 };

 return <div className="chatbot">
   <div className="chat-window">
     <div className="chat-head">
       <div>
         <b>WealthBot</b>
         <small className="live-status">
           {webMode?'Web-aware mode':'WealthTrack AI mode'}
         </small>
       </div>
       <button onClick={close} aria-label="Close WealthBot">×</button>
     </div>

     <div className="chat-mode">
       <button
         className={webMode?'active':''}
         onClick={()=>setWebMode(v=>!v)}
         disabled={busy}
       >
         🌐 Web Search {webMode?'ON':'OFF'}
       </button>
       <span>
         {webMode
           ? 'Current web information + your WealthTrack data'
           : 'Your WealthTrack data + AI assistance'}
       </span>
     </div>

     {webMode&&<div className="chat-web-settings">
       <label>
         Required topics / filters
         <input
           value={filter}
           onChange={e=>saveWebPrefs('filter',e.target.value)}
           placeholder="e.g. RBI rates, latest news, market prices"
         />
       </label>

       <label>
         Preferred freshness
         <select
           value={windowFilter}
           onChange={e=>saveWebPrefs('window',e.target.value)}
         >
           <option>Any time</option>
           <option>24 hours</option>
           <option>7 days</option>
           <option>30 days</option>
         </select>
       </label>

       <small>
         Web Search adds current web information to the assistant's response.
         Your private data and API credentials remain handled by the application.
       </small>
     </div>}

     <div className="chat-msgs">
       {msgs.map((m,i)=>
         <div key={i} className={'message '+m.role}>
           {m.role==='bot'?renderWealthBotMessage(m.text):m.text}
         </div>
       )}
       {busy&&<div className="message bot">
         {webMode?'Finding current information…':'Thinking…'}
       </div>}
     </div>

     <div className="chat-form">
       <input
         value={q}
         onChange={e=>setQ(e.target.value)}
         onKeyDown={e=>e.key==='Enter'&&send()}
         placeholder={webMode?'Ask WealthBot to search the web...':'Ask WealthBot about your finances...'}
         disabled={busy}
       />
       <button onClick={send} disabled={busy||!q.trim()}>
         {busy?'…':'Send'}
       </button>
     </div>
   </div>
 </div>}
function Detail({modal,close}){return <div className="modal" onClick={e=>e.target===e.currentTarget&&close()}><div className="modal-box"><button className="close" onClick={close}>×</button><span className="modal-icon">◈</span><h2>{modal.title}</h2><b>{modal.value}</b><p>Expanded view. This space can hold detailed graphs, tables, filters and live history for this module.</p></div></div>}
function Table({headers,rows,actions}){return <div className="table-wrap"><table><thead><tr>{headers.map(x=><th key={x}>{x}</th>)}<th>Action</th></tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{r.map((x,j)=><td key={j}>{x}</td>)}<td>{actions[i]}</td></tr>)}</tbody></table></div>}
function Empty(){return <div className="empty">No records yet. Add your first record above.</div>}

createRoot(document.getElementById('root')).render(<AuthGate><App/></AuthGate>);
