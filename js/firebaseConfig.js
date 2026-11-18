/**
 * Firebase 초기화 설정 (firebaseConfig.js)
 * - Firebase App, Cloud Firestore, Firebase Authentication 인스턴스 초기화
 * - 다음 단계(Cloudinary)는 ImageService에서 독립적으로 연결됩니다.
 */
(function (global) {
  "use strict";

  const firebaseConfig = {
    apiKey: "AIzaSyAVRo43NLAdhAoIwnusXhm4rlGK2AKCfFU",
    authDomain: "galleryboard.firebaseapp.com",
    projectId: "galleryboard",
    storageBucket: "galleryboard.firebasestorage.app",
    messagingSenderId: "102476233751",
    appId: "1:102476233751:web:ab384b9b073cc5d5b5b052",
  };

  if (!global.firebase) {
    console.error("Firebase SDK가 로드되지 않았습니다.");
    return;
  }

  const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();
  const auth = firebase.auth();

  global.FirebaseServices = {
    app,
    db,
    auth,
  };
})(window);
