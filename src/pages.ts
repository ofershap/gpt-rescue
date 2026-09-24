// Server-rendered pages. Plain HTML + a little vanilla JS, no build step.

const REPO = "https://github.com/ofershap/gpt-rescue";
const FAQ_URL = "https://help.openai.com/en/articles/20001519-custom-gpt-retirement-and-migration-faq";

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

const css = `
:root{--bg:#0b0d12;--card:#141821;--line:#262c3a;--text:#e8ebf2;--mute:#9aa3b5;--acc:#5b8cff;--ok:#3ecf8e;--warn:#ffb454}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
a{color:var(--acc)}.wrap{max-width:960px;margin:0 auto;padding:0 20px}
header.top{display:flex;justify-content:space-between;align-items:center;padding:18px 0}.logo{font-weight:700;letter-spacing:.2px;color:var(--text);text-decoration:none}
.btn{display:inline-block;background:var(--acc);color:#fff;border:0;border-radius:10px;padding:12px 20px;font-weight:600;text-decoration:none;cursor:pointer;font-size:16px}
.btn.ghost{background:transparent;border:1px solid var(--line);color:var(--text)}.btn.small{padding:6px 12px;font-size:14px}.btn.danger{background:#d9534f}
.hero{padding:56px 0 32px}.hero h1{font-size:44px;line-height:1.1;margin:0 0 16px}.hero p{font-size:19px;color:var(--mute);max-width:680px}
.pill{display:inline-block;border:1px solid var(--line);border-radius:99px;padding:4px 12px;font-size:13px;color:var(--warn);margin-bottom:18px}
section{padding:28px 0}h2{font-size:26px;margin:0 0 14px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px}.card h3{margin:0 0 6px;font-size:17px}.card p{margin:0;color:var(--mute)}
.x li::marker{content:"✕  ";color:#ff6b6b}.v li::marker{content:"✓  ";color:var(--ok)}ul{padding-left:22px}
.mute{color:var(--mute)}footer{padding:40px 0;color:var(--mute);font-size:14px;border-top:1px solid var(--line);margin-top:40px}
label{display:block;font-weight:600;margin:18px 0 6px}.hint{font-weight:400;color:var(--mute);font-size:14px}
input,textarea,select{width:100%;background:#0f1219;color:var(--text);border:1px solid var(--line);border-radius:10px;padding:10px 12px;font:inherit}
textarea{min-height:140px;font-family:ui-monospace,Menlo,monospace;font-size:14px}.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.err{background:#3a1d1d;border:1px solid #6b2b2b;padding:10px 14px;border-radius:10px;margin-top:14px;display:none}
code,.mono{font-family:ui-monospace,Menlo,monospace;font-size:13px;background:#0f1219;border:1px solid var(--line);border-radius:6px;padding:2px 6px;word-break:break-all}
table{width:100%;border-collapse:collapse;font-size:14px}td,th{border-bottom:1px solid var(--line);padding:8px 6px;text-align:left;vertical-align:top}
.steps{counter-reset:s}.steps .card{position:relative;padding-left:56px}.steps .card:before{counter-increment:s;content:counter(s);position:absolute;left:18px;top:16px;width:26px;height:26px;border-radius:50%;background:var(--acc);text-align:center;font-weight:700;line-height:26px}
details{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 16px;margin:8px 0}summary{cursor:pointer;font-weight:600}
@media(max-width:640px){.hero h1{font-size:32px}.row{grid-template-columns:1fr}}
`;

