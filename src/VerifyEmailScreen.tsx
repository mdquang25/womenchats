import { useState, useEffect } from "react";
import { auth } from "./firebase";
import { sendEmailVerification } from "firebase/auth";

function VerifyEmailScreen({ onBackToLogin, showToast }: any) {
  const [cooldown, setCooldown] = useState(60);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const resendEmail = async () => {
    if (!auth.currentUser) return;
    try {
      await sendEmailVerification(auth.currentUser);
      showToast("Email xác thực đã được gửi lại!", "success");
      setCooldown(60);
    } catch (err: any) {
      showToast("Lỗi gửi email: " + err.message, "error");
    }
  };

  const checkVerified = async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload(); // cập nhật trạng thái
    if (auth.currentUser.emailVerified) {
      showToast("Xác thực thành công! Vui lòng đăng nhập lại.", "success");
      onBackToLogin(); // quay về login, lần sau login vào Main
    } else {
      showToast("Email vẫn chưa được xác thực.", "error");
    }
  };

  return (
    <div className="d-flex flex-column align-items-center justify-content-center vh-100 bg-light">
      <div
        className="card shadow-lg p-4 text-center"
        style={{ maxWidth: "420px" }}
      >
        <h4 className="text-primary fw-bold mb-3">Xác thực email</h4>
        <p>Chúng tôi đã gửi email xác thực đến địa chỉ của bạn.</p>

        <button
          className="btn btn-secondary w-100 mb-3"
          disabled={cooldown > 0}
          onClick={resendEmail}
        >
          {cooldown > 0 ? `Gửi lại sau ${cooldown}s` : "Gửi lại email xác thực"}
        </button>

        <button className="btn btn-success w-100 mb-3" onClick={checkVerified}>
          Tôi đã xác thực, kiểm tra lại
        </button>

        <button className="btn btn-primary w-100" onClick={onBackToLogin}>
          Quay về đăng nhập
        </button>
      </div>
    </div>
  );
}

export default VerifyEmailScreen;
