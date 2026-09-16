import crypto from 'crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/app/lib/requireAdmin';
import {
  CAFE24_STATE_COOKIE,
  CAFE24_STATE_COOKIE_PATH,
  loadCafe24Config,
  toShopNo,
} from '@/app/lib/cafe24/config';
import { exchangeCodeForToken } from '@/app/lib/cafe24/oauth';
import { saveTokens } from '@/app/lib/cafe24/tokenStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 리디렉트 URL에 붙일 수 있는 짧고 민감하지 않은 실패 코드 */
type CallbackErrorCode =
  | 'forbidden'
  | 'config'
  | 'state'
  | 'code'
  | 'denied'
  | 'token'
  | 'shop_no'
  | 'save';

const RESULT_PATH = '/review-migration';

/**
 * 공개 주소를 기준으로 결과 URL을 만듭니다.
 * 고정된 redirect URI 환경변수를 우선 사용하고, 없으면 현재 요청 origin을 씁니다.
 */
function resultUrl(request: NextRequest, search: string): URL {
  let origin = request.nextUrl.origin;

  const configuredRedirectUri = process.env.CAFE24_REVIEW_REDIRECT_URI?.trim();
  if (configuredRedirectUri) {
    try {
      origin = new URL(configuredRedirectUri).origin;
    } catch {
      // 형식이 잘못된 경우 현재 요청 origin을 그대로 사용합니다.
    }
  }

  return new URL(`${RESULT_PATH}${search}`, origin);
}

/** 성공·실패 어느 쪽이든 state 쿠키는 반드시 지웁니다. */
function clearStateCookie(response: NextResponse) {
  response.cookies.set(CAFE24_STATE_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: CAFE24_STATE_COOKIE_PATH,
  });
  return response;
}

function failure(request: NextRequest, code: CallbackErrorCode) {
  console.error('[cafe24/callback] 실패:', code);
  return clearStateCookie(NextResponse.redirect(resultUrl(request, `?cafe24=error&code=${code}`)));
}

/** 길이가 같을 때만 timingSafeEqual로 비교합니다. */
function timingSafeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return failure(request, 'forbidden');
  }

  const params = request.nextUrl.searchParams;

  // 사용자가 카페24 화면에서 거부했거나 카페24가 오류를 돌려준 경우
  if (params.get('error')) {
    return failure(request, 'denied');
  }

  // ── state 검증: 여기서 막히면 토큰 요청을 절대 보내지 않습니다 ──
  const cookieState = request.cookies.get(CAFE24_STATE_COOKIE)?.value ?? '';
  const queryState = params.get('state') ?? '';

  if (!cookieState || !queryState || !timingSafeEquals(cookieState, queryState)) {
    return failure(request, 'state');
  }

  const code = params.get('code') ?? '';
  if (!code) {
    return failure(request, 'code');
  }

  const loaded = loadCafe24Config();
  if (!loaded.ok) {
    console.error('[cafe24/callback] 설정 오류:', loaded.reason);
    return failure(request, 'config');
  }
  const config = loaded.config;

  const exchanged = await exchangeCodeForToken(config, code);
  if (!exchanged.ok) {
    if (exchanged.kind === 'http') {
      console.error('[cafe24/callback] 토큰 교환 실패 status:', exchanged.status, 'code:', exchanged.code ?? '-');
    } else {
      console.error('[cafe24/callback] 토큰 교환 실패 kind:', exchanged.kind);
    }
    return failure(request, 'token');
  }

  // 응답 수신 시각을 기준으로 만료 시각을 계산합니다.
  const issuedAt = new Date();

  // shop_no가 문자열로 올 수 있으므로 정수로 변환하고, 없으면 기본 1번 샵으로 봅니다.
  const rawShopNo = exchanged.token.rawShopNo;
  const shopNo = rawShopNo === undefined || rawShopNo === null ? 1 : toShopNo(rawShopNo);
  if (shopNo === null) {
    return failure(request, 'shop_no');
  }

  const saved = await saveTokens({
    mallId: config.mallId,
    shopNo,
    connectedBy: admin.userId,
    accessToken: exchanged.token.accessToken,
    refreshToken: exchanged.token.refreshToken,
    scopes: exchanged.token.scopes,
    encryptionKey: config.encryptionKey,
    issuedAt,
  });

  if (!saved.ok) {
    console.error('[cafe24/callback] 토큰 저장 실패:', saved.reason);
    return failure(request, 'save');
  }

  return clearStateCookie(NextResponse.redirect(resultUrl(request, '?cafe24=connected')));
}
