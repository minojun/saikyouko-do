# 開発環境のセットアップ

**公開予定のゲームなので、ローカルサーバーでの開発を推奨します。**

## ローカルサーバーとは？

ローカルサーバーとは、自分のPC上で動く小さなWebサーバーのことです。
- ブラウザで直接HTMLファイルを開くのではなく、`http://localhost:8000` のようなURLでアクセスします
- 本番環境（公開されたWebサイト）に近い状態でテストできます
- CORSや相対パスの問題を避けられます

**注意：** このプロジェクトでは「仮想環境」（venv/Dockerなど）は不要です。ローカルサーバーだけで十分です。

## 方法1: Pythonのローカルサーバー（推奨）

### 前提条件
- Python 3.6以上がインストールされていること

### 起動方法
```bash
# Windows
python start_server.py

# Mac/Linux
python3 start_server.py
```

ブラウザが自動的に開き、`http://localhost:8000` でゲームが表示されます。

## 方法2: Node.jsのhttp-server

### 前提条件
- Node.jsがインストールされていること

### セットアップ
```bash
npm install -g http-server
```

### 起動方法
```bash
http-server -p 8000
```

## 方法3: Docker（オプション）

Dockerfileが提供されている場合は、以下のコマンドで起動できます：

```bash
docker build -t hackathon-game .
docker run -p 8000:80 hackathon-game
```

## 注意事項

- **公開予定のゲームなので、ローカルサーバーでの開発を強く推奨します**
- ブラウザで直接HTMLファイルを開くこともできますが、一部の機能（CORS、相対パスなど）が制限される場合があります
- ローカルサーバーを使用することで、本番環境に近い状態でテストできます

## デプロイについて

デプロイ手順は `DEPLOY.md` を参照してください。

