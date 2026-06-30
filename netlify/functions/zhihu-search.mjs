const ZHIHU_SEARCH_ENDPOINT = "https://developer.zhihu.com/api/v1/content/zhihu_search";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  const query = String(event.queryStringParameters?.query ?? "").trim().slice(0, 120);
  const count = clampNumber(Number(event.queryStringParameters?.count ?? 6), 1, 10);
  const token = process.env.ZHIHU_TOKEN;

  if (!query) {
    return json({ ok: false, source: "fallback", reason: "EMPTY_QUERY", items: [] });
  }

  if (!token) {
    return json({ ok: false, source: "fallback", reason: "ZHIHU_TOKEN_NOT_CONFIGURED", items: [] });
  }

  const url = new URL(ZHIHU_SEARCH_ENDPOINT);
  url.searchParams.set("Query", query);
  url.searchParams.set("Count", String(count));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Request-Timestamp": String(Math.floor(Date.now() / 1000)),
      },
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));
    const code = payload.Code ?? payload.code;
    const message = payload.Message ?? payload.msg ?? payload.message;

    if (!response.ok || code !== 0) {
      return json({
        ok: false,
        source: "fallback",
        reason: message || `ZHIHU_API_${response.status}`,
        items: [],
      });
    }

    const data = payload.Data ?? payload.data ?? {};
    const items = Array.isArray(data.Items) ? data.Items : Array.isArray(data.items) ? data.items : [];

    return json({
      ok: true,
      source: "zhihu_search",
      query,
      searchHashId: data.SearchHashId ?? data.searchHashId ?? "",
      items: items.slice(0, count).map(normalizeSearchItem),
    });
  } catch (error) {
    return json({
      ok: false,
      source: "fallback",
      reason: error?.name === "AbortError" ? "ZHIHU_API_TIMEOUT" : "ZHIHU_API_FAILED",
      items: [],
    });
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeSearchItem(item) {
  return {
    title: cleanText(item.Title ?? item.title ?? "知乎内容"),
    description: cleanText(item.ContentText ?? item.contentText ?? item.Summary ?? item.summary ?? ""),
    url: String(item.Url ?? item.url ?? "https://www.zhihu.com/").trim(),
    contentType: normalizeContentType(item.ContentType ?? item.contentType),
    authorName: cleanText(item.AuthorName ?? item.authorName ?? ""),
    voteUpCount: toNullableNumber(item.VoteUpCount ?? item.voteUpCount),
    commentCount: toNullableNumber(item.CommentCount ?? item.commentCount),
  };
}

function cleanText(value) {
  return String(value)
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

function normalizeContentType(value) {
  const text = String(value ?? "").toLowerCase();
  if (text.includes("answer")) return "回答";
  if (text.includes("article")) return "文章";
  if (text.includes("question")) return "问题";
  return value ? String(value) : "知乎内容";
}

function toNullableNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function json(body) {
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(body),
  };
}
