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
    typingTimer=setTimeout(()=>{ commit(); preview(fs[current]||""); }, 250);
  });
}

function qs(s){ return document.querySelector(s); }
function ensureDefault(){ if(!Object.keys(fs).length) { fs["index.html"]="<!doctype html><meta charset='utf-8'><title>Exemple</title><h1>Bonjour</h1>"; saveFS(fs);} }
function saveFS(obj){ localStorage.setItem(KEY, JSON.stringify(obj)); }

function renderList(){
  list.innerHTML="";
  Object.keys(fs).sort().forEach(name=>{
    const li=document.createElement("li");
    li.dataset.name=name; li.className = name===current ? "active":"";
    li.textContent=name; li.onclick=()=>openFile(name);
    list.appendChild(li);
  });
}

function openFile(name){
  if(!fs[name]) return;
  current=name; code.value=fs[name]; renderList(); preview(fs[name]);
  if(document.body.classList.contains("mobile")) setView("editor");
}

function commit(){
  if(!current) return;
  fs[current]=code.value;
  window.ai?.applyFiles ? window.ai.applyFiles({[current]: code.value}) : saveFS(fs);
}

function preview(html){
  const s=String(html||"");
  const isHTML=/^\s*<!doctype|^\s*<html|^\s*<head|^\s*<body/i.test(s);
  frame.srcdoc = isHTML ? s : "<!doctype html><meta charset='utf-8'><title>Aperçu</title><pre style='margin:16px;font:13px ui-monospace,Consolas,Menlo,monospace;white-space:pre-wrap'>"+escapeHTML(s)+"</pre>";
  if(document.body.classList.contains("mobile")) setView("preview");
}

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
  fs = window.ai.loadFS();
  renderList();
  const target = keys.find(n=>/\.html?$/i.test(n)) || keys[0];
  if (target) openFile(target);
  flash("OK");
}

function escapeHTML(s){return s.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function flash(t){ promptInput.value=""; promptInput.placeholder=t; setTimeout(()=>promptInput.placeholder="Décris ce que tu veux générer",1500); }

function applyMobile(){
  const mobile=matchMedia("(max-width:900px)").matches;
  if(mobile){
    document.body.classList.add("mobile");
    tabsBar.style.display="flex";
    tabsBar.querySelectorAll("button").forEach(b=>b.onclick=()=>{
      tabsBar.querySelectorAll("button").forEach(x=>x.classList.remove("active"));
      b.classList.add("active"); setView(b.dataset.v);
    });
  }else{
    document.body.classList.remove("mobile");
    tabsBar.style.display="none"; setView("files");
  }
}
function setView(v){
  document.body.className = document.body.className.replace(/view-\w+/,"").trim();
  document.body.classList.add("view-"+v);
}
