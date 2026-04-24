import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dual AI 포스팅",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
