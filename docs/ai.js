(() => {
  const API = "https://studio-ai.lucrincdu54.workers.dev";
  const KEY = "studio.fs.v1";

  function loadFS(){ try{ const raw=localStorage.getItem(KEY); return raw?JSON.parse(raw):{}; }catch{ return {}; } }
  function saveFS(fs){ localStorage.setItem(KEY, JSON.stringify(fs)); }
  function applyFiles(updates){ const fs=loadFS(); for(const [p,c] of Object.entries(updates||{})) fs[p]=c; saveFS(fs); return fs; }

  async function aiFetch(path, payload){
    const ctrl=new AbortController(); const to=setTimeout(()=>ctrl.abort(), 25000);
    try{
      const r = await fetch(API+path, { method:"POST", headers:{ "Content-Type":"application/json", "Accept":"application/json" }, body:JSON.stringify(payload), signal:ctrl.signal });
      const text = await r.text(); let json; try{ json=JSON.parse(text); }catch{ json={ raw:text }; }
      if(!r.ok) return { error:`http_${r.status}`, ...json };
      return json;
    }catch(e){ return { error: e.name==="AbortError" ? "timeout" : "network_error", detail:String(e) }; }
    finally{ clearTimeout(to); }
  }

  function normalizeToFiles(res){
    if(!res) return { files:{} };
    if(res.files && typeof res.files==="object") return { files:res.files };
    const html = res.html || res.code || res.markup || res.text;
    if(typeof html==="string" && html.trim()) return { files:{ "index.html": html } };
    return { files:{} };
  }

  async function aiGenerate(prompt){
    const fs = loadFS();
    const res = await aiFetch("/generate", { prompt, files: fs });
    if(res.error){
      // fallback client si le serveur renvoie une erreur
      const fallback = { files: { "index.html": "<!doctype html><meta charset='utf-8'><title>Aperçu</title><h1>Prototype (client)</h1><p>"+escape(prompt)+"</p>" } };
      applyFiles(fallback.files);
      return { ok:false, error:res.error, ...fallback };
    }
    const norm = normalizeToFiles(res);
    if(Object.keys(norm.files).length) applyFiles(norm.files);
    return { ok:true, ...norm, meta: res.meta || null };
  }

  async function aiAnalyze(){ const fs=loadFS(); return await aiFetch("/analyze", { files: fs }); }

  function escape(s){ return String(s).replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m])); }

  window.ai = { generate: aiGenerate, analyze: aiAnalyze, loadFS, applyFiles };
})();
