# 학생 점수 관리 웹 v5

이번 버전은 아래 기능을 추가 반영했습니다.

## 새로 추가된 핵심 기능

### 1) 학생도 직접 점수 올리기 가능
- 학생은 **하루에 한 번만** 활동을 선택해서 점수를 올릴 수 있습니다.
- 여러 항목을 동시에 선택할 수 있습니다.
- 예:
  - 물마시기 +100
  - 화분에 물주기 +100
  - 잔반 안 남기기 +100
  - 분리수거 하기 +100

예를 들어 `물마시기 + 잔반 안 남기기` 두 개를 선택하면 **총 200점**이 추가됩니다.

> 참고:  
> 사용자가 말한 “라디오버튼”은 한 개만 선택할 수 있어서,
> 실제 구현은 **체크박스**로 했습니다.  
> 여러 개를 동시에 선택해야 합산이 가능하니까 이게 맞습니다.

### 2) 선생님도 학생 점수 직접 변경 가능
- 점수 절대값 저장
- 누적 추가/차감
- +1 / +5 / +10 빠른 추가

### 3) 항목별 누적 점수 표시
학생/선생님 모두 아래 항목별 누적 점수를 볼 수 있습니다.

- 물마시기
- 화분에 물주기
- 잔반 안 남기기
- 분리수거 하기
- 선생님 조정

`선생님 조정` 항목을 따로 둔 이유는,  
선생님이 직접 바꾼 점수까지 포함해야 총점과 항목 누적합이 맞아 떨어지기 때문입니다.  
이걸 안 넣으면 총점은 맞는데 항목별 합계가 안 맞는, 아주 멋진 혼돈이 생깁니다.

---

## 데이터 구조 변경

이번 버전은 총점만 저장하는 게 아니라 **활동 로그 시트**를 추가합니다.

### 시트 구성
- `users`
- `sessions`
- `logs`

### logs 시트 역할
학생이 하루 활동을 제출하거나, 선생님이 점수를 수정할 때마다 기록을 남깁니다.

컬럼:
- id
- type
- dateKey
- submittedAt
- studentId
- teacherId
- actorUsername
- activityKeys
- deltaScore
- detailsJson
- note

---

## 페이지 구성

### `index.html`
- 로그인
- 학생 회원가입
- 선생님 회원가입

### `student.html`
- 학생 정보
- 현재 총점
- 하루 1회 활동 제출
- 항목별 누적 점수
- 최근 점수 반영 내역

### `teacher-students.html`
- 학생 계정 조회
- 학생 정보 수정
- 학생 계정 삭제

### `teacher-scores.html`
- 학생 총점 조회
- 항목별 누적 점수 조회
- 학생 점수 직접 수정
- 최근 점수 반영 내역 확인

### `teacher-settings.html`
- 선생님 정보 조회
- 학교명 수정
- 비밀번호 수정

---

## 학생 점수 처리 방식

### 학생 제출
- 하루에 1회만 가능
- 같은 날 두 번 제출 불가
- 체크한 항목 점수가 합산되어 총점에 반영
- logs 시트에 `daily_activity`로 기록

### 선생님 점수 수정
- logs 시트에 `teacher_adjustment`로 기록
- 항목별 누적에는 `선생님 조정`으로 합산

---

## 설치 방법

## 1. Google Sheets 준비
새 스프레드시트 생성 후 ID 복사

예:
`https://docs.google.com/spreadsheets/d/여기_ID/edit`

## 2. Apps Script 설정
`확장 프로그램 > Apps Script` 에서 `Code.gs` 붙여넣기 후 수정

```javascript
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID';
const TEACHER_SIGNUP_SECRET = '950518';
```

## 3. 최초 1회 실행
```javascript
setupProject()
```

자동 생성되는 시트:
- users
- sessions
- logs

## 4. 웹앱 배포
- `배포 > 새 배포`
- 유형: `웹 앱`
- 실행 사용자: `나`
- 접근 권한: `모든 사용자`

배포 후 `/exec` URL 복사

## 5. app.js 수정
```javascript
const CONFIG = {
  apiBaseUrl: "YOUR_APPS_SCRIPT_WEB_APP_URL"
};
```

## 6. GitHub Pages 업로드
업로드 파일:
- index.html
- student.html
- teacher-students.html
- teacher-scores.html
- teacher-settings.html
- styles.css
- app.js

---

## 중요한 판단 기준

### 기존 학생과 새 학생의 학교명
- 선생님이 학교명을 바꿔도 기존 학생 학교명은 그대로 유지
- 이후 새로 가입하는 학생만 변경된 학교명 적용

### 항목별 누적과 총점 일치
- 학생 자가 제출과 선생님 수동 조정을 모두 logs에 남겨서
- 항목 누적합과 총점이 최대한 논리적으로 맞도록 구성

### 하루 1회 제한
- `studentId + 오늘 날짜(dateKey)` 기준으로 검사
- 같은 날짜에 `daily_activity` 로그가 이미 있으면 재제출 차단

---

## 주의
이번 v5는 **logs 시트가 새로 추가된 구조**입니다.
이전 버전 시트를 그대로 덮어쓰면 꼬일 가능성이 큽니다.
새 구글시트에서 시작하는 게 제일 안전합니다.
