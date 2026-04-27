import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI 리뷰 답글 생성기",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
