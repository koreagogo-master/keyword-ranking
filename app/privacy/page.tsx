export default function PrivacyPage() {
  return (
    // 🌟 본문이 화면 중앙에 꽉 차게 배치되도록 설정되었습니다. (ml-64 없음)
    <div className="py-12 px-6">
      <div className="max-w-4xl mx-auto bg-white p-10 md:p-16 rounded-xl shadow-sm border border-gray-100">
        <h1 className="text-3xl font-black text-slate-800 mb-8">개인정보처리방침</h1>
        <div className="prose max-w-none text-[14px] text-slate-600 leading-loose space-y-6">
          <p>주식회사 티엠지(이하 "회사")는 회원의 개인정보를 중요시하며, "정보통신망 이용촉진 및 정보보호"에 관한 법률을 준수하고 있습니다.</p>

          <p><strong>1. 수집하는 개인정보 항목</strong><br />
          - 필수항목: 이메일, 비밀번호, 이름 (가입 시)<br />
          - 결제 시: 신용카드 결제기록, 접속 IP 정보, 서비스 이용 기록</p>

          <p><strong>2. 개인정보의 수집 및 이용 목적</strong><br />
          회사는 수집한 개인정보를 다음의 목적을 위해 활용합니다.<br />
          - 서비스 제공에 관한 계약 이행 및 요금 정산 (포인트 충전 및 결제)<br />
          - 회원 관리 및 고객 상담 지원</p>

          <p><strong>3. 개인정보의 보유 및 이용 기간 - *PG사 필수 항목*</strong><br />
          원칙적으로 개인정보 수집 및 이용 목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다. 단, 관계법령의 규정에 의하여 보존할 필요가 있는 경우 아래와 같이 보관합니다.<br />
          - 대금결제 및 재화 등의 공급에 관한 기록: <strong>5년 (전자상거래 등에서의 소비자보호에 관한 법률)</strong><br />
          - 소비자의 불만 또는 분쟁처리에 관한 기록: 3년</p>

          <p><strong>4. 개인정보 보호책임자</strong><br />
          - 담당자: 배상호<br />
          - 연락처: 02-2201-1881 / con@tmgst.com</p>
        </div>
      </div>
    </div>
  );
}