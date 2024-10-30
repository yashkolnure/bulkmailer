const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const http = require('http'); // Import HTTP module
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const socketIo = require('socket.io'); // Import Socket.IO
const path = require('path');
const bodyParser = require('body-parser');
require('dotenv').config();
const User = require('./models/user'); // Adjust the path as needed
const WebSocket = require('ws');
const cookieParser = require('cookie-parser');
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
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


const server = http.createServer(app);
// Handle socket connections

// MongoDB connection
mongoose.connect(mongoUri)
    .then(() => {
        console.log('Connected to MongoDB');
        run(); // Call your run function to fetch data or perform other initializations
    })
    .catch(err => console.error('Failed to connect to MongoDB', err));
    

    app.get('/register1111', (req, res) => {
        res.sendFile(path.join( 'public', 'register1111.html'));
    });
    


// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Directory to save uploaded files
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Unique file name
    }
});

const upload = multer({ storage: storage });

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


// Dashboard route (protected)
app.get('/dashboard', authenticateUser, (req, res) => {
    res.json({ message: `Welcome, ${req.user.email}!`, username: req.user.username }); // Send username along with the message
});



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
    res.redirect('/Index1.html'); // Redirect to main page after logout
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
        io.emit('mailStatus', `Email sent to: ${mailOptions.to}`);
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
                user: 'marketing20@avenirya.com', // Your authenticated email
                pass: mailpassadmin, // Password from environment variable
            },
        });

        await transporter.sendMail({
            from: '"Bird Mailer" <marketing20@avenirya.com>', // Use the authenticated email
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


let clients = [];

// Function to broadcast email sending progress to all connected clients
function broadcast(message) {
    clients.forEach(client => client.write(`data: ${message}\n\n`));
}

// SSE endpoint to listen for email sending updates
app.get('/email-status', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    clients.push(res); // Add the client to the list

    req.on('close', () => {
        clients = clients.filter(client => client !== res); // Remove client on disconnect
    });
});


// POST route to send emails
app.post('/send-email', authenticateUser, upload.single('attachment'), async (req, res) => {
    const { to, subject, message } = req.body;
    const attachment = req.file; // Get the uploaded file
    

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

        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        // Reset count if it's a new day
        if (user.emailsSentToday.date < todayStart) {
            user.emailsSentToday.count = 0;
            user.emailsSentToday.date = today;
        }

        const maxRetries = 2; // Maximum retries for a failed email
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
        
        <p style="font-size: small; color: gray;">This email is sent with <a href="https://birdmailer.in/">Birdmailer.in</a>.</p>
    </div>
            `,
              text: `\n\nThis email is sent with Birdmailer.in.`,
              attachments: attachment ? [{ // Only add the attachment if it exists
                filename: attachment.originalname,
                path: attachment.path
            }] : []
            };

            let retries = 0;
            let emailSent = false;

            while (retries < maxRetries && !emailSent) {
                try {
                    await sendEmail(transporter, mailOptions);
                    broadcast(`Email sent to: ${recipient}`);
                    socket.emit('emailStatus', `Email sent to: ${recipient}`);
                    emailSent = true;
                } catch (error) {
                    retries++;
                    console.error(`Error sending email to ${recipient}: ${error.message}`);
                    broadcast(`Error sending email to ${recipient}: ${error.message}. Retrying... (${retries}/${maxRetries})`);
                    socket.emit('emailStatus', `Error sending email to ${recipient}: ${error.message}. Retrying... (${retries}/${maxRetries})`);
                }
            }

            if (!emailSent) {
                console.error(`Failed to send email to ${recipient} after ${maxRetries} attempts. Skipping...`);
                broadcast(`Failed to send email to ${recipient} after ${maxRetries} attempts. Skipping...`);
                socket.emit('emailStatus', `Failed to send email to ${recipient} after ${maxRetries} attempts. Skipping...`); // Emit final failure
            }
        };

        // Parallelize email sending using a concurrency limit
        const concurrencyLimit = 1; // Adjust this based on your server capabilities
        const emailPromises = [];

        for (let i = 0; i < to.length; i++) {
            const smtpCredential = user.smtpCredentials[smtpIndex]; // Cycle through SMTP credentials
            emailPromises.push(sendMailWithRetries(to[i], smtpCredential));

            smtpIndex = (smtpIndex + 1) % smtpCount; // Rotate SMTP servers

            // Add a delay after each email is sent
            await delay(500); // Delay in milliseconds (e.g., 500 ms = 0.5 seconds)


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

        // Increment email sent count after all emails have been sent
        user.emailsSentToday.count += to.length; // Increment by the number of recipients
        await user.save(); // Save user to update count

        res.status(200).json({ message: 'All emails sent successfully!' });
    } catch (error) {
        console.error(`Error sending emails: ${error.message}`);
        res.status(500).json({ message: 'Error sending emails.', error: error.message });
    }
});

const io = require('socket.io')(server); // Ensure you have your server instance
io.on('connection', (socket) => {
    // Your socket event listeners go here
    socket.on('sendEmail', () => {
        // Handle sending email
    });
});
io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('sendEmail', () => {
        // Your email sending logic here
        console.log('Email sending triggered');
    });
    socket.on('sendEmail', () => {
        sendEmailWithRetries(transporter, mailOptions, recipient, socket);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});


// Express API endpoint
app.get('/api/smtp-settings', authenticateUser, async (req, res) => {
    try {
        const user = await User.findById(req.user.id); // Find the authenticated user
        if (!user || !user.smtpCredentials) {
            return res.status(404).json({ message: 'No SMTP settings found.' });
        }
        res.json(user.smtpCredentials); // Return the SMTP credentials
    } catch (error) {
        console.error('Error fetching SMTP settings:', error);
        res.status(500).json({ message: 'Error fetching SMTP settings' });
    }
});


// Endpoint to get SMTP usage data for the authenticated user
app.get('/api/smtp-usage', authenticateUser, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate('smtpCredentials');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const smtpConnections = user.smtpCredentials.length; // Number of SMTP connections
        const emailsSentToday = user.emailsSentToday.count; // Emails sent today
        const dailyLimit = 2000; // Set your daily limit

        res.json({
            smtpConnections,
            emailsSentToday,
            dailyLimit
        });
    } catch (error) {
        console.error('Error fetching SMTP usage:', error);
        res.status(500).json({ message: 'Error fetching SMTP usage' });
    }
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

server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});