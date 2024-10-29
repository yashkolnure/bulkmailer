// Function to validate email format
function isValidEmail(email) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // Basic email regex
  return emailPattern.test(email);
}

// Event listener for email form submission
document.getElementById('emailForm').addEventListener('submit', async (event) => {
  event.preventDefault();

  const to = document.getElementById('to').value.split(',').map(email => email.trim());
  const subject = document.getElementById('subject').value;
  const message = document.getElementById('message').value;

  const validRecipients = to.filter(email => isValidEmail(email)); // Filter valid emails

  const response = await fetch('/send-email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ to: validRecipients, subject, message }),
  });

  const resultDiv = document.getElementById('result');

  if (response.ok) {
    const result = await response.json();
    resultDiv.innerHTML += `<span style="color: green;">${result.message}</span><br>`;
  } else {
    const result = await response.json();
    resultDiv.innerHTML += `<span style="color: red;">Error: ${result.message}</span><br>`;
  }
});

// WebSocket client setup
const socket = new WebSocket('wss://localhost:3000');
// Handle incoming messages from the server
socket.on('emailUpdate', (message) => {
  const updatesDiv = document.getElementById('updates');
  const messageElement = document.createElement('p');
  messageElement.textContent = message; // Display the broadcast message
  updatesDiv.appendChild(messageElement);
});
// Handle CSV File Upload and Parse
document.getElementById('csvFile').addEventListener('change', handleFileUpload);

function handleFileUpload(event) {
  const file = event.target.files[0]; // Get the uploaded file
  if (!file) {
    alert('Please upload a CSV file');
    return;
  }

  Papa.parse(file, {
    complete: function(results) {
      const emailList = results.data
        .map(row => row[0]) // Assuming emails are in the first column
        .filter(email => isValidEmail(email)); // Filter out invalid emails
      document.getElementById('to').value = emailList.join(','); // Put valid emails into "to" field
    },
    header: false,
  });
}
