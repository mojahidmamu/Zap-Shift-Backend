const nodemailer = require('nodemailer');

const sendEmail = async ({ to, subject, html }) => {
  // Create transporter (use your email service)
  const transporter = nodemailer.createTransport({
    service: 'gmail', // or use SMTP
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: `"Delivery Service" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;