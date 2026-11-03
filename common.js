/**
 * 방명록 공통 코드 — firebase-config.js 다음에 불러옵니다.
 * ------------------------------------------------------------------
 * 작성(index) · 디스플레이(display) · 관리자(admin) 세 페이지가 함께 씁니다.
 * 복도 TV 내장 브라우저(크롬 85)에서도 돌아가도록 ES5 문법으로만 씁니다.
 *
 * Firestore 구조
 *   settings/app                         { defaultEventId }  ← 고정 주소가 여는 방명록
 *   events/{eventId}                     방명록 하나의 설정 (제목, 구분, 문구 …)
 *   events/{eventId}/entries/{entryId}   공개용 소감 (이름은 이미 가려진 상태)
 *   events/{eventId}/private/{entryId}   원래 이름 — 관리자만 읽을 수 있습니다
 */

var db;

var GB = (function () {
  firebase.initializeApp(FIREBASE_CONFIG);
  db = firebase.firestore();

  // 학교망이나 구형 TV 브라우저에서 실시간 연결이 막히면 자동으로 다른 방식으로 붙습니다.
  try {
    db.settings({ experimentalAutoDetectLongPolling: true });
  } catch (err) {
    // 설정을 못 바꿔도 기본 방식으로 동작합니다.
  }

  var NAME_MODES = {
    optional: '선택 입력',
    required: '반드시 입력',
    hidden: '받지 않음'
  };

  var EXTRA_TYPES = {
    none: '추가 입력 없음',
    text: '직접 입력 (예: 소속)',
    'class': '학년 · 반 선택'
  };

  /** 모든 설정의 기본값 — 예전 공개수업 방명록과 같은 내용입니다. */
  var BASE = {
    name: '공개수업 방명록',
    title: '공개수업 방명록',
    subtitle: '아이들에게 따뜻한 한마디를 남겨 주세요.',
    roleLabel: '참관 구분',
    roles: [
      { label: '참관 교사', extra: 'text', extraLabel: '소속', extraPlaceholder: '예) 햇살초등학교', mask: false },
      { label: '학부모', extra: 'class', extraLabel: '자녀 학급', extraPlaceholder: '', mask: true }
    ],
    gradeCount: 6,
    classCount: 12,
    nameMode: 'optional',
    nameLabel: '이름',
    namePlaceholder: '비워 두면 익명으로 남습니다',
    commentLabel: '소감',
    guide: '칭찬과 격려의 말이 아이들에게 큰 힘이 됩니다.',
    placeholder: '오늘 아이들의 어떤 모습이 좋으셨나요? 칭찬과 격려의 말을 남겨 주세요.',
    maxComment: 500,
    submitLabel: '소감 남기기',
    successMessage: '소감을 남겼습니다. 고맙습니다.',
    displayTitle: '공개수업 방명록',
    hintText: '첫 소감을 기다리고 있습니다',
    counterText: '지금까지 {n}분이 소감을 남겨 주셨습니다'
  };

  /** 새 방명록을 만들 때 고르는 출발점. BASE 위에 덮어씁니다. */
  var PRESETS = [
    {
      key: 'openClass',
      label: '공개수업 (참관 교사 · 학부모)',
      data: {}
    },
    {
      key: 'event',
      label: '행사 방명록 (방문객 · 소속)',
      data: {
        name: '행사 방명록',
        title: '행사 방명록',
        subtitle: '함께해 주셔서 고맙습니다. 소감을 남겨 주세요.',
        roleLabel: '구분',
        roles: [
          { label: '방문객', extra: 'text', extraLabel: '소속', extraPlaceholder: '예) 햇살초등학교', mask: false }
        ],
        guide: '',
        placeholder: '오늘 행사는 어떠셨나요?',
        displayTitle: '행사 방명록'
      }
    },
    {
      key: 'student',
      label: '학생 소감 (학년 · 반, 이름 가림)',
      data: {
        name: '학생 소감',
        title: '우리들의 소감',
        subtitle: '오늘 활동에서 느낀 점을 남겨 보세요.',
        roleLabel: '구분',
        roles: [
          { label: '학생', extra: 'class', extraLabel: '학급', extraPlaceholder: '', mask: true }
        ],
        guide: '친구를 존중하는 말로 써 주세요.',
        placeholder: '오늘 활동에서 가장 기억에 남는 것은 무엇인가요?',
        maxComment: 300,
        successMessage: '소감을 남겼어요. 고마워요!',
        displayTitle: '우리들의 소감',
        hintText: '첫 소감을 기다리고 있어요',
        counterText: '지금까지 {n}명이 소감을 남겼어요'
      }
    }
  ];

  /* ---------------- 작은 도우미 ---------------- */

  function clone(v) {
    return JSON.parse(JSON.stringify(v));
  }

  function clampInt(v, min, max, fallback) {
    var n = parseInt(v, 10);
    if (isNaN(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function str(v, max) {
    var s = (v === undefined || v === null) ? '' : String(v);
    return max ? s.slice(0, max) : s;
  }

  function normRole(r) {
    r = r || {};
    var extra = (r.extra === 'text' || r.extra === 'class') ? r.extra : 'none';
    return {
      label: str(r.label, 20).trim(),
      extra: extra,
      extraLabel: str(r.extraLabel, 20),
      extraPlaceholder: str(r.extraPlaceholder, 40),
      mask: r.mask === true
    };
  }

  /**
   * Firestore 에서 읽은 설정에 빠진 값을 기본값으로 채웁니다.
   * 관리자가 일부러 비워 둔 문구('')는 그대로 둡니다.
   */
  function normalizeEvent(d) {
    d = d || {};
    var ev = {};
    for (var k in BASE) {
      if (!BASE.hasOwnProperty(k)) continue;
      ev[k] = (d[k] === undefined || d[k] === null) ? clone(BASE[k]) : d[k];
    }
    var roles = (ev.roles && ev.roles.length) ? ev.roles : clone(BASE.roles);
    ev.roles = roles.map(normRole);
    ev.maxComment = clampInt(ev.maxComment, 10, 2000, BASE.maxComment);
    ev.gradeCount = clampInt(ev.gradeCount, 1, 12, BASE.gradeCount);
    ev.classCount = clampInt(ev.classCount, 1, 30, BASE.classCount);
    if (!NAME_MODES[ev.nameMode]) ev.nameMode = 'optional';
    ev.open = d.open !== false;
    return ev;
  }

  /** 저장할 형태. 보안 규칙이 검사하는 roleLabels 를 함께 만듭니다. */
  function toDoc(ev) {
    var out = {};
    for (var k in BASE) {
      if (BASE.hasOwnProperty(k)) out[k] = clone(ev[k]);
    }
    out.roleLabels = ev.roles.map(function (r) { return r.label; });
    return out;
  }

  function presetDoc(key, name) {
    var preset = PRESETS[0];
    for (var i = 0; i < PRESETS.length; i++) {
      if (PRESETS[i].key === key) preset = PRESETS[i];
    }
    var merged = clone(BASE);
    var data = clone(preset.data);
    for (var k in data) {
      if (data.hasOwnProperty(k)) merged[k] = data[k];
    }
    if (name) merged.name = name;
    return toDoc(normalizeEvent(merged));
  }

  /** '김철수' → '김○○', '김' → '김', 빈 값 → '' */
  function maskName(name) {
    var n = String(name || '').trim();
    if (n.length <= 1) return n;
    return n.charAt(0) + new Array(n.length).join('○');
  }

  function findRole(ev, label) {
    for (var i = 0; i < ev.roles.length; i++) {
      if (ev.roles[i].label === label) return ev.roles[i];
    }
    return null;
  }

  /** 구분이 하나뿐이면 고를 필요도, 화면에 표시할 필요도 없습니다. */
  function showRoleTag(ev) {
    return ev.roles.length > 1;
  }

  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function fmtTime(ms) {
    if (!ms) return '';
    var d = new Date(ms);
    return (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  /** Firestore 문서 → 화면에서 쓰는 소감 객체 */
  function entryFromDoc(doc) {
    var d = doc.data({ serverTimestamps: 'estimate' }) || {};
    var ts = (d.createdAt && d.createdAt.toMillis) ? d.createdAt.toMillis() : 0;
    return {
      id: doc.id,
      ts: ts,
      time: fmtTime(ts),
      role: str(d.role),
      name: str(d.name),
      affiliation: str(d.affiliation),
      comment: str(d.comment)
    };
  }

  /* ---------------- 주소 ---------------- */

  function param(name) {
    var m = new RegExp('[?&]' + name + '=([^&#]*)').exec(location.search);
    return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : '';
  }

  /** 현재 페이지가 있는 폴더 주소 (GitHub Pages 의 /저장소이름/ 까지) */
  function baseUrl() {
    return location.origin + location.pathname.replace(/[^\/]*$/, '');
  }

  function q(eventId) {
    return eventId ? '?e=' + encodeURIComponent(eventId) : '';
  }

  function writeUrl(eventId) { return baseUrl() + q(eventId); }
  function displayUrl(eventId) { return baseUrl() + 'display.html' + q(eventId); }
  function adminUrl(eventId) { return baseUrl() + 'admin.html' + q(eventId); }

  /**
   * 주소에 ?e= 가 있으면 그 방명록, 없으면 관리자가 정한 기본 방명록.
   * 그래서 QR 코드는 고정 주소로 한 번만 만들어 두면 됩니다.
   */
  function resolveEventId() {
    var fromUrl = param('e');
    if (fromUrl) return Promise.resolve(fromUrl);
    return db.collection('settings').doc('app').get().then(function (snap) {
      var d = snap.exists ? snap.data() : {};
      return d.defaultEventId || '';
    });
  }

  /** '지금까지 {n}분이 …' 의 {n} 자리에 굵은 숫자를 끼워 넣습니다. */
  function fillCounter(el, template, n) {
    el.innerHTML = '';
    var parts = String(template || '{n}').split('{n}');
    for (var i = 0; i < parts.length; i++) {
      if (parts[i]) el.appendChild(document.createTextNode(parts[i]));
      if (i < parts.length - 1) {
        var b = document.createElement('b');
        b.textContent = n;
        el.appendChild(b);
      }
    }
  }

  return {
    BASE: BASE,
    PRESETS: PRESETS,
    NAME_MODES: NAME_MODES,
    EXTRA_TYPES: EXTRA_TYPES,
    clone: clone,
    clampInt: clampInt,
    normRole: normRole,
    normalizeEvent: normalizeEvent,
    toDoc: toDoc,
    presetDoc: presetDoc,
    maskName: maskName,
    findRole: findRole,
    showRoleTag: showRoleTag,
    fmtTime: fmtTime,
    entryFromDoc: entryFromDoc,
    param: param,
    writeUrl: writeUrl,
    displayUrl: displayUrl,
    adminUrl: adminUrl,
    resolveEventId: resolveEventId,
    fillCounter: fillCounter
  };
})();