function layout(title: string, body: string, desc = "Keep your Custom GPT running for the customers who paid for it, after OpenAI retires GPTs.") {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta name="robots" content="index,follow">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🛟</text></svg>">
<style>${css}</style></head><body><div class="wrap"><header class="top"><a class="logo" href="/">🛟 GPT Rescue</a><nav><a class="btn ghost small" href="${REPO}">GitHub</a></nav></header>
${body}
<footer>GPT Rescue is free, open source (MIT) and in beta. Not affiliated with OpenAI. Code: <a href="${REPO}">github.com/ofershap/gpt-rescue</a>. Built by <a href="https://github.com/ofershap">@ofershap</a>.</footer>
</div></body></html>`;
}

export function landingPage() {
  return layout("GPT Rescue - keep serving your Custom GPT customers after December 11", `
<div class="hero">
  <div class="pill">OpenAI's help page: custom GPTs stop running December 11, 2026 (dates marked "subject to change")</div>
  <h1>Your Custom GPT is being retired.<br>Your customers don't have to lose it.</h1>
  <p>Paste your GPT's instructions, knowledge files and action schema. Get back a private link your customers can keep using, and a connector that puts your GPT, files and actions back inside ChatGPT. Per-customer access you control. Free and open source.</p>
  <p><a class="btn" href="/new">Rescue my GPT - free</a> &nbsp; <a class="btn ghost" href="#how">How it works</a></p>
</div>

<section>
  <h2>What the plugin migration leaves behind</h2>
  <div class="grid">
    <div class="card"><ul class="x"><li>Share links. Migrated plugins start private, so the link you sent customers stops being the way in.</li></ul></div>
    <div class="card"><ul class="x"><li>Custom actions. They don't transfer through the migration workflow and have to be rebuilt.</li></ul></div>
    <div class="card"><ul class="x"><li>Your customers' access. There is no "anyone with the link" for people outside your workspace, only the public directory after review.</li></ul></div>
  </div>
  <p class="mute">Sources: <a href="${FAQ_URL}">OpenAI's retirement and migration FAQ</a> and creators reporting it in the <a href="https://community.openai.com/t/custom-gpt-retirement-no-equivalent-to-anyone-with-the-link-in-plugins-how-do-small-businesses-keep-serving-external-customers-after-dec-11/1400202">OpenAI developer forum</a>.</p>
</section>

<section>
  <h2>What you get</h2>
  <div class="grid">
    <div class="card"><h3>A connector for ChatGPT</h3><p>A hosted MCP server that carries your instructions, searches your knowledge files and calls your actions. Your customer adds one URL in ChatGPT and keeps using it on their own plan. Also works in Claude and Cursor.</p></div>
    <div class="card"><h3>A private chat page</h3><p>A stable link that runs your GPT on your own OpenAI API key, for customers who'd rather not touch settings. You pay OpenAI per use, we charge nothing.</p></div>
    <div class="card"><h3>Your actions, kept</h3><p>Paste the OpenAPI schema from your GPT's actions. Every operation becomes a tool, called with your API key, which is stored encrypted and never shown to customers.</p></div>
    <div class="card"><h3>Access you control</h3><p>Every customer gets their own key. See when it was last used, revoke it in one click. Paywall with Stripe is next.</p></div>
  </div>
</section>

<section id="how">
  <h2>How it works</h2>
  <div class="grid steps">
    <div class="card"><h3>Copy it out of ChatGPT</h3><p>Open your GPT in the editor. Copy the instructions, download your knowledge files, copy each action's schema.</p></div>
    <div class="card"><h3>Paste it here</h3><p>Two minutes. You get a private admin link. Keep it, it's the only way to manage your GPT.</p></div>
    <div class="card"><h3>Send each customer their link</h3><p>Create a key per customer. They get a connector URL for ChatGPT and a chat link. Revoke any time.</p></div>
  </div>
</section>

<section>
  <h2>Straight answers</h2>
  <details><summary>What does my customer need to do in ChatGPT?</summary><p>Turn on Developer mode in ChatGPT settings, then add your connector URL as a custom app/plugin. ChatGPT shows a warning because the connector isn't reviewed by OpenAI. Availability by plan has shifted (paid plans for sure); if Developer mode isn't available to them, send the chat page link instead.</p></details>
  <details><summary>Is it exactly the same as my GPT?</summary><p>Close, not identical. In ChatGPT the connector is a tool the model calls, so it loads your instructions at the start of the conversation rather than owning the whole chat. The chat page runs your instructions as the system prompt, with the model you choose.</p></details>
  <details><summary>What does it cost?</summary><p>Nothing while in beta. The chat page uses your own OpenAI API key, so OpenAI bills you for usage. The connector costs you nothing: it runs on your customer's ChatGPT plan.</p></details>
  <details><summary>What happens to my data?</summary><p>Instructions, files and schema are stored so the GPT can run. API keys are encrypted at rest. Chat messages are not stored on the server. You can delete everything from your admin page. The code is open, so you can read it or host it yourself.</p></details>
  <details><summary>Which file types work?</summary><p>PDF (with a text layer), TXT, Markdown, CSV, JSON and HTML. Export Word or Google Docs to PDF first.</p></details>
</section>

<section style="text-align:center"><a class="btn" href="/new">Rescue my GPT - free</a></section>
`);
}

export function newPage() {
  return layout("Rescue a GPT - GPT Rescue", `
<h1>Rescue a GPT</h1>
<p class="mute">Everything here comes from your GPT's editor in ChatGPT (Explore GPTs → My GPTs → Edit → Configure).</p>
<form id="f">
  <div class="row">
    <div><label>Name</label><input name="name" required maxlength="80" placeholder="e.g. Recipe Coach"></div>
    <div><label>Short description <span class="hint">optional</span></label><input name="description" maxlength="500"></div>
  </div>
  <label>Instructions <span class="hint">paste the full Instructions field</span></label>
  <textarea name="instructions" required style="min-height:220px"></textarea>
  <label>Knowledge files <span class="hint">optional, up to 20 files, 8 MB each: PDF, TXT, MD, CSV, JSON, HTML</span></label>
  <input type="file" name="files" multiple accept=".pdf,.txt,.md,.markdown,.csv,.tsv,.json,.html,.htm,.xml,.yaml,.yml">
  <label>Action schema <span class="hint">optional, the OpenAPI JSON/YAML from Actions → Edit</span></label>
  <textarea name="openapi" placeholder='{"openapi":"3.1.0", ...}'></textarea>
  <div class="row">
    <div><label>Action authentication</label>
      <select name="authType" id="authType"><option value="none">None</option><option value="bearer">API key - Bearer</option><option value="header">API key - Custom header</option><option value="query">API key - Query parameter</option></select></div>
    <div id="authNameBox" style="display:none"><label>Header / parameter name</label><input name="authName" placeholder="X-API-Key"></div>
  </div>
  <div id="authValueBox" style="display:none"><label>API key <span class="hint">stored encrypted, never shown to customers</span></label><input name="authValue" type="password" autocomplete="off"></div>
  <label>Private chat page <span class="hint">optional: your OpenAI API key enables it. Leave empty for connector only.</span></label>
  <div class="row"><input name="openaiKey" type="password" autocomplete="off" placeholder="sk-..."><input name="model" value="gpt-4.1-mini" placeholder="model"></div>
  <p><button class="btn" id="go" type="submit">Create</button></p>
  <div class="err" id="err"></div>
</form>
<script>
const t=document.getElementById('authType');t.onchange=()=>{const v=t.value;document.getElementById('authNameBox').style.display=(v==='header'||v==='query')?'block':'none';document.getElementById('authValueBox').style.display=v==='none'?'none':'block'};
document.getElementById('f').onsubmit=async(e)=>{e.preventDefault();const b=document.getElementById('go'),er=document.getElementById('err');b.disabled=true;b.textContent='Creating...';er.style.display='none';
try{const r=await fetch('/api/rescues',{method:'POST',body:new FormData(e.target)});const d=await r.json();if(!r.ok)throw new Error(d.error||'Failed');
localStorage.setItem('gr_admin_'+d.id,d.adminToken);location.href='/admin/'+d.id+'#t='+d.adminToken;}catch(x){er.textContent=x.message;er.style.display='block';b.disabled=false;b.textContent='Create';}};
</script>`);
}

export function adminPage() {
  return layout("Manage GPT - GPT Rescue", `
<div id="app"><p class="mute">Loading...</p></div>
<div class="err" id="err"></div>
<script>
const id=location.pathname.split('/').pop();
const h=new URLSearchParams(location.hash.slice(1));if(h.get('t'))localStorage.setItem('gr_admin_'+id,h.get('t'));
const tok=localStorage.getItem('gr_admin_'+id)||h.get('t');
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const api=(p,o={})=>fetch(p,{...o,headers:{...(o.headers||{}),'x-admin-token':tok}}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||'Failed');return d});
function err(m){const e=document.getElementById('err');e.textContent=m;e.style.display='block';scrollTo(0,document.body.scrollHeight)}
async function load(){if(!tok){document.getElementById('app').innerHTML='<p>Missing admin token. Open the admin link you saved when you created this GPT.</p>';return}
try{render(await api('/api/rescues/'+id))}catch(x){document.getElementById('app').innerHTML='<p>'+E(x.message)+'</p>'}}
function render(d){const adminUrl=d.origin+'/admin/'+d.id+'#t='+tok;
document.getElementById('app').innerHTML=\`
<h1>\${E(d.name)}</h1>
<div class="card" style="border-color:var(--warn)"><b>Save your admin link.</b> It is the only way back to this page.<br><span class="mono">\${E(adminUrl)}</span> <button class="btn small ghost" onclick="navigator.clipboard.writeText('\${adminUrl}')">Copy</button></div>
<section><h2>Customers</h2>
<p class="mute">Each customer gets their own key: a connector URL for ChatGPT\${d.chatEnabled?' and a private chat link':''}. Revoke a key and that customer loses access.</p>
<div class="row"><input id="label" placeholder="Customer name or email (for your records)"><div><button class="btn" onclick="newKey()">Create customer access</button></div></div>
<div id="newkey"></div>
<table><tr><th>Customer</th><th>Created</th><th>Last used</th><th></th></tr>\${d.keys.map(k=>\`<tr><td>\${E(k.label)}</td><td>\${k.createdAt.slice(0,10)}</td><td>\${k.lastUsed?k.lastUsed.slice(0,16).replace('T',' '):'-'}</td><td>\${k.revoked?'<span class="mute">revoked</span> <button class="btn small ghost" onclick="rev(\\''+k.keyHash+'\\',false)">Restore</button>':'<button class="btn small ghost" onclick="rev(\\''+k.keyHash+'\\',true)">Revoke</button>'}</td></tr>\`).join('')||'<tr><td colspan=4 class="mute">No customers yet</td></tr>'}</table>
</section>
<section><h2>What it exposes</h2><p class="mute">Tools your customers' ChatGPT sees\${d.api?' (actions call <code>'+E(d.api.baseUrl)+'</code>)':''}:</p>
<table>\${d.tools.map(t=>'<tr><td><code>'+E(t.name)+'</code></td><td class="mute">'+E(t.description.slice(0,160))+'</td></tr>').join('')}</table></section>
<section><h2>Edit</h2><form id="ef">
<label>Name</label><input name="name" value="\${E(d.name)}">
<label>Description</label><input name="description" value="\${E(d.description)}">
<label>Instructions</label><textarea name="instructions" style="min-height:220px">\${E(d.instructions)}</textarea>
<label>Knowledge files</label><div>\${d.knowledgeFiles.map(f=>'<div>'+E(f.name)+' <span class="mute">('+f.chunks+' passages)</span> <button type="button" class="btn small ghost" onclick="delFile(\\''+encodeURIComponent(f.name)+'\\')">Remove</button></div>').join('')||'<span class="mute">None</span>'}</div>
<input type="file" name="files" multiple style="margin-top:8px">
<label>Action schema</label><textarea name="openapi">\${E(d.openapi)}</textarea>
<div class="row"><div><label>Action authentication <span class="hint">now: \${E(d.actionAuthType)}\${d.actionAuthName?' ('+E(d.actionAuthName)+')':''}</span></label><select name="authType"><option value="keep">Keep current</option><option value="none">None</option><option value="bearer">API key - Bearer</option><option value="header">API key - Custom header</option><option value="query">API key - Query parameter</option></select></div>
<div><label>Header / parameter name</label><input name="authName" value="\${E(d.actionAuthName)}"></div></div>
<label>New API key for actions <span class="hint">only if changing</span></label><input name="authValue" type="password" autocomplete="off">
<label>Chat page <span class="hint">\${d.chatEnabled?'enabled. Paste a new OpenAI key to replace it, or type remove':'disabled. Paste an OpenAI API key to enable'}</span></label>
<div class="row"><input name="openaiKey" type="password" autocomplete="off"><input name="model" value="\${E(d.model)}"></div>
<p><button class="btn" type="submit">Save changes</button> <button class="btn danger" type="button" onclick="delAll()">Delete this GPT</button></p></form></section>\`;
document.getElementById('ef').onsubmit=async e=>{e.preventDefault();try{await api('/api/rescues/'+id,{method:'POST',body:new FormData(e.target)});load()}catch(x){err(x.message)}}}
async function newKey(){try{const d=await api('/api/rescues/'+id+'/keys',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({label:document.getElementById('label').value})});
const chat=(await api('/api/rescues/'+id)).chatEnabled;
const msg=\`Here is your access to the new version of the GPT.\\n\\nIn ChatGPT: Settings → turn on Developer mode → Plugins/Apps → Create → paste this server URL (no authentication):\\n\${d.connectorUrl}\${chat?'\\n\\nOr just open it in your browser:\\n'+d.chatUrl:''}\\n\\nThis link is personal, please don't share it.\`;
document.getElementById('newkey').innerHTML='<div class="card" style="margin:12px 0;border-color:var(--ok)"><b>Send this to your customer.</b> The key is shown only once.<textarea id="msg" style="min-height:160px;margin-top:8px">'+E(msg)+'</textarea><button class="btn small" onclick="navigator.clipboard.writeText(document.getElementById(\\'msg\\').value)">Copy message</button></div>';
setTimeout(()=>{const n=document.getElementById('newkey').innerHTML;load().then(()=>document.getElementById('newkey').innerHTML=n)},0)}catch(x){err(x.message)}}
async function rev(hash,r){try{await api('/api/rescues/'+id+'/keys/'+hash,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({revoked:r})});load()}catch(x){err(x.message)}}
async function delFile(n){try{await api('/api/rescues/'+id+'/files/'+n,{method:'DELETE'});load()}catch(x){err(x.message)}}
async function delAll(){if(!confirm('Delete this GPT, its files and all customer access? This cannot be undone.'))return;try{await api('/api/rescues/'+id,{method:'DELETE'});localStorage.removeItem('gr_admin_'+id);location.href='/'}catch(x){err(x.message)}}
load();
</script>`);
}

