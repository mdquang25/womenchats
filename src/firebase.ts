import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// 🔹 Cấu hình Firebase (lấy từ Firebase Console)
const firebaseConfig = {
  apiKey: "AIzaSyBfz-ubf9rjW3OZK8K1cHlWNGrX7fkCnVY",
  authDomain: "projectchat3-b0aa1.firebaseapp.com",
  databaseURL: "https://projectchat3-b0aa1-default-rtdb.firebaseio.com",
  projectId: "projectchat3-b0aa1",
  storageBucket: "projectchat3-b0aa1.firebasestorage.app",
  messagingSenderId: "635801605784",
  appId: "1:635801605784:web:465156ac9f895fecae62ed"
};

// 🔹 Khởi tạo Firebase
const app = initializeApp(firebaseConfig);

// 🔹 Export các dịch vụ
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
