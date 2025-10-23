// src/AppFCM.tsx
import { useEffect } from "react";
import { messaging, getToken, onMessage } from "./firebase";
import { db, auth } from "./firebase";
import { doc, setDoc } from "firebase/firestore";

function AppFCM() {
  useEffect(() => {
    const initFCM = async () => {
      try {
        // 1️⃣ Xin quyền gửi thông báo
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          console.warn("❌ Người dùng chưa cho phép thông báo!");
          return;
        }

        // 2️⃣ Lấy FCM token của trình duyệt này
        const token = await getToken(messaging, {
          vapidKey:
            "BBE3YRzaBALXZBWJHnjvgTYQ8pV2r5xNEdJ-vhUQBEcWUC08kVaQlo-e6NNIp7xia8s2lFux7BKOPX5sTo6RYAk",
        });

        console.log("✅ Token FCM của trình duyệt:", token);

        // 3️⃣ Lưu token này vào Firestore để Functions sử dụng gửi thông báo
        const uid = auth.currentUser?.uid;
        if (uid && token) {
          await setDoc(doc(db, "fcmTokens", uid), { token }, { merge: true });
          console.log("✅ Token đã được lưu vào Firestore!");
        }

        // 4️⃣ Nhận thông báo realtime khi app đang mở
        onMessage(messaging, (payload) => {
          console.log("💬 Nhận thông báo khi đang mở:", payload);
          new Notification(payload.notification?.title ?? "Tin nhắn mới", {
            body: payload.notification?.body ?? "Bạn có tin nhắn mới",
            icon: "/icon.png",
          });
        });
      } catch (err) {
        console.error("🚨 Lỗi khởi tạo FCM:", err);
      }
    };

    initFCM();
  }, []);

  return null; // component không hiển thị gì
}

export default AppFCM;
