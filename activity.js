'use strict';
(()=>{
const main=document.createElement('main');main.id='collective-work';main.tabIndex=-1;main.innerHTML=`
<header class="work-header"><div><p class="eyebrow">COLLECTIVE WORK / 함께하는 일</p><h1>혼자 품었던 질문을,<br>함께 풀어갈 수 있도록.</h1><p>내가 겪은 변화에 당신의 경험을 더합니다.</p><p class="work-path">사건 확인 <span>▶</span> 정책 연결 <span>▶</span> 국가 간 비교</p></div><a class="work-back" href="#work-communities">커뮤니티 &amp; 소사이어티 찾아보기</a></header>
<div class="work-state"><span class="state-badge preparing">커뮤니티 준비 단계</span><p>질문을 남기고, 근거를 확인하고, 함께 논의할 분야를 찾아보세요.</p></div>

<section id="work-current" class="work-section"><div class="work-section-heading"><h2>우리의 출발점</h2></div><div class="work-grid">
<article class="work-card"><span class="state-badge available">기반 구현</span><h3>우려를 구체적인 사건으로</h3><p>무슨 일이 있었고, 누가 영향을 받았을까요? 관심 있는 사건을 원문에서 확인합니다.</p><p class="card-scope">OECD AIM · 전체 건수 / 최신 100건 분류</p><button class="work-action" id="work-explore">관심 있는 사건 찾아보기</button></article>
<article class="work-card"><span class="state-badge preparing">정책 자료 연결 준비 중</span><h3>우리를 지킬 대응을 찾아</h3><p>비슷한 피해를 줄일 방법은 무엇일까요? 알고 있는 정책에서 실마리를 찾습니다.</p><a class="work-action" href="#work-results" data-path="policy">질문에서 정책 논의까지 살펴보기</a></article>
<article class="work-card"><span class="state-badge proposed">공동 작업 제안</span><h3>다른 나라의 경험에서 배우기</h3><p>같은 문제를 먼저 겪은 곳은 어떻게 대응했을까요? 다른 나라의 경험을 연결합니다.</p><a class="work-action" href="#work-communities" data-path="compare">함께 비교할 관점 찾아보기</a></article>
</div></section>
<section id="work-results" class="work-section"><div class="work-section-heading"><h2>함께 쌓을 근거</h2></div><div class="result-note"><p>한 사람의 확인이, 다음 사람의 출발점이 됩니다.</p><span>공동 검토 결과는 아직 없습니다. 확인한 내용과 출처를 이곳에 모을 예정입니다.</span></div></section>
<section id="work-contribute" class="work-section"><div class="work-section-heading"><h2>내가 보탤 한 가지</h2><p>완성된 답이 아니어도 괜찮습니다. 사실 하나, 질문 하나부터.</p></div><div class="contribute-layout"><div><div class="task-options" role="group" aria-label="기여할 작업"><button data-task="source" aria-pressed="true">사건의 근거 살펴보기</button><button data-task="policy" aria-pressed="false">알고 있는 정책 보태기</button><button data-task="compare" aria-pressed="false">다른 나라의 경험 연결하기</button></div><p id="task-help"></p></div><form id="contribution-form"><label for="work-topic">함께 살펴볼 주제</label><input id="work-topic" required maxlength="300" placeholder="예: 생성형 AI와 개인정보 피해"><label for="work-source">함께 읽을 출처 주소</label><input id="work-source" type="url" placeholder="https://" maxlength="2000"><label for="work-note">확인한 사실과 남은 질문</label><textarea id="work-note" required rows="5" maxlength="6000" placeholder="확인한 사실:
함께 풀고 싶은 질문:"></textarea><button class="journey-primary" type="submit">내 검토 초안 내려받기</button><p id="contribution-status" role="status"></p><small>온라인 제출·참여 등록은 준비 중입니다. 입력은 서버에 저장되지 않으니 새로고침 전 초안을 내려받으세요.</small></form></div></section>
<footer class="work-footer"><span>서로의 작은 확인이, 함께 대응할 길을 넓힙니다.</span><a href="#work-communities">커뮤니티 &amp; 소사이어티 찾아보기</a></footer>`;
document.querySelector('#observatory').after(main);
})();
