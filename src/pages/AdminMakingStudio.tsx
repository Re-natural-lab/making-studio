import React, { useState, useEffect } from "react";

interface QueueSummary {
  pending: number;
  processing: number;
  sent: number;
  failed: number;
  total: number;
}

interface StepItem {
  stepNumber: number;
  delayDays: number;
  title: string;
  category: string;
}

interface CustomerRow {
  id: number;
  primaryEmail: string;
  displayName?: string | null;
  status: "active" | "merged" | "deleted";
  createdAt: string;
  subscription?: {
    status: "subscribed" | "unsubscribed" | "bounced" | "complained";
    source: string;
    updatedAt: string;
  } | null;
}

interface CustomerDetail {
  customer: CustomerRow;
  subscriptions: any[];
  consentEvents: any[];
  tags: any[];
  segments: any[];
  entitlements: any[];
  communication: {
    threads: any[];
    messages: any[];
    jobs: any[];
    attempts: any[];
    providerEvents: any[];
  };
}

async function readApiResponse(res: Response) {
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success) {
    const message = data?.error || data?.message || `HTTP ${res.status}`;
    throw new Error(message);
  }
  return data;
}

export default function AdminMakingStudio() {
  const [activeTab, setActiveTab] = useState<"queue" | "steps" | "subscribers" | "composer">("queue");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [csvInput, setCsvInput] = useState("");
  const [importResult, setImportResult] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDetail | null>(null);

  // 独立デプロイ後は環境変数で接続先だけ差し替える。
  // 未設定時は現行の安全な管理ルートを維持し、移行中の導線を壊さない。
  const adminConsoleUrl =
    (import.meta.env.VITE_ADMIN_CONSOLE_URL as string | undefined) ||
    "https://renatural-admin-console.vercel.app/";
  const cloudAgentUrl =
    (import.meta.env.VITE_CLOUD_AGENT_URL as string | undefined) ||
    "https://renatural-atelier.vercel.app/";

  // Composer State
  const [testEmail, setTestEmail] = useState("");
  const [testSubject, setTestSubject] = useState("Re'natural より大切なお知らせ");
  const [testHeading, setTestHeading] = useState("心地よい暮らしとオンリーワンの仕組み");
  const [testText, setTestText] = useState("数字を追うのをやめたら、毎日の8割が自由な遊びに変わりました。");
  const [testButtonUrl, setTestButtonUrl] = useState("https://wonderland.renatural.jp/nature-nomad-life");
  const [testButtonText, setTestButtonText] = useState("Nature Nomad Life を見る");
  const [sendResult, setSendResult] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      setConnectionError(null);
      const res = await fetch("/api/making-studio?action=status");
      const data = await readApiResponse(res);
      setStatus(data);
      const logRes = await fetch("/api/making-studio?action=getLogs");
      const logData = await readApiResponse(logRes);
      setLogs(logData.logs || []);
    } catch (err: any) {
      setStatus(null);
      setLogs([]);
      setConnectionError(err?.message || "Canonical APIへ接続できません");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchCustomers = async () => {
    try {
      setCustomerLoading(true);
      setCustomerError(null);
      const params = new URLSearchParams({ action: "listCustomers", limit: "50" });
      if (customerQuery.trim()) params.set("query", customerQuery.trim());
      const res = await fetch(`/api/making-studio?${params.toString()}`);
      const data = await readApiResponse(res);
      setCustomers(data.customers || []);
    } catch (err: any) {
      setCustomers([]);
      setSelectedCustomer(null);
      setCustomerError(err?.message || "顧客一覧を取得できません");
    } finally {
      setCustomerLoading(false);
    }
  };

  const fetchCustomerDetail = async (customerId: number) => {
    try {
      setCustomerLoading(true);
      setCustomerError(null);
      const res = await fetch(`/api/making-studio?action=getCustomer&customerId=${customerId}`);
      const data = await readApiResponse(res);
      setSelectedCustomer(data as CustomerDetail);
    } catch (err: any) {
      setSelectedCustomer(null);
      setCustomerError(err?.message || "顧客詳細を取得できません");
    } finally {
      setCustomerLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "subscribers") fetchCustomers();
  }, [activeTab]);

  const handleProcessQueue = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/making-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "processQueue" }),
      });
      const data = await readApiResponse(res);
      alert(`キュー処理完了: 送信 ${data.result?.sent || 0}件, 失敗 ${data.result?.failed || 0}件`);
      fetchStatus();
    } catch (err: any) {
      alert("処理失敗: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImportCsv = async () => {
    if (!csvInput.trim()) {
      alert("CSVデータを入力してください");
      return;
    }
    try {
      setLoading(true);
      const res = await fetch("/api/making-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "importCsv", csvContent: csvInput }),
      });
      const data = await readApiResponse(res);
      setImportResult(`✅ ${data.imported}件の購読者を正常にインポートしました！`);
      setCsvInput("");
      fetchStatus();
    } catch (err: any) {
      setImportResult(`❌ エラー: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTestSend = async () => {
    if (!testEmail) {
      alert("テスト送信先メールアドレスを入力してください");
      return;
    }
    try {
      setLoading(true);
      const payload = {
        action: "enqueue",
        campaignKey: `making-studio:test:${crypto.randomUUID()}`,
        recipients: [{ email: testEmail, name: "テスト読者" }],
        category: "test_delivery",
        message: {
          subject: testSubject,
          blocks: [
            { type: "heading", content: testHeading, emoji: "🌿" },
            { type: "text", content: testText },
            { type: "button", content: testButtonText, url: testButtonUrl },
          ],
        },
      };
      const res = await fetch("/api/making-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await readApiResponse(res);
      setSendResult("✅ 配信キューへ登録しました。処理結果を確認しています。");
      const processRes = await fetch("/api/making-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "processQueue" }),
      });
      const processData = await readApiResponse(processRes);
      setSendResult(
        `✅ キュー処理完了: 送信 ${processData.result?.sent || 0}件, 失敗 ${processData.result?.failed || 0}件`
      );
      fetchStatus();
    } catch (err: any) {
      setSendResult(`❌ エラー: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const stepSeries: StepItem[] = status?.stepSeries || [
    { stepNumber: 1, delayDays: 0, title: "お久しぶりです。お元気ですか？｜Re'naturalより", category: "renatural_step_1" },
    { stepNumber: 2, delayDays: 1, title: "「売上を追うほど苦しくなった」あの頃の違和感の正体", category: "renatural_step_2" },
    { stepNumber: 3, delayDays: 2, title: "売上が上がって「怖い」と感じた日｜安心ベースと数字の真理", category: "renatural_step_3" },
    { stepNumber: 4, delayDays: 3, title: "『大切にする土台』を決めたら、働く時間が1/5になった話", category: "renatural_step_4" },
    { stepNumber: 5, delayDays: 4, title: "「ファンを作る」のではなく「共鳴する人と出会う」仕組み", category: "renatural_step_5" },
    { stepNumber: 6, delayDays: 5, title: "日常の8割を「遊び」に変える、オンリーワンの設計図", category: "renatural_step_6" },
    { stepNumber: 7, delayDays: 6, title: "数字の奴隷から抜け出し、心で巡るビジネスを創る", category: "renatural_step_7" },
    { stepNumber: 8, delayDays: 7, title: "Re'natural が目指す世界｜あなたがあなたのままで巡る場所", category: "renatural_step_8" },
    { stepNumber: 9, delayDays: 8, title: "【特別なご案内】新しい物語をここから始めませんか？", category: "renatural_step_9" },
  ];

  return (
    <div className="min-h-screen bg-stone-50 p-6 text-stone-900">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* ヘッダー */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🌿</span>
              <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Making Studio</h1>
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800 rounded-full">
                Independent UI
              </span>
            </div>
            <p className="text-sm text-stone-500 mt-1">
              Re'natural 自律型マーケティング＆リッチステップ配信エンジン
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={fetchStatus}
              disabled={loading}
              className="px-3 py-1.5 text-sm bg-white border border-stone-300 rounded-lg hover:bg-stone-50 transition"
            >
              🔄 最新状態に更新
            </button>
            <a
              href={cloudAgentUrl}
              className="px-3 py-1.5 text-sm bg-emerald-700 text-white rounded-lg hover:bg-emerald-600 transition"
            >
              💎 Cloud Agentへ工事依頼
            </a>
            <a
              href={adminConsoleUrl}
              className="px-3 py-1.5 text-sm bg-stone-800 text-white rounded-lg hover:bg-stone-700 transition"
            >
              管理画面へ
            </a>
          </div>
        </div>

        {connectionError && (
          <div
            role="alert"
            aria-live="polite"
            className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
          >
            <strong>Canonical API未接続：</strong> {connectionError}
            <div className="mt-1 text-xs text-amber-800">
              数値を0件として扱わず、Owner認証・本番配線が確認できるまで操作を停止しています。
            </div>
          </div>
        )}

        {/* 状態サマリーカード */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
            <div className="text-xs font-medium text-stone-500">待機中キュー</div>
            <div className="text-2xl font-bold text-amber-600 mt-1">{status ? `${status.queue?.pending || 0} 件` : "—"}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
            <div className="text-xs font-medium text-stone-500">送信完了</div>
            <div className="text-2xl font-bold text-emerald-600 mt-1">{status ? `${status.queue?.sent || 0} 件` : "—"}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
            <div className="text-xs font-medium text-stone-500">登録購読者数</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">{status ? `${status.totalSubscribers || 0} 名` : "—"}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
            <div className="text-xs font-medium text-stone-500">ステップ配信シナリオ</div>
            <div className="text-2xl font-bold text-indigo-600 mt-1">全 {stepSeries.length} 話</div>
          </div>
        </div>

        {/* タブナビゲーション */}
        <div className="flex border-b border-stone-200 gap-2">
          {[
            { id: "queue", label: "📬 配信キュー & ログ" },
            { id: "steps", label: "📜 全9話（現在は閲覧のみ）" },
            { id: "subscribers", label: "👥 顧客集計 & BizCreate移行" },
            { id: "composer", label: "✍️ 単発テスト作成" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
                activeTab === tab.id
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-stone-500 hover:text-stone-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "queue" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
              <h2 className="font-bold text-lg">配信キュー操作</h2>
              <p className="text-sm text-stone-500">
                Canonical APIのdurable queueを処理します。送信資格情報はこのUIに置かず、WonderLand側のserver adapterだけが使用します。
              </p>
              <button
                onClick={handleProcessQueue}
                disabled={loading || !status}
                className="w-full px-4 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-500 disabled:opacity-50"
              >
                {loading ? "処理中..." : "▶ キューを処理する"}
              </button>
            </div>
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
              <h2 className="font-bold text-lg mb-4">最近の配信ログ</h2>
              <div className="space-y-2 max-h-96 overflow-auto">
                {logs.length === 0 ? (
                  <div className="text-sm text-stone-400">まだ配信ログはありません。</div>
                ) : (
                  logs.map((log, idx) => (
                    <div key={log.id || idx} className="text-xs border-b border-stone-100 pb-2">
                      <div className="font-medium">{log.recipient}</div>
                      <div className="text-stone-500">{log.category} / {log.status}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "steps" && (
          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
            <h2 className="font-bold text-lg mb-4">全9話ステップメール</h2>
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              現在はシナリオ一覧の確認画面です。本文編集・話数追加・カテゴリー別シナリオ作成・保存は、まだ接続されていません。
            </div>
            <div className="space-y-3">
              {stepSeries.map((step) => (
                <div key={step.stepNumber} className="p-4 rounded-xl border border-stone-200 flex items-start gap-4">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                    {step.stepNumber}
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{step.title}</div>
                    <div className="text-xs text-stone-500 mt-1">登録から {step.delayDays} 日後 / {step.category}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "subscribers" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
              <h2 className="font-bold text-lg mb-2">BizCreate CSV移行</h2>
              <p className="text-sm text-stone-500 mb-4">CSV本文を貼り付けて購読者をインポートします。</p>
              <textarea
                value={csvInput}
                onChange={(e) => setCsvInput(e.target.value)}
                className="w-full h-52 p-3 text-xs font-mono border border-stone-300 rounded-xl"
                placeholder="email,name,tags\nexample@example.com,山田太郎,tag1;tag2"
              />
              <button
                onClick={handleImportCsv}
                disabled={loading || !status}
                className="mt-3 w-full px-4 py-3 rounded-xl bg-stone-800 text-white font-semibold hover:bg-stone-700 disabled:opacity-50"
              >
                CSVをインポート
              </button>
              {importResult && <div className="mt-3 text-sm">{importResult}</div>}
            </div>
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
              <h2 className="font-bold text-lg mb-2">顧客・購読・行動履歴</h2>
              <p className="text-sm text-stone-500 mb-4">
                Canonical DBの実データをOwner専用APIから読み取ります。検索結果は最大50件です。
              </p>
              <form
                className="flex gap-2 mb-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  fetchCustomers();
                }}
              >
                <input
                  value={customerQuery}
                  onChange={(event) => setCustomerQuery(event.target.value)}
                  placeholder="名前またはメールで検索"
                  className="min-w-0 flex-1 p-2.5 border border-stone-300 rounded-xl text-sm"
                />
                <button
                  type="submit"
                  disabled={customerLoading}
                  className="px-4 rounded-xl bg-stone-800 text-white text-sm disabled:opacity-50"
                >
                  検索
                </button>
              </form>

              {customerError && (
                <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  実データを取得できません：{customerError}
                </div>
              )}

              <div className="space-y-2 max-h-72 overflow-auto">
                {customerLoading && customers.length === 0 ? (
                  <div className="text-sm text-stone-400">読み込み中…</div>
                ) : customers.length === 0 && !customerError ? (
                  <div className="text-sm text-stone-400">該当する顧客はいません。</div>
                ) : (
                  customers.map((customer) => (
                    <button
                      key={customer.id}
                      onClick={() => fetchCustomerDetail(customer.id)}
                      className="w-full rounded-xl border border-stone-200 p-3 text-left hover:border-emerald-400"
                    >
                      <div className="font-medium text-sm">{customer.displayName || "名称未設定"}</div>
                      <div className="text-xs text-stone-500 break-all">{customer.primaryEmail}</div>
                      <div className="mt-1 text-xs text-stone-600">
                        顧客: {customer.status} ／ 購読: {customer.subscription?.status || "記録なし"}
                      </div>
                    </button>
                  ))
                )}
              </div>

              {selectedCustomer && (
                <div className="mt-5 border-t border-stone-200 pt-4 space-y-3 text-sm">
                  <div>
                    <div className="font-bold">{selectedCustomer.customer.displayName || "名称未設定"}</div>
                    <div className="text-stone-500 break-all">{selectedCustomer.customer.primaryEmail}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-stone-50 p-2">購読履歴 <strong>{selectedCustomer.subscriptions.length}</strong></div>
                    <div className="rounded-lg bg-stone-50 p-2">同意履歴 <strong>{selectedCustomer.consentEvents.length}</strong></div>
                    <div className="rounded-lg bg-stone-50 p-2">タグ <strong>{selectedCustomer.tags.length}</strong></div>
                    <div className="rounded-lg bg-stone-50 p-2">セグメント <strong>{selectedCustomer.segments.length}</strong></div>
                    <div className="rounded-lg bg-stone-50 p-2">購入権限 <strong>{selectedCustomer.entitlements.length}</strong></div>
                    <div className="rounded-lg bg-stone-50 p-2">連絡スレッド <strong>{selectedCustomer.communication.threads.length}</strong></div>
                    <div className="rounded-lg bg-stone-50 p-2">メッセージ <strong>{selectedCustomer.communication.messages.length}</strong></div>
                    <div className="rounded-lg bg-stone-50 p-2">開封・クリック等 <strong>{selectedCustomer.communication.providerEvents.length}</strong></div>
                  </div>
                  {selectedCustomer.tags.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-stone-500 mb-1">タグ</div>
                      <div className="flex flex-wrap gap-1">
                        {selectedCustomer.tags.map((entry, index) => (
                          <span key={entry.tag?.id || index} className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-800">
                            {entry.tag?.name || entry.tag?.slug}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedCustomer.communication.providerEvents.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-stone-500 mb-1">最近の行動</div>
                      <div className="space-y-1 max-h-32 overflow-auto text-xs">
                        {selectedCustomer.communication.providerEvents.slice(0, 20).map((event) => (
                          <div key={event.id} className="flex justify-between gap-2 border-b border-stone-100 py-1">
                            <span>{event.eventType}</span>
                            <span className="text-stone-400">{new Date(event.occurredAt).toLocaleString("ja-JP")}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "composer" && (
          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
            <h2 className="font-bold text-lg">単発リッチメッセージ テスト送信</h2>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              ここで作る内容は単発テスト用です。テンプレートやステップシナリオとしての保存・再編集は、まだ接続されていません。
            </div>
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="送信先メールアドレス"
              className="w-full p-3 border border-stone-300 rounded-xl"
            />
            <input
              value={testSubject}
              onChange={(e) => setTestSubject(e.target.value)}
              placeholder="件名"
              className="w-full p-3 border border-stone-300 rounded-xl"
            />
            <input
              value={testHeading}
              onChange={(e) => setTestHeading(e.target.value)}
              placeholder="見出し"
              className="w-full p-3 border border-stone-300 rounded-xl"
            />
            <textarea
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              rows={5}
              placeholder="本文"
              className="w-full p-3 border border-stone-300 rounded-xl"
            />
            <input
              value={testButtonText}
              onChange={(e) => setTestButtonText(e.target.value)}
              placeholder="ボタン文言"
              className="w-full p-3 border border-stone-300 rounded-xl"
            />
            <input
              value={testButtonUrl}
              onChange={(e) => setTestButtonUrl(e.target.value)}
              placeholder="ボタンURL"
              className="w-full p-3 border border-stone-300 rounded-xl"
            />
            <button
              onClick={handleTestSend}
              disabled={loading || !status}
              className="w-full px-4 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-500 disabled:opacity-50"
            >
              {loading ? "送信中..." : "テスト送信する"}
            </button>
            {sendResult && <div className="text-sm">{sendResult}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
