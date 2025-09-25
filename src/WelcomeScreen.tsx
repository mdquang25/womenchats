import { doc, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "./firebase";
import type { User } from "./models/User";
import { useState } from "react";
import { auth, db } from "./firebase";

interface WelcomeScreenProps {
  onLogin: (bool: boolean) => void;
  showToast: (message: string, type: "success" | "error") => void;
}

function WelcomeScreen({ onLogin, showToast }: WelcomeScreenProps) {
  const [displayName, setDisplayName] = useState("");
  const [showModal, setShowModal] = useState(true);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const saveProfile = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const uid = user.uid;
      let avatarUrl =
        "https://cdn2.fptshop.com.vn/unsafe/800x0/meme_cho_1_e568e5b1a5.jpg";

      if (avatarFile) {
        const avatarRef = ref(storage, `avatars/${uid}`);
        await uploadBytes(avatarRef, avatarFile);
        avatarUrl = await getDownloadURL(avatarRef);
      }

      const userData: User = {
        uid,
        email: user.email || "",
        name: displayName || "Người dùng mới",
        avatarUrl,
      };

      await setDoc(doc(db, "users", uid), userData);

      showToast("Tạo hồ sơ thành công!", "success");
    } catch (err: any) {
      showToast("Lỗi lưu hồ sơ: " + err.message, "error");
    }
    setShowModal(false);
  };

  return (
    <div className="d-flex align-items-center justify-content-center vh-100 bg-light">
      <div className="text-center">
        <h1 className="mb-4">Chào mừng đến với WomenChats!</h1>
        <p className="lead">Nơi kết nối và chia sẻ giữa chúng ta!</p>
        <div>
          <button className="btn btn-success" onClick={() => onLogin(true)}>
            Bắt đầu trải nghiệm!
          </button>
        </div>
        {showModal && (
          <div
            className="modal d-block"
            style={{ background: "rgba(0,0,0,0.5)" }}
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content p-3">
                <h5 className="modal-title mb-3">🎉 Chào mừng bạn!</h5>
                <p>Vui lòng nhập tên hiển thị và chọn ảnh đại diện.</p>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Tên hiển thị</label>
                  <input
                    className="form-control"
                    placeholder="Tên của bạn"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Ảnh đại diện</label>
                  <input
                    className="form-control"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                  />
                </div>

                <div className="d-flex justify-content-end">
                  <button
                    className="btn btn-secondary me-2"
                    onClick={saveProfile}
                  >
                    Bỏ qua
                  </button>
                  <button className="btn btn-primary" onClick={saveProfile}>
                    Lưu hồ sơ
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default WelcomeScreen;
