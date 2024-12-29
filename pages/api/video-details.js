import { exec } from 'child_process';
import path from 'path';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    try {
      // Use environment variables to get the binary paths (ensure these are set correctly on Vercel)
      const ytDlpPath = process.env.YTDLP_PATH || path.join(process.cwd(), 'bin', 'yt-dlp_linux');
      const ffmpegPath = process.env.FFMPEG_PATH || path.join(process.cwd(), 'bin', 'ffmpeg');

      // Debugging output to check if the paths are correct
      console.log('yt-dlp path:', ytDlpPath);
      console.log('ffmpeg path:', ffmpegPath);

      const command = `${ytDlpPath} -j ${url}`;

      exec(command, (error, stdout, stderr) => {
        if (error || stderr) {
          console.error('Error executing yt-dlp:', error || stderr);
          return res.status(500).json({ error: 'Failed to fetch video details' });
        }

        try {
          const videoDetails = JSON.parse(stdout);
          return res.status(200).json(videoDetails);
        } catch (err) {
          console.error('Error parsing yt-dlp output:', err);
          return res.status(500).json({ error: 'Failed to parse video details' });
        }
      });
    } catch (err) {
      console.error('Error:', err);
      return res.status(500).json({ error: 'Failed to fetch video details' });
    }
  } else {
    res.status(405).json({ error: 'Method Not Allowed' });
  }
}
