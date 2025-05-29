// server.js
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/send-otp', async (req, res) => {
  const { email, code } = req.body;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'anhminh20221@gmail.com',       // ✏️ Gmail của bạn
      pass: 'qvmg sbph muvx lycm',          // ✏️ Mật khẩu ứng dụng (app password)
    },
  });

  const mailOptions = {
    from: 'Zalo App <your_email@gmail.com>',
    to: email,
    subject: 'Mã xác thực OTP',
    text: `Mã OTP của bạn là: ${code}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Lỗi gửi email:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(3000, () => {
  console.log('✅ API gửi OTP đang chạy tại http://localhost:3000');
});
