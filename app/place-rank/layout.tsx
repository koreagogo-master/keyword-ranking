import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "네이버 플레이스 순위 조회",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
