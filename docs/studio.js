const FS_KEY   = "studio.fs.v1";
const CHAT_KEY = "studio.chat.v1";

/* ===== Refs ===== */
const framePC     = document.getElementById("frame");
const leftPane    = document.getElementById("left");
const gutter      = document.getElementById("gutter");

const tabChat     = document.getElementById("tab-chat");
const tabCode     = document.getElementById("tab-code");
const codePanel   = document.getElementById("code-panel");
const chatPanel   = document.getElementById("chat-panel");

const listEl      = document.getElementById("list");
const codeEl      = document.getElementById("code");

const chatLog     = document.getElementById("chat-log");
const chatInput   = document.getElementById("chat-input");
const chatSend    = document.getElementById("chat-send");

const saveBtn     = document.getElementById("save");
const previewBtn  = document.getElementById("preview-btn");

/* Mobile tabs */
const mTabPreview = document.getElementById("m-tab-preview");
const mTabCode    = document.getElementById("m-tab-code");
const mTabChat    = document.getElementById("m-tab-chat");

let fs   = window.ai?.loadFS ? window.ai.loadFS() : {};
let chat = loadChat();
let current = null;
let previewTarget = null; // toujours prévisualiser un HTML (index.html par défaut)
let typingTimer = null;

/* ===== Init ===== */
init();

function init(){
  ensureDefaultFS();
  restoreLeftWidth();
  renderFiles();
  openFirst();
  renderChat();

  /* Tabs PC */
  tabChat.addEventListener("click", ()=>selectLeft("chat"));
  tabCode.addEventListener("click", ()=>selectLeft("code"));

  /* Tabs Mobile (vue exclusive) */
  mTabPreview.addEventListener("click", ()=>selectMobile("preview"));
  mTabCode.addEventListener("click", ()=>{ selectLeft("code"); selectMobile("code"); });
  mTabChat.addEventListener("click", ()=>{ selectLeft("chat"); selectMobile("chat"); });

  /* Chat */
  chatSend.addEventListener("click", sendChat);
  chatInput.addEventListener("keydown", e=>{
    if (e.key==="Enter" && !e.shiftKey){ e.preventDefault(); sendChat(); }
  });
  chatInput.addEventListener("input", autoGrowChat);
  autoGrowChat();

  /* Code editing */
  codeEl.addEventListener("input", ()=>{
    clearTimeout(typingTimer);
    typingTimer = setTimeout(()=>{ commit(); refreshPreview(); }, 150);
  });

  /* Save/Preview */
  saveBtn.addEventListener("click", ()=> commit());
  previewBtn.addEventListener("click", ()=> refreshPreview(true));

  /* Gutter (drag robuste) */
  setupGutter();

  /* États init */
  selectLeft("chat");         // PC : onglet Chat par défaut
  selectMobile("preview");    // Mobile : Aperçu par défaut
}

/* ===== FS / Files ===== */
function ensureDefaultFS(){
  if (!Object.keys(fs).length) {
    fs["index.html"] = "<!doctype html><meta charset='utf-8'><title>Exemple</title><h1>Bonjour</h1>";
    saveFS(fs);
  }
}
function saveFS(obj){ localStorage.setItem(FS_KEY, JSON.stringify(obj)); }
function renderFiles(){
  listEl.innerHTML = "";
  Object.keys(fs).sort().forEach(name=>{
    const li = document.createElement("li");
    li.dataset.name = name;
    li.className = name===current ? "active":"";
    li.textContent = name;
    li.addEventListener("click", ()=> openFile(name));
    listEl.appendChild(li);
  });
}
function openFirst(){
  const first = Object.keys(fs)[0];
  if (first) openFile(first);
}
function openFile(name){
  if(!fs[name]) return;
  current = name;
  codeEl.value = fs[name];
  renderFiles();
  // si c'est un HTML, on bascule la cible de preview sur ce fichier
  if (/\.html?$/i.test(name)) previewTarget = name;
  refreshPreview();
}
function commit(){
  if(!current) return;
  fs[current] = codeEl.value;
  if (window.ai?.applyFiles) window.ai.applyFiles({[current]: codeEl.value});
  else saveFS(fs);
}

/* ===== Preview ===== */
function isFullDoc(s){ return /^\s*<!doctype|^\s*<html|^\s*<head|^\s*<body/i.test(s); }
function looksLikeFragment(s){ return /<([a-zA-Z][\w:-]*)(\s[^>]*)?>/m.test(s); }
function wrapDoc(inner){
  return "<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width, initial-scale=1'>"+
         "<title>Aperçu</title><style>body{margin:16px;font:14px system-ui;color:#e5e7eb;background:#0b1324}</style></head><body>"+
         inner+"</body></html>";
}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function resolvePreviewTarget(){
  // 1) si une cible HTML a été vue récemment
  if (previewTarget && fs[previewTarget]) return previewTarget;
  // 2) index.html si dispo
  if (fs["index.html"]) return "index.html";
  // 3) premier .html
  const h = Object.keys(fs).find(n=>/\.html?$/i.test(n));
  if (h) return h;
  // 4) sinon, le fichier courant
  return current;
}
function makeDocForContent(s){
  const t = String(s||"");
  if (isFullDoc(t)) return t;
  if (looksLikeFragment(t)) return wrapDoc(t);
  return wrapDoc("<pre style='margin:16px;font:13px ui-monospace,Consolas,Menlo,monospace;white-space:pre-wrap'>"+esc(t)+"</pre>");
}
function refreshPreview(force=false){
  const target = resolvePreviewTarget();
  const content = fs[target] || "<!doctype html><title>Vide</title>";
  const doc = makeDocForContent(content);
  framePC.srcdoc = doc;
  if (force) framePC.focus();
}

