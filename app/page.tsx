import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-6">
      
      {/* 카드형 컨테이너 */}
      <div className="w-full max-w-md bg-gray-800 p-8 rounded-xl border border-gray-700 shadow-lg">
        
        {/* 제목 */}
        <h1 className="text-3xl font-bold mb-10 text-center text-blue-400">
          Keyword Ranking Tools
        </h1>

        <div className="flex flex-col gap-4">
          {/* 메뉴 1 - Blog Rank (Type A) */}
          <Link
            href="/blog-rank"
            className="block w-full text-center py-4 rounded-lg font-bold bg-blue-600 hover:bg-blue-500 transition-all text-white shadow-md"
          >
            통합 Rank (Type A)
          </Link>

          {/* 메뉴 2 - Blog Rank (Type B) */}
          <Link
            href="/blog-rank-b"
            className="block w-full text-center py-4 rounded-lg font-bold bg-blue-600 hover:bg-blue-500 transition-all text-white shadow-md"
          >
            블로그 Rank (Type B)
          </Link>

          {/* 메뉴 3 - 통합 검색 (보라색 포인트) */}
          <Link
            href="/kin-rank"
            className="block w-full text-center py-4 rounded-lg font-bold bg-purple-600 hover:bg-purple-500 transition-all text-white shadow-md"
          >
            지식인 Rank (Type C)
          </Link>
        </div>
        
        <p className="mt-8 text-center text-sm text-gray-500">
          Select a tool to start tracking.
        </p>
      </div>
    </main>
  );
}