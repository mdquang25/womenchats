import { useState, useEffect } from "react";
import { signOut, updatePassword } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import type { User } from "../models/User";
import Loading from "../utils/Loading";

function AccountSettings() {
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");

  const [userData, setUserData] = useState<User | null>(null);
  const currentUid = auth.currentUser?.uid;

  // 🔹 Load user info từ Firestore (users/{uid})
  useEffect(() => {
    const fetchUser = async () => {
      if (!currentUid) return;
      const userDoc = await getDoc(doc(db, "users", currentUid));
      if (userDoc.exists()) {
        setUserData({
          uid: userDoc.id,
          ...(userDoc.data() as Omit<User, "uid">),
        });
      }
    };
    fetchUser();
  }, [currentUid]);

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

  return (
    <div className="flex-1 d-flex h-100 p-3 flex-column border-end bg-white">
      <div className="fw-bold fs-6 p-2 border-bottom">Cài đặt tài khoản</div>

      {userData ? (
        <div className="mt-3">
          <p>
            <b>Tên:</b> {userData.name || "Chưa có tên"}
          </p>
          <p>
            <b>Email:</b> {userData.email}
          </p>
        </div>
      ) : (
        <Loading />
      )}

      <button
        className="btn btn-outline-primary mb-2"
        onClick={() => setShowEditModal(true)}
      >
        Chỉnh sửa hồ sơ
      </button>
      <button
        className="btn btn-outline-warning mb-2"
        onClick={() => setShowPasswordModal(true)}
      >
        Đổi mật khẩu
      </button>
      <button
        className="btn btn-outline-danger mb-2"
        onClick={() => setShowLogoutModal(true)}
      >
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
                <h5 className="modal-title">Chỉnh sửa hồ sơ</h5>
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
