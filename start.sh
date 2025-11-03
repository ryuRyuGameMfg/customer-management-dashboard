#!/bin/bash

# 顧客管理データビューア起動スクリプト
echo "🚀 顧客管理データビューアを起動中..."

# ポート番号
PORT=8000

# 既存のプロセスを確認
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  ポート $PORT は既に使用されています。"
    echo "🔄 既存のプロセスを終了しています..."
    kill -9 $(lsof -Pi :$PORT -sTCP:LISTEN -t) 2>/dev/null
    sleep 1
fi

# カレントディレクトリの確認
if [ ! -f "index.html" ]; then
    echo "❌ index.html が見つかりません。"
    echo "📁 正しいディレクトリで実行してください。"
    exit 1
fi

# Pythonの存在確認とHTTPサーバー起動
echo "🌐 HTTPサーバーを起動中... (ポート: $PORT)"

if command -v python3 &> /dev/null; then
    echo "✅ Python3 を使用してサーバーを起動..."
    python3 -m http.server $PORT &
    SERVER_PID=$!
elif command -v python &> /dev/null; then
    echo "✅ Python を使用してサーバーを起動..."
    python -m http.server $PORT &
    SERVER_PID=$!
else
    echo "❌ Python が見つかりません。"
    echo "💡 以下のいずれかの方法でPythonをインストールしてください："
    echo "   - Homebrew: brew install python3"
    echo "   - 公式サイト: https://www.python.org/downloads/"
    exit 1
fi

# サーバーの起動を待機
echo "⏳ サーバーの起動を待機中..."
sleep 2

# サーバーが正常に起動したか確認
if ! lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
    echo "❌ サーバーの起動に失敗しました。"
    exit 1
fi

# URL
URL="http://localhost:$PORT"

echo "✅ サーバーが起動しました！"
echo "🌐 URL: $URL"
echo "📊 顧客管理データビューアにアクセス中..."

# ブラウザを自動で開く
if command -v open &> /dev/null; then
    # macOS
    open "$URL"
elif command -v xdg-open &> /dev/null; then
    # Linux
    xdg-open "$URL"
elif command -v start &> /dev/null; then
    # Windows (Git Bash)
    start "$URL"
else
    echo "⚠️  ブラウザを自動で開けませんでした。"
    echo "🌐 手動で以下のURLを開いてください: $URL"
fi

echo ""
echo "🎉 起動完了！"
echo "📋 操作方法:"
echo "   - 列ヘッダーをクリックしてソート"
echo "   - フィルターで絞り込み"
echo "   - 検索ボックスでリアルタイム検索"
echo "   - スレッドボタンでココナラのページへ移動"
echo ""
echo "🛑 終了するには Ctrl+C を押してください"

# サーバーの終了を待機
trap "echo ''; echo '🛑 サーバーを停止中...'; kill $SERVER_PID 2>/dev/null; echo '✅ 終了しました。'; exit 0" INT

wait $SERVER_PID