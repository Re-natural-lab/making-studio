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
            <h2 className="font-bold text-lg mb-4">全9話ステップメール</h2>\n            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">\n              現在はシナリオ一覧の確認画面です。本文編集・話数追加・カテゴリー別シナリオ作成・保存は、まだ接続されていません。\n            </div>
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
              <h2 className="font-bold text-lg mb-2">購読者・セグメント状態</h2>\n              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">\n                現在は登録人数の集計のみです。個人一覧・タグ／セグメント絞り込み・購入状況・配信／開封／クリック履歴は、まだこの画面に接続されていません。\n              </div>
              <div className="text-sm text-stone-600 space-y-2">
                <p>登録購読者数: <strong>{status?.totalSubscribers || 0}</strong></p>
                <p>タグ・セグメント情報は API 側の MarketingSubscriber に保持されます。</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "composer" && (
          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
            <h2 className="font-bold text-lg">単発リッチメッセージ テスト送信</h2>\n            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">\n              ここで作る内容は単発テスト用です。テンプレートやステップシナリオとしての保存・再編集は、まだ接続されていません。\n            </div>
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
