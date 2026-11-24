document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    const submitBtn = document.getElementById('submitBtn');
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');

    togglePassword.addEventListener('click', () => {
        const isHidden = passwordInput.type === 'password';
        passwordInput.type = isHidden ? 'text' : 'password';
        togglePassword.classList.toggle('fa-eye');
        togglePassword.classList.toggle('fa-eye-slash');
    });

    registerForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const username = document.getElementById('username').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        submitBtn.querySelector('span').textContent = 'Registering...';
        submitBtn.disabled = true;

        try {
            const response = await fetch('http://localhost:5000/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('userName', username);
                localStorage.setItem('userEmail', email);
                alert('Akun berhasil dibuat dan disimpan ke database!');
                window.location.href = 'index.html';
            } else {
                alert(data.error || 'Gagal mendaftarkan akun.');
                submitBtn.querySelector('span').textContent = 'Register';
                submitBtn.disabled = false;
            }
        } catch (err) {
            console.error(err);
            alert('Tidak dapat terhubung ke server backend.');
            submitBtn.querySelector('span').textContent = 'Register';
            submitBtn.disabled = false;
        }
    });
});