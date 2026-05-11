import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "네이버 포스팅 X-Ray | Ranking Pro",
  description:
    "네이버 블로그 URL을 입력하면, 상위 노출을 위해 숨겨진 타겟 키워드와 작성 전략을 AI가 역엔지니어링하여 분석합니다.",
};

export default function PostXRayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
