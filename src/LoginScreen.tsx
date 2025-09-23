import { useState } from "react";
import { auth, db } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import type { User } from "./models/User";

interface LoginScreenProps {
  onLogin: (bool: boolean) => void;
  onRequireVerify: () => void; // 👈 điều hướng sang màn hình VerifyEmail
  showToast: (message: string, type: "success" | "error") => void;
}

function LoginScreen({
  onLogin,
  onRequireVerify,
  showToast,
}: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isRegister, setIsRegister] = useState(false);

  // UC-01: Đăng ký
  const register = async () => {
    try {
      const res = await createUserWithEmailAndPassword(auth, email, password);
      const uid = res.user.uid;

      // Lưu user
      const user: User = { uid, name, email };
      await setDoc(doc(db, "users", uid), user);

      // Gửi email xác thực
      await sendEmailVerification(res.user);

      showToast(
        "Đăng ký thành công! Vui lòng kiểm tra email để xác thực.",
        "success"
      );

      // Đăng xuất
      await signOut(auth);
      onLogin(false); // quay về login
      setIsRegister(false); // chuyển về tab login
    } catch (err: any) {
      showToast("Lỗi đăng ký: " + err.message, "error");
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
      showToast("Lỗi đăng nhập: " + err.message, "error");
    }
  };

  return (
    <div className="d-flex align-items-center justify-content-center vh-100 bg-light">
      <div
        className="card shadow-lg p-4"
        style={{ width: "100%", maxWidth: "420px" }}
      >
        <h3 className="text-center text-primary mb-4 fw-bold">
          {isRegister ? "Đăng ký tài khoản" : "Đăng nhập"}
        </h3>

        {isRegister && (
          <div className="mb-3">
            <label className="form-label fw-semibold">Tên hiển thị</label>
            <input
              className="form-control"
              placeholder="Tên"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        )}

        <div className="mb-3">
          <label className="form-label fw-semibold">Email</label>
          <input
            className="form-control"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="mb-3">
          <label className="form-label fw-semibold">Mật khẩu</label>
          <input
            className="form-control"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

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
