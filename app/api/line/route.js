// 強制 Next.js 不要快取這個路徑，這行非常重要！
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function POST(req) {
    try {
        // 讓 LINE 驗證通過的 OK 回應
        return new Response('OK', { status: 200 });
    } catch (error) {
        console.error('LINE Webhook Error:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}

// 讓瀏覽器測試時不會 404
export async function GET() {
    return NextResponse.json({
        message: "哈囉！加加樂，比比的聽筒已經強制轉為動態模式了！"
    });
}