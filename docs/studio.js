const FS_KEY   = "studio.fs.v1";
const CHAT_KEY = "studio.chat.v1";

/* Refs */
const framePC   = document.getElementById("frame");
const leftPane  = document.getElementById("left");
const gutter    = document.getElementById("gutter");

const tabChat   = document.getElementById("tab-chat");
const tabCode   = document.getElementById("tab-code");
const chatPanel = document.getElementById("chat-panel");
const codePanel = document.getElementById("code-panel");

const listEl    = document.getElementById("list");
const codeEl    = document.getElementById("code");

const chatLog   = document.getElementById("chat-log");
const chatInput = document.getElementById("chat-input");
const chatSend  = document.getElementById("chat-send");

const saveBtn   = document.getElementById("save");
const previewBtn= document.getElementById("preview-btn");
const pvSelect  = document.getElementById("preview-select");

/* Mobile tabs */
const mTabPreview = document.getElementById("m-tab-preview");
const mTabCode    = document.getElementById("m-tab-code");
const mTabChat    = document.getElementById("m-tab-chat");

/* State */
let fs         = window.ai?.loadFS ? window.ai.loadFS() : {};
let chat       = loadChat();
let current    = null;
let typingTimer= null;

/* Prévisualisation: mode = "auto" | "file:<name>" | "fragment-current" */
let pvMode = localStorage.getItem("studio.pvMode") || "auto";
let pvFile = localStorage.getItem("studio.pvFile") || "";

/* Boot */
init();

function init(){
  ensureDefaultFS();
  restoreLeftWidth();
  renderFiles();
  openFirst();
  buildPreviewSelect();
  renderChat();
  refreshPreview();

  // Onglets PC
  tabChat.addEventListener("click", ()=>selectLeft("chat"));
  tabCode.addEventListener("click", ()=>selectLeft("code"));

  // Onglets Mobile (UNIQUE vue)
  mTabPreview.addEventListener("click", ()=>{ selectMobile("preview"); });
  mTabCode.addEventListener("click", ()=>{ selectLeft("code"); selectMobile("code"); });
  mTabChat.addEventListener("click", ()=>{ selectLeft("chat"); selectMobile("chat"); });

  // Chat
  chatSend.addEventListener("click", sendChat);
  chatInput.addEventListener("keydown", e=>{
    if (e.key==="Enter" && !e.shiftKey){ e.preventDefault(); sendChat(); }
  });
  chatInput.addEventListener("input", autoGrowChat);
  autoGrowChat();

  // Code editor
  codeEl.addEventListener("input", ()=>{
    clearTimeout(typingTimer);
    typingTimer = setTimeout(()=>{ commit(); refreshPreview(); }, 120);
  });

  // Save / Preview
  saveBtn.addEventListener("click", ()=>commit());
  previewBtn.addEventListener("click", ()=>refreshPreview(true));

  // Preview select
  pvSelect.addEventListener("change", onPreviewSelect);

  // Gutter
  setupGutter();

  // États init
  selectLeft("chat");
  selectMobile("preview");
}

/* Files */
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
    li.addEventListener("click", ()=>openFile(name));
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
  buildPreviewSelect(); // tenir à jour la liste des .html
}

/* Preview select */
function buildPreviewSelect(){
  const old = pvSelect.value;
  pvSelect.innerHTML = "";
  const optAuto = new Option("Auto (index.html)", "auto");
  pvSelect.add(optAuto);

  const htmls = Object.keys(fs).filter(n=>/\.html?$/i.test(n)).sort();
  for(const h of htmls){ pvSelect.add(new Option(h, "file:"+h)); }

  pvSelect.add(new Option("Fragment (fichier courant)", "fragment-current"));

  // Restaurer le choix si possible
  if (pvMode==="file:"+pvFile && !fs[pvFile]) pvMode="auto";
  pvSelect.value = (pvMode==="auto" || pvMode==="fragment-current" || pvMode.startsWith("file:")) ? pvMode : "auto";
}
function onPreviewSelect(){
  pvMode = pvSelect.value;
  if (pvMode.startsWith("file:")) pvFile = pvMode.slice(5);
  localStorage.setItem("studio.pvMode", pvMode);
  localStorage.setItem("studio.pvFile", pvFile);
  refreshPreview(true);
}

/* Preview rendering */
function isFullDoc(s){ return /^\s*<!doctype|^\s*<html|^\s*<head|^\s*<body/i.test(s); }
function looksLikeFragment(s){ return /<([a-zA-Z][\w:-]*)(\s[^>]*)?>/m.test(s); }
function wrapDoc(inner){
  return "<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width, initial-scale=1'>"+
         "<title>Aperçu</title><style>body{margin:16px;font:14px system-ui;color:#e5e7eb;background:#0b1324}</style></head><body>"+
         inner+"</body></html>";
}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}

