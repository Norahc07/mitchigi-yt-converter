const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const app = express();
const port = 3000;

app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// Serve the frontend (HTML)
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Fetch video details
app.get('/video-details', (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'Missing URL parameter' });
    }

    console.log('Fetching video details for URL:', url);

    const ytDlp = spawn('yt-dlp', ['--cookies', 'path/to/cookies.txt', '-j', '--no-check-certificate','--restrict-filenames', url]);

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
            console.log('Raw yt-dlp output:', data); // Debugging
            const videoInfo = JSON.parse(data);

            if (!videoInfo.thumbnails || videoInfo.thumbnails.length === 0) {
                throw new Error('No thumbnails available');
            }

            const thumbnail = videoInfo.thumbnails[videoInfo.thumbnails.length - 1].url;
            const title = videoInfo.title;

            res.json({ thumbnail, title });
        } catch (err) {
            console.error('Error parsing yt-dlp output:', err);
            res.status(500).json({ error: 'Failed to parse video details' });
        }
    });

    ytDlp.on('error', (err) => {
        console.error('yt-dlp error:', err);
        res.status(500).json({ error: 'Failed to fetch video details' });
    });
});

// Download video
app.get('/download', (req, res) => {
    const { url, format } = req.query;

    if (!url || !format) {
        return res.status(400).json({ error: 'Missing URL or format parameter' });
    }

    const streamOptions = format === 'mp3' ? ['-x', '--audio-format', 'mp3'] : [];
    const fileExtension = format === 'mp3' ? 'mp3' : 'mp4';
    const contentType = format === 'mp3' ? 'audio/mpeg' : 'video/mp4';

    res.setHeader('Content-Disposition', `attachment; filename="video.${fileExtension}"`);
    res.setHeader('Content-Type', contentType);

    const ytDlp = spawn('yt-dlp', [...streamOptions, '--no-check-certificate', url]);

    ytDlp.stdout.pipe(res);

    ytDlp.on('error', (err) => {
        console.error('yt-dlp error:', err);
        res.status(500).json({ error: 'Failed to download video' });
    });

    ytDlp.on('close', (code) => {
        if (code !== 0) {
            console.error(`yt-dlp process exited with code ${code}`);
            res.status(500).json({ error: 'yt-dlp process failed' });
        }
    });
});

// Start server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
