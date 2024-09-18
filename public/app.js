document.getElementById('emailForm').addEventListener('submit', async (event) => {
    event.preventDefault();
  
    const to = document.getElementById('to').value.split(',').map(email => email.trim());
    const subject = document.getElementById('subject').value;
    const message = document.getElementById('message').value;
  
    const response = await fetch('/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to, subject, message }),
    });
  
    const result = await response.json();
    const resultDiv = document.getElementById('result');
  
    if (response.ok) {
      resultDiv.textContent = 'Email sent successfully!';
      resultDiv.style.color = 'green';
    } else {
      resultDiv.textContent = 'Error: ' + result.message;
      resultDiv.style.color = 'red';
    }
  });
  
  document.getElementById('csvFile').addEventListener('change', handleFileUpload);
document.getElementById('emailForm').addEventListener('submit', sendEmail);

// Handle CSV File Upload and Parse
function handleFileUpload(event) {
  const file = event.target.files[0]; // Get the uploaded file
  if (!file) {
    alert('Please upload a CSV file');
    return;
  }

  Papa.parse(file, {
    complete: function(results) {
      // Assuming the emails are in the first column of the CSV
      const emailList = results.data.map(row => row[0]).filter(Boolean); // Filters out empty rows
      document.getElementById('to').value = emailList.join(','); // Put emails into "to" field
    }
  });
}

// Send Email to Backend
function sendEmail(event) {
  event.preventDefault(); // Prevent form from reloading the page

  const to = document.getElementById('to').value;
  const subject = document.getElementById('subject').value;
  const message = document.getElementById('message').value;

  fetch('/api/send-email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ to, subject, message }), // Send emails, subject, and message to backend
  })
  .then(response => response.json())
  .then(data => {
    document.getElementById('result').innerText = 'Email sent successfully!';
  })
  .catch(error => {
    console.error('Error sending email:', error);
    document.getElementById('result').innerText = 'Error sending email.';
  });
}
