import Loading from "./utils/Loading";
import Login from "./LoginScreen";
import MainScreen from "./MainScreen";
import { useState, useEffect } from "react";
import { auth } from "./firebase";
import "./App.css";

// Toast component
function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: "success" | "error";
  onClose: () => void;
}) {
  return (
    <div
      className={`toast align-items-center text-bg-${
        type === "success" ? "success" : "danger"
      } border-0 show position-fixed top-0 end-0 m-3`}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      style={{ zIndex: 9999, minWidth: 200 }}
    >
      <div className="d-flex">
        <div className="toast-body">{message}</div>
        <button
          type="button"
          className="btn-close btn-close-white me-2 m-auto"
          aria-label="Close"
          onClick={onClose}
        ></button>
      </div>
    </div>
  );
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(!!auth.currentUser);
  const [loading, setLoading] = useState(true);

  // Toast state
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      setIsLoggedIn(!!user);
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) {
    return <Loading />;
  } else if (!isLoggedIn) {
    return (
      <>
        <Login onLogin={() => setIsLoggedIn(true)} showToast={showToast} />
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </>
    );
  } else {
    return (
      <>
        <MainScreen />
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </>
    );
  }
}

export default App;
