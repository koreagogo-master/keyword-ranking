'use client';

import { useState } from 'react';
// 중요: 현재 폴더(kin-rank2)의 actions를 가져와야 합니다.
import { checkNaverKinRank } from './actions'; 

export default function KinRank2Page() {
  const [keyword, setKeyword] = useState('부천치아교정');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('대기 중...');

  const handleCheck = async () => {
    setLoading(true);
    setStatus('터미널에서 HTML 구조를 분석 중입니다... (1~10위)');
    
    try {
      // 제목 키워드는 구조 분석에 크게 중요하지 않으므로 임의값 전달
      const result = await checkNaverKinRank(keyword, 'dummy');
      
      if (result.success) {
        setStatus('✅ 분석 완료! VSCode 터미널을 확인하세요.');
      } else {
        setStatus('❌ 분석 실패: ' + result.message);
      }
    } catch (e) {
      console.error(e);
      setStatus('에러 발생');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>[kin-rank2] 구조 정밀 진단</h1>
      <p>
        이 페이지는 <b>1위~5위</b>와 <b>6위~10위</b>의<br/>
        HTML 박스 구조(Depth)가 다른지 확인하는 용도입니다.
      </p>
      
      <div style={{ marginTop: '20px' }}>
        <input 
          type="text" 
          value={keyword} 
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="검색어 입력"
          style={{ padding: '10px', width: '200px', marginRight: '10px' }}
        />
        <button 
          onClick={handleCheck} 
          disabled={loading}
          style={{ 
            padding: '10px 20px', 
            backgroundColor: loading ? '#ccc' : '#0070f3', 
            color: 'white', 
            border: 'none', 
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? '분석 중...' : '구조 진단 시작'}
        </button>
      </div>

      <div style={{ marginTop: '20px', padding: '15px', background: '#f0f0f0' }}>
        <strong>상태:</strong> {status}
      </div>
      
      <p style={{ marginTop: '20px', color: 'red' }}>
        * 결과는 웹 화면이 아니라 <b>VSCode 터미널(로그)</b>에 표로 출력됩니다.
      </p>
    </div>
  );
}