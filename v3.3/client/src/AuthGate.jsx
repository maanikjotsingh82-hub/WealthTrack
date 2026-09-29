import React,{useState}from"react";

const enc=new TextEncoder();
async function derive(password,salt){
  const key=await crypto.subtle.importKey("raw",enc.encode(password),"PBKDF2",false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt:enc.encode(salt),iterations:120000,hash:"SHA-256"},key,256);
  return Array.from(new Uint8Array(bits)).map(b=>b.toString(16).padStart(2,"0")).join("");
}
const normalizeEmail=e=>String(e||"").trim().toLowerCase();
const accountKey=e=>`wealthtrack-account:${normalizeEmail(e)}`;
export default function AuthGate({children}){
 const [u,setU]=useState(()=>{try{return JSON.parse(sessionStorage.getItem("wealthtrack-session")||"null")}catch{return null}});
 const [signup,setSignup]=useState(false);const[name,setName]=useState("");const[email,setEmail]=useState("");const[password,setPassword]=useState("");const[confirm,setConfirm]=useState("");const[msg,setMsg]=useState("");const[busy,setBusy]=useState(false);
 const submit=async e=>{e.preventDefault();if(busy)return;const em=normalizeEmail(email);if(!em||!password||(signup&&!name)){setMsg("Please complete all fields.");return}if(password.length<8){setMsg("Use at least 8 characters.");return}if(signup&&password!==confirm){setMsg("Passwords do not match.");return}setBusy(true);setMsg("");
   try{const stored=JSON.parse(localStorage.getItem(accountKey(em))||"null");
     if(signup){if(stored){setMsg("An account with this email already exists.");return}const salt=crypto.randomUUID();const hash=await derive(password,salt);const account={email:em,name:name.trim(),salt,hash,createdAt:new Date().toISOString()};localStorage.setItem(accountKey(em),JSON.stringify(account));const session={email:em,name:account.name};sessionStorage.setItem("wealthtrack-session",JSON.stringify(session));setU(session);}
     else{if(!stored){setMsg("Account not found. Create an account first.");return}const hash=await derive(password,stored.salt);if(hash!==stored.hash){setMsg("Incorrect email or password.");return}const session={email:stored.email,name:stored.name};sessionStorage.setItem("wealthtrack-session",JSON.stringify(session));setU(session);}
   }catch(err){setMsg("Login could not be completed in this browser.")}finally{setBusy(false)}
 };
 if(u)return children;
 return <div className="auth-page"><form className="auth-card" onSubmit={submit}><div className="auth-logo">▥ WealthTrack</div><h1>{signup?"Create account":"Login"}</h1><p>{signup?"Create your private finance workspace.":"Sign in to continue."}</p>{signup&&<input required placeholder="Full name" value={name} onChange={e=>setName(e.target.value)}/>}<input required type="email" placeholder="name@gmail.com" value={email} onChange={e=>setEmail(e.target.value)}/><input required type="password" minLength="8" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)}/>{signup&&<input required type="password" minLength="8" placeholder="Confirm password" value={confirm} onChange={e=>setConfirm(e.target.value)}/>}<button className="primary" disabled={busy}>{busy?"Please wait…":signup?"Create Account":"Login"}</button><button type="button" className="switch-auth" onClick={()=>{setSignup(v=>!v);setMsg("");setConfirm("")}}>{signup?"Already registered? Login":"New user? Create account"}</button>{msg&&<small className="auth-error">{msg}</small>}<small className="auth-note">Password is stored as a salted PBKDF2 hash in this browser. For production, move authentication to a secure backend.</small></form></div>
}
