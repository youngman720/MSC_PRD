# Indie Weekly

インディーズ寄りのバンドの話題曲を毎週自動で紹介する静的サイトです。GitHub Pagesで公開され、GitHub Actionsのcronジョブで毎週更新されます。

（English version: [README.md](README.md)）

## 「日本のインディーズ寄りバンド」の判定基準（v2）

現在はサイトの対象を**日本のバンドに限定**しています。データソースは4つの日本のRSS音楽メディアと、RSSを持たない情報源1つ（`config/blogs.json`）です：[Spincoaster](https://spincoaster.com/)（インディー/R&B/ヒップホップ寄り）、[ROCKIN'ON JAPAN](https://rockinon.com/)のニュースフィード（より広いロックシーン、大学生に人気のライブハウス系対バンバンドも含む）、[激ロック/Gekirock](https://gekirock.com/)（ハードロック/メタル/ヴィジュアル系寄り）、[BARKS](https://barks.jp/)（広範だが配信件数が少ない）、そして[eggs.mu](https://eggs.mu/)のデイリー楽曲ランキング（RSSがないためスクレイピング、下記参照）。

- **RSSソース**の場合、いずれかが `lookbackDays`（デフォルト21日、設定変更可）以内に投稿し、かつ**これらのメディア共通の新曲リリース告知特有の書き方**（「新曲」「ニューシングル」「シングル」「コラボ曲」「楽曲」の直後に引用符付きで曲名が続く形式）に一致した投稿のみを対象とします。Spincoaster/ROCKIN'ON JAPAN/BARKSは曲名にカーリークォート（“…”）を、Gekirockはかぎ括弧（「…」）を使いますが、両方のパターンに対応しています（`scripts/lib/extract.js` の `JP_ARTIST_TITLE`）。いずれもアルバム/EP/イベント名には『』を使うため、この判定によりツアー告知・フェス出演・アルバムのみの投稿を自然に除外できます。
- **eggs.mu（`scripts/lib/eggs.js`）は性質が異なります**：日本の無名・インディーズ（unsigned）アーティスト専用の配信プラットフォームです（RSSがないため、サーバーサイドレンダリングされたデイリー楽曲ランキングページを、アーティスト/曲名のリンクペアに対する簡易な正規表現で直接スクレイピングしています。ヘッドレスブラウザは不要です）。プラットフォームの性質上、掲載されているアーティストは日本のインディーズであることが構造的に保証されているため、国籍フィルターや新人キーワード判定を一切スキップし、全件を🌱タブ向けの新人として扱っています。今回、🌱若手バンドタブを充実させる上で最も効果が大きかった対応でした（導入前は週1曲程度だったのが、導入後は週10曲程度に）。
- **対バンシーン出演の裏付け＋最低再生数によるフィルタ:** eggs.muには編集部による選定が一切なく（無名アップロード曲の単純な人気ランキング）、eggs.muのみで見つかった曲は本当に無名すぎる場合があります。そこで、各曲のアーティスト名を `config/circuit_artists.json`（実在するライブハウス系サーキットイベントの出演者一覧から作成したアローリスト。現在は「見放題東京2026」と「MINAMI WHEEL 2026」第1弾出演者を収録。ファイル内に出典リンクあり。新しいイベントが発表され次第追加してください）と照合し、一致すれば `inCircuitScene` フラグを立てます（サイト上では「対バンシーン出演実績」バッジとして表示）。**eggs.muのみ**が出典の曲は、`inCircuitScene` が true であるか、YouTube再生数が `eggs.minViewCount`（デフォルト1000）以上でない限り除外されます（この判定には `YOUTUBE_API_KEY` が必要で、未設定の場合は憶測で判断せず、このフィルタ自体をスキップします＝ログに記録）。この判定はeggs.mu単独ソースの曲にのみ適用され、RSSソースでも裏付けが取れている曲には適用されません。
- **国籍フィルター（ヒューリスティック、RSSソースのみ）:** どのRSSフィードも日本と海外の両方のアーティストを扱っているため、`config/blogs.json` の `excludeKeywords`（国名・都市名・「来日」など）のいずれかが見出しに含まれる投稿は海外アーティストとみなして除外しています。これは完全な国籍判定ではなく、あくまでキーワードによる簡易フィルターです。誤って除外してしまう場合（日本人アーティストの投稿に海外コラボ相手の国名が含まれるケースなど）や、逆に見逃してしまう場合（地名が書かれていない海外アーティスト、"MARILYN MANSON"のように国名を伴わない明らかに海外のアーティスト名など）の両方があり得ます。気づいた範囲でリストを調整してください。
- **メジャー/ベテランアーティストの除外（手動の安全策）:** ROCKIN'ON JAPAN、Gekirock、BARKSはいずれも、King Gnu、Ado、Mrs. GREEN APPLE、MARILYN MANSON、GREEN DAY、JO1など大手・海外・アイドル系のメジャーアーティストも同じ新曲告知フォーマットで扱っており、他のフィルターをすべて通過してしまいます。`config/blogs.json` の `excludeArtists` は、そうしたアーティストを名前で直接除外するための単純なブロックリストです。気づいたら追加してください。（下記🎓タブで使っている「再生速度÷登録者数」比率も、登録者数が非常に多いアーティストの比率を自然に下げる効果がありますが完璧ではありません。YouTube検索フォールバックが誤ったチャンネルの動画を紐付けてしまうと、比率が実態と異なる異常値になることがあり、そこは `excludeArtists` で補っています。）
- ランキングは「何件の異なるソースで取り上げられたか」→「掲載の新しさ」の順です。

**50曲・各タブ10曲という目標について:** `maxSongsPerWeek` は50に設定していますが、これは上限であって保証ではありません。実際の件数はこれらのソースがその期間内に何件の対象記事・ランキングを出すか、そして上記の対バンシーン/最低再生数フィルタを何曲通過するか次第です。eggs.mu追加によりフィルタ適用前の件数は週20件→週35件程度まで増えましたが、フィルタで対バンシーン実績も再生数も基準に満たないeggs.mu単独の曲は除外されます。各曲は1つのタブにしか表示されない仕様（下記カテゴリ参照）なので、4タブ×10曲を満たすには本来週40曲前後のユニークな曲数が必要です。⭐いま売れている（確保の優先順位が最後）は他の3タブに先に曲を取られるため、週によっては依然として手薄・0件になることがあります。これはバグではなく、実際のデータ量の上限によるものです。この最後のギャップを埋めたい場合は、対象フォーマットを持つメディアをさらに追加するか、この特定のタブについて「1曲は1タブのみ」というルールを緩和する必要があります。

これはあくまでヒューリスティック（経験則）であり、厳密なルールではありません。後からブラッシュアップしたいとのことでしたので、調整しやすい箇所は主に以下の2つです。
- `config/blogs.json` — ブログの追加・削除、`lookbackDays`・`maxSongsPerWeek`・`excludeKeywords`・`excludeArtists`・`newcomerKeywords`・`popularWithinDays`・`snsKeywords`・`snsBuzzRatioThreshold`・`eggs.enabled`/`eggs.limit`/`eggs.minViewCount` の変更
- `config/circuit_artists.json` — 新しいサーキットイベントの出演者一覧が発表され次第、アローリストに追加してください（アーティスト名はイベント側の表記そのまま。大文字小文字・空白は無視されますが、それ以外は完全一致で照合するので表記ゆれに注意）
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
4. GitHubリポジトリのSecretsに追加する：**Settings → Secrets and variables → Actions → New repository secret**、名前は `YOUTUBE_API_KEY`。ワークフロー側は既にfetchステップへ渡す設定済みです。ローカルで実行する場合は環境変数として設定してください：`YOUTUBE_API_KEY=xxx npm run fetch`。

このキーがなくても `fetch_songs.js` 自体は問題なく動きます。各曲の `youtube` フィールドが `null` になり、急上昇/いま売れている セクションには未設定の旨が表示されるだけです。

**クォータについて:** 動画IDが見つからなかった曲1件につきYouTubeの`search`呼び出しが1回発生し、これは100クォータ消費します（無料枠は1日10,000）。1日あたり100件程度までは安全な範囲です。動画/チャンネル情報の取得はまとめて行うためほとんど消費しません。開発中のように`npm run fetch`を1日に何度も実行するとクォータを使い切ることがあり（この開発中に実際に発生しました）、その場合は検索が失敗してその曲の`youtube`が`null`のままになりますが、クォータは（おおむね1日単位で）自動的にリセットされるので、特に対応は不要です。

## 仕組み

```
config/blogs.json                     RSSフィードの一覧と各種設定値（blogs, lookbackDays, maxSongsPerWeek, excludeKeywords, excludeArtists, newcomerKeywords, popularWithinDays, snsKeywords, snsBuzzRatioThreshold, eggs）
config/circuit_artists.json           実在のサーキットイベント出演者一覧から作成したアローリスト。eggs.mu単独の曲の裏付けに使用
scripts/fetch_songs.js                RSSフィード取得 + eggs.muランキング取得 → アーティスト/曲名抽出 → フィルタ → ランキング → YouTube統計情報付与 → eggs.mu単独曲の品質フィルタ適用 → data/weekly/<月曜日>.json に書き出し
scripts/lib/eggs.js                   eggs.muのデイリー楽曲ランキングをスクレイピング（RSSなし）。日本の無名アーティスト専用プラットフォームのため常に新人扱い
scripts/lib/youtube_stats.js          読み取り専用のYouTube Data APIクライアント（再生数/登録者数、動画検索フォールバック）。YOUTUBE_API_KEY が必要
scripts/build_site.js                 data/weekly/*.json を public/（静的HTML、上記4タブに分割）に変換
scripts/upload_youtube_playlist.js    その週の曲をYouTubeプレイリストとして投稿（詳細は下記）
scripts/weekly_local_run.js           ローカル用一括実行スクリプト（手動フォールバックとして保持。下記参照）：fetch → build → commit → push → deploy → （任意）YouTube投稿
.github/workflows/weekly-update.yml   GitHub Actions版の同等スクリプト（現在の自動実行の本体）
```

**既知の制限:** RSSフィードには通常、記事の短い抜粋しか含まれないため、元記事に埋め込まれたYouTube動画がフィードの内容に含まれないことがあります。動画が検出できなかった曲は「YouTubeで検索」リンクの表示になります。

## 公開方法：GitHub Actions

このGitHubアカウントでは一時期Actionsの実行がブロックされていましたが（`queued`のまま進まない／`Startup failure` — ワークフローファイル自体の問題ではなく、新規アカウントに対する不正利用防止の審査待ちだったと思われます）、その後正常に動作するようになったため、**現在はGitHub Actionsが自動実行の本体**です。

- **公開方法:** GitHub Pagesの Source を **GitHub Actions** に設定（**Settings → Pages**）。ワークフロー内の `deploy-pages` ステップが直接公開まで行うため、`gh-pages` ブランチは使いません。
- **実行スケジュール:** 毎週月曜03:00 UTCに自動実行（**Actions** タブから `workflow_dispatch` で手動実行も可能）。
- **必要なSecrets**（Settings → Secrets and variables → Actions）: 再生数/登録者数取得用の `YOUTUBE_API_KEY`（上記参照）。プレイリスト自動投稿を使う場合は追加で `YOUTUBE_CLIENT_ID`/`YOUTUBE_CLIENT_SECRET`/`YOUTUBE_REFRESH_TOKEN`（下記参照）。
- **ActionsとローカルPCの両方を定期実行しないでください** — Actionsがブロックされていた間にWindowsタスクスケジューラを設定していた場合は、データのpush・サイトのデプロイが競合する（後から実行した方で上書きされる）ため、そのスケジュールタスクは無効化・削除してください。`scripts/weekly_local_run.js` や `npm run deploy`（`gh-pages` ブランチ方式）自体は、変更をpushする前の動作確認など手動での単発利用には引き続き使えます。

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
