import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "연관 키워드 조회",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
