import { useState } from "react";
import Sidebar from "./Sidebar/Sidebar";
import ChatBox from "./ChatBox";
import type { User } from "./models/User";

function MainScreen() {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="d-flex" style={{ height: "100vh" }}>
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSelectUser={(user) => {
          setSelectedUser(user);
          setSidebarOpen(false); // đóng sidebar trên mobile sau khi chọn
        }}
      />

      {/* Nội dung chính */}
      <div className="flex-grow-1 h-100" style={{ minWidth: 0 }}>
        {selectedUser ? (
          <ChatBox
            selectedUser={selectedUser}
            onMenuClick={() => setSidebarOpen(true)}
          />
        ) : (
          <div className="d-flex flex-column h-100">
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center border-bottom p-2">
              <button
                className="btn btn-light d-md-none me-2"
                onClick={() => setSidebarOpen(true)}
              >
                <i className="bi bi-list fs-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-grow-1 p-3 overflow-auto align-items-center d-flex justify-content-center">
              <div className="text-muted">Select a user to start chatting</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MainScreen;
