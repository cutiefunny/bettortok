import React from 'react';

async function getLiveMatches() {
  const localApiUrl = 'http://localhost:3000/api/matchlist'; // API 라우트 경로

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

    // --- 변경된 부분: 오늘 데이터 가져오기 ---
    const responseToday = await fetch(localApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // API 라우트(/api/matchlist/route.js)에서 schDate를 받아서 사용하도록 수정할 예정
      body: JSON.stringify({ schDate: todaySchDate }),
      next: { revalidate: false },
    });

    if (!responseToday.ok) {
      console.error(`Failed to fetch today's data: ${responseToday.status}`);
      // return {}; // 오늘 데이터 실패 시 에러 처리
      // throw new Error(`HTTP error! status: ${responseToday.status}`); // 에러 발생 시 전체 중단
    }
    const dataToday = await responseToday.json();
    const matchesToday = dataToday.dl_data || [];

    // --- 변경된 부분: 다음 날 데이터 가져오기 ---
    const responseTomorrow = await fetch(localApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ schDate: tomorrowSchDate }),
      next: { revalidate: false },
    });

    if (!responseTomorrow.ok) {
      console.error(`Failed to fetch tomorrow's data: ${responseTomorrow.status}`);
      // return {}; // 다음 날 데이터 실패 시 에러 처리
      // throw new Error(`HTTP error! status: ${responseTomorrow.status}`); // 에러 발생 시 전체 중단
    }
    const dataTomorrow = await responseTomorrow.json();
    const matchesTomorrow = dataTomorrow.dl_data || [];

    console.log("Today's matches:", matchesToday);
    console.log("Tomorrow's matches:", matchesTomorrow);

    // --- 두 날짜의 경기 데이터 합치기 ---
    let allMatches = [...matchesToday, ...matchesTomorrow];

    // 1. 현재 시간 이후의 경기만 필터링
    // const currentKST = new Date(); // 현재 서버 시간 (KST)

    // allMatches = allMatches.filter(match => {
    //   const matchStartDateTime = parseMatchDateTimeKST(match.MCH_DTM);
    //   return matchStartDateTime.getTime() > currentKST.getTime(); // 현재 시간보다 미래인 경기만 남김
    // });

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