const FS_KEY   = "studio.fs.v1";
const CHAT_KEY = "studio.chat.v1";

/* Refs */
const framePC   = document.getElementById("frame");
const leftPane  = document.getElementById("left");
const gutter    = document.getElementById("gutter");
const consoleEl = document.getElementById("console");

const tabChat   = document.getElementById("tab-chat");
const tabCode   = document.getElementById("tab-code");
const chatPanel = document.getElementById("chat-panel");
const codePanel = document.getElementById("code-panel");

const listEl    = document.getElementById("list");
const codeEl    = document.getElementById("code");
const newFileBtn= document.getElementById("new-file");

const chatLog   = document.getElementById("chat-log");
const chatInput = document.getElementById("chat-input");
const chatSend  = document.getElementById("chat-send");

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

/* Prévisualisation */
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
  setupConsoleCapture();

  // Onglets PC
  tabChat.addEventListener("click", () => selectLeft("chat"));
  tabCode.addEventListener("click", () => selectLeft("code"));

  // Onglets Mobile
  mTabPreview.addEventListener("click", () => selectMobile("preview"));
  mTabCode.addEventListener("click", () => selectMobile("code"));
  mTabChat.addEventListener("click", () => selectMobile("chat"));

  // Chat
  chatSend.addEventListener("click", sendChat);
  chatInput.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { 
      e.preventDefault(); 
      sendChat(); 
    }
  });
  chatInput.addEventListener("input", autoGrowChat);
  autoGrowChat();

  // Code editor avec sauvegarde auto
  codeEl.addEventListener("input", () => {
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => { 
      commitAuto(); 
      refreshPreview(); 
    }, 300);
  });
  codeEl.addEventListener("keydown", e => {
    // Tab indentation
    if (e.key === "Tab") {
      e.preventDefault();
      const start = codeEl.selectionStart;
      const end = codeEl.selectionEnd;
      codeEl.value = codeEl.value.substring(0, start) + "  " + codeEl.value.substring(end);
      codeEl.selectionStart = codeEl.selectionEnd = start + 2;
    }
  });

  // Nouveau fichier
  newFileBtn.addEventListener("click", createNewFile);

  // Preview select
  pvSelect.addEventListener("change", onPreviewSelect);

  // Gutter
  setupGutter();

  // Raccourcis clavier
  document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      commitAuto();
    }
  });

  // États init
  selectLeft("chat");
  selectMobile("preview");
}

