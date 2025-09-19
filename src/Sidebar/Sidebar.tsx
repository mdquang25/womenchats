import { useState } from "react";
import type { User } from "../models/User";
import ChatsList from "./ChatList";
import FriendRequests from "./FriendRquests";
import DiscoverUsers from "./DiscoverUsers";
import AppSettings from "./AppSettings";
import AccountSettings from "./AccountSettings";

// Add Bootstrap Icons CDN in your index.html or install react-icons/bootstrap-icons if not already

interface SidebarProps {
  onSelectUser: (user: User) => void;
}

type NavOption =
  | "chats"
  | "friendRequests"
  | "discover"
  | "appSettings"
  | "accountSettings";

const navItems = [
  { key: "chats", label: "Chats", icon: "bi-chat-dots" },
  { key: "friendRequests", label: "Friend Requests", icon: "bi-person-plus" },
  { key: "discover", label: "Discover Users", icon: "bi-search" },
  { key: "appSettings", label: "App Settings", icon: "bi-gear" },
  {
    key: "accountSettings",
    label: "Account Settings",
    icon: "bi-person-circle",
  },
];

function Sidebar({ onSelectUser }: SidebarProps) {
  const [selected, setSelected] = useState<NavOption>("chats");

  return (
    <div
      className="d-flex"
      style={{ height: "100vh", width: "30%", minWidth: 200 }}
    >
      {/* NavBar */}
      <div
        className="d-flex flex-column border-end bg-light"
        style={{ width: 60 }}
      >
        {navItems.map((item) => (
          <button
            key={item.key}
            className={`btn btn-link py-3 ${
              selected === item.key ? "bg-primary text-white" : "text-dark"
            }`}
            style={{ border: "none", borderRadius: 0 }}
            onClick={() => setSelected(item.key as NavOption)}
            title={item.label}
          >
            <i className={`bi ${item.icon} fs-4`} />
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex-grow-1" style={{ minWidth: 250 }}>
        {selected === "chats" && <ChatsList onSelectUser={onSelectUser} />}
        {selected === "friendRequests" && <FriendRequests />}
        {selected === "discover" && <DiscoverUsers />}
        {selected === "appSettings" && <AppSettings />}
        {selected === "accountSettings" && <AccountSettings />}
      </div>
    </div>
  );
}

export default Sidebar;
