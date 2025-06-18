import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const externalApiUrl = 'https://www.betman.co.kr/matchinfo/inqMainLivescreMchList.do';

    // *** 중요: 여기서 요청 본문(body)에서 schDate를 가져와야 합니다. ***
    const requestBodyFromClient = await request.json(); // 클라이언트에서 보낸 JSON 본문을 파싱
    let schDate = requestBodyFromClient.schDate; // schDate 값 추출

    // 만약 schDate가 없으면 기본값 설정 (선택 사항)
    if (!schDate) {
      schDate = `2025.06.19`;
    }
    // ***************************************************************

    // 외부 API 호출에 사용할 최종 요청 본문
    const externalApiRequestBody = {
      schDate: schDate, // 클라이언트로부터 받은 schDate 사용
      _sbmInfo: {
        _sbmInfo: {
          debugMode: 'false'
        }
      }
    };

    // 외부 API 호출
    const response = await fetch(externalApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(externalApiRequestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`External API call failed: ${response.status} - ${errorText}`);
      return NextResponse.json(
        { message: 'Failed to fetch data from external API', error: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 200 });

  } catch (error) {
    console.error('Error in /api/matchlist route:', error);
    return NextResponse.json(
      { message: 'Internal Server Error', error: error.message },
      { status: 500 }
    );
  }
}