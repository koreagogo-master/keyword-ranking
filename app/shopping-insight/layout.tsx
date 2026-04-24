import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "쇼핑 키워드 인사이트",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