export function chatPage(name: string, description: string, enabled: boolean) {
  return layout(name, `
<style>#log{min-height:50vh}.m{padding:12px 16px;border-radius:12px;margin:10px 0;white-space:pre-wrap;word-wrap:break-word}.u{background:#1c2436;margin-left:15%}.a{background:var(--card);border:1px solid var(--line);margin-right:10%}
#box{position:sticky;bottom:0;background:var(--bg);padding:12px 0;display:flex;gap:8px}#box textarea{min-height:52px;font-family:inherit;font-size:16px}</style>
<h1 style="margin-bottom:0">${esc(name)}</h1><p class="mute">${esc(description)}</p>
${enabled ? "" : '<div class="card">The creator has not enabled the chat page for this GPT. Use the connector URL they sent you in ChatGPT.</div>'}
<div id="log"></div>
<div id="box"><textarea id="q" placeholder="Message ${esc(name)}"${enabled ? "" : " disabled"}></textarea><button class="btn" id="send"${enabled ? "" : " disabled"}>Send</button></div>
<p class="mute" style="font-size:13px">Your conversation is kept in this browser only. <a href="#" id="clr">Clear</a></p>
<script>
const id=location.pathname.split('/').pop();const h=new URLSearchParams(location.hash.slice(1));
if(h.get('k')){localStorage.setItem('gr_key_'+id,h.get('k'));history.replaceState(null,'',location.pathname)}
const key=localStorage.getItem('gr_key_'+id);let msgs=JSON.parse(localStorage.getItem('gr_msgs_'+id)||'[]');
const E=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const md=s=>E(s).replace(/\`\`\`([\\s\\S]*?)\`\`\`/g,'<code style="display:block;white-space:pre">$1</code>').replace(/\`([^\`]+)\`/g,'<code>$1</code>').replace(/\\*\\*([^*]+)\\*\\*/g,'<b>$1</b>').replace(/\\[([^\\]]+)\\]\\((https?:[^)\\s]+)\\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');
function draw(){document.getElementById('log').innerHTML=msgs.map(m=>'<div class="m '+(m.role==='user'?'u':'a')+'">'+md(m.content)+'</div>').join('');scrollTo(0,document.body.scrollHeight)}
if(!key){document.getElementById('log').innerHTML='<div class="card">This page needs the personal link the creator sent you.</div>'}else draw();
async function send(){const q=document.getElementById('q');const t=q.value.trim();if(!t||!key)return;q.value='';msgs.push({role:'user',content:t});draw();
const b=document.getElementById('send');b.disabled=true;b.textContent='...';
try{const r=await fetch('/api/chat/'+id,{method:'POST',headers:{'content-type':'application/json','x-customer-key':key},body:JSON.stringify({messages:msgs})});const d=await r.json();if(!r.ok)throw new Error(d.error);msgs.push({role:'assistant',content:d.reply})}
catch(x){msgs.push({role:'assistant',content:'⚠️ '+x.message})}
localStorage.setItem('gr_msgs_'+id,JSON.stringify(msgs.slice(-60)));draw();b.disabled=false;b.textContent='Send'}
document.getElementById('send').onclick=send;document.getElementById('q').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}};
document.getElementById('clr').onclick=e=>{e.preventDefault();msgs=[];localStorage.removeItem('gr_msgs_'+id);draw()};
</script>`, description || name);
}

export function notFoundPage() {
  return layout("Not found - GPT Rescue", `<h1>Not found</h1><p><a href="/">Back to GPT Rescue</a></p>`);
}
