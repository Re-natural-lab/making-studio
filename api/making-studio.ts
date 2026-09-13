import type { VercelRequest, VercelResponse } from "@vercel/node";

// ─── 型定義 ────────────────────────────────────────────────────────────────
export type ChannelType = "email" | "line" | "chat" | "internal";

export interface MarketingSubscriber {
  id: string;
  email: string;
  name?: string;
  channel: ChannelType;
  status: "active" | "unsubscribed" | "bounced";
  tags: string[];
  segments: string[];
  registeredAt: Date;
  metadata?: Record<string, any>;
}

export interface RichContentBlock {
  type: "heading" | "text" | "image" | "video" | "button" | "divider";
  content: string;
  url?: string;
  imageUrl?: string;
  emoji?: string;
  style?: {
    align?: "left" | "center" | "right";
    color?: string;
    bgColor?: string;
  };
}

export interface RichMessage {
  subject: string;
  blocks: RichContentBlock[];
  rawText?: string;
  rawHtml?: string;
}

export interface BroadcastQueueItem {
  id: string;
  subscriberId: string;
  email: string;
  name?: string;
  channel: ChannelType;
  stepNumber?: number;
  scheduledAt: Date;
  status: "pending" | "processing" | "sent" | "failed";
  retryCount: number;
  maxRetries: number;
  lastError?: string;
  message: RichMessage;
  category: string;
}

export interface DispatchLog {
  id: string;
  queueId?: string;
  recipient: string;
  channel: ChannelType;
  category: string;
  status: "success" | "error" | "mock";
  messageId?: string;
  errorMessage?: string;
  timestamp: Date;
}

// ─── 全9話ステップメール定義 ───────────────────────────────────────────────
export const STEP_EMAIL_SERIES_9 = [
  { stepNumber: 1, delayDays: 0, title: "お久しぶりです。お元気ですか？｜Re'naturalより", category: "renatural_step_1" },
  { stepNumber: 2, delayDays: 1, title: "「売上を追うほど苦しくなった」あの頃の違和感の正体", category: "renatural_step_2" },
  { stepNumber: 3, delayDays: 2, title: "売上が上がって「怖い」と感じた日｜安心ベースと数字の真理", category: "renatural_step_3" },
  { stepNumber: 4, delayDays: 3, title: "数字アレルギーを手放したら、旅と暮らしが100%自由になった", category: "renatural_step_4" },
  { stepNumber: 5, delayDays: 4, title: "1日の8割はリアタイの充実。作業が「最高峰の遊び」に変わった", category: "renatural_step_5" },
  { stepNumber: 6, delayDays: 5, title: "AIは勉強しなくていい。「面白い付き合い方」さえ知っていれば", category: "renatural_step_6" },
  { stepNumber: 7, delayDays: 6, title: "誰かの正解を捨てて、オンリーワンの仕組みを創るということ", category: "renatural_step_7" },
  { stepNumber: 8, delayDays: 7, title: "大人のための自由化空間「Nature Nomad Life」プレオープンのお知らせ", category: "renatural_step_8" },
  { stepNumber: 9, delayDays: 8, title: "一緒に、遊ぶように生きていこう｜Nature Nomad Life招待枠のご案内", category: "renatural_step_9" },
];

// ─── インメモリストア ──────────────────────────────────────────────────────
const subscribersStore = new Map<string, MarketingSubscriber>();
const queue: BroadcastQueueItem[] = [];
const deliveryLogs: DispatchLog[] = [];

// ─── ヘルパー関数 ──────────────────────────────────────────────────────────
export function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (m) => {
    switch (m) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return m;
    }
  });
}

export function generateUnsubscribeUrl(email: string): string {
  return `https://renatural.org/unsubscribe?email=${encodeURIComponent(email)}`;
}

