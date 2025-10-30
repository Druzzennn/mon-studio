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

  qs("#save").onclick = ()=>{ commit(); flash("Enregistré"); };
  qs("#preview").onclick = ()=> preview(fs[current]||"");
  qs("#ai-propose").onclick = onGenerate;

  code.addEventListener("input", ()=>{
    clearTimeout(typingTimer);
    typingTimer = setTimeout(()=>{ commit(); preview(fs[current]||""); }, 250);
  });
}

function qs(s){ return document.querySelector(s); }
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
  if(document.body.classList.contains("mobile")) setView("editor");
}

function commit(){
  if(!current) return;
  fs[current] = code.value;
  window.ai?.applyFiles ? window.ai.applyFiles({[current]: code.value}) : saveFS(fs);
}

/* ---------- Preview intelligente ---------- */
function isFullDocument(s){
  return /^\s*<!doctype|^\s*<html|^\s*<head|^\s*<body/i.test(s);
}
function looksLikeHtmlFragment(s){
  // contient au moins une balise HTML
  return /<([a-zA-Z][\w:-]*)(\s[^>]*)?>/m.test(s);
}
function wrapAsDocument(inner){
  return (
    "<!doctype html><html><head><meta charset='utf-8'>" +
    "<meta name='viewport' content='width=device-width, initial-scale=1'>" +
    "<title>Aperçu</title>" +
    "<style>body{margin:16px;font:14px system-ui;color:#e5e7eb;background:#0b1324}</style>" +
    "</head><body>" + inner + "</body></html>"
  );
}
function preview(html){
  const s = String(html || "");
  let doc;
  if (isFullDocument(s)) {
    doc = s;
  } else if (looksLikeHtmlFragment(s)) {
    // cas PC: fragment tel que <div ...> → on l'enveloppe
    doc = wrapAsDocument(s);
  } else {
    // simple texte → on montre lisiblement
    const pre = "<pre style='margin:16px;font:13px ui-monospace,Consolas,Menlo,monospace;white-space:pre-wrap'>"
              + escapeHTML(s) + "</pre>";
    doc = wrapAsDocument(pre);
  }
  frame.srcdoc = doc;
  if (document.body.classList.contains("mobile")) setView("preview");
}

/* ---------- IA ---------- */
async function onGenerate(){
  const q = promptInput.value.trim();
  if(!q){ flash("Décris d'abord"); return; }
  flash("IA…");
  const res = await window.ai.generate(q);
  const files = res?.files || {};
  const keys = Object.keys(files);
  if (!keys.length){
    flash(res?.error ? ("Erreur IA: "+res.error) : "Aucune sortie IA");
    return;
  }
  // Recharger le FS et ouvrir le 1er HTML ou le 1er fichier
  fs = window.ai.loadFS();
  renderList();
  const target = keys.find(n=>/\.html?$/i.test(n)) || keys[0];
  if (target) openFile(target);
  // Forcer l'aperçu sur mobile (ceinture + bretelles)
  setView("preview");
  preview(fs[target] || fs[current] || "");
  flash("OK");
}

/* ---------- Utils ---------- */
function escapeHTML(s){return s.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}

function flash(t){
  promptInput.value="";
  promptInput.placeholder=t;
  setTimeout(()=>promptInput.placeholder="Décris ce que tu veux générer",1500);
}

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
}
