import React from 'react';

async function getLiveMatches() {
  // --- 변경된 부분: localApiUrl을 절대 URL로 구성 ---
  const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL;
  if (!baseUrl) {
    // 빌드 타임이나 특정 환경에서 환경 변수가 설정되지 않았을 경우를 대비한 대체
    // 개발 환경에서는 localhost를, Vercel 환경에서는 자동으로 도메인 설정
    console.warn("NEXT_PUBLIC_VERCEL_URL is not set. Falling back to default URL.");
    // 이 부분은 실제 배포 환경에 따라 다르게 설정해야 합니다.
    // 만약 항상 'https://bettortok.vercel.app'을 기본으로 사용하고 싶다면 직접 지정 가능
    // 또는 개발 모드에서만 'http://localhost:3000'을 사용하도록 할 수 있습니다.
    // 여기서는 개발 모드 기준으로 'http://localhost:3000'을 기본값으로 사용합니다.
    const isDev = process.env.NODE_ENV === 'development';
    const defaultBaseUrl = isDev ? 'http://localhost:3000' : 'https://bettortok.vercel.app'; // Vercel 배포 도메인으로 변경
    const localApiUrl = `${defaultBaseUrl}/api/matchlist`;
    console.log(`Using API URL: ${localApiUrl}`);
    // return early or throw error if URL cannot be determined
    // For now, continue with defaultBaseUrl
  }

  const localApiUrl = `${baseUrl || 'http://localhost:3000'}/api/matchlist`; // 최종적으로 사용될 URL
  // -------------------------------------------------------------

  // KST를 고려하여 Date 객체를 생성하는 헬퍼 함수
  const parseMatchDateTimeKST = (dtmString) => {
    const year = parseInt(dtmString.substring(0, 4), 10);
    const month = parseInt(dtmString.substring(4, 6), 10) - 1; // 월은 0부터 시작
    const day = parseInt(dtmString.substring(6, 8), 10);
    const hour = parseInt(dtmString.substring(8, 10), 10);
    const minute = parseInt(dtmString.substring(10, 12), 10);
    const second = parseInt(dtmString.substring(12, 14), 10);

    return new Date(year, month, day, hour, minute, second);
  };

  try {
    const today = new Date(); // 현재 시간 (KST 기준)
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todaySchDate = `${year}.${month}.${day}`;

    // 다음 날짜 계산
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1); // 다음 날로 설정
    const tomorrowYear = tomorrow.getFullYear();
    const tomorrowMonth = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const tomorrowDay = String(tomorrow.getDate()).padStart(2, '0');
    const tomorrowSchDate = `${tomorrowYear}.${tomorrowMonth}.${tomorrowDay}`;

    // 오늘 데이터 가져오기
    const responseToday = await fetch(localApiUrl, { // localApiUrl 사용
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ schDate: todaySchDate }), // schDate를 body에 실어 보냄
      next: { revalidate: false },
    });

    if (!responseToday.ok) {
      console.error(`Failed to fetch today's data from API route: ${responseToday.status}`);
    }
    const dataToday = await responseToday.json();
    const matchesToday = dataToday.dl_data || [];

    // 다음 날 데이터 가져오기
    const responseTomorrow = await fetch(localApiUrl, { // localApiUrl 사용
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ schDate: tomorrowSchDate }), // schDate를 body에 실어 보냄
      next: { revalidate: false },
    });

    if (!responseTomorrow.ok) {
      console.error(`Failed to fetch tomorrow's data from API route: ${responseTomorrow.status}`);
    }
    const dataTomorrow = await responseTomorrow.json();
    const matchesTomorrow = dataTomorrow.dl_data || [];

    let allMatches = [...matchesToday, ...matchesTomorrow];

    // 1. 현재 시간 이후의 경기만 필터링
    const currentKST = new Date(); // 현재 서버 시간 (KST)

    allMatches = allMatches.filter(match => {
      const matchStartDateTime = parseMatchDateTimeKST(match.MCH_DTM);
      return matchStartDateTime.getTime() > currentKST.getTime(); // 현재 시간보다 미래인 경기만 남김
    });

    // 2. 필터링된 경기를 마감시간(MCH_DTM) 기준으로 정렬
    allMatches.sort((a, b) => {
      const timeA = parseInt(a.MCH_DTM, 10);
      const timeB = parseInt(b.MCH_DTM, 10);
      return timeA - timeB; // 오름차순 (시간이 빠를수록 먼저)
    });

    // 3. 마감시간별로 경기들을 그룹화
    const groupedMatches = {};
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

    allMatches.forEach(match => {
      const matchDateTime = parseMatchDateTimeKST(match.MCH_DTM);
      const month = String(matchDateTime.getMonth() + 1).padStart(2, '0');
      const day = String(matchDateTime.getDate()).padStart(2, '0');
      const dayOfWeek = dayNames[matchDateTime.getDay()];
      const hours = String(matchDateTime.getHours()).padStart(2, '0');
      const minutes = String(matchDateTime.getMinutes()).padStart(2, '0');

      // "MM.DD(요일) HH:mm 마감" 형식의 키 생성
      const groupKey = `${month}.${day}(${dayOfWeek}) ${hours}:${minutes} 마감`;

      if (!groupedMatches[groupKey]) {
        groupedMatches[groupKey] = [];
      }
      groupedMatches[groupKey].push(match);
    });

    return groupedMatches; // 그룹화된 객체 반환
  } catch (error) {
    console.error("Failed to fetch live matches:", error);
    return {}; // 에러 발생 시 빈 객체 반환
  }
}

export default async function LiveMatchList() {
  const groupedMatches = await getLiveMatches();
  const groupKeys = Object.keys(groupedMatches);

  return (
    <div>
      {groupKeys.length > 0 ? (
        groupKeys.map(groupKey => (
          <React.Fragment key={groupKey}>
            {/* 마감시간 헤더 */}
            <div className="match-time-header">
              {groupKey}
            </div>
            <table>
              <thead>
                <tr>
                  <th>No.</th>
                  <th>리그명</th>
                  <th>홈 팀</th>
                  <th>원정 팀</th>
                  <th>시작</th>
                  <th>승</th>
                  <th>무</th>
                  <th>패</th>
                </tr>
              </thead>
              <tbody>
                {groupedMatches[groupKey].map((match, index) => (
                  <tr key={`${match.OUTER_GM_OSID_TS}-${match.MCH_DTM}-${index}`}>
                    <td>{match.OUTER_GM_OSID_TS}</td>
                    <td>{match.LEAG_NM}</td>
                    <td>{match.HOME_NM}</td>
                    <td>{match.AWAY_NM}</td>
                    <td>{match.MCH_DTM_H}</td>
                    <td>-</td>
                    <td>-</td>
                    <td>-</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </React.Fragment>
        ))
      ) : (
        <div style={{ textAlign: 'center', padding: '20px', color: '#888', border: '1px solid #ddd', marginTop: '20px' }}>
          현재 진행 중이거나 마감된 경기가 없습니다.
        </div>
      )}
    </div>
  );
}