import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "통검 노출/순위 확인",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
