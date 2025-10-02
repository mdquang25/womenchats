import { useState } from "react";
import { auth } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut,
} from "firebase/auth";

interface LoginScreenProps {
  onLogin: (bool: boolean) => void;
  onRequireVerify: () => void;
  showToast: (message: string, type: "success" | "error") => void;
}

function LoginScreen({
  onLogin,
  onRequireVerify,
  showToast,
}: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  // const [checked, setChecked] = useState(false);
  // const [err1, setErr1] = useState(null);
  // const [err2, setErr2] = useState(null);
  // const [err3, setErr3] = useState(null);
  // UC-01: Đăng ký

  const toggleShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const toggleShowConfirmPassword = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  const register = async () => {
    // setChecked(true);
    if (password !== confirmPassword) {
      showToast("Mật khẩu không khớp!", "error");
      return;
    }
    try {
      const res = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(res.user);

      showToast(
        "Đăng ký thành công! Vui lòng kiểm tra email để xác thực.",
        "success"
      );
      await signOut(auth);

      onLogin(false);
      setIsRegister(false);
    } catch (err: any) {
      const errorMessage =
        err.code === "auth/password-does-not-meet-requirements"
          ? "Mật khẩu không đủ mạnh!"
          : err.code === "auth/email-already-in-use"
          ? "Email đã được sử dụng!"
          : err.code === "auth/invalid-email"
          ? "Email không hợp lệ!"
          : err.code === "auth/missing-password"
          ? "Vui lòng nhập mật khẩu!"
          : err.code === "auth/missing-email"
          ? "Vui lòng nhập email!"
          : "Lỗi đăng ký: " + err.message;
      showToast(errorMessage, "error");
    }
  };

  // UC-02: Đăng nhập
  const login = async () => {
    try {
      const res = await signInWithEmailAndPassword(auth, email, password);

      if (!res.user.emailVerified) {
        showToast("Email chưa xác thực, vui lòng kiểm tra hộp thư.", "error");
        onRequireVerify();
        return;
      }
      showToast("Đăng nhập thành công!", "success");
      onLogin(true);
    } catch (err: any) {
      console.log(err.message);
      showToast("Lỗi đăng nhập: tài khoản hoặc mật khẩu không đúng!", "error");
    }
  };

  return (
    <div className="d-flex align-items-center justify-content-around flex-sm-row flex-column vh-100 bg-light">
      <div className="text-center">
        <img
          src="logo_womenchats.png"
          alt="WomenChats Logo"
          className="img-fluid mb-4"
          style={{ maxWidth: "150px" }}
        />
        <div className="mb-4">
          <h1 className="display-5 fw-bold">WomenChats</h1>
          <p className="text-muted">Kết nối và trò chuyện cùng bạn bè!</p>
        </div>
      </div>
      <div
        className="card shadow-lg p-4"
        style={{ width: "100%", maxWidth: "420px" }}
      >
        <h3 className="text-center text-primary mb-4 fw-bold">
          {isRegister ? "Đăng ký tài khoản" : "Đăng nhập"}
        </h3>

        <div className="mb-3">
          <label className="form-label fw-semibold">Email</label>
          <input
            className="form-control border-0 shadow-sm"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value.trim())}
          />
        </div>

        <div className="mb-3">
          <label className="form-label fw-semibold">Mật khẩu</label>
          <div className="input-group border-0 shadow-sm">
            <input
              className="form-control border-0"
              type={showPassword ? "text" : "password"}
              placeholder="Nhập mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button className="btn" type="button" onClick={toggleShowPassword}>
              <i
                className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`}
              ></i>
            </button>
          </div>
        </div>
        {isRegister && (
          <div className="mb-3">
            <label className="form-label fw-semibold">Xác nhận mật khẩu</label>
            <div className="input-group border-0 shadow-sm">
              <input
                className={
                  `form-control` +
                  (password !== confirmPassword ? " is-invalid" : " is-valid")
                }
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Xác nhận mật khẩu"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <button
                className="btn"
                type="button"
                onClick={toggleShowConfirmPassword}
              >
                <i
                  className={`bi ${
                    showConfirmPassword ? "bi-eye-slash" : "bi-eye"
                  }`}
                ></i>
              </button>
            </div>
          </div>
        )}
        <button
          className="btn btn-primary w-100 mb-3 fw-semibold"
          onClick={isRegister ? register : login}
        >
          {isRegister ? "Đăng ký" : "Đăng nhập"}
        </button>

        <div className="text-center">
          <small>
            {isRegister ? "Đã có tài khoản? " : "Chưa có tài khoản? "}
            <button
              className="btn btn-link p-0 fw-semibold"
              onClick={() => setIsRegister(!isRegister)}
            >
              {isRegister ? "Đăng nhập" : "Đăng ký ngay"}
            </button>
          </small>
        </div>
      </div>
    </div>
  );
}

export default LoginScreen;
