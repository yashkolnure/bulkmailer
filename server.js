const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const path = require('path');
const bodyParser = require('body-parser');
const User = require('./models/user'); // Adjust the path as needed
const WebSocket = require('ws');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const cors = require('cors');

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(cors());
app.use(express.static('public')); // Serve static files from the 'public' folder

// MongoDB connection// MongoDB connection
const mongoUri = 'mongodb+srv://yashkolnure:TYHOqElmpIsGzaBf@cluster1.d31hn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster1';

mongoose.connect(mongoUri)
    .then(() => {
        console.log('Connected to MongoDB');
        // No need to close the connection here
        run(); // Call your run function to fetch data or perform other initializations
    })
    .catch(err => console.error('Failed to connect to MongoDB', err));

async function run() {
    const database = mongoose.connection.db; // Access the connected database
    const collection = database.collection('your_collection_name'); // Replace with your collection name

    try {
        const data = await collection.find().toArray();
        console.log(data);
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

// (Rest of your server code remains unchanged)

// JWT Authentication Middleware
const authenticateUser = (req, res, next) => {
  const token = req.cookies.authToken; // Check for the auth token in cookies
  if (!token) {
    return res.redirect('/login'); // Redirect to login if no token is found
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // Verify the token
    req.user = decoded; // Attach user info to the request object
    next(); // Proceed to the next middleware
  } catch (err) {
    return res.redirect('/login'); // Redirect to login if token verification fails
  }
};

// Routes
app.get('/', (req, res) => {
  const token = req.cookies.authToken;
  if (token) {
    try {
      jwt.verify(token, process.env.JWT_SECRET); // Check if the token is valid
      return res.sendFile(path.join(__dirname, 'private', 'index.html')); // Serve index.html
    } catch (err) {
      return res.sendFile(path.join(__dirname, 'public', 'login.html')); // Serve login.html on token failure
    }
  } else {
    return res.sendFile(path.join(__dirname, 'public', 'login.html')); // Serve login.html if no token exists
  }
});

// In your server.js or app.js check user is logged in or not
app.get('/check-login', (req, res) => {
  if (req.isAuthenticated()) {
      return res.sendStatus(200); // User is logged in
  }
  return res.sendStatus(401); // User is not logged in
});

// upload smtp cred to server
app.post('/upload-smtp', authenticateUser, async (req, res) => {
  const { index, host, port, user, pass } = req.body;

  try {
      // Assuming you have a user model with smtpCredentials field
      const user = await User.findById(req.user.id); // Get the authenticated user
      user.smtpCredentials[index] = { host, port, user, pass }; // Update the specified index
      await user.save(); // Save changes to the user
      res.status(200).json({ message: 'SMTP credential uploaded successfully!' });
  } catch (error) {
      console.error('Error saving SMTP credentials:', error);
      res.status(500).json({ message: 'Failed to upload SMTP credentials' });
  }
});

// Handle user registration
app.post('/register', async (req, res) => {
  const { email, password } = req.body;

  // Check if the user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).send('User already exists');
  }

  // Hash the password and create a new user
  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = new User({
    email,
    password: hashedPassword,
  });

  try {
    await newUser.save();
    res.status(201).send('User registered successfully');
  } catch (error) {
    res.status(500).send('Error registering user');
  }
});

// Login route
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Check if the user exists
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(400).send('Invalid email or password'); // Invalid user
  }

  // Verify the password using bcrypt
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(400).send('Invalid email or password'); // Incorrect password
  }

  // Generate JWT and set it as a cookie
  const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });
  res.cookie('authToken', token, { httpOnly: true });

  // Redirect to the main page after successful login
  res.redirect('/');
});

// Logout route
app.get('/logout', (req, res) => {
  res.clearCookie('authToken'); // Remove the auth token from cookies
  res.redirect('/login'); // Redirect to login page after logout
});

// Dashboard route (protected)
app.get('/dashboard', authenticateUser, (req, res) => {
  res.send(`Welcome, ${req.user.email}! This is the dashboard.`); // Display user's email or other info
});

