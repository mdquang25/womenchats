/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.6.1/firebase-messaging-compat.js");

firebase.initializeApp({
    apiKey: "AIzaSyBfz-ubf9rjW3OZK8K1cHlWNGrX7fkCnVY",
    authDomain: "projectchat3-b0aa1.firebaseapp.com",
    databaseURL: "https://projectchat3-b0aa1-default-rtdb.firebaseio.com",
    projectId: "projectchat3-b0aa1",
    storageBucket: "projectchat3-b0aa1.firebasestorage.app",
    messagingSenderId: "635801605784",
    appId: "1:635801605784:web:465156ac9f895fecae62ed",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
    console.log("Received background message: ", payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: "/logo_womenchats.png",
    };
    self.registration.showNotification(notificationTitle, notificationOptions);
});
