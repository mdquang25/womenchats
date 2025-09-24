// Sidebar.tsx
import { useState } from "react";
import type { User } from "../models/User";
import ChatsList from "./ChatList";
import FriendList from "./FriendList";
import FriendRequests from "./FriendRquests";
import DiscoverUsers from "./DiscoverUsers";
import AppSettings from "./AppSettings";
import AccountSettings from "./AccountSettings";

interface SidebarProps {
  userData: User | null;
  setUserData: React.Dispatch<React.SetStateAction<User | null>>;
  isOpen: boolean;
  onClose: () => void;
  onSelectUser: (user: User) => void;
}

type NavOption =
  | "chats"
  | "friends"
  | "friendRequests"
  | "discover"
  | "appSettings"
  | "accountSettings";

const navItems = [
  { key: "chats", label: "Chats", icon: "bi-chat-dots" },
  { key: "friends", label: "Friends", icon: "bi-person-check" },
  { key: "friendRequests", label: "Friend Requests", icon: "bi-person-plus" },
  { key: "discover", label: "Discover Users", icon: "bi-search" },
  { key: "appSettings", label: "App Settings", icon: "bi-gear" },
  {
    key: "accountSettings",
    label: "Account Settings",
    icon: "bi-person-circle",
  },
];

function Sidebar({
  userData,
  setUserData,
  isOpen,
  onClose,
  onSelectUser,
}: SidebarProps) {
  const [selected, setSelected] = useState<NavOption>("chats");

  // wrapper để truyền xuống ChatsList: đóng sidebar trên mobile sau khi chọn
  const handleSelectUser = (user: User) => {
    onSelectUser(user);
    // gọi onClose để đóng mobile sidebar (MainScreen sẽ ignore nếu desktop)
    onClose();
  };

  return (
    <>
      {/* Overlay (mobile only) */}
      <div
        className={`d-md-none position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-25 ${
          isOpen ? "d-block" : "d-none"
        }`}
        style={{ zIndex: 1040 }}
        onClick={onClose}
      />

      {/* Mobile sliding sidebar */}
      <div
        className="position-fixed d-md-none top-0 start-0 h-100 bg-white shadow"
        style={{
          zIndex: 1050,
          width: "80%",
          maxWidth: 320,
          transform: isOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 240ms ease-in-out",
        }}
      >
        <div className="d-flex" style={{ height: "100%" }}>
          {/* icon nav */}
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

          {/* nội dung */}
          <div className="flex-grow-1" style={{ minWidth: 200 }}>
            {selected === "chats" && (
              <ChatsList onSelectUser={handleSelectUser} />
            )}
            {selected === "friends" && <FriendList />}
            {selected === "friendRequests" && <FriendRequests />}
            {selected === "discover" && <DiscoverUsers />}
            {selected === "appSettings" && <AppSettings />}
            {selected === "accountSettings" && (
              <AccountSettings userData={userData} setUserData={setUserData} />
            )}
          </div>
        </div>
      </div>

      {/* Desktop sidebar (static) */}
      <div
        className="d-none d-md-flex position-static flex-column border-end bg-white"
        style={{ width: 320, height: "100vh" }}
      >
        <div className="d-flex" style={{ height: "100%" }}>
          <div
            className="d-flex flex-column border-end bg-dark"
            style={{ minWidth: 60 }}
          >
            {navItems.map(
              (item, key) =>
                key < 5 && (
                  <button
                    key={item.key}
                    className={`btn btn-link py-3 rounded-4 mx-1 my-2 ${
                      selected === item.key
                        ? "bg-secondary text-warning"
                        : "text-white"
                    }`}
                    style={{ border: "none", paddingTop: 0, paddingBottom: 0 }}
                    onClick={() => setSelected(item.key as NavOption)}
                    title={item.label}
                  >
                    <i className={`bi ${item.icon} fs-4`} />
                  </button>
                )
            )}
            <button
              key={navItems[5].key}
              className={`rounded-circle mx-1 my-2  ${
                selected === navItems[5].key
                  ? "bg-success avatar-tab-active"
                  : "text-dark"
              }`}
              style={{
                border: "none",
                borderRadius: 0,
                paddingLeft: 0,
                paddingRight: 0,
              }}
              onClick={() => setSelected(navItems[5].key as NavOption)}
              title={navItems[5].label}
            >
              <img
                className="rounded-circle"
                style={{
                  width: 48,
                  height: 48,
                  objectFit: "cover",
                }}
                src={
                  userData?.avatarUrl ||
                  "https://cdn2.fptshop.com.vn/unsafe/800x0/meme_cho_1_e568e5b1a5.jpg"
                }
                alt="Ảnh đại diện người dùng"
              />
            </button>
          </div>

          <div className="flex-grow-1" style={{ minWidth: 240 }}>
            {selected === "chats" && <ChatsList onSelectUser={onSelectUser} />}
            {selected === "friends" && <FriendList />}
            {selected === "friendRequests" && <FriendRequests />}
            {selected === "discover" && <DiscoverUsers />}
            {selected === "appSettings" && <AppSettings />}
            {selected === "accountSettings" && (
              <AccountSettings userData={userData} setUserData={setUserData} />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default Sidebar;
