import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "쇼핑 상품명 최적화",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
