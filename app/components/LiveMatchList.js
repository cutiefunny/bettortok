import React from 'react';
import { toZonedTime, formatInTimeZone, zonedTimeToUtc } from 'date-fns-tz';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

const TIME_ZONE = 'Asia/Seoul';

// API에서 넘어오는 MCH_DTM (yyyyMMddHHmmss) 문자열이 KST라고 가정하고,
// 이를 정확한 KST Date 객체로 변환합니다.
const parseMatchDateTimeKST = (dtmString) => {
  if (!dtmString || dtmString.length !== 14) {
    console.warn("Invalid dtmString format:", dtmString);
    return new Date(); // 유효하지 않은 경우 현재 시간 반환 또는 에러 처리
  }
  const year = parseInt(dtmString.substring(0, 4), 10);
  const month = parseInt(dtmString.substring(4, 6), 10) - 1; // 월은 0부터 시작
  const day = parseInt(dtmString.substring(6, 8), 10);
  const hour = parseInt(dtmString.substring(8, 10), 10);
  const minute = parseInt(dtmString.substring(10, 12), 10);
  const second = parseInt(dtmString.substring(12, 14), 10);

  const kstDateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
  return toZonedTime(kstDateString, TIME_ZONE);
};

// 배당률 변경 아이콘을 결정하는 헬퍼 함수
const getAllotChangeIcon = (currentAllot, prevAllot) => {
  if (!prevAllot || prevAllot === 0) return null; // 이전 배당률이 없거나 0이면 아이콘 없음

  if (currentAllot > prevAllot) {
    return <span className="rate-up">▲</span>;
  } else if (currentAllot < prevAllot) {
    return <span className="rate-down">▼</span>;
  }
  return null;
};

// 이 함수는 서버 컴포넌트에서 실행될 것이므로 'use client' 지시어가 필요 없습니다.
// 데이터를 서버에서 가져와 클라이언트에 전달합니다.
async function getLiveMatches() {
  const externalApiUrl = 'https://musclecat.co.kr/inqMainGameInfo';

  try {
    const requestBody = {
      _sbmInfo: { debugMode: 'false' }
    };

    const response = await fetch(externalApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      next: { revalidate: 10 },
    });

    if (!response.ok) {
      console.error(`Failed to fetch data: ${response.status}, ${await response.text()}`);
      return { schedulesList: [], tooltipList: [] };
    }
    const data = await response.json();
    const schedules = data.data?.schedulesList || [];
    const tooltips = data.data?.tooltipList || [];

    const tooltipMap = new Map();
    tooltips.forEach(tooltip => {
      const key = `${tooltip.GM_SEQ}`;
      if (!tooltipMap.has(key) || tooltip.CHG_DTM > tooltipMap.get(key).CHG_DTM) {
        tooltipMap.set(key, tooltip);
      }
    });

    const currentKST = toZonedTime(new Date(), TIME_ZONE);

    // gameDateStr을 YYYYMMDDHHmmss 형식으로 변환하는 헬퍼 함수
    const convertGameDateStrToDtmString = (gameDateStr) => {
      const match = gameDateStr.match(/(\d{2})\.(\d{2})\.(\d{2}) \(.\) (\d{2}):(\d{2})/);
      if (match) {
        const [, year, month, day, hour, minute] = match;
        const fullYear = `20${year}`; // '25' -> '2025'
        return `${fullYear}${month}${day}${hour}${minute}00`; // 초는 '00'으로 고정
      }
      return null;
    };

    let allMatches = schedules.filter(match => {
      const dtmStringForParse = convertGameDateStrToDtmString(match.gameDateStr);
      if (!dtmStringForParse) return false; // 변환 실패 시 필터링
      
      const matchStartDateTime = parseMatchDateTimeKST(dtmStringForParse);
      return matchStartDateTime.getTime() > currentKST.getTime();
    });

    allMatches.sort((a, b) => {
      const dtmStringA = convertGameDateStrToDtmString(a.gameDateStr);
      const dtmStringB = convertGameDateStrToDtmString(b.gameDateStr);

      if (!dtmStringA || !dtmStringB) return 0; // 변환 실패 시 정렬에 영향 없도록

      const timeA = parseMatchDateTimeKST(dtmStringA).getTime();
      const timeB = parseMatchDateTimeKST(dtmStringB).getTime();
      return timeA - timeB;
    });

    const groupedMatches = {};

    allMatches.forEach(match => {
      // gameDateStr 전체를 그룹 키로 사용
      const groupKey = match.gameDateStr + ' 마감';

      if (!groupedMatches[groupKey]) {
        groupedMatches[groupKey] = [];
      }

      const latestTooltip = tooltipMap.get(`${match.matchSeq}`);

      groupedMatches[groupKey].push({
        ...match,
        prevWinAllot: latestTooltip ? latestTooltip.BCHG_W_ODDS / 100 : null,
        prevDrawAllot: latestTooltip ? latestTooltip.BCHG_D_ODDS / 100 : null,
        prevLoseAllot: latestTooltip ? latestTooltip.BCHG_L_ODDS / 100 : null,
      });
    });

    return groupedMatches;
  } catch (error) {
    console.error("Failed to fetch live matches:", error);
    return { schedulesList: [], tooltipList: [] };
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
            <div className="match-time-header">
              {groupKey}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <tbody>
                  {groupedMatches[groupKey].map((match, index) => (
                    <tr key={`${match.matchSeq}-${match.gameDateStr}-${index}`} style={{ whiteSpace: 'nowrap' }}>
                      <td>{match.matchSeq}</td>
                      <td>{match.leagueName}</td>
                      <td>{match.homeName}</td>
                      <td>
                        {match.winHandi !== 0 ? (
                          <span>
                            {match.winHandi}
                          </span>
                        ) : '-'}
                      </td>
                      <td>{match.awayName}</td>
                      <td>
                        {match.winAllot !== 0 ? (
                          <span className="rate-cell">
                            {match.winAllot}
                            {getAllotChangeIcon(match.winAllot, match.prevWinAllot)}
                          </span>
                        ) : '-'}
                      </td>
                      <td>
                        {match.drawAllot !== 0 ? (
                          <span className="rate-cell">
                            {match.drawAllot}
                            {getAllotChangeIcon(match.drawAllot, match.prevDrawAllot)}
                          </span>
                        ) : '-'}
                      </td>
                      <td>
                        {match.loseAllot !== 0 ? (
                          <span className="rate-cell">
                            {match.loseAllot}
                            {getAllotChangeIcon(match.loseAllot, match.prevLoseAllot)}
                          </span>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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