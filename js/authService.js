/**
 * 사용자 인증 서비스 (AuthService - Firebase Authentication)
 * - 이메일/비밀번호 회원가입, 로그인, 로그아웃 및 인증 상태 구독 관리
 */
(function (global) {
  "use strict";

  const listeners = new Set();
  let initializedListener = false;

  function getAuth() {
    if (!global.FirebaseServices || !global.FirebaseServices.auth) {
      throw new Error("Firebase Authentication이 초기화되지 않았습니다.");
    }
    return global.FirebaseServices.auth;
  }

  /**
   * Firebase User 객체를 UI 및 저장소에서 사용하기 편한 형태로 정규화
   */
  function normalizeUser(fbUser) {
    if (!fbUser || !fbUser.uid) return null;

    const email = fbUser.email || "";
    const emailPrefix = email.includes("@") ? email.split("@")[0] : "사용자";
    const rawName = (fbUser.displayName || "").trim() || emailPrefix;
    const authorLabel = rawName.slice(0, 40) || "사용자";

    return {
      uid: String(fbUser.uid),
      email,
      displayName: fbUser.displayName || "",
      authorLabel,
    };
  }

  function notifyListeners(user) {
    const current = user !== undefined ? user : normalizeUser(getAuth().currentUser);
    listeners.forEach((fn) => {
      try {
        fn(current);
      } catch (err) {
        console.error("인증 상태 리스너 오류:", err);
      }
    });
  }

  function ensureAuthObserver() {
    if (initializedListener) return;
    initializedListener = true;
    getAuth().onAuthStateChanged((fbUser) => {
      notifyListeners(normalizeUser(fbUser));
    });
  }

  const AuthService = {
    /**
     * 현재 로그인한 사용자 정보 반환 (비로그인 시 null)
     */
    getCurrentUser() {
      return normalizeUser(getAuth().currentUser);
    },

    /**
     * 인증 상태 변경 구독
     * @param {(user: object | null) => void} callback
     * @returns {() => void} 구독 해제 함수
     */
    subscribeAuthState(callback) {
      ensureAuthObserver();
      listeners.add(callback);
      callback(normalizeUser(getAuth().currentUser));
      return () => {
        listeners.delete(callback);
      };
    },

    /**
     * 이메일/비밀번호 회원가입 (닉네임 프로필 저장 포함)
     */
    async signUp({ email, password, nickname }) {
      const cleanEmail = email.trim();
      const cleanNickname = (nickname || "").trim().slice(0, 40);
      const credential = await getAuth().createUserWithEmailAndPassword(cleanEmail, password);

      const finalDisplayName =
        cleanNickname || (cleanEmail.includes("@") ? cleanEmail.split("@")[0].slice(0, 40) : "사용자");

      if (credential.user) {
        await credential.user.updateProfile({
          displayName: finalDisplayName,
        });
        notifyListeners(normalizeUser(credential.user));
      }

      return normalizeUser(credential.user);
    },

    /**
     * 이메일/비밀번호 로그인
     */
    async signIn({ email, password }) {
      const credential = await getAuth().signInWithEmailAndPassword(email.trim(), password);
      return normalizeUser(credential.user);
    },

    /**
     * 로그아웃
     */
    async signOut() {
      await getAuth().signOut();
      notifyListeners(null);
    },

    /**
     * Firebase Auth 오류 코드를 한국어 안내 문구로 변환
     */
    getFriendlyErrorMessage(err) {
      const code = err && err.code ? err.code : "";
      switch (code) {
        case "auth/email-already-in-use":
          return "이미 가입되어 사용 중인 이메일 주소입니다.";
        case "auth/invalid-email":
          return "올바른 이메일 주소 형식이 아닙니다.";
        case "auth/weak-password":
          return "비밀번호는 6자리 이상으로 설정해 주세요.";
        case "auth/invalid-credential":
        case "auth/user-not-found":
        case "auth/wrong-password":
          return "이메일 또는 비밀번호가 일치하지 않습니다.";
        case "auth/too-many-requests":
          return "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";
        case "auth/user-disabled":
          return "비활성화된 계정입니다. 관리자에게 문의해 주세요.";
        case "auth/operation-not-allowed":
          return "Firebase 콘솔(Authentication > Sign-in method)에서 '이메일/비밀번호' 로그인을 활성화해 주세요.";
        case "auth/network-request-failed":
          return "네트워크 연결을 확인한 후 다시 시도해 주세요.";
        default:
          return err && err.message
            ? `인증 처리 중 오류가 발생했습니다: ${err.message}`
            : "인증 처리 중 알 수 없는 오류가 발생했습니다.";
      }
    },
  };

  global.AuthService = AuthService;
})(window);
