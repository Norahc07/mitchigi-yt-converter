import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export default function handler(req, res) {
  const { url, format } = req.query;

  if (!url || !format) {
    return res.status(400).json({ error: 'Missing URL or format parameter' });
  }

  const streamOptions = format === 'mp3' 
    ? ['-x', '--audio-format', 'mp3'] 
    : ['-f', 'bestvideo+bestaudio/best']; // For MP4, download both video and audio streams
  
  const ytDlpPath = process.env.YTDLP_PATH || path.join(process.cwd(), 'yt-dlp.exe');
  const ytDlpDownload = spawn(ytDlpPath, [...streamOptions, '--no-check-certificate', '-o', '%(title)s.%(ext)s', url]);

  let title = '';
  let finalFilePath = '';

  ytDlpDownload.stdout.on('data', (chunk) => {
    if (!title) {
      const match = chunk.toString().match(/(.*)\.mp4/); 
      if (match) {
        title = match[1];
        finalFilePath = path.join(process.cwd(), `${title}.${format}`);
      }
    }
  });

  ytDlpDownload.stderr.on('data', (chunk) => {
    const match = chunk.toString().match(/(\d+)%/);
    if (match) {
      const percent = match[1];
      res.write(`data: ${percent}\n\n`); // Send progress to client
    }
  });

  ytDlpDownload.on('close', (code) => {
    if (code !== 0) {
      return res.status(500).json({ error: 'yt-dlp process failed during download' });
    }

    res.download(finalFilePath, () => {
      fs.unlinkSync(finalFilePath); // Cleanup
    });
  });
}
