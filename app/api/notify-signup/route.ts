import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: NextRequest) {
    try {
        // 1. 요청 본문에서 가입한 이메일 파싱
        const { newUserEmail } = await req.json();

        if (!newUserEmail) {
            return NextResponse.json(
                { error: '신규 회원 이메일이 누락되었습니다.' },
                { status: 400 }
            );
        }

        // 2. 환경변수 확인
        const gmailUser = process.env.GMAIL_USER;
        const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

        if (!gmailUser || !gmailAppPassword) {
            console.error('[notify-signup] GMAIL_USER 또는 GMAIL_APP_PASSWORD 환경변수가 설정되지 않았습니다.');
            return NextResponse.json(
                { error: '메일 발송 서버 설정이 누락되었습니다.' },
                { status: 500 }
            );
        }

        // 3. Nodemailer Gmail SMTP 트랜스포터 생성
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: gmailUser,
                pass: gmailAppPassword,
            },
        });

        // 4. 메일 옵션 설정
        const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

        const mailOptions = {
            from: `"Ranking Pro 알림" <${gmailUser}>`,
            to: 'a01091944465@gmail.com',
            subject: '[Ranking Pro] 신규 회원 가입 알림',
            html: `
                <div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 480px; margin: 0 auto; background: #f8f9fa; padding: 32px 24px; border-radius: 12px;">
                    <h2 style="color: #4f46e5; margin-bottom: 8px;">신규 회원 가입 알림 🎉</h2>
                    <p style="color: #374151; line-height: 1.7; margin: 0 0 16px;">새로운 회원이 가입했습니다.</p>
                    <table style="width: 100%; border-collapse: collapse; background: #ffffff; border-radius: 8px; overflow: hidden;">
                        <tr>
                            <td style="padding: 12px 16px; background: #eef2ff; font-weight: bold; color: #4f46e5; width: 120px;">가입 이메일</td>
                            <td style="padding: 12px 16px; color: #111827;">${newUserEmail}</td>
                        </tr>
                        <tr>
                            <td style="padding: 12px 16px; background: #eef2ff; font-weight: bold; color: #4f46e5;">가입 시각</td>
                            <td style="padding: 12px 16px; color: #111827;">${now}</td>
                        </tr>
                    </table>
                    <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">이 메일은 Ranking Pro 서비스에서 자동 발송된 알림입니다.</p>
                </div>
            `,
        };

        // 5. 메일 발송
        await transporter.sendMail(mailOptions);

        return NextResponse.json({ success: true });

    } catch (err: unknown) {
        console.error('[notify-signup API 오류]', err);
        const message = err instanceof Error ? err.message : '알 수 없는 서버 오류';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
