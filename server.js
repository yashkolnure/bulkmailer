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
const port = process.env.PORT || 3000;
const mongoUri = process.env.MONGO_URI;

// Middleware
app.use(bodyParser.json({ limit: '100mb' })); // Adjust the limit based on your needs
app.use(bodyParser.urlencoded({ limit: '100mb', extended: true }));
app.use(express.json());
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
        return res.redirect('/Index1.html'); // Redirect to login if no token is found
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET); // Verify the token
        req.user = decoded; // Attach user info to the request object
        next(); // Proceed to the next middleware
    } catch (err) {
        return res.redirect('/Index1.html'); // Redirect to login if token verification fails
    }
};


// Serve the main login page
app.get('/', (req, res) => {
    const token = req.cookies.authToken;
    if (token) {
        try {
            jwt.verify(token, process.env.JWT_SECRET); // Check if the token is valid
            return res.sendFile(path.join(__dirname, 'private', 'index.html')); // Serve your main HTML page
        } catch (err) {
            return res.sendFile(path.join(__dirname, 'public', 'Index1.html')); // Serve login.html on token failure
        }
    } else {
        return res.sendFile(path.join(__dirname, 'public', 'Index1.html')); // Serve login.html if no token exists
    }
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
    res.redirect('/index1.html'); // Redirect to main page after logout
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

const sendEmail = async (transporter, mailOptions, retries = 1) => {
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
const mailpassadmin = process.env.MAIL_PASS_ADMIN;

// Endpoint to handle form submission
app.post('/send-email-admin', async (req, res) => {
    const { name, email, message } = req.body;

    try {
        const transporter = nodemailer.createTransport({
            host: 'smtp.hostinger.com', // Your SMTP server details
            port: 465,
            secure: true, // true for port 465
            auth: {
                user: 'marketing1@avenirya.com', // Your authenticated email
                pass: mailpassadmin, // Password from environment variable
            },
        });

        await transporter.sendMail({
            from: '"Bird Mailer" <marketing1@avenirya.com>', // Use the authenticated email
            to: 'admin@avenirya.com, yashkolnure58@gmail.com', // List of receivers
            subject: 'New Contact Form Submission',
            text: `You have a new message from ${name} (${email}): ${message}`,
            html: `<p>You have a new message from <strong>${name}</strong> (${email}):</p><p>${message}</p>`,
        });

        res.status(200).send('Message sent successfully!');
    } catch (error) {
        console.error('Error sending email:', error); // Log the error message
        res.status(500).send('Error sending email: ' + error.message); // Send the error message
    }
});

// POST route to send emails
// POST route to send emails
app.post('/send-email', authenticateUser, async (req, res) => {
    const { to, subject, message } = req.body;

    // Validate email recipients
    if (!to || !Array.isArray(to) || to.length === 0) {
        return res.status(400).json({ message: 'No recipients defined' });
    }

    try {
        // Fetch user and their SMTP credentials from the database
        const user = await User.findById(req.user.id).populate('smtpCredentials');
        if (!user || !user.smtpCredentials || user.smtpCredentials.length === 0) {
            return res.status(400).json({ message: 'No SMTP credentials found for the user.' });
        }

        const maxRetries = 1; // Maximum retries for a failed email
        const smtpCount = user.smtpCredentials.length; // Get total number of SMTP servers

        if (smtpCount === 0) {
            return res.status(400).json({ message: 'No SMTP servers configured.' });
        }

        let smtpIndex = 0; // Index to cycle through SMTP servers

        // Function to send email with retries
        const sendMailWithRetries = async (recipient, smtpCredential) => {
            const transporter = createTransporter({
                user: smtpCredential.email,
                pass: smtpCredential.password,
                host: smtpCredential.host,
                port: smtpCredential.port,
            });

            const mailOptions = {
                from: `"${user.username}" <${smtpCredential.email}>`,
                to: recipient,
                subject: subject,
                replyTo: user.email,
                html: `
                    <div>
                        ${message}
                        <br>
                        <p style="font-size: small; color: gray;">This email is sent with <a href="https://birdmailer.in/">Birdmailer.in</a>.</p>
                    </div>
                `,
            };

            let retries = 0;
            let emailSent = false;

            while (retries < maxRetries && !emailSent) {
                try {
                    await sendEmail(transporter, mailOptions);
                    broadcast(`Email sent to: ${recipient}`);
                    emailSent = true;
                } catch (error) {
                    retries++;
                    console.error(`Error sending email to ${recipient}: ${error.message}`);
                    broadcast(`Error sending email to ${recipient}: ${error.message}. Retrying... (${retries}/${maxRetries})`);
                }
            }

            if (!emailSent) {
                console.error(`Failed to send email to ${recipient} after ${maxRetries} attempts. Skipping...`);
                broadcast(`Failed to send email to ${recipient} after ${maxRetries} attempts. Skipping...`);
            }
        };

        // Parallelize email sending using a concurrency limit
        const concurrencyLimit = 2; // Adjust this based on your server capabilities
        const emailPromises = [];

        for (let i = 0; i < to.length; i++) {
            const smtpCredential = user.smtpCredentials[smtpIndex]; // Cycle through SMTP credentials
            emailPromises.push(sendMailWithRetries(to[i], smtpCredential));

            smtpIndex = (smtpIndex + 1) % smtpCount; // Rotate SMTP servers

            // Once we reach the concurrency limit, wait for them to resolve before sending more
            if (emailPromises.length === concurrencyLimit) {
                await Promise.all(emailPromises); // Wait for the batch to complete
                emailPromises.length = 0; // Reset the batch
            }
        }

        // Send remaining emails
        if (emailPromises.length > 0) {
            await Promise.all(emailPromises);
        }

        res.status(200).json({ message: 'All emails sent successfully!' });
    } catch (error) {
        console.error(`Error sending emails: ${error.message}`);
        res.status(500).json({ message: 'Error sending emails.', error: error.message });
    }
});


// WebSocket setup
const server = app.listen(port, '0.0.0.0', () => {
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