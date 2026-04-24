import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "지식인 순위 확인",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
