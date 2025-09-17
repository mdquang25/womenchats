import Sidebar from "./Sidebar";
import Chat from "./Chat";
import Login from "./Login";
import { useState, useEffect } from "react";
import { auth } from "./firebase";
import type { User } from "./models/User";
import Loading from "./Loading";

function App() {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(!!auth.currentUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      setIsLoggedIn(!!user);
      if (!user) setSelectedUser(null);
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) {
    return <Loading />;
  } else if (!isLoggedIn) {
    return <Login onLogin={() => setIsLoggedIn(true)} />;
  }

  return (
    <div className="d-flex">
      <Sidebar onSelectUser={setSelectedUser} />
      <div className="flex-grow-1">
        {selectedUser ? (
          <Chat selectedUser={selectedUser} />
        ) : (
          <div className="d-flex align-items-center justify-content-center h-100 text-muted">
            Select a friend to start chatting
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
