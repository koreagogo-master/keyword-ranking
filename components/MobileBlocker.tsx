// components/MobileBlocker.tsx
'use client';

import { useEffect, useState } from 'react';

export default function MobileBlocker() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // 화면 가로 길이가 768px (일반적인 태블릿/모바일 크기) 이하인지 체크
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile(); // 처음 렌더링 시 체크
    window.addEventListener('resize', checkMobile); // 화면 크기 조절 시 실시간 체크

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-[999999] bg-[#0f172a] flex flex-col items-center justify-center p-6 text-center">
        
        {/* 1. 세련된 로고 영역 (절대 강제 색상 적용) */}
        <div className="mb-8">
          <h2 className="text-2xl font-black mb-4 tracking-tight !text-white">Ranking Pro</h2>
          <h2 className="text-2xl font-black mb-4 tracking-tight !text-white">PC 환경 최적화 안내</h2>
          
        </div>

        {/* 2. 아이콘 영역 */}
        <div className="mb-8 bg-[#1e293b] p-6 rounded-full shadow-lg border border-[#334155]">
          <svg className="w-14 h-12 !text-[#818cf8]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
        </div>
        
        {/* 3. 안내 문구 (절대 강제 하얀색 적용) */}
        <p className="!text-[#94a3b8] text-[15px] leading-relaxed mb-10">
          Ranking Pro는 방대한 데이터 분석과 정밀한 차트 확인을 위해 <span className="!text-white font-bold border-b border-[#6366f1] pb-0.5">PC(데스크탑) 환경에 최적화</span>되어 있습니다.
        </p>
        
        {/* 4. 기획자님의 완벽한 카피가 적용된 박스 */}
        <div className="w-full max-w-sm bg-[#6366f1]/10 border border-[#6366f1]/20 p-6 rounded-2xl shadow-lg">
          <p className="!text-[#a5b4fc] text-[15px] font-medium leading-relaxed">
            PC(데스크탑) 환경에서 접속하셔서<br/>
            <span className="!text-white text-lg font-medium mt-2 block">확인 해 주세요!</span>
          </p>
        </div>

        <div className="mb-12">
          <br/><span className="!text-white text-2xl font-bold tracking-tight">TMG ad</span>
        </div>


      </div>
    );
  }

  // PC 환경이면 아무것도 하지 않고 사이트를 정상적으로 보여줍니다.
  return null;
}