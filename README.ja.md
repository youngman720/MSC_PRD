# Indie Weekly

インディーズ寄りのバンドの話題曲を毎週自動で紹介する静的サイトです。GitHub Pagesで公開され、GitHub Actionsのcronジョブで毎週更新されます。

（English version: [README.md](README.md)）

## 「日本のインディーズ寄りバンド」の判定基準（v2）

現在はサイトの対象を**日本のバンドに限定**しています。データソースは [Spincoaster](https://spincoaster.com/)（`config/blogs.json`）で、新人・インディー寄りのアーティストを扱う編集方針を持ち、更新頻度も高い（1日あたり複数投稿）日本の音楽メディアです。

- Spincoasterが `lookbackDays`（デフォルト14日、設定変更可）以内に投稿し、かつ**新曲リリース告知特有の書き方**（「新曲」「ニューシングル」「シングル」「コラボ曲」「楽曲」の直後にカーリークォート（“…”）で曲名が続く形式）に一致した投稿のみを対象とします。Spincoasterはアルバム/EP/イベント名には『』を、曲名には“…”を使い分ける傾向があるため、この判定によりツアー告知・フェス出演・アルバムのみの投稿を自然に除外できます。
- **国籍フィルター（ヒューリスティック）:** Spincoasterは日本と海外の両方のアーティストを同じフィードで扱っているため、`config/blogs.json` の `excludeKeywords`（国名・都市名・「来日」など）のいずれかが見出しに含まれる投稿は海外アーティストとみなして除外しています。これは完全な国籍判定ではなく、あくまでキーワードによる簡易フィルターです。誤って除外してしまう場合（日本人アーティストの投稿に海外コラボ相手の国名が含まれるケースなど）や、逆に見逃してしまう場合（地名が書かれていない海外アーティスト）の両方があり得ます。気づいた範囲でリストを調整してください。
- ランキングは「何件の異なるソースで取り上げられたか」→「掲載の新しさ」の順ですが、現状ソースが1つしかないため、実質的には新しさ順になっています。

**50曲という目標について:** `maxSongsPerWeek` は50に設定していますが、これは上限であって保証ではありません。実際の件数はSpincoasterがその期間内に何件の対象記事を出すか次第です。テストでは週15〜20件程度でした。50件に近づけたい場合は、同様の新曲告知フォーマットを持つ日本の音楽メディアを `config/blogs.json` に追加してください（追加する際は、その媒体の見出し形式が `scripts/lib/extract.js` のパターンに合うか要確認、合わなければ新しいパターンの追加が必要です）。

これはあくまでヒューリスティック（経験則）であり、厳密なルールではありません。後からブラッシュアップしたいとのことでしたので、調整しやすい箇所は主に以下の2つです。
- `config/blogs.json` — ブログの追加・削除、`lookbackDays`・`maxSongsPerWeek`・`excludeKeywords`・`newcomerKeywords`・`popularWithinDays`・`snsKeywords`・`snsBuzzRatioThreshold` の変更
- `scripts/lib/extract.js` — 見出しから「アーティスト名」と「曲名」を抽出する正規表現パターン（日本語の投稿形式向けは `JP_ARTIST_TITLE`/`extractJpArtist`。`ARTIST_TITLE_DASH`/`ARTIST_SHARE_TITLE` は元々の英語ブログ向けパターンで、日本語が含まれる見出しには発動しないようガードしてあります）

## サイト上のカテゴリ分け

1つの縦長リストではなく、4つのタブに分けて表示しています（`🔥 急上昇` / `🎓 大学生世代に人気` / `🌱 若手バンド` / `⭐ いま売れている`）。ページ内で切り替えでき、再読み込みは不要です（素のCSS/JSのみ、フレームワーク不使用）。

各曲は**必ずどれか1つのタブにのみ**表示されます（複数タブに重複しません）。カテゴリは優先順位付きで割り当てており、若手バンド → 大学生世代に人気 → 急上昇 → いま売れている、の順に対象曲を確保していきます（`scripts/build_site.js` の `categorize()`）。より狭く・該当しにくい条件を先に確保し、「いま売れている」は残りを埋める形の受け皿的な位置づけです。曲数が少ない週は、他のカテゴリで既に確保され尽くしてしまい「いま売れている」タブが空になることもありますが、想定通りの挙動です。

- **🔥 急上昇**：YouTubeの「再生速度」（再生数 ÷ 動画公開からの経過日数）でランキングした、伸びの速さを示す指標です。`YOUTUBE_API_KEY`（下記）が必要で、未設定の場合はその旨のメッセージを表示します。
- **🎓 大学生世代に人気**：YouTubeもTikTokも、第三者が視聴者の年齢層を取得できるAPIを提供していないため、直接判定する方法がありません。代わりに以下のいずれかを満たす曲を対象にしています。(a) 記事見出しにSNS/バズ系キーワード（`config/blogs.json` の `snsKeywords`。例：Z世代/TikTok/バズ/バイラル）が含まれる、または (b) 「再生速度 ÷ チャンネル登録者数」の比率が `snsBuzzRatioThreshold`（デフォルト0.5）以上である（＝そのチャンネルの登録者数から予想される範囲を超えて再生されている状態。TikTok/SNS経由で既存ファン層を超えて拡散した曲によく見られる兆候です）。この比率順にランキングします。
- **🌱 若手バンド**：「バンドの結成年」を機械的に取得できる信頼できる無料データソースがないため、代理指標として使っています。記事見出しにデビュー系キーワード（`config/blogs.json` の `newcomerKeywords`。例：デビュー/初シングル/1stアルバム 等）が含まれる投稿を対象にしており、「結成5年以内」を厳密に判定しているわけではありません。
- **⭐ いま売れている**：YouTube動画の公開日が `popularWithinDays`（デフォルト365日、設定変更可）以内の曲を、再生数の絶対値でランキングしたものです。こちらも `YOUTUBE_API_KEY` が必要です。

**TikTok**についても実データソースとして検討しましたが、公式APIは企業審査が必要で個人利用では実質使えず、スクレイピングは規約違反かつ不安定なため、実際の再生数データの代わりに各曲へTikTok検索リンク（`tiktokUrl`）を付与するだけに留めています。

### YouTubeの統計情報（再生数・登録者数）を有効にする

下記のYouTube投稿用OAuth設定とは別の、もっと簡単な認証情報です。同意画面不要の、読み取り専用のAPIキーだけで動きます。

1. [Google Cloud Console](https://console.cloud.google.com/)（下記と同じプロジェクトでOK）で **APIs & Services → Library** から「**YouTube Data API v3**」を検索して有効化する。
2. **APIs & Services → Credentials → + CREATE CREDENTIALS → API key** でAPIキーを作成する。
3. （推奨）作成したキーを「YouTube Data API v3」のみに制限する。
4. パイプライン実行時に環境変数として設定する：`YOUTUBE_API_KEY=xxx npm run fetch`（`npm run weekly` を使う場合も同様に、実行環境の環境変数として設定してください。例：タスクスケジューラのアクション設定）。

このキーがなくても `fetch_songs.js` 自体は問題なく動きます。各曲の `youtube` フィールドが `null` になり、急上昇/いま売れている セクションには未設定の旨が表示されるだけです。

**クォータについて:** 動画IDが見つからなかった曲1件につきYouTubeの`search`呼び出しが1回発生し、これは100クォータ消費します（無料枠は1日10,000）。1日あたり100件程度までは安全な範囲です。動画/チャンネル情報の取得はまとめて行うためほとんど消費しません。

## 仕組み

```
config/blogs.json                     ブログRSSフィードの一覧と各種設定値（blogs, lookbackDays, maxSongsPerWeek, excludeKeywords, newcomerKeywords, popularWithinDays, snsKeywords, snsBuzzRatioThreshold）
scripts/fetch_songs.js                フィード取得 → アーティスト/曲名抽出 → フィルタ → ランキング → YouTube統計情報付与 → data/weekly/<月曜日>.json に書き出し
scripts/lib/youtube_stats.js          読み取り専用のYouTube Data APIクライアント（再生数/登録者数、動画検索フォールバック）。YOUTUBE_API_KEY が必要
scripts/build_site.js                 data/weekly/*.json を public/（静的HTML、上記4カテゴリのタブUIに分割）に変換
scripts/upload_youtube_playlist.js    その週の曲をYouTubeプレイリストとして投稿（詳細は下記）
scripts/weekly_local_run.js           ローカル用一括実行スクリプト：fetch → build → commit → push → deploy → （任意）YouTube投稿
.github/workflows/weekly-update.yml   GitHub Actions版の同等スクリプト（現在は未使用、下記参照）
```

**既知の制限:** RSSフィードには通常、記事の短い抜粋しか含まれないため、元記事に埋め込まれたYouTube動画がフィードの内容に含まれないことがあります。動画が検出できなかった曲は「YouTubeで検索」リンクの表示になります。

## 公開方法について：GitHub ActionsではなくローカルPCから実行

このGitHubアカウントではActionsの実行がブロックされてしまったため（`queued`のまま進まない／`Startup failure` — ワークフローファイル自体の問題ではなく、新規アカウントに対する不正利用防止の審査待ちと思われる）、現在は以下の運用にしています。

- **公開方法:** GitHub Pagesの Source を **Deploy from a branch** → `gh-pages` に設定（**Settings → Pages** で一度だけ設定）。
- **更新方法:** `npm run weekly` をローカルで実行するか、**Windowsのタスクスケジューラ**で毎週自動実行するように設定。fetch → build → commit → push → `npm run deploy`（`gh-pages` パッケージで `public/` を `gh-pages` ブランチにpublish）→ （任意で）YouTube投稿、まで一括で行います。
- `.github/workflows/weekly-update.yml` は、将来このアカウントでActionsが使えるようになった場合に備えてリポジトリに残していますが、現時点では使われていません。

## ローカルでの開発

```
npm install
npm run fetch     # data/weekly/<月曜日>.json を書き出す
npm run build     # public/ を生成 — public/index.html をブラウザで開いて確認
npm run deploy    # public/ を gh-pages ブランチにpublish
npm run weekly    # 上記すべて＋git commit/pushを一括実行
```

## YouTube自動投稿（現在は未有効化）

アップロード用スクリプト（`scripts/upload_youtube_playlist.js`）は実装済みで、毎週のワークフローにも組み込まれていますが、認証情報を設定するまでは**安全に何もせずスキップ**します。設定が完了するまで投稿は一切行われません。

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成し、**YouTube Data API v3** を有効化する。
2. **OAuth同意画面**を設定する（外部向けで問題ありません。アプリが「テスト中」ステータスのままの場合は、自分のGoogleアカウントをテストユーザーとして追加してください）。
3. **Desktopアプリ**タイプの**OAuthクライアントID**を作成する。クライアントIDとクライアントシークレットを控えておく。
4. ローカル環境で（CI上では実行しないこと）以下を実行する。
   ```
   YOUTUBE_CLIENT_ID=xxx YOUTUBE_CLIENT_SECRET=yyy npm run get-youtube-token
   ```
   表示されたURLを開き、**プレイリストを投稿したいYouTubeチャンネル/アカウント**でログインしてアクセスを許可する。スクリプトが `refresh_token` を表示します。
5. GitHubリポジトリの **Settings → Secrets and variables → Actions** で以下を追加する。
   - `YOUTUBE_CLIENT_ID`
   - `YOUTUBE_CLIENT_SECRET`
   - `YOUTUBE_REFRESH_TOKEN`
6. ワークフローを再実行する（または次の月曜を待つ）。`Indie Weekly – <日付>` という名前のプレイリストが、デフォルトでは**限定公開（unlisted）**として作成されます（`public` にしたい場合はワークフロー内の `PLAYLIST_PRIVACY` 環境変数を変更してください）。

YouTube動画IDが検出できなかった曲は、投稿時にYouTube検索で代替の動画を探すため、公式動画ではなくファンアップロードや歌詞動画になることがあります。運用開始初期はプレイリストの内容を一度確認することをおすすめします。
