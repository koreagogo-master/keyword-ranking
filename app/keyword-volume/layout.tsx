import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "키워드별 조회수",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
