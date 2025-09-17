import { useState, useEffect } from "react";
import { db, auth } from "./firebase";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";

interface User {
  uid: string;
  name: string;
  email: string;
}

interface SidebarProps {
  onSelectUser: (user: User) => void;
}

function Sidebar({ onSelectUser }: SidebarProps) {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [filtered, setFiltered] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      const snapshot = await getDocs(collection(db, "users"));
      const currentUid = auth.currentUser?.uid;
      const data = snapshot.docs
        .map(
          (doc) =>
            ({ uid: doc.id, ...(doc.data() as Omit<User, "uid">) } as User)
        )
        .filter((u) => u.uid !== currentUid);

      // For each user, get latest message timestamp
      const usersWithLastMsg = await Promise.all(
        data.map(async (user) => {
          const chatId = [currentUid, user.uid].sort().join("_");
          const msgQuery = query(
            collection(db, "chats", chatId, "messages"),
            orderBy("timestamp", "desc"),
            limit(1)
          );
          const msgSnap = await getDocs(msgQuery);
          let lastMsgTime = 0;
          if (!msgSnap.empty) {
            const msg = msgSnap.docs[0].data();
            lastMsgTime = msg.timestamp?.toMillis?.() || 0;
          }
          return { ...user, lastMsgTime };
        })
      );

      // Sort by lastMsgTime desc
      usersWithLastMsg.sort((a, b) => b.lastMsgTime - a.lastMsgTime);

      setUsers(usersWithLastMsg);
      setFiltered(usersWithLastMsg);
      setLoading(false);
    };
    fetchUsers();
  }, []);

  // filter as you type
  useEffect(() => {
    if (!search.trim()) {
      setFiltered(users);
    } else {
      setFiltered(
        users.filter(
          (u) =>
            u.name.toLowerCase().includes(search.toLowerCase()) ||
            u.email.toLowerCase().includes(search.toLowerCase())
        )
      );
    }
  }, [search, users]);

  return (
    <div
      className="d-flex flex-column border-end bg-white"
      style={{ width: "250px", height: "100vh" }}
    >
      {/* Search */}
      <div className="p-3 border-bottom">
        <input
          type="text"
          className="form-control"
          placeholder="Search friends..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Friends List */}
      <div className="flex-grow-1 overflow-auto">
        {loading ? (
          <div className="p-3 text-muted text-center">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-3 text-muted text-center">No users found</div>
        ) : (
          filtered.map((user) => (
            <div
              key={user.uid}
              className="p-2 border-bottom d-flex align-items-center hover-bg"
              style={{ cursor: "pointer" }}
              onClick={() => onSelectUser(user)}
            >
              <div
                className="rounded-circle bg-primary text-white d-flex justify-content-center align-items-center me-2"
                style={{ width: "36px", height: "36px" }}
              >
                {user.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="fw-bold">{user.name || user.email}</div>
                <small className="text-muted">{user.email}</small>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Sidebar;