function resolvePreviewTarget(){
  if (pvMode==="fragment-current") return { mode:"fragment", name: current };
  if (pvMode.startsWith("file:"))  return { mode:"file", name: pvFile };
  // auto
  if (fs["index.html"]) return { mode:"file", name:"index.html" };
  const h = Object.keys(fs).find(n=>/\.html?$/i.test(n));
  if (h) return { mode:"file", name:h };
  return { mode:"fragment", name: current };
}
function makeDoc(s){
  const t=String(s||"");
  if (isFullDoc(t)) return t;
  if (looksLikeFragment(t)) return wrapDoc(t);
  return wrapDoc("<pre style='margin:16px;font:13px ui-monospace,Consolas,Menlo,monospace;white-space:pre-wrap'>"+esc(t)+"</pre>");
}
function refreshPreview(force=false){
  const tgt = resolvePreviewTarget();
  let content = fs[tgt.name] || "";
  const doc = makeDoc(content);
  framePC.srcdoc = doc;
  if (force) framePC.focus();
}

/* Chat */
function loadChat(){ try{ const raw=localStorage.getItem(CHAT_KEY); return raw?JSON.parse(raw):[]; } catch{ return []; } }
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
  const focus =
`### RÈGLES TRÈS STRICTES
1) Tu respectes **UNIQUEMENT la DERNIÈRE instruction utilisateur**. Si l'historique contredit, tu ignores l'ancien.
2) Si la demande est ambiguë, tu **poses 1–3 questions de clarification** dans "reply" AVANT toute modif lourde.
3) Tu retournes **JSON STRICT**: {"files": { "path":"content", ... }, "reply":"explication brève / questions"} — pas de \`\`\`, pas d'autres champs.
4) Pour "générer un carré blanc", produis un HTML minimal utilisable dans **index.html** (ou précise où tu l’as mis).
`;

  let convo = `Contexte projet • Fichiers: ${names}\n\n${focus}\n\nConversation:\n`;
  for(const m of chat.slice(-12)){
    convo += (m.role==="user" ? "User: " : "Assistant: ") + m.text + "\n";
  }
  return convo;
}
async function sendChat(){
  const txt = chatInput.value.trim();
  if(!txt) return;
  addMsg("user", txt); renderChat();
  chatInput.value=""; autoGrowChat();
  lockChat(true);

  try{
    const prompt = buildPromptFromChat();
    const res = await window.ai.generate(prompt);
    const files = res?.files || {};
    const keys  = Object.keys(files);

    if (keys.length){
      fs = window.ai.loadFS();
      renderFiles();
      // Si un .html a été touché, basculer automatiquement l'aperçu sur ce fichier (le proposer visuellement via select déjà à jour).
      const changedHtml = keys.find(n=>/\.html?$/i.test(n));
      if (changedHtml){
        pvMode = "file:"+changedHtml; pvFile = changedHtml;
        localStorage.setItem("studio.pvMode", pvMode);
        localStorage.setItem("studio.pvFile", pvFile);
        buildPreviewSelect();
        pvSelect.value = "file:"+changedHtml;
      } else {
        buildPreviewSelect();
      }
      // Ouvrir le premier fichier modifié dans l’éditeur
      openFile(keys[0]);
    } else {
      // si pas de fichiers, on garde l’aperçu courant
      refreshPreview();
    }

    const reply = res?.reply ? String(res.reply) : (keys.length ? `Modifs: ${keys.join(", ")}` : `Aucune modification • Si c’est ambigu, reformule ta demande.`);
    addMsg("assistant", reply);
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

/* Tabs / Layout */
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
    selectLeft("code");
  } else {
    document.body.classList.add("m-chat");
    mTabChat.classList.add("active"); mTabPreview.classList.remove("active"); mTabCode.classList.remove("active");
    selectLeft("chat");
  }
}

/* Gutter (slider PC borné, arrêt net) */
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
    window.removeEventListener("pointerleave", endDrag);
  };

  gutter.addEventListener("pointerdown", (e)=>{
    dragging=true; pid=e.pointerId;
    startX=e.clientX; startW=leftPane.getBoundingClientRect().width;
    try{ gutter.setPointerCapture(pid); }catch{}
    document.body.style.userSelect="none";
    window.addEventListener("pointermove", onMove, { passive:true });
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    window.addEventListener("pointerleave", endDrag);
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
