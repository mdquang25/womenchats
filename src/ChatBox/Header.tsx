import type { User } from "../models/User";

interface HeaderProps {
  selectedUser: User;
  onMenuClick: () => void;
}

export default function Header({ selectedUser, onMenuClick }: HeaderProps) {
  return (
    <div className="d-flex justify-content-between align-items-center border-bottom p-2">
      <h5 className="mb-0 text-primary d-flex align-items-center gap-2">
        <img
          className="rounded-circle"
          style={{ width: 42, height: 42, objectFit: "cover" }}
          src={
            selectedUser.avatarUrl ||
            "https://cdn2.fptshop.com.vn/unsafe/800x0/meme_cho_1_e568e5b1a5.jpg"
          }
          alt="Ảnh đại diện người dùng"
        />
        <span className="fw-semibold">{selectedUser.name}</span>
      </h5>

      <div className="d-flex align-items-center gap-2">
        <button
          className="btn btn-sm btn-outline-secondary d-md-none"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <i className="bi bi-list" />
        </button>
      </div>
    </div>
  );
}
