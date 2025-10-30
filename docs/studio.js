const FS_KEY   = "studio.fs.v1";     // aligné ai.js
const CHAT_KEY = "studio.chat.v1";

const frame     = document.getElementById("frame");
const saveBtn   = document.getElementById("save");
const previewBtn= document.getElementById("preview");

// Code panel refs
const listEl  = document.getElementById("list");
const codeEl  = document.getElementById("code");
const tabChat = document.getElementById("tab-chat");
const tabCode = document.getElementById("tab-code");
const chatPanel = document.getElementById("chat-panel");
const codePanel = document.getElementById("code-panel");

// Chat refs
const chatLog   = document.getElementById("chat-log");
const chatInput = document.getElementById("chat-input");
const chatSend  = document.getElementById("chat-send");

let fs = window.ai?.loadFS ? window.ai.loadFS() : {};
let current = null;
let typingTimer = null;

// Chat state
let chat = loadChat();

init();

function init(){
  ensureDefaultFS();
  renderFiles();
  openFirst();
  wireUI();
  renderChat();
  selectTab("chat"); // par défaut : Chat IA (aperçu toujours visible)
}

/* ---------------- Files / FS ---------------- */
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
    li.onclick = ()=> openFile(name);
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
  updatePreview(fs[name]);
}
function commit(){
  if(!current) return;
  fs[current] = codeEl.value;
  if (window.ai?.applyFiles) window.ai.applyFiles({[current]: codeEl.value});
  else saveFS(fs);
}

/* ---------------- Preview (intelligente) ---------------- */
function isFullDoc(s){ return /^\s*<!doctype|^\s*<html|^\s*<head|^\s*<body/i.test(s); }
function looksLikeFragment(s){ return /<([a-zA-Z][\w:-]*)(\s[^>]*)?>/m.test(s); }
function wrapDoc(inner){
  return "<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width, initial-scale=1'>"
       + "<title>Aperçu</title><style>body{margin:16px;font:14px system-ui;color:#e5e7eb;background:#0b1324}</style></head><body>"
       + inner + "</body></html>";
}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function updatePreview(str){
  const s = String(str||"");
  let doc;
  if (isFullDoc(s)) doc = s;
  else if (looksLikeFragment(s)) doc = wrapDoc(s);
  else doc = wrapDoc("<pre style='margin:16px;font:13px ui-monospace,Consolas,Menlo,monospace;white-space:pre-wrap'>"+esc(s)+"</pre>");
  frame.srcdoc = doc;
}

/* ---------------- Chat ---------------- */
function loadChat(){
  try{ const raw = localStorage.getItem(CHAT_KEY); return raw?JSON.parse(raw):[]; }
  catch{ return []; }
}
function saveChat(){ localStorage.setItem(CHAT_KEY, JSON.stringify(chat)); }
function addMsg(role, text){
  chat.push({ role, text, ts: Date.now() });
  saveChat();
}
function renderChat(){
  chatLog.innerHTML = "";
  for(const m of chat){
    const wrap = document.createElement("div");
    wrap.className = "msg " + (m.role==="user"?"user":"bot");
    wrap.innerHTML = esc(m.text);
    chatLog.appendChild(wrap);
  }
  chatLog.scrollTop = chatLog.scrollHeight;
}
function buildPromptFromChat(){
  // Concatène brièvement le contexte + historique; le Worker accepte "prompt"
  const names = Object.keys(fs).join(", ");
  let convo = `Contexte projet. Fichiers existants: ${names}.\n` +
              `Quand tu modifies ou ajoutes des fichiers, réponds en JSON {"files":{"path":"content"}}. ` +
              `Si tu renvoies un fragment HTML, c'est accepté.\n\nConversation:\n`;
  for(const m of chat.slice(-12)){
    convo += (m.role==="user" ? "User: " : "Assistant: ") + m.text + "\n";
  }
  // Dernier message utilisateur déjà en fin de chat
  return convo;
}
async function sendChat(){
  const text = chatInput.value.trim();
  if(!text) return;
  // message utilisateur
  addMsg("user", text);
  renderChat();
  chatInput.value = ""; autoGrowChat();

  // Construire prompt agrégé
  const prompt = buildPromptFromChat();

  chatSend.disabled = true; chatSend.textContent = "IA…";
  try{
    const res = await window.ai.generate(prompt);
    // Normalise affichage assistant
    if (res?.error) {
      addMsg("assistant", "Erreur IA: " + res.error);
      renderChat();
      return;
    }
    const files = res?.files || {};
    const keys = Object.keys(files);
    if (keys.length) {
      // fs déjà merge côté ai.js; recharge et aperçus
      fs = window.ai.loadFS();
      renderFiles();
      const target = keys.find(n=>/\.html?$/i.test(n)) || keys[0];
      if (target) openFile(target);
      addMsg("assistant", "OK • " + keys.length + " fichier(s) mis à jour");
      renderChat();
    } else {
      addMsg("assistant", "Pas de fichiers renvoyés. Reformule ta demande en précisant le fichier à créer/modifier.");
      renderChat();
    }
  } catch(e){
    addMsg("assistant", "Erreur: " + String(e));
    renderChat();
  } finally {
    chatSend.disabled = false; chatSend.textContent = "Envoyer";
  }
}

/* ---------------- Tabs / UI ---------------- */
function selectTab(which){
  if (which==="chat"){
    tabChat.classList.add("active"); tabCode.classList.remove("active");
    chatPanel.classList.add("active"); codePanel.classList.remove("active");
  } else {
    tabCode.classList.add("active"); tabChat.classList.remove("active");
    codePanel.classList.add("active"); chatPanel.classList.remove("active");
  }
}
function autoGrowChat(){
  chatInput.style.height = "auto";
  const min = 64, max = 180;
  chatInput.style.height = Math.min(Math.max(chatInput.scrollHeight, min), max) + "px";
}

/* ---------------- Events ---------------- */
saveBtn.onclick    = ()=>{ commit(); };
previewBtn.onclick = ()=>{ if (current) updatePreview(fs[current]); };
tabChat.onclick    = ()=> selectTab("chat");
tabCode.onclick    = ()=> selectTab("code");
chatSend.onclick   = sendChat;
chatInput.addEventListener("keydown",(e)=>{
  if (e.key==="Enter" && !e.shiftKey){ e.preventDefault(); sendChat(); }
});
codeEl.addEventListener("input", ()=>{
  clearTimeout(typingTimer);
  typingTimer = setTimeout(()=>{ commit(); if(current) updatePreview(fs[current]); }, 200);
});
chatInput.addEventListener("input", autoGrowChat);
