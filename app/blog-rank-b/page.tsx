'use client';

import { useState } from 'react';
import { checkNaverBlogRank } from './actions';
import RankTabs from '@/components/RankTabs';

// 결과 타입 정의
interface SearchResultRow {
  keyword: string;
  rank: string | number;
  date: string;
  title: string;
  author: string;
  isSuccess: boolean;
}

// 작성자별 색상 지정 (입력된 닉네임 순서대로 적용)
const AUTHOR_COLORS = [
  'text-blue-400',
  'text-green-400',
  'text-yellow-400',
  'text-pink-400',
  'text-purple-400',
  'text-orange-400',
  'text-cyan-400',
  'text-red-400',
];

export default function BlogRankPage() {
  const [targetNickname, setTargetNickname] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [results, setResults] = useState<SearchResultRow[]>([]);

  // 입력된 닉네임 목록 파싱 (범례 및 색상 매칭용)
  const nicknames = targetNickname.split(',').map(s => s.trim()).filter(Boolean);

  // [수정된 부분] 작성자 이름에 따른 색상 클래스 반환 함수 (정확도 개선)
  const getAuthorColorClass = (authorName: string) => {
    if (!authorName || authorName === '-') return 'text-gray-500';
    
    let bestMatchIndex = -1;
    let maxMatchLength = 0;

    // 등록된 닉네임들을 하나씩 대조해봅니다.
    nicknames.forEach((nick, idx) => {
      // 결과의 작성자명(authorName)이 우리가 입력한 닉네임(nick)을 포함하고 있다면
      if (authorName.includes(nick)) {
        // 그 중에서도 "가장 긴 닉네임"을 선택합니다. 
        // (예: '연세베스트치과' vs '연세베스트치과입니다' -> 더 긴 쪽을 우선시하여 색상 오류 방지)
        if (nick.length > maxMatchLength) {
          maxMatchLength = nick.length;
          bestMatchIndex = idx;
        }
      }
    });

    // 매칭된 것이 있다면 해당 순서의 색상을 반환
    if (bestMatchIndex !== -1) {
      return AUTHOR_COLORS[bestMatchIndex % AUTHOR_COLORS.length];
    }

    return 'text-gray-400'; // 매칭 안되면 기본 회색
  };

  const handleCheck = async () => {
    if (!targetNickname || !keywordInput) {
      alert('닉네임과 키워드를 모두 입력해주세요.');
      return;
    }

    const keywords = keywordInput.split(',').map(k => k.trim()).filter(k => k.length > 0);
    if (keywords.length === 0) return;

    setLoading(true);
    setResults([]); 
    
    for (let i = 0; i < keywords.length; i++) {
      const currentKeyword = keywords[i];
      setProgress(`${i + 1} / ${keywords.length} 진행 중... (${currentKeyword})`);

      try {
        const response = await checkNaverBlogRank(currentKeyword, targetNickname);

        if (response.success && response.data && Array.isArray(response.data)) {
          const newRows = response.data.map((item) => ({
            keyword: currentKeyword,
            rank: item.rank,
            date: item.date,
            title: item.title,
            author: item.author,
            isSuccess: true
          }));
          setResults(prev => [...prev, ...newRows]);

        } else {
          setResults(prev => [...prev, {
            keyword: currentKeyword,
            rank: 'X',
            date: '-',
            title: '순위 내 없음',
            author: '-', 
            isSuccess: false
          }]);
        }

      } catch (error) {
        console.error(error);
        setResults(prev => [...prev, {
          keyword: currentKeyword,
          rank: 'Err',
          date: '-',
          title: '오류 발생',
          author: '-',
          isSuccess: false
        }]);
      }
    }

    setLoading(false);
    setProgress('완료');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCheck();
  };

  // 키워드별 그룹화 (중복 키워드 제거)
  const uniqueKeywords = Array.from(new Set(results.map(r => r.keyword)));

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto mt-10">
        
        <RankTabs />
        
        <h1 className="text-3xl font-bold mb-8 text-left text-blue-400">
          N 블로그 탭 순위 확인 (멀티 닉네임)
        </h1>
        
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg mb-8">
          <div className="flex gap-4 items-start">
            
            <div className="w-1/4 min-w-[200px]">
              <label className="block text-sm font-medium mb-2 text-gray-300">
                블로그 닉네임 (쉼표로 구분 가능)
              </label>
              <input 
                type="text"
                value={targetNickname}
                onChange={(e) => setTargetNickname(e.target.value)}
                placeholder="예: 연세베스트치과, 연세베스트치과입니다"
                className="w-full p-3 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:border-blue-500 text-white h-[50px]"
              />
              {/* 범례 (Legend) */}
              {nicknames.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2 animate-fade-in">
                  {nicknames.map((nick, idx) => (
                    <span 
                      key={idx} 
                      className={`text-xs font-bold px-2 py-1 rounded bg-gray-900 border border-gray-600 ${AUTHOR_COLORS[idx % AUTHOR_COLORS.length]}`}
                    >
                      {nick}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1">
              <label className="block text-sm font-medium mb-2 text-gray-300">
                키워드 (쉼표로 구분)
              </label>
              <input 
                type="text"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="예: 부천교정, 부천치과"
                className="w-full p-3 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:border-blue-500 text-white h-[50px]"
              />
            </div>

            <div className="mt-[29px]">
              <button 
                onClick={handleCheck}
                disabled={loading}
                className={`h-[50px] px-6 rounded font-bold transition-all whitespace-nowrap flex items-center justify-center
                  ${loading ? 'bg-gray-600' : 'bg-blue-600 hover:bg-blue-500'}`}
              >
                {loading ? `분석 중... ${progress}` : '순위 확인하기'}
              </button>
            </div>
          </div>
        </div>

        {results.length > 0 && (
          <div className="animate-fade-in-up">
            <h2 className="text-xl font-bold mb-4 text-gray-200">
              검색 결과 ({results.length}건)
            </h2>
            
            <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-700 text-gray-300 text-xs uppercase">
                  <tr>
                    <th className="p-3 border-b border-gray-600 w-32">키워드</th>
                    <th className="p-3 border-b border-gray-600 w-40 text-center">순위</th>
                    <th className="p-3 border-b border-gray-600 w-auto">제목 (날짜)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {uniqueKeywords.map((keyword, kIdx) => {
                    // 현재 키워드에 해당하는 결과만 필터링
                    const items = results.filter(r => r.keyword === keyword);
                    
                    return (
                      <tr key={kIdx} className="hover:bg-gray-700/50 transition-colors">
                        
                        {/* 1. 키워드 (상단 정렬) */}
                        <td className="p-3 font-light text-white truncate align-top pt-4">
                          {keyword}
                        </td>
                        
                        {/* 2. 순위 (닉네임별 색상 적용 + 슬래시 구분) */}
                        <td className="p-3 text-center align-top pt-4">
                          <div className="flex flex-wrap justify-center gap-1">
                            {items.map((item, iIdx) => (
                              <span key={iIdx} className="flex items-center">
                                {/* 순위에 색상 적용: 수정된 getAuthorColorClass 사용 */}
                                <span className={`text-base font-bold ${getAuthorColorClass(item.author)}`}>
                                  {item.rank}
                                </span>
                                {/* 구분자 */}
                                {iIdx < items.length - 1 && (
                                  <span className="text-gray-500 mx-1">/</span>
                                )}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* 3. 제목 + (날짜) */}
                        <td className="p-3 text-sm text-gray-300 align-top pt-4">
                          <div className="flex flex-col gap-3">
                            {items.map((item, iIdx) => (
                              <div key={iIdx} className="w-full">
                                <span className={`whitespace-normal break-keep leading-relaxed ${item.isSuccess ? 'text-gray-200' : 'text-gray-500'}`}>
                                  {item.title}
                                </span>
                                {/* 날짜: 제목 뒤에 괄호로 붙임 */}
                                {item.date !== '-' && (
                                  <span className="text-gray-500 text-xs ml-2">
                                    ({item.date})
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}