export function renderRichContentToHtml(message: RichMessage, recipientEmail: string): string {
  if (message.rawHtml) return message.rawHtml;

  const unsubscribeUrl = generateUnsubscribeUrl(recipientEmail);
  const blocksHtml = message.blocks.map((b) => {
    const align = b.style?.align || "left";
    switch (b.type) {
      case "heading":
        return `<h2 style="font-size:20px;font-weight:bold;color:${b.style?.color || '#2d3748'};text-align:${align};margin:24px 0 12px 0;">${b.emoji ? b.emoji + ' ' : ''}${escapeHtml(b.content)}</h2>`;
      case "text":
        return `<p style="font-size:15px;line-height:1.8;color:${b.style?.color || '#4a5568'};text-align:${align};margin:0 0 16px 0;">${escapeHtml(b.content).replace(/\n/g, '<br>')}</p>`;
      case "image":
        return `<div style="text-align:${align};margin:20px 0;"><img src="${escapeHtml(b.url || b.content)}" alt="image" style="max-width:100%;height:auto;border-radius:8px;" /></div>`;
      case "video":
        return `
          <div style="text-align:${align};margin:24px 0;">
            <a href="${escapeHtml(b.url || '#')}" target="_blank" style="display:inline-block;text-decoration:none;">
              ${b.imageUrl ? `<img src="${escapeHtml(b.imageUrl)}" style="max-width:100%;border-radius:8px;" />` : ''}
              <div style="background:#2b6cb0;color:#fff;padding:12px 24px;border-radius:6px;font-weight:bold;margin-top:8px;display:inline-block;">
                ▶ 動画を再生する: ${escapeHtml(b.content)}
              </div>
            </a>
          </div>`;
      case "button":
        return `
          <div style="text-align:${align};margin:28px 0;">
            <a href="${escapeHtml(b.url || '#')}" target="_blank" style="background-color:${b.style?.bgColor || '#2b6cb0'};color:#ffffff;padding:14px 32px;border-radius:30px;font-weight:bold;text-decoration:none;display:inline-block;font-size:16px;">
              ${b.emoji ? b.emoji + ' ' : ''}${escapeHtml(b.content)}
            </a>
          </div>`;
      case "divider":
        return `<hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0;" />`;
      default:
        return `<p style="font-size:15px;line-height:1.8;">${escapeHtml(b.content)}</p>`;
    }
  }).join("\n");

  const footerHtml = `
    <br><hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0;" />
    <p style="font-size:11px;color:#888;line-height:1.6;text-align:center;">
      ※本メールは Re'natural のご案内・作品をお届けしています。<br>
      受付時間: 10:00〜16:00（定休日: 木・金 / 休業日は土曜以降順次返信）<br>
      配信停止をご希望の場合は <a href="${unsubscribeUrl}" style="color:#666;text-decoration:underline;">こちらからワンクリックで解除</a> できます。
    </p>
  `;

  return `<div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#ffffff;">${blocksHtml}${footerHtml}</div>`;
}

export function parseBizCreateCSV(csvContent: string): MarketingSubscriber[] {
  const lines = csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
  const emailIdx = headers.findIndex((h) => h.includes("email") || h.includes("メール"));
  const nameIdx = headers.findIndex((h) => h.includes("name") || h.includes("名前") || h.includes("氏名"));
  const tagIdx = headers.findIndex((h) => h.includes("tag") || h.includes("タグ") || h.includes("シナリオ"));

  const subscribers: MarketingSubscriber[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const email = emailIdx >= 0 ? cols[emailIdx] : cols[0];
    if (!email || !email.includes("@")) continue;

    const name = nameIdx >= 0 ? cols[nameIdx] : undefined;
    const rawTags = tagIdx >= 0 ? cols[tagIdx] : "";
    const tags = rawTags ? rawTags.split(";").map((t) => t.trim()) : ["bizcreate_migrated"];

    subscribers.push({
      id: `sub_${Math.random().toString(36).substr(2, 9)}`,
      email,
      name,
      channel: "email",
      status: "active",
      tags,
      segments: ["bizcreate_import"],
      registeredAt: new Date(),
    });
  }
  return subscribers;
}

export function subscribeSubscriber(email: string, name?: string, tags: string[] = [], segments: string[] = ["default"]): MarketingSubscriber {
  const cleanEmail = email.trim().toLowerCase();
  const existing = subscribersStore.get(cleanEmail);
  if (existing) {
    existing.status = "active";
    if (name) existing.name = name;
    existing.tags = Array.from(new Set([...existing.tags, ...tags]));
    existing.segments = Array.from(new Set([...existing.segments, ...segments]));
    return existing;
  }
  const newSub: MarketingSubscriber = {
    id: `sub_${Math.random().toString(36).substring(2, 10)}`,
    email: cleanEmail,
    name,
    channel: "email",
    status: "active",
    tags,
    segments,
    registeredAt: new Date(),
  };
  subscribersStore.set(cleanEmail, newSub);
  return newSub;
}

export function unsubscribeSubscriber(email: string): boolean {
  const cleanEmail = email.trim().toLowerCase();
  const existing = subscribersStore.get(cleanEmail);
  if (existing) {
    existing.status = "unsubscribed";
    return true;
  }
  return false;
}

export class RenaturalMarketingCore {
  public static async dispatchEmail(options: any): Promise<{ success: boolean; messageId?: string; mock?: boolean }> {
    const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
    if (!SENDGRID_API_KEY) {
      console.log("[RenaturalMarketingCore] Mock Dispatch (SENDGRID_API_KEY unset):", options.to, options.subject);
      return { success: true, mock: true };
    }

    let finalHtml = options.html;
    if (options.richMessage) {
      finalHtml = renderRichContentToHtml(options.richMessage, options.to);
    } else if (!finalHtml) {
      const unsubscribeUrl = generateUnsubscribeUrl(options.to);
      const footerHtml = `
        <br><hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
        <p style="font-size:11px;color:#888;line-height:1.6;">
          ※本メールは Re'natural のご案内・作品をお届けしています。<br>
          配信停止をご希望の場合は <a href="${unsubscribeUrl}">こちらから解除</a> できます。
        </p>
      `;
      finalHtml = (options.text || options.subject || "").replace(/\n/g, '<br>') + footerHtml;
    }

    const payload = {
      personalizations: [{ to: [{ email: options.to, name: options.toName || undefined }] }],
      from: { email: "info@renatural.org", name: "Re'natural" },
      subject: options.subject,
      content: [
        { type: "text/plain", value: options.text || options.subject },
        { type: "text/html", value: finalHtml },
      ],
      categories: options.category ? [options.category] : ["renatural_core"],
    };

    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (res.status >= 200 && res.status < 300) {
      return { success: true, messageId: res.headers.get("x-message-id") || undefined };
    } else {
      const errText = await res.text();
      throw new Error(`SendGrid error (${res.status}): ${errText}`);
    }
  }
}

