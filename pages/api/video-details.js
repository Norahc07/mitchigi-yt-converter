const { spawn } = require('child_process');
const path = require('path');

// Get binary paths from environment variables
const ytDlpPath = process.env.YTDLP_PATH || path.join(process.cwd(), 'bin', 'yt-dlp');
const ffmpegPath = process.env.FFMPEG_PATH || path.join(process.cwd(), 'bin', 'ffmpeg');

export default function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing URL parameter' });
  }

  console.log('Fetching video details for URL:', url);

  const cookiesPath = path.join(process.cwd(), 'cookies.txt');
  const ytDlp = spawn(ytDlpPath, [
    '--ffmpeg-location', ffmpegPath,
    '--cookies', cookiesPath,
    '-j',  // JSON format for video details
    '--no-check-certificate',
    '--restrict-filenames',
    url
  ]);

  let data = '';

  ytDlp.stdout.on('data', (chunk) => {
    data += chunk;
  });

  ytDlp.stderr.on('data', (chunk) => {
    console.error(`yt-dlp error: ${chunk.toString()}`);
  });

  ytDlp.on('close', (code) => {
    if (code !== 0) {
      console.error(`yt-dlp exited with code ${code}`);
      return res.status(500).json({ error: 'yt-dlp process failed. Check video URL or availability.' });
    }

    try {
      const videoInfo = JSON.parse(data);

      if (!videoInfo.thumbnails || videoInfo.thumbnails.length === 0) {
        throw new Error('No thumbnails available');
      }

      const thumbnail = videoInfo.thumbnails[videoInfo.thumbnails.length - 1].url;
      const title = videoInfo.title;

      return res.json({ thumbnail, title });
    } catch (err) {
      console.error('Error parsing yt-dlp output:', err);
      return res.status(500).json({ error: 'Failed to parse video details' });
    }
  });

  ytDlp.on('error', (err) => {
    console.error('yt-dlp error:', err);
    return res.status(500).json({ error: 'Failed to fetch video details' });
  });
}
