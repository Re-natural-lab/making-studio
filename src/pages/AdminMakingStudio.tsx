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

export default function AdminMakingStudio() {
  const [activeTab, setActiveTab] = useState<"queue" | "steps" | "subscribers" | "composer">("queue");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [csvInput, setCsvInput] = useState("");
  const [importResult, setImportResult] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);

  // Composer State
  const [testEmail, setTestEmail] = useState("");
  const [testSubject, setTestSubject] = useState("Re'natural より大切なお知らせ");
  const [testHeading, setTestHeading] = useState("心地よい暮らしとオンリーワンの仕組み");
  const [testText, setTestText] = useState("数字を追うのをやめたら、毎日の8割が自由な遊びに変わりました。");
  const [testButtonUrl, setTestButtonUrl] = useState("https://renatural.org/nature-nomad-life");
  const [testButtonText, setTestButtonText] = useState("Nature Nomad Life を見る");
  const [sendResult, setSendResult] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/making-studio?action=status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
      const logRes = await fetch("/api/making-studio?action=getLogs");
      if (logRes.ok) {
        const logData = await logRes.json();
        setLogs(logData.logs || []);
      }
    } catch (err) {
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
      const data = await res.json();
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
      const data = await res.json();
      if (data.success) {
        setImportResult(`✅ ${data.imported}件の購読者を正常にインポートしました！`);
        setCsvInput("");
        fetchStatus();
      } else {
        setImportResult(`❌ インポート失敗: ${data.error}`);
      }
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
      const data = await res.json();
      if (data.success) {
        setSendResult("✅ 配信キューに登録しました。まもなく送信されます。");
        await fetch("/api/making-studio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "processQueue" }),
        });
        fetchStatus();
      } else {
        setSendResult(`❌ 登録失敗: ${data.error}`);
      }
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
                Standalone Live
              </span>
            </div>
            <p className="text-sm text-stone-500 mt-1">
              Re'natural 自律型マーケティング＆リッチステップ配信エンジン
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchStatus}
              disabled={loading}
              className="px-3 py-1.5 text-sm bg-white border border-stone-300 rounded-lg hover:bg-stone-50 transition"
            >
              🔄 最新状態に更新
            </button>
            <a
              href="https://wonderland-renatural.vercel.app/admin"
              className="px-3 py-1.5 text-sm bg-stone-800 text-white rounded-lg hover:bg-stone-700 transition"
            >
              WonderLand TOPへ
            </a>
          </div>
        </div>

        {/* 状態サマリーカード */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
            <div className="text-xs font-medium text-stone-500">待機中キュー</div>
            <div className="text-2xl font-bold text-amber-600 mt-1">{status?.queue?.pending || 0} 件</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
            <div className="text-xs font-medium text-stone-500">送信完了</div>
            <div className="text-2xl font-bold text-emerald-600 mt-1">{status?.queue?.sent || 0} 件</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
            <div className="text-xs font-medium text-stone-500">登録購読者数</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">{status?.totalSubscribers || 0} 名</div>
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
            { id: "steps", label: "📜 全9話ステップ配信" },
            { id: "subscribers", label: "👥 顧客 & BizCreate移行" },
            { id: "composer", label: "✍️ リッチメッセージ作成" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 font-medium text-sm transition border-b-2 -mb-px ${
                activeTab === tab.id
                  ? "border-emerald-600 text-emerald-700 bg-white rounded-t-lg"
                  : "border-transparent text-stone-500 hover:text-stone-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* タブ 1: 配信キュー & ログ */}
        {activeTab === "queue" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-stone-200">
              <div>
                <h3 className="font-bold text-stone-900">配信キュー実行</h3>
                <p className="text-xs text-stone-500">スケジュール時刻に達した未送信メールを一括処理します</p>
              </div>
              <button
                onClick={handleProcessQueue}
                disabled={loading}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium text-sm shadow-sm"
              >
                ▶ 今すぐキューを処理する
              </button>
            </div>

            <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-stone-100 font-bold text-stone-800">配信ログ履歴</div>
              {logs.length === 0 ? (
                <div className="p-8 text-center text-stone-400 text-sm">配信ログはまだありません</div>
              ) : (
                <div className="divide-y divide-stone-100">
                  {logs.map((log, idx) => (
                    <div key={idx} className="p-3 text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded font-semibold ${log.status === "success" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                          {log.status}
                        </span>
                        <span className="font-mono text-stone-700">{log.recipient}</span>
                        <span className="text-stone-400">({log.category})</span>
                      </div>
                      <span className="text-stone-400">{new Date(log.timestamp).toLocaleString("ja-JP")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* タブ 2: 全9話ステップ配信 */}
        {activeTab === "steps" && (
          <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-4 shadow-sm">
            <div>
              <h3 className="font-bold text-stone-900 text-lg">Re'natural 統一ステップメール（全9話）</h3>
              <p className="text-xs text-stone-500 mt-1">登録初日から順次配信される心温まるストーリーシナリオ</p>
            </div>
            <div className="space-y-3">
              {stepSeries.map((step) => (
                <div key={step.stepNumber} className="flex items-start gap-4 p-3 bg-stone-50 rounded-lg border border-stone-100">
                  <div className="w-16 text-center font-bold text-emerald-700 bg-emerald-50 py-1.5 rounded border border-emerald-200">
                    第{step.stepNumber}話
                    <div className="text-[10px] text-stone-500 font-normal">Day {step.delayDays}</div>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm text-stone-800">{step.title}</h4>
                    <p className="text-xs text-stone-500 mt-0.5">カテゴリ: {step.category}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* タブ 3: 顧客 & BizCreate移行 */}
        {activeTab === "subscribers" && (
          <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-6 shadow-sm">
            <div>
              <h3 className="font-bold text-stone-900 text-lg">BizCreate CSV インポート</h3>
              <p className="text-xs text-stone-500 mt-1">BizCreateや他社スタンドからエクスポートしたCSVを貼り付けて一括移行します</p>
            </div>
            <textarea
              value={csvInput}
              onChange={(e) => setCsvInput(e.target.value)}
              placeholder={`メールアドレス,氏名,タグ\nuser1@example.com,山田花子,bizcreate_migrated;product_a\nuser2@example.com,佐藤太郎,bizcreate_migrated`}
              rows={6}
              className="w-full p-3 font-mono text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <div className="flex items-center justify-between">
              <button
                onClick={handleImportCsv}
                disabled={loading}
                className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium text-sm shadow-sm"
              >
                📥 CSVデータを一括インポートする
              </button>
              {importResult && <span className="text-sm font-medium">{importResult}</span>}
            </div>
          </div>
        )}

        {/* タブ 4: リッチメッセージ作成 */}
        {activeTab === "composer" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-4 shadow-sm">
              <h3 className="font-bold text-stone-900 text-lg">リッチメール作成 ＆ テスト配信</h3>
              <div>
                <label className="text-xs font-semibold text-stone-600">件名 (Subject)</label>
                <input
                  type="text"
                  value={testSubject}
                  onChange={(e) => setTestSubject(e.target.value)}
                  className="w-full mt-1 p-2.5 text-sm border border-stone-300 rounded-lg"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-600">見出し (Heading)</label>
                <input
                  type="text"
                  value={testHeading}
                  onChange={(e) => setTestHeading(e.target.value)}
                  className="w-full mt-1 p-2.5 text-sm border border-stone-300 rounded-lg"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-600">本文 (Body Text)</label>
                <textarea
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                  rows={4}
                  className="w-full mt-1 p-2.5 text-sm border border-stone-300 rounded-lg"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-600">CTAボタン表示名 ＆ リンクURL</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <input
                    type="text"
                    value={testButtonText}
                    onChange={(e) => setTestButtonText(e.target.value)}
                    placeholder="ボタン文字"
                    className="p-2.5 text-sm border border-stone-300 rounded-lg"
                  />
                  <input
                    type="text"
                    value={testButtonUrl}
                    onChange={(e) => setTestButtonUrl(e.target.value)}
                    placeholder="https://..."
                    className="p-2.5 text-sm border border-stone-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="border-t border-stone-100 pt-4">
                <label className="text-xs font-semibold text-stone-600">テスト送信先メールアドレス</label>
                <div className="flex gap-2 mt-1">
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="info@renatural.org"
                    className="flex-1 p-2.5 text-sm border border-stone-300 rounded-lg"
                  />
                  <button
                    onClick={handleTestSend}
                    disabled={loading}
                    className="px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium text-sm"
                  >
                    🚀 テスト送信
                  </button>
                </div>
                {sendResult && <p className="text-xs font-medium text-stone-600 mt-2">{sendResult}</p>}
              </div>
            </div>

            {/* プレビュー表示 */}
            <div className="bg-stone-100 rounded-xl border border-stone-300 p-6 flex flex-col justify-start">
              <div className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">メールプレビュー</div>
              <div className="bg-white rounded-lg p-6 shadow-sm border border-stone-200 space-y-4">
                <h2 className="text-xl font-bold text-stone-900 border-b border-stone-100 pb-2">🌿 {testHeading}</h2>
                <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">{testText}</p>
                <div className="pt-2 text-center">
                  <a
                    href={testButtonUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block bg-blue-700 text-white font-bold px-6 py-3 rounded-full text-sm shadow hover:bg-blue-800 transition"
                  >
                    {testButtonText}
                  </a>
                </div>
                <div className="border-t border-stone-100 pt-4 text-center text-[11px] text-stone-400">
                  ※本メールは Re'natural のご案内をお届けしています。<br />
                  <span className="underline cursor-pointer">こちらからワンクリックで解除</span> できます。
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
