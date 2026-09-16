import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "코만도몰 리뷰 이전",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/*
        공통 사이드바(<aside>)는 폭 256px로 고정되어 있고 공통 푸터도 사이드바 폭만큼
        왼쪽 여백을 두기 때문에, 좁은 화면에서는 본문을 덮거나 가로 스크롤을 만듭니다.
        이 스타일은 /review-migration 이 열려 있는 동안에만 DOM에 존재하며,
        다른 경로로 이동하면 함께 제거됩니다.
      */}
      <style>{`@media (max-width: 1023px) {
        aside { display: none !important; }
        footer { margin-left: 0 !important; }
      }`}</style>
      {children}
    </>
  );
}
