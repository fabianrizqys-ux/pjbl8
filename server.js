const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/db_narkoba'
});

// Temporary memory store untuk kode verifikasi (OTP) reset password
const resetCodes = {};

// Konfigurasi Nodemailer untuk mengirim email asli (menggunakan Gmail dari .env)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Test DB Connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Database connected successfully');
    }
});

// Register
app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;
    try {
        const checkUser = await pool.query('SELECT * FROM users WHERE username = $1 OR email = $2', [username, email]);
        if (checkUser.rows.length > 0) {
            return res.status(400).json({ error: 'Username atau Email sudah terdaftar!' });
        }
        await pool.query(
            'INSERT INTO users (username, email, password, quiz_score) VALUES ($1, $2, $3, 0)',
            [username, email, password]
        );
        res.status(201).json({ message: 'Registrasi berhasil!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1 AND password = $2', [username, password]);
        if (result.rows.length > 0) {
            res.json({ success: true, user: result.rows[0] });
        } else {
            res.status(401).json({ error: 'Username atau Password salah!' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
    }
});

// Google Login Endpoint
app.post('/api/google-login', async (req, res) => {
    const { token } = req.body;
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        
        const googlePayload = JSON.parse(jsonPayload);
        const email = googlePayload.email;
        const name = googlePayload.name || email.split('@')[0];

        let userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        
        if (userResult.rows.length === 0) {
            const insertResult = await pool.query(
                'INSERT INTO users (username, email, password, quiz_score) VALUES ($1, $2, $3, 0) RETURNING *',
                [name, email, 'GOOGLE_AUTH_USER']
            );
            userResult = insertResult;
        }

        res.json({ success: true, user: userResult.rows[0] });
    } catch (err) {
        console.error('Google Auth Error:', err);
        res.status(400).json({ error: 'Gagal verifikasi token Google.' });
    }
});

// Step 1: Kirim Kode Verifikasi (OTP) ke Email Pengguna
app.post('/api/send-reset-code', async (req, res) => {
    const { email } = req.body;
    try {
        const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Email tidak ditemukan di database.' });
        }

        // Generate kode acak 4 digit
        const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
        resetCodes[email] = verificationCode;

        // Kirim email menggunakan Nodemailer
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Kode Verifikasi Reset Password - Edukasi Anti Narkoba',
            text: `Halo, kode verifikasi untuk mereset password akun kamu adalah: ${verificationCode}. Jangan berikan kode ini kepada siapa pun.`
        };

        await transporter.sendMail(mailOptions);

        res.json({ 
            success: true, 
            message: `Kode verifikasi telah dikirim ke email ${email}. Silakan cek inbox atau folder spam.` 
        });
    } catch (err) {
        console.error('Gagal mengirim email:', err);
        res.status(500).json({ error: 'Gagal mengirim email verifikasi. Periksa konfigurasi EMAIL_USER & EMAIL_PASS di file .env.' });
    }
});

// Step 2: Verifikasi Kode & Ubah Password
app.post('/api/forgot-password', async (req, res) => {
    const { email, code, newPassword } = req.body;
    try {
        // Cek kecocokan kode verifikasi
        if (!resetCodes[email] || resetCodes[email] !== code) {
            return res.status(400).json({ error: 'Kode verifikasi salah atau sudah kedaluwarsa!' });
        }

        const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Email tidak ditemukan di database.' });
        }

        // Update password baru di database Neon
        await pool.query('UPDATE users SET password = $1 WHERE email = $2', [newPassword, email]);
        
        // Hapus kode verifikasi dari memori setelah sukses digunakan
        delete resetCodes[email];

        res.json({ message: 'Password berhasil diubah! Mengarahkan ke halaman login...' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
    }
});

// Save / Update Quiz Score Endpoint
app.post('/api/save-score', async (req, res) => {
    const { email, score } = req.body;
    try {
        if (!email) {
            return res.status(400).json({ error: 'Email tidak valid.' });
        }

        await pool.query(
            'UPDATE users SET quiz_score = GREATEST(COALESCE(quiz_score, 0), $1) WHERE email = $2',
            [score, email]
        );

        res.json({ success: true, message: 'Skor berhasil disimpan ke database!' });
    } catch (err) {
        console.error('Error saving score:', err);
        res.status(500).json({ error: 'Terjadi kesalahan pada server saat menyimpan skor.' });
    }
});

// Get User Score Endpoint
app.get('/api/get-score', async (req, res) => {
    const { email } = req.query;
    try {
        const result = await pool.query('SELECT quiz_score FROM users WHERE email = $1', [email]);
        if (result.rows.length > 0) {
            res.json({ success: true, quiz_score: result.rows[0].quiz_score || 0 });
        } else {
            res.status(404).json({ error: 'User tidak ditemukan.' });
        }
    } catch (err) {
        console.error('Error fetching score:', err);
        res.status(500).json({ error: 'Kesalahan server.' });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});