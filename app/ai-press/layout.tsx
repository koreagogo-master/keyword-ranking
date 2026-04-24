import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI 언론 보도자료",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
