const FS_KEY   = "studio.fs.v1";
const CHAT_KEY = "studio.chat.v1";

/* ===== Refs ===== */
const framePC = document.getElementById("frame");
const left    = document.getElementById("left");
const gutter  = document.getElementById("gutter");

let fs   = window.ai?.loadFS ? window.ai.loadFS() : {};
let chat = loadChat();
let current = null;
let previewTarget = null;
let typingTimer = null;

/* ==== BOOT ==== */
boot();

function boot(){
  setMobileClass(); window.addEventListener("resize", setMobileClass, {passive:true});

  ensureDefaultFS();
  restoreLeftWidth();
  renderFiles();
  openFirst();
  renderChat();
  refreshPreview();

  wireEvents();
  selectLeft("chat");
  if (isMobile()) selectMobile("preview");
}

/* ==== Mobile/PC detect ==== */
function isMobile(){
  return window.matchMedia("(max-width: 1024px)").matches || (navigator.maxTouchPoints|0) > 0;
}
function setMobileClass(){
  document.body.classList.toggle("is-mobile", isMobile());
}

/* ==== Event wiring (avec DELEGATION robuste) ==== */
function wireEvents(){
  // Boutons globaux
  document.addEventListener("click", (e)=>{
    const t = e.target;

    // PC tabs
    if (t.closest && t.closest("#tab-chat")) { e.preventDefault(); selectLeft("chat"); return; }
    if (t.closest && t.closest("#tab-code")) { e.preventDefault(); selectLeft("code"); return; }

    // Mobile tabs
    if (t.closest && t.closest("#m-tab-preview")) { e.preventDefault(); selectMobile("preview"); return; }
    if (t.closest && t.closest("#m-tab-code"))    { e.preventDefault(); selectLeft("code"); selectMobile("code"); return; }
    if (t.closest && t.closest("#m-tab-chat"))    { e.preventDefault(); selectLeft("chat"); selectMobile("chat"); return; }

    // Save / Preview
    if (t.closest && t.closest("#save"))        { e.preventDefault(); commit(); return; }
    if (t.closest && t.closest("#preview-btn")) { e.preventDefault(); refreshPreview(true); return; }

    // Fichiers
    const li = t.closest && t.closest("#list li");
    if (li && li.dataset && li.dataset.name){ e.preventDefault(); openFile(li.dataset.name); return; }

    // Chat send
    if (t.closest && t.closest("#chat-send")){ e.preventDefault(); sendChat(); return; }
  });

  // Chat input
  const chatInput = document.getElementById("chat-input");
  chatInput.addEventListener("keydown", (e)=>{
    if (e.key==="Enter" && !e.shiftKey){ e.preventDefault(); sendChat(); }
  });
  chatInput.addEventListener("input", autoGrowChat);
  autoGrowChat();

  // Code input
  const codeEl = document.getElementById("code");
  codeEl.addEventListener("input", ()=>{
    clearTimeout(typingTimer);
    typingTimer = setTimeout(()=>{ commit(); refreshPreview(); }, 120);
  });

  // Gutter (drag)
  setupGutter();
}

/* ==== FS ==== */
function ensureDefaultFS(){
  if (!Object.keys(fs).length){
    fs["index.html"] = "<!doctype html><meta charset='utf-8'><title>Exemple</title><h1>Bonjour</h1>";
    saveFS(fs);
  }
}
function saveFS(obj){ localStorage.setItem(FS_KEY, JSON.stringify(obj)); }
function renderFiles(){
  const listEl = document.getElementById("list");
  listEl.innerHTML = "";
  Object.keys(fs).sort().forEach(name=>{
    const li=document.createElement("li");
    li.dataset.name=name;
    li.className = name===current ? "active":"";
    li.textContent = name;
    listEl.appendChild(li);
  });
}
function openFirst(){ const first = Object.keys(fs)[0]; if (first) openFile(first); }
function openFile(name){
  if(!fs[name]) return;
  current = name;
  document.getElementById("code").value = fs[name];
  renderFiles();
  if (/\.html?$/i.test(name)) previewTarget = name;
  refreshPreview();
}
function commit(){
  if(!current) return;
  const codeEl = document.getElementById("code");
  fs[current] = codeEl.value;
  if (window.ai?.applyFiles) window.ai.applyFiles({[current]: codeEl.value});
  else saveFS(fs);
}

