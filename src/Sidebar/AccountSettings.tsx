import { useState } from "react";
import { signOut, updatePassword } from "firebase/auth";
import { auth, db, storage } from "../firebase";
import { doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import type { User } from "../models/User";
import Loading from "../utils/Loading";

interface AccountSettingsProps {
  userData: User | null;
  setUserData: React.Dispatch<React.SetStateAction<User | null>>;
}

function AccountSettings({ userData, setUserData }: AccountSettingsProps) {
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");

  const currentUid = auth.currentUser?.uid;

  // 🔹 Đăng xuất
  const confirmLogout = () => {
    signOut(auth);
    setShowLogoutModal(false);
  };

  // 🔹 Đổi mật khẩu
  const handlePasswordChange = async () => {
    if (!newPassword.trim() || !auth.currentUser) return;
    try {
      await updatePassword(auth.currentUser, newPassword);
      alert("Password updated successfully!");
      setShowPasswordModal(false);
      setNewPassword("");
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  // 🔹 Cập nhật tên hiển thị (Firestore)
  const handleUpdateProfile = async () => {
    if (!newName.trim() || !currentUid) return;
    try {
      await updateDoc(doc(db, "users", currentUid), { name: newName });
      setUserData((prev) => (prev ? { ...prev, name: newName } : prev));
      alert("Profile updated successfully!");
      setShowEditModal(false);
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  // 🔹 Upload Avatar
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !currentUid) return;
    const file = e.target.files[0];

    try {
      const avatarRef = ref(storage, `avatars/${currentUid}`);
      await uploadBytes(avatarRef, file);
      const url = await getDownloadURL(avatarRef);

      await updateDoc(doc(db, "users", currentUid), { avatarUrl: url });
      setUserData((prev) => (prev ? { ...prev, avatarUrl: url } : prev));

      alert("Avatar updated successfully!");
    } catch (err: any) {
      alert("Error uploading avatar: " + err.message);
    }
  };

  return (
    <div className="flex-1 d-flex h-100 p-3 flex-column border-end bg-white">
      <div className="fw-bold fs-6 p-2 border-bottom">Cài đặt tài khoản</div>

      {userData ? (
        <div className="mt-3 text-center">
          <div>
            <img
              src={
                userData?.avatarUrl ||
                "https://cdn2.fptshop.com.vn/unsafe/800x0/meme_cho_1_e568e5b1a5.jpg"
              }
              alt="Ảnh đại diện"
              title="ảnh đại diện người dùng"
              className="img-fluid rounded-circle mx-auto d-block mb-2"
              style={{ width: 100, height: 100, objectFit: "cover" }}
            />
            {/* Nút sửa avatar */}
            <label
              htmlFor="avatarInput"
              className="btn btn-sm btn-outline-success"
            >
              <i className="bi bi-pen" /> Sửa avatar
            </label>
            <input
              type="file"
              id="avatarInput"
              accept="image/*"
              className="d-none"
              onChange={handleAvatarChange}
            />
          </div>

          <p className="mt-3">
            <b>Tên:</b> {userData.name || "Chưa có tên"}
          </p>
          <p title={userData.email}>
            <b>Email:</b> {userData.email}
          </p>
        </div>
      ) : (
        <Loading />
      )}

      {/* Các nút chức năng cũ */}
      <button
        className="btn btn-outline-primary mb-2"
        onClick={() => setShowEditModal(true)}
      >
        <i className="bi bi-pen me-1" />
        Đổi tên hiển thị
      </button>
      <button
        className="btn btn-outline-warning mb-2"
        onClick={() => setShowPasswordModal(true)}
      >
        <i className="bi bi-lock me-1" />
        Đổi mật khẩu
      </button>
      <button
        className="btn btn-outline-danger mb-2"
        onClick={() => setShowLogoutModal(true)}
      >
        <i className="bi bi-box-arrow-right me-1" />
        Đăng xuất
      </button>

      {/* Logout Modal */}
      {showLogoutModal && (
        <div
          className="modal fade show"
          style={{ display: "block", background: "rgba(0,0,0,0.3)" }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Xác nhận đăng xuất</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowLogoutModal(false)}
                />
              </div>
              <div className="modal-body">
                <p>Bạn có chắc chắn muốn đăng xuất không?</p>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowLogoutModal(false)}
                >
                  Hủy
                </button>
                <button className="btn btn-danger" onClick={confirmLogout}>
                  Đăng xuất
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div
          className="modal fade show"
          style={{ display: "block", background: "rgba(0,0,0,0.3)" }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Đổi mật khẩu</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowPasswordModal(false)}
                />
              </div>
              <div className="modal-body">
                <input
                  type="password"
                  className="form-control"
                  placeholder="Nhập mật khẩu mới"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowPasswordModal(false)}
                >
                  Hủy
                </button>
                <button
                  className="btn btn-warning"
                  onClick={handlePasswordChange}
                >
                  Cập nhật
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div
          className="modal fade show"
          style={{ display: "block", background: "rgba(0,0,0,0.3)" }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Đổi tên hiển thị</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowEditModal(false)}
                />
              </div>
              <div className="modal-body">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Nhập tên mới..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowEditModal(false)}
                >
                  Hủy
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleUpdateProfile}
                >
                  Lưu thay đổi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AccountSettings;
