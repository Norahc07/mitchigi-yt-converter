import { spawn } from 'child_process';
import path from 'path';

export default async function handler(req, res) {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'Missing URL parameter' });
    }

    const ytDlpPath = process.env.YTDLP_PATH || path.join(process.cwd(), 'yt-dlp.exe');
    const ffmpegPath = process.env.FFMPEG_PATH || path.join(process.cwd(), 'ffmpeg');

    try {
        const ytDlp = spawn(ytDlpPath, [
            '--ffmpeg-location', ffmpegPath,
            '-j',  // JSON format for video details
            '--no-check-certificate',
            url
        ]);

        let data = '';

        ytDlp.stdout.on('data', (chunk) => {
            data += chunk;
        });

        ytDlp.stderr.on('data', (chunk) => {
            console.error('yt-dlp error:', chunk.toString());
        });

        ytDlp.on('close', (code) => {
            if (code !== 0) {
                return res.status(500).json({ error: 'yt-dlp failed to fetch video details' });
            }

            try {
                const videoInfo = JSON.parse(data);
                if (!videoInfo.thumbnails || videoInfo.thumbnails.length === 0) {
                    return res.status(500).json({ error: 'No thumbnails available' });
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

    } catch (err) {
        console.error('API error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
