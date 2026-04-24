import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "구글 키워드 분석",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
