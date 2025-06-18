/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  async rewrites() {
    return [
      {
        source: "/betman/:path*",
        destination: "https://www.betman.co.kr/matchinfo/:path*",
      },
      {
        source: "/naver/:path*",
        destination: "https://openapi.naver.com/v1/search/:path*",
      },
      // { // 이 라우트는 현재 사용하지 않으므로 주석 처리 또는 삭제 가능
      //   source: "/(.*)",
      //   destination: "/",
      // },
    ];
  },
};

export default nextConfig;