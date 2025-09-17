import { useState } from "react";
import { auth, db } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import type { User } from "./models/User";

interface LoginProps {
  onLogin: () => void;
}

function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [isRegister, setIsRegister] = useState<boolean>(false);

  const register = async () => {
    try {
      const res = await createUserWithEmailAndPassword(auth, email, password);
      const uid = res.user.uid;
      const user: User = { uid, name, email };
      await setDoc(doc(db, "users", uid), user);
      alert("Đăng ký thành công!");
      onLogin();
    } catch (err: any) {
      alert("Lỗi đăng ký: " + err.message);
    }
  };

  const login = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      alert("Đăng nhập thành công!");
      onLogin();
    } catch (err: any) {
      alert("Lỗi đăng nhập: " + err.message);
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

export default Login;
