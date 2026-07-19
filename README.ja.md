# Indie Weekly

インディーズ寄りのバンドの話題曲を毎週自動で紹介する静的サイトです。GitHub Pagesで公開され、GitHub Actionsのcronジョブで毎週更新されます。

（English version: [README.md](README.md)）

## 「インディーズ寄り」の判定基準（v1）

「インディーズ」というジャンルを厳密に判定できるAPIは存在しないため、ジャンルタグではなく構造的な基準で定義しています。

- **`config/blogs.json` に登録した、独立系（インディー系）に特化した音楽ブログで取り上げられた曲のみ**を対象とします（現在のリストは Gorilla vs. Bear、So Young Magazine、The Line of Best Fit、Beats Per Minute、Brooklyn Vegan）。これらは、メジャーレーベルのプロモーションではなく、新人・未契約・小規模レーベルのアーティストを中心に扱っているブログとして選定しました。
- 「最近話題」＝ `lookbackDays`（デフォルト10日、設定変更可）以内にいずれかのブログで取り上げられたこと。ランキングは以下の順:
  1. 何件の異なるブログで取り上げられたか（複数ブログでの言及＝裏付け）
  2. 掲載の新しさ
- Stereogumはテストの結果、デフォルトのブログリストから意図的に除外しました。メインフィードがMartin Garrix、Leon Bridges、The Killersなど、メジャー系・一般的な音楽ニュースを広く扱いすぎており、このフィルターには合わないと判断したためです。

これはあくまでヒューリスティック（経験則）であり、厳密なルールではありません。後からブラッシュアップしたいとのことでしたので、調整しやすい箇所は主に以下の2つです。
- `config/blogs.json` — ブログの追加・削除、`lookbackDays` や `maxSongsPerWeek` の変更
- `scripts/lib/extract.js` — ブログ記事の見出しから「アーティスト名」と「曲名」を抽出する正規表現パターン

## 仕組み

```
config/blogs.json                     ブログRSSフィードの一覧と各種設定値
scripts/fetch_songs.js                フィード取得 → アーティスト/曲名抽出 → ランキング → data/weekly/<月曜日>.json に書き出し
scripts/build_site.js                 data/weekly/*.json を public/（静的HTML）に変換
scripts/upload_youtube_playlist.js    その週の曲をYouTubeプレイリストとして投稿（詳細は下記）
.github/workflows/weekly-update.yml   上記を毎週月曜に実行し、データをコミットしてPagesにデプロイ
```

曲の抽出は正規表現によるヒューリスティックです（`"Artist – Title"` や `"Artist announce ..., share new single 'Title'"` のようなブログ見出しのパターンにマッチさせています）。多少のノイズは想定内で、誤検出・見逃しの修正は `scripts/lib/extract.js` を調整するのが一番簡単です。

**既知の制限:** RSSフィードには通常、記事の短い抜粋しか含まれず全文は含まれないため、元記事に埋め込まれたYouTube動画がフィードの内容に含まれることは稀です。そのため多くの曲は再生可能な埋め込みではなく「YouTubeで検索」リンクの表示になります。記事本文のページを取得して埋め込みを探す方法で改善できますが、現時点では未実装です。

## 初回セットアップ

1. GitHubリポジトリを作成し、このプロジェクトをpushする。
2. リポジトリの **Settings → Pages → Source** を **GitHub Actions** に設定する。
3. これで完了です。ワークフローは毎週月曜03:00 UTCに自動実行されます。すぐに動作確認したい場合は **Actions** タブから **Weekly indie update → Run workflow** で手動実行できます。

## ローカルでの開発

```
npm install
npm run fetch   # data/weekly/<月曜日>.json を書き出す
npm run build   # public/ を生成 — public/index.html をブラウザで開いて確認
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
