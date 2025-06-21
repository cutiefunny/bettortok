import React from 'react';
// date-fns-tz 라이브러리 임포트
import { toZonedTime, formatInTimeZone, zonedTimeToUtc } from 'date-fns-tz';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale'; // 한국어 로케일 임포트 (요일 표시용)

// [수정] KST 시간대 문자열을 전역 상수로 정의합니다.
const TIME_ZONE = 'Asia/Seoul';

// [수정] KST를 고려하여 Date 객체를 생성하는 헬퍼 함수를 전역으로 이동합니다.
// API에서 넘어오는 MCH_DTM (yyyyMMddHHmmss) 문자열이 KST라고 가정하고,
// 이를 정확한 KST Date 객체로 변환합니다.
const parseMatchDateTimeKST = (dtmString) => {
  // API 문자열을 Date 객체로 변환 (일단 로컬 시간대로 파싱)
  const year = parseInt(dtmString.substring(0, 4), 10);
  const month = parseInt(dtmString.substring(4, 6), 10) - 1; // 월은 0부터 시작
  const day = parseInt(dtmString.substring(6, 8), 10);
  const hour = parseInt(dtmString.substring(8, 10), 10);
  const minute = parseInt(dtmString.substring(10, 12), 10);
  const second = parseInt(dtmString.substring(12, 14), 10);

  // KST 기준으로 이 시간을 Date 객체로 생성합니다.
  // 이는 서버의 시스템 시간대가 UTC이더라도 KST 22시를 정확히 표현합니다.
  // zonedTimeToUtc로 KST 문자열을 UTC Date 객체로 변환한 뒤,
  // toZonedTime으로 KST 시간대에 맞게 Date 객체를 "표시"하도록 합니다.
  const kstDateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
  return toZonedTime(kstDateString, TIME_ZONE); // 함수 이름 변경
};


// 이 함수는 서버 컴포넌트에서 실행될 것이므로 'use client' 지시어가 필요 없습니다.
// 데이터를 서버에서 가져와 클라이언트에 전달합니다.
async function getLiveMatches() {
  const externalApiUrl = 'https://musclecat.co.kr/getLiveMatchInfo';


  try {
    // 현재 KST 기준 날짜 계산
    const nowInKST = toZonedTime(new Date(), TIME_ZONE); // 서버의 UTC 시간을 KST로 변환
    
    const todaySchDate = formatInTimeZone(nowInKST, TIME_ZONE, 'yyyy.MM.dd'); // KST 기준 오늘 날짜
    
    // 다음 날짜 계산 (KST 기준으로 다음 날)
    const tomorrowInKST = new Date(nowInKST);
    tomorrowInKST.setDate(nowInKST.getDate() + 1); // KST 기준으로 다음 날짜로 설정
    const tomorrowSchDate = formatInTimeZone(tomorrowInKST, TIME_ZONE, 'yyyy.MM.dd'); // KST 기준 내일 날짜

    // 오늘 데이터 가져오기
    const requestBodyToday = {
      schDate: todaySchDate,
      _sbmInfo: { _sbmInfo: { debugMode: 'false' } }
    };
    const responseToday = await fetch(externalApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBodyToday),
      // Next.js 13+ 서버 컴포넌트에서 데이터 캐싱 동작을 제어합니다.
      // false로 설정하면 요청 시마다 새로운 데이터를 가져옵니다.
      next: { revalidate: false }, 
    });

    if (!responseToday.ok) {
      console.error(`Failed to fetch today's data: ${responseToday.status}, ${await responseToday.text()}`);
      // 실패 시 빈 배열 반환 대신 에러를 던지거나 명확히 처리
      return {}; 
    }
    const dataToday = await responseToday.json();
    const matchesToday = dataToday.data?.dl_data || []; // ?. 연산자로 안전하게 접근

    // 다음 날 데이터 가져오기
    const requestBodyTomorrow = {
      schDate: tomorrowSchDate,
      _sbmInfo: { _sbmInfo: { debugMode: 'false' } }
    };
    const responseTomorrow = await fetch(externalApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBodyTomorrow),
      next: { revalidate: false },
    });

    if (!responseTomorrow.ok) {
      console.error(`Failed to fetch tomorrow's data: ${responseTomorrow.status}, ${await responseTomorrow.text()}`);
      return {};
    }
    const dataTomorrow = await responseTomorrow.json();
    const matchesTomorrow = dataTomorrow.data?.dl_data || []; // ?. 연산자로 안전하게 접근

    let allMatches = [...matchesToday, ...matchesTomorrow];

    // 1. 현재 KST 시간 이후의 경기만 필터링
    const currentKST = toZonedTime(new Date(), TIME_ZONE); // 현재 KST 시간

    allMatches = allMatches.filter(match => {
      const matchStartDateTime = parseMatchDateTimeKST(match.MCH_DTM);
      // getTime()으로 비교해야 정확합니다.
      return matchStartDateTime.getTime() > currentKST.getTime(); 
    });

    // 2. 필터링된 경기를 마감시간(MCH_DTM) 기준으로 정렬
    allMatches.sort((a, b) => {
      const timeA = parseMatchDateTimeKST(a.MCH_DTM).getTime();
      const timeB = parseMatchDateTimeKST(b.MCH_DTM).getTime();
      return timeA - timeB; // 오름차순 (시간이 빠를수록 먼저)
    });

    // 3. 마감시간별로 경기들을 그룹화
    const groupedMatches = {};

    allMatches.forEach(match => {
      const matchDateTime = parseMatchDateTimeKST(match.MCH_DTM);
      
      // date-fns의 format 함수와 ko 로케일을 사용하여 요일과 시간을 포맷팅
      const groupKey = format(matchDateTime, 'MM.dd(EEE) HH:mm', { locale: ko }) + ' 마감';

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
                    <td>
                      {/* MCH_DTM_H는 API에서 제공하는 포맷된 시간인데,
                          이것도 KST로 맞춰져 있는지 확인 필요.
                          정확한 KST 시간 표시를 위해 parseMatchDateTimeKST 사용 가능.
                      */}
                      {formatInTimeZone(parseMatchDateTimeKST(match.MCH_DTM), TIME_ZONE, 'HH:mm', { locale: ko })}
                    </td>
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
