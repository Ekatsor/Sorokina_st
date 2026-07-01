/**
 * Sorokina ST — Cloudflare Worker: secure publishing proxy
 *
 * Secrets (set via `wrangler secret put`):
 *   META_TOKEN       — Meta Graph API long-lived token (Instagram Business)
 *   META_ACCOUNT_ID  — Instagram Business Account ID
 *   VK_TOKEN         — VK API access token (wall.post permission)
 *   VK_OWNER_ID      — VK group/page owner ID (negative for groups)
 *   TG_BOT_TOKEN     — Telegram Bot API token
 *   TG_CHANNEL_ID    — Telegram channel ID (e.g. -1001234567890)
 *   ALLOWED_ORIGIN   — Your GitHub Pages origin, e.g. https://ekatsor.github.io
 *
 * Deploy:
 *   npm create cloudflare@latest sorokina-publish
 *   # replace worker.js with this file
 *   wrangler secret put META_TOKEN
 *   wrangler secret put META_ACCOUNT_ID
 *   wrangler secret put VK_TOKEN
 *   wrangler secret put VK_OWNER_ID
 *   wrangler secret put TG_BOT_TOKEN
 *   wrangler secret put TG_CHANNEL_ID
 *   wrangler secret put ALLOWED_ORIGIN
 *   wrangler deploy
 */

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = env.ALLOWED_ORIGIN || "";

    const cors = {
      "Access-Control-Allow-Origin": allowed || "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);

    // Health check
    if (url.pathname === "/health") {
      return json({ ok: true, version: "1.0.0" }, cors);
    }

    // Schedule / post immediately
    if (url.pathname === "/schedule" && request.method === "POST") {
      let body;
      try { body = await request.json(); }
      catch { return json({ error: "Invalid JSON" }, cors, 400); }

      const { platform, text, mediaUrl, scheduledAt } = body;
      if (!platform || !text) {
        return json({ error: "platform and text are required" }, cors, 400);
      }

      try {
        let result;
        switch (platform) {
          case "instagram":
            result = await postInstagram(text, mediaUrl, scheduledAt, env);
            break;
          case "vk":
            result = await postVk(text, mediaUrl, scheduledAt, env);
            break;
          case "telegram":
            result = await postTelegram(text, mediaUrl, env);
            break;
          default:
            return json({ error: `Unsupported platform: ${platform}` }, cors, 400);
        }
        return json({ ok: true, id: result.id, raw: result }, cors);
      } catch (e) {
        return json({ error: e.message }, cors, 500);
      }
    }

    return json({ error: "Not found" }, cors, 404);
  },
};

// ─── Instagram (Meta Graph API) ──────────────────────────────────────────────
// Requires: Instagram Business account linked to FB Page,
//           app with instagram_basic + instagram_content_publish permissions.
// Note: Scheduled publishing requires publish_content permission approval.
async function postInstagram(text, mediaUrl, scheduledAt, env) {
  const accountId = env.META_ACCOUNT_ID;
  const token = env.META_TOKEN;
  if (!accountId || !token) throw new Error("META_TOKEN or META_ACCOUNT_ID not configured");

  // Step 1: create media container
  const containerParams = new URLSearchParams({
    caption: text,
    access_token: token,
  });
  if (mediaUrl) {
    // Determine if video or image by extension
    const isVideo = /\.(mp4|mov|avi|webm)$/i.test(mediaUrl);
    containerParams.set(isVideo ? "video_url" : "image_url", mediaUrl);
    containerParams.set("media_type", isVideo ? "REELS" : "IMAGE");
  }

  const containerRes = await fetch(
    `https://graph.facebook.com/v20.0/${accountId}/media`,
    { method: "POST", body: containerParams }
  );
  const container = await containerRes.json();
  if (container.error) throw new Error(`Instagram container: ${container.error.message}`);

  // Step 2: publish container
  const publishRes = await fetch(
    `https://graph.facebook.com/v20.0/${accountId}/media_publish`,
    {
      method: "POST",
      body: new URLSearchParams({
        creation_id: container.id,
        access_token: token,
      }),
    }
  );
  const pub = await publishRes.json();
  if (pub.error) throw new Error(`Instagram publish: ${pub.error.message}`);
  return { id: pub.id, platform: "instagram" };
}

// ─── VKontakte (VK API) ──────────────────────────────────────────────────────
// wall.post supports publish_date for scheduled posts (Unix timestamp).
async function postVk(text, mediaUrl, scheduledAt, env) {
  const token = env.VK_TOKEN;
  const ownerId = env.VK_OWNER_ID;
  if (!token || !ownerId) throw new Error("VK_TOKEN or VK_OWNER_ID not configured");

  const params = new URLSearchParams({
    owner_id: ownerId,
    message: text,
    access_token: token,
    v: "5.199",
  });

  if (scheduledAt) {
    params.set("publish_date", Math.floor(new Date(scheduledAt).getTime() / 1000));
  }

  const res = await fetch("https://api.vk.com/method/wall.post", {
    method: "POST",
    body: params,
  });
  const d = await res.json();
  if (d.error) throw new Error(`VK: ${d.error.error_msg}`);
  return { id: d.response?.post_id, platform: "vk" };
}

// ─── Telegram (Bot API) ──────────────────────────────────────────────────────
// Telegram Bot API has no native scheduling — post immediately or use a queue.
async function postTelegram(text, mediaUrl, env) {
  const botToken = env.TG_BOT_TOKEN;
  const channelId = env.TG_CHANNEL_ID;
  if (!botToken || !channelId) throw new Error("TG_BOT_TOKEN or TG_CHANNEL_ID not configured");

  const base = `https://api.telegram.org/bot${botToken}`;
  let res;

  if (mediaUrl) {
    const isVideo = /\.(mp4|mov|avi|webm)$/i.test(mediaUrl);
    const endpoint = isVideo ? "sendVideo" : "sendPhoto";
    res = await fetch(`${base}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: channelId,
        [isVideo ? "video" : "photo"]: mediaUrl,
        caption: text,
        parse_mode: "HTML",
      }),
    });
  } else {
    res = await fetch(`${base}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: channelId, text, parse_mode: "HTML" }),
    });
  }

  const d = await res.json();
  if (!d.ok) throw new Error(`Telegram: ${d.description}`);
  return { id: d.result?.message_id, platform: "telegram" };
}

function json(data, extraHeaders = {}, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}
