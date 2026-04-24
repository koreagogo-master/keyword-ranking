import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "블로그 노출 진단",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