export class MarketingQueueManager {
  public static enqueueBroadcast(recipients: any[], message: RichMessage, category: string, scheduledAt: Date = new Date()) {
    const items: BroadcastQueueItem[] = recipients.map((r) => ({
      id: `queue_${Math.random().toString(36).substring(2, 10)}`,
      subscriberId: r.subscriberId || `sub_${Math.random().toString(36).substring(2, 8)}`,
      email: r.email,
      name: r.name,
      channel: "email",
      scheduledAt,
      status: "pending",
      retryCount: 0,
      maxRetries: 3,
      message,
      category,
    }));
    queue.push(...items);
    return items;
  }

  public static async processQueue() {
    const now = new Date();
    const readyItems = queue.filter((i) => i.status === "pending" && i.scheduledAt <= now);
    let sent = 0;
    let failed = 0;
    for (const item of readyItems) {
      item.status = "processing";
      try {
        const res = await RenaturalMarketingCore.dispatchEmail({
          to: item.email,
          toName: item.name,
          subject: item.message.subject,
          richMessage: item.message,
          category: item.category,
        });
        item.status = "sent";
        sent++;
        deliveryLogs.push({
          id: `log_${Date.now()}`,
          queueId: item.id,
          recipient: item.email,
          channel: item.channel,
          category: item.category,
          status: res.mock ? "mock" : "success",
          messageId: res.messageId,
          timestamp: new Date(),
        });
      } catch (err: any) {
        item.retryCount++;
        item.lastError = err.message;
        item.status = item.retryCount < item.maxRetries ? "pending" : "failed";
        if (item.status === "failed") failed++;
      }
    }
    return { processed: readyItems.length, sent, failed };
  }

  public static getQueueSummary() {
    return {
      pending: queue.filter((i) => i.status === "pending").length,
      processing: queue.filter((i) => i.status === "processing").length,
      sent: queue.filter((i) => i.status === "sent").length,
      failed: queue.filter((i) => i.status === "failed").length,
      total: queue.length,
    };
  }

  public static getDeliveryLogs() {
    return deliveryLogs;
  }
}

// ─── API HANDLER ───────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    let body: any = {};
    if (req.body) {
      body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    }

    const action = (req.query.action as string) || body.action || "status";

    if (action === "status") {
      const summary = MarketingQueueManager.getQueueSummary();
      const subscribers = Array.from(subscribersStore.values());
      return res.status(200).json({
        success: true,
        engine: "Making Studio (Re'natural 本質開花マーケティング基盤)",
        version: "2.0.0",
        status: "ONLINE",
        queue: summary,
        totalSubscribers: subscribers.length,
        stepSeriesCount: STEP_EMAIL_SERIES_9.length,
        timestamp: new Date().toISOString(),
      });
    }

    if (action === "subscribe") {
      const { email, name, tags, segments } = body;
      if (!email) return res.status(400).json({ success: false, error: "email is required" });
      const sub = subscribeSubscriber(email, name, tags, segments);
      return res.status(200).json({ success: true, subscriber: sub });
    }

    if (action === "unsubscribe") {
      const { email } = body;
      if (!email) return res.status(400).json({ success: false, error: "email is required" });
      const ok = unsubscribeSubscriber(email);
      return res.status(200).json({ success: ok, message: ok ? "Unsubscribed" : "Subscriber not found" });
    }

    if (action === "importCsv") {
      const { csvContent } = body;
      if (!csvContent) return res.status(400).json({ success: false, error: "csvContent is required" });
      const subs = parseBizCreateCSV(csvContent);
      subs.forEach((s) => subscribeSubscriber(s.email, s.name, s.tags, s.segments));
      return res.status(200).json({ success: true, imported: subs.length, subscribers: subs });
    }

    if (action === "enqueue") {
      const { recipients, message, category, scheduledAt } = body;
      if (!recipients || !message) return res.status(400).json({ success: false, error: "recipients and message are required" });
      const items = MarketingQueueManager.enqueueBroadcast(recipients, message, category || "general", scheduledAt ? new Date(scheduledAt) : undefined);
      return res.status(200).json({ success: true, queuedItems: items });
    }

    if (action === "processQueue") {
      const result = await MarketingQueueManager.processQueue();
      return res.status(200).json({ success: true, result });
    }

    if (action === "getLogs") {
      const logs = MarketingQueueManager.getDeliveryLogs();
      return res.status(200).json({ success: true, logs });
    }

    return res.status(400).json({ success: false, error: `Unknown action: ${action}` });
  } catch (err: any) {
    console.error("[MakingStudio API] Error:", err);
    return res.status(500).json({ success: false, error: err.message || "Internal server error" });
  }
}
