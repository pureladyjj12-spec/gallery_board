/**
 * 이미지 서비스 (ImageService - Cloudinary 연동)
 * - Cloudinary unsigned upload preset을 사용한 이미지 업로드
 * - 업로드 진행률(onProgress) 콜백 지원
 * - 기본/대체 썸네일 SVG 제공
 */
(function (global) {
  "use strict";

  const CLOUD_NAME = "vsca2sai";
  const UPLOAD_PRESET = "gallery_board";
  const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

  // 이미지를 첨부하지 않았거나 로드 실패 시 표시할 깔끔한 플레이스홀더 SVG
  const DEFAULT_PLACEHOLDER_DATA_URL =
    "data:image/svg+xml;charset=UTF-8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">' +
        '<rect width="800" height="600" fill="#f1f5f9"/>' +
        '<g transform="translate(360, 240)" fill="none" stroke="#94a3b8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
          '<rect x="0" y="0" width="80" height="64" rx="8"/>' +
          '<circle cx="26" cy="24" r="8"/>' +
          '<path d="M12 52l18-18 14 14 16-16 10 10"/>' +
        '</g>' +
        '<text x="50%" y="350" dominant-baseline="middle" text-anchor="middle" fill="#64748b" font-family="Pretendard, -apple-system, sans-serif" font-size="20" font-weight="600">등록된 이미지가 없습니다</text>' +
        '<text x="50%" y="380" dominant-baseline="middle" text-anchor="middle" fill="#94a3b8" font-family="Pretendard, -apple-system, sans-serif" font-size="14">Gallery Board</text>' +
      "</svg>"
    );

  const ImageService = {
    /**
     * 기본 플레이스홀더 / 대체 이미지 URL 반환
     */
    getDefaultImageUrl() {
      return DEFAULT_PLACEHOLDER_DATA_URL;
    },

    getFallbackUrl() {
      return DEFAULT_PLACEHOLDER_DATA_URL;
    },

    /**
     * Cloudinary에 이미지 파일 업로드
     * @param {File} file 업로드할 이미지 파일
     * @param {(percent: number) => void} [onProgress] 진행률 콜백
     * @returns {Promise<string>} 업로드된 이미지 secure_url
     */
    uploadImage(file, onProgress) {
      return new Promise((resolve, reject) => {
        if (!file) {
          reject(new Error("업로드할 파일이 없습니다."));
          return;
        }

        // 파일 유효성 검사 (이미지 형식 및 10MB 크기 제한)
        if (!file.type.startsWith("image/")) {
          reject(new Error("이미지 파일만 업로드할 수 있습니다 (JPG, PNG, GIF, WebP 등)."));
          return;
        }

        const maxSizeBytes = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSizeBytes) {
          reject(new Error("이미지 크기는 최대 10MB까지 가능합니다."));
          return;
        }

        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", UPLOAD_PRESET);

        const xhr = new XMLHttpRequest();
        xhr.open("POST", UPLOAD_URL);

        if (xhr.upload && typeof onProgress === "function") {
          xhr.upload.addEventListener("progress", (evt) => {
            if (evt.lengthComputable) {
              const percent = Math.round((evt.loaded / evt.total) * 100);
              onProgress(percent);
            }
          });
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const res = JSON.parse(xhr.responseText);
              if (res.secure_url) {
                resolve(res.secure_url);
              } else {
                reject(new Error("업로드 응답에 이미지 URL이 없습니다."));
              }
            } catch (e) {
              reject(new Error("Cloudinary 응답 파싱 실패: " + e.message));
            }
          } else {
            let errorMsg = `Cloudinary 업로드 실패 (HTTP ${xhr.status})`;
            try {
              const res = JSON.parse(xhr.responseText);
              if (res.error && res.error.message) {
                errorMsg = res.error.message;
              }
            } catch (e) {
              // json이 아닐 경우 기본 메시지 유지
            }
            reject(new Error(errorMsg));
          }
        };

        xhr.onerror = () => {
          reject(new Error("네트워크 오류로 이미지 업로드에 실패했습니다. 인터넷 연결을 확인해 주세요."));
        };

        xhr.onabort = () => {
          reject(new Error("이미지 업로드가 중단되었습니다."));
        };

        xhr.send(formData);
      });
    },
  };

  global.ImageService = ImageService;
})(window);
