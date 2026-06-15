'use client';

// TODO: 2차에서 profiles.role === 'admin' 또는 지정 user.id만 접근 가능하도록 보강 예정
// useAuth import 및 접근 제한 로직은 2차 작업에서 추가 예정

import { useState } from 'react';

/* ═══════════════════════════════════════════════════════════════
   타입
═══════════════════════════════════════════════════════════════ */
type DocType = 'quote' | 'statement';

/** 품목 행 — TODO: 2차에서 자동 계산 로직 연결 예정 */
interface ItemRow {
  id: string;
  month: string;
  day: string;
  name: string;
  spec: string;
  quantity: string;
  unitPrice: string;
  supplyAmt: string;
  taxAmt: string;
  note: string;
}

/* ═══════════════════════════════════════════════════════════════
   상수 / 유틸
═══════════════════════════════════════════════════════════════ */
const DEFAULT_NOTES = [
  '입금 확인 후 발송됩니다.',
  '배송비 포함입니다.',
  '재고 상황에 따라 출고일이 변동될 수 있습니다.',
];

let _uid = 0;
function uid() { return `r-${++_uid}`; }

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function makeRow(): ItemRow {
  return { id: uid(), month: '', day: '', name: '', spec: '', quantity: '', unitPrice: '', supplyAmt: '', taxAmt: '', note: '' };
}

