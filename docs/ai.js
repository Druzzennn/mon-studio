(() => {
  const API = "https://studio-ai.lucrincdu54.workers.dev";
  const KEY = "studio.fs.v1";

  function loadFS() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function saveFS(fs) {
    localStorage.setItem(KEY, JSON.stringify(fs));
  }

  function applyFiles(updates) {
    const fs = loadFS();
    for (const [path, content] of Object.entries(updates || {})) {
      fs[path] = content;
    }
    saveFS(fs);
    return fs;
  }

  async function aiFetch(path, payload) {
    const r = await fetch(API + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const t = await r.text();
    try {
      return JSON.parse(t);
    } catch {
      return { error: "invalid_json", raw: t };
    }
  }

  async function aiGenerate(prompt) {
    const files = loadFS();
    const res = await aiFetch("/generate", { prompt, files });
    if (res && res.files) applyFiles(res.files);
    return res;
  }

  async function aiAnalyze() {
    const files = loadFS();
    return await aiFetch("/analyze", { files });
  }

  window.ai = { generate: aiGenerate, analyze: aiAnalyze, loadFS, applyFiles };
})();
