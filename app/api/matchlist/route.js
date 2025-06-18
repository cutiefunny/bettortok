import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const externalApiUrl = 'https://www.betman.co.kr/matchinfo/inqMainLivescreMchList.do';

    // --- 변경된 부분: 요청 본문에서 schDate를 가져오도록 수정 ---
    const requestBodyFromClient = await request.json(); // 클라이언트에서 보낸 JSON 본문을 파싱
    const schDate = requestBodyFromClient.schDate; // schDate 값 추출

    // schDate가 필수이므로, 없으면 에러 처리 (클라이언트에서 항상 보내야 함)
    if (!schDate) {
      return NextResponse.json(
        { message: 'schDate is required in the request body' },
        { status: 400 }
      );
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