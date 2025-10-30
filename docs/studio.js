// Reset dur d'état et assainissement automatique
const KEY = "studio.fs.v4";
const list = document.getElementById("list");
const code = document.getElementById("code");
const frame = document.getElementById("frame");
const promptInput = document.getElementById("prompt");
const tabsBar = document.querySelector(".tabs");

let fs = loadFS();
let current = null;
let typingTimer = null;

init();

function init(){
  applyMobile();
  sanitizeFS();               // <- supprime le "JS imprimé en texte"
  renderList();
  const first = Object.keys(fs)[0];
  if(first) openFile(first); else preview("");

  document.getElementById("save").onclick = ()=>{ commit(); flash("Enregistré"); };
  document.getElementById("preview").onclick = ()=> preview(fs[current]||"");
  document.getElementById("ai-propose").onclick = generateAI;
  code.addEventListener("input", ()=>{
    clearTimeout(typingTimer);
    typingTimer = setTimeout(()=>{ commit(); preview(fs[current]||""); }, 250);
  });

  if ("serviceWorker" in navigator){
    addEventListener("load", ()=>navigator.serviceWorker.register("sw.js"));
  }
}

/* ---------- FS ---------- */
function loadFS(){
  try{
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {
      "index.html": "<!doctype html><meta charset='utf-8'><title>Exemple</title><h1>Bonjour</h1>"
    };
  }catch{
    return {"index.html":"<!doctype html><meta charset='utf-8'><title>Exemple</title><h1>Bonjour</h1>"};
  }
}
function saveFS(){ localStorage.setItem(KEY, JSON.stringify(fs)); }
function renderList(){
  list.innerHTML = "";
  Object.keys(fs).sort().forEach(name=>{
    const li = document.createElement("li");
    li.dataset.name = name;
    li.className = name===current ? "active" : "";
    const span = document.createElement("span"); span.textContent = name;
    li.append(span);
    li.onclick = ()=> openFile(name);
    list.appendChild(li);
  });
}
function openFile(name){
  if(!fs[name]) return;
  current = name;
  code.value = fs[name];
  renderList();
  preview(fs[name]);
  if(document.body.classList.contains("mobile")) setView("editor");
}
function commit(){
  if(!current) return;
  fs[current] = code.value;
  saveFS();
}

/* ---------- Prévisualisation ---------- */
function preview(html){
  const s = String(html||"");
  const isHTML = /^\s*<!doctype|^\s*<html|^\s*<head|^\s*<body/i.test(s);
  frame.srcdoc = isHTML
    ? s
    : `<!doctype html><meta charset="utf-8"><title>Aperçu</title>
       <pre style="margin:16px;font:13px ui-monospace,Consolas,Menlo,monospace;white-space:pre-wrap">${escapeHTML(s)}</pre>`;
  if(document.body.classList.contains("mobile")) setView("preview");
}

/* ---------- IA ---------- */
async function generateAI(){
  const query = promptInput.value.trim();
  if(!query){ flash("Décris d'abord"); return; }
  flash("Génération…");
  try{
    const res = await window.ai.generate(query);
    if(!res || !res.files){ flash("Aucune sortie"); return; }
    // merge safe
    for(const [path,content] of Object.entries(res.files)){
      if(typeof content !== "string") continue;
      fs[path] = content;
    }
    saveFS(); renderList();
    const htmlTarget = Object.keys(res.files).find(n=>/\.html?$/i.test(n)) || Object.keys(res.files)[0];
    if(htmlTarget) openFile(htmlTarget);
    flash("OK");
  }catch(e){ console.error(e); flash("Erreur IA"); }
}

/* ---------- Sanitize anti-texte ---------- */
function sanitizeFS(){
  const suspicious = [
    "function applyMobileMode", "document.getElementById(\"rename\")",
    "const KEY =", "document.getElementById(\"ai-propose\")",
    "frame.srcdoc", "openFile(name)"
  ];
  const defHTML = "<!doctype html><meta charset='utf-8'><title>Exemple</title><h1>Bonjour</h1>";
  let changed = false;

  for(const [name,content] of Object.entries(fs)){
    if(!/\.html?$/i.test(name)) continue;
    const txt = String(content||"");
    const hasScriptTag = /<script[\s>]/i.test(txt);
    const looksLikeDump = suspicious.some(sig=>txt.includes(sig));
    if(looksLikeDump && !hasScriptTag){
      fs[name] = defHTML;
      changed = true;
    }
  }
  if(changed) saveFS();
}