// WebSocket setup
const server = app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

const wss = new WebSocket.Server({ server });

// Broadcast function to send messages to all connected clients
const broadcast = (message) => {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
};



// SMTP credentials
const smtpCredentials = [
  { user: process.env.SMTP_EMAIL_1, pass: process.env.SMTP_PASSWORD_1 },
  { user: process.env.SMTP_EMAIL_2, pass: process.env.SMTP_PASSWORD_2 },
  { user: process.env.SMTP_EMAIL_3, pass: process.env.SMTP_PASSWORD_3 },
  { user: process.env.SMTP_EMAIL_4, pass: process.env.SMTP_PASSWORD_4 },
  { user: process.env.SMTP_EMAIL_5, pass: process.env.SMTP_PASSWORD_5 },
  { user: process.env.SMTP_EMAIL_6, pass: process.env.SMTP_PASSWORD_6 },
  { user: process.env.SMTP_EMAIL_7, pass: process.env.SMTP_PASSWORD_7 },
  { user: process.env.SMTP_EMAIL_8, pass: process.env.SMTP_PASSWORD_8 },
  { user: process.env.SMTP_EMAIL_9, pass: process.env.SMTP_PASSWORD_9 },
  { user: process.env.SMTP_EMAIL_10, pass: process.env.SMTP_PASSWORD_10 },
  // Add more SMTP credentials as needed
];



// Create SMTP transporter
const createTransporter = (smtpCredential) => {
  return nodemailer.createTransport({
    host: 'smtp.hostinger.com',
    port: 465,
    secure: true,
    pool: true,
    maxConnections: 5,
    rateLimit: 5,
    connectionTimeout: 3 * 60 * 1000,
    socketTimeout: 3 * 60 * 1000,
    auth: {
      user: smtpCredential.user,
      pass: smtpCredential.pass
    }
  });
};

// Function to send emails with retry logic
const sendEmail = async (transporter, mailOptions, retries = 3) => {
  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email sent to: ${mailOptions.to}`);
    return true; // Indicate success
  } catch (error) {
    console.error(`Error sending email to ${mailOptions.to}: ${error.message}`);
    if (retries > 0) {
      console.log(`Retrying to send email... (${3 - retries + 1}/3)`);
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait before retrying
      return sendEmail(transporter, mailOptions, retries - 1);
    } else {
      console.error(`Failed to send email after 3 attempts: ${mailOptions.to}`);
      throw error;
    }
  }
};

// POST route to send emails
app.post('/send-email', authenticateUser, async (req, res) => {
  const { to, subject, message } = req.body;

  // Validate email recipients
  if (!to || !Array.isArray(to) || to.length === 0) {
    return res.status(400).json({ message: 'No recipients defined' });
  }

  const batchSize = 5; // Define how many emails each SMTP credential should handle

  try {
    for (let i = 0; i < to.length; i++) {
      const smtpIndex = Math.floor(i / batchSize) % smtpCredentials.length; // Cycle through credentials
      const transporter = createTransporter(smtpCredentials[smtpIndex]);

      // Email details
      const mailOptions = {
        from: `"Your Name" <${smtpCredentials[smtpIndex].user}>`,
        to: to[i], // current recipient
        subject: subject,
        html: message,
      };

      // Send email with retry logic
      await sendEmail(transporter, mailOptions);
      broadcast(`Email sent to: ${to[i]}`); // Broadcast success message

      // Add a delay between each email
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    res.status(200).json({ message: 'All emails sent successfully!' });
  } catch (error) {
    console.error(`Error sending email: ${error.message}`);
    res.status(500).json({ message: 'Error sending emails.', error: error.message });
  }
});

// WebSocket example
wss.on('connection', (ws) => {
  console.log('Client connected');
  ws.on('message', (message) => {
    console.log(`Received: ${message}`);
    broadcast(`Server: ${message}`); // Echo message back to all clients
  });
});
