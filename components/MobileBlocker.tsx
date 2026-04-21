// components/MobileBlocker.tsx
'use client';

import { useEffect, useState } from 'react';

export default function MobileBlocker() {
  const [isMobile, setIsMobile] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    // 화면 가로 길이가 768px (일반적인 태블릿/모바일 크기) 이하인지 체크
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile(); // 처음 렌더링 시 체크
    window.addEventListener('resize', checkMobile); // 화면 크기 조절 시 실시간 체크

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText('https://tmgad.com');
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    } catch (err) {
      console.error('클립보드 복사 실패:', err);
    }
  };

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-[999999] bg-[#0f172a] flex flex-col items-center justify-start p-6 text-center overflow-y-auto">

        {/* 1. 로고 영역 */}
        <div className="mt-10 mb-6">
          <span className="!text-white text-2xl font-bold tracking-tight">Ranking Pro</span>
          <h2 className="text-xl font-black mt-2 tracking-tight !text-white">PC 환경 최적화 안내</h2>
        </div>

        {/* 2. PC 브라우저 대시보드 목업 */}
        <div className="w-full max-w-xs mb-8">
          {/* 브라우저 윈도우 외곽 */}
          <div className="rounded-xl border border-[#334155] bg-[#1e293b] shadow-2xl overflow-hidden">
            {/* 상단 탭 바 */}
            <div className="flex items-center gap-1.5 px-3 py-2 bg-[#0f172a] border-b border-[#334155]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e]"></span>
              <div className="flex-1 mx-3 bg-[#1e293b] rounded px-2 py-0.5 text-[10px] !text-[#64748b] text-left">
                tmgad.com
              </div>
            </div>
            {/* 대시보드 내용 */}
            <div className="p-3 grid grid-cols-3 gap-2">
              {/* 상단 stat 카드 3개 */}
              <div className="bg-[#0f172a] rounded-lg p-2 border border-[#334155]">
                <div className="w-full h-1.5 bg-[#6366f1] rounded mb-1.5"></div>
                <div className="w-3/4 h-1 bg-[#334155] rounded"></div>
              </div>
              <div className="bg-[#0f172a] rounded-lg p-2 border border-[#334155]">
                <div className="w-full h-1.5 bg-[#818cf8] rounded mb-1.5"></div>
                <div className="w-2/3 h-1 bg-[#334155] rounded"></div>
              </div>
              <div className="bg-[#0f172a] rounded-lg p-2 border border-[#334155]">
                <div className="w-full h-1.5 bg-[#a5b4fc] rounded mb-1.5"></div>
                <div className="w-1/2 h-1 bg-[#334155] rounded"></div>
              </div>
            </div>
            {/* 차트 영역 */}
            <div className="px-3 pb-3">
              <div className="bg-[#0f172a] rounded-lg p-2 border border-[#334155]">
                <div className="flex items-end gap-1 h-10 mt-1">
                  <div className="flex-1 bg-[#6366f1]/40 rounded-t" style={{ height: '40%' }}></div>
                  <div className="flex-1 bg-[#6366f1]/60 rounded-t" style={{ height: '65%' }}></div>
                  <div className="flex-1 bg-[#6366f1]/40 rounded-t" style={{ height: '50%' }}></div>
                  <div className="flex-1 bg-[#6366f1] rounded-t" style={{ height: '90%' }}></div>
                  <div className="flex-1 bg-[#6366f1]/60 rounded-t" style={{ height: '70%' }}></div>
                  <div className="flex-1 bg-[#818cf8] rounded-t" style={{ height: '85%' }}></div>
                  <div className="flex-1 bg-[#a5b4fc] rounded-t" style={{ height: '100%' }}></div>
                </div>
                <div className="flex gap-1 mt-1">
                  {[...Array(7)].map((_, i) => (
                    <div key={i} className="flex-1 h-0.5 bg-[#334155] rounded"></div>
                  ))}
                </div>
              </div>
            </div>
            {/* 테이블 영역 */}
            <div className="px-3 pb-3 space-y-1">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-2 bg-[#0f172a] rounded px-2 py-1 border border-[#334155]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#6366f1]"></div>
                  <div className="flex-1 h-1 bg-[#334155] rounded"></div>
                  <div className="w-4 h-1 bg-[#6366f1]/40 rounded"></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 3. 긍정적 안내 문구 */}
        <p className="!text-[#94a3b8] text-[14px] leading-relaxed mb-6 max-w-xs">
          Ranking Pro의 정밀한 데이터 분석은<br />
          <span className="!text-white font-bold border-b border-[#6366f1] pb-0.5">
            PC 환경에 최적화
          </span>
          되어 있습니다.<br />더 넓은 화면에서 강력한 기능을 경험해 보세요!
        </p>

        {/* 4. 안내 박스 */}
        <div className="w-full max-w-xs bg-[#6366f1]/10 border border-[#6366f1]/20 p-4 rounded-2xl shadow-lg mb-8">
          <p className="!text-[#a5b4fc] text-[13px] font-medium leading-relaxed">
            PC(데스크탑) 환경에서 접속하셔서
            <span className="!text-white text-base font-semibold mt-1 block">확인해 보세요!</span>
          </p>
        </div>

        {/* 5. CTA 버튼 + 안내 텍스트 */}
        <div className="w-full max-w-xs mb-10">
          <button
            onClick={handleCopyLink}
            className={`w-full py-3.5 rounded-xl font-bold text-[15px] transition-all duration-300 shadow-lg !text-white ${copySuccess
                ? 'bg-[#22c55e] shadow-green-500/20'
                : 'bg-[#6366f1] hover:bg-[#4f46e5] shadow-indigo-500/30 active:scale-95'
              }`}
          >
            {copySuccess ? '✓ 링크가 복사되었습니다!' : 'PC 접속용 링크 복사하기'}
          </button>
          <p className="!text-[#64748b] text-[12px] mt-3 leading-relaxed">
            복사한 링크를 카카오톡 '내게쓰기' 등에 붙여넣어<br />
            나중에 PC에서 바로 접속해 보세요.
          </p>
        </div>

      </div>
    );
  }

  // PC 환경이면 아무것도 하지 않고 사이트를 정상적으로 보여줍니다.
  return null;
}