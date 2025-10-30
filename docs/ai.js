(function(){
  const API = "https://studio-ai.lucrincdu54.workers.dev";
  const KEY = "studio.fs.v1";
  
  function loadFS(){ 
    try{ 
      const raw = localStorage.getItem(KEY); 
      return raw ? JSON.parse(raw) : {}; 
    } catch { 
      return {}; 
    } 
  }
  
  function saveFS(fs){ 
    localStorage.setItem(KEY, JSON.stringify(fs)); 
  }
  
  function applyFiles(updates){ 
    const fs = loadFS(); 
    for(const [p, c] of Object.entries(updates || {})) {
      fs[p] = c;
    }
    saveFS(fs); 
    return fs; 
  }
  
  async function aiFetch(path, payload){
    const ctrl = new AbortController(); 
    const to = setTimeout(() => ctrl.abort(), 30000);
    try {
      const r = await fetch(API + path, { 
        method: "POST", 
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json" 
        }, 
        body: JSON.stringify(payload), 
        signal: ctrl.signal 
      });
      const text = await r.text(); 
      let json; 
      try { 
        json = JSON.parse(text); 
      } catch { 
        json = { raw: text }; 
      }
      if (!r.ok) return { error: `http_${r.status}`, ...json };
      return json;
    } catch(e) { 
      return { 
        error: (e && e.name) === "AbortError" ? "timeout" : "network_error", 
        detail: String(e) 
      }; 
    } finally { 
      clearTimeout(to); 
    }
  }
  
  function normalize(res){
    const out = { files: {}, reply: null, meta: res?.meta || null };
    if (res?.files && typeof res.files === "object") {
      out.files = res.files;
    }
    const reply = res?.reply ?? res?.message ?? res?.text ?? res?.raw;
    if (reply) out.reply = String(reply);
    return out;
  }
  
  async function aiGenerate(prompt, conversationHistory = []){
    const fs = loadFS();
    const res = await aiFetch("/generate", { 
      prompt, 
      files: fs,
      history: conversationHistory 
    });
    
    if (res.error) {
      return { 
        ok: false, 
        files: {}, 
        reply: `[Erreur IA] ${res.error}${res.detail ? ': ' + res.detail : ''}` 
      };
    }
    
    const norm = normalize(res);
    if (Object.keys(norm.files).length) {
      applyFiles(norm.files);
    }
    return { ok: true, ...norm };
  }
  
  window.ai = { 
    generate: aiGenerate, 
    loadFS, 
    applyFiles 
  };
})();
