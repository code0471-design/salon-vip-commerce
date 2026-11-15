// 살롱 VIP — 실서버 전용 설정 (브라우저 localStorage / local-api 사용 안 함)
// apiBase가 비어 있으면 같은 origin의 /api 를 쓴다 (Node server.js가 HTML+API 함께 제공).
// GitHub Pages 등 정적 호스팅만 쓸 때는 아래에 실서버 URL을 넣는다.
window.__SALON_CONFIG__ = {
  apiBase: '',
  // 예: apiBase: 'https://salon-vip.example.com',
};
