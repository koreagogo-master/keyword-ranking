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

          <p><strong>제 3 조 (포인트 결제 취소 및 환불)</strong><br />
          1. 회원이 결제한 '포인트'는 무형의 디지털 재화로, 다음 각 호의 기준에 따라 환불을 규정합니다.<br />
          2. <strong>전액 환불:</strong> 결제 완료일로부터 7일 이내에 충전한 포인트를 단 1원(1P)도 사용하지 않은 경우, 회원의 요청 시 100% 전액 환불이 가능합니다.<br />
          3. <strong>환불 불가:</strong> 다음 각 호에 해당하는 경우 환불이 절대 불가합니다.<br />
          &nbsp;&nbsp;&nbsp;&nbsp;- 결제 완료일로부터 7일이 경과한 경우<br />
          &nbsp;&nbsp;&nbsp;&nbsp;- 충전한 포인트를 일부라도 사용한 경우 (서비스 특성상 데이터 열람 즉시 가치가 소모되므로 잔여 포인트에 대한 부분 환불은 제공하지 않습니다.)<br />
          &nbsp;&nbsp;&nbsp;&nbsp;- 이벤트, 프로모션, 또는 결제 시 추가로 지급된 '무료 포인트(보너스)'는 환불 대상에서 제외됩니다.<br />
          4. 환불 요청은 고객센터(이메일 또는 1:1 문의)를 통해 접수해야 하며, 회사는 접수일로부터 3영업일 이내에 결제 취소 처리를 진행합니다.</p>

          <p><strong>제 4 조 (서비스의 중단)</strong><br />
          회사는 컴퓨터 등 정보통신설비의 보수점검, 교체 및 고장, 통신두절 또는 운영상 타당한 이유가 있는 경우 서비스의 제공을 일시적으로 중단할 수 있습니다.</p>

          <p className="mt-12 text-gray-400">부칙: 본 약관은 2026년 3월 12일부터 시행됩니다.</p>
        </div>
      </div>
    </div>
  );
}