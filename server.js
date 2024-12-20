const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const app = express();
const port = 3000;

app.use(express.json());
app.use(cors());

app.use(express.static('public'));

// Serve the frontend (HTML) when accessing the root URL
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html'); // Replace with the path to your HTML file
});

// Fetch video details using yt-dlp
app.get('/video-details', (req, res) => {
    const { url } = req.query;

    // Call yt-dlp via spawn to fetch video info
    const ytDlp = spawn('yt-dlp', ['-j', '--no-check-certificate', url]);

    let data = '';

    ytDlp.stdout.on('data', (chunk) => {
        data += chunk;
    });

    ytDlp.on('close', () => {
        try {
            const videoInfo = JSON.parse(data);
            const thumbnail = videoInfo.thumbnails.pop().url;
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

// Handle downloads
app.get('/download', (req, res) => {
    const { url, format } = req.query;

    const streamOptions = format === 'mp3' ? ['-x', '--audio-format', 'mp3'] : [];

    // Set the correct content-type and file extension for MP4 or MP3
    const fileExtension = format === 'mp3' ? 'mp3' : 'mp4';
    const contentType = format === 'mp3' ? 'audio/mpeg' : 'video/mp4';

    // Set the content-disposition header to force download with the proper extension
    res.setHeader('Content-Disposition', `attachment; filename="video.${fileExtension}"`);
    res.setHeader('Content-Type', contentType);

    const ytDlp = spawn('yt-dlp', [
        ...streamOptions, 
        '--no-check-certificate', 
        url
    ]);

    ytDlp.stdout.pipe(res);  // Pipe the video or audio stream to the response

    ytDlp.stderr.on('data', (data) => {
        console.warn('yt-dlp stderr:', data.toString());
    });

    ytDlp.on('close', (code) => {
        if (code !== 0) {
            console.error(`yt-dlp process exited with code ${code}`);
            res.status(500).json({ error: 'Failed to download video' });
        }
    });

    ytDlp.on('error', (err) => {
        console.error('yt-dlp error:', err);
        res.status(500).json({ error: 'Failed to start yt-dlp process' });
    });
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
