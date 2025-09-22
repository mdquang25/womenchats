import type { User } from "./models/User";

interface ChatBoxProps {
  selectedUser: User;
  onMenuClick: () => void;
}

function ChatBox({ selectedUser, onMenuClick }: ChatBoxProps) {
  return (
    <div className="d-flex flex-column h-100">
      {/* Header */}
      <div className="d-flex align-items-center border-bottom p-2">
        {/* Nút menu chỉ hiện trên mobile */}
        <button className="btn btn-light d-md-none me-2" onClick={onMenuClick}>
          <i className="bi bi-list fs-4" />
        </button>
        <h5 className="mb-0">{selectedUser.name}</h5>
      </div>

      {/* Messages */}
      <div className="flex-grow-1 p-3 overflow-auto bg-light">
        <div className="text-muted">Chat messages with {selectedUser.name}</div>
      </div>

      {/* Input */}
      <div className="p-2 border-top">
        <div className="input-group">
          <input
            type="text"
            className="form-control"
            placeholder="Type a message..."
          />
          <button className="btn btn-primary">Send</button>
        </div>
      </div>
    </div>
  );
}

export default ChatBox;
