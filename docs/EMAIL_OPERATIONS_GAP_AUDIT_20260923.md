# Making Studio メール運用ギャップ監査（2026-09-23）

## 結論

Making Studio は、現時点では「完成したメールマーケティング運用画面」ではない。
単発テスト配信、キュー処理、配信ログ、購読者数、BizCreate CSV移行、固定9話の表示は存在する。
一方、Ownerが日常運用で必要とする編集・分類・対象者抽出・個人履歴確認は未接続である。

このため、メール運用機能はオープン後対応ではなく、マイルーム登録と同時に連絡先が発生する前のP0とする。

## 実装状況

| Ownerが必要とする操作 | 現在地 | 根拠 | 判定 |
| --- | --- | --- | --- |
| ステップメールを開いて編集 | 9話を静的なカードとして表示。クリック処理、編集フォーム、保存APIなし | `src/pages/AdminMakingStudio.tsx` | 未実装 |
| 複数シナリオをカテゴリー別に管理 | `renatural_step_1` から `renatural_step_9` の固定配列のみ | UIおよびcanonical `stepSeries.ts` | 未実装 |
| NNL / Only One Life Design / AI等を分ける | 任意のカテゴリー名で単発送信キューへ登録は可能だが、シナリオ管理画面なし | enqueue API | 部分実装 |
| 購読者の個人一覧 | 登録人数だけ表示。個人行、検索、詳細画面なし | `AdminMakingStudio.tsx` | 未実装 |
| タグ・セグメントで絞り込む | canonical DBにタグ・セグメント表はあるが、Making Studio API/UIに一覧・編集なし | `marketing_tags`, `marketing_segments` | 基盤のみ |
| 購入済み／未購入で絞り込む | canonical DBに entitlement / order の器はあるが、メール画面に結合なし | canonical schema | 基盤のみ |
| 何を受信したかを個人別に確認 | 配信ジョブと配信試行は保存可能。個人タイムラインUIなし | `communication_jobs`, `communication_attempts` | 基盤のみ |
| 開封／未開封、クリック有無を確認 | provider event表は open / click を表現できるが、取込経路と閲覧UIが未完成 | `communication_provider_events` | 基盤のみ |
| 登録時に所定シナリオへ自動登録 | 固定9話を生成する旧ロジックはあるが、canonical durable運用との接続とシナリオ選択が未完成 | Making Studio core | 未完成 |
| 配信停止・同意履歴 | canonical購読状態・同意イベントの器と処理あり | `marketing_subscriptions`, `marketing_consent_events` | 基盤あり |

## オープン前P0の受け入れ条件

### 1. シナリオ編集

- シナリオを新規作成、複製、下書き保存、公開停止できる。
- カテゴリーを `NNL`、`Only One Life Design`、`AI` など任意に作成できる。
- 各シナリオに複数話を追加し、件名、本文、送信間隔、順序を編集できる。
- 公開中の版を履歴として残し、編集中の下書きと分離する。

### 2. 購読者・セグメント

- 個人一覧を検索できる。
- 購読状態、タグ、所属シナリオ、購入権利で絞り込める。
- 「購入済み／未購入」「シナリオ受信済み／未受信」を保存条件として使える。
- 個人詳細で同意、配信、失敗、開封、クリック、購入を時系列表示する。

### 3. 登録・自動配信

- マイルーム登録または購入イベントを、明示したルールに従ってシナリオへ登録する。
- 二重登録・二重送信をidempotency keyで防止する。
- 配信停止、bounce、complaintを以後の送信前に必ず再確認する。
- 本番送信前にOwnerが対象件数、除外件数、1通目の内容を確認できる。

### 4. 計測

- SendGrid等のprovider eventを署名検証付きで受け取る。
- delivered / bounce / complaint / open / click / unsubscribeをcanonical customerへ関連付ける。
- 開封はメールクライアントのプライバシー機能で不正確になり得ることを画面に明記する。

## 安全な実装順

1. 編集可能なシナリオ、版、ステップのDB契約とAPIを追加する。
2. Making Studioにシナリオ一覧・編集・下書き保存を接続する。
3. 購読者一覧、タグ／セグメント、個人履歴のread-only画面を接続する。
4. 購入権利・受信履歴を条件にした保存セグメントを追加する。
5. 登録イベントからの自動登録、予約キュー生成を接続する。
6. provider event取込と開封／クリック表示を接続する。
7. テストデータでE2Eし、Owner承認後に本番送信を有効化する。

## 境界

- 本監査では本番メール送信、本番データ変更、DB migration適用、資格情報変更を行わない。
- UIだけを先に作り、保存できるように見せることはしない。
- 配信開始・対象者確定・公開シナリオ本文の承認はOwner判断とする。
