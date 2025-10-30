const FS_KEY   = "studio.fs.v1";
const CHAT_KEY = "studio.chat.v1";

/* ---- Refs PC ---- */
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
const previewBtn  = document.getElementById("preview");

/* ---- Refs Mobile ---- */
const mTabPreview = document.getElementById("m-tab-preview");
const mTabCode    = document.getElementById("m-tab-code");
const mTabChat    = document.getElementById("m-tab-chat");
const mPreview    = document.getElementById("m-preview");
const mPreviewIF  = mPreview?.querySelector("iframe");
const mCode       = document.getElementById("m-code");
const mChat       = document.getElementById("m-chat");

let fs   = window.ai?.loadFS ? window.ai.loadFS() : {};
let chat = loadChat();
let current = null;
let typingTimer = null;

init();

/* ================= INIT ================= */
function init(){
  ensureDefaultFS();
  renderFiles();
  openFirst();
  renderChat();

  /* Tabs PC */
  tabChat.onclick = ()=>selectLeft("chat");
  tabCode.onclick = ()=>selectLeft("code");

  /* Tabs Mobile */
  mTabPreview.onclick = ()=>selectMobile("preview");
  mTabCode.onclick    = ()=>selectMobile("code");
  mTabChat.onclick    = ()=>selectMobile("chat");

  /* Chat */
  chatSend.onclick = sendChat;
  chatInput.addEventListener("keydown", e=>{
    if (e.key==="Enter" && !e.shiftKey){ e.preventDefault(); sendChat(); }
  });
  chatInput.addEventListener("input", autoGrowChat);
  autoGrowChat();

  /* Code editing */
  codeEl.addEventListener("input", ()=>{
    clearTimeout(typingTimer);
    typingTimer = setTimeout(()=>{ commit(); refreshPreview(); }, 180);
  });

  /* Save/Preview */
  saveBtn.onclick    = ()=> commit();
  previewBtn.onclick = ()=> refreshPreview();

  /* Gutter drag (PC) */
  setupGutter();

  /* Départ: PC => left=chat ; Mobile => vue=preview */
  selectLeft("chat");
  if (isMobile()) selectMobile("preview");
}

/* ================= FS / FILES ================= */
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
    const li=document.createElement("li");
    li.dataset.name=name;
    li.className = name===current ? "active":"";
    li.textContent = name;
    li.onclick = ()=> openFile(name);
    listEl.appendChild(li);
  });
}
function openFirst(){ const first = Object.keys(fs)[0]; if (first) openFile(first); }
function openFile(name){
  if(!fs[name]) return;
  current = name;
  codeEl.value = fs[name];
  renderFiles();
  refreshPreview();
}
function commit(){
  if(!current) return;
  fs[current] = codeEl.value;
  if (window.ai?.applyFiles) window.ai.applyFiles({[current]: codeEl.value});
  else saveFS(fs);
}

/* ================= PREVIEW ================= */
function isFullDoc(s){ return /^\s*<!doctype|^\s*<html|^\s*<head|^\s*<body/i.test(s); }
function looksLikeFragment(s){ return /<([a-zA-Z][\w:-]*)(\s[^>]*)?>/m.test(s); }
function wrapDoc(inner){
  return "<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width, initial-scale=1'>"+
         "<title>Aperçu</title><style>body{margin:16px;font:14px system-ui;color:#e5e7eb;background:#0b1324}</style></head><body>"+
         inner+"</body></html>";
}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function makeDoc(s){
  const t = String(s||"");
  if (isFullDoc(t)) return t;
  if (looksLikeFragment(t)) return wrapDoc(t);
  return wrapDoc("<pre style='margin:16px;font:13px ui-monospace,Consolas,Menlo,monospace;white-space:pre-wrap'>"+esc(t)+"</pre>");
}
function refreshPreview(){
  const html = current ? fs[current] : "<!doctype html><title>Vide</title>";
  const doc = makeDoc(html);
  framePC.srcdoc = doc;
  if (mPreviewIF) mPreviewIF.srcdoc = doc; // mobile
}

/* ================= CHAT ================= */
function loadChat(){ try{ const raw=localStorage.getItem(CHAT_KEY); return raw?JSON.parse(raw):[]; }catch{ return []; } }
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
  let convo = `Contexte projet. Fichiers existants: ${names}.
Réponds en JSON strict {"files":{"path":"content"}} quand tu modifies/ajoutes des fichiers. Fragments HTML acceptés.

Conversation:\n`;
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
    if (res?.error){
      addMsg("assistant", "Erreur IA: " + res.error);
      renderChat();
      return;
    }
    const files = res?.files || {};
    const keys = Object.keys(files);
    if (keys.length){
      fs = window.ai.loadFS();
      renderFiles();
      // ouvre le premier HTML ou le 1er fichier
      const target = keys.find(n=>/\.html?$/i.test(n)) || keys[0];
      if (target) openFile(target);
      addMsg("assistant", `OK • ${keys.length} fichier(s) mis à jour`);
      renderChat();
    } else {
      addMsg("assistant", "Pas de fichiers renvoyés.");
      renderChat();
    }
  }catch(e){
    addMsg("assistant", "Erreur: " + String(e));
    renderChat();
  }finally{
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

/* ================= TABS / LAYOUT ================= */
function selectLeft(which){
  if (which==="chat"){
    tabChat.classList.add("active"); tabCode.classList.remove("active");
    chatPanel.classList.add("active"); codePanel.classList.remove("active");
  } else {
    tabCode.classList.add("active"); tabChat.classList.remove("active");
    codePanel.classList.add("active"); chatPanel.classList.remove("active");
  }
}
function selectMobile(which){
  document.body.classList.remove("m-view-preview","m-view-code","m-view-chat");
  if (which==="preview"){
    document.body.classList.add("m-view-preview");
    mTabPreview.classList.add("active"); mTabCode.classList.remove("active"); mTabChat.classList.remove("active");
  } else if (which==="code"){
    document.body.classList.add("m-view-code");
    mTabCode.classList.add("active"); mTabPreview.classList.remove("active"); mTabChat.classList.remove("active");
  } else {
    document.body.classList.add("m-view-chat");
    mTabChat.classList.add("active"); mTabPreview.classList.remove("active"); mTabCode.classList.remove("active");
  }
}

/* ================= GUTTER (drag) ================= */
function setupGutter(){
  let dragging=false, startX=0, startW=0;
  gutter.addEventListener("mousedown", e=>{
    dragging=true; startX=e.clientX; startW=leftPane.getBoundingClientRect().width;
    document.body.style.userSelect="none";
  });
  window.addEventListener("mousemove", e=>{
    if(!dragging) return;
    const dx = e.clientX - startX;
    const newW = Math.max(window.innerWidth*0.2, Math.min(window.innerWidth*0.8, startW + dx));
    document.documentElement.style.setProperty("--leftw", newW+"px");
  });
  window.addEventListener("mouseup", ()=>{
    if(!dragging) return;
    dragging=false; document.body.style.userSelect="";
  });
}

/* ================= HELPERS ================= */
function isMobile(){ return matchMedia("(max-width:900px)").matches; }