/* ---------- Utilitaires UI ---------- */
function escapeHTML(s){return s.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function flash(t){ promptInput.value=""; promptInput.placeholder=t; setTimeout(()=>promptInput.placeholder="Décris ce que tu veux générer",1500); }

/* ---------- Mobile ---------- */
function applyMobile(){
  const mobile = matchMedia("(max-width:900px)").matches;
  if(mobile){
    document.body.classList.add("mobile");
    tabsBar.style.display = "flex";
    tabsBar.querySelectorAll("button").forEach(b=>b.onclick=()=>{
      tabsBar.querySelectorAll("button").forEach(x=>x.classList.remove("active"));
      b.classList.add("active");
      setView(b.dataset.v);
    });
  }else{
    document.body.classList.remove("mobile");
    tabsBar.style.display = "none";
    setView("files");
  }
}
function setView(v){
  document.body.className = document.body.className.replace(/view-\w+/,"").trim();
  document.body.classList.add("view-"+v);
}  }else{
    document.body.classList.remove("is-mobile","view-files","view-editor","view-preview");
  }
}
addEventListener("resize", applyMobileMode);

function loadFS(){
  try{
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {
      "index.html": "<!doctype html><html><head><meta charset='utf-8'><title>Exemple</title><style>body{font:16px/1.5 system-ui;margin:24px}</style></head><body><h1>Bonjour</h1><p>Modifie ce fichier puis clique Aperçu.</p></body></html>"
    };
  }catch{
    return {"index.html":"<!doctype html><meta charset='utf-8'><title>Exemple</title><h1>Bonjour</h1>"};
  }
}
function saveFS(){ localStorage.setItem(KEY, JSON.stringify(fs)); }
function renderList(){
  list.innerHTML = "";
  Object.keys(fs).sort().forEach(name=>{
    const li=document.createElement("li");
    li.dataset.name=name;
    li.className = name===current ? "active":"";
    const n=document.createElement("span"); n.className="name"; n.textContent=name;
    const s=document.createElement("span"); s.textContent=(new Blob([fs[name]]).size)+"o";
    li.append(n,s);
    li.onclick=()=>openFile(name);
    list.appendChild(li);
  });
}
function openFile(name){
  if(!fs[name]) return;
  commitState();
  current = name;
  code.value = fs[name];
  renderList();
  resetHistoryIfNeeded(name);
  preview();
}
function resetHistoryIfNeeded(name){
  if(!history[name]){ history[name]=[fs[name]]; cursor[name]=0; }
  else{ cursor[name]=history[name].length-1; }
}
function commitState(){
  if(!current) return;
  const arr = history[current] || [fs[current]];
  const idx = cursor[current] ?? (arr.length-1);
  const latest = arr[idx];
  if(code.value !== latest){
    const next = arr.slice(0,idx+1); next.push(code.value);
    history[current]=next; cursor[current]=next.length-1;
    fs[current]=code.value; saveFS();
  }
}

function preview(){
  commitState();
  const html = fs[current] || "<!doctype html><meta charset='utf-8'><title>Vide</title><p>Fichier vide</p>";
  frame.srcdoc = html.startsWith("<!doctype") || html.startsWith("<html")
    ? html
    : `<!doctype html><meta charset="utf-8"><title>Aperçu</title><body>${escapeHTML(html)}</body>`;
  switchView("preview");
}