/* ===== Chat ===== */
function loadChat(){ try{ const raw = localStorage.getItem(CHAT_KEY); return raw?JSON.parse(raw):[]; } catch{ return []; } }
function saveChat(){ localStorage.setItem(CHAT_KEY, JSON.stringify(chat)); }
function addMsg(role, text){ chat.push({ role, text, ts: Date.now() }); saveChat(); }
function renderChat(){
  chatLog.innerHTML = "";
  for(const m of chat){
    const n = document.createElement("div");
    n.className = "msg " + (m.role==="user"?"user":"bot");
    n.textContent = m.text;
    chatLog.appendChild(n);
  }
  chatLog.scrollTop = chatLog.scrollHeight;
}
function buildPromptFromChat(){
  const names = Object.keys(fs).join(", ");
  let convo =
`Contexte projet. Fichiers existants: ${names}.
Réponds en JSON strict {"files":{"path":"content"}, "reply":"texte court"} quand tu modifies/ajoutes des fichiers.
Les fragments HTML sont acceptés pour le contenu. "reply" doit être un texte lisible, sans code, qui explique ce que tu as fait.

Conversation:
`;
  for(const m of chat.slice(-12)){
    convo += (m.role==="user" ? "User: " : "Assistant: ") + m.text + "\n";
  }
  return convo;
}
async function sendChat(){
  const text = chatInput.value.trim();
  if(!text) return;
  addMsg("user", text); renderChat();
  chatInput.value=""; autoGrowChat();
  lockChat(true);

  try{
    const prompt = buildPromptFromChat();
    const res = await window.ai.generate(prompt);

    // Afficher une vraie réponse si dispo
    const reply = res?.reply || res?.message || res?.text || res?.raw || null;

    const files = res?.files || {};
    const keys = Object.keys(files);

    if (keys.length){
      // Recharger FS (ai.js a déjà mergé), viser un HTML pour la preview
      fs = window.ai.loadFS();
      renderFiles();
      const target = keys.find(n=>/\.html?$/i.test(n)) || keys[0];
      if (target) { previewTarget = /\.html?$/i.test(target) ? target : previewTarget; openFile(target); }
    } else {
      // Pas de fichiers renvoyés : garder la preview courante
      refreshPreview();
    }

    addMsg("assistant", reply ? String(reply) : (keys.length ? `OK • ${keys.length} fichier(s) mis à jour` : `Aucune modification`));
    renderChat();
  } catch(e){
    addMsg("assistant", "Erreur: " + String(e));
    renderChat();
  } finally {
    lockChat(false);
  }
}
function autoGrowChat(){
  chatInput.style.height="auto";
  chatInput.style.height=Math.min(Math.max(chatInput.scrollHeight,64),180)+"px";
}
function lockChat(b){
  chatSend.disabled = b;
  chatSend.textContent = b ? "IA…" : "Envoyer";
}

/* ===== Tabs / Layout ===== */
function selectLeft(which){
  const isChat = which==="chat";
  tabChat.classList.toggle("active", isChat);
  tabCode.classList.toggle("active", !isChat);
  chatPanel.classList.toggle("active", isChat);
  codePanel.classList.toggle("active", !isChat);
}
function selectMobile(which){
  document.body.classList.remove("m-preview","m-code","m-chat");
  if (which==="preview"){
    document.body.classList.add("m-preview");
    mTabPreview.classList.add("active"); mTabCode.classList.remove("active"); mTabChat.classList.remove("active");
  } else if (which==="code"){
    document.body.classList.add("m-code");
    mTabCode.classList.add("active"); mTabPreview.classList.remove("active"); mTabChat.classList.remove("active");
  } else {
    document.body.classList.add("m-chat");
    mTabChat.classList.add("active"); mTabPreview.classList.remove("active"); mTabCode.classList.remove("active");
  }
}

/* ===== Gutter (drag résilient, 20–80%, arrêt net au relâchement) ===== */
function setupGutter(){
  let dragging=false, pointerId=null, startX=0, startW=0;

  const onMove = (e)=>{
    if(!dragging) return;
    const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX);
    if (clientX==null) return;
    const dx = clientX - startX;
    const min = Math.max(320, window.innerWidth * 0.20);
    const max = Math.max(320, window.innerWidth * 0.80);
    const newW = Math.min(max, Math.max(min, startW + dx));
    document.documentElement.style.setProperty("--leftw", newW+"px");
  };
  const endDrag = ()=>{
    if(!dragging) return;
    dragging=false;
    if (pointerId!=null) { try{ gutter.releasePointerCapture(pointerId); }catch{} pointerId=null; }
    document.body.style.userSelect="";
    persistLeftWidth();
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
    window.removeEventListener("mouseleave", endDrag);
  };

  gutter.addEventListener("pointerdown", (e)=>{
    dragging=true; pointerId=e.pointerId;
    startX=e.clientX; startW=leftPane.getBoundingClientRect().width;
    try{ gutter.setPointerCapture(pointerId); }catch{}
    document.body.style.userSelect="none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    window.addEventListener("mouseleave", endDrag);
  });
}

function persistLeftWidth(){
  const cs = getComputedStyle(document.documentElement);
  const w = cs.getPropertyValue("--leftw").trim();
  localStorage.setItem("studio.leftw", w);
}
function restoreLeftWidth(){
  const w = localStorage.getItem("studio.leftw");
  if (w) document.documentElement.style.setProperty("--leftw", w);
}

/* ===== Helpers ===== */
function loadChat(){ try{ const raw=localStorage.getItem(CHAT_KEY); return raw?JSON.parse(raw):[]; } catch{ return []; } }
