# 방명록 (GitHub Pages + Firebase)

행사마다 관리자 화면에서 제목·참여자 구분·입력 칸·디스플레이 문구를 바꿔 쓰는 방명록입니다.
만든이: 푸르이든

## 파일

| 파일 | 하는 일 |
|---|---|
| `index.html` | 작성 화면 (QR로 들어오는 곳) |
| `display.html` | 풍선 디스플레이 (복도 TV) |
| `admin.html` | 관리자 화면 (방명록 만들기·설정·소감 관리) |
| `common.js` | 세 화면이 함께 쓰는 코드 |
| `firebase-config.js` | Firebase 연결 정보 — **직접 채워야 함** |
| `firestore.rules` | 보안 규칙 — Firebase 콘솔에 붙여 넣기 |

## 처음 설정 (한 번만)

1. **Firebase 프로젝트 만들기** — console.firebase.google.com → 프로젝트 추가 (예: `guestbook`)
2. **Firestore Database 만들기** — 위치는 `asia-northeast3 (서울)`, 프로덕션 모드
3. **보안 규칙** — Firestore → 규칙 탭에 `firestore.rules` 내용을 통째로 붙여 넣고 게시.
   관리자 이메일(`pwoong99@naver.com`)이 다르면 고쳐 주세요.
4. **관리자 계정** — Authentication → 시작하기 → 이메일/비밀번호 사용 설정 → Users 탭에서 사용자 추가
   (규칙에 적은 이메일과 같아야 합니다)
5. **웹 앱 등록** — 프로젝트 설정 → 내 앱 → 웹(`</>`) → 나오는 값을 `firebase-config.js`에 붙여 넣기
6. **GitHub에 올리기** — 저장소에 파일 7개를 올리고 Settings → Pages → Branch `main` / root 로 배포
7. `https://pwoong99.github.io/저장소이름/admin.html` 로 들어가 로그인하면
   공개수업 방명록이 하나 자동으로 만들어지고 기본 방명록으로 지정됩니다.

## 행사가 바뀔 때

1. 관리자 → **+ 새 방명록** (공개수업 / 행사 / 학생 소감 중 골라 시작)
2. 설정 탭에서 문구·구분을 고치고 **저장**
3. **★ 기본 방명록으로 지정** — 고정 주소(QR)와 고정 주소로 켜 둔 TV가 저절로 새 방명록으로 바뀝니다
4. 끝나면 **마감하기** (디스플레이는 계속 보이고, 새 소감만 막힙니다)

## 데이터 구조

```
settings/app                       { defaultEventId }
events/{id}                        방명록 설정
events/{id}/entries/{entryId}      공개용 소감 (가림 처리된 이름)
events/{id}/private/{entryId}      원래 이름 — 관리자만 읽기
```
