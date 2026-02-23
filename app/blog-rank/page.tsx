'use client';

import { useState } from 'react';
import { checkNaverRank } from './actions';
import Sidebar from '@/components/Sidebar';
import RankTabs from '@/components/RankTabs';

// 🌟 1. 로그인 신분증을 챙기기 위해 중앙 통제실 스위치를 가져옵니다.
import { useAuth } from '@/app/contexts/AuthContext';

interface SearchResult {
  keyword: string;
  success: boolean;
  rank: string | number;
  date: string;
  title: string;
  author: string;
}

export default function BlogRankPage() {
  // 🌟 2. 중앙 통제실에서 현재 로그인한 유저 정보(user)를 꺼내옵니다.
  const { user } = useAuth();

  const [targetNickname, setTargetNickname] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);

  const handleCheck = async () => {
    if (!targetNickname || !keywordInput) {
      alert('닉네임과 키워드를 모두 입력해주세요.');
      return;
    }

    // 🌟 3. 혹시 로그인이 풀렸거나 정보를 못 가져왔다면 여기서 방어합니다.
    if (!user) {
        alert('로그인 정보가 만료되었거나 확인할 수 없습니다. 다시 로그인해주세요.');
        return;
    }

    const keywords = keywordInput
      .split(',')
      .map(k => k.trim())
      .filter(Boolean);

    setLoading(true);
    setResults([]);

    for (let i = 0; i < keywords.length; i++) {
      const keyword = keywords[i];
      setProgress(`${i + 1} / ${keywords.length} 진행 중... (${keyword})`);

      try {
        // 서버(actions.ts) 함수를 호출합니다. 이제 Next.js 환경에서 쿠키가 자동으로 전달됩니다.
        const data = await checkNaverRank(keyword, targetNickname);

        setResults(prev => [
          ...prev,
          {
            keyword,
            success: data.success,
            // 🌟 4. 서버에서 "로그인이 필요한 서비스입니다"라고 거절당했을 경우를 명확히 보여줍니다.
            rank: data.success ? data.data?.totalRank || 0 : (data.message.includes('로그인') ? 'Auth Error' : 'X'),
            date: data.success ? data.data?.date || '-' : '-',
            title: data.success ? data.data?.title || '' : (data.message || '순위 내 없음'),
            author: data.success ? data.data?.author || '' : '-',
          },
        ]);
      } catch (err) {
        setResults(prev => [
          ...prev,
          {
            keyword,
            success: false,
            rank: 'Err',
            date: '-',
            title: '시스템 오류 발생',
            author: '-',
          },
        ]);
      }
    }

    setLoading(false);
    setProgress('완료');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleCheck();
  };

  return (
    <>
      <link href="https://cdn.jsdelivr.net/gh/moonspam/NanumSquare@2.0/nanumsquare.css" rel="stylesheet" type="text/css" />

      <div 
        className="flex min-h-screen bg-[#f8f9fa] text-[#3c4043] antialiased tracking-tight"
        style={{ fontFamily: "'NanumSquare', sans-serif" }}
      >
        <Sidebar />

        <main className="flex-1 ml-64 p-10">
          <div className="max-w-7xl mx-auto">
            <RankTabs />

            <h1 className="text-2xl font-bold text-gray-900 mb-8">
              N 모바일 통검 순위 확인
            </h1>
            <p>* "사이트", "뉴스", "플레이스"는 순위에서 제외 됩니다.</p>
            <p>* "지식인"이 순위에 노출 될 경우 제목에 내용이 길게 표시 됩니다.</p><br />

            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm mb-10">
              <div className="flex gap-4 items-end">
                <div className="w-1/4 min-w-[200px]">
                  <label className="block text-sm font-bold mb-2 text-gray-600">
                    블로그 닉네임
                  </label>
                  <input
                    value={targetNickname}
                    onChange={e => setTargetNickname(e.target.value)}
                    placeholder="예: 연세베스트치과"
                    className="w-full h-[50px] p-3 rounded bg-white border border-gray-300
                               focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] transition-all shadow-sm"
                  />
                </div>

                <div className="flex-1">
                  <label className="block text-sm font-bold mb-2 text-gray-600">
                    키워드 (쉼표 구분)
                  </label>
                  <input
                    value={keywordInput}
                    onChange={e => setKeywordInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="부천교정, 부천치과"
                    className="w-full h-[50px] p-3 rounded bg-white border border-gray-300
                               focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] transition-all shadow-sm"
                  />
                </div>

                <div>
                  <button
                    onClick={handleCheck}
                    disabled={loading}
                    className={`h-[50px] px-6 rounded font-bold text-white whitespace-nowrap transition-all shadow-md
                      ${
                        loading
                          ? 'bg-gray-400'
                          : 'bg-[#1a73e8] hover:bg-[#1557b0] hover:shadow-lg'
                      }`}
                  >
                    {loading ? `분석 중... ${progress}` : '순위 확인하기'}
                  </button>
                </div>
              </div>
            </div>

            {results.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-gray-50 text-gray-500 uppercase text-xs font-bold tracking-wider">
                    <tr>
                      <th className="px-6 py-4 text-center w-40">키워드</th>
                      <th className="px-6 py-4 text-center w-24">순위</th>
                      <th className="px-6 py-4 text-center w-32">작성일</th>
                      <th className="px-6 py-4 text-left">제목</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {results.map((r, i) => (
                      <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-6 py-4 font-bold text-gray-900 text-center">{r.keyword}</td>
                        <td className="px-6 py-4 text-center">
                          {r.rank === 'Auth Error' ? (
                              <span className="text-sm text-red-500 font-bold">인증 실패</span>
                          ) : r.rank !== 'X' && r.rank !== 'Err' && r.rank !== 0 ? (
                            <span className="text-lg font-extrabold text-[#1a73e8]">{r.rank}위</span>
                          ) : (
                            <span className="text-sm text-gray-400 font-medium">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center text-gray-400 font-medium">
                          {r.date}
                        </td>
                        <td className="px-6 py-4 text-gray-700 font-medium">
                          {r.title}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}