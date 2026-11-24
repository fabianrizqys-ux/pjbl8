document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const submitBtn = document.getElementById('submitBtn');
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    const errorMessage = document.getElementById('errorMessage');

    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', () => {
            const isHidden = passwordInput.type === 'password';
            passwordInput.type = isHidden ? 'text' : 'password';
            togglePassword.classList.toggle('fa-eye');
            togglePassword.classList.toggle('fa-eye-slash');
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const username = document.getElementById('username').value;
            const password = passwordInput.value;

            errorMessage.style.display = 'none';
            errorMessage.textContent = '';

            submitBtn.querySelector('span').textContent = 'Verifying...';
            submitBtn.disabled = true;

            try {
                const response = await fetch('http://localhost:5000/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (response.ok) {
                    localStorage.setItem('userName', data.user.username);
                    if (data.user.email) {
                        localStorage.setItem('userEmail', data.user.email);
                    }
                    window.location.href = 'dashboard.html';
                } else {
                    errorMessage.textContent = data.error || 'Username atau Password salah!';
                    errorMessage.style.display = 'block';

                    submitBtn.querySelector('span').textContent = 'Login';
                    submitBtn.disabled = false;
                }
            } catch (err) {
                console.error(err);
                errorMessage.textContent = 'Tidak dapat terhubung ke server backend.';
                errorMessage.style.display = 'block';

                submitBtn.querySelector('span').textContent = 'Login';
                submitBtn.disabled = false;
            }
        });
    }
});

async function handleCredentialResponse(response) {
    const errorMessage = document.getElementById('errorMessage');
    if (errorMessage) {
        errorMessage.style.display = 'none';
        errorMessage.textContent = '';
    }

    try {
        // Ambil email langsung dari payload JWT Google sebagai cadangan utama
        const googlePayload = JSON.parse(atob(response.credential.split('.')[1]));

        const res = await fetch('http://localhost:5000/api/google-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: response.credential })
        });

        const data = await res.json();

        if (res.ok) {
            localStorage.setItem('userName', data.user.username || googlePayload.name);
            localStorage.setItem('userEmail', data.user.email || googlePayload.email);
            window.location.href = 'dashboard.html';
        } else {
            if (errorMessage) {
                errorMessage.textContent = data.error || 'Gagal login via Google.';
                errorMessage.style.display = 'block';
            }
        }
    } catch (err) {
        console.error('Google Login Fetch Error:', err);
        if (errorMessage) {
            errorMessage.textContent = 'Terjadi kesalahan saat verifikasi Google.';
            errorMessage.style.display = 'block';
        }
    }
}