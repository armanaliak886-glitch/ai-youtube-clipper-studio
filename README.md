# AI YouTube Clipper Studio

A bilingual (Hindi/English) mobile-friendly starter project for creators. It includes:
- YouTube link preview using the official embedded player.
- Upload of a video file you own or have permission to edit.
- MP4 trimming/export with FFmpeg.
- Gemini video analysis for clip suggestions, a best-effort transcript and timestamped captions (SRT download).
- AI dubbing script translation and generated voice audio; optional mux into a new MP4.
- Google AI Studio / Gemini API key connector.

## Important YouTube limitation

The YouTube URL field embeds the official player and can be used as an AI reference where Gemini's public-video URL support is available. It does **not** download or extract YouTube video/audio. The YouTube API policies prohibit offering downloads or separating/modifying YouTube audiovisual tracks through the API. To create an exported clip, upload a local video you own or have permission to edit.

## Run locally

Requires Node.js 20+ and FFmpeg support (the `ffmpeg-static` package supplies a binary on supported platforms).

```bash
npm install
cp .env.example .env
npm start
```

Open `http://localhost:3000`.

On Android, run the app on a hosted Node server and open its HTTPS URL in Chrome. The project is not an Android APK.

## Google AI Studio API key

1. Create a Gemini API key at https://aistudio.google.com/app/apikey.
2. Paste it into the API Connector field in the website.
3. The browser sends it to this server over the request header. The server uses it for that request and does not save or log it.
4. For a private deployment, you may instead set `GEMINI_API_KEY` in the host's environment/secrets panel.

Never paste a real key into `server.js`, `app.js`, `.env.example`, or GitHub. If you accidentally publish a key, revoke it and create a new one. Use HTTPS in production.

## GitHub upload from Android

1. Download and extract this ZIP on your phone.
2. Sign in to GitHub and create a new empty repository named `ai-youtube-clipper-studio`.
3. Use GitHub's web interface to upload the extracted project files and folders. Do not upload `.env`, `node_modules`, or generated videos.
4. For a live website, deploy the repository to a Node.js host that supports persistent app processes and FFmpeg. Configure the start command as `npm start`.
5. Add secrets/environment variables in the hosting dashboard if using server-side key storage.

## Notes and limitations

- Gemini model availability, quotas, free-tier limits, and pricing depend on the Google AI Studio project and can change. The default model names can be changed with `GEMINI_MODEL` and `GEMINI_TTS_MODEL`.
- The "Test API" button checks server health; the actual key is verified when an AI operation runs.
- Caption timestamps are AI estimates. Review and correct them before publishing.
- The dubbing flow generates a translated voiceover and can mux it as the new audio track. It does not preserve original dialogue/music under the new track.
- The generated voice may not match the original speaker. Obtain consent before imitating or replacing a real person's voice.
- Production deployments should add authentication, per-user quotas, rate limiting, automatic cleanup of old uploads/outputs, and stronger abuse controls.
- This is an original starter project, not a finished commercial SaaS. Test with short videos first.
