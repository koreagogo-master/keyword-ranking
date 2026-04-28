import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/utils/supabase/server';

// ── 요청 타입
interface ReviewItem {
  id: number;
  text: string;
  isPhoto: boolean;
  isNegative: boolean;
  presetName?: string;    // 선택된 제품명 (없으면 undefined)
  presetDesc?: string;    // 선택된 핵심 장점
}

interface RequestBody {
  productName: string;   // 공통 제품명 (프리셋 미선택 시 fallback)
  productDesc: string;   // 핵심 장점
  tone: string;          // 톤앤매너 id
  isEmojiOff?: boolean;  // 이모지 사용 금지 여부
  reviews: ReviewItem[];
}

// ── 톤앤매너 → 한국어 설명 매핑
const TONE_LABELS: Record<string, string> = {
  friendly:   '친절하고 공감하는 따뜻한 말투',
  expert:     '전문적이고 신뢰감 있는 말투',
  apologize:  '진심으로 사과하고 문제를 해결하려는 말투',
  repurchase: '재구매를 자연스럽게 유도하는 말투',
};

// ── Claude 단건 호출 함수
async function generateReply(
  client: Anthropic,
  { productName, productDesc, tone, isEmojiOff, review }: {
    productName: string;
    productDesc: string;
    tone: string;
    isEmojiOff?: boolean;
    review: ReviewItem;
  }
): Promise<string> {
  const tonLabel = TONE_LABELS[tone] ?? '친절하고 공감하는 따뜻한 말투';

  const userPrompt = [
    `[제품명]: ${review.presetName || productName || '해당 제품'}`,
    `[핵심 장점]: ${review.presetDesc || productDesc || '없음'}`,
    `[톤앤매너]: ${tonLabel}`,
    isEmojiOff ? '[이모지 규칙]: 이모지(이모티콘)를 절대 사용하지 마세요.' : '',
    review.isPhoto ? '[특이사항]: 사진을 첨부해준 포토 리뷰입니다. 사진 촬영에 대한 감사 표현을 자연스럽게 포함해 주세요.' : '',
    review.isNegative ? '[특이사항]: 3점 이하 부정적 리뷰입니다. 고객의 불만을 진심으로 수용하고 개선 의지를 보여주세요.' : '',
    '',
    `[고객 리뷰 원문]:`,
    review.text.trim() || '(리뷰 내용 없음)',
  ].filter(Boolean).join('\n');

  const message = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 512,
    system:
      '너는 10년 차 베테랑 쇼핑몰 CS 매니저야. ' +
      '제공된 [제품명, 핵심 장점, 톤앤매너]를 바탕으로, 고객의 리뷰에 대한 맞춤형 답글을 한국어로 작성해. ' +
      '절대 로봇이나 번역기처럼 말하지 말고, 사람처럼 자연스럽고 정중하게 작성해. ' +
      '불필요한 인사말 없이 "답글 내용"만 출력해.',
    messages: [{ role: 'user', content: userPrompt }],
  });

  // 텍스트 블록만 추출
  const textBlock = message.content.find(b => b.type === 'text');
  return textBlock?.type === 'text' ? textBlock.text.trim() : '';
}

// ── POST 핸들러
export async function POST(req: NextRequest) {
  try {
    // 1. API 키 확인
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    // 2. 요청 파싱
    const body: RequestBody = await req.json();
    const { productName, productDesc, tone, isEmojiOff, reviews } = body;

    const validReviews = reviews.filter(r => r.text && r.text.trim() !== '');

    if (!validReviews || validReviews.length === 0) {
      return NextResponse.json(
        { error: '리뷰 데이터가 없습니다.' },
        { status: 400 }
      );
    }

    // 가. 유저 세션 확인
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '인증되지 않은 사용자입니다.' }, { status: 401 });
    }

    // 나/다. 차감할 포인트 계산 및 차감 함수 실행
    const { data: pointData, error: pointError } = await supabase.rpc('deduct_points_dynamic', {
      p_user_id: user.id,
      p_page_type: 'REVIEW_AI',
      p_item_count: validReviews.length,
      p_description: `리뷰 답글 생성 (${validReviews.length}건)`
    });

    // 라. 유저 잔여 포인트 부족 처리
    if (pointError || !pointData || pointData.success === false) {
      return NextResponse.json({ error: '포인트가 부족합니다.' }, { status: 400 });
    }

    // 3. Anthropic 클라이언트 초기화
    const client = new Anthropic({ apiKey });

    // 4. 모든 리뷰 병렬 처리
    const settled = await Promise.allSettled(
      validReviews.map(review =>
        generateReply(client, { productName, productDesc, tone, isEmojiOff, review })
      )
    );

    // 5. 결과 정리 (실패한 항목은 에러 메시지 대체)
    const results = settled.map((result, i) => ({
      id: validReviews[i].id,
      text:
        result.status === 'fulfilled'
          ? result.value
          : `[오류] 답글 생성에 실패했습니다: ${(result as PromiseRejectedResult).reason}`,
    }));

    return NextResponse.json({ results });
  } catch (err: unknown) {
    console.error('[review-ai API 오류]', err);
    const message = err instanceof Error ? err.message : '알 수 없는 서버 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
