// One-time local helper to obtain a YouTube Data API refresh token.
// Run locally (never in CI): YOUTUBE_CLIENT_ID=... YOUTUBE_CLIENT_SECRET=... npm run get-youtube-token
import http from "node:http";
import { google } from "googleapis";

const PORT = 53682;
const REDIRECT_URI = `http://127.0.0.1:${PORT}/oauth2callback`;

const { YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET } = process.env;

if (!YOUTUBE_CLIENT_ID || !YOUTUBE_CLIENT_SECRET) {
  console.error(
    "Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET env vars first (from your Google Cloud OAuth client), then re-run this script."
  );
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: ["https://www.googleapis.com/auth/youtube"],
});

console.log("\n1. Open this URL in a browser and approve access with the YouTube account/channel you want to post to:\n");
console.log(authUrl);
console.log(`\n2. Waiting for the redirect back to ${REDIRECT_URI} ...\n`);

const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith("/oauth2callback")) {
    res.writeHead(404);
    res.end();
    return;
  }
  const url = new URL(req.url, REDIRECT_URI);
  const code = url.searchParams.get("code");
  if (!code) {
    res.writeHead(400);
    res.end("Missing code parameter.");
    return;
  }
  try {
    const { tokens } = await oauth2Client.getToken(code);
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<html><body>Done — you can close this tab and return to the terminal.</body></html>");
    console.log("Success. Store this as the GitHub repo secret YOUTUBE_REFRESH_TOKEN:\n");
    console.log(tokens.refresh_token || "(no refresh_token returned — revoke prior access at https://myaccount.google.com/permissions and retry)");
  } catch (err) {
    res.writeHead(500);
    res.end("Token exchange failed, see terminal.");
    console.error("Token exchange failed:", err.message);
  } finally {
    server.close();
  }
});

server.listen(PORT);
