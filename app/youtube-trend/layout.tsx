import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "유튜브 트렌드",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
