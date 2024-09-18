const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const port = 3000;

// Middleware to parse incoming form data
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Serve static HTML (for frontend)
app.use(express.static('public'));

// Array of SMTP credentials
const smtpCredentials = [
  { user: process.env.SMTP_EMAIL_1, pass: process.env.SMTP_PASSWORD_1 },
  { user: process.env.SMTP_EMAIL_2, pass: process.env.SMTP_PASSWORD_2 },
  { user: process.env.SMTP_EMAIL_3, pass: process.env.SMTP_PASSWORD_3 },
  { user: process.env.SMTP_EMAIL_4, pass: process.env.SMTP_PASSWORD_4 },
  { user: process.env.SMTP_EMAIL_5, pass: process.env.SMTP_PASSWORD_5 },
  // Add more credentials here
];

// Function to create transporter based on the current SMTP credential
const createTransporter = (smtpCredential) => {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: smtpCredential.user,
      pass: smtpCredential.pass
    }
  });
};

// POST route to handle form submission and send emails
app.post('/send-email', async (req, res) => {
  const { to, subject, message } = req.body;
  const emailRecipients = Array.isArray(to) ? to : to.split(',');
  const batchSize = 2; // Define how many emails each SMTP credential should handle

  try {
    for (let i = 0; i < emailRecipients.length; i++) {
      const smtpIndex = Math.floor(i / batchSize) % smtpCredentials.length; // Cycle through credentials
      let transporter = createTransporter(smtpCredentials[smtpIndex]);

      // Email details
      let mailOptions = {
        from: `"Your Name" <${smtpCredentials[smtpIndex].user}>`,
        to: to, // current recipient
        subject: subject, // subject from the form
        text: message, // message from the form
      };

      // Send email
      await transporter.sendMail(mailOptions);
      console.log(`Email sent to: ${emailRecipients[i]}`);
    }

    res.status(200).json({ message: 'All emails sent successfully!' });
  } catch (error) {
    res.status(500).json({ message: 'Error sending emails.', error: error.message });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
