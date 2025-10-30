(() => {
  const API = "https://studio-ai.lucrincdu54.workers.dev";
  const KEY = "studio.fs.v1";

  function loadFS() {
    try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : {}; }
    catch { return {}; }
  }
  function saveFS(fs) { localStorage.setItem(KEY, JSON.stringify(fs)); }

  function applyFiles(updates) {
    const fs = loadFS();
    for (const [path, content] of Object.entries(updates || {})) fs[path] = content;
    saveFS(fs);
    return fs;
  }

  async function aiFetch(path, payload) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 25000);
    try {
      const r = await fetch(API + path, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal
      });
      const text = await r.text();
      let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
      if (!r.ok) return { error: `http_${r.status}`, ...json };
      return json;
    } catch (e) {
      return { error: e.name === "AbortError" ? "timeout" : "network_error", detail: String(e) };
    } finally { clearTimeout(t); }
  }

  // Normalise diverses formes de sortie => {files:{...}}
  function normalizeToFiles(res) {
    if (!res) return { files: {} };
    if (res.files && typeof res.files === "object") return { files: res.files };
    const html = res.html || res.code || res.markup || res.text;
    if (typeof html === "string" && html.trim()) return { files: { "index.html": html } };
    return { files: {} };
  }

  async function aiGenerate(prompt) {
    const fs = loadFS();
    const res = await aiFetch("/generate", { prompt, files: fs });
    if (res.error) return res; // surface l'erreur au caller
    const norm = normalizeToFiles(res);
    if (Object.keys(norm.files).length) applyFiles(norm.files);
    return { ok: true, ...norm, meta: res.meta || null };
  }

  async function aiAnalyze() {
    const fs = loadFS();
    return await aiFetch("/analyze", { files: fs });
  }

  async function aiPing() {
    try {
      const r = await fetch(API, { method: "GET" });
      return { ok: r.ok, status: r.status };
    } catch (e) { return { ok: false, error: String(e) }; }
  }

  window.ai = { generate: aiGenerate, analyze: aiAnalyze, loadFS, applyFiles, ping: aiPing };
})();
