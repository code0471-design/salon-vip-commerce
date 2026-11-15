// 살롱 VIP 설정
// - 지금은 GitHub Pages로 검증 (github.io에서는 local-api가 브라우저 공유 DB로 /api 응답)
// - 나중에 앱스토어·실서버 붙일 때 apiBase에 서버 URL만 넣으면 됨
window.__SALON_CONFIG__ = {
  apiBase: '',
  // 앱스토어/실서버 예: apiBase: 'https://api.salon-vip.example.com',
};
