# Making Studio 🌿 Re'natural

Re'natural の配信・subscriber運用・segment運用を担う独立UIです。

## Architecture

Making Studioは独自の顧客DB・in-memory queue・直接SendGrid送信を持ちません。
同一originの `/api/making-studio` proxyが、Ownerの `admin_session` を
WonderLandのcanonical APIへ限定転送します。Customer / consent / queue /
delivery attemptの正本はcanonical DBです。

```text
Browser
  -> making-studio /api/making-studio
  -> CANONICAL_API_URL/api/making-studio
  -> canonical DB / durable queue / SendGrid adapter
```

## Environment

```text
CANONICAL_API_URL=https://<wonderland-canonical-host>
```

`CANONICAL_API_URL` 未設定、Owner sessionなし、またはcanonical API到達不能時は
fail-closedします。SendGrid key・DB credential・JWT secretをこのrepoへ置かないでください。

## 主な機能

- リッチメッセージ作成・テスト配信
- 全9話ステップメール運用
- BizCreate CSVインポート
- durable queue / delivery attemptの運用確認
- React + Tailwind UI
