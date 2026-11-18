/**
 * 게시글 저장소 (PostRepository - Firestore + Authentication + 비밀글 + 다중 추가 이미지 첨부)
 * - 비로그인 사용자도 전체 게시글 조회(subscribePosts, getAllPosts, getPostById) 가능
 * - 게시글 생성(createPost) 시 현재 로그인한 사용자의 UID(authorUid), 작성자명(authorName),
 *   대표 이미지(imageUrl), 추가 이미지 목록(additionalImages, 최대 10개),
 *   비밀글 여부(isSecret), 4자리 비밀번호(secretPin)를 함께 저장
 * - 게시글 수정(updatePost)·삭제(deletePost)는 본인 UID와 일치할 때만 허용 (클라이언트 + Firestore 보안 규칙 이중 검증)
 */
(function (global) {
  "use strict";

  const COLLECTION_NAME = "posts";

  function getDb() {
    if (!global.FirebaseServices || !global.FirebaseServices.db) {
      throw new Error("Firestore 데이터베이스가 초기화되지 않았습니다.");
    }
    return global.FirebaseServices.db;
  }

  function getPostsCollection() {
    return getDb().collection(COLLECTION_NAME);
  }

  function requireCurrentUser(actionName) {
    const user = global.AuthService ? global.AuthService.getCurrentUser() : null;
    if (!user || !user.uid) {
      const err = new Error(`로그인한 사용자만 ${actionName}할 수 있습니다.`);
      err.code = "auth-required";
      throw err;
    }
    return user;
  }

  /**
   * Firestore Timestamp 또는 날짜 값을 ISO 8601 문자열로 안전하게 변환
   */
  function timestampToIso(value) {
    if (!value) return new Date().toISOString();
    if (typeof value.toDate === "function") {
      return value.toDate().toISOString();
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === "string") {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
    }
    return new Date().toISOString();
  }

  /**
   * Firestore 문서를 UI에서 사용하는 게시글 객체 형태로 변환
   */
  function mapDocToPost(docSnap) {
    const data = docSnap.data({ serverTimestamps: "estimate" }) || {};
    const createdIso = timestampToIso(data.createdAt);
    const updatedIso = data.updatedAt ? timestampToIso(data.updatedAt) : createdIso;

    const isSecret = Boolean(data.isSecret);
    const secretPin = isSecret && typeof data.secretPin === "string" ? data.secretPin.trim() : "";

    const additionalImages = Array.isArray(data.additionalImages)
      ? data.additionalImages.filter((url) => typeof url === "string" && url.trim().length > 0).slice(0, 10)
      : [];

    return {
      id: docSnap.id,
      title: typeof data.title === "string" ? data.title : "",
      content: typeof data.content === "string" ? data.content : "",
      imageUrl: typeof data.imageUrl === "string" ? data.imageUrl : "",
      additionalImages,
      authorUid: data.authorUid ? String(data.authorUid).trim() : "",
      authorName:
        typeof data.authorName === "string" && data.authorName.trim()
          ? data.authorName.trim()
          : "익명",
      isSecret,
      secretPin,
      createdAt: createdIso,
      updatedAt: updatedIso,
    };
  }

  const PostRepository = {
    /**
     * 전체 게시글 실시간 구독 (로그인하지 않아도 조회 가능)
     */
    subscribePosts(onUpdate, onError) {
      return getPostsCollection()
        .orderBy("createdAt", "desc")
        .onSnapshot(
          (querySnapshot) => {
            const posts = querySnapshot.docs.map(mapDocToPost);
            onUpdate(posts);
          },
          (error) => {
            console.error("Firestore 실시간 구독 오류:", error);
            if (typeof onError === "function") {
              onError(error);
            }
          }
        );
    },

    /**
     * 전체 게시글 목록 단건 조회
     */
    async getAllPosts() {
      const snapshot = await getPostsCollection().orderBy("createdAt", "desc").get();
      return snapshot.docs.map(mapDocToPost);
    },

    /**
     * 단일 게시글 상세 조회
     */
    async getPostById(id) {
      const docSnap = await getPostsCollection().doc(id).get();
      if (!docSnap.exists) return null;
      return mapDocToPost(docSnap);
    },

    /**
     * 새 게시글 생성 (대표 이미지 + 추가 이미지 최대 10개)
     */
    async createPost({ title, content, imageUrl, additionalImages, isSecret, secretPin }) {
      const user = requireCurrentUser("게시글을 작성");
      const serverNow = firebase.firestore.FieldValue.serverTimestamp();

      const normalizedIsSecret = Boolean(isSecret);
      const normalizedPin = normalizedIsSecret ? String(secretPin || "").trim() : "";
      const normalizedAdditional = Array.isArray(additionalImages)
        ? additionalImages.filter((u) => typeof u === "string" && u.trim().length > 0).slice(0, 10)
        : [];

      const payload = {
        title: title.trim(),
        content: content.trim(),
        imageUrl: (imageUrl || "").trim(),
        additionalImages: normalizedAdditional,
        authorUid: String(user.uid).trim(),
        authorName: user.authorLabel,
        isSecret: normalizedIsSecret,
        secretPin: normalizedPin,
        createdAt: serverNow,
        updatedAt: serverNow,
      };

      const docRef = await getPostsCollection().add(payload);
      const createdSnap = await docRef.get();
      return mapDocToPost(createdSnap);
    },

    /**
     * 기존 게시글 수정 (본인 UID 일치 시에만 허용)
     */
    async updatePost(id, { title, content, imageUrl, additionalImages, isSecret, secretPin }) {
      const user = requireCurrentUser("게시글을 수정");
      const docRef = getPostsCollection().doc(id);
      const existing = await docRef.get();

      if (!existing.exists) {
        throw new Error("수정할 게시글을 찾을 수 없습니다.");
      }

      const existingData = existing.data() || {};
      const postAuthorUid = existingData.authorUid ? String(existingData.authorUid).trim() : "";
      const currentUid = String(user.uid).trim();

      if (!postAuthorUid || postAuthorUid !== currentUid) {
        const err = new Error("본인이 작성한 게시글만 수정할 수 있습니다.");
        err.code = "not-owner";
        throw err;
      }

      const normalizedIsSecret = Boolean(isSecret);
      const normalizedPin = normalizedIsSecret ? String(secretPin || "").trim() : "";
      const normalizedAdditional = Array.isArray(additionalImages)
        ? additionalImages.filter((u) => typeof u === "string" && u.trim().length > 0).slice(0, 10)
        : [];

      await docRef.update({
        title: title.trim(),
        content: content.trim(),
        imageUrl: (imageUrl || "").trim(),
        additionalImages: normalizedAdditional,
        isSecret: normalizedIsSecret,
        secretPin: normalizedPin,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      const updatedSnap = await docRef.get();
      return mapDocToPost(updatedSnap);
    },

    /**
     * 게시글 삭제 (본인 UID 일치 시에만 허용)
     */
    async deletePost(id) {
      const user = requireCurrentUser("게시글을 삭제");
      const docRef = getPostsCollection().doc(id);
      const existing = await docRef.get();

      if (!existing.exists) {
        return true;
      }

      const existingData = existing.data() || {};
      const postAuthorUid = existingData.authorUid ? String(existingData.authorUid).trim() : "";
      const currentUid = String(user.uid).trim();

      if (!postAuthorUid || postAuthorUid !== currentUid) {
        const err = new Error("본인이 작성한 게시글만 삭제할 수 있습니다.");
        err.code = "not-owner";
        throw err;
      }

      await docRef.delete();
      return true;
    },
  };

  global.PostRepository = PostRepository;
})(window);
