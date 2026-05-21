import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "우편번호 대량 변환기",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
