const ALLOWED_ORIGINS = [
  "https://amantariq1.github.io",
  "http://localhost:3000",
  "http://localhost:5173",
];

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, function (char) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
  });
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function applyCors(req, res) {
  var origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.indexOf(origin) !== -1) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

module.exports = async function handler(req, res) {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ message: "Method not allowed." });
    return;
  }

  var name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  var email = typeof req.body.email === "string" ? req.body.email.trim() : "";
  var message = typeof req.body.message === "string" ? req.body.message.trim() : "";

  if (!name || !email || !message) {
    res.status(400).json({ message: "Please fill in your name, email, and message." });
    return;
  }
  if (!isEmail(email)) {
    res.status(400).json({ message: "Please enter a valid email address." });
    return;
  }
  if (name.length > 120 || email.length > 254 || message.length > 5000) {
    res.status(400).json({ message: "One of the fields is too long." });
    return;
  }

  var apiKey = process.env.RESEND_API_KEY;
  var toEmail = process.env.CONTACT_TO_EMAIL;
  var fromEmail = process.env.CONTACT_FROM_EMAIL || "Portfolio <onboarding@resend.dev>";

  if (!apiKey || !toEmail) {
    res.status(500).json({ message: "Email service is not configured." });
    return;
  }

  var safeName = escapeHtml(name);
  var safeEmail = escapeHtml(email);
  var safeMessage = escapeHtml(message).replace(/\n/g, "<br>");

  try {
    var response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        reply_to: email,
        subject: "Portfolio contact from " + name,
        html:
          "<p><strong>Name:</strong> " + safeName + "</p>" +
          "<p><strong>Email:</strong> " + safeEmail + "</p>" +
          "<p><strong>Message:</strong></p>" +
          "<p>" + safeMessage + "</p>",
        text: "Name: " + name + "\nEmail: " + email + "\n\n" + message,
      }),
    });

    if (!response.ok) {
      var detail = "";
      try {
        var data = await response.json();
        detail = data && (data.message || data.error) ? String(data.message || data.error) : "";
      } catch (error) {
        detail = "";
      }
      console.error("Resend error", response.status, detail);
      res.status(502).json({ message: "Could not send your message. Please try again later." });
      return;
    }

    res.status(200).json({ message: "Thanks! Your message has been sent." });
  } catch (error) {
    console.error("Send email failed", error);
    res.status(500).json({ message: "Could not send your message. Please try again later." });
  }
};