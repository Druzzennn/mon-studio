const KEY = "studio.fs.v1";

const list = document.getElementById("list");
const code = document.getElementById("code");
const frame = document.getElementById("frame");
const promptInput = document.getElementById("prompt");
const tabsBar = document.querySelector(".tabs");

let fs = window.ai?.loadFS ? window.ai.loadFS() : {};
let current = null;
let typingTimer = null;

boot();

function boot(){
  applyMobile();
  ensureDefault();
  renderList();
  openFile(Object.keys(fs)[0]);

  q("#save").onclick    = ()=>{ commit(); flash("Enregistré"); };
  q("#preview").onclick = ()=> preview(fs[current]||"");
  q("#ai-propose").onclick = onGenerate;

  code.addEventListener("input", ()=>{
    clearTimeout(typingTimer);
    typingTimer = setTimeout(()=>{ commit(); preview(fs[current]||""); }, 200);
  });

  // auto-grow pour la zone IA (PC + mobile)
  autoGrowPrompt();
  promptInput.addEventListener("input", autoGrowPrompt);
}

function q(s){ return document.querySelector(s); }
function isMobile(){ return matchMedia("(max-width:900px)").matches; }

function ensureDefault(){
  if (!Object.keys(fs).length) fs["index.html"] = "<!doctype html><meta charset='utf-8'><title>Exemple</title><h1>Bonjour</h1>";
  saveFS(fs);
}
function saveFS(obj){ localStorage.setItem(KEY, JSON.stringify(obj)); }

function renderList(){
  list.innerHTML = "";
  Object.keys(fs).sort().forEach(name=>{
    const li=document.createElement("li");
    li.dataset.name=name;
    li.className = name===current ? "active":"";
    li.textContent = name;
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
  if (isMobile()) setView("preview"); // on reste centré sur l’aperçu par défaut
}

function commit(){
  if(!current) return;
  fs[current] = code.value;
  window.ai?.applyFiles ? window.ai.applyFiles({[current]: code.value}) : saveFS(fs);
}

/* ---------- Preview intelligente ---------- */
function isFullDocument(s){ return /^\s*<!doctype|^\s*<html|^\s*<head|^\s*<body/i.test(s); }
function looksLikeHtmlFragment(s){ return /<([a-zA-Z][\w:-]*)(\s[^>]*)?>/m.test(s); }
function wrapAsDocument(inner){
  return "<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width, initial-scale=1'>"
       + "<title>Aperçu</title><style>body{margin:16px;font:14px system-ui;color:#e5e7eb;background:#0b1324}</style></head><body>"
       + inner + "</body></html>";
}
function preview(html){
  const s = String(html || "");
  let doc;
  if (isFullDocument(s)) doc = s;
  else if (looksLikeHtmlFragment(s)) doc = wrapAsDocument(s);
  else doc = wrapAsDocument("<pre style='margin:16px;font:13px ui-monospace,Consolas,Menlo,monospace;white-space:pre-wrap'>"+escapeHTML(s)+"</pre>");
  frame.srcdoc = doc;
  if (isMobile()) setView("preview");
}

/* ---------- IA ---------- */
async function onGenerate(){
  const qy = (promptInput.value || "").trim();
  if(!qy){ flash("Décris d'abord"); return; }
  flash("IA…");
  const res = await window.ai.generate(qy);
  // vider le champ quelle que soit l'issue
  promptInput.value = "";
  autoGrowPrompt();

  const files = res?.files || {};
  const keys = Object.keys(files);
  if (!keys.length){
    flash(res?.error ? ("Erreur IA: "+res.error) : "Aucune sortie IA");
    return;
  }
  fs = window.ai.loadFS();
  renderList();
  const target = keys.find(n=>/\.html?$/i.test(n)) || keys[0];
  if (target) openFile(target);
  setView("preview");
  preview(fs[target] || fs[current] || "");
  flash("OK");
}

/* ---------- Tabs / Mobile ---------- */
function applyMobile(){
  if (isMobile()){
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
    setView("preview"); // PC: toujours l'aperçu par défaut
  }
}
function setView(v){
  document.body.className = document.body.className.replace(/view-\w+/g,"").trim();
  document.body.classList.add("view-"+v);
  if (tabsBar.style.display !== "none"){
    tabsBar.querySelectorAll("button").forEach(x=>x.classList.toggle("active", x.dataset.v===v));
  }
}

/* ---------- Utils ---------- */
function autoGrowPrompt(){
  // reset -> fit content
  promptInput.style.height = "auto";
  const min = isMobile() ? 84 : 64;
  const h = Math.min(Math.max(promptInput.scrollHeight, min), 180);
  promptInput.style.height = h + "px";
}
function escapeHTML(s){return s.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function flash(t){ promptInput.placeholder=t; setTimeout(()=>promptInput.placeholder="Décris ce que tu veux générer ou modifier",1500); }
