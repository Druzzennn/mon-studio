export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return ok();
    if (request.method === "GET" && url.pathname === "/") return json({ ok: true, service: "studio-ai" });

    if (request.method === "POST" && url.pathname === "/generate") {
      const body = await safeJSON(request);
      const prompt = String(body?.prompt || "").trim();
      const files = body?.files && typeof body.files === "object" ? body.files : {};
      if (!prompt) return json({ error: "missing_prompt" }, 400);

      let out = null;
      const AI = env.AI || env.ai;
      if (AI && AI.run) {
        try {
          const model = "@cf/meta/llama-3.1-8b-instruct";
          const sys = 'Tu es un générateur de code. Réponds STRICTEMENT en JSON {"files":{"path":"content"}} sans prose ni ```.';
          const ctx = "Fichiers existants: " + Object.keys(files).join(", ") + "\nConsigne: " + prompt;
          const resp = await AI.run(model, { messages: [{ role:"system", content:sys }, { role:"user", content:ctx }] });
          out = parseFilesJSON(resp?.response || resp?.output_text || "");
        } catch {}
      }

      if (!out || !Object.keys(out.files).length) {
        out = { files: { "index.html": "<!doctype html><meta charset='utf-8'><title>Aperçu</title><h1>Prototype</h1><p>" + escapeHTML(prompt) + "</p>" } };
      }
      return json({ ok: true, ...out, meta: { model: AI ? "cf-ai" : "fallback" } });
    }

    if (request.method === "POST" && url.pathname === "/analyze") {
      const body = await safeJSON(request);
      const files = body?.files && typeof body.files === "object" ? body.files : {};
      return json({ ok: true, summary: `Fichiers: ${Object.keys(files).length}`, issues: [], actions: [] });
    }

    return json({ error: "not_found" }, 404);
  }
};

function ok(){ return new Response("", { status:204, headers:cors() }); }
function json(obj, status=200){ return new Response(JSON.stringify(obj), { status, headers:{...cors(),"content-type":"application/json; charset=utf-8","cache-control":"no-store"} }); }
function cors(){ return {"access-control-allow-origin":"*","access-control-allow-methods":"GET,POST,OPTIONS","access-control-allow-headers":"content-type,authorization"}; }
async function safeJSON(req){ try{ return await req.json(); } catch{ return {}; } }
function parseFilesJSON(text){
  try{ const j=JSON.parse(text); if(j?.files && typeof j.files==="object") return { files:j.files }; }catch{}
  const a=text.indexOf("{"), b=text.lastIndexOf("}");
  if(a>=0 && b>a){ try{ const j=JSON.parse(text.slice(a,b+1)); if(j?.files && typeof j.files==="object") return { files:j.files }; }catch{} }
  return { files:{} };
}
function escapeHTML(s){ return String(s).replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m])); }