/* ---- IA helpers ---- */
function escapeHTML(s){
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function renderAnalysis(res){
  const css = `
    body{font:14px system-ui;margin:16px;line-height:1.6;color:#e5e7eb;background:#0b1324}
    h1{margin:0 0 8px}h2{margin:16px 0 8px}
    details{border:1px solid #23314d;border-radius:8px;background:#0e1530;margin:8px 0}
    details>summary{cursor:pointer;padding:8px 10px;outline:0}
    pre{margin:0;border-top:1px solid #23314d;max-height:40vh;overflow:auto;padding:10px 12px;white-space:pre-wrap}
    code{font-family:ui-monospace,Consolas,Menlo,monospace;font-size:12px}
    p{margin:6px 0}
  `;
  const section = (title, arr=[]) => {
    if(!Array.isArray(arr) || arr.length===0) return `<h2>${title}</h2><p>—</p>`;
    return `<h2>${title}</h2>` + arr.map(item=>{
      const s = typeof item==='string' ? item : JSON.stringify(item, null, 2);
      const esc = escapeHTML(s);
      if(esc.length > 400){
        const head = escapeHTML(s.slice(0,120)).replace(/\n/g,' ');
        return `<details><summary>${head}…</summary><pre><code>${esc}</code></pre></details>`;
      }
      return `<p>${esc}</p>`;
    }).join("");
  };
  return `<!doctype html><meta charset="utf-8"><title>Analyse</title><style>${css}</style>
    <h1>Analyse</h1>
    ${section("Problèmes", res?.issues)}
    ${section("Actions", res?.actions)}
    ${section("Avertissements", res?.warnings)}
  `;
}

/* ---- Events ---- */
document.getElementById("new").onclick=()=>{
  if(lock) return;
  const name = prompt("Nom du fichier","nouveau.html");
  if(!name) return;
  if(fs[name]){ alert("Existe déjà"); return; }
  fs[name]=""; saveFS(); renderList(); openFile(name);
};
document.getElementById("rename").onclick=()=>{
  if(lock) return;
  if(!current) return;
  const nv = prompt("Nouveau nom", current);
  if(!nv || nv===current) return;
  if(fs[nv]){ alert("Existe déjà"); return; }
  fs[nv]=fs[current]; delete fs[current];
  history[nv]=history[current]; cursor[nv]=cursor[current];
  delete history[current]; delete cursor[current];
  saveFS(); renderList(); openFile(nv);
};
document.getElementById("delete").onclick=()=>{
  if(lock) return;
  if(!current) return;
  if(!confirm("Supprimer "+current+" ?")) return;
  delete fs[current]; delete history[current]; delete cursor[current];
  saveFS(); current=null; renderList();
  const first=Object.keys(fs)[0]; if(first){ openFile(first); } preview();
};
document.getElementById("save").onclick=()=>{ if(lock) return; commitState(); setStatus("Enregistré"); setTimeout(()=>setStatus(""),1000); preview(); };
document.getElementById("download").onclick=async()=>{
  if(lock) return;
  const zip=new JSZip(); for(const [n,c] of Object.entries(fs)) zip.file(n,c);
  const blob=await zip.generateAsync({type:"blob"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="projet.zip"; a.click(); URL.revokeObjectURL(a.href);
};
document.getElementById("import").onclick=()=>{ if(lock) return; document.getElementById("zip").click(); };
document.getElementById("zip").onchange=async e=>{
  if(lock) return;
  const f=e.target.files[0]; if(!f) return;
  const zip=await JSZip.loadAsync(f); let imported=0;
  for(const path of Object.keys(zip.files)){
    const file=zip.files[path]; if(file.dir)continue;
    const content=await file.async("string"); fs[path]=content; imported++;
  }
  if(imported===0){ alert("ZIP vide"); return; }
  saveFS(); renderList(); openFile(Object.keys(fs)[0]); preview();
};
document.getElementById("preview").onclick=()=>{ if(lock) return; preview(); };
document.getElementById("reset").onclick=()=>{ if(lock) return; if(!confirm("Réinitialiser le studio ?")) return; localStorage.removeItem(KEY); location.reload(); };

code.addEventListener("input",()=>{ clearTimeout(typingTimer); typingTimer=setTimeout(()=>{ commitState(); preview(); }, 300); });

document.getElementById("ai-propose").onclick=async()=>{
  if(lock) return;
  setLock(true); setStatus("IA en cours");
  try{
    const res = await window.ai.generate(promptInput.value||"");
    if(res && res.files){
      for(const [p,c] of Object.entries(res.files)) fs[p]=c;
      saveFS(); renderList();
      const htmlTarget = Object.keys(res.files).find(n=>/\.html?$/i.test(n));
      if(htmlTarget){ openFile(htmlTarget); } else { setStatus("Code ajouté"); }
      preview();
    }
    setStatus(res?.summary || "IA terminé"); setTimeout(()=>setStatus(""),1500);
  }catch{ setStatus("Erreur IA"); }
  finally{ setLock(false); }
};

document.getElementById("ai-analyze").onclick=async()=>{
  if(lock) return;
  setLock(true); setStatus("Analyse en cours");
  try{
    const res = await window.ai.analyze();
    frame.srcdoc = renderAnalysis(res || {});
    switchView("preview");
    setStatus("Analyse affichée"); setTimeout(()=>setStatus(""),1500);
  }catch{ setStatus("Erreur analyse"); }
  finally{ setLock(false); }
};

/* Init */
applyMobileMode();
renderList();
if(!current){ const first = Object.keys(fs)[0]; if(first) openFile(first); else preview(); }
if("serviceWorker" in navigator){
  addEventListener("load", ()=>navigator.serviceWorker.register("sw.js"));
}  }else{
    document.body.classList.remove("is-mobile","view-files","view-editor","view-preview");
  }
}
addEventListener("resize", applyMobileMode);

function loadFS(){
  try{
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {
      "index.html": "<!doctype html><html><head><meta charset='utf-8'><title>Exemple</title><style>body{font:16px/1.5 system-ui;margin:24px}</style></head><body><h1>Bonjour</h1><p>Modifie ce fichier puis clique Aperçu.</p></body></html>"
    };
  }catch{
    return {"index.html":"<!doctype html><meta charset='utf-8'><title>Exemple</title><h1>Bonjour</h1>"};
  }
}
function saveFS(){ localStorage.setItem(KEY, JSON.stringify(fs)); }
function renderList(){
  list.innerHTML = "";
  Object.keys(fs).sort().forEach(name=>{
    const li=document.createElement("li");
    li.dataset.name=name;
    li.className = name===current ? "active":"";
    const n=document.createElement("span"); n.className="name"; n.textContent=name;
    const s=document.createElement("span"); s.textContent=(new Blob([fs[name]]).size)+"o";
    li.append(n,s);
    li.onclick=()=>openFile(name);
    list.appendChild(li);
  });
}
function openFile(name){
  if(!fs[name]) return;
  commitState();
  current = name;
  code.value = fs[name];
  renderList();
  resetHistoryIfNeeded(name);
  preview();
}
function resetHistoryIfNeeded(name){
  if(!history[name]){ history[name]=[fs[name]]; cursor[name]=0; }
  else{ cursor[name]=history[name].length-1; }
}
function commitState(){
  if(!current) return;
  const arr = history[current] || [fs[current]];
  const idx = cursor[current] ?? (arr.length-1);
  const latest = arr[idx];
  if(code.value !== latest){
    const next = arr.slice(0,idx+1); next.push(code.value);
    history[current]=next; cursor[current]=next.length-1;
    fs[current]=code.value; saveFS();
  }
}

function preview(){
  commitState();
  const html = fs[current] || "<!doctype html><meta charset='utf-8'><title>Vide</title><p>Fichier vide</p>";
  frame.srcdoc = html;
  switchView("preview");
}

document.getElementById("new").onclick=()=>{
  if(lock) return;
  const name = prompt("Nom du fichier","nouveau.html");
  if(!name) return;
  if(fs[name]){ alert("Existe déjà"); return; }
  fs[name]=""; saveFS(); renderList(); openFile(name);
};
document.getElementById("rename").onclick=()=>{
  if(lock) return;
  if(!current) return;
  const nv = prompt("Nouveau nom", current);
  if(!nv || nv===current) return;
  if(fs[nv]){ alert("Existe déjà"); return; }
  fs[nv]=fs[current]; delete fs[current];
  history[nv]=history[current]; cursor[nv]=cursor[current];
  delete history[current]; delete cursor[current];
  saveFS(); renderList(); openFile(nv);
};
document.getElementById("delete").onclick=()=>{
  if(lock) return;
  if(!current) return;
  if(!confirm("Supprimer "+current+" ?")) return;
  delete fs[current]; delete history[current]; delete cursor[current];
  saveFS(); current=null; renderList(); const first=Object.keys(fs)[0]; if(first){ openFile(first); } preview();
};
document.getElementById("save").onclick=()=>{ if(lock) return; commitState(); setStatus("Enregistré"); setTimeout(()=>setStatus(""),1000); preview(); };
document.getElementById("download").onclick=async()=>{
  if(lock) return;
  const zip=new JSZip(); for(const [n,c] of Object.entries(fs)) zip.file(n,c);
  const blob=await zip.generateAsync({type:"blob"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="projet.zip"; a.click(); URL.revokeObjectURL(a.href);
};
document.getElementById("import").onclick=()=>{ if(lock) return; document.getElementById("zip").click(); };
document.getElementById("zip").onchange=async e=>{
  if(lock) return;
  const f=e.target.files[0]; if(!f) return;
  const zip=await JSZip.loadAsync(f); let imported=0;
  for(const path of Object.keys(zip.files)){
    const file=zip.files[path]; if(file.dir) continue;
    const content=await file.async("string"); fs[path]=content; imported++;
  }
  if(imported===0){ alert("ZIP vide"); return; }
  saveFS(); renderList(); openFile(Object.keys(fs)[0]); preview();
};
document.getElementById("preview").onclick=()=>{ if(lock) return; preview(); };
document.getElementById("reset").onclick=()=>{ if(lock) return; if(!confirm("Réinitialiser le studio ?")) return; localStorage.removeItem(KEY); location.reload(); };

code.addEventListener("input",()=>{ clearTimeout(typingTimer); typingTimer=setTimeout(()=>{ commitState(); preview(); }, 350); });

document.getElementById("ai-propose").onclick=async()=>{
  if(lock) return;
  setLock(true); setStatus("IA en cours");
  try{
    const res = await window.ai.generate(promptInput.value||"");
    if(res && res.files){
      for(const [p,c] of Object.entries(res.files)) fs[p]=c;
      saveFS(); renderList();
      const names=Object.keys(res.files);
      const target = names.includes("index.html") ? "index.html" : names[0];
      if(target) openFile(target); else preview();
    }
    setStatus(res?.summary || "IA terminé"); setTimeout(()=>setStatus(""),1500);
  }catch{ setStatus("Erreur IA"); }
  finally{ setLock(false); }
};

document.getElementById("ai-analyze").onclick=async()=>{
  if(lock) return;
  setLock(true); setStatus("Analyse en cours");
  try{
    const res = await window.ai.analyze();
    const html = [
      "<!doctype html><meta charset='utf-8'><title>Analyse</title>",
      "<style>body{font:14px system-ui;margin:20px;line-height:1.6;color:#e5e7eb;background:#0b1324}h1{margin:0 0 8px}h2{margin:16px 0 8px}ul{padding-left:18px}</style>",
      "<h1>Analyse</h1>",
      section("Problèmes",res?.issues),
      section("Actions",res?.actions),
      section("Avertissements",res?.warnings)
    ].join("");
    frame.srcdoc = html;
    switchView("preview");
    setStatus("Analyse affichée"); setTimeout(()=>setStatus(""),1500);
  }catch{ setStatus("Erreur analyse"); }
  finally{ setLock(false); }
};
function section(title,items){
  const arr = Array.isArray(items)?items:[];
  return "<h2>"+title+"</h2><ul>"+arr.map(x=>"<li>"+String(x)+"</li>").join("")+"</ul>";
}

applyMobileMode();
renderList();
if(!current){ openFile(Object.keys(fs)[0]); } else { preview(); }

if("serviceWorker" in navigator){
  addEventListener("load", ()=>navigator.serviceWorker.register("sw.js"));
}
