// Supabase Edge Function — link preview (Open Graph) for Agoda / Traveloka / Airbnb / Google
// Maps / TikTok / IG links pasted into Akomodasi.
//
// Fetched server-side because the browser can't (CORS), and because it also needs to write the
// image/title back onto the accommodation_options row with a privilege the caller doesn't have
// (see supabase/schema.sql — that table has no client-facing UPDATE policy).
//
// Deploy with: supabase functions deploy link-unfurl
// Call from the client with: supabase.functions.invoke("link-unfurl", { body: { url, optionId } })

import { createClient } from "jsr:@supabase/supabase-js@2";

const BROWSER_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

interface Preview {
  title: string | null;
  image: string | null;
  description: string | null;
}

function isPublicHttpUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    // don't let the function be pointed at internal addresses
    if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[?::1)/i.test(url.hostname)) return null;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(url.hostname)) return null;
    if (url.hostname === "metadata.google.internal" || url.hostname.endsWith(".internal")) return null;
    return url;
  } catch {
    return null;
  }
}

function metaContent(html: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

// Matches <meta property="og:title" content="..."> in either attribute order, single or double quotes.
function metaTag(nameAttr: "property" | "name", key: string): RegExp[] {
  return [
    new RegExp(`<meta[^>]*${nameAttr}=["']${key}["'][^>]*content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*${nameAttr}=["']${key}["']`, "i"),
  ];
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function fetchPreview(rawUrl: string): Promise<Preview> {
  const url = isPublicHttpUrl(rawUrl);
  if (!url) throw new Error("URL tidak valid");

  const res = await fetch(url, {
    headers: { "User-Agent": BROWSER_UA, "Accept-Language": "id-ID,id;q=0.9,en;q=0.8" },
    redirect: "follow",
    signal: AbortSignal.timeout(8000),
  });
  const html = (await res.text()).slice(0, 1_500_000); // OG tags are in <head>

  const title =
    metaContent(html, metaTag("property", "og:title")) ??
    metaContent(html, metaTag("name", "twitter:title")) ??
    decodeEntities(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? "") ??
    null;

  const rawImage =
    metaContent(html, metaTag("property", "og:image")) ??
    metaContent(html, metaTag("property", "og:image:url")) ??
    metaContent(html, metaTag("name", "twitter:image"));
  let image: string | null = null;
  if (rawImage) {
    try {
      image = new URL(decodeEntities(rawImage), res.url || url.toString()).toString();
    } catch {
      image = null;
    }
  }

  const description =
    metaContent(html, metaTag("property", "og:description")) ?? metaContent(html, metaTag("name", "description"));

  return { title: title ? decodeEntities(title) : null, image, description: description ? decodeEntities(description) : null };
}

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Masuk dulu ya." }), { status: 401, headers: corsHeaders });
    }

    // verify the caller is actually signed in (not just carrying the public anon key)
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Masuk dulu ya." }), { status: 401, headers: corsHeaders });
    }

    const { url, optionId } = (await req.json()) as { url?: string; optionId?: string };
    if (!url || !isPublicHttpUrl(url)) {
      return new Response(JSON.stringify({ error: "Kasih URL yang valid ya." }), { status: 400, headers: corsHeaders });
    }

    const preview = await fetchPreview(url);

    if (optionId) {
      // service-role client: accommodation_options has no client UPDATE policy, this is the
      // one place image_url/title are allowed to change.
      const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const patch: Record<string, string> = {};
      if (preview.image) patch.image_url = preview.image;
      const { data: existing } = await adminClient.from("accommodation_options").select("title").eq("id", optionId).maybeSingle();
      if (preview.title && (!existing?.title || existing.title === "Villa")) patch.title = preview.title.slice(0, 120);
      if (Object.keys(patch).length) await adminClient.from("accommodation_options").update(patch).eq("id", optionId);
    }

    return new Response(JSON.stringify(preview), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: `Gagal ambil preview: ${(err as Error).message}` }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
