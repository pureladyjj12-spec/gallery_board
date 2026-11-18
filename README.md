# 🖼️ 갤러리형 온라인 게시판 (Gallery Board)

반응형 3열 갤러리 레이아웃 기반의 온라인 게시판 웹 애플리케이션입니다.  
Firebase Authentication, Cloud Firestore, Cloudinary 이미지 업로드 및 비밀글(4자리 비밀번호) 기능을 제공합니다.

---

## ✨ 주요 기능

1. **갤러리형 반응형 디자인**
   - PC 화면: 3열 카드 그리드 레이아웃
   - 태블릿(2열) 및 모바일(1열) 환경 자동 최적화 반응형 UI
   - 썸네일 중심의 직관적인 시각적 카드 구성

2. **대표 이미지 및 추가 이미지 첨부 (Cloudinary)**
   - 대표 이미지 첨부 (드래그 앤 드롭, 로컬 미리보기 지원)
   - 대표 이미지 외에 **최대 10개까지 추가 이미지 다중 첨부 (`multiple`)**
   - 실시간 업로드 진행률 바(`%`) 표시
   - 이미지를 첨부하지 않아도 기본 플레이스홀더 썸네일로 작성 가능

3. **비밀글 작성 기능 (4자리 비밀번호)**
   - 작성 시 `🔒 비밀글로 작성` 선택 및 4자리 숫자 비밀번호 설정
   - 목록에서 비밀글 배지 및 요약 숨김 처리
   - 타 사용자는 4자리 비밀번호를 입력해야 상세 열람 가능 (작성자 본인은 자동 열람)

4. **게시글 상세 보기 & 다중 이미지 뷰어**
   - 대표 이미지 및 본문, 작성일, 작성자 정보 표시
   - 하단 추가 첨부 이미지 갤러리 썸네일 클릭 시 상단 메인 뷰어로 확대 확인

5. **Firebase Authentication 사용자 인증**
   - 이메일/비밀번호 회원가입(작성자 닉네임 설정 포함) 및 로그인/로그아웃
   - 로그인하지 않은 방문자도 공개글 목록 및 상세 내용 열람 가능
   - 로그인한 사용자만 새 게시글 작성 가능

6. **본인 글 한정 수정 및 삭제 권한**
   - 게시글 작성 시 로그인한 사용자의 UID를 Firestore에 함께 저장
   - 본인이 작성한 글에만 `내 글` 배지 표시 및 `수정` / `삭제` 버튼 노출
   - 클라이언트 및 Firestore Security Rules 이중 보안 검증

---

## 🛠️ 기술 스택

- **Frontend**: HTML5, CSS3 (CSS Variables, Flexbox, Grid), Modern Vanilla JavaScript (ES6+)
- **Font**: Pretendard Web Font
- **Backend / Database**: Google Firebase (Cloud Firestore)
- **Authentication**: Google Firebase (Firebase Authentication)
- **Image Storage / CDN**: Cloudinary Media API
