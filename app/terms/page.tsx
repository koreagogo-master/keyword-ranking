export default function TermsPage() {
  return (
    <div className="bg-gray-50 py-16 px-6">
      <div className="max-w-4xl mx-auto bg-white p-10 md:p-16 rounded-xl shadow-sm border border-gray-100">
        <h1 className="text-3xl font-black text-slate-800 mb-8">이용약관</h1>
        <div className="prose max-w-none text-sm text-slate-600 leading-loose space-y-6">
          <p><strong>제 1 조 (목적)</strong><br />
          본 약관은 주식회사 티엠지(이하 "회사")가 운영하는 TMG AD 서비스(이하 "서비스")의 이용과 관련하여 회사와 회원 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.</p>
          
          <p><strong>제 2 조 (용어의 정의)</strong><br />
          1. "회원"이란 본 약관에 동의하고 서비스를 이용하는 자를 말합니다.<br />
          2. "포인트"란 회원이 서비스 내의 유료 기능을 이용하기 위해 구매하는 가상의 결제 수단을 말합니다.</p>

          <p><strong>제 3 조 (포인트 결제 및 환불 규정) - *PG사 필수 항목*</strong><br />
          1. 회원은 회사가 제공하는 결제 수단(신용카드, 간편결제 등)을 통해 포인트를 충전할 수 있습니다.<br />
          2. <strong>환불 정책:</strong> 충전한 포인트는 결제일로부터 7일 이내에 미사용 상태일 경우 전액 환불이 가능합니다. 단, 충전한 포인트를 1포인트라도 사용한 경우, 해당 결제건은 환불이 불가합니다.<br />
          3. 무료로 지급된 이벤트 포인트나 보너스 포인트는 환불 대상에서 제외되며, 타인에게 양도할 수 없습니다.</p>

          <p><strong>제 4 조 (서비스의 중단)</strong><br />
          회사는 컴퓨터 등 정보통신설비의 보수점검, 교체 및 고장, 통신두절 또는 운영상 타당한 이유가 있는 경우 서비스의 제공을 일시적으로 중단할 수 있습니다.</p>

          <p className="mt-12 text-gray-400">부칙: 본 약관은 2026년 3월 12일부터 시행됩니다.</p>
        </div>
      </div>
    </div>
  );
}