/* ==== Preview ==== */
function isFullDoc(s){ return /^\s*<!doctype|^\s*<html|^\s*<head|^\s*<body/i.test(s); }
function looksLikeFragment(s){ return /<([a-zA-Z][\w:-]*)(\s[^>]*)?>/m.test(s); }
function wrapDoc(inner){
  return "<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width, initial-scale=1'>"+
         "<title>Aperçu</title><style>body{margin:16px;font:14px system-ui;color:#e5e7eb;background:#0b1324}</style></head><body>"+
         inner+"</body></html>";
}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function resolvePreviewTarget(){
  if (previewTarget && fs[previewTarget]) return previewTarget;
  if (fs["index.html"]) return "index.html";
  const h = Object.keys(fs).find(n=>/\.html?$/i.test(n));
  return h || current;
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

/* ==== Chat ==== */
function loadChat(){ try{ const raw=localStorage.getItem(CHAT_KEY); return raw?JSON.parse(raw):[]; } catch{ return []; } }
function saveChat(){ localStorage.setItem(CHAT_KEY, JSON.stringify(chat)); }
function addMsg(role, text){ chat.push({ role, text, ts: Date.now() }); saveChat(); }
function renderChat(){
  const log = document.getElementById("chat-log");
  log.innerHTML = "";
  for(const m of chat){
    const n = document.createElement("div");
    n.className = "msg " + (m.role==="user"?"user":"bot");
    n.textContent = m.text;
    log.appendChild(n);
  }
  log.scrollTop = log.scrollHeight;
}
function buildPromptFromChat(){
  const names = Object.keys(fs).join(", ");
  let convo =
`Contexte projet. Fichiers existants: ${names}.
Réponds en JSON strict {"files":{"path":"content"}, "reply":"bref résumé clair de ce que tu as fait et pourquoi"} quand tu modifies/ajoutes des fichiers.
Fragments HTML acceptés. Pas de \`\`\`, pas de texte hors JSON.

Conversation:
`;
  for(const m of chat.slice(-12)){
    convo += (m.role==="user" ? "User: " : "Assistant: ") + m.text + "\n";
  }
  return convo;
}
async function sendChat(){
  const input = document.getElementById("chat-input");
  const text = input.value.trim();
  if(!text) return;
  addMsg("user", text); renderChat();
  input.value=""; autoGrowChat();
  lockChat(true);

  try{
    const prompt = buildPromptFromChat();
    const res = await window.ai.generate(prompt);
    const files = res?.files || {};
    const keys  = Object.keys(files);
    if (keys.length){
      fs = window.ai.loadFS();
      renderFiles();
      const target = keys.find(n=>/\.html?$/i.test(n)) || keys[0];
      if (target) { if (/\.html?$/i.test(target)) previewTarget=target; openFile(target); }
    } else {
      refreshPreview();
    }
    const reply = res?.reply ? String(res.reply) : (keys.length ? `Modifs: ${keys.join(", ")}` : `Aucune modification`);
    addMsg("assistant", reply); renderChat();
  } catch(e){
    addMsg("assistant", "Erreur: " + String(e)); renderChat();
  } finally {
    lockChat(false);
  }
}
function autoGrowChat(){
  const input = document.getElementById("chat-input");
  input.style.height="auto";
  input.style.height=Math.min(Math.max(input.scrollHeight,64),180)+"px";
}
function lockChat(b){
  const btn = document.getElementById("chat-send");
  btn.disabled = b;
  btn.textContent = b ? "IA…" : "Envoyer";
}

/* ==== Tabs / Layout ==== */
function selectLeft(which){
  const chatBtn = document.getElementById("tab-chat");
  const codeBtn = document.getElementById("tab-code");
  const chatP   = document.getElementById("chat-panel");
  const codeP   = document.getElementById("code-panel");
  const isChat  = which==="chat";
  chatBtn.classList.toggle("active", isChat);
  codeBtn.classList.toggle("active", !isChat);
  chatP.classList.toggle("active", isChat);
  codeP.classList.toggle("active", !isChat);
}
function selectMobile(which){
  if (!document.body.classList.contains("is-mobile")) return; // pas en mode mobile
  document.body.classList.remove("v-preview","v-code","v-chat");
  if (which==="preview"){
    document.body.classList.add("v-preview");
    document.getElementById("m-tab-preview").classList.add("active");
    document.getElementById("m-tab-code").classList.remove("active");
    document.getElementById("m-tab-chat").classList.remove("active");
  } else if (which==="code"){
    document.body.classList.add("v-code");
    document.getElementById("m-tab-code").classList.add("active");
    document.getElementById("m-tab-preview").classList.remove("active");
    document.getElementById("m-tab-chat").classList.remove("active");
    selectLeft("code");
  } else {
    document.body.classList.add("v-chat");
    document.getElementById("m-tab-chat").classList.add("active");
    document.getElementById("m-tab-preview").classList.remove("active");
    document.getElementById("m-tab-code").classList.remove("active");
    selectLeft("chat");
  }
}

/* ==== Gutter (drag borné, arrêt net) ==== */
function setupGutter(){
  let dragging=false, pid=null, startX=0, startW=0;

  const onMove = (e)=>{
    if(!dragging) return;
    const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX);
    if (clientX==null) return;
    const dx = clientX - startX;
    const minPx = 240;
    const maxPx = Math.max(360, window.innerWidth - 360);
    const newW = Math.min(maxPx, Math.max(minPx, startW + dx));
    document.documentElement.style.setProperty("--leftw", newW+"px");
  };
  const endDrag = ()=>{
    if(!dragging) return;
    dragging=false;
    if (pid!=null) { try{ gutter.releasePointerCapture(pid); }catch{} pid=null; }
    document.body.style.userSelect="";
    persistLeftWidth();
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
    window.removeEventListener("mouseleave", endDrag);
  };

  gutter.addEventListener("pointerdown", (e)=>{
    if (document.body.classList.contains("is-mobile")) return; // pas de slider en mobile
    dragging=true; pid=e.pointerId;
    startX=e.clientX; startW=left.getBoundingClientRect().width;
    try{ gutter.setPointerCapture(pid); }catch{}
    document.body.style.userSelect="none";
    window.addEventListener("pointermove", onMove, { passive:true });
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
