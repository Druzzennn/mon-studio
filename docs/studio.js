// Clé alignée avec ai.js
const KEY = "studio.fs.v1";

const list = document.getElementById("list");
const code = document.getElementById("code");
const frame = document.getElementById("frame");
const promptInput = document.getElementById("prompt");
const tabsBar = document.querySelector(".tabs");

let fs = window.ai?.loadFS ? window.ai.loadFS() : loadFSFallback();
let current = null;
let typingTimer = null;

boot();

function boot(){
  applyMobile();
  sanitizeFS();
  renderList();
  const first = Object.keys(fs)[0] || "index.html";
  if(!fs[first]) fs[first] = "<!doctype html><meta charset='utf-8'><title>Exemple</title><h1>Bonjour</h1>";
  openFile(first);

  document.getElementById("save").onclick = ()=>{ commit(); flash("Enregistré"); };
  document.getElementById("preview").onclick = ()=> preview(fs[current]||"");
  document.getElementById("ai-propose").onclick = generateAI;

  code.addEventListener("input", ()=>{
    clearTimeout(typingTimer);
    typingTimer = setTimeout(()=>{ commit(); preview(fs[current]||""); }, 250);
  });
}

function loadFSFallback(){
  try{ const raw = localStorage.getItem(KEY); return raw?JSON.parse(raw):{}; }
  catch{ return {}; }
}
function saveFS(obj){
  localStorage.setItem(KEY, JSON.stringify(obj));
}

function renderList(){
  list.innerHTML = "";
  Object.keys(fs).sort().forEach(name=>{
    const li = document.createElement("li");
    li.dataset.name = name;
    li.className = name===current ? "active":"";
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
  if(window.ai?.applyFiles) window.ai.applyFiles({[current]: code.value});
  else saveFS(fs);
}

function preview(html){
  const s = String(html||"");
  const isHTML = /^\s*<!doctype|^\s*<html|^\s*<head|^\s*<body/i.test(s);
  frame.srcdoc = isHTML
    ? s
    : `<!doctype html><meta charset="utf-8"><title>Aperçu</title>
       <pre style="margin:16px;font:13px ui-monospace,Consolas,Menlo,monospace;white-space:pre-wrap">${escapeHTML(s)}</pre>`;
  if(document.body.classList.contains("mobile")) setView("preview");
}

async function generateAI(){
  const q = promptInput.value.trim();
  if(!q){ flash("Décris d'abord"); return; }
  flash("Génération…");
  try{
    const res = await window.ai.generate(q);
    if(res && res.files){
      for(const [p,c] of Object.entries(res.files)) fs[p]=c;
      if(window.ai?.applyFiles) window.ai.applyFiles(res.files); else saveFS(fs);
      renderList();
      const htmlTarget = Object.keys(res.files).find(n=>/\.html?$/i.test(n)) || Object.keys(res.files)[0];
      if(htmlTarget) openFile(htmlTarget);
      flash("OK");
    }else{
      flash("Aucune sortie");
    }
  }catch(e){ console.error(e); flash("Erreur IA"); }
}

function sanitizeFS(){
  // Corrige un index.html pollué par du code app affiché en texte
  const suspect = ["document.getElementById(\"ai-propose\")","const KEY =","openFile(name)"];
  for(const [name,content] of Object.entries(fs)){
    if(!/\.html?$/i.test(name)) continue;
    const txt = String(content||"");
    const hasScript = /<script[\s>]/i.test(txt);
    if(suspect.some(s=>txt.includes(s)) && !hasScript){
      fs[name] = "<!doctype html><meta charset='utf-8'><title>Exemple</title><h1>Bonjour</h1>";
    }
  }
  if(window.ai?.applyFiles) window.ai.applyFiles(fs); else saveFS(fs);
}

function escapeHTML(s){return s.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function flash(t){ promptInput.value=""; promptInput.placeholder=t; setTimeout(()=>promptInput.placeholder="Décris ce que tu veux générer",1500); }

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
}