/* ═══════════════════════════════════════════════════════════════
   메인 컴포넌트
═══════════════════════════════════════════════════════════════ */
export default function QuotePage() {
  /* 문서 종류 */
  const [docType, setDocType] = useState<DocType>('quote');

  /* 작성일 */
  const [date, setDate] = useState(todayStr());

  /* 업체 정보 */
  const [companyName,    setCompanyName]    = useState('');
  const [contactName,    setContactName]    = useState('');
  const [phone,          setPhone]          = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [address,        setAddress]        = useState('');
  const [bizNumber,      setBizNumber]      = useState('');
  const [companyNote,    setCompanyNote]    = useState('');

  /* 거래처 버튼 안내 */
  const [showClientHint, setShowClientHint] = useState(false);
  const [showItemHint,   setShowItemHint]   = useState(false);

  /* 품목 행 (TODO: 2차에서 계산 로직 연결 예정) */
  const [rows, setRows] = useState<ItemRow[]>(() => Array.from({ length: 5 }, makeRow));

  /* 하단 비고 */
  const [extraNote, setExtraNote] = useState('');

  /* 도장 오류 */
  const [stampError, setStampError] = useState(false);

  /* 이메일 복사 토스트 */
  const [emailCopied, setEmailCopied] = useState(false);

  /* 행 값 업데이트 */
  const updateRow = (id: string, patch: Partial<ItemRow>) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  /* 표시용 */
  const dateDisplay  = date.replace(/-/g, '. ') + '.';
  const docTitle     = docType === 'quote' ? '견 적 서' : '거 래 명 세 서';
  const docSentence  = docType === 'quote'
    ? '아래와 같이 견적합니다.'
    : '아래와 같이 거래명세서를 제출합니다.';

  // TODO: 2차에서 품목 행 값 기반 자동 계산 로직 추가 예정 — 현재는 0으로 표시
  const totalSupply = 0;
  const totalTax    = 0;
  const grandTotal  = 0;

  /* ─────────────────── 렌더 ─────────────────── */
  return (
    <>
      <style>{`
        /* ── form 공통 ── */
        .fi {
          width: 100%;
          border: 1px solid #d1d5db;
          border-radius: 5px;
          padding: 7px 10px;
          font-size: 13px;
          color: #374151;
          background: #fff;
          outline: none;
        }
        .fi:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.1); }

        /* 품목표 셀 입력 — 중앙 정렬 */
        .fi-sm {
          width: 100%;
          border: 1px solid #e5e7eb;
          border-radius: 3px;
          padding: 3px 4px;
          font-size: 11px;
          color: #374151;
          background: #fff;
          outline: none;
          text-align: center;
        }
        .fi-sm:focus { border-color: #93c5fd; }

        /* 품목표 셀 입력 — 좌측 정렬 */
        .fi-sm-l {
          width: 100%;
          border: 1px solid #e5e7eb;
          border-radius: 3px;
          padding: 3px 5px;
          font-size: 11px;
          color: #374151;
          background: #fff;
          outline: none;
        }
        .fi-sm-l:focus { border-color: #93c5fd; }

        /* ── 인쇄 CSS ──
           body * visibility:hidden → .quote-paper 만 visible
           position:absolute top:0 으로 A4 최상단 고정 */
        @media print {
          html, body {
            height: auto !important;
            overflow: hidden !important;
            background: white !important;
          }
          body * { visibility: hidden !important; }
          .quote-paper,
          .quote-paper * { visibility: visible !important; }
          .quote-paper {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            min-height: unset !important;
            background: white !important;
          }
          @page { size: A4; margin: 10mm; }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">

          {/* ────────────── 제목 ────────────── */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold mb-1" style={{ color: '#111827' }}>
              견적서 / 거래명세서 작성
            </h1>
            <p style={{ color: '#6b7280', fontSize: '14px' }}>
              회사 내부용 견적서와 거래명세서를 작성하고 PDF로 저장할 수 있습니다.
            </p>
          </div>

          {/* ────────────── 종류 + 작성일 (2열, 한 줄형) ────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* 좌: 종류 */}
            <section className="bg-white rounded-xl shadow-sm border border-gray-200 px-5" style={{ display: 'flex', alignItems: 'center', minHeight: '52px' }}>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px', width: '100%' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', lineHeight: '1' }}>종류</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  {([['quote', '견적서'], ['statement', '거래명세서']] as [DocType, string][]).map(([v, lbl]) => (
                    <label key={v} style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', margin: 0 }}>
                      <input
                        type="radio" name="doctype" value={v}
                        checked={docType === v} onChange={() => setDocType(v)}
                        style={{ accentColor: '#2563eb', width: '16px', height: '16px', margin: 0 }}
                      />
                      <span style={{
                        fontSize: '14px',
                        fontWeight: docType === v ? 700 : 400,
                        color: docType === v ? '#1d4ed8' : '#374151',
                        lineHeight: '1',
                      }}>
                        {lbl}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </section>

            {/* 우: 작성일 */}
            <section className="bg-white rounded-xl shadow-sm border border-gray-200 px-5" style={{ display: 'flex', alignItems: 'center', minHeight: '52px' }}>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px', width: '100%' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', lineHeight: '1' }}>작성일</span>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="fi" style={{ maxWidth: '200px' }} />
              </div>
            </section>
          </div>

          {/* ────────────── 업체 정보 ────────────── */}
          {/* 카드 바깥 상단: 우측에 거래처 버튼만 배치 */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '6px', gap: '6px', flexWrap: 'wrap' }}>
            <button
              className="!text-white"
              onClick={() => setShowClientHint(v => !v)}
              style={{
                fontSize: '12px', padding: '5px 13px', borderRadius: '6px',
                border: 'none', background: '#2563eb', cursor: 'pointer', fontWeight: 600,
              }}
            >
              거래처 관리
            </button>
            <button
              className="!text-blue-700"
              onClick={() => setShowClientHint(v => !v)}
              style={{
                fontSize: '12px', padding: '5px 13px', borderRadius: '6px',
                border: '1px solid #93c5fd', background: '#ffffff', cursor: 'pointer', fontWeight: 500,
              }}
            >
              거래처 조회
            </button>
            {showClientHint && (
              <span style={{ fontSize: '11px', color: '#9ca3af', width: '100%', textAlign: 'right' }}>
                2차에서 연결 예정입니다.
              </span>
            )}
          </div>

          <Card>
            {/* 업체 정보 필드 — PC: 3열 grid
                1행: [업체정보 라벨] [업체명]       [사업자등록번호]
                2행: [담당자명/참조] [전화번호]      [이메일]
                3행: [주소              col-span-3]
                4행: [비고(업체)        col-span-3]            */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

              {/* ── 1행 ── */}
              {/* col1: 섹션 라벨 (입력칸 아님) — paddingTop으로 옆 칸의 라벨 높이만큼 내려 input 라인에 맞춤 */}
              <div style={{ display: 'flex', alignItems: 'flex-start', paddingTop: '17px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#374151' }}>업체정보</span>
              </div>
              {/* col2: 업체명 */}
              <F label="업체명">
                <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="업체명" className="fi" />
              </F>
              {/* col3: 사업자등록번호 */}
              <F label="사업자등록번호">
                <input type="text" value={bizNumber} onChange={e => setBizNumber(e.target.value)} placeholder="000-00-00000" className="fi" />
              </F>

              {/* ── 2행 ── */}
              <F label="담당자명 / 참조">
                <input type="text" value={contactName} onChange={e => setContactName(e.target.value)} placeholder="담당자명" className="fi" />
              </F>
              <F label="전화번호">
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="전화번호" className="fi" />
              </F>
              <F label="이메일">
                <input type="email" value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} placeholder="이메일을 입력하세요" className="fi" />
              </F>

              {/* ── 3행: 주소 전체 너비 ── */}
              <div className="sm:col-span-3">
                <F label="주소">
                  <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="주소" className="fi" />
                </F>
              </div>

              {/* ── 4행: 비고(업체) 전체 너비 ── */}
              <div className="sm:col-span-3">
                <F label="비고 (업체)">
                  <input type="text" value={companyNote} onChange={e => setCompanyNote(e.target.value)} placeholder="업체 관련 메모" className="fi" />
                </F>
              </div>

            </div>
          </Card>

          {/* ────────────── 품목 표 ────────────── */}
          {/* TODO: 2차에서 제품 선택, 자동 계산, 할인 로직 연결 예정 */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <SectionTitle>품목</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                    TODO: 2차에서 자동 계산 연결 예정
                  </span>
                  <button
                    className="!text-gray-600"
                    onClick={() => setShowItemHint(v => !v)}
                    style={{
                      fontSize: '12px', padding: '4px 12px', borderRadius: '6px',
                      border: '1px solid #d1d5db', background: '#f9fafb', cursor: 'pointer',
                    }}
                  >
                    품목관리
                  </button>
                </div>
                {showItemHint && (
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                    2차에서 연결 예정입니다.
                  </span>
                )}
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '680px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderTop: '2px solid #e5e7eb', borderBottom: '2px solid #e5e7eb' }}>
                    {[
                      { label: '월',    w: '40px'  },
                      { label: '일',    w: '40px'  },
                      { label: '품목',  w: undefined },
                      { label: '규격',  w: '80px'  },
                      { label: '수량',  w: '56px'  },
                      { label: '단가',  w: '88px'  },
                      { label: '공급가액', w: '88px' },
                      { label: '세액',  w: '72px'  },
                      { label: '비고',  w: '80px'  },
                    ].map(({ label, w }) => (
                      <th key={label} style={{
                        padding: '8px 4px', textAlign: 'center', fontWeight: 600,
                        color: '#374151', borderRight: '1px solid #e5e7eb',
                        whiteSpace: 'nowrap', width: w,
                      }}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={row.id} style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding: '4px 3px' }}>
                        <input type="text" value={row.month}     onChange={e => updateRow(row.id, { month:     e.target.value })} placeholder="월"  className="fi-sm" />
                      </td>
                      <td style={{ padding: '4px 3px' }}>
                        <input type="text" value={row.day}       onChange={e => updateRow(row.id, { day:       e.target.value })} placeholder="일"  className="fi-sm" />
                      </td>
                      <td style={{ padding: '4px 3px' }}>
                        <input type="text" value={row.name}      onChange={e => updateRow(row.id, { name:      e.target.value })} placeholder="품목명" className="fi-sm-l" />
                      </td>
                      <td style={{ padding: '4px 3px' }}>
                        <input type="text" value={row.spec}      onChange={e => updateRow(row.id, { spec:      e.target.value })} placeholder="규격"  className="fi-sm-l" />
                      </td>
                      <td style={{ padding: '4px 3px' }}>
                        <input type="text" value={row.quantity}  onChange={e => updateRow(row.id, { quantity:  e.target.value })} placeholder="0"    className="fi-sm" />
                      </td>
                      <td style={{ padding: '4px 3px' }}>
                        <input type="text" value={row.unitPrice} onChange={e => updateRow(row.id, { unitPrice: e.target.value })} placeholder="0"    className="fi-sm" />
                      </td>
                      <td style={{ padding: '4px 3px' }}>
                        <input type="text" value={row.supplyAmt} onChange={e => updateRow(row.id, { supplyAmt: e.target.value })} placeholder="0"    className="fi-sm" />
                      </td>
                      <td style={{ padding: '4px 3px' }}>
                        <input type="text" value={row.taxAmt}    onChange={e => updateRow(row.id, { taxAmt:    e.target.value })} placeholder="0"    className="fi-sm" />
                      </td>
                      <td style={{ padding: '4px 3px' }}>
                        <input type="text" value={row.note}      onChange={e => updateRow(row.id, { note:      e.target.value })} placeholder="비고"  className="fi-sm-l" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* ────────────── 합계 (임시 단순화) ────────────── */}
          {/* TODO: 2차에서 품목 행 값 기반 자동 합산 로직 추가 예정 — 현재 0 고정 표시 */}
          <section style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '16px 20px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <SectionTitle>합계 요약</SectionTitle>
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>TODO: 2차 자동 계산 예정</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '28px', fontSize: '13px' }}>
              <span style={{ color: '#6b7280' }}>공급가액&nbsp;
                <strong style={{ color: '#111827' }}>{totalSupply.toLocaleString('ko-KR')}원</strong>
              </span>
              <span style={{ color: '#6b7280' }}>세액&nbsp;
                <strong style={{ color: '#111827' }}>{totalTax.toLocaleString('ko-KR')}원</strong>
              </span>
              <span style={{ color: '#374151', fontWeight: 600 }}>합계&nbsp;
                <strong style={{ color: '#1d4ed8', fontSize: '18px' }}>{grandTotal.toLocaleString('ko-KR')}원</strong>
              </span>
            </div>
          </section>

          {/* ────────────── 비고 ────────────── */}
          <Card>
            <SectionTitle>비고</SectionTitle>
            <div style={{ marginTop: '8px', marginBottom: '8px' }}>
              {DEFAULT_NOTES.map((n, i) => (
                <p key={i} style={{ fontSize: '12px', color: '#9ca3af' }}>• {n}</p>
              ))}
            </div>
            <textarea
              value={extraNote} onChange={e => setExtraNote(e.target.value)}
              rows={3} placeholder="추가 비고 사항..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2"
              style={{ fontSize: '13px', color: '#374151', resize: 'vertical' }}
            />
          </Card>

          {/* ────────────── 미리보기 제목 ────────────── */}
          <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '10px' }}>
            미리보기
          </h2>
        </div>

        {/* ════════════════════════════════════════════════════════
            견적서 / 거래명세서 미리보기 — 인쇄 대상 (.quote-paper)
        ════════════════════════════════════════════════════════ */}
        <div style={{ maxWidth: '870px', margin: '0 auto', padding: '0 16px 24px' }}>
          <div
            className="quote-paper bg-white"
            style={{
              fontFamily: "'Malgun Gothic','맑은 고딕','Apple SD Gothic Neo',Arial,sans-serif",
              padding: '32px 40px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.10)',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#111',
              lineHeight: '1.6',
            }}
          >
            {/* ── 제목 ── */}
            <h1 style={{
              textAlign: 'center', fontSize: '24px', fontWeight: 700,
              letterSpacing: '12px', marginBottom: '22px', color: '#111',
            }}>
              {docTitle}
            </h1>

            {/* ── 상단 좌우 ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', gap: '16px' }}>

              {/* 좌: 업체 정보 */}
              <div style={{ lineHeight: '2.1', fontSize: '12.5px' }}>
                <PRow label="날  짜"  value={dateDisplay} />
                <PRow label="수  신"  value={companyName ? `${companyName} 귀중` : '귀중'} />
                <PRow label="참  조"  value={contactName  || ''} />
                {phone     && <PRow label="전  화"    value={phone} />}
                {bizNumber && <PRow label="사업자번호" value={bizNumber} />}
                {address   && <PRow label="주  소"    value={address} />}
              </div>

              {/* 우: 공급자 + 도장 */}
              <div style={{ flexShrink: 0, textAlign: 'right', fontSize: '11px', lineHeight: '1.9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'flex-end' }}>
                  <div>
                    <p style={{ color: '#555' }}>서울 금천구 가산디지털1로 128, 904호</p>
                    <p style={{ color: '#555', marginBottom: '2px' }}>(가산동, STX-V타워)</p>
                    <p style={{ fontWeight: 700, fontSize: '13px', color: '#111' }}>주식회사 티엠지</p>
                    <p>대  표 : 배 상 호</p>
                    <p>TEL : 02-2201-1881</p>
                  </div>
                  {/* 도장 */}
                  <div style={{
                    width: '82px', height: '82px', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, overflow: 'hidden',
                    border: stampError ? '2px solid #cc2200' : 'none',
                  }}>
                    {!stampError ? (
                      <img
                        src="/quote/tmg-stamp.png" alt="직인"
                        style={{ width: '82px', height: '82px', objectFit: 'contain', display: 'block' }}
                        onError={() => setStampError(true)}
                      />
                    ) : (
                      <span style={{ fontSize: '11px', color: '#cc2200', fontWeight: 700 }}>직인</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 구분선 */}
            <hr style={{ border: 'none', borderTop: '2px solid #1d3557', marginBottom: '13px' }} />
            <p style={{ marginBottom: '13px', fontSize: '12.5px' }}>{docSentence}</p>

            {/* ── 품목 표 ── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: 0 }}>
              <thead>
                <tr style={{ backgroundColor: '#1d3557', color: '#fff' }}>
                  {['월', '일', '품목', '규격', '수량', '단가', '공급가액', '세액', '비고'].map(h => (
                    <th key={h} style={{ padding: '5px 4px', border: '1px solid #94a3b8', textAlign: 'center', fontWeight: 600 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id}>
                    <td style={ptd({ textAlign: 'center', width: '28px' })}>{row.month}</td>
                    <td style={ptd({ textAlign: 'center', width: '28px' })}>{row.day}</td>
                    <td style={ptd({ minWidth: '100px' })}>{row.name}</td>
                    <td style={ptd({ minWidth: '60px' })}>{row.spec}</td>
                    <td style={ptd({ textAlign: 'center', width: '40px' })}>{row.quantity}</td>
                    <td style={ptd({ textAlign: 'right', width: '72px' })}>{row.unitPrice}</td>
                    <td style={ptd({ textAlign: 'right', width: '72px' })}>{row.supplyAmt}</td>
                    <td style={ptd({ textAlign: 'right', width: '60px' })}>{row.taxAmt}</td>
                    <td style={ptd({ minWidth: '60px' })}>{row.note}</td>
                  </tr>
                ))}

                {/* 소계 */}
                <tr style={{ backgroundColor: '#f0f4f8' }}>
                  <td colSpan={6} style={{ padding: '5px 8px', border: '1px solid #d1d5db', textAlign: 'right', fontWeight: 700, fontSize: '11.5px' }}>소  계</td>
                  <td style={{ padding: '5px 8px', border: '1px solid #d1d5db', textAlign: 'right', fontWeight: 600 }}>0</td>
                  <td style={{ padding: '5px 8px', border: '1px solid #d1d5db', textAlign: 'right', fontWeight: 600 }}>0</td>
                  <td style={{ border: '1px solid #d1d5db' }} />
                </tr>

                {/* 합계 */}
                <tr style={{ backgroundColor: '#1d3557', color: '#fff' }}>
                  <td colSpan={6} style={{ padding: '7px 8px', border: '1px solid #94a3b8', textAlign: 'right', fontWeight: 700 }}>합  계</td>
                  <td colSpan={3} style={{ padding: '7px 8px', border: '1px solid #94a3b8', textAlign: 'center', fontWeight: 700, fontSize: '13px' }}>
                    0 원
                  </td>
                </tr>
              </tbody>
            </table>

            {/* 한글 금액 */}
            <div style={{
              border: '1px solid #d1d5db', borderTop: 'none',
              padding: '7px 14px', backgroundColor: '#fafafa',
              fontSize: '12.5px', marginBottom: '14px',
            }}>
              <strong>한글 금액 : </strong>일금영원 (₩0)
            </div>

            {/* 비고 */}
            <div style={{ marginBottom: '14px' }}>
              <p style={{ fontWeight: 700, marginBottom: '5px', fontSize: '12.5px' }}>비 고</p>
              <div style={{
                border: '1px solid #e5e7eb', borderRadius: '4px',
                padding: '8px 14px', backgroundColor: '#fafafa',
                fontSize: '11.5px', lineHeight: '2', color: '#374151',
              }}>
                {DEFAULT_NOTES.map((n, i) => <p key={i}>• {n}</p>)}
                {extraNote && <p style={{ whiteSpace: 'pre-wrap', marginTop: '4px' }}>{extraNote}</p>}
              </div>
            </div>

            {/* 입금 계좌 */}
            <div style={{
              border: '1px solid #bfdbfe', borderRadius: '4px',
              padding: '8px 14px', backgroundColor: '#eff6ff',
              fontSize: '12.5px', color: '#1e3a5f',
            }}>
              <strong>입금 계좌 : </strong>
              512601-01-160762 &nbsp; 국민은행 / 주식회사티엠지
            </div>

          </div>{/* /quote-paper */}

          {/* ── PDF 저장 / 이메일 복사 (미리보기 카드 바로 아래, 인쇄 미포함) ── */}
          <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #e5e7eb' }}>
            {/* 버튼 행 */}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '10px' }}>
              <button onClick={() => window.print()} style={sBtnPdf}>
                PDF 저장
              </button>

              <button
                disabled={!recipientEmail.trim()}
                onClick={() => {
                  if (!recipientEmail.trim()) return;
                  navigator.clipboard.writeText(recipientEmail.trim()).then(() => {
                    setEmailCopied(true);
                    setTimeout(() => setEmailCopied(false), 2500);
                  });
                }}
                style={{
                  backgroundColor: recipientEmail.trim() ? '#059669' : '#d1d5db',
                  color: '#ffffff', fontWeight: 600, fontSize: '14px',
                  padding: '10px 22px', borderRadius: '8px', border: 'none',
                  cursor: recipientEmail.trim() ? 'pointer' : 'not-allowed',
                  transition: 'background-color 0.2s',
                }}
              >
                이메일 복사
              </button>

              {emailCopied && (
                <span style={{
                  fontSize: '13px', color: '#059669', fontWeight: 600,
                  padding: '4px 12px', backgroundColor: '#ecfdf5',
                  border: '1px solid #a7f3d0', borderRadius: '6px',
                }}>
                  ✓ 이메일 주소가 복사되었습니다.
                </span>
              )}
            </div>

            {/* 안내 문구 */}
            <div style={{ fontSize: '12px', color: '#9ca3af', lineHeight: '1.9' }}>
              <p>• 브라우저 인쇄창에서 &lsquo;PDF로 저장&rsquo;을 선택해 주세요.</p>
              <p>• PDF로 저장한 뒤 이메일에 첨부해 수동 발송해 주세요.</p>
              <p>• 이메일 복사 버튼은 수신 이메일 주소만 복사합니다.</p>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   스타일 상수
═══════════════════════════════════════════════════════════════ */
const sBtnPdf: React.CSSProperties = {
  backgroundColor: '#2563eb', color: '#ffffff', fontWeight: 700,
  fontSize: '14px', padding: '10px 30px', borderRadius: '8px',
  border: 'none', cursor: 'pointer',
};

/* ═══════════════════════════════════════════════════════════════
   소형 컴포넌트
═══════════════════════════════════════════════════════════════ */

/** 섹션 카드 래퍼 */
function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-4">
      {children}
    </section>
  );
}

/** 섹션 제목 */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>{children}</h2>
  );
}

/** 입력 필드 래퍼 */
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '3px' }}>{label}</p>
      {children}
    </div>
  );
}

/** 미리보기 정보 행 */
function PRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={{ display: 'inline-block', width: '72px', fontWeight: 600, color: '#374151' }}>
        {label}
      </span>
      <span style={{ color: '#374151' }}> : </span>
      <span style={{ color: '#111' }}>{value}</span>
    </div>
  );
}

/** 미리보기 표 td 스타일 */
function ptd(extra?: React.CSSProperties): React.CSSProperties {
  return {
    padding: '5px 4px',
    border: '1px solid #d1d5db',
    backgroundColor: '#fff',
    minHeight: '24px',
    ...extra,
  };
}
