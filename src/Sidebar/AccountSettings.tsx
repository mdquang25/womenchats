import { useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

function AccountSettings() {
  const [showModal, setShowModal] = useState(false);

  const handleLogout = () => setShowModal(true);
  const confirmLogout = () => {
    signOut(auth);
    setShowModal(false);
  };
  const cancelLogout = () => setShowModal(false);

  return (
    <div className="flex-1 p-2">
      <h6 className="fw-bold">Account Settings</h6>
      <p>Manage your account settings here.</p>
      <hr />
      <button
        className="btn btn-outline-danger mt-auto mb-2"
        onClick={handleLogout}
      >
        Logout
      </button>

      {/* Modal with smooth transition */}
      <div
        className={`modal fade react-modal-fade${showModal ? " show" : ""}`}
        style={{
          display: "block",
          background: showModal ? "rgba(0,0,0,0.3)" : "transparent",
        }}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Confirm Logout</h5>
              <button
                type="button"
                className="btn-close"
                onClick={cancelLogout}
                aria-label="Close"
              />
            </div>
            <div className="modal-body">
              <p>Are you sure you want to sign out?</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={cancelLogout}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={confirmLogout}>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AccountSettings;
