import LiveMatchList from './components/LiveMatchList'; // LiveMatchList 컴포넌트 임포트

export default function HomePage() {
  return (
    <main>
      {/* 상단 헤더 섹션 */}
      <div className="header-bar">
        <div className="logo">
          <img src="/images/logo.png" alt="로고" className="logo-image" />
          </div> 
        <div className="nav-links">
          <span>승부식</span> {/* 현재 페이지 */}
          <span>기록식</span>
        </div>
        <button className="login-button">login</button>
      </div>

      {/* 상단 정보 섹션 (73회차) */}
      <div className="current-round-info">
        <span>73회차</span>
      </div>

      {/* 금액 입력 및 버튼 섹션 */}
      <div className="betting-amount-section">
        <span className="currency-symbol">₩</span>
        <input type="number" className="amount-input" placeholder="0" />
        <button className="quick-amount-button">1만</button>
        <button className="quick-amount-button">5만</button>
        <button className="quick-amount-button">10만</button>
        {/* 리셋 버튼은 여기서 분리하여 아래 'action-buttons'로 이동합니다. */}
      </div>

      {/* --- 변경된 부분: 리셋과 공유 버튼을 감싸는 새로운 div --- */}
      <div className="action-buttons-container">
        <button className="reset-button">리셋</button>
        <button className="share-button">공유</button>
      </div>

      {/* 라이브 매치 리스트 (메인 콘텐츠 테이블) */}
      <LiveMatchList />
    </main>
  );
}