/* Files */
function ensureDefaultFS(){
  if (!Object.keys(fs).length) {
    fs["index.html"] = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mon Projet</title>
  <style>
    body {
      margin: 0;
      padding: 20px;
      font-family: system-ui, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    }
    .container {
      text-align: center;
      background: rgba(255,255,255,0.1);
      backdrop-filter: blur(10px);
      padding: 40px;
      border-radius: 20px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    }
    h1 {
      font-size: 3em;
      margin: 0 0 20px;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 Bienvenue</h1>
    <p>Commencez à créer avec l'IA !</p>
  </div>
</body>
</html>`;
    saveFS(fs);
  }
}

function saveFS(obj){ 
  localStorage.setItem(FS_KEY, JSON.stringify(obj)); 
}

function renderFiles(){
  listEl.innerHTML = "";
  Object.keys(fs).sort().forEach(name => {
    const li = document.createElement("li");
    li.dataset.name = name;
    li.className = name === current ? "active" : "";
    
    const nameSpan = document.createElement("span");
    nameSpan.className = "file-name";
    nameSpan.textContent = name;
    li.appendChild(nameSpan);
    
    const delBtn = document.createElement("span");
    delBtn.className = "file-delete";
    delBtn.textContent = "🗑️";
    delBtn.title = "Supprimer";
    delBtn.addEventListener("click", e => {
      e.stopPropagation();
      deleteFile(name);
    });
    li.appendChild(delBtn);
    
    li.addEventListener("click", () => openFile(name));
    listEl.appendChild(li);
  });
}

function openFirst(){ 
  const first = Object.keys(fs).sort()[0]; 
  if (first) openFile(first); 
}

function openFile(name){
  if (!fs[name]) return;
  current = name;
  codeEl.value = fs[name];
  renderFiles();
  refreshPreview();
}

function commitAuto(){
  if (!current) return;
  fs[current] = codeEl.value;
  if (window.ai?.applyFiles) {
    window.ai.applyFiles({[current]: codeEl.value});
  } else {
    saveFS(fs);
  }
  buildPreviewSelect();
}

function createNewFile(){
  const name = prompt("Nom du fichier (ex: style.css, script.js):");
  if (!name || !name.trim()) return;
  
  const safeName = name.trim();
  if (fs[safeName]) {
    alert("Ce fichier existe déjà !");
    return;
  }
  
  const ext = safeName.split(".").pop().toLowerCase();
  let template = "";
  
  if (ext === "html") {
    template = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Nouveau</title>
</head>
<body>
  <h1>Nouveau fichier</h1>
</body>
</html>`;
  } else if (ext === "css") {
    template = `/* ${safeName} */\n\nbody {\n  margin: 0;\n  padding: 0;\n}\n`;
  } else if (ext === "js") {
    template = `// ${safeName}\n\nconsole.log("Hello from ${safeName}");\n`;
  }
  
  fs[safeName] = template;
  saveFS(fs);
  renderFiles();
  buildPreviewSelect();
  openFile(safeName);
  showNotification("✅ Fichier créé");
}

function deleteFile(name){
  if (!confirm(`Supprimer ${name} ?`)) return;
  delete fs[name];
  saveFS(fs);
  renderFiles();
  buildPreviewSelect();
  if (current === name) {
    openFirst();
  }
  showNotification("🗑️ Fichier supprimé");
}

function showNotification(text){
  const notif = document.createElement("div");
  notif.textContent = text;
  notif.style.cssText = "position:fixed;top:20px;right:20px;background:#18233c;color:#e5e7eb;padding:12px 20px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.3);z-index:9999;animation:slideIn 0.3s";
  document.body.appendChild(notif);
  setTimeout(() => {
    notif.style.animation = "slideOut 0.3s";
    setTimeout(() => notif.remove(), 300);
  }, 2000);
}

/* Preview select */
function buildPreviewSelect(){
  const old = pvSelect.value;
  pvSelect.innerHTML = "";
  
  const optAuto = new Option("🔄 Auto (index.html)", "auto");
  pvSelect.add(optAuto);

  const htmls = Object.keys(fs).filter(n => /\.html?$/i.test(n)).sort();
  for (const h of htmls) { 
    pvSelect.add(new Option(`📄 ${h}`, "file:" + h)); 
  }

  pvSelect.add(new Option("✂️ Fragment (fichier courant)", "fragment-current"));

  if (pvMode === "file:" + pvFile && !fs[pvFile]) pvMode = "auto";
  pvSelect.value = (pvMode === "auto" || pvMode === "fragment-current" || pvMode.startsWith("file:")) ? pvMode : "auto";
}

function onPreviewSelect(){
  pvMode = pvSelect.value;
  if (pvMode.startsWith("file:")) pvFile = pvMode.slice(5);
  localStorage.setItem("studio.pvMode", pvMode);
  localStorage.setItem("studio.pvFile", pvFile);
  refreshPreview(true);
}

/* Preview rendering avec support multi-fichiers */
function isFullDoc(s){ 
  return /^\s*<!doctype|^\s*<html|^\s*<head|^\s*<body/i.test(s); 
}

function looksLikeFragment(s){ 
  return /<([a-zA-Z][\w:-]*)(\s[^>]*)?>/m.test(s); 
}

function esc(s){
  return String(s).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

function wrapDoc(inner){
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Aperçu</title>
  <style>
    body {
      margin: 16px;
      font-family: system-ui, -apple-system, sans-serif;
      color: #e5e7eb;
      background: #0b1324;
      line-height: 1.6;
    }
  </style>
</head>
<body>${inner}</body>
</html>`;
}

function resolvePreviewTarget(){
  if (pvMode === "fragment-current") return { mode: "fragment", name: current };
  if (pvMode.startsWith("file:"))  return { mode: "file", name: pvFile };
  
  // Auto
  if (fs["index.html"]) return { mode: "file", name: "index.html" };
  const h = Object.keys(fs).find(n => /\.html?$/i.test(n));
  if (h) return { mode: "file", name: h };
  return { mode: "fragment", name: current };
}

function injectExternalFiles(html){
  // Injecter CSS et JS externes dans le HTML
  const cssFiles = Object.keys(fs).filter(n => /\.css$/i.test(n));
  const jsFiles = Object.keys(fs).filter(n => /\.js$/i.test(n));
  
  let result = html;
  
  // Injecter CSS avant </head>
  if (cssFiles.length && result.includes("</head>")) {
    const styles = cssFiles.map(f => `<style data-file="${f}">\n${fs[f]}\n</style>`).join("\n");
    result = result.replace("</head>", styles + "\n</head>");
  }
  
  // Injecter JS avant </body>
  if (jsFiles.length && result.includes("</body>")) {
    const scripts = jsFiles.map(f => `<script data-file="${f}">\n${fs[f]}\n</script>`).join("\n");
    result = result.replace("</body>", scripts + "\n</body>");
  }
  
  return result;
}

function makeDoc(s){
  const t = String(s || "");
  
  if (isFullDoc(t)) {
    return injectExternalFiles(t);
  }
  
  if (looksLikeFragment(t)) {
    return injectExternalFiles(wrapDoc(t));
  }
  
  // Texte brut
  return wrapDoc(`<pre style="margin:16px;font:13px ui-monospace,Consolas,Menlo,monospace;white-space:pre-wrap">${esc(t)}</pre>`);
}

function refreshPreview(force = false){
  const tgt = resolvePreviewTarget();
  let content = fs[tgt.name] || "";
  const doc = makeDoc(content);
  framePC.srcdoc = doc;
  consoleEl.innerHTML = "";
  consoleEl.classList.remove("visible");
  if (force) framePC.focus();
}

/* Console capture */
function setupConsoleCapture(){
  window.addEventListener("message", e => {
    if (e.data && e.data.type === "console") {
      addConsoleMessage(e.data.level, e.data.message);
    }
  });
}

function addConsoleMessage(level, msg){
  const div = document.createElement("div");
  div.className = "error";
  div.textContent = `[${level.toUpperCase()}] ${msg}`;
  consoleEl.appendChild(div);
  consoleEl.classList.add("visible");
}

/* Chat */
function loadChat(){ 
  try { 
    const raw = localStorage.getItem(CHAT_KEY); 
    return raw ? JSON.parse(raw) : []; 
  } catch { 
    return []; 
  } 
}

function saveChat(){ 
  localStorage.setItem(CHAT_KEY, JSON.stringify(chat)); 
}

function addMsg(role, text, isError = false){ 
  chat.push({ role, text, ts: Date.now(), error: isError }); 
  saveChat(); 
}

function renderChat(){
  chatLog.innerHTML = "";
  for (const m of chat) {
    const n = document.createElement("div");
    n.className = "msg " + (m.role === "user" ? "user" : "bot");
    if (m.error) n.classList.add("error");
    n.textContent = m.text;
    chatLog.appendChild(n);
  }
  chatLog.scrollTop = chatLog.scrollHeight;
}

async function sendChat(){
  const txt = chatInput.value.trim();
  if (!txt) return;
  
  addMsg("user", txt); 
  renderChat();
  chatInput.value = ""; 
  autoGrowChat();
  lockChat(true);

  try {
    const history = chat.slice(-20).map(m => ({ role: m.role, text: m.text }));
    const res = await window.ai.generate(txt, history);
    
    const files = res?.files || {};
    const keys = Object.keys(files);

    if (keys.length) {
      fs = window.ai.loadFS();
      renderFiles();
      
      // Si HTML modifié, basculer l'aperçu
      const changedHtml = keys.find(n => /\.html?$/i.test(n));
      if (changedHtml) {
        pvMode = "file:" + changedHtml; 
        pvFile = changedHtml;
        localStorage.setItem("studio.pvMode", pvMode);
        localStorage.setItem("studio.pvFile", pvFile);
        buildPreviewSelect();
        pvSelect.value = "file:" + changedHtml;
      } else {
        buildPreviewSelect();
      }
      
      openFile(keys[0]);
    } else {
      refreshPreview();
    }

    const reply = res?.reply 
      ? String(res.reply) 
      : (keys.length ? `✅ Fichiers modifiés: ${keys.join(", ")}` : `ℹ️ Aucune modification. Reformule ta demande si besoin.`);
    
    addMsg("assistant", reply);
    renderChat();
    
  } catch(e) {
    addMsg("assistant", "❌ Erreur: " + String(e), true);
    renderChat();
  } finally {
    lockChat(false);
  }
}

function autoGrowChat(){
  chatInput.style.height = "auto";
  chatInput.style.height = Math.min(Math.max(chatInput.scrollHeight, 64), 180) + "px";
}

function lockChat(b){
  chatSend.disabled = b;
  chatInput.disabled = b;
  chatSend.textContent = b ? "⏳ IA..." : "Envoyer";
}

/* Tabs / Layout */
function selectLeft(which){
  const isChat = which === "chat";
  tabChat.classList.toggle("active", isChat);
  tabCode.classList.toggle("active", !isChat);
  chatPanel.classList.toggle("active", isChat);
  codePanel.classList.toggle("active", !isChat);
}

function selectMobile(which){
  document.body.classList.remove("m-view-preview", "m-view-code", "m-view-chat");
  mTabPreview.classList.remove("active");
  mTabCode.classList.remove("active");
  mTabChat.classList.remove("active");
  
  if (which === "preview") {
    document.body.classList.add("m-view-preview");
    mTabPreview.classList.add("active");
  } else if (which === "code") {
    document.body.classList.add("m-view-code");
    mTabCode.classList.add("active");
  } else if (which === "chat") {
    document.body.classList.add("m-view-chat");
    mTabChat.classList.add("active");
  }
}

/* Gutter */
function setupGutter(){
  let dragging = false, pid = null, startX = 0, startW = 0;

  const onMove = (e) => {
    if (!dragging) return;
    const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX);
    if (clientX == null) return;
    const dx = clientX - startX;
    const minPx = 240;
    const maxPx = Math.max(360, window.innerWidth - 360);
    const newW = Math.min(maxPx, Math.max(minPx, startW + dx));
    document.documentElement.style.setProperty("--leftw", newW + "px");
  };
  
  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    if (pid != null) { 
      try { gutter.releasePointerCapture(pid); } catch {} 
      pid = null; 
    }
    document.body.style.userSelect = "";
    persistLeftWidth();
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
    window.removeEventListener("pointerleave", endDrag);
  };

  gutter.addEventListener("pointerdown", (e) => {
    dragging = true; 
    pid = e.pointerId;
    startX = e.clientX; 
    startW = leftPane.getBoundingClientRect().width;
    try { gutter.setPointerCapture(pid); } catch {}
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove, { passive: true });
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

// Animations CSS
const style = document.createElement("style");
style.textContent = `
@keyframes slideIn {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
@keyframes slideOut {
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(100%); opacity: 0; }
}
`;
document.head.appendChild(style);
