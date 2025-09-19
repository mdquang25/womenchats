import Sidebar from "./Sidebar/Sidebar";
import ChatBox from "./ChatBox";
import { useState } from "react";
import type { User } from "./models/User";

function MainScreen() {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  return (
    <div className="d-flex" style={{ height: "100vh" }}>
      <Sidebar onSelectUser={setSelectedUser} />
      <div className="flex-grow-1 h-100">
        {selectedUser ? (
          <ChatBox selectedUser={selectedUser} />
        ) : (
          <div className="d-flex align-items-center justify-content-center h-100 text-muted">
            Select a friend to start chatting
          </div>
        )}
      </div>
    </div>
  );
}

export default MainScreen;
