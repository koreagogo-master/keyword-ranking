'use client';

import { useState, Suspense, useMemo } from "react";

import RankTabs from "@/components/RankTabs";

import KeywordInput from "./components/KeywordInput";
import GeneratedTable from "./components/GeneratedTable";
import SelectedCart from "./components/SelectedCart";
import HelpButton from "@/components/HelpButton";

export default function KeywordGeneratorPage() {
  return (
    <Suspense>
      <KeywordGeneratorContent />
    </Suspense>
  );
}

function KeywordGeneratorContent() {
  const [input1, setInput1] = useState("");
  const [input2, setInput2] = useState("");
  const [input3, setInput3] = useState("");
  
  const [options, setOptions] = useState({ ab: true, ac: false, bc: true, abc: false });

  const [combinedList, setCombinedList] = useState<any[]>([]);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [progress, setProgress] = useState(0);

  const [pickedKeywords, setPickedKeywords] = useState<string[]>([]);

  const [sortField, setSortField] = useState<'pc' | 'mobile' | 'total' | 'cpc' | null>(null);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc' | null>(null);

  const handleCombine = () => {
    const l1 = input1.split('\n').map(w => w.trim()).filter(w => w);
    const l2 = input2.split('\n').map(w => w.trim()).filter(w => w);
    const l3 = input3.split('\n').map(w => w.trim()).filter(w => w);

    if (l1.length === 0 && l2.length === 0 && l3.length === 0) {
      alert("단어를 하나 이상 입력해주세요.");
      return;
    }

    let results = new Set<string>();

    if (options.ab) l1.forEach(w1 => l2.forEach(w2 => results.add(`${w1}${w2}`.replace(/\s+/g, ''))));
    if (options.ac) l1.forEach(w1 => l3.forEach(w3 => results.add(`${w1}${w3}`.replace(/\s+/g, ''))));
    if (options.bc) l2.forEach(w2 => l3.forEach(w3 => results.add(`${w2}${w3}`.replace(/\s+/g, ''))));
    if (options.abc) l1.forEach(w1 => l2.forEach(w2 => l3.forEach(w3 => results.add(`${w1}${w2}${w3}`.replace(/\s+/g, '')))));

    let finalResults = Array.from(results).filter(w => w);
    
    if (finalResults.length > 500) {
      alert("생성된 키워드가 500개를 초과하여 최대 500개까지만 표시됩니다.");
      finalResults = finalResults.slice(0, 500);
    }

    const newList = finalResults.map(k => ({
      keyword: k, pc: 0, mobile: 0, total: 0, cpc: 0, isDone: false, isLoading: false
    }));

    setCombinedList(newList);
    setSelectedKeywords([]);
    setPickedKeywords([]); 
    setProgress(0);
    setSortField(null);
    setSortOrder(null);
  };

  const fetchSearchVolumes = async () => {
    const targets = combinedList.filter(item => selectedKeywords.includes(item.keyword) && !item.isDone);
    if (targets.length === 0) {
      alert("조회할 키워드를 선택해주시거나 이미 모두 조회되었습니다.");
      return;
    }

    setIsFetching(true);
    let currentList = [...combinedList];

    for (let i = 0; i < targets.length; i++) {
      const item = targets[i];
      currentList = currentList.map(c => c.keyword === item.keyword ? { ...c, isLoading: true } : c);
      setCombinedList(currentList);

      try {
        const searchKeyword = item.keyword.replace(/\s+/g, '');
        const res = await fetch('/api/related-ads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword: searchKeyword, cpcDevice: 'MOBILE', cpcPosition: 3 })
        });
        const data = await res.json();
        const exactMatch = data.keywords?.find((k: any) => k.keyword.replace(/\s+/g, '') === searchKeyword);

        if (exactMatch) {
          const forceNum = (val: any) => {
            if (typeof val === 'number') return val;
            if (typeof val === 'string') {
              const clean = val.replace(/,/g, '');
              if (clean.includes('<')) return 5;
              return Number(clean) || 0;
            }
            return 0;
          };
          currentList = currentList.map(c => 
            c.keyword === item.keyword ? { 
              ...c, pc: forceNum(exactMatch.pc), mobile: forceNum(exactMatch.mobile),
              total: forceNum(exactMatch.pc) + forceNum(exactMatch.mobile),
              cpc: forceNum(exactMatch.cpc), isDone: true, isLoading: false 
            } : c
          );
        } else {
           currentList = currentList.map(c => c.keyword === item.keyword ? { ...c, isDone: true, isLoading: false } : c);
        }
      } catch (e) {
        currentList = currentList.map(c => c.keyword === item.keyword ? { ...c, isDone: true, isLoading: false } : c);
      }
      
      setCombinedList(currentList);
      setProgress(Math.min(100, Math.round(((i + 1) / targets.length) * 100)));

      if (i + 1 < targets.length) await new Promise(r => setTimeout(r, 200));
    }
    setIsFetching(false);
  };

  const toggleKeyword = (keyword: string) => setSelectedKeywords(prev => prev.includes(keyword) ? prev.filter(k => k !== keyword) : [...prev, keyword]);
  const toggleAll = () => setSelectedKeywords(selectedKeywords.length === combinedList.length ? [] : combinedList.map(item => item.keyword));
  const togglePick = (keyword: string) => setPickedKeywords(prev => prev.includes(keyword) ? prev.filter(k => k !== keyword) : [...prev, keyword]);

  const handleSort = (field: 'pc' | 'mobile' | 'total' | 'cpc') => {
    if (sortField === field) {
      if (sortOrder === 'desc') setSortOrder('asc');
      else { setSortField(null); setSortOrder(null); }
    } else { setSortField(field); setSortOrder('desc'); }
  };

  const renderSortIcon = (field: 'pc' | 'mobile' | 'total' | 'cpc') => {
    if (sortField !== field) return (
      <span className="flex flex-col ml-1.5 opacity-20 text-[10px] leading-tight group-hover:opacity-40 transition-opacity"><span className="-mb-0.5">▲</span><span className="-mt-0.5">▼</span></span>
    );
    // 🌟 수정: 아이콘 색상을 파란색에서 브랜드 컬러로 변경
    return sortOrder === 'desc' ? <span className="text-[#5244e8] ml-1.5 text-xs font-extrabold">▼</span> : <span className="text-[#5244e8] ml-1.5 text-xs font-extrabold">▲</span>;
  };

  const sortedList = useMemo(() => {
    if (combinedList.length === 0) return [];
    let list = [...combinedList];
    if (sortField && sortOrder) {
      list.sort((a, b) => {
        const valA = a[sortField] || 0;
        const valB = b[sortField] || 0;
        return sortOrder === 'desc' ? valB - valA : valA - valB;
      });
    }
    return list;
  }, [combinedList, sortField, sortOrder]);

  const totalPickedVolume = useMemo(() => {
    return pickedKeywords.reduce((sum, key) => {
      const found = combinedList.find(item => item.keyword === key);
      return sum + (found?.isDone ? found.total : 0);
    }, 0);
  }, [pickedKeywords, combinedList]);

  const copyGeneratedToClipboard = () => {
    if (combinedList.length === 0) return;
    const textToCopy = combinedList.map(item => item.keyword).join('\n');
    navigator.clipboard.writeText(textToCopy).then(() => alert("생성된 키워드 목록이 복사되었습니다.")).catch(err => console.error('복사 실패:', err));
  };

  const copyPickedToClipboard = () => {
    if (pickedKeywords.length === 0) return;
    const textToCopy = pickedKeywords.join('\n');
    navigator.clipboard.writeText(textToCopy).then(() => alert("담은 키워드 목록이 복사되었습니다.")).catch(err => console.error('복사 실패:', err));
  };

  const clearPickedKeywords = () => {
    if (pickedKeywords.length === 0) return;
    if (window.confirm("담은 키워드를 모두 비우시겠습니까?")) {
      setPickedKeywords([]);
    }
  };

  return (
    <>
      <link href="https://cdn.jsdelivr.net/gh/moonspam/NanumSquare@2.0/nanumsquare.css" rel="stylesheet" type="text/css" />
      <div className="flex min-h-screen bg-[#f8f9fa] text-[#3c4043] antialiased tracking-tight" style={{ fontFamily: "'NanumSquare', sans-serif" }}>
        

        <main className="flex-1 ml-64 p-10">
          <div className="max-w-7xl mx-auto">
            <RankTabs /> 

            <div className="mb-6 mt-6">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold !text-black">키워드 생성기</h1>
                <HelpButton href="https://blog.naver.com/lboll/224254481124" tooltip="도움말" />
              </div>
              {/* 🌟 수정: 안내 문구의 색상을 파란색에서 브랜드 컬러로 변경 */}
              <p className="text-[14px] font-extrabold text-[#5244e8] mt-3 mb-2">💡 본 메뉴는 포인트 차감 없이 무제한으로 이용 가능한 무료 도구입니다.</p>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                여러 단어들을 조합하여 수많은 키워드 경우의 수를 생성합니다. (최대 500개 생성)<br />
                안정적인 데이터 조회를 위해, 세부 조회는 1개씩 0.2초 간격으로 순차 진행됩니다.<br />
                <span className="text-[#5244e8] font-bold">각 단어장에 들어갈 단어들은 엔터(줄바꿈)로 구분하여 한 줄에 하나씩 입력해 주세요.</span>
              </p>
            </div>

            <KeywordInput 
              input1={input1} setInput1={setInput1} input2={input2} setInput2={setInput2} input3={input3} setInput3={setInput3}
              options={options} setOptions={setOptions} handleCombine={handleCombine}
            />

            {combinedList.length > 0 && (
              <div className="flex flex-col lg:flex-row gap-6 items-start relative mt-6">
                
                <GeneratedTable 
                  combinedList={combinedList} sortedList={sortedList} selectedKeywords={selectedKeywords} pickedKeywords={pickedKeywords}
                  isFetching={isFetching} progress={progress} fetchSearchVolumes={fetchSearchVolumes}
                  toggleAll={toggleAll} toggleKeyword={toggleKeyword} togglePick={togglePick}
                  handleSort={handleSort} renderSortIcon={renderSortIcon} copyGeneratedToClipboard={copyGeneratedToClipboard}
                />
                
                <SelectedCart 
                  pickedKeywords={pickedKeywords} combinedList={combinedList} totalPickedVolume={totalPickedVolume}
                  togglePick={togglePick} copyPickedToClipboard={copyPickedToClipboard} clearPickedKeywords={clearPickedKeywords}
                />

              </div>
            )}

          </div>
        </main>
      </div>
    </>
  );
}