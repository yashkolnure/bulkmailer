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
const socketIo = require('socket.io');
const http = require('http');


const app = express();
const port = process.env.PORT || 3000;
const mongoUri = process.env.MONGO_URI;
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(cors());
app.use(express.static('public')); // Serve static files from the 'public' folder

// MongoDB connection
mongoose.connect(mongoUri)
    .then(() => {
        console.log('Connected to MongoDB');
        run(); // Call your run function to fetch data or perform other initializations
    })
    .catch(err => console.error('Failed to connect to MongoDB', err));

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
io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('sendEmail', (to) => {
        for (let i = 0; i < to.length; i++) {
            // Simulate email sending
            setTimeout(() => {
                io.emit('emailStatus', `Email sent to: ${to[i]}`);
            }, 1000 * i); // Delay for demonstration
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// Serve the main login page
app.get('/', (req, res) => {
    const token = req.cookies.authToken;
    if (token) {
        try {
            jwt.verify(token, process.env.JWT_SECRET); // Check if the token is valid
            return res.sendFile(path.join(__dirname, 'private', 'index.html')); // Serve your main HTML page
        } catch (err) {
            return res.sendFile(path.join(__dirname, 'public', 'login.html')); // Serve login.html on token failure
        }
    } else {
        return res.sendFile(path.join(__dirname, 'public', 'login.html')); // Serve login.html if no token exists
    }
});

// Serve login page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html')); // Ensure this path is correct
});

// Registration route
app.post('/register', async (req, res) => {
    const { username, email, password, smtpCredentials } = req.body;

    try {
        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create a new user
        const newUser = new User({
            username,
            email,
            password: hashedPassword,
            smtpCredentials
        });

        // Save user to the database
        await newUser.save();
        res.status(201).send('User registered successfully!');
    } catch (error) {
        console.error(error);
        res.status(500).send('Registration failed: ' + error.message);
    }
});

// Login route
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

// Email sending logic
const createTransporter = ({ user, pass, host, port }) => {
    return nodemailer.createTransport({
        host: host,
        port: port,
        secure: port === '465', // true for 465, false for other ports
        auth: {
            user: user,
            pass: pass,
        },
    });
};

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

    try {
        // Fetch user and their SMTP credentials
        const user = await User.findById(req.user.id).populate('smtpCredentials');
        if (!user || !user.smtpCredentials || user.smtpCredentials.length === 0) {
            return res.status(400).json({ message: 'No SMTP credentials found for the user.' });
        }

        const batchSize = 3; // Define how many emails each SMTP credential should handle

        for (let i = 0; i < to.length; i++) {
            const smtpIndex = Math.floor(i / batchSize) % user.smtpCredentials.length; // Cycle through credentials
            const smtpCredential = user.smtpCredentials[smtpIndex];

            // Create transporter with user-specific SMTP credentials
            const transporter = createTransporter({
                user: smtpCredential.email,
                pass: smtpCredential.password,
                host: smtpCredential.host,
                port: smtpCredential.port,
            });

            // Email details
            const mailOptions = {
                from: `"${user.username}" <${smtpCredential.email}>`,
                to: to[i], // Current recipient
                subject: subject,
                html: `
        <div>
            ${message}
            <br>
            <p style="font-size: small; color: gray;">This email is sent with <a href="https://birdmailer.in/">Birdmailer.in</a>.</p>
        </div>
    `,
            };

            // Send email with retry logic
            await sendEmail(transporter, mailOptions);
            // Broadcast success message
          broadcast(`Email sent to: ${to[i]}`);

          // Add a delay between each email
          await new Promise(resolve => setTimeout(resolve, 80));
      
        }

        res.status(200).json({ message: 'All emails sent successfully!' });
    } catch (error) {
        console.error(`Error sending email: ${error.message}`);
        res.status(500).json({ message: 'Error sending emails.', error: error.message });
    }
});

// WebSocket setup
// Start the server
server.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
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

// WebSocket example
wss.on('connection', (ws) => {
    console.log('Client connected');
    ws.on('message', (message) => {
        console.log(`Received: ${message}`);
        broadcast(`Server: ${message}`); // Echo message back to all clients
    });
});

// Run function to perform initial actions
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

