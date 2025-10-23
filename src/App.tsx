import { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";
import Loading from "./utils/Loading";
import LoginScreen from "./LoginScreen";
import VerifyEmailScreen from "./VerifyEmailScreen";
import MainScreen from "./MainScreen";
import WelcomeScreen from "./WelcomeScreen";
import "./App.css";
import AppFCM from "./AppFCM";

function Toast({ message, type, onClose }: any) {
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
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showVerifyScreen, setShowVerifyScreen] = useState(false);
  const [showWelcome, setShowWelcome] = useState<boolean | null>(true);

  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (user && user.emailVerified) {
        // ✅ Check Firestore xem user đã có hồ sơ chưa
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);
        setShowWelcome(!snap.exists());
        setIsLoggedIn(true);
      } else {
        setIsLoggedIn(false);
        setShowWelcome(false);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) return <Loading />;

  if (showVerifyScreen) {
    return (
      <>
        <VerifyEmailScreen
          onBackToLogin={() => setShowVerifyScreen(false)}
          showToast={showToast}
        />
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

  if (!isLoggedIn) {
    return (
      <>
        <LoginScreen
          onLogin={setIsLoggedIn}
          onRequireVerify={() => setShowVerifyScreen(true)}
          showToast={showToast}
        />
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
  return (
    <>
      {!showWelcome && <MainScreen />}
      <AppFCM />
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      {showWelcome && (
        <>
          <WelcomeScreen
            onLogin={() => setShowWelcome(false)}
            showToast={showToast}
          />
          {toast && (
            <Toast
              message={toast.message}
              type={toast.type}
              onClose={() => setToast(null)}
            />
          )}
        </>
      )}
    </>
  );
}

export default App;
