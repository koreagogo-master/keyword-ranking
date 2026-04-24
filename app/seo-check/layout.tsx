import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "내 상품명 진단",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
