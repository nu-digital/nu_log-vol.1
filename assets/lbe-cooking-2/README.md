# LBEクッキングゲーム 続編の原稿と画像

本文は [article.md](article.md)、ブラウザーで読む版は [preview.html](preview.html) です。前編「協力型クッキングゲーム × LBEをUnityで作る！」に続く記事として作成しました。

- `article.md`：掲載用の原稿。画像キャプション付き。
- `images/`：既存のスクリーンショット・検証用画像を選んでコピーした9点。元画像を加工・再生成していません。
- `image-catalog.md` / `image-manifest.json`：各画像の内容、出典、寸法、ハッシュ、掲載候補。
- `research-notes.md`：会話をまたぐ時系列、人間とエージェントの分担、根拠と未確認事項。編集用であり本文ではありません。
- `evidence/`：今回の記事に関係する既存検証結果の原文コピー。HMD実機テストとの区別を保持。
- `article.fragment.json`：nu_logの `editor/data/book.json` の記事オブジェクト形式に合わせた移植用データ。本全体のJSONではありません。
- `verification.json`：原稿画像リンク、画像コピーのハッシュ、データ構造を確認した結果。

## 写真を後で足す

展示写真は未収録です。`images/10-interbee-experience.jpg` として置く想定で、本文の「展示で分かった操作の課題」に挿入位置をコメントで残しています。未提供画像への壊れた画像リンクは作っていません。

キャプション案：Inter BEE IGNITION × DCEXPO ANNEXでの体験の様子。同じ場所を歩きながら、仮想の厨房で協力して調理する。

## 記事リポジトリへの移植

参照先：[nu-digital/nu_log-vol.1](https://github.com/nu-digital/nu_log-vol.1)。確認コミットは `f391a7ce881bc89958cadfc76ec12d862531a512`（2026-11-21取得）。

現在の正本はMarkdownではなく `editor/data/book.json` です。生成物の `manuscripts/book.html` だけを書き換えると再生成時に消えるため、本文は編集室へ転記するか、記事データを正本へ追加します。今回は記事用フォルダの作成までで、記事リポジトリの正本変更やpushはしていません。

移植用JSONの画像参照は `assets/images/lbe-cooking-2/` です。対応するPNGを同じ場所へコピーし、画像一覧 `reports/images.json` と寸法一覧へ登録する必要があります。現リポジトリではWebP運用のため、必要なら取り込み時にロスレスWebPへ変換し、参照もそろえてください。JSONの追加だけでは画像選択一覧に登録されません。

記事IDは `chapter-lbe-cooking-2`、クラスは `chapter ch-19` を仮設定しています。取り込み時の既存ID・番号との重複を確認し、目次の「ゲーム・VR」で前編 `chapter-4` の次へ配置してください。`draft: true` のため、確認後に公開対象へ切り替えます。会場写真は写真追加後に別途figureブロックを追加してください。

`preview.html` は画像と本文を読むための単独プレビューです。冊子のB5組版・改ページ・最終PDFは今回作成していません。
