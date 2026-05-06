/**
 * AXData Cloud API Client
 * 모든 채널(SaaS·온디바이스·모바일·클라우드)에서 공통 사용
 *
 * 보안 원칙:
 * - 모든 알고리즘은 Cloud Run 서버에 있음
 * - 이 클라이언트는 API 호출만 담당
 * - 영업 비밀 노출 0%
 */

const AXDATA_API = 'https://axdata-uploader-330974399500.asia-northeast3.run.app';

// ============================================================
// 사용자 유형 자동 감지
// ============================================================
function getUserType() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('edu') || params.get('education')) {
    localStorage.setItem('axdata_user_type', 'education');
    return 'education';
  }
  if (params.get('ent') || params.get('enterprise')) {
    localStorage.setItem('axdata_user_type', 'enterprise');
    return 'enterprise';
  }
  return localStorage.getItem('axdata_user_type') || 'free';
}

// ============================================================
// 사용량 관리 (브라우저 + 서버 동기화)
// ============================================================
function getTodayUsage() {
  const today = new Date().toISOString().slice(0, 10);
  const usage = JSON.parse(localStorage.getItem('axdata_usage') || '{}');
  return usage[today] || 0;
}

function incrementUsage(count) {
  const today = new Date().toISOString().slice(0, 10);
  const usage = JSON.parse(localStorage.getItem('axdata_usage') || '{}');
  usage[today] = (usage[today] || 0) + (count || 1);
  localStorage.setItem('axdata_usage', JSON.stringify(usage));
}

async function fetchQuota() {
  try {
    const res = await fetch(`${AXDATA_API}/api/quota`);
    if (!res.ok) throw new Error('quota 조회 실패');
    return await res.json();
  } catch (err) {
    console.error('Quota fetch error:', err);
    return {
      free_daily: 10,
      education_daily: 100,
      member_daily: 100,
      enterprise_daily: 9999
    };
  }
}

async function trackUsage(channel, fileCount) {
  try {
    await fetch(`${AXDATA_API}/api/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: channel || 'saas', files: fileCount || 1 })
    });
  } catch (err) {
    console.error('Track error:', err);
  }
}

async function checkQuotaLimit(fileCount) {
  const userType = getUserType();
  const used = getTodayUsage();
  const quota = await fetchQuota();

  let limit = quota.free_daily || 10;
  if (userType === 'education') limit = quota.education_daily || 100;
  else if (userType === 'member') limit = quota.member_daily || 100;
  else if (userType === 'enterprise') limit = quota.enterprise_daily || 9999;

  return {
    userType,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    canProceed: (used + fileCount) <= limit
  };
}

// ============================================================
// 핵심 API 호출 (Cloud Run으로 위임)
// ============================================================

// 5W1H 추출
async function apiExtract(text, filename) {
  try {
    const res = await fetch(`${AXDATA_API}/api/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, filename })
    });
    if (!res.ok) throw new Error('추출 실패');
    return await res.json();
  } catch (err) {
    console.error('Extract error:', err);
    return null;
  }
}

// DQS 평가
async function apiGrade(channels) {
  try {
    const res = await fetch(`${AXDATA_API}/api/grade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channels })
    });
    if (!res.ok) throw new Error('평가 실패');
    return await res.json();
  } catch (err) {
    console.error('Grade error:', err);
    return null;
  }
}

// AI 자동 보완 (진화)
async function apiEvolve(record) {
  try {
    const res = await fetch(`${AXDATA_API}/api/evolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ record })
    });
    if (!res.ok) throw new Error('진화 실패');
    return await res.json();
  } catch (err) {
    console.error('Evolve error:', err);
    return null;
  }
}

// 검색
async function apiSearch(query, records) {
  try {
    const res = await fetch(`${AXDATA_API}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, records })
    });
    if (!res.ok) throw new Error('검색 실패');
    return await res.json();
  } catch (err) {
    console.error('Search error:', err);
    return null;
  }
}

// AI 질의응답
async function apiQA(question, records) {
  try {
    const res = await fetch(`${AXDATA_API}/api/qa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, records })
    });
    if (!res.ok) throw new Error('질의응답 실패');
    return await res.json();
  } catch (err) {
    console.error('QA error:', err);
    return null;
  }
}

// ============================================================
// 사용자 표시 헬퍼
// ============================================================
function getUserTypeLabel(type) {
  const labels = {
    free: '🆓 무료',
    education: '🎓 교육생',
    member: '👤 회원',
    enterprise: '🏢 기업'
  };
  return labels[type] || labels.free;
}

function getUserTypeColor(type) {
  const colors = {
    free: '#B0BEC5',
    education: '#FFC107',
    member: '#5eead4',
    enterprise: '#CE93D8'
  };
  return colors[type] || colors.free;
}

// 한도 초과 메시지
function showQuotaBlockedMessage(check) {
  const label = getUserTypeLabel(check.userType);
  alert(`⚠️ 일일 사용 한도 초과\n\n` +
    `• 사용자 유형: ${label}\n` +
    `• 오늘 사용량: ${check.used}건 / ${check.limit}건\n` +
    `• 남은 한도: ${check.remaining}건\n\n` +
    `[해결 방법]\n` +
    `• 내일 다시 시도 (자정에 초기화)\n` +
    `• 교육생: 교육 코드를 받아 사용\n` +
    `• 기업 고객: 기업 구독 신청\n\n` +
    `[문의]\nabc@bigdt.co.kr / 010-5234-3535`);
}
