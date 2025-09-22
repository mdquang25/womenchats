import { useState, useEffect } from "react";
import { signOut, updatePassword } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import type { User } from "../models/User";

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
      <h6 className="fw-bold mb-3">Account Settings</h6>

      {userData ? (
        <div className="mb-3">
          <p>
            <b>Name:</b> {userData.name || "No name"}
          </p>
          <p>
            <b>Email:</b> {userData.email}
          </p>
        </div>
      ) : (
        <p>Loading...</p>
      )}

      <button
        className="btn btn-outline-primary mb-2"
        onClick={() => setShowEditModal(true)}
      >
        Edit Profile
      </button>
      <button
        className="btn btn-outline-warning mb-2"
        onClick={() => setShowPasswordModal(true)}
      >
        Change Password
      </button>
      <button
        className="btn btn-outline-danger mb-2"
        onClick={() => setShowLogoutModal(true)}
      >
        Logout
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
                <h5 className="modal-title">Confirm Logout</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowLogoutModal(false)}
                />
              </div>
              <div className="modal-body">
                <p>Are you sure you want to sign out?</p>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowLogoutModal(false)}
                >
                  Cancel
                </button>
                <button className="btn btn-danger" onClick={confirmLogout}>
                  Sign Out
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
                <h5 className="modal-title">Change Password</h5>
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
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowPasswordModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-warning"
                  onClick={handlePasswordChange}
                >
                  Update
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
                <h5 className="modal-title">Edit Profile</h5>
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
                  placeholder="Enter new name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleUpdateProfile}
                >
                  Save
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
