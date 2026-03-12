export default function ContactPage() {
  return (
    <div className="bg-gray-50 min-h-[60vh] py-16 px-6">
      <div className="max-w-3xl mx-auto text-center mt-10">
        <h1 className="text-3xl font-black text-slate-800 mb-4">무엇을 도와드릴까요?</h1>
        <p className="text-slate-500 mb-12">결제, 오류 신고, 서비스 제휴 등 궁금하신 점을 언제든 문의해 주세요.</p>

        <div className="grid md:grid-cols-2 gap-6 text-left">
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
            <div className="text-3xl mb-4">📞</div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">고객센터 전화</h3>
            <p className="text-2xl font-black text-blue-600 mb-4">02-2201-1881</p>
            <p className="text-sm text-slate-500 leading-relaxed">
              <strong>운영시간:</strong> 평일 10:00 ~ 17:00<br />
              (점심시간 12:00 ~ 13:00 / 주말 및 공휴일 휴무)
            </p>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
            <div className="text-3xl mb-4">✉️</div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">이메일 문의</h3>
            <p className="text-lg font-bold text-slate-700 mb-4">con@tmgst.com</p>
            <p className="text-sm text-slate-500 leading-relaxed">
              운영시간 외에는 이메일을 남겨주시면<br />
              영업일에 확인 후 빠르게 답변해 드리겠습니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}