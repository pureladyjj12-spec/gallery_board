/**
 * 갤러리 게시판 UI 컨트롤러 (app.js)
 * - Cloudinary 이미지 업로드 (대표 이미지 + 추가 이미지 최대 10개)
 * - 비밀글 기능 (4자리 비밀번호 설정, 목록 🔒 아이콘 표시, 비밀번호 입력 후 열람, 작성자 본인은 바로 열람)
 * - 비로그인 사용자도 전체 게시글 목록과 공개글 상세 내용을 자유롭게 조회 가능
 * - 로그인한 사용자만 게시글 작성 가능 (UID 저장)
 * - 이미지를 첨부하지 않아도 게시글 작성 가능
 * - 본인이 작성한 게시글만 수정(이미지 변경/제거 포함) 및 삭제 가능
 */
(function () {
  "use strict";

  // 상태 관리
  const state = {
    posts: [],
    hasLoadedPosts: false,
    currentPostId: null,
    pendingSecretPostId: null, // 비밀번호 입력을 기다리는 비밀글 ID
    unlockedSecretPosts: new Set(), // 비밀번호가 통과되어 현재 세션에서 열람 허용된 게시글 ID 목록
    currentUser: null,
    authMode: "login", // "login" | "signup"
    openCreateAfterAuth: false,
    unsubscribePosts: null,
    unsubscribeAuth: null,

    // 대표 이미지 업로드 관련 폼 상태
    selectedImageFile: null, // 새로 선택한 File 객체
    existingImageUrl: "", // 수정 시 기존 대표 이미지 URL
    isImageRemoved: false, // 기존 대표 이미지를 명시적으로 제거했는지 여부
    localPreviewUrl: "", // URL.createObjectURL로 생성한 대표 미리보기 URL

    // 추가 첨부 이미지 상태 (최대 10개)
    // 항목 구조: { type: 'file', file: File, previewUrl: string } 또는 { type: 'existing', url: string }
    extraImages: [],
  };

  // DOM 요소 참조
  const els = {
    // 헤더 인증 컨트롤
    loggedOutActions: document.getElementById("loggedOutActions"),
    loggedInActions: document.getElementById("loggedInActions"),
    btnOpenLogin: document.getElementById("btnOpenLogin"),
    btnOpenSignup: document.getElementById("btnOpenSignup"),
    currentUserBadge: document.getElementById("currentUserBadge"),
    btnOpenCreate: document.getElementById("btnOpenCreate"),
    btnLogout: document.getElementById("btnLogout"),

    // 목록 및 상태 영역
    galleryGrid: document.getElementById("galleryGrid"),
    loadingState: document.getElementById("loadingState"),
    emptyState: document.getElementById("emptyState"),
    emptyStateDesc: document.getElementById("emptyStateDesc"),
    errorBanner: document.getElementById("errorBanner"),
    totalCount: document.getElementById("totalCount"),
    authToolbarHint: document.getElementById("authToolbarHint"),
    btnEmptyCreate: document.getElementById("btnEmptyCreate"),

    // 상세 모달
    detailModal: document.getElementById("detailModal"),
    detailImage: document.getElementById("detailImage"),
    detailAuthor: document.getElementById("detailAuthor"),
    detailSecretBadge: document.getElementById("detailSecretBadge"),
    detailMineBadge: document.getElementById("detailMineBadge"),
    detailDate: document.getElementById("detailDate"),
    detailTitle: document.getElementById("detailTitle"),
    detailContent: document.getElementById("detailContent"),
    detailGallerySection: document.getElementById("detailGallerySection"),
    detailGalleryCount: document.getElementById("detailGalleryCount"),
    detailGalleryGrid: document.getElementById("detailGalleryGrid"),
    detailOwnerActions: document.getElementById("detailOwnerActions"),
    btnEditFromDetail: document.getElementById("btnEditFromDetail"),
    btnDeleteFromDetail: document.getElementById("btnDeleteFromDetail"),

    // 작성·수정 모달 및 대표 이미지 업로드 요소
    formModal: document.getElementById("formModal"),
    formModalTitle: document.getElementById("formModalTitle"),
    postForm: document.getElementById("postForm"),
    postIdInput: document.getElementById("postIdInput"),

    imageUploadDropzone: document.getElementById("imageUploadDropzone"),
    imageFileInput: document.getElementById("imageFileInput"),
    imagePreviewContainer: document.getElementById("imagePreviewContainer"),
    imagePreviewImg: document.getElementById("imagePreviewImg"),
    previewFileName: document.getElementById("previewFileName"),
    btnRemoveImage: document.getElementById("btnRemoveImage"),
    btnChangeImage: document.getElementById("btnChangeImage"),

    uploadProgressContainer: document.getElementById("uploadProgressContainer"),
    uploadProgressBar: document.getElementById("uploadProgressBar"),
    uploadProgressText: document.getElementById("uploadProgressText"),
    imageError: document.getElementById("imageError"),

    // 추가 이미지 업로드 요소 (최대 10개)
    extraImagesInput: document.getElementById("extraImagesInput"),
    extraUploadDropzone: document.getElementById("extraUploadDropzone"),
    extraImagesPreviewGrid: document.getElementById("extraImagesPreviewGrid"),
    extraCountLabel: document.getElementById("extraCountLabel"),
    extraImagesError: document.getElementById("extraImagesError"),

    titleInput: document.getElementById("titleInput"),
    contentInput: document.getElementById("contentInput"),
    titleError: document.getElementById("titleError"),
    contentError: document.getElementById("contentError"),

    // 비밀글 설정 요소
    isSecretCheckbox: document.getElementById("isSecretCheckbox"),
    secretPinGroup: document.getElementById("secretPinGroup"),
    secretPinInput: document.getElementById("secretPinInput"),
    secretPinError: document.getElementById("secretPinError"),
    btnSubmitForm: document.getElementById("btnSubmitForm"),

    // 비밀글 비밀번호 입력 모달
    secretPromptModal: document.getElementById("secretPromptModal"),
    secretPromptForm: document.getElementById("secretPromptForm"),
    promptPinInput: document.getElementById("promptPinInput"),
    promptPinError: document.getElementById("promptPinError"),
    btnSubmitPin: document.getElementById("btnSubmitPin"),

    // 로그인·회원가입 모달
    authModal: document.getElementById("authModal"),
    authModalTitle: document.getElementById("authModalTitle"),
    tabLogin: document.getElementById("tabLogin"),
    tabSignup: document.getElementById("tabSignup"),
    authNoticeBox: document.getElementById("authNoticeBox"),
    authErrorBox: document.getElementById("authErrorBox"),
    authForm: document.getElementById("authForm"),
    signupNicknameGroup: document.getElementById("signupNicknameGroup"),
    authNicknameInput: document.getElementById("authNicknameInput"),
    authEmailInput: document.getElementById("authEmailInput"),
    authPasswordInput: document.getElementById("authPasswordInput"),
    signupConfirmGroup: document.getElementById("signupConfirmGroup"),
    authPasswordConfirmInput: document.getElementById("authPasswordConfirmInput"),
    btnSubmitAuth: document.getElementById("btnSubmitAuth"),

    // 삭제 확인 모달
    deleteModal: document.getElementById("deleteModal"),
    btnConfirmDelete: document.getElementById("btnConfirmDelete"),
  };

  /**
   * 현재 로그인 사용자가 해당 게시글 작성자인지 UID 기준 판별
   */
  function isPostOwner(post) {
    if (!state.currentUser || !state.currentUser.uid || !post || !post.authorUid) {
      return false;
    }
    const currentUid = String(state.currentUser.uid).trim();
    const postAuthorUid = String(post.authorUid).trim();
    return Boolean(currentUid && postAuthorUid && currentUid === postAuthorUid);
  }

  /**
   * 사용자가 해당 비밀글을 열람할 수 있는지 여부
   * (일반글이거나, 본인 글이거나, 세션 내에서 이미 4자리 PIN을 통과한 경우 true)
   */
  function canAccessPost(post) {
    if (!post || !post.isSecret) return true;
    if (isPostOwner(post)) return true;
    return state.unlockedSecretPosts.has(post.id);
  }

  /**
   * 날짜 포맷팅 (YYYY. MM. DD. HH:mm)
   */
  function formatDate(isoString) {
    if (!isoString) return "";
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return "";

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    return `${yyyy}. ${mm}. ${dd}. ${hh}:${min}`;
  }

  /**
   * 오류 배너 표시 / 숨김
   */
  function showError(message) {
    els.errorBanner.textContent = message;
    els.errorBanner.classList.remove("hidden");
  }

  function hideError() {
    els.errorBanner.textContent = "";
    els.errorBanner.classList.add("hidden");
  }

  function getFriendlyFirestoreError(err, actionLabel) {
    if (err && (err.code === "auth-required" || err.code === "not-owner")) {
      return err.message;
    }
    if (err && err.code === "permission-denied") {
      return `${actionLabel} 권한이 없습니다. 본인 게시글인지 또는 Firestore 보안 규칙(Rules)이 최신 상태인지 확인해 주세요.`;
    }
    if (err && err.code === "unavailable") {
      return "네트워크 연결이 불안정합니다. 인터넷 연결 상태를 확인해 주세요.";
    }
    return `${actionLabel} 중 오류가 발생했습니다: ${err && err.message ? err.message : "알 수 없는 오류"}`;
  }

  /**
   * 모달 열기 / 닫기 제어
   */
  function openModal(modalEl) {
    modalEl.classList.remove("hidden");
    document.body.classList.add("modal-open");
  }

  function closeModal(modalEl) {
    modalEl.classList.add("hidden");
    if (modalEl === els.authModal) {
      state.openCreateAfterAuth = false;
    }
    if (modalEl === els.formModal) {
      resetImageFormState();
    }
    if (modalEl === els.secretPromptModal) {
      state.pendingSecretPostId = null;
      els.promptPinInput.value = "";
      els.promptPinError.classList.add("hidden");
    }
    const anyOpen = document.querySelectorAll(".modal-backdrop:not(.hidden)").length > 0;
    if (!anyOpen) {
      document.body.classList.remove("modal-open");
    }
  }

  /**
   * 이미지 로드 실패 시 대체 플레이스홀더 이미지 지정
   */
  function attachImageFallback(imgEl) {
    imgEl.addEventListener(
      "error",
      function () {
        imgEl.src = window.ImageService.getFallbackUrl();
      },
      { once: true }
    );
  }

  /**
   * 로그인 상태 변경에 따른 헤더 및 권한 UI 갱신
   */
  function updateAuthUI(user) {
    state.currentUser = user;

    if (user) {
      els.loggedOutActions.classList.add("hidden");
      els.loggedInActions.classList.remove("hidden");
      els.currentUserBadge.textContent = `👤 ${user.authorLabel}`;
      els.currentUserBadge.title = user.email ? `${user.authorLabel} (${user.email})` : user.authorLabel;
      els.authToolbarHint.textContent = `${user.authorLabel}님으로 로그인됨 · 본인이 작성한 게시글만 수정·삭제할 수 있습니다`;
      els.emptyStateDesc.textContent = "첫 번째 갤러리 게시글을 작성해 보세요.";
    } else {
      els.loggedInActions.classList.add("hidden");
      els.loggedOutActions.classList.remove("hidden");
      els.currentUserBadge.textContent = "";
      els.currentUserBadge.title = "";
      els.authToolbarHint.textContent =
        "로그인하지 않아도 모든 게시글을 열람할 수 있습니다 · 글 작성은 로그인 후 가능합니다";
      els.emptyStateDesc.textContent = "로그인 후 첫 번째 갤러리 게시글을 작성해 보세요.";

      closeModal(els.formModal);
      closeModal(els.deleteModal);
      closeModal(els.secretPromptModal);
    }

    if (state.hasLoadedPosts) {
      renderGallery(state.posts);
    }
  }

  /**
   * 로그인 / 회원가입 모달 제어
   */
  function setAuthModalMode(mode) {
    state.authMode = mode === "signup" ? "signup" : "login";
    const isSignup = state.authMode === "signup";

    els.authModalTitle.textContent = isSignup ? "이메일 회원가입" : "로그인";
    els.tabLogin.classList.toggle("active", !isSignup);
    els.tabLogin.setAttribute("aria-selected", String(!isSignup));
    els.tabSignup.classList.toggle("active", isSignup);
    els.tabSignup.setAttribute("aria-selected", String(isSignup));

    els.signupNicknameGroup.classList.toggle("hidden", !isSignup);
    els.signupConfirmGroup.classList.toggle("hidden", !isSignup);
    els.authPasswordInput.setAttribute(
      "autocomplete",
      isSignup ? "new-password" : "current-password"
    );
    els.btnSubmitAuth.textContent = isSignup ? "회원가입 완료" : "로그인";

    els.authErrorBox.textContent = "";
    els.authErrorBox.classList.add("hidden");
  }

  function openAuthModal(mode, noticeMessage) {
    els.authForm.reset();
    setAuthModalMode(mode);

    if (noticeMessage) {
      els.authNoticeBox.textContent = noticeMessage;
      els.authNoticeBox.classList.remove("hidden");
    } else {
      els.authNoticeBox.textContent = "";
      els.authNoticeBox.classList.add("hidden");
    }

    openModal(els.authModal);
    setTimeout(() => {
      if (state.authMode === "signup") {
        els.authNicknameInput.focus();
      } else {
        els.authEmailInput.focus();
      }
    }, 50);
  }

  function showAuthError(message) {
    els.authErrorBox.textContent = message;
    els.authErrorBox.classList.remove("hidden");
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    els.authErrorBox.classList.add("hidden");

    const isSignup = state.authMode === "signup";
    const nickname = els.authNicknameInput.value.trim();
    const email = els.authEmailInput.value.trim();
    const password = els.authPasswordInput.value;
    const passwordConfirm = els.authPasswordConfirmInput.value;

    if (isSignup && !nickname) {
      showAuthError("게시글에 표시될 작성자 이름(닉네임)을 입력해 주세요.");
      els.authNicknameInput.focus();
      return;
    }
    if (!email) {
      showAuthError("이메일 주소를 입력해 주세요.");
      els.authEmailInput.focus();
      return;
    }
    if (!password || password.length < 6) {
      showAuthError("비밀번호는 6자리 이상 입력해 주세요.");
      els.authPasswordInput.focus();
      return;
    }
    if (isSignup && password !== passwordConfirm) {
      showAuthError("비밀번호와 비밀번호 확인이 일치하지 않습니다.");
      els.authPasswordConfirmInput.focus();
      return;
    }

    const originalText = els.btnSubmitAuth.textContent;
    els.btnSubmitAuth.disabled = true;
    els.btnSubmitAuth.textContent = isSignup ? "가입 처리 중..." : "로그인 중...";

    try {
      const shouldOpenCreate = state.openCreateAfterAuth;
      if (isSignup) {
        await window.AuthService.signUp({ email, password, nickname });
      } else {
        await window.AuthService.signIn({ email, password });
      }
      closeModal(els.authModal);
      if (shouldOpenCreate) {
        openCreateModal();
      }
    } catch (err) {
      showAuthError(window.AuthService.getFriendlyErrorMessage(err));
    } finally {
      els.btnSubmitAuth.disabled = false;
      els.btnSubmitAuth.textContent = originalText;
    }
  }

  /**
   * 상세 모달 내용 채우기 (대표 이미지 + 추가 첨부 이미지 최대 10개 갤러리)
   */
  function populateDetailModal(post) {
    const displayUrl = (post.imageUrl || "").trim() || window.ImageService.getDefaultImageUrl();
    els.detailImage.src = displayUrl;
    els.detailImage.alt = post.title;
    els.detailImage.onerror = function () {
      els.detailImage.src = window.ImageService.getFallbackUrl();
    };

    els.detailAuthor.textContent = `작성자 · ${post.authorName || "익명"}`;

    const isSecret = Boolean(post.isSecret);
    els.detailSecretBadge.classList.toggle("hidden", !isSecret);

    const mine = isPostOwner(post);
    els.detailMineBadge.classList.toggle("hidden", !mine);
    els.detailOwnerActions.classList.toggle("hidden", !mine);

    const createdText = formatDate(post.createdAt);
    const isEdited = post.updatedAt && post.updatedAt !== post.createdAt;
    els.detailDate.dateTime = post.createdAt;
    els.detailDate.textContent = isEdited
      ? `작성일 ${createdText} · 수정됨`
      : `작성일 ${createdText}`;

    els.detailTitle.textContent = isSecret && !mine ? `🔒 ${post.title}` : post.title;
    els.detailContent.textContent = post.content;

    // 추가 첨부 이미지 렌더링
    const extraList = Array.isArray(post.additionalImages) ? post.additionalImages : [];
    if (extraList.length > 0) {
      els.detailGalleryCount.textContent = String(extraList.length);
      els.detailGalleryGrid.innerHTML = "";

      extraList.forEach((imgUrl, idx) => {
        const item = document.createElement("div");
        item.className = "detail-gallery-item";
        item.tabIndex = 0;
        item.setAttribute("role", "button");
        item.setAttribute("aria-label", `첨부 이미지 ${idx + 1} 크게 보기`);

        const img = document.createElement("img");
        img.src = imgUrl;
        img.alt = `${post.title} 추가 이미지 ${idx + 1}`;
        img.loading = "lazy";
        attachImageFallback(img);

        item.appendChild(img);
        // 클릭 시 대표 이미지 뷰어로 확대 표시
        item.addEventListener("click", () => {
          els.detailImage.src = imgUrl;
          els.detailImage.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });

        els.detailGalleryGrid.appendChild(item);
      });

      els.detailGallerySection.classList.remove("hidden");
    } else {
      els.detailGallerySection.classList.add("hidden");
      els.detailGalleryGrid.innerHTML = "";
    }
  }

  /**
   * 갤러리 목록 렌더링 (실시간 스냅샷 데이터 반영)
   */
  function renderGallery(posts) {
    hideError();
    els.loadingState.classList.add("hidden");

    state.hasLoadedPosts = true;
    state.posts = posts;
    els.totalCount.textContent = String(posts.length);
    els.galleryGrid.innerHTML = "";

    if (state.currentPostId && !els.detailModal.classList.contains("hidden")) {
      const activePost = posts.find((p) => p.id === state.currentPostId);
      if (activePost) {
        populateDetailModal(activePost);
      } else {
        state.currentPostId = null;
        closeModal(els.deleteModal);
        closeModal(els.detailModal);
      }
    }

    if (posts.length === 0) {
      els.galleryGrid.classList.add("hidden");
      els.emptyState.classList.remove("hidden");
      return;
    }

    els.emptyState.classList.add("hidden");
    els.galleryGrid.classList.remove("hidden");

    const fragment = document.createDocumentFragment();

    posts.forEach((post) => {
      const card = document.createElement("article");
      card.className = "gallery-card";
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", `${post.title} 상세 보기`);

      const thumbWrap = document.createElement("div");
      thumbWrap.className = "card-thumb-wrap";

      const img = document.createElement("img");
      img.className = "card-thumb";
      img.src = (post.imageUrl || "").trim() || window.ImageService.getDefaultImageUrl();
      img.alt = post.title;
      img.loading = "lazy";
      attachImageFallback(img);
      thumbWrap.appendChild(img);

      const body = document.createElement("div");
      body.className = "card-body";

      const authorRow = document.createElement("div");
      authorRow.className = "card-author-row";

      const authorName = document.createElement("span");
      authorName.className = "card-author-name";
      authorName.textContent = `작성자 · ${post.authorName || "익명"}`;
      authorRow.appendChild(authorName);

      if (post.isSecret) {
        const secretBadge = document.createElement("span");
        secretBadge.className = "secret-badge";
        secretBadge.textContent = "🔒 비밀글";
        authorRow.appendChild(secretBadge);
      }

      // 추가 첨부 이미지가 있는 경우 +N 장 배지 표시
      const extraCount = Array.isArray(post.additionalImages) ? post.additionalImages.length : 0;
      if (extraCount > 0) {
        const extraBadge = document.createElement("span");
        extraBadge.className = "extra-images-badge";
        extraBadge.textContent = `📷 +${extraCount}`;
        authorRow.appendChild(extraBadge);
      }

      if (isPostOwner(post)) {
        const mineBadge = document.createElement("span");
        mineBadge.className = "mine-badge";
        mineBadge.textContent = "내 글";
        authorRow.appendChild(mineBadge);
      }

      const title = document.createElement("h3");
      title.className = "card-title";
      title.textContent = post.isSecret ? `🔒 ${post.title}` : post.title;

      const excerpt = document.createElement("p");
      excerpt.className = "card-excerpt";
      if (post.isSecret && !canAccessPost(post)) {
        excerpt.textContent = "비밀글입니다. 비밀번호 4자리를 입력하면 내용을 확인할 수 있습니다.";
        excerpt.classList.add("text-muted");
      } else {
        excerpt.textContent = post.content;
      }

      const meta = document.createElement("div");
      meta.className = "card-meta";

      const time = document.createElement("time");
      time.dateTime = post.createdAt;
      time.textContent = formatDate(post.createdAt);

      const more = document.createElement("span");
      more.className = "card-more";
      more.textContent = post.isSecret && !canAccessPost(post) ? "비밀글 열람 🔒" : "자세히 보기 →";

      meta.appendChild(time);
      meta.appendChild(more);

      body.appendChild(authorRow);
      body.appendChild(title);
      body.appendChild(excerpt);
      body.appendChild(meta);

      card.appendChild(thumbWrap);
      card.appendChild(body);

      card.addEventListener("click", () => handleCardClick(post.id));
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleCardClick(post.id);
        }
      });

      fragment.appendChild(card);
    });

    els.galleryGrid.appendChild(fragment);
  }

  /**
   * Firestore 실시간 구독 시작
   */
  function startRealtimeSubscription() {
    try {
      state.unsubscribePosts = window.PostRepository.subscribePosts(
        (posts) => {
          renderGallery(posts);
        },
        (err) => {
          els.loadingState.classList.add("hidden");
          showError(getFriendlyFirestoreError(err, "게시글 목록 조회"));
        }
      );
    } catch (err) {
      els.loadingState.classList.add("hidden");
      showError(getFriendlyFirestoreError(err, "데이터베이스 연결"));
    }
  }

  /**
   * 게시글 카드 클릭 시: 일반글 또는 권한 있는 비밀글은 즉시 상세 열기,
   * 권한이 없는 비밀글은 4자리 비밀번호 모달 호출
   */
  async function handleCardClick(postId) {
    const cached = state.posts.find((p) => p.id === postId);
    const post = cached || (await window.PostRepository.getPostById(postId));
    if (!post) return;

    if (canAccessPost(post)) {
      openDetailModal(post.id);
    } else {
      openSecretPromptModal(post.id);
    }
  }

  /**
   * 비밀글 4자리 비밀번호 입력 모달 열기
   */
  function openSecretPromptModal(postId) {
    state.pendingSecretPostId = postId;
    els.promptPinInput.value = "";
    els.promptPinError.classList.add("hidden");
    openModal(els.secretPromptModal);
    setTimeout(() => els.promptPinInput.focus(), 50);
  }

  /**
   * 비밀번호 4자리 제출 처리
   */
  function handleSecretPromptSubmit(event) {
    event.preventDefault();
    els.promptPinError.classList.add("hidden");

    const inputPin = els.promptPinInput.value.trim();
    if (!/^\d{4}$/.test(inputPin)) {
      els.promptPinError.textContent = "비밀번호는 숫자 4자리로 입력해 주세요.";
      els.promptPinError.classList.remove("hidden");
      els.promptPinInput.focus();
      return;
    }

    const post = state.posts.find((p) => p.id === state.pendingSecretPostId);
    if (!post) {
      closeModal(els.secretPromptModal);
      return;
    }

    if (post.secretPin && post.secretPin === inputPin) {
      state.unlockedSecretPosts.add(post.id);
      const targetId = post.id;
      closeModal(els.secretPromptModal);
      renderGallery(state.posts);
      openDetailModal(targetId);
    } else {
      els.promptPinError.textContent = "비밀번호가 일치하지 않습니다. 다시 확인해 주세요.";
      els.promptPinError.classList.remove("hidden");
      els.promptPinInput.select();
    }
  }

  /**
   * 상세 보기 모달 열기
   */
  async function openDetailModal(postId) {
    const cached = state.posts.find((p) => p.id === postId);
    const post = cached || (await window.PostRepository.getPostById(postId));
    if (!post) return;

    state.currentPostId = post.id;
    populateDetailModal(post);
    openModal(els.detailModal);
  }

  /**
   * 이미지 업로드 폼 상태 초기화
   */
  function resetImageFormState() {
    if (state.localPreviewUrl) {
      URL.revokeObjectURL(state.localPreviewUrl);
      state.localPreviewUrl = "";
    }
    state.selectedImageFile = null;
    state.existingImageUrl = "";
    state.isImageRemoved = false;

    // 추가 이미지 상태 및 ObjectURL 정리
    state.extraImages.forEach((item) => {
      if (item.type === "file" && item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
    });
    state.extraImages = [];

    els.imageFileInput.value = "";
    els.imagePreviewImg.src = "";
    els.previewFileName.textContent = "";
    els.imagePreviewContainer.classList.add("hidden");
    els.imageUploadDropzone.classList.remove("hidden");

    els.extraImagesInput.value = "";
    renderExtraImagesPreview();

    hideUploadProgress();
    els.imageError.textContent = "";
    els.imageError.classList.add("hidden");
    els.extraImagesError.textContent = "";
    els.extraImagesError.classList.add("hidden");
  }

  /**
   * 대표 이미지 파일 선택 시 미리보기 설정
   */
  function handleImageFileSelected(file) {
    els.imageError.textContent = "";
    els.imageError.classList.add("hidden");

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      els.imageError.textContent = "이미지 파일만 선택할 수 있습니다 (JPG, PNG, GIF, WebP 등).";
      els.imageError.classList.remove("hidden");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      els.imageError.textContent = "이미지 크기는 최대 10MB까지 가능합니다.";
      els.imageError.classList.remove("hidden");
      return;
    }

    if (state.localPreviewUrl) {
      URL.revokeObjectURL(state.localPreviewUrl);
    }

    state.selectedImageFile = file;
    state.isImageRemoved = false;
    state.localPreviewUrl = URL.createObjectURL(file);

    els.imagePreviewImg.src = state.localPreviewUrl;
    els.previewFileName.textContent = file.name;

    els.imageUploadDropzone.classList.add("hidden");
    els.imagePreviewContainer.classList.remove("hidden");
  }

  /**
   * 추가 첨부 이미지 파일 다중 선택 처리 (최대 10개)
   */
  function handleExtraFilesSelected(fileList) {
    els.extraImagesError.textContent = "";
    els.extraImagesError.classList.add("hidden");

    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList);
    const currentCount = state.extraImages.length;
    const availableSlots = 10 - currentCount;

    if (availableSlots <= 0) {
      els.extraImagesError.textContent = "추가 이미지는 최대 10개까지만 첨부할 수 있습니다.";
      els.extraImagesError.classList.remove("hidden");
      return;
    }

    if (files.length > availableSlots) {
      els.extraImagesError.textContent = `추가 가능한 개수는 ${availableSlots}개입니다. 초과된 이미지는 제외되었습니다.`;
      els.extraImagesError.classList.remove("hidden");
    }

    const targetFiles = files.slice(0, availableSlots);

    targetFiles.forEach((file) => {
      if (!file.type.startsWith("image/")) {
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        els.extraImagesError.textContent = "10MB를 초과하는 파일은 첨부되지 않았습니다.";
        els.extraImagesError.classList.remove("hidden");
        return;
      }

      state.extraImages.push({
        type: "file",
        file,
        previewUrl: URL.createObjectURL(file),
      });
    });

    els.extraImagesInput.value = "";
    renderExtraImagesPreview();
  }

  /**
   * 추가 이미지 미리보기 그리드 렌더링
   */
  function renderExtraImagesPreview() {
    els.extraCountLabel.textContent = `${state.extraImages.length} / 10`;
    els.extraImagesPreviewGrid.innerHTML = "";

    if (state.extraImages.length === 0) {
      els.extraImagesPreviewGrid.classList.add("hidden");
      els.extraUploadDropzone.classList.remove("hidden");
      return;
    }

    els.extraImagesPreviewGrid.classList.remove("hidden");
    els.extraUploadDropzone.classList.toggle("hidden", state.extraImages.length >= 10);

    state.extraImages.forEach((item, index) => {
      const thumb = document.createElement("div");
      thumb.className = "extra-preview-item";

      const img = document.createElement("img");
      img.src = item.type === "file" ? item.previewUrl : item.url;
      img.alt = `추가 이미지 ${index + 1}`;
      attachImageFallback(img);

      const btnRemove = document.createElement("button");
      btnRemove.type = "button";
      btnRemove.className = "extra-preview-remove";
      btnRemove.setAttribute("aria-label", "이미지 삭제");
      btnRemove.innerHTML = "&times;";

      btnRemove.addEventListener("click", () => {
        if (item.type === "file" && item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
        state.extraImages.splice(index, 1);
        renderExtraImagesPreview();
      });

      thumb.appendChild(img);
      thumb.appendChild(btnRemove);
      els.extraImagesPreviewGrid.appendChild(thumb);
    });
  }

  /**
   * 기존 대표 이미지(수정 모달) 미리보기 표시
   */
  function setExistingImagePreview(url) {
    state.existingImageUrl = url || "";
    state.selectedImageFile = null;
    state.isImageRemoved = false;

    if (url) {
      els.imagePreviewImg.src = url;
      els.previewFileName.textContent = "현재 등록된 대표 이미지";
      els.imageUploadDropzone.classList.add("hidden");
      els.imagePreviewContainer.classList.remove("hidden");
    } else {
      els.imagePreviewContainer.classList.add("hidden");
      els.imageUploadDropzone.classList.remove("hidden");
    }
  }

  /**
   * 업로드 진행바 표시 / 숨김
   */
  function showUploadProgress(percent, label) {
    els.uploadProgressContainer.classList.remove("hidden");
    els.uploadProgressBar.style.width = `${percent}%`;
    els.uploadProgressText.textContent = label || `이미지 업로드 중... ${percent}%`;
  }

  function hideUploadProgress() {
    els.uploadProgressContainer.classList.add("hidden");
    els.uploadProgressBar.style.width = "0%";
    els.uploadProgressText.textContent = "이미지 업로드 중... 0%";
  }

  /**
   * 폼 유효성 오류 초기화
   */
  function clearFormErrors() {
    els.imageError.textContent = "";
    els.imageError.classList.add("hidden");
    els.extraImagesError.textContent = "";
    els.extraImagesError.classList.add("hidden");
    els.titleError.classList.add("hidden");
    els.contentError.classList.add("hidden");
    els.secretPinError.classList.add("hidden");
  }

  /**
   * 비밀글 체크박스 토글 처리
   */
  function handleSecretCheckboxChange() {
    const isChecked = els.isSecretCheckbox.checked;
    els.secretPinGroup.classList.toggle("hidden", !isChecked);
    els.secretPinError.classList.add("hidden");
    if (isChecked) {
      setTimeout(() => els.secretPinInput.focus(), 50);
    } else {
      els.secretPinInput.value = "";
    }
  }

  /**
   * 새 게시글 작성 모달 열기 (로그인한 사용자만 허용)
   */
  function openCreateModal() {
    if (!state.currentUser) {
      state.openCreateAfterAuth = true;
      openAuthModal("login", "로그인한 사용자만 게시글을 작성할 수 있습니다.");
      return;
    }

    clearFormErrors();
    resetImageFormState();

    els.formModalTitle.textContent = "새 게시글 작성";
    els.btnSubmitForm.textContent = "등록하기";
    els.postIdInput.value = "";
    els.titleInput.value = "";
    els.contentInput.value = "";

    els.isSecretCheckbox.checked = false;
    els.secretPinGroup.classList.add("hidden");
    els.secretPinInput.value = "";

    openModal(els.formModal);
    setTimeout(() => els.titleInput.focus(), 50);
  }

  /**
   * 기존 게시글 수정 모달 열기 (본인 게시글만 허용)
   */
  async function openEditModal(postId) {
    const cached = state.posts.find((p) => p.id === postId);
    const post = cached || (await window.PostRepository.getPostById(postId));
    if (!post) return;

    if (!isPostOwner(post)) {
      alert("본인이 작성한 게시글만 수정할 수 있습니다.");
      return;
    }

    clearFormErrors();
    resetImageFormState();
    closeModal(els.detailModal);

    els.formModalTitle.textContent = "게시글 수정";
    els.btnSubmitForm.textContent = "수정 완료";
    els.postIdInput.value = post.id;
    els.titleInput.value = post.title;
    els.contentInput.value = post.content;

    setExistingImagePreview(post.imageUrl);

    // 기존 추가 이미지 목록 불러오기
    const extraList = Array.isArray(post.additionalImages) ? post.additionalImages : [];
    state.extraImages = extraList.map((url) => ({
      type: "existing",
      url,
    }));
    renderExtraImagesPreview();

    // 비밀글 설정 값 반영
    const isSecret = Boolean(post.isSecret);
    els.isSecretCheckbox.checked = isSecret;
    els.secretPinGroup.classList.toggle("hidden", !isSecret);
    els.secretPinInput.value = isSecret && post.secretPin ? post.secretPin : "";

    openModal(els.formModal);
    setTimeout(() => els.titleInput.focus(), 50);
  }

  /**
   * 작성 / 수정 폼 제출 처리 (Cloudinary 대표+추가 이미지 업로드 -> Firestore 저장)
   */
  async function handleFormSubmit(event) {
    event.preventDefault();
    clearFormErrors();

    if (!state.currentUser) {
      closeModal(els.formModal);
      openAuthModal("login", "로그인한 사용자만 게시글을 작성할 수 있습니다.");
      return;
    }

    const editingId = els.postIdInput.value.trim();
    const title = els.titleInput.value.trim();
    const content = els.contentInput.value.trim();
    const isSecret = els.isSecretCheckbox.checked;
    const secretPin = els.secretPinInput.value.trim();

    let hasError = false;
    if (!title) {
      els.titleError.classList.remove("hidden");
      hasError = true;
    }
    if (!content) {
      els.contentError.classList.remove("hidden");
      hasError = true;
    }
    if (isSecret && !/^\d{4}$/.test(secretPin)) {
      els.secretPinError.textContent = "비밀번호는 숫자 4자리로 입력해 주세요.";
      els.secretPinError.classList.remove("hidden");
      els.secretPinInput.focus();
      hasError = true;
    }
    if (hasError) return;

    const originalBtnText = els.btnSubmitForm.textContent;
    els.btnSubmitForm.disabled = true;

    try {
      hideError();
      let finalImageUrl = "";

      // 1. 대표 이미지 업로드 처리
      if (state.selectedImageFile) {
        els.btnSubmitForm.textContent = "대표 이미지 업로드 중...";
        showUploadProgress(0, "대표 이미지 업로드 중... 0%");

        try {
          finalImageUrl = await window.ImageService.uploadImage(
            state.selectedImageFile,
            (percent) => {
              showUploadProgress(percent, `대표 이미지 업로드 중... ${percent}%`);
            }
          );
        } catch (uploadErr) {
          hideUploadProgress();
          els.imageError.textContent = `대표 이미지 업로드 실패: ${uploadErr.message}`;
          els.imageError.classList.remove("hidden");
          els.btnSubmitForm.disabled = false;
          els.btnSubmitForm.textContent = originalBtnText;
          return;
        }
      } else if (editingId && !state.isImageRemoved) {
        finalImageUrl = state.existingImageUrl || "";
      } else {
        finalImageUrl = "";
      }

      // 2. 추가 첨부 이미지들 업로드 처리 (최대 10개)
      const finalAdditionalImages = [];
      const newExtraFiles = state.extraImages.filter((item) => item.type === "file");
      let uploadedCount = 0;

      for (let i = 0; i < state.extraImages.length; i++) {
        const item = state.extraImages[i];
        if (item.type === "existing") {
          finalAdditionalImages.push(item.url);
        } else if (item.type === "file") {
          uploadedCount++;
          const progressPrefix = `추가 이미지 업로드 중 (${uploadedCount}/${newExtraFiles.length})`;
          els.btnSubmitForm.textContent = progressPrefix;
          showUploadProgress(0, `${progressPrefix} 0%`);

          try {
            const uploadedUrl = await window.ImageService.uploadImage(
              item.file,
              (percent) => {
                showUploadProgress(percent, `${progressPrefix} ${percent}%`);
              }
            );
            finalAdditionalImages.push(uploadedUrl);
          } catch (err) {
            hideUploadProgress();
            els.extraImagesError.textContent = `추가 이미지 업로드 실패 (${item.file.name}): ${err.message}`;
            els.extraImagesError.classList.remove("hidden");
            els.btnSubmitForm.disabled = false;
            els.btnSubmitForm.textContent = originalBtnText;
            return;
          }
        }
      }

      // 3. Firestore에 게시글 데이터 저장/수정
      els.btnSubmitForm.textContent = "게시글 저장 중...";

      if (editingId) {
        const updated = await window.PostRepository.updatePost(editingId, {
          title,
          content,
          imageUrl: finalImageUrl,
          additionalImages: finalAdditionalImages,
          isSecret,
          secretPin: isSecret ? secretPin : "",
        });
        closeModal(els.formModal);
        state.currentPostId = updated.id;
        state.unlockedSecretPosts.add(updated.id);
        populateDetailModal(updated);
        openModal(els.detailModal);
      } else {
        const created = await window.PostRepository.createPost({
          title,
          content,
          imageUrl: finalImageUrl,
          additionalImages: finalAdditionalImages,
          isSecret,
          secretPin: isSecret ? secretPin : "",
        });
        state.unlockedSecretPosts.add(created.id);
        closeModal(els.formModal);
      }
    } catch (err) {
      alert(getFriendlyFirestoreError(err, editingId ? "게시글 수정" : "게시글 등록"));
    } finally {
      hideUploadProgress();
      els.btnSubmitForm.disabled = false;
      els.btnSubmitForm.textContent = originalBtnText;
    }
  }

  /**
   * 삭제 확인 모달 열기 및 삭제 실행 (본인 게시글만 허용)
   */
  function openDeleteConfirmModal() {
    if (!state.currentPostId) return;
    const post = state.posts.find((p) => p.id === state.currentPostId);
    if (!isPostOwner(post)) {
      alert("본인이 작성한 게시글만 삭제할 수 있습니다.");
      return;
    }
    openModal(els.deleteModal);
  }

  async function handleConfirmDelete() {
    if (!state.currentPostId) return;

    const targetId = state.currentPostId;
    const originalText = els.btnConfirmDelete.textContent;
    els.btnConfirmDelete.disabled = true;
    els.btnConfirmDelete.textContent = "삭제 중...";

    try {
      hideError();
      await window.PostRepository.deletePost(targetId);
      state.unlockedSecretPosts.delete(targetId);
      state.currentPostId = null;
      closeModal(els.deleteModal);
      closeModal(els.detailModal);
    } catch (err) {
      alert(getFriendlyFirestoreError(err, "게시글 삭제"));
    } finally {
      els.btnConfirmDelete.disabled = false;
      els.btnConfirmDelete.textContent = originalText;
    }
  }

  /**
   * 이벤트 리스너 바인딩
   */
  function bindEvents() {
    // 로그인 / 회원가입 / 로그아웃
    els.btnOpenLogin.addEventListener("click", () => openAuthModal("login"));
    els.btnOpenSignup.addEventListener("click", () => openAuthModal("signup"));
    els.tabLogin.addEventListener("click", () => setAuthModalMode("login"));
    els.tabSignup.addEventListener("click", () => setAuthModalMode("signup"));
    els.authForm.addEventListener("submit", handleAuthSubmit);

    els.btnLogout.addEventListener("click", async () => {
      try {
        await window.AuthService.signOut();
        state.unlockedSecretPosts.clear();
      } catch (err) {
        alert(window.AuthService.getFriendlyErrorMessage(err));
      }
    });

    // 게시글 작성
    els.btnOpenCreate.addEventListener("click", openCreateModal);
    els.btnEmptyCreate.addEventListener("click", openCreateModal);

    // 비밀글 체크박스 토글
    els.isSecretCheckbox.addEventListener("change", handleSecretCheckboxChange);
    // 4자리 숫자만 입력되도록 필터링
    els.secretPinInput.addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/[^0-9]/g, "").slice(0, 4);
    });
    els.promptPinInput.addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/[^0-9]/g, "").slice(0, 4);
    });

    // 비밀글 비밀번호 확인 폼 제출
    els.secretPromptForm.addEventListener("submit", handleSecretPromptSubmit);

    // 대표 이미지 업로드 드롭존 및 파일 선택 이벤트
    els.imageUploadDropzone.addEventListener("click", () => {
      els.imageFileInput.click();
    });

    els.imageFileInput.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        handleImageFileSelected(file);
      }
    });

    // 대표 이미지 드래그 앤 드롭 지원
    els.imageUploadDropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      els.imageUploadDropzone.classList.add("dragover");
    });
    els.imageUploadDropzone.addEventListener("dragleave", () => {
      els.imageUploadDropzone.classList.remove("dragover");
    });
    els.imageUploadDropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      els.imageUploadDropzone.classList.remove("dragover");
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) {
        handleImageFileSelected(file);
      }
    });

    // 대표 이미지 변경 버튼
    els.btnChangeImage.addEventListener("click", () => {
      els.imageFileInput.click();
    });

    // 대표 이미지 첨부 취소/제거 버튼
    els.btnRemoveImage.addEventListener("click", () => {
      if (state.localPreviewUrl) {
        URL.revokeObjectURL(state.localPreviewUrl);
        state.localPreviewUrl = "";
      }
      state.selectedImageFile = null;
      state.existingImageUrl = "";
      state.isImageRemoved = true;

      els.imageFileInput.value = "";
      els.imagePreviewImg.src = "";
      els.previewFileName.textContent = "";

      els.imagePreviewContainer.classList.add("hidden");
      els.imageUploadDropzone.classList.remove("hidden");
      els.imageError.classList.add("hidden");
    });

    // 추가 이미지 첨부 (최대 10개)
    els.extraUploadDropzone.addEventListener("click", () => {
      els.extraImagesInput.click();
    });

    els.extraImagesInput.addEventListener("change", (e) => {
      handleExtraFilesSelected(e.target.files);
    });

    els.extraUploadDropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      els.extraUploadDropzone.classList.add("dragover");
    });
    els.extraUploadDropzone.addEventListener("dragleave", () => {
      els.extraUploadDropzone.classList.remove("dragover");
    });
    els.extraUploadDropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      els.extraUploadDropzone.classList.remove("dragover");
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleExtraFilesSelected(e.dataTransfer.files);
      }
    });

    els.postForm.addEventListener("submit", handleFormSubmit);

    els.btnEditFromDetail.addEventListener("click", () => {
      if (state.currentPostId) {
        openEditModal(state.currentPostId);
      }
    });

    els.btnDeleteFromDetail.addEventListener("click", openDeleteConfirmModal);
    els.btnConfirmDelete.addEventListener("click", handleConfirmDelete);

    // 모달 닫기 버튼 공통 처리
    document.querySelectorAll("[data-close-modal]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetId = btn.getAttribute("data-close-modal");
        const targetModal = document.getElementById(targetId);
        if (targetModal) closeModal(targetModal);
      });
    });

    // 배경 클릭 시 모달 닫기
    [els.detailModal, els.formModal, els.authModal, els.secretPromptModal, els.deleteModal].forEach((backdrop) => {
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) {
          closeModal(backdrop);
        }
      });
    });

    // ESC 키로 가장 위에 열린 모달 닫기
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!els.deleteModal.classList.contains("hidden")) {
        closeModal(els.deleteModal);
      } else if (!els.secretPromptModal.classList.contains("hidden")) {
        closeModal(els.secretPromptModal);
      } else if (!els.authModal.classList.contains("hidden")) {
        closeModal(els.authModal);
      } else if (!els.formModal.classList.contains("hidden")) {
        closeModal(els.formModal);
      } else if (!els.detailModal.classList.contains("hidden")) {
        closeModal(els.detailModal);
      }
    });
  }

  // 앱 초기화
  document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    state.unsubscribeAuth = window.AuthService.subscribeAuthState(updateAuthUI);
    startRealtimeSubscription();
  });
})();
