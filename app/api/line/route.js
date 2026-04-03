import { NextResponse } from 'next/server';

export async function POST(req) {
    try {
        // 1. 這裡之後會放處理 LINE 訊息的邏輯
        // 2. 目前先讓它回傳 200 OK，證明比比在門口聽到了
        return new Response('OK', { status: 200 });
    } catch (error) {
        console.error('LINE Webhook Error:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}

// 增加這個 GET 方法，是為了讓你用瀏覽器測網址時不會看到 404
export async function GET() {
    return NextResponse.json({
        message: "哈囉！加加樂，這裡是比比的聽筒，請用 LINE 的 POST 訊號傳送資料喔！"
    });
}