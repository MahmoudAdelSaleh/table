// auth.js

// --- وظائف مساعدة ---
function showAlert(message) {
    // يمكنك استخدام modal مخصص هنا إذا أردت
    alert(message);
}

// --- وظائف رئيسية ---
function toggleForms() {
    document.getElementById('login-form').classList.toggle('hidden');
    document.getElementById('register-form').classList.toggle('hidden');
}

function registerUser() {
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const phone = document.getElementById('register-phone').value;
    const password = document.getElementById('register-password').value;

    if (!name || !email || !password || !phone) {
        showAlert("يرجى ملء جميع الحقول.");
        return;
    }

    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            const user = userCredential.user;
            
            // تحديث ملف المستخدم بالاسم
            user.updateProfile({
                displayName: name
            }).then(() => {
                // تخزين بيانات المستخدم الإضافية في Firestore
                db.collection("users").doc(user.uid).set({
                    name: name,
                    email: email,
                    phone: phone,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                })
                .then(() => {
                    showAlert("تم إنشاء حسابك بنجاح! سيتم توجيهك الآن.");
                    window.location.href = 'scheduler.html';
                });
            });
        })
        .catch((error) => {
            showAlert("حدث خطأ: " + error.message);
        });
}

function loginUser() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
        showAlert("يرجى إدخال البريد الإلكتروني وكلمة المرور.");
        return;
    }

    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            window.location.href = 'scheduler.html';
        })
        .catch((error) => {
            showAlert("فشل تسجيل الدخول: " + error.message);
        });
}

function sendPasswordReset() {
    const email = prompt("الرجاء إدخال بريدك الإلكتروني لاستعادة كلمة المرور:");
    if (email) {
        auth.sendPasswordResetEmail(email)
            .then(() => {
                showAlert("تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.");
            })
            .catch((error) => {
                showAlert("حدث خطأ: " + error.message);
            });
    }
}

function logoutUser() {
    auth.signOut().then(() => {
        // سيقوم مراقب onAuthStateChanged في script.js بتوجيه المستخدم
        console.log("تم تسجيل الخروج بنجاح.");
    }).catch((error) => {
        console.error("خطأ في تسجيل الخروج:", error);
    });
}
