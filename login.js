document.addEventListener('DOMContentLoaded', () => {
    // استخدم المصادقة المجهولة من Firebase للسماح باستدعاء الدوال السحابية
    firebase.auth().signInAnonymously().catch((error) => {
        console.error("Anonymous sign-in failed:", error);
    });

    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('error-message');

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        errorMessage.textContent = '';

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        // --- قم بتغيير اسم المستخدم وكلمة المرور هنا ---
        const correctUsername = "mahmoudadelsaleh@gmail.com";
        const correctPassword = "Almas&Ahmed";
        // ---------------------------------------------

        if (username === correctUsername && password === correctPassword) {
            // تم تسجيل الدخول بنجاح
            sessionStorage.setItem('isLoggedIn', 'true');
            window.location.href = 'index.html';
        } else {
            // بيانات الدخول خاطئة
            errorMessage.textContent = 'اسم المستخدم أو كلمة المرور غير صحيحة.';
        }
    });
});
